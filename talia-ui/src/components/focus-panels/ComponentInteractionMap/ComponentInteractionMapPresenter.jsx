/**
 * Component Interaction Map Presenter — UI only.
 *
 * Renders a summary-level view of the main panel-to-panel interactions:
 * for each interaction channel, which panels EMIT it and which RESPOND to it.
 * Canonical channels (Sailing / Ship) are highlighted because they route
 * through inventory_item.reference_sail_code.
 */

import React from 'react';

const Chips = ({ people, emptyLabel }) => {
  if (!people || people.length === 0) {
    return <span className="talia-cim-chip talia-cim-chip--empty">{emptyLabel}</span>;
  }
  return (
    <>
      {people.map((p) => (
        <span key={p.name} className="talia-cim-chip" title={`${p.title} (${p.category})`}>
          {p.title}
        </span>
      ))}
    </>
  );
};

const ChannelLane = ({ channel }) => {
  const canonical = channel.canonical;
  const laneClass = [
    'talia-cim-lane',
    canonical ? 'talia-cim-lane--canonical' : '',
    channel.incomplete ? 'talia-cim-lane--incomplete' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={laneClass}>
      <div className="talia-cim-lane__side talia-cim-lane__side--from">
        <div className="talia-cim-lane__side-label">Emits ({channel.emitters.length})</div>
        <div className="talia-cim-chips">
          <Chips people={channel.emitters} emptyLabel="no emitter yet" />
        </div>
      </div>

      <div className="talia-cim-lane__event">
        <div className="talia-cim-lane__event-name">
          {channel.label}
          {canonical && <span className="talia-cim-badge">canonical</span>}
        </div>
        <div className="talia-cim-lane__arrow" aria-hidden="true">→</div>
        <code className="talia-cim-lane__event-key">{channel.key}.*</code>
        {canonical && (
          <div className="talia-cim-lane__note">via inventory_item.reference_sail_code</div>
        )}
        {channel.incomplete && (
          <div className="talia-cim-lane__gap">
            {channel.emitters.length === 0 ? 'no panel emits this yet' : 'no panel responds yet'}
          </div>
        )}
      </div>

      <div className="talia-cim-lane__side talia-cim-lane__side--to">
        <div className="talia-cim-lane__side-label">Responds ({channel.listeners.length})</div>
        <div className="talia-cim-chips">
          <Chips people={channel.listeners} emptyLabel="no listener yet" />
        </div>
      </div>
    </div>
  );
};

const SidePanels = ({ side }) => (
  <div className="talia-cim-present__panels">
    {side.drivers.length > 0 && (
      <div className="talia-cim-present__group">
        <div className="talia-cim-present__group-label">Drives selection</div>
        <div className="talia-cim-chips">
          {side.drivers.map((p) => (
            <span key={p.name} className="talia-cim-chip talia-cim-chip--driver" title={`${p.title} (${p.category})`}>
              {p.title}
            </span>
          ))}
        </div>
      </div>
    )}
    <div className="talia-cim-present__group">
      <div className="talia-cim-present__group-label">
        Reacts{side.responderCount ? ` (${side.responderCount})` : ''}
      </div>
      {side.responders.length === 0 ? (
        <span className="talia-cim-chip talia-cim-chip--empty">—</span>
      ) : side.responderCount > 6 ? (
        <div className="talia-cim-chips">
          {side.responderCategories.map((c) => (
            <span key={c.category} className="talia-cim-chip">
              {c.category} <strong>×{c.count}</strong>
            </span>
          ))}
        </div>
      ) : (
        <div className="talia-cim-chips">
          {side.responders.map((p) => (
            <span key={p.name} className="talia-cim-chip" title={`${p.title} (${p.category})`}>
              {p.title}
            </span>
          ))}
        </div>
      )}
    </div>
  </div>
);

