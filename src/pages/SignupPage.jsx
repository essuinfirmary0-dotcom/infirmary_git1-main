import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { UserPlus, GraduationCap, Building2, Briefcase, ChevronLeft, Eye, EyeOff, Lock } from 'lucide-react';
import { authService } from '../services/authService';

const userTypes = [
  { id: 'new', label: 'New Student', icon: GraduationCap, color: 'bg-blue-500' },
  { id: 'old', label: 'Old Student', icon: Building2, color: 'bg-emerald-500' },
  { id: 'employee', label: 'Employee', icon: Briefcase, color: 'bg-orange-500' }
];

const colleges = [
  'College of Arts and Sciences',
  'College of Business and Accountancy',
  'College of Engineering',
  'College of Education',
  'College of Nursing',
];

const programsByCollege = {
  'College of Arts and Sciences': ['BS Psychology', 'BA Communication', 'BS Mathematics'],
  'College of Business and Accountancy': ['BS Accountancy', 'BS Business Administration', 'BS Management Accounting'],
  'College of Engineering': ['BS Computer Engineering', 'BS Civil Engineering', 'BS Electrical Engineering'],
  'College of Education': ['BSEd English', 'BSEd Math', 'BEEd General Education'],
  'College of Nursing': ['BS Nursing'],
};

const formatStudentNumber = (raw) => {
  // Keep only digits and cap at 7 digits (2 + 5)
  const digits = raw.replace(/\D/g, '').slice(0, 7);
  const first = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (!first) return '';
  if (!rest) return first;
  // Show exactly what the user has typed after the dash (no zero padding),
  // while still limiting to max 5 digits after the dash.
  return `${first}-${rest.slice(0, 5)}`;
};

