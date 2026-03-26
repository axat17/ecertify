import { useState, useEffect, useRef, useCallback } from 'react';

// ─── useToast ─────────────────────────────────────────────────────────────────

interface Toast {
  id: number;
  message: string;
  color?: string;
}

let toastId = 0;
let _setToasts: React.Dispatch<React.SetStateAction<Toast[]>> | null = null;

/** Call from anywhere — no context needed */
export function showToast(message: string, color = '#d0271d') {
  if (!_setToasts) return;
  const id = ++toastId;
  _setToasts(prev => [...prev, { id, message, color }]);
  setTimeout(() => _setToasts!(prev => prev.filter(t => t.id !== id)), 3400);
}

export function useToastProvider() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => { _setToasts = setToasts; return () => { _setToasts = null; }; }, []);
  return toasts;
}

// ─── useClipboard ─────────────────────────────────────────────────────────────

export function useClipboard() {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Fallback for older browsers
      const el = document.createElement('textarea');
      el.value = text; document.body.appendChild(el); el.select();
      document.execCommand('copy'); document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);
  return { copy, copied };
}

// ─── useDebounce ──────────────────────────────────────────────────────────────

export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

// ─── usePoll ──────────────────────────────────────────────────────────────────
// Calls fn() every intervalMs while enabled. Useful for live session counters.

export function usePoll(fn: () => void, intervalMs: number, enabled = true) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => fnRef.current(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}

// ─── useTimer ─────────────────────────────────────────────────────────────────
// Returns live elapsed seconds from a start timestamp string/Date.

export function useTimer(startedAt: string | Date | null | undefined, running = true): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startedAt || !running) return;
    const start = new Date(startedAt).getTime();
    setElapsed(Math.floor((Date.now() - start) / 1000));
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startedAt, running]);
  return elapsed;
}

// ─── useLocalStorage ─────────────────────────────────────────────────────────

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [stored, setStored] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch { return initialValue; }
  });
  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStored(prev => {
      const next = typeof value === 'function' ? (value as (p: T) => T)(prev) : value;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [key]);
  return [stored, setValue] as const;
}
