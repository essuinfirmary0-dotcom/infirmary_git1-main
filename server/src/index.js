import express from 'express';
import crypto from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkDatabaseConnection, pool } from './config/db.js';

dotenv.config();

const app = express();
app.set('trust proxy', true);
const port = Number(process.env.PORT || 5000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../uploads');
const clientDistDir = path.resolve(__dirname, '../../dist');
const clientIndexPath = path.join(clientDistDir, 'index.html');
const isProduction = process.env.NODE_ENV === 'production';
const sessionTtlMs = Math.max(Number(process.env.AUTH_TOKEN_TTL_MS || 7 * 24 * 60 * 60 * 1000), 5 * 60 * 1000);
const authTokenSecret = String(process.env.AUTH_TOKEN_SECRET || process.env.JWT_SECRET || '').trim();
const configuredAllowedOrigins = String(process.env.CORS_ORIGIN || process.env.CORS_ORIGINS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const defaultDevOrigins = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);
const supabaseUrl = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const supabaseServiceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const supabaseStorageBucket = String(process.env.SUPABASE_STORAGE_BUCKET || '').trim();
const supabaseSignedUrlTtlSeconds = Math.max(Number(process.env.SUPABASE_STORAGE_SIGNED_URL_TTL || 60 * 60), 60);
const isSupabaseStorageConfigured = Boolean(supabaseUrl && supabaseServiceRoleKey && supabaseStorageBucket);
const PASSWORD_HASH_PREFIX = 'scrypt';
const PASSWORD_HASH_KEY_LENGTH = 64;
const PASSWORD_SALT_BYTES = 16;

fs.mkdirSync(uploadsDir, { recursive: true });

if (isProduction && !authTokenSecret) {
  throw new Error('AUTH_TOKEN_SECRET is required in production.');
}

function getRequestBaseOrigin(req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim();
  const forwardedHost = String(req.headers['x-forwarded-host'] || '')
    .split(',')[0]
    .trim();
  const host = forwardedHost || String(req.headers.host || '').split(',')[0].trim();
  const protocol = forwardedProto || req.protocol || (isProduction ? 'https' : 'http');

  if (!host) {
    return '';
  }

  return `${protocol}://${host}`;
}

function isOriginAllowed(origin, requestBaseOrigin = '') {
  if (!origin) {
    return true;
  }

  if (requestBaseOrigin && origin === requestBaseOrigin) {
    return true;
  }

  if (configuredAllowedOrigins.length > 0) {
    return configuredAllowedOrigins.includes(origin);
  }

  return !isProduction || defaultDevOrigins.has(origin);
}

app.use((req, res, next) => {
  const requestOrigin = String(req.headers.origin || '').trim();
  const requestBaseOrigin = getRequestBaseOrigin(req);

  if (requestOrigin && !isOriginAllowed(requestOrigin, requestBaseOrigin)) {
    return res.status(403).json({ message: 'This origin is not allowed to access the API.' });
  }

  if (requestOrigin && isOriginAllowed(requestOrigin, requestBaseOrigin)) {
    res.header('Access-Control-Allow-Origin', requestOrigin);
    res.header('Vary', 'Origin');
  }
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
});

app.use(express.json({ limit: '25mb' }));
if (!isSupabaseStorageConfigured) {
  app.use('/uploads', express.static(uploadsDir));
}

function normalizeIdentifier(value) {
  return String(value || '').trim();
}

const APPOINTMENT_SUBCATEGORY_OPTIONS = Object.freeze({
  Medical: ['Certification', 'Consultation'],
  Dental: ['Consultation'],
  Nutrition: ['Consultation'],
});

function getAllowedAppointmentSubcategories(service) {
  return APPOINTMENT_SUBCATEGORY_OPTIONS[normalizeIdentifier(service)] || [];
}

function isValidAppointmentService(service) {
  return getAllowedAppointmentSubcategories(service).length > 0;
}

function isValidAppointmentSubcategory(service, subcategory) {
  return getAllowedAppointmentSubcategories(service).includes(normalizeIdentifier(subcategory));
}

function appointmentAllowsRequirementUploads(service, subcategory) {
  return (
    normalizeIdentifier(service) === 'Medical' &&
    normalizeIdentifier(subcategory) === 'Certification'
  );
}

function normalizeCredential(value) {
  return String(value || '').trim();
}

function getDefaultPasswordForUser(user) {
  return normalizeCredential(user?.student_number || user?.employee_number || user?.id_number || '');
}

function timingSafeCompare(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

function isStoredPasswordHash(value) {
  return String(value || '').startsWith(`${PASSWORD_HASH_PREFIX}$`);
}

function hashPassword(password) {
  const normalizedPassword = normalizeCredential(password);
  if (!normalizedPassword) {
    throw new Error('Password is required.');
  }

  const salt = crypto.randomBytes(PASSWORD_SALT_BYTES).toString('hex');
  const derivedKey = crypto.scryptSync(normalizedPassword, salt, PASSWORD_HASH_KEY_LENGTH).toString('hex');
  return `${PASSWORD_HASH_PREFIX}$${salt}$${derivedKey}`;
}

function verifyHashedPassword(password, storedHash) {
  const [prefix, salt, expectedHash] = String(storedHash || '').split('$');
  if (prefix !== PASSWORD_HASH_PREFIX || !salt || !expectedHash) {
    return false;
  }

  const computedHash = crypto.scryptSync(normalizeCredential(password), salt, PASSWORD_HASH_KEY_LENGTH).toString('hex');
  return timingSafeCompare(expectedHash, computedHash);
}

async function doesPasswordMatch(user, candidatePassword) {
  const providedPassword = normalizeCredential(candidatePassword);
  const storedPassword = normalizeCredential(user?.password_hash);

  if (storedPassword) {
    if (isStoredPasswordHash(storedPassword)) {
      return {
        matches: verifyHashedPassword(providedPassword, storedPassword),
        shouldUpgradeHash: false,
      };
    }

    const matches = timingSafeCompare(storedPassword, providedPassword);
    return {
      matches,
      shouldUpgradeHash: matches,
    };
  }

  const fallbackPassword = getDefaultPasswordForUser(user);
  const matches = Boolean(fallbackPassword) && timingSafeCompare(fallbackPassword, providedPassword);
  return {
    matches,
    shouldUpgradeHash: matches,
  };
}

function getEffectiveUserType(user) {
  return user?.user_type || user?.role || null;
}

function isGuestUserType(userType) {
  return String(userType || '').trim().toLowerCase() === 'guest';
}

const STUDENT_USER_TYPES = new Set(['student', 'new', 'old']);
const NON_EMPLOYEE_USER_TYPES = new Set(['guest', 'admin', 'super_admin']);

function normalizeUserType(userType) {
  return String(userType || '').trim().toLowerCase();
}

function isInternalGeneratedIdentifier(value) {
  return /^(?:NS|EM)-\d+$/i.test(normalizeIdentifier(value));
}

function pickActualIdentifier(...values) {
  const candidates = values.map((value) => normalizeIdentifier(value)).filter(Boolean);
  return candidates.find((value) => !isInternalGeneratedIdentifier(value)) || null;
}

function isEmployeeLikeUser(user) {
  const normalizedUserType = normalizeUserType(getEffectiveUserType(user));

  if (!normalizedUserType) {
    return false;
  }

  if (STUDENT_USER_TYPES.has(normalizedUserType) || NON_EMPLOYEE_USER_TYPES.has(normalizedUserType)) {
    return false;
  }

  return true;
}

function resolveActualUserIdentifier(user) {
  const idNumber = normalizeIdentifier(user?.id_number);
  const studentNumber = normalizeIdentifier(user?.student_number);
  const employeeNumber = normalizeIdentifier(user?.employee_number);

  if (isEmployeeLikeUser(user)) {
    return pickActualIdentifier(idNumber, employeeNumber, studentNumber) || idNumber || null;
  }

  return pickActualIdentifier(idNumber, studentNumber, employeeNumber) || idNumber || null;
}

function resolveEmployeePosition(user) {
  return normalizeIdentifier(user?.faculty_designation)
    || normalizeIdentifier(user?.faculty_position)
    || normalizeIdentifier(user?.faculty_academic_rank)
    || normalizeIdentifier(user?.role)
    || '';
}

function resolveEmployeeDepartment(user) {
  return normalizeIdentifier(user?.faculty_department)
    || normalizeIdentifier(user?.program)
    || normalizeIdentifier(user?.faculty_college)
    || normalizeIdentifier(user?.college)
    || '';
}

const AUTH_USER_SELECT = `
  SELECT
    u.id,
    u.firstname,
    u.middle_initial,
    u.lastname,
    u.email,
    u.user_type,
    u.picture_url,
    u.student_number,
    u.employee_number,
    u.college,
    u.program,
    u.qr_code,
    u.qr_data,
    u.phone,
    u.address,
    u.id_number,
    u.role,
    u.status,
    u.password_hash,
    f.department AS faculty_department,
    f.college AS faculty_college,
    f.position AS faculty_position,
    f.designation AS faculty_designation,
    f.academic_rank AS faculty_academic_rank
  FROM public.users_auth AS u
  LEFT JOIN LATERAL (
    SELECT
      department,
      college,
      position,
      designation,
      academic_rank,
      updated_at,
      created_at
    FROM public.faculties
    WHERE auth_user_id = u.id
    ORDER BY
      CASE
        WHEN COALESCE(NULLIF(designation, ''), NULLIF(position, ''), NULLIF(academic_rank, ''), NULLIF(department, ''), NULLIF(college, '')) IS NULL THEN 1
        ELSE 0
      END,
      updated_at DESC NULLS LAST,
      created_at DESC NULLS LAST
    LIMIT 1
  ) AS f ON TRUE
`;

async function fetchAuthUserById(userId) {
  const { rows } = await pool.query(
    `
      ${AUTH_USER_SELECT}
      WHERE u.id = $1
      LIMIT 1
    `,
    [userId],
  );

  return rows[0] || null;
}

async function findAuthUserByLoginIdentifier(identifier) {
  const normalizedLookup = normalizeIdentifier(identifier).toUpperCase();

  if (!normalizedLookup) {
    return null;
  }

  const { rows } = await pool.query(
    `
      ${AUTH_USER_SELECT}
      WHERE UPPER(COALESCE(u.id_number, '')) = $1
         OR UPPER(COALESCE(u.student_number, '')) = $1
         OR UPPER(COALESCE(u.employee_number, '')) = $1
      ORDER BY
        CASE WHEN LOWER(COALESCE(u.status, '')) = 'active' THEN 0 ELSE 1 END,
        u.created_at DESC,
        u.updated_at DESC NULLS LAST
      LIMIT 1
    `,
    [normalizedLookup],
  );

  return rows[0] || null;
}

function getUserDisplayName(user) {
  return [user?.firstname, user?.lastname].filter(Boolean).join(' ') || user?.email || user?.id_number || 'Unknown User';
}

function mapManagedUserRow(user) {
  return {
    id: user.id,
    firstName: user.firstname || '',
    middleName: user.middle_initial || '',
    lastName: user.lastname || '',
    name: [user.firstname, user.middle_initial, user.lastname].filter(Boolean).join(' '),
    email: user.email || '',
    phone: user.phone || '',
    address: user.address || '',
    idNumber: user.id_number || null,
    employeeNumber: user.employee_number || null,
    userType: getEffectiveUserType(user),
    role: user.role || null,
    status: user.status || null,
    createdAt: user.created_at || null,
    updatedAt: user.updated_at || null,
  };
}

const DEFAULT_TIME_SLOTS = [
  { timeSlot: '12:00 AM - 7:00 AM', maxCapacity: 50, sortOrder: 0 },
  { timeSlot: '8:00 AM - 11:00 AM', maxCapacity: 50, sortOrder: 1 },
  { timeSlot: '1:00 PM - 4:00 PM', maxCapacity: 50, sortOrder: 2 },
  { timeSlot: '4:00 PM - 7:00 PM', maxCapacity: 50, sortOrder: 3 },
  { timeSlot: '7:00 PM - 11:00 PM', maxCapacity: 50, sortOrder: 4 },
];
const DEFAULT_TIME_SLOT_MAP = new Map(DEFAULT_TIME_SLOTS.map((slot) => [slot.timeSlot, slot]));
let cachedAppointmentStatuses = null;

function parseAuthToken(token) {
  try {
    const [encodedPayload, providedSignature] = String(token || '').split('.');
    if (!encodedPayload || !providedSignature || !authTokenSecret) {
      return null;
    }

    const expectedSignature = crypto.createHmac('sha256', authTokenSecret).update(encodedPayload).digest('base64url');
    if (!timingSafeCompare(providedSignature, expectedSignature)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (!payload?.sub || !Number.isFinite(Number(payload?.exp)) || Number(payload.exp) < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function createSessionToken(user, loginIdentifier = '') {
  if (!authTokenSecret) {
    throw new Error('AUTH_TOKEN_SECRET is not configured.');
  }

  const issuedAt = Date.now();
  const payload = {
    sub: user.id,
    studentId: user.id_number || user.student_number || user.employee_number || loginIdentifier || null,
    userType: getEffectiveUserType(user) || 'student',
    iat: issuedAt,
    exp: issuedAt + sessionTtlMs,
    ver: 1,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', authTokenSecret).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

async function loadAuthenticatedUser(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  const payload = parseAuthToken(token);
  if (!payload?.sub) {
    return res.status(401).json({ message: 'Invalid session token.' });
  }

  try {
    const user = await fetchAuthUserById(payload.sub);

    if (!user) {
      return res.status(401).json({ message: 'Session user was not found.' });
    }

    if (String(user.status || '').toLowerCase() === 'blocked') {
      return res.status(403).json({ message: 'This account is blocked. Please contact the super admin.' });
    }

    req.authTokenPayload = payload;
    req.authUser = user;
    return next();
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load authenticated user.', error: error.message });
  }
}

function buildUserPayload(user) {
  const userType = getEffectiveUserType(user) || 'student';
  const studentUser = STUDENT_USER_TYPES.has(normalizeUserType(userType));
  const employeeUser = isEmployeeLikeUser({ ...user, user_type: userType });
  const guestUser = isGuestUserType(userType);
  const actualIdentifier = resolveActualUserIdentifier({ ...user, user_type: userType });

  return {
    id: user.id,
    firstName: user.firstname || '',
    middleName: user.middle_initial || '',
    lastName: user.lastname || '',
    email: user.email || '',
    userType,
    pictureUrl: user.picture_url || null,
    studentNumber: studentUser ? actualIdentifier : null,
    employeeNumber: employeeUser ? actualIdentifier : null,
    college: studentUser
      ? normalizeIdentifier(user.college) || normalizeIdentifier(user.faculty_college) || ''
      : normalizeIdentifier(user.faculty_college) || normalizeIdentifier(user.college) || '',
    program: studentUser
      ? normalizeIdentifier(user.program) || ''
      : normalizeIdentifier(user.program) || normalizeIdentifier(user.faculty_department) || '',
    department: employeeUser ? resolveEmployeeDepartment(user) : '',
    position: employeeUser ? resolveEmployeePosition(user) : '',
    qrCode: user.qr_code || null,
    qrData: guestUser ? normalizeIdentifier(user.qr_data) || actualIdentifier : actualIdentifier || normalizeIdentifier(user.qr_data) || null,
    phone: user.phone || '',
    address: user.address || '',
    idNumber: user.id_number || null,
    role: user.role || null,
    status: user.status || null,
  };
}

async function generateGuestIdentifier() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = Math.floor(100000 + (Math.random() * 900000));
    const identifier = `GST-${suffix}`;
    const { rows } = await pool.query(
      `
        SELECT id
        FROM public.users_auth
        WHERE UPPER(COALESCE(id_number, '')) = UPPER($1)
        LIMIT 1
      `,
      [identifier],
    );

    if (!rows[0]) {
      return identifier;
    }
  }

  return `GST-${Date.now().toString().slice(-6)}`;
}

function resolveKioskReceiptIdentity(user) {
  const normalizedUserType = normalizeUserType(getEffectiveUserType(user));
  const studentNumber = normalizeIdentifier(user?.student_number);
  const employeeNumber = normalizeIdentifier(user?.employee_number);
  const idNumber = normalizeIdentifier(user?.id_number);
  const guestIdentifier = idNumber || normalizeIdentifier(user?.qr_data);

  if (isGuestUserType(normalizedUserType)) {
    return {
      type: 'guest',
      label: 'Guest ID',
      value: guestIdentifier || null,
    };
  }

  if (isEmployeeLikeUser(user)) {
    return {
      type: 'employee',
      label: 'Employee Number',
      value: employeeNumber || idNumber || null,
    };
  }

  return {
    type: 'student',
    label: 'Student ID Number',
    value: idNumber || studentNumber || null,
  };
}

function buildKioskUserPayload(user) {
  const receiptIdentity = resolveKioskReceiptIdentity(user);

  return {
    id: user.id,
    name: [user.firstname, user.middle_initial, user.lastname].filter(Boolean).join(' ') || user.email || user.id_number || 'Guest',
    userType: getEffectiveUserType(user) || receiptIdentity.type || null,
    studentNumber: receiptIdentity.type === 'student' ? receiptIdentity.value : null,
    employeeNumber: receiptIdentity.type === 'employee' ? receiptIdentity.value : null,
    guestId: receiptIdentity.type === 'guest' ? receiptIdentity.value : null,
    receiptIdType: receiptIdentity.type,
    receiptIdLabel: receiptIdentity.label,
    receiptIdValue: receiptIdentity.value,
    college: user.college || '',
    program: user.program || '',
  };
}

function formatMinutesToClockLabel(totalMinutes) {
  const normalizedMinutes = Number(totalMinutes);
  if (!Number.isFinite(normalizedMinutes)) {
    return '';
  }

  const hour24 = Math.floor(normalizedMinutes / 60);
  const minute = normalizedMinutes % 60;
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function mapAppointmentRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    appointmentCode: row.appointment_code,
    patientName: row.patient_name,
    service: row.service,
    subcategory: row.subcategory,
    purpose: row.purpose,
    date: row.appointment_date,
    time: formatTimeSlotLabel(row.time_slot),
    notes: row.notes || '',
    status: mapAppointmentStatusFromDatabase(row.status, row.cancelled_at),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    slotDefinitionId: row.slot_definition_id || null,
    cancelledAt: row.cancelled_at || null,
    cancellationReason: row.cancellation_reason || '',
    college: row.appointment_college || '',
    program: row.appointment_program || '',
    studentNumber: row.appointment_student_number || null,
    employeeNumber: row.appointment_employee_number || null,
    idNumber: row.appointment_id_number || null,
    userType: getEffectiveUserType({
      user_type: row.appointment_user_type,
      role: row.appointment_user_role,
    }) || null,
  };
}

function mapAppointmentStatusFromDatabase(status, cancelledAt = null) {
  const normalized = String(status || '').trim();
  if (cancelledAt) return 'Cancelled';
  if (normalized === 'Success') return 'Completed';
  if (normalized === 'Cancelled') return 'Not Completed';
  return normalized || 'Waiting';
}

async function toDatabaseAppointmentStatus(status) {
  const normalized = String(status || '').trim();
  const allowedStatuses = await getAllowedAppointmentStatuses();

  if (allowedStatuses.includes(normalized)) {
    return normalized;
  }

  const fallbackCandidates = {
    Waiting: ['Ongoing'],
    Ongoing: ['Ongoing'],
    Completed: ['Success', 'Completed', 'Ongoing'],
    Cancelled: ['Cancelled', 'Not Completed', 'Ongoing'],
    'Not Completed': ['Cancelled', 'Not Completed', 'Ongoing'],
  };

  const candidates = fallbackCandidates[normalized] || [normalized];
  return candidates.find((candidate) => allowedStatuses.includes(candidate)) || allowedStatuses[0] || normalized;
}

function mapQueueStatus(status) {
  const normalized = String(status || '').trim();
  if (normalized === 'Done') return 'Completed';
  if (normalized === 'Cancelled') return 'Skipped';
  return normalized || 'Waiting';
}

function toDatabaseQueueStatus(status) {
  const normalized = String(status || '').trim();
  if (normalized === 'Completed') return 'Done';
  if (normalized === 'Skipped') return 'Cancelled';
  return normalized || 'Waiting';
}

function mapQueueRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    queueNumber: row.queue_number,
    appointmentId: row.appointment_id || null,
    createdAt: row.created_at || null,
    checkedInAt: row.checked_in_at || null,
    status: mapQueueStatus(row.status),
    user: row.user_id
      ? {
        id: row.user_id,
        name: [row.user_firstname, row.user_middle_initial, row.user_lastname].filter(Boolean).join(' ') || row.user_email || 'Unknown',
        email: row.user_email || '',
        studentNumber: row.user_student_number || null,
        employeeNumber: row.user_employee_number || null,
        idNumber: row.user_id_number || null,
        college: row.user_college || '',
        program: row.user_program || '',
        userType: getEffectiveUserType({
          user_type: row.user_user_type,
          role: row.user_role,
        }) || null,
      }
      : null,
    appointment: row.appointment_id
      ? {
        id: row.appointment_id,
        code: row.appointment_code || '',
        patientName: row.patient_name || '',
        date: row.appointment_date || null,
        time: row.appointment_time || '',
        service: row.appointment_service || '',
        subcategory: row.appointment_subcategory || '',
        purpose: row.appointment_purpose || '',
        notes: row.appointment_notes || '',
        status: row.appointment_status || '',
      }
      : null,
  };
}

async function ensureQueueCheckInTracking() {
  await pool.query(`
    ALTER TABLE public.queues
    ADD COLUMN IF NOT EXISTS checked_in_at timestamp with time zone
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_queues_checked_in_at
    ON public.queues(checked_in_at)
  `);
}

async function ensureAppointmentCancellationTracking() {
  await pool.query(`
    ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone
  `);

  await pool.query(`
    ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS cancellation_reason text
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_appointments_cancelled_at
    ON public.appointments(cancelled_at)
  `);
}

function mapKioskAppointment(appointment) {
  if (!appointment) {
    return null;
  }

  return {
    id: appointment.id,
    code: appointment.appointment_code || '',
    patientName: appointment.patient_name || '',
    date: appointment.appointment_date || null,
    time: formatTimeSlotLabel(appointment.time_slot),
    service: appointment.service || '',
    subcategory: appointment.subcategory || '',
    purpose: appointment.purpose || '',
    notes: appointment.notes || '',
    status: appointment.status || '',
  };
}

function getTimeInTimeZoneParts(date = new Date(), timeZone = 'Asia/Manila') {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type) => parts.find((part) => part.type === type)?.value || '';

  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
    hour: Number(getPart('hour') || 0),
    minute: Number(getPart('minute') || 0),
  };
}

function getTodayInManila(date = new Date()) {
  const parts = getTimeInTimeZoneParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getCurrentMinutesInManila(date = new Date()) {
  const parts = getTimeInTimeZoneParts(date);
  return (parts.hour * 60) + parts.minute;
}

function parseClockToMinutes(value) {
  const match = String(value || '').trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) {
    return null;
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2] || '0');
  const meridiem = String(match[3] || '').toUpperCase();
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  if (meridiem) {
    if (hours < 1 || hours > 12) {
      return null;
    }
    if (meridiem === 'AM') {
      hours = hours === 12 ? 0 : hours;
    } else if (meridiem === 'PM') {
      hours = hours === 12 ? 12 : hours + 12;
    }
  }

  return (hours * 60) + minutes;
}

