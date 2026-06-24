# Strategy for job cost price / sale price, Parts & charges and job final. This should be the strategy:
- When through Job Pipeline user selects "Parts & Charges", a modal window for "Parts & Charges" opens. User can add part and select a part from part selector. Cost of spare parts is taken from spare part master (if not there then 0) and sale price is obtained after adding markup for sale price (if not present in spare part master). The cost and sale prices are populated in the newly added row. Please note that there should be no consideration of gst calculations at this stage.
- When data saved, job_part_used table is populated with cost_price, selling_price, gst_rate(from spare_part_master or default gst rate for part), hsn (from spare_part_master or default hsn code for part). Gst information is always saved based on available data irrespective of whether gst or non-gst division.
- For additional charges also the hsn_code and gst_rate are stored in job_additional_charge table along with cost_price and sale_price irrespective of whether division is gst or non-gst.
- User can always alter the cost_price and sale_price fetched from master or calculated, and save
- Once user is doing finalization of a job, following is important:
  - if selected division is gst, then hsn, gst%, force igst, +GST fields appear, otherwise these fields don't appear in the UI
  - When gst then calulations for gst is done on sale_price and +gst field is populated accordingly. Amt is same as +gst * qty.
  - When non-gst:
    - if force_gst_on_parts_for_non_gst_invoices is true then set cost_price = cost_price + applicable gst and sale price as per markup else
    no effect of gst on prices. Amt is same as sale * qty.
  - When user changes any editable value, recalculation is done
  - When user changes division and GST changes to non-gst or vice versa then also recalculation is done
  - calculated and total values are evaluated as normal. traget amout is set to job.amount or total. Back calculate will do bacward calculation.
  - Remove Edit functionality from is_final = true jobs: finalized Jobs > Actions > No edit button
  - Deliver job will generate GST or non-gst bill based on division

