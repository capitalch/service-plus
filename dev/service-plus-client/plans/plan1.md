# Login Screen Implementation Plan

## Workflow

```
User lands on login page
    ↓
Types 2+ characters in Client dropdown
    ↓
RTK Query API call fetches matching clients (REST endpoint)
    ↓
User selects client from dropdown
    ↓
User enters email/username and password
    ↓
Form validated using react-hook-form + zod
    ↓
Submit login via REST API OR click "Forgot Password"
    ↓
Success: Store token + Navigate to dashboard | Error: Show Sonner notification
    ↓
Post-login: All API calls use GraphQL with Authorization header + token
```

## ✅ Completed Steps

- ✅ Step 0: Install Required Dependencies (All dependencies installed)
- ✅ Step 1: Create Centralized Messages File (`src/constants/messages.ts`)
- ✅ Step 2: Setup RTK Query API (`src/store/api/baseApi.ts`, `src/store/api/authApi.ts`)
- ✅ Step 3: Setup Redux Auth Slice (`src/store/slices/authSlice.ts`)
- ✅ Step 4: Configure Redux Store (`src/store/index.ts`)
- ✅ Step 5: Setup Apollo Client (`src/lib/apollo-client.ts`)

## 🔄 Next Steps to Implement

### Step 1: Install shadcn UI Components

**Command:**
```bash
pnpm dlx shadcn@latest add button input label card command
```

**Purpose:** Install shadcn components needed for login screen
- button, input, label - Form controls
- card - Container for login form
- command - Client combobox with search

**Files created:** `src/components/ui/button.tsx`, `input.tsx`, `label.tsx`, `card.tsx`, `command.tsx`

---

## Step 2: Create Zod Validation Schemas

Update `src/store/api/authApi.ts` to support email or username login:
- Modify `LoginRequest` interface:
  - Add `emailOrUsername: string` field (replaces separate username field)
  - Keep `clientId: string` and `password: string`
- Types already defined:
  - `Client`, `User`, `LoginResponse`
  - `ForgotPasswordRequest`, `ForgotPasswordResponse`
  - `SearchClientsRequest`, `SearchClientsResponse`

**Note:** The backend should accept either email or username in the `emailOrUsername` field.

Create `src/schemas/authSchemas.ts`:
- **loginSchema**: Validates clientId (required), emailOrUsername (min 3 chars), password (min 6 chars)
- **forgotPasswordSchema**: Validates email (required, valid email format)
- Use messages from `src/constants/messages.ts` via `VALIDATION_MESSAGES`
- Export TypeScript types: `LoginFormData`, `ForgotPasswordFormData`

**Example:**
```typescript
import { z } from 'zod';
import { MESSAGES } from '@/constants/messages';

export const loginSchema = z.object({
  clientId: z.string().min(1, MESSAGES.ERROR_CLIENT_REQUIRED),
  emailOrUsername: z
    .string()
    .min(1, MESSAGES.ERROR_EMAIL_OR_USERNAME_REQUIRED)
    .min(3, MESSAGES.ERROR_EMAIL_OR_USERNAME_MIN_LENGTH),
  password: z
    .string()
    .min(1, MESSAGES.ERROR_PASSWORD_REQUIRED)
    .min(6, MESSAGES.ERROR_PASSWORD_MIN_LENGTH),
});

export type LoginFormData = z.infer<typeof loginSchema>;
```

---

## Step 3: Create Custom Hooks

**Create `src/hooks/useDebounce.ts`:**
- Generic debounce hook with configurable delay (default 300ms)
- Returns debounced value after delay

**Create `src/hooks/useClientSearch.ts`:**
- Encapsulates client search logic with debouncing
- Uses `useLazySearchClientsQuery` from authApi
- Integrates `useDebounce` hook
- Returns: `searchTerm`, `setSearchTerm`, `clients`, `isLoading`, `error`
- Automatically triggers search when term length >= 2

---

## Step 4: Create Client Type-Ahead Component

Create `src/components/ClientCombobox.tsx`:
- Uses shadcn Command component for search UI
- Integrates `useClientSearch` hook for debounced API calls
- Display loading state while fetching from REST API
- Show "No results" when no matches
- Handle selection and update form state
- Framer Motion for smooth open/close animations
- Red error text for error states only
- **Props:** `{ value: string; onValueChange: (value: string) => void; error?: string }`

---

## Step 5: Create Login Form Component

Create `src/components/LoginForm.tsx`:
- Use react-hook-form with zod resolver
- Implement form fields:
  - Client dropdown (using ClientCombobox component)
  - **Email/Username input field** (accepts both email and username)
  - Password input field (type="password")
  - "Remember me" checkbox (optional)
  - Submit button
  - "Forgot Password?" link
- Add red asterisk (*) for mandatory field labels
- Never use red color for control styling (only for errors)
- Display validation errors below each field in red
- Handle form submission with RTK Query `useLoginMutation` (REST API call)
- On successful login:
  - Store token in Redux store and localStorage
  - Token will be used for Authorization headers in subsequent protected GraphQL requests
  - Navigate to dashboard
