export interface AttendanceRosterRecord {
  registerNo: string;
  name: string;
  studentEmail: string;
  studentPhone: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  mentorName: string;
  mentorEmail: string;
  mentorId: string;
  department: string;
  section: string;
  workingDays: number;
  presentDays: number;
  absentDays: number;
  percentage: number;
}

function value(row: Record<string, unknown>, ...names: string[]): string {
  const normalized = new Map(Object.entries(row).map(([key, fieldValue]) => [key.trim().toUpperCase(), fieldValue]));
  for (const name of names) {
    const fieldValue = normalized.get(name.trim().toUpperCase());
    if (fieldValue !== undefined && fieldValue !== null && String(fieldValue).trim() !== '') return String(fieldValue).trim();
  }
  return '';
}

function valueStartingWith(row: Record<string, unknown>, prefix: string): string {
  const match = Object.entries(row).find(([key, fieldValue]) =>
    key.trim().toUpperCase().startsWith(prefix.trim().toUpperCase()) &&
    fieldValue !== undefined && fieldValue !== null && String(fieldValue).trim() !== ''
  );
  return match ? String(match[1]).trim() : '';
}

function numberValue(input: string, fallback = 0): number {
  const parsed = Number(input.replace(/%/g, '').replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeAttendanceRosterRow(row: Record<string, unknown>): AttendanceRosterRecord | null {
  const registerNo = value(row, 'ROLL NO.', 'register_no', 'Register No', 'Register Number', 'ID').toUpperCase();
  const name = value(row, 'STUDENT NAME', 'name', 'Name');
  if (!registerNo || !name) return null;

  const workingDays = numberValue(value(row, 'TOTAL WORKING DAYS (AS ON 28/08/2026)', 'TOTAL WORKING DAYS', 'total_conducted', 'Working Days') || valueStartingWith(row, 'TOTAL WORKING DAYS (AS ON'));
  const presentDays = numberValue(value(row, 'TOTAL PRESENT DAYS', 'total_attended', 'Present Days'));
  const absentDays = numberValue(value(row, 'TOTAL ABSENT DAYS', 'Absent Days'), Math.max(0, workingDays - presentDays));
  const providedPercent = value(row, 'ATTENDANCE PERCENTAGE', 'current_percentage', 'Attendance Percentage');
  const percentage = providedPercent
    ? numberValue(providedPercent)
    : workingDays > 0 ? Number(((presentDays / workingDays) * 100).toFixed(2)) : 0;
  const mentorName = value(row, 'MENTOR NAME', 'mentor_name', 'Mentor Name', 'Faculty Mentor') || 'Mentor not assigned';
  const mentorEmail = value(row, 'MENTOR EMAIL', 'mentor_email', 'Faculty Email').toLowerCase();
  const mentorId = value(row, 'MENTOR ID', 'mentor_id', 'Faculty ID').toUpperCase();
  const parentName = value(row, 'PARENT NAME (FATHER)', 'PARENT NAME', 'parent_name', 'Father Name') || `Parent/Guardian of ${name}`;
  const parentIdSuffix = registerNo.replace(/[^A-Z0-9]/g, '').toLowerCase();

  return {
    registerNo,
    name,
    studentEmail: value(row, 'STUDENT MAIL ID', 'student_email', 'email', 'Student Email').toLowerCase() || `${registerNo.toLowerCase()}@institution.edu`,
    studentPhone: value(row, 'STUDENT MOBILE NO.', 'student_phone', 'phone', 'Student Phone') || 'N/A',
    parentName,
    parentPhone: value(row, 'PARENT MOBILE NO.', 'parent_phone', 'Parent Phone', 'Parent Mobile') || 'N/A',
    parentEmail: value(row, 'PARENT MAIL ID', 'parent_email', 'Parent Email').toLowerCase() || `${parentIdSuffix}@parent.local`,
    mentorName,
    mentorEmail,
    mentorId,
    department: value(row, 'DEPARTMENT', 'department') || 'Artificial Intelligence and Data Science',
    section: value(row, 'SECTION', 'section') || 'A',
    workingDays,
    presentDays,
    absentDays,
    percentage: Math.max(0, Math.min(100, percentage))
  };
}

export function stableAccountKey(label: string): string {
  let hash = 2166136261;
  for (const character of label.trim().toUpperCase()) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase();
}

export function uniqueAccountEmail(email: string, accountKey: string): string {
  return email.replace(/@/, `+${accountKey.toLowerCase()}@`);
}

export function attendanceRisk(percentage: number): string {
  if (percentage < 65) return 'CRITICAL_DETENTION';
  if (percentage < 75) return 'RED_DEFICIENT';
  if (percentage < 80) return 'AMBER_ALERT';
  return 'SAFE';
}