export const SignupPage = () => {
  const navigate = useNavigate();
  const [userType, setUserType] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    lastName: '',
    firstName: '',
    middleName: '',
    email: '',
    address: '',
    phone: '',
    password: '',
    confirmPassword: '',
    studentNumber: '',
    college: '',
    program: '',
  });
  const [loading, setLoading] = useState(false);
  const [createdUser, setCreatedUser] = useState(null);

  const handleDownloadQr = (qrCode) => {
    if (!qrCode) return;
    try {
      const link = document.createElement('a');
      link.href = qrCode;
      link.download = 'infirmary-id-qr.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      // best-effort only
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userType) {
      toast.error('Please select your status (New Student, Old Student, or Employee).');
      return;
    }
    try {
      setLoading(true);
      const payload = {
        userType,
        lastName: formData.lastName,
        firstName: formData.firstName,
        middleName: formData.middleName,
        email: formData.email,
        address: formData.address,
        phone: formData.phone,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        // Only relevant for old students; server will ignore for others
        studentNumber: userType === 'old' ? formData.studentNumber : undefined,
        college: userType === 'old' ? formData.college : undefined,
        program: userType === 'old' ? formData.program : undefined,
      };

      const result = await authService.signup(payload);

      toast.success('Account created successfully!');
      setCreatedUser(result?.user || null);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Signup failed:', err);
      const message = err.response?.data?.message || 'Signup failed. Please check your details and try again.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-6 py-6 sm:py-12 md:py-20 relative overflow-hidden min-h-0">
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/20 via-slate-50 to-primary/10 -z-10" />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/90 sm:bg-white/80 backdrop-blur-2xl p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-2xl border border-white w-full max-w-4xl space-y-6 sm:space-y-8 relative my-6 sm:my-8"
      >
        <div className="text-center space-y-2 sm:space-y-3">
          <div className="bg-gradient-to-br from-primary to-primary-hover w-14 h-14 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center text-white mx-auto mb-4 sm:mb-6 shadow-xl shadow-primary/30 transform rotate-6">
            <UserPlus className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tighter">Create Account</h2>
          <p className="text-slate-500 font-medium text-sm sm:text-base">Join the University Infirmary</p>
        </div>

        {!userType ? (
          <div className="space-y-5 sm:space-y-8">
            <label className="text-[11px] font-black text-slate-600 uppercase tracking-[0.1em] block text-center">Select your status to continue</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              {userTypes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setUserType(t.id)}
                  className="p-5 sm:p-8 bg-white border-2 border-slate-100 rounded-2xl sm:rounded-3xl hover:border-primary hover:bg-primary/5 transition-all flex flex-col items-center gap-4 sm:gap-6 group relative overflow-hidden shadow-lg shadow-slate-200/50 min-h-[120px] sm:min-h-0"
                >
                  <div className={`p-3 sm:p-4 bg-slate-50 rounded-xl sm:rounded-2xl text-slate-400 group-hover:text-white group-hover:bg-primary transition-all duration-500 shadow-inner group-hover:shadow-xl group-hover:shadow-primary/40 flex items-center justify-center`}>
                    <t.icon className="w-8 h-8 sm:w-9 sm:h-9" />
                  </div>
                  <span className="font-black text-base sm:text-xl text-slate-800 group-hover:text-primary transition-colors text-center">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : !createdUser ? (
          <form className="space-y-6 sm:space-y-8" onSubmit={handleSubmit}>
            <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-primary/5 rounded-xl sm:rounded-2xl border border-primary/10 flex-wrap">
              <button type="button" onClick={() => setUserType(null)} className="p-2 bg-white hover:bg-slate-100 rounded-xl text-primary shadow-lg shadow-primary/10 transition-all shrink-0" aria-label="Back">
                <ChevronLeft size={20} />
              </button>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[10px] font-black text-primary uppercase tracking-[0.1em]">Step 02: Information</span>
                <span className="font-black text-slate-900 text-base sm:text-xl tracking-tight truncate">Registering as {userTypes.find(t => t.id === userType).label}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-600 uppercase tracking-[0.1em] ml-2">Last Name</label>
                <input
                  required
                  className="w-full px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-base font-medium min-h-[48px]"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-600 uppercase tracking-[0.1em] ml-2">First Name</label>
                <input
                  required
                  className="w-full px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-base font-medium min-h-[48px]"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-600 uppercase tracking-[0.1em] ml-2">Middle Name</label>
                <input
                  className="w-full px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-base font-medium min-h-[48px]"
                  placeholder="Quincy"
                  value={formData.middleName}
                  onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                />
              </div>
              {userType === 'old' && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-600 uppercase tracking-[0.1em] ml-2">
                      Student Number
                    </label>
                    <input
                      required
                      className="w-full px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-base font-medium min-h-[48px]"
                      placeholder="00-00000"
                      value={formData.studentNumber}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          studentNumber: formatStudentNumber(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-600 uppercase tracking-[0.1em] ml-2">
                      College
                    </label>
                    <select
                      required
                      className="w-full px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-base font-medium min-h-[48px]"
                      value={formData.college}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          college: e.target.value,
                          program: '',
                        })
                      }
                    >
                      <option value="">Select college</option>
                      {colleges.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[11px] font-black text-slate-600 uppercase tracking-[0.1em] ml-2">
                      Program
                    </label>
                    <select
                      required
                      disabled={!formData.college}
                      className="w-full px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-base font-medium min-h-[48px] disabled:opacity-60"
                      value={formData.program}
                      onChange={(e) => setFormData({ ...formData, program: e.target.value })}
                    >
                      <option value="">Select program</option>
                      {(programsByCollege[formData.college] || []).map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-600 uppercase tracking-[0.1em] ml-2">Email Address</label>
                <input
                  required
                  type="email"
                  className="w-full px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-base font-medium min-h-[48px]"
                  placeholder="john.doe@school.edu"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[11px] font-black text-slate-600 uppercase tracking-[0.1em] ml-2">Address</label>
                <input
                  required
                  className="w-full px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-base font-medium min-h-[48px]"
                  placeholder="123 School St, City"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-600 uppercase tracking-[0.1em] ml-2">Phone Number</label>
                <input
                  required
                  className="w-full px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-base font-medium min-h-[48px]"
                  placeholder="+63 912 345 6789"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-600 uppercase tracking-[0.1em] ml-2">Password</label>
                <div className="relative group">
                  <Lock className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-4 sm:right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4 sm:w-[18px] sm:h-[18px]" /> : <Eye className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />}
                  </button>
                  <input
                    required
                    type={showPassword ? 'text' : 'password'}
                    className="w-full pl-11 sm:pl-14 pr-11 sm:pr-14 py-3.5 sm:py-4 bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-base font-medium min-h-[48px]"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[11px] font-black text-slate-600 uppercase tracking-[0.1em] ml-2">Confirm Password</label>
                <div className="relative group">
                  <Lock className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-4 sm:right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4 sm:w-[18px] sm:h-[18px]" /> : <Eye className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />}
                  </button>
                  <input
                    required
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="w-full pl-11 sm:pl-14 pr-11 sm:pr-14 py-3.5 sm:py-4 bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-base font-medium min-h-[48px]"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 sm:py-4 bg-primary text-white font-black rounded-xl sm:rounded-2xl hover:bg-primary-hover transition-all shadow-xl shadow-primary/30 text-base sm:text-lg mt-2 sm:mt-4 disabled:opacity-60 disabled:cursor-not-allowed min-h-[48px]"
            >
              {loading ? 'Creating account...' : 'Complete Registration'}
            </button>
          </form>
        ) : (
          <div className="space-y-6 sm:space-y-8">
            <div className="text-center space-y-2 sm:space-y-3">
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Account Created
              </h3>
              <p className="text-slate-600 text-sm sm:text-base max-w-xl mx-auto">
                Your record has been created successfully. Save your ID details and QR code for future
                infirmary visits.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-6 space-y-3 shadow-lg shadow-slate-900/30">
                <p className="text-[10px] font-black text-primary/60 uppercase tracking-[0.2em]">
                  Basic Information
                </p>
                <div className="space-y-1.5">
                  <p className="text-lg sm:text-xl font-black">
                    {createdUser.firstName} {createdUser.lastName}
                  </p>
                  <p className="text-xs text-slate-300">{createdUser.email}</p>
                </div>

                <div className="mt-3 space-y-1.5 text-xs">
                  {createdUser.studentNumber && (
                    <p>
                      <span className="font-bold text-slate-400">Student No.</span>{' '}
                      <span className="font-black bg-slate-800 px-2 py-0.5 rounded-lg">
                        {createdUser.studentNumber}
                      </span>
                    </p>
                  )}
                  {createdUser.employeeNumber && (
                    <p>
                      <span className="font-bold text-slate-400">Employee No.</span>{' '}
                      <span className="font-black bg-slate-800 px-2 py-0.5 rounded-lg">
                        {createdUser.employeeNumber}
                      </span>
                    </p>
                  )}
                  {createdUser.college && (
                    <p>
                      <span className="font-bold text-slate-400">College</span>{' '}
                      <span className="font-semibold">{createdUser.college}</span>
                    </p>
                  )}
                  {createdUser.program && (
                    <p>
                      <span className="font-bold text-slate-400">Program</span>{' '}
                      <span className="font-semibold">{createdUser.program}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 sm:p-6 flex flex-col items-center justify-center gap-3">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                  QR Code
                </p>
                {createdUser.qrCode ? (
                  <>
                    <div className="p-2 bg-white rounded-2xl border border-slate-200 shadow-inner">
                      <img
                        src={createdUser.qrCode}
                        alt="Student/Employee QR code"
                        className="w-40 h-40 sm:w-48 sm:h-48 rounded-xl object-contain"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 text-center max-w-xs">
                      Screenshot or download this QR code. You may be asked to present it during infirmary
                      visits.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleDownloadQr(createdUser.qrCode)}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-white text-[11px] font-bold hover:bg-primary-hover shadow-sm"
                    >
                      Download QR
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-slate-500 text-center">
                    QR code not available. Please contact the infirmary staff.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => navigate('/login/user')}
                className="w-full sm:w-auto px-5 py-3 bg-primary text-white font-black rounded-xl hover:bg-primary-hover transition-all shadow-lg shadow-primary/30 text-sm"
              >
                Go to Login
              </button>
            </div>
          </div>
        )}

        <div className="text-center pt-2 sm:pt-4">
          <p className="text-slate-500 font-medium text-sm sm:text-base md:text-lg">
            Already have an account?{" "}
            <Link to="/login/user" className="text-primary font-black hover:underline">Sign In</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};
