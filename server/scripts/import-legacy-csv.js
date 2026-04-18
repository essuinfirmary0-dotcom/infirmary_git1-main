import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { pool } from '../src/config/db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..', '..', '..');
const csvDir = path.join(workspaceRoot, 'csv_fiiles');

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

async function readCsv(fileName) {
  const content = await fs.readFile(path.join(csvDir, fileName), 'utf8');
  const rawLines = content.replace(/^\uFEFF/, '').split(/\r?\n/);
  const lines = [];
  let currentLine = '';
  let quoteCount = 0;

  for (const rawLine of rawLines) {
    if (currentLine.length > 0) {
      currentLine += '\n';
    }

    currentLine += rawLine;

    const escapedQuotes = rawLine.match(/""/g)?.length || 0;
    const lineQuotes = (rawLine.match(/"/g)?.length || 0) - escapedQuotes * 2;
    quoteCount += lineQuotes;

    if (quoteCount % 2 === 0) {
      if (currentLine.length > 0) {
        lines.push(currentLine);
      }
      currentLine = '';
      quoteCount = 0;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  const nonEmptyLines = lines.filter((line) => line.length > 0);

  if (nonEmptyLines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(nonEmptyLines[0]);

  return nonEmptyLines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce((row, header, index) => {
      row[header] = values[index] ?? '';
      return row;
    }, {});
  });
}

function nullIfBlank(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

function cleanedStatus(value) {
  const raw = nullIfBlank(value);
  if (!raw) {
    return 'active';
  }

  return raw.replace(/::text$/i, '').replace(/^'+|'+$/g, '').trim();
}

function normalizeUserType(role) {
  const cleaned = (nullIfBlank(role) || 'student').toLowerCase();

  if (cleaned === 'student' || cleaned === 'ojt') {
    return 'student';
  }

  if (cleaned === 'faculty') {
    return 'faculty';
  }

  if (cleaned === 'admin') {
    return 'admin';
  }

  if (cleaned === 'employee') {
    return 'employee';
  }

  return 'staff';
}

async function ensureSchemaExists(client) {
  const result = await client.query(`
    SELECT to_regclass('public.users_auth') AS users_auth,
           to_regclass('public.attendance_records') AS attendance_records,
           to_regclass('public.departments') AS departments,
           to_regclass('public.faculties') AS faculties
  `);

  const row = result.rows[0];
  if (!row.users_auth || !row.attendance_records || !row.departments || !row.faculties) {
    throw new Error(
      'Required tables are missing. Run schema.txt in pgAdmin first, then rerun this importer.',
    );
  }
}

async function upsertDepartments(client, departments) {
  const departmentMap = new Map();

  for (const row of departments) {
    await client.query(
      `
        INSERT INTO public.departments (id, name, type, created_at)
        VALUES ($1, $2, $3, COALESCE($4::timestamptz, now()))
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name,
            type = EXCLUDED.type,
            created_at = EXCLUDED.created_at
      `,
      [row.id, row.name, nullIfBlank(row.type), nullIfBlank(row.created_at)],
    );

    if (row.name) {
      departmentMap.set(row.name.trim().toLowerCase(), row.id);
    }
  }

  return departmentMap;
}

async function upsertUsers(client, users) {
  const idNumberCounts = new Map();

  for (const row of users) {
    const idNumber = nullIfBlank(row.id_number);
    if (!idNumber) {
      continue;
    }

    idNumberCounts.set(idNumber, (idNumberCounts.get(idNumber) || 0) + 1);
  }

  for (const row of users) {
    const userType = normalizeUserType(row.role);
    const idNumber = nullIfBlank(row.id_number);
    const role = nullIfBlank(row.role);
    const hasDuplicateIdNumber = idNumber ? (idNumberCounts.get(idNumber) || 0) > 1 : false;
    const studentNumber = userType === 'student' && !hasDuplicateIdNumber ? idNumber : null;
    const employeeNumber = userType !== 'student' && !hasDuplicateIdNumber ? idNumber : null;

    await client.query(
      `
        INSERT INTO public.users_auth (
          id,
          lastname,
          firstname,
          middle_initial,
          id_number,
          picture_url,
          role,
          registration_date,
          qr_code,
          department_program,
          qr_code_generated_at,
          status,
          qr_data,
          user_type,
          email,
          student_number,
          employee_number,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8::date, $9, $10,
          $11::timestamptz, $12, $13, $14, $15, $16, $17,
          COALESCE($18::timestamptz, now()), COALESCE($19::timestamptz, now())
        )
        ON CONFLICT (id) DO UPDATE
        SET lastname = EXCLUDED.lastname,
            firstname = EXCLUDED.firstname,
            middle_initial = EXCLUDED.middle_initial,
            id_number = EXCLUDED.id_number,
            picture_url = EXCLUDED.picture_url,
            role = EXCLUDED.role,
            registration_date = EXCLUDED.registration_date,
            qr_code = EXCLUDED.qr_code,
            department_program = EXCLUDED.department_program,
            qr_code_generated_at = EXCLUDED.qr_code_generated_at,
            status = EXCLUDED.status,
            qr_data = EXCLUDED.qr_data,
            user_type = EXCLUDED.user_type,
            email = EXCLUDED.email,
            student_number = COALESCE(EXCLUDED.student_number, public.users_auth.student_number),
            employee_number = COALESCE(EXCLUDED.employee_number, public.users_auth.employee_number),
            updated_at = EXCLUDED.updated_at
      `,
      [
        row.id,
        nullIfBlank(row.lastname),
        nullIfBlank(row.firstname),
        nullIfBlank(row.middle_initial),
        idNumber,
        nullIfBlank(row.picture_url),
        role,
        nullIfBlank(row.registration_date),
        nullIfBlank(row.qr_code),
        nullIfBlank(row.department_program),
        nullIfBlank(row.qr_code_generated_at),
        cleanedStatus(row.status),
        nullIfBlank(row.qr_data),
        userType,
        nullIfBlank(row.email),
        studentNumber,
        employeeNumber,
        nullIfBlank(row.created_at),
        nullIfBlank(row.created_at),
      ],
    );
  }
}

function findDepartmentId(row, departmentMap) {
  const candidates = [row.department, row.college]
    .map((value) => nullIfBlank(value))
    .filter(Boolean)
    .map((value) => value.toLowerCase());

  for (const candidate of candidates) {
    if (departmentMap.has(candidate)) {
      return departmentMap.get(candidate);
    }
  }

  return null;
}

async function upsertFaculties(client, faculties, departmentMap) {
  for (const row of faculties) {
    await client.query(
      `
        INSERT INTO public.faculties (
          id,
          auth_user_id,
          faculty_id,
          email,
          first_name,
          last_name,
          middle_name,
          campus_id,
          department,
          college,
          position,
          photo_url,
          created_at,
          updated_at,
          contact_number,
          baccalaureate_degree,
          masters_degree,
          doctorate_degree,
          tor_diploma_url,
          professional_license,
          license_url,
          academic_rank,
          designation,
          password_changed_at,
          must_change_password,
          program_head_id,
          department_id
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8::uuid, $9, $10, $11, $12,
          COALESCE($13::timestamptz, now()), COALESCE($14::timestamptz, COALESCE($13::timestamptz, now())),
          $15, $16, $17, $18, $19, $20, $21, $22, $23, $24::timestamptz,
          COALESCE($25::boolean, false), $26::uuid, $27
        )
        ON CONFLICT (id) DO UPDATE
        SET auth_user_id = EXCLUDED.auth_user_id,
            faculty_id = EXCLUDED.faculty_id,
            email = EXCLUDED.email,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            middle_name = EXCLUDED.middle_name,
            campus_id = EXCLUDED.campus_id,
            department = EXCLUDED.department,
            college = EXCLUDED.college,
            position = EXCLUDED.position,
            photo_url = EXCLUDED.photo_url,
            updated_at = EXCLUDED.updated_at,
            contact_number = EXCLUDED.contact_number,
            baccalaureate_degree = EXCLUDED.baccalaureate_degree,
            masters_degree = EXCLUDED.masters_degree,
            doctorate_degree = EXCLUDED.doctorate_degree,
            tor_diploma_url = EXCLUDED.tor_diploma_url,
            professional_license = EXCLUDED.professional_license,
            license_url = EXCLUDED.license_url,
            academic_rank = EXCLUDED.academic_rank,
            designation = EXCLUDED.designation,
            password_changed_at = EXCLUDED.password_changed_at,
            must_change_password = EXCLUDED.must_change_password,
            program_head_id = EXCLUDED.program_head_id,
            department_id = EXCLUDED.department_id,
            created_at = EXCLUDED.created_at
      `,
      [
        row.id,
        nullIfBlank(row.auth_user_id),
        nullIfBlank(row.faculty_id),
        nullIfBlank(row.email),
        nullIfBlank(row.first_name),
        nullIfBlank(row.last_name),
        nullIfBlank(row.middle_name),
        nullIfBlank(row.campus_id),
        nullIfBlank(row.department),
        nullIfBlank(row.college),
        nullIfBlank(row.position) || 'Faculty',
        nullIfBlank(row.photo_url),
        nullIfBlank(row.created_at),
        nullIfBlank(row.updated_at),
        nullIfBlank(row.contact_number),
        nullIfBlank(row.baccalaureate_degree),
        nullIfBlank(row.masters_degree),
        nullIfBlank(row.doctorate_degree),
        nullIfBlank(row.tor_diploma_url),
        nullIfBlank(row.professional_license),
        nullIfBlank(row.license_url),
        nullIfBlank(row.academic_rank),
        nullIfBlank(row.designation),
        nullIfBlank(row.password_changed_at),
        nullIfBlank(row.must_change_password),
        nullIfBlank(row.program_head_id),
        findDepartmentId(row, departmentMap),
      ],
    );
  }
}

async function upsertAttendance(client, attendanceRecords) {
  for (const row of attendanceRecords) {
    await client.query(
      `
        INSERT INTO public.attendance_records (
          id,
          user_id,
          scan_datetime,
          scan_picture_url,
          scan_status,
          display_message,
          kiosk_id,
          created_at
        )
        VALUES ($1, $2, $3::timestamptz, $4, $5, $6, $7, COALESCE($8::timestamptz, $3::timestamptz, now()))
        ON CONFLICT (id) DO UPDATE
        SET user_id = EXCLUDED.user_id,
            scan_datetime = EXCLUDED.scan_datetime,
            scan_picture_url = EXCLUDED.scan_picture_url,
            scan_status = EXCLUDED.scan_status,
            display_message = EXCLUDED.display_message,
            kiosk_id = EXCLUDED.kiosk_id,
            created_at = EXCLUDED.created_at
      `,
      [
        row.id,
        row.user_id,
        nullIfBlank(row.scan_datetime),
        nullIfBlank(row.scan_picture_url),
        nullIfBlank(row.scan_status),
        nullIfBlank(row.display_message),
        nullIfBlank(row.kiosk_id),
        nullIfBlank(row.created_at),
      ],
    );
  }
}

async function main() {
  const client = await pool.connect();

  try {
    await ensureSchemaExists(client);

    const [departments, users, faculties, attendanceRecords] = await Promise.all([
      readCsv('departments_rows.csv'),
      readCsv('users_rows.csv'),
      readCsv('faculties_rows.csv'),
      readCsv('attendance_records_rows.csv'),
    ]);

    await client.query('BEGIN');
    const departmentMap = await upsertDepartments(client, departments);
    await upsertUsers(client, users);
    await upsertFaculties(client, faculties, departmentMap);
    await upsertAttendance(client, attendanceRecords);
    await client.query('COMMIT');

    console.log(`Imported departments: ${departments.length}`);
    console.log(`Imported users_auth rows: ${users.length}`);
    console.log(`Imported faculties rows: ${faculties.length}`);
    console.log(`Imported attendance_records rows: ${attendanceRecords.length}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Import failed:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
