# Service management software Post data to accounts
## Trace plus is an accounting software with postgresql database and GraphQL based API. The app server is written in fastApi. It is in folder /projects/trace-plus/dev/trace-server. Service plus is service jobs management software. its server is in folder /projects/service-plus/dev/service-plus-server. DB schema is in files /projects/service-plus/db/service-plus-demo.sql and /projects/service-plus/db/service-plus-client.sql
- A need is felt to post the data for Purchase Invoices, Sales Invoices, Job Invoices and Money Receipts from service-plus to trace-plus. The process should be robust and in service plus, is_posted flag is to be made true after successful posting to accounts.
- Posting data is in JSON format and data transfer is to be done in secured manner
- In service plus client, There is already a menu item named as "Accounts Posting". A "Post Selected" button should initiate the posting process. After posting of data a proper message is to be given to user
- You need to design  a complete system in details as follows:
        - Design a complete handshake between service plus client and trace plus. Will it be better that service plus client makes a secured call to service plus server api and the service plus server then calls to trace plus server and transfers data
        - Trace plus api to receive the data in Json format in authenticated manner and post it to relevant tables
        - Implement the service plus client method for "Post Selected" button click. This generates the json and calls to relevant apis in secured manner
- Create a complete plan with available options
- At this stage give a detailed overview of entire process incorporating best practises. No need to write detaied code. This is only the design phase
- Write you plan to plans/plan.md.