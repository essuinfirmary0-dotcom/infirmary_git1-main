import React, { useState } from 'react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { Lock, Mail, ArrowRight, HeartPulse, ShieldCheck, Eye, EyeOff } from 'lucide-react';

export const AdminLogin = ({ onLogin, onBack }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Simple mock validation
    if (email === 'admin@university.edu' && password === 'admin123') {
      toast.success('Admin login successful. Welcome to the admin portal.', { duration: 4000 });
      onLogin();
    } else {
      toast.error('Invalid email or password. Please check your admin credentials.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-slate-900">
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/20 via-slate-900 to-primary/10 -z-10"></div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-8 rounded-[2.5rem] shadow-2xl w-full max-w-md space-y-8 relative"
      >
        <div className="text-center space-y-3">
          <div className="bg-slate-900 w-16 h-16 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-xl transform -rotate-6">
            <ShieldCheck size={32} />
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Admin Portal</h2>
          <p className="text-slate-500 font-medium">Authorized Personnel Only</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-600 uppercase tracking-[0.1em] ml-2">Admin Email</label>
            <div className="relative group">
              <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-base font-medium"
                placeholder="admin@university.edu"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-600 uppercase tracking-[0.1em] ml-2">Password</label>
            <div className="relative group">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
              <input 
                type={showPassword ? 'text' : 'password'} 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-14 pr-14 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-base font-medium"
                placeholder="••••••••"
              />
            </div>
          </div>
          <button type="submit" className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all shadow-xl text-lg mt-2">
            Login as Admin
          </button>
        </form>

        <div className="text-center pt-4">
          <button onClick={onBack} className="text-slate-500 font-bold hover:text-primary flex items-center gap-2 mx-auto transition-colors">
            <ArrowRight size={16} className="rotate-180" /> Back to Public Site
          </button>
        </div>
      </motion.div>
    </div>
  );
};
