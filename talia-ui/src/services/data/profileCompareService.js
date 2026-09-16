/**
 * GraphQL client for ProfileCompare + model map + aggregations / review.
 */

import { apolloClient } from '../../lib/apolloClient';
import { gql } from '@apollo/client';
import { trackedApolloQuery, trackedApolloMutate } from './trackedGraphql';

const LF_POINT = `
  weekLabel
  weeksUntilSailing
  bookings
  guests
  lfPct
`;

const SERIES_SUMMARY = `
  sailCode
  referenceSailCode
  sailDate
  shipCode
  shipName
  bookedCabins
  totalCabins
  loadFactorPct
  reservationBookings
  reservationGuests
  daysUntilSailing
  series { ${LF_POINT} }
`;

const MODEL_MAP = `
  id
  inventoryItemId
  modelInventoryItemId
  modelSailCode
  matchMode
  notes
  confidence
  matchedDow
  matchedDuration
  lastEditedBy
  createdAt
  updatedAt
`;

const CANDIDATE_FIELDS = `
  sailCode
  sailDate
  shipCode
  shipName
  sailDays
  isMain
  packageType
  dayDiff
`;

const PROFILE_COMPARE = gql`
  query ProfileCompare($sailCode: String!, $includeBudget: Boolean, $includeTarget: Boolean) {
    profileCompare(sailCode: $sailCode, includeBudget: $includeBudget, includeTarget: $includeTarget) {
      sailCode
      referenceSailCode
      inventoryItemId
      shipCode
      shipName
      sailDate
      matchMode
      peerSource
      modelSailCode
      modelMap { ${MODEL_MAP} }
      real { ${SERIES_SUMMARY} }
      model { ${SERIES_SUMMARY} }
      activeTarget {
        id
        name
        perspective
        isActive
      }
      targetSeries { ${LF_POINT} }
      targetSource
      budget {
        sailCode
        referenceSailCode
        totalBudgetPassengers
        totalActualGuests
        totalGapGuests
        capacity
        message
        budgetRowCount
      }
      candidates { ${CANDIDATE_FIELDS} }
    }
  }
`;

const MODEL_CANDIDATES = gql`
  query ProfileModelCandidates($sailCode: String!) {
    profileModelCandidates(sailCode: $sailCode) {
      ${CANDIDATE_FIELDS}
    }
  }
`;

const UPSERT_MAP = gql`
  mutation UpsertProfileModelMap($input: UpsertProfileModelMapInput!) {
    upsertProfileModelMap(input: $input) {
      ${MODEL_MAP}
    }
  }
`;

const CLEAR_MAP = gql`
  mutation ClearProfileModelMap($inventoryItemId: ID!) {
    clearProfileModelMap(inventoryItemId: $inventoryItemId)
  }
`;

const REVIEW_STATUSES = gql`
  query ProfileTargetReviewStatuses($sailCodes: [String!]!, $behindPp: Float, $aheadPp: Float) {
    profileTargetReviewStatuses(sailCodes: $sailCodes, behindPp: $behindPp, aheadPp: $aheadPp) {
      sailCode
      referenceSailCode
      inventoryItemId
      status
      actualLfPct
      targetLfPct
      gapPp
      activeTargetId
      activeTargetName
    }
  }
`;

const BACKFILL = gql`
  mutation BackfillTargetProfiles($fromDate: String, $toDate: String, $dryRun: Boolean, $limit: Int, $templateProfileId: ID) {
    backfillTargetProfiles(fromDate: $fromDate, toDate: $toDate, dryRun: $dryRun, limit: $limit, templateProfileId: $templateProfileId) {
      fromDate
      toDate
      dryRun
      considered
      created
      skippedExisting
      skippedNoCurve
      failed
      sampleSailCodes
      message
    }
  }
`;

