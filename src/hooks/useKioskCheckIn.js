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

  const directMatch = text.match(/\b(?:NS-\d{5,}|EM-\d{5,}|\d{2,4}-\d{4,6}|\d{7,8})\b/i);
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

export function normalizeQrScanInput(raw, previousRaw = '') {
  const text = String(raw || '');
  if (!text) return '';

  const extractedId = extractIdFromScanInput(text);
  if (extractedId) return extractedId;

  const previousId = extractIdFromScanInput(previousRaw);
  if (previousId && text.toUpperCase().includes(previousId)) {
    return previousId;
  }

  return text;
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

function buildKioskSubmission(mode, rawValue) {
  const trimmed = String(rawValue || '').trim();
  if (!trimmed) return null;

  if (mode === 'qr') {
    const normalizedId = extractIdFromScanInput(trimmed) || trimmed;
    return {
      normalizedValue: normalizedId,
      dedupeKey: normalizedId,
      payload: { mode: 'qr', payload: normalizedId },
    };
  }

  return {
    normalizedValue: trimmed,
    dedupeKey: trimmed,
    payload: { mode: 'id', id: trimmed },
  };
}

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

  const submitKioskScan = useCallback(
    async (mode, rawValue) => {
      const submission = buildKioskSubmission(mode, rawValue);
      if (!submission) return false;
      if (kioskLoading || kioskSubmitLockRef.current) return false;
      if (mode === 'qr' && lastProcessedScanRef.current === submission.dedupeKey) {
        return false;
      }

      if (qrAutoSubmitTimerRef.current) {
        clearTimeout(qrAutoSubmitTimerRef.current);
      }

      try {
        kioskSubmitLockRef.current = true;
        if (mode === 'qr') {
          lastProcessedScanRef.current = submission.dedupeKey;
          setScanValue(submission.normalizedValue);
        }
        setShowReceipt(false);
        setKioskLoading(true);
        setKioskResult(null);
        setKioskError(null);

        const data = await authService.kioskCheckIn(submission.payload);
        if (mode === 'qr') {
          setScanValue('');
          navigate('/kiosk/appointment', { state: { kioskResult: data } });
          return true;
        }

        setKioskResult(data);
        setShowReceipt(true);
        return true;
      } catch (err) {
        const resp = err?.response?.data;
        const message = resp?.message || 'Failed to check in. Please try again.';
        setKioskError({
          message,
          code: resp?.code || null,
          user: resp?.user || null,
        });
        if (mode === 'qr') {
          lastProcessedScanRef.current = '';
          setScanValue('');
        }
        return false;
      } finally {
        setKioskLoading(false);
        kioskSubmitLockRef.current = false;
      }
    },
    [kioskLoading, navigate],
  );

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
      await submitKioskScan(kioskMode, scanValue);
    },
    [kioskMode, scanValue, submitKioskScan]
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
      submitKioskScan('qr', extractedId);
    }, 120);

    return () => {
      if (qrAutoSubmitTimerRef.current) {
        clearTimeout(qrAutoSubmitTimerRef.current);
      }
    };
  }, [kioskMode, scanValue, kioskLoading, showReceipt, kioskResult, submitKioskScan]);

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
