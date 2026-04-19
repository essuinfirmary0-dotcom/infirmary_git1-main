--
-- PostgreSQL database dump
--

\restrict qtYTzzU3K1cbZWfgc16uX0mdHOYptS9csQ8qaj5JhqbzJm65dO1Hre5Uv8v8w74

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_activity_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_user_id uuid,
    admin_user_name character varying NOT NULL,
    action_type character varying NOT NULL,
    message text NOT NULL,
    changed_data jsonb,
    target_type character varying,
    target_id character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: appointment_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointment_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    appointment_id uuid NOT NULL,
    attachment_path text NOT NULL,
    attachment_mime text NOT NULL,
    original_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    requirement_label text
);


--
-- Name: appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    appointment_code character varying NOT NULL,
    patient_name character varying NOT NULL,
    service character varying NOT NULL,
    subcategory character varying NOT NULL,
    purpose character varying NOT NULL,
    appointment_date date NOT NULL,
    time_slot character varying NOT NULL,
    notes text,
    status character varying DEFAULT 'Ongoing'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    slot_definition_id uuid,
    CONSTRAINT appointments_service_check CHECK (((service)::text = ANY (ARRAY[('Dental'::character varying)::text, ('Medical'::character varying)::text, ('Nutrition'::character varying)::text]))),
    CONSTRAINT appointments_status_check CHECK (((status)::text = ANY (ARRAY[('Ongoing'::character varying)::text, ('Success'::character varying)::text, ('Cancelled'::character varying)::text])))
);


--
-- Name: attendance_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    scan_datetime timestamp with time zone NOT NULL,
    scan_picture_url text,
    scan_status text,
    display_message text,
    kiosk_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: consultation_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consultation_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    recorded_by uuid NOT NULL,
    systolic integer NOT NULL,
    diastolic integer NOT NULL,
    notes text,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    attachment_path text,
    attachment_mime text
);


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    type text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: employee_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employee_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: faculties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.faculties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_user_id uuid,
    faculty_id text,
    email text,
    first_name text,
    last_name text,
    middle_name text,
    campus_id uuid,
    department text,
    college text,
    "position" text,
    photo_url text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
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
    must_change_password boolean DEFAULT false NOT NULL,
    program_head_id uuid,
    department_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: medical_record_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medical_record_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    record_id uuid NOT NULL,
    attachment_path text NOT NULL,
    attachment_mime text NOT NULL,
    original_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    requirement_label text
);


--
-- Name: medical_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medical_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    recorded_by uuid NOT NULL,
    title character varying NOT NULL,
    notes text,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    attachment_path text,
    attachment_mime text,
    appointment_id uuid,
    queue_id uuid,
    record_type character varying,
    purpose text
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type character varying NOT NULL,
    title character varying NOT NULL,
    message text NOT NULL,
    appointment_id uuid,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: queues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.queues (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    queue_number character varying NOT NULL,
    appointment_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    status character varying DEFAULT 'Waiting'::character varying NOT NULL,
    CONSTRAINT queues_status_check CHECK (((status)::text = ANY (ARRAY[('Waiting'::character varying)::text, ('Serving'::character varying)::text, ('Done'::character varying)::text, ('Cancelled'::character varying)::text])))
);


