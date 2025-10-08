SELECT TOP (1000) [Snapshot_Date]
      ,[Sail_Code]
      ,[Package_Name]
      ,[Sail_Days]
      ,[Cabin_Category]
      ,[Available_Cabins]
      ,[Total_Cabins]
      ,[Available_Absolute]
      ,[Available_Weighted]
      ,[Availability_Result]
      ,[Nested_Cabins]
  FROM [dwh].[Dim_Cabin_Availability]
    WHERE 1=1
    and Snapshot_Date between '2025-09-02' and '2025-09-04' 