const PresentationView = ({ presentation }) => {
  const { physical, selling, hub } = presentation;
  return (
    <div className="talia-cim-present">
      <div className="talia-cim-present__stage">
        <section className="talia-cim-present__zone talia-cim-present__zone--physical">
          <h3 className="talia-cim-present__zone-title">{physical.title}</h3>
          <p className="talia-cim-present__zone-sub">{physical.subtitle}</p>
          <div className="talia-cim-present__filter">filters by <code>{physical.filterBy}</code></div>
          <SidePanels side={physical} />
        </section>

        <div className="talia-cim-present__flow" aria-hidden="true">
          <span className="talia-cim-present__arrow">→</span>
          <span className="talia-cim-present__arrow talia-cim-present__arrow--back">←</span>
        </div>

        <section className="talia-cim-present__zone talia-cim-present__zone--hub">
          <div className="talia-cim-present__hub-badge">canonical</div>
          <h3 className="talia-cim-present__zone-title">{hub.table}</h3>
          <code className="talia-cim-present__hub-key">{hub.key}</code>
          <p className="talia-cim-present__zone-sub">{hub.note}</p>
        </section>

        <div className="talia-cim-present__flow" aria-hidden="true">
          <span className="talia-cim-present__arrow talia-cim-present__arrow--back">←</span>
          <span className="talia-cim-present__arrow">→</span>
        </div>

        <section className="talia-cim-present__zone talia-cim-present__zone--selling">
          <h3 className="talia-cim-present__zone-title">{selling.title}</h3>
          <p className="talia-cim-present__zone-sub">{selling.subtitle}</p>
          <div className="talia-cim-present__filter">filters by <code>{selling.filterBy}</code></div>
          <SidePanels side={selling} />
        </section>
      </div>

      <p className="talia-cim-present__takeaway">
        One canonical layer. A selection anywhere is translated through{' '}
        <code>inventory_item.reference_sail_code</code> <em>at emit time</em>, so every
        panel — physical or selling — reacts with the full, consistent context.
      </p>
    </div>
  );
};

const CatalogCard = ({ item }) => (
  <div className={`talia-cim-cat__card${item.canonical ? ' talia-cim-cat__card--canonical' : ''}`}>
    <div className="talia-cim-cat__card-head">
      <span className="talia-cim-cat__card-title" title={item.name}>{item.title}</span>
      <span className="talia-cim-cat__card-flags">
        {item.flags.mock && <span className="talia-cim-tag talia-cim-tag--mock" title="Uses mock data">mock</span>}
        {item.flags.legacy && <span className="talia-cim-tag talia-cim-tag--legacy" title="Legacy component">legacy</span>}
        {item.flags.restricted && <span className="talia-cim-tag talia-cim-tag--role" title={`Restricted: ${item.flags.roles.join(', ')}`}>admin</span>}
      </span>
    </div>
    {item.description && <p className="talia-cim-cat__card-desc">{item.description}</p>}
    <div className="talia-cim-cat__card-events">
      <span className="talia-cim-cat__io" title={item.emits.map((c) => c.label).join(', ') || 'emits nothing'}>
        ▲ {item.emits.length ? item.emits.map((c) => c.label).join(', ') : '—'}
      </span>
      <span className="talia-cim-cat__io" title={item.responds.map((c) => c.label).join(', ') || 'responds to nothing'}>
        ▼ {item.responds.length ? item.responds.map((c) => c.label).join(', ') : '—'}
      </span>
    </div>
  </div>
);