--
-- Name: slot_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.slot_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    time_slot character varying NOT NULL,
    max_capacity integer DEFAULT 50 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: student_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.student_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_auth; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users_auth (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lastname text,
    firstname text,
    middle_initial text,
    id_number text,
    picture_url text,
    role text,
    registration_date date,
    qr_code text,
    department_program uuid,
    qr_code_generated_at timestamp with time zone,
    status text DEFAULT 'active'::text,
    qr_data text,
    user_type text,
    email text,
    address text,
    phone text,
    password_hash text,
    student_number character varying DEFAULT ('NS-'::text || lpad((nextval('public.student_number_seq'::regclass))::text, 5, '0'::text)),
    employee_number character varying DEFAULT ('EM-'::text || lpad((nextval('public.employee_number_seq'::regclass))::text, 5, '0'::text)),
    college character varying,
    program character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_activity_logs admin_activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_activity_logs
    ADD CONSTRAINT admin_activity_logs_pkey PRIMARY KEY (id);


--
-- Name: appointment_attachments appointment_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_attachments
    ADD CONSTRAINT appointment_attachments_pkey PRIMARY KEY (id);


--
-- Name: appointments appointments_appointment_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_appointment_code_key UNIQUE (appointment_code);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: attendance_records attendance_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_pkey PRIMARY KEY (id);


--
-- Name: consultation_logs consultation_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultation_logs
    ADD CONSTRAINT consultation_logs_pkey PRIMARY KEY (id);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: faculties faculties_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faculties
    ADD CONSTRAINT faculties_email_key UNIQUE (email);


--
-- Name: faculties faculties_faculty_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faculties
    ADD CONSTRAINT faculties_faculty_id_key UNIQUE (faculty_id);


--
-- Name: faculties faculties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faculties
    ADD CONSTRAINT faculties_pkey PRIMARY KEY (id);


--
-- Name: medical_record_attachments medical_record_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_record_attachments
    ADD CONSTRAINT medical_record_attachments_pkey PRIMARY KEY (id);


--
-- Name: medical_records medical_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_records
    ADD CONSTRAINT medical_records_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: queues queues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queues
    ADD CONSTRAINT queues_pkey PRIMARY KEY (id);


--
-- Name: slot_definitions slot_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slot_definitions
    ADD CONSTRAINT slot_definitions_pkey PRIMARY KEY (id);


--
-- Name: slot_definitions slot_definitions_time_slot_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slot_definitions
    ADD CONSTRAINT slot_definitions_time_slot_key UNIQUE (time_slot);


--
-- Name: users_auth users_auth_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_auth
    ADD CONSTRAINT users_auth_email_key UNIQUE (email);


--
-- Name: users_auth users_auth_employee_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_auth
    ADD CONSTRAINT users_auth_employee_number_key UNIQUE (employee_number);


--
-- Name: users_auth users_auth_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_auth
    ADD CONSTRAINT users_auth_pkey PRIMARY KEY (id);


--
-- Name: users_auth users_auth_student_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_auth
    ADD CONSTRAINT users_auth_student_number_key UNIQUE (student_number);


--
-- Name: idx_appointment_attachments_appointment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointment_attachments_appointment_id ON public.appointment_attachments USING btree (appointment_id);


--
-- Name: idx_appointments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_user_id ON public.appointments USING btree (user_id);


--
-- Name: idx_attendance_records_scan_datetime; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_records_scan_datetime ON public.attendance_records USING btree (scan_datetime);


--
-- Name: idx_attendance_records_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_records_user_id ON public.attendance_records USING btree (user_id);


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: idx_queues_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_queues_user_id ON public.queues USING btree (user_id);


--
-- Name: idx_users_auth_department_program; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_auth_department_program ON public.users_auth USING btree (department_program);


--
-- Name: idx_users_auth_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_auth_email ON public.users_auth USING btree (email);


--
-- Name: idx_users_auth_id_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_auth_id_number ON public.users_auth USING btree (id_number);


--
-- Name: appointments trg_appointments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: users_auth trg_users_auth_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_users_auth_updated_at BEFORE UPDATE ON public.users_auth FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: admin_activity_logs admin_activity_logs_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_activity_logs
    ADD CONSTRAINT admin_activity_logs_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES public.users_auth(id) ON DELETE SET NULL;


--
-- Name: appointment_attachments appointment_attachments_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_attachments
    ADD CONSTRAINT appointment_attachments_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;


--
-- Name: appointments appointments_slot_definition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_slot_definition_id_fkey FOREIGN KEY (slot_definition_id) REFERENCES public.slot_definitions(id) ON DELETE SET NULL;


--
-- Name: appointments appointments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_auth(id) ON DELETE CASCADE;


--
-- Name: attendance_records attendance_records_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_auth(id) ON DELETE CASCADE;


--
-- Name: consultation_logs consultation_logs_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultation_logs
    ADD CONSTRAINT consultation_logs_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users_auth(id) ON DELETE RESTRICT;


--
-- Name: consultation_logs consultation_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultation_logs
    ADD CONSTRAINT consultation_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_auth(id) ON DELETE CASCADE;


--
-- Name: faculties faculties_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faculties
    ADD CONSTRAINT faculties_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: medical_record_attachments medical_record_attachments_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_record_attachments
    ADD CONSTRAINT medical_record_attachments_record_id_fkey FOREIGN KEY (record_id) REFERENCES public.medical_records(id) ON DELETE CASCADE;


--
-- Name: medical_records medical_records_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_records
    ADD CONSTRAINT medical_records_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;


--
-- Name: medical_records medical_records_queue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_records
    ADD CONSTRAINT medical_records_queue_id_fkey FOREIGN KEY (queue_id) REFERENCES public.queues(id) ON DELETE SET NULL;


--
-- Name: medical_records medical_records_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_records
    ADD CONSTRAINT medical_records_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users_auth(id) ON DELETE RESTRICT;


--
-- Name: medical_records medical_records_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_records
    ADD CONSTRAINT medical_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_auth(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_auth(id) ON DELETE CASCADE;


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_auth(id) ON DELETE CASCADE;


--
-- Name: queues queues_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queues
    ADD CONSTRAINT queues_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;


--
-- Name: queues queues_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queues
    ADD CONSTRAINT queues_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_auth(id) ON DELETE CASCADE;


--
-- Name: users_auth users_auth_department_program_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_auth
    ADD CONSTRAINT users_auth_department_program_fkey FOREIGN KEY (department_program) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict qtYTzzU3K1cbZWfgc16uX0mdHOYptS9csQ8qaj5JhqbzJm65dO1Hre5Uv8v8w74

