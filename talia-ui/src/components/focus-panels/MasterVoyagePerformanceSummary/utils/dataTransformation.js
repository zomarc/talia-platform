/**
 * Data Transformation Utility for Master Voyage Performance Summary
 * Transforms master_sail data into hierarchical structure with aggregations
 * and generates mock data for missing columns
 */

/**
 * Generate a realistic mock value based on voyage characteristics
 */
const generateMockValue = (voyage, columnType, seed = 0) => {
  const hash = (voyage.sail_code || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), seed);
  const random = (hash % 1000) / 1000;
  
  switch (columnType) {
    case 'occupancy':
      return 70 + (random * 30); // 70-100%
    case 'availability':
      return 10 + (random * 40); // 10-50%
    case 'price_min_inside':
      return 500 + (random * 300); // 500-800 EUR
    case 'price_max_inside':
      return 800 + (random * 400); // 800-1200 EUR
    case 'price_min_outside':
      return 700 + (random * 300); // 700-1000 EUR
    case 'price_max_outside':
      return 1000 + (random * 500); // 1000-1500 EUR
    case 'price_min_deluxe':
      return 1200 + (random * 400); // 1200-1600 EUR
    case 'price_max_deluxe':
      return 1600 + (random * 600); // 1600-2200 EUR
    case 'revenue':
      const duration = voyage.sail_days || 7;
      const pax = 100 + (random * 400); // 100-500 pax
      const avgPrice = 800 + (random * 400);
      return Math.round(pax * avgPrice * duration);
    case 'pax':
      return Math.round(100 + (random * 400)); // 100-500
    case 'ppp':
      return 800 + (random * 400); // 800-1200
    case 'percentage':
      return -20 + (random * 40); // -20% to +20%
    case 'ros':
      return 10 + (random * 20); // 10-30 days
    case 'groups':
      return Math.round(5 + (random * 15)); // 5-20 groups
    case 'amount':
      return Math.round(50000 + (random * 150000)); // 50k-200k EUR
    case 'released':
      return Math.round(10 + (random * 50)); // 10-60
    default:
      return random * 100;
  }
};

/**
 * Format date to AccMonth format (e.g., "Jan-26")
 */
const formatAccMonth = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const year = date.getFullYear().toString().substring(2);
  return `${month}-${year}`;
};

/**
 * Extract voyage category from package name or type
 */
const extractVoyageCategory = (voyage) => {
  const packageName = (voyage.package_name || '').toLowerCase();
  const packageType = (voyage.package_type || '').toLowerCase();
  
  // Try to extract category from package name
  if (packageName.includes('iconic arabia')) {
    if (packageName.includes('3n')) return 'Iconic Arabia 3N';
    if (packageName.includes('4n')) return 'Iconic Arabia 4N';
    return 'Iconic Arabia';
  }
  if (packageName.includes('iconic aegean')) {
    if (packageName.includes('3n')) return 'Iconic Aegean 3N';
    if (packageName.includes('4n')) return 'Iconic Aegean 4N';
    return 'Iconic Aegean';
  }
  if (packageName.includes('desert')) return 'Desert Days';
  if (packageName.includes('holy land')) return 'Holy Land';
  if (packageName.includes('adriatic')) return 'Adriatic';
  if (packageName.includes('mediterranean')) return 'Mediterranean';
  
  // Fallback to package type
  if (packageType) {
    return packageType.charAt(0).toUpperCase() + packageType.slice(1);
  }
  
  return 'Other';
};

/**
 * Transform a single voyage record with all required columns
 */
