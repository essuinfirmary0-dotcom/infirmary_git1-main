import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  CalendarDays, 
  ClipboardList, 
  User, 
  LogOut, 
  Search, 
  Filter, 
  Plus, 
  CheckCircle, 
  XCircle, 
  Clock,
  Activity,
  ChevronRight,
  UserSearch,
  Save,
  History,
  HeartPulse,
  CalendarRange,
  Stethoscope,
  Trash2,
  Info,
  CircleDot,
  FolderOpen,
  FileUp,
  FileText,
  LayoutGrid,
  X,
  Mail,
  UserCircle2
} from 'lucide-react';
import { format, isSameDay, parseISO, isWithinInterval, startOfDay, endOfDay, isValid } from 'date-fns';
import { AppointmentList } from './AppointmentList';
import toast, { Toaster } from 'react-hot-toast';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { 
  startOfMonth, 
  endOfMonth, 
  setMonth, 
  setYear, 
  getYear, 
  getMonth, 
  eachMonthOfInterval,
  startOfYear,
  endOfYear
} from 'date-fns';
import { getAppointmentStatusLabel } from '../utils/appointmentStatus';

const safeFormat = (date, formatStr) => {
  if (!date) return 'N/A';
  try {
    let dateObj = date;
    if (typeof date === 'string') {
      dateObj = parseISO(date);
      if (!isValid(dateObj)) {
        dateObj = new Date(date);
      }
    }
    if (!isValid(dateObj)) return 'Invalid Date';
    return format(dateObj, formatStr);
  } catch (error) {
    return 'Invalid Date';
  }
};

