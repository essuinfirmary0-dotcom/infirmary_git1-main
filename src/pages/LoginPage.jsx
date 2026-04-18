import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { ArrowLeft, Eye, EyeOff, IdCard, Lock, ShieldCheck, Stethoscope } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { authService } from '../services/authService';
import logoImg from '../assets/logo_bgnone.png';

const isAdminUserType = (userType) => userType === 'admin' || userType === 'super_admin';

const pageCopy = {
  user: {
    icon: Stethoscope,
    title: 'Welcome Back',
    subtitle: 'Sign in to book appointments and manage your infirmary visits.',
    identifierLabel: 'Student ID or Employee ID',
    identifierPlaceholder: 'e.g. 23-00275',
    submitLabel: 'Sign In',
    loadingLabel: 'Signing in...',
    forgotLink: '/forgot-password',
    alternateLabel: 'Admin access',
    alternateTo: '/login/admin',
    alternateText: 'Go to admin portal',
    tone: 'from-primary to-primary-hover',
  },
  admin: {
    icon: ShieldCheck,
    title: 'Admin Portal',
    subtitle: 'Authorized infirmary personnel only. Sign in to manage queues, records, and appointments.',
    identifierLabel: 'Admin ID',
    identifierPlaceholder: 'Enter your admin ID',
    submitLabel: 'Access Admin Portal',
    loadingLabel: 'Verifying...',
    forgotLink: '/forgot-password',
    alternateLabel: 'Patient access',
    alternateTo: '/login/user',
    alternateText: 'Go to user sign in',
    tone: 'from-slate-900 via-slate-800 to-teal-900',
  },
};

