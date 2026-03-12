# Plan: Surface email failure reason to the SA in the Reset Password dialog

## Context

When `resolve_mail_admin_credentials_helper` cannot reach the mail server (e.g.
`[Errno 11003] getaddrinfo failed`), it catches the exception, logs a warning, and
returns `{"id": id, "email_sent": False}`. The client receives `email_sent = false`
and shows the generic warning:
> "Password was reset, but the credentials email could not be sent. Please share
> credentials manually."

The SA has no visibility into *why* the email failed. The fix passes the error reason
from the server to the client and displays it as a second line inside the persistent
inline alert.

---

## Workflow

Server captures error string → returns it in `email_error` field → client type updated
to include `email_error` → dialog renders the detail below the warning message.

---

## Step 1 — Server: capture and return `email_error` in `mutation_helper.py`

**File:** `service-plus-server/app/graphql/resolvers/mutation_helper.py`
**Function:** `resolve_mail_admin_credentials_helper`

Change the email block from:

```python
email_sent = False
try:
    await send_email(...)
    email_sent = True
except Exception as mail_err:
    logger.warning(f"Failed to send reset credentials email to {user['email']}: {mail_err}")

return {"id": id, "email_sent": email_sent}
```

To:

```python
email_sent = False
email_error: str | None = None
try:
    await send_email(...)
    email_sent = True
except Exception as mail_err:
    email_error = str(mail_err)
    logger.warning(f"Failed to send reset credentials email to {user['email']}: {mail_err}")

return {"id": id, "email_sent": email_sent, "email_error": email_error}
```

---

## Step 2 — Client: update `MailAdminCredentialsResultType`

**File:** `service-plus-client/src/features/super-admin/components/mail-admin-credentials-dialog.tsx`

Add `email_error` to the result type:

```ts
type MailAdminCredentialsResultType = {
    mailAdminCredentials: { email_error: string | null; email_sent: boolean; id: number };
};
```

---

## Step 3 — Client: show `email_error` detail in the warning alert

**File:** `service-plus-client/src/features/super-admin/components/mail-admin-credentials-dialog.tsx`

In `handleMailCredentials`, when `emailSent` is false, pass the error detail into the
alert state. Add `email_detail` to `AlertStateType`:

```ts
type AlertStateType = {
    detail?: string;
    message: string;
    variant: "destructive" | "warning";
} | null;
```

Set the alert:

```ts
const emailError = result.data?.mailAdminCredentials?.email_error ?? undefined;
setAlert({
    detail: emailError,
    message: MESSAGES.WARN_ADMIN_CREDENTIALS_MAIL_NOT_SENT,
    variant: "warning",
});
```

---

## Step 4 — Client: render `detail` in the Alert

In the JSX, render `detail` as a smaller second line when present:

```tsx
{alert && (
    <Alert variant={alert.variant} className="relative pr-8">
        <AlertDescription>
            {alert.message}
            {alert.detail && (
                <span className="mt-1 block text-xs opacity-75">{alert.detail}</span>
            )}
        </AlertDescription>
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

## Summary of files to change

| File | Change |
|------|--------|
| `mutation_helper.py` | Capture `email_error` string; return it alongside `email_sent` |
| `mail-admin-credentials-dialog.tsx` | Add `email_error` to result type; add `detail` to `AlertStateType`; render detail in alert |
