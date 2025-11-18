-- dim_sail_by_cabin_occupancy.sql sale_by_cabin_occupancy.json
SELECT TOP (1000) [Sail_ID]
      ,[Sail_Code]
      ,[Sail_Days]
      ,[Sail_Date_From]
      ,[Master_Voyage]
      ,[Sail_Itinerary_Date]
      ,[Sail_Itinerary_Night]
      ,[Port_Code]
      ,[Ship_Code]
      ,[Ship_name]
      ,[Package_Type]
      ,[Package_Name]
      ,[Geog_Area_Code]
      ,[Season_Code]
      ,[IS_Fake]
      ,[IS_Active]
      ,[IS_Package_Active]
      ,[Cabin_Category]
      ,[Cabin_Capacity]
      ,[Total_Cabins]
      ,[Occupied_Cabins]
      ,[Remaining_Cabins]
  FROM [dwh].[Dim_Sail_By_Cabin_Occupancy]
WHERE  3=3
and   [SHIP_CODE] = 'CJ'
and   [Sail_Date_From] between '2026-05-01' and '2026-05-31'

-- Publish Rates published_rates.json
SELECT TOP (1000) 
 [SNAPSHOT_DATE]
      ,[SAIL_CODE]
      ,[SHIP_CODE]
      ,[PACKAGE_NAME]
      ,[REGION]
      ,[RATE_TYPE]
      ,[SAIL_DAYS]
      ,[DEPARTURE_DATE]
      ,[CABIN_CATEGORY]
      ,[PROMO_NAME]
      ,[PROMO_TYPE]
      ,[CURRENCY_CODE]
      ,[FARE_PER_PERSON]
      ,[PORT_TAXES_SERVICES]
      ,[EXTRA_ADULT]
      ,[EXTRA_CHILD]
      ,[DISCOUNT]
  FROM [fou].[GQL_PUBLISHED_RATES]
  where 3=3
  and snapshot_date between '2025-05-01' and getdate() 
  --and rate_type = 'BAR'
 and   [SHIP_CODE] = 'CJ'
 and   [DEPARTURE_DATe] between '2026-05-01' and '2026-05-31'