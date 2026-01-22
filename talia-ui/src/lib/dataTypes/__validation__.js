/**
 * Validation Script for Data Types Library
 * 
 * This file validates that all data types can be imported and used correctly.
 * Run this in browser console or as a test to verify the library works.
 * 
 * This file is for validation only and should not be imported in production code.
 */

import { Currency, Percentage, Date, Number, isEmpty, parseNumber } from './index';

// Validation tests
const validationTests = {
  // Test imports
  imports: () => {
    console.log('✓ All types imported successfully');
    return true;
  },

  // Test Currency formatter
  currencyFormatter: () => {
    const mockCell = {
      getValue: () => 1234.56
    };
    const result = Currency.formatter(mockCell, { currency: 'EUR' });
    console.log('Currency formatter test:', result);
    return result.includes('EUR') || result.includes('€') || result.includes('1,234');
  },

  // Test Percentage formatter
  percentageFormatter: () => {
    const mockCell = {
      getValue: () => 85.5
    };
    const result = Percentage.formatter(mockCell, { decimals: 2 });
    console.log('Percentage formatter test:', result);
    return result.includes('%') && result.includes('85.50');
  },

  // Test Number formatter
  numberFormatter: () => {
    const mockCell = {
      getValue: () => 1234567
    };
    const result = Number.formatter(mockCell);
    console.log('Number formatter test:', result);
    return typeof result === 'string' && result.length > 0;
  },

  // Test Date formatter
  dateFormatter: () => {
    const mockCell = {
      getValue: () => '2026-01-21'
    };
    const result = Date.formatter(mockCell);
    console.log('Date formatter test:', result);
    return typeof result === 'string' && result.length > 0;
  },

  // Test toTabulatorColumn methods
  columnBuilders: () => {
    const currencyCol = Currency.toTabulatorColumn('price', 'Price', { currency: 'EUR' });
    const percentageCol = Percentage.toTabulatorColumn('occupancy', 'Occupancy %');
    const dateCol = Date.toTabulatorColumn('sail_date', 'Sail Date');
    const numberCol = Number.toTabulatorColumn('quantity', 'Quantity');

    const allValid = 
      currencyCol.field === 'price' &&
      percentageCol.field === 'occupancy' &&
      dateCol.field === 'sail_date' &&
      numberCol.field === 'quantity';

    console.log('Column builders test:', { currencyCol, percentageCol, dateCol, numberCol });
    return allValid;
  },

  // Test utility functions
  utilities: () => {
    const emptyTest = isEmpty(null) === true && isEmpty(undefined) === true && isEmpty('') === true;
    const numberTest = parseNumber('123.45') === 123.45 && parseNumber('invalid') === null;
    
    console.log('Utilities test:', { emptyTest, numberTest });
    return emptyTest && numberTest;
  }
};

// Run all validation tests
export const runValidation = () => {
  console.log('=== Data Types Library Validation ===');
  const results = {};
  let allPassed = true;

  for (const [testName, testFn] of Object.entries(validationTests)) {
    try {
      const result = testFn();
      results[testName] = result ? 'PASS' : 'FAIL';
      if (!result) allPassed = false;
    } catch (error) {
      results[testName] = `ERROR: ${error.message}`;
      allPassed = false;
    }
  }

  console.log('=== Validation Results ===');
  console.table(results);
  console.log(allPassed ? '✓ All tests passed!' : '✗ Some tests failed');
  
  return allPassed;
};

// Auto-run in development
if (import.meta.env.DEV) {
  // Only log that validation is available, don't auto-run
  console.log('[DataTypes] Validation available: import { runValidation } from "@/lib/dataTypes/__validation__"');
}
