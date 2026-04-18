import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Search,
  Trash2,
  Mail,
  Phone,
  UserSquare2,
  GraduationCap,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminService } from '../../services/adminService';

const toastStyle = {
  borderRadius: '12px',
  background: '#0f172a',
  color: '#fff',
  fontWeight: 'bold',
  fontSize: '12px',
};

const PAGE_SIZE = 25;

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

export const AdminUserControlPage = () => {
  const [userType, setUserType] = useState(null);
  const [clientUsers, setClientUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const loadClientUsers = async ({ silent = false } = {}) => {
    if (!silent) setUsersLoading(true);
    try {
      const data = await adminService.listClientUsers();
      setClientUsers(Array.isArray(data) ? data : []);
      setCurrentPage(1);
    } catch (err) {
      const message = err?.response?.data?.message || 'Failed to load user accounts.';
      toast.error(message, { style: toastStyle });
      setClientUsers([]);
    } finally {
      if (!silent) setUsersLoading(false);
    }
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem('authUser');
      setUserType(stored ? JSON.parse(stored).userType : null);
    } catch {
      setUserType(null);
    }
  }, []);

  useEffect(() => {
    if (userType === 'super_admin') {
      loadClientUsers();
    }
  }, [userType]);

  const filteredClientUsers = useMemo(() => {
    const query = userSearchQuery.trim().toLowerCase();
    if (!query) return clientUsers;
    return clientUsers.filter((account) =>
      [
        account.name,
        account.email,
        account.idNumber,
        account.studentNumber,
        account.employeeNumber,
        account.status,
        account.userType,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [clientUsers, userSearchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredClientUsers.length / PAGE_SIZE));

  const paginatedClientUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredClientUsers.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredClientUsers, currentPage]);

  const userStats = useMemo(() => {
    const total = clientUsers.length;
    const active = clientUsers.filter((account) => account.status === 'active').length;
    const blocked = clientUsers.filter((account) => account.status === 'blocked').length;
    return { total, active, blocked };
  }, [clientUsers]);

  useEffect(() => {
    setCurrentPage(1);
  }, [userSearchQuery]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleToggleClientUserStatus = async (account) => {
    const nextStatus = account.status === 'blocked' ? 'active' : 'blocked';
    setBusyAction(`user:${account.id}:${nextStatus}`);
    try {
      const result = await adminService.updateClientUserStatus(account.id, nextStatus);
      setClientUsers((prev) => prev.map((item) => (item.id === account.id ? result.user : item)));
      toast.success(result?.message || 'User account updated.', { style: toastStyle });
    } catch (err) {
      const message = err?.response?.data?.message || 'Failed to update user account status.';
      toast.error(message, { style: toastStyle });
    } finally {
      setBusyAction('');
    }
  };

  const handleDeleteClientUser = async (account) => {
    const confirmed = window.confirm(`Delete user account "${account.email || account.name}"? This cannot be undone.`);
    if (!confirmed) return;

    setBusyAction(`user:${account.id}:delete`);
    try {
      const result = await adminService.deleteClientUser(account.id);
      setClientUsers((prev) => prev.filter((item) => item.id !== account.id));
      toast.success(result?.message || 'User account deleted.', { style: toastStyle });
    } catch (err) {
      const message = err?.response?.data?.message || 'Failed to delete user account.';
      toast.error(message, { style: toastStyle });
    } finally {
      setBusyAction('');
    }
  };

  if (userType != null && userType !== 'super_admin') {
    return <Navigate to="/admin" replace />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">User Control</h1>
          <p className="text-sm text-slate-500 font-medium">Manage student and employee access accounts on a dedicated page.</p>
        </div>
        <button
          type="button"
          onClick={() => loadClientUsers()}
          disabled={usersLoading}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold hover:bg-slate-50 transition-all shadow-sm text-sm disabled:opacity-50"
        >
          <RefreshCw size={16} className={usersLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4 max-w-2xl">
        {[
          { label: 'Users', value: userStats.total, color: 'text-slate-700', bg: 'bg-slate-100' },
          { label: 'Active', value: userStats.active, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'Blocked', value: userStats.blocked, color: 'text-amber-700', bg: 'bg-amber-50' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{stat.label}</p>
            <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={userSearchQuery}
            onChange={(e) => setUserSearchQuery(e.target.value)}
            placeholder="Search users by name, email, login ID, student number, employee number, status..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium"
          />
        </div>

        {!usersLoading && filteredClientUsers.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm">
            <p className="text-slate-500 font-medium">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}
              {' - '}
              {Math.min(currentPage * PAGE_SIZE, filteredClientUsers.length)}
              {' '}of {filteredClientUsers.length} users
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <span className="px-3 py-2 text-slate-500 font-bold">
                Page {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {usersLoading ? (
            <div className="py-10 text-center text-slate-400 font-medium text-sm">Loading user accounts...</div>
          ) : filteredClientUsers.length === 0 ? (
            <div className="py-10 text-center text-slate-400 font-medium text-sm">No user accounts matched your search.</div>
          ) : (
            paginatedClientUsers.map((account) => {
              const isBlocked = account.status === 'blocked';
              const actionBusy = busyAction.startsWith(`user:${account.id}:`);

              return (
                <div
                  key={account.id}
                  className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 sm:p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-black text-slate-900">{account.name || account.email || 'Unnamed user'}</h3>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-[0.12em] bg-cyan-100 text-cyan-700">
                          {account.userType || 'User'}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-[0.12em] ${
                          isBlocked ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {account.status || 'active'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Mail size={16} className="text-slate-400 shrink-0" />
                          <span className="font-medium break-all">{account.email || '—'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <Phone size={16} className="text-slate-400 shrink-0" />
                          <span className="font-medium">{account.phone || '—'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <UserSquare2 size={16} className="text-slate-400 shrink-0" />
                          <span className="font-medium">Login ID: {account.idNumber || '—'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <GraduationCap size={16} className="text-slate-400 shrink-0" />
                          <span className="font-medium">Student No.: {account.studentNumber || account.employeeNumber || '—'}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-500 font-medium">
                        <p>Created: {formatDateTime(account.createdAt)}</p>
                        <p>Updated: {formatDateTime(account.updatedAt)}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <button
                        type="button"
                        onClick={() => handleToggleClientUserStatus(account)}
                        disabled={actionBusy}
                        className={`px-4 py-2.5 rounded-xl text-sm font-black transition-all disabled:opacity-50 ${
                          isBlocked
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-amber-500 text-white hover:bg-amber-600'
                        }`}
                      >
                        {actionBusy && busyAction.endsWith(':active') ? 'Activating...' : actionBusy && busyAction.endsWith(':blocked') ? 'Blocking...' : isBlocked ? 'Activate' : 'Block'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClientUser(account)}
                        disabled={actionBusy}
                        className="px-4 py-2.5 rounded-xl bg-red-50 text-red-600 text-sm font-black hover:bg-red-100 transition-all disabled:opacity-50 inline-flex items-center gap-2"
                      >
                        <Trash2 size={16} />
                        {actionBusy && busyAction.endsWith(':delete') ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {!usersLoading && filteredClientUsers.length > PAGE_SIZE && (
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};
