# Modification of Deliver Job feature
- in delivery-modal, on click of "create invoice & receipts", Invoice and receipts are generated. 
- Invoice details are now stored in database tables job_invoice and job_invoice_line.
- Source of invoice details are job_part_used and job_additional_charge. Information from these two tables are stored collectively in job_invoice_line at proper columns
- job_invoice.amount comes from job.amount. The aggregate, cgst_amount, sgst_amount and igst_amount are calculated and put at appropriate columns
- Job_invoice_line is also properly populated. part_code is null when not available
- Generation of receipt is also done and data is stored in job_payment