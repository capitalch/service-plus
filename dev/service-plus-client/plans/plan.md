# Plan: Persist error/warning messages in MailAdminCredentialsDialog until user dismisses

## Context

Currently, when the "Reset password and mail" operation fails or the email is not sent,
`toast.error` / `toast.warning` (Sonner) are used. These auto-dismiss after a few
seconds and the user cannot read the full message in time.

The fix: replace transient toasts for **error and warning** outcomes with an inline
alert inside the dialog. The alert has a close (×) button — it stays visible until the
user clicks it. On success the dialog closes immediately, so the success toast stays
as-is.

---

## Workflow

Add inline alert state to the dialog → render an Alert component with a close button
inside `DialogContent` → replace `toast.error` / `toast.warning` calls with state
setters → keep `toast.success` unchanged → dialog close clears the alert state.

---

## Step 1 — Add `alert` state to `mail-admin-credentials-dialog.tsx`

**File:** `service-plus-client/src/features/super-admin/components/mail-admin-credentials-dialog.tsx`

Add a local type and state variable to hold the inline alert:

```tsx
type AlertStateType = { message: string; variant: "destructive" | "warning" } | null;
const [alert, setAlert] = useState<AlertStateType>(null);
```

---

## Step 2 — Replace `toast.error` / `toast.warning` with `setAlert`

In `handleMailCredentials`, replace:

| Old | New |
|-----|-----|
| `toast.error(MESSAGES.ERROR_ADMIN_MAIL_CREDENTIALS_FAILED)` | `setAlert({ message: MESSAGES.ERROR_ADMIN_MAIL_CREDENTIALS_FAILED, variant: "destructive" })` |
| `toast.warning(MESSAGES.WARN_ADMIN_CREDENTIALS_MAIL_NOT_SENT)` | `setAlert({ message: MESSAGES.WARN_ADMIN_CREDENTIALS_MAIL_NOT_SENT, variant: "warning" })` |

For both error and warning cases, **do not close the dialog** — keep it open so the
user can read the message and dismiss it manually with the close button.

Remove `onSuccess()` and `onOpenChange(false)` from the warning path — call them only
on the success (`emailSent === true`) path.

---

## Step 3 — Render the inline Alert inside `DialogContent`

Import `Alert`, `AlertDescription` from shadcn/ui and `XIcon` from lucide-react.

Add just above `<DialogFooter>`:

```tsx
{alert && (
    <Alert variant={alert.variant} className="relative pr-8">
        <AlertDescription>{alert.message}</AlertDescription>
        <button
            aria-label="Dismiss"
            className="absolute right-2 top-2 opacity-70 hover:opacity-100"
            onClick={() => setAlert(null)}
        >
            <XIcon className="h-4 w-4" />
        </button>
    </Alert>
)}
```

---

## Step 4 — Clear alert when dialog closes

Wrap the `onOpenChange` prop into a local handler that also clears the alert:

```tsx
function handleOpenChange(open: boolean) {
    if (!open) setAlert(null);
    onOpenChange(open);
}
```

Use `handleOpenChange` on the `<Dialog>` `onOpenChange` prop and on the Cancel button's
`onClick`.

---

## Summary of files to change

| File | Change |
|------|--------|
| `mail-admin-credentials-dialog.tsx` | Add `alert` state; replace error/warning toasts with inline Alert with close button; clear on dialog close |
