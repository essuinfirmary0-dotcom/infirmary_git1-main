import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { Mail, ArrowLeft } from 'lucide-react';
import { authService } from '../services/authService';

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      await authService.forgotPassword(email.trim());
      setSent(true);
      toast.success('If that email is registered, you will receive a reset link shortly.');
    } catch (err) {
      const message = err?.response?.data?.message || 'Something went wrong. Please try again.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-linear-to-br from-primary/20 via-slate-50 to-primary/10 -z-10" />
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary/10 rounded-full blur-[100px] -z-10" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-primary/10 rounded-full blur-[100px] -z-10" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white/80 backdrop-blur-2xl p-8 rounded-[2.5rem] shadow-2xl border border-white w-full max-w-md space-y-8 relative"
      >
        <div className="text-center space-y-3">
          <div className="bg-linear-to-br from-primary to-primary-hover w-16 h-16 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-xl shadow-primary/30 transform -rotate-6">
            <Mail size={32} />
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Forgot password?</h2>
          <p className="text-slate-500 font-medium">
            Enter your email and we’ll send you a link to reset your password.
          </p>
        </div>

        {sent ? (
          <div className="space-y-6">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
              <p className="text-emerald-800 font-medium text-sm">
                Check your inbox. If an account exists for that email, you’ll receive a link to reset your password. The link expires in 1 hour.
              </p>
            </div>
            <Link
              to="/login/user"
              className="flex items-center justify-center gap-2 w-full py-4 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-all"
            >
              <ArrowLeft size={18} />
              Back to sign in
            </Link>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-600 uppercase tracking-widest ml-2">
                Email address
              </label>
              <div className="relative group">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-base font-medium"
                  placeholder="name@university.edu"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-primary text-white font-black rounded-2xl hover:bg-primary-hover transition-all shadow-xl shadow-primary/30 text-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
            <Link
              to="/login/user"
              className="flex items-center justify-center gap-2 text-slate-500 font-bold text-sm hover:text-primary transition-colors"
            >
              <ArrowLeft size={16} />
              Back to sign in
            </Link>
          </form>
        )}
      </motion.div>
    </div>
  );
};
