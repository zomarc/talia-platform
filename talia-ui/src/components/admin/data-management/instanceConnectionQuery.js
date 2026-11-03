/**
 * Shared GraphQL document for Instance & keys and Architecture overview.
 */

export const INSTANCE_PROFILE_QUERY = `
  query InstanceConnectionProfile {
    instanceConnectionProfile {
      collectedAt
      configEnvironmentName
      nodeEnv
      dataSourcePriority
      synapseSyncDisabled
      graphqlServerPackageVersion
      nodeRuntimeVersion
      validateScriptDocVersion
      backupBetweenInstances
      architectureNotes
      dataTargets {
        id
        label
        role
        address
        skipped
        online
        detail
      }
      networking {
        egressIpv4
        egressSource
        hops {
          id
          label
          address
          kind
          note
        }
        concerns {
          id
          severity
          title
          detail
          relatedTargetId
        }
        notes
      }
      envKeys {
        key
        scope
        label
        present
        sensitive
        importance
        whenRequired
        note
      }
    }
    dataSources {
      id
      sourceName
      displayName
      sourceType
      isActive
      description
      connectionConfig
    }
    integrationSettings {
      aisstreamApiKeyPresent
      aishubUsername
      vesselfinderApiKeyPresent
      marinetrafficApiKeyPresent
    }
  }
`;
