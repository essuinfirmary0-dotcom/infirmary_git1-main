import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { UserPlus, Save, User, Mail, MapPin, Phone, Lock, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminService } from '../../services/adminService';

const toastStyle = {
  borderRadius: '12px',
  background: '#0f172a',
  color: '#fff',
  fontWeight: 'bold',
  fontSize: '12px',
};

const initialForm = {
  firstName: '',
  lastName: '',
  middleName: '',
  email: '',
  address: '',
  phone: '',
  password: '',
  confirmPassword: '',
};

export const AdminCreateAdminPage = () => {
  const [userType, setUserType] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('authUser');
      setUserType(stored ? JSON.parse(stored).userType : null);
    } catch {
      setUserType(null);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match.', { style: toastStyle });
      return;
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters.', { style: toastStyle });
      return;
    }
    setLoading(true);
    try {
      const result = await adminService.createAdminUser({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        middleName: form.middleName.trim() || undefined,
        email: form.email.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
      });
      const loginId = result?.loginId || form.email.trim();
      toast.success(`Admin account created. Login ID: ${loginId}`, { style: toastStyle });
      setForm(initialForm);
    } catch (err) {
      const message = err?.response?.data?.message || 'Failed to create admin account.';
      toast.error(message, { style: toastStyle });
    } finally {
      setLoading(false);
    }
  };

  if (userType != null && userType !== 'super_admin') {
    return <Navigate to="/admin" replace />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Create Admin Account</h1>
        <p className="text-sm text-slate-500 font-medium">Super admin only. Add a new admin user to the portal.</p>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                <User size={14} /> First Name
              </label>
              <input
                required
                type="text"
                placeholder="Jane"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                <User size={14} /> Last Name
              </label>
              <input
                required
                type="text"
                placeholder="Doe"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
              <User size={14} /> Middle Name <span className="text-slate-400 font-normal normal-case">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="M."
              value={form.middleName}
              onChange={(e) => setForm({ ...form, middleName: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
              <Mail size={14} /> Email
            </label>
            <input
              required
              type="email"
              placeholder="admin@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
              <MapPin size={14} /> Address
            </label>
            <input
              required
              type="text"
              placeholder="Street, City, Country"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
              <Phone size={14} /> Phone
            </label>
            <input
              required
              type="tel"
              placeholder="+1 234 567 8900"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                <Lock size={14} /> Password
              </label>
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min 8 characters"
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-4 pr-11 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                <Lock size={14} /> Confirm Password
              </label>
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <input
                  required
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Repeat password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  className="w-full px-4 pr-11 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto px-6 py-3.5 bg-primary text-white font-black rounded-xl hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <UserPlus size={18} />
                Create Admin Account
              </>
            )}
          </button>
        </form>
      </div>
    </motion.div>
  );
};
