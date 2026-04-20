import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  User,
  Mail,
  Phone,
  MapPin,
  ShieldCheck,
  Maximize2,
  Download,
  X,
  Save,
  KeyRound,
  Camera,
} from 'lucide-react';
import { profileService } from '../services/profileService';
import { getProfileImageSrc, handleProfileImageError } from '../utils/profileImage';

const getUserTypeLabel = (userType) => {
  const map = {
    new: 'New Student',
    old: 'Old Student',
    employee: 'Employee',
    student: 'Student',
    faculty: 'Faculty',
    admin: 'Admin',
  };
  return map[userType] || (userType ? String(userType) : 'User');
};

const emptyPasswordForm = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

export const ProfileView = ({ user, onUserUpdated }) => {
  const [showQrPreview, setShowQrPreview] = useState(false);
  const [profileForm, setProfileForm] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    pictureUrl: '',
  });
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    setProfileForm({
      firstName: user?.firstName || '',
      middleName: user?.middleName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      phone: user?.phone || '',
      address: user?.address || '',
      pictureUrl: user?.pictureUrl || '',
    });
  }, [user]);

  const handleDownloadQr = () => {
    if (!user?.qrCode) return;
    try {
      const link = document.createElement('a');
      link.href = user.qrCode;
      link.download = 'infirmary-id-qr.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      // ignore best-effort browser download failures
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    try {
      setProfileLoading(true);
      const result = await profileService.updateProfile(profileForm);
      onUserUpdated?.(result.user);
      toast.success(result.message || 'Profile updated successfully.');
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to update profile.';
      toast.error(message);
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    try {
      setPasswordLoading(true);
      const result = await profileService.updatePassword(passwordForm);
      setPasswordForm(emptyPasswordForm);
      toast.success(result.message || 'Password updated successfully.');
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to update password.';
      toast.error(message);
    } finally {
      setPasswordLoading(false);
    }
  };

  const updateProfileField = (field, value) => {
    setProfileForm((prev) => ({ ...prev, [field]: value }));
  };

  const updatePasswordField = (field, value) => {
    setPasswordForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleProfileImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      updateProfileField('pictureUrl', typeof reader.result === 'string' ? reader.result : '');
    };
    reader.onerror = () => {
      toast.error('Failed to read the selected image.');
    };
    reader.readAsDataURL(file);
  };

  const userTypeLabel = getUserTypeLabel(user?.userType);
  const isGuestUser = user?.userType === 'guest';

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 min-w-0">
      <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-sm border border-slate-200 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-24 sm:h-32 bg-primary/10" />
        <div className="relative flex flex-col md:flex-row items-center gap-4 sm:gap-8 mt-6 sm:mt-8">
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-white p-1 shadow-lg shrink-0">
            <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border-4 border-white">
              <img
                src={getProfileImageSrc(user?.pictureUrl)}
                alt={user?.name || 'Profile'}
                className="w-full h-full rounded-full object-cover"
                onError={handleProfileImageError}
              />
            </div>
          </div>
          <div className="text-center md:text-left space-y-2 min-w-0 flex-1">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-800 break-words">{user?.name || 'User'}</h2>
            <div className="flex flex-wrap justify-center md:justify-start gap-4">
              <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold border border-emerald-100 flex items-center gap-1">
                <ShieldCheck size={12} /> {userTypeLabel}
              </span>
              {user?.studentNumber && (
                <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold border border-slate-200">
                  Student ID: {user.studentNumber}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-6 sm:gap-8 items-start">
        <div className="space-y-6">
          <form
            onSubmit={handleProfileSubmit}
            className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-sm border border-slate-200 space-y-5"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
                <User size={20} className="text-primary shrink-0" /> Update Profile
              </h3>
              <button
                type="submit"
                disabled={profileLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-hover disabled:opacity-60"
              >
                <Save size={16} />
                {profileLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 flex flex-col sm:flex-row items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="w-20 h-20 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center overflow-hidden">
                  <img
                    src={getProfileImageSrc(profileForm.pictureUrl)}
                    alt="Profile preview"
                    className="w-full h-full object-cover"
                    onError={handleProfileImageError}
                  />
                </div>
                <div className="flex-1 space-y-2 text-center sm:text-left">
                  <p className="text-sm font-bold text-slate-700">Profile Photo</p>
                  <p className="text-xs text-slate-500">Upload a square photo for the best result. It will be saved with your profile.</p>
                </div>
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">
                  <Camera size={16} className="text-primary" />
                  Upload Image
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleProfileImageChange}
                  />
                </label>
              </div>
              <label className="space-y-1.5">
                <span className="text-xs font-black text-slate-500 uppercase tracking-[0.08em]">First Name</span>
                <input
                  type="text"
                  value={profileForm.firstName}
                  onChange={(e) => updateProfileField('firstName', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black text-slate-500 uppercase tracking-[0.08em]">Middle Initial / Name</span>
                <input
                  type="text"
                  value={profileForm.middleName}
                  onChange={(e) => updateProfileField('middleName', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary"
                />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-xs font-black text-slate-500 uppercase tracking-[0.08em]">Last Name</span>
                <input
                  type="text"
                  value={profileForm.lastName}
                  onChange={(e) => updateProfileField('lastName', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black text-slate-500 uppercase tracking-[0.08em]">Email</span>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => updateProfileField('email', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black text-slate-500 uppercase tracking-[0.08em]">Phone</span>
                <input
                  type="text"
                  value={profileForm.phone}
                  onChange={(e) => updateProfileField('phone', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary"
                />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-xs font-black text-slate-500 uppercase tracking-[0.08em]">Address</span>
                <textarea
                  rows={3}
                  value={profileForm.address}
                  onChange={(e) => updateProfileField('address', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary resize-none"
                />
              </label>
            </div>
          </form>

          <form
            onSubmit={handlePasswordSubmit}
            className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-sm border border-slate-200 space-y-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
                  <KeyRound size={20} className="text-primary shrink-0" /> Change Password
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  By default, your first password is your student ID. You can change it here anytime.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="space-y-1.5">
                <span className="text-xs font-black text-slate-500 uppercase tracking-[0.08em]">Current Password</span>
                <input
                  type="password"
                  required
                  value={passwordForm.currentPassword}
                  onChange={(e) => updatePasswordField('currentPassword', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black text-slate-500 uppercase tracking-[0.08em]">New Password</span>
                <input
                  type="password"
                  required
                  value={passwordForm.newPassword}
                  onChange={(e) => updatePasswordField('newPassword', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black text-slate-500 uppercase tracking-[0.08em]">Confirm Password</span>
                <input
                  type="password"
                  required
                  value={passwordForm.confirmPassword}
                  onChange={(e) => updatePasswordField('confirmPassword', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary"
                />
              </label>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={passwordLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-hover disabled:opacity-60"
              >
                <KeyRound size={16} />
                {passwordLoading ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>

          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-sm border border-slate-200 space-y-4 sm:space-y-6 min-w-0 overflow-hidden">
            <h3 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
              <User size={20} className="text-primary shrink-0" /> Current Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                <div className="p-2 bg-white rounded-lg text-primary shadow-sm">
                  <Mail size={18} />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Email Address</p>
                  <p className="text-sm font-semibold text-slate-800 break-all">{user?.email || 'Not set'}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                <div className="p-2 bg-white rounded-lg text-primary shadow-sm">
                  <Phone size={18} />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Phone Number</p>
                  <p className="text-sm font-semibold text-slate-800">{user?.phone || 'Not set'}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl md:col-span-2">
                <div className="p-2 bg-white rounded-lg text-primary shadow-sm">
                  <MapPin size={18} />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Address</p>
                  <p className="text-sm font-semibold text-slate-800">{user?.address || 'Not set'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-sm border border-slate-200 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
              <User size={18} className="text-primary shrink-0" />
              ID & QR Code
            </h3>
            {user?.qrCode && (
              <button
                type="button"
                onClick={handleDownloadQr}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-bold bg-primary text-white hover:bg-primary-hover transition-colors"
              >
                <Download size={12} />
                Download
              </button>
            )}
          </div>

          <div className="space-y-2 text-xs sm:text-sm">
            {user?.studentNumber && (
              <p>
                <span className="font-semibold text-slate-500">Student No.</span>{' '}
                <span className="font-black text-slate-900">{user.studentNumber}</span>
              </p>
            )}
            {user?.employeeNumber && (
              <p>
                <span className="font-semibold text-slate-500">Employee No.</span>{' '}
                <span className="font-black text-slate-900">{user.employeeNumber}</span>
              </p>
            )}
            {!isGuestUser && user?.college && (
              <p className="text-slate-600">
                <span className="font-semibold">College:</span> {user.college}
              </p>
            )}
            {!isGuestUser && user?.program && (
              <p className="text-slate-600">
                <span className="font-semibold">Program:</span> {user.program}
              </p>
            )}
            {isGuestUser && user?.program && (
              <p className="text-slate-600">
                <span className="font-semibold">Type of Guest:</span> {user.program}
              </p>
            )}
          </div>

          <div className="mt-3">
            {user?.qrCode ? (
              <button
                type="button"
                onClick={() => setShowQrPreview(true)}
                className="group w-full flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border border-dashed border-slate-200 hover:border-primary/50 hover:bg-primary/5 transition-colors"
              >
                <div className="p-2 bg-white rounded-2xl border border-slate-200 shadow-inner">
                  <img
                    src={user.qrCode}
                    alt="Profile QR code"
                    className="w-28 h-28 sm:w-32 sm:h-32 rounded-xl object-contain"
                  />
                </div>
                <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                  <Maximize2 size={12} className="text-primary" />
                  Click to enlarge / download
                </span>
              </button>
            ) : (
              <p className="text-[11px] text-slate-400">No QR code is available for this account type.</p>
            )}
          </div>

          {showQrPreview && user?.qrCode && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 max-w-sm w-full space-y-4 shadow-2xl relative">
                <button
                  type="button"
                  onClick={() => setShowQrPreview(false)}
                  className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  <X size={16} />
                </button>
                <h4 className="text-sm font-bold text-slate-800">Your Infirmary QR Code</h4>
                <div className="flex justify-center">
                  <div className="p-3 bg-white rounded-3xl border border-slate-200 shadow-inner">
                    <img
                      src={user.qrCode}
                      alt="Profile QR code large"
                      className="w-48 h-48 rounded-2xl object-contain"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                  <p>Show this to infirmary staff during visits.</p>
                  <button
                    type="button"
                    onClick={handleDownloadQr}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-primary text-white font-bold hover:bg-primary-hover"
                  >
                    <Download size={12} />
                    Download
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
