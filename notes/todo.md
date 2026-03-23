# To Do
## Login
- Forgot password
- Remember me
								- Selection of super admin vs others for login
								- Clients fill in dropdown
								- Superadmin
# Menu System
- Job
	- New Job
	- Query Job
	- Transact Job
	- Finalize ready job
	- Deliver Job
	- Opening Job
	- Money receipt
- Dashboard
	- Job status
	- Revenue
- Master
	- Branch
	- Document Type
	- Financial Year
	- Customer Type
	- Customer
	- Job delivery manner
	- Job receive condition
	- Job receive manner
	- Job status
	- Job type
	- State / Province
	- Parts
	- Brand
	- Supplier
	- Technician
	- Product
	- Model
	- Part location
- Settings
	- Company info
	- Branch setup
	- Job slip
	- Money receipt
- Reports
	- Parts Summary
	- Job status
	- Cash register
	- Detailed Performance
	- Summary performance
	- Sales
	- Jobs
	- Stock transaction
- Parts Inventory
	- Consumption
	- Purchase invoice
	- Sale invoice
	- Stock Adjust
	- Loan
	- Opening stock
	- Part finder
# modify seed data and table columns
add is_system column to:
	- customer_type
	- document_type
	- job_delivery_manner
	- job_receive_condition
	- job_type
	- state
	- stock_transaction_type
# seed data
	- financial year
	- branch
	
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
