import { Request, Response } from 'express';
import { getAsync, runAsync, allAsync } from '../db/database';
import { z } from 'zod';
import { beginAuthenticatorLogin, beginAuthenticatorRegistration, verifyAuthenticatorChallenge } from '../services/authenticator';

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
  password: z.string().min(4).optional().default('password123')
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

    const {
      name,
      register_no,
      email,
      phone,
      role,
      department,
      section,
      parent_name,
      parent_phone,
      parent_email,
      mentor_name,
      password
    } = parse.data;

    // Check if user already exists
    const existing = await getAsync(
      `SELECT user_id FROM users WHERE upper(register_no) = ? OR lower(email) = ? LIMIT 1`,
      [register_no.trim().toUpperCase(), email.trim().toLowerCase()]
    );

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'A user with this Register No or Email already exists. Please login instead.'
      });
    }

    const challenge = await beginAuthenticatorRegistration({
      ...parse.data,
      email: email.trim().toLowerCase(),
      register_no: register_no.trim().toUpperCase()
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
    const user = await verifyAuthenticatorChallenge(parsed.data.challenge_id, parsed.data.otp_code);
    return res.json({ success: true, message: 'Authenticator verified. Registration complete.', user });
  } catch (err: any) {
    const status = err.message.includes('expired') || err.message.includes('Incorrect') || err.message.includes('Too many') ? 400 : 500;
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

    const authenticator = await beginAuthenticatorLogin(user.user_id, user.email);

    return res.json({
      success: true,
      requires_otp: !authenticator.requires_authenticator_setup,
      message: authenticator.requires_authenticator_setup
        ? 'Set up an authenticator app, then enter its six-digit code.'
        : 'Enter the current six-digit code from your authenticator app.',
      ...authenticator
    });
  } catch (err: any) {
    const status = err.message.includes('Authenticator setup is not configured') ? 503 : 500;
    return res.status(status).json({ success: false, error: err.message });
  }
}

export async function verifyLoginAuthenticator(req: Request, res: Response) {
  try {
    const parsed = z.object({ challenge_id: z.string().uuid(), otp_code: z.string().regex(/^\d{6}$/) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Enter the six-digit code from your authenticator app.' });
    const user = await verifyAuthenticatorChallenge(parsed.data.challenge_id, parsed.data.otp_code);
    return res.json({ success: true, message: `Welcome back, ${user.name}!`, user });
  } catch (err: any) {
    const status = err.message.includes('expired') || err.message.includes('Incorrect') || err.message.includes('Too many') ? 400 : 500;
    return res.status(status).json({ success: false, error: err.message });
  }
}

export async function updateProfile(req: Request, res: Response) {
  try {
    const { user_id, phone, email, parent_name, parent_phone, parent_email, department, section, mentor_name } = req.body;

    if (!user_id) {
      return res.status(400).json({ success: false, error: 'user_id is required' });
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
      [phone, email, parent_name, parent_phone, parent_email, department, section, mentor_name, user_id, user_id]
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
      [phone, email, parent_name, parent_phone, parent_email, department, section, mentor_name, user_id, user_id]
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
