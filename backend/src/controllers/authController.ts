import { Request, Response } from 'express';
import { getAsync, runAsync, allAsync } from '../db/database';
import { z } from 'zod';
import { createEmailOtp, verifyEmailOtp } from '../services/emailOtp';

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

    if (!body.otp_code) {
      const otp = await createEmailOtp(email, 'REGISTER', null);
      return res.json({ success: true, requires_otp: true, message: 'Enter the verification code sent to your email.', ...otp });
    }
    if (!/^\d{6}$/.test(String(body.otp_code)) || !body.challenge_id) {
      return res.status(400).json({ success: false, error: 'Enter the six-digit code sent to your email.' });
    }
    await verifyEmailOtp(String(body.challenge_id), String(body.otp_code), 'REGISTER', email);

    const userId = register_no.toUpperCase();
    const parentId = `PAR_${userId.slice(-4)}`;

    // Insert into users table
    await runAsync(
      `INSERT INTO users (user_id, name, register_no, email, phone, role, department, section, parent_name, parent_phone, parent_email, mentor_name, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        name,
        register_no.toUpperCase(),
        email.toLowerCase(),
        phone,
        role,
        department,
        section || 'A',
        parent_name || 'N/A',
        parent_phone || 'N/A',
        parent_email || 'N/A',
        mentor_name || 'Mentor not assigned',
        password || 'password123'
      ]
    );

    // If student, also insert into students table and create deficiency records
    if (role === 'STUDENT') {
      await runAsync(
        `INSERT INTO students (student_id, name, register_no, email, phone, parent_id, parent_name, parent_phone, parent_email, department, section, mentor_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(student_id) DO UPDATE SET name = excluded.name, email = excluded.email, phone = excluded.phone`,
        [
          userId,
          name,
          register_no.toUpperCase(),
          email.toLowerCase(),
          phone,
          parentId,
          parent_name || 'Parent/Guardian',
          parent_phone || phone,
          parent_email || email,
          department,
          section || 'A',
          mentor_name || 'Mentor not assigned'
        ]
      );

      // Initialize initial safe deficiency records for core courses
      const defaultCourses = ['ATTENDANCE'];
      for (const code of defaultCourses) {
        await runAsync(
          `INSERT INTO attendance_deficiency_records (student_id, course_code, total_conducted, total_attended, current_percentage, projected_percentage, classes_required_for_75, deficiency_status)
           VALUES (?, ?, 40, 36, 90.0, 91.0, 0, 'SAFE')
           ON CONFLICT(student_id, course_code) DO NOTHING`,
          [userId, code]
        );
      }
    }

    // Audit log
    await runAsync(
      `INSERT INTO audit_logs (action_type, performed_by, target_id, details) VALUES (?, ?, ?, ?)`,
      ['USER_REGISTRATION', name, userId, `Registered first-time account with role ${role}`]
    );

    const newUser = await getAsync<any>(`SELECT * FROM users WHERE user_id = ?`, [userId]);
    if (!newUser) throw new Error('The account was created but could not be loaded.');
    const { password_hash: _passwordHash, ...safeUser } = newUser;

    return res.json({
      success: true,
      message: 'Registration successful! Welcome to Attendance Tracker.',
      user: safeUser
    });
  } catch (err: any) {
    const status = err.message.includes('wait one minute') ? 429 : err.message.includes('expired') || err.message.includes('Incorrect') || err.message.includes('Too many') || err.message.includes('does not match') ? 400 : err.message.includes('Email OTP is not configured') || err.message.includes('verification email could not be sent') ? 503 : 500;
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

    const otp = await createEmailOtp(user.email, 'LOGIN', user.user_id);

    return res.json({
      success: true,
      requires_otp: true,
      message: 'Enter the verification code sent to your account email.',
      ...otp
    });
  } catch (err: any) {
    const status = err.message.includes('wait one minute') ? 429 : err.message.includes('Email OTP is not configured') || err.message.includes('verification email could not be sent') ? 503 : 500;
    return res.status(status).json({ success: false, error: err.message });
  }
}

export async function verifyLoginOtp(req: Request, res: Response) {
  try {
    const parsed = z.object({ challenge_id: z.string().uuid(), otp_code: z.string().regex(/^\d{6}$/) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Enter the six-digit code sent to your email.' });
    const challenge = await verifyEmailOtp(parsed.data.challenge_id, parsed.data.otp_code, 'LOGIN');
    const user = await getAsync<any>(`SELECT * FROM users WHERE user_id = ? LIMIT 1`, [challenge.user_id]);
    if (!user) return res.status(404).json({ success: false, error: 'Account not found.' });
    await runAsync(
      `INSERT INTO audit_logs (action_type, performed_by, target_id, details) VALUES (?, ?, ?, ?)`,
      ['USER_LOGIN', user.name, user.user_id, `User logged in under role ${user.role} after email OTP verification`]
    );
    const { password_hash: _passwordHash, ...safeUser } = user;
    return res.json({ success: true, message: `Welcome back, ${user.name}!`, user: safeUser });
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