function parseTimeSlotRange(timeSlot) {
  const normalized = String(timeSlot || '').trim();
  const match = normalized.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i);
  if (!match) {
    return null;
  }

  const startMinutes = parseClockToMinutes(match[1]);
  const endMinutes = parseClockToMinutes(match[2]);
  if (startMinutes == null || endMinutes == null) {
    return null;
  }

  return {
    startMinutes,
    endMinutes,
  };
}

function formatTimeSlotLabel(timeSlot) {
  const slotRange = parseTimeSlotRange(timeSlot);
  if (!slotRange) {
    return String(timeSlot || '').trim();
  }

  return `${formatMinutesToClockLabel(slotRange.startMinutes)} - ${formatMinutesToClockLabel(slotRange.endMinutes)}`;
}

function evaluateAppointmentArrivalWindow(timeSlot, date = new Date()) {
  const slotRange = parseTimeSlotRange(timeSlot);
  if (!slotRange) {
    return { status: 'unknown', slotRange: null };
  }

  const nowMinutes = getCurrentMinutesInManila(date);
  if (nowMinutes < slotRange.startMinutes) {
    return { status: 'early', slotRange };
  }

  if (nowMinutes > slotRange.endMinutes) {
    return { status: 'missed', slotRange };
  }

  return { status: 'active', slotRange };
}

function evaluateScheduledAppointmentState(appointmentDate, timeSlot, date = new Date()) {
  const normalizedDate = String(appointmentDate || '').trim();
  const slotRange = parseTimeSlotRange(timeSlot);

  if (!normalizedDate) {
    return { status: 'unknown', slotRange };
  }

  const today = getTodayInManila(date);
  if (normalizedDate > today) {
    return { status: 'upcoming', slotRange };
  }

  if (normalizedDate < today) {
    return { status: 'past', slotRange };
  }

  if (!slotRange) {
    return { status: 'unknown', slotRange: null };
  }

  const nowMinutes = getCurrentMinutesInManila(date);
  if (nowMinutes < slotRange.startMinutes) {
    return { status: 'upcoming', slotRange };
  }

  if (nowMinutes <= slotRange.endMinutes) {
    return { status: 'active', slotRange };
  }

  return { status: 'past', slotRange };
}

function formatKioskCheckInDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function buildKioskResult({ user, appointment, queueNumber, checkInDate = new Date() }) {
  return {
    queueNumber: queueNumber || '',
    checkInDate: getTodayInManila(checkInDate),
    checkInDateDisplay: formatKioskCheckInDate(checkInDate),
    checkInConfirmed: Boolean(queueNumber),
    confirmationRequired: Boolean(appointment && !queueNumber),
    user: buildKioskUserPayload(user),
    hasAppointmentToday: Boolean(appointment),
    appointment: mapKioskAppointment(appointment),
  };
}

function mapPatientRow(row) {
  return {
    id: row.id,
    name: [row.firstname, row.middle_initial, row.lastname].filter(Boolean).join(' ') || row.email || row.student_number || row.employee_number || 'Unknown patient',
    email: row.email || '',
    studentNumber: row.student_number || null,
    employeeNumber: row.employee_number || null,
  };
}

function extensionFromMime(mime) {
  const normalized = String(mime || '').toLowerCase();
  if (normalized.includes('png')) return '.png';
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return '.jpg';
  if (normalized.includes('gif')) return '.gif';
  if (normalized.includes('webp')) return '.webp';
  if (normalized.includes('bmp')) return '.bmp';
  if (normalized.includes('svg')) return '.svg';
  if (normalized.includes('pdf')) return '.pdf';
  if (normalized.includes('msword')) return '.doc';
  if (normalized.includes('wordprocessingml')) return '.docx';
  if (normalized.includes('plain')) return '.txt';
  return '';
}

function buildStoredFileName(originalName, extension) {
  const rawBaseName = path.basename(String(originalName || '')).trim();
  const rawNameWithoutExtension = rawBaseName ? rawBaseName.replace(/\.[^/.]+$/, '') : 'file';
  const safeName = rawNameWithoutExtension.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'file';
  const normalizedExtension = extension || path.extname(rawBaseName) || '';
  return `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${safeName}${normalizedExtension}`;
}

function encodeSupabaseStoragePath(storagePath) {
  return String(storagePath || '')
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

async function uploadBufferToSupabaseStorage({ buffer, storagePath, mimeType }) {
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${encodeURIComponent(supabaseStorageBucket)}/${encodeSupabaseStoragePath(storagePath)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
        apikey: supabaseServiceRoleKey,
        'Content-Type': mimeType || 'application/octet-stream',
        'x-upsert': 'true',
      },
      body: buffer,
    },
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Supabase Storage upload failed (${response.status})${errorText ? `: ${errorText}` : ''}`);
  }
}

async function createSupabaseSignedUrl(storagePath) {
  if (!isSupabaseStorageConfigured || !storagePath) {
    return null;
  }

  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/sign/${encodeURIComponent(supabaseStorageBucket)}/${encodeSupabaseStoragePath(storagePath)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
        apikey: supabaseServiceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: supabaseSignedUrlTtlSeconds }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Failed to create signed attachment URL (${response.status})${errorText ? `: ${errorText}` : ''}`);
  }

  const data = await response.json().catch(() => null);
  return data?.signedURL ? `${supabaseUrl}/storage/v1${data.signedURL}` : null;
}

async function appendAttachmentUrl(attachment) {
  if (!attachment?.attachmentPath) {
    return {
      ...attachment,
      attachmentUrl: null,
    };
  }

  if (!isSupabaseStorageConfigured) {
    return {
      ...attachment,
      attachmentUrl: null,
    };
  }

  return {
    ...attachment,
    attachmentUrl: await createSupabaseSignedUrl(attachment.attachmentPath),
  };
}

async function appendAttachmentUrls(attachments = []) {
  return Promise.all((attachments || []).map((attachment) => appendAttachmentUrl(attachment)));
}

async function saveDataUrlAttachment({ dataUrl, mimeType, originalName, storageCategory = 'attachments' }) {
  const match = String(dataUrl || '').match(/^data:(.+?);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid attachment payload.');
  }

  const detectedMime = match[1] || mimeType || 'application/octet-stream';
  const extension = extensionFromMime(detectedMime) || path.extname(originalName || '') || '';
  const fileName = buildStoredFileName(originalName, extension);
  const buffer = Buffer.from(match[2], 'base64');

  if (isSupabaseStorageConfigured) {
    const storagePath = `${storageCategory}/${new Date().toISOString().slice(0, 10)}/${fileName}`;
    await uploadBufferToSupabaseStorage({
      buffer,
      storagePath,
      mimeType: detectedMime,
    });

    return {
      attachmentPath: storagePath,
      attachmentMime: detectedMime,
      originalName: originalName || fileName,
    };
  }

  if (isProduction) {
    throw new Error('Supabase Storage is not configured. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_STORAGE_BUCKET.');
  }

  const absolutePath = path.join(uploadsDir, fileName);
  await fs.promises.writeFile(absolutePath, buffer);

  return {
    attachmentPath: fileName,
    attachmentMime: detectedMime,
    originalName: originalName || fileName,
  };
}

async function ensureAppointmentAttachmentsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.appointment_attachments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
      attachment_path text NOT NULL,
      attachment_mime text NOT NULL,
      requirement_label text,
      original_name text,
      created_at timestamp with time zone NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    ALTER TABLE public.appointment_attachments
    ADD COLUMN IF NOT EXISTS requirement_label text
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_appointment_attachments_appointment_id
    ON public.appointment_attachments(appointment_id)
  `);
}

async function ensureMedicalRecordAttachmentLabels() {
  await pool.query(`
    ALTER TABLE public.medical_record_attachments
    ADD COLUMN IF NOT EXISTS requirement_label text
  `);
}

async function getAppointmentAttachments(appointmentId, client = pool) {
  if (!appointmentId) return [];

  const { rows } = await client.query(
    `
      SELECT id, appointment_id, attachment_path, attachment_mime, requirement_label, original_name, created_at
      FROM public.appointment_attachments
      WHERE appointment_id = $1
      ORDER BY created_at ASC
    `,
    [appointmentId],
  );

  return rows.map((row) => ({
    id: row.id,
    appointmentId: row.appointment_id,
    attachmentPath: row.attachment_path,
    attachmentMime: row.attachment_mime,
    requirementLabel: row.requirement_label || null,
    originalName: row.original_name || null,
    createdAt: row.created_at,
  }));
}

async function replaceAppointmentAttachments(client, appointmentId, attachments = []) {
  if (!appointmentId) return [];

  await client.query(
    `
      DELETE FROM public.appointment_attachments
      WHERE appointment_id = $1
    `,
    [appointmentId],
  );

  const savedAttachments = [];
  for (const attachment of attachments) {
    if (!attachment?.dataUrl) continue;
    const requirementLabel = String(attachment.label || '').trim() || null;
    const saved = await saveDataUrlAttachment({
      dataUrl: attachment.dataUrl,
      mimeType: attachment.type,
      originalName: attachment.name,
      storageCategory: 'appointments',
    });

    await client.query(
      `
        INSERT INTO public.appointment_attachments (
          appointment_id,
          attachment_path,
          attachment_mime,
          requirement_label,
          original_name
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [appointmentId, saved.attachmentPath, saved.attachmentMime, requirementLabel, saved.originalName],
    );

    savedAttachments.push({
      ...saved,
      requirementLabel,
    });
  }

  return savedAttachments;
}

async function generateQueueNumberForDate(date) {
  const { rows } = await pool.query(
    `
      SELECT COUNT(*)::int AS total
      FROM public.queues q
      LEFT JOIN public.appointments a ON a.id = q.appointment_id
      WHERE q.checked_in_at IS NOT NULL
        AND COALESCE(a.appointment_date, DATE(q.checked_in_at AT TIME ZONE 'Asia/Manila')) = $1
    `,
    [date],
  );

  const nextNumber = (rows[0]?.total || 0) + 1;
  return `Q-${String(nextNumber).padStart(3, '0')}`;
}