const transformVoyageRecord = (voyage, index) => {
  const seed = index;
  
  // Extract base data
  const accMonth = formatAccMonth(voyage.sail_date_from);
  const voyageCategory = extractVoyageCategory(voyage);
  
  // Calculate availability percentages (should be realistic)
  const availInside = generateMockValue(voyage, 'availability', seed + 1);
  const availOutside = generateMockValue(voyage, 'availability', seed + 2);
  const availDeluxe = generateMockValue(voyage, 'availability', seed + 3);
  
  // Calculate occupancy (higher occupancy = lower availability)
  const occupancy = generateMockValue(voyage, 'occupancy', seed);
  const targetOccupancy = 85 + ((seed % 100) / 100 * 10); // 85-95%
  
  // Calculate pricing
  const minFareInside = generateMockValue(voyage, 'price_min_inside', seed + 10);
  const maxFareInside = generateMockValue(voyage, 'price_max_inside', seed + 11);
  const minFareOutside = generateMockValue(voyage, 'price_min_outside', seed + 12);
  const maxFareOutside = generateMockValue(voyage, 'price_max_outside', seed + 13);
  const minFareDeluxe = generateMockValue(voyage, 'price_min_deluxe', seed + 14);
  const maxFareDeluxe = generateMockValue(voyage, 'price_max_deluxe', seed + 15);
  
  // Calculate revenue and pax metrics
  const ytdBookedPax = generateMockValue(voyage, 'pax', seed + 20);
  const ytdBookedRevEUR = generateMockValue(voyage, 'revenue', seed + 21);
  const ytdBookedPPP = generateMockValue(voyage, 'ppp', seed + 22);
  const ytdBookedPPPEUR = ytdBookedPPP * 1.0; // Assume 1:1 conversion for now
  
  // Calculate vs Target percentages
  const vsTargetRev = ((ytdBookedRevEUR / (ytdBookedRevEUR * 1.1)) - 1) * 100;
  const vsTargetPax = ((ytdBookedPax / (ytdBookedPax * 1.05)) - 1) * 100;
  const vsTargetPPP = ((ytdBookedPPP / (ytdBookedPPP * 1.03)) - 1) * 100;
  const vsTargetPPPEUR = ((ytdBookedPPPEUR / (ytdBookedPPPEUR * 1.03)) - 1) * 100;
  
  // Calculate last week metrics
  const lwBookedRevEUR = ytdBookedRevEUR * 0.15; // 15% of YTD
  const lwBookedGroupRevEUR = lwBookedRevEUR * 0.6; // 60% group
  const lwBookedFITRevEUR = lwBookedRevEUR * 0.4; // 40% FIT
  const lwBookedGroupPax = Math.round(ytdBookedPax * 0.15 * 0.6);
  const lwBookedFITPax = Math.round(ytdBookedPax * 0.15 * 0.4);
  
  // Calculate ROS (Rate of Sale) - days until sailing
  const sailDate = voyage.sail_date_from ? new Date(voyage.sail_date_from) : new Date();
  const today = new Date();
  const daysUntilSailing = Math.max(0, Math.floor((sailDate - today) / (1000 * 60 * 60 * 24)));
  const lwBookedGroupROS = daysUntilSailing > 30 ? generateMockValue(voyage, 'ros', seed + 30) : daysUntilSailing;
  const lwBookedFITROS = daysUntilSailing > 30 ? generateMockValue(voyage, 'ros', seed + 31) : daysUntilSailing;
  
  return {
    // Core identification
    accMonth,
    voyageCode: voyage.sail_code || '',
    ship: voyage.ship_name || '',
    sailDate: voyage.sail_date_from || '',
    package: voyage.package_name || '',
    itinerary: voyage.geog_area_code || voyage.port_from || '',
    voyageCategory,
    
    // Row type indicator (for grouping)
    rowType: 'voyage', // 'month', 'category', or 'voyage'
    
    // Occupancy - Passenger Nights
    paxNightsBookedOccupancy: Math.round(occupancy * 100) / 100,
    targetOccupancy: Math.round(targetOccupancy * 100) / 100,
    paxNightsReservedOccupancy: Math.round((occupancy * 0.9) * 100) / 100,
    paxNightsBudgetedOccupancy: Math.round((targetOccupancy * 0.95) * 100) / 100,
    
    // Availability
    availableCabinsInside: Math.round((100 - occupancy) * 2),
    availabilityPercentInside: Math.round(availInside * 100) / 100,
    availableCabinsOutside: Math.round((100 - occupancy) * 3),
    availabilityPercentOutside: Math.round(availOutside * 100) / 100,
    availableCabinsDeluxe: Math.round((100 - occupancy) * 1),
    availabilityPercentDeluxe: Math.round(availDeluxe * 100) / 100,
    availableCabinsSuites: Math.round((100 - occupancy) * 0.5),
    availabilityPercentSuites: Math.round(availDeluxe * 0.7 * 100) / 100,
    
    // Pricing
    minFarePPInside: Math.round(minFareInside),
    minFarePPOutside: Math.round(minFareOutside),
    minFarePPDeluxe: Math.round(minFareDeluxe),
    maxFarePPInside: Math.round(maxFareInside),
    maxFarePPOutside: Math.round(maxFareOutside),
    maxFarePPDeluxe: Math.round(maxFareDeluxe),
    ytdBookedPax: Math.round(ytdBookedPax),
    
    // Performance vs Budget
    ytdBookedRevEUR: Math.round(ytdBookedRevEUR),
    vsTargetPercentYTDBookedRevEUR: Math.round(vsTargetRev * 100) / 100,
    ytdBookedPaxPerformance: Math.round(ytdBookedPax),
    vsTargetPercentYTDBookedPax: Math.round(vsTargetPax * 100) / 100,
    ytdBookedPPP: Math.round(ytdBookedPPP * 100) / 100,
    vsTargetPercentYTDBookedPPP: Math.round(vsTargetPPP * 100) / 100,
    ytdBookedPPPEUR: Math.round(ytdBookedPPPEUR * 100) / 100,
    vsTargetPercentYTDBookedPPPEUR: Math.round(vsTargetPPPEUR * 100) / 100,
    ytdBudgetYTDBookedPPP: Math.round((ytdBookedPPP * 0.97) * 100) / 100,
    ytdBudgetYTDBookedPPPEUR: Math.round((ytdBookedPPPEUR * 0.97) * 100) / 100,
    budgetVsForecastDelta: Math.round(((ytdBookedPPP - ytdBookedPPP * 0.97) / ytdBookedPPP) * 10000) / 100,
    budgetVsForecastDeltaEUR: Math.round((ytdBookedPPPEUR * 0.03) * 100) / 100,
    
    // Recent Performance (LW = Last Week)
    lwBookedRevEUR: Math.round(lwBookedRevEUR),
    lwBookedGroupRevEUR: Math.round(lwBookedGroupRevEUR),
    lwBookedFITRevEUR: Math.round(lwBookedFITRevEUR),
    lwBookedGroupPaxTotal: lwBookedGroupPax,
    lwBookedFITPaxTotal: lwBookedFITPax,
    lwBookedGroupROS: Math.round(lwBookedGroupROS * 10) / 10,
    lwBookedFITROS: Math.round(lwBookedFITROS * 10) / 10,
    lwBookedPaxTotal: lwBookedGroupPax + lwBookedFITPax,
    lwBookedRosTotal: Math.round(((lwBookedGroupROS + lwBookedFITROS) / 2) * 10) / 10,
    lwAvgGroupROS: Math.round(lwBookedGroupROS * 10) / 10,
    lwAvgFITROS: Math.round(lwBookedFITROS * 10) / 10,
    lwAvgCombinedROS: Math.round(((lwBookedGroupROS + lwBookedFITROS) / 2) * 10) / 10,
    groupsLessThan10: Math.round(generateMockValue(voyage, 'groups', seed + 40) * 0.7),
    groupsGreaterThanEqual10: Math.round(generateMockValue(voyage, 'groups', seed + 41) * 0.3),
    groupsReleased: Math.round(generateMockValue(voyage, 'groups', seed + 42) * 0.1),
    
    // Released Space in Last Week
    releasedBookedOFGreaterCX: Math.round(generateMockValue(voyage, 'released', seed + 50)),
    groupsBKGreaterCX: Math.round(generateMockValue(voyage, 'released', seed + 51) * 0.6),
    fitOFGreaterCX: Math.round(generateMockValue(voyage, 'released', seed + 52) * 0.3),
    fitBKGreaterCX: Math.round(generateMockValue(voyage, 'released', seed + 53) * 0.1),
    
    // T&Cs (Terms & Conditions)
    outstandingNoGroups: Math.round(generateMockValue(voyage, 'groups', seed + 60)),
    outstandingBookedPax: Math.round(generateMockValue(voyage, 'pax', seed + 61) * 0.3),
    outstandingGroupReservedPax: Math.round(generateMockValue(voyage, 'pax', seed + 62) * 0.2),
    outstandingGroupAmountEUR: Math.round(generateMockValue(voyage, 'amount', seed + 63)),
    outstandingGroupAmountPercentOfDue: Math.round((generateMockValue(voyage, 'percentage', seed + 64) + 50) * 100) / 100, // 30-70%
    
    // Keep original voyage data for reference
    _originalVoyage: voyage
  };
};

