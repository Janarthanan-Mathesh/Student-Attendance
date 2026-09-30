export const STUDENT_DEPARTMENTS = {
  CE: { program: 'BE', name: 'Civil Engineering' },
  BM: { program: 'BE', name: 'Biomedical Engineering' },
  CD: { program: 'BE', name: 'Computer Science & Design' },
  CS: { program: 'BE', name: 'Computer Science & Engineering' },
  EE: { program: 'BE', name: 'Electrical & Electronics Engineering' },
  EC: { program: 'BE', name: 'Electronics & Communication Engineering' },
  EI: { program: 'BE', name: 'Electronics & Instrumentation Engineering' },
  IS: { program: 'BE', name: 'Information Science & Engineering' },
  MZ: { program: 'BE', name: 'Mechatronics Engineering' },
  ME: { program: 'BE', name: 'Mechanical Engineering' },
  AD: { program: 'BTECH', name: 'Artificial Intelligence and Data Science' },
  AL: { program: 'BTECH', name: 'Artificial Intelligence and Machine Learning' },
  IT: { program: 'BTECH', name: 'Information Technology' },
  AG: { program: 'BTECH', name: 'Agricultural Engineering' },
  CT: { program: 'BTECH', name: 'Computer Technology' },
  BT: { program: 'BTECH', name: 'Biotechnology' },
  CB: { program: 'BTECH', name: 'Computer Science & Business Systems' },
  FD: { program: 'BTECH', name: 'Food Technology' },
  FT: { program: 'BTECH', name: 'Fashion Technology' },
  TT: { program: 'BTECH', name: 'Textile Technology' }
} as const;

export type DepartmentCode = keyof typeof STUDENT_DEPARTMENTS;
export type StudentIdentityResult =
  | { valid: false; error: string }
  | { valid: true; code: DepartmentCode; name: string };

export function hasInstitutionEmail(email: string) {
  return /^[^\s@]+@bitsathy\.ac\.in$/i.test(email.trim());
}

export function departmentCodeFromRoll(registerNo: string): DepartmentCode | null {
  const match = /^7376(\d{2})([12])([A-Z]{2})(\d{3})$/i.exec(registerNo.trim());
  if (!match) return null;
  const programDigit = match[2];
  const code = match[3].toUpperCase() as DepartmentCode;
  const department = STUDENT_DEPARTMENTS[code];
  if (!department) return null;
  return (programDigit === '1' && department.program === 'BE') ||
    (programDigit === '2' && department.program === 'BTECH') ? code : null;
}

export function departmentCodeFromEmail(email: string): DepartmentCode | null {
  const localPart = email.trim().toLowerCase().split('@')[0] || '';
  const match = /\.([a-z]{2})\d{2}$/.exec(localPart);
  if (!match) return null;
  const code = match[1].toUpperCase() as DepartmentCode;
  return Object.prototype.hasOwnProperty.call(STUDENT_DEPARTMENTS, code) ? code : null;
}

export function departmentCodeFromName(value: string): DepartmentCode | null {
  const trimmed = value.trim();
  const code = trimmed.toUpperCase() as DepartmentCode;
  if (Object.prototype.hasOwnProperty.call(STUDENT_DEPARTMENTS, code)) return code;
  const compact = trimmed.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
  const entry = Object.entries(STUDENT_DEPARTMENTS).find(([, department]) =>
    department.name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '') === compact
  );
  return (entry?.[0] as DepartmentCode | undefined) || null;
}

export function validateStudentDepartmentIdentity(registerNo: string, email: string, departmentName: string): StudentIdentityResult {
  const rollCode = departmentCodeFromRoll(registerNo);
  const rollParts = /^7376(\d{2})([12])([A-Z]{2})(\d{3})$/i.exec(registerNo.trim());
  if (!rollParts) {
    return { valid: false, error: 'Register number must use the format 7376YY[1/2][department code][three digits], for example 7376231CS179.' };
  }
  if (!rollCode) {
    const departmentCode = rollParts[3].toUpperCase();
    if (departmentCode && STUDENT_DEPARTMENTS[departmentCode as DepartmentCode]) {
      return { valid: false, error: `The roll number program digit does not match ${departmentCode} (${STUDENT_DEPARTMENTS[departmentCode as DepartmentCode].program === 'BE' ? 'BE' : 'B.Tech'}).` };
    }
    return { valid: false, error: 'The department code in the roll number is not recognized.' };
  }
  const emailCode = departmentCodeFromEmail(email);
  if (!emailCode) return { valid: false, error: 'Student email must end with a department/year suffix such as .cs23@bitsathy.ac.in.' };
  if (emailCode !== rollCode) return { valid: false, error: `The email department code ${emailCode} does not match roll number department ${rollCode}.` };
  const selectedCode = departmentCodeFromName(departmentName);
  if (!selectedCode) return { valid: false, error: 'Select a department from the approved department list.' };
  if (selectedCode !== rollCode) return { valid: false, error: `Department ${selectedCode} does not match the ${rollCode} code in the roll number and email.` };
  return { valid: true, code: rollCode, name: STUDENT_DEPARTMENTS[rollCode].name };
}

export function validateStudentRosterIdentity(registerNo: string, email: string, department: string) {
  return validateStudentDepartmentIdentity(registerNo, email, department);
}