async function ensureQueueForAppointment(appointmentRow) {
  if (!appointmentRow?.id || !appointmentRow?.user_id) {
    return null;
  }

  const existing = await pool.query(
    `
      SELECT *
      FROM public.queues
      WHERE appointment_id = $1
      LIMIT 1
    `,
    [appointmentRow.id],
  );

  if (existing.rows[0]) {
    if (existing.rows[0].checked_in_at) {
      return existing.rows[0];
    }

    const queueNumber = await generateQueueNumberForDate(appointmentRow.appointment_date);
    const { rows } = await pool.query(
      `
        UPDATE public.queues
        SET queue_number = $2,
            status = 'Waiting',
            checked_in_at = now(),
            created_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [existing.rows[0].id, queueNumber],
    );

    return rows[0] || existing.rows[0];
  }

  const queueNumber = await generateQueueNumberForDate(appointmentRow.appointment_date);
  const { rows } = await pool.query(
    `
      INSERT INTO public.queues (
        user_id,
        queue_number,
        appointment_id,
        status,
        checked_in_at
      )
      VALUES ($1, $2, $3, 'Waiting', now())
      RETURNING *
    `,
    [appointmentRow.user_id, queueNumber, appointmentRow.id],
  );

  return rows[0] || null;
}

async function getExistingQueueForAppointment(appointmentId) {
  if (!appointmentId) {
    return null;
  }

  const { rows } = await pool.query(
    `
      SELECT *
      FROM public.queues
      WHERE appointment_id = $1
      LIMIT 1
    `,
    [appointmentId],
  );

  return rows[0] || null;
}

function buildNonCheckInQueueLabel(appointmentRow) {
  const appointmentCode = String(appointmentRow?.appointment_code || '').trim().toUpperCase();
  if (appointmentCode) {
    return `MISSED-${appointmentCode}`;
  }

  const fallback = String(appointmentRow?.id || 'QUEUE').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 8);
  return `MISSED-${fallback || 'ENTRY'}`;
}

async function ensureQueueForAppointmentWithClient(client, appointmentRow) {
  if (!appointmentRow?.id || !appointmentRow?.user_id) {
    return null;
  }

  const existing = await client.query(
    `
      SELECT *
      FROM public.queues
      WHERE appointment_id = $1
      LIMIT 1
    `,
    [appointmentRow.id],
  );

  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const { rows } = await client.query(
    `
      INSERT INTO public.queues (
        user_id,
        queue_number,
        appointment_id,
        status
      )
      VALUES ($1, $2, $3, 'Cancelled')
      RETURNING *
    `,
    [appointmentRow.user_id, buildNonCheckInQueueLabel(appointmentRow), appointmentRow.id],
  );

  return rows[0] || null;
}

async function findKioskUserByIdentifier(identifier) {
  if (!identifier) {
    return null;
  }

  const { rows } = await pool.query(
    `
      SELECT
        id,
        firstname,
        middle_initial,
        lastname,
        email,
        student_number,
        employee_number,
        college,
        program,
        id_number,
        qr_data,
        user_type,
        role
      FROM public.users_auth
      WHERE UPPER(COALESCE(student_number, '')) = UPPER($1)
         OR UPPER(COALESCE(employee_number, '')) = UPPER($1)
         OR UPPER(COALESCE(id_number, '')) = UPPER($1)
         OR COALESCE(qr_data, '') = $1
      ORDER BY created_at ASC
      LIMIT 1
    `,
    [identifier],
  );

  return rows[0] || null;
}

async function findActiveKioskAppointmentForUser(userId, date = getTodayInManila()) {
  if (!userId) {
    return null;
  }

  const completedStatus = await toDatabaseAppointmentStatus('Completed');
  const notCompletedStatus = await toDatabaseAppointmentStatus('Not Completed');
  const { rows } = await pool.query(
    `
      SELECT *
      FROM public.appointments
      WHERE user_id = $1
        AND appointment_date = $2
        AND status NOT IN ($3, $4)
      ORDER BY created_at ASC
      LIMIT 1
    `,
    [userId, date, completedStatus, notCompletedStatus],
  );

  return rows[0] || null;
}

async function findKioskCheckInContextByAppointmentId(appointmentId) {
  if (!appointmentId) {
    return { user: null, appointment: null };
  }

  const today = getTodayInManila();
  const completedStatus = await toDatabaseAppointmentStatus('Completed');
  const notCompletedStatus = await toDatabaseAppointmentStatus('Not Completed');
  const { rows } = await pool.query(
    `
      SELECT
        a.*,
        u.id AS kiosk_user_id,
        u.firstname AS kiosk_firstname,
        u.middle_initial AS kiosk_middle_initial,
        u.lastname AS kiosk_lastname,
        u.email AS kiosk_email,
        u.student_number AS kiosk_student_number,
        u.employee_number AS kiosk_employee_number,
        u.college AS kiosk_college,
        u.program AS kiosk_program,
        u.id_number AS kiosk_id_number,
        u.qr_data AS kiosk_qr_data,
        u.user_type AS kiosk_user_type,
        u.role AS kiosk_role
      FROM public.appointments AS a
      JOIN public.users_auth AS u
        ON u.id = a.user_id
      WHERE a.id = $1
        AND a.appointment_date = $2
        AND a.status NOT IN ($3, $4)
      LIMIT 1
    `,
    [appointmentId, today, completedStatus, notCompletedStatus],
  );

  const row = rows[0];
  if (!row) {
    return { user: null, appointment: null };
  }

  return {
    appointment: row,
    user: {
      id: row.kiosk_user_id,
      firstname: row.kiosk_firstname,
      middle_initial: row.kiosk_middle_initial,
      lastname: row.kiosk_lastname,
      email: row.kiosk_email,
      student_number: row.kiosk_student_number,
      employee_number: row.kiosk_employee_number,
      college: row.kiosk_college,
      program: row.kiosk_program,
      id_number: row.kiosk_id_number,
      qr_data: row.kiosk_qr_data,
      user_type: row.kiosk_user_type,
      role: row.kiosk_role,
    },
  };
}

async function finalizeKioskCheckIn({ user, appointment }) {
  if (!user?.id || !appointment?.id) {
    throw new Error('A valid kiosk user and appointment are required.');
  }

  const queueRow = await ensureQueueForAppointment(appointment);
  const client = await pool.connect();
  let syncedAppointment = appointment;
  try {
    await client.query('BEGIN');
    syncedAppointment = await syncAppointmentStatusFromQueue(
      client,
      queueRow?.id || null,
      queueRow?.status || 'Waiting',
      appointment.id,
    ) || appointment;
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return buildKioskResult({
    user,
    appointment: syncedAppointment,
    queueNumber: queueRow?.queue_number || '',
  });
}

async function syncAppointmentStatusFromQueue(client, queueId, queueStatus, appointmentId = null) {
  const normalizedQueueStatus = String(queueStatus || '').trim();
  const derivedAppointmentStatus =
    normalizedQueueStatus === 'Waiting'
      ? 'Waiting'
      : normalizedQueueStatus === 'Serving'
        ? 'Ongoing'
        : normalizedQueueStatus === 'Done'
          ? 'Completed'
          : normalizedQueueStatus === 'Cancelled'
            ? 'Not Completed'
            : null;

  if (!derivedAppointmentStatus) {
    return null;
  }

  const allowedStatuses = await getAllowedAppointmentStatuses();
  let nextAppointmentStatus = derivedAppointmentStatus;

  if (!allowedStatuses.includes(nextAppointmentStatus)) {
    const fallbackCandidates = {
      Waiting: ['Ongoing', 'Success', 'Cancelled'],
      Ongoing: ['Waiting', 'Success'],
      Completed: ['Success', 'Ongoing'],
      'Not Completed': ['Cancelled', 'Ongoing'],
    };
    const candidates = fallbackCandidates[derivedAppointmentStatus] || [];
    const fallback = candidates.find((candidate) => allowedStatuses.includes(candidate));
    if (!fallback) {
      return null;
    }
    nextAppointmentStatus = fallback;
  }

  if (appointmentId) {
    const { rows } = await client.query(
      `
        UPDATE public.appointments
        SET status = $2,
            cancelled_at = NULL,
            cancellation_reason = NULL
        WHERE id = $1
        RETURNING *
      `,
      [appointmentId, nextAppointmentStatus],
    );

    return rows[0] || null;
  }

  if (!queueId) {
    return null;
  }

  const { rows } = await client.query(
    `
      UPDATE public.appointments AS a
      SET status = $2
      FROM public.queues AS q
      WHERE q.id = $1
        AND q.appointment_id = a.id
      RETURNING a.*
    `,
    [queueId, nextAppointmentStatus],
  );

  return rows[0] || null;
}

function mapNotificationRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    appointmentId: row.appointment_id || null,
    readAt: row.read_at || null,
    createdAt: row.created_at,
  };
}

function mapActivityLogRow(row) {
  let changedData = null;
  if (row.changed_data && typeof row.changed_data === 'object') {
    changedData = row.changed_data;
  } else if (typeof row.changed_data === 'string') {
    try {
      changedData = JSON.parse(row.changed_data);
    } catch {
      changedData = row.changed_data;
    }
  }

  const actionType = row.action_type || '';
  let scope = 'other';
  if (['admin_login', 'super_admin_login', 'user_login'].includes(actionType)) {
    scope = 'access';
  } else if (actionType.startsWith('admin_account_')) {
    scope = 'admin_accounts';
  } else if (actionType.startsWith('user_account_')) {
    scope = 'user_accounts';
  } else if (['appointment_status', 'medical_record_created', 'consultation_log_created'].includes(actionType)) {
    scope = 'operations';
  }

  return {
    id: row.id,
    adminUserId: row.admin_user_id || null,
    adminUserName: row.admin_user_name || '',
    actionType,
    message: row.message || '',
    changedData,
    targetType: row.target_type || null,
    targetId: row.target_id || null,
    createdAt: row.created_at || null,
    scope,
  };
}

async function createNotification({ userId, type, title, message, appointmentId = null }) {
  if (!userId || !title || !message) {
    return null;
  }

  const { rows } = await pool.query(
    `
      INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        appointment_id
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [userId, type || 'general', title, message, appointmentId],
  );

  return rows[0] ? mapNotificationRow(rows[0]) : null;
}

async function createAdminActivityLog({
  adminUserId,
  adminUserName,
  actionType,
  message,
  changedData = null,
  targetType = null,
  targetId = null,
}) {
  if (!adminUserName || !actionType || !message) {
    return;
  }

  try {
    await pool.query(
      `
        INSERT INTO public.admin_activity_logs (
          admin_user_id,
          admin_user_name,
          action_type,
          message,
          changed_data,
          target_type,
          target_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        adminUserId || null,
        adminUserName,
        actionType,
        message,
        changedData ? JSON.stringify(changedData) : null,
        targetType,
        targetId,
      ],
    );
  } catch {
    // Best-effort only. App should still work if logs table is missing.
  }
}

function ensureSuperAdmin(req, res) {
  const requesterType = getEffectiveUserType(req.authUser);
  if (requesterType !== 'super_admin') {
    res.status(403).json({ message: 'Only super admins can manage admin accounts.' });
    return false;
  }
  return true;
}

function ensureAdmin(req, res, message = 'Only admins can access this resource.') {
  if (!isAdminUserType(getEffectiveUserType(req.authUser))) {
    res.status(403).json({ message });
    return false;
  }
  return true;
}

function ensureSelfOrAdmin(req, res, targetUserId, message = 'You are not authorized to access this resource.') {
  if (req.authUser.id === targetUserId || isAdminUserType(getEffectiveUserType(req.authUser))) {
    return true;
  }

  res.status(403).json({ message });
  return false;
}

async function getSlotDefinitions() {
  await syncDefaultSlotDefinitions();

  const { rows } = await pool.query(
    `
      SELECT id, time_slot, max_capacity, sort_order
      FROM public.slot_definitions
      WHERE is_active = true
      ORDER BY sort_order ASC, time_slot ASC
    `,
  );

  const rowsByTimeSlot = new Map(
    rows.map((row) => [formatTimeSlotLabel(row.time_slot), row]),
  );

  return DEFAULT_TIME_SLOTS.map((slot) => {
    const existingRow = rowsByTimeSlot.get(slot.timeSlot);
    return {
      id: existingRow?.id || null,
      timeSlot: slot.timeSlot,
      maxCapacity: existingRow?.max_capacity ?? slot.maxCapacity,
      sortOrder: existingRow?.sort_order ?? slot.sortOrder,
    };
  });
}

function buildMissedAppointmentNote(existingNotes, timeSlot, dateLabel = 'today') {
  const base = normalizeIdentifier(existingNotes);
  const reasonLine = `Auto-updated to Not Completed after missing the ${timeSlot} appointment window on ${dateLabel}.`;
  if (!base) return reasonLine;
  if (base.includes(reasonLine)) return base;
  return `${base}\n${reasonLine}`;
}

async function markMissedAppointmentsAsNotCompleted() {
  const today = getTodayInManila();
  const nowMinutes = getCurrentMinutesInManila();
  const missedStatus = await toDatabaseAppointmentStatus('Not Completed');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `
        SELECT id, user_id, appointment_date, time_slot, notes
        FROM public.appointments
        WHERE status NOT IN ('Completed', 'Not Completed')
          AND (
            appointment_date < $1
            OR (
              appointment_date = $1
              AND time_slot IS NOT NULL
            )
          )
      `,
      [today],
    );

    const missedAppointments = rows.filter((appointment) => {
      if (appointment.appointment_date < today) {
        return true;
      }

      const slotRange = parseTimeSlotRange(appointment.time_slot);
      if (!slotRange) {
        return false;
      }

      return nowMinutes > slotRange.endMinutes;
    });

    for (const appointment of missedAppointments) {
      const queueLookup = await client.query(
        `
          SELECT id, status
          FROM public.queues
          WHERE appointment_id = $1
          LIMIT 1
        `,
        [appointment.id],
      );

      if (queueLookup.rows[0] && queueLookup.rows[0].status !== 'Cancelled') {
        await client.query(
          `
            UPDATE public.queues
            SET status = 'Cancelled'
            WHERE id = $1
          `,
          [queueLookup.rows[0].id],
        );
      }

      const dateLabel = appointment.appointment_date || today;
      await client.query(
        `
          UPDATE public.appointments
          SET status = $2,
              notes = NULLIF($3, '')
          WHERE id = $1
        `,
        [
          appointment.id,
          missedStatus,
          buildMissedAppointmentNote(appointment.notes, appointment.time_slot, dateLabel),
        ],
      );
    }

    await client.query('COMMIT');
    return missedAppointments.length;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getOrCreateSlotDefinition(timeSlot) {
  const normalizedTimeSlot = formatTimeSlotLabel(normalizeIdentifier(timeSlot));
  if (!normalizedTimeSlot || !DEFAULT_TIME_SLOT_MAP.has(normalizedTimeSlot)) {
    return null;
  }

  await syncDefaultSlotDefinitions();

  const existing = await pool.query(
    `
      SELECT id, time_slot, max_capacity, sort_order
      FROM public.slot_definitions
      WHERE is_active = true
        AND time_slot = $1
      LIMIT 1
    `,
    [normalizedTimeSlot],
  );

  const matchingRow = existing.rows[0];

  if (matchingRow) {
    return {
      id: matchingRow.id,
      timeSlot: formatTimeSlotLabel(matchingRow.time_slot),
      maxCapacity: matchingRow.max_capacity,
      sortOrder: matchingRow.sort_order,
    };
  }

  const fallback = DEFAULT_TIME_SLOT_MAP.get(normalizedTimeSlot);
  const created = await pool.query(
    `
      INSERT INTO public.slot_definitions (time_slot, max_capacity, sort_order, is_active)
      VALUES ($1, $2, $3, true)
      RETURNING id, time_slot, max_capacity, sort_order
    `,
    [
      normalizedTimeSlot,
      fallback?.maxCapacity || 50,
      fallback?.sortOrder || 0,
    ],
  );

  return {
    id: created.rows[0].id,
    timeSlot: created.rows[0].time_slot,
    maxCapacity: created.rows[0].max_capacity,
    sortOrder: created.rows[0].sort_order,
  };
}

async function syncDefaultSlotDefinitions() {
  const { rows } = await pool.query(
    `
      SELECT id, time_slot, max_capacity, sort_order, is_active
      FROM public.slot_definitions
      ORDER BY sort_order ASC, time_slot ASC
    `,
  );

  const seenAllowedSlots = new Set();
  for (const row of rows) {
    const normalizedTimeSlot = formatTimeSlotLabel(row.time_slot);
    const defaultSlot = DEFAULT_TIME_SLOT_MAP.get(normalizedTimeSlot);

    if (!defaultSlot) {
      if (row.is_active) {
        await pool.query(
          `
            UPDATE public.slot_definitions
            SET is_active = false
            WHERE id = $1
          `,
          [row.id],
        );
      }
      continue;
    }

    seenAllowedSlots.add(defaultSlot.timeSlot);
    const needsUpdate =
      !row.is_active ||
      row.time_slot !== defaultSlot.timeSlot ||
      row.max_capacity !== defaultSlot.maxCapacity ||
      row.sort_order !== defaultSlot.sortOrder;

    if (needsUpdate) {
      await pool.query(
        `
          UPDATE public.slot_definitions
          SET time_slot = $2,
              max_capacity = $3,
              sort_order = $4,
              is_active = true
          WHERE id = $1
        `,
        [row.id, defaultSlot.timeSlot, defaultSlot.maxCapacity, defaultSlot.sortOrder],
      );
    }
  }

  for (const defaultSlot of DEFAULT_TIME_SLOTS) {
    if (seenAllowedSlots.has(defaultSlot.timeSlot)) {
      continue;
    }

    await pool.query(
      `
        INSERT INTO public.slot_definitions (time_slot, max_capacity, sort_order, is_active)
        VALUES ($1, $2, $3, true)
      `,
      [defaultSlot.timeSlot, defaultSlot.maxCapacity, defaultSlot.sortOrder],
    );
  }
}

async function generateAppointmentCode() {
  const { rows } = await pool.query(
    `
      SELECT COUNT(*)::int AS total
      FROM public.appointments
    `,
  );

  const nextNumber = (rows[0]?.total || 0) + 1;
  return `APT-${String(nextNumber).padStart(5, '0')}`;
}

function appendNotCompletedReason(existingNotes, reason) {
  const trimmedReason = normalizeIdentifier(reason);
  if (!trimmedReason) {
    return existingNotes || '';
  }
  const base = normalizeIdentifier(existingNotes);
  const reasonLine = `Not completed reason: ${trimmedReason}`;
  if (!base) return reasonLine;
  if (base.includes(reasonLine)) return base;
  return `${base}\n${reasonLine}`;
}

function appendCancellationReason(existingNotes, reason) {
  const trimmedReason = normalizeIdentifier(reason) || 'Cancelled by user.';
  const base = normalizeIdentifier(existingNotes);
  const reasonLine = `Cancellation reason: ${trimmedReason}`;
  if (!base) return reasonLine;
  if (base.includes(reasonLine)) return base;
  return `${base}\n${reasonLine}`;
}

async function getAllowedAppointmentStatuses() {
  if (cachedAppointmentStatuses) {
    return cachedAppointmentStatuses;
  }

  try {
    const { rows } = await pool.query(
      `
        SELECT pg_get_constraintdef(c.oid) AS definition
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'appointments'
          AND c.contype = 'c'
          AND c.conname ILIKE '%status%'
        LIMIT 1
      `,
    );

    const definition = rows[0]?.definition || '';
    const matches = [...definition.matchAll(/'([^']+)'/g)];
    const statuses = matches.map((m) => m[1]).filter(Boolean);
    cachedAppointmentStatuses = statuses.length ? statuses : ['Waiting', 'Ongoing', 'Completed', 'Not Completed'];
    return cachedAppointmentStatuses;
  } catch {
    cachedAppointmentStatuses = ['Waiting', 'Ongoing', 'Completed', 'Not Completed'];
    return cachedAppointmentStatuses;
  }
}

async function getAllAllowedAppointmentStatuses() {
  try {
    const definition = rows[0]?.definition || {};
    const matches = [...definition.matchAll(/'([^']+)'/g)];
    const statuses = matches.map((m) => m[1]).filter(Boolean);

    return statuses.length ? statuses : ['Ongoing', 'Success', 'Cancelled'];
  } catch {
    return ['Ongoing', 'Success', 'Cancelled'];
  }
}

async function getInitialAppointmentStatus() {
  const allowed = await getAllAllowedAppointmentStatuses();

  if (allowed.includes('Ongoing')) {
    return 'Ongoing';
  }

  if (allowed.includes('Success')) {
    return 'Success';
  }

  if (allowed.includes('Cancelled')) {
    return 'Cancelled';
  }

  return 'Ongoing';
}

app.post('/api/auth/login', async (req, res) => {
  const studentId = normalizeIdentifier(req.body?.studentId);
  const password = normalizeCredential(req.body?.password);

  if (!studentId || !password) {
    return res.status(400).json({
      message: 'An ID and password are required.',
    });
  }

  try {
    const user = await findAuthUserByLoginIdentifier(studentId);

    if (!user) {
      return res.status(401).json({
        message: 'Invalid ID or password.',
      });
    }

    if (String(user.status || '').toLowerCase() === 'blocked') {
      return res.status(403).json({
        message: 'This account is blocked. Please contact the super admin.',
      });
    }

    const { matches: passwordMatches, shouldUpgradeHash } = await doesPasswordMatch(user, password);

    if (!passwordMatches) {
      return res.status(401).json({
        message: 'Invalid ID or password.',
      });
    }

    if (shouldUpgradeHash && getEffectiveUserType(user) !== 'guest') {
      const nextPasswordHash = hashPassword(password);
      await pool.query(
        `
          UPDATE public.users_auth
          SET password_hash = $2
          WHERE id = $1
        `,
        [user.id, nextPasswordHash],
      );
      user.password_hash = nextPasswordHash;
    }

    const token = createSessionToken(user, studentId);

    await createAdminActivityLog({
      adminUserId: user.id,
      adminUserName: getUserDisplayName(user),
      actionType: user.user_type === 'super_admin' ? 'super_admin_login' : isAdminUserType(user.user_type || user.role) ? 'admin_login' : 'user_login',
      message: user.user_type === 'super_admin'
        ? 'Super admin signed in.'
        : isAdminUserType(user.user_type || user.role)
          ? 'Admin signed in.'
          : 'User signed in.',
      changedData: {
        loginId: user.id_number || user.student_number || user.employee_number || studentId,
        userType: user.user_type || user.role || 'student',
      },
      targetType: isAdminUserType(user.user_type || user.role) ? 'admin' : 'user',
      targetId: user.id,
    });

    return res.json({
      token,
      user: buildUserPayload(user),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Login failed.',
      error: error.message,
    });
  }
});

app.post('/api/auth/guest', async (_req, res) => {
  try {
    const guestIdentifier = await generateGuestIdentifier();
    const { rows } = await pool.query(
      `
        INSERT INTO public.users_auth (
          firstname,
          lastname,
          id_number,
          qr_data,
          role,
          user_type,
          status,
          student_number,
          employee_number
        )
        VALUES ('Guest', NULL, $1, $1, 'guest', 'guest', 'active', NULL, NULL)
        RETURNING
          id,
          firstname,
          middle_initial,
          lastname,
          email,
          user_type,
          picture_url,
          student_number,
          employee_number,
          college,
          program,
          qr_code,
          qr_data,
          phone,
          address,
          id_number,
          role,
          status,
          password_hash
      `,
      [guestIdentifier],
    );

    const guestUser = (await fetchAuthUserById(rows[0].id)) || rows[0];
    const token = createSessionToken(guestUser, guestIdentifier);

    return res.status(201).json({
      token,
      user: buildUserPayload(guestUser),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to start guest session.',
      error: error.message,
    });
  }
});

function isAdminUserType(userType) {
  return userType === 'admin' || userType === 'super_admin';
}

app.post('/api/admin/users', loadAuthenticatedUser, async (req, res) => {
  if (!ensureSuperAdmin(req, res)) {
    return;
  }

  const firstName = normalizeIdentifier(req.body?.firstName);
  const middleName = normalizeIdentifier(req.body?.middleName);
  const lastName = normalizeIdentifier(req.body?.lastName);
  const email = normalizeIdentifier(req.body?.email).toLowerCase();
  const address = normalizeIdentifier(req.body?.address);
  const phone = normalizeIdentifier(req.body?.phone);
  const password = String(req.body?.password || '');
  const confirmPassword = String(req.body?.confirmPassword || '');

  if (!firstName || !lastName || !email || !address || !phone || !password || !confirmPassword) {
    return res.status(400).json({ message: 'All required admin account fields must be provided.' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters.' });
  }

  try {
    const passwordHash = hashPassword(password);
    const { rows } = await pool.query(
      `
        INSERT INTO public.users_auth (
          firstname,
          middle_initial,
          lastname,
          id_number,
          role,
          registration_date,
          status,
          user_type,
          email,
          address,
          phone,
          password_hash
        )
        VALUES ($1, NULLIF($2, ''), $3, $4, 'admin', CURRENT_DATE, 'active', 'admin', $5, $6, $7, $8)
        RETURNING
          id,
          firstname,
          middle_initial,
          lastname,
          email,
          user_type,
          picture_url,
          student_number,
          employee_number,
          college,
          program,
          qr_code,
          qr_data,
          phone,
          address,
          id_number,
          role,
          status,
          password_hash
      `,
      [
        firstName,
        middleName,
        lastName,
        email,
        email,
        address,
        phone,
        passwordHash,
      ],
    );

    const createdUser = (await fetchAuthUserById(rows[0].id)) || rows[0];
    const adminName = [req.authUser.firstname, req.authUser.lastname].filter(Boolean).join(' ') || req.authUser.email || 'Super Admin';

    await createAdminActivityLog({
      adminUserId: req.authUser.id,
      adminUserName: adminName,
      actionType: 'admin_account_created',
      message: `Created admin account for ${createdUser.email}.`,
      changedData: {
        createdAdminId: createdUser.id,
        createdAdminEmail: createdUser.email,
        createdAdminLoginId: createdUser.id_number,
      },
      targetType: 'user',
      targetId: createdUser.id,
    });

    return res.status(201).json({
      message: 'Admin account created successfully.',
      user: buildUserPayload(createdUser),
      loginId: createdUser?.id_number || rows[0].id_number,
    });
  } catch (error) {
    const isEmailConflict = error.code === '23505' && String(error.constraint || '').includes('email');
    const isEmployeeConflict = error.code === '23505' && String(error.constraint || '').includes('employee_number');
    return res.status(isEmailConflict || isEmployeeConflict ? 409 : 500).json({
      message: isEmailConflict
        ? 'That email address is already in use.'
        : isEmployeeConflict
          ? 'Failed to generate a unique admin employee number. Please try again.'
          : 'Failed to create admin account.',
      error: error.message,
    });
  }
});

app.get('/api/admin/users', loadAuthenticatedUser, async (req, res) => {
  if (!ensureSuperAdmin(req, res)) {
    return;
  }

  try {
    const { rows } = await pool.query(
      `
        SELECT
          id,
          firstname,
          middle_initial,
          lastname,
          email,
          phone,
          address,
          id_number,
          employee_number,
          user_type,
          role,
          status,
          created_at,
          updated_at
        FROM public.users_auth
        WHERE user_type IN ('admin', 'super_admin')
           OR role IN ('admin', 'super_admin')
        ORDER BY
          CASE WHEN COALESCE(user_type, role) = 'super_admin' THEN 0 ELSE 1 END,
          created_at ASC
      `,
    );

    return res.json(rows.map(mapManagedUserRow));
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to load admin accounts.',
      error: error.message,
    });
  }
});

app.patch('/api/admin/users/:id', loadAuthenticatedUser, async (req, res) => {
  if (!ensureSuperAdmin(req, res)) {
    return;
  }

  const targetId = normalizeIdentifier(req.params?.id);
  const firstName = normalizeIdentifier(req.body?.firstName);
  const middleName = normalizeIdentifier(req.body?.middleName);
  const lastName = normalizeIdentifier(req.body?.lastName);
  const email = normalizeIdentifier(req.body?.email).toLowerCase();
  const address = normalizeIdentifier(req.body?.address);
  const phone = normalizeIdentifier(req.body?.phone);
  const password = String(req.body?.password || '');
  const confirmPassword = String(req.body?.confirmPassword || '');

  if (!targetId || !firstName || !lastName || !email || !address || !phone) {
    return res.status(400).json({ message: 'All required admin account fields must be provided.' });
  }

  if (password || confirmPassword) {
    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }
  }

  try {
    const existing = await pool.query(
      `
        SELECT id, firstname, middle_initial, lastname, email, phone, address, id_number, employee_number, user_type, role, status, created_at, updated_at
        FROM public.users_auth
        WHERE id = $1
        LIMIT 1
      `,
      [targetId],
    );

    const targetUser = existing.rows[0];
    if (!targetUser) {
      return res.status(404).json({ message: 'Admin account not found.' });
    }

    if (getEffectiveUserType(targetUser) === 'super_admin') {
      return res.status(403).json({ message: 'Super admin accounts cannot be edited from this page.' });
    }

    const passwordValue = password ? hashPassword(password) : null;
    const { rows } = await pool.query(
      `
        UPDATE public.users_auth
        SET firstname = $2,
            middle_initial = NULLIF($3, ''),
            lastname = $4,
            email = $5,
            id_number = $5,
            address = $6,
            phone = $7,
            password_hash = COALESCE($8, password_hash),
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, firstname, middle_initial, lastname, email, phone, address, id_number, employee_number, user_type, role, status, created_at, updated_at
      `,
      [targetId, firstName, middleName, lastName, email, address, phone, passwordValue],
    );

    await createAdminActivityLog({
      adminUserId: req.authUser.id,
      adminUserName: getUserDisplayName(req.authUser),
      actionType: 'admin_account_updated',
      message: `Updated admin account ${rows[0].email || rows[0].id_number}.`,
      changedData: {
        targetAdminId: rows[0].id,
        previousEmail: targetUser.email,
        nextEmail: rows[0].email,
        passwordUpdated: Boolean(passwordValue),
      },
      targetType: 'user',
      targetId: rows[0].id,
    });

    return res.json({
      message: 'Admin account updated successfully.',
      user: mapManagedUserRow(rows[0]),
    });
  } catch (error) {
    const isEmailConflict = error.code === '23505' && String(error.constraint || '').includes('email');
    return res.status(isEmailConflict ? 409 : 500).json({
      message: isEmailConflict ? 'That email address is already in use.' : 'Failed to update admin account.',
      error: error.message,
    });
  }
});

app.patch('/api/admin/users/:id/status', loadAuthenticatedUser, async (req, res) => {
  if (!ensureSuperAdmin(req, res)) {
    return;
  }

  const targetId = normalizeIdentifier(req.params?.id);
  const nextStatus = normalizeIdentifier(req.body?.status).toLowerCase();

  if (!targetId || !['active', 'blocked'].includes(nextStatus)) {
    return res.status(400).json({ message: 'A valid target id and status are required.' });
  }

  if (targetId === req.authUser.id) {
    return res.status(400).json({ message: 'You cannot change the status of your own super admin account.' });
  }

  try {
    const existing = await pool.query(
      `
        SELECT id, firstname, middle_initial, lastname, email, phone, address, id_number, employee_number, user_type, role, status, created_at, updated_at
        FROM public.users_auth
        WHERE id = $1
        LIMIT 1
      `,
      [targetId],
    );

    const targetUser = existing.rows[0];
    if (!targetUser) {
      return res.status(404).json({ message: 'Admin account not found.' });
    }

    if (getEffectiveUserType(targetUser) === 'super_admin') {
      return res.status(403).json({ message: 'Super admin accounts cannot be blocked from this page.' });
    }

    const { rows } = await pool.query(
      `
        UPDATE public.users_auth
        SET status = $2,
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, firstname, middle_initial, lastname, email, phone, address, id_number, employee_number, user_type, role, status, created_at, updated_at
      `,
      [targetId, nextStatus],
    );

    await createAdminActivityLog({
      adminUserId: req.authUser.id,
      adminUserName: getUserDisplayName(req.authUser),
      actionType: 'admin_account_status_updated',
      message: `${nextStatus === 'blocked' ? 'Blocked' : 'Activated'} admin account ${rows[0].email || rows[0].id_number}.`,
      changedData: {
        targetAdminId: rows[0].id,
        targetAdminEmail: rows[0].email,
        previousStatus: targetUser.status,
        nextStatus,
      },
      targetType: 'user',
      targetId: rows[0].id,
    });

    return res.json({
      message: `Admin account ${nextStatus === 'blocked' ? 'blocked' : 'activated'} successfully.`,
      user: mapManagedUserRow(rows[0]),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to update admin account status.',
      error: error.message,
    });
  }
});

app.delete('/api/admin/users/:id', loadAuthenticatedUser, async (req, res) => {
  if (!ensureSuperAdmin(req, res)) {
    return;
  }

  const targetId = normalizeIdentifier(req.params?.id);
  if (!targetId) {
    return res.status(400).json({ message: 'A target admin id is required.' });
  }

  if (targetId === req.authUser.id) {
    return res.status(400).json({ message: 'You cannot delete your own super admin account.' });
  }

  try {
    const existing = await pool.query(
      `
        SELECT id, firstname, middle_initial, lastname, email, phone, address, id_number, employee_number, user_type, role, status, created_at, updated_at
        FROM public.users_auth
        WHERE id = $1
        LIMIT 1
      `,
      [targetId],
    );

    const targetUser = existing.rows[0];
    if (!targetUser) {
      return res.status(404).json({ message: 'Admin account not found.' });
    }

    if (getEffectiveUserType(targetUser) === 'super_admin') {
      return res.status(403).json({ message: 'Super admin accounts cannot be deleted from this page.' });
    }

    await pool.query(
      `
        DELETE FROM public.users_auth
        WHERE id = $1
      `,
      [targetId],
    );

    await createAdminActivityLog({
      adminUserId: req.authUser.id,
      adminUserName: getUserDisplayName(req.authUser),
      actionType: 'admin_account_deleted',
      message: `Deleted admin account ${targetUser.email || targetUser.id_number}.`,
      changedData: {
        deletedAdminId: targetUser.id,
        deletedAdminEmail: targetUser.email,
        deletedAdminLoginId: targetUser.id_number,
      },
      targetType: 'user',
      targetId: targetUser.id,
    });

    return res.json({
      message: 'Admin account deleted successfully.',
      deletedId: targetUser.id,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to delete admin account.',
      error: error.message,
    });
  }
});

app.get('/api/admin/client-users', loadAuthenticatedUser, async (req, res) => {
  if (!ensureSuperAdmin(req, res)) {
    return;
  }

  try {
    const { rows } = await pool.query(
      `
        SELECT
          id,
          firstname,
          middle_initial,
          lastname,
          email,
          phone,
          address,
          id_number,
          student_number,
          employee_number,
          user_type,
          role,
          status,
          created_at,
          updated_at
        FROM public.users_auth
        WHERE COALESCE(user_type, role, '') NOT IN ('admin', 'super_admin')
          AND COALESCE(role, '') NOT IN ('admin', 'super_admin')
        ORDER BY created_at DESC
      `,
    );

    return res.json(rows.map((user) => ({
      ...mapManagedUserRow(user),
      studentNumber: user.student_number || null,
    })));
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to load user accounts.',
      error: error.message,
    });
  }
});

app.patch('/api/admin/client-users/:id/status', loadAuthenticatedUser, async (req, res) => {
  if (!ensureSuperAdmin(req, res)) {
    return;
  }

  const targetId = normalizeIdentifier(req.params?.id);
  const nextStatus = normalizeIdentifier(req.body?.status).toLowerCase();

  if (!targetId || !['active', 'blocked'].includes(nextStatus)) {
    return res.status(400).json({ message: 'A valid target id and status are required.' });
  }

  try {
    const existing = await pool.query(
      `
        SELECT id, firstname, middle_initial, lastname, email, phone, address, id_number, student_number, employee_number, user_type, role, status, created_at, updated_at
        FROM public.users_auth
        WHERE id = $1
        LIMIT 1
      `,
      [targetId],
    );

    const targetUser = existing.rows[0];
    if (!targetUser) {
      return res.status(404).json({ message: 'User account not found.' });
    }

    if (['admin', 'super_admin'].includes(getEffectiveUserType(targetUser))) {
      return res.status(403).json({ message: 'Use the admin accounts controls for admin users.' });
    }

    const { rows } = await pool.query(
      `
        UPDATE public.users_auth
        SET status = $2,
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, firstname, middle_initial, lastname, email, phone, address, id_number, student_number, employee_number, user_type, role, status, created_at, updated_at
      `,
      [targetId, nextStatus],
    );

    await createAdminActivityLog({
      adminUserId: req.authUser.id,
      adminUserName: getUserDisplayName(req.authUser),
      actionType: 'user_account_status_updated',
      message: `${nextStatus === 'blocked' ? 'Blocked' : 'Activated'} user account ${rows[0].email || rows[0].id_number}.`,
      changedData: {
        targetUserId: rows[0].id,
        targetUserEmail: rows[0].email,
        previousStatus: targetUser.status,
        nextStatus,
      },
      targetType: 'user',
      targetId: rows[0].id,
    });

    return res.json({
      message: `User account ${nextStatus === 'blocked' ? 'blocked' : 'activated'} successfully.`,
      user: {
        ...mapManagedUserRow(rows[0]),
        studentNumber: rows[0].student_number || null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to update user account status.',
      error: error.message,
    });
  }
});

app.delete('/api/admin/client-users/:id', loadAuthenticatedUser, async (req, res) => {
  if (!ensureSuperAdmin(req, res)) {
    return;
  }

  const targetId = normalizeIdentifier(req.params?.id);
  if (!targetId) {
    return res.status(400).json({ message: 'A target user id is required.' });
  }

  try {
    const existing = await pool.query(
      `
        SELECT id, firstname, middle_initial, lastname, email, phone, address, id_number, student_number, employee_number, user_type, role, status, created_at, updated_at
        FROM public.users_auth
        WHERE id = $1
        LIMIT 1
      `,
      [targetId],
    );

    const targetUser = existing.rows[0];
    if (!targetUser) {
      return res.status(404).json({ message: 'User account not found.' });
    }

    if (['admin', 'super_admin'].includes(getEffectiveUserType(targetUser))) {
      return res.status(403).json({ message: 'Use the admin accounts controls for admin users.' });
    }

    await pool.query(
      `
        DELETE FROM public.users_auth
        WHERE id = $1
      `,
      [targetId],
    );

    await createAdminActivityLog({
      adminUserId: req.authUser.id,
      adminUserName: getUserDisplayName(req.authUser),
      actionType: 'user_account_deleted',
      message: `Deleted user account ${targetUser.email || targetUser.id_number}.`,
      changedData: {
        deletedUserId: targetUser.id,
        deletedUserEmail: targetUser.email,
        deletedUserLoginId: targetUser.id_number,
      },
      targetType: 'user',
      targetId: targetUser.id,
    });

    return res.json({
      message: 'User account deleted successfully.',
      deletedId: targetUser.id,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to delete user account.',
      error: error.message,
    });
  }
});

app.get('/api/auth/me', loadAuthenticatedUser, async (req, res) => {
  return res.json({
    user: buildUserPayload(req.authUser),
  });
});

app.get('/api/departments', loadAuthenticatedUser, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
        SELECT id, name, type, created_at
        FROM public.departments
        WHERE LOWER(COALESCE(type, '')) = 'academic'
        ORDER BY name ASC
      `,
    );

    return res.json(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type || '',
        createdAt: row.created_at || null,
      })),
    );
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load departments.', error: error.message });
  }
});

