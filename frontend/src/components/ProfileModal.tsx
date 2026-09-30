import React, { useState } from 'react';
import { UserProfile } from '../types';
import { updateProfileAPI } from '../lib/api';
import { User, Edit3, Save, LogOut, CheckCircle, ShieldCheck, Mail, Phone, Building, UserCheck } from 'lucide-react';

interface ProfileModalProps {
  user: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
  onLogout: () => void;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ user, onUpdateUser, onLogout, onClose }) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [phone, setPhone] = useState<string>(user.phone);
  const [email, setEmail] = useState<string>(user.email);
  const [parentName, setParentName] = useState<string>(user.parent_name || '');
  const [parentPhone, setParentPhone] = useState<string>(user.parent_phone || '');
  const [parentEmail, setParentEmail] = useState<string>(user.parent_email || '');
  const [department, setDepartment] = useState<string>(user.department);
  const [section, setSection] = useState<string>(user.section || 'A');
  const [mentorName, setMentorName] = useState<string>(user.mentor_name || 'Mentor not assigned');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccessMsg(null);

    const res = await updateProfileAPI({
      user_id: user.user_id,
      phone,
      email,
      parent_name: parentName,
      parent_phone: parentPhone,
      parent_email: parentEmail,
      department,
      section,
      mentor_name: mentorName
    });

    if (res.success && res.user) {
      onUpdateUser(res.user);
      setSaveSuccessMsg('Profile updated successfully!');
      setTimeout(() => {
        setIsEditing(false);
        setSaveSuccessMsg(null);
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-card max-w-xl w-full rounded-2xl p-6 border border-slate-700 shadow-2xl relative space-y-6 max-h-[90vh] overflow-y-auto">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-bold text-lg">
              {user.name.charAt(0)}
            </div>
            <div>
              <h3 className="font-extrabold text-white text-lg">{user.name}</h3>
              <span className="text-xs text-slate-400">Register No: {user.register_no}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              {user.role}
            </span>
            <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
          </div>
        </div>

        {/* View vs Edit Profile Body */}
        {!isEditing ? (
          <div className="space-y-4 text-xs">
            
            <div className="grid grid-cols-2 gap-3 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-400 block">Department</span>
                <strong className="text-white text-sm">{user.department}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Section</span>
                <strong className="text-cyan-300 text-sm">Section {user.section || 'A'}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Email Address</span>
                <strong className="text-slate-200">{user.email}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Phone Number</span>
                <strong className="text-slate-200">{user.phone}</strong>
              </div>
            </div>

            {/* Parent & Mentor Details */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
              <span className="text-cyan-400 font-bold text-xs block">Parent / Guardian & Faculty Advisor Details</span>
              <div className="grid grid-cols-2 gap-2 text-slate-300">
                <div>Parent Name: <strong className="text-white">{user.parent_name || 'N/A'}</strong></div>
                <div>Parent Phone: <strong className="text-emerald-300">{user.parent_phone || 'N/A'}</strong></div>
                <div>Parent Email: <strong className="text-slate-200">{user.parent_email || 'N/A'}</strong></div>
                <div>Faculty Mentor: <strong className="text-cyan-300">{user.mentor_name || 'Mentor not assigned'}</strong></div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={onLogout}
                className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-semibold text-xs flex items-center space-x-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>

              <button
                onClick={() => setIsEditing(true)}
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center space-x-2 shadow-lg shadow-cyan-600/30"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit Profile</span>
              </button>
            </div>

          </div>
        ) : (
          <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-cyan-400" />
              Update Profile Information
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Phone Number</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Department</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Section</label>
                <input
                  type="text"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
              <span className="text-cyan-400 font-bold block text-[11px]">Parent & Mentor Contacts</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-400 text-[10px] mb-0.5">Parent Name</label>
                  <input
                    type="text"
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-[10px] mb-0.5">Parent Phone</label>
                  <input
                    type="text"
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-[10px] mb-0.5">Mentor Name</label>
                  <input
                    type="text"
                    value={mentorName}
                    onChange={(e) => setMentorName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                  />
                </div>
              </div>
            </div>

            {saveSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold flex items-center space-x-2 shadow-lg shadow-cyan-600/30"
              >
                <Save className="w-4 h-4" />
                <span>Save Profile Updates</span>
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
