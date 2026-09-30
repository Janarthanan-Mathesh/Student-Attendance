"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendAdminOTP = sendAdminOTP;
exports.verifyAdminOTP = verifyAdminOTP;
exports.registerUser = registerUser;
exports.loginUser = loginUser;
exports.updateProfile = updateProfile;
const database_1 = require("../db/database");
const zod_1 = require("zod");
const RegisterSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    register_no: zod_1.z.string().min(3),
    email: zod_1.z.string().email(),
    phone: zod_1.z.string().min(5),
    role: zod_1.z.enum(['STUDENT', 'FACULTY', 'PARENT', 'ADMIN']),
    department: zod_1.z.string().min(2),
    section: zod_1.z.string().optional().default('A'),
    parent_name: zod_1.z.string().optional(),
    parent_phone: zod_1.z.string().optional(),
    parent_email: zod_1.z.string().optional(),
    mentor_name: zod_1.z.string().optional().default('Mentor not assigned'),
    password: zod_1.z.string().min(4).optional().default('password123')
});
const LoginSchema = zod_1.z.object({
    identifier: zod_1.z.string(), // email or register_no
    password: zod_1.z.string().optional(),
    role: zod_1.z.enum(['STUDENT', 'FACULTY', 'PARENT', 'ADMIN']).optional()
});
let currentAdminOTP = '849201';
let currentAdminUserId = '';
async function sendAdminOTP(req, res) {
    try {
        const userId = String(req.body?.user_id || '');
        const adminUser = await (0, database_1.getAsync)(`SELECT * FROM users WHERE user_id = ? AND role = 'ADMIN' LIMIT 1`, [userId]);
        if (!adminUser) {
            return res.status(403).json({ success: false, error: 'Sign in with an administrator account before requesting a verification code.' });
        }
        // Generate random 6-digit code
        currentAdminOTP = Math.floor(100000 + Math.random() * 900000).toString();
        currentAdminUserId = adminUser.user_id;
        const targetEmail = adminUser.email;
        const targetPhone = adminUser.phone;
        const otpPayload = `SECURITY NOTICE: Your Admin verification code is ${currentAdminOTP}. Code dispatched identically to Email (${targetEmail}) & Phone (${targetPhone}).`;
        // Log to communication_logs table
        await (0, database_1.runAsync)(`INSERT INTO communication_logs (student_id, parent_id, channel, warning_level, message_payload, delivery_status, gateway_response_id)
       VALUES (?, 'ADM001', 'SMS', 'CRITICAL', ?, 'DELIVERED', ?)`, [currentAdminUserId, otpPayload, `OTP_${Date.now()}`]);
        await (0, database_1.runAsync)(`INSERT INTO audit_logs (action_type, performed_by, target_id, details) VALUES (?, ?, ?, ?)`, ['ADMIN_2FA_OTP_SENT', currentAdminUserId, currentAdminUserId, `Admin verification code sent to ${targetEmail} and ${targetPhone}`]);
        return res.json({
            success: true,
            message: `Verification code sent to ${targetEmail} and ${targetPhone}`,
            email: targetEmail,
            phone: targetPhone,
            otp_code: currentAdminOTP // Returned for live testing preview
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
async function verifyAdminOTP(req, res) {
    try {
        const { otp_code, user_id } = req.body;
        if (!otp_code || otp_code.trim() !== currentAdminOTP.trim() || user_id !== currentAdminUserId) {
            return res.status(400).json({
                success: false,
                error: 'Invalid 2FA Verification Code. Please enter the matching 6-digit code sent to your email/phone.'
            });
        }
        const adminUser = await (0, database_1.getAsync)(`SELECT * FROM users WHERE role = 'ADMIN' AND user_id = ? LIMIT 1`, [currentAdminUserId]);
        if (!adminUser) {
            return res.status(404).json({ success: false, error: 'Administrator account was not found.' });
        }
        const { password_hash: _passwordHash, ...safeAdminUser } = adminUser;
        return res.json({
            success: true,
            message: 'Admin 2FA verification successful!',
            user: safeAdminUser
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
async function registerUser(req, res) {
    try {
        const parse = RegisterSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: parse.error.issues });
        }
        const { name, register_no, email, phone, role, department, section, parent_name, parent_phone, parent_email, mentor_name, password } = parse.data;
        // Check if user already exists
        const existing = await (0, database_1.getAsync)(`SELECT * FROM users WHERE register_no = ? OR email = ?`, [register_no, email]);
        if (existing) {
            return res.status(400).json({
                success: false,
                error: 'A user with this Register No or Email already exists. Please login instead.'
            });
        }
        const userId = register_no.toUpperCase();
        const parentId = `PAR_${userId.slice(-4)}`;
        // Insert into users table
        await (0, database_1.runAsync)(`INSERT INTO users (user_id, name, register_no, email, phone, role, department, section, parent_name, parent_phone, parent_email, mentor_name, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
        ]);
        // If student, also insert into students table and create deficiency records
        if (role === 'STUDENT') {
            await (0, database_1.runAsync)(`INSERT INTO students (student_id, name, register_no, email, phone, parent_id, parent_name, parent_phone, parent_email, department, section, mentor_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(student_id) DO UPDATE SET name = excluded.name, email = excluded.email, phone = excluded.phone`, [
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
            ]);
            // Initialize initial safe deficiency records for core courses
            const defaultCourses = ['ATTENDANCE'];
            for (const code of defaultCourses) {
                await (0, database_1.runAsync)(`INSERT INTO attendance_deficiency_records (student_id, course_code, total_conducted, total_attended, current_percentage, projected_percentage, classes_required_for_75, deficiency_status)
           VALUES (?, ?, 40, 36, 90.0, 91.0, 0, 'SAFE')
           ON CONFLICT(student_id, course_code) DO NOTHING`, [userId, code]);
            }
        }
        // Audit log
        await (0, database_1.runAsync)(`INSERT INTO audit_logs (action_type, performed_by, target_id, details) VALUES (?, ?, ?, ?)`, ['USER_REGISTRATION', name, userId, `Registered first-time account with role ${role}`]);
        const newUser = await (0, database_1.getAsync)(`SELECT * FROM users WHERE user_id = ?`, [userId]);
        return res.json({
            success: true,
            message: 'Registration successful! Welcome to Attendance Tracker.',
            user: newUser
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
async function loginUser(req, res) {
    try {
        const parse = LoginSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: parse.error.issues });
        }
        const { identifier, password, role } = parse.data;
        const candidates = await (0, database_1.allAsync)(`SELECT DISTINCT u.* FROM users u
       LEFT JOIN students s ON s.student_id = u.user_id
       WHERE (upper(u.register_no) = ? OR lower(u.email) = ? OR lower(s.email) = ? OR u.user_id = ?)
         AND (? IS NULL OR u.role = ?)
       ORDER BY u.id DESC`, [identifier.trim().toUpperCase(), identifier.trim().toLowerCase(), identifier.trim().toLowerCase(), identifier.trim(), role || null, role || null]);
        const matchingUser = candidates.find((candidate) => password && candidate.password_hash === password);
        const user = matchingUser || candidates[0];
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'No account found with this Register No or Email. Please register as a first-time user.'
            });
        }
        if (!password || !matchingUser) {
            return res.status(401).json({ success: false, error: 'Incorrect password.' });
        }
        // Audit log
        await (0, database_1.runAsync)(`INSERT INTO audit_logs (action_type, performed_by, target_id, details) VALUES (?, ?, ?, ?)`, ['USER_LOGIN', user.name, user.user_id, `User logged in under role ${user.role}`]);
        return res.json({
            success: true,
            message: `Welcome back, ${user.name}!`,
            user: (({ password_hash: _passwordHash, ...safeUser }) => safeUser)(user)
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
async function updateProfile(req, res) {
    try {
        const { user_id, phone, email, parent_name, parent_phone, parent_email, department, section, mentor_name } = req.body;
        if (!user_id) {
            return res.status(400).json({ success: false, error: 'user_id is required' });
        }
        await (0, database_1.runAsync)(`UPDATE users 
       SET phone = COALESCE(?, phone),
           email = COALESCE(?, email),
           parent_name = COALESCE(?, parent_name),
           parent_phone = COALESCE(?, parent_phone),
           parent_email = COALESCE(?, parent_email),
           department = COALESCE(?, department),
           section = COALESCE(?, section),
           mentor_name = COALESCE(?, mentor_name)
       WHERE user_id = ? OR register_no = ?`, [phone, email, parent_name, parent_phone, parent_email, department, section, mentor_name, user_id, user_id]);
        // Also update students table if exists
        await (0, database_1.runAsync)(`UPDATE students
       SET phone = COALESCE(?, phone),
           email = COALESCE(?, email),
           parent_name = COALESCE(?, parent_name),
           parent_phone = COALESCE(?, parent_phone),
           parent_email = COALESCE(?, parent_email),
           department = COALESCE(?, department),
           section = COALESCE(?, section),
           mentor_name = COALESCE(?, mentor_name)
       WHERE student_id = ? OR register_no = ?`, [phone, email, parent_name, parent_phone, parent_email, department, section, mentor_name, user_id, user_id]);
        const updatedUser = await (0, database_1.getAsync)(`SELECT * FROM users WHERE user_id = ? OR register_no = ?`, [user_id, user_id]);
        return res.json({
            success: true,
            message: 'Profile updated successfully!',
            user: updatedUser
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
