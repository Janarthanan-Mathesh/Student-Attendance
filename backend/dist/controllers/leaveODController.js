"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitLeaveOD = submitLeaveOD;
exports.approveLeaveOD = approveLeaveOD;
const database_1 = require("../db/database");
const riskService_1 = require("../services/riskService");
const zod_1 = require("zod");
const SubmitLeaveSchema = zod_1.z.object({
    student_id: zod_1.z.string(),
    course_code: zod_1.z.string(),
    request_type: zod_1.z.enum(['ON_DUTY', 'MEDICAL', 'PERSONAL']),
    date_from: zod_1.z.string(),
    date_to: zod_1.z.string(),
    hours_applied: zod_1.z.number().min(1),
    reason: zod_1.z.string(),
    document_name: zod_1.z.string().optional()
});
async function submitLeaveOD(req, res) {
    try {
        const parse = SubmitLeaveSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: parse.error.issues });
        }
        const { student_id, course_code, request_type, date_from, date_to, hours_applied, reason, document_name } = parse.data;
        const result = await (0, database_1.runAsync)(`INSERT INTO leave_od_requests (student_id, course_code, request_type, date_from, date_to, hours_applied, reason, document_name, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`, [student_id, course_code, request_type, date_from, date_to, hours_applied, reason, document_name || 'document.pdf']);
        // Audit log
        await (0, database_1.runAsync)(`INSERT INTO audit_logs (action_type, performed_by, target_id, details) VALUES (?, ?, ?, ?)`, ['LEAVE_OD_SUBMITTED', student_id, course_code, `Submitted ${request_type} request for ${hours_applied} hours.`]);
        return res.json({
            success: true,
            message: 'Leave/OD request submitted successfully and pending mentor review.',
            request_id: result.lastID
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
async function approveLeaveOD(req, res) {
    try {
        const { id } = req.params;
        const { status, approved_by } = req.body; // APPROVED or REJECTED
        const request = await (0, database_1.getAsync)(`SELECT * FROM leave_od_requests WHERE id = ?`, [id]);
        if (!request) {
            return res.status(404).json({ success: false, error: 'Request not found' });
        }
        await (0, database_1.runAsync)(`UPDATE leave_od_requests SET status = ?, approved_by = ? WHERE id = ?`, [status || 'APPROVED', approved_by || 'Assigned Mentor', id]);
        if (status === 'APPROVED') {
            // Reconcile attendance percentage: add approved hours to total_attended
            const defRecord = await (0, database_1.getAsync)(`SELECT * FROM attendance_deficiency_records WHERE student_id = ? AND course_code = ?`, [request.student_id, request.course_code]);
            if (defRecord) {
                const newAttended = Math.min(defRecord.total_conducted, defRecord.total_attended + request.hours_applied);
                await (0, database_1.runAsync)(`UPDATE attendance_deficiency_records SET total_attended = ? WHERE id = ?`, [newAttended, defRecord.id]);
                // Re-evaluate risk
                await (0, riskService_1.evaluateStudentRisk)(request.student_id, request.course_code);
            }
        }
        // Audit log
        await (0, database_1.runAsync)(`INSERT INTO audit_logs (action_type, performed_by, target_id, details) VALUES (?, ?, ?, ?)`, ['LEAVE_OD_RECONCILED', approved_by || 'FACULTY', request.student_id, `Status updated to ${status} for request ID ${id}`]);
        return res.json({
            success: true,
            message: `Leave/OD request status updated to ${status} and attendance reconciled.`,
            request_id: id
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
