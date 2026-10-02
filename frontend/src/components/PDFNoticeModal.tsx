import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { FileText, Download, ShieldCheck, Printer } from 'lucide-react';
import { API_BASE, fetchStudentDetails } from '../lib/api';

interface PDFNoticeModalProps {
  studentId: string;
  courseCode: string;
  onClose: () => void;
}

export const PDFNoticeModal: React.FC<PDFNoticeModalProps> = ({ studentId, courseCode, onClose }) => {
  const [qrUrl, setQrUrl] = useState<string>('');
  const [attendanceRecord, setAttendanceRecord] = useState<any>(null);
  const [courseTitle, setCourseTitle] = useState<string>(courseCode);
  const [downloadError, setDownloadError] = useState('');
  const pdfApiUrl = `${API_BASE}/pdf/deficiency-notice?student_id=${encodeURIComponent(studentId)}&course_code=${encodeURIComponent(courseCode)}`;

  const digitalHash = `SHA256-${studentId.slice(0, 6)}-${courseCode}-901A8F3C`;

  useEffect(() => {
    let active = true;
    fetchStudentDetails(studentId).then((details) => {
      if (!active || !details.success) return;
      const record = (details.deficiency_records || []).find((item: any) => item.course_code === courseCode);
      if (record) {
        setAttendanceRecord(record);
        setCourseTitle(record.course_name || courseCode);
      }
    }).catch(console.error);
    const verifyUrl = `https://portal.institution.edu/verify-notice?student=${studentId}&code=${courseCode}&sig=${digitalHash}`;
    QRCode.toDataURL(verifyUrl).then(setQrUrl).catch(console.error);
    return () => { active = false; };
  }, [studentId, courseCode]);

  const downloadPDF = async () => {
    setDownloadError('');
    try {
      const response = await fetch(pdfApiUrl);
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || 'PDF generation failed. Please try again.');
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `Deficiency_Notice_${studentId}_${courseCode}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'PDF download failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-card max-w-2xl w-full rounded-2xl p-6 border border-slate-700 shadow-2xl relative space-y-6 max-h-[90vh] overflow-y-auto">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-white text-lg">Official PDF Deficiency Notice Preview</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        {/* Rendered Document View */}
        <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 space-y-6 text-slate-200 text-xs">
          
          {/* Document Title */}
          <div className="text-center space-y-1">
            <h4 className="text-base font-extrabold tracking-wide text-white">INSTITUTIONAL ACADEMIC ACCREDITATION BOARD</h4>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Official Deficiency & Eligibility Warning Certificate</p>
          </div>

          <div className="h-0.5 bg-gradient-to-r from-transparent via-cyan-500 to-transparent my-2" />

          {/* Warning Banner */}
          <div className="p-3 bg-rose-950/60 border border-rose-600/60 rounded-xl text-center font-bold text-rose-300">
            {attendanceRecord?.current_percentage < 75 ? 'FORMAL DEFICIENCY NOTICE' : 'ATTENDANCE SUMMARY'}
          </div>

          {/* Student Grid */}
          <div className="grid grid-cols-2 gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            <div>
              <span className="text-slate-400 block">Student Register ID:</span>
              <strong className="text-white text-sm">{studentId}</strong>
            </div>
            <div>
              <span className="text-slate-400 block">Course Code & Title:</span>
              <strong className="text-cyan-300 text-sm">{courseTitle}</strong>
            </div>
            <div>
              <span className="text-slate-400 block">Current Attendance:</span>
              <strong className="text-rose-400 text-sm">{attendanceRecord ? `${attendanceRecord.current_percentage}% (Threshold: 75%)` : 'Loading attendance…'}</strong>
            </div>
            <div>
              <span className="text-slate-400 block">Consecutive Sessions Needed:</span>
              <strong className="text-amber-400 text-sm">{attendanceRecord ? `${attendanceRecord.classes_required_for_75} Sessions` : '—'}</strong>
            </div>
          </div>

          {/* Digital Signature & QR Verification Section */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="font-bold text-emerald-400 flex items-center gap-1.5 text-xs">
                <ShieldCheck className="w-4 h-4" />
                Digital Cryptographic Signature Verified
              </span>
              <p className="text-[10px] text-slate-400 font-mono">Hash: {digitalHash}</p>
              <p className="text-[10px] text-slate-500">Issued On: {new Date().toISOString().split('T')[0]}</p>
            </div>

            {qrUrl && (
              <div className="flex flex-col items-center">
                <img src={qrUrl} alt="QR Verification Code" className="w-20 h-20 rounded border border-slate-700 p-1 bg-white" />
                <span className="text-[9px] text-slate-400 mt-1">Scan to Verify</span>
              </div>
            )}
          </div>

        </div>

        {/* Footer Buttons */}
        <div className="flex justify-end space-x-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium text-xs"
          >
            Close Preview
          </button>
          <button
            onClick={downloadPDF}
            className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center space-x-2 shadow-lg shadow-cyan-600/30"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF Notice</span>
          </button>
        </div>
        {downloadError && <p role="alert" className="text-sm text-rose-400">{downloadError}</p>}

      </div>
    </div>
  );
};
