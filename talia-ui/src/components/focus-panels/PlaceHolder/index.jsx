/**
 * Place Holder — empty dock slot for demos and future reports.
 * The caption and wireframe live on the panel instance via Views.
 */

import React from 'react';
import PlaceHolderPresenter from './PlaceHolderPresenter';

const PlaceHolderContainer = ({ panelInstanceId = null, panelComponentId = null }) => (
  <PlaceHolderPresenter
    panelInstanceId={panelInstanceId}
    panelComponentId={panelComponentId}
  />
);

export default PlaceHolderContainer;
