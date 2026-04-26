# QA round
- Jobs
	- Single Job
								- Remove date filter
								- Search to include all items
								- View list to include product, brand, model.
								- Search debounce be 1200
		- Check new save
		- Check edit save
		- File upload
		- Edit save
								- Search working
		- Delete job
		- Edit job
		- Check batch_no functionality. null or 0
	- Batch Jobs
	- Job list search
		- Remove date filter
		- Make search stronger
		- Remove delete from Actions
		- Add job view
			- Job details
			- Job transactions
# To Do
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

## Login
- Forgot password
- Remember me
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
