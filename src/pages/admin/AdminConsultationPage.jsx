import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserSearch, Search, Activity, User, Save, History, ClipboardList, ChevronRight, Info, CalendarDays, RefreshCw, Clock } from 'lucide-react';
import { addDays, compareAsc, compareDesc, isSameDay, isSameMonth, isSameWeek, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { useApp } from '../../context/AppContext';
import { consultationService } from '../../services/consultationService';

const toastStyle = {
  borderRadius: '12px',
  background: '#0f172a',
  color: '#fff',
  fontWeight: 'bold',
  fontSize: '12px',
};

const DATE_SCOPE_OPTIONS = [
  { value: 'all', label: 'All Dates' },
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'thisWeek', label: 'This Week' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'specific', label: 'Specific Date' },
];

const toRecordedDate = (value) => {
  if (!value) return null;
  try {
    return parseISO(value);
  } catch {
    return null;
  }
};

const matchesLogDateScope = (recordedAt, scope, specificDate) => {
  const date = toRecordedDate(recordedAt);
  if (!date) return false;

  const today = new Date();
  const tomorrow = addDays(today, 1);
  if (scope === 'today') return isSameDay(date, today);
  if (scope === 'tomorrow') return isSameDay(date, tomorrow);
  if (scope === 'thisWeek') return isSameWeek(date, today, { weekStartsOn: 1 });
  if (scope === 'thisMonth') return isSameMonth(date, today);
  if (scope === 'specific') return specificDate ? recordedAt?.slice(0, 10) === specificDate : true;
  return true;
};