export const AdminDashboard = ({ appointments, onUpdateStatus, onLogout, mockUsers, onSaveBP }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [filterService, setFilterService] = useState('All');
  const [filterSubcategory, setFilterSubcategory] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [appointmentSearchQuery, setAppointmentSearchQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Month options for current year
  const currentYear = getYear(new Date());
  const monthOptions = eachMonthOfInterval({
    start: startOfYear(new Date()),
    end: endOfYear(new Date())
  });

  const handleMonthChange = (e) => {
    const monthIndex = parseInt(e.target.value);
    if (isNaN(monthIndex)) return;
    const selectedMonthDate = setMonth(setYear(new Date(), currentYear), monthIndex);
    setStartDate(startOfMonth(selectedMonthDate));
    setEndDate(endOfMonth(selectedMonthDate));
  };
  const handleStartDateChange = (date) => {
    if (!date) return;
    setStartDate(date);
    setEndDate((prevEnd) => (prevEnd && prevEnd >= date ? prevEnd : date));
  };
  const handleEndDateChange = (date) => {
    if (!date) return;
    setEndDate(date);
    setStartDate((prevStart) => (prevStart && prevStart <= date ? prevStart : date));
  };
  const [selectedUser, setSelectedUser] = useState(null);
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Records states
  const [recordsSearchQuery, setRecordsSearchQuery] = useState('');
  const [selectedRecordUser, setSelectedRecordUser] = useState(null);
  const [selectedRecordTile, setSelectedRecordTile] = useState(null);
  const [isAddingRecord, setIsAddingRecord] = useState(false);
  const [recordNotes, setRecordNotes] = useState('');
  const [recordFiles, setRecordFiles] = useState([]);
  const fileInputRef = useRef(null);

  const subcategories = {
    'Dental': ['Consultation'],
    'Medical': ['Consultation', 'Certification'],
    'Nutrition': ['Consultation']
  };

  // Filter appointments by date range, service, subcategory, status, and search query
  const filteredAppointments = appointments.filter(apt => {
    const aptDate = apt.date; // yyyy-MM-dd
    const sDate = format(startDate, 'yyyy-MM-dd');
    const eDate = format(endDate, 'yyyy-MM-dd');
    const isWithinDateRange = aptDate >= sDate && aptDate <= eDate;
    const matchesService = filterService === 'All' || apt.service === filterService;
    const matchesSubcategory = filterSubcategory === 'All' || apt.subcategory === filterSubcategory;
    const matchesStatus = filterStatus === 'All' || apt.status === filterStatus;
    const matchesSearch = appointmentSearchQuery.trim() === '' || 
      (apt.patientName && apt.patientName.toLowerCase().includes(appointmentSearchQuery.toLowerCase())) ||
      (apt.appointmentCode && apt.appointmentCode.toLowerCase().includes(appointmentSearchQuery.toLowerCase()));
    
    return isWithinDateRange && matchesService && matchesSubcategory && matchesStatus && matchesSearch;
  });

  // Search users for consultation logs
  const searchedUsers = searchQuery.trim() === '' ? [] : mockUsers.filter(user => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Search users for records
  const recordsSearchedUsers = recordsSearchQuery.trim() === '' ? [] : mockUsers.filter(user => 
    user.name.toLowerCase().includes(recordsSearchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(recordsSearchQuery.toLowerCase())
  );

  const handleSaveBP = async () => {
    if (!selectedUser || !systolic || !diastolic) return;
    setIsSaving(true);
    
    const bpValue = `${systolic}/${diastolic}`;
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));
    
    onSaveBP(selectedUser.id, bpValue);
    setSystolic('');
    setDiastolic('');
    setSelectedUser(null);
    setSearchQuery('');
    setIsSaving(false);
    toast.success('BP Record saved successfully!', {
      style: {
        borderRadius: '12px',
        background: '#0f172a',
        color: '#fff',
        fontWeight: 'bold',
        fontSize: '12px'
      }
    });
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setRecordFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index) => {
    setRecordFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveRecord = async () => {
    if (!selectedRecordUser || !recordNotes) {
      toast.error('Please add notes before saving.', {
        style: {
          borderRadius: '12px',
          background: '#0f172a',
          color: '#fff',
          fontWeight: 'bold',
          fontSize: '12px'
        }
      });
      return;
    }
    
    setIsSaving(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setIsSaving(false);
    toast.success('Medical record saved successfully!', {
      style: {
        borderRadius: '12px',
        background: '#0f172a',
        color: '#fff',
        fontWeight: 'bold',
        fontSize: '12px'
      }
    });
    
    // Reset form
    setSelectedRecordUser(null);
    setSelectedRecordTile(null);
    setIsAddingRecord(false);
    setRecordNotes('');
    setRecordFiles([]);
    setRecordsSearchQuery('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Toaster position="top-right" />
      {/* Admin Sidebar */}
      <aside className="w-48 bg-slate-900 text-white flex flex-col fixed h-full z-50">
        <div className="p-4 flex items-center gap-2 border-b border-white/10">
          <div className="bg-primary p-1.5 rounded-lg text-white">
            <HeartPulse size={18} />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-base tracking-tight leading-none">Admin</span>
            <span className="text-[8px] font-bold text-primary uppercase tracking-[0.2em] mt-0.5">Portal</span>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-0.5 mt-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg transition-all ${
              activeTab === 'dashboard' 
                ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <LayoutDashboard size={16} />
            <span className="font-bold text-xs">Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab('appointments')}
            className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg transition-all ${
              activeTab === 'appointments' 
                ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <CalendarDays size={16} />
            <span className="font-bold text-xs">Appointments</span>
          </button>
          <button
            onClick={() => setActiveTab('consultation')}
            className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg transition-all ${
              activeTab === 'consultation' 
                ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <ClipboardList size={16} />
            <span className="font-bold text-xs">Consultation Logs</span>
          </button>
          <button
            onClick={() => setActiveTab('records')}
            className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg transition-all ${
              activeTab === 'records' 
                ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <FolderOpen size={16} />
            <span className="font-bold text-xs">Medical Records</span>
          </button>
        </nav>

        <div className="p-2 border-t border-white/10">
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 p-2.5 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-500 transition-all"
          >
            <LogOut size={16} />
            <span className="font-bold text-xs">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-48 p-4">
        {activeTab === 'dashboard' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Admin Overview</h1>
              <p className="text-xs text-slate-500 font-medium">Real-time summary of infirmary activities</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Appointments', value: appointments.length, icon: CalendarDays, color: 'text-slate-600', bg: 'bg-slate-100' },
                { label: getAppointmentStatusLabel('Confirmed'), value: appointments.filter(a => a.status === 'Confirmed').length, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Completed', value: appointments.filter(a => a.status === 'Completed').length, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: getAppointmentStatusLabel('Cancelled'), value: appointments.filter(a => a.status === 'Cancelled').length, icon: XCircle, color: 'text-slate-600', bg: 'bg-slate-100' }
              ].map((stat, i) => (
                <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2.5 ${stat.bg} ${stat.color} rounded-xl`}>
                      <stat.icon size={20} />
                    </div>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Admin Stats</span>
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 mb-0.5">{stat.label}</p>
                  <h3 className={`text-2xl font-black ${stat.color}`}>{stat.value}</h3>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Service Distribution Summary */}
              <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <h3 className="text-sm font-black text-slate-800 mb-6 flex items-center gap-2">
                  <Activity size={16} className="text-primary" />
                  Service Distribution
                </h3>
                <div className="space-y-4">
                  {['Medical', 'Dental', 'Nutrition'].map(service => {
                    const count = appointments.filter(a => a.service === service).length;
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

              {/* Quick Actions */}
              <div className="bg-slate-900 p-6 rounded-2xl shadow-xl space-y-6">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <LayoutDashboard size={16} className="text-primary" />
                  Quick Actions
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  <button onClick={() => setActiveTab('appointments')} className="w-full p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-left transition-all group">
                    <p className="text-white text-[11px] font-bold group-hover:text-primary transition-colors">Manage All Appts</p>
                    <p className="text-slate-500 text-[9px]">View and edit schedules</p>
                  </button>
                  <button onClick={() => setActiveTab('consultation')} className="w-full p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-left transition-all group">
                    <p className="text-white text-[11px] font-bold group-hover:text-primary transition-colors">Record Vitals</p>
                    <p className="text-slate-500 text-[9px]">New patient consultation</p>
                  </button>
                  <button onClick={() => setActiveTab('records')} className="w-full p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-left transition-all group">
                    <p className="text-white text-[11px] font-bold group-hover:text-primary transition-colors">Medical Archive</p>
                    <p className="text-slate-500 text-[9px]">Patient history lookup</p>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'appointments' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="flex flex-col gap-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <h1 className="text-lg font-black text-slate-900 tracking-tight">Appointments</h1>
                  <p className="text-[10px] text-slate-500 font-medium">Manage daily health schedules</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="relative group min-w-[200px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={14} />
                    <input 
                      type="text" 
                      placeholder="Search name or ticket..."
                      value={appointmentSearchQuery}
                      onChange={(e) => setAppointmentSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all font-medium text-slate-800 text-[11px]"
                    />
                  </div>
                  <button 
                    onClick={() => {
                      setStartDate(new Date());
                      setEndDate(new Date());
                      setFilterService('All');
                      setFilterSubcategory('All');
                      setFilterStatus('All');
                      setAppointmentSearchQuery('');
                    }}
                    className="flex items-center gap-1.5 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 font-bold hover:bg-slate-50 transition-all shadow-sm text-[10px]"
                  >
                    <Trash2 size={12} />
                    Reset
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                <div className="space-y-2 col-span-2">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Date Range</label>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <div>
                      <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">From</p>
                      <DatePicker
                        selected={startDate}
                        onChange={handleStartDateChange}
                        shouldCloseOnSelect={true}
                        closeOnScroll={false}
                        popperClassName="appointment-datepicker-popper"
                        popperPlacement="bottom-start"
                        portalId="admin-dashboard-datepicker"
                        calendarClassName="appointment-datepicker-calendar shadow-md"
                        wrapperClassName="w-full"
                        dateFormat="MMM d, yyyy"
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg focus:outline-none focus:border-primary transition-all font-bold text-slate-800 text-[11px]"
                      />
                    </div>
                    <div>
                      <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">To</p>
                      <DatePicker
                        selected={endDate}
                        onChange={handleEndDateChange}
                        shouldCloseOnSelect={true}
                        closeOnScroll={false}
                        popperClassName="appointment-datepicker-popper"
                        popperPlacement="bottom-start"
                        portalId="admin-dashboard-datepicker"
                        calendarClassName="appointment-datepicker-calendar shadow-md"
                        wrapperClassName="w-full"
                        dateFormat="MMM d, yyyy"
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg focus:outline-none focus:border-primary transition-all font-bold text-slate-800 text-[11px]"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-0.5">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Quick Month</label>
                  <select 
                    onChange={handleMonthChange}
                    value={startDate && endDate && getMonth(startDate) === getMonth(endDate) ? getMonth(startDate) : ""}
                    className="w-full px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg focus:outline-none focus:border-primary transition-all font-bold text-slate-800 text-[11px]"
                  >
                    <option value="" disabled>Select Month</option>
                    {monthOptions.map((date, i) => (
                      <option key={i} value={i}>{format(date, 'MMMM')}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-0.5">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Service</label>
                  <select 
                    value={filterService}
                    onChange={(e) => {
                      setFilterService(e.target.value);
                      setFilterSubcategory('All');
                    }}
                    className="w-full px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg focus:outline-none focus:border-primary transition-all font-bold text-slate-800 text-[11px]"
                  >
                    <option value="All">All Services</option>
                    <option value="Medical">Medical</option>
                    <option value="Dental">Dental</option>
                    <option value="Nutrition">Nutrition</option>
                  </select>
                </div>

                <div className="space-y-0.5">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                  <select 
                    value={filterSubcategory}
                    onChange={(e) => setFilterSubcategory(e.target.value)}
                    disabled={filterService === 'All'}
                    className="w-full px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg focus:outline-none focus:border-primary transition-all font-bold text-slate-800 text-[11px] disabled:opacity-50"
                  >
                    <option value="All">All Categories</option>
                    {filterService !== 'All' && subcategories[filterService].map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-0.5">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                  <select 
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg focus:outline-none focus:border-primary transition-all font-bold text-slate-800 text-[11px]"
                  >
                    <option value="All">All Status</option>
                    <option value="Approved">Approved</option>
                    <option value="Confirmed">{getAppointmentStatusLabel('Confirmed')}</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">{getAppointmentStatusLabel('Cancelled')}</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-2 px-1">
                <h2 className="text-[11px] font-black text-slate-800 tracking-tight">
                  {startDate === endDate 
                    ? `Results for ${safeFormat(startDate, 'MMM d, yyyy')}`
                    : `Range: ${safeFormat(startDate, 'MMM d')} - ${safeFormat(endDate, 'MMM d, yyyy')}`
                  }
                </h2>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[9px] font-black uppercase tracking-widest">
                  {filteredAppointments.length} Found
                </span>
              </div>
              
              {filteredAppointments.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-slate-400 font-bold text-[10px]">No matches found.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {filteredAppointments.map((apt) => (
                    <div key={apt.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-md transition-all">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 bg-white rounded-lg flex flex-col items-center justify-center shadow-sm border border-slate-100 shrink-0">
                          <span className="text-[6px] font-black text-primary uppercase">{safeFormat(apt.date, 'MMM')}</span>
                          <span className="text-xs font-black text-slate-800 leading-none">{safeFormat(apt.date, 'dd')}</span>
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-[11px] font-black text-slate-800 leading-tight truncate">{apt.patientName || 'Anonymous'}</h4>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[8px] font-black text-primary uppercase">{apt.appointmentCode}</span>
                            <span className="text-[8px] text-slate-400">•</span>
                            <span className="text-[8px] text-slate-500 font-bold">{apt.time}</span>
                          </div>
                        </div>
                      </div>

                      <select 
                        value={apt.status}
                        onChange={(e) => onUpdateStatus(apt.id, e.target.value)}
                        className={`px-1.5 py-1 rounded-md font-bold text-[9px] border-2 transition-all focus:outline-none ${
                          apt.status === 'Completed' ? 'border-emerald-100 bg-emerald-50 text-emerald-600' :
                          apt.status === 'Cancelled' ? 'border-slate-200 bg-slate-100 text-slate-600' :
                          apt.status === 'Approved' ? 'border-amber-100 bg-amber-50 text-amber-700' :
                          'border-blue-100 bg-blue-50 text-blue-600'
                        }`}
                      >
                        <option value="Approved">Approved</option>
                        <option value="Confirmed">{getAppointmentStatusLabel('Confirmed')}</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">{getAppointmentStatusLabel('Cancelled')}</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'consultation' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Consultation Logs</h1>
              <p className="text-xs text-slate-500 font-medium">Record patient vitals and medical history</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Search Section */}
              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-4">
                <div className="space-y-2">
                  <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                    <UserSearch size={18} className="text-primary" />
                    Search Patient
                  </h3>
                  <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={16} />
                    <input 
                      type="text" 
                      placeholder="Search by name or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-xs font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  {searchedUsers.length > 0 ? (
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Search Results</p>
                      {searchedUsers.map(user => (
                        <button
                          key={user.id}
                          onClick={() => setSelectedUser(user)}
                          className={`w-full p-2.5 rounded-lg border text-left transition-all flex items-center justify-between group ${
                            selectedUser?.id === user.id 
                              ? 'border-primary bg-primary/5 ring-1 ring-primary/20' 
                              : 'border-slate-100 hover:border-primary/30'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-white transition-all">
                              <User size={16} />
                            </div>
                            <div>
                              <p className="font-black text-slate-800 text-xs">{user.name}</p>
                              <p className="text-[9px] text-slate-500 font-medium">{user.email}</p>
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-slate-300 group-hover:text-primary transition-all" />
                        </button>
                      ))}
                    </div>
                  ) : searchQuery.trim() !== '' ? (
                    <div className="text-center py-4 text-slate-400 font-bold text-xs">No patients found.</div>
                  ) : (
                    <div className="text-center py-4 text-slate-400 font-bold text-xs">Start typing to search for a patient.</div>
                  )}
                </div>
              </div>

              {/* Log Section */}
              <AnimatePresence mode="wait">
                {selectedUser ? (
                  <motion.div
                    key="log-form"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                        <Activity size={18} className="text-primary" />
                        Vitals Entry
                      </h3>
                      <button 
                        onClick={() => setSelectedUser(null)}
                        className="text-[9px] font-black text-slate-400 hover:text-red-500 transition-colors uppercase tracking-widest"
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-primary shadow-sm">
                          <User size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-800">{selectedUser.name}</p>
                          <p className="text-[10px] text-slate-500 font-medium">Patient ID: {selectedUser.patientId}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-700 uppercase tracking-wider ml-1 flex items-center gap-1">
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
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-base font-black"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-700 uppercase tracking-wider ml-1 flex items-center gap-1">
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
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-base font-black"
                          />
                        </div>
                      </div>

                      <button
                        onClick={handleSaveBP}
                        disabled={!systolic || !diastolic || isSaving}
                        className="w-full py-3 bg-primary text-white font-black rounded-lg hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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

                    {/* BP History for this user */}
                    <div className="space-y-2 pt-1">
                      <h4 className="text-[10px] font-black text-slate-800 flex items-center gap-1.5">
                        <History size={12} className="text-slate-400" />
                        Recent BP History
                      </h4>
                      <div className="space-y-1">
                        {selectedUser.bpHistory && selectedUser.bpHistory.length > 0 ? (
                          selectedUser.bpHistory.map((record, i) => (
                            <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100">
                              <span className="font-black text-slate-700 text-xs">{record.value}</span>
                              <span className="text-[9px] text-slate-400 font-bold">{record.date}</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-[9px] text-slate-400 font-bold text-center py-1 italic">No previous records found.</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <div className="bg-slate-100/50 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center p-6 text-center space-y-2">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-slate-200 shadow-sm">
                      <ClipboardList size={24} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-400">No Patient Selected</h3>
                      <p className="text-[10px] text-slate-400 font-medium max-w-[180px] mx-auto">Select a patient from the search results to record their vitals.</p>
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {activeTab === 'records' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Medical Records</h1>
              <p className="text-xs text-slate-500 font-medium">Data keeping and patient history management</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Search Section */}
              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-4">
                <div className="space-y-2">
                  <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                    <UserSearch size={18} className="text-primary" />
                    Search Patient
                  </h3>
                  <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={16} />
                    <input 
                      type="text" 
                      placeholder="Search by name or email..."
                      value={recordsSearchQuery}
                      onChange={(e) => setRecordsSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-xs font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  {recordsSearchedUsers.length > 0 ? (
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Search Results</p>
                      {recordsSearchedUsers.map(user => (
                        <button
                          key={user.id}
                          onClick={() => {
                            setSelectedRecordUser(user);
                            setIsAddingRecord(false);
                            setSelectedRecordTile(null);
                          }}
                          className={`w-full p-2.5 rounded-lg border text-left transition-all flex items-center justify-between group ${
                            selectedRecordUser?.id === user.id 
                              ? 'border-primary bg-primary/5 ring-1 ring-primary/20' 
                              : 'border-slate-100 hover:border-primary/30'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-white transition-all">
                              <User size={16} />
                            </div>
                            <div>
                              <p className="font-black text-slate-800 text-xs">{user.name}</p>
                              <p className="text-[9px] text-slate-500 font-medium">{user.email}</p>
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-slate-300 group-hover:text-primary transition-all" />
                        </button>
                      ))}
                    </div>
                  ) : recordsSearchQuery.trim() !== '' ? (
                    <div className="text-center py-4 text-slate-400 font-bold text-xs">No patients found.</div>
                  ) : (
                    <div className="text-center py-4 text-slate-400 font-bold text-xs">Start typing to search for a patient.</div>
                  )}
                </div>
              </div>

              {/* Records / Form Section */}
              <AnimatePresence mode="wait">
                {selectedRecordUser ? (
                  !selectedRecordTile && !isAddingRecord ? (
                    <motion.div
                      key="record-tiles"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                          <LayoutGrid size={18} className="text-primary" />
                          Record Results
                        </h3>
                        <button 
                          onClick={() => setSelectedRecordUser(null)}
                          className="text-[9px] font-black text-slate-400 hover:text-red-500 transition-colors uppercase tracking-widest"
                        >
                          Close
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <motion.button
                          whileHover={{ y: -4 }}
                          onClick={() => setIsAddingRecord(true)}
                          className="p-4 bg-primary/5 border-2 border-dashed border-primary/20 rounded-xl flex flex-col items-center justify-center space-y-2 group hover:bg-primary/10 hover:border-primary transition-all"
                        >
                          <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center shadow-lg shadow-primary/20">
                            <Plus size={20} />
                          </div>
                          <span className="text-[10px] font-black text-primary uppercase tracking-widest">New Record</span>
                        </motion.button>

                        {[
                          { id: 1, title: 'Initial Consultation', date: 'Mar 10, 2026', type: 'Medical' },
                          { id: 2, title: 'Lab Results - Blood', date: 'Mar 12, 2026', type: 'Laboratory' }
                        ].map((record) => (
                          <motion.button
                            key={record.id}
                            whileHover={{ y: -4 }}
                            onClick={() => setSelectedRecordTile(record)}
                            className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex flex-col items-start space-y-2 group hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 hover:border-primary/20 transition-all text-left"
                          >
                            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-400 group-hover:text-primary transition-all shadow-sm">
                              <FileText size={16} />
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-slate-800 line-clamp-1">{record.title}</p>
                              <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{record.date}</p>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="record-form"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                          <FileText size={18} className="text-primary" />
                          {isAddingRecord ? 'New Entry' : selectedRecordTile?.title}
                        </h3>
                        <button 
                          onClick={() => {
                            setIsAddingRecord(false);
                            setSelectedRecordTile(null);
                          }}
                          className="text-[9px] font-black text-slate-400 hover:text-red-500 transition-colors uppercase tracking-widest"
                        >
                          Back to Tiles
                        </button>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-primary shadow-sm">
                            <UserCircle2 size={24} />
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-800">{selectedRecordUser.name}</p>
                            <p className="text-[10px] text-slate-500 font-medium">{selectedRecordUser.email}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-700 uppercase tracking-widest ml-1">Notes & Observations</label>
                          <textarea 
                            rows={4}
                            placeholder="Add detailed clinical notes..."
                            value={recordNotes}
                            onChange={(e) => setRecordNotes(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-xs font-medium resize-none"
                          ></textarea>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-700 uppercase tracking-widest ml-1">Attachments</label>
                          <div 
                            onClick={() => fileInputRef.current.click()}
                            className="border-2 border-dashed border-slate-100 rounded-lg p-4 flex flex-col items-center justify-center space-y-1 cursor-pointer hover:bg-slate-50 transition-all group"
                          >
                            <FileUp size={16} className="text-slate-300 group-hover:text-primary transition-colors" />
                            <p className="text-[9px] font-black text-slate-400 uppercase">Upload Files</p>
                            <input 
                              type="file" 
                              ref={fileInputRef}
                              onChange={handleFileChange}
                              multiple
                              className="hidden"
                            />
                          </div>

                          {recordFiles.length > 0 && (
                            <div className="space-y-1">
                              {recordFiles.map((file, i) => (
                                <div key={i} className="flex items-center justify-between p-1.5 bg-slate-50 border border-slate-100 rounded-lg">
                                  <span className="text-[9px] font-bold text-slate-600 truncate max-w-[150px]">{file.name}</span>
                                  <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500"><X size={12} /></button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <button
                          onClick={handleSaveRecord}
                          disabled={isSaving || !recordNotes}
                          className="w-full py-3 bg-primary text-white font-black rounded-lg hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isSaving ? (
                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          ) : (
                            <>
                              <Save size={14} />
                              Save Medical Record
                            </>
                          )}
                        </button>
                      </div>
                    </motion.div>
                  )
                ) : (
                  <div className="bg-slate-100/50 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center p-6 text-center space-y-2">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-slate-200 shadow-sm">
                      <FolderOpen size={24} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-400">No Patient Selected</h3>
                      <p className="text-[10px] text-slate-400 font-medium max-w-[180px] mx-auto">Select a patient from the search results to manage their medical records.</p>
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
};
