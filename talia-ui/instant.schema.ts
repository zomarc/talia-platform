import { i } from '@instantdb/react';

const schema = i.schema({
  entities: {
    // Simple one-to-one mapping: taliaUserId ↔ instantAuthId
    taliaUser: i.entity({
      taliaUserId: i.number().unique().indexed(),   // Talia's unique ID
      instantAuthId: i.string().unique().indexed()  // $user.id from InstantDB
    }),

    // Focus Management - Admin can create/edit layouts
    focus: i.entity({
      name: i.string().indexed(),                    // Focus name
      description: i.string(),                       // Focus description
      type: i.string().indexed(),                    // 'standard', 'user', 'template'
      isStandard: i.boolean().indexed(),             // Standard layouts appear for all users
      assignedRoles: i.json(),                       // Roles that can access this focus (JSON array)
      isDefault: i.boolean().indexed(),              // Default focus for role
      isActive: i.boolean().indexed(),               // Active/inactive status
      createdBy: i.number().indexed(),               // taliaUserId of creator
      layoutData: i.json(),                          // Layout configuration (JSON object)
      createdAt: i.date(),                           // Creation timestamp
      updatedAt: i.date()                            // Last update timestamp
    }),

    // User Focus Preferences
    userFocusPreference: i.entity({
      taliaUserId: i.number().indexed(),             // Talia user ID
      focusId: i.string().indexed(),                 // Focus ID
      isFavorite: i.boolean().indexed(),             // Is this a favorite focus
      lastUsed: i.date(),                            // Last time this focus was used
      customLayout: i.json()                         // User's custom layout override (JSON object)
    })
  }
});

export default schema;