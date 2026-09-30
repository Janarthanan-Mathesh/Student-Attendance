import { Request, Response } from 'express';
import { allAsync, getAsync } from '../db/database';
import { evaluateStudentRisk } from '../services/riskService';
import { z } from 'zod';

function getRequesterInfo(req: Request) {
  const requesterId = (req.headers['x-user-id'] || req.query.user_id) as string | undefined;
  const requesterRole = (req.headers['x-user-role'] || req.query.role) as string | undefined;
  return { requesterId, requesterRole };
}

export async function getDeficiencyRecords(req: Request, res: Response) {
  try {
    const { status, filter } = req.query;
    const { requesterId, requesterRole } = getRequesterInfo(req);

    let sql = `
      SELECT d.*, s.name as student_name, s.department, s.section, s.parent_name, s.parent_phone, s.parent_id, c.course_name 
      FROM attendance_deficiency_records d
      JOIN students s ON d.student_id = s.student_id
      JOIN courses c ON d.course_code = c.course_code
    `;

    const clauses: string[] = [];
    const params: any[] = [];

    if (status) {
      clauses.push(`d.deficiency_status = ?`);
      params.push(status);
    }

    // Apply role-based scoping when requester info is provided
    if (requesterRole === 'STUDENT' && requesterId) {
      clauses.push(`d.student_id = ?`);
      params.push(requesterId);
    } else if (requesterRole === 'FACULTY' && requesterId) {
      const user = await getAsync(`SELECT * FROM users WHERE user_id = ? OR register_no = ? LIMIT 1`, [requesterId, requesterId]);
      if (user && user.name) {
        clauses.push(`s.mentor_name = ?`);
        params.push(user.name);
      }
    } else if (requesterRole === 'PARENT' && requesterId) {
      const user = await getAsync(`SELECT * FROM users WHERE user_id = ? OR register_no = ? LIMIT 1`, [requesterId, requesterId]);
      if (user) {
        clauses.push(`s.parent_id = ? OR s.parent_phone = ? OR s.parent_email = ?`);
        params.push(user.user_id, user.phone, user.email);
      }
    }

    if (clauses.length > 0) {
      sql += ` WHERE ` + clauses.join(' AND ');
    }

    const records = await allAsync(sql, params);

    // Apply Smart Filter "Deficient in > 2 subjects" if requested
    if (filter === 'multi_deficient') {
      const studentDeficitCount: Record<string, number> = {};
      records.forEach((r) => {
        if (r.deficiency_status === 'RED_DEFICIENT' || r.deficiency_status === 'CRITICAL_DETENTION') {
          studentDeficitCount[r.student_id] = (studentDeficitCount[r.student_id] || 0) + 1;
        }
      });
      const multiDeficientStudentIds = Object.keys(studentDeficitCount).filter((id) => studentDeficitCount[id] >= 2);
      const filtered = records.filter((r) => multiDeficientStudentIds.includes(r.student_id));
      return res.json({ success: true, records: filtered });
    }

    return res.json({ success: true, records });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

const SimulateSchema = z.object({
  student_id: z.string(),
  course_code: z.string(),
  additional_attended: z.number().min(0),
  additional_conducted: z.number().min(1)
});

export async function simulateAttendance(req: Request, res: Response) {
  try {
    const parse = SimulateSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: parse.error.issues });
    }

    const { student_id, course_code, additional_attended, additional_conducted } = parse.data;

    const record = await getAsync(
      `SELECT * FROM attendance_deficiency_records WHERE student_id = ? AND course_code = ?`,
      [student_id, course_code]
    );

    const baseConducted = record?.total_conducted || 40;
    const baseAttended = record?.total_attended || 28;

    const simulatedConducted = baseConducted + additional_conducted;
    const simulatedAttended = baseAttended + Math.min(additional_attended, additional_conducted);
    const simulatedPct = Number(((simulatedAttended / simulatedConducted) * 100).toFixed(2));

    let simulatedStatus = 'SAFE';
    if (simulatedPct < 65.0) simulatedStatus = 'CRITICAL_DETENTION';
    else if (simulatedPct < 75.0) simulatedStatus = 'RED_DEFICIENT';
    else if (simulatedPct < 80.0) simulatedStatus = 'AMBER_ALERT';

    let neededFor75 = 0;
    if (simulatedPct < 75.0) {
      neededFor75 = Math.ceil((0.75 * simulatedConducted - simulatedAttended) / 0.25);
    }

    return res.json({
      success: true,
      current: {
        total_conducted: baseConducted,
        total_attended: baseAttended,
        current_percentage: record?.current_percentage || 70.0
      },
      simulated: {
        additional_conducted,
        additional_attended,
        total_conducted: simulatedConducted,
        total_attended: simulatedAttended,
        simulated_percentage: simulatedPct,
        simulated_status: simulatedStatus,
        classes_required_for_75: Math.max(0, neededFor75)
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
