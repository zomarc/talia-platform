/**
 * Talia UI theme registry — `config_setting` via GraphQL.
 * Dispatched after admin saves so ThemeContext can refetch without a full reload.
 */
export const TALIA_UI_THEME_REGISTRY_UPDATED_EVENT = 'talia-ui-theme-registry-updated';

export const TALIA_UI_THEME_REGISTRY_QUERY = `
  query TaliaUiThemeRegistry {
    taliaUiThemeRegistry {
      themes
      assets
    }
  }
`;

export const SAVE_TALIA_UI_THEME_REGISTRY_MUTATION = `
  mutation SaveTaliaUiThemeRegistry($themes: JSON, $assets: JSON) {
    saveTaliaUiThemeRegistry(themes: $themes, assets: $assets) {
      themes
      assets
    }
  }
`;
