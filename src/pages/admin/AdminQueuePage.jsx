import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { queueService } from '../../services/queueService';
import { Clock, Users, Filter, CheckCircle, Grid3x3, List, XCircle, IdCard, Building2, GraduationCap } from 'lucide-react';
import { addDays, compareAsc, format, isSameDay, isSameMonth, isSameWeek, parseISO } from 'date-fns';
import { resolveKioskReceiptProfile } from '../../utils/kioskReceiptIdentity';

const STATUS_OPTIONS = ['All', 'Waiting', 'Serving', 'Completed', 'Skipped'];
const DATE_SCOPE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'all', label: 'All Dates' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'thisWeek', label: 'This Week' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'specific', label: 'Specific Date' },
];

const STATUS_PRIORITY = {
  Serving: 0,
  Waiting: 1,
  Completed: 2,
  Skipped: 3,
};

const NOT_COMPLETED_REASONS = [
  'Late/Did not attend',
  'Missing requirements',
];

const resolveQueueReceiptProfile = (queue) =>
  resolveKioskReceiptProfile({
    userType: queue?.user?.userType,
    studentNumber: queue?.user?.studentNumber,
    employeeNumber: queue?.user?.employeeNumber,
    idNumber: queue?.user?.idNumber,
    college: queue?.user?.college,
    program: queue?.user?.program,
  });

const formatQueuePatientDate = (queue) =>
  queue?.appointment?.date
    ? new Date(queue.appointment.date).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })
    : queue?.createdAt
      ? new Date(queue.createdAt).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })
      : 'No date';

const formatQueuePatientShortDate = (queue) =>
  queue?.appointment?.date
    ? new Date(queue.appointment.date).toLocaleDateString([], { month: 'short', day: 'numeric' })
    : queue?.createdAt
      ? new Date(queue.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })
      : 'No date';

