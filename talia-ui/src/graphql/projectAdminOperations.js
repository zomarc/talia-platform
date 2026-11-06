export const RISK_REGISTER_ITEMS_QUERY = `
  query RiskRegisterItems {
    riskRegisterItems {
      id
      referenceCode
      title
      statement
      category
      likelihood
      impact
      residualLikelihood
      residualImpact
      proximity
      status
      response
      treatment
      owner
      reviewOn
      sortOrder
      links { targetKind targetId label }
      createdAt
      updatedAt
    }
  }
`;

export const UPSERT_RISK_REGISTER_ITEM_MUTATION = `
  mutation UpsertRiskRegisterItem($input: RiskRegisterItemInput!) {
    upsertRiskRegisterItem(input: $input) {
      id
      referenceCode
      title
      links { targetKind targetId label }
    }
  }
`;

export const DELETE_RISK_REGISTER_ITEM_MUTATION = `
  mutation DeleteRiskRegisterItem($id: ID!) {
    deleteRiskRegisterItem(id: $id)
  }
`;

export const PROJECT_DOCUMENTS_QUERY = `
  query ProjectDocuments {
    projectDocuments {
      id
      referenceCode
      title
      body
      isStarred
      links { targetKind targetId label }
      assets { id filename mimeType byteSize }
      createdAt
      updatedAt
    }
  }
`;

export const PROJECT_DOCUMENTS_FOR_QUERY = `
  query ProjectDocumentsFor($targetKind: String!, $targetId: ID!) {
    projectDocumentsFor(targetKind: $targetKind, targetId: $targetId) {
      id
      referenceCode
      title
      isStarred
    }
  }
`;

export const PROJECT_DOCUMENT_ASSETS_QUERY = `
  query ProjectDocumentAssets($ids: [ID!]!) {
    projectDocumentAssets(ids: $ids) {
      id
      mimeType
      contentBase64
    }
  }
`;

export const UPSERT_PROJECT_DOCUMENT_MUTATION = `
  mutation UpsertProjectDocument($input: ProjectDocumentInput!) {
    upsertProjectDocument(input: $input) {
      id
      referenceCode
      title
      body
      isStarred
      links { targetKind targetId label }
      assets { id filename mimeType byteSize }
    }
  }
`;

export const DELETE_PROJECT_DOCUMENT_MUTATION = `
  mutation DeleteProjectDocument($id: ID!) {
    deleteProjectDocument(id: $id)
  }
`;

export const ADD_PROJECT_DOCUMENT_ASSET_MUTATION = `
  mutation AddProjectDocumentAsset($documentId: ID!, $filename: String, $mimeType: String!, $contentBase64: String!) {
    addProjectDocumentAsset(documentId: $documentId, filename: $filename, mimeType: $mimeType, contentBase64: $contentBase64) {
      id
      markdown
    }
  }
`;

export const DELETE_PROJECT_DOCUMENT_ASSET_MUTATION = `
  mutation DeleteProjectDocumentAsset($id: ID!) {
    deleteProjectDocumentAsset(id: $id)
  }
`;

export const PROJECT_PLAN_CALENDAR_QUERY = `
  query ProjectPlanCalendar {
    projectPlanCalendar {
      phases { code label targetOn sortOrder }
      milestones { id name phaseCode targetOn sortOrder }
    }
  }
`;

export const SAVE_PROJECT_PLAN_MUTATION = `
  mutation SaveProjectPlan($input: ProjectPlanSaveInput!) {
    saveProjectPlan(input: $input) {
      phases { code label targetOn sortOrder }
      milestones { id name phaseCode targetOn sortOrder }
    }
  }
`;
