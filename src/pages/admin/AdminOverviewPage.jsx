import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  LayoutDashboard,
  CalendarDays,
  Clock,
  Clock3,
  CheckCircle,
  Ban,
  Activity,
  ListOrdered,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { queueService } from '../../services/queueService';

export const AdminOverviewPage = () => {
  const { appointments } = useApp();
  const [queues, setQueues] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        // Default: show today's queues
        const today = new Date().toISOString().slice(0, 10);
        const data = await queueService.list({ status: 'All', date: today });
        setQueues(data || []);
      } catch {
        setQueues([]);
      }
    };
    load();
  }, []);

  const waiting = queues.filter((q) => q.status === 'Waiting').length;
  const serving = queues.filter((q) => q.status === 'Serving').length;
  const completed = queues.filter((q) => q.status === 'Completed').length;

  const appointmentStats = [
    { label: 'Total Appointments', value: appointments.length, icon: CalendarDays, color: 'text-slate-600', bg: 'bg-slate-100' },
    { label: 'Approved', value: appointments.filter((a) => a.status === 'Approved').length, icon: Clock3, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Confirmed', value: appointments.filter((a) => a.status === 'Confirmed').length, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Completed', value: appointments.filter((a) => a.status === 'Completed').length, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Cancelled', value: appointments.filter((a) => a.status === 'Cancelled').length, icon: Ban, color: 'text-slate-600', bg: 'bg-slate-100' },
  ];

  const queueStats = [
    { label: 'Queues Today', value: queues.length, icon: ListOrdered, color: 'text-slate-700', bg: 'bg-slate-100' },
    { label: 'Waiting', value: waiting, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Being Served', value: serving, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Completed', value: completed, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 sm:space-y-8 min-w-0"
    >
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Admin Overview</h1>
        <p className="text-xs sm:text-sm text-slate-500 font-medium">Real-time summary of infirmary activities</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-6">
        {appointmentStats.map((stat, i) => (
          <div key={i} className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all min-w-0">
            <div className="flex items-center justify-between mb-2 sm:mb-4">
              <div className={`p-2 sm:p-3 ${stat.bg} ${stat.color} rounded-lg sm:rounded-xl`}>
                <stat.icon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Stats</span>
            </div>
            <p className="text-[10px] sm:text-xs font-bold text-slate-500 mb-0.5 sm:mb-1 truncate">{stat.label}</p>
            <h3 className={`text-xl sm:text-3xl font-black ${stat.color}`}>{stat.value}</h3>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 my-6 sm:my-7">
        <div className="flex-1 h-px bg-slate-200" />
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Queues</span>
        </div>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {queueStats.map((stat, i) => (
          <div key={i} className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all min-w-0">
            <div className="flex items-center justify-between mb-2 sm:mb-4">
              <div className={`p-2 sm:p-3 ${stat.bg} ${stat.color} rounded-lg sm:rounded-xl`}>
                <stat.icon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Stats</span>
            </div>
            <p className="text-[10px] sm:text-xs font-bold text-slate-500 mb-0.5 sm:mb-1 truncate">{stat.label}</p>
            <h3 className={`text-xl sm:text-3xl font-black ${stat.color}`}>{stat.value}</h3>
          </div>
        ))}
      </div>

      {/* <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-sm font-black text-slate-800 mb-6 flex items-center gap-2">
            <Activity size={16} className="text-primary" />
            Service Distribution
          </h3>
          <div className="space-y-4">
            {['Medical', 'Dental', 'Nutrition'].map((service) => {
              const count = appointments.filter((a) => a.service === service).length;
              const percentage = appointments.length > 0 ? (count / appointments.length) * 100 : 0;
              return (
                <div key={service} className="space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider">
                    <span className="text-slate-700">{service}</span>
                    <span className="text-primary">{count} Appts ({percentage.toFixed(0)}%)</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      className="h-full bg-primary"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-2xl shadow-xl space-y-6">
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <LayoutDashboard size={16} className="text-primary" />
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 gap-2">
            <Link
              to="/admin/appointments"
              className="w-full p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-left transition-all group block"
            >
              <p className="text-white text-[11px] font-bold group-hover:text-primary transition-colors">Manage All Appts</p>
              <p className="text-slate-500 text-[9px]">View and edit schedules</p>
            </Link>
            <Link
              to="/admin/consultation"
              className="w-full p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-left transition-all group block"
            >
              <p className="text-white text-[11px] font-bold group-hover:text-primary transition-colors">Record Vitals</p>
              <p className="text-slate-500 text-[9px]">New patient consultation</p>
            </Link>
            <Link
              to="/admin/records"
              className="w-full p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-left transition-all group block"
            >
              <p className="text-white text-[11px] font-bold group-hover:text-primary transition-colors">Medical Archive</p>
              <p className="text-slate-500 text-[9px]">Patient history lookup</p>
            </Link>
          </div>
        </div>
      </div> */}
    </motion.div>
  );
};
