# Computation of cost_price and selling_price and other values during finalization process of job. This is applicable for spare parts charges to be stored in job_part_used table:
- let dbcp = cost_price of spare part in spare_part_master table, dbsp = selling_price of spare part in spare_part_master table, isGst = gst applicable for the selected division, rate = gst_rate in percent for the part (from job_part_used or (from spare_part_master) or (from default_gst_rate))
- When "Parts & charges" is executed in various screens of Job Pipeline, cost_price, selling_price, gst_rate, hsn of the spare_part is stored in job_part_used table. When a part is selected using the PartCodeInput: dbcp is the default value for cost_price and dbsp or (dbcp + markup) is default value for selling_price. User can edit them. If already these values exist in job_part_used table, those existing values are used and shown for cost_price and selling_price without any further calculations. hsn_code, gst_rate are silently put in respective fields from spare_part_master (if not present or 0 value then use default_hsn_for_spare_part and default_gst_rate instead). This action is irrespective of gst or non-gst division.
- Remove force_gst_on_parts_for_non_gst_invoices app_settings and all associated logic in the codebase.
- In final a job > Final :
  - For isGst
    - show hsn, cost, sale, +gst, amt as usual, based on cost_price, selling_price, gst_rate and hsn values in job_part_used table
    - If new part is added then the values are calculated as in case of "Parts & Charges"
  - For !isGst
    - hsn, +gst columns are not shown
    - if values are present in job_part_used table, they are used without any calculations. Otherwise cost_price = dbcp*(1 + rate/100), selling price calculations as before
  - For reset:
    All values are recalculated from begining
  - When division changes from gst <-> non-gst, all values are recalculated from begining
  - Computed and total values are normal. Back Calculate will respect above logic and be sensible.
  - Target amount is job.amount or total (The first non zero)