import React, { useState } from 'react';
import { Student } from '../types';
import { sendWhatsAppReplyAPI } from '../lib/api';
import { Smartphone, CheckCircle, PhoneCall, Globe, MessageSquare, AlertTriangle, ShieldCheck, Clock, Mail, MessageCircle } from 'lucide-react';

interface ParentPortalProps {
  student: Student;
  onOpenPDF: (studentId: string, courseCode: string) => void;
}

type Language = 'EN' | 'TA' | 'HI';

const translations = {
  EN: {
    title: 'Parent Portal Gateway',
    subtitle: 'Institutional Mobile PWA Monitor',
    studentInfo: 'Student Profile:',
    ackBtn: 'Single-Tap Acknowledge Receipt',
    callbackBtn: 'Request Mentor Callback',
    waHeader: 'WhatsApp Business Gateway (2-Way Interactive)',
    replyPrompt: 'Type 1 to Acknowledge or 2 to Request Callback:',
    ackSuccess: 'Digital signature acknowledgment sent to institution!',
    callbackSuccess: 'Mentor callback request logged! Assigned to ',
    deficiencyAlert: 'Deficiency Notice:',
    classesNeeded: 'Classes needed for 75% threshold:'
  },
  TA: {
    title: 'பெற்றோர் தளம் (Parent Portal)',
    subtitle: 'நிறுவன மொபைல் கண்காணிப்பு அமைப்பு',
    studentInfo: 'மாணவர் விவரம்:',
    ackBtn: 'ஒற்றைத் தொடுதலில் உறுதிப்படுத்தல்',
    callbackBtn: 'ஆசிரியருடன் தொலைபேசி அழைப்பு கோரல்',
    waHeader: 'வாட்ஸ்அப் வணிக தளம் (2-Way)',
    replyPrompt: 'உறுதிப்படுத்த 1 அல்லது அழைப்பைக் கோர 2 என பதிலளிக்கவும்:',
    ackSuccess: 'உறுதிப்படுத்தல் நிறுவனத்திற்கு வெற்றிகரமாக அனுப்பப்பட்டது!',
    callbackSuccess: 'ஆசிரியர் அழைப்பு கோரிக்கை பதிவு செய்யப்பட்டது!',
    deficiencyAlert: 'வருகை குறைபாடு எச்சரிக்கை:',
    classesNeeded: '75% எட்ட தேவையான வகுப்புகள்:'
  },
  HI: {
    title: 'अभिभावक पोर्टल (Parent Portal)',
    subtitle: 'संस्थागत मोबाइल मॉनिटर',
    studentInfo: 'छात्र विवरण:',
    ackBtn: 'एक-टैप रसीद की पुष्टि करें',
    callbackBtn: 'मेंटोर कॉल बैक का अनुरोध करें',
    waHeader: 'व्हाट्सएप बिजनेस गेटवे (2-Way)',
    replyPrompt: 'पुष्टि के लिए 1 या कॉल बैक के लिए 2 का उत्तर दें:',
    ackSuccess: 'डिजिटल हस्ताक्षर रसीद सफलतापूर्वक भेजी गई!',
    callbackSuccess: 'मेंटोर कॉल बैक का अनुरोध दर्ज किया गया!',
    deficiencyAlert: 'उपस्थिति कमी नोटिस:',
    classesNeeded: '75% थ्रेशोल्ड के लिए आवश्यक कक्षाएं:'
  }
};

