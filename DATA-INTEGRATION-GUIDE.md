# Data Integration Guide for Talia Platform

## Overview

This guide explains how to pull data from your local Supabase instance and Azure Synapse data warehouse into your Talia platform.

## Data Sources

### 1. Local Supabase (Development)
- **URL**: `http://127.0.0.1:54323/`
- **Purpose**: Local development and testing
- **Setup**: Use the provided setup script

### 2. Azure Synapse (Production Data)
- **Server**: `celestyaldataplatform-prd.sql.azuresynapse.net,1433`
- **Database**: `CDP_Dedicated_SQL_DWH`
- **Username**: `RBryer`
- **Password**: `Cele5tyalrbUser!`
- **Purpose**: Production business data

## Setup Instructions

### Step 1: Install Dependencies

```bash
cd talia-server
npm install @supabase/supabase-js tedious
```

### Step 2: Configure Environment Variables

Create a `.env` file in `talia-server/` directory:

```bash
# Supabase Configuration (Local Development)
SUPABASE_URL=http://127.0.0.1:54323
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Azure Synapse Configuration (Production Data)
AZURE_SYNAPSE_SERVER=celestyaldataplatform-prd.sql.azuresynapse.net
AZURE_SYNAPSE_PORT=1433
AZURE_SYNAPSE_DATABASE=CDP_Dedicated_SQL_DWH
AZURE_SYNAPSE_USERNAME=RBryer
AZURE_SYNAPSE_PASSWORD=Cele5tyalrbUser!

# Data Source Priority (supabase | azure | both)
DATA_SOURCE_PRIORITY=supabase

# Environment
NODE_ENV=development
```

### Step 3: Set Up Local Supabase

1. **Start your local Supabase instance**:
   ```bash
   # Make sure Supabase is running at http://127.0.0.1:54323/
   ```

2. **Get your Supabase keys**:
   - Go to http://127.0.0.1:54323/
   - Navigate to Settings > API
   - Copy the `anon` key and `service_role` key
   - Update your `.env` file with these keys

3. **Create database tables**:
   - Go to http://127.0.0.1:54323/
   - Navigate to SQL Editor
   - Run the SQL schema from `talia-server/scripts/setup-supabase.js`

4. **Insert sample data**:
   ```bash
   cd talia-server
   node scripts/setup-supabase.js
   ```

### Step 4: Test the Integration

1. **Start the GraphQL server**:
   ```bash
   cd talia-server
   npm start
   ```

2. **Test queries**:
   - Go to http://localhost:4000/graphql
   - Try these sample queries:

   ```graphql
   # Get ships
   query GetShips {
     ships {
       Ship_Id
       Ship_Code
       Ship_Name
       Ship_Pax_Capacity
     }
   }

   # Get sailings
   query GetSailings {
     sailings {
       id
       ship
       sailing
       depart
       booked
       available
     }
   }

   # Get cabin availability
   query GetCabinAvailability {
     cabinAvailability {
       Snapshot_Date
       Package_Name
       Cabin_Category
       Available_Cabins
       Total_Cabins
     }
   }
   ```

## Data Flow Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Talia UI     │    │  GraphQL Server │    │   Data Sources  │
│   (Frontend)    │◄───┤   (Backend)     │◄───┤                 │
│                 │    │                 │    │                 │
│ - React App     │    │ - Apollo Server │    │ - Local Supabase│
│ - InstantDB     │    │ - Resolvers     │    │ - Azure Synapse │
│ - Focus Mgmt    │    │ - Data Services │    │ - Sample Data  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Data Source Priority

The system tries data sources in this order:

1. **Local Supabase** (for development)
2. **Azure Synapse** (for production data)
3. **Sample Data** (fallback)

## Available Data Services

### SupabaseDataService
- `getShips()` - Get ships data
- `getSailings(filters)` - Get sailings with filters
- `getCabinAvailability(filters)` - Get cabin availability
- `getKPIs(userRole)` - Get KPIs by user role
- `getExceptions(userRole)` - Get exceptions by user role

### AzureSynapseService
- `getShips()` - Get ships from Azure Synapse
- `getSailings(filters)` - Get sailings from Azure Synapse
- `getCabinAvailability(filters)` - Get cabin availability from Azure Synapse
- `getRevenue(filters)` - Get revenue data
- `getOccupancy(filters)` - Get occupancy data
- `getKPIs(userRole)` - Get KPIs from Azure Synapse
- `getExceptions(userRole)` - Get exceptions from Azure Synapse

## Query Examples

### Ships Query
```graphql
query GetShips {
  ships {
    Ship_Id
    Ship_Code
    Ship_Name
    Ship_Pax_Capacity
    Ship_Length
    Ship_Tonnage
  }
}
```

### Sailings Query with Filters
```graphql
query GetSailings($filters: SailingFilters) {
  sailings(filters: $filters) {
    id
    ship
    sailing
    depart
    booked
    available
    projected
    status
  }
}
```

### Cabin Availability Query
```graphql
query GetCabinAvailability($filters: DateFilters) {
  cabinAvailability(filters: $filters) {
    Snapshot_Date
    Package_Name
    Sail_Days
    Cabin_Category
    Available_Cabins
    Total_Cabins
    Available_Absolute
    Available_Weighted
    Availability_Result
    Nested_Cabins
  }
}
```

## Troubleshooting

### Common Issues

1. **Supabase Connection Failed**
   - Check if Supabase is running at http://127.0.0.1:54323/
   - Verify your API keys in `.env`
   - Check if tables exist in Supabase dashboard

2. **Azure Synapse Connection Failed**
   - Verify network connectivity to Azure
   - Check credentials in `.env`
   - Ensure firewall allows connections

3. **No Data Returned**
   - Check if tables have data
   - Verify user permissions
   - Check GraphQL query syntax

### Debug Mode

Enable debug logging by setting:
```bash
NODE_ENV=development
DEBUG=talia:*
```

## Next Steps

1. **Set up your local Supabase** with the provided script
2. **Configure your environment variables**
3. **Test the GraphQL queries**
4. **Start building your dashboard components**

## Support

- Check the GraphQL Playground at http://localhost:4000/graphql
- Review the Supabase dashboard at http://127.0.0.1:54323/
- Check server logs for detailed error messages

