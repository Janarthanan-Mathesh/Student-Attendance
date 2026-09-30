"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCounselingLog = createCounselingLog;
exports.getCounselingLogs = getCounselingLogs;
const database_1 = require("../db/database");
const zod_1 = require("zod");
const CounselingSchema = zod_1.z.object({
    student_id: zod_1.z.string(),
    mentor_name: zod_1.z.string(),
    date: zod_1.z.string(),
    notes: zod_1.z.string(),
    action_taken: zod_1.z.string()
});
async function createCounselingLog(req, res) {
    try {
        const parse = CounselingSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: parse.error.issues });
        }
        const { student_id, mentor_name, date, notes, action_taken } = parse.data;
        const result = await (0, database_1.runAsync)(`INSERT INTO counseling_logs (student_id, mentor_name, date, notes, action_taken, status)
       VALUES (?, ?, ?, ?, ?, 'COMPLETED')`, [student_id, mentor_name, date, notes, action_taken]);
        await (0, database_1.runAsync)(`INSERT INTO audit_logs (action_type, performed_by, target_id, details) VALUES (?, ?, ?, ?)`, ['COUNSELING_RECORDED', mentor_name, student_id, `Recorded counseling session on ${date}. Notes: ${notes.slice(0, 50)}...`]);
        return res.json({
            success: true,
            message: 'Counseling session logged successfully.',
            log_id: result.lastID
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
async function getCounselingLogs(req, res) {
    try {
        const { student_id } = req.query;
        let sql = `SELECT c.*, s.name as student_name, s.department FROM counseling_logs c JOIN students s ON c.student_id = s.student_id`;
        const params = [];
        if (student_id) {
            sql += ` WHERE c.student_id = ?`;
            params.push(student_id);
        }
        sql += ` ORDER BY c.created_at DESC`;
        const logs = await (0, database_1.allAsync)(sql, params);
        return res.json({ success: true, logs });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