app.get('/api/activity-logs', loadAuthenticatedUser, async (req, res) => {
  if (!ensureSuperAdmin(req, res)) {
    return;
  }

  const actionType = normalizeIdentifier(req.query?.actionType);
  const scope = normalizeIdentifier(req.query?.scope);
  const limit = Math.min(Math.max(Number(req.query?.limit || 200), 1), 500);
  const offset = Math.max(Number(req.query?.offset || 0), 0);

  const conditions = [];
  const values = [];

  if (actionType && actionType !== 'all') {
    values.push(actionType);
    conditions.push(`action_type = $${values.length}`);
  }

  if (scope && scope !== 'all') {
    if (scope === 'access') {
      conditions.push(`action_type IN ('admin_login', 'super_admin_login', 'user_login')`);
    } else if (scope === 'admin_accounts') {
      conditions.push(`action_type LIKE 'admin_account_%'`);
    } else if (scope === 'user_accounts') {
      conditions.push(`action_type LIKE 'user_account_%'`);
    } else if (scope === 'operations') {
      conditions.push(`action_type IN ('appointment_status', 'medical_record_created', 'consultation_log_created')`);
    }
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const { rows } = await pool.query(
      `
        SELECT
          id,
          admin_user_id,
          admin_user_name,
          action_type,
          message,
          changed_data,
          target_type,
          target_id,
          created_at
        FROM public.admin_activity_logs
        ${whereClause}
        ORDER BY created_at DESC, action_type ASC
        LIMIT $${values.length + 1}
        OFFSET $${values.length + 2}
      `,
      [...values, limit, offset],
    );

    return res.json(rows.map(mapActivityLogRow));
  } catch (error) {
    const missingTable = error.code === '42P01';
    return res.status(missingTable ? 200 : 500).json(
      missingTable
        ? { logs: [], setupRequired: true }
        : { message: 'Failed to load activity logs.', error: error.message },
    );
  }
});

app.patch('/api/auth/profile', loadAuthenticatedUser, async (req, res) => {
  const firstName = normalizeIdentifier(req.body?.firstName);
  const middleName = normalizeIdentifier(req.body?.middleName);
  const lastName = normalizeIdentifier(req.body?.lastName);
  const email = normalizeIdentifier(req.body?.email);
  const phone = normalizeIdentifier(req.body?.phone);
  const address = normalizeIdentifier(req.body?.address);
  const college = normalizeIdentifier(req.body?.college);
  const program = normalizeIdentifier(req.body?.program);
  const pictureUrl = typeof req.body?.pictureUrl === 'string' ? req.body.pictureUrl.trim() : '';

  try {
    const { rows } = await pool.query(
      `
        UPDATE public.users_auth
        SET firstname = $2,
            middle_initial = NULLIF($3, ''),
            lastname = $4,
            email = NULLIF($5, ''),
            phone = NULLIF($6, ''),
            address = NULLIF($7, ''),
            picture_url = NULLIF($8, ''),
            college = NULLIF($9, ''),
            program = NULLIF($10, '')
        WHERE id = $1
        RETURNING
          id,
          firstname,
          middle_initial,
          lastname,
          email,
          user_type,
          picture_url,
          student_number,
          employee_number,
          college,
          program,
          qr_code,
          qr_data,
          phone,
          address,
          id_number,
          role,
          status,
          password_hash
      `,
      [
        req.authUser.id,
        firstName || null,
        middleName,
        lastName || null,
        email,
        phone,
        address,
        pictureUrl,
        college,
        program,
      ],
    );

    return res.json({
      message: 'Profile updated successfully.',
      user: buildUserPayload((await fetchAuthUserById(rows[0].id)) || rows[0]),
    });
  } catch (error) {
    const isEmailConflict = error.code === '23505' && String(error.constraint || '').includes('email');
    return res.status(isEmailConflict ? 409 : 500).json({
      message: isEmailConflict ? 'That email address is already in use.' : 'Failed to update profile.',
      error: error.message,
    });
  }
});

app.patch('/api/auth/password', loadAuthenticatedUser, async (req, res) => {
  const currentPassword = normalizeCredential(req.body?.currentPassword);
  const newPassword = normalizeCredential(req.body?.newPassword);
  const confirmPassword = normalizeCredential(req.body?.confirmPassword);

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ message: 'Current password, new password, and confirmation are required.' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: 'New password and confirmation do not match.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
  }

  const { matches: currentMatches } = await doesPasswordMatch(req.authUser, currentPassword);

  if (!currentMatches) {
    return res.status(400).json({ message: 'Current password is incorrect.' });
  }

  try {
    const nextPasswordHash = hashPassword(newPassword);
    await pool.query(
      `
        UPDATE public.users_auth
        SET password_hash = $2
        WHERE id = $1
      `,
      [req.authUser.id, nextPasswordHash],
    );

    return res.json({
      message: 'Password updated successfully.',
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to update password.',
      error: error.message,
    });
  }
});

