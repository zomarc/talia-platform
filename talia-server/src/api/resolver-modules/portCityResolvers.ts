import { supabaseDataService } from '../../services/supabase.js';

const MAX_LIMIT = 20000;

const cleanSearch = (value) => String(value || '')
  .trim()
  .replace(/[%_,()]/g, '')
  .slice(0, 80);

const applyFilters = (query, filters = {}) => {
  const search = cleanSearch(filters.search);
  if (search) {
    const pattern = `"%${search}%"`;
    query = query.or([
      `port_name.ilike.${pattern}`,
      `location_code.ilike.${pattern}`,
      `country_location.ilike.${pattern}`,
      `latitude_longitude.ilike.${pattern}`,
      `nearest_port_name.ilike.${pattern}`,
      `name_wo_diacritics.ilike.${pattern}`,
    ].join(','));
  }
  const country = String(filters.countryCode || '').trim().toUpperCase();
  if (country) query = query.eq('country_code', country);
  const functionName = String(filters.functionName || '').trim();
  if (functionName === 'Port') query = query.eq('function_name', 'Port');
  if (functionName === 'Other') query = query.neq('function_name', 'Port');
  const kind = String(filters.kind || '').trim().toLowerCase();
  if (kind === 'cruise') query = query.eq('is_cruise', true);
  if (kind === 'celestyal') query = query.eq('is_celestyal', true);
  if (kind === 'port') query = query.eq('is_port', true);
  if (kind === 'airport') query = query.eq('is_airport', true);
  const region = String(filters.region || '').trim();
  if (region) query = query.eq('region', region);
  if (filters.minDistanceNm != null && filters.minDistanceNm !== '') {
    const min = Number(filters.minDistanceNm);
    if (Number.isFinite(min)) query = query.gte('nearest_distance_nm', min);
  }
  if (filters.maxDistanceNm != null && filters.maxDistanceNm !== '') {
    const max = Number(filters.maxDistanceNm);
    if (Number.isFinite(max)) query = query.lte('nearest_distance_nm', max);
  }
  return query;
};

const mapRow = (row) => ({
  countryLocation: row.country_location,
  countryCode: row.country_code,
  locationCode: row.location_code,
  portName: row.port_name,
  portCity: row.port_city,
  nameWoDiacritics: row.name_wo_diacritics,
  functionName: row.function_name,
  functionCode: row.function_code,
  latitudeLongitude: row.latitude_longitude,
  latitude: row.latitude,
  longitude: row.longitude,
  nearestPortCode: row.nearest_port_code,
  nearestPortName: row.nearest_port_name,
  nearestDistanceNm: row.nearest_distance_nm,
  isPort: row.is_port === true,
  wpi: row.wpi,
  isCruise: row.is_cruise === true,
  isAirport: row.is_airport === true,
  isCelestyal: row.is_celestyal === true,
  region: row.region,
  portAddress: row.port_address,
  addressLabel: row.address_label,
});

const exactCount = async (configure) => {
  let query = supabaseDataService.client
    .from('port_city')
    .select('country_location', { count: 'exact', head: true });
  query = configure(query);
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count || 0;
};

export const portCityQueryResolvers = {
  portCityPage: async (_parent, args) => {
    const filters = args?.filters || {};
    const limit = Math.min(Math.max(Number(filters.limit) || 2000, 1), MAX_LIMIT);
    const offset = Math.max(Number(filters.offset) || 0, 0);

    const [total, withCoordinates, ports, labeled, cruise, celestyal, airports, matchCount] = await Promise.all([
      exactCount((query) => query),
      exactCount((query) => query.not('latitude', 'is', null)),
      exactCount((query) => query.eq('function_name', 'Port')),
      exactCount((query) => query.not('nearest_port_code', 'is', null)),
      exactCount((query) => query.eq('is_cruise', true)),
      exactCount((query) => query.eq('is_celestyal', true)),
      exactCount((query) => query.eq('is_airport', true)),
      exactCount((query) => applyFilters(query, filters)),
    ]);

    let query = supabaseDataService.client
      .from('port_city')
      .select('*')
      .order('is_celestyal', { ascending: false })
      .order('port_name', { ascending: true })
      .order('country_location', { ascending: true })
      .range(offset, offset + limit - 1);
    query = applyFilters(query, filters);
    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return {
      total,
      withCoordinates,
      ports,
      labeled,
      cruise,
      celestyal,
      airports,
      matchCount,
      rows: (data || []).map(mapRow),
    };
  },
};
