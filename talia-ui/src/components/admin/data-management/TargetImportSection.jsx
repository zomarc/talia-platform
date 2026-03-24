/**
 * Target Import Section - Data Management
 * Load BOOKINGTARGET_*.csv into booking_targets_supplied table
 */

import React, { useState, useRef } from 'react';
import Papa from 'papaparse';

const GRAPHQL_URL = '/api/graphql';

const findCol = (row, ...candidates) => {
  const norm = (n) => String(n || '').trim().toLowerCase().replace(/[-_\s]/g, '');
  const keys = Object.keys(row || {});
  for (const c of candidates) {
    const nc = norm(c);
    const found = keys.find((k) => norm(k) === nc);
    if (found) return row[found];
  }
  return undefined;
};

const csvToRows = (csvText) => {
  const result = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  const rows = [];
  const errors = [];
  (result.data || []).forEach((row, i) => {
    const sailCode = findCol(row, 'sail_code', 'sailcode', 'Sail_Code') ||
      findCol(row, 'reference_sail_code');
    const weekLabel = findCol(row, 'week_label', 'weeklabel', 'week') ||
      (findCol(row, 'weeks_until_sailing') != null ? `W-${findCol(row, 'weeks_until_sailing')}` : null);
    const weeksUntil = parseInt(findCol(row, 'weeks_until_sailing', 'weeksuntilsailing'), 10);
    const targetBookings = parseInt(findCol(row, 'target_bookings', 'targetbookings', 'target'), 10);
    const targetGuests = parseInt(findCol(row, 'target_guests', 'targetguests'), 10);

    if (!sailCode) {
      errors.push(`Row ${i + 2}: Missing sail_code`);
      return;
    }
    if (!weekLabel && !Number.isFinite(weeksUntil)) {
      errors.push(`Row ${i + 2}: Missing week_label or weeks_until_sailing`);
      return;
    }

    rows.push({
      sailCode: String(sailCode).trim(),
      shipCode: findCol(row, 'ship_code', 'shipcode') ? String(findCol(row, 'ship_code', 'shipcode')).trim() : undefined,
      weekLabel: weekLabel || (Number.isFinite(weeksUntil) ? `W-${weeksUntil}` : ''),
      weeksUntilSailing: Number.isFinite(weeksUntil) ? weeksUntil : undefined,
      targetBookings: Number.isFinite(targetBookings) ? targetBookings : 0,
      targetGuests: Number.isFinite(targetGuests) ? targetGuests : 0,
    });
  });
  return { rows, errors };
};

const TargetImportSection = ({ addClientLog, logIdCounterRef, onImportComplete, compact = false }) => {
  const [importing, setImporting] = useState(false);
  const [lastImport, setLastImport] = useState(null);
  const [storeLocation, setStoreLocation] = useState(() => {
    try {
      return localStorage.getItem('talia.target.storeLocation') || 'local-target-store';
    } catch {
      return 'local-target-store';
    }
  });
  const [storeLocationDraft, setStoreLocationDraft] = useState(storeLocation);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);

    const log = (msg, type = 'info') => {
      addClientLog?.({
        id: `${Date.now()}-${++logIdCounterRef.current}`,
        timestamp: new Date(),
        type,
        message: msg,
        tableName: 'booking_targets_supplied',
      });
    };

    try {
      const text = await file.text();
      const { rows, errors } = csvToRows(text);

      if (errors.length > 0) {
        errors.slice(0, 5).forEach((err) => log(err, 'error'));
        if (errors.length > 5) log(`…and ${errors.length - 5} more errors`, 'error');
      }

      if (rows.length === 0) {
        log('No valid rows to import. Check CSV format (sail_code, week_label, target_bookings).', 'error');
        setImporting(false);
        return;
      }

      log(`Importing ${rows.length} target rows from ${file.name} into ${storeLocation}...`);

      const mutation = `
        mutation ImportTargetData($rows: [TargetDataRowInput!]!) {
          importTargetData(rows: $rows) {
            success
            rowsImported
            batchId
            errors
          }
        }
      `;

      const res = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: mutation, variables: { rows } }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.errors?.length) throw new Error(json.errors[0].message);

      const data = json.data?.importTargetData;
      if (!data?.success) {
        throw new Error(data?.errors?.[0] || 'Import failed');
      }

      setLastImport({ at: new Date(), count: data.rowsImported });
      log(`✅ Imported ${data.rowsImported} target rows into booking_targets_supplied.`, 'success');
      onImportComplete?.();
    } catch (err) {
      log(`❌ Import failed: ${err?.message || err}`, 'error');
    } finally {
      setImporting(false);
    }
  };

  const saveStoreLocation = () => {
    const normalized = String(storeLocationDraft || '').trim() || 'local-target-store';
    setStoreLocation(normalized);
    try {
      localStorage.setItem('talia.target.storeLocation', normalized);
    } catch {
      // no-op for environments without localStorage
    }
    addClientLog?.({
      id: `${Date.now()}-${++logIdCounterRef.current}`,
      timestamp: new Date(),
      type: 'info',
      message: `Local target store set to "${normalized}"`,
      tableName: 'booking_targets_supplied',
    });
  };

  return (
    <div className={`dm-target-import ${compact ? 'dm-target-import--compact' : ''}`.trim()}>
      <div className="dm-target-import__header">
        <span className="dm-target-import__title">
          {compact ? 'Target CSV import' : 'Booking Targets (supplied)'}
        </span>
        <span className="dm-target-import__desc">
          {compact ? 'Import BOOKINGTARGET_*.csv into local target store' : 'Import BOOKINGTARGET_*.csv into central store'}
        </span>
      </div>
      <div className="dm-target-import__store">
        <label className="dm-target-import__store-label" htmlFor="target-store-location">
          Local store location
        </label>
        <input
          id="target-store-location"
          className="dm-target-import__store-input"
          value={storeLocationDraft}
          onChange={(e) => setStoreLocationDraft(e.target.value)}
          placeholder="e.g. shared-targets-2026"
        />
        <button
          type="button"
          className="talia-btn talia-btn--secondary talia-btn--small"
          onClick={saveStoreLocation}
        >
          Set location
        </button>
      </div>
      <div className="dm-target-import__actions">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          className="talia-btn talia-btn--primary talia-btn--small"
          disabled={importing}
          onClick={() => fileInputRef.current?.click()}
        >
          {importing ? 'Importing…' : 'Import target CSV'}
        </button>
        {lastImport && (
          <span className="dm-target-import__last">
            Last: {lastImport.count} rows at {lastImport.at.toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
};

export default TargetImportSection;
