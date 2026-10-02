import React, { useState, useEffect } from 'react';
import { Student, DeficiencyRecord } from '../types';
import { simulateAttendanceAPI, submitLeaveODAPI } from '../lib/api';
import { Calculator, AlertTriangle, CheckCircle, FileText, Upload, TrendingUp, Zap, Sparkles } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface StudentDashboardProps {
  student: Student;
  onOpenPDF: (studentId: string, courseCode: string) => void;
}

const dailyAttendanceSchedule = [
  { time: 'Biometric Forenoon', status: 'Present' },
  { time: '08:45 AM – 09:35 AM', status: 'Present' },
  { time: '09:35 AM – 10:25 AM', status: 'Absent' },
  { time: '10:40 AM – 11:30 AM', status: 'Present' },
  { time: '11:30 AM – 12:20 PM', status: 'Present' },
  { time: 'Biometric Afternoon', status: 'Present' },
  { time: '01:30 PM – 02:20 PM', status: 'Present' },
  { time: '02:20 PM – 03:10 PM', status: 'Present' },
  { time: '03:25 PM – 04:25 PM', status: 'Present' }
];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read the selected document.'));
    reader.onerror = () => reject(new Error('Could not read the selected document.'));
    reader.readAsDataURL(file);
  });
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ student, onOpenPDF }) => {
  const [selectedCourse, setSelectedCourse] = useState<DeficiencyRecord | null>(null);
  
  // Simulator State
  const [simAttended, setSimAttended] = useState<number>(5);
  const [simConducted, setSimConducted] = useState<number>(5);
  const [simResult, setSimResult] = useState<any>(null);

  // OD / Leave Drawer State
  const [showODDrawer, setShowODDrawer] = useState<boolean>(false);
  const [odType, setOdType] = useState<'ON_DUTY' | 'MEDICAL'>('ON_DUTY');
  const [odReason, setOdReason] = useState<string>('');
  const [odHours, setOdHours] = useState<number>(4);
  const [odDateFrom, setOdDateFrom] = useState<string>('2026-08-30');
  const [odDateTo, setOdDateTo] = useState<string>('2026-08-31');
  const [odDocument, setOdDocument] = useState<File | null>(null);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [odMessage, setOdMessage] = useState<string | null>(null);
  const [odSubmitting, setOdSubmitting] = useState(false);

  // Dispute Drawer State
  const [showDisputeDrawer, setShowDisputeDrawer] = useState<boolean>(false);
  const [disputeNote, setDisputeNote] = useState<string>('');
  const [disputeSent, setDisputeSent] = useState<boolean>(false);

  useEffect(() => {
    if (student.courses && student.courses.length > 0) {
      setSelectedCourse(student.courses[0]);
    }
  }, [student]);

  useEffect(() => {
    if (selectedCourse) {
      handleRunSimulation(simAttended, simConducted);
    }
  }, [selectedCourse, simAttended, simConducted]);

  const handleRunSimulation = async (attended: number, conducted: number) => {
    if (!selectedCourse) return;
    try {
      const res = await simulateAttendanceAPI({
        student_id: student.student_id,
        course_code: selectedCourse.course_code,
        additional_attended: attended,
        additional_conducted: conducted
      });
      if (res.success) {
        setSimResult(res.simulated);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmitOD = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;
    setOdMessage(null);
    if (odType === 'MEDICAL' && !odDocument) {
      setOdMessage('Please attach a medical document before submitting.');
      return;
    }
    if (odDocument && odDocument.size > 10 * 1024 * 1024) {
      setOdMessage('The document must be 10 MB or smaller.');
      return;
    }

    setOdSubmitting(true);
    try {
    const res = await submitLeaveODAPI({
      student_id: student.student_id,
      course_code: selectedCourse.course_code,
      request_type: odType,
      date_from: odDateFrom,
      date_to: odDateTo,
      hours_applied: odHours,
      reason: odReason || 'Submitted via Student Portal',
      document_name: odDocument?.name,
      document_data: odDocument ? await readFileAsDataUrl(odDocument) : undefined
    });

    if (res.success) {
      setOdMessage('Request submitted! Automatic reconciliation pending mentor sign-off.');
      setTimeout(() => {
        setShowODDrawer(false);
        setOdMessage(null);
      }, 2000);
    } else {
      const error = Array.isArray(res.error) ? res.error.map((item: any) => item.message).join(' ') : res.error;
      setOdMessage(error || 'The request could not be submitted. Please try again.');
    }
    } catch (error) {
      setOdMessage(error instanceof Error ? error.message : 'Document upload failed. Please try again.');
    } finally {
      setOdSubmitting(false);
    }
  };

  const handleSendDispute = (e: React.FormEvent) => {
    e.preventDefault();
    setDisputeSent(true);
    setTimeout(() => {
      setShowDisputeDrawer(false);
      setDisputeSent(false);
      setDisputeNote('');
    }, 2000);
  };

  // Generate Trajectory Chart Data
  const getTrajectoryData = (course: DeficiencyRecord) => {
    const curPct = course.current_percentage;
    const projPct = course.projected_percentage || curPct;

    return [
      { week: 'Roster Snapshot', percentage: curPct },
      { week: 'Projected', percentage: projPct }
    ];
  };

  return (
    <div className="space-y-6">
      {/* Student Welcome Banner */}
      <div className="glass-card rounded-2xl p-6 relative overflow-hidden border border-cyan-500/20 bg-gradient-to-r from-slate-900 via-cyan-950/30 to-indigo-950/40">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Sparkles className="w-48 h-48 text-cyan-400" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Student Profile
              </span>
              <span className="text-xs text-slate-400">Reg No: {student.register_no}</span>
            </div>
            <h2 className="text-2xl font-extrabold text-white mt-1">{student.name}</h2>
            <p className="text-sm text-slate-300">
              {student.department} • Section {student.section} • Mentor: <span className="text-cyan-300 font-semibold">{student.mentor_name}</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowODDrawer(true)}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs shadow-lg shadow-cyan-600/30 transition-all"
            >
              <Upload className="w-4 h-4" />
              <span>Submit OD / Medical</span>
            </button>
            <button
              onClick={() => setShowDisputeDrawer(true)}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs transition-all"
            >
              <FileText className="w-4 h-4" />
              <span>Dispute Attendance</span>
            </button>
          </div>
        </div>
      </div>

      {/* Course Selection Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2">
        {student.courses?.map((c) => {
          const isSelected = selectedCourse?.course_code === c.course_code;
          const isAmber = c.deficiency_status === 'AMBER_ALERT';
          const isRed = c.deficiency_status === 'RED_DEFICIENT';
          const isCritical = c.deficiency_status === 'CRITICAL_DETENTION';

          let statusBadgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
          if (isAmber) statusBadgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
          if (isRed) statusBadgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
          if (isCritical) statusBadgeColor = 'bg-red-900/40 text-red-300 border-red-700';

          return (
            <button
              key={c.course_code}
              onClick={() => setSelectedCourse(c)}
              className={`flex flex-col items-start px-4 py-3 rounded-xl border text-left min-w-[200px] transition-all ${
                isSelected
                  ? 'glass-card border-cyan-500 bg-cyan-950/30 ring-1 ring-cyan-500/50'
                  : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-bold text-slate-300">{c.course_code}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusBadgeColor}`}>
                  {c.current_percentage}%
                </span>
              </div>
              <span className="text-xs text-slate-400 truncate max-w-[170px] mt-1">{c.course_name || 'Subject Title'}</span>
            </button>
          );
        })}
      </div>

      {/* Attendance totals and per-course present / absent counts */}
      <section className="glass-card rounded-2xl p-5 border border-slate-800 space-y-4">
        <div>
          <h3 className="font-bold text-white">Attendance Summary</h3>
          <p className="text-xs text-slate-400">Present and absent class hours recorded for your courses.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-emerald-950/30 border border-emerald-500/20 p-4">
            <p className="text-xs text-slate-400">Present classes</p>
            <p className="text-2xl font-extrabold text-emerald-400">{(student.courses || []).reduce((sum, course) => sum + course.total_attended, 0)}</p>
          </div>
          <div className="rounded-xl bg-rose-950/30 border border-rose-500/20 p-4">
            <p className="text-xs text-slate-400">Absent classes</p>
            <p className="text-2xl font-extrabold text-rose-400">{(student.courses || []).reduce((sum, course) => sum + course.total_conducted - course.total_attended, 0)}</p>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/30">
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead className="bg-slate-900/80 text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Course</th>
                <th scope="col" className="px-4 py-3 text-center font-semibold">Present</th>
                <th scope="col" className="px-4 py-3 text-center font-semibold">Absent</th>
                <th scope="col" className="px-4 py-3 text-center font-semibold">Conducted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {(student.courses || []).map((course) => <tr key={course.course_code} className="transition-colors hover:bg-slate-900/60">
                <th scope="row" className="px-4 py-3 font-semibold text-slate-200">{course.course_code}<span className="block mt-1 text-[10px] font-normal text-slate-500">{course.course_name || 'Course attendance'}</span></th>
                <td className="px-4 py-3 text-center"><span className="inline-flex min-w-12 justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 font-bold tabular-nums text-emerald-300">{course.total_attended}</span></td>
                <td className="px-4 py-3 text-center"><span className="inline-flex min-w-12 justify-center rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 font-bold tabular-nums text-rose-300">{course.total_conducted - course.total_attended}</span></td>
                <td className="px-4 py-3 text-center"><span className="inline-flex min-w-12 justify-center rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-1.5 font-bold tabular-nums text-slate-200">{course.total_conducted}</span></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </section>

      <section className="glass-card rounded-2xl p-5 border border-cyan-500/20 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-white">Hourly Attendance</h3>
            <p className="text-xs text-slate-400">Choose a date to review its class periods.</p>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300">Date <input type="date" value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200" /></label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {dailyAttendanceSchedule.map((slot) => (
            <div key={slot.time} className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${slot.status ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-900/40 border-slate-800/60'}`}>
              <span className={`text-xs ${slot.status ? 'text-slate-200' : 'text-slate-500'}`}>{slot.time}</span>
              {slot.status ? <span className={`text-xs font-bold ${slot.status === 'Present' ? 'text-emerald-400' : 'text-rose-400'}`}>{slot.status}</span> : <span className="text-[10px] text-slate-500">No attendance</span>}
            </div>
          ))}
        </div>
      </section>

      {selectedCourse && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Trajectory & Gauge Meter Card */}
          <div className="lg:col-span-2 glass-card rounded-2xl p-6 border border-slate-800 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-cyan-400" />
                  Predictive Trajectory Forecast
                </h3>
                <p className="text-xs text-slate-400">
                  ML projected final attendance at Week 15 based on velocity trends
                </p>
              </div>

              <button
                onClick={() => onOpenPDF(student.student_id, selectedCourse.course_code)}
                className="px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/30 text-xs font-semibold flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Export PDF Notice</span>
              </button>
            </div>

            {/* Gauge & Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
              <div>
                <span className="text-xs text-slate-400">Current %</span>
                <p className={`text-xl font-extrabold ${selectedCourse.current_percentage < 75 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {selectedCourse.current_percentage}%
                </p>
                <span className="text-[10px] text-slate-500">{selectedCourse.total_attended} / {selectedCourse.total_conducted} Hours</span>
              </div>

              <div>
                <span className="text-xs text-slate-400">ML Forecast %</span>
                <p className="text-xl font-extrabold text-cyan-400">
                  {selectedCourse.projected_percentage || selectedCourse.current_percentage}%
                </p>
                <span className="text-[10px] text-cyan-400/70">Wk 15 Projection</span>
              </div>

              <div>
                <span className="text-xs text-slate-400">Classes Needed (75%)</span>
                <p className="text-xl font-extrabold text-amber-400">
                  {selectedCourse.classes_required_for_75} Sessions
                </p>
                <span className="text-[10px] text-slate-500">Consecutive Safe</span>
              </div>

              <div>
                <span className="text-xs text-slate-400">Risk Categorization</span>
                <p className="text-sm font-bold text-slate-200 mt-1 capitalize">
                  {selectedCourse.deficiency_status.replace('_', ' ')}
                </p>
              </div>
            </div>

            {/* Trajectory Recharts Forecast */}
            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={getTrajectoryData(selectedCourse)}>
                  <defs>
                    <linearGradient id="colorPct" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="week" stroke="#64748b" fontSize={12} />
                  <YAxis domain={[40, 100]} stroke="#64748b" fontSize={12} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                  />
                  <ReferenceLine y={75} stroke="#ef4444" strokeDasharray="3 3" label={{ value: '75% Threshold', fill: '#ef4444', fontSize: 10 }} />
                  <ReferenceLine y={80} stroke="#10b981" strokeDasharray="3 3" label={{ value: '80% Safe Zone', fill: '#10b981', fontSize: 10 }} />
                  <Area type="monotone" dataKey="percentage" stroke="#06b6d4" strokeWidth={3} fillOpacity={1} fill="url(#colorPct)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

          </div>

          {/* Interactive "Classes Needed" Simulator Calculator */}
          <div className="glass-card rounded-2xl p-6 border border-slate-800 flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">"Classes Needed" Simulator</h3>
                  <p className="text-xs text-slate-400">Simulate future consecutive sessions</p>
                </div>
              </div>

              {/* Slider Inputs */}
              <div className="space-y-4 mt-6">
                <div>
                  <div className="flex justify-between text-xs text-slate-300 font-medium mb-1">
                    <span>Future Conducted Classes</span>
                    <span className="text-cyan-400 font-bold">{simConducted} Hours</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={simConducted}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setSimConducted(val);
                      if (simAttended > val) setSimAttended(val);
                    }}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-300 font-medium mb-1">
                    <span>Future Classes Attended</span>
                    <span className="text-emerald-400 font-bold">{simAttended} Hours</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={simConducted}
                    value={simAttended}
                    onChange={(e) => setSimAttended(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
              </div>

              {/* Simulator Outcome Card */}
              {simResult && (
                <div className="mt-6 p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Simulated Percentage</span>
                    <span className={`text-lg font-extrabold ${simResult.simulated_percentage >= 75 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {simResult.simulated_percentage}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Projected Risk Zone</span>
                    <span className="font-semibold text-slate-200 uppercase">{simResult.simulated_status.replace('_', ' ')}</span>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Classes to Reach 75%</span>
                    <span className="font-bold text-amber-400">{simResult.classes_required_for_75} Sessions</span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-300 flex items-start space-x-2">
              <Zap className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>
                Tip: Attending the next <strong>{selectedCourse.classes_required_for_75 || 4} consecutive classes</strong> will return your attendance safely above 75%.
              </span>
            </div>
          </div>

        </div>
      )}

      {/* Modal / Drawer for OD Upload */}
      {showODDrawer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card max-w-lg w-full rounded-2xl p-6 border border-slate-700 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-cyan-400" />
                Submit OD / Medical Certificate
              </h3>
              <button onClick={() => setShowODDrawer(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSubmitOD} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Request Category</label>
                <select
                  value={odType}
                  onChange={(e: any) => setOdType(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="ON_DUTY">On-Duty (OD - Hackathon / Sports / Event)</option>
                  <option value="MEDICAL">Medical Leave (Doctor Cert / Hospitalization)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">From Date</label>
                  <input
                    type="date"
                    value={odDateFrom}
                    onChange={(e) => setOdDateFrom(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">To Date</label>
                  <input
                    type="date"
                    value={odDateTo}
                    onChange={(e) => setOdDateTo(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Hours Claimed for OD</label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={odHours}
                  onChange={(e) => setOdHours(parseInt(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Reason / Event Description</label>
                <textarea
                  rows={2}
                  value={odReason}
                  onChange={(e) => setOdReason(e.target.value)}
                  placeholder="Explain event or illness details..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Attach Supporting Document</label>
              <label className="p-4 border-2 border-dashed border-slate-700 rounded-xl bg-slate-950/50 flex flex-col items-center justify-center cursor-pointer hover:border-cyan-500 transition-all">
                  <FileText className="w-8 h-8 text-cyan-400 mb-1" />
                  <span className="text-slate-300 font-semibold">{odDocument?.name || 'Choose a supporting document'}</span>
                  <span className="text-[10px] text-slate-500">PDF, JPG or PNG up to 10 MB {odType === 'MEDICAL' ? '· Required' : '· Optional'}</span>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => setOdDocument(event.target.files?.[0] || null)} className="sr-only" />
                </label>
              </div>

              {odMessage && (
                <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${odMessage.startsWith('Request submitted') ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/20 border-rose-500/30 text-rose-300'}`}>
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>{odMessage}</span>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowODDrawer(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={odSubmitting}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white font-semibold shadow-lg shadow-cyan-600/30"
                >
                  {odSubmitting ? 'Uploading…' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal for Dispute Drawer */}
      {showDisputeDrawer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full rounded-2xl p-6 border border-slate-700 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                Submit Attendance Dispute
              </h3>
              <button onClick={() => setShowDisputeDrawer(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSendDispute} className="space-y-4 text-xs">
              <p className="text-slate-400">
                Log a formal dispute if biometric scanner or manual roll call missed your attendance log for an attended session.
              </p>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Dispute Explanation & Date of Session</label>
                <textarea
                  rows={4}
                  required
                  value={disputeNote}
                  onChange={(e) => setDisputeNote(e.target.value)}
                  placeholder="Describe the date and class session to dispute..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {disputeSent && (
                <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>Dispute ticket logged! Forwarded to mentor {student.mentor_name}.</span>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDisputeDrawer(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/30"
                >
                  Submit Dispute Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
