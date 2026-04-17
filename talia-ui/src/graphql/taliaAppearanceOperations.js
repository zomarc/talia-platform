/**
 * Appearance settings + profiles (config_setting), shared by ThemeContext and admin Themes UI.
 */
export const TALIA_APPEARANCE_SETTINGS_UPDATED_EVENT = 'talia-appearance-settings-updated';

export const APPEARANCE_SETTINGS_QUERY = `
  query AppearanceSettings($userId: String) {
    appearanceSettings(userId: $userId) {
      settings
      profiles {
        id
        name
        settings
        updatedAt
      }
      activeProfileId
    }
  }
`;

export const APPEARANCE_PROFILE_BUCKETS_QUERY = `
  query AppearanceProfileBuckets($userId: String) {
    appearanceProfileBuckets(userId: $userId) {
      globalProfiles {
        id
        name
        settings
        updatedAt
      }
      userProfiles {
        id
        name
        settings
        updatedAt
      }
      activeProfileId
    }
  }
`;

export const SAVE_APPEARANCE_SETTINGS_MUTATION = `
  mutation SaveAppearanceSettings($settings: JSON!, $activeProfileId: String, $userId: String) {
    saveAppearanceSettings(settings: $settings, activeProfileId: $activeProfileId, userId: $userId) {
      settings
      activeProfileId
    }
  }
`;

export const SAVE_APPEARANCE_PROFILES_MUTATION = `
  mutation SaveAppearanceProfiles($profiles: JSON!, $userId: String) {
    saveAppearanceProfiles(profiles: $profiles, userId: $userId) {
      id
      name
      settings
      updatedAt
    }
  }
`;
