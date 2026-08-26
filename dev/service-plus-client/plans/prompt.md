# Whatsapp implementation for delivering the receipt of job to customer
- At present when a customer gives a job for repairs, a manual job slip is issued to customer.
- Can we issue the job slip on whatsapp instead of printing. This will also save paper.
- There can be whatsapp button which will send the job receipt in whatsapp. This button with proper whatsapp icon should appear in all the places where job slip can be printed. Also this button should be available on the modal window which shows the pdf of job slip.
- When a message for job received is sent to customer its success, failure should be recorded in whatsapp_notifications colum of job table, without disturbing other data in the column.
- Also we should be able to resend the job slip on whatsapp. But there is no count of succes and fail in the columnof job table. There must be some indication in job view and jobs grid if whatsapp job receipt is sent.
- This facility should be available for batch jobs also.
- Create anoverall design with meta message template to get approved. Do you suggest that the message should be conclusive in itself or attach the job slip pdf with it, or both. Consider security, privacy and what will be easier for customer to use. We also have a link for customer to enquire the job status. Should we send the job slip on whatsapp and the job status link also.
- Write your approach to plans/plan.md. Do not implement now.
