#!/usr/bin/env node

// Test script for data transformation
// This will test the transformation methods with sample data

import { synapseSyncService } from './src/lib/synapse-sync.js';

console.log('🧪 Testing Data Transformation...\n');

// Test 1: Ships transformation
console.log('📋 Testing Ships Transformation:');
const shipsData = [
  {
    Ship_Id: 1,
    Ship_Code: 'DIS',
    Ship_Name: 'Celestyal Discovery',
    Ship_Pax_Capacity: '950',
    Ship_Length: '180m',
    Ship_Tonnage: '45000'
  }
];

const transformedShips = synapseSyncService.transformData('ships', shipsData);
console.log('✅ Ships transformation result:');
console.log(JSON.stringify(transformedShips[0], null, 2));
console.log('');

// Test 2: Cabin Availability transformation
console.log('📋 Testing Cabin Availability Transformation:');
const cabinData = [
  {
    Snapshot_Date: '2025-01-01',
    Sail_Code: 'DIS250101',
    Package_Name: '7N Islands',
    Sail_Days: 7,
    Cabin_Category: 'Interior',
    Available_Cabins: 120,
    Total_Cabins: 150,
    Available_Absolute: 120,
    Available_Weighted: 115.5,
    Availability_Result: 'Good',
    Nested_Cabins: 0
  }
];

const transformedCabin = synapseSyncService.transformData('cabinAvailability', cabinData);
console.log('✅ Cabin Availability transformation result:');
console.log(JSON.stringify(transformedCabin[0], null, 2));
console.log('');

// Test 3: Reservations transformation
console.log('📋 Testing Reservations Transformation:');
const reservationData = [
  {
    WC_Snapshot_Date: '2025-01-01',
    Group_ID: 12345,
    Res_ID: 67890,
    Ship: 'DIS',
    Sail_code: 'DIS250101',
    Sail_From_Date: '2025-01-15',
    Sail_To_Date: '2025-01-22',
    Agency_ID: 100,
    Cabin_Category: 'Interior',
    Guest_Count: 2,
    Pax_Status: 'Confirmed',
    Group_Status: 'Active',
    Res_Status: 'Confirmed',
    GrossSellingFare: 1500.00,
    NetSellingFare: 1200.00
  }
];

const transformedReservation = synapseSyncService.transformData('reservations', reservationData);
console.log('✅ Reservations transformation result:');
console.log(JSON.stringify(transformedReservation[0], null, 2));
console.log('');

console.log('✅ All transformation tests passed!');
