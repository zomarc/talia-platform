/**
 * Service for fetching booking profile data
 * Provides booking trends and metrics for a specific sailing
 */

import { apolloClient } from '../../lib/apolloClient';
import { gql } from '@apollo/client';

// GraphQL query for booking profile
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

// GraphQL query for booking profile with build curves
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

// GraphQL query for year-over-year comparison
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

class BookingProfileService {
  /**
   * Fetch booking profile for a sailing
   * @param {string} sailCode - Sail code (e.g., "CJ07250901")
   * @returns {Promise<Object>} Booking profile data
   */
  async fetch(sailCode) {
    if (!sailCode) {
      throw new Error('Sail code is required');
    }

    try {
      const { data } = await apolloClient.query({
        query: GET_BOOKING_PROFILE,
        variables: { sailCode },
        fetchPolicy: 'network-only' // Always fetch fresh data
      });

      if (!data || !data.bookingProfile) {
        throw new Error('No booking profile data returned from server');
      }

      return data.bookingProfile;
    } catch (error) {
      console.error('[BookingProfileService] Error fetching booking profile:', error);
      throw error;
    }
  }

  /**
   * Fetch booking profile with year-over-year comparison
   * @param {string} sailCode - Current year sail code
   * @param {string} previousYearSailCode - Previous year sail code (optional)
   * @returns {Promise<Object>} Booking profile with comparison data
   */
  async fetchWithComparison(sailCode, previousYearSailCode = null) {
    if (!sailCode) {
      throw new Error('Sail code is required');
    }

    try {
      const { data } = await apolloClient.query({
        query: GET_BOOKING_PROFILE_YOY,
        variables: { sailCode, previousYearSailCode },
        fetchPolicy: 'network-only'
      });

      return data.bookingProfileYearOverYear;
    } catch (error) {
      console.error('[BookingProfileService] Error fetching YOY comparison:', error);
      throw error;
    }
  }

  /**
   * Fetch booking profile with build curves
   * @param {string} sailCode - Sail code
   * @returns {Promise<Object>} Booking profile with build curves
   */
  async fetchWithBuildCurves(sailCode) {
    if (!sailCode) {
      throw new Error('Sail code is required');
    }

    try {
      const { data } = await apolloClient.query({
        query: GET_BOOKING_PROFILE_WITH_CURVES,
        variables: { sailCode },
        fetchPolicy: 'network-only'
      });

      if (!data || !data.bookingProfileWithCurves) {
        throw new Error('No booking profile with curves data returned from server');
      }

      return data.bookingProfileWithCurves;
    } catch (error) {
      console.error('[BookingProfileService] Error fetching booking profile with curves:', error);
      throw error;
    }
  }

  /**
   * Generate previous year sail code from current sail code
   * Pattern: CJ07250901 -> CJ07240901 (decrement year)
   * @param {string} sailCode - Current sail code
   * @returns {string} Previous year sail code
   */
  generatePreviousYearSailCode(sailCode) {
    if (!sailCode || sailCode.length < 10) {
      return null;
    }

    // Extract year (positions 6-9 typically)
    // Pattern: CJ07250901 -> year is "2509" -> "2409"
    try {
      const yearPart = sailCode.substring(4, 8); // Assuming format: XXYYMMDD
      const year = parseInt(yearPart.substring(0, 2));
      const monthDay = yearPart.substring(2, 4);
      
      if (isNaN(year) || year < 0 || year > 99) {
        return null;
      }

      const prevYear = year - 1;
      const prevYearStr = prevYear.toString().padStart(2, '0');
      const prefix = sailCode.substring(0, 4);
      const suffix = sailCode.substring(8);
      
      return `${prefix}${prevYearStr}${monthDay}${suffix}`;
    } catch (error) {
      console.warn('[BookingProfileService] Could not generate previous year sail code:', error);
      return null;
    }
  }
}

// Export singleton instance
const bookingProfileService = new BookingProfileService();
export default bookingProfileService;

