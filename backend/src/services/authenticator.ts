import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import QRCode from 'qrcode';
import { getAsync, runAsync } from '../db/database';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_MS = 30_000;
const CHALLENGE_MS = 10 * 60_000;

interface AuthenticatorChallenge {
  challenge_id: string;
  user_id: string | null;
  purpose: 'LOGIN' | 'LOGIN_SETUP' | 'REGISTER';
  secret_encrypted: string;
  registration_json: string | null;
  expires_at: number;
  attempts: number;
}

function encryptionKey() {
  const secret = process.env.AUTHENTICATOR_ENCRYPTION_KEY;
  if (!secret) throw new Error('Authenticator setup is not configured on the server.');
  return createHash('sha256').update(secret).digest();
}

function encryptSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${encrypted.toString('base64')}`;
}

function decryptSecret(value: string) {
  const [ivText, tagText, encryptedText] = value.split('.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivText, 'base64'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, 'base64')), decipher.final()]).toString('utf8');
}

function encodeBase32(input: Buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

function decodeBase32(input: string) {
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of input.replace(/=+$/g, '').toUpperCase()) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw new Error('Invalid authenticator secret.');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

function makeTotp(secret: string, timeMs: number) {
  const counter = BigInt(Math.floor(timeMs / STEP_MS));
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(counter);
  const digest = createHmac('sha1', decodeBase32(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

function verifyTotp(secret: string, code: string) {
  if (!/^\d{6}$/.test(code)) return false;
  const received = Buffer.from(code);
  for (const drift of [-1, 0, 1]) {
    const expected = Buffer.from(makeTotp(secret, Date.now() + drift * STEP_MS));
    if (timingSafeEqual(received, expected)) return true;
  }
  return false;
}

async function prepareChallenge(args: {
  userId: string | null;
  purpose: AuthenticatorChallenge['purpose'];
  secret: string;
  registration?: unknown;
  email: string;
}) {
  const challengeId = randomUUID();
  const secretEncrypted = encryptSecret(args.secret);
  const uri = `otpauth://totp/${encodeURIComponent(`Student Attendance:${args.email}`)}?secret=${args.secret}&issuer=${encodeURIComponent('Student Attendance')}&algorithm=SHA1&digits=6&period=30`;
  const qrDataUrl = await QRCode.toDataURL(uri);
  await runAsync(
    `INSERT INTO authenticator_challenges (challenge_id, user_id, purpose, secret_encrypted, registration_json, expires_at, attempts)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    [challengeId, args.userId, args.purpose, secretEncrypted, args.registration ? JSON.stringify(args.registration) : null, Date.now() + CHALLENGE_MS]
  );
  return { challenge_id: challengeId, qr_data_url: qrDataUrl, setup_key: args.secret, expires_in_seconds: CHALLENGE_MS / 1000 };
}

export async function beginAuthenticatorRegistration(registration: any) {
  const secret = encodeBase32(randomBytes(20));
  return prepareChallenge({ userId: null, purpose: 'REGISTER', secret, registration, email: registration.email });
}

export async function beginAuthenticatorLogin(userId: string) {
  const configured = await getAsync<{ secret_encrypted: string }>(
    `SELECT secret_encrypted FROM user_authenticators WHERE user_id = ? LIMIT 1`, [userId]
  );
  if (configured) {
    const challengeId = randomUUID();
    await runAsync(
      `INSERT INTO authenticator_challenges (challenge_id, user_id, purpose, secret_encrypted, registration_json, expires_at, attempts)
       VALUES (?, ?, 'LOGIN', ?, NULL, ?, 0)`,
      [challengeId, userId, configured.secret_encrypted, Date.now() + CHALLENGE_MS]
    );
    return { challenge_id: challengeId, requires_authenticator_setup: false, expires_in_seconds: CHALLENGE_MS / 1000 };
  }
  throw new Error('No authenticator is registered for this account. Contact your administrator for account recovery; login cannot enroll a new authenticator.');
}

export async function verifyAuthenticatorChallenge(
  challengeId: string,
  code: string,
  expectedPurpose?: AuthenticatorChallenge['purpose']
) {
  const challenge = await getAsync<AuthenticatorChallenge>(
    `SELECT * FROM authenticator_challenges WHERE challenge_id = ? LIMIT 1`, [challengeId]
  );
  if (!challenge || challenge.expires_at <= Date.now()) {
    if (challenge) await runAsync(`DELETE FROM authenticator_challenges WHERE challenge_id = ?`, [challengeId]);
    throw new Error('Authenticator challenge expired. Start again.');
  }
  if (expectedPurpose && challenge.purpose !== expectedPurpose) {
    throw new Error('Authenticator challenge is not valid for this flow. Start again.');
  }
  if (challenge.attempts >= 5) {
    await runAsync(`DELETE FROM authenticator_challenges WHERE challenge_id = ?`, [challengeId]);
    throw new Error('Too many incorrect codes. Start again.');
  }
  const secret = decryptSecret(challenge.secret_encrypted);
  if (!verifyTotp(secret, code)) {
    await runAsync(`UPDATE authenticator_challenges SET attempts = attempts + 1 WHERE challenge_id = ?`, [challengeId]);
    throw new Error('Incorrect authenticator code. Check the current six-digit code and try again.');
  }

  let userId = challenge.user_id;
  if (challenge.purpose === 'REGISTER') {
    const registration = JSON.parse(challenge.registration_json || '{}');
    const {
      name, register_no, email, phone, role, department, section,
      parent_name, parent_phone, parent_email, mentor_name, password
    } = registration;
    const normalizedRegisterNo = String(register_no).trim().toUpperCase();
    userId = role === 'FACULTY'
      ? `FAC_${normalizedRegisterNo.replace(/[^A-Z0-9_-]/g, '_')}`
      : normalizedRegisterNo;
    const storedRegisterNo = role === 'FACULTY' ? normalizedRegisterNo : userId;
    const parentId = `PAR_${userId}`;
    await runAsync(
      `INSERT INTO users (user_id, name, register_no, email, phone, role, department, section, parent_name, parent_phone, parent_email, mentor_name, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, name, storedRegisterNo, String(email).toLowerCase(), phone, role, department, section || 'A', parent_name || 'N/A', parent_phone || 'N/A', parent_email || 'N/A', mentor_name || 'Mentor not assigned', password || 'password123']
    );
    if (role === 'STUDENT') {
      await runAsync(
        `INSERT INTO students (student_id, name, register_no, email, phone, parent_id, parent_name, parent_phone, parent_email, department, section, mentor_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(student_id) DO UPDATE SET name = excluded.name, email = excluded.email, phone = excluded.phone`,
        [userId, name, userId, String(email).toLowerCase(), phone, parentId, parent_name || 'Parent/Guardian', parent_phone || phone, parent_email || email, department, section || 'A', mentor_name || 'Mentor not assigned']
      );
      await runAsync(
        `INSERT INTO attendance_deficiency_records (student_id, course_code, total_conducted, total_attended, current_percentage, projected_percentage, classes_required_for_75, deficiency_status)
         VALUES (?, 'ATTENDANCE', 40, 36, 90.0, 91.0, 0, 'SAFE') ON CONFLICT(student_id, course_code) DO NOTHING`, [userId]
      );
    }
    if (role === 'PARENT' && registration.linked_student_roll) {
      await runAsync(
        `UPDATE students SET parent_name = ?, parent_phone = ?, parent_email = ? WHERE upper(register_no) = ?`,
        [name, phone, String(email).toLowerCase(), String(registration.linked_student_roll).toUpperCase()]
      );
    }
    await runAsync(
      `INSERT INTO audit_logs (action_type, performed_by, target_id, details) VALUES ('USER_REGISTRATION', ?, ?, ?)`,
      [name, userId, `Registered first-time account with role ${role} using authenticator verification`]
    );
    await runAsync(`INSERT INTO user_authenticators (user_id, secret_encrypted) VALUES (?, ?)`, [userId, challenge.secret_encrypted]);
  } else if (challenge.purpose === 'LOGIN_SETUP') {
    await runAsync(`INSERT INTO user_authenticators (user_id, secret_encrypted) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET secret_encrypted = excluded.secret_encrypted`, [userId, challenge.secret_encrypted]);
  }

  await runAsync(`DELETE FROM authenticator_challenges WHERE challenge_id = ?`, [challengeId]);
  if (!userId) throw new Error('Account setup failed. Please start again.');
  const user = await getAsync<any>(`SELECT * FROM users WHERE user_id = ? LIMIT 1`, [userId]);
  if (!user) throw new Error('Account not found.');
  if (challenge.purpose !== 'REGISTER') {
    await runAsync(`INSERT INTO audit_logs (action_type, performed_by, target_id, details) VALUES ('USER_LOGIN', ?, ?, ?)`, [user.name, user.user_id, `User logged in under role ${user.role} after authenticator verification`]);
  }
  const { password_hash: _passwordHash, ...safeUser } = user;
  return safeUser;
}
