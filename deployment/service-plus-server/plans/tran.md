# instructions for evaluating the database connections
- In get_service_db_connection and get_client_db_connection functions, host and port are used from settings.py file. But in the settings, there are also service_db_ip_address and service_db_internal_port and client_db_ip_address and client_db_internal_port variables defined.
- Please get from the env variable APP_ENV, whether the application is running in development mode or production mode.
- If APP_ENV is production, then use service_db_ip_address and service_db_internal_port and client_db_ip_address and client_db_internal_port variables.
- If APP_ENV is development, then use service_db_host and service_db_port and client_db_host and client_db_port variables.