export const AdminConsultationPage = () => {
  const {
    consultationPatients,
    consultationLogsByUser,
    consultationLoading,
    fetchConsultationLogsForUser,
    handleSaveBP,
  } = useApp();
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [allLogs, setAllLogs] = useState([]);
  const [allLogsLoading, setAllLogsLoading] = useState(false);
  const [dateScope, setDateScope] = useState('all');
  const [specificDate, setSpecificDate] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');

  const loadAllLogs = useCallback(async () => {
    if (!consultationPatients?.length) {
      setAllLogs([]);
      return;
    }

    setAllLogsLoading(true);
    try {
      const logsPerPatient = await Promise.all(
        consultationPatients.map(async (patient) => {
          try {
            const logs = await consultationService.getLogsByUserId(patient.id);
            return (logs || []).map((log) => ({
              ...log,
              patientName: patient.name,
              patientEmail: patient.email,
              studentNumber: patient.studentNumber || null,
              employeeNumber: patient.employeeNumber || null,
            }));
          } catch {
            return [];
          }
        }),
      );

      setAllLogs(logsPerPatient.flat());
    } finally {
      setAllLogsLoading(false);
    }
  }, [consultationPatients]);

  const searchedUsers = useMemo(() => {
    const q = patientSearchQuery.trim().toLowerCase();
    if (!q) return [];
    return (consultationPatients || []).filter((user) => {
      const inName = user.name?.toLowerCase().includes(q);
      const inEmail = user.email?.toLowerCase().includes(q);
      const inStudent = user.studentNumber?.toLowerCase().includes(q);
      const inEmployee = user.employeeNumber?.toLowerCase().includes(q);
      return inName || inEmail || inStudent || inEmployee;
    });
  }, [patientSearchQuery, consultationPatients]);

  const filteredLogs = useMemo(() => {
    const q = logSearchQuery.trim().toLowerCase();
    return [...allLogs]
      .filter((record) => {
        const matchesDate = matchesLogDateScope(record.recordedAt, dateScope, specificDate);
        const matchesSearch =
          q === '' ||
          record.patientName?.toLowerCase().includes(q) ||
          record.patientEmail?.toLowerCase().includes(q) ||
          record.studentNumber?.toLowerCase().includes(q) ||
          record.employeeNumber?.toLowerCase().includes(q);
        return matchesDate && matchesSearch;
      })
      .sort((a, b) => {
        const dateA = toRecordedDate(a.recordedAt);
        const dateB = toRecordedDate(b.recordedAt);
        return sortOrder === 'oldest' ? compareAsc(dateA, dateB) : compareDesc(dateA, dateB);
      });
  }, [allLogs, dateScope, specificDate, logSearchQuery, sortOrder]);

  const consultationStats = useMemo(() => ([
    { label: 'All Logs', value: allLogs.length, icon: ClipboardList, color: 'text-slate-700', bg: 'bg-slate-100' },
    { label: 'Today', value: allLogs.filter((log) => matchesLogDateScope(log.recordedAt, 'today')).length, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Tomorrow', value: allLogs.filter((log) => matchesLogDateScope(log.recordedAt, 'tomorrow')).length, icon: CalendarDays, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'This Week', value: allLogs.filter((log) => matchesLogDateScope(log.recordedAt, 'thisWeek')).length, icon: Activity, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'This Month', value: allLogs.filter((log) => matchesLogDateScope(log.recordedAt, 'thisMonth')).length, icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ]), [allLogs]);

  useEffect(() => {
    if (!selectedUser) return;
    fetchConsultationLogsForUser(selectedUser.id);
  }, [selectedUser, fetchConsultationLogsForUser]);

  useEffect(() => {
    loadAllLogs();
  }, [loadAllLogs]);

  const handleSave = async () => {
    if (!selectedUser || !systolic || !diastolic) return;
    setIsSaving(true);
    try {
      await handleSaveBP(selectedUser.id, {
        systolic: Number(systolic),
        diastolic: Number(diastolic),
        notes: '',
      });
      await loadAllLogs();
      setSystolic('');
      setDiastolic('');
      toast.success('BP Record saved successfully!', { style: toastStyle });
    } catch (err) {
      const message = err?.response?.data?.message || 'Failed to save BP record.';
      toast.error(message, { style: toastStyle });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 sm:space-y-6 min-w-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Consultation Logs</h1>
        <p className="text-xs sm:text-sm text-slate-500 font-medium">Display all consultation logs first, then sort by date or search for a patient when needed.</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 sm:gap-4">
        {consultationStats.map((stat) => (
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

      <div className="bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-800">All Consultation Entries</h2>
            <p className="text-xs text-slate-500 font-medium">Use the date view or pick one exact date to inspect records.</p>
          </div>
          <button
            type="button"
            onClick={loadAllLogs}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={14} />
            Refresh Logs
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Search Logs</label>
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={16} />
              <input
                type="text"
                placeholder="Search patient..."
                value={logSearchQuery}
                onChange={(e) => setLogSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm font-medium"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date View</label>
            <select
              value={dateScope}
              onChange={(e) => setDateScope(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-primary transition-all font-bold text-slate-800 text-sm"
            >
              {DATE_SCOPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Specific Date</label>
            <input
              type="date"
              value={specificDate}
              onChange={(e) => {
                setSpecificDate(e.target.value);
                if (e.target.value) setDateScope('specific');
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-primary transition-all font-bold text-slate-800 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Order</label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-primary transition-all font-bold text-slate-800 text-sm"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>

        <div className="bg-slate-50 rounded-2xl border border-slate-100 p-3 sm:p-4">
          {allLogsLoading ? (
            <div className="text-center py-8 text-sm font-bold text-slate-400">Loading consultation logs...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-sm font-bold text-slate-400">No consultation logs match the current filters.</div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((record) => (
                <div key={record.id} className="bg-white border border-slate-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-black text-slate-800">{record.patientName || 'Unknown patient'}</p>
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-1 rounded-full">
                        {record.systolic}/{record.diastolic}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      {record.patientEmail || 'No email'}
                    </p>
                    {(record.studentNumber || record.employeeNumber) && (
                      <p className="text-[11px] text-slate-400 font-semibold mt-1">
                        {record.studentNumber || record.employeeNumber}
                      </p>
                    )}
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <p className="text-xs font-black text-slate-700">
                      {record.recordedAt ? new Date(record.recordedAt).toLocaleString() : ''}
                    </p>
                    <p className="text-[11px] text-slate-400 font-semibold mt-1">
                      Consultation entry
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-100 shadow-sm space-y-4 sm:space-y-5 min-w-0">
          <div className="space-y-3">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <UserSearch size={20} className="text-primary" />
              Search Patient
            </h3>
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={patientSearchQuery}
                onChange={(e) => setPatientSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm font-medium"
              />
            </div>
          </div>
          <div className="space-y-2">
            {searchedUsers.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Search Results</p>
                {searchedUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUser(user)}
                    className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between group ${
                      selectedUser?.id === user.id ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-slate-100 hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-white transition-all">
                        <User size={20} />
                      </div>
                      <div>
                        <p className="font-black text-slate-800 text-sm">{user.name}</p>
                        <p className="text-xs text-slate-500 font-medium">{user.email}</p>
                        {(user.studentNumber || user.employeeNumber) && (
                          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                            {user.studentNumber || user.employeeNumber}
                          </p>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-slate-300 group-hover:text-primary transition-all" />
                  </button>
                ))}
              </div>
            ) : patientSearchQuery.trim() !== '' ? (
              <div className="text-center py-6 text-slate-400 font-bold text-sm">No patients found.</div>
            ) : (
              <div className="text-center py-6 text-slate-400 font-bold text-sm">Start typing to search for a patient.</div>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {selectedUser ? (
            <motion.div
              key="log-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                  <Activity size={20} className="text-primary" />
                  Vitals Entry
                </h3>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="text-xs font-black text-slate-400 hover:text-red-500 transition-colors uppercase tracking-widest"
                >
                  Cancel
                </button>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm">
                    <User size={24} />
                  </div>
                  <div>
                    <p className="text-base font-black text-slate-800">{selectedUser.name}</p>
                    <p className="text-xs text-slate-500 font-medium">{selectedUser.email}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider ml-1 flex items-center gap-1">
                      Systolic
                      <div className="group relative cursor-help">
                        <Info size={10} className="text-slate-400" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 p-2 bg-slate-800 text-white text-[9px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                          The top number measures the pressure in your arteries when your heart beats.
                        </div>
                      </div>
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 120"
                      value={systolic}
                      onChange={(e) => setSystolic(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-base font-black"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider ml-1 flex items-center gap-1">
                      Diastolic
                      <div className="group relative cursor-help">
                        <Info size={10} className="text-slate-400" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 p-2 bg-slate-800 text-white text-[9px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                          The bottom number measures the pressure in your arteries when your heart rests between beats.
                        </div>
                      </div>
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 80"
                      value={diastolic}
                      onChange={(e) => setDiastolic(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-base font-black"
                    />
                  </div>
                </div>
                <button
                  onClick={handleSave}
                  disabled={!systolic || !diastolic || isSaving}
                  className="w-full py-3.5 bg-primary text-white font-black rounded-xl hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Save size={18} />
                      Save BP Record
                    </>
                  )}
                </button>
              </div>
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
                  <History size={14} className="text-slate-400" />
                  Recent BP History
                </h4>
                <div className="space-y-2">
                  {consultationLoading && (
                    <p className="text-xs text-slate-400 font-bold text-center py-2 italic">
                      Loading history...
                    </p>
                  )}
                  {!consultationLoading && (
                    <>
                      {(consultationLogsByUser[selectedUser.id] || []).length > 0 ? (
                        consultationLogsByUser[selectedUser.id].map((record) => (
                          <div
                            key={record.id}
                            className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100"
                          >
                            <span className="font-black text-slate-700 text-sm">
                              {record.systolic}/{record.diastolic}
                            </span>
                            <span className="text-xs text-slate-400 font-bold">
                              {record.recordedAt
                                ? new Date(record.recordedAt).toLocaleString()
                                : ''}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400 font-bold text-center py-2 italic">
                          No previous records found.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="bg-slate-100/50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-slate-200 shadow-sm">
                <ClipboardList size={28} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-400">No Patient Selected</h3>
                <p className="text-sm text-slate-400 font-medium max-w-[220px] mx-auto">Select a patient from the search results to record their vitals.</p>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