const AGGREGATIONS = gql`
  query ProfileAggregations($filters: ProfileAggregationFilters) {
    profileAggregations(filters: $filters) {
      groupBy
      message
      rows {
        dimensionKey
        dimensionLabel
        shipCode
        shipName
        month
        dow
        durationBucket
        sailCount
        withActiveTarget
        withManualModel
        withLazyModel
        sailCodes
      }
    }
  }
`;

class ProfileCompareService {
  async fetchCompare(sailCode, options = {}) {
    if (!sailCode) return null;
    const { data } = await trackedApolloQuery({
      client: apolloClient,
      query: PROFILE_COMPARE,
      variables: {
        sailCode,
        includeBudget: options.includeBudget !== false,
        includeTarget: options.includeTarget !== false,
      },
      component: 'Sailing Profile',
      purpose: 'Compare REAL vs model profile',
      tableName: 'profile_model_map',
      options: { fetchPolicy: 'network-only', errorPolicy: 'all' },
    });
    return data?.profileCompare || null;
  }

  async fetchModelCandidates(sailCode) {
    if (!sailCode) return [];
    try {
      const { data } = await trackedApolloQuery({
        client: apolloClient,
        query: MODEL_CANDIDATES,
        variables: { sailCode },
        component: 'Sailing Profile',
        purpose: 'List Change model candidates',
        tableName: 'master_sail',
        options: { fetchPolicy: 'network-only', errorPolicy: 'all' },
      });
      return data?.profileModelCandidates || [];
    } catch (err) {
      console.warn('[profileCompareService] candidates fallback empty:', err.message);
      return [];
    }
  }

  async upsertModelMap(input) {
    const { data } = await trackedApolloMutate({
      client: apolloClient,
      mutation: UPSERT_MAP,
      variables: { input },
      component: 'Sailing Profile',
      purpose: 'Upsert profile model map',
      tableName: 'profile_model_map',
    });
    return data?.upsertProfileModelMap;
  }

  async clearModelMap(inventoryItemId) {
    const { data } = await trackedApolloMutate({
      client: apolloClient,
      mutation: CLEAR_MAP,
      variables: { inventoryItemId: String(inventoryItemId) },
      component: 'Sailing Profile',
      purpose: 'Clear profile model map (back to lazy)',
      tableName: 'profile_model_map',
    });
    return data?.clearProfileModelMap;
  }

  async fetchReviewStatuses(sailCodes, options = {}) {
    if (!sailCodes?.length) return [];
    const { data } = await trackedApolloQuery({
      client: apolloClient,
      query: REVIEW_STATUSES,
      variables: {
        sailCodes,
        behindPp: options.behindPp,
        aheadPp: options.aheadPp,
      },
      component: 'Master Sailing Explorer',
      purpose: 'Target review statuses',
      tableName: 'inventory_target_profile',
      options: { fetchPolicy: 'network-only' },
    });
    return data?.profileTargetReviewStatuses || [];
  }

  async backfillTargetProfiles(options = {}) {
    const { data } = await trackedApolloMutate({
      client: apolloClient,
      mutation: BACKFILL,
      variables: {
        fromDate: options.fromDate || null,
        toDate: options.toDate || null,
        dryRun: options.dryRun === true,
        limit: options.limit || 500,
        templateProfileId: options.templateProfileId || null,
      },
      component: 'Target Profile Editor',
      purpose: 'Assign default target profiles to current sailings',
      tableName: 'inventory_target_profile',
    });
    return data?.backfillTargetProfiles || null;
  }

  async fetchAggregations(filters = {}) {
    const { data } = await trackedApolloQuery({
      client: apolloClient,
      query: AGGREGATIONS,
      variables: { filters },
      component: 'Profile Aggregations',
      purpose: 'Multi-level profile coverage',
      tableName: 'inventory_item',
      options: { fetchPolicy: 'network-only' },
    });
    return data?.profileAggregations || null;
  }
}

const profileCompareService = new ProfileCompareService();
export default profileCompareService;
