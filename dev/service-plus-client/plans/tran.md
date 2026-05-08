# Plan for modifying "Update Job" feature
- For "Assigned" as target status, selection of technician through drop down is mandatory in modal window if technician is not already selected.
- For all transactions, remarks and date field will appear by default in modal window.
- When completed OK as target status, there should be provision to register part used through a grid in the existing dialog window, which stores data in job_part_used. If already some part used, that should show up. User should be able to add / delete new parts.
- When target status is IN_PROGRESS, then also there should be provision to add / delete parts as above.
- When existing status is COMPLETED_OK, RETURN, DELIVERED_OK, DELIVERED_NOT_OK then make sure that no     
actions / transactions can be performed on these jobs. That means, Actions options      
will not appear for them. This function is already existing. Please verify and if required    
correct it.
- Please incorporate the following logical steps table for options in dropdown of actions column
* This table defines possible transitions for jobs in various present statuses and for different job types. 
* For each combination, the column “Allowed Options” lists all possible next statuses the job can be moved to, via transaction.
Present Status                  Job Type                Allowed Options
        RECEIVED                Estimate                Assigned, Estimated (estimate_amount)
                                Any other               Assigned, IN_PROGRESS, 
        ASSIGNED                Any                     Assigned, IN_PROGRESS
        ESTIMATED               Any                     ESTIMATE_APPROVED, ESTIMATE_REJECTED, IN_PROGRESS
        ESTIMATE_APPROVED       Any                     IN_PROGRESS
        ESTIMATE_REJECTED       Any                     RETURN
        IN_PROGRESS             Any                     Assigned, SENT_TO_COMPANY, OUTSOURCED, PARTS_PENDING, ON_HOLD, COMPLETED_OK. RETURN, CANCELLED, DISPOSED, In_progress
        PARTS_PENDING           Any                     IN_PROGRESS
        ON_HOLD                 Any                     IN_PROGRESS
        OUTSOURCED              Any                     IN_PROGRESS
        SENT_TO_COMPANY         Any                     RECEIVED_BACK_FROM_COMPANY
        COMPLETED_OK            Any                     No transactions
        RETURN                  Any                     No transactions
        DELIVERED_OK            Any                     No transactions
        DELIVERED_NOT_OK        Any                     No transactions
        CANCELLED               Any                     IN_PROGRESS
        DISPOSED                Any                     IN_PROGRESS
        RECEIVED_BACK_FROM_COMPANY                      IN_PROGRESS