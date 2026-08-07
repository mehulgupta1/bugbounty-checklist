import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Format seconds as HH:MM:SS.
 */
export function formatTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Format seconds as compact "Xh Ym" string.
 */
export function formatTimeCompact(totalSeconds) {
  if (totalSeconds < 60) return "0m";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/**
 * Timer hook — manages per-category stopwatches.
 * timersData: { [catId]: { elapsed: number, isRunning: boolean, startedAt: number | null } }
 */
export default function useTimer(timersData, onUpdate) {
  const [timers, setTimers] = useState(timersData || {});
  const intervalRef = useRef(null);

  // Sync when external data changes (project switch)
  useEffect(() => {
    setTimers(timersData || {});
  }, [timersData]);

  // Tick every second for running timers
  useEffect(() => {
    const hasRunning = Object.values(timers).some((t) => t.isRunning);
    if (hasRunning) {
      intervalRef.current = setInterval(() => {
        setTimers((prev) => {
          const updated = { ...prev };
          let changed = false;
          for (const [catId, timer] of Object.entries(updated)) {
            if (timer.isRunning && timer.startedAt) {
              const now = Date.now();
              const additionalSeconds = Math.floor((now - timer.startedAt) / 1000);
              if (additionalSeconds > 0) {
                updated[catId] = {
                  ...timer,
                  elapsed: timer.elapsed + additionalSeconds,
                  startedAt: now,
                };
                changed = true;
              }
            }
          }
          return changed ? updated : prev;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [Object.values(timers).some((t) => t.isRunning)]);

  // Save when timers change
  useEffect(() => {
    onUpdate(timers);
  }, [timers]);

  const startTimer = useCallback((catId) => {
    setTimers((prev) => {
      const updated = { ...prev };
      // Pause all other running timers
      for (const [id, timer] of Object.entries(updated)) {
        if (timer.isRunning && id !== catId) {
          const now = Date.now();
          const additional = timer.startedAt ? Math.floor((now - timer.startedAt) / 1000) : 0;
          updated[id] = { ...timer, isRunning: false, elapsed: timer.elapsed + additional, startedAt: null };
        }
      }
      // Start this timer
      const existing = updated[catId] || { elapsed: 0 };
      updated[catId] = { ...existing, isRunning: true, startedAt: Date.now() };
      return updated;
    });
  }, []);

  const pauseTimer = useCallback((catId) => {
    setTimers((prev) => {
      const timer = prev[catId];
      if (!timer || !timer.isRunning) return prev;
      const now = Date.now();
      const additional = timer.startedAt ? Math.floor((now - timer.startedAt) / 1000) : 0;
      return {
        ...prev,
        [catId]: { ...timer, isRunning: false, elapsed: timer.elapsed + additional, startedAt: null },
      };
    });
  }, []);

  const resetTimer = useCallback((catId) => {
    setTimers((prev) => ({
      ...prev,
      [catId]: { elapsed: 0, isRunning: false, startedAt: null },
    }));
  }, []);

  const getElapsed = useCallback((catId) => {
    return timers[catId]?.elapsed || 0;
  }, [timers]);

  const isRunning = useCallback((catId) => {
    return timers[catId]?.isRunning || false;
  }, [timers]);

  return { timers, startTimer, pauseTimer, resetTimer, getElapsed, isRunning };
}
