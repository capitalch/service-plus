# For overall change in query and mutations:
- Is it possible to use genericQuery and genericUpdate for most operations wherever possible? Reaccess the possibility of using genericQuery and genericUpdate for most operations.
- For all new queries and mutations try to use parameters in format ($db_name: String!, $schema: String, $value: String!)
- reaccess the ntire codebase and check if there are any other places where genericQuery and genericUpdate can be used and also possibility of using parameters in format ($db_name: String!, $schema: String, $value: String!)