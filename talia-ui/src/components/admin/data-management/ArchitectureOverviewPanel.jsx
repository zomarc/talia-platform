/**
 * Data Management → Architecture.
 * Overview (Details off): simple layered board.
 * Details on: full Mermaid connectivity + structured path sections.
 * Diagram uses framework SubpanelExpandButton to maximize within the panel.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { trackedFetchGraphql } from '../../../services/data/trackedGraphql';
import { useSubpanelExpansion } from '../../../hooks/useSubpanelExpansion';
import SubpanelExpandButton from '../../shared/SubpanelExpandButton.jsx';
import { INSTANCE_PROFILE_QUERY } from './instanceConnectionQuery.js';
import { buildArchitectureDetailsMermaid } from './architectureMermaid.js';
import ArchitectureOverviewDiagram from './ArchitectureOverviewDiagram.jsx';
import ArchitectureDetailedDiagram from './ArchitectureDetailedDiagram.jsx';
import ArchitectureMermaidFrame from './ArchitectureMermaidFrame.jsx';

export default function ArchitectureOverviewPanel({
  formatDateTime,
  showDetails = false,
  diagramHostRef = null,
  onExportSnapshot = null,
}) {
  const [profile, setProfile] = useState(null);
  const [integrationSettings, setIntegrationSettings] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const localDiagramRef = useRef(null);
  const diagramRef = diagramHostRef || localDiagramRef;
  const { expandedKey, toggleExpandedKey } = useSubpanelExpansion(null);
  const diagramExpanded = expandedKey === 'diagram';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await trackedFetchGraphql({
        query: INSTANCE_PROFILE_QUERY,
        component: 'ArchitectureOverviewPanel',
        purpose: 'Load architecture overview status',
        tableName: 'instance_connection_profile',
      });
      setProfile(data?.instanceConnectionProfile || null);
      setIntegrationSettings(data?.integrationSettings || null);
    } catch (e) {
      setError(e.message || 'Failed to load architecture overview');
      setProfile(null);
      setIntegrationSettings(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!showDetails && diagramExpanded) {
      toggleExpandedKey('diagram');
    }
  }, [showDetails, diagramExpanded, toggleExpandedKey]);

  // Expose latest profile snapshot for parent PDF export (ref + callback).
  useEffect(() => {
    if (diagramRef) {
      diagramRef.currentProfile = profile;
      diagramRef.currentNetworking = profile?.networking || null;
      diagramRef.currentIntegration = integrationSettings;
    }
    if (typeof onExportSnapshot === 'function') {
      onExportSnapshot({
        profile,
        networking: profile?.networking || null,
        integrationSettings,
      });
    }
  }, [diagramRef, profile, integrationSettings, onExportSnapshot]);

  const networking = profile?.networking || null;
  const collectedLabel = profile?.collectedAt && formatDateTime
    ? formatDateTime(profile.collectedAt)
    : (profile?.collectedAt || null);
  const detailsMermaid = profile
    ? buildArchitectureDetailsMermaid({
      profile,
      networking,
      integrationSettings,
    })
    : '';

  return (
    <div
      className={[
        'dm-arch-overview',
        showDetails ? 'dm-arch-overview--details' : '',
        diagramExpanded ? 'dm-arch-overview--diagram-expanded' : '',
      ].filter(Boolean).join(' ')}
    >
      {!diagramExpanded ? (
        <header className="talia-report__header dm-section-header">
          <div className="talia-report__header-left">
            <h3 className="talia-report__title dm-section-header__title">
              {showDetails ? 'Architecture details' : 'Architecture overview'}
            </h3>
            <span className="talia-report__subtitle dm-section-header__subtitle">
              {showDetails
                ? 'End-to-end connectivity with live status'
                : 'Workspace, application, databases, and path to the client warehouse'}
              {collectedLabel ? ` · Snapshot ${collectedLabel}` : ''}
            </span>
          </div>
          <div className="talia-report__actions-bar dm-arch-overview__actions">
            <button
              type="button"
              className="admin-button admin-button--secondary"
              onClick={load}
              disabled={loading}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </header>
      ) : null}

      {error && (
        <div className="dm-instance-profile__error" role="alert">
          {error}
        </div>
      )}

      {loading && !profile && !error && (
        <p className="dm-instance-profile__loading">Loading architecture overview…</p>
      )}

      {profile && !showDetails && (
        <>
          <ArchitectureOverviewDiagram
            profile={profile}
            networking={networking}
            integrationSettings={integrationSettings}
          />
          <p className="dm-arch-overview__details-hint talia-callout" role="note">
            Turn on <strong>Views → Details</strong> for the full architecture diagram.
            Double-click any box to open copyable details.
          </p>
        </>
      )}

      {profile && showDetails && (
        <div className="dm-arch-overview__details-mode">
          <section
            className={[
              'talia-card',
              'talia-card--expandable',
              'dm-arch-diagram-card',
              diagramExpanded ? 'talia-card--expanded' : '',
            ].filter(Boolean).join(' ')}
            aria-label="Full architecture diagram"
          >
            <div className="talia-card__header dm-arch-diagram-card__header">
              <div>
                <h4 className="talia-card__title">System architecture</h4>
                <p className="dm-arch-diagram-card__subtitle">
                  Blocked nodes are red-tinted. Expand for a full-panel view.
                </p>
              </div>
              <SubpanelExpandButton
                className="talia-card__expand-toggle"
                expanded={diagramExpanded}
                label="architecture diagram"
                onToggle={() => toggleExpandedKey('diagram')}
              />
            </div>
            <div className="talia-card__content dm-arch-diagram-card__content">
              <ArchitectureMermaidFrame
                source={detailsMermaid}
                diagramRef={diagramRef}
                maximized={diagramExpanded}
              />
            </div>
          </section>

          {!diagramExpanded ? (
            <ArchitectureDetailedDiagram
              profile={profile}
              networking={networking}
              integrationSettings={integrationSettings}
              hideMermaid
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
