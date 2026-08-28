# Bug fix
- Jobs > Receipts > New Receipt. When there is a single division in the selected Business Unit, I create a new money receipt against a job and click save button in the modal, There is error. Related to receipt auto series. Check this issue.
- This bug at server:
2026-08-29 00:10:22 - service_plus - ERROR - error_handling.py:45 - wrapper() - Error creating job payment: Database query failed
Traceback (most recent call last):
  File "/home/sushant/projects/service-plus/dev/service-plus-server/app/db/connection/psycopg_driver.py", line 87, in _open_db_connection
    yield conn
  File "/home/sushant/projects/service-plus/dev/service-plus-server/app/db/connection/psycopg_driver.py", line 500, in get_service_db_connection
    yield conn
  File "/home/sushant/projects/service-plus/dev/service-plus-server/app/graphql/resolvers/jobs/mutations.py", line 60, in resolve_create_job_payment_helper
    raise ValidationException(
    ...<4 lines>...
    )
app.core.exceptions.ValidationException: Requested resource not found

The above exception was the direct cause of the following exception:

Traceback (most recent call last):
  File "/home/sushant/projects/service-plus/dev/service-plus-server/app/graphql/resolvers/error_handling.py", line 41, in wrapper
    return await fn(*args, **kwargs)
           ^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/home/sushant/projects/service-plus/dev/service-plus-server/app/graphql/resolvers/mutation.py", line 407, in resolve_create_job_payment
    return await resolve_create_job_payment_helper(db_name, schema, value)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/home/sushant/projects/service-plus/dev/service-plus-server/app/graphql/resolvers/jobs/mutations.py", line 49, in resolve_create_job_payment_helper
    async with get_service_db_connection(db_name_arg) as conn:
               ~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^
  File "/usr/lib/python3.14/contextlib.py", line 235, in __aexit__
    await self.gen.athrow(value)
  File "/home/sushant/projects/service-plus/dev/service-plus-server/app/db/connection/psycopg_driver.py", line 491, in get_service_db_connection
    async with _open_db_connection(
               ~~~~~~~~~~~~~~~~~~~^
        host=host,
        ^^^^^^^^^^
    ...<5 lines>...
        autocommit=autocommit,
        ^^^^^^^^^^^^^^^^^^^^^^
    ) as conn:
    ^
  File "/usr/lib/python3.14/contextlib.py", line 235, in __aexit__
    await self.gen.athrow(value)
  File "/home/sushant/projects/service-plus/dev/service-plus-server/app/db/connection/psycopg_driver.py", line 102, in _open_db_connection
    raise DatabaseException(AppMessages.DATABASE_QUERY_FAILED) from e
app.core.exceptions.DatabaseException: Database query failed
Operation failed

GraphQL request:2:3
1 | mutation CreateJobPayment($db_name: String!, $schema: String, $value: String!) {
2 |   createJobPayment(db_name: $db_name, schema: $schema, value: $value)
  |   ^
3 | }
Traceback (most recent call last):
  File "/home/sushant/projects/service-plus/dev/service-plus-server/app/db/connection/psycopg_driver.py", line 87, in _open_db_connection
    yield conn
  File "/home/sushant/projects/service-plus/dev/service-plus-server/app/db/connection/psycopg_driver.py", line 500, in get_service_db_connection
    yield conn
  File "/home/sushant/projects/service-plus/dev/service-plus-server/app/graphql/resolvers/jobs/mutations.py", line 60, in resolve_create_job_payment_helper
    raise ValidationException(
    ...<4 lines>...
    )
app.core.exceptions.ValidationException: Requested resource not found

The above exception was the direct cause of the following exception:

Traceback (most recent call last):
  File "/home/sushant/projects/service-plus/dev/service-plus-server/app/graphql/resolvers/error_handling.py", line 41, in wrapper
    return await fn(*args, **kwargs)
           ^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/home/sushant/projects/service-plus/dev/service-plus-server/app/graphql/resolvers/mutation.py", line 407, in resolve_create_job_payment
    return await resolve_create_job_payment_helper(db_name, schema, value)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/home/sushant/projects/service-plus/dev/service-plus-server/app/graphql/resolvers/jobs/mutations.py", line 49, in resolve_create_job_payment_helper
    async with get_service_db_connection(db_name_arg) as conn:
               ~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^
  File "/usr/lib/python3.14/contextlib.py", line 235, in __aexit__
    await self.gen.athrow(value)
  File "/home/sushant/projects/service-plus/dev/service-plus-server/app/db/connection/psycopg_driver.py", line 491, in get_service_db_connection
    async with _open_db_connection(
               ~~~~~~~~~~~~~~~~~~~^
        host=host,
        ^^^^^^^^^^
    ...<5 lines>...
        autocommit=autocommit,
        ^^^^^^^^^^^^^^^^^^^^^^
    ) as conn:
    ^
  File "/usr/lib/python3.14/contextlib.py", line 235, in __aexit__
    await self.gen.athrow(value)
  File "/home/sushant/projects/service-plus/dev/service-plus-server/app/db/connection/psycopg_driver.py", line 102, in _open_db_connection
    raise DatabaseException(AppMessages.DATABASE_QUERY_FAILED) from e
app.core.exceptions.DatabaseException: Database query failed

The above exception was the direct cause of the following exception:

Traceback (most recent call last):
  File "/home/sushant/projects/service-plus/env/lib/python3.14/site-packages/graphql/execution/execute.py", line 530, in await_result
    return_type, field_nodes, info, path, await result
                                          ^^^^^^^^^^^^
  File "/home/sushant/projects/service-plus/dev/service-plus-server/app/graphql/resolvers/error_handling.py", line 46, in wrapper
    raise GraphQLException(
        message=exception_message, extensions={"details": str(e)}
    ) from e
app.core.exceptions.GraphQLException: Operation failed

The above exception was the direct cause of the following exception:

Traceback (most recent call last):
  File "/home/sushant/projects/service-plus/env/lib/python3.14/site-packages/graphql/execution/execute.py", line 530, in await_result
    return_type, field_nodes, info, path, await result
                                          ^^^^^^^^^^^^
  File "/home/sushant/projects/service-plus/dev/service-plus-server/app/graphql/resolvers/error_handling.py", line 46, in wrapper
    raise GraphQLException(
        message=exception_message, extensions={"details": str(e)}
    ) from e
graphql.error.graphql_error.GraphQLError: Operation failed

GraphQL request:2:3
1 | mutation CreateJobPayment($db_name: String!, $schema: String, $value: String!) {
2 |   createJobPayment(db_name: $db_name, schema: $schema, value: $value)
  |   ^
3 | }