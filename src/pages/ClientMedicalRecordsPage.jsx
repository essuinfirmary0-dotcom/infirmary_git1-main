import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Activity,
  CalendarDays,
  ClipboardList,
  Download,
  Eye,
  FileText,
  FolderOpen,
  ShieldCheck,
  Stethoscope,
  Tag,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { medicalRecordService } from '../services/medicalRecordService';
import { baseURL } from '../services/api';

const METADATA_LINE_PATTERN = /^(?:Queue Number|Service|Requested Purpose|Appointment Code|Appointment Date|Appointment Time|Patient Notes):/i;
const BP_LINE_PATTERN = /^Blood Pressure:\s*(.+)$/i;
const HARDCOPY_LINE_PATTERN = /^Hardcopy verification:\s*(.+)$/i;
const CERTIFICATE_LINE_PATTERN = /^Certificate issuance:\s*(.+)$/i;

function formatDisplayDate(value, options = { dateStyle: 'medium' }) {
  if (!value) return 'Not available';

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return String(value);
  }

  return parsedDate.toLocaleString(undefined, options);
}

function getStatusTone(status) {
  const normalized = String(status || '').toLowerCase();

  if (normalized.includes('complete')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }

  if (normalized.includes('saved')) {
    return 'bg-blue-50 text-blue-700 border-blue-200';
  }

  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function getAttachmentIdentity(attachment) {
  return attachment?.attachmentPath || attachment?.id || attachment?.originalName || '';
}

function dedupeAttachments(attachments = []) {
  const seen = new Set();

  return (attachments || []).filter((attachment) => {
    const key = getAttachmentIdentity(attachment);
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function normalizeRecordAttachments(record) {
  const attachments = Array.isArray(record?.attachments) ? [...record.attachments] : [];

  if (record?.attachmentPath) {
    attachments.unshift({
      id: `primary-${record.id || record.attachmentPath}`,
      attachmentPath: record.attachmentPath,
      attachmentMime: record.attachmentMime,
      attachmentUrl: record.attachmentUrl || null,
      originalName: null,
      requirementLabel: null,
    });
  }

  return dedupeAttachments(attachments);
}

function resolveAttachmentUrl(attachment) {
  if (attachment?.attachmentUrl) return attachment.attachmentUrl;
  if (!attachment?.attachmentPath) return '';
  return `${baseURL}/uploads/${attachment.attachmentPath}`;
}

function parseMedicalRecordNotes(notes = '') {
  const rawLines = String(notes || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const contextLines = rawLines.filter((line) => METADATA_LINE_PATTERN.test(line));
  const bloodPressure = rawLines.find((line) => BP_LINE_PATTERN.test(line))?.match(BP_LINE_PATTERN)?.[1]?.trim() || '';
  const hardcopyVerification = rawLines.find((line) => HARDCOPY_LINE_PATTERN.test(line))?.match(HARDCOPY_LINE_PATTERN)?.[1]?.trim() || '';
  const certificateIssuance = rawLines.find((line) => CERTIFICATE_LINE_PATTERN.test(line))?.match(CERTIFICATE_LINE_PATTERN)?.[1]?.trim() || '';
  const remarksIndex = rawLines.findIndex((line) => /^Remarks \/ Findings:/i.test(line));
  const cleanRemarkLines = (lines) =>
    lines.filter(
      (line) =>
        !METADATA_LINE_PATTERN.test(line)
        && !BP_LINE_PATTERN.test(line)
        && !HARDCOPY_LINE_PATTERN.test(line)
        && !CERTIFICATE_LINE_PATTERN.test(line)
        && !/^Remarks \/ Findings:/i.test(line),
    );

  const remarks = remarksIndex >= 0
    ? cleanRemarkLines(rawLines.slice(remarksIndex + 1)).join('\n').trim()
    : '';
  const fallbackRemarks = cleanRemarkLines(rawLines).join('\n').trim();

  return {
    remarks: remarks || fallbackRemarks || 'No remarks available.',
    bloodPressure,
    hardcopyVerification,
    certificateIssuance,
    contextLines,
  };
}

function getServiceLabel(record) {
  if (record?.service && record?.subcategory) {
    return `${record.service} - ${record.subcategory}`;
  }

  return record?.service || record?.recordType || 'Medical record';
}

function AttachmentSection({ title, description, attachments = [] }) {
  if (!attachments.length) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{title}</p>
        {description && <p className="text-sm text-slate-500 font-medium mt-1">{description}</p>}
      </div>
      <div className="space-y-2">
        {attachments.map((attachment) => {
          const attachmentUrl = resolveAttachmentUrl(attachment);
          const attachmentName = attachment.originalName || attachment.attachmentPath?.split('/').pop() || 'Attachment';

          return (
            <div
              key={getAttachmentIdentity(attachment)}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-800 break-words">{attachmentName}</p>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  {attachment.requirementLabel || 'Uploaded file'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Eye size={14} />
                  View
                </a>
                <a
                  href={attachmentUrl}
                  download={attachmentName}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-black text-white hover:bg-primary-hover transition-colors"
                >
                  <Download size={14} />
                  Download
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const ClientMedicalRecordsPage = () => {
  const { authUser, isGuestUser } = useApp();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedRecordId, setSelectedRecordId] = useState(null);

  const loadRecords = useCallback(async () => {
    if (!authUser?.id) {
      setRecords([]);
      setSelectedRecordId(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const data = await medicalRecordService.getRecordsByUserId(authUser.id);
      setRecords(Array.isArray(data) ? data : []);
    } catch (error) {
      setRecords([]);
      setErrorMessage(error?.response?.data?.message || 'Failed to load your medical records.');
    } finally {
      setLoading(false);
    }
  }, [authUser?.id]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    if (!records.length) {
      setSelectedRecordId(null);
      return;
    }

    if (!records.some((record) => record.id === selectedRecordId)) {
      setSelectedRecordId(records[0].id);
    }
  }, [records, selectedRecordId]);

  const selectedRecord = useMemo(
    () => records.find((record) => record.id === selectedRecordId) || records[0] || null,
    [records, selectedRecordId],
  );

  const selectedRecordNotes = useMemo(
    () => parseMedicalRecordNotes(selectedRecord?.notes || ''),
    [selectedRecord],
  );

  const selectedRecordAttachments = useMemo(
    () => normalizeRecordAttachments(selectedRecord),
    [selectedRecord],
  );

  const selectedRequirementFiles = useMemo(
    () =>
      dedupeAttachments([
        ...(selectedRecord?.requirementFiles || []),
        ...selectedRecordAttachments.filter((attachment) => attachment.requirementLabel),
      ]),
    [selectedRecord, selectedRecordAttachments],
  );

  const selectedSupportingAttachments = useMemo(() => {
    const requirementKeys = new Set(selectedRequirementFiles.map((attachment) => getAttachmentIdentity(attachment)));
    return selectedRecordAttachments.filter((attachment) => !requirementKeys.has(getAttachmentIdentity(attachment)));
  }, [selectedRecordAttachments, selectedRequirementFiles]);

  const stats = useMemo(
    () => [
      {
        label: 'Saved Records',
        value: records.length,
        icon: FolderOpen,
        tone: 'text-slate-800',
        bg: 'bg-slate-100',
      },
      {
        label: 'With Attachments',
        value: records.filter((record) => normalizeRecordAttachments(record).length > 0).length,
        icon: ClipboardList,
        tone: 'text-blue-700',
        bg: 'bg-blue-50',
      },
    ],
    [records],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 sm:space-y-8"
    >
      <div className="bg-gradient-to-r from-primary to-primary-hover p-5 sm:p-8 md:p-10 rounded-2xl sm:rounded-[2.5rem] text-white shadow-2xl shadow-primary/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-[80px] -mr-32 -mt-32" />
        <div className="relative z-10 space-y-3 sm:space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/15 backdrop-blur-md rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest">
            <ShieldCheck size={14} />
            Transparency View
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight">My Medical Records</h2>
          <p className="text-white/80 text-sm sm:text-base md:text-lg font-medium max-w-2xl">
            Review your saved medical record history, appointment-linked details, remarks, and supporting files in one place.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              to="/app/appointments"
              className="px-5 py-2.5 bg-white text-primary font-black rounded-xl hover:bg-slate-50 transition-all shadow-lg text-sm sm:text-base"
            >
              View Appointments
            </Link>
            <Link
              to={isGuestUser ? '/app/book' : '/app/profile'}
              className="px-5 py-2.5 bg-white/20 backdrop-blur-md border border-white/30 text-white font-bold rounded-xl hover:bg-white/30 transition-all text-sm sm:text-base"
            >
              {isGuestUser ? 'Book Appointment' : 'View Profile'}
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className={`p-3 rounded-2xl ${stat.bg} ${stat.tone}`}>
                <stat.icon size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Overview</span>
            </div>
            <p className="text-sm font-bold text-slate-500">{stat.label}</p>
            <h3 className={`text-3xl font-black ${stat.tone}`}>{stat.value}</h3>
          </div>
        ))}
      </div>

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={loadRecords}
            className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-xs font-black text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm text-center">
          <p className="text-sm font-bold text-slate-500">Loading your medical records...</p>
        </div>
      ) : records.length === 0 ? (
        <div className="bg-white p-8 sm:p-12 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-100 shadow-sm text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <FolderOpen size={28} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black text-slate-800">No medical records available yet.</h3>
            <p className="text-sm sm:text-base font-medium text-slate-500 max-w-xl mx-auto">
              Your saved consultation or certification records will appear here after they are completed by the infirmary team.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-6">
          <div className="bg-white p-4 sm:p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Record History</p>
                <h3 className="text-lg sm:text-xl font-black text-slate-800 mt-1">Successful Medical Record Transactions</h3>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-slate-500">
                {records.length} total
              </span>
            </div>

            <div className="space-y-3">
              {records.map((record) => (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => setSelectedRecordId(record.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition-all ${
                    selectedRecord?.id === record.id
                      ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                      : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-800 truncate">{record.title || 'Medical record'}</p>
                      <p className="text-xs text-slate-500 font-medium mt-1 truncate">{getServiceLabel(record)}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${getStatusTone(record.status)}`}>
                      {record.status || 'Saved'}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500">
                    <span className="rounded-full bg-white px-2.5 py-1 border border-slate-200">
                      Saved {formatDisplayDate(record.recordedAt)}
                    </span>
                    {record.appointmentDate && (
                      <span className="rounded-full bg-white px-2.5 py-1 border border-slate-200">
                        Appointment {formatDisplayDate(record.appointmentDate)}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {selectedRecord && (
            <div className="bg-white p-5 sm:p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Record Details</p>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900">{selectedRecord.title || 'Medical Record'}</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedRecord.recordType && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-slate-600">
                        <Tag size={12} />
                        {selectedRecord.recordType}
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-widest ${getStatusTone(selectedRecord.status)}`}>
                      <ShieldCheck size={12} />
                      {selectedRecord.status || 'Saved'}
                    </span>
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Saved Date</p>
                  <p className="text-sm font-black text-slate-800 mt-1">{formatDisplayDate(selectedRecord.recordedAt)}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <CalendarDays size={12} />
                    Appointment Date
                  </p>
                  <p className="text-sm font-black text-slate-800 mt-2">{formatDisplayDate(selectedRecord.appointmentDate)}</p>
                  {selectedRecord.appointmentTime && (
                    <p className="text-sm font-semibold text-slate-600 mt-1">{selectedRecord.appointmentTime}</p>
                  )}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <ClipboardList size={12} />
                    Service
                  </p>
                  <p className="text-sm font-black text-slate-800 mt-2">{getServiceLabel(selectedRecord)}</p>
                  {selectedRecord.purpose && (
                    <p className="text-sm font-semibold text-slate-600 mt-1">{selectedRecord.purpose}</p>
                  )}
                </div>
              </div>

              {(selectedRecordNotes.bloodPressure || selectedRecordNotes.hardcopyVerification || selectedRecordNotes.certificateIssuance) && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Record Highlights</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedRecordNotes.bloodPressure && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-black text-primary">
                        <Stethoscope size={14} />
                        BP {selectedRecordNotes.bloodPressure}
                      </span>
                    )}
                    {selectedRecordNotes.hardcopyVerification && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">
                        <ShieldCheck size={14} />
                        Hardcopy {selectedRecordNotes.hardcopyVerification}
                      </span>
                    )}
                    {selectedRecordNotes.certificateIssuance && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">
                        <ShieldCheck size={14} />
                        Certificate {selectedRecordNotes.certificateIssuance}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <FileText size={12} />
                  Remarks / Findings
                </p>
                <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {selectedRecordNotes.remarks}
                </p>
              </div>

              {selectedRecordNotes.contextLines.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Record Context</p>
                  {selectedRecordNotes.contextLines.map((line, index) => (
                    <p key={`${line}-${index}`} className="text-sm font-medium text-slate-700">
                      {line}
                    </p>
                  ))}
                </div>
              )}

              {selectedRequirementFiles.length > 0 && (
                <AttachmentSection
                  title="Certificate Requirement Files"
                  description="Files submitted during medical certificate processing."
                  attachments={selectedRequirementFiles}
                />
              )}

              {selectedSupportingAttachments.length > 0 && (
                <AttachmentSection
                  title="Record Attachments"
                  description="Files saved together with this medical record."
                  attachments={selectedSupportingAttachments}
                />
              )}

              {selectedRequirementFiles.length === 0 && selectedSupportingAttachments.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center space-y-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 border border-slate-200">
                    <Activity size={20} />
                  </div>
                  <p className="text-sm font-black text-slate-700">No attached files for this record.</p>
                  <p className="text-xs font-medium text-slate-500">
                    Uploaded certificate requirement files and saved record attachments will appear here when available.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};
