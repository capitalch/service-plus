# Plan: Client-Side Email Uniqueness Validation for Business User Edit

## Goal
Validate business user email uniqueness on the client-side during the edit workflow, preventing submission if the given email already belongs to another existing user.

## Workflow
1. Intercept email changes in the edit business user form using `useWatch` and debounce the input to avoid excessive API calls.
2. If the new email is valid and different from the user's original email, trigger a validation query.
3. Use the existing `genericQuery` functionality with `SQL_MAP.CHECK_BUSINESS_USER_EMAIL_EXISTS_EXCLUDE_ID` to perform the database check.
4. Update form state and prevent submission if the exact email is taken by another user.

## Step-by-Step Execution

### Step 1: Add State Variables in `edit-business-user-dialog.tsx`
- Add `checkingEmail` (boolean, default false) to track API loading state.
- Add `emailTaken` (boolean | null, default null) to store the validation result.
- Hook into the form's email field using `useWatch` and debounce the value using `useDebounce` (default 1200ms).

### Step 2: Implement the Validation `useEffect` Hook
- Create a `useEffect` that depends on `debouncedEmail`.
- Ensure it skips execution if:
  - `debouncedEmail` hasn't changed from the user's original email.
  - The email field is already failing local format validation (checked via `form.getFieldState("email")`).
- Trigger `apolloClient.query` using `GRAPHQL_MAP.genericQuery` and `SQL_MAP.CHECK_BUSINESS_USER_EMAIL_EXISTS_EXCLUDE_ID`.
- Pass parameters using the standard genericQuery format:
  ```typescript
  variables: {
      db_name: dbName,
      schema: "security",
      value: graphQlUtils.buildGenericQueryValue({
          sqlArgs: { email: debouncedEmail, id: user.id },
          sqlId: SQL_MAP.CHECK_BUSINESS_USER_EMAIL_EXISTS_EXCLUDE_ID,
      }),
  }
  ```
- If the result indicates the email exists, call `form.setError("email", { ... })` using the appropriate message from `MESSAGES`.
- If the result is false, call `form.clearErrors("email")`.

### Step 3: Handle UI Feedback and Submit Validation
- In the JSX, add a conditional loading spinner (`Loader2`) inside the email input when `checkingEmail` is true.
- Add a success indicator (`Check` icon) when `checkingEmail` is false, `emailTaken` is false, and there are no other errors.
- Ensure the `submitDisabled` logic accounts for `checkingEmail` and `emailTaken === true` to properly prevent form submission before/during/after validation.

### Step 4: Add Username Validation Consistency (Optional but recommended)
- If the username is also editable, apply the identical debounced validation pattern using `SQL_MAP.CHECK_BUSINESS_USER_USERNAME_EXISTS_EXCLUDE_ID`.

## Verification Plan
1. Open the Edit Business User dialog.
2. Enter an email address that belongs to a different business user.
3. Observe the UI reflecting the loading state, followed by an error message.
4. Verify that the Submit button is completely disabled.
5. Revert the email back to the user's original email; verify that no validation error occurs and the submit button re-enables.
