import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  CalendarDays,
  PlayCircle,
  CheckCircle,
  Ban,
  HeartPulse,
  ClipboardList,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useApp } from '../context/AppContext';
import { AppointmentList } from '../components/AppointmentList';
import { getAppointmentStatusLabel } from '../utils/appointmentStatus';

export const ClientDashboardPage = () => {
  const { userProfile, appointments, isGuestUser } = useApp();

  if (isGuestUser) {
    return <Navigate to="/app/book" replace />;
  }

  const stats = [
    { label: 'Total Visits', value: appointments.length, icon: CalendarDays, color: 'text-slate-800', bg: 'bg-slate-50' },
    { label: getAppointmentStatusLabel('Confirmed'), value: appointments.filter((a) => a.status === 'Confirmed').length, icon: PlayCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Completed', value: appointments.filter((a) => a.status === 'Completed').length, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: getAppointmentStatusLabel('Cancelled'), value: appointments.filter((a) => a.status === 'Cancelled').length, icon: Ban, color: 'text-slate-600', bg: 'bg-slate-100' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 sm:space-y-8"
    >
      <div className="bg-gradient-to-r from-primary to-primary-hover p-5 sm:p-8 md:p-10 rounded-2xl sm:rounded-[2.5rem] text-white shadow-2xl shadow-primary/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-[80px] -mr-32 -mt-32" />
        <div className="relative z-10 space-y-3 sm:space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 sm:px-4 sm:py-1.5 bg-white/20 backdrop-blur-md rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full animate-pulse" />
            {format(new Date(), 'MMMM d, yyyy')}
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight">Good day, {userProfile.name.split(' ')[0]}!</h2>
          <p className="text-white/80 text-sm sm:text-base md:text-lg font-medium max-w-md">
            Your health is our priority. Manage your appointments and stay updated with your medical records.
          </p>
          <div className="flex flex-wrap gap-3 sm:gap-4 pt-2 sm:pt-4">
            <Link
              to="/app/book"
              className="px-5 py-2.5 sm:px-6 sm:py-3 bg-white text-primary font-black rounded-xl hover:bg-slate-50 transition-all shadow-lg text-sm sm:text-base"
            >
              Book Now
            </Link>
            <Link
              to="/app/profile"
              className="px-5 py-2.5 sm:px-6 sm:py-3 bg-white/20 backdrop-blur-md border border-white/30 text-white font-bold rounded-xl hover:bg-white/30 transition-all text-sm sm:text-base"
            >
              View Profile
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-2 sm:mb-4">
              <div className={`p-2 sm:p-3 ${stat.bg} ${stat.color} rounded-xl sm:rounded-2xl group-hover:scale-110 transition-transform`}>
                <stat.icon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Stats</span>
            </div>
            <p className="text-xs sm:text-sm font-bold text-slate-500 mb-0.5 sm:mb-1 truncate">{stat.label}</p>
            <h3 className={`text-xl sm:text-3xl font-black ${stat.color}`}>{stat.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:gap-8">
        <div className="lg:col-span-2 bg-white p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-[2.5rem] border border-slate-100 shadow-sm min-w-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2 mb-4 sm:mb-8">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="p-2 bg-primary/10 text-primary rounded-xl shrink-0">
                <ClipboardList size={20} />
              </div>
              <h2 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight truncate">Recent Appointments</h2>
            </div>
            <Link to="/app/appointments" className="text-primary font-black text-sm hover:underline shrink-0">
              View All
            </Link>
          </div>
          <AppointmentList appointments={appointments.slice(0, 2)} isClient={true} user={userProfile} />
        </div>

        {/* <div className="space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <HeartPulse size={20} className="text-primary" />
              Health Tip of the Day
            </h3>
            <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100">
              <p className="text-emerald-800 font-medium leading-relaxed italic">
                "Stay hydrated! Drinking at least 8 glasses of water a day helps maintain your energy levels and keeps your skin glowing."
              </p>
            </div>
            <div className="space-y-4">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Upcoming Events</p>
              <div className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-colors cursor-pointer group">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center font-black">15</div>
                <div>
                  <p className="text-sm font-bold text-slate-800 group-hover:text-primary transition-colors">Blood Donation Drive</p>
                  <p className="text-xs text-slate-500">Main Hall • 09:00 AM</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-colors cursor-pointer group">
                <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center font-black">18</div>
                <div>
                  <p className="text-sm font-bold text-slate-800 group-hover:text-primary transition-colors">Mental Health Seminar</p>
                  <p className="text-xs text-slate-500">Room 302 • 02:00 PM</p>
                </div>
              </div>
            </div>
          </div>
        </div> */}
      </div>
    </motion.div>
  );
};
