# instructions
- I have following possible statuses in job_status_type table
        UNTOUCHED
        ESTIMATED
        APPROVED
        NOT_APPROVED
        SENT_TO_COMPANY
        RECEIVED_READY_FROM_COMPANY
        RECEIVED_RETIRN_FROM_COMPANY
        WAITING_FOR_PARTS
        IN_REPAIR
        READY_STOCK
        RETURN_STOCK
        DELIVERED
        CANCELLED
        DISPOSED
        FOR_DISPOSAL
        DEMO_REQUESTED
        DEMO_COMPLETED
        HOME_SERVICE_REQUESTED
        HOME_SERVICE_ATTENDED
        HOME_SERVICE_WAITING_FOR_PARTS
        HOME_SERVICE_COMPLETED
        INSTALLATION_REQUESTED
        INSTALLATION_COMPLETED
- i have following values for job_type table
        IN_WARRANTY_WORKSHOP
        DEMO
        CHARGABLE_REPAIRS
        ESTIMATE
        REPLACEMENT
        REPEAT_REPAIRS
        IN_WARRANTY_HOME_SERVICE
        CHARGABLE_HOME_SERVICE
        SERVICE_CONTRACTIN_WARRANTY_WORKSHOP
        DEMO
        CHARGABLE_REPAIRS
        ESTIMATE
        REPLACEMENT
        REPEAT_REPAIRS
        IN_WARRANTY_HOME_SERVICE
        CHARGABLE_HOME_SERVICE
        SERVICE_CONTRACT
- I want to create a third table which stores the possible outcome or mapping of above two tables. For example, if values are demo and demo_requsted in job_type and job_status_type table the mapping output can be cancelled or demo_completed
- Please provide the design, name and seed values of third table. The third table should store id's or code from first two tables
- If id's are to be stored in third table please provide the values for all three tables
- Be consise and specific