- Show Sonner notifications for success/error
- **Props:** `{ onForgotPassword: () => void; onSuccess: () => void }`

---

## Step 6: Create Forgot Password Component

Create `src/components/ForgotPasswordForm.tsx`:
- Uses `react-hook-form` with `zodResolver` and `forgotPasswordSchema`
- Single email field with validation
- Label with red asterisk (*) for required field
- Error message below field in red
- "Send Reset Link" button with loading state
- "Back to login" or "Cancel" button
- Uses `useForgotPasswordMutation` from authApi
- On success: shows success toast and calls callback
- On error: displays error message and shows toast
- Framer Motion for entrance/exit animations
- **Props:** `{ onBack: () => void; onSuccess?: () => void }`

---

## Step 7: Create Login Page Component

Create `src/pages/LoginPage.tsx`:
- Page-level component with centered layout
- Background gradient (gradient-to-br from-neutral-50 to-neutral-100)
- Card container with shadow-lg for depth
- State management for view switching: "login" | "forgotPassword"
- Conditionally renders LoginForm or ForgotPasswordForm
- Uses AnimatePresence from framer-motion for smooth transitions
- Title: "Welcome Back" for login, "Reset Password" for forgot password
- Subtitle from MESSAGES constants
- Responsive design with max-w-md container
- On login success: navigate to '/'

---

## Step 8: Setup Routing

Update `src/router/index.tsx`:
- Import LoginPage component
- Add `/login` route at root level
- Update root path `/` (currently renders App)
- Add protected route wrapper for authenticated routes (optional)

**Router structure:**
```typescript
import LoginPage from '@/pages/LoginPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <App />,
    // Optional: Wrap with ProtectedRoute
  },
]);
```

---

## Step 9: Update App Component (Optional)

Update `src/App.tsx`:
- Replace ComponentExample with authentication check
- If not authenticated, redirect to `/login`
- If authenticated, show ComponentExample or dashboard UI
- Or use ProtectedRoute wrapper component for route-level protection

---

## Step 10: Verification and Testing

### Verification Steps:
1. **Run dev server:** `pnpm start`
2. **Navigate to:** `http://localhost:3001/login`
3. **Test client search:** Type 2+ characters, verify API call and results
4. **Test form validation:** Submit empty, verify red error messages
5. **Test login:** Submit valid data, verify token stored and redirect
6. **Test forgot password:** Click link, verify view switch with animation
7. **Check localStorage:** Verify token and user persisted after login
8. **Check Redux DevTools:** Verify auth state updated
9. **Check console:** No errors or warnings

### Manual Testing Checklist:
- [ ] Client search triggers after 2 characters
- [ ] Client search debounces properly (no excessive API calls)
- [ ] Login form validates all fields with correct error messages
- [ ] Successful login stores token and redirects to /
- [ ] Failed login shows appropriate error message
- [ ] Forgot password sends reset link successfully
- [ ] Form switching animates smoothly with framer-motion
- [ ] Red asterisks (*) appear on all required fields
- [ ] Error messages display in red color only
- [ ] Toast notifications work correctly with Sonner
- [ ] Responsive design works on mobile/tablet/desktop

---

## Step 11: Style and Polish

- Apply consistent spacing using Tailwind utilities
- Ensure accessibility (ARIA labels, keyboard navigation)
- Add focus states for all interactive elements
- Implement smooth error message animations using framer-motion
- Test responsive design on different screen sizes
- Add loading states with skeleton loaders or spinners
- Apply consistent focus states for accessibility

---

## Dependencies Summary

**Production (Login Screen):**
- react-hook-form
- zod
- @hookform/resolvers
- framer-motion
- sonner
- react-router-dom
- @reduxjs/toolkit (includes RTK Query)

**Production (Post-Login - to be added later):**
- @apollo/client
- graphql

**Development (Post-Login - to be added later):**
- @graphql-codegen/cli
- @graphql-codegen/typescript
- @graphql-codegen/typescript-operations
- @graphql-codegen/typescript-react-apollo

**Note:** Shadcn components will be installed as needed during implementation using `pnpm dlx shadcn@latest add <component>`

## Key Technical Decisions

1. **API Strategy** (Following claude.md best practices):
   - **Pre-login API calls**: Use RTK Query with REST endpoints (simpler approach)
     - Client search, login, forgot password
   - **Post-login protected API calls**: Use GraphQL with `Authorization: Bearer <token>` header
     - Dashboard, user data, business operations
   - Apollo Client middleware will automatically attach token from Redux store
   - Token persisted in both Redux store and localStorage
2. **Type-ahead Implementation**: Use shadcn Command + Popover with RTK Query lazy hook
3. **Debounce**: 300ms delay before triggering search (only after 2+ chars)
4. **Validation**: Client-side with zod, server-side validation on submit
5. **State Management**: Redux for global auth state, RTK Query for API caching, react-hook-form for form state
6. **Notifications**: Sonner for all toast notifications
7. **Error Colors**: Red (#ef4444 or red-500) only for errors and mandatory asterisks
8. **Animations**: Subtle framer-motion transitions (fade, slide, scale)
9. **Code Generation**: GraphQL Codegen for post-login type-safe queries (added later)
