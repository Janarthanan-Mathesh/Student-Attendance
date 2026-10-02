import React, { useState } from 'react';
import { UserProfile } from '../types';
import { beginAdminAuthenticatorSetupAPI, loginUserAPI, registerUserAPI, verifyAdminAuthenticatorSetupAPI, verifyLoginOTPAPI, verifyRegistrationOTPAPI } from '../lib/api';
import { User, Users, Smartphone, ShieldCheck, LogIn, UserPlus, Mail, Phone, Lock, Building, BookOpen, CheckCircle, AlertCircle, ArrowLeft, Globe, Eye, EyeOff } from 'lucide-react';

interface AuthModalProps {
  onSuccess: (user: UserProfile) => void;
  onClose?: () => void;
}

type PersonaType = 'STUDENT' | 'FACULTY' | 'PARENT' | 'ADMIN';

const studentDepartmentOptions = [
  { code: 'CE', program: 'BE', name: 'Civil Engineering' },
  { code: 'BM', program: 'BE', name: 'Biomedical Engineering' },
  { code: 'CD', program: 'BE', name: 'Computer Science & Design' },
  { code: 'CS', program: 'BE', name: 'Computer Science & Engineering' },
  { code: 'EE', program: 'BE', name: 'Electrical & Electronics Engineering' },
  { code: 'EC', program: 'BE', name: 'Electronics & Communication Engineering' },
  { code: 'EI', program: 'BE', name: 'Electronics & Instrumentation Engineering' },
  { code: 'IS', program: 'BE', name: 'Information Science & Engineering' },
  { code: 'MZ', program: 'BE', name: 'Mechatronics Engineering' },
  { code: 'ME', program: 'BE', name: 'Mechanical Engineering' },
  { code: 'AD', program: 'B.Tech', name: 'Artificial Intelligence and Data Science' },
  { code: 'AL', program: 'B.Tech', name: 'Artificial Intelligence and Machine Learning' },
  { code: 'IT', program: 'B.Tech', name: 'Information Technology' },
  { code: 'AG', program: 'B.Tech', name: 'Agricultural Engineering' },
  { code: 'CT', program: 'B.Tech', name: 'Computer Technology' },
  { code: 'BT', program: 'B.Tech', name: 'Biotechnology' },
  { code: 'CB', program: 'B.Tech', name: 'Computer Science & Business Systems' },
  { code: 'FD', program: 'B.Tech', name: 'Food Technology' },
  { code: 'FT', program: 'B.Tech', name: 'Fashion Technology' },
  { code: 'TT', program: 'B.Tech', name: 'Textile Technology' }
];

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess, onClose }) => {
  const [selectedPersona, setSelectedPersona] = useState<PersonaType | null>('STUDENT');
  const [activeTab, setActiveTab] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  // Login State
  const [loginIdentifier, setLoginIdentifier] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Register State
  const [regName, setRegName] = useState<string>('');
  const [regRegisterNo, setRegRegisterNo] = useState<string>('');
  const [regEmail, setRegEmail] = useState<string>('');
  const [regStudentDepartment, setRegStudentDepartment] = useState<string>('AD');
  const [regPhone, setRegPhone] = useState<string>('');
  const [regDepartment, setRegDepartment] = useState<string>('Artificial Intelligence and Data Science');
  const [regSection, setRegSection] = useState<string>('A');
  const [regParentName, setRegParentName] = useState<string>('');
  const [regParentPhone, setRegParentPhone] = useState<string>('');
  const [regParentEmail, setRegParentEmail] = useState<string>('');
  const [regMentorName, setRegMentorName] = useState<string>('');
  const [regLangPref, setRegLangPref] = useState<string>('EN');
  const [regAdminKey, setRegAdminKey] = useState<string>('');
  const [regPassword, setRegPassword] = useState<string>('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [enrollingExistingAccount, setEnrollingExistingAccount] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccessMsg, setRegSuccessMsg] = useState<string | null>(null);

  // Authenticator app verification state
  const [loginOtpStep, setLoginOtpStep] = useState<boolean>(false);
  const [loginChallengeId, setLoginChallengeId] = useState<string>('');
  const [adminAuthenticatorSetupStep, setAdminAuthenticatorSetupStep] = useState(false);
  const [adminSetupChallengeId, setAdminSetupChallengeId] = useState('');
  const [adminSetupQr, setAdminSetupQr] = useState('');
  const [adminSetupKey, setAdminSetupKey] = useState('');
  const [adminSetupOtp, setAdminSetupOtp] = useState('');
  const [otpCodeInput, setOtpCodeInput] = useState<string>('');
  const [registerOtpStep, setRegisterOtpStep] = useState<boolean>(false);
  const [registerChallengeId, setRegisterChallengeId] = useState<string>('');
  const [registerAuthenticatorQr, setRegisterAuthenticatorQr] = useState<string>('');
  const [registerAuthenticatorKey, setRegisterAuthenticatorKey] = useState<string>('');
  const [registerOtpCode, setRegisterOtpCode] = useState<string>('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier.trim()) return;

    setLoginError(null);

    try {
      const res = await loginUserAPI(loginIdentifier, loginPassword, selectedPersona || undefined);
      if (res.success && res.requires_otp && res.challenge_id) {
        setLoginChallengeId(res.challenge_id);
        setLoginOtpStep(true);
        setOtpCodeInput('');
      } else if (res.success && res.user) {
        onSuccess(res.user);
        if (onClose) onClose();
      } else {
        setLoginError(res.error || 'Invalid credentials or account not found.');
      }
    } catch {
      setLoginError('Could not connect to the attendance server. Please try again later.');
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await verifyLoginOTPAPI(loginChallengeId, otpCodeInput);
      if (res.success && res.user) {
        onSuccess(res.user);
        if (onClose) onClose();
      } else {
        setLoginError(res.error || 'Invalid verification code.');
      }
    } catch {
      setLoginError('Could not verify the code. Check your connection and try again.');
    }
  };

  const handleBeginAdminAuthenticatorSetup = async () => {
    if (!loginIdentifier.trim() || !loginPassword) {
      setLoginError('Enter your admin ID/email and password before setting up an authenticator.');
      return;
    }
    setLoginError(null);
    try {
      const res = await beginAdminAuthenticatorSetupAPI(loginIdentifier, loginPassword);
      if (res.success && res.challenge_id && res.qr_data_url) {
        setAdminSetupChallengeId(res.challenge_id);
        setAdminSetupQr(res.qr_data_url);
        setAdminSetupKey(res.setup_key || '');
        setAdminSetupOtp('');
        setAdminAuthenticatorSetupStep(true);
      } else {
        setLoginError(res.error || 'Could not start administrator authenticator setup.');
      }
    } catch {
      setLoginError('Could not connect to the attendance server. Please try again later.');
    }
  };

  const handleVerifyAdminAuthenticatorSetup = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginError(null);
    try {
      const res = await verifyAdminAuthenticatorSetupAPI(adminSetupChallengeId, adminSetupOtp);
      if (res.success && res.user) {
        onSuccess(res.user);
        if (onClose) onClose();
      } else {
        setLoginError(res.error || 'Authenticator setup failed. Enter the current six-digit code.');
      }
    } catch {
      setLoginError('Could not verify the code. Check your connection and try again.');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPersona) return;

    setRegError(null);
    setRegSuccessMsg(null);

    const payload = {
      name: regName,
      register_no: regRegisterNo,
      email: regEmail,
      phone: regPhone,
      role: selectedPersona,
      department: selectedPersona === 'STUDENT' ? regStudentDepartment : regDepartment,
      section: regSection,
      parent_name: regParentName,
      parent_phone: regParentPhone,
      parent_email: regParentEmail,
      mentor_name: regMentorName,
      password: regPassword
    };

    try {
      const res = await registerUserAPI(payload);
      if (res.success && res.requires_authenticator_setup && res.challenge_id && res.qr_data_url) {
        setEnrollingExistingAccount(Boolean(res.existing_account));
        setRegisterChallengeId(res.challenge_id);
        setRegisterAuthenticatorQr(res.qr_data_url);
        setRegisterAuthenticatorKey(res.setup_key || '');
        setRegisterOtpCode('');
        setRegisterOtpStep(true);
      } else {
        setRegError(res.error || 'Could not start authenticator setup.');
      }
    } catch {
      setRegError('Could not connect to the attendance server. Please try again later.');
    }
  };

  const handleVerifyRegistrationOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    try {
      const res = await verifyRegistrationOTPAPI(registerChallengeId, registerOtpCode);
      if (res.success && res.user) {
        setRegSuccessMsg(enrollingExistingAccount ? 'Authenticator verified. Your existing account is ready to sign in.' : 'Authenticator verified. Registration successful!');
        setTimeout(() => {
          onSuccess(res.user);
          if (onClose) onClose();
        }, 1000);
      } else {
        setRegError(typeof res.error === 'string' ? res.error : 'The code is invalid or expired. Please try again.');
      }
    } catch {
      setRegError('Could not connect to the attendance server. Please try again later.');
    }
  };

  // Persona Portal Visual Configs
  const personaConfigs = {
    STUDENT: {
      title: 'Student Portal Access',
      subtitle: 'Real-time trajectory forecasting & simulator calculator',
      icon: User,
      color: 'cyan',
      borderColor: 'border-cyan-500/40',
      bgColor: 'bg-cyan-500/10',
      btnColor: 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-600/30',
      placeholderID: 'Student email from CSV'
    },
    FACULTY: {
      title: 'Faculty / Mentor Portal',
      subtitle: 'Batch absenteeism heatmaps & 1-click batch alert dispatcher',
      icon: Users,
      color: 'indigo',
      borderColor: 'border-indigo-500/40',
      bgColor: 'bg-indigo-500/10',
      btnColor: 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30',
      placeholderID: 'Mentor email from CSV'
    },
    PARENT: {
      title: 'Parent PWA Portal',
      subtitle: 'Multilingual 1-tap deficiency acknowledgment & 2-way WhatsApp',
      icon: Smartphone,
      color: 'emerald',
      borderColor: 'border-emerald-500/40',
      bgColor: 'bg-emerald-500/10',
      btnColor: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30',
      placeholderID: 'Parent email from CSV'
    },
    ADMIN: {
      title: 'Institutional HOD / Admin Portal',
      subtitle: 'Department deficiency analytics & tamper-proof audit trail logs',
      icon: ShieldCheck,
      color: 'purple',
      borderColor: 'border-purple-500/40',
      bgColor: 'bg-purple-500/10',
      btnColor: 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/30',
      placeholderID: 'e.g. ADM001'
    }
  };

  const currentConfig = selectedPersona ? personaConfigs[selectedPersona] : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-card max-w-2xl w-full rounded-2xl p-6 border border-slate-700 shadow-2xl relative space-y-6 max-h-[90vh] overflow-y-auto">
        
        {/* Header Navigation */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            {selectedPersona && (
              <button
                onClick={() => setSelectedPersona(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white mr-1"
                title="Back to Portal Selection"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h3 className="font-extrabold text-white text-lg">
              {currentConfig ? currentConfig.title : 'Select Your Portal Access'}
            </h3>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
          )}
        </div>

        {/* STEP 1: PERSONA PORTAL SELECTION CARDS */}
        {!selectedPersona ? (
          <div className="space-y-4">
            <p className="text-xs text-slate-400">
              Select your persona portal below to access customized features, forms, and workflows tailored for your role:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Student Card */}
              <button
                onClick={() => { setSelectedPersona('STUDENT'); setActiveTab('LOGIN'); setRegRegisterNo(''); }}
                className="p-5 rounded-2xl glass-card border border-cyan-500/30 bg-cyan-950/20 hover:bg-cyan-950/40 text-left transition-all hover:scale-[1.02] space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-white transition-all">
                    <User className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                    Student Portal
                  </span>
                </div>
                <h4 className="font-bold text-white text-base pt-1">Student Portal</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Real-time attendance trajectory gauge, "Classes Needed" simulator calculator, and OD/Medical upload drawer.
                </p>
              </button>

              {/* Faculty Card */}
              <button
                onClick={() => { setSelectedPersona('FACULTY'); setActiveTab('LOGIN'); setRegRegisterNo(''); }}
                className="p-5 rounded-2xl glass-card border border-indigo-500/30 bg-indigo-950/20 hover:bg-indigo-950/40 text-left transition-all hover:scale-[1.02] space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                    <Users className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                    Faculty Portal
                  </span>
                </div>
                <h4 className="font-bold text-white text-base pt-1">Faculty / Mentor Portal</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Batch absenteeism heatmap calendar, 1-click batch alert dispatcher, and student counseling logs.
                </p>
              </button>

              {/* Parent Card */}
              <button
                onClick={() => { setSelectedPersona('PARENT'); setActiveTab('LOGIN'); setRegRegisterNo(''); }}
                className="p-5 rounded-2xl glass-card border border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-950/40 text-left transition-all hover:scale-[1.02] space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                    Parent PWA
                  </span>
                </div>
                <h4 className="font-bold text-white text-base pt-1">Parent Portal (PWA)</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Multilingual UI (Tamil, Hindi, English), 1-tap digital alert acknowledgment, and 2-way WhatsApp.
                </p>
              </button>

              {/* Admin Card */}
              <button
                onClick={() => { setSelectedPersona('ADMIN'); setActiveTab('LOGIN'); setRegRegisterNo('ADM001'); }}
                className="p-5 rounded-2xl glass-card border border-purple-500/30 bg-purple-950/20 hover:bg-purple-950/40 text-left transition-all hover:scale-[1.02] space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-all">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                    HOD Admin
                  </span>
                </div>
                <h4 className="font-bold text-white text-base pt-1">Institutional Admin / HOD</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Department deficiency analytics, multi-channel gateway delivery health monitor, and audit trail logs.
                </p>
              </button>
            </div>
          </div>
        ) : (
          /* STEP 2: TAILORED LOGIN / REGISTRATION FORM */
          <div className="space-y-5 text-xs">
            
            {/* Persona Portal Switcher Sub-Header */}
            <div className={`p-3.5 rounded-xl border ${currentConfig?.borderColor} ${currentConfig?.bgColor} flex items-center justify-between`}>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Portal Mode:</span>
                <p className="font-extrabold text-sm text-white">{currentConfig?.title}</p>
              </div>
              <button
                onClick={() => { setSelectedPersona(null); setActiveTab('LOGIN'); setRegisterOtpStep(false); setLoginOtpStep(false); }}
                className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white text-[11px]"
              >
                Switch Portal
              </button>
            </div>

            {/* Login vs Register Tab Selector */}
            <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-900 border border-slate-800 font-semibold">
              <button
                onClick={() => setActiveTab('LOGIN')}
                className={`py-2 rounded-lg transition-all flex items-center justify-center space-x-2 ${
                  activeTab === 'LOGIN' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LogIn className="w-4 h-4" />
                <span>{selectedPersona} Login</span>
              </button>

              {selectedPersona === 'ADMIN' ? (
                <div className="py-2 text-center text-slate-500">Admin accounts are provisioned by the institution.</div>
              ) : <button
                onClick={() => setActiveTab('REGISTER')}
                className={`py-2 rounded-lg transition-all flex items-center justify-center space-x-2 ${
                  activeTab === 'REGISTER' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>First-Time Registration</span>
              </button>}
            </div>

            {/* LOGIN FORM */}
            {activeTab === 'LOGIN' && (
              adminAuthenticatorSetupStep ? (
                <form onSubmit={handleVerifyAdminAuthenticatorSetup} className="space-y-4">
                  <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-4 space-y-3 text-center">
                    <h4 className="font-bold text-white">Set up the admin authenticator</h4>
                    <p className="text-xs text-slate-300">Scan this QR code once with Google Authenticator or Microsoft Authenticator. Enter the current six-digit code to finish setup.</p>
                    <img src={adminSetupQr} alt="Admin authenticator setup QR code" className="mx-auto w-48 rounded-lg bg-white p-2" />
                    <details className="text-left text-xs text-slate-400">
                      <summary className="cursor-pointer">Can’t scan? Show setup key</summary>
                      <code className="mt-2 block break-all rounded bg-slate-900 p-2 text-cyan-300">{adminSetupKey}</code>
                    </details>
                    <p className="text-xs text-amber-200">You have five code attempts. Authenticator codes refresh every 30 seconds.</p>
                  </div>
                  <label className="block text-slate-300 font-medium mb-1" htmlFor="admin-setup-otp">Six-digit authenticator code</label>
                  <input id="admin-setup-otp" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={adminSetupOtp} onChange={(event) => setAdminSetupOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter current 6-digit code" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-200 tracking-widest focus:outline-none focus:border-purple-500" />
                  {loginError && <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs">{loginError}</div>}
                  <button type="submit" className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs">Verify and Enable Admin Authenticator</button>
                  <button type="button" onClick={() => { setAdminAuthenticatorSetupStep(false); setAdminSetupChallengeId(''); setAdminSetupQr(''); setAdminSetupKey(''); setLoginError(null); }} className="w-full py-2 text-slate-400 hover:text-white text-xs">Back to admin login</button>
                </form>
              ) : loginOtpStep ? (
                <form onSubmit={handleVerifyOTP} className="space-y-4">
                  <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4 space-y-2">
                    <h4 className="font-bold text-white">Authenticator verification</h4>
                    <p className="text-xs text-slate-300">Open the authenticator app you linked during registration and enter its current six-digit code.</p>
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Authenticator code</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      required
                      value={otpCodeInput}
                      onChange={(event) => setOtpCodeInput(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Enter 6-digit code"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-200 tracking-widest focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  {loginError && <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs">{loginError}</div>}
                  <button type="submit" className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg">Verify and Sign In</button>
                  <button type="button" onClick={() => { setLoginOtpStep(false); setLoginChallengeId(''); setLoginError(null); }} className="w-full py-2 text-slate-400 hover:text-white text-xs">Back to login</button>
                </form>
              ) : <div className="space-y-4">
                
                {/* Form Input */}
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      {selectedPersona === 'STUDENT' ? 'Student Email' : selectedPersona === 'FACULTY' ? 'Mentor Email' : selectedPersona === 'PARENT' ? 'Parent Email' : 'Admin Key or Email'}
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        required
                        value={loginIdentifier}
                        onChange={(e) => setLoginIdentifier(e.target.value)}
                        placeholder={currentConfig?.placeholderID}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Password</label>
                    {selectedPersona !== 'ADMIN' && <p className="text-[11px] text-slate-500 mb-1">{selectedPersona === 'FACULTY' ? 'Use your Mentor ID from the CSV.' : 'Use the student Roll No. from the CSV.'}</p>}
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type={showLoginPassword ? 'text' : 'password'}
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-11 py-2.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                      />
                      <button type="button" onClick={() => setShowLoginPassword((visible) => !visible)} aria-label={showLoginPassword ? 'Hide password' : 'Show password'} aria-pressed={showLoginPassword} className="absolute right-3 top-2.5 text-slate-400 hover:text-cyan-300">
                        {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {loginError && (
                    <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{loginError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className={`w-full py-3 rounded-xl text-white font-bold text-xs shadow-lg transition-all ${currentConfig?.btnColor}`}
                  >
                    Sign In to {selectedPersona} Portal
                  </button>
                  {selectedPersona === 'ADMIN' && <button type="button" onClick={handleBeginAdminAuthenticatorSetup} className="w-full py-2 text-purple-300 hover:text-purple-200 text-xs font-semibold">First time here? Set up admin authenticator</button>}
                </form>
              </div>
            )}

            {/* TAILORED REGISTRATION FORM */}
            {activeTab === 'REGISTER' && (
              registerOtpStep ? (
                <form onSubmit={handleVerifyRegistrationOTP} className="space-y-4">
                  <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4 space-y-2">
                    <h4 className="font-bold text-white">Set up your authenticator</h4>
                    <p className="text-xs text-slate-300">Scan this QR code with Google Authenticator, Microsoft Authenticator, or another TOTP app. Then enter the current code to finish registration.</p>
                    <img src={registerAuthenticatorQr} alt="Authenticator setup QR code" className="mx-auto w-48 rounded-lg bg-white p-2" />
                    <p className="text-xs text-slate-300">On the same phone? Choose “Enter setup key” in the authenticator app and use:</p>
                    <code className="block break-all rounded bg-slate-900 p-2 text-center text-xs text-cyan-300">{registerAuthenticatorKey}</code>
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1" htmlFor="registration-email-otp">Authenticator code</label>
                    <input
                      id="registration-email-otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      required
                      value={registerOtpCode}
                      onChange={(event) => setRegisterOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Enter current 6-digit code"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-200 tracking-widest focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  {regError && <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs">{regError}</div>}
                  <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">You have up to five attempts to enter the current six-digit code. Keep this QR in your authenticator app for future logins.</p>
                  <button type="submit" className={`w-full py-3 rounded-xl text-white font-bold text-xs shadow-lg ${currentConfig?.btnColor}`}>Verify and {enrollingExistingAccount ? 'Enroll Account' : 'Create Account'}</button>
                  <button type="button" onClick={() => { setRegisterOtpStep(false); setRegisterChallengeId(''); setRegError(null); }} className="w-full py-2 text-slate-400 hover:text-white text-xs">Back to registration</button>
                </form>
              ) : <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-slate-300">
                  <p className="font-semibold text-amber-300">Already listed in the attendance CSV?</p>
                  <p className="mt-1">Choose your role and enter the same ID, institutional email, and password already assigned to your account. This enrolls your existing account instead of creating a duplicate. Authenticator verification allows up to five code attempts.</p>
                </div>
                
                {/* PERSONA 1: STUDENT TAILORED REGISTRATION */}
                {selectedPersona === 'STUDENT' && (
                  <div className="space-y-3">
                    <p className="text-slate-400">
                      Register as a student to track your attendance trajectory, simulate classes needed, and submit OD documents.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-300 font-medium mb-1">Student Full Name *</label>
                        <input
                          type="text"
                          required
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          placeholder="e.g. Janarthanan M"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-medium mb-1">Register No *</label>
                        <input
                          type="text"
                          required
                          value={regRegisterNo}
                          onChange={(e) => setRegRegisterNo(e.target.value.toUpperCase())}
                          placeholder="7376232AD101"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200"
                        />
                        <p className="mt-1 text-[10px] text-slate-500">Format: 7376YY + 1 (BE) or 2 (B.Tech) + department code + 3 digits.</p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Department *</label>
                      <select
                        required
                        value={regStudentDepartment}
                        onChange={(e) => setRegStudentDepartment(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200"
                      >
                        <optgroup label="BE — Bachelor of Engineering">
                          {studentDepartmentOptions.filter((item) => item.program === 'BE').map((item) => <option key={item.code} value={item.code}>{item.code} — {item.name}</option>)}
                        </optgroup>
                        <optgroup label="B.Tech — Bachelor of Technology">
                          {studentDepartmentOptions.filter((item) => item.program === 'B.Tech').map((item) => <option key={item.code} value={item.code}>{item.code} — {item.name}</option>)}
                        </optgroup>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-300 font-medium mb-1">Institutional Email *</label>
                        <input
                          type="email"
                          required
                          value={regEmail}
                          onChange={(e) => {
                            const email = e.target.value.toLowerCase();
                            setRegEmail(email);
                            const suffix = /\.([a-z]{2})\d{2}@bitsathy\.ac\.in$/i.exec(email);
                            if (suffix && studentDepartmentOptions.some((item) => item.code === suffix[1].toUpperCase())) {
                              setRegStudentDepartment(suffix[1].toUpperCase());
                            }
                          }}
                          placeholder="janarthanan.ad23@bitsathy.ac.in"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200"
                        />
                        <p className="mt-1 text-[10px] text-slate-500">Use your @bitsathy.ac.in address with a department/year suffix, e.g. .ad23.</p>
                      </div>

                      <div>
                        <label className="block text-slate-300 font-medium mb-1">Student Phone Number *</label>
                        <input
                          type="text"
                          required
                          value={regPhone}
                          onChange={(e) => setRegPhone(e.target.value)}
                          placeholder="+91 9876543210"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200"
                        />
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                      <span className="text-cyan-400 font-bold block">Parent & Mentor Details</span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-slate-400 text-[10px] mb-0.5">Parent Name</label>
                          <input
                            type="text"
                            value={regParentName}
                            onChange={(e) => setRegParentName(e.target.value)}
                            placeholder="Murugesan K"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 text-[10px] mb-0.5">Parent Phone (WhatsApp)</label>
                          <input
                            type="text"
                            value={regParentPhone}
                            onChange={(e) => setRegParentPhone(e.target.value)}
                            placeholder="+91 9876543201"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 text-[10px] mb-0.5">Faculty Mentor</label>
                          <input
                            type="text"
                            value={regMentorName}
                            onChange={(e) => setRegMentorName(e.target.value)}
                            placeholder="Mentor name"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* PERSONA 2: FACULTY TAILORED REGISTRATION */}
                {selectedPersona === 'FACULTY' && (
                  <div className="space-y-3">
                    <p className="text-slate-400">
                      Register as a Faculty Advisor / Class Mentor to manage batch deficiency alerts, heatmaps, and counseling sessions.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-300 font-medium mb-1">Faculty Name *</label>
                        <input
                          type="text"
                          required
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          placeholder="Mentor name"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-medium mb-1">Employee ID *</label>
                        <input
                          type="text"
                          required
                          value={regRegisterNo}
                          onChange={(e) => setRegRegisterNo(e.target.value)}
                          placeholder="Mentor ID"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-300 font-medium mb-1">Faculty Email *</label>
                        <input
                          type="email"
                          required
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          placeholder="ramanathan@bitsathy.ac.in"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-medium mb-1">Department *</label>
                        <select
                          required
                          value={regDepartment}
                          onChange={(e) => setRegDepartment(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200"
                        >
                          <optgroup label="BE — Bachelor of Engineering">
                            {studentDepartmentOptions.filter((item) => item.program === 'BE').map((item) => <option key={item.code} value={item.name}>{item.code} — {item.name}</option>)}
                          </optgroup>
                          <optgroup label="B.Tech — Bachelor of Technology">
                            {studentDepartmentOptions.filter((item) => item.program === 'B.Tech').map((item) => <option key={item.code} value={item.name}>{item.code} — {item.name}</option>)}
                          </optgroup>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* PERSONA 3: PARENT TAILORED REGISTRATION */}
                {selectedPersona === 'PARENT' && (
                  <div className="space-y-3">
                    <p className="text-slate-400">
                      Register your Parent PWA account to receive WhatsApp deficiency alerts, 1-tap acknowledgments, and direct mentor callbacks.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-300 font-medium mb-1">Parent/Guardian Name *</label>
                        <input
                          type="text"
                          required
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          placeholder="Dhanapal R"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-medium mb-1">WhatsApp Phone Number *</label>
                        <input
                          type="text"
                          required
                          value={regPhone}
                          onChange={(e) => setRegPhone(e.target.value)}
                          placeholder="Parent phone number"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Institutional Email *</label>
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value.toLowerCase())}
                        placeholder="parent@bitsathy.ac.in"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200"
                      />
                      <p className="mt-1 text-[10px] text-slate-500">Parent accounts also require an @bitsathy.ac.in address.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-300 font-medium mb-1">Student Register No to Link *</label>
                        <input
                          type="text"
                          required
                          value={regRegisterNo}
                          onChange={(e) => setRegRegisterNo(e.target.value)}
                          placeholder="7376232AD197"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-medium mb-1">Language Preference</label>
                        <select
                          value={regLangPref}
                          onChange={(e) => setRegLangPref(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200"
                        >
                          <option value="EN">English</option>
                          <option value="TA">Tamil (தமிழ்)</option>
                          <option value="HI">Hindi (हिंदी)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* PERSONA 4: ADMIN TAILORED REGISTRATION */}
                {selectedPersona === 'ADMIN' && (
                  <div className="space-y-3">
                    <p className="text-slate-400">
                      Register as an Institutional Admin / HOD to access accreditation reports, delivery health monitors, and audit logs.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-300 font-medium mb-1">Admin / HOD Name *</label>
                        <input
                          type="text"
                          required
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          placeholder="Dr. K. Venkatesh"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-medium mb-1">Admin Security Access Token *</label>
                        <input
                          type="text"
                          required
                          value={regAdminKey}
                          onChange={(e) => setRegAdminKey(e.target.value)}
                          placeholder="ADM-KEY-901"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200 font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-300 font-medium mb-1">Institutional Admin Email *</label>
                        <input
                          type="email"
                          required
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          placeholder="Administrator email"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-medium mb-1">Department Scope *</label>
                        <input
                          type="text"
                          required
                          value={regDepartment}
                          onChange={(e) => setRegDepartment(e.target.value)}
                          placeholder="Artificial Intelligence & Data Science"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Account Password *</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      minLength={4}
                      autoComplete="current-password"
                      value={regPassword}
                      onChange={(event) => setRegPassword(event.target.value)}
                      placeholder="Enter your account password"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-11 py-2.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                    />
                    <button type="button" onClick={() => setShowRegPassword((visible) => !visible)} aria-label={showRegPassword ? 'Hide password' : 'Show password'} aria-pressed={showRegPassword} className="absolute right-3 top-2.5 text-slate-400 hover:text-cyan-300">
                      {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500">
                    CSV account defaults: {selectedPersona === 'STUDENT' ? 'student roll number' : selectedPersona === 'FACULTY' ? 'mentor ID' : 'linked student roll number'}. If changed later, use the current password.
                  </p>
                </div>

                {regError && (
                  <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{regError}</span>
                  </div>
                )}

                {regSuccessMsg && (
                  <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>{regSuccessMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className={`w-full py-3 rounded-xl text-white font-bold text-xs shadow-lg transition-all ${currentConfig?.btnColor}`}
                >
                  Complete {selectedPersona} Registration
                </button>
              </form>
            )}

          </div>
        )}

      </div>
    </div>
  );
};