export const LoginPage = ({ variant = 'user' }) => {
  const navigate = useNavigate();
  const { addSystemLog, setStoredAuthUser } = useApp();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  const copy = useMemo(() => pageCopy[variant] || pageCopy.user, [variant]);
  const Icon = copy.icon;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const result = await authService.login({ studentId: identifier, password });
      const userType = result?.user?.userType;
      const isAdmin = isAdminUserType(userType);

      if (variant === 'admin' && !isAdmin) {
        toast.error('This portal is for admin accounts only.');
        navigate('/login/user', { replace: true });
        return;
      }

      if (variant === 'user' && isAdmin) {
        toast.error('Admin accounts must sign in through the admin portal.');
        navigate('/login/admin', { replace: true });
        return;
      }

      if (result?.token) {
        localStorage.setItem('authToken', result.token);
      }
      if (result?.user) {
        setStoredAuthUser(result.user);
      }

      addSystemLog({
        type: isAdmin ? 'admin_login' : 'client_login',
        message: isAdmin ? 'Admin signed in to admin portal' : 'User signed in to client portal',
        metadata: { studentId: identifier || '(not provided)', userType: userType || 'unknown' },
      });

      toast.success(variant === 'admin' ? 'Admin access granted.' : 'Welcome back! You have signed in successfully.');
      navigate(isAdmin ? '/admin' : '/app');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Login failed:', err);
      const fallback = variant === 'admin'
        ? 'Login failed. Please check your admin credentials and try again.'
        : 'Login failed. Please check your credentials and try again.';
      const message = err.response?.data?.message || fallback;
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestSignIn = async () => {
    try {
      setGuestLoading(true);
      const result = await authService.createGuestSession();

      if (result?.token) {
        localStorage.setItem('authToken', result.token);
      }
      if (result?.user) {
        setStoredAuthUser(result.user);
      }

      addSystemLog({
        type: 'client_login',
        message: 'Guest signed in to client portal',
        metadata: { userType: 'guest', idNumber: result?.user?.idNumber || 'temporary guest' },
      });

      toast.success('Guest access is ready. Please complete the booking form.');
      navigate('/app/book');
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to start a guest session.';
      toast.error(message);
    } finally {
      setGuestLoading(false);
    }
  };

  if (variant === 'admin') {
    return (
      <div className="min-h-screen overflow-hidden bg-slate-950 text-white">
        <div className="relative isolate min-h-screen">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.22),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.18),_transparent_32%),linear-gradient(135deg,_#020617,_#0f172a_55%,_#082f49)]" />
          <div className="absolute inset-y-0 left-[8%] w-px bg-white/10 hidden lg:block" />
          <div className="absolute top-20 right-20 w-64 h-64 rounded-full border border-white/10 hidden lg:block" />
          <div className="absolute bottom-16 left-[44%] w-40 h-40 rounded-full bg-teal-400/10 blur-3xl" />

          <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-4 py-10 sm:px-6 lg:grid lg:grid-cols-[1.15fr_0.85fr] lg:gap-12 lg:px-10">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              className="hidden lg:flex flex-col justify-between rounded-[2.5rem] border border-white/10 bg-white/5 p-10 backdrop-blur-xl"
            >
              <div className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/10 p-2 shadow-xl shadow-black/20">
                    <img src={logoImg} alt="Infirmary system logo" className="h-full w-full object-contain" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black uppercase tracking-[0.24em] text-teal-200/80">Infirmary Connect</p>
                    <p className="text-sm font-medium text-slate-300">Administrative access panel</p>
                  </div>
                </div>
                <div className="inline-flex items-center gap-3 rounded-full border border-teal-400/20 bg-teal-400/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-teal-100">
                  <span className="h-2 w-2 rounded-full bg-teal-300" />
                  Secure Operations Access
                </div>
                <div className="space-y-5">
                  <h1 className="max-w-xl text-5xl font-black tracking-tight text-white">
                    Infirmary administration, separated from patient access.
                  </h1>
                  <p className="max-w-xl text-lg leading-relaxed text-slate-300">
                    This portal is reserved for administrators handling appointments, consultation logs, medical records, and on-site queue operations.
                  </p>
                </div>
              </div>

              <div className="grid gap-4">
                {[
                  'Review appointments and walk-in queues in one workspace.',
                  'Access medical records and consultation logs behind a dedicated admin entry.',
                  'Keep regular user sign-in isolated from staff operations.',
                ].map((item) => (
                  <div key={item} className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
                    <p className="text-sm font-medium leading-relaxed text-slate-200">{item}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto w-full max-w-xl lg:max-w-none"
            >
              <div className="rounded-[2rem] border border-white/10 bg-white/10 p-4 backdrop-blur-2xl sm:p-6">
                <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-black/30 sm:p-8">
                  <div className="mb-8 flex items-center justify-between gap-4">
                    <Link
                      to="/"
                      className="inline-flex items-center gap-2 text-sm font-bold text-slate-300 transition-colors hover:text-white"
                    >
                      <ArrowLeft size={16} />
                      Back to site
                    </Link>
                    <Link
                      to="/login/user"
                      className="text-sm font-bold text-teal-300 transition-colors hover:text-teal-200"
                    >
                      User sign in
                    </Link>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/10 p-2 shadow-xl shadow-black/20">
                        <img src={logoImg} alt="Infirmary system logo" className="h-full w-full object-contain" />
                      </div>
                      <div className={`inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br ${copy.tone} shadow-xl shadow-teal-950/40`}>
                        <Icon className="h-8 w-8" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-black uppercase tracking-[0.26em] text-teal-200/80">Infirmary Admin Portal</p>
                      <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{copy.title}</h2>
                      <p className="max-w-md text-sm font-medium leading-relaxed text-slate-300 sm:text-base">{copy.subtitle}</p>
                    </div>
                  </div>

                  <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
                    <div className="space-y-2">
                      <label className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">
                        {copy.identifierLabel}
                      </label>
                      <div className="group relative">
                        <IdCard className="absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-teal-300" />
                        <input
                          type="text"
                          required
                          value={identifier}
                          onChange={(e) => setIdentifier(e.target.value)}
                          className="min-h-[52px] w-full rounded-2xl border border-white/10 bg-white/5 py-4 pl-12 pr-4 text-base font-medium text-white placeholder:text-slate-500 focus:border-teal-300/60 focus:outline-none focus:ring-4 focus:ring-teal-300/10"
                          placeholder={copy.identifierPlaceholder}
                          autoComplete="username"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-300">Password</label>
                      <div className="group relative">
                        <Lock className="absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-teal-300" />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-300"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                        </button>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="min-h-[52px] w-full rounded-2xl border border-white/10 bg-white/5 py-4 pl-12 pr-12 text-base font-medium text-white placeholder:text-slate-500 focus:border-teal-300/60 focus:outline-none focus:ring-4 focus:ring-teal-300/10"
                          placeholder="Enter your password"
                          autoComplete="current-password"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1 text-sm">
                      <Link to={copy.forgotLink} className="font-bold text-slate-300 transition-colors hover:text-white">
                        Forgot password?
                      </Link>
                      <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                        Staff Only
                      </span>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="min-h-[54px] w-full rounded-2xl bg-gradient-to-r from-teal-400 via-cyan-400 to-sky-500 px-6 py-4 text-base font-black text-slate-950 shadow-xl shadow-cyan-950/30 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading ? copy.loadingLabel : copy.submitLabel}
                    </button>
                  </form>

                  <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                    Need the patient portal instead?{' '}
                    <Link to={copy.alternateTo} className="font-black text-teal-300 hover:text-teal-200">
                      {copy.alternateText}
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-6 py-8 sm:py-12 min-h-0 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/20 via-slate-50 to-primary/10 -z-10" />
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary/10 rounded-full blur-[100px] -z-10 hidden sm:block" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-primary/10 rounded-full blur-[100px] -z-10 hidden sm:block" />

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white/90 sm:bg-white/80 backdrop-blur-2xl p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-2xl border border-white w-full max-w-md space-y-6 sm:space-y-8 relative my-auto"
      >
        <div className="text-center space-y-2 sm:space-y-3">
          <div className={`bg-gradient-to-br ${copy.tone} w-14 h-14 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center text-white mx-auto mb-4 sm:mb-6 shadow-xl shadow-primary/30 transform -rotate-6`}>
            <Icon className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tighter">{copy.title}</h2>
          <p className="text-slate-500 font-medium text-sm sm:text-base">{copy.subtitle}</p>
        </div>

        <form className="space-y-4 sm:space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-600 uppercase tracking-[0.1em] ml-2">{copy.identifierLabel}</label>
            <div className="relative group">
              <IdCard className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors w-4 h-4 sm:w-[18px] sm:h-[18px]" />
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full pl-11 sm:pl-14 pr-4 sm:pr-6 py-3.5 sm:py-4 bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-base font-medium min-h-[48px]"
                placeholder={copy.identifierPlaceholder}
                autoComplete="username"
              />
            </div>
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
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 sm:pl-14 pr-11 sm:pr-14 py-3.5 sm:py-4 bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-base font-medium min-h-[48px]"
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <Link to={copy.forgotLink} className="text-xs font-black text-primary hover:underline py-2">Forgot Password?</Link>
            <Link to={copy.alternateTo} className="text-xs font-black text-slate-500 hover:text-primary transition-colors">
              {copy.alternateLabel}
            </Link>
          </div>
          <button
            type="submit"
            disabled={loading || guestLoading}
            className="w-full py-3.5 sm:py-4 bg-primary text-white font-black rounded-xl sm:rounded-2xl hover:bg-primary-hover transition-all shadow-xl shadow-primary/30 text-base sm:text-lg mt-1 disabled:opacity-60 disabled:cursor-not-allowed min-h-[48px]"
          >
            {loading ? copy.loadingLabel : copy.submitLabel}
          </button>
        </form>

        <div className="space-y-3">
          <div className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            Or
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <button
            type="button"
            onClick={handleGuestSignIn}
            disabled={loading || guestLoading}
            className="w-full py-3.5 sm:py-4 border border-slate-200 bg-slate-50 text-slate-800 font-black rounded-xl sm:rounded-2xl hover:border-primary/30 hover:bg-primary/5 transition-all text-sm sm:text-base disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {guestLoading ? 'Preparing guest access...' : 'Sign In as Guest'}
          </button>
          <p className="text-xs text-slate-500 text-center leading-relaxed">
            Guest access is limited to medical appointment booking and appointment viewing with a temporary ID or QR code.
          </p>
        </div>
      </motion.div>
    </div>
  );
};
