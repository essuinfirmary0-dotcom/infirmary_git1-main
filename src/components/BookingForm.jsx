import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import ReactCalendar from 'react-calendar';
import { appointmentService } from '../services/appointmentService';
import { profileService } from '../services/profileService';
import { departmentService } from '../services/departmentService';
import 'react-calendar/dist/Calendar.css';
import { format, isBefore, startOfDay, getDay, addMonths, isAfter, isValid, parseISO, isSameDay } from 'date-fns';
import { Clock, User, FileText, CheckCircle2, AlertCircle, Calendar as CalendarIcon, ClipboardList, Tag, X, Ticket, MapPin, CalendarDays, Building2, GraduationCap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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

const getInitialGuestPatientName = (user) => {
  const trimmedName = String(user?.name || '').trim();
  return /^guest$/i.test(trimmedName) ? '' : trimmedName;
};

const services = [
  { id: 'Dental', label: 'Dental', description: 'Oral health & hygiene' },
  { id: 'Medical', label: 'Medical', description: 'General health' },
  { id: 'Nutrition', label: 'Nutrition', description: 'Dietary & wellness' }
];

const guestServices = [
  { id: 'Medical', label: 'Medical', description: 'Guest medical appointment booking' },
];

const SUBCATEGORY_OPTIONS_BY_SERVICE = {
  Medical: ['Certification', 'Consultation'],
  Dental: ['Consultation'],
  Nutrition: ['Consultation'],
};

const commonPurposesByService = {
  Dental: ['Tooth Extraction'],
  Medical: ['OJT', 'Sports', 'Educational Tours'],
  Nutrition: ['Dietary Counseling'],
};

const guestPurposesByService = {
  Medical: ['School Requirement'],
};

const STUDENT_PROGRAM_GROUPS = {
  'College of Education': [
    'Bachelor of Secondary Education - Mathematics',
    'Bachelor of Secondary Education - Social Studies',
    'Bachelor of Secondary Education - Science',
    'Bachelor of Secondary Education - English',
    'Bachelor of Secondary Education - Filipino',
    'Bachelor of Elementary Education',
  ],
  'College of Agriculture and Fisheries': [
    'BS in Agriculture',
    'BS in Agriculture - Animal Science',
    'BS in Agriculture - Crop Science',
    'BS in Fisheries',
  ],
  'College of Business and Accountancy': [
    'BS in Accountancy',
    'BS in Accounting Information System',
    'BS in Business Administration',
    'BS in Business Administration - Business Economics',
    'BS in Business Administration - Human Resource Management',
    'BS in Business Administration - Financial Management',
    'BS in Business Administration - Marketing Management',
    'BS in Entrepreneurship',
  ],
  'College of Engineering': [
    'BS in Civil Enginerring',
    'BS in Computer Engineering',
    'BS in Electrical Engineering',
  ],
  'College of Nursing and Allied Health Sciences': [
    'BS in Nursing',
    'Diploma in Midwifery',
    'BS in Nutrition and Dietetics',
  ],
  'College of Information and Computing Studies': [
    'BS in Information Technology',
    'BS in Computer Science',
    'Associate in Computer Technology',
    'BS in Entertainment & Multimedia Computing - Digital Animation Technology',
  ],
  'College of Arts and Social Sciences': [
    'BA in Political Science',
    'BA in Communication',
    'BS in Social Work',
  ],
  'College of Industrial Technology': [
    'BS in Industrial Technology - Drafting Technology',
    'BS in Industrial Technology - Automotive Technology',
    'BS in Industrial Technology - Electrical Technology',
    'BS in Industrial Technology - Electronics Technology',
  ],
  'College of Hospitality and Tourism Management': [
    'BS in Hospitality Management',
    'BS in Tourism Management',
  ],
  'College of Science and Environment': [
    'BS in Biology',
    'BS in Environmental Science',
  ],
  'College of Criminology': [
    'BS in Criminology',
  ],
};
const STUDENT_BOOKING_USER_TYPES = new Set(['student', 'new', 'old']);

const isStudentBookingUserType = (userType) =>
  STUDENT_BOOKING_USER_TYPES.has(String(userType || '').trim().toLowerCase());

const normalizeDepartmentName = (name) =>
  String(name || '')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim();

const buildStudentAcademicOptions = (departments = []) => {
  const importedProgramLookup = new Map(
    (Array.isArray(departments) ? departments : [])
      .map((department) => normalizeDepartmentName(department?.name))
      .filter(Boolean)
      .map((name) => [name, name]),
  );

  const programsByCollege = Object.fromEntries(
    Object.entries(STUDENT_PROGRAM_GROUPS).map(([college, programs]) => {
      const resolvedPrograms = programs
        .map((program) => importedProgramLookup.get(normalizeDepartmentName(program)) || program)
        .map((program) => normalizeDepartmentName(program));

      return [college, [...new Set(resolvedPrograms)].sort((left, right) => left.localeCompare(right))];
    }),
  );

  return {
    colleges: Object.keys(programsByCollege),
    programsByCollege,
  };
};

const DEFAULT_TIME_SLOT_OPTIONS = [
  { time: '8:00 AM - 9:00 AM', maxCapacity: 13, session: 'morning' },
  { time: '9:00 AM - 10:00 AM', maxCapacity: 13, session: 'morning' },
  { time: '10:00 AM - 11:00 AM', maxCapacity: 13, session: 'morning' },
  { time: '11:00 AM - 12:00 PM', maxCapacity: 11, session: 'morning' },
  { time: '1:00 PM - 2:00 PM', maxCapacity: 13, session: 'afternoon' },
  { time: '2:00 PM - 3:00 PM', maxCapacity: 13, session: 'afternoon' },
  { time: '3:00 PM - 4:00 PM', maxCapacity: 13, session: 'afternoon' },
  { time: '4:00 PM - 5:00 PM', maxCapacity: 11, session: 'afternoon' },
  { time: '10:00 PM - 11:00 PM', maxCapacity: 10, session: 'night' },
  { time: '11:00 PM - 12:00 AM', maxCapacity: 10, session: 'night' },
];
const TIME_SLOT_SECTIONS = [
  { key: 'morning', label: 'Morning Session', totalCapacity: 50 },
  { key: 'afternoon', label: 'Afternoon Session', totalCapacity: 50 },
  { key: 'night', label: 'Temporary Night Session', totalCapacity: 20 },
];
const MEDICAL_REQUIREMENT_NOTICE = 'All submitted files are for initial review only. Please bring the original documents to the infirmary office, otherwise your request will not be processed and no medical certification will be issued.';

const createDefaultSlotAvailability = () =>
  DEFAULT_TIME_SLOT_OPTIONS.map((slot) => ({
    time: slot.time,
    remaining: slot.maxCapacity,
    maxCapacity: slot.maxCapacity,
    session: slot.session,
  }));

const mapApiSlotsToAvailability = (slots = []) => {
  const slotsByTime = new Map(
    (slots || []).map((slot) => [slot.timeSlot || slot.time, slot]),
  );

  return DEFAULT_TIME_SLOT_OPTIONS.map((slot) => {
    const apiSlot = slotsByTime.get(slot.time);

    return {
      time: slot.time,
      remaining: apiSlot?.remaining ?? slot.maxCapacity,
      maxCapacity: apiSlot?.maxCapacity ?? slot.maxCapacity,
      session: slot.session,
    };
  });
};

const getAvailableSubcategoryOptions = (service) =>
  SUBCATEGORY_OPTIONS_BY_SERVICE[service] || [];

const getDefaultSubcategoryForService = (service) => {
  const options = getAvailableSubcategoryOptions(service);
  return options.length === 1 ? options[0] : '';
};

const supportsRequirementUploads = (service, subcategory) =>
  service === 'Medical' && subcategory === 'Certification';

const isInfirmaryClosedOnDate = (d) => {
  const day = getDay(d);
  return day === 0 || day === 5 || day === 6; // Sunday, Friday, and Saturday
};

const getCurrentSystemDate = (baseDate = new Date()) => startOfDay(baseDate);

const getMillisecondsUntilNextDay = (baseDate = new Date()) => {
  const nextDay = new Date(baseDate);
  nextDay.setHours(24, 0, 1, 0);
  return Math.max(nextDay.getTime() - baseDate.getTime(), 1000);
};

const parseTimeSlotEndMinutes = (slotLabel) => {
  const slotRange = parseTimeSlotRange(slotLabel);
  return slotRange?.comparisonEndMinutes ?? null;
};

const isActiveAppointmentStatus = (status) => !['Completed', 'Cancelled'].includes(String(status || '').trim());

const ConfirmationModal = ({
  isOpen,
  appointment,
  onClose,
  user,
  isGuestUser,
  guestType,
  selectedCollege = '',
  selectedProgram = '',
  isRescheduleMode = false,
}) => {
  if (!appointment) return null;
  const displayCollege = !isGuestUser ? (selectedCollege?.trim() || user?.college?.trim() || '') : '';
  const displayProgram = !isGuestUser ? (selectedProgram?.trim() || user?.program?.trim() || '') : '';
  const showCollege = !isGuestUser && Boolean(displayCollege);
  const showProgram = !isGuestUser && Boolean(displayProgram);
  const tempIdentifier = user?.idNumber || user?.qrValue || null;
  const guestQrCode = user?.qrCode || null;

  const handleDownloadGuestPass = () => {
    if (!tempIdentifier || !guestQrCode) return;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Guest Check-In Pass</title>
          <style>
            body {
              margin: 0;
              padding: 24px;
              font-family: Arial, sans-serif;
              background: #f8fafc;
              color: #0f172a;
            }
            .card {
              max-width: 420px;
              margin: 0 auto;
              background: #ffffff;
              border: 1px solid #e2e8f0;
              border-radius: 24px;
              padding: 24px;
              box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
            }
            .eyebrow {
              font-size: 12px;
              letter-spacing: 0.18em;
              text-transform: uppercase;
              color: #0f766e;
              font-weight: 700;
            }
            h1 {
              margin: 10px 0 16px;
              font-size: 26px;
              line-height: 1.1;
            }
            .meta {
              margin: 12px 0;
              padding: 14px 16px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 16px;
            }
            .label {
              font-size: 11px;
              letter-spacing: 0.12em;
              text-transform: uppercase;
              color: #64748b;
              font-weight: 700;
              margin-bottom: 4px;
            }
            .value {
              font-size: 20px;
              font-weight: 800;
              color: #020617;
            }
            .qr {
              margin: 20px auto;
              width: 220px;
              height: 220px;
              display: block;
              object-fit: contain;
              border: 1px solid #e2e8f0;
              border-radius: 18px;
              padding: 12px;
              background: #ffffff;
            }
            .note {
              margin-top: 16px;
              font-size: 13px;
              line-height: 1.5;
              color: #475569;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="eyebrow">Guest Check-In Pass</div>
            <h1>Temporary QR and ID</h1>
            <div class="meta">
              <div class="label">Temporary ID</div>
              <div class="value">${tempIdentifier}</div>
            </div>
            <div class="meta">
              <div class="label">Patient</div>
              <div class="value" style="font-size: 18px;">${appointment.patientName || 'Guest'}</div>
            </div>
            <img class="qr" src="${guestQrCode}" alt="Guest temporary QR code" />
            <p class="note">
              Show this QR code or temporary ID at the kiosk during check-in.
            </p>
          </div>
        </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tempIdentifier}-guest-pass.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
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

            <div className="bg-primary p-5 sm:p-8 text-white text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 backdrop-blur-md">
                <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold">
                {isRescheduleMode ? 'Reschedule Confirmed!' : 'Booking Confirmed!'}
              </h2>
              <p className="text-white/80 mt-2 text-sm sm:text-base">
                {isRescheduleMode
                  ? 'Your appointment has been successfully moved to the new schedule.'
                  : 'Your appointment has been successfully scheduled.'}
              </p>
            </div>

            <div className="p-4 sm:p-8 space-y-4 sm:space-y-6">
              <div className="flex items-center justify-between p-4 sm:p-6 bg-slate-50 rounded-2xl sm:rounded-3xl border border-dashed border-slate-200">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                    <Ticket size={24} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ticket Number</p>
                    <p className="text-2xl font-black text-slate-800 tracking-tight">{appointment.appointmentCode}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-6">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase">Patient</p>
                  <p className="font-bold text-slate-800">{appointment.patientName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase">Service</p>
                  <p className="font-bold text-slate-800">{appointment.service} - {appointment.subcategory}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase">Date</p>
                  <p className="font-bold text-slate-800 flex items-center gap-2">
                    <CalendarDays size={14} className="text-primary" />
                    {safeFormat(appointment.date, 'MMM d, yyyy')}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase">Time</p>
                  <p className="font-bold text-slate-800 flex items-center gap-2">
                    <Clock size={14} className="text-primary" />
                    {appointment.time}
                  </p>
                </div>
              </div>

              {isGuestUser && (
                <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Guest Check-In Pass</p>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Temporary ID</p>
                        <p className="text-xl font-black text-slate-900">{tempIdentifier || 'Not available'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Type of Guest</p>
                        <p className="font-bold text-slate-800">{guestType || user?.program || 'Not provided'}</p>
                      </div>
                      <p className="text-xs text-slate-500">
                        Use this temporary ID or QR code at the kiosk when you check in for your appointment.
                      </p>
                    </div>
                    {guestQrCode && (
                      <div className="self-center rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                        <img src={guestQrCode} alt="Guest temporary QR code" className="h-32 w-32 rounded-xl object-contain" />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadGuestPass}
                    disabled={!tempIdentifier || !guestQrCode}
                    className="mt-4 w-full rounded-2xl border border-primary/20 bg-white px-4 py-3 text-sm font-black text-primary transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Download Guest QR and Temp ID
                  </button>
                </div>
              )}

              {(showCollege || showProgram) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
                  {showCollege && (
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-400 uppercase">College</p>
                      <p className="font-bold text-slate-800 flex items-start gap-2">
                        <Building2 size={14} className="text-primary shrink-0 mt-0.5" />
                        <span className="min-w-0">{displayCollege}</span>
                      </p>
                    </div>
                  )}
                  {showProgram && (
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-400 uppercase">Department / Program</p>
                      <p className="font-bold text-slate-800 flex items-start gap-2">
                        <GraduationCap size={14} className="text-primary shrink-0 mt-0.5" />
                        <span className="min-w-0">{displayProgram}</span>
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-start gap-3 text-sm text-slate-500">
                  <MapPin size={16} className="text-slate-400 mt-0.5" />
                  <p>ESSU MAIN INFIRMARY BUILDING</p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full py-4 bg-primary text-white font-bold rounded-2xl hover:bg-primary-hover transition-all shadow-lg shadow-primary/20"
              >
                Done
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const initialFormData = (user) => ({
  patientName: user?.userType === 'guest' ? getInitialGuestPatientName(user) : (user?.name || ''),
  guestType: user?.program || '',
  college: user?.college || '',
  program: user?.program || '',
  service: user?.userType === 'guest' ? 'Medical' : '',
  subcategory: '',
  purpose: '',
  timeSlot: '',
  notes: '',
});

const parseAppointmentDateValue = (value, fallbackDate = getCurrentSystemDate()) => {
  if (!value) return fallbackDate;
  if (value instanceof Date && isValid(value)) return startOfDay(value);
  const parsed = typeof value === 'string' ? parseISO(value) : new Date(value);
  return isValid(parsed) ? startOfDay(parsed) : fallbackDate;
};

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

const parseTimeSlotRange = (timeSlot) => {
  const normalized = String(timeSlot || '').trim();
  const match = normalized.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i);
  if (!match) return null;

  const startMinutes = parseClockToMinutes(match[1]);
  const endMinutes = parseClockToMinutes(match[2]);
  if (startMinutes == null || endMinutes == null) return null;

  return {
    startMinutes,
    endMinutes,
    comparisonEndMinutes: endMinutes <= startMinutes ? endMinutes + (24 * 60) : endMinutes,
  };
};

const evaluateScheduledAppointmentState = (appointmentDate, timeSlot, now = new Date()) => {
  const normalizedDate = String(appointmentDate || '').trim();
  const slotRange = parseTimeSlotRange(timeSlot);

  if (!normalizedDate) {
    return { status: 'unknown', slotRange };
  }

  const today = format(now, 'yyyy-MM-dd');
  if (normalizedDate > today) {
    return { status: 'upcoming', slotRange };
  }

  if (normalizedDate < today) {
    return { status: 'past', slotRange };
  }

  if (!slotRange) {
    return { status: 'unknown', slotRange: null };
  }

  const nowMinutes = (now.getHours() * 60) + now.getMinutes();
  if (nowMinutes < slotRange.startMinutes) {
    return { status: 'upcoming', slotRange };
  }

  if (nowMinutes <= slotRange.comparisonEndMinutes) {
    return { status: 'active', slotRange };
  }

  return { status: 'past', slotRange };
};

export const BookingForm = ({
  onBook,
  onReschedule,
  appointments,
  user,
  isGuestUser = false,
  onUserUpdated,
  rescheduleAppointment = null,
}) => {
  const navigate = useNavigate();
  const [currentDateTime, setCurrentDateTime] = useState(() => new Date());
  const [date, setDate] = useState(() => getCurrentSystemDate());
  const [hasUserSelectedDate, setHasUserSelectedDate] = useState(false);
  const [formData, setFormData] = useState(() => initialFormData(user));
  const [requirementFileGroups, setRequirementFileGroups] = useState({
    chestXray: [],
    urinalysis: [],
  });
  const [studentAcademicOptions, setStudentAcademicOptions] = useState(() =>
    buildStudentAcademicOptions(),
  );
  const submitLockRef = useRef(false);
  const isRescheduleMode = Boolean(rescheduleAppointment && onReschedule);
  const isStudentBookingUser = !isGuestUser && isStudentBookingUserType(user?.userType);
  const todayDate = getCurrentSystemDate(currentDateTime);
  const todayDateKey = format(todayDate, 'yyyy-MM-dd');

  useEffect(() => {
    const syncCurrentDateTime = () => {
      setCurrentDateTime(new Date());
    };

    syncCurrentDateTime();

    const minuteIntervalId = window.setInterval(syncCurrentDateTime, 60 * 1000);
    let nextDayTimeoutId = null;

    const scheduleNextDayRefresh = () => {
      nextDayTimeoutId = window.setTimeout(() => {
        syncCurrentDateTime();
        scheduleNextDayRefresh();
      }, getMillisecondsUntilNextDay());
    };

    scheduleNextDayRefresh();

    return () => {
      window.clearInterval(minuteIntervalId);
      if (nextDayTimeoutId) {
        window.clearTimeout(nextDayTimeoutId);
      }
    };
  }, []);

  useEffect(() => {
    const currentSystemDate = getCurrentSystemDate();

    setDate((currentSelectedDate) => {
      const normalizedSelectedDate = parseAppointmentDateValue(currentSelectedDate, currentSystemDate);

      if (!hasUserSelectedDate || isBefore(normalizedSelectedDate, currentSystemDate)) {
        return currentSystemDate;
      }

      return normalizedSelectedDate;
    });
  }, [todayDateKey, hasUserSelectedDate]);

  useEffect(() => {
    let isMounted = true;

    const loadDepartmentOptions = async () => {
      try {
        const departments = await departmentService.getAcademicDepartments();
        if (!isMounted) return;
        setStudentAcademicOptions(buildStudentAcademicOptions(departments));
      } catch {
        if (!isMounted) return;
        setStudentAcademicOptions(buildStudentAcademicOptions());
      }
    };

    loadDepartmentOptions();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (user?.name || user?.program || user?.college || user?.userType === 'guest') {
      setFormData(prev => ({
        ...prev,
        patientName: user?.userType === 'guest' ? prev.patientName : (user?.name || prev.patientName),
        guestType: user?.program || prev.guestType,
        college: isStudentBookingUser ? (user?.college || prev.college) : prev.college,
        program: isStudentBookingUser ? (user?.program || prev.program) : prev.program,
        service: user?.userType === 'guest' ? 'Medical' : prev.service,
      }));
    }
  }, [isStudentBookingUser, user]);

  useEffect(() => {
    if (!isRescheduleMode || !rescheduleAppointment) {
      return;
    }

    setDate(getCurrentSystemDate());
    setHasUserSelectedDate(false);
    setFormData((prev) => ({
      ...prev,
      patientName: isGuestUser
        ? (prev.patientName || rescheduleAppointment.patientName || getInitialGuestPatientName(user))
        : (user?.name || rescheduleAppointment.patientName || prev.patientName),
      guestType: user?.program || prev.guestType,
      college: isStudentBookingUser ? (user?.college || prev.college) : prev.college,
      program: isStudentBookingUser ? (user?.program || prev.program) : prev.program,
      service: rescheduleAppointment.service || prev.service,
      subcategory: rescheduleAppointment.subcategory || '',
      purpose: rescheduleAppointment.purpose || '',
      timeSlot: rescheduleAppointment.time || '',
      notes: rescheduleAppointment.notes || '',
    }));
    setRequirementFileGroups({
      chestXray: [],
      urinalysis: [],
    });
  }, [isGuestUser, isRescheduleMode, isStudentBookingUser, rescheduleAppointment, user]);

  const availableStudentPrograms = formData.college
    ? (studentAcademicOptions.programsByCollege[formData.college] || [])
    : [];

  useEffect(() => {
    if (!isStudentBookingUser) {
      return;
    }

    if (formData.college && !studentAcademicOptions.colleges.includes(formData.college)) {
      setFormData((prev) => ({ ...prev, college: '', program: '' }));
      return;
    }

    if (!formData.college) {
      if (formData.program) {
        setFormData((prev) => ({ ...prev, program: '' }));
      }
      return;
    }

    if (!availableStudentPrograms.includes(formData.program)) {
      setFormData((prev) => ({ ...prev, program: '' }));
    }
  }, [availableStudentPrograms, formData.college, formData.program, isStudentBookingUser, studentAcademicOptions.colleges]);

  const purposeOptions = isGuestUser ? guestPurposesByService : commonPurposesByService;
  const serviceOptions = isGuestUser ? guestServices : services;
  const availablePurposes = formData.service ? (purposeOptions[formData.service] || []) : [];
  const availableSubcategories = getAvailableSubcategoryOptions(formData.service);
  const isSingleSubcategoryOption = availableSubcategories.length === 1;
  const requirementFiles = [...requirementFileGroups.chestXray, ...requirementFileGroups.urinalysis];
  const requirementUploadItems = [
    ...requirementFileGroups.chestXray.map((file) => ({ file, label: 'Chest Xray' })),
    ...requirementFileGroups.urinalysis.map((file) => ({ file, label: 'Urinalyses' })),
  ];
  const shouldShowRequirementUpload = supportsRequirementUploads(
    formData.service,
    formData.subcategory,
  );

  useEffect(() => {
    const nextOptions = getAvailableSubcategoryOptions(formData.service);
    const nextDefault = nextOptions.length === 1 ? nextOptions[0] : '';

    if (!formData.service) {
      if (formData.subcategory) {
        setFormData((prev) => ({ ...prev, subcategory: '' }));
      }
      return;
    }

    if (!nextOptions.includes(formData.subcategory)) {
      setFormData((prev) => ({ ...prev, subcategory: nextDefault }));
    }
  }, [formData.service, formData.subcategory]);

  useEffect(() => {
    if (shouldShowRequirementUpload || requirementFiles.length === 0) {
      return;
    }

    setRequirementFileGroups({
      chestXray: [],
      urinalysis: [],
    });
  }, [requirementFiles.length, shouldShowRequirementUpload]);

  useEffect(() => {
    if (!formData.service) {
      if (formData.purpose) {
        setFormData((prev) => ({ ...prev, purpose: '' }));
      }
      return;
    }

    if (availablePurposes.length && !availablePurposes.includes(formData.purpose)) {
      setFormData((prev) => ({ ...prev, purpose: availablePurposes[0] }));
    }
  }, [formData.service, formData.purpose, availablePurposes]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [lastBooked, setLastBooked] = useState(null);

  const handleConfirmationDone = () => {
    setShowConfirmation(false);
    setLastBooked(null);
    setDate(getCurrentSystemDate());
    setHasUserSelectedDate(false);
    setFormData(initialFormData(user));
    setRequirementFileGroups({
      chestXray: [],
      urinalysis: [],
    });
    navigate('/app/appointments');
  };

  const handleRequirementGroupChange = (groupKey, files) => {
    setRequirementFileGroups((prev) => ({
      ...prev,
      [groupKey]: Array.from(files || []),
    }));
  };

  // Fetch all slot availabilities for the selected date from API (single request)
  const [slotAvailability, setSlotAvailability] = useState(
    createDefaultSlotAvailability(),
  );
  const [slotsLoading, setSlotsLoading] = useState(false);
  const loadSlotAvailability = async (selectedDate) => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    setSlotsLoading(true);
    try {
      const res = await appointmentService.getSlotsForDate(dateStr);
      const slots = res?.slots ?? [];
      setSlotAvailability(
        slots.length
          ? mapApiSlotsToAvailability(slots)
          : createDefaultSlotAvailability(),
      );
    } catch {
      setSlotAvailability(createDefaultSlotAvailability());
    } finally {
      setSlotsLoading(false);
    }
  };

  useEffect(() => {
    loadSlotAvailability(date);
  }, [date]);

  const isDayDisabled = ({ date: calendarDate }) => {
    const isPast = isBefore(calendarDate, todayDate);
    const isTooFar = isAfter(calendarDate, addMonths(todayDate, 1));
    return isInfirmaryClosedOnDate(calendarDate) || isPast || isTooFar;
  };

  const getCalendarTileClassName = ({ date: calendarDate, view }) => {
    if (view !== 'month') {
      return null;
    }

    const classNames = [];

    if (isSameDay(calendarDate, todayDate)) {
      classNames.push('booking-calendar__tile--today');
    }

    if (isBefore(calendarDate, todayDate)) {
      classNames.push('booking-calendar__tile--past');
    }

    return classNames.join(' ') || null;
  };

  const isClosedDate = isInfirmaryClosedOnDate(date);
  const isSelectedDateToday = isSameDay(date, todayDate);
  const currentMinutes = (currentDateTime.getHours() * 60) + currentDateTime.getMinutes();
  const isSlotPastCutoff = (slotTime) => {
    if (!isSelectedDateToday) return false;
    const slotEndMinutes = parseTimeSlotEndMinutes(slotTime);
    if (slotEndMinutes == null) return false;
    return currentMinutes > slotEndMinutes;
  };
  const isSlotUnavailable = (slotTime) => {
    const slot = slotAvailability.find((item) => item.time === slotTime);
    if (!slot) return true;
    const isFull = slot ? slot.remaining <= 0 : false;
    return isFull || isSlotPastCutoff(slotTime);
  };
  const groupedSlotAvailability = TIME_SLOT_SECTIONS.map((section) => ({
    ...section,
    slots: slotAvailability.filter((slot) => slot.session === section.key),
  }));

  useEffect(() => {
    if (!formData.timeSlot) return;
    if (!isSlotUnavailable(formData.timeSlot)) return;
    setFormData((prev) => ({ ...prev, timeSlot: '' }));
  }, [formData.timeSlot, slotAvailability, date]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitLockRef.current) return;
    if (isGuestUser && !formData.patientName.trim()) {
      toast.error('Please enter your full name.');
      return;
    }
    if (isGuestUser && !formData.guestType.trim()) {
      toast.error('Please enter the type of guest.');
      return;
    }
    if (isStudentBookingUser && !formData.college.trim()) {
      toast.error('Please select your college.');
      return;
    }
    if (isStudentBookingUser && !formData.program.trim()) {
      toast.error('Please select your department / program.');
      return;
    }
    if (!formData.service) {
      toast.error('Please select a service.');
      return;
    }
    if (!formData.timeSlot) {
      toast.error('Please select a time slot.');
      return;
    }
    const selectedDate = format(date, 'yyyy-MM-dd');
    const requestedScheduleState = evaluateScheduledAppointmentState(
      selectedDate,
      formData.timeSlot,
    );
    if (requestedScheduleState.status === 'past') {
      toast.error('The selected time slot is no longer available for booking.');
      return;
    }
    if (requestedScheduleState.status === 'unknown') {
      toast.error('The selected time slot is invalid.');
      return;
    }
    const hasSameSlotConflict = (appointments || []).some(
      (apt) =>
        apt.id !== rescheduleAppointment?.id &&
        apt.date === selectedDate &&
        apt.time === formData.timeSlot &&
        isActiveAppointmentStatus(apt.status),
    );
    if (hasSameSlotConflict) {
      toast.error('You already have an appointment in that same date and time slot.');
      return;
    }
    if (isSlotUnavailable(formData.timeSlot)) {
      toast.error('Selected time slot is no longer available.');
      return;
    }
    if (isInfirmaryClosedOnDate(date)) {
      toast.error('The infirmary is closed on this day. Please select an open day from Monday to Thursday.');
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);

    try {
      if (isGuestUser) {
        const nameParts = formData.patientName.trim().split(/\s+/).filter(Boolean);
        const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
        const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : nameParts[0] || 'Guest';
        const profileResult = await profileService.updateProfile({
          firstName,
          middleName: '',
          lastName,
          email: '',
          phone: '',
          address: '',
          college: '',
          program: formData.guestType.trim(),
          pictureUrl: '',
        });

        if (profileResult?.user && typeof onUserUpdated === 'function') {
          onUserUpdated(profileResult.user);
        }
      } else if (isStudentBookingUser) {
        const profileResult = await profileService.updateProfile({
          firstName: user?.firstName || '',
          middleName: user?.middleName || '',
          lastName: user?.lastName || '',
          email: user?.email || '',
          phone: user?.phone || '',
          address: user?.address || '',
          college: formData.college.trim(),
          program: formData.program.trim(),
          pictureUrl: user?.pictureUrl || '',
        });

        if (profileResult?.user && typeof onUserUpdated === 'function') {
          onUserUpdated(profileResult.user);
        }
      }

      const payload = {
        ...formData,
        patientName: isGuestUser ? formData.patientName.trim() : (user?.name || formData.patientName),
        date: format(date, 'yyyy-MM-dd'),
        time: formData.timeSlot,
        requirementFiles: requirementUploadItems,
        notes: [
          isGuestUser ? `Type of Guest: ${formData.guestType.trim()}` : '',
          formData.notes?.trim() || '',
          shouldShowRequirementUpload && requirementUploadItems.length > 0
            ? `Submitted requirement files: ${requirementUploadItems.map((item) => `${item.label}: ${item.file.name}`).join(', ')}`
            : '',
        ]
          .filter(Boolean)
          .join('\n'),
      };

      const appointment = isRescheduleMode
        ? await onReschedule(rescheduleAppointment.id, payload)
        : await onBook(payload);

      await loadSlotAvailability(date);
      setLastBooked(appointment);
      setShowConfirmation(true);
    } catch (err) {
      const message =
        err.response?.data?.message ||
        (isRescheduleMode
          ? 'Failed to reschedule appointment. Please try again.'
          : 'Failed to book appointment. Please try again.');
      toast.error(message);
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <ConfirmationModal
        isOpen={showConfirmation}
        appointment={lastBooked}
        onClose={handleConfirmationDone}
        user={user}
        isGuestUser={isGuestUser}
        guestType={formData.guestType}
        selectedCollege={formData.college}
        selectedProgram={formData.program}
        isRescheduleMode={isRescheduleMode}
      />

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 md:gap-8 px-0">
        <div className="space-y-4 sm:space-y-8 min-w-0">
          {isRescheduleMode && rescheduleAppointment && (
            <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4 text-sm font-semibold text-primary">
              Rescheduling {rescheduleAppointment.service} from {safeFormat(rescheduleAppointment.date, 'MMM d, yyyy')} at {rescheduleAppointment.time}.
              Choose a new future slot below.
            </div>
          )}
          <div className="bg-white p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200 min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-4 sm:mb-6 flex items-center gap-2">
              <CalendarIcon size={20} className="text-primary shrink-0" />
              1. Select Date
            </h2>
            <ReactCalendar
              onChange={(nextValue) => {
                const nextDate = Array.isArray(nextValue) ? nextValue[0] : nextValue;
                if (!nextDate || !isValid(nextDate)) {
                  return;
                }

                setHasUserSelectedDate(true);
                setDate(startOfDay(nextDate));
              }}
              value={date}
              tileDisabled={isDayDisabled}
              tileClassName={getCalendarTileClassName}
              className="rounded-xl sm:rounded-2xl border-none w-full max-w-full"
              minDate={todayDate}
              maxDate={addMonths(todayDate, 1)}
            />
            <div className="mt-4 sm:mt-8 p-4 sm:p-6 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-100">
              <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                <Clock size={16} className="text-primary" />
                Availability for {safeFormat(date, 'MMMM d, yyyy')}
              </h3>
              {isClosedDate ? (
                <div className="mt-4 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-100">
                  <AlertCircle size={14} />
                  Infirmary is closed on Friday and weekends.
                </div>
              ) : (
                <div className="space-y-5">
                  {TIME_SLOT_SECTIONS.map((section) => {
                    const sectionSlots = groupedSlotAvailability.find((group) => group.key === section.key)?.slots || [];
                    const sectionSlotDefinitions = DEFAULT_TIME_SLOT_OPTIONS.filter((slot) => slot.session === section.key);

                    return (
                      <div key={section.key} className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                            {section.label}
                          </p>
                          <span className="text-[11px] font-bold text-slate-500">
                            {section.totalCapacity} total slots
                          </span>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                          {slotsLoading ? (
                            sectionSlotDefinitions.map((slot) => (
                              <div
                                key={`${section.key}-${slot.time}`}
                                className="p-4 rounded-2xl border border-slate-200 bg-slate-50 animate-pulse flex justify-between items-center"
                              >
                                <div className="h-4 w-40 bg-slate-200 rounded-full" />
                                <div className="h-6 w-28 bg-slate-200 rounded-full" />
                              </div>
                            ))
                          ) : (
                            sectionSlots.map((slot) => {
                              const isPastCutoff = isSlotPastCutoff(slot.time);
                              const isUnavailable = slot.remaining <= 0 || isPastCutoff;
                              const isNearlyFull = slot.remaining <= Math.max(1, Math.ceil(slot.maxCapacity * 0.25));

                              return (
                                <button
                                  key={slot.time}
                                  type="button"
                                  disabled={isUnavailable}
                                  onClick={() => setFormData({ ...formData, timeSlot: slot.time })}
                                  className={`p-4 rounded-2xl border transition-all flex justify-between items-center ${formData.timeSlot === slot.time
                                    ? 'border-primary bg-primary/5 text-primary ring-2 ring-primary/20'
                                    : 'border-slate-200 bg-white hover:border-primary/50 text-slate-600'
                                    } ${isUnavailable ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
                                >
                                  <span className="font-bold">{slot.time}</span>
                                  <span
                                    className={`text-xs font-bold px-3 py-1 rounded-full ${isPastCutoff
                                      ? 'bg-slate-200 text-slate-600'
                                      : isNearlyFull
                                        ? 'bg-red-100 text-red-600'
                                        : 'bg-emerald-100 text-emerald-600'
                                      }`}
                                  >
                                    {isPastCutoff ? 'Not available' : `${slot.remaining} slots left`}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200 overflow-hidden min-w-0">
          <div className="bg-primary p-5 sm:p-6 md:p-8 text-white">
            <h2 className="text-xl sm:text-2xl font-bold">
              {isRescheduleMode ? '2. Update Appointment' : '2. Patient Details'}
            </h2>
            <p className="text-white/80 text-xs sm:text-sm mt-1">
              {isRescheduleMode
                ? 'You can only reschedule upcoming appointments, and the service stays the same.'
                : isGuestUser
                ? `Guest booking is limited to Medical service. Complete your details for ${safeFormat(date, 'MMM d')}.`
                : `Tell us more about your visit on ${safeFormat(date, 'MMM d')}.`}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-8">
            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wider">
                <User size={16} className="text-primary" />
                {isGuestUser ? 'Full Name' : 'Patient Name'}
              </label>
              {isGuestUser ? (
                <input
                  type="text"
                  required
                  className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all bg-white text-lg font-medium text-slate-800"
                  placeholder="Enter your full name"
                  value={formData.patientName}
                  onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                />
              ) : (
                <div className="w-full px-5 py-4 rounded-2xl border border-slate-200 bg-slate-50 text-lg font-medium text-slate-800">
                  {user?.name || formData.patientName || '—'}
                </div>
              )}
            </div>

            {isGuestUser && (
              <>
                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wider">
                    <GraduationCap size={16} className="text-primary" />
                    Type of Guest
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all bg-white font-medium"
                    placeholder="Example: Incoming Freshmen"
                    value={formData.guestType}
                    onChange={(e) => setFormData({ ...formData, guestType: e.target.value })}
                  />
                </div>

              </>
            )}

            {isStudentBookingUser && (
              <>
                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wider">
                    <Building2 size={16} className="text-primary" />
                    College
                  </label>
                  <select
                    required
                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all bg-white font-medium"
                    value={formData.college}
                    onChange={(e) => setFormData((prev) => ({ ...prev, college: e.target.value, program: '' }))}
                  >
                    <option value="" disabled>Select college</option>
                    {studentAcademicOptions.colleges.map((college) => (
                      <option key={college} value={college}>{college}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wider">
                    <GraduationCap size={16} className="text-primary" />
                    Department / Program
                  </label>
                  <select
                    required
                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all bg-white font-medium disabled:bg-slate-50 disabled:text-slate-500"
                    value={formData.program}
                    onChange={(e) => setFormData((prev) => ({ ...prev, program: e.target.value }))}
                    disabled={!formData.college}
                  >
                    <option value="" disabled>
                      {formData.college ? 'Select department / program' : 'Select a college first'}
                    </option>
                    {availableStudentPrograms.map((program) => (
                      <option key={program} value={program}>{program}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="space-y-4">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wider">
                <FileText size={16} className="text-primary" />
                Select Service
              </label>
              {isRescheduleMode && (
                <div className="rounded-2xl border border-primary/10 bg-primary/5 px-4 py-3 text-xs font-semibold text-primary">
                  Rescheduling keeps the same service. If you need a different service, create a new appointment instead.
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {serviceOptions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    disabled={isRescheduleMode}
                    onClick={() => {
                      if (isRescheduleMode) return;
                      setFormData({
                        ...formData,
                        service: s.id,
                        subcategory: getDefaultSubcategoryForService(s.id),
                        purpose: '',
                      });
                    }}
                    className={`p-4 rounded-2xl border text-left transition-all ${formData.service === s.id
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-slate-200 hover:border-primary/30'
                      } ${isRescheduleMode ? 'cursor-not-allowed opacity-80' : ''}`}
                  >
                    <p className={`font-bold ${formData.service === s.id ? 'text-primary' : 'text-slate-700'}`}>{s.label}</p>
                    <p className="text-[10px] text-slate-400 mt-1 leading-tight">{s.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wider">
                <Tag size={16} className="text-primary" />
                Sub-category
              </label>
              {isSingleSubcategoryOption && formData.service ? (
                <div className="w-full px-5 py-4 rounded-2xl border border-slate-200 bg-slate-50 text-base font-medium text-slate-700">
                  {formData.subcategory || availableSubcategories[0]}
                </div>
              ) : (
                <select
                  required
                  className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all bg-white font-medium disabled:bg-slate-50 disabled:text-slate-500"
                  value={formData.subcategory}
                  onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                  disabled={!formData.service}
                >
                  <option value="" disabled>
                    {formData.service ? 'Select sub-category' : 'Select a service first'}
                  </option>
                  {availableSubcategories.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wider">
                <ClipboardList size={16} className="text-primary" />
                Purpose of Appointment
              </label>
              <select
                required
                className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all bg-white font-medium"
                value={formData.purpose}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                disabled={!formData.service}
              >
                <option value="" disabled>
                  {formData.service ? 'Select purpose' : 'Select a service first'}
                </option>
                {availablePurposes.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Additional Notes</label>
              <textarea
                rows={2}
                className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all resize-none font-medium"
                placeholder="Any specific concerns..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            {shouldShowRequirementUpload && (
              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                  Medical Requirements Upload
                </label>
                {isRescheduleMode && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
                    Re-uploading medical requirements is optional when you are only rescheduling an upcoming appointment.
                  </div>
                )}
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">
                      Chest Xray:
                    </label>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={(e) => handleRequirementGroupChange('chestXray', e.target.files)}
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-sm text-slate-700 file:mr-3 file:rounded-xl file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-bold file:text-white"
                    />
                    <p className="text-xs text-slate-500">
                      {requirementFileGroups.chestXray.length > 0
                        ? `Selected: ${requirementFileGroups.chestXray.map((file) => file.name).join(', ')}`
                        : 'Choose file/s'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">
                      Urinalyses:
                    </label>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={(e) => handleRequirementGroupChange('urinalysis', e.target.files)}
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-sm text-slate-700 file:mr-3 file:rounded-xl file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-bold file:text-white"
                    />
                    <p className="text-xs text-slate-500">
                      {requirementFileGroups.urinalysis.length > 0
                        ? `Selected: ${requirementFileGroups.urinalysis.map((file) => file.name).join(', ')}`
                        : 'Choose file/s'}
                    </p>
                  </div>
                </div>
                {requirementFiles.length > 0 && (
                  <p className="text-xs text-slate-500">
                    Uploaded files: {requirementFiles.map((file) => file.name).join(', ')}
                  </p>
                )}
                <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs font-semibold">
                  {MEDICAL_REQUIREMENT_NOTICE}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={
                isSubmitting ||
                !formData.service ||
                !formData.subcategory ||
                !formData.purpose ||
                !formData.timeSlot ||
                (isGuestUser && (!formData.patientName.trim() || !formData.guestType.trim())) ||
                (isStudentBookingUser && (!formData.college.trim() || !formData.program.trim()))
              }
              className={`w-full py-4 sm:py-5 rounded-xl sm:rounded-2xl font-black text-base sm:text-lg text-white transition-all flex items-center justify-center gap-3 shadow-xl ${isSubmitting ? 'bg-emerald-500' : 'bg-primary hover:bg-primary-hover shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
            >
              {isSubmitting ? (
                <>
                  <CheckCircle2 size={24} />
                  Processing...
                </>
              ) : (
                isRescheduleMode ? 'Confirm Reschedule' : 'Confirm Appointment'
              )}
            </button>
          </form>
        </div>
      </div>
    </>
  );
};
