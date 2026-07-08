/**
 * Component Interaction Map Container.
 *
 * Data mapping/state only. The "data" is the component registry itself, so we
 * derive the interaction model from it (no network fetch). Renders the presenter.
 */

import React, { useMemo, useState, useCallback } from 'react';
import componentRegistry from '../registry';
import { buildInteractionModel, buildPresentationModel, buildComponentCatalog } from './componentInteractionsTransform';
import ComponentInteractionMapPresenter from './ComponentInteractionMapPresenter';

const ComponentInteractionMapContainer = () => {
  // Registry is static at runtime; a nonce lets the Refresh button force a rebuild.
  const [nonce, setNonce] = useState(0);
  const [mode, setMode] = useState('presentation');

  const model = useMemo(
    () => buildInteractionModel(componentRegistry),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nonce]
  );

  const presentation = useMemo(
    () => buildPresentationModel(componentRegistry),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nonce]
  );

  const catalog = useMemo(
    () => buildComponentCatalog(componentRegistry),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nonce]
  );

  const handleRefresh = useCallback(() => setNonce((n) => n + 1), []);

  return (
    <ComponentInteractionMapPresenter
      model={model}
      presentation={presentation}
      catalog={catalog}
      mode={mode}
      onModeChange={setMode}
      onRefresh={handleRefresh}
    />
  );
};

export default ComponentInteractionMapContainer;
