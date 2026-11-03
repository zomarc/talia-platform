/**
 * Simple management-facing path: this connects to that.
 * Uses networking hops/concerns from instanceConnectionProfile.
 */

import React, { useState } from 'react';
import HoverPreview from '../../shared/HoverPreview';
import { concernForHop, concernToState } from './networkStatus.js';

const FRIENDLY = {
  graphql_process: {
    title: 'This Talia server',
    blurb: 'Where sync and warehouse calls start',
  },
  egress_public: {
    title: 'Public identity',
    blurb: 'The IP remote systems see',
  },
  azure_firewall: {
    title: 'Client firewall',
    blurb: 'Must allow the public identity',
  },
  synapse_sql: {
    title: 'Azure warehouse',
    blurb: 'Source data for sync',
  },
  supabase_kong: {
    title: 'Talia database',
    blurb: 'Application data for this instance',
  },
};

function friendlyFor(hop) {
  const preset = FRIENDLY[hop.id];
  if (preset) return preset;
  return { title: hop.label, blurb: hop.note || 'Network step' };
}

/**
 * Prefer the warehouse path for the diagram; always include Talia DB as the local store.
 * Order: GraphQL → egress → firewall → Synapse → Supabase (if present).
 */
function selectDiagramHops(hops) {
  const byId = new Map((hops || []).map((h) => [h.id, h]));
  const order = ['graphql_process', 'egress_public', 'azure_firewall', 'synapse_sql', 'supabase_kong'];
  const selected = order.map((id) => byId.get(id)).filter(Boolean);
  return selected.length ? selected : (hops || []);
}

export default function NetworkPathDiagram({ networking }) {
  const [tip, setTip] = useState(null);
  if (!networking) return null;

  const hops = selectDiagramHops(networking.hops);
  const concerns = networking.concerns || [];
  if (!hops.length) return null;

  const showTip = (hop, concern, rect) => {
    if (!rect) {
      setTip(null);
      return;
    }
    const friendly = friendlyFor(hop);
    setTip({
      rect,
      title: friendly.title,
      blurb: friendly.blurb,
      address: hop.address,
      note: hop.note,
      concern,
    });
  };

  return (
    <div className="dm-network-diagram" aria-label="Network path diagram">
      <p className="dm-network-diagram__lead">
        How this instance reaches its data — hover a box for detail.
      </p>
      <div className="dm-network-diagram__flow" role="list">
        {hops.map((hop, index) => {
          const friendly = friendlyFor(hop);
          const concern = concernForHop(hop.id, concerns);
          const state = concernToState(concern) || (hop.kind === 'policy' ? 'policy' : 'ok');
          return (
            <React.Fragment key={hop.id}>
              {index > 0 ? (
                <div
                  className={`dm-network-diagram__connector dm-network-diagram__connector--${state === 'blocked' ? 'blocked' : 'ok'}`}
                  aria-hidden="true"
                >
                  <span className="dm-network-diagram__arrow" />
                </div>
              ) : null}
              <button
                type="button"
                role="listitem"
                className={`dm-network-diagram__node dm-network-diagram__node--${state}`}
                aria-label={`${friendly.title}${concern ? `, ${concern.title}` : ''}`}
                onMouseEnter={(event) => showTip(hop, concern, event.currentTarget.getBoundingClientRect())}
                onMouseLeave={() => showTip(null, null, null)}
                onFocus={(event) => showTip(hop, concern, event.currentTarget.getBoundingClientRect())}
                onBlur={() => showTip(null, null, null)}
              >
                <span className="dm-network-diagram__node-title">{friendly.title}</span>
                <span className="dm-network-diagram__node-addr">
                  {hop.address || '—'}
                </span>
                {concern && concern.severity !== 'info' ? (
                  <span className="dm-network-diagram__node-flag">
                    {concern.severity === 'high' ? 'Blocked' : 'Attention'}
                  </span>
                ) : null}
                {concern && concern.severity === 'info' ? (
                  <span className="dm-network-diagram__node-flag dm-network-diagram__node-flag--ok">OK</span>
                ) : null}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      <HoverPreview open={Boolean(tip)} anchorRect={tip?.rect || null} placement="bottom">
        {tip ? (
          <div className="dm-network-diagram__tip">
            <strong>{tip.title}</strong>
            {tip.blurb ? <p>{tip.blurb}</p> : null}
            {tip.address ? <p><code>{tip.address}</code></p> : null}
            {tip.note ? <p>{tip.note}</p> : null}
            {tip.concern ? (
              <p className={`dm-network-diagram__tip-concern dm-network-diagram__tip-concern--${tip.concern.severity}`}>
                {tip.concern.title}: {tip.concern.detail}
              </p>
            ) : null}
          </div>
        ) : null}
      </HoverPreview>
    </div>
  );
}
