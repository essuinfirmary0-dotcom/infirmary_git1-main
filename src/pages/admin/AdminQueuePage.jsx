import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { queueService } from '../../services/queueService';
import {
  Users,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  IdCard,
  Building2,
  GraduationCap,
  Mail,
  RefreshCw,
  ClipboardList,
  FileText,
} from 'lucide-react';
import { addDays, format, isSameDay, isSameMonth, isSameWeek, isValid, parseISO } from 'date-fns';
import { resolveKioskReceiptProfile } from '../../utils/kioskReceiptIdentity';
import { safeFormat } from '../../utils/dateUtils';
import {
  getCompletedQueueEntries,
  getQueueDisplayRows,
  QUEUE_DISPLAY_STATUSES,
} from '../../utils/queueStatus';

const STATUS_OPTIONS = [
  { value: 'All', label: 'All Active' },
  { value: QUEUE_DISPLAY_STATUSES.CURRENTLY_SERVING, label: QUEUE_DISPLAY_STATUSES.CURRENTLY_SERVING },
  { value: QUEUE_DISPLAY_STATUSES.UP_NEXT, label: QUEUE_DISPLAY_STATUSES.UP_NEXT },
  { value: QUEUE_DISPLAY_STATUSES.IN_LINE, label: QUEUE_DISPLAY_STATUSES.IN_LINE },
];
const DATE_SCOPE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'all', label: 'All Dates' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'thisWeek', label: 'This Week' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'specific', label: 'Specific Date' },
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

const formatQueueScheduleDate = (queue) =>
  queue?.appointment?.date
    ? safeFormat(queue.appointment.date, 'MMM d, yyyy')
    : queue?.checkedInAt || queue?.createdAt
      ? safeFormat(queue.checkedInAt || queue.createdAt, 'MMM d, yyyy')
      : 'No date';

const formatQueueScheduleTime = (queue) =>
  queue?.appointment?.time ||
  (queue?.checkedInAt || queue?.createdAt
    ? safeFormat(queue.checkedInAt || queue.createdAt, 'p')
    : 'No time');

