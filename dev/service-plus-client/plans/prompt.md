# Simplification and modification
- consider plan-whatsapp.md
- I want to integrate Whatsapp message only this time. No SMS or emails
- Following whatsapp messages only, no any other whatsapp messages for now
    - On Job Creation: which means there will be a button available named as Whatsapp, which on click will send whatsapp message with pdf of job sheet to customer.
    - At the time of job completion / finalization: there will be a button available named as Whatsapp, which on click will send whatsapp message with charge details to customer. This message should be tracked as count in a new jsonb field in job table. Jsonb field is used for future extention.
    - Specific message on job delivery: which means there will be a button available named as Whatsapp, which on click will send whatsapp message with pdf of invoice to customer.
    - On creation of Job Receipt and payment receive: there will be a button available named as Whatsapp, which on click will send whatsapp message with pdf of job receipt and payment details to customer.
    - As described in plan-whatsapp.md, customer connect will display all final jobs for sending messages.

- At present concentrate on whatsapp messages as above. Remove all the things that are not related to it.
- We will be using one BSP for sending messages.
- Configuration of templates and account settings of BSP will be done at server as setting / config files
- No additional database tables  required for now.
- Create anew plan in plans/plan.md which will make use of plan-whatsapp.md and apply above info to it.



