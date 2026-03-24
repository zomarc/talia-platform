import React from 'react';

/**
 * Short, consistent copy so REAL vs TARGET vs MODEL vs overlay panels are obvious.
 * @param {'REAL'|'REAL_SIMPLE'|'TARGET'|'COMBINED'|'MODEL'|'LEGACY_CHART'} variant
 */
const COPY = {
  REAL: {
    tag: 'Goal ① — REAL',
    body: 'Trends and KPIs from live booking/reservation data. Use Profile Tools → “Real profile + YoY” for year-over-year on the same chart.',
  },
  REAL_SIMPLE: {
    tag: 'Goal ① — REAL (diagnostic)',
    body: 'Weeks-to-sail build curve from booking data only — for checking REAL series in isolation.',
  },
  TARGET: {
    tag: 'Goal ② — TARGET',
    body: 'Imported business targets (Data Management → booking_targets_supplied). Read-only here; edit the source file/import, not this chart.',
  },
  COMBINED: {
    tag: 'Overlay — REAL + TARGET + BUDGET + MODEL',
    body: 'Compare streams on one axis. TARGET = imported; MODEL = Talia curve stored on the inventory item; BUDGET when present.',
  },
  MODEL: {
    tag: 'Goal ③ — MODEL (Talia)',
    body:
      'REAL / TARGET / BUDGET / MODEL intelligence is system-owned (profile scope system, owner talia), not tied to a single human user. Everyone can view; Manager+ or Super User can drag points, edit the table, and save. Saves are audit-stamped.',
  },
  LEGACY_CHART: {
    tag: 'Configurable target vs booking chart',
    body: 'Explore metrics and legacy target profiles here. For inventory-backed MODEL editing (drag points, persisted curve), use “Booking Target Profile Editor (Simple)” under Profile Tools.',
  },
};

export default function BookingGoalCallout({ variant = 'REAL', includeComparison = false, className = '' }) {
  const c = COPY[variant] || COPY.REAL;
  return (
    <div className={`booking-goal-callout talia-callout ${className}`.trim()} role="note">
      <span className="booking-goal-callout__tag">{c.tag}</span>
      <p className="booking-goal-callout__body">{c.body}</p>
      {includeComparison && variant === 'REAL' && (
        <p className="booking-goal-callout__extra">
          Year-over-year is enabled for this panel (prior sail is auto-derived unless you pass <code>previousYearSailCode</code>).
        </p>
      )}
    </div>
  );
}
