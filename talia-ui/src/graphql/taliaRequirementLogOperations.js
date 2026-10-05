/**
 * GraphQL operations for Requirements Log (ADMIN+).
 */

const REQUIREMENT_ITEM_FIELDS = `
  id
  section
  title
  detail
  status
  priority
  area
  targetVersion
  taliaVersion
  owner
  source
  sourceRef
  createdAt
  updatedAt
  createdBy
`;

export const REQUIREMENT_ITEMS_QUERY = `
  query RequirementItems($filters: RequirementItemFilters) {
    requirementItems(filters: $filters) {
      ${REQUIREMENT_ITEM_FIELDS}
    }
  }
`;

export const UPSERT_REQUIREMENT_ITEM_MUTATION = `
  mutation UpsertRequirementItem($input: RequirementItemInput!) {
    upsertRequirementItem(input: $input) {
      ${REQUIREMENT_ITEM_FIELDS}
    }
  }
`;

export const UPSERT_REQUIREMENT_ITEMS_MUTATION = `
  mutation UpsertRequirementItems($inputs: [RequirementItemInput!]!) {
    upsertRequirementItems(inputs: $inputs) {
      ${REQUIREMENT_ITEM_FIELDS}
    }
  }
`;

export const SET_REQUIREMENT_ITEM_STATUS_MUTATION = `
  mutation SetRequirementItemStatus($id: ID!, $status: String!) {
    setRequirementItemStatus(id: $id, status: $status) {
      id
      status
      updatedAt
    }
  }
`;

export const DELETE_REQUIREMENT_ITEM_MUTATION = `
  mutation DeleteRequirementItem($id: ID!) {
    deleteRequirementItem(id: $id)
  }
`;