app.post('/api/kiosk/check-in', async (req, res) => {
  const mode = normalizeIdentifier(req.body?.mode).toLowerCase();
  const rawPayload = mode === 'id' ? req.body?.id : req.body?.payload;
  const identifier = normalizeIdentifier(rawPayload);

  if (!identifier) {
    return res.status(400).json({ message: 'A valid kiosk ID or QR payload is required.' });
  }

  try {
    const user = await findKioskUserByIdentifier(identifier);
    if (!user) {
      return res.status(404).json({
        code: 'USER_NOT_FOUND',
        message: 'No user account matched the scanned ID.',
      });
    }

    const appointment = await findActiveKioskAppointmentForUser(user.id);
    if (!appointment) {
      return res.status(404).json({
        code: 'NO_APPOINTMENT_TODAY',
        message: 'No active appointment was found for today.',
        user: buildKioskUserPayload(user),
      });
    }

    const arrivalWindow = evaluateAppointmentArrivalWindow(appointment.time_slot);

    if (arrivalWindow.status === 'early') {
      return res.status(409).json({
        code: 'APPOINTMENT_TOO_EARLY',
        message: `Your appointment is scheduled for ${appointment.time_slot}. Please come back during your selected time window.`,
        user: buildKioskUserPayload(user),
        appointment: mapKioskAppointment(appointment),
      });
    }

    if (arrivalWindow.status === 'missed') {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const queueRow = await ensureQueueForAppointmentWithClient(client, appointment);
        const updatedQueue = await client.query(
          `
            UPDATE public.queues
            SET status = 'Cancelled'
            WHERE id = $1
            RETURNING *
          `,
          [queueRow.id],
        );

        const updatedAppointment = await syncAppointmentStatusFromQueue(
          client,
          updatedQueue.rows[0]?.id || queueRow.id,
          'Cancelled',
          appointment.id,
        );

        await client.query('COMMIT');

        if (updatedAppointment?.user_id) {
          await createNotification({
            userId: updatedAppointment.user_id,
            type: 'appointment_status',
            title: 'Appointment skipped',
            message: `Your ${appointment.time_slot} appointment was marked as Not Completed because you arrived outside your selected time window.`,
            appointmentId: updatedAppointment.id,
          });
        }

        return res.status(409).json({
          code: 'APPOINTMENT_SKIPPED',
          message: `Your selected appointment time was ${appointment.time_slot}. Because you arrived after that time window, your appointment has been marked as skipped.`,
          skipped: true,
          queueNumber: updatedQueue.rows[0]?.queue_number || queueRow.queue_number || '',
          user: buildKioskUserPayload(user),
          hasAppointmentToday: true,
          appointment: mapKioskAppointment(updatedAppointment || { ...appointment, status: 'Not Completed' }),
        });
      } catch (error) {
        await client.query('ROLLBACK');
        return res.status(500).json({
          message: 'Failed to update the missed appointment status.',
          error: error.message,
        });
      } finally {
        client.release();
      }
    }

    const existingQueue = await getExistingQueueForAppointment(appointment.id);
    if (existingQueue?.checked_in_at) {
      return res.json(buildKioskResult({
        user,
        appointment,
        queueNumber: existingQueue.queue_number || '',
      }));
    }

    return res.json(buildKioskResult({
      user,
      appointment,
      queueNumber: '',
    }));
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to complete kiosk check-in.',
      error: error.message,
    });
  }
});

app.post('/api/kiosk/confirm-check-in', async (req, res) => {
  const appointmentId = normalizeIdentifier(req.body?.appointmentId);

  if (!appointmentId) {
    return res.status(400).json({ message: 'A valid appointment id is required.' });
  }

  try {
    const { user, appointment } = await findKioskCheckInContextByAppointmentId(appointmentId);
    if (!user || !appointment) {
      return res.status(404).json({
        code: 'NO_APPOINTMENT_TODAY',
        message: 'No active appointment was found for today.',
      });
    }

    const arrivalWindow = evaluateAppointmentArrivalWindow(appointment.time_slot);
    if (arrivalWindow.status === 'early') {
      return res.status(409).json({
        code: 'APPOINTMENT_TOO_EARLY',
        message: `Your appointment is scheduled for ${appointment.time_slot}. Please come back during your selected time window.`,
        user: buildKioskUserPayload(user),
        appointment: mapKioskAppointment(appointment),
      });
    }

    if (arrivalWindow.status === 'missed') {
      return res.status(409).json({
        code: 'APPOINTMENT_SKIPPED',
        message: `Your selected appointment time was ${appointment.time_slot}. This appointment can no longer be checked in because the time window has already passed.`,
        skipped: true,
        user: buildKioskUserPayload(user),
        hasAppointmentToday: true,
        appointment: mapKioskAppointment(appointment),
      });
    }

    return res.json(await finalizeKioskCheckIn({ user, appointment }));
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to confirm kiosk check-in.',
      error: error.message,
    });
  }
});

app.get('/api/appointments/slots', loadAuthenticatedUser, async (req, res) => {
  const date = normalizeIdentifier(req.query?.date);
  const timeSlot = formatTimeSlotLabel(normalizeIdentifier(req.query?.timeSlot));

  if (!date) {
    return res.status(400).json({ message: 'Date is required.' });
  }

  try {
    await markMissedAppointmentsAsNotCompleted();
    const completedStatus = await toDatabaseAppointmentStatus('Completed');
    const notCompletedStatus = await toDatabaseAppointmentStatus('Not Completed');
    const slotDefinitions = await getSlotDefinitions();
    const { rows } = await pool.query(
      `
        SELECT time_slot, COUNT(*)::int AS booked_count
        FROM public.appointments
        WHERE appointment_date = $1
          AND status NOT IN ($2, $3)
        GROUP BY time_slot
      `,
      [date, completedStatus, notCompletedStatus],
    );

    const bookedBySlot = new Map(
      rows.map((row) => [formatTimeSlotLabel(row.time_slot), row.booked_count]),
    );
    const slots = slotDefinitions.map((slot) => {
      const booked = bookedBySlot.get(slot.timeSlot) || 0;
      return {
        id: slot.id || null,
        timeSlot: slot.timeSlot,
        maxCapacity: slot.maxCapacity,
        remaining: Math.max(0, slot.maxCapacity - booked),
      };
    });

    if (timeSlot) {
      const single = slots.find((slot) => slot.timeSlot === timeSlot);
      return res.json(single || { timeSlot, maxCapacity: 50, remaining: 50 });
    }

    return res.json({ slots });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load slot availability.', error: error.message });
  }
});

