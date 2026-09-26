# Service+ provisioning to other service centers on subscription model
- We have already fixed the security loophole.
- My proposal is this:
    - Actually one bu can own multiple service centers. So clients based on one company's service centers only will not be practical. Let the client name be arbitray, to be decided later, may be based on territory or state or any other criteria.
    - There will be one admin for each client which has all the powers to navigate through data of each bu and create any user pertainig to any roles for that bu
    - Let the manager can create any number of users excepting manager role for his bu. Manager has all the powers within his bu.
    - Super admin function unchanged.
    - We will final the subscription model later. But for now it can be basic, pro and enterprise.
    - Enterprise level will have special feature of creating BU under him or herself. Only this level can do this. Separate database for enterprise customer.
    - Basic and pro will have features changes but unchanged user management.

# Service+ subscription model modifications
- There will be 4 subscription levels
    - Trial: Free plan
        - Single user, unlimited login
        - No whatsapp integration
        - No spare parts inventory management
        - Single business unit
        - Will automatically expire after 30 days
    - Basic: Paid plan: INR 999/- per month
        - 1 user, unlimited login
        - 100 jobs per month
        - whatsapp integration: 100 messages per month
        - Single business unit
    - Standard (Previously Pro): INR 4999/- per month
        - multi users, unlimited login
        - 500 jobs per month
        - whatsapp integration: 500 messages per month
        - single business unit
    - Enterprise: INR 9999/- per month
        - multi users, unlimited login
        - unlimited jobs
        - whatsapp integration: 2000 messages
        - 5 business units
- Implementation
    - Trial version
        - There is a prebuilt database for the trial version. Database name and credentials are stored in .env file. This database is manually created by super admin. An admin user and its credentials are also stored in .env file.
        - 
    
    