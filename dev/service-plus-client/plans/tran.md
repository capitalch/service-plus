# Strategy for change in division
- One branch can have many divisions. Each division can post data to specific accounts database, based on its account_setting
- User can receive a job in any available division.
- A division is gst if gstin no is there in account_setting, non-gst otherwise.
- GST aspects of an invoice should depend on whether division is GST or non-gst.
- Invoicing should be done GST or non-gst, based on account_setting of the division
- User should be able to change division anytime before it is final and accordingly gst aspects change
- User should not be allowed to change division once job is done final

