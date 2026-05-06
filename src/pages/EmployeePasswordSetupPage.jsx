import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { CheckCircle, Eye, EyeOff, KeyRound, Lock } from 'lucide-react';
import { authService } from '../services/authService';

const successMessage =
  'Your employee account has been successfully activated. You may now log in using your email and password.';

const getPasswordError = (password) => {
  if (password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    return 'Password must include uppercase and lowercase letters.';
  }
  if (!/\d/.test(password)) {
    return 'Password must include at least one number.';
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must include at least one special character.';
  }
  return '';
};

export const EmployeePasswordSetupPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const passwordError = useMemo(() => (password ? getPasswordError(password) : ''), [password]);

  useEffect(() => {
    if (!token) {
      toast.error('Invalid or missing employee password setup link.');
    }
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!token) return;

    const nextPasswordError = getPasswordError(password);
    if (nextPasswordError) {
      toast.error(nextPasswordError);
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const result = await authService.setupEmployeePassword({ token, password, confirmPassword });
      setSuccess(true);
      toast.success(result?.message || successMessage);
      setTimeout(() => navigate('/login/user'), 2500);
    } catch (error) {
      const message = error?.response?.data?.message || 'Invalid or expired password setup link.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 p-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-xl space-y-5"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
            <KeyRound size={28} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-slate-900">Invalid setup link</h1>
            <p className="text-sm font-medium leading-relaxed text-slate-500">
              This employee password setup link is missing or invalid. Request a new link from the sign-in page.
            </p>
          </div>
          <Link to="/login/user" className="inline-block rounded-xl bg-primary px-6 py-3 text-sm font-black text-white hover:bg-primary-hover">
            Back to sign in
          </Link>
        </motion.div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-xl space-y-5"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
            <CheckCircle size={34} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-slate-900">Account activated</h1>
            <p className="text-sm font-medium leading-relaxed text-slate-600">{successMessage}</p>
          </div>
          <Link to="/login/user" className="inline-block rounded-xl bg-primary px-6 py-3 text-sm font-black text-white hover:bg-primary-hover">
            Sign in now
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-slate-50 p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-[2rem] border border-white bg-white/95 p-6 shadow-2xl sm:p-8"
      >
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white shadow-xl shadow-primary/25">
            <KeyRound size={30} />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Set Up Password</h1>
            <p className="text-sm font-medium leading-relaxed text-slate-500">
              Create a password to activate your employee account.
            </p>
          </div>
        </div>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <label className="ml-2 text-[11px] font-black uppercase tracking-[0.1em] text-slate-600">
              New Password
            </label>
            <div className="relative group">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-slate-100 bg-slate-50 py-4 pl-14 pr-14 text-base font-medium transition-all focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                placeholder="Enter new password"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="ml-2 text-[11px] font-black uppercase tracking-[0.1em] text-slate-600">
              Confirm Password
            </label>
            <div className="relative group">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((value) => !value)}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-2xl border border-slate-100 bg-slate-50 py-4 pl-14 pr-14 text-base font-medium transition-all focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                placeholder="Confirm new password"
              />
            </div>
          </div>

          <p className={`rounded-xl border px-3 py-2 text-xs font-semibold ${passwordError ? 'border-amber-100 bg-amber-50 text-amber-700' : 'border-slate-100 bg-slate-50 text-slate-500'}`}>
            Passwords need at least 8 characters, uppercase and lowercase letters, a number, and a special character.
          </p>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-primary py-4 text-lg font-black text-white shadow-xl shadow-primary/30 transition-all hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Activating...' : 'Activate Account'}
          </button>
          <Link to="/login/user" className="block text-center text-sm font-bold text-slate-500 transition-colors hover:text-primary">
            Back to sign in
          </Link>
        </form>
      </motion.div>
    </div>
  );
};
