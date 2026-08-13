/**
 * Profile Aggregations — ship×month or DOW×duration coverage.
 */

import React, { useEffect, useState } from 'react';
import profileCompareService from '../../../services/data/profileCompareService';
import { REPORT_REFRESH_EVENT } from '../../dockview/eventConstants';
import useReportPanelLoading from '../../../hooks/useReportPanelLoading';
import LoadingSpinner from '../../shared/LoadingSpinner';
import ErrorMessage from '../../shared/ErrorMessage';

const ProfileAggregationsContainer = ({
  panelInstanceId,
  panelComponentId,
}) => {
  const [groupBy, setGroupBy] = useState('ship_month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [backfillResult, setBackfillResult] = useState(null);

  useReportPanelLoading(
    panelInstanceId,
    panelComponentId || 'profile-aggregations',
    loading || backfillBusy
  );

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await profileCompareService.fetchAggregations({ groupBy });
      setData(result);
    } catch (err) {
      setError(err);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [groupBy]);

  useEffect(() => {
    const onRefresh = (e) => {
      const detail = e?.detail || {};
      if (detail.panelInstanceId && panelInstanceId && detail.panelInstanceId !== panelInstanceId) {
        return;
      }
      load();
    };
    window.addEventListener(REPORT_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(REPORT_REFRESH_EVENT, onRefresh);
  }, [groupBy, panelInstanceId]);

  const handleBackfill = async () => {
    setBackfillBusy(true);
    setError(null);
    try {
      const result = await profileCompareService.backfillTargetProfiles({
        fromDate: '2026-06-01',
      });
      setBackfillResult(result);
      window.dispatchEvent(new CustomEvent(REPORT_REFRESH_EVENT, { detail: {} }));
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setBackfillBusy(false);
    }
  };

  if (loading && !data) {
    return <LoadingSpinner message="Loading profile aggregations..." fullScreen={false} />;
  }

  if (error && !data) {
    return (
      <ErrorMessage
        title="Failed to load aggregations"
        message={error.message || String(error)}
        onRetry={load}
      />
    );
  }

  const rows = data?.rows || [];

  return (
    <div
      className="focus-panel talia-report profile-aggregations"
      role="region"
      aria-label="Profile Aggregations"
    >
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Profile Aggregations</h2>
          <p className="talia-report__subtitle">
            Coverage of active targets and model maps (read-only)
          </p>
        </div>
      </header>

      <div className="talia-report-filters" aria-label="Aggregation filters">
        <label className="talia-report-filters__group">
          <span className="talia-report-filters__label">Group by</span>
          <select
            className="talia-report-filters__input"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
          >
            <option value="ship_month">Ship × month</option>
            <option value="dow_duration">DOW × duration</option>
          </select>
        </label>
      </div>

      {data?.message || backfillResult?.message ? (
        <div className="talia-callout" role="note">
          {backfillResult?.message || data.message}
        </div>
      ) : (
        <div className="talia-callout" role="note">
          Counts of master sails with an active target or manual model map. Backfill creates
          suggested targets from June 2026 (Manager+).
        </div>
      )}

      <div className="talia-report__actions-bar" aria-label="Aggregation actions">
        <button type="button" className="talia-btn talia-btn--secondary" onClick={load}>
          Refresh
        </button>
        <button
          type="button"
          className="talia-btn talia-btn--secondary"
          disabled={backfillBusy}
          onClick={handleBackfill}
        >
          {backfillBusy ? 'Backfilling…' : 'Backfill from Jun 2026'}
        </button>
      </div>

      <main className="talia-report__content">
        <table className="talia-report-table">
          <thead>
            <tr>
              <th>Bucket</th>
              <th>Sails</th>
              <th>Active target</th>
              <th>Manual model</th>
              <th>Lazy model</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.dimensionKey}>
                <td>{r.dimensionLabel}</td>
                <td>{r.sailCount}</td>
                <td>{r.withActiveTarget}</td>
                <td>{r.withManualModel}</td>
                <td>{r.withLazyModel}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={5}>No rows</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </main>
    </div>
  );
};

export default ProfileAggregationsContainer;
