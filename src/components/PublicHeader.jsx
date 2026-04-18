import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import logoImg from '../assets/logo.jpg';

export const PublicHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isUserLogin = location.pathname === '/login' || location.pathname === '/login/user';

  return (
    <nav className="bg-white/80 backdrop-blur-xl border-b border-primary/10 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
          <div className="w-11 h-11 rounded-2xl overflow-hidden bg-slate-100 group-hover:scale-105 transition-transform shadow-lg shrink-0 flex items-center justify-center">
            <img src={logoImg} alt="Infirmary" className="w-full h-full object-contain" />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-xl text-slate-800 tracking-tight leading-none">Infirmary</span>
            <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mt-1">Connect</span>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          {!isUserLogin && (
            <button onClick={() => navigate('/login/user')} className="px-6 py-2.5 text-slate-600 font-bold hover:text-primary transition-colors text-sm md:text-base">Login</button>
          )}
        </div>
      </div>
    </nav>
  );
};
