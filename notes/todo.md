# To Do
- Enhancements
	- In all drill down grids of Job Pipeline, final a job and Deliver Job including all tabs: for action dropdown and corresponding actions, follow the same pattern of row selection and page and row and scroll position retention.
							- Draft Invoice info for finalised jobs
							- modify Sales Invoice functionality
								- Rename Job Search to Job Panel / Control /Manage
							- Job Control
								- undo final for final jobs
								- undo delivery / undo last transactions for closed jobs
								- Also make drill down buttons for undo final and undo delivery
	- Access management
	- Account posting: Service account instead of super admin
	- Validate creation of new client / Bu / Branch / Division end to end
	- Security of server config file
- QA
								- Error when final a Job. Final amount possible without providing details
	- Massive transactions testing end to end
		- Create single job and batch jobs. Check why two times transactions shown in job view.
		- do at least 5 transactions
		- Do final
		- Deliver
	- Accounts Posting
		- sales invoice
								- Check customer GSTIN No transfer: Not transferring
								- Check IGST transfer
								- Proper HSN for parts and service
								- Upload trace-plus and check account posting online at serviceplus.cloudjiffy.net
	- Bug fix
		- Sales Entry: When division changes, corresponding GST info is not changed. Amount for spare should be same in gst / non-gst
								- When a batch job is received, two times received is shown in job view: Transaction
								- Add contactsId to posting of sales
								- Warranty job transactions: allow adding spare parts
