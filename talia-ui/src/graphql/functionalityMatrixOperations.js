/**
 * GraphQL operations for the Functionality Matrix (ADMIN+).
 * Separate from the Requirements Log operations.
 */

const MATRIX_ITEM_FIELDS = `
  id
  referenceCode
  element
  functionName
  shortName
  name
  concept
  rationale
  technicalRequirement
  complexity
  size
  phase
  sortOrder
  notes {
    id
    body
    createdAt
    createdBy
  }
  links {
    requirementItemId
    title
    section
    status
  }
  createdAt
  updatedAt
  createdBy
`;

export const FUNCTIONALITY_MATRIX_ITEMS_QUERY = `
  query FunctionalityMatrixItems {
    functionalityMatrixItems {
      ${MATRIX_ITEM_FIELDS}
    }
  }
`;

export const UPSERT_FUNCTIONALITY_MATRIX_ITEM_MUTATION = `
  mutation UpsertFunctionalityMatrixItem($input: FunctionalityMatrixItemInput!) {
    upsertFunctionalityMatrixItem(input: $input) {
      ${MATRIX_ITEM_FIELDS}
    }
  }
`;

export const DELETE_FUNCTIONALITY_MATRIX_ITEM_MUTATION = `
  mutation DeleteFunctionalityMatrixItem($id: ID!) {
    deleteFunctionalityMatrixItem(id: $id)
  }
`;

export const ADD_FUNCTIONALITY_MATRIX_NOTE_MUTATION = `
  mutation AddFunctionalityMatrixNote($matrixItemId: ID!, $body: String!) {
    addFunctionalityMatrixNote(matrixItemId: $matrixItemId, body: $body) {
      id
      body
      createdAt
      createdBy
    }
  }
`;

export const DELETE_FUNCTIONALITY_MATRIX_NOTE_MUTATION = `
  mutation DeleteFunctionalityMatrixNote($id: ID!) {
    deleteFunctionalityMatrixNote(id: $id)
  }
`;

export const SET_FUNCTIONALITY_MATRIX_LINKS_MUTATION = `
  mutation SetFunctionalityMatrixLinks($matrixItemId: ID!, $requirementItemIds: [ID!]!) {
    setFunctionalityMatrixLinks(matrixItemId: $matrixItemId, requirementItemIds: $requirementItemIds) {
      ${MATRIX_ITEM_FIELDS}
    }
  }
`;
