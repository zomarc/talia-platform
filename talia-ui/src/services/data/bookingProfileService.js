/**
 * Booking profile GraphQL client — dimensional REAL curves, YoY, finance budget.
 */

import { apolloClient } from '../../lib/apolloClient';
import { gql } from '@apollo/client';
import { trackedApolloQuery } from './trackedGraphql';

const DIMENSIONAL_FIELDS = `
  sailCode
  referenceSailCode
  inventoryItemId
  sailCodes
  sailDate
  shipName
  shipCode
  currentBookings
  currentGuests
  capacity
  capacitySource
  currentLoadFactorPct
  bookingVelocity
  cancellationRate
  daysUntilSailing
  breakdown
  bookingDataPoints {
    date
    bookings
    guests
    newBookings
    cancellations
    netBookings
  }
  buildCurves {
    weekLabel
    weeksUntilSailing
    bookings
    guests
    loadFactorPct
  }
  series {
    dimensionKey
    points {
      weekLabel
      weeksUntilSailing
      bookings
      guests
      loadFactorPct
    }
  }
  composition {
    market { dimensionKey bookings guests loadFactorPct }
    marketGroup { dimensionKey bookings guests loadFactorPct }
    currency { dimensionKey bookings guests loadFactorPct }
  }
  history {
    quality
    distinctSnapshotDates
    minSnapshotDate
    maxSnapshotDate
    thinHistory
    message
  }
`;

const GET_BOOKING_PROFILE_DIMENSIONAL = gql`
  query GetBookingProfileDimensional($sailCode: String!, $breakdown: ProfileBreakdown) {
    bookingProfileDimensional(sailCode: $sailCode, breakdown: $breakdown) {
      ${DIMENSIONAL_FIELDS}
    }
  }
`;

const GET_BOOKING_PROFILE_DIMENSIONAL_YOY = gql`
  query GetBookingProfileDimensionalYoY(
    $sailCode: String!
    $breakdown: ProfileBreakdown
    $previousYearSailCode: String
  ) {
    bookingProfileDimensionalYoY(
      sailCode: $sailCode
      breakdown: $breakdown
      previousYearSailCode: $previousYearSailCode
    ) {
      previousYearSailCode
      peerSource
      representativenessNote
      comparison {
        bookingsDifference
        bookingsPercentageChange
        guestsDifference
        guestsPercentageChange
        velocityDifference
        velocityPercentageChange
        loadFactorDifference
      }
      currentYear { ${DIMENSIONAL_FIELDS} }
      previousYear { ${DIMENSIONAL_FIELDS} }
    }
  }
`;

const GET_BUDGET_END_STATE = gql`
  query GetBudgetEndStateComparison($sailCode: String!, $breakdown: ProfileBreakdown) {
    budgetEndStateComparison(sailCode: $sailCode, breakdown: $breakdown) {
      sailCode
      referenceSailCode
      shipCode
      shipName
      capacity
      breakdown
      streamLabel
      totalBudgetPassengers
      totalActualGuests
      totalGapGuests
      budgetRowCount
      message
      rows {
        dimensionKey
        budgetPassengers
        actualGuests
        actualBookings
        gapGuests
        budgetLoadFactorPct
        actualLoadFactorPct
        gapLoadFactorPct
      }
    }
  }
`;

// Legacy queries kept for older panels
const GET_BOOKING_PROFILE = gql`
  query GetBookingProfile($sailCode: String!) {
    bookingProfile(sailCode: $sailCode) {
      sailCode
      sailDate
      shipName
      shipCode
      currentBookings
      currentGuests
      bookingVelocity
      cancellationRate
      daysUntilSailing
      bookingDataPoints {
        date
        bookings
        guests
        newBookings
        cancellations
        netBookings
      }
    }
  }
`;

const GET_BOOKING_PROFILE_WITH_CURVES = gql`
  query GetBookingProfileWithCurves($sailCode: String!) {
    bookingProfileWithCurves(sailCode: $sailCode) {
      sailCode
      sailDate
      shipName
      shipCode
      currentBookings
      currentGuests
      bookingVelocity
      cancellationRate
      daysUntilSailing
      bookingDataPoints {
        date
        bookings
        guests
        newBookings
        cancellations
        netBookings
      }
      buildCurves {
        weekLabel
        weeksUntilSailing
        bookings
        guests
        percentageOfTarget
        actualVsTarget
      }
    }
  }
`;

