import { Request, Response } from 'express';
import { allAsync, getAsync } from '../db/database';
import { evaluateStudentRisk } from '../services/riskService';

function getRequesterInfo(req: Request) {
  const requesterId = (req.headers['x-user-id'] || req.query.user_id) as string | undefined;
  const requesterRole = (req.headers['x-user-role'] || req.query.role) as string | undefined;
  return { requesterId, requesterRole };
}

export async function getStudents(req: Request, res: Response) {
  try {
    const { requesterId, requesterRole } = getRequesterInfo(req);

    // If a requester role is provided, apply role-based filtering
    let students: any[] = [];

    if (requesterRole === 'STUDENT' && requesterId) {
      const s = await getAsync(`SELECT * FROM students WHERE student_id = ? OR register_no = ?`, [requesterId, requesterId]);
      if (s) students = [s];
    } else if (requesterRole === 'FACULTY' && requesterId) {
      const user = await getAsync(`SELECT * FROM users WHERE user_id = ? OR register_no = ? LIMIT 1`, [requesterId, requesterId]);
      if (user && user.name) {
        students = await allAsync(`SELECT * FROM students WHERE mentor_name = ? ORDER BY name ASC`, [user.name]);
      }
    } else if (requesterRole === 'PARENT' && requesterId) {
      const user = await getAsync(`SELECT * FROM users WHERE user_id = ? OR register_no = ? LIMIT 1`, [requesterId, requesterId]);
      if (user) {
        students = await allAsync(`SELECT * FROM students WHERE parent_id = ? OR parent_phone = ? OR parent_email = ? ORDER BY name ASC`, [user.user_id, user.phone, user.email]);
      }
    }

    // Default: no requester info or ADMIN or fallback -> return all students
    if (!students || students.length === 0) {
      students = await allAsync(`SELECT * FROM students ORDER BY name ASC`);
    }

    // Enrich with dynamic risk summaries
    const enriched: any[] = [];
    for (const s of students) {
      const records = await allAsync(`SELECT * FROM attendance_deficiency_records WHERE student_id = ?`, [s.student_id]);

      // Calculate worst risk status
      let highestRisk = 'SAFE';
      for (const r of records) {
        if (r.deficiency_status === 'CRITICAL_DETENTION') highestRisk = 'CRITICAL_DETENTION';
        else if (r.deficiency_status === 'RED_DEFICIENT' && highestRisk !== 'CRITICAL_DETENTION') highestRisk = 'RED_DEFICIENT';
        else if (r.deficiency_status === 'AMBER_ALERT' && highestRisk === 'SAFE') highestRisk = 'AMBER_ALERT';
      }

      enriched.push({
        ...s,
        courses: records,
        overall_risk: highestRisk
      });
    }

    return res.json({ success: true, students: enriched });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function getStudentById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const student = await getAsync(`SELECT * FROM students WHERE student_id = ? OR register_no = ?`, [id, id]);

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    // Enforce role-based access if requester info provided
    const { requesterId, requesterRole } = getRequesterInfo(req);
    if (requesterRole) {
      if (requesterRole === 'STUDENT' && requesterId && requesterId !== student.student_id && requesterId !== student.register_no) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      if (requesterRole === 'FACULTY' && requesterId) {
        const user = await getAsync(`SELECT * FROM users WHERE user_id = ? OR register_no = ? LIMIT 1`, [requesterId, requesterId]);
        if (user && user.name && student.mentor_name !== user.name) {
          return res.status(403).json({ success: false, error: 'Access denied' });
        }
      }

      if (requesterRole === 'PARENT' && requesterId) {
        const user = await getAsync(`SELECT * FROM users WHERE user_id = ? OR register_no = ? LIMIT 1`, [requesterId, requesterId]);
        if (user && user.user_id && student.parent_id !== user.user_id && student.parent_phone !== user.phone && student.parent_email !== user.email) {
          return res.status(403).json({ success: false, error: 'Access denied' });
        }
      }
    }

    // Re-evaluate risk for student courses
    const rawRecords = await allAsync(`SELECT * FROM attendance_deficiency_records WHERE student_id = ?`, [student.student_id]);
    const evaluatedRecords = [];
    for (const r of rawRecords) {
      const evalRes = await evaluateStudentRisk(r.student_id, r.course_code);
      evaluatedRecords.push({
        ...r,
        ...evalRes
      });
    }

    const commLogs = await allAsync(`SELECT * FROM communication_logs WHERE student_id = ? ORDER BY created_at DESC`, [student.student_id]);
    const leaveRequests = await allAsync(`SELECT * FROM leave_od_requests WHERE student_id = ? ORDER BY created_at DESC`, [student.student_id]);
    const counselingLogs = await allAsync(`SELECT * FROM counseling_logs WHERE student_id = ? ORDER BY created_at DESC`, [student.student_id]);

    return res.json({
      success: true,
      student,
      deficiency_records: evaluatedRecords,
      communication_logs: commLogs,
      leave_od_requests: leaveRequests,
      counseling_logs: counselingLogs
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
