import { Request, Response } from 'express';
import { allAsync, runAsync } from '../db/database';
import { z } from 'zod';

const CounselingSchema = z.object({
  student_id: z.string(),
  mentor_name: z.string(),
  date: z.string(),
  notes: z.string(),
  action_taken: z.string()
});

export async function createCounselingLog(req: Request, res: Response) {
  try {
    const parse = CounselingSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: parse.error.issues });
    }

    const { student_id, mentor_name, date, notes, action_taken } = parse.data;

    const result = await runAsync(
      `INSERT INTO counseling_logs (student_id, mentor_name, date, notes, action_taken, status)
       VALUES (?, ?, ?, ?, ?, 'COMPLETED')`,
      [student_id, mentor_name, date, notes, action_taken]
    );

    await runAsync(
      `INSERT INTO audit_logs (action_type, performed_by, target_id, details) VALUES (?, ?, ?, ?)`,
      ['COUNSELING_RECORDED', mentor_name, student_id, `Recorded counseling session on ${date}. Notes: ${notes.slice(0, 50)}...`]
    );

    return res.json({
      success: true,
      message: 'Counseling session logged successfully.',
      log_id: result.lastID
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function getCounselingLogs(req: Request, res: Response) {
  try {
    const { student_id } = req.query;
    let sql = `SELECT c.*, s.name as student_name, s.department FROM counseling_logs c JOIN students s ON c.student_id = s.student_id`;
    const params: any[] = [];

    if (student_id) {
      sql += ` WHERE c.student_id = ?`;
      params.push(student_id);
    }

    sql += ` ORDER BY c.created_at DESC`;

    const logs = await allAsync(sql, params);
    return res.json({ success: true, logs });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
