import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Users,
  Search,
  Shield,
  ShieldAlert,
  Trash2,
  RefreshCw,
  Mail,
  Phone,
  UserSquare2,
  UserPlus,
  User,
  MapPin,
  Lock,
  Eye,
  EyeOff,
  Pencil,
  X,
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

const initialForm = {
  firstName: '',
  lastName: '',
  middleName: '',
  email: '',
  address: '',
  phone: '',
  password: '',
  confirmPassword: '',
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

export const AdminAccountsPage = () => {
  const [userType, setUserType] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [form, setForm] = useState(initialForm);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [editForm, setEditForm] = useState(initialForm);
  const [editing, setEditing] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showEditConfirmPassword, setShowEditConfirmPassword] = useState(false);

  const loadAccounts = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const data = await adminService.listAdminUsers();
      setAccounts(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err?.response?.data?.message || 'Failed to load admin accounts.';
      toast.error(message, { style: toastStyle });
      setAccounts([]);
    } finally {
      if (!silent) setLoading(false);
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
      loadAccounts();
    }
  }, [userType]);

  const filteredAccounts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return accounts;
    return accounts.filter((account) =>
      [
        account.name,
        account.email,
        account.idNumber,
        account.employeeNumber,
        account.status,
        account.userType,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [accounts, searchQuery]);

  const stats = useMemo(() => {
    const total = accounts.length;
    const active = accounts.filter((account) => account.status === 'active').length;
    const blocked = accounts.filter((account) => account.status === 'blocked').length;
    const superAdmins = accounts.filter((account) => account.userType === 'super_admin').length;
    return { total, active, blocked, superAdmins };
  }, [accounts]);

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match.', { style: toastStyle });
      return;
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters.', { style: toastStyle });
      return;
    }

    setCreating(true);
    try {
      const result = await adminService.createAdminUser({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        middleName: form.middleName.trim() || undefined,
        email: form.email.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
      });

      const createdUser = result?.user;
      if (createdUser) {
        setAccounts((prev) => {
          const next = [createdUser, ...prev.filter((item) => item.id !== createdUser.id)];
          return next.sort((a, b) => {
            if (a.userType === 'super_admin' && b.userType !== 'super_admin') return -1;
            if (a.userType !== 'super_admin' && b.userType === 'super_admin') return 1;
            return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
          });
        });
      } else {
        await loadAccounts({ silent: true });
      }

      const loginId = result?.loginId || form.email.trim();
      toast.success(`Admin account created. Login ID: ${loginId}`, { style: toastStyle });
      setForm(initialForm);
      setShowPassword(false);
      setShowConfirmPassword(false);
    } catch (err) {
      const message = err?.response?.data?.message || 'Failed to create admin account.';
      toast.error(message, { style: toastStyle });
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (account) => {
    const nextStatus = account.status === 'blocked' ? 'active' : 'blocked';
    setBusyAction(`${account.id}:${nextStatus}`);
    try {
      const result = await adminService.updateAdminStatus(account.id, nextStatus);
      setAccounts((prev) => prev.map((item) => (item.id === account.id ? result.user : item)));
      toast.success(result?.message || 'Admin account updated.', { style: toastStyle });
    } catch (err) {
      const message = err?.response?.data?.message || 'Failed to update admin account status.';
      toast.error(message, { style: toastStyle });
    } finally {
      setBusyAction('');
    }
  };

  const handleDelete = async (account) => {
    const confirmed = window.confirm(`Delete admin account "${account.email || account.name}"? This cannot be undone.`);
    if (!confirmed) return;

    setBusyAction(`${account.id}:delete`);
    try {
      const result = await adminService.deleteAdminUser(account.id);
      setAccounts((prev) => prev.filter((item) => item.id !== account.id));
      toast.success(result?.message || 'Admin account deleted.', { style: toastStyle });
    } catch (err) {
      const message = err?.response?.data?.message || 'Failed to delete admin account.';
      toast.error(message, { style: toastStyle });
    } finally {
      setBusyAction('');
    }
  };

  const openEditAccount = (account) => {
    setEditingAccount(account);
    setEditForm({
      firstName: account.firstName || '',
      lastName: account.lastName || '',
      middleName: account.middleName || '',
      email: account.email || '',
      address: account.address || '',
      phone: account.phone || '',
      password: '',
      confirmPassword: '',
    });
    setShowEditPassword(false);
    setShowEditConfirmPassword(false);
  };

  const closeEditAccount = () => {
    setEditingAccount(null);
    setEditForm(initialForm);
    setEditing(false);
    setShowEditPassword(false);
    setShowEditConfirmPassword(false);
  };

  const handleEditAdmin = async (e) => {
    e.preventDefault();
    if (!editingAccount) return;

    if (editForm.password || editForm.confirmPassword) {
      if (editForm.password !== editForm.confirmPassword) {
        toast.error('Passwords do not match.', { style: toastStyle });
        return;
      }
      if (editForm.password.length < 8) {
        toast.error('Password must be at least 8 characters.', { style: toastStyle });
        return;
      }
    }

    setEditing(true);
    try {
      const result = await adminService.updateAdminUser(editingAccount.id, {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        middleName: editForm.middleName.trim() || undefined,
        email: editForm.email.trim(),
        address: editForm.address.trim(),
        phone: editForm.phone.trim(),
        password: editForm.password,
        confirmPassword: editForm.confirmPassword,
      });

      setAccounts((prev) => prev.map((item) => (item.id === editingAccount.id ? result.user : item)));
      toast.success(result?.message || 'Admin account updated.', { style: toastStyle });
      closeEditAccount();
    } catch (err) {
      const message = err?.response?.data?.message || 'Failed to update admin account.';
      toast.error(message, { style: toastStyle });
    } finally {
      setEditing(false);
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
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Admin Accounts</h1>
          <p className="text-sm text-slate-500 font-medium">Create, review, block, and delete admin access from one page.</p>
        </div>
        <button
          type="button"
          onClick={() => loadAccounts()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold hover:bg-slate-50 transition-all shadow-sm text-sm disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total Admins', value: stats.total, icon: Users, color: 'text-slate-700', bg: 'bg-slate-100' },
          { label: 'Active', value: stats.active, icon: Shield, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'Blocked', value: stats.blocked, icon: ShieldAlert, color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'Super Admins', value: stats.superAdmins, icon: UserSquare2, color: 'text-indigo-700', bg: 'bg-indigo-50' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                <stat.icon size={18} />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Accounts</span>
            </div>
            <p className="text-xs font-bold text-slate-500">{stat.label}</p>
            <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.35fr] gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <UserPlus size={18} className="text-primary" />
              Create Admin Account
            </h2>
            <p className="text-sm text-slate-500 font-medium mt-1">New admin accounts are saved directly to the database.</p>
          </div>

          <form onSubmit={handleCreateAdmin} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                  <User size={14} /> First Name
                </label>
                <input
                  required
                  type="text"
                  placeholder="Jane"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                  <User size={14} /> Last Name
                </label>
                <input
                  required
                  type="text"
                  placeholder="Doe"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                <User size={14} /> Middle Name <span className="text-slate-400 font-normal normal-case">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="M."
                value={form.middleName}
                onChange={(e) => setForm({ ...form, middleName: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                <Mail size={14} /> Email
              </label>
              <input
                required
                type="email"
                placeholder="admin@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                <MapPin size={14} /> Address
              </label>
              <input
                required
                type="text"
                placeholder="Street, City, Country"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                <Phone size={14} /> Phone
              </label>
              <input
                required
                type="tel"
                placeholder="+63 912 345 6789"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                  <Lock size={14} /> Password
                </label>
                <div className="relative group">
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <input
                    required
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min 8 characters"
                    minLength={8}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full px-4 pr-11 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                  <Lock size={14} /> Confirm Password
                </label>
                <div className="relative group">
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <input
                    required
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Repeat password"
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    className="w-full px-4 pr-11 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="w-full sm:w-auto px-6 py-3.5 bg-primary text-white font-black rounded-xl hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {creating ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <UserPlus size={18} />
                  Create Admin Account
                </>
              )}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, login ID, employee number, status..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium"
            />
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="py-10 text-center text-slate-400 font-medium text-sm">Loading admin accounts...</div>
            ) : filteredAccounts.length === 0 ? (
              <div className="py-10 text-center text-slate-400 font-medium text-sm">No admin accounts matched your search.</div>
            ) : (
              filteredAccounts.map((account) => {
                const isSuperAdmin = account.userType === 'super_admin';
                const isBlocked = account.status === 'blocked';
                const actionBusy = busyAction.startsWith(`${account.id}:`);

                return (
                  <div
                    key={account.id}
                    className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 sm:p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-black text-slate-900">{account.name || account.email || 'Unnamed admin'}</h3>
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-[0.12em] ${
                            isSuperAdmin ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {isSuperAdmin ? 'Super Admin' : 'Admin'}
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
                            <Users size={16} className="text-slate-400 shrink-0" />
                            <span className="font-medium">Employee No.: {account.employeeNumber || '—'}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-500 font-medium">
                          <p>Created: {formatDateTime(account.createdAt)}</p>
                          <p>Updated: {formatDateTime(account.updatedAt)}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        {!isSuperAdmin && (
                          <button
                            type="button"
                            onClick={() => openEditAccount(account)}
                            disabled={actionBusy}
                            className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-black hover:bg-slate-800 transition-all disabled:opacity-50 inline-flex items-center gap-2"
                          >
                            <Pencil size={16} />
                            Edit
                          </button>
                        )}
                        {!isSuperAdmin && (
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(account)}
                            disabled={actionBusy}
                            className={`px-4 py-2.5 rounded-xl text-sm font-black transition-all disabled:opacity-50 ${
                              isBlocked
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : 'bg-amber-500 text-white hover:bg-amber-600'
                            }`}
                          >
                            {actionBusy && busyAction.endsWith(':active') ? 'Activating...' : actionBusy && busyAction.endsWith(':blocked') ? 'Blocking...' : isBlocked ? 'Activate' : 'Block'}
                          </button>
                        )}
                        {!isSuperAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDelete(account)}
                            disabled={actionBusy}
                            className="px-4 py-2.5 rounded-xl bg-red-50 text-red-600 text-sm font-black hover:bg-red-100 transition-all disabled:opacity-50 inline-flex items-center gap-2"
                          >
                            <Trash2 size={16} />
                            {actionBusy && busyAction.endsWith(':delete') ? 'Deleting...' : 'Delete'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {editingAccount && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-100 shadow-2xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h2 className="text-xl font-black text-slate-900">Edit Admin Account</h2>
                <p className="text-sm text-slate-500 font-medium">Update this regular admin account. Super admin is excluded.</p>
              </div>
              <button
                type="button"
                onClick={closeEditAccount}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                aria-label="Close edit dialog"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditAdmin} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                    <User size={14} /> First Name
                  </label>
                  <input
                    required
                    type="text"
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                    <User size={14} /> Last Name
                  </label>
                  <input
                    required
                    type="text"
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                  <User size={14} /> Middle Name <span className="text-slate-400 font-normal normal-case">(optional)</span>
                </label>
                <input
                  type="text"
                  value={editForm.middleName}
                  onChange={(e) => setEditForm({ ...editForm, middleName: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                  <Mail size={14} /> Email
                </label>
                <input
                  required
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                  <MapPin size={14} /> Address
                </label>
                <input
                  required
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                  <Phone size={14} /> Phone
                </label>
                <input
                  required
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                    <Lock size={14} /> New Password <span className="text-slate-400 font-normal normal-case">(optional)</span>
                  </label>
                  <div className="relative group">
                    <button
                      type="button"
                      onClick={() => setShowEditPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      aria-label={showEditPassword ? 'Hide password' : 'Show password'}
                    >
                      {showEditPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <input
                      type={showEditPassword ? 'text' : 'password'}
                      placeholder="Leave blank to keep current password"
                      value={editForm.password}
                      onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                      className="w-full px-4 pr-11 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                    <Lock size={14} /> Confirm Password
                  </label>
                  <div className="relative group">
                    <button
                      type="button"
                      onClick={() => setShowEditConfirmPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      aria-label={showEditConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showEditConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <input
                      type={showEditConfirmPassword ? 'text' : 'password'}
                      placeholder="Repeat new password"
                      value={editForm.confirmPassword}
                      onChange={(e) => setEditForm({ ...editForm, confirmPassword: e.target.value })}
                      className="w-full px-4 pr-11 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEditAccount}
                  className="px-5 py-3 rounded-xl border border-slate-200 text-slate-700 font-black hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editing}
                  className="px-5 py-3 rounded-xl bg-primary text-white font-black hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  {editing ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
};