const formatQueuePatientTime = (queue) =>
  queue?.appointment?.time || (queue?.createdAt ? new Date(queue.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No time');

const toQueueDate = (queue) => {
  if (queue?.appointment?.date) {
    try {
      return parseISO(queue.appointment.date);
    } catch {
      return null;
    }
  }
  if (!queue?.createdAt) return null;
  try {
    return parseISO(queue.createdAt);
  } catch {
    return null;
  }
};

const compareQueueOrder = (a, b) => {
  const statusA = STATUS_PRIORITY[a.status] ?? 99;
  const statusB = STATUS_PRIORITY[b.status] ?? 99;
  if (statusA !== statusB) return statusA - statusB;

  // Order by kiosk check-in time (createdAt) - who scanned first
  const createdAtA = toQueueDate(a);
  const createdAtB = toQueueDate(b);
  if (createdAtA && createdAtB) return compareAsc(createdAtA, createdAtB);

  return 0;
};

const matchesQueueDateScope = (queue, scope, specificDate) => {
  const queueDate = toQueueDate(queue);
  if (!queueDate) return false;

  const today = new Date();
  const tomorrow = addDays(today, 1);

  if (scope === 'today') return isSameDay(queueDate, today);
  if (scope === 'tomorrow') return isSameDay(queueDate, tomorrow);
  if (scope === 'thisWeek') return isSameWeek(queueDate, today, { weekStartsOn: 1 });
  if (scope === 'thisMonth') return isSameMonth(queueDate, today);
  if (scope === 'specific') return specificDate ? format(queueDate, 'yyyy-MM-dd') === specificDate : true;
  return true;
};

export const AdminQueuePage = () => {
  const navigate = useNavigate();
  const [queues, setQueues] = useState([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateScope, setDateScope] = useState('today');
  const [specificDate, setSpecificDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [viewMode, setViewMode] = useState('card');

  const loadQueues = async () => {
    setLoading(true);
    try {
      const data = await queueService.list({ status: 'All' });
      setQueues(data || []);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to load queues', err);
      setQueues([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueues();
  }, []);

  const syncQueueStatus = async (id, newStatus, reason = '') => {
    try {
      setUpdatingId(id);
      const updatedQueue = await queueService.updateStatus(id, newStatus, reason);
      setQueues((prev) =>
        prev.map((q) => (q.id === id ? { ...q, status: updatedQueue?.status || newStatus } : q))
      );
      return updatedQueue;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to update queue status', err);
      return null;
    } finally {
      setUpdatingId(null);
    }
  };

  const queueStats = useMemo(() => ([
    { label: 'All Queues', value: queues.length, icon: Users, color: 'text-slate-700', bg: 'bg-slate-100' },
    { label: 'Waiting', value: queues.filter((queue) => queue.status === 'Waiting').length, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Being Served', value: queues.filter((queue) => queue.status === 'Serving').length, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Completed', value: queues.filter((queue) => queue.status === 'Completed').length, icon: CheckCircle, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'Skipped', value: queues.filter((queue) => queue.status === 'Skipped').length, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
  ]), [queues]);

  const filteredQueues = useMemo(() => {
    const seen = new Set();
    return [...queues]
      .filter((queue) => {
        const isDuplicate = seen.has(queue.id);
        if (!isDuplicate) seen.add(queue.id);
        return !isDuplicate;
      })
      .filter((queue) => {
        const matchesStatus = statusFilter === 'All' || queue.status === statusFilter;
        const matchesDate = matchesQueueDateScope(queue, dateScope, specificDate);
        return matchesStatus && matchesDate;
      })
      .sort((a, b) => compareQueueOrder(a, b));
  }, [queues, statusFilter, dateScope, specificDate]);

  const openRecordEntry = (queue) => {
    sessionStorage.setItem(
      'adminActiveRecordContext',
      JSON.stringify({
        queueId: queue.id,
        queueNumber: queue.queueNumber || '',
        status: queue.status,
        user: queue.user || null,
        appointment: queue.appointment || null,
      }),
    );

    navigate('/admin/records', {
      state: {
        queueContext: {
          queueId: queue.id,
          queueNumber: queue.queueNumber || '',
          status: queue.status,
          user: queue.user || null,
          appointment: queue.appointment || null,
        },
      },
    });
  };

  const handleServePatient = async (queue) => {
    if (queue.status === 'Completed' || queue.status === 'Skipped') {
      return;
    }

    const activeQueue =
      queue.status === 'Serving'
        ? queue
        : {
            ...queue,
            status: (await syncQueueStatus(queue.id, 'Serving'))?.status || 'Serving',
          };

    openRecordEntry(activeQueue);
  };

  const handleSkipPatient = async (queue) => {
    const reasonInput = window.prompt(
      `Select not-completed reason:\n1) ${NOT_COMPLETED_REASONS[0]}\n2) ${NOT_COMPLETED_REASONS[1]}\n\nType 1 or 2:`,
      '1',
    );
    if (reasonInput == null) return;
    const normalized = reasonInput.trim();
    const reason =
      normalized === '2'
        ? NOT_COMPLETED_REASONS[1]
        : normalized === '1'
          ? NOT_COMPLETED_REASONS[0]
          : '';
    if (!reason) {
      window.alert('Skipping requires a valid reason (1 or 2).');
      return;
    }
    await syncQueueStatus(queue.id, 'Skipped', reason);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 sm:space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
            Queue Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Live queue based on kiosk check-in order. Filter by status when needed.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-full text-[11px] font-semibold text-slate-600">
            <Users size={14} />
            <span>{filteredQueues.length} shown</span>
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
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 sm:gap-4">
        {queueStats.map((stat) => (
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

      <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 items-end">
          <div className="space-y-1">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
              Date View
            </label>
            <select
              value={dateScope}
              onChange={(e) => setDateScope(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary w-full"
            >
              {DATE_SCOPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
              Specific Date
            </label>
            <input
              type="date"
              value={specificDate}
              onChange={(e) => {
                setSpecificDate(e.target.value);
                if (e.target.value) setDateScope('specific');
              }}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary w-full"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
              Filter by Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary w-full"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s === 'Serving' ? 'Being Served' : s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={loadQueues}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-700 hover:bg-slate-50"
            >
              <Filter size={12} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-sm">
        {loading ? (
          <div className="py-10 text-center text-xs text-slate-500 font-semibold">
            Loading queues...
          </div>
        ) : filteredQueues.length === 0 ? (
          <div className="py-32 text-center text-xs text-slate-400 font-semibold">
            No queues found for the selected filters.
          </div>
        ) : viewMode === 'card' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {filteredQueues.map((q) => {
              const patientProfile = resolveQueueReceiptProfile(q);
              const receiptIdentity = patientProfile.receiptIdentity;

              return (
                <div
                  key={q.id}
                  onClick={() => handleServePatient(q)}
                  className="p-4 rounded-xl border border-slate-100 bg-slate-50/80 flex flex-col gap-3 hover:bg-white hover:border-primary/20 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em]">
                        {filteredQueues[0]?.id === q.id ? 'Up Next' : 'Queue'}
                      </p>
                      <p className="text-lg font-black text-slate-900">{q.queueNumber || '-'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em]">Status</p>
                      <p className="text-sm font-black text-slate-800">{q.status === 'Serving' ? 'Being Served' : q.status}</p>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-100 rounded-xl p-3 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900">
                          {q.user?.name || 'Unknown patient'}
                        </p>
                        {q.appointment?.code && (
                          <p className="text-[11px] font-bold text-primary mt-1">
                            {q.appointment.code}
                          </p>
                        )}
                      </div>
                      {receiptIdentity.value && (
                        <div className="text-right shrink-0">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                            {receiptIdentity.label}
                          </p>
                          <p className="text-xs font-black text-slate-800">{receiptIdentity.value}</p>
                        </div>
                      )}
                    </div>

                    {(patientProfile.showCollege || patientProfile.showProgram || patientProfile.showGuestType) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 border-t border-slate-100">
                        {patientProfile.showCollege && (
                          <div className="flex items-start gap-2 text-xs text-slate-700">
                            <Building2 size={14} className="text-primary shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">College</p>
                              <p className="font-semibold text-slate-800">{patientProfile.college}</p>
                            </div>
                          </div>
                        )}
                        {patientProfile.showProgram && (
                          <div className="flex items-start gap-2 text-xs text-slate-700">
                            <GraduationCap size={14} className="text-primary shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Department / Program</p>
                              <p className="font-semibold text-slate-800">{patientProfile.program}</p>
                            </div>
                          </div>
                        )}
                        {patientProfile.showGuestType && (
                          <div className="flex items-start gap-2 text-xs text-slate-700">
                            <GraduationCap size={14} className="text-primary shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Type of Guest</p>
                              <p className="font-semibold text-slate-800">{patientProfile.guestType}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em]">When To Take Patient</p>
                        <p className="text-sm font-black text-slate-800">{formatQueuePatientDate(q)}</p>
                        <p className="text-sm font-semibold text-slate-600">{formatQueuePatientTime(q)}</p>
                      </div>
                      {q.appointment?.service && (
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em]">Booked Service</p>
                          <p className="text-sm font-black text-slate-800">
                            {q.appointment.service}
                            {q.appointment.subcategory ? ` - ${q.appointment.subcategory}` : ''}
                          </p>
                        </div>
                      )}
                    </div>

                    {q.appointment?.purpose && (
                      <div className="pt-3 border-t border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em]">Purpose</p>
                        <p className="text-sm font-semibold text-slate-700">{q.appointment.purpose}</p>
                      </div>
                    )}

                    {q.appointment?.notes && (
                      <div className="pt-3 border-t border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em]">Notes</p>
                        <p className="text-sm font-semibold text-slate-700 whitespace-pre-wrap">{q.appointment.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={updatingId === q.id || q.status === 'Completed' || q.status === 'Skipped'}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleServePatient(q);
                      }}
                      className="flex-1 py-2.5 rounded-xl border border-primary/20 bg-primary/5 text-primary text-xs font-black uppercase tracking-[0.16em] hover:bg-primary/10 transition-all disabled:opacity-60"
                    >
                      {q.status === 'Serving' ? 'Record Service Result' : 'Serve Patient'}
                    </button>
                    <button
                      type="button"
                      disabled={updatingId === q.id || q.status === 'Completed' || q.status === 'Skipped'}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSkipPatient(q);
                      }}
                      className="px-3 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 text-[11px] font-black uppercase tracking-[0.14em] hover:bg-red-100 transition-all disabled:opacity-40"
                    >
                      Skip Patient
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredQueues.map((q) => {
              const patientProfile = resolveQueueReceiptProfile(q);
              const receiptIdentity = patientProfile.receiptIdentity;

              return (
                <div
                  key={q.id}
                  onClick={() => handleServePatient(q)}
                  className="p-4 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-primary/20 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="min-w-fit">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em]">
                          {filteredQueues[0]?.id === q.id ? 'Up Next' : 'Queue'}
                        </p>
                        <p className="text-xl font-black text-slate-900">{q.queueNumber || '-'}</p>
                      </div>
                      <div className="flex-1 border-l border-slate-200 pl-4 min-w-0">
                        <p className="text-sm font-black text-slate-900">
                          {q.user?.name || 'Unknown patient'}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs font-semibold text-slate-500">
                          {receiptIdentity.value && (
                            <span className="inline-flex items-center gap-1">
                              <IdCard size={12} />
                              {receiptIdentity.label} {receiptIdentity.value}
                            </span>
                          )}
                          {q.appointment?.code && (
                            <span className="text-primary font-bold">{q.appointment.code}</span>
                          )}
                        </div>
                        {(patientProfile.showCollege || patientProfile.showProgram || patientProfile.showGuestType) && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-600">
                            {patientProfile.showCollege && (
                              <span className="inline-flex items-center gap-1">
                                <Building2 size={12} />
                                {patientProfile.college}
                              </span>
                            )}
                            {patientProfile.showProgram && (
                              <span className="inline-flex items-center gap-1">
                                <GraduationCap size={12} />
                                {patientProfile.program}
                              </span>
                            )}
                            {patientProfile.showGuestType && (
                              <span className="inline-flex items-center gap-1">
                                <GraduationCap size={12} />
                                {patientProfile.guestType}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="hidden sm:block border-l border-slate-200 pl-4 min-w-fit">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em]">When To Take Patient</p>
                        <p className="text-sm font-black text-slate-800">
                          {formatQueuePatientShortDate(q)}
                        </p>
                        <p className="text-xs font-semibold text-slate-600">
                          {formatQueuePatientTime(q)}
                        </p>
                      </div>
                      <div className="hidden lg:block border-l border-slate-200 pl-4 min-w-fit max-w-65">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em]">Booked Details</p>
                        <p className="text-sm font-black text-slate-800">
                          {q.appointment?.service || 'No service'}
                          {q.appointment?.subcategory ? ` - ${q.appointment.subcategory}` : ''}
                        </p>
                        <p className="text-xs font-semibold text-slate-600 mt-1">
                          {q.appointment?.purpose || 'No purpose provided'}
                        </p>
                        {q.appointment?.notes && (
                          <p className="text-xs text-slate-500 font-medium mt-1 line-clamp-2 whitespace-pre-wrap">
                            {q.appointment.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 min-w-fit">
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em]">Status</p>
                        <p className="text-sm font-black text-slate-800">{q.status === 'Serving' ? 'Being Served' : q.status}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={updatingId === q.id || q.status === 'Completed' || q.status === 'Skipped'}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleServePatient(q);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-primary/20 bg-primary/5 text-primary text-[11px] font-black hover:bg-primary/10 transition-all disabled:opacity-60"
                        >
                          {q.status === 'Serving' ? 'Record Result' : 'Serve Patient'}
                        </button>
                        <button
                          type="button"
                          disabled={updatingId === q.id || q.status === 'Completed' || q.status === 'Skipped'}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSkipPatient(q);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 text-[11px] font-black hover:bg-red-100 transition-all disabled:opacity-40"
                        >
                          Skip Patient
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
};
