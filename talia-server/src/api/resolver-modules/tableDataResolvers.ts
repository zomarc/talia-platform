type BuildTableDataResolversDeps = {
  supabaseDataService: any;
};

export const buildTableDataQueryResolvers = ({
  supabaseDataService
}: BuildTableDataResolversDeps) => ({
  tableData: async (_parent: any, args: any) => {
    const { tableName, limit = 100, filters } = args;
    try {
      const includeNonRealSailings = filters?.include_non_real_sailings === true;
      const baseLimit = Number.isFinite(Number(limit)) ? Number(limit) : 100;
      const expandedLimit = tableName === 'agency'
        ? Math.min(Math.max(baseLimit, 100), 50000)
        : (includeNonRealSailings ? baseLimit : Math.min(Math.max(baseLimit * 3, baseLimit), 5000));

      let query = supabaseDataService.client
        .from(tableName)
        .select('*');

      if (filters) {
        if (filters.sail_code) {
          query = query.eq('sail_code', filters.sail_code);
          console.log(`[tableData] Applied filter: sail_code = ${filters.sail_code}`);
        }
        if (Array.isArray(filters.sail_codes) && filters.sail_codes.length > 0) {
          const sailCodes = filters.sail_codes
            .map((value: unknown) => String(value).trim())
            .filter((value: string) => value.length > 0);
          if (sailCodes.length === 1) {
            query = query.eq('sail_code', sailCodes[0]);
            console.log(`[tableData] Applied filter: sail_code = ${sailCodes[0]}`);
          } else if (sailCodes.length > 1) {
            query = query.in('sail_code', sailCodes);
            console.log(`[tableData] Applied filter: sail_code IN (${sailCodes.join(', ')})`);
          }
        }
        if (filters.ship_code) {
          query = query.eq('ship_code', filters.ship_code);
          console.log(`[tableData] Applied filter: ship_code = ${filters.ship_code}`);
        }
        if (filters.cabin_category) {
          query = query.eq('cabin_category', filters.cabin_category);
          console.log(`[tableData] Applied filter: cabin_category = ${filters.cabin_category}`);
        }
        if (filters.ship_name) {
          query = query.eq('ship_name', filters.ship_name);
          console.log(`[tableData] Applied filter: ship_name = ${filters.ship_name}`);
        }
        if (filters.package_name) {
          query = query.eq('package_name', filters.package_name);
          console.log(`[tableData] Applied filter: package_name = ${filters.package_name}`);
        }
        if (filters.package_type) {
          query = query.eq('package_type', filters.package_type);
          console.log(`[tableData] Applied filter: package_type = ${filters.package_type}`);
        }
        if (filters.geog_area_code) {
          query = query.eq('geog_area_code', filters.geog_area_code);
          console.log(`[tableData] Applied filter: geog_area_code = ${filters.geog_area_code}`);
        }
        if (filters.departure_date_from) {
          query = query.gte('departure_date', filters.departure_date_from);
          console.log(`[tableData] Applied filter: departure_date >= ${filters.departure_date_from}`);
        }
        if (filters.departure_date_to) {
          query = query.lte('departure_date', filters.departure_date_to);
          console.log(`[tableData] Applied filter: departure_date <= ${filters.departure_date_to}`);
        }
        if (filters.agency_id !== undefined && filters.agency_id !== null && String(filters.agency_id).trim() !== '') {
          query = query.eq('agency_id', filters.agency_id);
          console.log(`[tableData] Applied filter: agency_id = ${filters.agency_id}`);
        }
        if (filters.market) {
          query = query.eq('market', filters.market);
          console.log(`[tableData] Applied filter: market = ${filters.market}`);
        }
        if (filters.agency_type) {
          query = query.eq('agency_type', filters.agency_type);
          console.log(`[tableData] Applied filter: agency_type = ${filters.agency_type}`);
        }
        if (filters.country_code) {
          query = query.eq('country_code', filters.country_code);
          console.log(`[tableData] Applied filter: country_code = ${filters.country_code}`);
        }
        if (filters.status) {
          query = query.eq('status', filters.status);
          console.log(`[tableData] Applied filter: status = ${filters.status}`);
        }
        if (filters.is_main !== undefined && filters.is_main !== null && String(filters.is_main).trim() !== '') {
          query = query.eq('is_main', Number(filters.is_main));
          console.log(`[tableData] Applied filter: is_main = ${filters.is_main}`);
        }
        if (filters.sailing_role) {
          query = query.eq('sailing_role', filters.sailing_role);
          console.log(`[tableData] Applied filter: sailing_role = ${filters.sailing_role}`);
        }
        if (filters.is_operational !== undefined && filters.is_operational !== null) {
          const operational = filters.is_operational === true || String(filters.is_operational).toLowerCase() === 'true';
          query = query.eq('is_operational', operational);
          console.log(`[tableData] Applied filter: is_operational = ${operational}`);
        }
        if (filters.query_column && filters.query_value !== undefined && filters.query_value !== null && String(filters.query_value).trim() !== '') {
          const column = String(filters.query_column).trim();
          const value = String(filters.query_value).trim();
          const operator = String(filters.query_operator || 'contains').toLowerCase();
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
            throw new Error(`Invalid query column: ${column}`);
          }
          if (operator === 'eq') {
            query = query.eq(column, value);
          } else if (operator === 'neq') {
            query = query.neq(column, value);
          } else if (operator === 'starts_with') {
            query = query.ilike(column, `${value}%`);
          } else if (operator === 'ends_with') {
            query = query.ilike(column, `%${value}`);
          } else if (operator === 'gt') {
            query = query.gt(column, value);
          } else if (operator === 'gte') {
            query = query.gte(column, value);
          } else if (operator === 'lt') {
            query = query.lt(column, value);
          } else if (operator === 'lte') {
            query = query.lte(column, value);
          } else {
            query = query.ilike(column, `%${value}%`);
          }
          console.log(`[tableData] Applied generic query filter: ${column} ${operator} ${value}`);
        }
        if (!includeNonRealSailings && tableName === 'master_sail') {
          query = query.neq('is_active', 'N').neq('is_fake', 'Y');
          console.log('[tableData] Applied default real-sailing filter for master_sail (exclude is_active=N, is_fake=Y)');
        }
      }

      if (tableName === 'published_rates_changes') {
        query = query.order('snapshot_date', { ascending: false }).order('id', { ascending: false });
      }
      if (tableName === 'published_rates_current_state') {
        query = query.order('snapshot_date', { ascending: false }).order('rate_key', { ascending: true });
      }
      if (tableName === 'agency') {
        query = query.order('agency_name', { ascending: true });
      }

      query = query.limit(expandedLimit);
      let { data, error } = await query;

      if (error) {
        console.error(`Error fetching table data for ${tableName}:`, error);
        throw new Error(`Failed to fetch data from ${tableName}: ${error.message}`);
      }

      if (!includeNonRealSailings && tableName !== 'master_sail' && Array.isArray(data) && data.length > 0) {
        const rowSailCodes = Array.from(
          new Set(
            data
              .map((row: any) => row?.sail_code)
              .filter((value: any) => typeof value === 'string' && value.trim().length > 0)
          )
        );

        if (rowSailCodes.length > 0) {
          const { data: nonRealRows, error: nonRealError } = await supabaseDataService.client
            .from('master_sail')
            .select('sail_code')
            .in('sail_code', rowSailCodes)
            .or('is_active.eq.N,is_fake.eq.Y');

          if (nonRealError) {
            console.warn(`[tableData] Could not resolve non-real sailings from master_sail for ${tableName}:`, nonRealError.message);
          } else {
            const excludedSailCodes = new Set(
              (nonRealRows || [])
                .map((row: any) => row?.sail_code)
                .filter((value: any) => typeof value === 'string' && value.length > 0)
            );

            if (excludedSailCodes.size > 0) {
              data = data.filter((row: any) => {
                const sailCode = row?.sail_code;
                if (typeof sailCode !== 'string' || sailCode.length === 0) return true;
                return !excludedSailCodes.has(sailCode);
              });
              console.log(`[tableData] Excluded ${excludedSailCodes.size} non-real sail_code values via master_sail reference for ${tableName}`);
            }
          }
        }
      }

      const limitedData = Array.isArray(data) ? data.slice(0, baseLimit) : [];
      console.log(`[tableData] Fetched ${limitedData.length} records from ${tableName}${filters ? ' with filters' : ''}`);
      return limitedData;
    } catch (error: any) {
      console.error(`Error in tableData resolver for ${tableName}:`, error);
      throw error;
    }
  },
});
