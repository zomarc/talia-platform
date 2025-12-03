/**
 * Google Trends Search Queries Configuration
 * Organized by category - these are generic cruise holiday search terms
 * that people are searching for (not product-specific)
 */

export const GOOGLE_TRENDS_QUERIES = {
  generic: [
    "mediterranean cruise 2024",
    "mediterranean cruise 2025",
    "med cruise holidays 2024",
    "med cruise holidays 2025",
    "mediterranean cruise holidays from uk",
    "mediterranean cruise holidays all inclusive",
    "med cruise deals 2024",
    "med cruise deals 2025",
    "mediterranean cruise offers",
    "mediterranean cruise package deals",
    "cheap mediterranean cruises 2024",
    "cheap mediterranean cruises 2025",
    "budget mediterranean cruise deals",
    "last minute mediterranean cruises",
    "last minute med cruise deals",
    "7 night mediterranean cruise",
    "7 day mediterranean cruise 2024",
    "10 night mediterranean cruise 2025",
    "14 night mediterranean cruise",
    "short mediterranean cruise 3 nights",
    "mini mediterranean cruise",
    "western mediterranean cruise 2024",
    "western mediterranean cruise 2025",
    "eastern mediterranean cruise 2024",
    "eastern mediterranean cruise 2025",
    "central mediterranean cruise",
    "summer mediterranean cruise 2024",
    "summer mediterranean cruise 2025",
    "spring mediterranean cruise",
    "october mediterranean cruise 2024",
    "october mediterranean cruise 2025",
    "november mediterranean cruise deals",
    "family mediterranean cruise 2024",
    "family mediterranean cruise 2025",
    "couples mediterranean cruise",
    "adult only mediterranean cruises",
    "luxury mediterranean cruise 2024",
    "luxury mediterranean cruise 2025",
    "all inclusive mediterranean cruise 2024",
    "all inclusive mediterranean cruise 2025",
    "mediterranean cruise full board",
    "mediterranean cruise with flights",
    "fly cruise mediterranean 2024",
    "fly cruise mediterranean 2025"
  ],

  destination_focused: [
    "italy and greek islands cruise 2024",
    "italy and greek islands cruise 2025",
    "greek islands mediterranean cruise 2024",
    "greek islands mediterranean cruise 2025",
    "barcelona to rome mediterranean cruise",
    "rome to barcelona cruise 2024",
    "athens to venice cruise 2025",
    "venice to athens cruise itineraries",
    "amalfi coast cruise 2024",
    "amalfi coast cruise 2025",
    "croatia and greek islands cruise",
    "adriatic and mediterranean cruise",
    "mediterranean cruise from barcelona 2024",
    "mediterranean cruise from barcelona 2025",
    "mediterranean cruise from rome 2024",
    "mediterranean cruise from rome 2025",
    "mediterranean cruise from athens",
    "mediterranean cruise from venice",
    "mediterranean cruise from marseille",
    "mediterranean cruise from palma",
    "athens santorini mykonos cruise",
    "rome naples palma barcelona cruise",
    "turkey and greek islands cruise",
    "mediterranean cruise greek isles and turkey",
    "western med cruise spain france italy",
    "eastern med cruise greece turkey croatia",
    "canary islands and mediterranean cruise",
    "mediterranean and greek islands cruise from uk"
  ],

  gulf_and_middle_east: [
    "gulf cruise 2024",
    "gulf cruise 2025",
    "arabian gulf cruise holidays",
    "arabian gulf cruise 7 nights",
    "dubai cruise 2024",
    "dubai cruise 2025",
    "dubai to doha gulf cruise 2024",
    "dubai to doha gulf cruise 2025",
    "dubai to abu dhabi cruise",
    "abu dhabi gulf cruise 2024",
    "abu dhabi gulf cruise 2025",
    "qatar gulf cruise holidays",
    "oman and uae cruise",
    "muscat dubai cruise",
    "saudi arabia red sea cruise",
    "red sea cruise from jeddah",
    "middle east cruise winter 2024",
    "middle east cruise winter 2025",
    "winter sun cruises gulf 2024",
    "winter sun cruises gulf 2025"
  ],

  brand_and_ship: [
    "royal caribbean mediterranean cruise 2024",
    "royal caribbean mediterranean cruise 2025",
    "royal caribbean western med cruises",
    "royal caribbean greek islands 2024",
    "msc mediterranean cruises 2024",
    "msc mediterranean cruises 2025",
    "msc med cruises from southampton 2025",
    "p&o mediterranean cruises 2024",
    "p&o mediterranean cruises 2025",
    "p&o cruises med from southampton",
    "celebrity cruises mediterranean 2024",
    "celebrity cruises mediterranean 2025",
    "celebrity cruises greek islands 2025",
    "tui mediterranean cruise all inclusive",
    "tui med cruises 2024",
    "tui med cruises 2025",
    "norwegian cruise line mediterranean 2024",
    "norwegian cruise line mediterranean 2025",
    "norwegian epic mediterranean 2024",
    "princess cruises mediterranean 2024",
    "princess cruises mediterranean 2025",
    "costa cruises western med 2025",
    "costa cruises mediterranean 2024",
    "cunard mediterranean cruises 2025",
    "virgin voyages mediterranean 2024"
  ],

  departure_and_duration: [
    "cruises from southampton to mediterranean 2024",
    "cruises from southampton to mediterranean 2025",
    "mediterranean cruises from uk ports",
    "mediterranean cruises from london 2024",
    "mediterranean cruises from barcelona 2024",
    "mediterranean cruises from barcelona 2025",
    "mediterranean cruises from rome 2024",
    "mediterranean cruises from rome 2025",
    "mediterranean cruises from athens 2024",
    "mediterranean cruises from venice 2025",
    "7 night med cruise from barcelona",
    "10 night med cruise from rome",
    "14 night med cruise from southampton",
    "med cruise october 2024",
    "med cruise october 2025",
    "med cruise may 2024",
    "med cruise june 2025",
    "school summer holiday mediterranean cruise",
    "half term mediterranean cruise deals",
    "easter mediterranean cruises 2025"
  ],

  audience_and_style: [
    "family friendly mediterranean cruises 2024",
    "family friendly mediterranean cruises 2025",
    "kids club mediterranean cruise",
    "adult only mediterranean cruises from uk",
    "honeymoon mediterranean cruise",
    "mediterranean cruise with drinks package",
    "mediterranean cruise with shore excursions included",
    "mediterranean cruise with no flying",
    "mediterranean cruise and stay package",
    "mediterranean cruise plus city break barcelona",
    "luxury small ship mediterranean cruise",
    "mediterranean yacht style cruise",
    "solo traveller mediterranean cruise deals"
  ]
};

// Flatten all queries for easy access
export const ALL_QUERIES = Object.values(GOOGLE_TRENDS_QUERIES).flat();

// Get queries by category
export const getQueriesByCategory = (category) => {
  return GOOGLE_TRENDS_QUERIES[category] || [];
};

// Get all categories
export const getCategories = () => {
  return Object.keys(GOOGLE_TRENDS_QUERIES);
};

