# instructions for program flow of login mechanism
- Receive Credentials
    - The endpoint receives clientId, identity (username or email), and password (plain text
- Check for SuperAdmin (S)
    - Check: Does the identity match the SuperAdmin username in config?
    - Verify: Use pwd_context.verify(password, superadmin_hash_from_config).
    - Action: If valid,  generate a JWT with userType: "S".Return: userType: "S", email, mobile, and a global access flag.
- Resolve Tenant (Client DB Lookup)
    - Query: Look up the clientId in the Client DB (Master).
    - Validation: * If the clientId does not exist Return 401 Unauthorized (Generic error).
        If it exists, retrieve the db_name or connection string for that client's Service 
- Authenticate User (Service DB Lookup)
    - Connect: Use the db_name from the previous step to connect to the specific Service DB.- - Query: In the security schema, find the user by identity.
    - Verify Password: * Retrieve the stored_hash, is_admin, roleName, and access_rights.
        Use pwd_context.verify(password, stored_hash).If no user found or hashes don't match Return 401 Unauthorized.
- Token Creation & Final Response
    - Logic: Determine userType. If is_admin is true, userType = "A", else userType = "B".
    - JWT Payload: Include userId, userType, clientId, and crucially, the db_name.
    - Return: All profile info (email, mobile, role, access rights) and the JWT to the React client.