const toQueueDate = (queue) => {
  const rawValue = queue?.appointment?.date || queue?.checkedInAt || queue?.createdAt;
  if (!rawValue) return null;

  try {
    const parsed = parseISO(rawValue);
    if (isValid(parsed)) {
      return parsed;
    }
  } catch {
    // Fall through to native Date parsing.
  }

  const fallback = new Date(rawValue);
  return isValid(fallback) ? fallback : null;
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

const STATUS_TONE_CLASSES = {
  [QUEUE_DISPLAY_STATUSES.CURRENTLY_SERVING]: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  [QUEUE_DISPLAY_STATUSES.UP_NEXT]: 'border-amber-200 bg-amber-50 text-amber-700',
  [QUEUE_DISPLAY_STATUSES.IN_LINE]: 'border-blue-200 bg-blue-50 text-blue-700',
};

export const AdminQueuePage = () => {
  const navigate = useNavigate();
  const [queues, setQueues] = useState([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateScope, setDateScope] = useState('today');
  const [specificDate, setSpecificDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [expandedQueueId, setExpandedQueueId] = useState(null);

  const loadQueues = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadQueues();
  }, [loadQueues]);

  const syncQueueStatus = async (id, newStatus) => {
    try {
      setUpdatingId(id);
      const updatedQueue = await queueService.updateStatus(id, newStatus);
      await loadQueues();
      return updatedQueue;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to update queue status', err);
      return null;
    } finally {
      setUpdatingId(null);
    }
  };

  const { queueStats, filteredQueues } = useMemo(() => {
    const scopedQueues = queues.filter((queue) => matchesQueueDateScope(queue, dateScope, specificDate));
    const activeQueueRows = getQueueDisplayRows(scopedQueues);
    const completedCount = getCompletedQueueEntries(scopedQueues).length;
    const nextFilteredQueues =
      statusFilter === 'All'
        ? activeQueueRows
        : activeQueueRows.filter((queue) => queue.displayStatus === statusFilter);

    return {
      queueStats: [
        { label: 'All Queues', value: activeQueueRows.length, icon: Users, color: 'text-slate-700', bg: 'bg-slate-100' },
        {
          label: QUEUE_DISPLAY_STATUSES.CURRENTLY_SERVING,
          value: activeQueueRows.filter((queue) => queue.isCurrentServing).length,
          icon: CheckCircle,
          color: 'text-emerald-600',
          bg: 'bg-emerald-50',
        },
        { label: 'Completed', value: completedCount, icon: ClipboardList, color: 'text-violet-600', bg: 'bg-violet-50' },
      ],
      filteredQueues: nextFilteredQueues,
    };
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
    if (queue.status === 'Completed') {
      return;
    }

    if (queue.status === 'Serving') {
      openRecordEntry(queue);
      return;
    }

    const updatedQueue = await syncQueueStatus(queue.id, 'Serving');
    if (!updatedQueue) {
      return;
    }

    openRecordEntry({
      ...queue,
      status: updatedQueue.status || 'Serving',
    });
  };

  const toggleExpandedQueue = (queueId) => {
    setExpandedQueueId((currentQueueId) => (currentQueueId === queueId ? null : queueId));
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
            Review only successfully checked-in patients, expand a row for the full appointment details, and serve the next patient when ready.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-full text-[11px] font-semibold text-slate-600">
            <Users size={14} />
            <span>{filteredQueues.length} shown</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
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
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
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
              <RefreshCw size={12} />
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
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full border-separate border-spacing-0">
              <thead>
                <tr className="text-left">
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-slate-200">Queue Number</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-slate-200">Patient Name</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-slate-200">Service</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-slate-200">Schedule</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-slate-200">Status</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-slate-200 text-right">Action Button</th>
                </tr>
              </thead>
              <tbody>
                {filteredQueues.map((queue) => {
                  const patientProfile = resolveQueueReceiptProfile(queue);
                  const receiptIdentity = patientProfile.receiptIdentity;
                  const isExpanded = expandedQueueId === queue.id;
                  const actionLabel = queue.isCurrentServing ? 'Open Record' : 'Serve Patient';

                  return (
                    <React.Fragment key={queue.id}>
                      <tr
                        onClick={() => toggleExpandedQueue(queue.id)}
                        className="cursor-pointer hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="px-4 py-4 border-b border-slate-100 align-top">
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 text-slate-400">
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </span>
                            <div>
                              <p className="text-sm font-black text-slate-900">{queue.queueNumber || '-'}</p>
                              <p className="text-[11px] font-semibold text-slate-500">Click to expand details</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 border-b border-slate-100 align-top">
                          <div className="space-y-1">
                            <p className="text-sm font-black text-slate-900">
                              {queue.user?.name || queue.appointment?.patientName || 'Unknown patient'}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 font-semibold">
                              {receiptIdentity.value && (
                                <span className="inline-flex items-center gap-1">
                                  <IdCard size={12} />
                                  {receiptIdentity.value}
                                </span>
                              )}
                              {queue.appointment?.code && (
                                <span className="text-primary font-bold">{queue.appointment.code}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 border-b border-slate-100 align-top">
                          <p className="text-sm font-black text-slate-900">
                            {queue.appointment?.service || 'No service'}
                            {queue.appointment?.subcategory ? ` - ${queue.appointment.subcategory}` : ''}
                          </p>
                          <p className="text-[11px] font-semibold text-slate-500">
                            {queue.appointment?.purpose || 'No purpose provided'}
                          </p>
                        </td>
                        <td className="px-4 py-4 border-b border-slate-100 align-top">
                          <p className="text-sm font-black text-slate-900">{formatQueueScheduleDate(queue)}</p>
                          <p className="text-[11px] font-semibold text-slate-500">{formatQueueScheduleTime(queue)}</p>
                        </td>
                        <td className="px-4 py-4 border-b border-slate-100 align-top">
                          <span className={`inline-flex px-3 py-1 rounded-full border text-xs font-black ${STATUS_TONE_CLASSES[queue.displayStatus] || 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                            {queue.displayStatus}
                          </span>
                        </td>
                        <td className="px-4 py-4 border-b border-slate-100 align-top text-right">
                          <button
                            type="button"
                            disabled={updatingId === queue.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleServePatient(queue);
                            }}
                            className="inline-flex items-center justify-center px-3 py-2 rounded-lg border border-primary/20 bg-primary/5 text-primary text-[11px] font-black hover:bg-primary/10 transition-all disabled:opacity-60"
                          >
                            {updatingId === queue.id ? 'Updating...' : actionLabel}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="px-4 pb-4">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5 space-y-4">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.22em]">Expanded Appointment Details</p>
                                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                                    {queue.user?.name || queue.appointment?.patientName || 'Unknown patient'}
                                  </h3>
                                </div>
                                <span className={`inline-flex px-3 py-1 rounded-full border text-xs font-black ${STATUS_TONE_CLASSES[queue.displayStatus] || 'border-slate-200 bg-white text-slate-700'}`}>
                                  {queue.displayStatus}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                <div className="rounded-xl border border-slate-200 bg-white p-3">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] mb-1">Queue Number</p>
                                  <p className="text-sm font-black text-slate-900">{queue.queueNumber || 'No queue number'}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white p-3">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] mb-1">Appointment Number / Reference Number</p>
                                  <p className="text-sm font-black text-slate-900">{queue.appointment?.code || 'No reference number'}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white p-3">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] mb-1">Patient Name</p>
                                  <p className="text-sm font-black text-slate-900">{queue.user?.name || queue.appointment?.patientName || 'Unknown patient'}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white p-3">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] mb-1">
                                    {receiptIdentity.label || 'Student / Employee ID Number'}
                                  </p>
                                  <p className="text-sm font-black text-slate-900">{receiptIdentity.value || 'No ID recorded'}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white p-3">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] mb-1">College</p>
                                  <p className="text-sm font-black text-slate-900">{patientProfile.college || 'Not available'}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white p-3">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] mb-1">Department / Program</p>
                                  <p className="text-sm font-black text-slate-900">{patientProfile.program || patientProfile.guestType || 'Not available'}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white p-3">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] mb-1">Booked Service</p>
                                  <p className="text-sm font-black text-slate-900">
                                    {queue.appointment?.service || 'No service'}
                                    {queue.appointment?.subcategory ? ` - ${queue.appointment.subcategory}` : ''}
                                  </p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white p-3">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] mb-1">Purpose</p>
                                  <p className="text-sm font-black text-slate-900">{queue.appointment?.purpose || 'No purpose provided'}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white p-3">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] mb-1">Appointment Date</p>
                                  <p className="text-sm font-black text-slate-900">{formatQueueScheduleDate(queue)}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white p-3">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] mb-1">Appointment Time</p>
                                  <p className="text-sm font-black text-slate-900">{formatQueueScheduleTime(queue)}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white p-3">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] mb-1">Status</p>
                                  <p className="text-sm font-black text-slate-900">{queue.displayStatus}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white p-3">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] mb-1">Checked-In Time</p>
                                  <p className="text-sm font-black text-slate-900">
                                    {queue.checkedInAt ? safeFormat(queue.checkedInAt, 'MMM d, yyyy p') : 'No check-in timestamp'}
                                  </p>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                                <div className="rounded-xl border border-slate-200 bg-white p-3">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2 flex items-center gap-1.5">
                                    <Mail size={12} />
                                    Other Related Stored Appointment Details
                                  </p>
                                  <div className="space-y-2 text-sm">
                                    <p className="font-semibold text-slate-700">
                                      <span className="text-slate-400">Email:</span> {queue.user?.email || 'No email recorded'}
                                    </p>
                                    <p className="font-semibold text-slate-700">
                                      <span className="text-slate-400">Appointment Status:</span> {queue.appointment?.status || 'No appointment status'}
                                    </p>
                                    {patientProfile.showGuestType && (
                                      <p className="font-semibold text-slate-700">
                                        <span className="text-slate-400">Type of Guest:</span> {patientProfile.guestType}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white p-3">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2 flex items-center gap-1.5">
                                    <FileText size={12} />
                                    Notes
                                  </p>
                                  <p className="text-sm font-semibold text-slate-700 whitespace-pre-wrap">
                                    {queue.appointment?.notes || 'No additional appointment notes.'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
};
