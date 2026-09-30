# subscription plans implementation
- let lite, basic and standard plans together be denoted as lt, and enterprise plane be ent.
- Present design considers that sales enquiry of all plans be pushed into service_plus_client.public.sales_enquiry table. But admin of customer database for lt plan is not able to see the sales enquiry for approval.
- So for approval of lt plan we need a table in the customer database to store the sales enquiry for approval.
- And for ent plan we can continue with the table in service_plus_client database as it is.
- The sales portal updates data for ent in service_plus_client.public.sales_enquiry and for lt in customer_database.security.sales_enquiry and sends an email to admin for approval of the same.
- Admin panel of admin user has appropriate buttons and UI for lite plan. For basic and standard plans, the admin will first check the payment status and then will create a bu and then user and send an email to the user. If payment fails then the admin will not be able to create bu and user and will not send email. So there should be proper ui and database columns for payment received with initial setup cost for basic and standard plans.
- Similar provisions should be there for Super Admin for ent plan.
- Make appropriate changes in plan.md and do not implement