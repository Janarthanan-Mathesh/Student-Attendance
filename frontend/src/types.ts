export type RiskZone = 'GREEN' | 'AMBER_ALERT' | 'RED_DEFICIENT' | 'CRITICAL_DETENTION' | 'SAFE';

export interface UserProfile {
  id?: number;
  user_id: string;
  name: string;
  register_no: string;
  email: string;
  phone: string;
  role: 'STUDENT' | 'FACULTY' | 'PARENT' | 'ADMIN';
  department: string;
  section?: string;
  parent_name?: string;
  parent_phone?: string;
  parent_email?: string;
  mentor_name?: string;
  demo_mode?: boolean;
  created_at?: string;
}

export interface Student {
  student_id: string;
  name: string;
  register_no: string;
  email: string;
  phone: string;
  parent_id: string;
  parent_name: string;
  parent_phone: string;
  parent_email: string;
  department: string;
  section: string;
  mentor_name: string;
  overall_risk?: RiskZone;
  courses?: DeficiencyRecord[];
}

export interface DeficiencyRecord {
  id: number;
  student_id: string;
  course_code: string;
  course_name?: string;
  total_conducted: number;
  total_attended: number;
  current_percentage: number;
  projected_percentage?: number;
  classes_required_for_75: number;
  deficiency_status: RiskZone;
  last_evaluated_at?: string;
  student_name?: string;
  department?: string;
  section?: string;
  parent_name?: string;
  parent_phone?: string;
}

export interface CommunicationLog {
  id: number;
  student_id: string;
  parent_id: string;
  channel: 'WHATSAPP' | 'SMS' | 'EMAIL' | 'PUSH';
  warning_level: 'ADVISORY' | 'MODERATE' | 'CRITICAL';
  message_payload: string;
  delivery_status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  gateway_response_id?: string;
  is_acknowledged: number;
  acknowledged_at?: string;
  created_at: string;
}

export interface LeaveODRequest {
  id: number;
  student_id: string;
  course_code: string;
  request_type: 'ON_DUTY' | 'MEDICAL' | 'PERSONAL';
  date_from: string;
  date_to: string;
  hours_applied: number;
  reason: string;
  document_name?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approved_by?: string;
  created_at: string;
}

export interface CounselingLog {
  id: number;
  student_id: string;
  mentor_name: string;
  date: string;
  notes: string;
  action_taken: string;
  status: string;
  created_at: string;
}

export interface AuditLog {
  id: number;
  action_type: string;
  performed_by: string;
  target_id: string;
  details: string;
  ip_address: string;
  timestamp: string;
}
