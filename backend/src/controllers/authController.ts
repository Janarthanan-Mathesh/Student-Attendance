import { Request, Response } from 'express';
import { getAsync, runAsync, allAsync } from '../db/database';
import { z } from 'zod';
import { beginAuthenticatorEnrollment, beginAuthenticatorLogin, beginAuthenticatorRegistration, verifyAuthenticatorChallenge } from '../services/authenticator';
import { departmentCodeFromName, departmentCodeFromRoll, hasInstitutionEmail, STUDENT_DEPARTMENTS, validateStudentDepartmentIdentity } from '../services/departmentRules';

const RegisterSchema = z.object({
  name: z.string().min(2),
  register_no: z.string().min(3),
  email: z.string().email(),
  phone: z.string().min(5),
  role: z.enum(['STUDENT', 'FACULTY', 'PARENT']),
  department: z.string().min(2),
  section: z.string().optional().default('A'),
  parent_name: z.string().optional(),
  parent_phone: z.string().optional(),
  parent_email: z.string().optional(),
  mentor_name: z.string().optional().default('Mentor not assigned'),
  password: z.string().min(4)
});

const LoginSchema = z.object({
  identifier: z.string(), // email or register_no
  password: z.string().optional(),
  role: z.enum(['STUDENT', 'FACULTY', 'PARENT', 'ADMIN']).optional()
});

export async function registerUser(req: Request, res: Response) {
  try {
    const body = req.body || {};
    const registration = body.registration || body;
    const parse = RegisterSchema.safeParse(registration);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: parse.error.issues });
    }

    const { register_no, email, role } = parse.data;
    let department = parse.data.department;
    const normalizedEmail = email.trim().toLowerCase();

    if (!hasInstitutionEmail(normalizedEmail)) {
      return res.status(400).json({ success: false, error: 'Use your institutional email ending in @bitsathy.ac.in.' });
    }

    if (role === 'STUDENT') {
      const identity = validateStudentDepartmentIdentity(register_no, normalizedEmail, department);
      if (!identity.valid) return res.status(400).json({ success: false, error: identity.error });
      department = identity.name;
    }

    let lookupRegisterNo = register_no.trim().toUpperCase();
    if (role === 'PARENT') {
      const linkedRoll = lookupRegisterNo;
      const linkedCode = departmentCodeFromRoll(linkedRoll);
      if (!linkedCode) {
        return res.status(400).json({ success: false, error: 'Enter a valid student roll number in the 7376YY[1/2][department code][three digits] format.' });
      }
      const linkedStudent = await getAsync<{ department: string }>(`SELECT department FROM students WHERE upper(register_no) = ? LIMIT 1`, [linkedRoll]);
      if (!linkedStudent) return res.status(400).json({ success: false, error: 'No student with that roll number is in the roster yet.' });
      const actualCode = departmentCodeFromName(linkedStudent.department);
      if (actualCode !== linkedCode) return res.status(400).json({ success: false, error: 'The linked student roll number does not match the department in the roster.' });
      department = STUDENT_DEPARTMENTS[linkedCode].name;
      lookupRegisterNo = `PAR_${linkedRoll}`;
    }

    // CSV imports provision accounts in advance. Let the real account owner
    // enroll MFA using the exact existing account credentials, without making
    // a duplicate account or overwriting the roster data.
    const existing = await getAsync<{ user_id: string; register_no: string; email: string; role: string; password_hash: string }>(
      `SELECT user_id, register_no, email, role, password_hash FROM users WHERE upper(register_no) = ? OR lower(email) = ? LIMIT 1`,
      [lookupRegisterNo, normalizedEmail]
    );

    if (existing) {
      const matchesAccount = existing.role === role && existing.register_no.toUpperCase() === lookupRegisterNo && existing.email.toLowerCase() === normalizedEmail;
      if (!matchesAccount || existing.password_hash !== parse.data.password) {
        return res.status(400).json({ success: false, error: 'The existing account details do not match. Use the same role, ID, institutional email, and password used for this account.' });
      }
      const enrolled = await getAsync<{ user_id: string }>('SELECT user_id FROM user_authenticators WHERE user_id = ? LIMIT 1', [existing.user_id]);
      if (enrolled) {
        return res.status(409).json({ success: false, error: 'This account is already enrolled. Sign in and enter the current six-digit authenticator code.' });
      }
      const challenge = await beginAuthenticatorEnrollment(existing.user_id, normalizedEmail);
      return res.json({
        success: true,
        requires_authenticator_setup: true,
        existing_account: true,
        message: 'Verify your existing account, scan this QR code once, and enter the current six-digit code. You have five code attempts.',
        ...challenge
      });
    }

    const challenge = await beginAuthenticatorRegistration({
      ...parse.data,
      email: normalizedEmail,
      register_no: lookupRegisterNo,
      linked_student_roll: role === 'PARENT' ? register_no.trim().toUpperCase() : undefined,
      department
    });
    return res.json({
      success: true,
      requires_authenticator_setup: true,
      message: 'Scan this QR code with an authenticator app, then enter its six-digit code.',
      ...challenge
    });
  } catch (err: any) {
    const status = err.message.includes('expired') || err.message.includes('Incorrect') || err.message.includes('Too many') ? 400 : err.message.includes('Authenticator setup is not configured') ? 503 : 500;
    return res.status(status).json({ success: false, error: err.message });
  }
}

