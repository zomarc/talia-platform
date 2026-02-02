/**
 * Data Types Library Validation Component
 * 
 * This component validates that the shared data types library works correctly
 * with Tabulator. It creates a test table using all data types to ensure
 * formatters, sorters, and filters function properly.
 * 
 * This is a development/validation component and should not be used in production.
 */

import React, { useRef, useEffect, useState } from 'react';
import { initTabulator } from '../../lib/tabulatorConfig';
import { Currency, Percentage, DateType, Number } from '../../lib/dataTypes';
import '../../styles/dev-components.css';

/**
 * Validation component for data types library
 */
const DataTypesValidation = () => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const [tableInitialized, setTableInitialized] = useState(false);
  const [validationResults, setValidationResults] = useState({
    imports: false,
    formatters: false,
    columnBuilders: false,
    tableRendering: false
  });

  // Test data with various data types
  const testData = [
    {
      id: 1,
      currency_value: 1234.56,
      percentage_value: 85.5,
      date_value: '2026-01-21',
      number_value: 1234567,
      description: 'Test Row 1'
    },
    {
      id: 2,
      currency_value: 5678.90,
      percentage_value: 92.3,
      date_value: '2026-02-15',
      number_value: 2345678,
      description: 'Test Row 2'
    },
    {
      id: 3,
      currency_value: 9012.34,
      percentage_value: 45.7,
      date_value: '2026-03-10',
      number_value: 3456789,
      description: 'Test Row 3'
    },
    {
      id: 4,
      currency_value: null,
      percentage_value: null,
      date_value: null,
      number_value: null,
      description: 'Null Values Test'
    }
  ];

  // Validate imports
  useEffect(() => {
    try {
      const hasCurrency = typeof Currency === 'object' && Currency.formatter && Currency.toTabulatorColumn;
      const hasPercentage = typeof Percentage === 'object' && Percentage.formatter && Percentage.toTabulatorColumn;
      const hasDateType = typeof DateType === 'object' && DateType.formatter && DateType.toTabulatorColumn;
      const hasNumber = typeof Number === 'object' && Number.formatter && Number.toTabulatorColumn;

      setValidationResults(prev => ({
        ...prev,
        imports: hasCurrency && hasPercentage && hasDateType && hasNumber
      }));

      if (hasCurrency && hasPercentage && hasDateType && hasNumber) {
        console.log('[DataTypesValidation] ✓ All imports successful');
      } else {
        console.error('[DataTypesValidation] ✗ Import validation failed');
      }
    } catch (error) {
      console.error('[DataTypesValidation] Import error:', error);
    }
  }, []);

  // Validate formatters
  useEffect(() => {
    try {
      const mockCell = {
        getValue: () => 1234.56,
        getElement: () => ({ style: {} })
      };

      const currencyResult = Currency.formatter(mockCell, { currency: 'EUR' });
      const percentageResult = Percentage.formatter(mockCell, { decimals: 2 });
      const numberResult = Number.formatter(mockCell);
      const dateMockCell = { getValue: () => '2026-01-21', getElement: () => ({ style: {} }) };
      const dateResult = DateType.formatter(dateMockCell, { format: 'short' });
      
      console.log('[DataTypesValidation] DateType formatter test - Input: 2026-01-21, Output:', dateResult);

      const allValid = 
        typeof currencyResult === 'string' && currencyResult.length > 0 &&
        typeof percentageResult === 'string' && percentageResult.includes('%') &&
        typeof numberResult === 'string' && numberResult.length > 0 &&
        typeof dateResult === 'string' && dateResult.length > 0;

      setValidationResults(prev => ({
        ...prev,
        formatters: allValid
      }));

      if (allValid) {
        console.log('[DataTypesValidation] ✓ All formatters working');
        console.log('[DataTypesValidation] Sample outputs:', {
          currency: currencyResult,
          percentage: percentageResult,
          number: numberResult,
          date: dateResult
        });
      } else {
        console.error('[DataTypesValidation] ✗ Formatter validation failed');
      }
    } catch (error) {
      console.error('[DataTypesValidation] Formatter error:', error);
    }
  }, []);

  // Validate column builders
  useEffect(() => {
    try {
      const currencyCol = Currency.toTabulatorColumn('price', 'Price', { currency: 'EUR' });
      const percentageCol = Percentage.toTabulatorColumn('occupancy', 'Occupancy %');
      const dateCol = DateType.toTabulatorColumn('sail_date', 'Sail Date');
      const numberCol = Number.toTabulatorColumn('quantity', 'Quantity');

      const allValid = 
        currencyCol.field === 'price' && currencyCol.formatter === Currency.formatter &&
        percentageCol.field === 'occupancy' && percentageCol.formatter === Percentage.formatter &&
        dateCol.field === 'sail_date' && dateCol.formatter === DateType.formatter &&
        numberCol.field === 'quantity' && numberCol.formatter === Number.formatter;

      setValidationResults(prev => ({
        ...prev,
        columnBuilders: allValid
      }));

      if (allValid) {
        console.log('[DataTypesValidation] ✓ All column builders working');
      } else {
        console.error('[DataTypesValidation] ✗ Column builder validation failed');
      }
    } catch (error) {
      console.error('[DataTypesValidation] Column builder error:', error);
    }
  }, []);

  // Initialize Tabulator table with data types
  useEffect(() => {
    if (tableInitialized) return;

    let cancelled = false;

    const initTable = async () => {
      if (!tableRef.current || cancelled) return;

      try {
        const Tabulator = await initTabulator();
        if (cancelled || !tableRef.current) return;

        // Create columns using data types library
        const columns = [
          {
            field: 'id',
            title: 'ID',
            width: 80,
            headerFilter: 'input'
          },
          {
            field: 'description',
            title: 'Description',
            widthGrow: 2,
            headerFilter: 'input'
          },
          // Use Currency type (with comparison filter)
          Currency.toTabulatorColumn('currency_value', 'Currency (EUR)', {
            currency: 'EUR',
            minDecimals: 2,
            maxDecimals: 2
          }),
          // Use Percentage type
          Percentage.toTabulatorColumn('percentage_value', 'Percentage %', {
            decimals: 2
          }),
          // Use DateType
          DateType.toTabulatorColumn('date_value', 'Date', {
            format: 'short'
          }),
          // Use Number type (with comparison filter)
          Number.toTabulatorColumn('number_value', 'Number', {
            minDecimals: 0,
            maxDecimals: 0
          })
        ];

        if (instanceRef.current) {
          instanceRef.current.destroy();
        }

        instanceRef.current = new Tabulator(tableRef.current, {
          data: testData,
          columns: columns,
          layout: 'fitColumns',
          initialSort: [{ column: 'id', dir: 'asc' }],
          height: '100%',
          resizableColumns: true,
          movableColumns: true,
          headerFilterLiveFilter: true,
          headerFilterLiveFilterDelay: 300
        });

        console.log('[DataTypesValidation] ✓ Table initialized with data types');
        setValidationResults(prev => ({
          ...prev,
          tableRendering: true
        }));
        setTableInitialized(true);
      } catch (err) {
        console.error('[DataTypesValidation] Table initialization error:', err);
      }
    };

    initTable();

    return () => {
      cancelled = true;
      if (instanceRef.current) {
        try {
          instanceRef.current.destroy();
        } catch (e) {
          console.warn('[DataTypesValidation] Error destroying table:', e);
        }
      }
    };
  }, []);

  const allTestsPassed = Object.values(validationResults).every(result => result === true);

  return (
    <div className="dev-validation-container">
      {/* Validation Status */}
      <div className={`dev-validation-status ${allTestsPassed ? 'dev-validation-status--pass' : 'dev-validation-status--fail'}`}>
        <h3 className="dev-validation-title">
          Data Types Library Validation
        </h3>
        <div className="dev-validation-list">
          <div>✓ Imports: {validationResults.imports ? 'PASS' : 'FAIL'}</div>
          <div>✓ Formatters: {validationResults.formatters ? 'PASS' : 'FAIL'}</div>
          <div>✓ Column Builders: {validationResults.columnBuilders ? 'PASS' : 'FAIL'}</div>
          <div>✓ Table Rendering: {validationResults.tableRendering ? 'PASS' : 'FAIL'}</div>
        </div>
        {allTestsPassed && (
          <div className="dev-validation-success">
            ✓ All validation tests passed!
          </div>
        )}
      </div>

      {/* Test Table */}
      <div className="dev-validation-table-container">
        <h4 className="dev-validation-table-title">Test Table Using Data Types</h4>
        <div 
          ref={tableRef} 
          className="dev-validation-table-wrapper"
        />
      </div>
    </div>
  );
};

export default DataTypesValidation;
