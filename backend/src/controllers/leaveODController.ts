import { Request, Response } from 'express';
import { allAsync, getAsync, runAsync } from '../db/database';
import { evaluateStudentRisk } from '../services/riskService';
import { z } from 'zod';

const SubmitLeaveSchema = z.object({
  student_id: z.string(),
  course_code: z.string(),
  request_type: z.enum(['ON_DUTY', 'MEDICAL', 'PERSONAL']),
  date_from: z.string(),
  date_to: z.string(),
  hours_applied: z.number().min(1),
  reason: z.string(),
  document_name: z.string().optional(),
  document_data: z.string().max(14 * 1024 * 1024).optional()
}).superRefine((data, context) => {
  if (data.request_type === 'MEDICAL' && (!data.document_name || !data.document_data)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'A medical document is required.', path: ['document_data'] });
  }
  if (data.document_data && !/^data:(application\/pdf|image\/(jpeg|png));base64,/.test(data.document_data)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Document must be a PDF, JPG or PNG.', path: ['document_data'] });
  }
});

export async function submitLeaveOD(req: Request, res: Response) {
  try {
    const parse = SubmitLeaveSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: parse.error.issues });
    }

    const { student_id, course_code, request_type, date_from, date_to, hours_applied, reason, document_name, document_data } = parse.data;
    const requesterId = String(req.header('X-User-Id') || '');
    const requesterRole = String(req.header('X-User-Role') || '');
    if (!requesterId || requesterRole !== 'STUDENT' || requesterId !== student_id) {
      return res.status(403).json({ success: false, error: 'Students may submit OD requests only for their own account.' });
    }
    const student = await getAsync<{ student_id: string }>(`SELECT student_id FROM students WHERE student_id = ? OR register_no = ? LIMIT 1`, [student_id, student_id]);
    if (!student) return res.status(404).json({ success: false, error: 'Student was not found.' });

    const result = await runAsync(
      `INSERT INTO leave_od_requests (student_id, course_code, request_type, date_from, date_to, hours_applied, reason, document_name, document_data, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [student_id, course_code, request_type, date_from, date_to, hours_applied, reason, document_name || null, document_data || null]
    );

    // Audit log
    await runAsync(
      `INSERT INTO audit_logs (action_type, performed_by, target_id, details) VALUES (?, ?, ?, ?)`,
      ['LEAVE_OD_SUBMITTED', student_id, course_code, `Submitted ${request_type} request for ${hours_applied} hours.`]
    );

    return res.json({
      success: true,
      message: 'Leave/OD request submitted successfully and pending mentor review.',
      request_id: result.lastID
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function approveLeaveOD(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const parsed = z.object({ status: z.enum(['APPROVED', 'REJECTED']) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Choose approve or reject for this request.' });
    const status = parsed.data.status;
    const requesterId = String(req.header('X-User-Id') || '');
    const requesterRole = String(req.header('X-User-Role') || '');
    if (!requesterId || requesterRole !== 'FACULTY') {
      return res.status(403).json({ success: false, error: 'Only the assigned mentor can review an OD request.' });
    }

    const mentor = await getAsync<{ user_id: string; role: string; name: string }>(
      `SELECT user_id, role, name FROM users WHERE (user_id = ? OR register_no = ?) AND role = 'FACULTY' LIMIT 1`,
      [requesterId, requesterId]
    );
    if (!mentor) return res.status(403).json({ success: false, error: 'Mentor account was not found.' });

    const request = await getAsync<any>(
      `SELECT r.* FROM leave_od_requests r JOIN students s ON s.student_id = r.student_id WHERE r.id = ? AND s.mentor_name = ?`,
      [id, mentor.name]
    );
    if (!request) {
      return res.status(404).json({ success: false, error: 'Request not found for this mentor.' });
    }
    if (request.status !== 'PENDING') return res.status(409).json({ success: false, error: 'This request has already been reviewed.' });

    const update = await runAsync(
      `UPDATE leave_od_requests SET status = ?, approved_by = ? WHERE id = ? AND status = 'PENDING'`,
      [status, mentor.name, id]
    );
    if (!update.changes) return res.status(409).json({ success: false, error: 'This request has already been reviewed.' });

    if (status === 'APPROVED') {
      // Reconcile attendance percentage: add approved hours to total_attended
      const defRecord = await getAsync(
        `SELECT * FROM attendance_deficiency_records WHERE student_id = ? AND course_code = ?`,
        [request.student_id, request.course_code]
      );

      if (defRecord) {
        const newAttended = Math.min(defRecord.total_conducted, defRecord.total_attended + request.hours_applied);
        await runAsync(
          `UPDATE attendance_deficiency_records SET total_attended = ? WHERE id = ?`,
          [newAttended, defRecord.id]
        );

        // Re-evaluate risk
        await evaluateStudentRisk(request.student_id, request.course_code);
      }
    }

    // Audit log
    await runAsync(
      `INSERT INTO audit_logs (action_type, performed_by, target_id, details) VALUES (?, ?, ?, ?)`,
      ['LEAVE_OD_RECONCILED', mentor.name, request.student_id, `Status updated to ${status} for request ID ${id}`]
    );

    return res.json({
      success: true,
      message: status === 'APPROVED' ? 'Request approved and attendance reconciled.' : 'Request rejected.',
      request_id: id
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