/**
 * Create summary row for a category
 */
const createCategorySummaryRow = (category, voyages) => {
  const summary = {
    accMonth: voyages[0]?.accMonth || '',
    voyageCode: category,
    ship: '',
    sailDate: '',
    package: '',
    itinerary: '',
    voyageCategory: category,
    rowType: 'category',
    
    // Aggregate values (sum for most, average for percentages)
    paxNightsBookedOccupancy: Math.round((voyages.reduce((sum, v) => sum + v.paxNightsBookedOccupancy, 0) / voyages.length) * 100) / 100,
    targetOccupancy: Math.round((voyages.reduce((sum, v) => sum + v.targetOccupancy, 0) / voyages.length) * 100) / 100,
    paxNightsReservedOccupancy: Math.round((voyages.reduce((sum, v) => sum + v.paxNightsReservedOccupancy, 0) / voyages.length) * 100) / 100,
    paxNightsBudgetedOccupancy: Math.round((voyages.reduce((sum, v) => sum + v.paxNightsBudgetedOccupancy, 0) / voyages.length) * 100) / 100,
    
    availableCabinsInside: voyages.reduce((sum, v) => sum + v.availableCabinsInside, 0),
    availabilityPercentInside: Math.round((voyages.reduce((sum, v) => sum + v.availabilityPercentInside, 0) / voyages.length) * 100) / 100,
    availableCabinsOutside: voyages.reduce((sum, v) => sum + v.availableCabinsOutside, 0),
    availabilityPercentOutside: Math.round((voyages.reduce((sum, v) => sum + v.availabilityPercentOutside, 0) / voyages.length) * 100) / 100,
    availableCabinsDeluxe: voyages.reduce((sum, v) => sum + v.availableCabinsDeluxe, 0),
    availabilityPercentDeluxe: Math.round((voyages.reduce((sum, v) => sum + v.availabilityPercentDeluxe, 0) / voyages.length) * 100) / 100,
    availableCabinsSuites: voyages.reduce((sum, v) => sum + v.availableCabinsSuites, 0),
    availabilityPercentSuites: Math.round((voyages.reduce((sum, v) => sum + v.availabilityPercentSuites, 0) / voyages.length) * 100) / 100,
    
    minFarePPInside: Math.round(voyages.reduce((sum, v) => sum + v.minFarePPInside, 0) / voyages.length),
    minFarePPOutside: Math.round(voyages.reduce((sum, v) => sum + v.minFarePPOutside, 0) / voyages.length),
    minFarePPDeluxe: Math.round(voyages.reduce((sum, v) => sum + v.minFarePPDeluxe, 0) / voyages.length),
    maxFarePPInside: Math.round(voyages.reduce((sum, v) => sum + v.maxFarePPInside, 0) / voyages.length),
    maxFarePPOutside: Math.round(voyages.reduce((sum, v) => sum + v.maxFarePPOutside, 0) / voyages.length),
    maxFarePPDeluxe: Math.round(voyages.reduce((sum, v) => sum + v.maxFarePPDeluxe, 0) / voyages.length),
    ytdBookedPax: voyages.reduce((sum, v) => sum + v.ytdBookedPax, 0),
    
    ytdBookedRevEUR: voyages.reduce((sum, v) => sum + v.ytdBookedRevEUR, 0),
    vsTargetPercentYTDBookedRevEUR: Math.round((voyages.reduce((sum, v) => sum + v.vsTargetPercentYTDBookedRevEUR, 0) / voyages.length) * 100) / 100,
    ytdBookedPaxPerformance: voyages.reduce((sum, v) => sum + v.ytdBookedPaxPerformance, 0),
    vsTargetPercentYTDBookedPax: Math.round((voyages.reduce((sum, v) => sum + v.vsTargetPercentYTDBookedPax, 0) / voyages.length) * 100) / 100,
    ytdBookedPPP: Math.round((voyages.reduce((sum, v) => sum + v.ytdBookedPPP, 0) / voyages.length) * 100) / 100,
    vsTargetPercentYTDBookedPPP: Math.round((voyages.reduce((sum, v) => sum + v.vsTargetPercentYTDBookedPPP, 0) / voyages.length) * 100) / 100,
    ytdBookedPPPEUR: Math.round((voyages.reduce((sum, v) => sum + v.ytdBookedPPPEUR, 0) / voyages.length) * 100) / 100,
    vsTargetPercentYTDBookedPPPEUR: Math.round((voyages.reduce((sum, v) => sum + v.vsTargetPercentYTDBookedPPPEUR, 0) / voyages.length) * 100) / 100,
    ytdBudgetYTDBookedPPP: Math.round((voyages.reduce((sum, v) => sum + v.ytdBudgetYTDBookedPPP, 0) / voyages.length) * 100) / 100,
    ytdBudgetYTDBookedPPPEUR: Math.round((voyages.reduce((sum, v) => sum + v.ytdBudgetYTDBookedPPPEUR, 0) / voyages.length) * 100) / 100,
    budgetVsForecastDelta: Math.round((voyages.reduce((sum, v) => sum + v.budgetVsForecastDelta, 0) / voyages.length) * 100) / 100,
    budgetVsForecastDeltaEUR: Math.round((voyages.reduce((sum, v) => sum + v.budgetVsForecastDeltaEUR, 0) / voyages.length) * 100) / 100,
    
    lwBookedRevEUR: voyages.reduce((sum, v) => sum + v.lwBookedRevEUR, 0),
    lwBookedGroupRevEUR: voyages.reduce((sum, v) => sum + v.lwBookedGroupRevEUR, 0),
    lwBookedFITRevEUR: voyages.reduce((sum, v) => sum + v.lwBookedFITRevEUR, 0),
    lwBookedGroupPaxTotal: voyages.reduce((sum, v) => sum + v.lwBookedGroupPaxTotal, 0),
    lwBookedFITPaxTotal: voyages.reduce((sum, v) => sum + v.lwBookedFITPaxTotal, 0),
    lwBookedGroupROS: Math.round((voyages.reduce((sum, v) => sum + v.lwBookedGroupROS, 0) / voyages.length) * 10) / 10,
    lwBookedFITROS: Math.round((voyages.reduce((sum, v) => sum + v.lwBookedFITROS, 0) / voyages.length) * 10) / 10,
    lwBookedPaxTotal: voyages.reduce((sum, v) => sum + v.lwBookedPaxTotal, 0),
    lwBookedRosTotal: Math.round((voyages.reduce((sum, v) => sum + v.lwBookedRosTotal, 0) / voyages.length) * 10) / 10,
    lwAvgGroupROS: Math.round((voyages.reduce((sum, v) => sum + v.lwAvgGroupROS, 0) / voyages.length) * 10) / 10,
    lwAvgFITROS: Math.round((voyages.reduce((sum, v) => sum + v.lwAvgFITROS, 0) / voyages.length) * 10) / 10,
    lwAvgCombinedROS: Math.round((voyages.reduce((sum, v) => sum + v.lwAvgCombinedROS, 0) / voyages.length) * 10) / 10,
    groupsLessThan10: voyages.reduce((sum, v) => sum + v.groupsLessThan10, 0),
    groupsGreaterThanEqual10: voyages.reduce((sum, v) => sum + v.groupsGreaterThanEqual10, 0),
    groupsReleased: voyages.reduce((sum, v) => sum + v.groupsReleased, 0),
    
    releasedBookedOFGreaterCX: voyages.reduce((sum, v) => sum + v.releasedBookedOFGreaterCX, 0),
    groupsBKGreaterCX: voyages.reduce((sum, v) => sum + v.groupsBKGreaterCX, 0),
    fitOFGreaterCX: voyages.reduce((sum, v) => sum + v.fitOFGreaterCX, 0),
    fitBKGreaterCX: voyages.reduce((sum, v) => sum + v.fitBKGreaterCX, 0),
    
    outstandingNoGroups: voyages.reduce((sum, v) => sum + v.outstandingNoGroups, 0),
    outstandingBookedPax: voyages.reduce((sum, v) => sum + v.outstandingBookedPax, 0),
    outstandingGroupReservedPax: voyages.reduce((sum, v) => sum + v.outstandingGroupReservedPax, 0),
    outstandingGroupAmountEUR: voyages.reduce((sum, v) => sum + v.outstandingGroupAmountEUR, 0),
    outstandingGroupAmountPercentOfDue: Math.round((voyages.reduce((sum, v) => sum + v.outstandingGroupAmountPercentOfDue, 0) / voyages.length) * 100) / 100
  };
  
  return summary;
};

