import React, { useEffect, useRef, useState } from 'react';
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
  Pencil,
  IdCard,
  Building2,
  GraduationCap,
} from 'lucide-react';
import { profileService } from '../services/profileService';
import { getProfileImageSrc, handleProfileImageError } from '../utils/profileImage';
import { getRoleIdentityInfo } from '../utils/userIdentity';

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

const buildProfileForm = (user = {}) => ({
  firstName: user?.firstName || '',
  middleName: user?.middleName || '',
  lastName: user?.lastName || '',
  email: user?.email || '',
  phone: user?.phone || '',
  address: user?.address || '',
  pictureUrl: user?.pictureUrl || '',
});

const ProfileInfoItem = ({ icon: Icon, label, value, fullWidth = false }) => (
  <div className={`flex items-start gap-4 rounded-2xl bg-slate-50 p-4 ${fullWidth ? 'md:col-span-2' : ''}`}>
    <div className="rounded-lg bg-white p-2 text-primary shadow-sm">
      <Icon size={18} />
    </div>
    <div className="min-w-0">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="break-words text-sm font-semibold text-slate-800">{value || 'Not set'}</p>
    </div>
  </div>
);

const MAX_PROFILE_IMAGE_BYTES = 15 * 1024 * 1024;
const PROFILE_IMAGE_MAX_DIMENSION = 1200;
const PROFILE_IMAGE_QUALITY = 0.86;
const PROFILE_IMAGE_EXTENSION_PATTERN = /\.(avif|bmp|gif|heic|heif|jpe?g|png|webp)$/i;

const isLikelyImageFile = (file) =>
  Boolean(file?.type?.startsWith('image/')) || PROFILE_IMAGE_EXTENSION_PATTERN.test(file?.name || '');

const formatFileSize = (bytes) => {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return '';
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result.startsWith('data:image/')) {
        resolve(reader.result);
        return;
      }
      reject(new Error('The selected file is not a valid image.'));
    };
    reader.onerror = () => reject(new Error('Failed to read the selected image.'));
    reader.readAsDataURL(file);
  });

const resizeImageDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    let objectUrl = '';

    image.onload = () => {
      try {
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;

        if (!width || !height) {
          reject(new Error('The selected image could not be loaded.'));
          return;
        }

        const scale = Math.min(1, PROFILE_IMAGE_MAX_DIMENSION / Math.max(width, height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));

        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Image preview is not supported in this browser.'));
          return;
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const outputType = file.type === 'image/png' || file.type === 'image/webp' ? file.type : 'image/jpeg';
        const dataUrl = canvas.toDataURL(outputType, PROFILE_IMAGE_QUALITY);
        resolve(dataUrl);
      } catch (error) {
        reject(error);
      } finally {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
      }
    };

    image.onerror = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      reject(new Error('The selected image could not be loaded.'));
    };

    objectUrl = URL.createObjectURL(file);
    image.src = objectUrl;
  });

