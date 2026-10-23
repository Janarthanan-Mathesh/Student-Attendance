import React, { useState, useEffect } from 'react';
import { fetchDeliveryHealthAPI, fetchAuditLogsAPI, fetchStudents, fetchRegistrationOptionsAPI } from '../lib/api';
import { uploadBulkExcelAPI } from '../lib/api';
import { AuditLog, Student } from '../types';
import { ShieldCheck, Activity, Send, CheckCircle2, AlertTriangle, Search, Server, FileCheck } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

export const AdminDashboard: React.FC = () => {
  const [health, setHealth] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<'bulk' | 'single'>('bulk');
  const [departments, setDepartments] = useState<Array<{ code: string; name: string }>>([]);
  const [registeredMentors, setRegisteredMentors] = useState<Array<{ register_no: string; name: string; email: string }>>([]);
  const [registrationOptionsError, setRegistrationOptionsError] = useState<string | null>(null);
  const [registrationOptionsLoading, setRegistrationOptionsLoading] = useState<boolean>(true);
  const [singleStudent, setSingleStudent] = useState({
    registerNo: '', name: '', studentEmail: '', studentPhone: '', parentName: '', parentPhone: '', parentEmail: '',
    mentorName: '', mentorEmail: '', mentorId: '', department: '', workingDays: '', presentDays: ''
  });

  useEffect(() => {
    loadAdminData();
    loadRegistrationOptions();
  }, []);

  const loadAdminData = async () => {
    try {
      const hData = await fetchDeliveryHealthAPI();
      if (hData.success) {
        setHealth(hData.health_metrics);
      }

      const logs = await fetchAuditLogsAPI();
      setAuditLogs(logs);

      const roster = await fetchStudents();
      setStudents(roster);
    } catch (e) {
      console.error(e);
    }
  };

  const loadRegistrationOptions = async () => {
    setRegistrationOptionsError(null);
    setRegistrationOptionsLoading(true);
    try {
      const result = await fetchRegistrationOptionsAPI();
      if (!result.success) throw new Error(result.error || 'Could not load registration options.');
      setDepartments(result.departments || []);
      setRegisteredMentors(result.mentors || []);
    } catch (error) {
      setRegistrationOptionsError(error instanceof Error ? error.message : 'Could not load registration options.');
    } finally {
      setRegistrationOptionsLoading(false);
    }
  };

  const averageAttendance = (student: Student) => student.courses?.length
    ? student.courses.reduce((sum, course) => sum + course.current_percentage, 0) / student.courses.length
    : 0;
  const pieData = [
    { name: 'High (80%+)', value: students.filter((student) => averageAttendance(student) >= 80).length, color: '#10b981' },
    { name: 'Medium (75–79.9%)', value: students.filter((student) => averageAttendance(student) >= 75 && averageAttendance(student) < 80).length, color: '#f59e0b' },
    { name: 'Low (65–74.9%)', value: students.filter((student) => averageAttendance(student) >= 65 && averageAttendance(student) < 75).length, color: '#ef4444' },
    { name: 'Critical (<65%)', value: students.filter((student) => averageAttendance(student) < 65).length, color: '#881337' }
  ];

  const channelData = health ? [
    { channel: 'WhatsApp', count: health.channel_breakdown.WHATSAPP || 0 },
    { channel: 'SMS', count: health.channel_breakdown.SMS || 0 },
    { channel: 'Email', count: health.channel_breakdown.EMAIL || 0 },
    { channel: 'Web Push', count: health.channel_breakdown.PUSH || 0 }
  ] : [];

  const filteredAuditLogs = auditLogs.filter(
    (l) =>
      l.action_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.performed_by.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.target_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.details.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const parseCSV = (text: string) => {
    const parsedRows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    const source = text.replace(/^\uFEFF/, '');

    for (let i = 0; i < source.length; i++) {
      const character = source[i];
      if (character === '"') {
        if (quoted && source[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = !quoted;
        }
      } else if (character === ',' && !quoted) {
        row.push(cell.trim());
        cell = '';
      } else if ((character === '\n' || character === '\r') && !quoted) {
        if (character === '\r' && source[i + 1] === '\n') i++;
        row.push(cell.trim());
        if (row.some((value) => value !== '')) parsedRows.push(row);
        row = [];
        cell = '';
      } else {
        cell += character;
      }
    }
    row.push(cell.trim());
    if (row.some((value) => value !== '')) parsedRows.push(row);
    if (parsedRows.length < 2) return [];

    const headers = parsedRows[0].map((header) => header.trim().toUpperCase());
    return parsedRows.slice(1).map((columns) => Object.fromEntries(headers.map((header, index) => [header, columns[index] || ''])));
  };

  const handleFileChange = async (file: File | null) => {
    setUploadResult(null);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      try {
        const res = await uploadBulkExcelAPI(rows);
        if (res.success) setUploadResult(`IMPORTED ${res.processed_count || 0} STUDENTS, THEIR PARENTS, AND ${res.mentor_count || 0} MENTORS`);
        else setUploadResult(`FAILED: ${res.error || 'UNKNOWN'}`.toUpperCase());
        if (res.success) await loadAdminData();
      } catch (err: any) {
        setUploadResult(`ERROR: ${err.message || String(err)}`.toUpperCase());
      }
    };
    reader.readAsText(file);
  };

  const handleSingleStudentSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUploadResult(null);
    try {
      const row = {
        'ROLL NO.': singleStudent.registerNo.trim().toUpperCase(),
        'STUDENT NAME': singleStudent.name.trim(),
        'STUDENT MAIL ID': singleStudent.studentEmail.trim().toLowerCase(),
        'STUDENT MOBILE NO.': singleStudent.studentPhone.trim(),
        'PARENT NAME (FATHER)': singleStudent.parentName.trim(),
        'PARENT MOBILE NO.': singleStudent.parentPhone.trim(),
        'PARENT MAIL ID': singleStudent.parentEmail.trim().toLowerCase(),
        'MENTOR NAME': singleStudent.mentorName.trim(),
        'MENTOR EMAIL': singleStudent.mentorEmail.trim().toLowerCase(),
        'MENTOR ID': singleStudent.mentorId.trim().toUpperCase(),
        DEPARTMENT: singleStudent.department,
        'TOTAL WORKING DAYS': singleStudent.workingDays || '0',
        'TOTAL PRESENT DAYS': singleStudent.presentDays || '0'
      };
      const res = await uploadBulkExcelAPI([row]);
      if (res.success) {
        setUploadResult(`REGISTERED ${res.processed_count || 0} STUDENT, PARENT, AND ${res.mentor_count || 0} MENTOR`);
        setSingleStudent({ registerNo: '', name: '', studentEmail: '', studentPhone: '', parentName: '', parentPhone: '', parentEmail: '', mentorName: '', mentorEmail: '', mentorId: '', department: '', workingDays: '', presentDays: '' });
        await loadAdminData();
      } else setUploadResult(`FAILED: ${res.error || 'UNKNOWN ERROR'}`);
    } catch (err: any) {
      setUploadResult(`ERROR: ${err.message || String(err)}`);
    }
  };

  const formFieldClass = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-purple-500 focus:outline-none';

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="glass-card rounded-2xl p-6 border border-purple-500/20 bg-gradient-to-r from-slate-900 via-purple-950/30 to-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Institutional HOD & Accreditation Portal
            </span>
            <span className="text-xs text-slate-400">Compliance & Delivery Health</span>
          </div>
          <h2 className="text-2xl font-extrabold text-white mt-1">Department Deficiency Analytics & Audit Logs</h2>
          <p className="text-xs text-slate-300">
            Real-time gateway delivery receipts, multi-channel health metrics, and tamper-proof compliance logs.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center gap-2">
            <button
              onClick={loadAdminData}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-lg shadow-purple-600/30"
            >
              Refresh System Health
            </button>

            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/30"
            >
              BULK UPLOAD CSV
            </button>
          </div>
        </div>
      </div>

      {/* Gateway Health Metrics Cards */}
      {health && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="glass-card rounded-xl p-4 border border-slate-800 space-y-1">
            <span className="text-xs text-slate-400">Total Dispatched</span>
            <p className="text-2xl font-extrabold text-white">{health.total_dispatched}</p>
            <span className="text-[10px] text-slate-500">Across all 4 gateways</span>
          </div>

          <div className="glass-card rounded-xl p-4 border border-slate-800 space-y-1">
            <span className="text-xs text-slate-400">Delivery Success Rate</span>
            <p className="text-2xl font-extrabold text-emerald-400">{health.delivery_rate}%</p>
            <span className="text-[10px] text-emerald-400/80">WhatsApp + SMS Verified</span>
          </div>

          <div className="glass-card rounded-xl p-4 border border-slate-800 space-y-1">
            <span className="text-xs text-slate-400">Parent Acknowledgment Rate</span>
            <p className="text-2xl font-extrabold text-cyan-400">{health.acknowledgment_rate}%</p>
            <span className="text-[10px] text-cyan-400/80">Digital Signatures</span>
          </div>

          <div className="glass-card rounded-xl p-4 border border-slate-800 space-y-1">
            <span className="text-xs text-slate-400">Bounce / Fail Rate</span>
            <p className="text-2xl font-extrabold text-rose-400">{health.bounce_rate}%</p>
            <span className="text-[10px] text-slate-500">Automatic Fallback Active</span>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="glass-card max-w-3xl w-full max-h-[90vh] overflow-y-auto rounded-2xl p-6 border border-slate-700 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold uppercase text-white">Student Registration</h3>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-900 p-1">
              <button type="button" onClick={() => { setUploadMode('bulk'); setUploadResult(null); }} className={`rounded-lg px-4 py-2 text-xs font-bold uppercase ${uploadMode === 'bulk' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}>Bulk CSV Upload</button>
              <button type="button" onClick={() => { setUploadMode('single'); setUploadResult(null); loadRegistrationOptions(); }} className={`rounded-lg px-4 py-2 text-xs font-bold uppercase ${uploadMode === 'single' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}>Single Student Form</button>
            </div>

            {uploadMode === 'bulk' ? (
              <div className="space-y-3">
                <p className="text-xs uppercase leading-relaxed text-slate-400">UPLOAD THE ATTENDANCE CSV WITH <span className="font-mono text-slate-300">ROLL NO., STUDENT NAME, STUDENT MAIL ID, PARENT NAME (FATHER), PARENT MAIL ID, MENTOR NAME, MENTOR EMAIL, MENTOR ID</span> AND ATTENDANCE TOTALS. HEADERS ARE ACCEPTED REGARDLESS OF CASE.</p>
                <input type="file" accept=".csv,text/csv" onChange={(e) => handleFileChange(e.target.files ? e.target.files[0] : null)} className="w-full text-xs text-slate-200" />
              </div>
            ) : (
              <form onSubmit={handleSingleStudentSubmit} className="space-y-4">
                <p className="text-xs uppercase text-slate-400">ENTER STUDENT, PARENT, AND MENTOR DETAILS. INITIAL STUDENT/PARENT PASSWORD IS THE ROLL NUMBER; MENTOR PASSWORD IS THE MENTOR ID.</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    ['registerNo', 'ROLL NUMBER', true], ['name', 'STUDENT NAME', true], ['studentEmail', 'STUDENT EMAIL', true], ['studentPhone', 'STUDENT PHONE', false],
                    ['parentName', 'PARENT / GUARDIAN NAME', true], ['parentPhone', 'PARENT PHONE', false], ['parentEmail', 'PARENT EMAIL', true],
                    ['workingDays', 'TOTAL WORKING DAYS', false], ['presentDays', 'TOTAL PRESENT DAYS', false]
                  ].map(([key, label, required]) => (
                    <label key={String(key)} className="space-y-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {String(label)}
                      <input
                        required={Boolean(required)}
                        type={String(key).toLowerCase().includes('email') ? 'email' : ['workingDays', 'presentDays'].includes(String(key)) ? 'number' : 'text'}
                        min={['workingDays', 'presentDays'].includes(String(key)) ? '0' : undefined}
                        inputMode={['workingDays', 'presentDays'].includes(String(key)) ? 'numeric' : undefined}
                        placeholder={key === 'department' ? 'E.G. CS OR COMPUTER SCIENCE & ENGINEERING' : undefined}
                        value={singleStudent[key as keyof typeof singleStudent]}
                        onChange={(e) => setSingleStudent((current) => ({ ...current, [String(key)]: e.target.value }))}
                        className={formFieldClass}
                      />
                    </label>
                  ))}
                  <label className="space-y-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    DEPARTMENT (MATCH ROLL NUMBER)
                    <select
                      required
                      value={singleStudent.department}
                      onChange={(e) => setSingleStudent((current) => ({ ...current, department: e.target.value }))}
                      className={formFieldClass}
                    >
                      <option value="" disabled>{registrationOptionsLoading ? 'LOADING DEPARTMENTS…' : registrationOptionsError ? 'DEPARTMENTS UNAVAILABLE' : 'SELECT DEPARTMENT'}</option>
                      {departments.map((department) => <option key={department.code} value={department.name}>{department.name.toUpperCase()}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    SELECT REGISTERED MENTOR (NAME — ID)
                    <select
                      required
                      value={singleStudent.mentorId}
                      onChange={(e) => {
                        const mentor = registeredMentors.find((candidate) => candidate.register_no === e.target.value);
                        setSingleStudent((current) => ({
                          ...current,
                          mentorId: mentor?.register_no || '',
                          mentorName: mentor?.name || '',
                          mentorEmail: mentor?.email || ''
                        }));
                      }}
                      className={formFieldClass}
                    >
                      <option value="" disabled>{registrationOptionsLoading ? 'LOADING REGISTERED MENTORS…' : registrationOptionsError ? 'MENTORS UNAVAILABLE' : 'SELECT MENTOR'}</option>
                      {registeredMentors.map((mentor) => (
                        <option key={mentor.register_no} value={mentor.register_no}>{mentor.name.toUpperCase()} — {mentor.register_no.toUpperCase()}</option>
                      ))}
                    </select>
                    {singleStudent.mentorId && <span className="block pt-1 text-[10px] text-slate-500">ID: {singleStudent.mentorId} · EMAIL: {singleStudent.mentorEmail}</span>}
                  </label>
                </div>
                {registrationOptionsError && <p className="text-xs text-rose-300">{registrationOptionsError}</p>}
                {!registrationOptionsLoading && !registrationOptionsError && registeredMentors.length === 0 && <p className="text-xs text-amber-300">NO REGISTERED FACULTY ACCOUNTS FOUND. ADD A FACULTY ACCOUNT BEFORE REGISTERING A STUDENT.</p>}
                <button type="submit" disabled={registrationOptionsLoading || Boolean(registrationOptionsError) || departments.length === 0 || registeredMentors.length === 0} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold uppercase text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">Register Student</button>
              </form>
            )}

            {uploadResult && (
              <div className={`p-3 rounded-xl border text-xs uppercase ${uploadResult.startsWith('FAILED') || uploadResult.startsWith('ERROR') ? 'bg-rose-500/10 border-rose-500/20 text-rose-300' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'}`}>
                {uploadResult}
              </div>
            )}

            <div className="flex justify-end">
              <button onClick={() => setShowUploadModal(false)} className="px-4 py-2 rounded-lg bg-slate-800 text-xs font-semibold uppercase text-slate-300">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Department Risk Distribution Pie Chart */}
        <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            Department Risk Categorization Breakdown
          </h3>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
            {pieData.map((p, i) => (
              <div key={i} className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="text-slate-300">{p.name}: <strong className="text-white">{p.value} students</strong></span>
              </div>
            ))}
          </div>
        </div>

        {/* Multi-Channel Dispatch Volume Bar Chart */}
        <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <Send className="w-5 h-5 text-indigo-400" />
            Multi-Channel Dispatcher Volume
          </h3>

          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelData}>
                <XAxis dataKey="channel" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }} />
                <Bar dataKey="count" fill="#818cf8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tamper-Proof Audit Trail Table */}
      <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden space-y-4">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/60">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-bold text-white text-base">Immutable Audit Trail Logs</h3>
              <p className="text-xs text-slate-400">Cryptographically verifiable event log of all system evaluation & administrative actions</p>
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search audit logs..."
              className="bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500 w-full sm:w-64"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900/80 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="p-4">Timestamp</th>
                <th className="p-4">Action Type</th>
                <th className="p-4">Performed By</th>
                <th className="p-4">Target ID</th>
                <th className="p-4">Event Details</th>
                <th className="p-4">Origin IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredAuditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/40">
                  <td className="p-4 text-slate-400">{log.timestamp}</td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30 text-[10px]">
                      {log.action_type}
                    </span>
                  </td>
                  <td className="p-4 text-slate-200">{log.performed_by}</td>
                  <td className="p-4 text-cyan-400">{log.target_id}</td>
                  <td className="p-4 text-slate-300 max-w-xs truncate">{log.details}</td>
                  <td className="p-4 text-slate-500">{log.ip_address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
