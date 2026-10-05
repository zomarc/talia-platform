import assert from 'node:assert/strict';
import test from 'node:test';
import { applyNgaNames, labelNearestPorts, parseLatitudeLongitude, restoreDisplayName } from './port-city-label.js';

test('restores accented names the warehouse stored as question marks', () => {
  const lookup = { FRHOT: "Île-d'Houat", NOAES: 'Ålesund' };
  const restored = restoreDisplayName({
    country_location: 'FRHOT',
    port_name: "?le-d'Houat",
    name_wo_diacritics: "Ile-d'Houat",
  }, lookup);
  assert.equal(restored.port_name, "Île-d'Houat");
  const kept = restoreDisplayName({
    country_location: 'GRPIR',
    port_name: 'Piraeus',
    name_wo_diacritics: 'Piraeus',
  }, lookup);
  assert.equal(kept.port_name, 'Piraeus');
  assert.equal(restoreDisplayName({
    country_location: 'NOAES',
    port_name: 'Alesund',
    name_wo_diacritics: 'Alesund',
  }, lookup).port_name, 'Ålesund');
  assert.equal(restoreDisplayName({
    country_location: 'AX',
    location_code: null,
    port_name: '.?LAND ISLANDS',
    name_wo_diacritics: '',
  }, {}).port_name, 'Åland Islands');
  assert.equal(restoreDisplayName({
    country_location: 'DE',
    location_code: '',
    port_name: 'Cologne = K?ln',
    name_wo_diacritics: 'Cologne = Koln',
  }, {}).port_name, 'Cologne = Köln');
});

test('parses UN/LOCODE degrees and minutes', () => {
  const piraeus = parseLatitudeLongitude('3756N 02337E');
  assert.equal(piraeus.latitude, 37.933333);
  assert.equal(piraeus.longitude, 23.616667);

  const south = parseLatitudeLongitude('0734S 04404W');
  assert.equal(south.latitude, -7.566667);
  assert.equal(south.longitude, -44.066667);
  assert.equal(parseLatitudeLongitude('2444N 05045'), null);
});

test('uses NGA World Port Index names instead of the warehouse name', () => {
  const nga = [
    { wpi: '42230', name: 'Piraievs', unlocode: 'GRPIR', lat: 37.933333, lon: 23.65 },
    { wpi: '44770', name: 'Kusadasi', unlocode: 'TRKUS', lat: 37.866667, lon: 27.25 },
  ];
  const [piraeus, inland] = applyNgaNames([
    {
      country_location: 'GRPIR',
      port_name: 'Piraeus',
      latitude: 37.933333,
      longitude: 23.616667,
    },
    {
      country_location: 'XXINL',
      port_name: '?junk',
      latitude: 37.94,
      longitude: 23.62,
    },
  ], nga);
  assert.equal(piraeus.port_name, 'Piraievs');
  assert.equal(piraeus.wpi, '42230');
  assert.equal(piraeus.nearest_port_name, 'Piraievs');
  assert.equal(piraeus.nearest_port_code, '42230');
  assert.equal(inland.port_name, 'Piraievs');
  assert.ok(inland.nearest_distance_nm < 3);
  const [far] = applyNgaNames([
    {
      country_location: 'FRHOT',
      port_name: "?le-d'Houat",
      latitude: 47.383333,
      longitude: -3.05,
    },
  ], nga);
  assert.equal(far.port_name, null);
  assert.equal(far.wpi, null);
  assert.ok(far.nearest_port_name);
});

test('labels the sample coordinates with themselves when they are ports', () => {
  const samples = [
    ['GRPIR', 'Piraeus', '3756N 02337E'],
    ['TRKUS', 'Kusadasi', '3751N 02715E'],
    ['TRIST', 'Istanbul', '4101N 02858E'],
  ].map(([country_location, port_name, latitude_longitude]) => {
    const parsed = parseLatitudeLongitude(latitude_longitude);
    return {
      country_location,
      port_name,
      function_name: 'Port',
      latitude_longitude,
      ...parsed,
    };
  });

  const inland = {
    country_location: 'XXINL',
    port_name: 'Inland point',
    function_name: 'Unknown',
    latitude: 37.94,
    longitude: 23.62,
  };

  const labeled = labelNearestPorts([...samples, inland]);
  const byCode = Object.fromEntries(labeled.map((row) => [row.country_location, row]));

  assert.equal(byCode.GRPIR.nearest_port_name, 'Piraeus');
  assert.equal(byCode.GRPIR.nearest_distance_nm, 0);
  assert.equal(byCode.TRKUS.nearest_port_name, 'Kusadasi');
  assert.equal(byCode.TRIST.nearest_port_name, 'Istanbul');
  assert.equal(byCode.XXINL.nearest_port_name, 'Piraeus');
  assert.ok(byCode.XXINL.nearest_distance_nm < 2);
});
