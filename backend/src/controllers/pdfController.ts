import { Request, Response } from 'express';
import { getAsync, runAsync } from '../db/database';
import { generateDeficiencyPDF } from '../services/pdfService';

export async function generatePDFNotice(req: Request, res: Response) {
  try {
    const { student_id, course_code } = req.query;

    if (!student_id || !course_code) {
      return res.status(400).json({ success: false, error: 'student_id and course_code are required parameters' });
    }

    const student = await getAsync(`SELECT * FROM students WHERE student_id = ?`, [student_id]);
    const course = await getAsync(`SELECT * FROM courses WHERE course_code = ?`, [course_code]);
    const record = await getAsync(
      `SELECT * FROM attendance_deficiency_records WHERE student_id = ? AND course_code = ?`,
      [student_id, course_code]
    );

    if (!student || !course || !record) {
      return res.status(404).json({ success: false, error: 'Record details not found' });
    }

    const pdfBuffer = await generateDeficiencyPDF({
      student_name: student.name,
      register_no: student.register_no,
      department: student.department,
      course_code: course.course_code,
      course_name: course.course_name,
      current_percentage: record.current_percentage,
      classes_required: record.classes_required_for_75,
      deficiency_status: record.deficiency_status,
      parent_name: student.parent_name,
      issued_at: new Date().toISOString().split('T')[0]
    });

    // Audit log
    await runAsync(
      `INSERT INTO audit_logs (action_type, performed_by, target_id, details) VALUES (?, ?, ?, ?)`,
      ['PDF_DEFICIENCY_NOTICE_GENERATED', 'SYSTEM_GATEWAY', String(student_id), `Generated PDF Deficiency Notice for course ${course_code}`]
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Deficiency_Notice_${student_id}_${course_code}.pdf`);
    return res.send(pdfBuffer);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