app.post('/api/appointments', loadAuthenticatedUser, async (req, res) => {
  const patientName = normalizeIdentifier(req.body?.patientName) || [req.authUser.firstname, req.authUser.lastname].filter(Boolean).join(' ');
  const service = normalizeIdentifier(req.body?.service);
  const subcategory = normalizeIdentifier(req.body?.subcategory);
  const requestedPurpose = normalizeIdentifier(req.body?.purpose);
  const purpose = isGuestUserType(getEffectiveUserType(req.authUser))
    ? 'School Requirement'
    : requestedPurpose;
  const date = normalizeIdentifier(req.body?.date);
  const timeSlot = formatTimeSlotLabel(normalizeIdentifier(req.body?.time));
  const notes = normalizeIdentifier(req.body?.notes);
  const attachments = Array.isArray(req.body?.attachments) ? req.body.attachments : [];

  if (!patientName || !service || !subcategory || !purpose || !date || !timeSlot) {
    return res.status(400).json({ message: 'Missing required appointment fields.' });
  }
  if (!isValidAppointmentService(service)) {
    return res.status(400).json({ message: 'Invalid appointment service selected.' });
  }
  if (!isValidAppointmentSubcategory(service, subcategory)) {
    return res.status(400).json({
      message: `${service} appointments only support ${getAllowedAppointmentSubcategories(service).join(' or ')}.`,
    });
  }
  if (attachments.length > 0 && !appointmentAllowsRequirementUploads(service, subcategory)) {
    return res.status(400).json({
      message: 'Requirement file uploads are only allowed for Medical Certification appointments.',
    });
  }

  try {
    await markMissedAppointmentsAsNotCompleted();
    const initialStatus = await getInitialAppointmentStatus();
    const completedStatus = await toDatabaseAppointmentStatus('Completed');
    const notCompletedStatus = await toDatabaseAppointmentStatus('Not Completed');
    const requestedScheduleState = evaluateScheduledAppointmentState(date, timeSlot);
    if (requestedScheduleState.status === 'past') {
      return res.status(409).json({
        message: 'The selected appointment date and time slot is no longer available for booking.',
      });
    }
    if (requestedScheduleState.status === 'unknown') {
      return res.status(400).json({
        message: 'The selected appointment time slot is invalid.',
      });
    }

    const { rows: conflictingRows } = await pool.query(
      `
        SELECT id
        FROM public.appointments
        WHERE user_id = $1
          AND appointment_date = $2
          AND time_slot = $3
          AND status NOT IN ($4, $5)
        LIMIT 1
      `,
      [req.authUser.id, date, timeSlot, completedStatus, notCompletedStatus],
    );

    if (conflictingRows[0]) {
      return res.status(409).json({ message: 'You already have an appointment in that same date and time slot.' });
    }

    const slotDefinition = await getOrCreateSlotDefinition(timeSlot);
    if (!slotDefinition) {
      return res.status(400).json({ message: 'Selected time slot is no longer available.' });
    }
    const { rows: bookedRows } = await pool.query(
      `
        SELECT time_slot, COUNT(*)::int AS booked_count
        FROM public.appointments
        WHERE appointment_date = $1
          AND status NOT IN ($2, $3)
          AND time_slot IS NOT NULL
        GROUP BY time_slot
      `,
      [date, completedStatus, notCompletedStatus],
    );

    const bookedCount = bookedRows.reduce(
      (total, row) => total + (formatTimeSlotLabel(row.time_slot) === timeSlot ? Number(row.booked_count || 0) : 0),
      0,
    );
    const maxCapacity = slotDefinition?.maxCapacity || 50;
    if (bookedCount >= maxCapacity) {
      return res.status(409).json({ message: 'Selected time slot is already full.' });
    }

    const appointmentCode = await generateAppointmentCode();
    const client = await pool.connect();
    let insertedRow;
    try {
      await client.query('BEGIN');

      const inserted = await client.query(
        `
          INSERT INTO public.appointments (
            user_id,
            appointment_code,
            patient_name,
            service,
            subcategory,
            purpose,
            appointment_date,
            time_slot,
            notes,
            status,
            slot_definition_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULLIF($9, ''), $10, $11)
          RETURNING *
        `,
        [
          req.authUser.id,
          appointmentCode,
          patientName,
          service,
          subcategory,
          purpose,
          date,
          timeSlot,
          notes,
          initialStatus,
          slotDefinition?.id || null,
        ],
      );

      insertedRow = inserted.rows[0];
      if (attachments.length > 0) {
        await replaceAppointmentAttachments(client, insertedRow.id, attachments);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    await createNotification({
      userId: req.authUser.id,
      type: 'appointment_booked',
      title: 'Appointment booked',
      message: `${service} appointment scheduled for ${date} at ${timeSlot}.`,
      appointmentId: insertedRow.id,
    });

    return res.status(201).json(mapAppointmentRow(insertedRow));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to book appointment.', error: error.message });
  }
});

app.patch('/api/appointments/:id/reschedule', loadAuthenticatedUser, async (req, res) => {
  const id = normalizeIdentifier(req.params?.id);
  const patientName = normalizeIdentifier(req.body?.patientName) || [req.authUser.firstname, req.authUser.lastname].filter(Boolean).join(' ');
  const service = normalizeIdentifier(req.body?.service);
  const subcategory = normalizeIdentifier(req.body?.subcategory);
  const requestedPurpose = normalizeIdentifier(req.body?.purpose);
  const purpose = isGuestUserType(getEffectiveUserType(req.authUser))
    ? 'School Requirement'
    : requestedPurpose;
  const date = normalizeIdentifier(req.body?.date);
  const timeSlot = formatTimeSlotLabel(normalizeIdentifier(req.body?.time));
  const notes = normalizeIdentifier(req.body?.notes);
  const attachments = Array.isArray(req.body?.attachments) ? req.body.attachments : [];

  if (!id || !patientName || !service || !subcategory || !purpose || !date || !timeSlot) {
    return res.status(400).json({ message: 'Missing required appointment fields for reschedule.' });
  }
  if (!isValidAppointmentService(service)) {
    return res.status(400).json({ message: 'Invalid appointment service selected.' });
  }
  if (!isValidAppointmentSubcategory(service, subcategory)) {
    return res.status(400).json({
      message: `${service} appointments only support ${getAllowedAppointmentSubcategories(service).join(' or ')}.`,
    });
  }
  if (attachments.length > 0 && !appointmentAllowsRequirementUploads(service, subcategory)) {
    return res.status(400).json({
      message: 'Requirement file uploads are only allowed for Medical Certification appointments.',
    });
  }

  try {
    await markMissedAppointmentsAsNotCompleted();
    const notCompletedStatus = await toDatabaseAppointmentStatus('Not Completed');
    const completedStatus = await toDatabaseAppointmentStatus('Completed');
    const existing = await pool.query(
      `
        SELECT *
        FROM public.appointments
        WHERE id = $1
          AND user_id = $2
        LIMIT 1
      `,
      [id, req.authUser.id],
    );

    if (!existing.rows[0]) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    const existingAppointment = existing.rows[0];
    const existingStatus = mapAppointmentStatusFromDatabase(existingAppointment.status);
    if (['Completed', 'Not Completed'].includes(existingStatus)) {
      return res.status(409).json({
        message: 'Missed, not attended, or completed appointments cannot be rescheduled. Please create a new appointment instead.',
      });
    }

    const existingScheduleState = evaluateScheduledAppointmentState(existingAppointment.appointment_date, existingAppointment.time_slot);
    if (existingScheduleState.status !== 'upcoming') {
      return res.status(409).json({ message: 'Only upcoming appointments can be rescheduled.' });
    }

    if (existingAppointment.service && existingAppointment.service !== service) {
      return res.status(409).json({
        message: 'Appointments can only be rescheduled within the same service. Please create a new appointment for a different service.',
      });
    }

    const requestedScheduleState = evaluateScheduledAppointmentState(date, timeSlot);
    if (requestedScheduleState.status !== 'upcoming') {
      return res.status(409).json({ message: 'Appointments can only be rescheduled to a future date and time slot.' });
    }

    const { rows: conflictingRows } = await pool.query(
      `
        SELECT id
        FROM public.appointments
        WHERE user_id = $1
          AND appointment_date = $2
          AND time_slot = $3
          AND status NOT IN ($4, $5)
          AND id <> $6
        LIMIT 1
      `,
      [req.authUser.id, date, timeSlot, completedStatus, notCompletedStatus, id],
    );

    if (conflictingRows[0]) {
      return res.status(409).json({ message: 'You already have an appointment in that same date and time slot.' });
    }

    const slotDefinition = await getOrCreateSlotDefinition(timeSlot);
    if (!slotDefinition) {
      return res.status(400).json({ message: 'Selected time slot is no longer available.' });
    }
    const { rows: bookedRows } = await pool.query(
      `
        SELECT time_slot, COUNT(*)::int AS booked_count
        FROM public.appointments
        WHERE appointment_date = $1
          AND status NOT IN ($2, $3)
          AND time_slot IS NOT NULL
          AND id <> $4
        GROUP BY time_slot
      `,
      [date, completedStatus, notCompletedStatus, id],
    );

    const bookedCount = bookedRows.reduce(
      (total, row) => total + (formatTimeSlotLabel(row.time_slot) === timeSlot ? Number(row.booked_count || 0) : 0),
      0,
    );
    const maxCapacity = slotDefinition?.maxCapacity || 50;
    if (bookedCount >= maxCapacity) {
      return res.status(409).json({ message: 'Selected time slot is already full.' });
    }

    const resetStatus = await getInitialAppointmentStatus();
    const client = await pool.connect();
    let updatedRow;
    try {
      await client.query('BEGIN');

      const updated = await client.query(
        `
          UPDATE public.appointments
          SET patient_name = $2,
              service = $3,
              subcategory = $4,
              purpose = $5,
              appointment_date = $6,
              time_slot = $7,
              notes = NULLIF($8, ''),
              status = $9,
              slot_definition_id = $10,
              cancelled_at = NULL,
              cancellation_reason = NULL
          WHERE id = $1
            AND user_id = $11
          RETURNING *
        `,
        [id, patientName, service, subcategory, purpose, date, timeSlot, notes, resetStatus, slotDefinition?.id || null, req.authUser.id],
      );

      updatedRow = updated.rows[0];
      if (appointmentAllowsRequirementUploads(service, subcategory) && attachments.length > 0) {
        await replaceAppointmentAttachments(client, id, attachments);
      } else if (!appointmentAllowsRequirementUploads(service, subcategory)) {
        await replaceAppointmentAttachments(client, id, []);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return res.json(mapAppointmentRow(updatedRow));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to reschedule appointment.', error: error.message });
  }
});

app.get('/api/appointments/:id/attachments', loadAuthenticatedUser, async (req, res) => {
  const id = normalizeIdentifier(req.params?.id);

  if (!id) {
    return res.status(400).json({ message: 'Appointment id is required.' });
  }

  try {
    const { rows } = await pool.query(
      `
        SELECT id, user_id
        FROM public.appointments
        WHERE id = $1
        LIMIT 1
      `,
      [id],
    );
    const appointment = rows[0];

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    if (!ensureSelfOrAdmin(req, res, appointment.user_id, 'You are not authorized to view these appointment attachments.')) {
      return;
    }

    const attachments = await getAppointmentAttachments(id);
    return res.json({ attachments: await appendAttachmentUrls(attachments) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load appointment attachments.', error: error.message });
  }
});

app.get('/api/appointments', loadAuthenticatedUser, async (req, res) => {
  try {
    await markMissedAppointmentsAsNotCompleted();
    const { rows } = await pool.query(
      `
        SELECT
          a.*,
          u.college AS appointment_college,
          u.program AS appointment_program,
          u.student_number AS appointment_student_number,
          u.employee_number AS appointment_employee_number,
          u.id_number AS appointment_id_number,
          u.user_type AS appointment_user_type,
          u.role AS appointment_user_role
        FROM public.appointments AS a
        LEFT JOIN public.users_auth AS u
          ON u.id = a.user_id
        WHERE a.user_id = $1
        ORDER BY appointment_date DESC, created_at DESC
      `,
      [req.authUser.id],
    );

    return res.json(rows.map(mapAppointmentRow));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load appointments.', error: error.message });
  }
});

app.get('/api/appointments/all', loadAuthenticatedUser, async (req, res) => {
  if (!ensureAdmin(req, res, 'Only admins can view all appointments.')) {
    return;
  }

  try {
    await markMissedAppointmentsAsNotCompleted();
    const { rows } = await pool.query(
      `
        SELECT
          a.*,
          u.college AS appointment_college,
          u.program AS appointment_program,
          u.student_number AS appointment_student_number,
          u.employee_number AS appointment_employee_number,
          u.id_number AS appointment_id_number,
          u.user_type AS appointment_user_type,
          u.role AS appointment_user_role
        FROM public.appointments AS a
        LEFT JOIN public.users_auth AS u
          ON u.id = a.user_id
        ORDER BY a.appointment_date DESC, a.created_at DESC
      `,
    );

    return res.json(rows.map(mapAppointmentRow));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load all appointments.', error: error.message });
  }
});

app.get('/api/consultations/patients', loadAuthenticatedUser, async (req, res) => {
  if (!ensureAdmin(req, res, 'Only admins can view consultation patients.')) {
    return;
  }

  try {
    const { rows } = await pool.query(
      `
        SELECT id, firstname, middle_initial, lastname, email, student_number, employee_number
        FROM public.users_auth
        WHERE COALESCE(user_type, role, '') NOT IN ('admin', 'super_admin')
        ORDER BY firstname ASC, lastname ASC, email ASC
      `,
    );

    return res.json(rows.map(mapPatientRow));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load consultation patients.', error: error.message });
  }
});

app.get('/api/consultations/:userId/logs', loadAuthenticatedUser, async (req, res) => {
  const userId = normalizeIdentifier(req.params?.userId);

  if (!userId) {
    return res.status(400).json({ message: 'User id is required.' });
  }
  if (!ensureSelfOrAdmin(req, res, userId, 'You are not authorized to view these consultation logs.')) {
    return;
  }

  try {
    const { rows } = await pool.query(
      `
        SELECT id, user_id, recorded_by, systolic, diastolic, notes, recorded_at, attachment_path, attachment_mime
        FROM public.consultation_logs
        WHERE user_id = $1
        ORDER BY recorded_at DESC
      `,
      [userId],
    );

    const logs = await Promise.all(
      rows.map(async (row) => {
        const attachment = row.attachment_path
          ? await appendAttachmentUrl({
              attachmentPath: row.attachment_path,
              attachmentMime: row.attachment_mime,
            })
          : { attachmentUrl: null };

        return {
          id: row.id,
          userId: row.user_id,
          recordedBy: row.recorded_by,
          systolic: row.systolic,
          diastolic: row.diastolic,
          notes: row.notes || '',
          recordedAt: row.recorded_at,
          attachmentPath: row.attachment_path || null,
          attachmentMime: row.attachment_mime || null,
          attachmentUrl: attachment.attachmentUrl || null,
        };
      }),
    );

    return res.json(logs);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load consultation logs.', error: error.message });
  }
});

app.post('/api/consultations/:userId/logs', loadAuthenticatedUser, async (req, res) => {
  if (!ensureAdmin(req, res, 'Only admins can create consultation logs.')) {
    return;
  }

  const userId = normalizeIdentifier(req.params?.userId);
  const systolic = Number(req.body?.systolic);
  const diastolic = Number(req.body?.diastolic);
  const notes = normalizeIdentifier(req.body?.notes);

  if (!userId || Number.isNaN(systolic) || Number.isNaN(diastolic)) {
    return res.status(400).json({ message: 'User id, systolic, and diastolic are required.' });
  }

  try {
    const { rows } = await pool.query(
      `
        INSERT INTO public.consultation_logs (
          user_id,
          recorded_by,
          systolic,
          diastolic,
          notes
        )
        VALUES ($1, $2, $3, $4, NULLIF($5, ''))
        RETURNING *
      `,
      [userId, req.authUser.id, systolic, diastolic, notes],
    );

    await createAdminActivityLog({
      adminUserId: req.authUser.id,
      adminUserName: getUserDisplayName(req.authUser),
      actionType: 'consultation_log_created',
      message: `Created consultation log for patient ${userId}.`,
      changedData: { userId, systolic, diastolic },
      targetType: 'consultation_log',
      targetId: rows[0]?.id || null,
    });

    const createdAttachment = rows[0].attachment_path
      ? await appendAttachmentUrl({
          attachmentPath: rows[0].attachment_path,
          attachmentMime: rows[0].attachment_mime,
        })
      : { attachmentUrl: null };

    return res.status(201).json({
      id: rows[0].id,
      userId: rows[0].user_id,
      recordedBy: rows[0].recorded_by,
      systolic: rows[0].systolic,
      diastolic: rows[0].diastolic,
      notes: rows[0].notes || '',
      recordedAt: rows[0].recorded_at,
      attachmentPath: rows[0].attachment_path || null,
      attachmentMime: rows[0].attachment_mime || null,
      attachmentUrl: createdAttachment.attachmentUrl || null,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to save consultation log.', error: error.message });
  }
});

app.get('/api/medical-records/patients', loadAuthenticatedUser, async (req, res) => {
  if (!ensureAdmin(req, res, 'Only admins can view medical record patients.')) {
    return;
  }

  try {
    const { rows } = await pool.query(
      `
        SELECT id, firstname, middle_initial, lastname, email, student_number, employee_number
        FROM public.users_auth
        WHERE COALESCE(user_type, role, '') NOT IN ('admin', 'super_admin')
        ORDER BY firstname ASC, lastname ASC, email ASC
      `,
    );

    return res.json(rows.map(mapPatientRow));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load medical record patients.', error: error.message });
  }
});

app.get('/api/medical-records/:userId/records', loadAuthenticatedUser, async (req, res) => {
  const userId = normalizeIdentifier(req.params?.userId);

  if (!userId) {
    return res.status(400).json({ message: 'User id is required.' });
  }
  if (!ensureSelfOrAdmin(req, res, userId, 'You are not authorized to view these medical records.')) {
    return;
  }

  try {
    const { rows } = await pool.query(
      `
        SELECT
          mr.id,
          mr.user_id,
          mr.recorded_by,
          mr.title,
          mr.notes,
          mr.recorded_at,
          mr.attachment_path,
          mr.attachment_mime,
          mr.appointment_id,
          mr.queue_id,
          mr.record_type,
          mr.purpose,
          mra.id AS attachment_id,
          mra.attachment_path AS attachment_item_path,
          mra.attachment_mime AS attachment_item_mime,
          mra.requirement_label AS attachment_item_requirement_label,
          mra.original_name AS attachment_item_name,
          mra.created_at AS attachment_item_created_at
        FROM public.medical_records mr
        LEFT JOIN public.medical_record_attachments mra ON mra.record_id = mr.id
        WHERE mr.user_id = $1
        ORDER BY mr.recorded_at DESC, mra.created_at ASC
      `,
      [userId],
    );

    const byRecord = new Map();
    rows.forEach((row) => {
      if (!byRecord.has(row.id)) {
        byRecord.set(row.id, {
          id: row.id,
          userId: row.user_id,
          recordedBy: row.recorded_by,
          title: row.title,
          notes: row.notes || '',
          recordedAt: row.recorded_at,
          attachmentPath: row.attachment_path || null,
          attachmentMime: row.attachment_mime || null,
          appointmentId: row.appointment_id || null,
          queueId: row.queue_id || null,
          recordType: row.record_type || null,
          purpose: row.purpose || null,
          attachments: [],
        });
      }

      if (row.attachment_id) {
        byRecord.get(row.id).attachments.push({
          id: row.attachment_id,
          attachmentPath: row.attachment_item_path,
          attachmentMime: row.attachment_item_mime,
          requirementLabel: row.attachment_item_requirement_label || null,
          originalName: row.attachment_item_name || null,
          createdAt: row.attachment_item_created_at || null,
        });
      }
    });

    const records = await Promise.all(
      Array.from(byRecord.values()).map(async (record) => {
        const attachments = await appendAttachmentUrls(record.attachments || []);
        const primaryAttachment = record.attachmentPath
          ? await appendAttachmentUrl({
              attachmentPath: record.attachmentPath,
              attachmentMime: record.attachmentMime,
            })
          : { attachmentUrl: null };

        return {
          ...record,
          attachmentUrl: primaryAttachment.attachmentUrl || null,
          attachments,
        };
      }),
    );

    return res.json(records);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load medical records.', error: error.message });
  }
});

app.post('/api/medical-records/:userId/records', loadAuthenticatedUser, async (req, res) => {
  if (!ensureAdmin(req, res, 'Only admins can create medical records.')) {
    return;
  }

  const userId = normalizeIdentifier(req.params?.userId);
  const title = normalizeIdentifier(req.body?.title);
  const notes = normalizeIdentifier(req.body?.notes);
  const recordType = normalizeIdentifier(req.body?.recordType);
  const purpose = normalizeIdentifier(req.body?.purpose);
  const appointmentId = normalizeIdentifier(req.body?.appointmentId);
  const queueId = normalizeIdentifier(req.body?.queueId);
  const isHardcopyVerified = req.body?.isHardcopyVerified === true;
  const certificateIssued = req.body?.certificateIssued === true;
  const attachments = Array.isArray(req.body?.attachments) ? req.body.attachments : [];
  const normalizedRecordLabel = String(recordType || title || '').toLowerCase();
  const isCertificationRecord =
    certificateIssued ||
    normalizedRecordLabel.includes('certification') ||
    normalizedRecordLabel.includes('certificate');
  const appointmentMetadata =
    appointmentId
      ? await pool
          .query(
            `
              SELECT service, subcategory
              FROM public.appointments
              WHERE id = $1
              LIMIT 1
            `,
            [appointmentId],
          )
          .then((result) => result.rows[0] || null)
          .catch(() => null)
      : null;
  const appointmentRequiresRequirementFiles = appointmentAllowsRequirementUploads(
    appointmentMetadata?.service,
    appointmentMetadata?.subcategory,
  );

  const appointmentAttachmentSource =
    appointmentId
      ? await getAppointmentAttachments(appointmentId).catch(() => [])
      : [];

  if (!userId || !title) {
    return res.status(400).json({ message: 'User id and title are required.' });
  }
  if (
    isCertificationRecord &&
    appointmentRequiresRequirementFiles &&
    attachments.length === 0 &&
    appointmentAttachmentSource.length === 0
  ) {
    return res.status(400).json({
      message: 'At least one uploaded requirement file from the user appointment is required before issuing a medical certificate.',
    });
  }
  if (isCertificationRecord && appointmentRequiresRequirementFiles && !isHardcopyVerified) {
    return res.status(400).json({
      message: 'Hardcopy verification is required before issuing a medical certificate.',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const savedAttachments = [];
    if (attachments.length > 0) {
      for (const attachment of attachments) {
        if (!attachment?.dataUrl) continue;
        const saved = await saveDataUrlAttachment({
          dataUrl: attachment.dataUrl,
          mimeType: attachment.type,
          originalName: attachment.name,
          storageCategory: 'medical-records',
        });
        savedAttachments.push(saved);
      }
    } else if (appointmentAttachmentSource.length > 0) {
      savedAttachments.push(
        ...appointmentAttachmentSource.map((attachment) => ({
          attachmentPath: attachment.attachmentPath,
          attachmentMime: attachment.attachmentMime,
          requirementLabel: attachment.requirementLabel || null,
          originalName: attachment.originalName,
        })),
      );
    }

    const primaryAttachment = savedAttachments[0] || null;
    const finalNotes = [
      notes || '',
      isCertificationRecord && appointmentRequiresRequirementFiles
        ? `Hardcopy verification: ${isHardcopyVerified ? 'Verified' : 'Not verified'}`
        : '',
      isCertificationRecord && appointmentRequiresRequirementFiles && certificateIssued
        ? 'Certificate issuance: Completed'
        : '',
    ]
      .filter(Boolean)
      .join('\n');
    const { rows } = await client.query(
      `
        INSERT INTO public.medical_records (
          user_id,
          recorded_by,
          title,
          notes,
          attachment_path,
          attachment_mime,
          appointment_id,
          queue_id,
          record_type,
          purpose
        )
        VALUES (
          $1, $2, $3, NULLIF($4, ''), $5, $6,
          NULLIF($7, '')::uuid,
          NULLIF($8, '')::uuid,
          NULLIF($9, ''),
          NULLIF($10, '')
        )
        RETURNING *
      `,
      [
        userId,
        req.authUser.id,
        title,
        finalNotes,
        primaryAttachment?.attachmentPath || null,
        primaryAttachment?.attachmentMime || null,
        appointmentId,
        queueId,
        recordType,
        purpose,
      ],
    );

    for (const attachment of savedAttachments) {
      await client.query(
        `
          INSERT INTO public.medical_record_attachments (
            record_id,
            attachment_path,
            attachment_mime,
            requirement_label,
            original_name
          )
          VALUES ($1, $2, $3, $4, $5)
        `,
        [rows[0].id, attachment.attachmentPath, attachment.attachmentMime, attachment.requirementLabel || null, attachment.originalName],
      );
    }

    let updatedAppointment = null;
    if (queueId) {
      await client.query(
        `
          UPDATE public.queues
          SET status = 'Done'
          WHERE id = $1
        `,
        [queueId],
      );

      updatedAppointment = await syncAppointmentStatusFromQueue(
        client,
        queueId,
        'Done',
        appointmentId || null,
      );
    } else if (appointmentId) {
      updatedAppointment = await syncAppointmentStatusFromQueue(
        client,
        null,
        'Done',
        appointmentId,
      );
    }

    await client.query('COMMIT');

    if (updatedAppointment?.user_id) {
      await createNotification({
        userId: updatedAppointment.user_id,
        type: 'appointment_status',
        title: 'Appointment updated',
        message: 'Your appointment status is now Completed.',
        appointmentId: updatedAppointment.id,
      });
    }

    await createAdminActivityLog({
      adminUserId: req.authUser.id,
      adminUserName: getUserDisplayName(req.authUser),
      actionType: 'medical_record_created',
      message: `Created medical record for patient ${userId}.`,
      changedData: {
        userId,
        title,
        attachmentCount: savedAttachments.length,
        isCertificationRecord,
        isHardcopyVerified,
        certificateIssued,
      },
      targetType: 'medical_record',
      targetId: rows[0]?.id || null,
    });

    const responseAttachments = await appendAttachmentUrls(savedAttachments);
    const primaryAttachmentAsset = rows[0].attachment_path
      ? await appendAttachmentUrl({
          attachmentPath: rows[0].attachment_path,
          attachmentMime: rows[0].attachment_mime,
        })
      : { attachmentUrl: null };

    return res.status(201).json({
      id: rows[0].id,
      userId: rows[0].user_id,
      recordedBy: rows[0].recorded_by,
      title: rows[0].title,
      notes: rows[0].notes || '',
      recordedAt: rows[0].recorded_at,
      attachmentPath: rows[0].attachment_path || null,
      attachmentMime: rows[0].attachment_mime || null,
      attachmentUrl: primaryAttachmentAsset.attachmentUrl || null,
      appointmentId: rows[0].appointment_id || null,
      queueId: rows[0].queue_id || null,
      recordType: rows[0].record_type || null,
      purpose: rows[0].purpose || null,
      attachments: responseAttachments,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ message: 'Failed to save medical record.', error: error.message });
  } finally {
    client.release();
  }
});

app.patch('/api/appointments/:id/status', loadAuthenticatedUser, async (req, res) => {
  if (!ensureAdmin(req, res, 'Only admins can update appointment status.')) {
    return;
  }

  const status = normalizeIdentifier(req.body?.status);
  const id = normalizeIdentifier(req.params?.id);

  if (!id || !status) {
    return res.status(400).json({ message: 'Appointment id and status are required.' });
  }

  try {
    const dbStatus = await toDatabaseAppointmentStatus(status);
    const { rows } = await pool.query(
      `
        UPDATE public.appointments
        SET status = $2
        WHERE id = $1
        RETURNING *
      `,
      [id, dbStatus],
    );

    if (!rows[0]) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    await createNotification({
      userId: rows[0].user_id,
      type: 'appointment_status',
      title: 'Appointment updated',
      message: `Your appointment status is now ${mapAppointmentStatusFromDatabase(rows[0].status)}.`,
      appointmentId: rows[0].id,
    });

    return res.json(mapAppointmentRow(rows[0]));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update appointment status.', error: error.message });
  }
});

app.post('/api/appointments/:id/cancel', loadAuthenticatedUser, async (req, res) => {
  const id = normalizeIdentifier(req.params?.id);
  const reason = normalizeIdentifier(req.body?.reason);

  if (!id) {
    return res.status(400).json({ message: 'Appointment id is required.' });
  }

  try {
    await markMissedAppointmentsAsNotCompleted();
    const notCompletedStatus = await toDatabaseAppointmentStatus('Not Completed');
    const existing = await pool.query(
      `
        SELECT *
        FROM public.appointments
        WHERE id = $1
          AND user_id = $2
        LIMIT 1
      `,
      [id, req.authUser.id],
    );

    if (!existing.rows[0]) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    const existingAppointment = existing.rows[0];
    const existingStatus = mapAppointmentStatusFromDatabase(existingAppointment.status, existingAppointment.cancelled_at);
    if (['Completed', 'Not Completed', 'Cancelled'].includes(existingStatus)) {
      return res.status(409).json({ message: 'Only upcoming appointments can be cancelled.' });
    }

    const existingScheduleState = evaluateScheduledAppointmentState(existingAppointment.appointment_date, existingAppointment.time_slot);
    if (existingScheduleState.status !== 'upcoming') {
      return res.status(409).json({ message: 'Only upcoming appointments can be cancelled.' });
    }

    const cancellationReason = reason || 'Cancelled by user.';
    const enrichedNotes = appendCancellationReason(existingAppointment.notes || '', cancellationReason);
    const client = await pool.connect();
    let updatedAppointment;

    try {
      await client.query('BEGIN');

      const updated = await client.query(
        `
          UPDATE public.appointments
          SET status = $3,
              notes = NULLIF($4, ''),
              cancelled_at = now(),
              cancellation_reason = NULLIF($5, '')
          WHERE id = $1
            AND user_id = $2
          RETURNING *
        `,
        [id, req.authUser.id, notCompletedStatus, enrichedNotes, cancellationReason],
      );

      updatedAppointment = updated.rows[0];

      if (!updatedAppointment) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Appointment not found.' });
      }

      await client.query(
        `
          UPDATE public.queues
          SET status = 'Cancelled'
          WHERE appointment_id = $1
            AND status <> 'Cancelled'
        `,
        [id],
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    await createNotification({
      userId: updatedAppointment.user_id,
      type: 'appointment_status',
      title: 'Appointment cancelled',
      message: 'Your appointment has been cancelled and the slot is available again.',
      appointmentId: updatedAppointment.id,
    });

    return res.json(mapAppointmentRow(updatedAppointment));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to cancel appointment.', error: error.message });
  }
});

app.get('/api/queues', loadAuthenticatedUser, async (req, res) => {
  if (!ensureAdmin(req, res, 'Only admins can view queue data.')) {
    return;
  }

  const status = normalizeIdentifier(req.query?.status);
  const date = normalizeIdentifier(req.query?.date);

  const conditions = [];
  const values = [];

  if (status && status !== 'All') {
    const dbStatus = toDatabaseQueueStatus(status);
    values.push(dbStatus);
    conditions.push(`q.status = $${values.length}`);
  }

  if (date) {
    values.push(date);
    conditions.push(`COALESCE(a.appointment_date, DATE(q.checked_in_at AT TIME ZONE 'Asia/Manila'), DATE(q.created_at)) = $${values.length}`);
  }

  conditions.push('q.checked_in_at IS NOT NULL');
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const { rows } = await pool.query(
      `
        SELECT
          q.id,
          q.user_id,
          q.queue_number,
          q.appointment_id,
          q.created_at,
          q.checked_in_at,
          q.status,
          u.firstname AS user_firstname,
          u.middle_initial AS user_middle_initial,
          u.lastname AS user_lastname,
          u.email AS user_email,
          u.student_number AS user_student_number,
          u.employee_number AS user_employee_number,
          u.id_number AS user_id_number,
          u.college AS user_college,
          u.program AS user_program,
          u.user_type AS user_user_type,
          u.role AS user_role,
          a.appointment_code,
          a.patient_name,
          a.appointment_date,
          a.time_slot AS appointment_time,
          a.service AS appointment_service,
          a.subcategory AS appointment_subcategory,
          a.purpose AS appointment_purpose,
          a.notes AS appointment_notes,
          a.status AS appointment_status
        FROM public.queues q
        LEFT JOIN public.users_auth u ON u.id = q.user_id
        LEFT JOIN public.appointments a ON a.id = q.appointment_id
        ${whereClause}
        ORDER BY COALESCE(a.appointment_date, DATE(q.checked_in_at AT TIME ZONE 'Asia/Manila'), DATE(q.created_at)) ASC, q.checked_in_at ASC NULLS LAST, q.created_at ASC, q.queue_number ASC
      `,
      values,
    );

    return res.json(rows.map(mapQueueRow));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load queues.', error: error.message });
  }
});

app.patch('/api/queues/:id/status', loadAuthenticatedUser, async (req, res) => {
  if (!ensureAdmin(req, res, 'Only admins can update queue status.')) {
    return;
  }

  const id = normalizeIdentifier(req.params?.id);
  const nextStatus = toDatabaseQueueStatus(normalizeIdentifier(req.body?.status));
  const reason = normalizeIdentifier(req.body?.reason);

  if (!id || !['Waiting', 'Serving', 'Done', 'Cancelled'].includes(nextStatus)) {
    return res.status(400).json({ message: 'A valid queue id and status are required.' });
  }
  if (nextStatus === 'Cancelled' && !reason) {
    return res.status(400).json({ message: 'A reason is required when marking as skipped/not completed.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `
        UPDATE public.queues
        SET status = $2
        WHERE id = $1
        RETURNING *
      `,
      [id, nextStatus],
    );

    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Queue entry not found.' });
    }

    const updatedAppointment = await syncAppointmentStatusFromQueue(
      client,
      rows[0].id,
      rows[0].status,
      rows[0].appointment_id || null,
    );

    if (rows[0].status === 'Cancelled' && updatedAppointment?.id) {
      const enrichedNotes = appendNotCompletedReason(updatedAppointment.notes, reason);
      await client.query(
        `
          UPDATE public.appointments
          SET notes = NULLIF($2, '')
          WHERE id = $1
        `,
        [updatedAppointment.id, enrichedNotes],
      );
      updatedAppointment.notes = enrichedNotes;
    }

    await client.query('COMMIT');

    if (updatedAppointment?.user_id) {
      await createNotification({
        userId: updatedAppointment.user_id,
        type: 'appointment_status',
        title: 'Appointment updated',
        message: `Your appointment status is now ${updatedAppointment.status}.`,
        appointmentId: updatedAppointment.id,
      });
    }

    return res.json({
      ...mapQueueRow(rows[0]),
      status: mapQueueStatus(rows[0].status),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ message: 'Failed to update queue status.', error: error.message });
  } finally {
    client.release();
  }
});

app.get('/api/queues/my', loadAuthenticatedUser, async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  try {
    const { rows } = await pool.query(
      `
        SELECT
          q.id,
          q.user_id,
          q.queue_number,
          q.appointment_id,
          q.created_at,
          q.checked_in_at,
          q.status,
          u.firstname AS user_firstname,
          u.lastname AS user_lastname,
          u.email AS user_email,
          u.student_number AS user_student_number,
          u.employee_number AS user_employee_number,
          a.appointment_code,
          a.patient_name,
          a.appointment_date,
          a.time_slot AS appointment_time,
          a.service AS appointment_service,
          a.subcategory AS appointment_subcategory,
          a.purpose AS appointment_purpose,
          a.notes AS appointment_notes,
          a.status AS appointment_status
        FROM public.queues q
        LEFT JOIN public.users_auth u ON u.id = q.user_id
        LEFT JOIN public.appointments a ON a.id = q.appointment_id
        WHERE q.user_id = $1
          AND q.checked_in_at IS NOT NULL
          AND COALESCE(a.appointment_date, DATE(q.checked_in_at AT TIME ZONE 'Asia/Manila'), DATE(q.created_at)) = $2
        ORDER BY q.checked_in_at ASC, q.created_at ASC, q.queue_number ASC
      `,
      [req.authUser.id, today],
    );

    return res.json(rows.map(mapQueueRow));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load your queue entries.', error: error.message });
  }
});

app.get('/api/notifications', loadAuthenticatedUser, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
        SELECT *
        FROM public.notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 100
      `,
      [req.authUser.id],
    );

    const notifications = rows.map(mapNotificationRow);
    const unreadCount = notifications.filter((item) => !item.readAt).length;

    return res.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to load notifications.',
      error: error.message,
    });
  }
});

app.patch('/api/notifications/:id/read', loadAuthenticatedUser, async (req, res) => {
  const id = normalizeIdentifier(req.params?.id);

  if (!id) {
    return res.status(400).json({ message: 'Notification id is required.' });
  }

  try {
    const { rows } = await pool.query(
      `
        UPDATE public.notifications
        SET read_at = COALESCE(read_at, now())
        WHERE id = $1
          AND user_id = $2
        RETURNING *
      `,
      [id, req.authUser.id],
    );

    if (!rows[0]) {
      return res.status(404).json({ message: 'Notification not found.' });
    }

    return res.json(mapNotificationRow(rows[0]));
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to mark notification as read.',
      error: error.message,
    });
  }
});

app.post('/api/notifications/read-all', loadAuthenticatedUser, async (req, res) => {
  try {
    await pool.query(
      `
        UPDATE public.notifications
        SET read_at = COALESCE(read_at, now())
        WHERE user_id = $1
          AND read_at IS NULL
      `,
      [req.authUser.id],
    );

    return res.json({
      ok: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to mark all notifications as read.',
      error: error.message,
    });
  }
});

app.get('/api/health', async (_req, res) => {
  try {
    await checkDatabaseConnection();
    res.json({
      ok: true,
      message: 'Server is running and PostgreSQL connection is ready.',
      database: process.env.DB_NAME || 'infirmary_system',
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: 'Database connection failed.',
      error: error.message,
    });
  }
});

if (fs.existsSync(clientIndexPath)) {
  app.use(express.static(clientDistDir));

  app.get('*', (req, res, next) => {
    if (req.path === '/api' || req.path.startsWith('/api/')) {
      return next();
    }

    if (req.path === '/uploads' || req.path.startsWith('/uploads/')) {
      return next();
    }

    return res.sendFile(clientIndexPath);
  });
}

async function runStartupMaintenance() {
  try {
    console.log('Running syncDefaultSlotDefinitions...');
    await syncDefaultSlotDefinitions();

    console.log('Running ensureQueueCheckInTracking...');
    await ensureQueueCheckInTracking();

    console.log('Running ensureAppointmentCancellationTracking...');
    await ensureAppointmentCancellationTracking();

    console.log('Running ensureAppointmentAttachmentsTable...');
    await ensureAppointmentAttachmentsTable();

    console.log('Running ensureMedicalRecordAttachmentLabels...');
    await ensureMedicalRecordAttachmentLabels();

    console.log('Running markMissedAppointmentsAsNotCompleted...');
    await markMissedAppointmentsAsNotCompleted();

    console.log('Startup maintenance finished.');
  } catch (error) {
    console.error('Startup maintenance failed:', error);
  }
}

void runStartupMaintenance();
setInterval(() => {
  void markMissedAppointmentsAsNotCompleted().catch((error) => {
console.error("Startup maintenance failed:", error.message);
  });
}, 60 * 1000);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