/**
 * Create summary row for a month
 */
const createMonthSummaryRow = (month, categories) => {
  // Flatten all voyages from all categories
  const allVoyages = categories.flatMap(cat => cat.voyages);
  
  // Use same aggregation logic as category summary
  return createCategorySummaryRow(month, allVoyages);
};

/**
 * Transform raw master_sail data into hierarchical structure
 */
export const transformVoyageData = (rawData) => {
  if (!rawData || rawData.length === 0) {
    return [];
  }
  
  // Transform all voyage records
  const transformedVoyages = rawData.map((voyage, index) => 
    transformVoyageRecord(voyage, index)
  );
  
  // Group by month
  const byMonth = {};
  transformedVoyages.forEach(voyage => {
    const month = voyage.accMonth;
    if (!byMonth[month]) {
      byMonth[month] = [];
    }
    byMonth[month].push(voyage);
  });
  
  // Build hierarchical structure
  const result = [];
  
  Object.keys(byMonth).sort().forEach(month => {
    const monthVoyages = byMonth[month];
    
    // Group by category within month
    const byCategory = {};
    monthVoyages.forEach(voyage => {
      const category = voyage.voyageCategory;
      if (!byCategory[category]) {
        byCategory[category] = [];
      }
      byCategory[category].push(voyage);
    });
    
    // Create month header row
    const monthSummary = {
      ...createMonthSummaryRow(month, Object.values(byCategory).map(v => ({ voyages: v }))),
      accMonth: month,
      voyageCode: month,
      rowType: 'month',
      voyageCategory: ''
    };
    result.push(monthSummary);
    
    // Add category groups and voyages
    Object.keys(byCategory).sort().forEach(category => {
      const categoryVoyages = byCategory[category];
      
      // Create category summary row
      const categorySummary = createCategorySummaryRow(category, categoryVoyages);
      result.push(categorySummary);
      
      // Add individual voyage rows
      categoryVoyages.forEach(voyage => {
        result.push(voyage);
      });
    });
  });
  
  // Add total row at the end
  const totalRow = createCategorySummaryRow('Total', transformedVoyages);
  totalRow.accMonth = 'Total';
  totalRow.voyageCode = 'Total';
  totalRow.rowType = 'total';
  result.push(totalRow);
  
  return result;
};