- Login
	- Forgot password
	- Remember me

							- Enhancements
								- Guard invoice without delivery
								- Provide a button in Finalized jobs actions, which shows a detailed view of all charges as it is shown in "Final a Job", but it will be in readonly mode.
							- Bug fix / QA
								- in account_setting for job_invoice and sales_invoice capture a new item contactsId
								Job Search- When invoice is created on delivery, invoice amount is 0
								-  When in final the job form: division is changed from gst to non-gst and vice-versa, the sale price and amount does not remain consistent.
								- Connection pool closes arbitrarily in local server
							- Features
								- When undeliver a job, its status delivered_ok does not change
								- Remove unpost from Jobs > Receipts > Actions dropdown
								- mechanism to unpost a receipt, purchase invoice, sales invoice, job invoice
								- Change spelling of divison to division all over the codebase
							- Accounts posting
								- Sales Invoices
								- Job Invoices
								- All divisons
								- Inspect the document no strategy for divisions. At present if proper doc prefix is missing from a division, it results in a cryptic error
								- When a division is changed for a job from gst to non-gst, and already some part is registered with gst, theninvoice figures become wrong. Device a strategy for that. Suggestion is thatgst application on parts be applied only during finalizing stage and not before that. When undo final then gst parameters should reset.
		
							- When divison is non-gst, still gst calculations appear. Gst calculations are meaningful for gst divisions only
							- Device a strategy where the user can change a division. Should not be allowed everywhere especially when gst
							- Trace+
								- Create authenticated json based api to listen: dry run
								- Define json fields and format to receive
								- Input json successfully enters data in the target db
							- Service+
								- Define config for Trace+ connection
								- Create json with available fields
								- Execute API
			
			
						# Job life cycle QA
								- Appsettings:post_data_to_accounts
							- Single Job
								- Print should print single copy. Counter input to set no of copies to print. Default count 2. App settings default copies to print for job sheets
								- Print count feature for batch jobs also
								- When delete a job, if transactions there, show a friendly message that transactions are there so cannot delete, instead of error at server
								- In JobDetailsModal: Give a provision to print job sheet and print invoice and money receipt if available
								- divison is not populated when edit a batch job
								- View job will always show the complete list from whichever place it is fired. 
								- Allow pdf view / print for view job.
							- Job Search
								- Status page: Statuses to show in background colored pills
							- Final Job
								- Check updated_at column update from fastapi
								- Reverse sort on updated_at field
							- Part selector
								- when a part code is typed, show list for validated parts with details, just as in customer selector
							- Add Part modal
								- Should be non closure type
								- hsn code should be default_hsn_for_spare_part, gst rate: default_gst_rate
								- Add a column for selling_price: as markup_percent_over_cost, MRP: add gst (default gst rate) over selling price: gst_rate: default gst rate
								- At present, when editing a final job, target amount is calculated amount. It should be the job.amount
							- Job view
								- if job is final and not delivered, show a fab indicating that job is final, on right of status. The job should not have been delivered yet
								- When undo last, do not allow if delivered
							- deliver job
								- Show pdf will show only one copy per page. Print count facility to print multiple copies, otherwise single copy
								- Delivered jobs page: date should show date of delivery. job date should show in job no column. Sorting order should be last delivered first
								- Delivered jobs page grid view: a button to print invoice and receipts of delivered job
								- At present delivered jobs whose invoice have been is_aposted true is allowed to undeliver. That should not be allowed.
								- Delivered jobs view: new column for is_posted and post_data_to_accounts true
							- Money receipts
								- Money receipts for closed, cancelled, disposed, on hold, estimate rejected, return, delivered, final jobs cannot be done. They should be greyedout and not selectable in job select.
								- Deletion not allowed for final, delivered, posted receipts.
								- A button for unpost a receipt
								- A column for is_posted if applicable in the view receipts
							- Part used
								- cannot be for jobs: cancelled, closed, posted, final, disposed, on hold. Those items should be greyed out in the list with reasons
								- restrict edit and delete
								- modify view screen
								- When a new row is entered, The save button is not enabled. It is enabled only when + button is clicked and another row is added
								- Add new fields for new entry and edits
								- part select: Name is not required here. Provide a mechanism to set off the part name from part selector
							- Dashboard and reports design
								- Make the sequence of menu items as Jobs Inventory Reports Masters Configurations
								- Merge Reports and dashboard to Reports
								- Blocks
									- Received: today,current month name, previous month name, -2 months name
									- delivered ok:
									- returns:
									- Completed OK:
									- Revenue branch wise with divison and all branches
									- Waiting for delivery and corresponding amount
								- Last few transactions
	
						# Job features
								- Repeat repairs
								- global settings: no of job slips to be printed
								- global settings: no of job invoices to be printed
								- Inputting parts and charges at any step with similar to final a job screen
								- under warranty job, cannot do final
							- Deliver job
								- Job 00007, no invoice line but amount 1000. Should not be allowed
								- Modify receipt
								- Invoice numbering at server side
								- Show part details in invoice toggle
								- Re generate invoice
								- If modify final job, then update invoice if already generated
								- check delivery
								- Undo delivery
								- DELETE INVOICE
								- Warranty issue parts and claim back

					- Final a Job
							- Undo final
								- delete invoice
								- set is_final false
						- Save
								- Bug: job existing in both grids: Final a job and finalised jobs
							- Division
								- CRUD division
								- JOB crud: division
								- Batch job: division
								- Job invoice: division
						- parts invoice: implement division
						- Jobs
							- job pipeline
								- for job type: demo, inspection: No spare parts can be provided
								- job update: should be in a transaction. Recheck mutation at server
								- data saving test
								- Undo last transaction
								- Unique index for customer
								- implement alternate job no
								- implement multiple company name options
							- Separate file server
								- Folder hierarchy as client/bu/branch/job_no
								- Final deployment of file server with deploy script
								- Deployment documentation
								- Create local server and Test it locally
								- Create cloudjiffy server
								- Deploy cloudjiffy server
							- Single Job
								- the info card does not retain the job-no selected during refresh
								- Info card should show the no before latest
								- remove useEffect unnecessary fetches
								- Quick info card
								- Remove date filter
								- Search to include all items
								- View list to include product, brand, model.
								- Search debounce be 1200
								- Check new save
								- Check edit save
								- Check when new job is created, then QIC is updated
							- File upload
								- Quick info card is not updated with latest no of files, when files added or deleted
								- put navigation to job no's in quick info card
								- As per job no
								- In a different folder
								- Search working
								- Delete job
								- Check batch_no functionality. null or 0
							- Batch Jobs
								- When a single job is beig edited which is part of batch, then Batch jobs edit screen should open
								- Delete a job not working
								- quick info card view and print are same
								- View MODAL -> print pdf or print All not working
								- view mode: 1.1,1.2 -> 3.1, 3.2
								- Single job view mode: all the jobs in a batch should have different demarkation
							- Job list search
								- Remove date filter
								- Make search stronger
								- Remove delete from Actions
								- Add job view
									- Job details
									- Job transactions

						- Jobs
							- New job
								- Equal width
								- Set job no as first item
								- Remove technician
								- Remove status
								- Remove delivery date
								- Problem reported may be optional
							- Job type sequence
								- Make ready, Estimate, Under warranty, thereafter sort
							- Job receive manner
								- Walkin, Home pickup, Add home service
							- Receieve condition
								- Dead, Not working, Damaged, then sort
							- product model
								- should be typable select
								- Add a button to create a new product, brand, model
								- maybe is_warranty field is not required in table. Warrant_card no box will appear if job type is under warranty
								- provision for multiple jobs in a batch
								- provision to load multiple images less than 500KB
						- Inventory
							- db
								- stock_branch_transfer table
								- stock_branch_transfer_line table
								- stock_loan table
								- stock_loan_line table
								- corresponding entries in stock_transaction
								- seed value add branch_in, branch_out for table stock_transaction_type
								- Treatment for opening stock
							- sales
								- Why DELETE_SALES_INVOICE is used? genericUpdate can do delete. On delete cascade is already enabled at database
								- Create a separate mutation for sales, which uses exec_sql_object, using the sql object sent by client and then incrementing the document sequence, don't use xExtras. For edit ise genericUpdate.
								
								- taxable_amount to be changed to aggregate_amount in relevant places. Already made changed at database level
								- In SalesLineFormItem why cgst_rate, sgst_rate and igst_rate are there. There should be cgst_amount, sgst_amount and igst_amount
								- In Line table columns replace Aggregate for Taxable
								- On part selection fill the relevant fields from master
								- HSN required if gst is applicable
								- set default_gst_rate if 0
								- Need to take care of document_sequence to increment next_number by 1 in the same mutation at server. No need for separate mutation
	
							- purchase
								- download as excel
								- Actions buttons overlap with background data. should be opaque
								- Dark mode issues
								- After new purchase invoice save don't go to view mode. stay in New mode with all data resetted for a new invoice entry
								- If in edit mode and data saved, then go to view mode
								- Provide a checkbox for IGST in the title line, and implement its functionality
								- If gst rate does not come from spare part master and gst enabled then consider the default gst rate
						- DB
							- Purchase_invoice
								- brand_id
								- taxable_amount -> aggregate_amount
							- Purchase_invoice_line
								- remove cgst_rate, sgst_rate, igst_rate
								- add gst_rate
						# modify seed data and table columns
							add is_system column to:
								- customer_type
								- document_type
								- job_delivery_manner
								- job_receive_condition
								- job_type
								- stock_transaction_type
							# seed data
								- financial year: last five to next 2 years
								- branch: head office
								- modify seed data input logic
								- Selection of super admin vs others for login
								- Clients fill in dropdown
								- Superadmin
							# Menu System
							- Jobs
								# Everything related to service job lifecycle
								- New Job
								- Job List / Search
								- Update Job
								- Ready for Delivery
								- Deliver Job
								- Opening Jobs
								- Receipts
							- Dashboard
								# Quick insights
								- Overview
								- Job Status
								- Revenue
								- Technician Performance
							- Inventory (Spare Parts Management)
								# Stock + parts operations
								- Stock Overview
								- Consumption (Parts Usage)
								- Purchase Entry
								- Sales Entry
								- Stock Adjustment
								- Stock Transfer
								- Loan / Issue & Return
								- Opening stock
								- Part finder
							- Reports
								# Read-only analytics
								- Job Reports
									- Job Status Report
									- Job History
								- Financial Reports
									- Revenue Report
									- Cash Register
									- Sales Report
								- Inventory Reports
									- Parts Summary
									- Stock Ledger
									- Stock Movement
								- Performance Reports
									- Technician Performance
									- Summary Performance
									- Detailed Performance
							- Masters
								# All configurations / static data
								- 📍 Organization
									- Branch
									- Financial Year
									- State / Province
								- 👥 Entities
									- Customer
									- Vendor
									- Technician
								- 🧾 Service Config
									- Customer Type
									- Document Type
									- Job Type
									- Job Status
									- Job Receive Manner
									- Job Delivery Manner
									- Job Receive Condition
								- 🏷️ Product & Parts
									- Brand
									- Product
									- Model
									- Parts
									- Part Location
							- Configurations
								# System-level configuration
								- Company Profile
								- Branch Configuration
								- Print Templates
									- Job Slip
									- Receipt Layouts
								- Numbering / Auto Series

	
								Final Organized Menu (Recommended)
								🧾 Jobs (Core Workflow)

								Everything related to job lifecycle

									New Job
									Job List / Search
									Update Job (instead of “Transact Job”)
									Ready for Delivery (instead of “Finalize ready job”)
									Deliver Job
									Opening Jobs (bulk import / migration)
									Receipts (instead of “Money receipt” — more generic)
								📊 Dashboard

								Quick insights
									Overview
									Job Status
									Revenue
									Technician Performance (add this 👍)
								📦 Inventory (Parts Management)

								Stock + parts operations

									Stock Overview
									Consumption (Job Usage)
									Purchase Entry
									Sales Entry
									Stock Adjustment
									Stock Transfer (recommended addition)
									Loan / Issue & Return
									Opening Stock
									Part Finder
								📑 Reports

								Read-only analytics

									Job Reports
									Job Status Report
									Job History
									Financial Reports
									Revenue Report
									Cash Register
									Inventory Reports
									Parts Summary
									Stock Ledger (add this 🔥)
									Stock Movement
									Performance Reports
									Technician Performance
									Summary Performance
									Detailed Performance
								🧩 Masters

								All configurations / static data

									📍 Organization
									Branch
									Financial Year
									State / Province
									👥 Customer & Vendor
									Customer Type
									Customer
									Supplier
									🧾 Document & Workflow
									Document Type
									Job Type
									Job Status
									Job Receive Manner
									Job Delivery Manner
									Job Receive Condition
									🏷️ Product & Parts
									Brand
									Product
									Model
									Parts
									Part Location
									👨‍🔧 Resources
									Technician
								⚙️ Settings

								System-level configuration

									Company Profile (better wording)
									Branch Configuration
									Print Templates
									Job Slip
									Receipt
									Numbering / Auto Series (important addition 🔥)
									User & Roles (must-have for real system)

	
				## Super admin login
							- Clients
								- Stats: Orphon databases. A button to view orphon databases
								- Testing
									- Add client
									- initialize
										- Database
										- Seed data
										- Create admin
									- Actions
										- disable
										- Add admin
										- Edit
										- View
								- Actions new
									- Delete disabled rows
									- Remove database

								- Dashboard
								- Audit logs
								- System Settings
								- Usage and health
				- Admins login
					- Dashboard
					- Budiness Users
					- Business Units
						- Three steps process
							a) bu name
							b) schema creation
							c) seed data
								- state in proper format
								- customer type: No identity
									- corporate
								- document_type
								- financial_year
								- job_delivery_manner
								- job_receive_condition
								- job_receive_manner
									- walk-in
									- courier
									- pickup
									- online
								- job_status
									- under process
									- waiting for spare parts
									- ready
									- delivered ok
									- delivered not ok
									- Sent to company
								- job_type
								- stock_transaction_type

					- Roles
					- Audit Logs

								# Project setup
								- Server
									- Env
									- FastAPI
										- GraphQL
										- Exception handling

								- Client
									- Env and project setup
								- Database design
									- Finalize tables
									- database objects
									- complete
- Deployment
	- cloudjiffy env
		- Create database
		- Setup fastapi
