# To Do
## Login
- Forgot password
- Remember me
									- Selection of super admin vs others for login
									- Clients fill in dropdown
									- Superadmin
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