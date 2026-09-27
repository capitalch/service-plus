# Service+ subscription model
- There will be 4 subscription levels
    - Lite: Free plan
        - Single user, unlimited login
        - 50 jobs per month
        - No whatsapp integration
        - No spare parts inventory management
        - Single business unit
    - Basic: Paid plan: INR 2999/- per month
        - 1 user, unlimited login
        - 100 jobs per month
        - whatsapp integration: 100 messages per month
        - No spare parts inventory management
        - Single business unit
    - Standard (Previously Pro): INR 5999/- per month
        - multi users, unlimited login
        - 500 jobs per month
        - whatsapp integration: 500 messages per month
        - Spare parts inventory management
        - Single business unit
    - Enterprise: INR 10999/- per month
        - multi users, unlimited login
        - unlimited jobs
        - whatsapp integration: 2000 messages
        - Spare parts inventory management
        - 5 business units
- A mechanism has to be made for enabling / disabling various features for a plan at the bu level, maybe in security database or in some config file. the config file may have certain key value pairs indicating feature enabled or disabled status. This is needed for lite, basic and standard plans. For enterprise plan, super admin has to create a new db and enable the features for that db.
- Implementation for lite, basic and standard plans
    - A user can sign up for a free lite version from the public facing website. While signing up, the user will have to provide their email and mobile number. The user will be registered and a free lite version plan will be assigned to the user.
    - There will be an api call from public website to serviceplus.cloudjiffy.net to register a new user and create a free lite version plan for the user.
    - For the standard, basic and enterprise plans the user will contact the service plus team and discuss the requirements. The service plus database adminwill then create a new business unit and assign it to the user for basic and standard version. For enterprise version super admin has to create a ne db. The user will then be able to login to the service plus client application and use the features of the plan. Payment is at present manual and done via bank transfer. In future we will be using razorpay for payment gateway integration.
    
    - There is a prebuilt database. The Database name and credentials are stored in .env file. This database is manually created by super admin. An admin user and its credentials are also stored in .env file for this database, also created by super admin. This database will be having business units for lite, basic and standard plans. 
    - Only one business unit is allowed per plan. The database will contain one business unit for each plan.
    - Security schema of database hold the name of plan against each bu.
    - Each bu will also contain the user details against user registration done by the user while registering on service plus public facing web site, while signing up for a free lite version. The address and gstin fields may be null.
- Implementation for enterprise plan
    - Super admin will create a new database for each enterprise customer.
    - Enterprise version will have the features and restrictions as defined in plan.
    
    
    