# Modifications for "Final A Job" functionality
- For Final a Job menu item, there will be two tabs: 1) final a job 2) Already final jobs. Give correct names for tabs. Default tab is final a job, whose functionality is already implemented.
- The second tab already Final jobs will show all jobs with is_final and not is_closed status. Actions in each row will show view and edit icons. View will work as usual to show job details modal. Edit will open the same screen as opened when final button is clicked in "Final a Job". This screen will open in edit mode. Some visual indication should be there for edit mode. User will be allowed to edit the data
# Functionality of "Save and mark final" for Jobs > Final A job
- Data is saved in two tables job_part_used and job_additional_charge
- is_final is set true in job table
- Also a new row is added to job_invoice and corresponding details in job_invoice_line. For job_additional_charge, the part_code is null in job_invoice_line. All hsn and gst entries are properly populated in job_invoice and job_invoice_line tables
- All the above entries are in a database transaction
- At the time of edit a job final entry, data is updated in job_part_used and job_additional_charge tables. For updates to job_invoice and job_invoice_line, invoice is at first deleted against the job and then reinserted

- Plan to plans/plan.md