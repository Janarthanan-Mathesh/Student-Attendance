import { Request, Response } from 'express';
import { allAsync, getAsync, runAsync } from '../db/database';
import { notificationQueue } from '../services/notificationQueue';
import { z } from 'zod';

const DispatchBatchSchema = z.object({
  student_ids: z.array(z.string()),
  channel: z.enum(['WHATSAPP', 'SMS', 'EMAIL', 'PUSH']),
  warning_level: z.enum(['ADVISORY', 'MODERATE', 'CRITICAL']),
  custom_note: z.string().optional()
});

export async function dispatchBatchAlerts(req: Request, res: Response) {
  try {
    const parse = DispatchBatchSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: parse.error.issues });
    }

    const { student_ids, channel, warning_level, custom_note } = parse.data;
    const queuedJobs = [];

    for (const sid of student_ids) {
      const student = await getAsync(`SELECT * FROM students WHERE student_id = ?`, [sid]);
      if (!student) continue;

      const defRecord = await getAsync(
        `SELECT * FROM attendance_deficiency_records WHERE student_id = ? ORDER BY current_percentage ASC LIMIT 1`,
        [sid]
      );

      const pct = defRecord ? defRecord.current_percentage : 0;
      const course = defRecord ? defRecord.course_code : 'ATTENDANCE';

      const payloadMsg = custom_note
        ? `[INSTITUTION ALERT] ${student.name} (${student.student_id}): ${custom_note} Current %: ${pct}% in ${course}. Reply 1 to acknowledge.`
        : `[ATTENDANCE ALERT] ${warning_level} NOTICE: Student ${student.name} attendance is ${pct}% in ${course}. Reply 1 to acknowledge receipt or 2 to request mentor callback.`;

      const jobId = await notificationQueue.addJob({
        student_id: sid,
        parent_id: student.parent_id,
        channel,
        warning_level,
        message_payload: payloadMsg
      });

      // Audit log
      await runAsync(
        `INSERT INTO audit_logs (action_type, performed_by, target_id, details) VALUES (?, ?, ?, ?)`,
        ['BATCH_NOTIFICATION_DISPATCH', 'FACULTY_PORTAL', sid, `Dispatched ${warning_level} alert via ${channel}`]
      );

      queuedJobs.push({ student_id: sid, jobId, channel });
    }

    return res.json({
      success: true,
      message: `Successfully queued ${queuedJobs.length} notification jobs.`,
      dispatched: queuedJobs
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function getDeliveryHealth(req: Request, res: Response) {
  try {
    const logs = await allAsync(`SELECT * FROM communication_logs ORDER BY created_at DESC`);
    const total = logs.length;
    const delivered = logs.filter((l) => l.delivery_status === 'DELIVERED' || l.delivery_status === 'READ').length;
    const read = logs.filter((l) => l.delivery_status === 'READ').length;
    const acknowledged = logs.filter((l) => l.is_acknowledged === 1).length;
    const failed = logs.filter((l) => l.delivery_status === 'FAILED').length;

    const channelStats = {
      WHATSAPP: logs.filter((l) => l.channel === 'WHATSAPP').length,
      SMS: logs.filter((l) => l.channel === 'SMS').length,
      EMAIL: logs.filter((l) => l.channel === 'EMAIL').length,
      PUSH: logs.filter((l) => l.channel === 'PUSH').length
    };

    return res.json({
      success: true,
      health_metrics: {
        total_dispatched: total,
        delivery_rate: total > 0 ? Number(((delivered / total) * 100).toFixed(1)) : 100,
        read_rate: total > 0 ? Number(((read / total) * 100).toFixed(1)) : 100,
        acknowledgment_rate: total > 0 ? Number(((acknowledged / total) * 100).toFixed(1)) : 100,
        bounce_rate: total > 0 ? Number(((failed / total) * 100).toFixed(1)) : 0,
        channel_breakdown: channelStats
      },
      recent_logs: logs.slice(0, 50)
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