const GET_BOOKING_PROFILE_YOY = gql`
  query GetBookingProfileYOY($sailCode: String!, $previousYearSailCode: String) {
    bookingProfileYearOverYear(sailCode: $sailCode, previousYearSailCode: $previousYearSailCode) {
      currentYear {
        sailCode
        sailDate
        shipName
        shipCode
        currentBookings
        currentGuests
        bookingVelocity
        cancellationRate
        daysUntilSailing
        bookingDataPoints {
          date
          bookings
          guests
          newBookings
          cancellations
          netBookings
        }
      }
      previousYear {
        sailCode
        sailDate
        shipName
        shipCode
        currentBookings
        currentGuests
        bookingVelocity
        cancellationRate
        daysUntilSailing
        bookingDataPoints {
          date
          bookings
          guests
          newBookings
          cancellations
          netBookings
        }
      }
      comparison {
        bookingsDifference
        bookingsPercentageChange
        guestsDifference
        guestsPercentageChange
        velocityDifference
        velocityPercentageChange
      }
    }
  }
`;

const GET_RESERVATION_BOOKING_CURVE = gql`
  query GetReservationBookingCurve(
    $sailCode: String!
    $marketBreakdown: ProfileBreakdown
    $seriesMode: ReservationCurveSeriesMode
    $includeCompetitor: Boolean
  ) {
    reservationBookingCurve(
      sailCode: $sailCode
      marketBreakdown: $marketBreakdown
      seriesMode: $seriesMode
      includeCompetitor: $includeCompetitor
    ) {
      sailCode
      referenceSailCode
      sailCodes
      sailDate
      shipCode
      shipName
      marketBreakdown
      seriesMode
      bookedCabins
      totalCabins
      loadFactorPct
      capacitySource
      reservationBookings
      reservationGuests
      bookDateField
      missingBookDates
      maxWeeks
      daysUntilSailing
      velocity {
        pastWeek { label days bookings guests bookingsPerDay guestsPerDay }
        pastTwoWeeks { label days bookings guests bookingsPerDay guestsPerDay }
        pastFourWeeks { label days bookings guests bookingsPerDay guestsPerDay }
        pastSixtyDays { label days bookings guests bookingsPerDay guestsPerDay }
      }
      revenue {
        totalNetEur
        totalGrossEur
        revPerPaxEur
        bookingsWithRevenue
        guestsWithRevenue
        totalGuests
        coveragePct
        currency
        message
      }
      competitor {
        currency
        ourMinFarePp
        competitorMedianPp
        competitorMinPp
        competitorCount
        gapPct
        departureMonth
        message
      }
      series {
        dimensionKey
        points {
          weekLabel
          weeksUntilSailing
          bookings
          guests
        }
      }
      totals {
        weekLabel
        weeksUntilSailing
        bookings
        guests
      }
      composition {
        dimensionKey
        bookings
        guests
      }
    }
  }
`;

class BookingProfileService {
  async fetchReservationCurve(sailCode, options = {}) {
    if (!sailCode) throw new Error('Sail code is required');
    const {
      marketBreakdown = 'market_group',
      seriesMode = 'market',
      includeCompetitor = false,
    } = options;
    const { data } = await trackedApolloQuery({
      client: apolloClient,
      query: GET_RESERVATION_BOOKING_CURVE,
      variables: { sailCode, marketBreakdown, seriesMode, includeCompetitor },
      component: 'Reservation Booking Curve',
      purpose: 'Fetch reservation-only booking curve (original book date)',
      tableName: 'reservation',
      options: { fetchPolicy: 'network-only' },
    });
    if (!data?.reservationBookingCurve) {
      throw new Error('No reservation booking curve returned');
    }
    return data.reservationBookingCurve;
  }

