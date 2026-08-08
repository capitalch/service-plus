# New feature: Whatsapp messages to customers on job completion and job delivery
- A nice interface at client is to be made which displays all completed and final jobs, There is a checkbox against every row, default checked, Uncheck to not send message for that row and send one message only for a customer with multiple jobs.
- Each row woll replicate info as in JobControl grid.
- Grid will be similar to job control with search box and refresh
- Select all check box will be there.
- A prominent big button to send message to all selected
- New client and server side apis for this purpose
- Count of successfully sent messages to a job will also be displayed. For that suggest database tables and columns.
- Any failure to send message should be visible with details to users
- I will be using meta business api for sending messages. The API call should be made from server side. A worker (job) should be triggered when user clicks on send button and it should send message to all selected jobs. Try to make it robust and scalable.
- Super Admin should be easily able to change the templates for job completion and job delivery messages. There should be an easy way for superadmin to change templates. 
- I have not thought of a name for this new feature. Suggest a name.
- At times I can change my mobile number at meta or can also use 3rd party provider like twilio. There should be an easy way to do so.
- Extensibility for whatsapp to other notification service should be easy.
- Give in details plan and design in plans/plan-whatsapp.md



