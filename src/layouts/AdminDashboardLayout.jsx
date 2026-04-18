import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Outlet, NavLink, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, ClipboardList, FolderOpen, LogOut, ScrollText, Menu, X, ListOrdered, Users, UserSquare2, Bell } from 'lucide-react';
import logoImg from '../assets/logo.jpg';
import toast from 'react-hot-toast';
import { useApp } from '../context/AppContext';
import { isSameDay, parseISO, compareAsc } from 'date-fns';

const navItemsBase = [
  { to: '/admin', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/appointments', end: false, label: 'Appointments', icon: CalendarDays },
  { to: '/admin/queues', end: false, label: 'Queues', icon: ListOrdered },
  { to: '/admin/records', end: false, label: 'Medical Records', icon: FolderOpen },
];
const navItemAccounts = { to: '/admin/accounts', end: false, label: 'Accounts', icon: Users };
const navItemUserControl = { to: '/admin/user-control', end: false, label: 'User Control', icon: UserSquare2 };
const navItemLogs = { to: '/admin/logs', end: false, label: 'System Logs', icon: ScrollText };

const getPageTitle = (pathname) => {
  const segment = pathname.replace('/admin', '').replace(/^\//, '') || 'dashboard';
  return segment.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
};

export const AdminDashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, fetchAllAppointments, appointments } = useApp();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const notificationRef = useRef(null);

  useEffect(() => {
    fetchAllAppointments();
  }, [fetchAllAppointments]);

  useEffect(() => {
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setIsNotificationOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const token = localStorage.getItem('authToken');
  if (!token) {
    return <Navigate to="/login/admin" replace />;
  }

  let userType = null;
  try {
    const stored = localStorage.getItem('authUser');
    userType = stored ? JSON.parse(stored).userType : null;
  } catch {
    userType = null;
  }
  const isAdmin = userType === 'admin' || userType === 'super_admin';
  const isSuperAdmin = userType === 'super_admin';
  if (!isAdmin) {
    toast.error('You are not authorized to access the admin dashboard.', { duration: 4000 });
    return <Navigate to="/app" replace />;
  }

  const navItems = isSuperAdmin ? [...navItemsBase, navItemAccounts, navItemUserControl, navItemLogs] : navItemsBase;
  const todayAppointments = useMemo(() => {
    const today = new Date();
    return [...appointments]
      .filter((appointment) => {
        try {
          return appointment?.date && isSameDay(parseISO(appointment.date), today);
        } catch {
          return false;
        }
      })
      .sort((a, b) => {
        try {
          return compareAsc(parseISO(a.date), parseISO(b.date));
        } catch {
          return 0;
        }
      });
  }, [appointments]);

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-x-hidden">
      {/* Mobile backdrop */}
      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col bg-slate-900 text-white transition-transform duration-300 ease-out
          w-56
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        <div className="p-4 sm:p-5 flex items-center gap-3 border-b border-white/10 shrink-0">
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/10 shrink-0 flex items-center justify-center">
            <img src={logoImg} alt="Infirmary" className="w-full h-full object-contain" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-black text-lg tracking-tight leading-none">Admin</span>
            <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mt-1">Portal</span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 mt-2 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => window.innerWidth < 768 && setIsSidebarOpen(false)}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                  isActive ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <item.icon size={20} className="shrink-0" />
              <span className="font-bold text-sm truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-white/10 shrink-0">
          <button
            onClick={() => {
              logout();
              navigate('/login/admin', { replace: true });
            }}
            className="w-full flex items-center gap-3 p-3 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-500 transition-all"
          >
            <LogOut size={20} className="shrink-0" />
            <span className="font-bold text-sm">Logout</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col md:pl-56">
        <header className="h-14 sm:h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center gap-4 sticky top-0 z-30 shrink-0">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-slate-50 rounded-lg text-slate-500 transition-colors md:hidden"
            aria-label={isSidebarOpen ? 'Close menu' : 'Open menu'}
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <h1 className="text-base sm:text-lg font-semibold text-slate-800 truncate">
            {getPageTitle(location.pathname)}
          </h1>
          <div className="ml-auto relative" ref={notificationRef}>
            <button
              type="button"
              onClick={() => setIsNotificationOpen((prev) => !prev)}
              className="relative p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
              aria-label="Today's appointment notifications"
            >
              <Bell size={18} />
              {todayAppointments.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                  {todayAppointments.length > 9 ? '9+' : todayAppointments.length}
                </span>
              )}
            </button>

            {isNotificationOpen && (
              <div className="absolute right-0 mt-2 w-[320px] max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                  <h3 className="text-sm font-black text-slate-800">Today's Appointments</h3>
                  <p className="text-[11px] text-slate-500 font-medium mt-1">
                    {todayAppointments.length > 0
                      ? `${todayAppointments.length} appointment${todayAppointments.length > 1 ? 's' : ''} scheduled today`
                      : 'No appointments scheduled for today'}
                  </p>
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {todayAppointments.length === 0 ? (
                    <div className="p-6 text-center text-sm text-slate-400 font-medium">
                      No appointment alerts for today.
                    </div>
                  ) : (
                    todayAppointments.map((appointment) => (
                      <button
                        key={appointment.id}
                        type="button"
                        onClick={() => {
                          setIsNotificationOpen(false);
                          navigate('/admin/appointments', {
                            state: { focusAppointmentId: appointment.id },
                          });
                        }}
                        className="w-full px-4 py-3 text-left border-b last:border-b-0 border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-black text-slate-800 truncate">{appointment.patientName || 'Anonymous'}</p>
                            <p className="text-[11px] text-slate-500 font-semibold mt-1">
                              {appointment.time} | {appointment.service}
                            </p>
                          </div>
                          <span className="text-[10px] font-black text-primary uppercase shrink-0">
                            {appointment.appointmentCode}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="p-4 sm:p-6 flex-1 min-h-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