  async fetchDimensional(sailCode, breakdown = 'none') {
    if (!sailCode) throw new Error('Sail code is required');
    const { data } = await trackedApolloQuery({
      client: apolloClient,
      query: GET_BOOKING_PROFILE_DIMENSIONAL,
      variables: { sailCode, breakdown },
      component: 'Booking Profile',
      purpose: 'Fetch dimensional booking profile',
      tableName: 'booking_profile_dimensional',
      options: { fetchPolicy: 'network-only' },
    });
    if (!data?.bookingProfileDimensional) {
      throw new Error('No dimensional booking profile returned');
    }
    return data.bookingProfileDimensional;
  }

  async fetchDimensionalYoY(sailCode, breakdown = 'none', previousYearSailCode = null) {
    if (!sailCode) throw new Error('Sail code is required');
    const { data } = await trackedApolloQuery({
      client: apolloClient,
      query: GET_BOOKING_PROFILE_DIMENSIONAL_YOY,
      variables: { sailCode, breakdown, previousYearSailCode },
      component: 'Booking Profile',
      purpose: 'Fetch dimensional booking profile YoY',
      tableName: 'booking_profile_dimensional_yoy',
      options: { fetchPolicy: 'network-only' },
    });
    return data.bookingProfileDimensionalYoY;
  }

  async fetchBudgetComparison(sailCode, breakdown = 'market_group') {
    if (!sailCode) throw new Error('Sail code is required');
    const { data } = await trackedApolloQuery({
      client: apolloClient,
      query: GET_BUDGET_END_STATE,
      variables: { sailCode, breakdown },
      component: 'Booking Profile',
      purpose: 'Fetch finance budget end-state comparison',
      tableName: 'budget',
      options: { fetchPolicy: 'network-only' },
    });
    return data.budgetEndStateComparison;
  }

  async fetch(sailCode) {
    if (!sailCode) throw new Error('Sail code is required');
    const { data } = await trackedApolloQuery({
      client: apolloClient,
      query: GET_BOOKING_PROFILE,
      variables: { sailCode },
      component: 'Booking Profile',
      purpose: 'Fetch booking profile from talia graphql',
      tableName: 'booking_profile',
      options: { fetchPolicy: 'network-only' },
    });
    if (!data?.bookingProfile) throw new Error('No booking profile data returned from server');
    return data.bookingProfile;
  }

  async fetchWithComparison(sailCode, previousYearSailCode = null) {
    if (!sailCode) throw new Error('Sail code is required');
    const { data } = await trackedApolloQuery({
      client: apolloClient,
      query: GET_BOOKING_PROFILE_YOY,
      variables: { sailCode, previousYearSailCode },
      component: 'Booking Profile',
      purpose: 'Fetch booking profile year-over-year from talia graphql',
      tableName: 'booking_profile_yoy',
      options: { fetchPolicy: 'network-only' },
    });
    return data.bookingProfileYearOverYear;
  }

  async fetchWithBuildCurves(sailCode) {
    if (!sailCode) throw new Error('Sail code is required');
    const { data } = await trackedApolloQuery({
      client: apolloClient,
      query: GET_BOOKING_PROFILE_WITH_CURVES,
      variables: { sailCode },
      component: 'Booking Profile',
      purpose: 'Fetch booking profile build curves from talia graphql',
      tableName: 'booking_profile_with_curves',
      options: { fetchPolicy: 'network-only' },
    });
    if (!data?.bookingProfileWithCurves) {
      throw new Error('No booking profile with curves data returned from server');
    }
    return data.bookingProfileWithCurves;
  }

  generatePreviousYearSailCode(sailCode) {
    if (!sailCode || sailCode.length < 10) return null;
    try {
      const yearPart = sailCode.substring(4, 8);
      const year = parseInt(yearPart.substring(0, 2), 10);
      const monthDay = yearPart.substring(2, 4);
      if (Number.isNaN(year) || year < 0 || year > 99) return null;
      const prevYearStr = (year - 1).toString().padStart(2, '0');
      return `${sailCode.substring(0, 4)}${prevYearStr}${monthDay}${sailCode.substring(8)}`;
    } catch {
      return null;
    }
  }
}

const bookingProfileService = new BookingProfileService();
export default bookingProfileService;