export const ProfileView = ({ user, onUserUpdated }) => {
  const [showQrPreview, setShowQrPreview] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isPasswordFormOpen, setIsPasswordFormOpen] = useState(false);
  const [profileForm, setProfileForm] = useState(() => buildProfileForm(user));
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileImageLoading, setProfileImageLoading] = useState(false);
  const [profileImageFileName, setProfileImageFileName] = useState('');
  const profileImageInputRef = useRef(null);

  useEffect(() => {
    setProfileForm(buildProfileForm(user));
    setProfileImageFileName('');
    setIsEditingProfile(false);
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
    if (!isEditingProfile) {
      return;
    }
    if (profileImageLoading) {
      toast.error('Please wait for the selected photo preview to finish loading.');
      return;
    }

    try {
      setProfileLoading(true);
      const result = await profileService.updateProfile(profileForm);
      onUserUpdated?.(result.user);
      setIsEditingProfile(false);
      setProfileImageFileName('');
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
      setIsPasswordFormOpen(false);
      toast.success(result.message || 'Password updated successfully.');
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to update password.';
      toast.error(message);
    } finally {
      setPasswordLoading(false);
    }
  };

  const updateProfileField = (field, value) => {
    if (!isEditingProfile) {
      return;
    }
    setProfileForm((prev) => ({ ...prev, [field]: value }));
  };

  const updatePasswordField = (field, value) => {
    setPasswordForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleProfileImageChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!isEditingProfile) {
      return;
    }

    if (!file) {
      return;
    }

    if (!isLikelyImageFile(file)) {
      toast.error('Please select an image file.');
      return;
    }

    if (file.size > MAX_PROFILE_IMAGE_BYTES) {
      toast.error(`Profile photo must be ${formatFileSize(MAX_PROFILE_IMAGE_BYTES)} or smaller.`);
      return;
    }

    try {
      setProfileImageLoading(true);
      const imageDataUrl = await resizeImageDataUrl(file).catch(() => readFileAsDataUrl(file));
      updateProfileField('pictureUrl', imageDataUrl);
      setProfileImageFileName(file.name || 'Selected image');
      toast.success('Profile photo preview is ready.');
    } catch (error) {
      toast.error(error?.message || 'Failed to read the selected image.');
    } finally {
      setProfileImageLoading(false);
    }
  };

  const handleStartProfileEdit = () => {
    setProfileForm(buildProfileForm(user));
    setProfileImageFileName('');
    setIsEditingProfile(true);
  };

  const handleCancelProfileEdit = () => {
    setProfileForm(buildProfileForm(user));
    setProfileImageFileName('');
    setIsEditingProfile(false);
  };

  const handleStartPasswordChange = () => {
    setPasswordForm(emptyPasswordForm);
    setIsPasswordFormOpen(true);
  };

  const handleCancelPasswordChange = () => {
    setPasswordForm(emptyPasswordForm);
    setIsPasswordFormOpen(false);
  };

  const userTypeLabel = getUserTypeLabel(user?.userType);
  const identityInfo = getRoleIdentityInfo(user);
  const isGuestUser = identityInfo.isGuestUser;
  const profileFieldDisabled = !isEditingProfile || profileLoading || profileImageLoading;
  const personalCollege = identityInfo.isEmployeeUser ? (user?.college || '') : identityInfo.college;
  const personalProgram = identityInfo.isEmployeeUser
    ? identityInfo.department
    : isGuestUser
      ? (user?.program || '')
      : identityInfo.program;
  const personalProgramLabel = isGuestUser ? 'Type of Guest' : 'Program / Department';
  const personalIdentifierLabel = identityInfo.isEmployeeUser
    ? 'Employee Email'
    : identityInfo.isStudentUser
      ? 'Student ID'
      : 'ID Number';
  const personalIdentifierValue = identityInfo.isEmployeeUser
    ? (user?.email || '')
    : identityInfo.identifierValue;

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
              {!isGuestUser && identityInfo.identifierValue && (
                <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold border border-slate-200">
                  {identityInfo.identifierLabel}: {identityInfo.identifierValue}
                </span>
              )}
              {identityInfo.isEmployeeUser && identityInfo.position && (
                <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-bold border border-amber-100">
                  {identityInfo.position}
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
                <User size={20} className="text-primary shrink-0" /> Profile Information
              </h3>
              {isEditingProfile ? (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCancelProfileEdit}
                    disabled={profileLoading}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                  >
                    <X size={16} />
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={profileLoading || profileImageLoading}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-hover disabled:opacity-60"
                  >
                    <Save size={16} />
                    {profileLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleStartProfileEdit}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-hover"
                >
                  <Pencil size={16} />
                  Edit Profile
                </button>
              )}
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
                  <p className="text-xs text-slate-500">
                    {!isEditingProfile
                      ? 'Click Edit Profile to update your profile photo.'
                      : profileImageFileName
                      ? `Previewing: ${profileImageFileName}`
                      : 'Upload a square photo for the best result. It will be saved with your profile.'}
                  </p>
                </div>
                {isEditingProfile && (
                  <div className="relative inline-flex min-h-[48px] min-w-[148px] items-center justify-center gap-2 overflow-hidden rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50">
                    <Camera size={16} className="text-primary" />
                    {profileImageLoading ? 'Loading...' : 'Upload Image'}
                    <input
                      ref={profileImageInputRef}
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                      onChange={handleProfileImageChange}
                      aria-label="Upload profile photo"
                      disabled={profileImageLoading || profileLoading}
                    />
                  </div>
                )}
              </div>
              <label className="space-y-1.5">
                <span className="text-xs font-black text-slate-500 uppercase tracking-[0.08em]">First Name</span>
                <input
                  type="text"
                  value={profileForm.firstName}
                  onChange={(e) => updateProfileField('firstName', e.target.value)}
                  disabled={profileFieldDisabled}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-600"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black text-slate-500 uppercase tracking-[0.08em]">Middle Initial / Name</span>
                <input
                  type="text"
                  value={profileForm.middleName}
                  onChange={(e) => updateProfileField('middleName', e.target.value)}
                  disabled={profileFieldDisabled}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-600"
                />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-xs font-black text-slate-500 uppercase tracking-[0.08em]">Last Name</span>
                <input
                  type="text"
                  value={profileForm.lastName}
                  onChange={(e) => updateProfileField('lastName', e.target.value)}
                  disabled={profileFieldDisabled}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-600"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black text-slate-500 uppercase tracking-[0.08em]">Email</span>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => updateProfileField('email', e.target.value)}
                  disabled={profileFieldDisabled}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-600"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black text-slate-500 uppercase tracking-[0.08em]">Phone</span>
                <input
                  type="text"
                  value={profileForm.phone}
                  onChange={(e) => updateProfileField('phone', e.target.value)}
                  disabled={profileFieldDisabled}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-600"
                />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-xs font-black text-slate-500 uppercase tracking-[0.08em]">Address</span>
                <textarea
                  rows={3}
                  value={profileForm.address}
                  onChange={(e) => updateProfileField('address', e.target.value)}
                  disabled={profileFieldDisabled}
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-600"
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
              {!isPasswordFormOpen && (
                <button
                  type="button"
                  onClick={handleStartPasswordChange}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-hover"
                >
                  <KeyRound size={16} />
                  Change Password
                </button>
              )}
            </div>

            {isPasswordFormOpen && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <label className="space-y-1.5">
                    <span className="text-xs font-black text-slate-500 uppercase tracking-[0.08em]">Current Password</span>
                    <input
                      type="password"
                      required
                      value={passwordForm.currentPassword}
                      onChange={(e) => updatePasswordField('currentPassword', e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-black text-slate-500 uppercase tracking-[0.08em]">New Password</span>
                    <input
                      type="password"
                      required
                      value={passwordForm.newPassword}
                      onChange={(e) => updatePasswordField('newPassword', e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-black text-slate-500 uppercase tracking-[0.08em]">Confirm Password</span>
                    <input
                      type="password"
                      required
                      value={passwordForm.confirmPassword}
                      onChange={(e) => updatePasswordField('confirmPassword', e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCancelPasswordChange}
                    disabled={passwordLoading}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                  >
                    <X size={16} />
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-hover disabled:opacity-60"
                  >
                    <KeyRound size={16} />
                    {passwordLoading ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </>
            )}
          </form>

          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-sm border border-slate-200 space-y-4 sm:space-y-6 min-w-0 overflow-hidden">
            <h3 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
              <User size={20} className="text-primary shrink-0" /> Personal Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <ProfileInfoItem icon={ShieldCheck} label="User Type" value={userTypeLabel} />
              <ProfileInfoItem icon={IdCard} label={personalIdentifierLabel} value={personalIdentifierValue} />
              {!isGuestUser && (
                <ProfileInfoItem icon={Building2} label="College" value={personalCollege} />
              )}
              <ProfileInfoItem icon={GraduationCap} label={personalProgramLabel} value={personalProgram} />
              <ProfileInfoItem icon={Mail} label="Email Address" value={user?.email || ''} />
              <ProfileInfoItem icon={Phone} label="Phone Number" value={user?.phone || ''} />
              <ProfileInfoItem icon={MapPin} label="Address" value={user?.address || ''} fullWidth />
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
            {!isGuestUser && identityInfo.identifierValue && (
              <p>
                <span className="font-semibold text-slate-500">{identityInfo.identifierLabel}</span>{' '}
                <span className="font-black text-slate-900">{identityInfo.identifierValue}</span>
              </p>
            )}
            {identityInfo.isStudentUser && identityInfo.college && (
              <p className="text-slate-600">
                <span className="font-semibold">College:</span> {identityInfo.college}
              </p>
            )}
            {identityInfo.isStudentUser && identityInfo.program && (
              <p className="text-slate-600">
                <span className="font-semibold">Program:</span> {identityInfo.program}
              </p>
            )}
            {identityInfo.isEmployeeUser && identityInfo.position && (
              <p className="text-slate-600">
                <span className="font-semibold">Position:</span> {identityInfo.position}
              </p>
            )}
            {identityInfo.isEmployeeUser && identityInfo.department && (
              <p className="text-slate-600">
                <span className="font-semibold">Program / Department:</span> {identityInfo.department}
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
