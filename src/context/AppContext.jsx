import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { appointmentService } from '../services/appointmentService';
import { notificationService } from '../services/notificationService';
import { consultationService } from '../services/consultationService';
import { queueService } from '../services/queueService';
import { resolveQrValue, resolveUserQrCode } from '../utils/qrCode';

const AppContext = createContext(null);

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};

const initialMockUsers = [
  { id: '1', name: 'John Doe', email: 'w3w2424@gmail.com', patientId: 'P-88291', bpHistory: [{ value: '120/80', date: '2026-03-10' }] },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com', patientId: 'P-12345', bpHistory: [] },
  { id: '3', name: 'Robert Brown', email: 'robert@university.edu', patientId: 'P-67890', bpHistory: [{ value: '130/85', date: '2026-03-12' }] },
];

export const AppProvider = ({ children }) => {
  const [mockUsers, setMockUsers] = useState(initialMockUsers);
  const getAuthUser = () => {
    try {
      const stored = localStorage.getItem('authUser');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  };

  const [authUser, setAuthUser] = useState(() => getAuthUser());
  const getStoredSession = useCallback(() => {
    const token = localStorage.getItem('authToken');
    const user = getAuthUser();

    if (!token || !user) {
      return { token: null, user: null };
    }

    return { token, user };
  }, []);
  const userProfile = authUser
    ? {
        firstName: authUser.firstName || '',
        middleName: authUser.middleName || '',
        lastName: authUser.lastName || '',
        name: [authUser.firstName, authUser.middleName, authUser.lastName].filter(Boolean).join(' '),
        email: authUser.email,
        userType: authUser.userType || null,
        pictureUrl: authUser.pictureUrl || null,
        studentNumber: authUser.studentNumber || null,
        employeeNumber: authUser.employeeNumber || null,
        college: authUser.college || '',
        program: authUser.program || '',
        idNumber: authUser.idNumber || null,
        qrData: authUser.qrData || null,
        qrCode: resolveUserQrCode(authUser),
        qrValue: resolveQrValue(authUser),
        phone: authUser.phone || '',
        address: authUser.address || '',
        patientId: `P-${authUser.id?.slice(0, 8) || '00000'}`,
        bloodType: 'O+',
        weight: 75,
        height: 180,
        age: 28,
        allergies: []
      }
    : {
        name: 'Guest',
        email: '',
        userType: null,
        phone: '',
        address: '',
        patientId: '',
        bloodType: '',
        weight: 0,
        height: 0,
        age: 0,
        allergies: []
      };
  const isGuestUser = (authUser?.userType || authUser?.role) === 'guest';

  const setStoredAuthUser = useCallback((user) => {
    if (!user) {
      localStorage.removeItem('authUser');
      setAuthUser(null);
      return;
    }

    localStorage.setItem('authUser', JSON.stringify(user));
    setAuthUser(user);
  }, []);

  const refreshAuthUser = useCallback(() => {
    setAuthUser(getAuthUser());
  }, []);

  const clearStoredSession = useCallback(() => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    setAuthUser(null);
  }, []);

  const [notifications, setNotifications] = useState([]);
  const [notificationsUnreadCount, setNotificationsUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    const { token, user } = getStoredSession();
    if (!token || !user) {
      setNotifications([]);
      setNotificationsUnreadCount(0);
      return;
    }
    try {
      const { notifications: list, unreadCount } = await notificationService.getMyNotifications();
      setNotifications(list || []);
      setNotificationsUnreadCount(unreadCount ?? 0);
    } catch (error) {
      if (error?.response?.status === 401) {
        clearStoredSession();
      }
      setNotifications([]);
      setNotificationsUnreadCount(0);
    }
  }, [clearStoredSession, getStoredSession]);

  const markNotificationAsRead = useCallback(async (id) => {
    try {
      const updated = await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: updated?.readAt || new Date().toISOString() } : n))
      );
      setNotificationsUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      fetchNotifications();
    }
  }, [fetchNotifications]);

  const markAllNotificationsAsRead = useCallback(async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() }))
      );
      setNotificationsUnreadCount(0);
    } catch {
      fetchNotifications();
    }
  }, [fetchNotifications]);

  const [appointments, setAppointments] = useState([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);

  const [consultationPatients, setConsultationPatients] = useState([]);
  const [consultationLogsByUser, setConsultationLogsByUser] = useState({});
  const [consultationLoading, setConsultationLoading] = useState(false);

  const fetchAppointments = useCallback(async () => {
    const { token, user: currentUser } = getStoredSession();
    if (!token || !currentUser) {
      setAppointments([]);
      setAppointmentsLoading(false);
      return;
    }
    try {
      const isAdmin = ['admin', 'super_admin'].includes(currentUser?.userType || currentUser?.role);

      if (isAdmin) {
        const data = await appointmentService.getAllAppointments();
        setAppointments(data || []);
      } else {
        const [data, myQueues] = await Promise.all([
          appointmentService.getMyAppointments(),
          queueService.myToday().catch(() => []),
        ]);
        const queuesByApt = new Map();
        (myQueues || []).forEach((q) => {
          if (q.appointmentId) {
            queuesByApt.set(q.appointmentId, q);
          }
        });
        const enriched = (data || []).map((apt) => {
          const q = queuesByApt.get(apt.id);
          return q
            ? {
                ...apt,
                queueNumber: q.queueNumber,
                queueStatus: q.status,
              }
            : apt;
        });
        setAppointments(enriched);
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        clearStoredSession();
      }
      setAppointments([]);
    } finally {
      setAppointmentsLoading(false);
    }
  }, [clearStoredSession, getStoredSession]);

  const fetchConsultationPatients = useCallback(async () => {
    const { token, user } = getStoredSession();
    if (!token || !user) {
      setConsultationPatients([]);
      return;
    }

    const isAdmin = ['admin', 'super_admin'].includes(user?.userType || user?.role);
    if (!isAdmin) {
      setConsultationPatients([]);
      return;
    }

    try {
      const data = await consultationService.getPatients();
      setConsultationPatients(data || []);
    } catch (error) {
      if (error?.response?.status === 401) {
        clearStoredSession();
      }
      setConsultationPatients([]);
    }
  }, [clearStoredSession, getStoredSession]);

  const fetchConsultationLogsForUser = useCallback(async (userId) => {
    if (!userId) return [];
    const { token, user } = getStoredSession();
    if (!token || !user) return [];
    try {
      setConsultationLoading(true);
      const logs = await consultationService.getLogsByUserId(userId);
      setConsultationLogsByUser((prev) => ({ ...prev, [userId]: logs || [] }));
      return logs || [];
    } catch (error) {
      if (error?.response?.status === 401) {
        clearStoredSession();
      }
      setConsultationLogsByUser((prev) => ({ ...prev, [userId]: [] }));
      return [];
    } finally {
      setConsultationLoading(false);
    }
  }, [clearStoredSession, getStoredSession]);

  const fetchAllAppointments = useCallback(async () => {
    const { token, user } = getStoredSession();
    if (!token || !user) return [];
    try {
      const data = await appointmentService.getAllAppointments();
      setAppointments(data);
      return data;
    } catch (error) {
      if (error?.response?.status === 401) {
        clearStoredSession();
      }
      return [];
    }
  }, [clearStoredSession, getStoredSession]);

  useEffect(() => {
    fetchAppointments();
    fetchNotifications();
    fetchConsultationPatients();
  }, [authUser, fetchAppointments, fetchNotifications, fetchConsultationPatients]);

  const handleBook = async (newApt) => {
    const payload = {
      patientName: newApt.patientName,
      service: newApt.service,
      subcategory: newApt.subcategory,
      purpose: newApt.purpose,
      date: newApt.date,
      time: newApt.time,
      notes: newApt.notes,
      requirementFiles: Array.isArray(newApt.requirementFiles) ? newApt.requirementFiles : [],
      attachmentFiles: Array.isArray(newApt.attachmentFiles) ? newApt.attachmentFiles : [],
    };
    const appointment = await appointmentService.book(payload);

    setAppointments((prev) => [appointment, ...prev]);
    await fetchNotifications();
    return appointment;
  };

  const handleReschedule = async (id, updatedApt) => {
    const payload = {
      patientName: updatedApt.patientName,
      service: updatedApt.service,
      subcategory: updatedApt.subcategory,
      purpose: updatedApt.purpose,
      date: updatedApt.date,
      time: updatedApt.time,
      notes: updatedApt.notes,
      requirementFiles: Array.isArray(updatedApt.requirementFiles) ? updatedApt.requirementFiles : [],
      attachmentFiles: Array.isArray(updatedApt.attachmentFiles) ? updatedApt.attachmentFiles : [],
    };
    const appointment = await appointmentService.reschedule(id, payload);

    setAppointments((prev) =>
      prev.map((existingAppointment) =>
        existingAppointment.id === id
          ? {
              ...appointment,
              queueNumber: null,
              queueStatus: null,
            }
          : existingAppointment,
      ),
    );
    await fetchNotifications();
    return appointment;
  };

  const handleCancel = async (id, reason = '') => {
    try {
      await appointmentService.cancel(id, reason);
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'Not Completed' } : a))
      );
      fetchNotifications();
      toast.success('Appointment marked as not completed.');
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to update appointment status.';
      toast.error(message);
    }
  };

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      await appointmentService.updateStatus(id, newStatus);
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a))
      );
      fetchNotifications();
      toast.success('Status updated.');
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to update status.';
      toast.error(message);
    }
  };

  const handleSaveBP = async (userId, { systolic, diastolic, notes }) => {
    await consultationService.createLog(userId, { systolic, diastolic, notes });
    await fetchConsultationLogsForUser(userId);
  };

  const [medicalRecords, setMedicalRecords] = useState(() => {
    const saved = localStorage.getItem('infirmary_medical_records');
    return saved ? JSON.parse(saved) : [];
  });

  const [systemLogs, setSystemLogs] = useState(() => {
    const saved = localStorage.getItem('infirmary_system_logs');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const addSystemLog = (entry) => {
    const log = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      ...entry,
    };
    setSystemLogs((prev) => [log, ...prev].slice(0, 500));
  };

  const addMedicalRecord = (userId, { title, notes, files }) => {
    const readFileAsDataUrl = (file) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ name: file.name, type: file.type, dataUrl: reader.result });
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

    const baseRecord = {
      id: Math.random().toString(36).substr(2, 9),
      userId,
      title: (title || '').trim() || 'Untitled Record',
      notes: notes || '',
      date: format(new Date(), 'MMM d, yyyy'),
      dateISO: format(new Date(), 'yyyy-MM-dd'),
    };

    const user = mockUsers.find((u) => u.id === userId);
    const userName = user?.name || 'Unknown';

    const filesList = files || [];
    if (filesList.length === 0) {
      setMedicalRecords((prev) => [{ ...baseRecord, attachments: [] }, ...prev]);
      addSystemLog({
        type: 'record_added',
        message: `Medical record "${baseRecord.title}" added`,
        userId,
        userName,
        metadata: { recordId: baseRecord.id },
      });
      return;
    }
    Promise.all(filesList.map(readFileAsDataUrl)).then((attachments) => {
      setMedicalRecords((prev) => [{ ...baseRecord, attachments }, ...prev]);
      addSystemLog({
        type: 'record_added',
        message: `Medical record "${baseRecord.title}" added`,
        userId,
        userName,
        metadata: { recordId: baseRecord.id, attachmentCount: attachments.length },
      });
    });
  };

  const getRecordsByUser = (userId) => {
    return medicalRecords.filter((r) => r.userId === userId);
  };

  const logout = useCallback(() => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    setAuthUser(null);
  }, []);

  useEffect(() => {
    localStorage.setItem('infirmary_medical_records', JSON.stringify(medicalRecords));
  }, [medicalRecords]);

  useEffect(() => {
    localStorage.setItem('infirmary_system_logs', JSON.stringify(systemLogs));
  }, [systemLogs]);

  const value = {
    userProfile,
    isGuestUser,
    authUser,
    setStoredAuthUser,
    refreshAuthUser,
    logout,
    consultationPatients,
    consultationLogsByUser,
    consultationLoading,
    fetchConsultationPatients,
    fetchConsultationLogsForUser,
    notifications,
    notificationsUnreadCount,
    fetchNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    appointments,
    appointmentsLoading,
    fetchAppointments,
    fetchAllAppointments,
    handleBook,
    handleReschedule,
    handleCancel,
    handleUpdateStatus,
    mockUsers,
    handleSaveBP,
    medicalRecords,
    addMedicalRecord,
    getRecordsByUser,
    systemLogs,
    addSystemLog,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
