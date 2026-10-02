import { Student, DeficiencyRecord, CommunicationLog, LeaveODRequest, CounselingLog, AuditLog, UserProfile } from '../types';

// Set VITE_API_BASE_URL in production to the deployed backend URL ending in /api.
// In local development, the relative path is served through Vite's /api proxy.
export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

function getUserHeaders() {
  try {
    const saved = localStorage.getItem('attendance_tracker_user');
    if (!saved) return {};
    const parsed = JSON.parse(saved || '{}');
    const u = parsed.user || parsed;
    const id = u?.user_id || u?.register_no || '';
    const role = u?.role || '';
    const headers: Record<string, string> = {};
    if (id) headers['X-User-Id'] = id;
    if (role) headers['X-User-Role'] = role;
    return headers;
  } catch (e) {
    return {};
  }
}

export async function registerUserAPI(data: any) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return await res.json();
}

export async function verifyRegistrationOTPAPI(challenge_id: string, otp_code: string) {
  const res = await fetch(`${API_BASE}/auth/register/verify-authenticator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challenge_id, otp_code })
  });
  return await res.json();
}

export async function loginUserAPI(identifier: string, password?: string, role?: UserProfile['role']) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password, role })
  });
  return await res.json();
}

export async function updateProfileAPI(data: any) {
  const res = await fetch(`${API_BASE}/auth/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return await res.json();
}

export async function verifyLoginOTPAPI(challenge_id: string, otp_code: string) {
  const res = await fetch(`${API_BASE}/auth/login/verify-authenticator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challenge_id, otp_code })
  });
  return await res.json();
}

export async function beginAdminAuthenticatorSetupAPI(identifier: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/admin/setup-authenticator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password })
  });
  return await res.json();
}

export async function verifyAdminAuthenticatorSetupAPI(challenge_id: string, otp_code: string) {
  const res = await fetch(`${API_BASE}/auth/admin/verify-authenticator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challenge_id, otp_code })
  });
  return await res.json();
}

export async function uploadBulkExcelAPI(rows: any[]) {
  const res = await fetch(`${API_BASE}/upload/bulk-excel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getUserHeaders() },
    body: JSON.stringify({ rows })
  });
  return await res.json();
}

export async function fetchStudents(): Promise<Student[]> {
  const res = await fetch(`${API_BASE}/students`, { headers: { ...getUserHeaders() } });
  const json = await res.json();
  return json.students || [];
}

export async function fetchStudentDetails(id: string): Promise<any> {
  const res = await fetch(`${API_BASE}/students/${id}`, { headers: { ...getUserHeaders() } });
  return await res.json();
}

export async function fetchDeficiencyRecords(status?: string, filter?: string): Promise<DeficiencyRecord[]> {
  let url = `${API_BASE}/deficiency-records?`;
  if (status) url += `status=${status}&`;
  if (filter) url += `filter=${filter}`;
  const res = await fetch(url, { headers: { ...getUserHeaders() } });
  const json = await res.json();
  return json.records || [];
}

export async function simulateAttendanceAPI(data: { student_id: string; course_code: string; additional_attended: number; additional_conducted: number }) {
  const res = await fetch(`${API_BASE}/deficiency/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return await res.json();
}

export async function dispatchBatchAlertsAPI(data: { student_ids: string[]; channel: string; warning_level: string; custom_note?: string }) {
  const res = await fetch(`${API_BASE}/notifications/dispatch-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return await res.json();
}

export async function fetchDeliveryHealthAPI() {
  const res = await fetch(`${API_BASE}/notifications/health`);
  return await res.json();
}

export async function sendWhatsAppReplyAPI(student_id: string, reply_text: string) {
  const res = await fetch(`${API_BASE}/whatsapp/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ student_id, reply_text })
  });
  return await res.json();
}

export async function submitLeaveODAPI(data: any) {
  const res = await fetch(`${API_BASE}/leave-od`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return await res.json();
}

export async function approveLeaveODAPI(id: number, status: string, approved_by: string) {
  const res = await fetch(`${API_BASE}/leave-od/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, approved_by })
  });
  return await res.json();
}

export async function submitCounselingAPI(data: any) {
  const res = await fetch(`${API_BASE}/counseling`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return await res.json();
}

export async function fetchAuditLogsAPI(): Promise<AuditLog[]> {
  const res = await fetch(`${API_BASE}/audit-logs`);
  const json = await res.json();
  return json.logs || [];
}
