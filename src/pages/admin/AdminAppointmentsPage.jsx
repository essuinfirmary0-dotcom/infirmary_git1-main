import React, { useEffect, useMemo, useState } from 'react';
import ReactCalendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { isSameDay, parseISO, addDays, isSameWeek, isSameMonth, compareAsc, compareDesc, startOfDay, isValid } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Trash2, CalendarDays, Clock, CheckCircle, XCircle, X, ClipboardList, Tag, FileText, User, Grid3x3, List, Building2, GraduationCap, IdCard } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { safeFormat } from '../../utils/dateUtils';
import { resolveKioskReceiptProfile } from '../../utils/kioskReceiptIdentity';
import { getAppointmentStatusLabel } from '../../utils/appointmentStatus';

const SORT_OPTIONS = [
  { value: 'oldest', label: 'Oldest First' },
  { value: 'newest', label: 'Newest First' },
];

const STATUS_FILTER_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'all', label: 'All' },
  { value: 'approved', label: 'Approved' },
  { value: 'confirmed', label: getAppointmentStatusLabel('Confirmed') },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: getAppointmentStatusLabel('Cancelled') },
];

const toDate = (value) => {
  if (!value) return null;
  try {
    const parsed = typeof value === 'string' ? parseISO(value) : new Date(value);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const normalizeCalendarDate = (value) => {
  const parsed = toDate(value);
  return parsed ? startOfDay(parsed) : startOfDay(new Date());
};

const getAppointmentStatusKey = (status) => {
  const normalized = String(status || '').trim();
  if (normalized === 'Completed') return 'completed';
  if (normalized === 'Cancelled') return 'cancelled';
  if (normalized === 'Confirmed') return 'confirmed';
  if (normalized === 'Approved') return 'approved';
  return 'other';
};

const matchesStatusFilter = (appointment, filterValue) => {
  const statusKey = getAppointmentStatusKey(appointment?.status);
  if (filterValue === 'all') return true;
  if (filterValue === 'active') return !['completed', 'cancelled'].includes(statusKey);
  return statusKey === filterValue;
};

const getStatusPriority = (status) => {
  const statusKey = getAppointmentStatusKey(status);
  if (statusKey === 'confirmed') return 0;
  if (statusKey === 'approved') return 1;
  if (statusKey === 'completed') return 2;
  if (statusKey === 'cancelled') return 3;
  return 4;
};

const matchesRelativeDateScope = (dateValue, scope) => {
  const date = toDate(dateValue);
  if (!date) return false;

  const today = new Date();
  const tomorrow = addDays(today, 1);

  if (scope === 'all') return true;
  if (scope === 'today') return isSameDay(date, today);
  if (scope === 'tomorrow') return isSameDay(date, tomorrow);
  if (scope === 'thisWeek') return isSameWeek(date, today, { weekStartsOn: 1 });
  if (scope === 'thisMonth') return isSameMonth(date, today);
  return true;
};

const APPOINTMENT_SESSION_SECTIONS = [
  { key: 'morning', label: 'Morning Session', alwaysVisible: true },
  { key: 'afternoon', label: 'Afternoon Session', alwaysVisible: true },
  { key: 'night', label: 'Temporary Night Session', alwaysVisible: false },
  { key: 'other', label: 'Other Schedule', alwaysVisible: false },
];

const parseClockToMinutes = (value) => {
  const match = String(value || '').trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2] || '0');
  const meridiem = String(match[3] || '').toUpperCase();
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === 'AM') {
      hours = hours === 12 ? 0 : hours;
    } else if (meridiem === 'PM') {
      hours = hours === 12 ? 12 : hours + 12;
    }
  }

  return (hours * 60) + minutes;
};

const getAppointmentSessionKey = (timeValue) => {
  const match = String(timeValue || '').trim().match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i);
  if (!match) return 'other';

  const startMinutes = parseClockToMinutes(match[1]);
  if (startMinutes == null) return 'other';
  if (startMinutes < 12 * 60) return 'morning';
  if (startMinutes < 18 * 60) return 'afternoon';
  return 'night';
};

