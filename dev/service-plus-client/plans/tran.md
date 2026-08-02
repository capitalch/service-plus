# New next.js project named as service-plus-web or some better name
- Create a new project as peer to service-plus-server and service-plus-client with above name or better name in next.js.
- The build output of the project should be deployable to milesweb.in as domain or subdomain.
- The web site should be responsive and with best quality UI / UX, user friendly and eye catching with latest technology. The project should be modular with intention of future expandability.
- The site should be able to communicate with service-plus-server (fastapi based) through secured api key. Need to make necessary changes in service-plus-server and service-plus-client and the database accordingly.
- This will be a medium size project with initially minimum functionality, which will grow with time.
- Following pages / features will be available
    - Introductory eye catching home page
        - Brief introduction of what the site can provide and what is inteded for future
        - Talk about features like Job status query for products given / booked for repairs in various service centers attached with Service Plus
        - On line AI driven help for faulty product and their estimated repair cost
        - Genuine spare parts query, prices with details directly from parent company
    - Job status query page
        - Option 1
            - Customer selects company from a list of companies. The company list will be populated from service-plus-server database. Which is the list of business units names from all clients of service-plus. Each client's name will be unique. This info is already there in database. Necessary sql queries are to be written in service-plus-server.
            - Customer types in the full job no and gives mobile no and clicks submit button
            - Server returns the job status which is displayed nicely
        - Option 2
            - Customer select company as above
            - Customer types in few letters of cust name, minimum 2 chars, list of cutomer appears. Customer selects one from the list and types in 10 digit mobile number.
            - All the open jobs for the customer are displayed in a nice table with jobno, date, productname, status, etc. 
    - Spare parts purchase
        - This page will be under construction. Will be implemented in later stage.
    - Contacts page
        - This page will display list of all service centers attached to Service Plus.
        - Customer can send email to individual service center or general email to Service Plus.
- I want deployment procedure / script for milesweb deployment. Kubuntu linux script will be good.
- initially create a single page minimum POC which can be deployed on milesweb.in as domain or subdomain. I want to test it. After my approval, I will ask you to proceed for full implementation.
- Create exhaustive plan for above in plans/plan-nextjs-website.md.
                
    
    