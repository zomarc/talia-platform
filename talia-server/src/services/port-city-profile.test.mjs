import assert from 'node:assert/strict';
import test from 'node:test';
import { applyPortCityProfile, isAirportCode, regionFor } from './port-city-profile.js';

test('splits commercial regions without filing Sharm under the Mediterranean', () => {
  assert.equal(regionFor({ latitude: 37.85, longitude: 27.25, countryCode: 'TR' }), 'Mediterranean');
  assert.equal(regionFor({ latitude: 38.72, longitude: -9.13, countryCode: 'PT' }), 'Mediterranean');
  assert.equal(regionFor({ latitude: 31.18, longitude: 29.92, countryCode: 'EG' }), 'Mediterranean');
  assert.equal(regionFor({ latitude: 27.87, longitude: 34.28, countryCode: 'EG' }), 'Arabian & Red Sea');
  assert.equal(regionFor({ latitude: 25.25, longitude: 55.27, countryCode: 'AE' }), 'Arabian & Red Sea');
  assert.equal(regionFor({ latitude: 25.8, longitude: -80.2, countryCode: 'US' }), 'United States');
  assert.equal(regionFor({ latitude: 18.0, longitude: -76.8, countryCode: 'JM' }), 'Caribbean');
  assert.equal(regionFor({ latitude: 50.9, longitude: -1.4, countryCode: 'GB' }), 'Northern Europe');
  assert.equal(regionFor({ latitude: -33.9, longitude: 18.4, countryCode: 'ZA' }), 'Rest of World');
});

test('reads the airport flag from UN/LOCODE function position 4', () => {
  assert.equal(isAirportCode('---4----'), true);
  assert.equal(isAirportCode('1--4----'), true);
  assert.equal(isAirportCode('1-------'), false);
  assert.equal(isAirportCode(''), false);
});

test('marks Celestyal ports and keeps the sourced Kusadasi address', () => {
  const [kusadasi, inland] = applyPortCityProfile([
    {
      country_location: 'TRKUS',
      port_name: 'Kusadasi',
      function_code: '1-------',
      latitude: 37.85,
      longitude: 27.25,
      country_code: 'TR',
      wpi: '44770',
    },
    {
      country_location: 'XXINL',
      port_name: 'Somewhere',
      function_code: '---4----',
      latitude: 10,
      longitude: 10,
      country_code: 'XX',
    },
  ]);
  assert.equal(kusadasi.is_celestyal, true);
  assert.equal(kusadasi.is_cruise, true);
  assert.equal(kusadasi.is_airport, false);
  assert.equal(kusadasi.port_address, 'Kusadasi - Aydin 09400, Ege Ports Guvercinada Caddesi No:2');
  assert.equal(kusadasi.address_label, 'Kusadasi, Turkey');
  assert.equal(kusadasi.region, 'Mediterranean');
  assert.equal(inland.is_celestyal, false);
  assert.equal(inland.is_cruise, false);
  assert.equal(inland.is_airport, true);
  assert.equal(inland.port_address, null);
});

test('keeps one row when the warehouse repeats a location code', () => {
  const rows = applyPortCityProfile([
    { country_location: 'GRLAV', port_name: 'Lavrio', function_code: '1-------', latitude: 37.72, longitude: 24.07, country_code: 'GR' },
    { country_location: 'GRLAV', port_name: 'Lavrio', function_code: '1-------', latitude: 37.72, longitude: 24.07, country_code: 'GR' },
    { country_location: 'GRPIR', port_name: 'Piraievs', function_code: '1-------', latitude: 37.93, longitude: 23.62, country_code: 'GR', wpi: '42230' },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows.filter((row) => row.country_location === 'GRLAV').length, 1);
  assert.match(rows.find((row) => row.country_location === 'GRLAV').port_address, /Akti Papandreou Andrea/);
});
