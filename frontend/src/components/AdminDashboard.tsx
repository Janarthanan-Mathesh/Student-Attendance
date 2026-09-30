import React, { useState, useEffect } from 'react';
import { fetchDeliveryHealthAPI, fetchAuditLogsAPI, fetchStudents } from '../lib/api';
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

  useEffect(() => {
    loadAdminData();
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

    const headers = parsedRows[0].map((header) => header.trim());
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
        if (res.success) setUploadResult(`Imported ${res.processed_count || 0} students, their parents, and ${res.mentor_count || 0} mentors`);
        else setUploadResult(`Failed: ${res.error || 'unknown'}`);
        if (res.success) await loadAdminData();
      } catch (err: any) {
        setUploadResult(`Error: ${err.message || String(err)}`);
      }
    };
    reader.readAsText(file);
  };

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
              Bulk Upload CSV
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
          <div className="glass-card max-w-lg w-full rounded-2xl p-6 border border-slate-700 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Bulk Upload Students / Parents / Faculty (CSV)</h3>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-slate-400">Upload the attendance CSV with <span className="font-mono">ROLL NO., STUDENT NAME, STUDENT MAIL ID, PARENT NAME (FATHER), PARENT MAIL ID, MENTOR NAME, MENTOR EMAIL, MENTOR ID</span> and attendance totals. Student and parent passwords use the student roll number; mentor passwords use the mentor ID.</p>

            <div>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => handleFileChange(e.target.files ? e.target.files[0] : null)}
                className="w-full text-xs text-slate-200"
              />
            </div>

            {uploadResult && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
                {uploadResult}
              </div>
            )}

            <div className="flex justify-end">
              <button onClick={() => setShowUploadModal(false)} className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300">Close</button>
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
