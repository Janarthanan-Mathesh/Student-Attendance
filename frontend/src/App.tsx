import React, { useState, useEffect } from 'react';
import { Navbar, Persona } from './components/Navbar';
import { StudentDashboard } from './components/StudentDashboard';
import { FacultyPortal } from './components/FacultyPortal';
import { ParentPortal } from './components/ParentPortal';
import { AdminDashboard } from './components/AdminDashboard';
import { PDFNoticeModal } from './components/PDFNoticeModal';
import { AuthModal } from './components/AuthModal';
import { ProfileModal } from './components/ProfileModal';
import { fetchStudents, fetchStudentDetails } from './lib/api';
import { Student, UserProfile } from './types';

export const App: React.FC = () => {
  const [currentPersona, setCurrentPersona] = useState<Persona>('STUDENT');
  const [students, setStudents] = useState<Student[]>([]);
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [mentorParentStudent, setMentorParentStudent] = useState<Student | null>(null);
  const [selectedMentorName, setSelectedMentorName] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('attendance_theme') as 'dark' | 'light') || 'dark');
  
  // Auth & Profile State - Defaults to null to require explicit Login/Register on startup
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('attendance_tracker_user');
      if (!saved) return null;
      const session = JSON.parse(saved);
      if (!session.expires_at || Date.now() >= session.expires_at) {
        localStorage.removeItem('attendance_tracker_user');
        return null;
      }
      return session.user as UserProfile;
    } catch {
      localStorage.removeItem('attendance_tracker_user');
      return null;
    }
  });
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const mentorNames = Array.from(new Set(students.map((student) => student.mentor_name).filter((name): name is string => Boolean(name)))).sort((a, b) => a.localeCompare(b));
  const activeMentorName = currentUser?.role === 'ADMIN' ? (selectedMentorName || mentorNames[0] || '') : (currentUser?.name || 'Assigned Mentor');

  // PDF Modal State
  const [pdfTarget, setPdfTarget] = useState<{ studentId: string; courseCode: string } | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('attendance_theme', theme);
  }, [theme]);

  useEffect(() => {
    loadStudents();
    const saved = localStorage.getItem('attendance_tracker_user');
    if (saved) {
      try {
        const session = JSON.parse(saved);
        if (session.user) setCurrentPersona(session.user.role as Persona);
      } catch { /* invalid session is cleared during initialization */ }
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    let expiresAt = 0;
    try { expiresAt = JSON.parse(localStorage.getItem('attendance_tracker_user') || '{}').expires_at || 0; } catch { /* invalid session expires immediately */ }
    const timeout = window.setTimeout(() => {
      setCurrentUser(null);
      localStorage.removeItem('attendance_tracker_user');
      setShowAuthModal(true);
    }, Math.max(0, expiresAt - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [currentUser]);

  const loadStudents = async () => {
    try {
      const list = await fetchStudents();
      setStudents(list);
      if (list.length > 0) {
        const detailed = await fetchStudentDetails(list[0].student_id);
        if (detailed.success) {
          setCurrentStudent({
            ...detailed.student,
            courses: detailed.deficiency_records
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectStudentForPersona = async (studentId: string) => {
    const detailed = await fetchStudentDetails(studentId);
    if (detailed.success) {
      setCurrentStudent({
        ...detailed.student,
        courses: detailed.deficiency_records
      });
    }
  };

  const handleOpenMentorParentView = async (studentId: string) => {
    setCurrentPersona('FACULTY');
    const detailed = await fetchStudentDetails(studentId);
    if (detailed.success) {
      setMentorParentStudent({ ...detailed.student, courses: detailed.deficiency_records });
    }
  };

  const handleAuthSuccess = async (user: UserProfile) => {
    setCurrentUser(user);
    localStorage.setItem('attendance_tracker_user', JSON.stringify({ user, expires_at: Date.now() + 30 * 60 * 1000 }));
    setShowAuthModal(false);

    if (user.role) {
      setCurrentPersona(user.role as Persona);
    }

    await loadStudents();
    if (user.user_id) {
      handleSelectStudentForPersona(user.user_id);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('attendance_tracker_user');
    setShowProfileModal(false);
    setShowAuthModal(true);
  };

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col font-sans">
      {/* Keep the portal navigation hidden until the user is signed in. */}
      {currentUser && <Navbar
        currentPersona={currentPersona}
        onSelectPersona={setCurrentPersona}
        currentUser={currentUser}
        onOpenProfile={() => setShowProfileModal(true)}
        onOpenAuth={() => setShowAuthModal(true)}
        students={students}
        onViewParent={handleOpenMentorParentView}
        onSelectStudent={handleSelectStudentForPersona}
        selectedStudentId={currentStudent?.student_id || ''}
        mentorNames={mentorNames}
        selectedMentorName={activeMentorName}
        onSelectMentor={(name) => { setSelectedMentorName(name); setMentorParentStudent(null); }}
        theme={theme}
        onToggleTheme={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')}
      />}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6">
        {currentUser && <>
            {/* Dynamic Persona Dashboard Render */}
            {currentPersona === 'STUDENT' && currentStudent && (
              <StudentDashboard
                student={currentStudent}
                onOpenPDF={(studentId, courseCode) => setPdfTarget({ studentId, courseCode })}
              />
            )}

            {currentPersona === 'FACULTY' && mentorParentStudent && (
              <div className="space-y-4">
                <button onClick={() => setMentorParentStudent(null)} className="px-4 py-2 rounded-lg bg-slate-800 text-slate-200 text-sm hover:bg-slate-700">← Back to mentor dashboard</button>
                <ParentPortal student={mentorParentStudent} onOpenPDF={(studentId, courseCode) => setPdfTarget({ studentId, courseCode })} />
              </div>
            )}

            {currentPersona === 'FACULTY' && !mentorParentStudent && (
              <FacultyPortal
                mentorName={activeMentorName}
                mentorFilter={currentUser.role === 'ADMIN' ? activeMentorName : undefined}
                rosterStudents={currentUser.role === 'ADMIN' ? students : undefined}
                onOpenParent={handleOpenMentorParentView}
                onOpenPDF={(studentId, courseCode) => setPdfTarget({ studentId, courseCode })}
              />
            )}

            {currentPersona === 'PARENT' && currentStudent && (
              <ParentPortal
                student={currentStudent}
                onOpenPDF={(studentId, courseCode) => setPdfTarget({ studentId, courseCode })}
              />
            )}

            {currentPersona === 'ADMIN' && (
              <AdminDashboard />
            )}
        </>}

      </main>

      {/* Auth Modal (Login / First-Time Registration) */}
      {(showAuthModal || !currentUser) && (
        <AuthModal
          onSuccess={handleAuthSuccess}
          onClose={currentUser ? () => setShowAuthModal(false) : undefined}
        />
      )}

      {/* Profile Modal (View & Edit Profile) */}
      {showProfileModal && currentUser && (
        <ProfileModal
          user={currentUser}
          onUpdateUser={(updated) => {
            setCurrentUser(updated);
    localStorage.setItem('attendance_tracker_user', JSON.stringify({ user: updated, expires_at: Date.now() + 30 * 60 * 1000 }));
          }}
          onLogout={handleLogout}
          onClose={() => setShowProfileModal(false)}
        />
      )}

      {/* PDF Notice Modal */}
      {pdfTarget && (
        <PDFNoticeModal
          studentId={pdfTarget.studentId}
          courseCode={pdfTarget.courseCode}
          onClose={() => setPdfTarget(null)}
        />
      )}

      {/* Footer */}
      {currentUser && <footer className="border-t border-slate-800 bg-slate-950/80 py-6 px-4 lg:px-8 mt-12 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <div>
            <p className="font-semibold text-slate-300">
              Intelligent Attendance Tracker System
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Powered by Scikit-Learn ML, React 18, Express.js, and an in-memory notification dispatcher
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 text-[11px]">
            <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
              <strong>JANARTHANAN M</strong> (7376232AD162) — Lead Developer & Architect
            </span>
          </div>
        </div>
      </footer>}
    </div>
  );
};
