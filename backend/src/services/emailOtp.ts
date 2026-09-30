import { createHash, randomInt, randomUUID, timingSafeEqual } from 'crypto';
import nodemailer from 'nodemailer';
import { getAsync, runAsync } from '../db/database';

export type OtpPurpose = 'LOGIN' | 'REGISTER';

interface OtpChallenge {
  challenge_id: string;
  purpose: OtpPurpose;
  user_id: string | null;
  email: string;
  code_hash: string;
  expires_at: number;
  attempts: number;
  created_at: number;
}

function hashCode(code: string) {
  const pepper = process.env.OTP_HASH_SECRET || process.env.GMAIL_APP_PASSWORD;
  if (!pepper) throw new Error('Email OTP is not configured on the server.');
  return createHash('sha256').update(`${pepper}:${code}`).digest('hex');
}

function maskEmail(email: string) {
  const [name, domain] = email.split('@');
  return `${name.slice(0, 1)}${'*'.repeat(Math.max(2, Math.min(name.length - 1, 6)))}@${domain}`;
}

async function sendEmailOtp(email: string, code: string, purpose: OtpPurpose) {
  const username = process.env.GMAIL_USERNAME;
  const appPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '');
  if (!username || !appPassword) throw new Error('Email OTP is not configured on the server.');

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user: username, pass: appPassword }
  });

  const action = purpose === 'LOGIN' ? 'login' : 'register';
  const actionLabel = purpose === 'LOGIN' ? 'Login' : 'Register';
  const sentAt = new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata'
  }).format(new Date());
  const supportEmail = process.env.OTP_SUPPORT_EMAIL || 'your-support-email@example.com';
  const supportPhone = process.env.OTP_SUPPORT_PHONE || 'your-support-phone-number';

  try {
    await transporter.sendMail({
      from: username,
      to: email,
      subject: 'Your OTP to access Student Attendance Warning Automation App',
      text: [
        'Dear User,',
        '',
        `You are attempting to ${action} to your Student Attendance App Account.`,
        `Your One-Time Password (OTP) for validating your Account ${actionLabel} generated at ${sentAt} is:`,
        code,
        '',
        'This OTP is valid for 10 minutes and is not to be shared with anyone.',
        `If you did not initiate this request, please contact ${supportEmail} / ${supportPhone}`,
        '',
        'Regards,',
        'ADMIN Team',
        '',
        'This is an auto-generated email. Do not reply to this email.'
      ].join('\n'),
      html: `
        <p>Dear User,</p>
        <p>You are attempting to <strong>${action}</strong> to your Student Attendance App Account.</p>
        <p>Your One-Time Password (OTP) for validating your Account <strong>${actionLabel}</strong> generated at ${sentAt} is:</p>
        <p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p>
        <p>This OTP is valid for 10 minutes and is not to be shared with anyone.</p>
        <p>If you did not initiate this request, please contact ${supportEmail} / ${supportPhone}</p>
        <p>Regards,<br><strong>ADMIN Team</strong></p>
        <p><em>This is an auto-generated email. Do not reply to this email.</em></p>
      `
    });
  } catch {
    // Do not expose SMTP diagnostics or credentials to API callers.
    throw new Error('The verification email could not be sent. Check the Gmail SMTP configuration.');
  } finally {
    transporter.close();
  }
}

export async function createEmailOtp(email: string, purpose: OtpPurpose, userId: string | null) {
  const normalizedEmail = email.trim().toLowerCase();
  const now = Date.now();
  const recent = await getAsync<OtpChallenge>(
    `SELECT * FROM email_otp_challenges WHERE email = ? AND purpose = ? AND created_at > ? ORDER BY created_at DESC LIMIT 1`,
    [normalizedEmail, purpose, now - 60_000]
  );
  if (recent) throw new Error('Please wait one minute before requesting another code.');

  const code = randomInt(100000, 1000000).toString();
  const challengeId = randomUUID();
  await runAsync(`DELETE FROM email_otp_challenges WHERE email = ? AND purpose = ?`, [normalizedEmail, purpose]);
  await runAsync(
    `INSERT INTO email_otp_challenges (challenge_id, purpose, user_id, email, code_hash, expires_at, attempts, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    [challengeId, purpose, userId, normalizedEmail, hashCode(code), now + 10 * 60_000, now]
  );

  try {
    await sendEmailOtp(normalizedEmail, code, purpose);
  } catch (error) {
    await runAsync(`DELETE FROM email_otp_challenges WHERE challenge_id = ?`, [challengeId]);
    throw error;
  }

  return { challenge_id: challengeId, email_hint: maskEmail(normalizedEmail), expires_in_seconds: 600 };
}

export async function verifyEmailOtp(challengeId: string, code: string, purpose: OtpPurpose, expectedEmail?: string) {
  const challenge = await getAsync<OtpChallenge>(
    `SELECT * FROM email_otp_challenges WHERE challenge_id = ? AND purpose = ? LIMIT 1`,
    [challengeId, purpose]
  );
  if (!challenge || challenge.expires_at <= Date.now()) {
    if (challenge) await runAsync(`DELETE FROM email_otp_challenges WHERE challenge_id = ?`, [challengeId]);
    throw new Error('This verification code expired or is invalid. Request a new code.');
  }
  if (expectedEmail && challenge.email !== expectedEmail.trim().toLowerCase()) {
    throw new Error('The email does not match the address that received this code.');
  }
  if (challenge.attempts >= 5) {
    await runAsync(`DELETE FROM email_otp_challenges WHERE challenge_id = ?`, [challengeId]);
    throw new Error('Too many incorrect attempts. Request a new code.');
  }

  const receivedHash = Buffer.from(hashCode(code));
  const expectedHash = Buffer.from(challenge.code_hash);
  const matches = receivedHash.length === expectedHash.length && timingSafeEqual(receivedHash, expectedHash);
  if (!matches) {
    await runAsync(`UPDATE email_otp_challenges SET attempts = attempts + 1 WHERE challenge_id = ?`, [challengeId]);
    throw new Error('Incorrect verification code. Check your email and try again.');
  }

  await runAsync(`DELETE FROM email_otp_challenges WHERE challenge_id = ?`, [challengeId]);
  return challenge;
}
