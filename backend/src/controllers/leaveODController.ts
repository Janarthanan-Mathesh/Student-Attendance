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
  document_data: z.string().max(11 * 1024 * 1024).optional()
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
    const { status, approved_by } = req.body; // APPROVED or REJECTED

    const request = await getAsync(`SELECT * FROM leave_od_requests WHERE id = ?`, [id]);
    if (!request) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    await runAsync(
      `UPDATE leave_od_requests SET status = ?, approved_by = ? WHERE id = ?`,
      [status || 'APPROVED', approved_by || 'Assigned Mentor', id]
    );

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
      ['LEAVE_OD_RECONCILED', approved_by || 'FACULTY', request.student_id, `Status updated to ${status} for request ID ${id}`]
    );

    return res.json({
      success: true,
      message: `Leave/OD request status updated to ${status} and attendance reconciled.`,
      request_id: id
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
