import React, { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarPlus,
  CalendarDays,
  FolderOpen,
  LogOut,
  Menu,
  X,
  Bell,
  Search,
  User,
  ChevronDown,
} from 'lucide-react';
import logoImg from '../assets/logo.jpg';
import { AnimatePresence, motion } from 'motion/react';
import { useApp } from '../context/AppContext';
import { NotificationDropdown } from '../components/NotificationDropdown';
import { getProfileImageSrc, handleProfileImageError } from '../utils/profileImage';

const navItems = [
  { to: '/app', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/app/book', end: false, label: 'Book Appointment', icon: CalendarPlus },
  { to: '/app/appointments', end: false, label: 'My Appointments', icon: CalendarDays },
  { to: '/app/profile', end: false, label: 'My Profile', icon: User },
  { to: '/app/medical-records', end: false, label: 'My Medical Records', icon: FolderOpen },
];

const getPageTitle = (pathname) => {
  const segment = pathname.replace('/app', '').replace(/^\//, '') || 'dashboard';
  const labelMap = {
    'medical-records': 'My Medical Records',
  };

  if (labelMap[segment]) {
    return labelMap[segment];
  }

  return segment.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
};

const getUserTypeLabel = (userType) => {
  const map = {
    new: 'New Student',
    old: 'Old Student',
    employee: 'Employee',
    guest: 'Guest Access',
  };
  return map[userType] || (userType ? String(userType) : 'Patient');
};

export const ClientDashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    userProfile,
    isGuestUser,
    logout,
    notifications,
    notificationsUnreadCount,
    fetchAppointments,
    fetchNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
  } = useApp();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const notificationRef = useRef(null);
  const profileRef = useRef(null);

  // On mobile, close sidebar when route changes
  useEffect(() => {
    const handler = () => {
      if (window.innerWidth < 768) setIsSidebarOpen(false);
    };
    handler();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [location.pathname]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    const onFocus = () => fetchNotifications();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setIsNotificationOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const token = localStorage.getItem('authToken');
  if (!token) {
    return <Navigate to="/login/user" replace />;
  }

  if (isGuestUser && (location.pathname === '/app' || location.pathname === '/app/profile')) {
    return <Navigate to="/app/book" replace />;
  }

  const userTypeLabel = getUserTypeLabel(userProfile?.userType);
  const visibleNavItems = isGuestUser
    ? navItems.filter((item) => item.to === '/app/book' || item.to === '/app/appointments' || item.to === '/app/medical-records')
    : navItems;

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-x-hidden">
      {/* Mobile backdrop: close sidebar when tapping outside */}
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
          fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-slate-200 transition-all duration-300 ease-out
          w-64
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:relative md:left-0
          ${isSidebarOpen ? 'md:w-64' : 'md:w-20'}
        `}
      >
        <div className="p-4 sm:p-6 flex items-center gap-3 border-b border-slate-100 shrink-0">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center">
            <img src={logoImg} alt="Infirmary" className="w-full h-full object-contain" />
          </div>
          {isSidebarOpen && (
            <span className="font-bold text-lg sm:text-xl text-slate-800 tracking-tight truncate">Infirmary</span>
          )}
        </div>

        <nav className="flex-1 p-3 sm:p-4 space-y-1 sm:space-y-2 mt-2 sm:mt-4 overflow-y-auto">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => window.innerWidth < 768 && setIsSidebarOpen(false)}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 sm:gap-4 p-3 rounded-xl transition-all ${
                  isActive
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-primary'
                }`
              }
            >
              <item.icon size={20} className="shrink-0" />
              {isSidebarOpen && <span className="font-medium truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 sm:p-4 border-t border-slate-100 shrink-0">
          <button
            onClick={() => {
              logout();
              navigate('/login/user', { replace: true });
            }}
            className="w-full flex items-center gap-3 sm:gap-4 p-3 rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all"
          >
            <LogOut size={20} className="shrink-0" />
            {isSidebarOpen && <span className="font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 transition-all duration-300">
        <header className="h-14 sm:h-16 md:h-20 bg-white border-b border-slate-200 px-4 sm:px-6 md:px-8 flex items-center justify-between gap-2 sticky top-0 z-30">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-50 rounded-lg text-slate-500 transition-colors shrink-0"
              aria-label={isSidebarOpen ? 'Close menu' : 'Open menu'}
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <h1 className="text-base sm:text-lg md:text-xl font-semibold text-slate-800 truncate">
              {getPageTitle(location.pathname)}
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* <div className="hidden md:flex items-center bg-slate-50 border border-slate-200 rounded-full px-4 py-1.5 gap-2">
              <Search size={16} className="text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                className="bg-transparent border-none focus:outline-none text-sm w-40"
              />
            </div> */}

            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => {
                  setIsNotificationOpen(!isNotificationOpen);
                  setIsProfileOpen(false);
                }}
                className="relative p-2 text-slate-500 hover:bg-slate-50 rounded-full transition-colors"
                aria-label="Notifications"
              >
                <Bell size={20} />
                {notificationsUnreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold bg-red-500 text-white rounded-full border-2 border-white">
                    {notificationsUnreadCount > 99 ? '99+' : notificationsUnreadCount}
                  </span>
                )}
              </button>
              <AnimatePresence>
                {isNotificationOpen && (
                  <NotificationDropdown
                    notifications={notifications}
                    onClose={() => setIsNotificationOpen(false)}
                    onMarkAsRead={markNotificationAsRead}
                    onMarkAllAsRead={markAllNotificationsAsRead}
                  />
                )}
              </AnimatePresence>
            </div>

            <div className="relative pl-2 sm:pl-4 md:pl-6 border-l border-slate-200" ref={profileRef}>
              <button
                type="button"
                onClick={() => {
                  setIsProfileOpen(!isProfileOpen);
                  setIsNotificationOpen(false);
                }}
                className="flex items-center gap-2 sm:gap-3 cursor-pointer rounded-lg hover:bg-slate-50 p-1 -m-1 transition-colors"
                aria-label="Profile menu"
                aria-expanded={isProfileOpen}
              >
                <div className="text-right hidden sm:block max-w-[120px] md:max-w-none text-left">
                  <p className="text-sm font-semibold text-slate-800 truncate">{userProfile.name}</p>
                  <p className="text-xs text-slate-500">{userTypeLabel}</p>
                </div>
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 ring-2 ring-transparent group-hover:ring-primary/20">
                  <img
                    src={getProfileImageSrc(userProfile.pictureUrl)}
                    alt={userProfile.name}
                    className="w-full h-full rounded-full object-cover"
                    onError={handleProfileImageError}
                  />
                </div>
                <ChevronDown size={16} className={`hidden sm:block text-slate-400 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {isProfileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden"
                  >
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                      <p className="font-bold text-slate-800 truncate">{userProfile.name}</p>
                      {userProfile.email && (
                        <p className="text-xs text-slate-500 truncate mt-0.5">{userProfile.email}</p>
                      )}
          
                    </div>
                    <div className="p-2">
                      {!isGuestUser && (
                        <NavLink
                          to="/app/profile"
                          onClick={() => setIsProfileOpen(false)}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-700 hover:bg-slate-50 font-medium text-sm transition-colors"
                        >
                          <User size={18} className="text-slate-400 shrink-0" />
                          My Profile
                        </NavLink>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileOpen(false);
                          logout();
                          navigate('/login/user', { replace: true });
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-600 hover:bg-red-50 font-medium text-sm transition-colors"
                      >
                        <LogOut size={18} className="shrink-0" />
                        Logout
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <div className="p-4 sm:p-6 md:p-8 min-h-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
