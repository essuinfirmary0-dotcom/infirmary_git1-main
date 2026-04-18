import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../services/authService';

export function formatIdInput(raw) {
  return raw.toUpperCase().trimStart();
}

/** Decode checkIn=… from query string (handles NS%2D123-style encoding). */
function extractIdFromCheckInQueryParam(text) {
  const m = String(text).match(/[?&]checkIn=([^&\s#]+)/i);
  if (!m?.[1]) return null;
  let decoded = m[1];
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // keep as-is
  }
  return decoded.trim() || null;
}

function extractIdFromKioskUrl(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  let toParse = s;
  if (!/^https?:\/\//i.test(s)) {
    if (
      /^www\./i.test(s) ||
      /[?&]checkIn=/i.test(s) ||
      /^[\w.-]+\.[a-z]{2,}\//i.test(s)
    ) {
      toParse = `https://${s.replace(/^\/+/, '')}`;
    } else {
      return null;
    }
  }
  try {
    const u = new URL(toParse);
    const checkIn = u.searchParams.get('checkIn');
    if (checkIn && typeof checkIn === 'string') {
      const t = checkIn.trim();
      if (t) return t.toUpperCase();
    }
  } catch {
    return null;
  }
  return null;
}

/** True when the field likely holds a URL / kiosk link rather than a raw ID. */
export function looksLikeKioskLinkOrUrl(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (/^https?:\/\//i.test(t)) return true;
  if (/^www\./i.test(t)) return true;
  if (/[?&]checkIn=/i.test(t)) return true;
  if (/\.[a-z]{2,}\//i.test(t)) return true;
  return false;
}

export function extractIdFromScanInput(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;

  const directMatch = text.match(/\b(?:NS-\d+|EM-\d+|\d{2}-\d+)\b/i);
  if (directMatch?.[0]) return directMatch[0].toUpperCase();

  const checkInRaw = extractIdFromCheckInQueryParam(text);
  if (checkInRaw && checkInRaw !== text) {
    const fromParam = extractIdFromScanInput(checkInRaw);
    if (fromParam) return fromParam;
  }

  const fromUrl = extractIdFromKioskUrl(text);
  if (fromUrl) return fromUrl;

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      const candidate =
        parsed.studentNumber ||
        parsed.student_number ||
        parsed.employeeNumber ||
        parsed.employee_number ||
        null;
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim().toUpperCase();
      }
    }
  } catch {
    // ignore
  }

  return null;
}

/** What to show in the QR input: extracted ID, or hide JSON blobs until parseable. */
export function getKioskQrInputDisplayValue(raw) {
  const text = String(raw || '');
  const id = extractIdFromScanInput(text);
  if (id) return id;
  const t = text.trim();
  if (t.startsWith('{')) return '';
  if (looksLikeKioskLinkOrUrl(t)) return '';
  return text;
}

let kioskUrlCheckInDedupeAt = 0;
let kioskUrlCheckInDedupeId = '';

export function useKioskCheckIn() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const checkInParam = searchParams.get('checkIn');
  const [urlCheckInPending, setUrlCheckInPending] = useState(false);
  const [kioskMode, setKioskMode] = useState(null);
  const [scanValue, setScanValue] = useState('');
  const [kioskLoading, setKioskLoading] = useState(false);
  const [kioskResult, setKioskResult] = useState(null);
  const [kioskError, setKioskError] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const scanInputRef = useRef(null);
  const kioskSubmitLockRef = useRef(false);
  const lastProcessedScanRef = useRef('');
  const qrAutoSubmitTimerRef = useRef(null);

  const resetKioskState = useCallback(() => {
    setKioskMode(null);
    setScanValue('');
    setKioskLoading(false);
    setKioskResult(null);
    setKioskError(null);
    setShowReceipt(false);
    kioskSubmitLockRef.current = false;
    lastProcessedScanRef.current = '';
  }, []);

  const handleSelectMode = useCallback((mode) => {
    setKioskMode(mode);
    setScanValue('');
    setKioskResult(null);
    setKioskError(null);
    kioskSubmitLockRef.current = false;
    lastProcessedScanRef.current = '';
    setShowReceipt(false);
    setTimeout(() => {
      scanInputRef.current?.focus();
    }, 0);
  }, []);

  const handleKioskSubmit = useCallback(
    async (e) => {
      e?.preventDefault?.();
      if (!kioskMode) return;
      if (kioskLoading || kioskSubmitLockRef.current) return;
      const trimmed = scanValue.trim();
      if (!trimmed) return;
      if (kioskMode === 'qr' && lastProcessedScanRef.current === trimmed) return;
      try {
        kioskSubmitLockRef.current = true;
        if (kioskMode === 'qr') lastProcessedScanRef.current = trimmed;
        setShowReceipt(false);
        setKioskLoading(true);
        setKioskResult(null);
        setKioskError(null);
        const payload =
          kioskMode === 'qr'
            ? { mode: 'qr', payload: trimmed }
            : { mode: 'id', id: trimmed };
        const data = await authService.kioskCheckIn(payload);
        if (kioskMode === 'qr') {
          setScanValue('');
          navigate('/kiosk/appointment', { state: { kioskResult: data } });
          return;
        }
        setKioskResult(data);
        setShowReceipt(true);
      } catch (err) {
        const resp = err?.response?.data;
        const message = resp?.message || 'Failed to check in. Please try again.';
        setKioskError({
          message,
          code: resp?.code || null,
          user: resp?.user || null,
        });
        if (kioskMode === 'qr') {
          lastProcessedScanRef.current = '';
          setScanValue('');
        }
      } finally {
        setKioskLoading(false);
        kioskSubmitLockRef.current = false;
      }
    },
    [kioskMode, kioskLoading, scanValue, navigate]
  );

  useEffect(() => {
    return () => {
      if (qrAutoSubmitTimerRef.current) {
        clearTimeout(qrAutoSubmitTimerRef.current);
      }
    };
  }, []);

  /** Opened from phone: /kiosk?checkIn=NS-… — run check-in and go to appointment details. */
  useEffect(() => {
    const checkIn = checkInParam?.trim();
    if (!checkIn) return;

    const now = Date.now();
    if (
      kioskUrlCheckInDedupeId === checkIn &&
      now - kioskUrlCheckInDedupeAt < 800
    ) {
      setSearchParams({}, { replace: true });
      return;
    }
    kioskUrlCheckInDedupeId = checkIn;
    kioskUrlCheckInDedupeAt = now;

    setUrlCheckInPending(true);
    setSearchParams({}, { replace: true });

    (async () => {
      try {
        setKioskLoading(true);
        setKioskError(null);
        const data = await authService.kioskCheckIn({
          mode: 'qr',
          payload: checkIn,
        });
        navigate('/kiosk/appointment', { state: { kioskResult: data } });
      } catch (err) {
        const resp = err?.response?.data;
        const message =
          resp?.message || 'Failed to check in. Please try again.';
        setKioskError({
          message,
          code: resp?.code || null,
          user: resp?.user || null,
        });
      } finally {
        setKioskLoading(false);
        setUrlCheckInPending(false);
      }
    })();
  }, [checkInParam, setSearchParams, navigate]);

  useEffect(() => {
    if (kioskMode !== 'qr') return;
    if (kioskLoading || kioskSubmitLockRef.current) return;
    if (showReceipt || kioskResult) return;
    const trimmed = scanValue.trim();
    if (!trimmed) return;

    const extractedId = extractIdFromScanInput(trimmed);
    if (!extractedId) return;
    if (lastProcessedScanRef.current === extractedId) return;

    if (qrAutoSubmitTimerRef.current) {
      clearTimeout(qrAutoSubmitTimerRef.current);
    }
    qrAutoSubmitTimerRef.current = setTimeout(() => {
      if (kioskSubmitLockRef.current) return;
      if (lastProcessedScanRef.current === extractedId) return;

      (async () => {
        kioskSubmitLockRef.current = true;
        lastProcessedScanRef.current = extractedId;
        try {
          setShowReceipt(false);
          setKioskLoading(true);
          setKioskResult(null);
          setKioskError(null);
          const payload = { mode: 'qr', payload: extractedId };
          const data = await authService.kioskCheckIn(payload);
          setScanValue('');
          navigate('/kiosk/appointment', { state: { kioskResult: data } });
        } catch (err) {
          const resp = err?.response?.data;
          const message = resp?.message || 'Failed to check in. Please try again.';
          setKioskError({
            message,
            code: resp?.code || null,
            user: resp?.user || null,
          });
          lastProcessedScanRef.current = '';
        } finally {
          setKioskLoading(false);
          kioskSubmitLockRef.current = false;
          setScanValue('');
        }
      })();
    }, 120);

    return () => {
      if (qrAutoSubmitTimerRef.current) {
        clearTimeout(qrAutoSubmitTimerRef.current);
      }
    };
  }, [kioskMode, scanValue, kioskLoading, showReceipt, kioskResult, navigate]);

  return {
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
  };
}
