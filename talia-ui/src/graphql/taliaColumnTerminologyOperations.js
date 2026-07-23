/**
 * Column terminology definitions (shared config_setting payload).
 */

export const COLUMN_TERMINOLOGY_DEFINITIONS_QUERY = `
  query ColumnTerminologyDefinitions {
    columnTerminologyDefinitions {
      field
      shortLabel
      longLabel
      userDefinition
      adminDefinition
      updatedAt
      updatedBy
    }
  }
`;

export const SAVE_COLUMN_TERMINOLOGY_DEFINITIONS_MUTATION = `
  mutation SaveColumnTerminologyDefinitions($definitions: JSON!) {
    saveColumnTerminologyDefinitions(definitions: $definitions) {
      field
      shortLabel
      longLabel
      userDefinition
      adminDefinition
      updatedAt
      updatedBy
    }
  }
`;
