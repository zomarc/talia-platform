--- Query for Selecting Sample for Modelling
 with
original_group_size as (select group_id,
								sum(guest_count) as orig_group_size,
								row_number() over(Partition by group_id order by wc_snapshot_date asc) as row_num
								from dwh.Fact_reservation_History
								group by group_id,wc_snapshot_date )
SELECT
f.wc_snapshot_date,
f.group_id,
f.agency_id,
f.sec_agency_id,
 datediff(year,
        case
            when osf.[createddate] is null then nsf.[createddate]
            else osf.[createddate]
        end,
        getdate()
 ) as ageinyears,
clps.agency_classification_code as paymentschedule,
clgps.agency_classification_code as grouppaymentschedule,
f.agency_market,
f.agency_channel,
datediff(day,cast(f.wc_snapshot_date as date),cast(f.sail_from_date as date)) as days_to_departure,
f.pax_status,
f.group_type,
f.group_status,
month(f.sail_from_date) as sailed_month,
f.Itinerary_type,
--agency_age,  missing info
datediff(day,cast(f.res_init_date as date),cast(f.sail_from_date as date)) as booking_time,
sum(f.guest_count) as current_group_size,
ogs.orig_group_size as original_group_size,
f.sail_duration
--payment schedule missing info
FROM dwh.Fact_Reservation_History f
left join original_group_size ogs on f.group_id=ogs.group_id and ogs.row_num=1
left join [fou].[old_sfdc_account] osf on osf.[agency_id__c] = cast(f.agency_id as nchar)
left join [fou].[sfdc_account] nsf on nsf.[agency_id_seaware__c] = f.agency_id and nsf.[active_record_flag] = '1'
left join [fou].[agency_classification_link] clps on clps.[agency_id] = f.agency_id and clps.agency_class_type = 'payment sch.'
left join [fou].[agency_classification_link] clgps on clgps.[agency_id]  = f.agency_id and clgps.agency_class_type = 'group sch'
where 1=1
and f.pax_type='G'
and f.sail_duration in (3,4)
and year(f.sail_from_date)=2024
and right(f.Itinerary_type,6)='ICONIC'
and month(f.sail_from_date) in (4,7,9)
and datediff(day,cast(f.wc_snapshot_date as date),cast(f.sail_from_date as date))>=0

group by
f.wc_snapshot_date,
f.group_id,
f.agency_id,
f.sec_agency_id,
f.agency_market,
f.agency_channel,
datediff(day,cast(f.wc_snapshot_date as date),cast(f.sail_from_date as date)),
f.pax_status,
f.group_type,
f.group_status,
month(f.sail_from_date),
f.Itinerary_type,
datediff(day,cast(f.res_init_date as date),cast(f.sail_from_date as date)),
f.sail_duration,
ogs.orig_group_size,
osf.[createddate],
nsf.[createddate],
clps.agency_classification_code,
clgps.agency_classification_code