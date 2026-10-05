/**
 * Load dwh.Dim_Port_City into public.port_city and label nearest ports.
 */
import sql from 'mssql';
import { supabaseDataService } from './supabase.js';
import { applyPortCityProfile } from './port-city-profile.js';
import { applyNgaNames, parseLatitudeLongitude } from './port-city-label.js';

const textOrNull = (value) => {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
};

export function mapPortCityRow(row) {
  const latitudeLongitude = textOrNull(row.Latitude_Longitude ?? row.latitude_longitude);
  const parsed = parseLatitudeLongitude(latitudeLongitude);
  const functionName = textOrNull(row.Function_Name ?? row.function_name);
  const countryCode = textOrNull(row.Country_Code ?? row.country_code);
  const locationCode = textOrNull(row.Location_Code ?? row.location_code);
  const countryLocation = textOrNull(row.Country_Location ?? row.country_location)
    || (countryCode && locationCode ? `${countryCode}${locationCode}` : null);
  return {
    country_location: countryLocation,
    country_code: countryCode,
    location_code: locationCode,
    port_name: textOrNull(row.Port_Name ?? row.port_name),
    port_city: textOrNull(row.Port_City ?? row.port_city),
    name_wo_diacritics: textOrNull(row.NameWoDiacritics ?? row.name_wo_diacritics),
    function_code: textOrNull(row.Function_Code ?? row.function_code),
    function_name: functionName,
    status_code: textOrNull(row.Status_Code ?? row.status_code),
    latitude_longitude: latitudeLongitude,
    latitude: parsed?.latitude ?? null,
    longitude: parsed?.longitude ?? null,
    is_port: functionName === 'Port',
    updated_at: new Date().toISOString(),
  };
}

async function deleteAllPortCities(client) {
  for (;;) {
    const { data, error } = await client
      .from('port_city')
      .delete()
      .gte('id', 0)
      .select('id')
      .limit(1000);
    if (error) throw error;
    if (!data?.length) break;
  }
}

async function insertPortCities(client, rows, logger) {
  const batchSize = 1000;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await client.from('port_city').insert(batch);
    if (error) throw error;
    logger?.info?.(`Inserted ${Math.min(i + batch.length, rows.length)}/${rows.length} port cities`);
  }
}

export async function syncPortCityFromSynapse({ logger, synapseConfig } = {}) {
  const started = Date.now();
  const config = synapseConfig || {
    server: process.env.AZURE_SYNAPSE_SERVER,
    port: parseInt(process.env.AZURE_SYNAPSE_PORT || '1433', 10),
    database: process.env.AZURE_SYNAPSE_DATABASE,
    user: process.env.AZURE_SYNAPSE_USERNAME,
    password: process.env.AZURE_SYNAPSE_PASSWORD,
    options: { encrypt: true, trustServerCertificate: false, enableArithAbort: true },
    requestTimeout: 180000,
  };
  if (!config.server) {
    throw new Error('AZURE_SYNAPSE_SERVER is not configured');
  }

  logger?.info?.('Loading dwh.Dim_Port_City');
  const pool = await sql.connect(config);
  let recordset;
  try {
    const result = await pool.request().query(`
      SELECT
        Country_Location,
        Country_Code,
        Location_Code,
        Port_Name,
        Port_City,
        NameWoDiacritics,
        Function_Code,
        Function_Name,
        Status_Code,
        Latitude_Longitude
      FROM dwh.Dim_Port_City
    `);
    recordset = result.recordset || [];
  } finally {
    await pool.close();
  }

  const mapped = recordset
    .map(mapPortCityRow)
    .filter((row) => row.country_location);
  const labeled = applyPortCityProfile(applyNgaNames(mapped));
  logger?.info?.(`Labeled ${labeled.length} locations with nearest port`);

  const client = supabaseDataService.client;
  await deleteAllPortCities(client);
  await insertPortCities(client, labeled, logger);

  return {
    tableName: 'portCity',
    success: true,
    recordsProcessed: labeled.length,
    duration: Date.now() - started,
    message: `Synced ${labeled.length} port cities`,
  };
}