export const ParentPortal: React.FC<ParentPortalProps> = ({ student, onOpenPDF }) => {
  const attendanceCourse = student.courses?.[0];
  const attendancePercent = attendanceCourse?.current_percentage ?? 0;
  const attendanceCode = attendanceCourse?.course_code || 'ATTENDANCE';
  const attendanceClassesNeeded = attendanceCourse?.classes_required_for_75 ?? 0;
  const [lang, setLang] = useState<Language>('EN');
  const [isAcked, setIsAcked] = useState<boolean>(false);
  const [waReply, setWaReply] = useState<string>('');
  const [timelineMessages, setTimelineMessages] = useState<Array<{ sender: 'SYSTEM' | 'PARENT'; text: string; time: string }>>([
    {
      sender: 'SYSTEM',
      text: `[INSTITUTION ALERT] Attendance update for ${student.name} (${student.register_no}). Attendance is ${attendancePercent.toFixed(2)}% in ${attendanceCode}. Reply 1 to acknowledge receipt or 2 to request a mentor callback with ${student.mentor_name}.`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const t = translations[lang];

  const handleSingleTapAck = async () => {
    setIsAcked(true);
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setTimelineMessages((prev) => [
      ...prev,
      { sender: 'PARENT', text: '1 (Digital Acknowledgment)', time: nowTime },
      { sender: 'SYSTEM', text: `[CONFIRMATION] Thank you ${student.parent_name}. Your acknowledgment has been logged in institutional audit records.`, time: nowTime }
    ]);

    await sendWhatsAppReplyAPI(student.student_id, '1');
    setFeedbackMessage(t.ackSuccess);
  };

  const handleRequestCallback = async () => {
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setTimelineMessages((prev) => [
      ...prev,
      { sender: 'PARENT', text: '2 (Request Callback)', time: nowTime },
      { sender: 'SYSTEM', text: `[CONFIRMATION] Mentor Callback Scheduled with ${student.mentor_name}. You will be contacted shortly on ${student.parent_phone}.`, time: nowTime }
    ]);

    await sendWhatsAppReplyAPI(student.student_id, '2');
    setFeedbackMessage(t.callbackSuccess + student.mentor_name);
  };

  const handleCustomWaReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waReply.trim()) return;

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const textSent = waReply;
    setWaReply('');

    setTimelineMessages((prev) => [
      ...prev,
      { sender: 'PARENT', text: textSent, time: nowTime }
    ]);

    const res = await sendWhatsAppReplyAPI(student.student_id, textSent);
    if (res.success) {
      setTimelineMessages((prev) => [
        ...prev,
        { sender: 'SYSTEM', text: `[BOT RESPONSE] ${res.action_taken}`, time: nowTime }
      ]);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      
      {/* PWA Mobile Header Container */}
      <div className="glass-card rounded-2xl p-6 border border-emerald-500/30 bg-gradient-to-br from-slate-900 via-emerald-950/30 to-slate-950 shadow-2xl relative">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Smartphone className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="font-extrabold text-lg text-white">{t.title}</h2>
              <p className="text-xs text-slate-400">{t.subtitle}</p>
            </div>
          </div>

          {/* Multilingual Toggle */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 space-x-1">
            <Globe className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
            <button
              onClick={() => setLang('EN')}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold ${lang === 'EN' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              EN
            </button>
            <button
              onClick={() => setLang('TA')}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold ${lang === 'TA' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              தமிழ்
            </button>
            <button
              onClick={() => setLang('HI')}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold ${lang === 'HI' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              हिंदी
            </button>
          </div>
        </div>

        {/* Student Profile Overview */}
        <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs text-slate-400">{t.studentInfo}</span>
            <h3 className="text-xl font-extrabold text-white mt-0.5">{student.name}</h3>
            <div className="mt-2 space-y-1 text-xs text-slate-300">
              <p>Parent: <span className="font-semibold text-emerald-300">{student.parent_name}</span></p>
              <p>Phone: {student.parent_phone} <span className="mx-1">•</span> Email: {student.parent_email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenPDF(student.student_id, attendanceCode)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold"
            >
              View PDF Notice
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
          <a href={`https://wa.me/${(student.parent_phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(`Attendance update for ${student.name}`)}`} target="_blank" rel="noreferrer" className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-2">
            <MessageCircle className="w-4 h-4" /> WhatsApp Notification
          </a>
          <a href={`mailto:${student.parent_email || ''}?subject=${encodeURIComponent(`Attendance update for ${student.name}`)}`} className="py-2 px-3 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-semibold flex items-center justify-center gap-2">
            <Mail className="w-4 h-4" /> Email Notification
          </a>
          <a href={`sms:${student.parent_phone || ''}?body=${encodeURIComponent(`Attendance update for ${student.name}`)}`} className="py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2">
            <MessageSquare className="w-4 h-4" /> SMS Notification
          </a>
        </div>

        {/* Active Deficiency Alert Banner */}
        <div className="mt-4 p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 glow-red space-y-2">
          <div className="flex items-center space-x-2 text-rose-300 font-bold text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{attendancePercent < 75 ? t.deficiencyAlert : 'Attendance Summary:'} {attendanceCode}</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-slate-300">Current Attendance: <strong className="text-rose-400">{attendancePercent.toFixed(2)}%</strong></span>
            <span className="text-amber-300 font-semibold">{t.classesNeeded} <strong>{attendanceClassesNeeded} Sessions</strong></span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
          <button
            onClick={handleSingleTapAck}
            className={`py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-lg ${
              isAcked
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            <span>{isAcked ? 'Acknowledged ✓' : t.ackBtn}</span>
          </button>

          <button
            onClick={handleRequestCallback}
            className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center justify-center space-x-2 transition-all"
          >
            <PhoneCall className="w-4 h-4 text-cyan-400" />
            <span>{t.callbackBtn}</span>
          </button>
        </div>

        {feedbackMessage && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2 border border-emerald-500/30">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
        )}
      </div>

      {/* Live 2-Way WhatsApp Interactive Timeline Simulator */}
      <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white text-base">{t.waHeader}</h3>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
            {student.parent_phone}
          </span>
        </div>

        {/* Chat Timeline Messages */}
        <div className="space-y-3 max-h-64 overflow-y-auto p-3 rounded-xl bg-slate-950/80 border border-slate-800">
          {timelineMessages.map((m, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${m.sender === 'PARENT' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] p-3 rounded-xl text-xs space-y-1 ${
                  m.sender === 'PARENT'
                    ? 'bg-emerald-600 text-white rounded-br-none shadow-md'
                    : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                <span className="text-[9px] text-slate-400 block text-right font-mono">{m.time}</span>
              </div>
            </div>
          ))}
        </div>

        {/* WhatsApp Quick Reply Form */}
        <form onSubmit={handleCustomWaReply} className="flex gap-2">
          <input
            type="text"
            value={waReply}
            onChange={(e) => setWaReply(e.target.value)}
            placeholder={t.replyPrompt}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-600/30"
          >
            Reply
          </button>
        </form>
      </div>

    </div>
  );
};
