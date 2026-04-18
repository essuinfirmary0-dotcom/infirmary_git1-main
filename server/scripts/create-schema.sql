CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS public.admin_activity_logs CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.queues CASCADE;
DROP TABLE IF EXISTS public.medical_record_attachments CASCADE;
DROP TABLE IF EXISTS public.medical_records CASCADE;
DROP TABLE IF EXISTS public.consultation_logs CASCADE;
DROP TABLE IF EXISTS public.password_reset_tokens CASCADE;
DROP TABLE IF EXISTS public.appointments CASCADE;
DROP TABLE IF EXISTS public.slot_definitions CASCADE;
DROP TABLE IF EXISTS public.attendance_records CASCADE;
DROP TABLE IF EXISTS public.faculties CASCADE;
DROP TABLE IF EXISTS public.departments CASCADE;
DROP TABLE IF EXISTS public.users_auth CASCADE;

DROP SEQUENCE IF EXISTS student_number_seq CASCADE;
DROP SEQUENCE IF EXISTS employee_number_seq CASCADE;

CREATE SEQUENCE student_number_seq START 1;
CREATE SEQUENCE employee_number_seq START 1;

CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.users_auth (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lastname text,
  firstname text,
  middle_initial text,
  id_number text,
  picture_url text,
  role text,
  registration_date date,
  qr_code text,
  department_program uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  qr_code_generated_at timestamp with time zone,
  status text DEFAULT 'active',
  qr_data text,
  user_type text,
  email text UNIQUE,
  address text,
  phone text,
  password_hash text,
  student_number character varying UNIQUE DEFAULT ('NS-'::text || lpad((nextval('student_number_seq'::regclass))::text, 5, '0'::text)),
  employee_number character varying UNIQUE DEFAULT ('EM-'::text || lpad((nextval('employee_number_seq'::regclass))::text, 5, '0'::text)),
  college character varying,
  program character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.faculties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid,
  faculty_id text UNIQUE,
  email text UNIQUE,
  first_name text,
  last_name text,
  middle_name text,
  campus_id uuid,
  department text,
  college text,
  position text,
  photo_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  contact_number text,
  baccalaureate_degree text,
  masters_degree text,
  doctorate_degree text,
  tor_diploma_url text,
  professional_license text,
  license_url text,
  academic_rank text,
  designation text,
  password_changed_at timestamp with time zone,
  must_change_password boolean NOT NULL DEFAULT false,
  program_head_id uuid,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL
);

CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users_auth(id) ON DELETE CASCADE,
  scan_datetime timestamp with time zone NOT NULL,
  scan_picture_url text,
  scan_status text,
  display_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  kiosk_id uuid
);

CREATE TABLE public.slot_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  time_slot character varying NOT NULL UNIQUE,
  max_capacity integer NOT NULL DEFAULT 50,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users_auth(id) ON DELETE CASCADE,
  appointment_code character varying NOT NULL UNIQUE,
  patient_name character varying NOT NULL,
  service character varying NOT NULL CHECK (service::text = ANY (ARRAY['Dental'::character varying, 'Medical'::character varying, 'Nutrition'::character varying]::text[])),
  subcategory character varying NOT NULL,
  purpose character varying NOT NULL,
  appointment_date date NOT NULL,
  time_slot character varying NOT NULL,
  notes text,
  status character varying NOT NULL DEFAULT 'Waiting'::character varying CHECK (status::text = ANY (ARRAY['Waiting'::character varying, 'Ongoing'::character varying, 'Completed'::character varying, 'Not Completed'::character varying]::text[])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  slot_definition_id uuid REFERENCES public.slot_definitions(id) ON DELETE SET NULL
);

CREATE TABLE public.consultation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users_auth(id) ON DELETE CASCADE,
  recorded_by uuid NOT NULL REFERENCES public.users_auth(id) ON DELETE RESTRICT,
  systolic integer NOT NULL,
  diastolic integer NOT NULL,
  notes text,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  attachment_path text,
  attachment_mime text
);

CREATE TABLE public.medical_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users_auth(id) ON DELETE CASCADE,
  recorded_by uuid NOT NULL REFERENCES public.users_auth(id) ON DELETE RESTRICT,
  title character varying NOT NULL,
  notes text,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  attachment_path text,
  attachment_mime text
);

CREATE TABLE public.medical_record_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES public.medical_records(id) ON DELETE CASCADE,
  attachment_path text NOT NULL,
  attachment_mime text NOT NULL,
  original_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users_auth(id) ON DELETE CASCADE,
  type character varying NOT NULL,
  title character varying NOT NULL,
  message text NOT NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE CASCADE,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users_auth(id) ON DELETE CASCADE,
  token_hash character varying NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.queues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users_auth(id) ON DELETE CASCADE,
  queue_number character varying NOT NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  status character varying NOT NULL DEFAULT 'Waiting'::character varying CHECK (status::text = ANY (ARRAY['Waiting'::character varying, 'Serving'::character varying, 'Done'::character varying, 'Cancelled'::character varying]::text[]))
);

CREATE TABLE public.admin_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES public.users_auth(id) ON DELETE SET NULL,
  admin_user_name character varying NOT NULL,
  action_type character varying NOT NULL,
  message text NOT NULL,
  changed_data jsonb,
  target_type character varying,
  target_id character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_auth_department_program ON public.users_auth(department_program);
CREATE INDEX idx_users_auth_email ON public.users_auth(email);
CREATE INDEX idx_users_auth_id_number ON public.users_auth(id_number);
CREATE INDEX idx_attendance_records_user_id ON public.attendance_records(user_id);
CREATE INDEX idx_attendance_records_scan_datetime ON public.attendance_records(scan_datetime);
CREATE INDEX idx_appointments_user_id ON public.appointments(user_id);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_queues_user_id ON public.queues(user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_auth_updated_at
BEFORE UPDATE ON public.users_auth
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_appointments_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
