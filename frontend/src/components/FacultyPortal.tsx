import React, { useState, useEffect } from 'react';
import { DeficiencyRecord, Student, LeaveODRequest } from '../types';
import { fetchDeficiencyRecords, dispatchBatchAlertsAPI, submitCounselingAPI, approveLeaveODAPI, fetchStudents, fetchStudentDetails } from '../lib/api';
import { Send, Filter, MessageSquare, AlertTriangle, CheckCircle, FileText, UserCheck, ShieldAlert, Bell, Clock, X } from 'lucide-react';

interface FacultyPortalProps {
  onOpenPDF: (studentId: string, courseCode: string) => void;
  mentorName?: string;
  mentorFilter?: string;
  rosterStudents?: Student[];
  onOpenParent?: (studentId: string) => void;
}

export const FacultyPortal: React.FC<FacultyPortalProps> = ({ onOpenPDF, mentorName = 'Assigned Mentor', mentorFilter, rosterStudents, onOpenParent }) => {
  const [records, setRecords] = useState<DeficiencyRecord[]>([]);
  const [students, setStudents] = useState<Array<Student & { leave_od_requests?: LeaveODRequest[] }>>([]);
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  
  // Dispatch Modal State
  const [showDispatchModal, setShowDispatchModal] = useState<boolean>(false);
  const [dispatchChannel, setDispatchChannel] = useState<'WHATSAPP' | 'SMS' | 'EMAIL' | 'PUSH'>('WHATSAPP');
  const [dispatchWarning, setDispatchWarning] = useState<'ADVISORY' | 'MODERATE' | 'CRITICAL'>('MODERATE');
  const [dispatchNote, setDispatchNote] = useState<string>('');
  const [dispatchResult, setDispatchResult] = useState<string | null>(null);

  // Counseling Log Drawer State
  const [showCounselingDrawer, setShowCounselingDrawer] = useState<boolean>(false);
  const [counselingStudentId, setCounselingStudentId] = useState<string>('');
  const [counselingNotes, setCounselingNotes] = useState<string>('');
  const [counselingAction, setCounselingAction] = useState<string>('');
  const [counselingSuccess, setCounselingSuccess] = useState<boolean>(false);
  const [reviewingRequestId, setReviewingRequestId] = useState<number | null>(null);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);

  useEffect(() => {
    loadRecords();
  }, [activeFilter]);

  useEffect(() => {
    loadStudents();
  }, [rosterStudents]);

  const loadStudents = async () => {
    const list = rosterStudents || await fetchStudents();
    const withDetails = await Promise.all(list.map(async (student) => {
      const details = await fetchStudentDetails(student.student_id);
      return { ...student, leave_od_requests: details.success ? details.leave_od_requests || [] : [] };
    }));
    setStudents(withDetails);
  };

  const handleODReview = async (requestId: number, status: 'APPROVED' | 'REJECTED') => {
    setReviewingRequestId(requestId);
    setReviewMessage(null);
    try {
      const result = await approveLeaveODAPI(requestId, status);
      if (!result.success) {
        setReviewMessage(result.error || 'Could not update this request. Refresh and try again.');
        return;
      }
      setReviewMessage(result.message || `Request ${status.toLowerCase()}.`);
      await Promise.all([loadStudents(), loadRecords()]);
    } catch {
      setReviewMessage('Could not connect to the server. The request status was not changed.');
    } finally {
      setReviewingRequestId(null);
    }
  };

  const loadRecords = async () => {
    let statusParam: string | undefined = undefined;
    let filterParam: string | undefined = undefined;

    if (activeFilter === 'AMBER_ALERT') statusParam = 'AMBER_ALERT';
    else if (activeFilter === 'RED_DEFICIENT') statusParam = 'RED_DEFICIENT';
    else if (activeFilter === 'CRITICAL_DETENTION') statusParam = 'CRITICAL_DETENTION';
    else if (activeFilter === 'MULTI') filterParam = 'multi_deficient';

    const data = await fetchDeficiencyRecords(statusParam, filterParam);
    setRecords(data);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStudentIds(visibleRecords.map((r) => r.student_id));
    } else {
      setSelectedStudentIds([]);
    }
  };

  const handleToggleSelect = (studentId: string) => {
    if (selectedStudentIds.includes(studentId)) {
      setSelectedStudentIds(selectedStudentIds.filter((id) => id !== studentId));
    } else {
      setSelectedStudentIds([...selectedStudentIds, studentId]);
    }
  };

  const normalizeMentor = (name?: string) => (name || '').trim().replace(/\s+/g, ' ').toLocaleUpperCase();
  const visibleStudents = mentorFilter
    ? students.filter((student) => normalizeMentor(student.mentor_name) === normalizeMentor(mentorFilter))
    : students;
  const visibleStudentIds = new Set(visibleStudents.map((student) => student.student_id));
  const visibleRecords = records.filter((record) => visibleStudentIds.has(record.student_id));

  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStudentIds.length === 0) return;

    setDispatchResult(null);
    const res = await dispatchBatchAlertsAPI({
      student_ids: selectedStudentIds,
      channel: dispatchChannel,
      warning_level: dispatchWarning,
      custom_note: dispatchNote
    });

    if (res.success) {
      setDispatchResult(`Successfully dispatched batch ${dispatchChannel} alerts to ${selectedStudentIds.length} parents/students.`);
      setTimeout(() => {
        setShowDispatchModal(false);
        setDispatchResult(null);
        setSelectedStudentIds([]);
      }, 2000);
    }
  };

  const handleCounselingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!counselingStudentId) return;

    const res = await submitCounselingAPI({
      student_id: counselingStudentId,
      mentor_name: mentorName,
      date: new Date().toISOString().split('T')[0],
      notes: counselingNotes,
      action_taken: counselingAction || 'Scheduled follow-up'
    });

    if (res.success) {
      setCounselingSuccess(true);
      setTimeout(() => {
        setShowCounselingDrawer(false);
        setCounselingSuccess(false);
        setCounselingNotes('');
        setCounselingAction('');
      }, 2000);
    }
  };

  const workingDayTotal = visibleStudents.reduce((sum, student) => sum + (student.courses || []).reduce((courseSum, course) => courseSum + course.total_conducted, 0), 0);
  const presentDayTotal = visibleStudents.reduce((sum, student) => sum + (student.courses || []).reduce((courseSum, course) => courseSum + course.total_attended, 0), 0);

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="glass-card rounded-2xl p-6 border border-indigo-500/20 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Faculty / Mentor Workspace
            </span>
            <span className="text-xs text-slate-400">Class Advisor: {mentorName}</span>
          </div>
          <h2 className="text-2xl font-extrabold text-white mt-1">Batch Deficiency Insights & Interventions</h2>
          <p className="text-xs text-slate-300">
            Monitor batch absenteeism heatmaps, run rapid multi-channel interventions, and log counseling records.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            disabled={selectedStudentIds.length === 0}
            onClick={() => setShowDispatchModal(true)}
            className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-lg ${
              selectedStudentIds.length > 0
                ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-indigo-500/30 hover:brightness-110'
                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>One-Click Batch Alert ({selectedStudentIds.length})</span>
          </button>
        </div>
      </div>

      {/* Student roster with guardian contacts and submitted leave requests */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Above average (80%+)', count: visibleStudents.filter((student) => student.courses?.length && student.courses.reduce((sum, course) => sum + course.current_percentage, 0) / student.courses.length >= 80).length, color: 'text-emerald-300 border-emerald-500/30 bg-emerald-950/20' },
          { label: 'Average (75–79.9%)', count: visibleStudents.filter((student) => { const average = student.courses?.length ? student.courses.reduce((sum, course) => sum + course.current_percentage, 0) / student.courses.length : 0; return average >= 75 && average < 80; }).length, color: 'text-amber-300 border-amber-500/30 bg-amber-950/20' },
          { label: 'Low (below 75%)', count: visibleStudents.filter((student) => student.courses?.length && student.courses.reduce((sum, course) => sum + course.current_percentage, 0) / student.courses.length < 75).length, color: 'text-rose-300 border-rose-500/30 bg-rose-950/20' }
        ].map((band) => <div key={band.label} className={`rounded-2xl border p-4 ${band.color}`}>
          <p className="text-xs">Students {band.label}</p><p className="text-2xl font-extrabold mt-1">{band.count}</p>
        </div>)}
      </section>

      {/* Mentor OD / medical notifications and review inbox */}
      <section className="glass-card rounded-2xl p-6 border border-amber-500/20 space-y-4" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-300" />
            <div>
              <h3 className="font-bold text-white">OD / Medical Request Inbox</h3>
              <p className="text-xs text-slate-400">Requests from students assigned to your mentor account.</p>
            </div>
          </div>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200">
            {students.reduce((count, student) => count + (student.leave_od_requests || []).filter((request) => request.status === 'PENDING').length, 0)} pending
          </span>
        </div>
        {reviewMessage && <p role="status" className="rounded-lg border border-cyan-500/20 bg-cyan-950/30 p-2 text-xs text-cyan-200">{reviewMessage}</p>}
        {students.every((student) => !(student.leave_od_requests || []).length) ? (
          <p className="text-xs text-slate-400">No OD or medical requests have been submitted by your assigned students.</p>
        ) : (
          <div className="space-y-3">
            {students.flatMap((student) => (student.leave_od_requests || []).map((request) => ({ student, request })))
              .sort((left, right) => Number(left.request.status !== 'PENDING') - Number(right.request.status !== 'PENDING') || right.request.id - left.request.id)
              .map(({ student, request }) => {
                const statusColor = request.status === 'APPROVED' ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300' : request.status === 'REJECTED' ? 'border-rose-500/30 bg-rose-950/20 text-rose-300' : 'border-amber-500/30 bg-amber-950/20 text-amber-300';
                return <article key={request.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{student.name} <span className="font-normal text-slate-400">· {student.register_no}</span></p>
                      <p className="mt-1 text-xs text-slate-300">{request.request_type.replace('_', ' ')} · {request.course_code} · {request.date_from} to {request.date_to} · {request.hours_applied} hours</p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusColor}`}>{request.status}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-300">Reason: {request.reason}</p>
                  <p className="mt-1 text-[11px] text-slate-500">Submitted {request.created_at}{request.approved_by ? ` · Reviewed by ${request.approved_by}` : ''}</p>
                  {request.document_data && request.document_name && <a href={request.document_data} download={request.document_name} onClick={(event) => event.stopPropagation()} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-cyan-300 hover:text-cyan-200"><FileText className="h-3.5 w-3.5" /> View supporting document</a>}
                  {request.status === 'PENDING' ? <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="mr-auto flex items-center gap-1 text-[11px] text-amber-300"><Clock className="h-3 w-3" /> Awaiting mentor review</span>
                    <button type="button" disabled={reviewingRequestId === request.id} onClick={() => handleODReview(request.id, 'REJECTED')} className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-900/40 disabled:opacity-50"><X className="h-3.5 w-3.5" /> Reject</button>
                    <button type="button" disabled={reviewingRequestId === request.id} onClick={() => handleODReview(request.id, 'APPROVED')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"><CheckCircle className="h-3.5 w-3.5" /> Approve</button>
                  </div> : <p className="mt-2 text-[11px] text-slate-400">Decision: {request.status.toLowerCase()} by {request.approved_by || 'mentor'}.</p>}
                </article>;
              })}
          </div>
        )}
      </section>

      <section className="glass-card rounded-2xl p-6 border border-indigo-500/20 space-y-4">
        <div>
          <h3 className="font-bold text-white">Student and Parent Details</h3>
          <p className="text-xs text-slate-400">Students assigned to your mentor account, with guardian contact details and leave requests.</p>
        </div>
        {visibleStudents.length === 0 ? <p className="text-sm text-slate-400">No students are currently assigned to this mentor.</p> : <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {visibleStudents.map((student) => {
            const leaveRequests = student.leave_od_requests || [];
            return <article key={student.student_id} role={onOpenParent ? 'button' : undefined} tabIndex={onOpenParent ? 0 : undefined} onClick={() => onOpenParent?.(student.student_id)} onKeyDown={(event) => { if (onOpenParent && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onOpenParent(student.student_id); } }} className={`rounded-xl bg-slate-950/50 border border-slate-800 p-4 space-y-3 ${onOpenParent ? 'cursor-pointer hover:border-cyan-500/50 hover:bg-slate-900/70 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/50' : ''}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><h4 className="font-bold text-white">{student.name}</h4><p className="text-xs text-slate-400">{student.register_no} · {student.department} · Section {student.section}</p></div>
                <span className="text-[10px] px-2 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">{student.overall_risk || 'SAFE'}</span>
              </div>
              <div className="text-xs text-slate-300 space-y-1">
                <p>Student: {student.email} · {student.phone}</p>
                <p>Parent: <span className="font-semibold text-cyan-300">{student.parent_name}</span> · {student.parent_phone} · {student.parent_email}</p>
              </div>
              <div className="border-t border-slate-800 pt-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">Leave / OD Details</p>
                {leaveRequests.length ? leaveRequests.map((leave) => <p key={leave.id} className="text-xs text-slate-300">{leave.request_type} · {leave.date_from} to {leave.date_to} · {leave.hours_applied} hrs · {leave.status} · {leave.reason}</p>) : <p className="text-xs text-slate-400">No leave / OD requests recorded.</p>}
              </div>
            </article>;
          })}
        </div>}
      </section>

      {/* Current roster totals and mentor actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card rounded-2xl p-6 border border-slate-800 space-y-3">
          <h3 className="font-bold text-white text-base">Assigned Student Attendance</h3>
          <p className="text-xs text-slate-400">Attendance totals loaded from the imported roster.</p>
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3"><span className="text-[11px] text-slate-400">Students</span><p className="text-xl font-bold text-white">{visibleStudents.length}</p></div>
            <div className="rounded-xl bg-emerald-950/20 border border-emerald-500/20 p-3"><span className="text-[11px] text-slate-400">Present days</span><p className="text-xl font-bold text-emerald-300">{presentDayTotal}</p></div>
            <div className="rounded-xl bg-rose-950/20 border border-rose-500/20 p-3"><span className="text-[11px] text-slate-400">Working days</span><p className="text-xl font-bold text-rose-300">{workingDayTotal}</p></div>
          </div>
        </div>

        {/* Rapid Actions Card */}
        <div className="glass-card rounded-2xl p-6 border border-slate-800 flex flex-col justify-between space-y-4">
          <div>
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              Quick Mentorship Intervention
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Select a student in Red/Critical zone to instantly log mentor counseling notes.
            </p>
          </div>

          <button
            onClick={() => {
              if (visibleRecords.length > 0) setCounselingStudentId(visibleRecords[0].student_id);
              setShowCounselingDrawer(true);
            }}
            className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 font-semibold text-xs flex items-center justify-center space-x-2 transition-all"
          >
            <UserCheck className="w-4 h-4 text-indigo-400" />
            <span>Log Student Counseling Session</span>
          </button>
        </div>
      </div>

      {/* Smart Filters & Deficiency Records Table */}
      <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
        
        {/* Table Filter Bar */}
        <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/40">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-300">Smart Filters:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeFilter === 'ALL' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800/50'
              }`}
            >
              All Records
            </button>
            <button
              onClick={() => setActiveFilter('AMBER_ALERT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeFilter === 'AMBER_ALERT' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:bg-slate-800/50'
              }`}
            >
              Amber Zone (75-80%)
            </button>
            <button
              onClick={() => setActiveFilter('RED_DEFICIENT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeFilter === 'RED_DEFICIENT' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'text-slate-400 hover:bg-slate-800/50'
              }`}
            >
              Red Zone (65-74.9%)
            </button>
            <button
              onClick={() => setActiveFilter('CRITICAL_DETENTION')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeFilter === 'CRITICAL_DETENTION' ? 'bg-red-950 text-red-300 border border-red-700' : 'text-slate-400 hover:bg-slate-800/50'
              }`}
            >
              Critical (&lt;65%)
            </button>
            <button
              onClick={() => setActiveFilter('MULTI')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeFilter === 'MULTI' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'text-slate-400 hover:bg-slate-800/50'
              }`}
            >
              Deficient in &gt;2 Subjects
            </button>
          </div>
        </div>

        {/* Table Component */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/80 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="p-4 w-10">
                  <input
                    type="checkbox"
                    checked={selectedStudentIds.length === visibleRecords.length && visibleRecords.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
                  />
                </th>
                <th className="p-4">Student & Register No</th>
                <th className="p-4">Course</th>
                <th className="p-4">Attended / Conducted</th>
                <th className="p-4">Current %</th>
                <th className="p-4">Projected %</th>
                <th className="p-4">Classes Needed (75%)</th>
                <th className="p-4">Risk Categorization</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60 text-xs">
              {visibleRecords.map((r) => {
                const isSelected = selectedStudentIds.includes(r.student_id);
                const isCritical = r.deficiency_status === 'CRITICAL_DETENTION';
                const isRed = r.deficiency_status === 'RED_DEFICIENT';
                const isAmber = r.deficiency_status === 'AMBER_ALERT';

                let badgeStyle = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
                if (isAmber) badgeStyle = 'bg-amber-500/10 text-amber-300 border-amber-500/30';
                if (isRed) badgeStyle = 'bg-rose-500/10 text-rose-300 border-rose-500/30';
                if (isCritical) badgeStyle = 'bg-red-950 text-red-300 border-red-700 font-bold';

                return (
                  <tr key={r.id} className={`hover:bg-slate-800/40 transition-all ${isSelected ? 'bg-indigo-950/20' : ''}`}>
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(r.student_id)}
                        className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="p-4">
                      <span className="font-semibold text-white block">{r.student_name || r.student_id}</span>
                      <span className="text-[10px] text-slate-400">{r.student_id} • {r.department}</span>
                    </td>
                    <td className="p-4">
                      <span className="font-semibold text-slate-200">{r.course_code}</span>
                      <span className="text-[10px] text-slate-400 block">{r.course_name}</span>
                    </td>
                    <td className="p-4 text-slate-300">
                      {r.total_attended} / {r.total_conducted} Hrs
                    </td>
                    <td className="p-4 font-bold text-slate-100">
                      {r.current_percentage}%
                    </td>
                    <td className="p-4 font-semibold text-cyan-400">
                      {r.projected_percentage || r.current_percentage}%
                    </td>
                    <td className="p-4 font-bold text-amber-400">
                      {r.classes_required_for_75} Sessions
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] border ${badgeStyle}`}>
                        {r.deficiency_status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => onOpenPDF(r.student_id, r.course_code)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                        title="Download Verified PDF Notice"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setCounselingStudentId(r.student_id);
                          setShowCounselingDrawer(true);
                        }}
                        className="p-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30"
                        title="Log Mentor Counseling"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dispatch Batch Alert Modal */}
      {showDispatchModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full rounded-2xl p-6 border border-slate-700 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-cyan-400" />
                Dispatch Multi-Channel Batch Alert
              </h3>
              <button onClick={() => setShowDispatchModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleDispatchSubmit} className="space-y-4 text-xs">
              <div>
                <span className="text-slate-300 font-medium block mb-1">Target Recipients</span>
                <span className="text-cyan-400 font-bold">{selectedStudentIds.length} Students & Parents selected</span>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Gateway Dispatch Channel</label>
                <select
                  value={dispatchChannel}
                  onChange={(e: any) => setDispatchChannel(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="WHATSAPP">WhatsApp Cloud API (Official Business)</option>
                  <option value="SMS">Twilio SMS Gateway</option>
                  <option value="EMAIL">Nodemailer Institutional Email</option>
                  <option value="PUSH">Mobile PWA Web Push Notification</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Warning Severity Level</label>
                <select
                  value={dispatchWarning}
                  onChange={(e: any) => setDispatchWarning(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="ADVISORY">ADVISORY (Amber Nudge)</option>
                  <option value="MODERATE">MODERATE (Red Deficiency Notice)</option>
                  <option value="CRITICAL">CRITICAL (Critical Detention Warning)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Custom Faculty Note (Optional)</label>
                <textarea
                  rows={3}
                  value={dispatchNote}
                  onChange={(e) => setDispatchNote(e.target.value)}
                  placeholder="e.g. Please meet Dr. Ramanathan tomorrow morning before 10 AM..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {dispatchResult && (
                <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>{dispatchResult}</span>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/30"
                >
                  Execute Batch Dispatch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Counseling Log Drawer */}
      {showCounselingDrawer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full rounded-2xl p-6 border border-slate-700 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-400" />
                Log Student Counseling Session
              </h3>
              <button onClick={() => setShowCounselingDrawer(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCounselingSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Student ID</label>
                <input
                  type="text"
                  value={counselingStudentId}
                  onChange={(e) => setCounselingStudentId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Counseling Session Notes</label>
                <textarea
                  rows={3}
                  required
                  value={counselingNotes}
                  onChange={(e) => setCounselingNotes(e.target.value)}
                  placeholder="Record counseling discussion points, student explanation..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Action Agreed / Recovery Plan</label>
                <input
                  type="text"
                  required
                  value={counselingAction}
                  onChange={(e) => setCounselingAction(e.target.value)}
                  placeholder="e.g. Student committed to attending all morning lab sessions..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {counselingSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>Counseling record saved to student academic file.</span>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCounselingDrawer(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/30"
                >
                  Save Counseling Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