const AppointmentDetailModal = ({ appointment, onClose }) => {
  if (!appointment) return null;
  const {
    receiptIdentity,
    showCollege,
    showProgram,
    showGuestType,
    college,
    program,
    guestType,
  } = resolveKioskReceiptProfile(appointment);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          className="w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-100 bg-slate-50">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">Appointment Details</h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">View the complete schedule information for this appointment.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X size={22} />
            </button>
          </div>

          <div className="p-5 sm:p-6 space-y-5">
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Patient</p>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-primary">
                      <User size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-800">{appointment.patientName || 'Anonymous'}</p>
                      <p className="text-xs text-slate-500">Review the complete patient and booking details below.</p>
                    </div>
                  </div>
                  {appointment.status && (
                    <span className="inline-flex px-3 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-black text-slate-700 whitespace-nowrap">
                      {getAppointmentStatusLabel(appointment.status)}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-200">
                  <div className="bg-white rounded-xl border border-slate-100 px-3 py-2.5">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Appointment Code</p>
                    <p className="text-sm font-black text-primary">{appointment.appointmentCode || 'No code'}</p>
                  </div>

                  {receiptIdentity.value && (
                    <div className="bg-white rounded-xl border border-slate-100 px-3 py-2.5">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                        <IdCard size={12} />
                        {receiptIdentity.label}
                      </p>
                      <p className="text-sm font-black text-slate-800">{receiptIdentity.value}</p>
                    </div>
                  )}

                  <div className="bg-white rounded-xl border border-slate-100 px-3 py-2.5">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                    <p className="text-sm font-black text-slate-800">{getAppointmentStatusLabel(appointment.status || 'Approved')}</p>
                  </div>
                </div>
              </div>
            </div>

            {(showCollege || showProgram || showGuestType) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {showCollege && (
                  <div className="bg-white rounded-2xl p-4 border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <Building2 size={12} />
                      College
                    </p>
                    <p className="text-sm font-black text-slate-800">{college}</p>
                  </div>
                )}

                {showProgram && (
                  <div className="bg-white rounded-2xl p-4 border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <GraduationCap size={12} />
                      Department / Program
                    </p>
                    <p className="text-sm font-black text-slate-800">{program}</p>
                  </div>
                )}

                {showGuestType && (
                  <div className="bg-white rounded-2xl p-4 border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <GraduationCap size={12} />
                      Type of Guest
                    </p>
                    <p className="text-sm font-black text-slate-800">{guestType}</p>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl p-4 border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <CalendarDays size={12} />
                  Schedule
                </p>
                <p className="text-sm font-black text-slate-800">{safeFormat(appointment.date, 'MMMM d, yyyy')}</p>
                <p className="text-sm text-slate-600 font-semibold mt-1">{appointment.time}</p>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Tag size={12} />
                  Service
                </p>
                <p className="text-sm font-black text-slate-800">
                  {appointment.service}
                  {appointment.subcategory ? ` - ${appointment.subcategory}` : ''}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                <ClipboardList size={12} />
                Purpose
              </p>
              <p className="text-sm font-semibold text-slate-700">{appointment.purpose || 'No purpose provided'}</p>
            </div>

            {appointment.notes && (
              <div className="bg-white rounded-2xl p-4 border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <FileText size={12} />
                  Notes
                </p>
                <p className="text-sm font-semibold text-slate-700">{appointment.notes}</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export const AdminAppointmentsPage = () => {
  const { appointments } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [filterService, setFilterService] = useState('All');
  const [statusFilter, setStatusFilter] = useState('active');
  const [appointmentSearchQuery, setAppointmentSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [sortOrder, setSortOrder] = useState('oldest');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [viewMode, setViewMode] = useState('list');

  const appointmentStats = useMemo(() => ([
    { label: 'All Appointments', value: appointments.length, icon: CalendarDays, color: 'text-slate-700', bg: 'bg-slate-100' },
    { label: 'Today', value: appointments.filter((apt) => matchesRelativeDateScope(apt.date, 'today')).length, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Tomorrow', value: appointments.filter((apt) => matchesRelativeDateScope(apt.date, 'tomorrow')).length, icon: CheckCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'This Week', value: appointments.filter((apt) => matchesRelativeDateScope(apt.date, 'thisWeek')).length, icon: CheckCircle, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'This Month', value: appointments.filter((apt) => matchesRelativeDateScope(apt.date, 'thisMonth')).length, icon: XCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ]), [appointments]);

  const filteredAppointments = useMemo(() => {
    return [...appointments]
      .filter((apt) => {
        const matchesService = filterService === 'All' || apt.service === filterService;
        const matchesStatus = matchesStatusFilter(apt, statusFilter);
        const matchesSearch =
          appointmentSearchQuery.trim() === '' ||
          (apt.patientName && apt.patientName.toLowerCase().includes(appointmentSearchQuery.toLowerCase())) ||
          (apt.appointmentCode && apt.appointmentCode.toLowerCase().includes(appointmentSearchQuery.toLowerCase()));
        const appointmentDate = toDate(apt.date);
        const matchesDate = appointmentDate ? isSameDay(appointmentDate, selectedDate) : false;

        return matchesService && matchesStatus && matchesSearch && matchesDate;
      })
      .sort((a, b) => {
        const statusComparison = getStatusPriority(a.status) - getStatusPriority(b.status);
        if (statusComparison !== 0) return statusComparison;

        const dateA = toDate(a.date);
        const dateB = toDate(b.date);
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        const dateComparison = sortOrder === 'oldest' ? compareAsc(dateA, dateB) : compareDesc(dateA, dateB);
        if (dateComparison !== 0) return dateComparison;

        const timeA = String(a.time || '');
        const timeB = String(b.time || '');
        return sortOrder === 'oldest' ? timeA.localeCompare(timeB) : timeB.localeCompare(timeA);
      });
  }, [appointments, filterService, statusFilter, appointmentSearchQuery, selectedDate, sortOrder]);

  const appointmentsBySession = useMemo(() => {
    const groupedAppointments = {
      morning: [],
      afternoon: [],
      night: [],
      other: [],
    };

    filteredAppointments.forEach((appointment) => {
      const sessionKey = getAppointmentSessionKey(appointment.time);
      if (!groupedAppointments[sessionKey]) {
        groupedAppointments.other.push(appointment);
        return;
      }

      groupedAppointments[sessionKey].push(appointment);
    });

    return groupedAppointments;
  }, [filteredAppointments]);

  const visibleSessionSections = useMemo(
    () =>
      APPOINTMENT_SESSION_SECTIONS.filter(
        (section) => section.alwaysVisible || (appointmentsBySession[section.key] || []).length > 0,
      ),
    [appointmentsBySession],
  );

  useEffect(() => {
    const focusId = location.state?.focusAppointmentId;
    if (!focusId) return;

    const target = appointments.find((apt) => apt.id === focusId);
    if (target) {
      setSelectedAppointment(target);
      setSelectedDate(normalizeCalendarDate(target.date));
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, appointments, navigate, location.pathname]);

  const resetFilters = () => {
    setFilterService('All');
    setStatusFilter('active');
    setAppointmentSearchQuery('');
    setSelectedDate(startOfDay(new Date()));
    setSortOrder('oldest');
  };

  const renderAppointmentCard = (appointment) => (
    <button
      key={appointment.id}
      type="button"
      onClick={() => setSelectedAppointment(appointment)}
      className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-4 group hover:bg-white hover:shadow-md transition-all text-left"
    >
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 bg-white rounded-xl flex flex-col items-center justify-center shadow-sm border border-slate-100 shrink-0">
          <span className="text-[8px] font-black text-primary uppercase">{safeFormat(appointment.date, 'MMM')}</span>
          <span className="text-sm font-black text-slate-800 leading-none">{safeFormat(appointment.date, 'dd')}</span>
        </div>
      </div>
      <div className="min-w-0">
        <h4 className="text-sm font-black text-slate-800 leading-tight truncate">{appointment.patientName || 'Anonymous'}</h4>
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span className="text-[10px] font-black text-primary uppercase">{appointment.appointmentCode}</span>
          <span className="text-[10px] text-slate-400">|</span>
          <span className="text-[10px] text-slate-500 font-bold">{appointment.time}</span>
          <span className="text-[10px] text-slate-400">|</span>
          <span className="text-[10px] text-slate-500 font-bold">{appointment.service}</span>
        </div>
        <p className="text-xs text-slate-600 font-semibold mt-2 truncate">
          {appointment.purpose || 'No purpose provided'}
        </p>
        {appointment.notes && (
          <p className="text-xs text-slate-500 mt-1 line-clamp-2 whitespace-pre-wrap">
            {appointment.notes}
          </p>
        )}
      </div>
    </button>
  );

  const renderAppointmentListRow = (appointment) => (
    <button
      key={appointment.id}
      type="button"
      onClick={() => setSelectedAppointment(appointment)}
      className="p-4 bg-slate-50 rounded-lg border border-slate-100 hover:bg-white hover:border-primary/20 hover:shadow-sm transition-all flex items-center justify-between gap-4 text-left w-full group"
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="w-10 h-10 bg-white rounded-lg flex flex-col items-center justify-center shadow-sm border border-slate-100 shrink-0">
          <span className="text-[7px] font-black text-primary uppercase">{safeFormat(appointment.date, 'MMM')}</span>
          <span className="text-xs font-black text-slate-800 leading-none">{safeFormat(appointment.date, 'dd')}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-black text-slate-800 truncate">{appointment.patientName || 'Anonymous'}</h4>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap text-[10px]">
            <span className="font-black text-primary uppercase">{appointment.appointmentCode}</span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-500 font-bold">{appointment.time}</span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-500 font-bold">{appointment.service}</span>
          </div>
          <p className="text-[11px] text-slate-600 font-semibold mt-1 truncate">
            {appointment.purpose || 'No purpose provided'}
          </p>
        </div>
      </div>
    </button>
  );

  return (
    <>
      <AppointmentDetailModal appointment={selectedAppointment} onClose={() => setSelectedAppointment(null)} />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 sm:space-y-5 min-w-0">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">Appointments</h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">Browse appointments by calendar date, then review each session for that day.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="relative group min-w-0 flex-1 sm:flex-initial sm:min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                <input
                  type="text"
                  placeholder="Search name or ticket..."
                  value={appointmentSearchQuery}
                  onChange={(e) => setAppointmentSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all font-medium text-slate-800 text-sm"
                />
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
                <button
                  onClick={() => setViewMode('card')}
                  className={`p-2 rounded transition-colors ${viewMode === 'card' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                  title="Card view"
                >
                  <Grid3x3 size={16} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded transition-colors ${viewMode === 'list' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                  title="List view"
                >
                  <List size={16} />
                </button>
              </div>
              <button
                onClick={resetFilters}
                className="flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition-all shadow-sm text-xs"
              >
                <Trash2 size={14} />
                Reset
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 sm:gap-4">
            {appointmentStats.map((stat) => (
              <div key={stat.label} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2.5 rounded-xl ${stat.bg} ${stat.color}`}>
                    <stat.icon size={18} />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</span>
                </div>
                <p className="text-xs font-bold text-slate-500">{stat.label}</p>
                <h3 className={`text-2xl font-black ${stat.color}`}>{stat.value}</h3>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 sm:p-4">
              <div className="mb-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Appointment Calendar</p>
                <p className="mt-1 text-xs text-slate-500 font-medium">Pick any past, current, or future date to view that day’s schedule.</p>
              </div>
              <ReactCalendar
                onChange={(nextValue) => {
                  const nextDate = Array.isArray(nextValue) ? nextValue[0] : nextValue;
                  if (!nextDate) {
                    return;
                  }

                  setSelectedDate(normalizeCalendarDate(nextDate));
                }}
                value={selectedDate}
                className="rounded-xl border-none w-full max-w-full"
              />
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Selected Date</p>
                <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-lg font-black text-slate-900">{safeFormat(selectedDate, 'EEEE, MMMM d, yyyy')}</p>
                    <p className="text-xs text-slate-500 font-medium">Appointments are grouped below by session for this selected day.</p>
                  </div>
                  <span className="inline-flex w-fit rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-widest text-slate-500 border border-slate-200">
                    {filteredAppointments.length} Found
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Order</label>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-primary transition-all font-bold text-slate-800 text-sm"
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-primary transition-all font-bold text-slate-800 text-sm"
                  >
                    {STATUS_FILTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Service</label>
                  <select
                    value={filterService}
                    onChange={(e) => setFilterService(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-primary transition-all font-bold text-slate-800 text-sm"
                  >
                    <option value="All">All Services</option>
                    <option value="Medical">Medical</option>
                    <option value="Dental">Dental</option>
                    <option value="Nutrition">Nutrition</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4 px-1 gap-3">
            <h2 className="text-sm font-black text-slate-800 tracking-tight">
              Appointments for {safeFormat(selectedDate, 'MMMM d, yyyy')}
            </h2>
            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-black uppercase tracking-widest">
              {filteredAppointments.length} Found
            </span>
          </div>
          {filteredAppointments.length === 0 ? (
            <div className="text-center py-32">
              <p className="text-slate-400 font-bold text-sm">No appointments found for the selected date.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {visibleSessionSections.map((section) => {
                const sessionAppointments = appointmentsBySession[section.key] || [];

                return (
                  <div key={section.key} className="rounded-2xl border border-slate-100 overflow-hidden">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
                      <div>
                        <h3 className="text-sm font-black text-slate-900">{section.label}</h3>
                        <p className="text-xs text-slate-500 font-medium">
                          {sessionAppointments.length > 0
                            ? `${sessionAppointments.length} appointment${sessionAppointments.length === 1 ? '' : 's'} scheduled`
                            : 'No appointments in this session.'}
                        </p>
                      </div>
                      <span className="rounded-full bg-white border border-slate-200 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-slate-500">
                        {sessionAppointments.length}
                      </span>
                    </div>

                    {sessionAppointments.length === 0 ? (
                      <div className="px-4 py-10 text-center text-sm font-semibold text-slate-400">
                        No appointments scheduled for the {section.label.toLowerCase()}.
                      </div>
                    ) : viewMode === 'card' ? (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
                        {sessionAppointments.map((appointment) => renderAppointmentCard(appointment))}
                      </div>
                    ) : (
                      <div className="space-y-2 p-3">
                        {sessionAppointments.map((appointment) => renderAppointmentListRow(appointment))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
};
