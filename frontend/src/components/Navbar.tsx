import React from 'react';
import { User, Users, ShieldCheck, Cpu, Smartphone, Activity, LogIn, Sun, Moon } from 'lucide-react';
import { UserProfile } from '../types';
import { Student } from '../types';

export type Persona = 'STUDENT' | 'FACULTY' | 'PARENT' | 'ADMIN';

interface NavbarProps {
  currentPersona: Persona;
  onSelectPersona: (p: Persona) => void;
  currentUser: UserProfile | null;
  onOpenProfile: () => void;
  onOpenAuth: () => void;
  students?: Student[];
  onViewParent?: (studentId: string) => void;
  onSelectStudent?: (studentId: string) => void;
  selectedStudentId?: string;
  mentorNames?: string[];
  selectedMentorName?: string;
  onSelectMentor?: (mentorName: string) => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPersona, onSelectPersona, currentUser, onOpenProfile, onOpenAuth, students = [], onViewParent, onSelectStudent, selectedStudentId = '', mentorNames = [], selectedMentorName = '', onSelectMentor, theme = 'dark', onToggleTheme }) => {
  return (
    <header className="sticky top-0 z-50 glass-card border-b border-slate-800 bg-[#0b0f17]/80 backdrop-blur-xl px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Brand Logo & Status */}
        <div className="flex items-center space-x-3">
          <button onClick={onToggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 hover:border-cyan-500/50">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 p-0.5 shadow-lg shadow-cyan-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Cpu className="w-5 h-5 text-cyan-400 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-extrabold text-lg text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-300">
                Attendance Tracker
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-semibold tracking-wider">
                {currentUser?.demo_mode ? 'DEMO' : 'PROD v2.4'}
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <Activity className="w-3 h-3 text-emerald-400 inline" /> Early-Intervention & Attendance Forecasting
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {currentUser?.role === 'ADMIN' && currentPersona === 'STUDENT' && students.length > 0 && (
            <select aria-label="Select student dashboard" value={selectedStudentId || students[0]?.student_id || ''} onChange={(event) => onSelectStudent?.(event.target.value)} className="max-w-[280px] bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200">
              {students.map((student) => <option key={student.student_id} value={student.student_id}>{student.name} - {student.register_no}</option>)}
            </select>
          )}
          {currentUser?.role === 'ADMIN' && currentPersona === 'FACULTY' && mentorNames.length > 0 && (
            <select aria-label="Select mentor group" value={selectedMentorName || mentorNames[0]} onChange={(event) => onSelectMentor?.(event.target.value)} className="max-w-[280px] bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200">
              {mentorNames.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          )}
          {currentUser?.role === 'FACULTY' && students.length > 0 && (
            <select
              aria-label="Open student parent dashboard"
              defaultValue=""
              onChange={(event) => {
                if (event.target.value) onViewParent?.(event.target.value);
                event.target.value = '';
              }}
              className="max-w-[280px] bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200"
            >
              <option value="">Student – Parent dashboard</option>
              {students.map((student) => <option key={student.student_id} value={student.student_id}>{student.name} - {student.parent_name}</option>)}
            </select>
          )}
          {/* Persona Switcher Buttons */}
          <div className="flex items-center bg-slate-900/90 p-1.5 rounded-xl border border-slate-800 shadow-inner overflow-x-auto">
            {(currentUser?.role === 'STUDENT' || currentUser?.role === 'ADMIN') && <button
              onClick={() => onSelectPersona('STUDENT')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${currentPersona === 'STUDENT' ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'}`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Student Portal</span>
            </button>}

            {(currentUser?.role === 'FACULTY' || currentUser?.role === 'ADMIN') && <button
              onClick={() => onSelectPersona('FACULTY')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${currentPersona === 'FACULTY' ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'}`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Faculty / Mentor</span>
            </button>}

            {(currentUser?.role === 'PARENT' || (currentUser?.role === 'ADMIN' && currentPersona !== 'FACULTY')) && <button
              onClick={() => onSelectPersona('PARENT')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${currentPersona === 'PARENT' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'}`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Parent PWA</span>
            </button>}

            {currentUser && currentUser.role === 'ADMIN' && (
              <button
                onClick={() => onSelectPersona('ADMIN')}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  currentPersona === 'ADMIN'
                    ? 'bg-purple-500 text-white shadow-md shadow-purple-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>HOD / Admin</span>
              </button>
            )}
          </div>

          {/* User Profile / Auth Button */}
          {currentUser ? (
            <button
              onClick={onOpenProfile}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-xs font-semibold text-slate-200 transition-all"
            >
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-xs border border-cyan-500/40">
                {currentUser.name.charAt(0)}
              </div>
              <span className="max-w-[100px] truncate hidden sm:inline">{currentUser.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono">
                {currentUser.role}
              </span>
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/30 transition-all"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Login / Register</span>
            </button>
          )}
        </div>

      </div>
    </header>
  );
};
