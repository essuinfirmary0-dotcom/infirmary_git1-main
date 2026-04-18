import React, { useState } from 'react';
import { Calendar, Clock, User, Stethoscope, Apple, Activity, Trash2, RefreshCw, XCircle, PlayCircle, CheckCircle, X, Ticket, MapPin, ClipboardList, Tag, FileText, IdCard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, isValid, parseISO } from 'date-fns';

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

const ServiceIcon = ({ service }) => {
  switch (service) {
    case 'Dental': return <Activity className="text-blue-500" size={20} />;
    case 'Medical': return <Stethoscope className="text-red-500" size={20} />;
    case 'Nutrition': return <Apple className="text-orange-500" size={20} />;
    default: return null;
  }
};

const StatusBadge = ({ status }) => {
  const styles = {
    'Waiting': 'bg-amber-50 text-amber-700 border-amber-100',
    'Ongoing': 'bg-blue-50 text-blue-600 border-blue-100',
    'Not Completed': 'bg-red-50 text-red-600 border-red-100',
    'Moved': 'bg-amber-50 text-amber-600 border-amber-100',
    'Completed': 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };

  const icons = {
    'Waiting': <Clock size={12} />,
    'Ongoing': <PlayCircle size={12} />,
    'Not Completed': <XCircle size={12} />,
    'Moved': <RefreshCw size={12} />,
    'Completed': <CheckCircle size={12} />,
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${styles[status] || 'bg-slate-50 text-slate-600'}`}>
      {icons[status]}
      {status}
    </span>
  );
};

const AppointmentDetailModal = ({ isOpen, appointment, onClose, user }) => {
  if (!appointment) return null;
  const isGuestUser = user?.userType === 'guest';
  const tempIdentifier = user?.idNumber || user?.qrValue || null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-2xl sm:rounded-[2.5rem] shadow-2xl max-w-lg w-full overflow-hidden relative my-4"
          >
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
            >
              <X size={24} />
            </button>

            <div className="bg-slate-50 p-4 sm:p-8 border-b border-slate-100">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100">
                    <ServiceIcon service={appointment.service} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">Appointment Details</h2>
                    <StatusBadge status={appointment.status} />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-8 space-y-4 sm:space-y-6">
              <div className="flex items-center justify-between p-4 sm:p-6 bg-primary/5 rounded-2xl sm:rounded-3xl border border-dashed border-primary/20">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white text-primary rounded-2xl shadow-sm">
                    <Ticket size={24} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ticket Number</p>
                    <p className="text-2xl font-black text-slate-800 tracking-tight">{appointment.appointmentCode}</p>
                  </div>
                </div>
                {appointment.queueNumber && (
                  <div className="ml-4 text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Queue Number
                    </p>
                    <p className="text-lg font-black text-slate-900">
                      {appointment.queueNumber}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
                    <User size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase">Patient Name</p>
                    <p className="font-bold text-slate-800">{appointment.patientName}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">Date</p>
                      <p className="font-bold text-slate-800">{safeFormat(appointment.date, 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
                      <Clock size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">Time Slot</p>
                      <p className="font-bold text-slate-800">{appointment.time}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
                    <Tag size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase">Service & Subcategory</p>
                    <p className="font-bold text-slate-800">{appointment.service} - {appointment.subcategory}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
                    <ClipboardList size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase">Purpose</p>
                    <p className="font-bold text-slate-800">{appointment.purpose}</p>
                  </div>
                </div>

                {isGuestUser && (
                  <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-white rounded-lg text-primary shadow-sm">
                            <IdCard size={18} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-400 uppercase">Temporary ID</p>
                            <p className="font-black text-slate-900">{tempIdentifier || 'Not available'}</p>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500">
                          Present this temporary ID or QR code when checking in at the kiosk.
                        </p>
                      </div>
                      {user?.qrCode && (
                        <div className="justify-self-center rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                          <img src={user.qrCode} alt="Temporary guest QR code" className="h-28 w-28 rounded-xl object-contain" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {appointment.notes && (
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
                      <FileText size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">Additional Notes</p>
                      <p className="text-sm text-slate-600 italic">"{appointment.notes}"</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-start gap-3 text-sm text-slate-500">
                  <MapPin size={16} className="text-slate-400 mt-0.5" />
                  <p>Main Infirmary Building, 2nd Floor, Room 204</p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full py-4 bg-primary text-white font-bold rounded-2xl hover:bg-primary-hover transition-all shadow-lg shadow-primary/20"
              >
                Close Details
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export const AppointmentList = ({ appointments, onCancel, onUpdateStatus, isClient = false, user = null }) => {
  const [selectedApt, setSelectedApt] = useState(null);

  if (appointments.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
        <Calendar size={48} className="mx-auto text-slate-300 mb-4" />
        <h3 className="text-lg font-medium text-slate-600">No appointments found</h3>
        <p className="text-slate-400">Your scheduled visits will appear here.</p>
      </div>
    );
  }

  return (
    <>
      <AppointmentDetailModal 
        isOpen={!!selectedApt} 
        appointment={selectedApt} 
        user={user}
        onClose={() => setSelectedApt(null)} 
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        {appointments.map((apt) => (
          <div 
            key={apt.id} 
            onClick={() => setSelectedApt(apt)}
            className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all relative group cursor-pointer hover:border-primary/20 min-w-0"
          >
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 rounded-xl bg-slate-50">
                  <ServiceIcon service={apt.service} />
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <StatusBadge status={apt.status} />
                  <div className="flex items-center gap-1.5">
                    {apt.appointmentCode && (
                      <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                        {apt.appointmentCode}
                      </span>
                    )}
                    {isClient && apt.queueNumber && (
                      <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">
                        Queue: {apt.queueNumber}
                      </span>
                    )}
                  </div>
                </div>
              </div>

            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <User size={18} className="text-slate-400" />
              {apt.patientName}
            </h3>

            <div className="space-y-3 text-sm text-slate-600">
              <div className="flex items-center gap-3">
                <Calendar size={16} className="text-primary" />
                <span>{apt.date}</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock size={16} className="text-primary" />
                <span>{apt.time}</span>
              </div>
              <div className="flex items-center gap-3 font-medium text-slate-700">
                <div className="w-4 h-4 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                </div>
                {apt.service} - {apt.subcategory}
              </div>
            </div>

            {apt.purpose && (
              <div className="mt-4 p-3 bg-slate-50 rounded-lg text-sm text-slate-600 border border-slate-100">
                <span className="font-bold text-slate-700 block mb-1">Purpose:</span>
                <span className="line-clamp-1">{apt.purpose}</span>
              </div>
            )}

            {apt.notes && (
              <div className="mt-4 pt-4 border-t border-slate-50 text-xs text-slate-400 italic line-clamp-1">
                "{apt.notes}"
              </div>
            )}

            {isClient && apt.status === 'Not Completed' && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                This appointment was not attended. Book again to reschedule for another time.
              </div>
            )}

            <div className="mt-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
              {!isClient && onUpdateStatus && apt.status !== 'Not Completed' && apt.status !== 'Completed' && (
                <>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onUpdateStatus(apt.id, 'Moved'); }}
                    className="flex-1 py-2 text-xs font-medium border border-amber-200 text-amber-600 rounded-lg hover:bg-amber-50 transition-colors"
                  >
                    Move
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onUpdateStatus(apt.id, 'Completed'); }}
                    className="flex-1 py-2 text-xs font-medium border border-emerald-200 text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors"
                  >
                    Completed
                  </button>
                </>
              )}
              {!isClient && onCancel && (
                <button
                  onClick={(e) => { e.stopPropagation(); onCancel(apt.id); }}
                  className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                  title="Mark as Not Completed"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
};
