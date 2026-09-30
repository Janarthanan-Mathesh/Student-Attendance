import { initDatabase, runAsync, allAsync } from './database';
import rosterRows from '../data/attendance_roster.json';
import { attendanceRisk, normalizeAttendanceRosterRow, stableAccountKey, uniqueAccountEmail } from '../services/rosterUtils';

const ROSTER_MIGRATION = 'attendance_roster_2026_09_v3_csv_credentials';
const ADMIN_EMAIL = 'janarthanan.admin@bitsathy.ac.in';

export async function seedDatabase() {
  await initDatabase();

  const applied = await allAsync('SELECT migration_key FROM app_migrations WHERE migration_key = ?', [ROSTER_MIGRATION]);
  if (applied.length) {
    console.log('Attendance roster already loaded.');
    return;
  }

  // Replace the old demo dataset once with the supplied attendance roster.
  await runAsync('DELETE FROM leave_od_requests');
  await runAsync('DELETE FROM counseling_logs');
  await runAsync('DELETE FROM communication_logs');
  await runAsync('DELETE FROM attendance_deficiency_records');
  await runAsync('DELETE FROM students');
  await runAsync('DELETE FROM users');
  await runAsync('DELETE FROM courses');
  await runAsync('DELETE FROM audit_logs');

  await runAsync(
    `INSERT INTO courses (course_code, course_name, credits, total_hours, faculty_name)
     VALUES ('ATTENDANCE', 'Semester Attendance', 0, 0, 'Mentor Team')`
  );

  const importedRoster = rosterRows as Array<Record<string, unknown>>;
  const importedStudents = importedRoster.map(normalizeAttendanceRosterRow).filter((student) => student !== null);
  const mentorAccounts = new Map<string, { name: string; key: string; email: string; id: string }>();
  const usedEmails = new Set<string>();

  for (const student of importedStudents) {
    const studentEmail = usedEmails.has(student.studentEmail)
      ? uniqueAccountEmail(student.studentEmail, student.registerNo)
      : student.studentEmail;
    usedEmails.add(studentEmail);

    const parentId = `PAR_${student.registerNo}`;
    const mentorKey = stableAccountKey(student.mentorName);
    mentorAccounts.set(student.mentorName, {
      name: student.mentorName,
      key: mentorKey,
      email: student.mentorEmail || `mentor.${mentorKey.toLowerCase()}@attendance.local`,
      id: student.mentorId || `FAC_${mentorKey}`
    });

    await runAsync(
      `INSERT INTO students (student_id, name, register_no, email, phone, parent_id, parent_name, parent_phone, parent_email, department, section, mentor_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [student.registerNo, student.name, student.registerNo, student.studentEmail, student.studentPhone, parentId, student.parentName, student.parentPhone, student.parentEmail, student.department, student.section, student.mentorName]
    );

    await runAsync(
      `INSERT INTO users (user_id, name, register_no, email, phone, role, department, section, parent_name, parent_phone, parent_email, mentor_name, password_hash)
       VALUES (?, ?, ?, ?, ?, 'STUDENT', ?, ?, ?, ?, ?, ?, ?)`,
      [student.registerNo, student.name, student.registerNo, studentEmail, student.studentPhone, student.department, student.section, student.parentName, student.parentPhone, student.parentEmail, student.mentorName, student.registerNo]
    );

    const parentEmail = student.parentEmail || `${parentId.toLowerCase()}@parent.local`;
    await runAsync(
      `INSERT INTO users (user_id, name, register_no, email, phone, role, department, section, mentor_name, password_hash)
       VALUES (?, ?, ?, ?, ?, 'PARENT', ?, ?, ?, ?)`,
      [parentId, student.parentName, parentId, parentEmail, student.parentPhone, student.department, student.section, student.mentorName, student.registerNo]
    );

    const percentage = student.workingDays > 0
      ? Number(((student.presentDays / student.workingDays) * 100).toFixed(2))
      : student.percentage;
    const requiredFor75 = percentage >= 75 || student.workingDays === 0
      ? 0
      : Math.max(0, Math.ceil((0.75 * student.workingDays - student.presentDays) / 0.25));
    await runAsync(
      `INSERT INTO attendance_deficiency_records (student_id, course_code, total_conducted, total_attended, current_percentage, projected_percentage, classes_required_for_75, deficiency_status)
       VALUES (?, 'ATTENDANCE', ?, ?, ?, ?, ?, ?)`,
      [student.registerNo, student.workingDays, student.presentDays, percentage, percentage, requiredFor75, attendanceRisk(percentage)]
    );
  }

  for (const mentor of mentorAccounts.values()) {
    const accountId = `FAC_${mentor.key}`;
    await runAsync(
      `INSERT INTO users (user_id, name, register_no, email, phone, role, department, section, mentor_name, password_hash)
       VALUES (?, ?, ?, ?, 'N/A', 'FACULTY', 'Artificial Intelligence and Data Science', 'ALL', ?, ?)`,
      [accountId, mentor.name, mentor.id, mentor.email, mentor.name, mentor.id]
    );
  }

  const ownerStudent = importedStudents.find((student) => student.name.toUpperCase() === 'JANARTHANAN M');
  await runAsync(
    `INSERT INTO users (user_id, name, register_no, email, phone, role, department, section, mentor_name, password_hash)
     VALUES ('ADM001', 'JANARTHANAN M', 'ADM001', ?, ?, 'ADMIN', ?, 'ALL', 'Institution Administrator', 'password123')`,
    [ADMIN_EMAIL, ownerStudent?.studentPhone || 'N/A', ownerStudent?.department || 'Artificial Intelligence and Data Science']
  );

  await runAsync(
    `INSERT INTO audit_logs (action_type, performed_by, target_id, details)
     VALUES ('ROSTER_IMPORT', 'JANARTHANAN M', 'BATCH_IMPORT', ?)` ,
    [`Loaded ${importedStudents.length} students, ${mentorAccounts.size} mentors and their parent accounts from the attendance roster.`]
  );
  await runAsync('INSERT INTO app_migrations (migration_key) VALUES (?)', [ROSTER_MIGRATION]);
  console.log(`Loaded ${importedStudents.length} roster students and ${mentorAccounts.size} mentor accounts.`);
}

if (require.main === module) {
  seedDatabase().catch(console.error);
}
