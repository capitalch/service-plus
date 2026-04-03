# instructions
- Always make responsive design
- When any text command is given and last word is plan then do the plan only for the given command. Write your plan in the planA.md file in the plans folder in root (in windows it is C:\projects\service-plus\dev\service-plus-client/plans). Don't touch existing plan.md file.
- Overwrite planA.md if aleady present.
- In planA.md write all the steps of execution as Step1, Step 2 and so on.
- In planA.md include a workflow section which provides the workflow of entire work.
- When creating a form never use red color for any control css. Red color will only be used for indicating errors.
- Always make use of shadcn components, and framer-motion for transition wherever required
- For forms use react-hook-form and zod for validations and business rules
- Use GraphQL with subscription support for authenticated query. 
- Use apollo for GraphQL.
- Use Sonner for notifications
- use pnpm and not npm
- use React Router + Redux Toolkit
- For global state management use redux
- When creating a form, the * for mandatory fields should be red color
- Keep all the messages and custom errors in a centralized sngle file as key values. Use the keys from this file to display any message including exception. Rule is any text longer than two words should stay in messages.ts. But keep all controls display text hard coded.
- For protected api calls after login use graphql with header Authorization + token. Otherwise use axios for api calls
- For components, hooks use arrow functions
- For Utility functions and API helpers and inline handlers use Normal functions
- Always sort the functions in a file alphabetically
- Use type instead of interface wherever possible
- All type element names should be appended with Type word
- Always sort functions with names in a react component. Always sort arrays, fields and object properties and parameters
- Sort tailwind classes as best practises
- The fastapi + graphql server is located at C:\projects\service-plus\dev\service-plus-server.
- /src/types/db-schema-service.ts is the file which has all the types for demo1 schema from database service-plus-service.
- /src/types/db-schema-security.ts is the file which has all the types for security schema from database service-plus-service.
- /src/types/db-schema-client.ts is the file which has all the types for public schema from database service-plus-client.
- Never use index.ts for re-exporting. Always use explicit named imports for intra-feature and cross-feature imports
- Always do proper error handling
- Always sort the ojects and types by its properties
- Always use useAppDispatch instead of useDispatch
- Always use useAppSelector instead of useSelector
- Always use apolloClient.query(...) instead of useApolloClient() hook
- default debounce time is 1200ms
- When creating a form, When validation happens the error should reflect immediately the result
- When any validation fails the form should not submit and submit button should be disabled
- Make use of genericQuery and genericUpdate as far as possible for insert, update, delete and get operations.
- For all new queries and mutations try to use genericQuery and genericUpdate as far as possible
- For all new queries and mutations try to use parameters in format ($db_name: String!, $schema: String, $value: String!)
- Capabilities Summary of genericUpdate
    | Feature | Supported |
    |---------|-----------|
    | Single master INSERT | ✅ |
    | Single master UPDATE | ✅ |
    | Multiple child rows (xData as list) | ✅ |
    | Single child row (xData as dict) | ✅ |
    | FK auto-injected from parent RETURNING id | ✅ |
    | Unlimited nesting depth (recursive) | ✅ |
    | Multiple sibling child tables (xDetails as list) | ✅ |
    | Delete child rows by id list (deletedIds) | ✅ |
    | Full transaction (all-or-nothing) | ✅ |
    | isIdInsert flag to force INSERT with explicit id | ✅ |
# directions
- At client side, In client mode, all the components are in components folder. 
- Based on main menu at the top create folders for each menu item and create a page for each menu item in the pages folder.
- For each submenu item in sidebar create corresponding folder in the main menu folder. Maintain the hierarchy of menus in the folder structure.
- Try to reuse components as much as possible. Keep the shared components in the shared folder.