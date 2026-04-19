import React, { useEffect, useMemo, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  UserSearch,
  Search,
  User,
  FolderOpen,
  LayoutGrid,
  FileText,
  FileUp,
  Plus,
  Save,
  X,
  UserCircle2,
  ChevronRight,
  Download,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { medicalRecordService } from '../../services/medicalRecordService';
import { appointmentService } from '../../services/appointmentService';
import { baseURL } from '../../services/api';
import { openMedicalCertificateWindow } from '../../utils/medicalCertificatePrint';

const toastStyle = {
  borderRadius: '12px',
  background: '#0f172a',
  color: '#fff',
  fontWeight: 'bold',
  fontSize: '12px',
};

function formatRecordDate(recordedAt) {
  if (!recordedAt) return '—';
  const d = new Date(recordedAt);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function buildQueueDraft(queueContext) {
  const service = queueContext?.appointment?.service || 'Consultation';
  const subcategory = queueContext?.appointment?.subcategory;
  const purpose = queueContext?.appointment?.purpose;
  const appointmentCode = queueContext?.appointment?.code;
  const queueNumber = queueContext?.queueNumber;
  const appointmentDate = queueContext?.appointment?.date;
  const appointmentTime = queueContext?.appointment?.time;
  const appointmentNotes = queueContext?.appointment?.notes;
  const cleanedAppointmentNotes = String(appointmentNotes || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^Submitted requirement files:/i.test(line))
    .join('\n');
  const serviceLabel = subcategory ? `${service} - ${subcategory}` : service;
  const isCertification = String(subcategory || '').toLowerCase() === 'certification';

  return {
    title: isCertification ? `${service} Certification Report` : `${serviceLabel} Medical Report`,
    recordType: serviceLabel,
    purpose: purpose || '',
    defaultNotes: [
      queueNumber ? `Queue Number: ${queueNumber}` : null,
      `Service: ${serviceLabel}`,
      purpose ? `Requested Purpose: ${purpose}` : null,
      appointmentCode ? `Appointment Code: ${appointmentCode}` : null,
      appointmentDate ? `Appointment Date: ${formatRecordDate(appointmentDate)}` : null,
      appointmentTime ? `Appointment Time: ${appointmentTime}` : null,
      cleanedAppointmentNotes ? `Patient Notes: ${cleanedAppointmentNotes}` : null,
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

function isImageAttachment(attachment) {
  const mime = attachment?.attachmentMime || '';
  const path = attachment?.attachmentPath || '';
  return mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(path);
}

function getAttachmentLabel(attachment) {
  return attachment?.requirementLabel || 'Uploaded file';
}

function getAttachmentUrl(attachment) {
  if (attachment?.attachmentUrl) return attachment.attachmentUrl;
  if (!attachment?.attachmentPath) return '';
  return `${baseURL}/uploads/${attachment.attachmentPath}`;
}

function isCertificateRecord(record) {
  const combined = `${record?.title || ''} ${record?.recordType || ''}`.toLowerCase();
  return combined.includes('certificate') || combined.includes('certification');
}

function getStoredAdminName() {
  try {
    const raw = localStorage.getItem('authUser');
    const user = raw ? JSON.parse(raw) : null;
    return [user?.firstName, user?.middleName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'Infirmary Admin';
  } catch {
    return 'Infirmary Admin';
  }
}

export const AdminRecordsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const initialQueueContext = (() => {
    try {
      const raw = sessionStorage.getItem('adminActiveRecordContext');
      return location.state?.queueContext || (raw ? JSON.parse(raw) : null);
    } catch {
      return location.state?.queueContext || null;
    }
  })();
  const [queueContext, setQueueContext] = useState(initialQueueContext);
  const [patients, setPatients] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [recordsSearchQuery, setRecordsSearchQuery] = useState('');
  const [selectedRecordUser, setSelectedRecordUser] = useState(null);
  const [apiRecords, setApiRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [selectedRecordTile, setSelectedRecordTile] = useState(null);
  const [isAddingRecord, setIsAddingRecord] = useState(false);
  const [recordTitle, setRecordTitle] = useState('');
  const [bpSystolic, setBpSystolic] = useState('');
  const [bpDiastolic, setBpDiastolic] = useState('');
  const [recordNotes, setRecordNotes] = useState('');
  const [recordDefaultNotes, setRecordDefaultNotes] = useState('');
  const [recordFiles, setRecordFiles] = useState([]);
  const [hardcopyVerified, setHardcopyVerified] = useState(false);
  const [appointmentAttachments, setAppointmentAttachments] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);
  const fileInputRef = useRef(null);
  const consumedQueueContextRef = useRef(null);
  useEffect(() => {
    const nextQueueContext = location.state?.queueContext;
    if (!nextQueueContext?.queueId) return;
    setQueueContext(nextQueueContext);
    try {
      sessionStorage.setItem('adminActiveRecordContext', JSON.stringify(nextQueueContext));
    } catch {
      // ignore storage errors
    }
  }, [location.state]);

  useEffect(() => {
    const loadPatients = async () => {
      setPatientsLoading(true);
      try {
        const data = await medicalRecordService.getPatients();
        setPatients(data || []);
      } catch {
        setPatients([]);
      } finally {
        setPatientsLoading(false);
      }
    };
    loadPatients();
  }, []);

  const recordsSearchedUsers = useMemo(() => {
    const q = recordsSearchQuery.trim().toLowerCase();
    if (!q) return [];
    return (patients || []).filter(
      (user) =>
        user.name?.toLowerCase().includes(q) ||
        user.email?.toLowerCase().includes(q) ||
        user.studentNumber?.toLowerCase().includes(q) ||
        user.employeeNumber?.toLowerCase().includes(q)
    );
  }, [recordsSearchQuery, patients]);

  useEffect(() => {
    if (!selectedRecordUser) {
      setApiRecords([]);
      return;
    }
    let cancelled = false;
    setRecordsLoading(true);
    medicalRecordService
      .getRecordsByUserId(selectedRecordUser.id)
      .then((data) => {
        if (!cancelled) setApiRecords(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setApiRecords([]);
      })
      .finally(() => {
        if (!cancelled) setRecordsLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedRecordUser]);

  useEffect(() => {
    if (!queueContext?.user?.id) return;
    if (consumedQueueContextRef.current === queueContext.queueId) return;

    const matchedPatient =
      patients.find((patient) => patient.id === queueContext.user.id) ||
      patients.find((patient) => patient.email === queueContext.user.email);
    const targetPatient = matchedPatient || {
      id: queueContext.user.id,
      name: queueContext.user.name || queueContext.appointment?.patientName || 'Unknown patient',
      email: queueContext.user.email || '',
      studentNumber: queueContext.user.studentNumber || null,
      employeeNumber: queueContext.user.employeeNumber || null,
    };

    const draft = buildQueueDraft(queueContext);
    setSelectedRecordUser(targetPatient);
    setSelectedRecordTile(null);
    setIsAddingRecord(true);
    setRecordTitle(draft.title);
    setBpSystolic('');
    setBpDiastolic('');
    setRecordDefaultNotes(draft.defaultNotes);
    setRecordNotes('');
    setRecordFiles([]);
    setHardcopyVerified(false);
    consumedQueueContextRef.current = queueContext.queueId;
  }, [patients, queueContext]);

  useEffect(() => {
    let cancelled = false;

    const loadAppointmentAttachments = async () => {
      if (!queueContext?.appointment?.id) {
        setAppointmentAttachments([]);
        return;
      }

      try {
        const attachments = await appointmentService.getAttachments(queueContext.appointment.id);
        if (!cancelled) {
          setAppointmentAttachments(Array.isArray(attachments) ? attachments : []);
        }
      } catch {
        if (!cancelled) {
          setAppointmentAttachments([]);
        }
      }
    };

    loadAppointmentAttachments();
    return () => {
      cancelled = true;
    };
  }, [queueContext, selectedRecordUser]);

  const userRecords = apiRecords;
  const isViewingRecord = selectedRecordTile && !isAddingRecord;
  const hasAppointmentAttachmentContext = Boolean(queueContext?.appointment?.id);
  const isCertificationFlow =
    hasAppointmentAttachmentContext &&
    String(queueContext?.appointment?.subcategory || '').toLowerCase() === 'certification';
  const appointmentAttachmentItems = appointmentAttachments || [];
  const selectedRecordAttachments =
    selectedRecordTile?.attachments?.length > 0
      ? selectedRecordTile.attachments
      : selectedRecordTile?.attachmentPath
        ? [
            {
              id: null,
              attachmentPath: selectedRecordTile.attachmentPath,
              attachmentMime: selectedRecordTile.attachmentMime,
              attachmentUrl: selectedRecordTile.attachmentUrl || null,
            },
          ]
        : [];

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setRecordFiles((prev) => [...prev, ...files]);
    e.target.value = '';
  };

  const removeFile = (index) => {
    setRecordFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const renderAppointmentRequirementFiles = () => {
    if (!hasAppointmentAttachmentContext) return null;

    if (appointmentAttachmentItems.length === 0) {
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs font-semibold text-amber-800">
          No requirement file has been uploaded by the user for this appointment yet.
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {appointmentAttachmentItems
            .filter((file) => isImageAttachment(file))
            .map((file, i) => (
              <div
                key={file.id || `${file.attachmentPath}-preview-${i}`}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white"
              >
                <button
                  type="button"
                  onClick={() => setPreviewImageUrl(getAttachmentUrl(file))}
                  className="relative aspect-square w-full overflow-hidden bg-slate-50 transition-all hover:border-primary/30"
                >
                  <img
                    src={getAttachmentUrl(file)}
                    alt={file.originalName || 'Requirement file'}
                    className="w-full h-full object-cover"
                  />
                </button>
                <div className="space-y-1 border-t border-slate-100 p-2.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                    {getAttachmentLabel(file)}
                  </p>
                  <p className="text-xs font-semibold text-slate-600 break-all">
                    {file.originalName || file.attachmentPath?.split('/').pop() || 'Requirement file'}
                  </p>
                </div>
              </div>
            ))}
        </div>
        <div className="space-y-2">
          {appointmentAttachmentItems.map((file, i) => (
            <a
              key={file.id || `${file.attachmentPath}-${i}`}
              href={getAttachmentUrl(file)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-2.5 transition-all hover:border-primary/30 hover:bg-white"
            >
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                  {getAttachmentLabel(file)}
                </p>
                <span className="block max-w-55 truncate text-xs font-bold text-slate-600">
                  {file.originalName || file.attachmentPath?.split('/').pop() || 'Uploaded file'}
                </span>
              </div>
              <Download size={14} className="text-slate-400" />
            </a>
          ))}
        </div>
      </div>
    );
  };

  const handleSaveRecord = async () => {
    const wantsCertificateIssuance = isCertificationFlow;
    if (!selectedRecordUser) return;
    if (!recordNotes.trim()) {
      toast.error('Please add remarks or findings before saving.', { style: toastStyle });
      return;
    }
    if (wantsCertificateIssuance && appointmentAttachmentItems.length === 0) {
      toast.error('The patient has not uploaded any requirement file for this appointment yet.', { style: toastStyle });
      return;
    }
    if (wantsCertificateIssuance && !hardcopyVerified) {
      toast.error('Please confirm hardcopy verification before completing this certification.', { style: toastStyle });
      return;
    }

    const noteSections = [recordDefaultNotes];
    if (bpSystolic.trim() && bpDiastolic.trim()) {
      noteSections.push(`Blood Pressure: ${bpSystolic.trim()}/${bpDiastolic.trim()} mmHg`);
    }
    noteSections.push('Remarks / Findings:');
    noteSections.push(recordNotes.trim());
    const combinedNotes = noteSections.filter(Boolean).join('\n\n');

    setIsSaving(true);
    try {
      const activeDraft = queueContext?.appointment?.id ? buildQueueDraft(queueContext) : null;
      const savedRecord = await medicalRecordService.createRecord(selectedRecordUser.id, {
        title: recordTitle.trim(),
        notes: combinedNotes,
        attachmentFiles: hasAppointmentAttachmentContext ? [] : recordFiles,
        queueId: queueContext?.queueId || '',
        appointmentId: queueContext?.appointment?.id || '',
        recordType: activeDraft?.recordType || recordTitle.trim(),
        purpose: activeDraft?.purpose || '',
        isHardcopyVerified: wantsCertificateIssuance ? hardcopyVerified : false,
        certificateIssued: wantsCertificateIssuance,
      });
      toast.success('Medical record saved successfully!', { style: toastStyle });
      const data = await medicalRecordService.getRecordsByUserId(selectedRecordUser.id);
      setApiRecords(Array.isArray(data) ? data : []);
      if (wantsCertificateIssuance) {
        const didOpen = openCertificateForRecord({ record: savedRecord, findingsOverride: recordNotes.trim() });
        if (!didOpen) {
          toast.error('Certificate saved, but the browser blocked the print/download window.', { style: toastStyle });
        }
      }
    } catch (err) {
      const message =
        err?.response?.data?.message || 'Failed to save medical record.';
      toast.error(message, { style: toastStyle });
    } finally {
      setIsSaving(false);
    }
    setSelectedRecordTile(null);
    setIsAddingRecord(false);
    setRecordTitle('');
    setBpSystolic('');
    setBpDiastolic('');
    setRecordNotes('');
    setRecordDefaultNotes('');
    setRecordFiles([]);
    setHardcopyVerified(false);
  };

  const goBackToTiles = () => {
    setSelectedRecordTile(null);
    setIsAddingRecord(false);
    setPreviewImageUrl(null);
    setBpSystolic('');
    setBpDiastolic('');
    setRecordDefaultNotes('');
    setHardcopyVerified(false);
  };

  const openCertificateForRecord = ({ record, findingsOverride = '' } = {}) => {
    const activeDraft = buildQueueDraft(queueContext);
    const findingsSource = findingsOverride || record?.notes || '';
    const cleanedFindings = String(findingsSource || '')
      .replace(recordDefaultNotes || '', '')
      .replace(/^Remarks \/ Findings:\s*/i, '')
      .trim();

    return openMedicalCertificateWindow({
      patientName: selectedRecordUser?.name || queueContext?.appointment?.patientName || 'Patient',
      patientId: selectedRecordUser?.studentNumber || selectedRecordUser?.employeeNumber || '',
      purpose: record?.purpose || activeDraft.purpose || queueContext?.appointment?.purpose || 'Medical certification',
      service: record?.recordType || activeDraft.recordType || 'Medical',
      appointmentDate: formatRecordDate(queueContext?.appointment?.date || record?.recordedAt),
      appointmentTime: queueContext?.appointment?.time || '',
      findings: cleanedFindings || 'No additional findings were provided.',
      issuedAt: formatRecordDate(record?.recordedAt || new Date().toISOString()),
      issuedBy: getStoredAdminName(),
      certificateCode: record?.id || queueContext?.appointment?.code || '',
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Medical Records</h1>
        <p className="text-sm text-slate-500 font-medium">Data keeping and patient history management</p>
      </div>

      <div className="space-y-6">
        <div className="bg-linear-to-br from-white via-slate-50 to-emerald-50/40 p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="space-y-1.5">
              <p className="text-[10px] font-black text-primary uppercase tracking-[0.24em]">Record Workspace</p>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
                <UserSearch size={18} className="text-primary" />
                Search Patient
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Search first, then review existing entries or create a new medical record below.
              </p>
            </div>
            <div className="self-start lg:self-auto px-3 py-2 rounded-xl bg-white/80 border border-slate-200 text-[11px] font-semibold text-slate-600">
              {patientsLoading ? 'Loading patient list...' : `${patients.length} patients available`}
            </div>
          </div>
          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={20} />
            <input
              type="text"
              placeholder="Search by name, student ID, employee ID, or email..."
              value={recordsSearchQuery}
              onChange={(e) => setRecordsSearchQuery(e.target.value)}
              className="w-full pl-14 pr-5 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm sm:text-base font-medium text-slate-700 shadow-sm placeholder:text-slate-400"
            />
          </div>
          <div className="space-y-2">
            {recordsSearchedUsers.length > 0 ? (
              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Search Results</p>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  {recordsSearchedUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => {
                        setSelectedRecordUser(user);
                        setIsAddingRecord(false);
                        setSelectedRecordTile(null);
                        setRecordDefaultNotes('');
                        setRecordNotes('');
                        setRecordTitle('');
                        setHardcopyVerified(false);
                      }}
                      className={`w-full p-4 rounded-xl border text-left transition-all flex items-center justify-between group ${
                        selectedRecordUser?.id === user.id ? 'border-primary bg-white ring-2 ring-primary/15 shadow-sm' : 'border-slate-200 bg-white/90 hover:border-primary/30 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-white transition-all shrink-0">
                          <User size={20} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-slate-800 text-sm truncate">{user.name}</p>
                          <p className="text-xs text-slate-500 font-medium truncate">{user.email}</p>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-slate-300 group-hover:text-primary transition-all shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ) : recordsSearchQuery.trim() !== '' ? (
              <div className="text-center py-4 text-slate-400 font-bold text-sm">No patients found.</div>
            ) : (
              <div className="text-center py-4 text-slate-400 font-bold text-sm">Start typing to search for a patient.</div>
            )}
          </div>
        </div>

        {selectedRecordUser && (
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <UserCircle2 size={24} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.22em]">Selected Patient</p>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 truncate">{selectedRecordUser.name}</h2>
                  <p className="text-sm text-slate-500 font-medium truncate">{selectedRecordUser.email || 'No email available'}</p>
                  {(selectedRecordUser.studentNumber || selectedRecordUser.employeeNumber) && (
                    <p className="text-xs text-slate-400 font-semibold mt-1">
                      {selectedRecordUser.studentNumber || selectedRecordUser.employeeNumber}
                    </p>
                  )}
                </div>
              </div>
              {!selectedRecordTile && !isAddingRecord && (
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingRecord(true);
                    setRecordTitle(queueContext?.appointment ? buildQueueDraft(queueContext).title : 'Medical Record');
                    setBpSystolic('');
                    setBpDiastolic('');
                    setRecordDefaultNotes(queueContext?.appointment ? buildQueueDraft(queueContext).defaultNotes : '');
                    setRecordNotes('');
                    setRecordFiles([]);
                    setHardcopyVerified(false);
                  }}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-primary text-white text-sm font-black shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all"
                >
                  <Plus size={16} />
                  New Record
                </button>
              )}
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {selectedRecordUser ? (
            !selectedRecordTile && !isAddingRecord ? (
              <motion.div
                key="record-tiles"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-5"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <LayoutGrid size={20} className="text-primary" />
                    Record Results
                  </h3>
                  <button
                    onClick={() => {
                      setSelectedRecordUser(null);
                      setSelectedRecordTile(null);
                      setIsAddingRecord(false);
                      setRecordTitle('');
                      setBpSystolic('');
                      setBpDiastolic('');
                      setRecordNotes('');
                      setRecordDefaultNotes('');
                      setRecordFiles([]);
                    }}
                    className="text-xs font-black text-slate-400 hover:text-red-500 transition-colors uppercase tracking-widest"
                  >
                    Close
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  <motion.button
                    whileHover={{ y: -4 }}
                    onClick={() => {
                      setIsAddingRecord(true);
                      setRecordTitle('');
                      setBpSystolic('');
                      setBpDiastolic('');
                      setRecordNotes('');
                      setRecordFiles([]);
                      setHardcopyVerified(false);
                    }}
                    className="p-5 bg-linear-to-br from-primary/5 to-emerald-50 border-2 border-dashed border-primary/20 rounded-2xl flex flex-col items-center justify-center space-y-3 group hover:bg-primary/10 hover:border-primary transition-all"
                  >
                    <div className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center shadow-lg shadow-primary/20">
                      <Plus size={24} />
                    </div>
                    <span className="text-xs font-black text-primary uppercase tracking-widest">New Record</span>
                  </motion.button>
                  {recordsLoading ? (
                    <div className="col-span-2 py-8 text-center text-slate-400 font-bold text-sm">Loading records…</div>
                  ) : (
                    userRecords.map((record) => (
                      <motion.button
                        key={record.id}
                        whileHover={{ y: -4 }}
                        onClick={() => setSelectedRecordTile(record)}
                        className="p-5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-start space-y-2 group hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 hover:border-primary/20 transition-all text-left"
                      >
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 group-hover:text-primary transition-all shadow-sm overflow-hidden">
                          {(record.attachmentPath || record.attachments?.[0]?.attachmentPath) && isImageAttachment({
                            attachmentPath: record.attachmentPath || record.attachments?.[0]?.attachmentPath,
                            attachmentMime: record.attachmentMime || record.attachments?.[0]?.attachmentMime,
                          }) ? (
                            <img
                              src={getAttachmentUrl({
                                attachmentPath: record.attachmentPath || record.attachments?.[0]?.attachmentPath,
                                attachmentUrl: record.attachmentUrl || record.attachments?.[0]?.attachmentUrl || null,
                              })}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <FileText size={20} />
                          )}
                        </div>
                        <div className="min-w-0 w-full">
                          <p className="text-xs font-black text-slate-800 line-clamp-1">{record.title}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{formatRecordDate(record.recordedAt)}</p>
                        </div>
                      </motion.button>
                    ))
                  )}
                </div>
              </motion.div>
            ) : isViewingRecord ? (
              <motion.div
                key="record-detail"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white p-5 sm:p-6 rounded-[1.75rem] border border-slate-200 shadow-sm space-y-5"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <FileText size={20} className="text-primary" />
                    {selectedRecordTile.title}
                  </h3>
                  <div className="flex items-center gap-2">
                    {isCertificateRecord(selectedRecordTile) && (
                      <button
                        type="button"
                        onClick={() => openCertificateForRecord({ record: selectedRecordTile })}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-primary-hover"
                      >
                        <Download size={14} />
                        Print Certificate
                      </button>
                    )}
                    <button
                      onClick={goBackToTiles}
                      className="text-xs font-black text-slate-400 hover:text-red-500 transition-colors uppercase tracking-widest"
                    >
                      Back to list
                    </button>
                  </div>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm">
                      <UserCircle2 size={28} />
                    </div>
                    <div>
                      <p className="text-base font-black text-slate-800">{selectedRecordUser.name}</p>
                      <p className="text-xs text-slate-500 font-medium">{selectedRecordUser.email}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Date</p>
                    <p className="text-sm font-bold text-slate-800">{formatRecordDate(selectedRecordTile.recordedAt) || selectedRecordTile.date}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Notes & observations</p>
                    <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-xl p-4 border border-slate-100 min-h-20">
                      {selectedRecordTile.notes ?? '—'}
                    </p>
                  </div>
                  {selectedRecordAttachments.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Attachments</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {selectedRecordAttachments.map((att, i) => {
                          const attachmentUrl = getAttachmentUrl(att);
                          const isImage = isImageAttachment(att);
                          return (
                            <div
                              key={att.id || `${att.attachmentPath}-${i}`}
                              className="relative overflow-hidden rounded-xl border-2 border-slate-100 bg-slate-50 group"
                            >
                              <div className="relative aspect-square w-full">
                                {isImage ? (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewImageUrl(attachmentUrl)}
                                    className="absolute inset-0 w-full h-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset rounded-xl"
                                  >
                                    <img
                                      src={attachmentUrl}
                                      alt="Record attachment"
                                      className="w-full h-full object-cover"
                                    />
                                  </button>
                                ) : (
                                  <a
                                    href={attachmentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center"
                                  >
                                    <FileText size={28} className="text-slate-400" />
                                    <span className="text-[11px] font-bold text-slate-600 break-all">
                                      {att.originalName || att.attachmentPath?.split('/').pop() || 'Attachment'}
                                    </span>
                                  </a>
                                )}
                              </div>
                              <div className="space-y-1 border-t border-slate-100 bg-white p-2.5">
                                <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                                  {getAttachmentLabel(att)}
                                </p>
                                <p className="text-xs font-semibold text-slate-600 break-all">
                                  {att.originalName || att.attachmentPath?.split('/').pop() || 'Attachment'}
                                </p>
                              </div>
                              <a
                                href={attachmentUrl}
                                download={att.originalName || `record-attachment-${att.id || selectedRecordTile.id || 'file'}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-black/50 hover:bg-black/70 text-white transition-colors"
                                aria-label="Download attachment"
                              >
                                <Download size={14} />
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="record-form"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white p-5 sm:p-6 rounded-[1.75rem] border border-slate-200 shadow-sm space-y-5"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <FileText size={20} className="text-primary" />
                    New Entry
                  </h3>
                  <button
                    onClick={goBackToTiles}
                    className="text-xs font-black text-slate-400 hover:text-red-500 transition-colors uppercase tracking-widest"
                  >
                    Back to list
                  </button>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm">
                      <UserCircle2 size={22} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-800">{selectedRecordUser.name}</p>
                      <p className="text-xs text-slate-500 font-medium">{selectedRecordUser.email}</p>
                    </div>
                  </div>
                </div>
                {queueContext?.queueId && selectedRecordUser?.id === queueContext.user?.id && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-1">
                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.18em]">Serving Queue Context</p>
                    <p className="text-sm font-black text-slate-800">
                      {queueContext.appointment?.service || 'Consultation'}
                      {queueContext.appointment?.subcategory ? ` - ${queueContext.appointment.subcategory}` : ''}
                    </p>
                    <p className="text-xs text-slate-600 font-medium">
                      {queueContext.queueNumber ? `Queue ${queueContext.queueNumber}` : 'Active queue patient'}
                      {queueContext.appointment?.code ? ` • ${queueContext.appointment.code}` : ''}
                    </p>
                    {queueContext.appointment?.purpose && (
                      <p className="text-xs text-slate-600 font-medium">
                        Requested purpose: {queueContext.appointment.purpose}
                      </p>
                    )}
                  </div>
                )}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-widest ml-1">Record Type</label>
                    <div className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-800">
                      {recordTitle || 'Medical Record'}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-widest ml-1">Request Details</label>
                    <div className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 whitespace-pre-wrap">
                      {recordDefaultNotes || 'No default request details available.'}
                    </div>
                  </div>
                  {hasAppointmentAttachmentContext && (
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-widest ml-1">
                        Requirement Files (Clickable)
                      </label>
                      {renderAppointmentRequirementFiles()}
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-widest ml-1">Blood Pressure</label>
                    <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-3 items-center">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={bpSystolic}
                        onChange={(e) => setBpSystolic(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
                        placeholder="Systolic"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm font-medium"
                      />
                      <div className="text-center text-lg font-black text-slate-400">/</div>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={bpDiastolic}
                        onChange={(e) => setBpDiastolic(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
                        placeholder="Diastolic"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm font-medium"
                      />
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      Optional. Example: `120 / 80 mmHg`
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-widest ml-1">Remarks / Findings</label>
                    <textarea
                      rows={5}
                      placeholder="Add your findings, remarks, reading, or result summary for this patient..."
                      value={recordNotes}
                      onChange={(e) => setRecordNotes(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm font-medium resize-none"
                    />
                  </div>
                  {!hasAppointmentAttachmentContext && (
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-widest ml-1">
                        Attachments (X-ray, scans, documents)
                      </label>
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center space-y-2 cursor-pointer hover:bg-slate-50 transition-all group"
                      >
                        <FileUp size={20} className="text-slate-300 group-hover:text-primary transition-colors" />
                        <p className="text-xs font-black text-slate-400 uppercase">Upload files</p>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple accept="image/*,.pdf,.doc,.docx,.txt" className="hidden" />
                      </div>
                      {recordFiles.length > 0 && (
                        <div className="space-y-2">
                          {recordFiles.map((file, i) => (
                            <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                              <span className="text-xs font-bold text-slate-600 truncate max-w-45">{file.name}</span>
                              <button type="button" onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500">
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {isCertificationFlow && (
                    <label className="flex items-start gap-2.5 p-3 rounded-xl border border-emerald-200 bg-emerald-50">
                      <input
                        type="checkbox"
                        checked={hardcopyVerified}
                        onChange={(e) => setHardcopyVerified(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      <span className="text-xs font-semibold text-emerald-800">
                        I verified the uploaded requirement files against the patient&apos;s hardcopy documents.
                      </span>
                    </label>
                  )}
                  <div className="grid grid-cols-1 gap-3">
                    <button
                      onClick={handleSaveRecord}
                      disabled={isSaving || !recordNotes.trim()}
                      className="w-full py-3 bg-slate-100 text-slate-800 font-black rounded-xl hover:bg-slate-200 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSaving ? (
                        <div className="w-3.5 h-3.5 border-2 border-slate-400/30 border-t-slate-700 rounded-full animate-spin" />
                      ) : (
                        <>
                          <Save size={14} />
                          Save medical record
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          ) : (
            <div className="bg-linear-to-br from-slate-50 to-slate-100/70 border-2 border-dashed border-slate-200 rounded-[1.75rem] flex flex-col items-center justify-center p-12 text-center space-y-3">
              <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-slate-200 shadow-sm">
                <FolderOpen size={28} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-400">No patient selected</h3>
                <p className="text-sm text-slate-400 font-medium max-w-50 mx-auto">Select a patient from the search results to manage their medical records.</p>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {previewImageUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-100 flex items-center justify-center bg-black/90 p-4"
            onClick={() => setPreviewImageUrl(null)}
          >
            <button
              type="button"
              onClick={() => setPreviewImageUrl(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              aria-label="Close preview"
            >
              <X size={24} />
            </button>
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative max-w-[90vw] max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={previewImageUrl}
                alt="Preview"
                className="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
