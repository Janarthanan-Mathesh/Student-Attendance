import { Request, Response } from 'express';
import { runAsync, getAsync } from '../db/database';
import { AttendanceRosterRecord, attendanceRisk, normalizeAttendanceRosterRow, stableAccountKey, uniqueAccountEmail } from '../services/rosterUtils';
import { hasInstitutionEmail, validateStudentRosterIdentity } from '../services/departmentRules';

export async function bulkUploadExcel(req: Request, res: Response) {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, error: 'No CSV rows provided. Choose a CSV with student, parent and mentor columns.' });
    }

    const entries = rows
      .map((row: Record<string, unknown>, index: number) => ({ student: normalizeAttendanceRosterRow(row), rowNumber: index + 2 }))
      .filter((entry): entry is { student: AttendanceRosterRecord; rowNumber: number } => entry.student !== null);
    const roster = entries.map((entry) => entry.student);
    if (!roster.length) {
      return res.status(400).json({ success: false, error: 'No valid students found. Include ROLL NO. and STUDENT NAME columns.' });
    }

    const validationErrors: string[] = [];
    for (const { student, rowNumber } of entries) {
      const identity = validateStudentRosterIdentity(student.registerNo, student.studentEmail, student.department);
      if (!identity.valid) validationErrors.push(`Row ${rowNumber}: ${identity.error}`);
      else student.department = identity.name;
      if (!hasInstitutionEmail(student.studentEmail)) validationErrors.push(`Row ${rowNumber}: student email must end with @bitsathy.ac.in.`);
      if (!hasInstitutionEmail(student.parentEmail)) validationErrors.push(`Row ${rowNumber}: parent email must end with @bitsathy.ac.in.`);
      if (!hasInstitutionEmail(student.mentorEmail)) validationErrors.push(`Row ${rowNumber}: mentor email must end with @bitsathy.ac.in.`);
    }
    if (validationErrors.length) {
      return res.status(400).json({
        success: false,
        error: `CSV validation failed. Correct these rows and upload again: ${validationErrors.slice(0, 20).join(' ')}`,
        error_count: validationErrors.length
      });
    }

    await runAsync(
      `INSERT INTO courses (course_code, course_name, credits, total_hours, faculty_name)
       VALUES ('ATTENDANCE', 'Semester Attendance', 0, 0, 'Mentor Team')
       ON CONFLICT(course_code) DO NOTHING`
    );

    const mentorAccounts = new Map<string, { name: string; key: string; email: string; id: string }>();
    let processedCount = 0;

    for (const student of roster) {
      const existingStudentUser = await getAsync<{ email: string }>('SELECT email FROM users WHERE email = ? AND user_id <> ?', [student.studentEmail, student.registerNo]);
      const studentEmail = existingStudentUser ? uniqueAccountEmail(student.studentEmail, student.registerNo) : student.studentEmail;
      const parentId = `PAR_${student.registerNo}`;
      const parentEmailConflict = await getAsync<{ user_id: string }>('SELECT user_id FROM users WHERE email = ? AND user_id <> ?', [student.parentEmail, parentId]);
      const parentEmail = parentEmailConflict ? uniqueAccountEmail(student.parentEmail, student.registerNo) : student.parentEmail;
      const mentorKey = stableAccountKey(student.mentorName);
      mentorAccounts.set(student.mentorName, {
        name: student.mentorName,
        key: mentorKey,
        email: student.mentorEmail,
        id: student.mentorId || `FAC_${mentorKey}`
      });

      await runAsync(
        `INSERT INTO students (student_id, name, register_no, email, phone, parent_id, parent_name, parent_phone, parent_email, department, section, mentor_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(student_id) DO UPDATE SET name = excluded.name, register_no = excluded.register_no, email = excluded.email, phone = excluded.phone,
           parent_id = excluded.parent_id, parent_name = excluded.parent_name, parent_phone = excluded.parent_phone,
           parent_email = excluded.parent_email, department = excluded.department, section = excluded.section, mentor_name = excluded.mentor_name`,
        [student.registerNo, student.name, student.registerNo, student.studentEmail, student.studentPhone, parentId, student.parentName, student.parentPhone, student.parentEmail, student.department, student.section, student.mentorName]
      );

      await runAsync(
        `INSERT INTO users (user_id, name, register_no, email, phone, role, department, section, parent_name, parent_phone, parent_email, mentor_name, password_hash)
         VALUES (?, ?, ?, ?, ?, 'STUDENT', ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET name = excluded.name, register_no = excluded.register_no, email = excluded.email,
         phone = excluded.phone, department = excluded.department, section = excluded.section, parent_name = excluded.parent_name,
           parent_phone = excluded.parent_phone, parent_email = excluded.parent_email, mentor_name = excluded.mentor_name,
           password_hash = excluded.password_hash`,
        [student.registerNo, student.name, student.registerNo, studentEmail, student.studentPhone, student.department, student.section, student.parentName, student.parentPhone, parentEmail, student.mentorName, student.registerNo]
      );

      await runAsync(
        `INSERT INTO users (user_id, name, register_no, email, phone, role, department, section, mentor_name, password_hash)
         VALUES (?, ?, ?, ?, ?, 'PARENT', ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET name = excluded.name, register_no = excluded.register_no, email = excluded.email,
           phone = excluded.phone, department = excluded.department, section = excluded.section, mentor_name = excluded.mentor_name,
           password_hash = excluded.password_hash`,
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
         VALUES (?, 'ATTENDANCE', ?, ?, ?, ?, ?, ?)
         ON CONFLICT(student_id, course_code) DO UPDATE SET total_conducted = excluded.total_conducted, total_attended = excluded.total_attended,
           current_percentage = excluded.current_percentage, projected_percentage = excluded.projected_percentage,
           classes_required_for_75 = excluded.classes_required_for_75, deficiency_status = excluded.deficiency_status,
           last_evaluated_at = CURRENT_TIMESTAMP`,
        [student.registerNo, student.workingDays, student.presentDays, percentage, percentage, requiredFor75, attendanceRisk(percentage)]
      );

      processedCount++;
    }

    for (const mentor of mentorAccounts.values()) {
      const accountId = `FAC_${mentor.key}`;
      await runAsync(
        `INSERT INTO users (user_id, name, register_no, email, phone, role, department, section, mentor_name, password_hash)
         VALUES (?, ?, ?, ?, 'N/A', 'FACULTY', 'Artificial Intelligence and Data Science', 'ALL', ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET name = excluded.name, register_no = excluded.register_no, email = excluded.email,
           mentor_name = excluded.mentor_name, password_hash = excluded.password_hash`,
        [accountId, mentor.name, mentor.id, mentor.email, mentor.name, mentor.id]
      );
    }

    await runAsync(
      `INSERT INTO audit_logs (action_type, performed_by, target_id, details) VALUES (?, ?, ?, ?)`,
      ['ROSTER_CSV_IMPORT', req.header('x-user-id') || 'ADM001', 'BATCH_IMPORT', `Imported ${processedCount} student and parent accounts and ${mentorAccounts.size} mentor accounts from CSV.`]
    );

    return res.json({ success: true, message: `Imported ${processedCount} students, their parent accounts and ${mentorAccounts.size} mentors.`, processed_count: processedCount, mentor_count: mentorAccounts.size });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
