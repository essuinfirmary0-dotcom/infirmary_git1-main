import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { QrCode, Keyboard, X, Building2, GraduationCap, Timer, Printer } from 'lucide-react';
import logoImg from '../assets/logo.jpg';
import {
  useKioskCheckIn,
  formatIdInput,
  getKioskQrInputDisplayValue,
  normalizeQrScanInput,
} from '../hooks/useKioskCheckIn';
import { authService } from '../services/authService';
import { resolveKioskReceiptIdentity } from '../utils/kioskReceiptIdentity';
import { printKioskReceipt } from '../utils/kioskPrintReceipt';
import { getAppointmentStatusLabel } from '../utils/appointmentStatus';

function KioskResultBlock({ kioskResult, tone = 'light' }) {
  if (!kioskResult) return null;
  const isDark = tone === 'dark';
  const user = kioskResult.user || {};
  const receiptIdentity = resolveKioskReceiptIdentity(user);
  const isGuestUser = receiptIdentity.type === 'guest';
  const guestType = user.program?.trim() || '';
  return (
    <div
      className={`mt-3 border-t pt-3 space-y-2 ${
        isDark ? 'border-white/20' : 'border-slate-100'
      }`}
    >
      {kioskResult.checkInDateDisplay && (
        <p
          className={`text-xs font-semibold ${
            isDark ? 'text-emerald-200/90' : 'text-primary'
          }`}
        >
          {kioskResult.checkInDateDisplay}
        </p>
      )}
      {kioskResult.queueNumber && (
        <div className="flex items-center justify-between gap-2">
          <p
            className={`text-[11px] font-black uppercase tracking-[0.2em] ${
              isDark ? 'text-white/60' : 'text-slate-500'
            }`}
          >
            Queue Number
          </p>
          <span className="px-3 py-1 rounded-full bg-slate-900 text-white text-xs font-black">
            {kioskResult.queueNumber}
          </span>
        </div>
      )}
      <div
        className={`text-xs space-y-1.5 ${isDark ? 'text-white/85' : 'text-slate-600'}`}
      >
        <p className="font-semibold">{user.name || 'Guest'}</p>
        {receiptIdentity.value && (
          <p>
            {receiptIdentity.label}: {receiptIdentity.value}
          </p>
        )}
        {!isGuestUser && user.college?.trim() && (
          <p>College: {user.college}</p>
        )}
        {!isGuestUser && user.program?.trim() && (
          <p>Program: {user.program}</p>
        )}
        {isGuestUser && guestType && (
          <p>Type of Guest: {guestType}</p>
        )}
        {kioskResult.hasAppointmentToday && kioskResult.appointment ? (
          <div
            className={`mt-2 p-3 rounded-xl space-y-1 ${
              isDark
                ? 'bg-white/10 border border-white/20'
                : 'bg-slate-50 border border-slate-200'
            }`}
          >
            <p
              className={`text-[11px] font-bold uppercase tracking-[0.15em] ${
                isDark ? 'text-white/55' : 'text-slate-500'
              }`}
            >
              Today&apos;s Appointment
            </p>
            <p className="text-xs">
              <span className="font-semibold">Ticket No.:</span>{' '}
              {kioskResult.appointment.code}
            </p>
            <p className="text-xs">
              <span className="font-semibold">Time:</span> {kioskResult.appointment.time}
            </p>
            <p className="text-xs">
              <span className="font-semibold">Service:</span> {kioskResult.appointment.service}{' '}
              {kioskResult.appointment.subcategory
                ? `- ${kioskResult.appointment.subcategory}`
                : ''}
            </p>
            <p className={isDark ? 'text-[11px] text-white/50' : 'text-[11px] text-slate-500'}>
              Status: {getAppointmentStatusLabel(kioskResult.appointment.status)}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const RECEIPT_AUTO_CLOSE_SECONDS = 10;
const PRINT_BUTTON_ARM_DELAY_MS = 900;

export function ReceiptOverlay({ kioskResult, onClose }) {
  const [activeResult, setActiveResult] = useState(kioskResult);
  const [secondsLeft, setSecondsLeft] = useState(RECEIPT_AUTO_CLOSE_SECONDS);
  const [confirmingCheckIn, setConfirmingCheckIn] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [printButtonReady, setPrintButtonReady] = useState(false);
  const closeRef = useRef(onClose);
  const didAutoCloseRef = useRef(false);
  const armPrintTimerRef = useRef(null);
  const overlayPanelRef = useRef(null);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    setActiveResult(kioskResult);
    setConfirmingCheckIn(false);
    setConfirmError('');
    setPrintButtonReady(false);
    if (armPrintTimerRef.current) {
      clearTimeout(armPrintTimerRef.current);
      armPrintTimerRef.current = null;
    }
    if (!kioskResult) return undefined;
    didAutoCloseRef.current = false;
    setSecondsLeft(RECEIPT_AUTO_CLOSE_SECONDS);
    if (typeof document !== 'undefined') {
      const activeElement = document.activeElement;
      if (
        activeElement &&
        typeof activeElement.blur === 'function' &&
        activeElement !== document.body
      ) {
        activeElement.blur();
      }
    }
    const focusTimerId = window.setTimeout(() => {
      overlayPanelRef.current?.focus();
    }, 0);
    armPrintTimerRef.current = window.setTimeout(() => {
      setPrintButtonReady(true);
      armPrintTimerRef.current = null;
    }, PRINT_BUTTON_ARM_DELAY_MS);
    const id = setInterval(() => {
      setSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => {
      clearInterval(id);
      clearTimeout(focusTimerId);
      if (armPrintTimerRef.current) {
        clearTimeout(armPrintTimerRef.current);
        armPrintTimerRef.current = null;
      }
    };
  }, [kioskResult]);

  useEffect(() => {
    if (!activeResult || confirmingCheckIn || secondsLeft > 0) return;
    if (didAutoCloseRef.current) return;
    didAutoCloseRef.current = true;
    closeRef.current();
  }, [secondsLeft, activeResult, confirmingCheckIn]);

  const handleClose = () => {
    didAutoCloseRef.current = true;
    onClose();
  };

  const result = activeResult || kioskResult;
  if (!result) return null;

  const pct = (secondsLeft / RECEIPT_AUTO_CLOSE_SECONDS) * 100;
  const user = result.user || {};
  const receiptIdentity = resolveKioskReceiptIdentity(user);
  const isGuestUser = receiptIdentity.type === 'guest';
  const guestType = user.program?.trim() || '';
  const showCollege = !isGuestUser && Boolean(user.college?.trim());
  const showProgram = !isGuestUser && Boolean(user.program?.trim());
  const showGuestType = isGuestUser && Boolean(guestType);
  const isCheckInConfirmed = Boolean(result.checkInConfirmed);

  const handlePrint = async () => {
    if (confirmingCheckIn || !printButtonReady) return;

    let resultToPrint = result;
    setConfirmError('');

    if (!isCheckInConfirmed) {
      if (!result.appointment?.id) {
        setConfirmError('This appointment cannot be confirmed right now. Please scan again.');
        return;
      }

      try {
        setConfirmingCheckIn(true);
        didAutoCloseRef.current = false;
        setSecondsLeft(RECEIPT_AUTO_CLOSE_SECONDS);
        const confirmedResult = await authService.kioskConfirmCheckIn({
          appointmentId: result.appointment.id,
        });
        resultToPrint = confirmedResult;
        setActiveResult(confirmedResult);
        didAutoCloseRef.current = false;
        setSecondsLeft(RECEIPT_AUTO_CLOSE_SECONDS);
      } catch (err) {
        setConfirmError(
          err?.response?.data?.message ||
            'Check-in could not be confirmed. Please try again.',
        );
        return;
      } finally {
        setConfirmingCheckIn(false);
      }
    }

    await printKioskReceipt(resultToPrint);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm px-4">
      <div
        ref={overlayPanelRef}
        tabIndex={-1}
        onKeyDownCapture={(e) => {
          if (
            !printButtonReady &&
            (e.key === 'Enter' || e.key === ' ')
          ) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        className="bg-white rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 max-w-lg w-full shadow-2xl border border-slate-200 relative outline-none"
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Close receipt"
        >
          <X size={22} />
        </button>

        <div className="space-y-4">
          <div className="text-center space-y-1 pr-8">
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.25em]">
              {isCheckInConfirmed ? 'Kiosk Check-in Receipt' : 'Kiosk Check-in Confirmation'}
            </p>
            <h3 className="font-black text-slate-900 text-2xl sm:text-3xl">
              {isCheckInConfirmed ? 'You&apos;re in the queue' : 'Confirm your check-in'}
            </h3>
            {result.checkInDateDisplay && (
              <p className="text-sm font-bold text-slate-600 pt-1">
                {result.checkInDateDisplay}
              </p>
            )}
          </div>

          {isCheckInConfirmed && result.queueNumber ? (
            <div className="flex flex-col items-center space-y-2">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                Queue Number
              </p>
              <div className="px-6 py-3 rounded-full bg-slate-900 text-white font-black shadow-lg shadow-slate-900/40 text-3xl sm:text-4xl tracking-tight">
                {result.queueNumber}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-primary/25 bg-primary/5 px-5 py-4 text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                Queue Number Pending
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-700">
                Click Print Receipt to save your check-in and assign your queue number.
              </p>
            </div>
          )}

          <div className="w-full h-px bg-slate-200" />

          <div className="bg-slate-50 rounded-2xl border border-slate-200 space-y-3 text-xs p-5 text-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-slate-700">
              {user.name || 'Guest'}
            </p>
            {receiptIdentity.value && (
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {receiptIdentity.label}
                </p>
                <span className="inline-flex px-2 py-0.5 rounded-full bg-slate-900 text-white text-[10px] font-bold">
                  {receiptIdentity.value}
                </span>
              </div>
            )}
          </div>
          {(showCollege || showProgram || showGuestType) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200/80">
              {showCollege && (
                <div className="flex items-start gap-2 text-xs text-slate-700">
                  <Building2 size={14} className="text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      College
                    </p>
                    <p className="font-semibold text-slate-800 leading-snug">{user.college}</p>
                  </div>
                </div>
              )}
              {showProgram && (
                <div className="flex items-start gap-2 text-xs text-slate-700">
                  <GraduationCap size={14} className="text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Program
                    </p>
                    <p className="font-semibold text-slate-800 leading-snug">{user.program}</p>
                  </div>
                </div>
              )}
              {showGuestType && (
                <div className="flex items-start gap-2 text-xs text-slate-700">
                  <GraduationCap size={14} className="text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Type of Guest
                    </p>
                    <p className="font-semibold text-slate-800 leading-snug">{guestType}</p>
                  </div>
                </div>
              )}
            </div>
          )}
          {result.hasAppointmentToday && result.appointment && (
            <div className="mt-1 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.15em]">
                  Today&apos;s Appointment
                </p>
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-black tracking-wide">
                  {result.appointment.code}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                    Time
                  </p>
                  <p className="text-xs font-semibold text-slate-800">
                    {result.appointment.time}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                    Status
                  </p>
                  <p className="text-xs font-semibold text-slate-800">
                    {getAppointmentStatusLabel(result.appointment.status)}
                  </p>
                </div>
                <div className="space-y-0.5 col-span-2">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                    Service
                  </p>
                  <p className="text-xs font-semibold text-slate-800">
                    {result.appointment.service}{' '}
                    {result.appointment.subcategory
                      ? `- ${result.appointment.subcategory}`
                      : ''}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

          <p className="text-[11px] text-slate-500 text-center">
            {isCheckInConfirmed
              ? 'Please wait for your queue number to be called on the infirmary display.'
              : 'Printing the receipt is the final step that confirms and saves this kiosk check-in.'}
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={handlePrint}
            disabled={confirmingCheckIn || !printButtonReady}
            className="w-full py-3.5 rounded-2xl border-2 border-primary/30 bg-primary/5 text-primary font-black text-sm sm:text-base flex items-center justify-center gap-2 hover:bg-primary/10 min-h-[48px] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Printer size={20} aria-hidden />
            {!printButtonReady
              ? 'Preparing receipt...'
              : confirmingCheckIn
              ? 'Confirming check-in...'
              : isCheckInConfirmed
                ? 'Print Receipt'
                : 'Print Receipt to Confirm Check-in'}
          </button>
          {confirmError && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              {confirmError}
            </div>
          )}
          <div className="space-y-2">
            <div
              className="flex items-center justify-center gap-2 text-sm font-bold text-slate-700"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <Timer size={16} className="text-primary shrink-0" aria-hidden />
              <span>
                Closing in{' '}
                <span className="tabular-nums text-primary">{secondsLeft}</span>s
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Full-screen self-service check-in UI for kiosk displays. */
export function KioskCheckIn() {
  const {
    kioskMode,
    scanValue,
    setScanValue,
    kioskLoading,
    urlCheckInPending,
    kioskResult,
    kioskError,
    showReceipt,
    setShowReceipt,
    scanInputRef,
    resetKioskState,
    handleSelectMode,
    handleKioskSubmit,
    setKioskMode,
    setKioskResult,
    setKioskError,
  } = useKioskCheckIn();

  const receiptClose = () => {
    setShowReceipt(false);
    resetKioskState();
  };

  const modeCards = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 w-full max-w-3xl mx-auto">
      <button
        type="button"
        onClick={() => handleSelectMode('qr')}
        className="min-h-[160px] sm:min-h-[200px] p-6 sm:p-8 rounded-3xl border-2 border-white/20 bg-white/10 backdrop-blur-md hover:bg-white/15 hover:border-primary/60 transition-all flex flex-col items-center justify-center gap-4 text-white shadow-xl"
      >
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg">
          <QrCode size={40} />
        </div>
        <div className="space-y-1 text-center">
          <p className="font-black text-xl sm:text-2xl">Scan QR Code</p>
          <p className="text-sm text-white/80 max-w-xs">Present your ID QR to the scanner.</p>
        </div>
      </button>
      <button
        type="button"
        onClick={() => handleSelectMode('id')}
        className="min-h-[160px] sm:min-h-[200px] p-6 sm:p-8 rounded-3xl border-2 border-white/20 bg-white/10 backdrop-blur-md hover:bg-white/15 hover:border-primary/60 transition-all flex flex-col items-center justify-center gap-4 text-white shadow-xl"
      >
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white text-slate-900 flex items-center justify-center shadow-lg">
          <Keyboard size={38} />
        </div>
        <div className="space-y-1 text-center">
          <p className="font-black text-xl sm:text-2xl">Enter ID</p>
          <p className="text-sm text-white/80 max-w-xs">Type your student or employee ID.</p>
        </div>
      </button>
    </div>
  );

  const formSection = kioskMode && (
    <form
      onSubmit={handleKioskSubmit}
      className="space-y-6 w-full max-w-xl mx-auto pt-2"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold uppercase tracking-[0.2em] text-sm text-white/70">
          {kioskMode === 'qr' ? 'Scan QR Code' : 'Enter ID'}
        </p>
        <button
          type="button"
          onClick={() => {
            setKioskMode(null);
            setKioskResult(null);
            setKioskError(null);
            setScanValue('');
          }}
          className="text-sm font-bold text-emerald-200 hover:text-white min-h-[44px] px-2"
        >
          Change mode
        </button>
      </div>
      <div className="space-y-2">
        <input
          ref={scanInputRef}
          type="text"
          autoFocus
          value={
            kioskMode === 'qr'
              ? getKioskQrInputDisplayValue(scanValue)
              : scanValue
          }
          onChange={(e) =>
            setScanValue(
              kioskMode === 'id'
                ? formatIdInput(e.target.value)
                : normalizeQrScanInput(e.target.value, scanValue)
            )
          }
          className="w-full px-5 py-4 sm:py-5 rounded-2xl border-2 border-white/20 bg-white/95 text-slate-900 text-lg sm:text-xl font-semibold placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-primary/30 focus:border-primary min-h-[56px]"
          placeholder={
            kioskMode === 'qr'
              ? 'Tap here, then scan your QR code…'
              : 'NS-00001 or EM-00001'
          }
        />
        <p className="text-sm text-white/60">
          {kioskMode === 'qr'
            ? 'The scanner types like a keyboard — keep this field focused.'
            : 'Include NS- or EM- when possible for accurate matching.'}
        </p>
      </div>
      <button
        type="submit"
        disabled={kioskLoading || !scanValue.trim()}
        className="w-full py-4 sm:py-5 rounded-2xl bg-primary text-white font-black text-lg sm:text-xl hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed min-h-[56px] shadow-xl shadow-primary/30"
      >
        {kioskLoading ? 'Checking in…' : 'Check in'}
      </button>
    </form>
  );

  const errorBlock = kioskError && (
    <div className="mt-3 border-t border-white/20 pt-3">
      <div className="p-4 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-sm text-amber-50 space-y-1">
        <p className="font-bold">
          {kioskError.code === 'NO_APPOINTMENT_TODAY'
            ? 'No appointment found'
            : ['APPOINTMENT_CANCELLED', 'APPOINTMENT_SKIPPED'].includes(kioskError.code)
              ? 'Appointment cancelled'
              : kioskError.code === 'APPOINTMENT_TOO_EARLY'
                ? 'Too early for check-in'
            : 'Check-in could not be completed'}
        </p>
        <p>{kioskError.message}</p>
      </div>
    </div>
  );

  const inlineResult =
    kioskResult &&
    !showReceipt && <KioskResultBlock kioskResult={kioskResult} tone="dark" />;

  return (
    <>
      {urlCheckInPending && (
        <div
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-4 bg-slate-950/95 text-white px-6"
          role="status"
          aria-live="polite"
        >
          <div className="h-10 w-10 rounded-full border-2 border-white/20 border-t-primary animate-spin" />
          <p className="text-lg font-bold">Checking you in…</p>
          <p className="text-sm text-white/70 text-center max-w-sm">
            Loading your queue and appointment details.
          </p>
        </div>
      )}

      <div className="min-h-[100dvh] flex flex-col relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(10,102,39,0.45),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_100%,rgba(10,102,39,0.25),transparent_50%)]" />
        <div className="absolute inset-0 opacity-[0.07] bg-[linear-gradient(rgba(255,255,255,0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.15)_1px,transparent_1px)] bg-[length:48px_48px]" />

        <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-10 sm:py-14">
          <div className="flex flex-col items-center text-center w-full max-w-4xl mb-10 sm:mb-12">
            <div className="relative mb-8 sm:mb-10">
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(100vw,22rem)] h-[min(100vw,22rem)] rounded-full bg-primary/35 blur-[64px] sm:blur-[80px]"
                aria-hidden
              />
              <div className="relative flex items-center justify-center rounded-[2rem] sm:rounded-[2.5rem] bg-white p-3 sm:p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_25px_80px_-12px_rgba(10,102,39,0.55),0_0_120px_-20px_rgba(10,102,39,0.4)] ring-4 ring-primary/40 ring-offset-4 ring-offset-slate-950">
                <div className="w-32 h-32 sm:w-40 sm:h-40 md:w-44 md:h-44 rounded-2xl sm:rounded-3xl overflow-hidden bg-slate-50 flex items-center justify-center">
                  <img
                    src={logoImg}
                    alt="Eastern Samar State University"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            </div>

            {/* <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.35em] text-emerald-400/95 mb-3 sm:mb-4">
              Self-service
            </p> */}
            <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white leading-[1.08] tracking-tight px-2">
              Eastern Samar State University
            </h1>
            <p className="mt-3 sm:mt-4 text-lg sm:text-2xl md:text-3xl font-black text-white/90 tracking-tight">
              University Infirmary check-in
            </p>
          </div>

          <p className="text-center text-white/80 text-base sm:text-lg max-w-xl mb-8 sm:mb-10 font-medium">
            Scan your QR or enter your ID to join today&apos;s queue and see your appointment.
          </p>

          {!kioskMode ? modeCards : null}
          {formSection}
          {inlineResult}
          {errorBlock}
        </main>

        <footer className="relative z-10 border-t border-white/10 px-4 py-5 sm:px-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-sm text-white/50">
          <span>Need help? Speak with the infirmary front desk.</span>
          {/* <Link
            to="/"
            className="text-white/60 hover:text-white font-bold underline-offset-4 hover:underline min-h-[44px] inline-flex items-center"
          >
            Main website
          </Link> */}
        </footer>
      </div>

      {showReceipt && kioskResult && (
        <ReceiptOverlay kioskResult={kioskResult} onClose={receiptClose} />
      )}
    </>
  );
}