const CatalogView = ({ catalog }) => {
  const groups = catalog?.groups || [];
  const summary = catalog?.summary || {};
  return (
    <div className="talia-cim-cat">
      <div className="talia-cim-summary">
        <span className="talia-cim-stat"><strong>{summary.total ?? 0}</strong> components</span>
        <span className="talia-cim-stat"><strong>{summary.categories ?? 0}</strong> categories</span>
        <span className="talia-cim-stat"><strong>{summary.emitting ?? 0}</strong> emit</span>
        <span className="talia-cim-stat"><strong>{summary.responding ?? 0}</strong> respond</span>
        <span className="talia-cim-stat"><strong>{summary.canonical ?? 0}</strong> canonical</span>
        <span className="talia-cim-stat"><strong>{summary.isolated ?? 0}</strong> standalone</span>
      </div>
      <p className="talia-cim-intro">
        Every registered panel, grouped by category. <span className="talia-cim-cat__legend">▲ emits · ▼ responds to</span>
      </p>
      {groups.map((group) => (
        <section key={group.category} className="talia-cim-cat__group">
          <h3 className="talia-cim-cat__group-title">
            {group.category} <span className="talia-cim-cat__group-count">{group.count}</span>
          </h3>
          <div className="talia-cim-cat__grid">
            {group.items.map((item) => (
              <CatalogCard key={item.name} item={item} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

const ComponentInteractionMapPresenter = ({
  model,
  presentation,
  catalog,
  mode = 'presentation',
  onModeChange,
  onRefresh,
}) => {
  const channels = model?.channels || [];
  const summary = model?.summary || {};
  const isPresentation = mode === 'presentation';
  const isCatalog = mode === 'catalog';
  const isDetailed = mode === 'detailed';

  return (
    <div className="talia-report" role="region" aria-label="Component interaction map">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Component Interaction Map</h2>
          <p className="talia-report__subtitle">
            {isPresentation && 'The big picture: how physical and selling meet at inventory_item'}
            {isDetailed && 'Main panel-to-panel interactions, derived from the component registry'}
            {isCatalog && 'Global catalog of every registered component'}
          </p>
        </div>
      </header>

      <div className="talia-report__controls" aria-label="Component interaction map controls">
        <div className="talia-cim-modes" role="group" aria-label="View mode">
          <button
            type="button"
            className={`talia-btn ${isPresentation ? 'talia-btn--primary' : 'talia-btn--secondary'}`}
            aria-pressed={isPresentation}
            onClick={() => onModeChange?.('presentation')}
          >
            Presentation
          </button>
          <button
            type="button"
            className={`talia-btn ${isDetailed ? 'talia-btn--primary' : 'talia-btn--secondary'}`}
            aria-pressed={isDetailed}
            onClick={() => onModeChange?.('detailed')}
          >
            Detailed
          </button>
          <button
            type="button"
            className={`talia-btn ${isCatalog ? 'talia-btn--primary' : 'talia-btn--secondary'}`}
            aria-pressed={isCatalog}
            onClick={() => onModeChange?.('catalog')}
          >
            All components
          </button>
        </div>
      </div>

      {onRefresh ? (
        <div className="talia-report__actions-bar" aria-label="Component interaction map actions">
          <button type="button" className="talia-btn talia-btn--secondary" onClick={onRefresh}>
            Refresh
          </button>
        </div>
      ) : null}

      {isPresentation && presentation ? (
        <main className="talia-report__content talia-cim">
          <PresentationView presentation={presentation} />
        </main>
      ) : isCatalog ? (
        <main className="talia-report__content talia-cim">
          <CatalogView catalog={catalog} />
        </main>
      ) : (
      <main className="talia-report__content talia-cim">
        <div className="talia-cim-summary">
          <span className="talia-cim-stat">
            <strong>{summary.mainChannels ?? channels.length}</strong> interaction channels
          </span>
          <span className="talia-cim-stat">
            <strong>{summary.canonicalChannels ?? 0}</strong> canonical (via inventory_item)
          </span>
          <span className="talia-cim-stat">
            <strong>{summary.participatingPanels ?? 0}</strong>/{summary.totalPanels ?? 0} panels linked
          </span>
        </div>

        <p className="talia-cim-intro">
          Talia separates the <strong>physical</strong> world (ships, berths, days) from the{' '}
          <strong>selling</strong> structure (master sailings, segments, bookings). The two meet
          through <code>inventory_item</code>. Selections are translated to a canonical scope
          <em> at emit time</em>, so every listener receives the full physical + selling context.
        </p>

        <div className="talia-cim-lanes">
          {channels.map((channel) => (
            <ChannelLane key={channel.key} channel={channel} />
          ))}
        </div>

        <p className="talia-cim-footnote">
          Reference: <code>docs/CANONICAL-SELECTION-LINKING.md</code>. Emitters send via{' '}
          <code>emitSailSelect</code> / <code>emitShipSelect</code>; listeners read{' '}
          <code>canonical_scope</code> from the event.
        </p>
      </main>
      )}
    </div>
  );
};

export default ComponentInteractionMapPresenter;
