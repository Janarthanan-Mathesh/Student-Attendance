"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleWhatsAppWebhook = handleWhatsAppWebhook;
const database_1 = require("../db/database");
const zod_1 = require("zod");
const WebhookReplySchema = zod_1.z.object({
    student_id: zod_1.z.string(),
    parent_id: zod_1.z.string().optional(),
    reply_text: zod_1.z.string()
});
async function handleWhatsAppWebhook(req, res) {
    try {
        const parse = WebhookReplySchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: parse.error.issues });
        }
        const { student_id, reply_text } = parse.data;
        const cleanText = reply_text.trim().toLowerCase();
        const student = await (0, database_1.getAsync)(`SELECT * FROM students WHERE student_id = ?`, [student_id]);
        if (!student) {
            return res.status(404).json({ success: false, error: 'Student record not found' });
        }
        let actionTaken = '';
        const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
        if (cleanText === '1' || cleanText.includes('ack') || cleanText.includes('confirm') || cleanText.includes('received')) {
            // Mark parent acknowledgment
            await (0, database_1.runAsync)(`UPDATE communication_logs 
         SET is_acknowledged = 1, acknowledged_at = ?, delivery_status = 'READ' 
         WHERE student_id = ? AND is_acknowledged = 0`, [nowStr, student_id]);
            actionTaken = 'Parent digital acknowledgment recorded successfully.';
        }
        else if (cleanText === '2' || cleanText.includes('call') || cleanText.includes('advisor') || cleanText.includes('mentor')) {
            // Create callback request entry in counseling logs
            await (0, database_1.runAsync)(`INSERT INTO counseling_logs (student_id, mentor_name, date, notes, action_taken, status)
         VALUES (?, ?, ?, ?, ?, 'OPEN')`, [student_id, student.mentor_name, nowStr.split(' ')[0], `Parent (${student.parent_name}) requested urgent callback via WhatsApp. Reply: "${reply_text}"`, 'SCHEDULED_CALLBACK']);
            await (0, database_1.runAsync)(`UPDATE communication_logs 
         SET is_acknowledged = 1, acknowledged_at = ? 
         WHERE student_id = ? AND is_acknowledged = 0`, [nowStr, student_id]);
            actionTaken = 'Mentor callback request logged. Assigned to ' + student.mentor_name;
        }
        else {
            actionTaken = 'General response recorded.';
        }
        // Log in audit trail
        await (0, database_1.runAsync)(`INSERT INTO audit_logs (action_type, performed_by, target_id, details) VALUES (?, ?, ?, ?)`, ['WHATSAPP_2WAY_REPLY', `PARENT_${student.parent_id}`, student_id, `Received WhatsApp Reply: "${reply_text}" -> ${actionTaken}`]);
        return res.json({
            success: true,
            student_id,
            reply_received: reply_text,
            action_taken: actionTaken,
            timestamp: nowStr
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