export async function verifyAuthenticatorRegistration(req: Request, res: Response) {
  try {
    const parsed = z.object({ challenge_id: z.string().uuid(), otp_code: z.string().regex(/^\d{6}$/) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Enter the six-digit code from your authenticator app.' });
    const user = await verifyAuthenticatorChallenge(parsed.data.challenge_id, parsed.data.otp_code, ['REGISTER', 'LOGIN_SETUP']);
    return res.json({ success: true, message: 'Authenticator verified. Your account is ready to sign in.', user });
  } catch (err: any) {
    const status = err.message.includes('expired') || err.message.includes('Incorrect') || err.message.includes('Too many') || err.message.includes('not valid for this flow') || err.message.includes('not valid for this account') ? 400 : 500;
    return res.status(status).json({ success: false, error: err.message });
  }
}

export async function loginUser(req: Request, res: Response) {
  try {
    const parse = LoginSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: parse.error.issues });
    }

    const { identifier, password, role } = parse.data;
    const candidates = await allAsync<any>(
      `SELECT DISTINCT u.* FROM users u
       LEFT JOIN students s ON s.student_id = u.user_id
       WHERE (upper(u.register_no) = ? OR lower(u.email) = ? OR lower(s.email) = ? OR u.user_id = ?)
         AND (? IS NULL OR u.role = ?)
       ORDER BY u.id DESC`,
      [identifier.trim().toUpperCase(), identifier.trim().toLowerCase(), identifier.trim().toLowerCase(), identifier.trim(), role || null, role || null]
    );
    const user = candidates.find((candidate) => password && candidate.password_hash === password);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: candidates.length ? 'Incorrect password.' : 'No account found with this Register No or Email. Please register as a first-time user.'
      });
    }

    if (user.role !== 'ADMIN' && !hasInstitutionEmail(user.email || '')) {
      return res.status(403).json({ success: false, error: 'This account must use an institutional @bitsathy.ac.in email. Contact the administrator to correct the roster email.' });
    }

    const authenticator = await beginAuthenticatorLogin(user.user_id);

    return res.json({
      success: true,
      requires_otp: !authenticator.requires_authenticator_setup,
      message: authenticator.requires_authenticator_setup
        ? 'Set up an authenticator app, then enter its six-digit code.'
        : 'Enter the current six-digit code from your authenticator app.',
      ...authenticator
    });
  } catch (err: any) {
    const status = err.message.includes('Authenticator setup is not configured') ? 503 : err.message.includes('No authenticator is registered') ? 403 : 500;
    return res.status(status).json({ success: false, error: err.message });
  }
}

