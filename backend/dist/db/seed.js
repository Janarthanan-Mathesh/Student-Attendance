"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDatabase = seedDatabase;
const database_1 = require("./database");
const attendance_roster_json_1 = __importDefault(require("../data/attendance_roster.json"));
const rosterUtils_1 = require("../services/rosterUtils");
const ROSTER_MIGRATION = 'attendance_roster_2026_09_v3_csv_credentials';
const ADMIN_EMAIL = 'janarthanan.admin@bitsathy.ac.in';
async function seedDatabase() {
    await (0, database_1.initDatabase)();
    const applied = await (0, database_1.allAsync)('SELECT migration_key FROM app_migrations WHERE migration_key = ?', [ROSTER_MIGRATION]);
    if (applied.length) {
        console.log('Attendance roster already loaded.');
        return;
    }
    // Replace the old demo dataset once with the supplied attendance roster.
    await (0, database_1.runAsync)('DELETE FROM leave_od_requests');
    await (0, database_1.runAsync)('DELETE FROM counseling_logs');
    await (0, database_1.runAsync)('DELETE FROM communication_logs');
    await (0, database_1.runAsync)('DELETE FROM attendance_deficiency_records');
    await (0, database_1.runAsync)('DELETE FROM students');
    await (0, database_1.runAsync)('DELETE FROM users');
    await (0, database_1.runAsync)('DELETE FROM courses');
    await (0, database_1.runAsync)('DELETE FROM audit_logs');
    await (0, database_1.runAsync)(`INSERT INTO courses (course_code, course_name, credits, total_hours, faculty_name)
     VALUES ('ATTENDANCE', 'Semester Attendance', 0, 0, 'Mentor Team')`);
    const importedRoster = attendance_roster_json_1.default;
    const importedStudents = importedRoster.map(rosterUtils_1.normalizeAttendanceRosterRow).filter((student) => student !== null);
    const mentorAccounts = new Map();
    const usedEmails = new Set();
    for (const student of importedStudents) {
        const studentEmail = usedEmails.has(student.studentEmail)
            ? (0, rosterUtils_1.uniqueAccountEmail)(student.studentEmail, student.registerNo)
            : student.studentEmail;
        usedEmails.add(studentEmail);
        const parentId = `PAR_${student.registerNo}`;
        const mentorKey = (0, rosterUtils_1.stableAccountKey)(student.mentorName);
        mentorAccounts.set(student.mentorName, {
            name: student.mentorName,
            key: mentorKey,
            email: student.mentorEmail || `mentor.${mentorKey.toLowerCase()}@attendance.local`,
            id: student.mentorId || `FAC_${mentorKey}`
        });
        await (0, database_1.runAsync)(`INSERT INTO students (student_id, name, register_no, email, phone, parent_id, parent_name, parent_phone, parent_email, department, section, mentor_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [student.registerNo, student.name, student.registerNo, student.studentEmail, student.studentPhone, parentId, student.parentName, student.parentPhone, student.parentEmail, student.department, student.section, student.mentorName]);
        await (0, database_1.runAsync)(`INSERT INTO users (user_id, name, register_no, email, phone, role, department, section, parent_name, parent_phone, parent_email, mentor_name, password_hash)
       VALUES (?, ?, ?, ?, ?, 'STUDENT', ?, ?, ?, ?, ?, ?, ?)`, [student.registerNo, student.name, student.registerNo, studentEmail, student.studentPhone, student.department, student.section, student.parentName, student.parentPhone, student.parentEmail, student.mentorName, student.registerNo]);
        const parentEmail = student.parentEmail || `${parentId.toLowerCase()}@parent.local`;
        await (0, database_1.runAsync)(`INSERT INTO users (user_id, name, register_no, email, phone, role, department, section, mentor_name, password_hash)
       VALUES (?, ?, ?, ?, ?, 'PARENT', ?, ?, ?, ?)`, [parentId, student.parentName, parentId, parentEmail, student.parentPhone, student.department, student.section, student.mentorName, student.registerNo]);
        const percentage = student.workingDays > 0
            ? Number(((student.presentDays / student.workingDays) * 100).toFixed(2))
            : student.percentage;
        const requiredFor75 = percentage >= 75 || student.workingDays === 0
            ? 0
            : Math.max(0, Math.ceil((0.75 * student.workingDays - student.presentDays) / 0.25));
        await (0, database_1.runAsync)(`INSERT INTO attendance_deficiency_records (student_id, course_code, total_conducted, total_attended, current_percentage, projected_percentage, classes_required_for_75, deficiency_status)
       VALUES (?, 'ATTENDANCE', ?, ?, ?, ?, ?, ?)`, [student.registerNo, student.workingDays, student.presentDays, percentage, percentage, requiredFor75, (0, rosterUtils_1.attendanceRisk)(percentage)]);
    }
    for (const mentor of mentorAccounts.values()) {
        const accountId = `FAC_${mentor.key}`;
        await (0, database_1.runAsync)(`INSERT INTO users (user_id, name, register_no, email, phone, role, department, section, mentor_name, password_hash)
       VALUES (?, ?, ?, ?, 'N/A', 'FACULTY', 'Artificial Intelligence and Data Science', 'ALL', ?, ?)`, [accountId, mentor.name, mentor.id, mentor.email, mentor.name, mentor.id]);
    }
    const ownerStudent = importedStudents.find((student) => student.name.toUpperCase() === 'JANARTHANAN M');
    await (0, database_1.runAsync)(`INSERT INTO users (user_id, name, register_no, email, phone, role, department, section, mentor_name, password_hash)
     VALUES ('ADM001', 'JANARTHANAN M', 'ADM001', ?, ?, 'ADMIN', ?, 'ALL', 'Institution Administrator', 'password123')`, [ADMIN_EMAIL, ownerStudent?.studentPhone || 'N/A', ownerStudent?.department || 'Artificial Intelligence and Data Science']);
    await (0, database_1.runAsync)(`INSERT INTO audit_logs (action_type, performed_by, target_id, details)
     VALUES ('ROSTER_IMPORT', 'JANARTHANAN M', 'BATCH_IMPORT', ?)`, [`Loaded ${importedStudents.length} students, ${mentorAccounts.size} mentors and their parent accounts from the attendance roster.`]);
    await (0, database_1.runAsync)('INSERT INTO app_migrations (migration_key) VALUES (?)', [ROSTER_MIGRATION]);
    console.log(`Loaded ${importedStudents.length} roster students and ${mentorAccounts.size} mentor accounts.`);
}
if (require.main === module) {
    seedDatabase().catch(console.error);
}
