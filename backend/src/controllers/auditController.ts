import { Request, Response } from 'express';
import { allAsync } from '../db/database';

export async function getAuditLogs(req: Request, res: Response) {
  try {
    const logs = await allAsync(`SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100`);
    return res.json({ success: true, logs });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