export async function verifyLoginAuthenticator(req: Request, res: Response) {
  try {
    const parsed = z.object({ challenge_id: z.string().uuid(), otp_code: z.string().regex(/^\d{6}$/) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Enter the six-digit code from your authenticator app.' });
    const user = await verifyAuthenticatorChallenge(parsed.data.challenge_id, parsed.data.otp_code, 'LOGIN');
    return res.json({ success: true, message: `Welcome back, ${user.name}!`, user });
  } catch (err: any) {
    const status = err.message.includes('expired') || err.message.includes('Incorrect') || err.message.includes('Too many') || err.message.includes('not valid for this flow') ? 400 : 500;
    return res.status(status).json({ success: false, error: err.message });
  }
}

export async function beginAdminAuthenticatorSetup(req: Request, res: Response) {
  try {
    const parsed = z.object({ identifier: z.string().min(1), password: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Enter your admin ID or email and password.' });
    const identifier = parsed.data.identifier.trim();
    const candidates = await allAsync<any>(
      `SELECT * FROM users WHERE role = 'ADMIN' AND (upper(register_no) = ? OR lower(email) = ? OR user_id = ?)`,
      [identifier.toUpperCase(), identifier.toLowerCase(), identifier]
    );
    const admin = candidates.find((candidate) => candidate.password_hash === parsed.data.password);
    if (!admin) return res.status(401).json({ success: false, error: 'Admin ID/email or password is incorrect.' });

    const enrolled = await getAsync<{ user_id: string }>('SELECT user_id FROM user_authenticators WHERE user_id = ? LIMIT 1', [admin.user_id]);
    if (enrolled) return res.status(409).json({ success: false, error: 'An authenticator is already enrolled. Sign in with its current six-digit code.' });

    const challenge = await beginAuthenticatorEnrollment(admin.user_id, admin.email);
    return res.json({ success: true, requires_authenticator_setup: true, ...challenge });
  } catch (err: any) {
    const status = err.message.includes('Authenticator setup is not configured') ? 503 : 500;
    return res.status(status).json({ success: false, error: err.message });
  }
}

export async function verifyAdminAuthenticatorSetup(req: Request, res: Response) {
  try {
    const parsed = z.object({ challenge_id: z.string().uuid(), otp_code: z.string().regex(/^\d{6}$/) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Enter the current six-digit code from your authenticator app.' });
    const user = await verifyAuthenticatorChallenge(parsed.data.challenge_id, parsed.data.otp_code, 'LOGIN_SETUP', 'ADMIN');
    return res.json({ success: true, message: 'Admin authenticator enrolled successfully.', user });
  } catch (err: any) {
    const status = err.message.includes('expired') || err.message.includes('Incorrect') || err.message.includes('Too many') || err.message.includes('not valid for this flow') || err.message.includes('not valid for this account') ? 400 : 500;
    return res.status(status).json({ success: false, error: err.message });
  }
}

export async function updateProfile(req: Request, res: Response) {
  try {
    const { user_id, phone, email, parent_name, parent_phone, parent_email, department, section, mentor_name } = req.body;
    let effectiveDepartment = department;

    if (!user_id) {
      return res.status(400).json({ success: false, error: 'user_id is required' });
    }

    const existingUser = await getAsync<{ role: string; email: string; register_no: string; department: string }>(
      `SELECT role, email, register_no, department FROM users WHERE user_id = ? OR register_no = ? LIMIT 1`,
      [user_id, user_id]
    );
    if (existingUser && existingUser.role !== 'ADMIN') {
      const nextEmail = String(email || existingUser.email).trim().toLowerCase();
      if (!hasInstitutionEmail(nextEmail)) {
        return res.status(400).json({ success: false, error: 'Student, mentor, and parent accounts must use an @bitsathy.ac.in email.' });
      }
      if (existingUser.role === 'STUDENT') {
        const identity = validateStudentDepartmentIdentity(existingUser.register_no, nextEmail, String(department || existingUser.department));
        if (!identity.valid) return res.status(400).json({ success: false, error: identity.error });
        effectiveDepartment = identity.name;
      }
    }

    await runAsync(
      `UPDATE users 
       SET phone = COALESCE(?, phone),
           email = COALESCE(?, email),
           parent_name = COALESCE(?, parent_name),
           parent_phone = COALESCE(?, parent_phone),
           parent_email = COALESCE(?, parent_email),
           department = COALESCE(?, department),
           section = COALESCE(?, section),
           mentor_name = COALESCE(?, mentor_name)
       WHERE user_id = ? OR register_no = ?`,
      [phone, email, parent_name, parent_phone, parent_email, effectiveDepartment, section, mentor_name, user_id, user_id]
    );

    // Also update students table if exists
    await runAsync(
      `UPDATE students
       SET phone = COALESCE(?, phone),
           email = COALESCE(?, email),
           parent_name = COALESCE(?, parent_name),
           parent_phone = COALESCE(?, parent_phone),
           parent_email = COALESCE(?, parent_email),
           department = COALESCE(?, department),
           section = COALESCE(?, section),
           mentor_name = COALESCE(?, mentor_name)
       WHERE student_id = ? OR register_no = ?`,
      [phone, email, parent_name, parent_phone, parent_email, effectiveDepartment, section, mentor_name, user_id, user_id]
    );

    const updatedUser = await getAsync(`SELECT * FROM users WHERE user_id = ? OR register_no = ?`, [user_id, user_id]);

    return res.json({
      success: true,
      message: 'Profile updated successfully!',
      user: updatedUser
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
