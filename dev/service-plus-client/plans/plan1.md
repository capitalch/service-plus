# The `extended_warranty` app_setting — what each attribute does

## Goal

A reference for the one JSONB row that configures the Extended Warranty add-on:
`app_setting` id **16**, `setting_key = 'extended_warranty'`, one row per BU schema. Eight
attributes, each consumed at exactly one point in the flow. This is a **reference
document, not an implementation plan** — nothing here needs building; it explains what is
already live.

The live `demo1` value:

```json
{
  "enabled":               true,
  "notify_email":          "",
  "contact_phone":         "9831052332",
  "daily_send_cap":        250,
  "whatsapp_number":       "8910322267",
  "auto_send_enabled":     false,
  "reminder_days_before":  [30, 7, 0],
  "staff_whatsapp_number": "9831052332"
}
```

Read server-side by `get_ew_settings` (`sender.py:1169-1184`), which merges the stored
object over `_EW_DEFAULT_SETTINGS` so a partial or missing row never raises. Read
client-side twice: `client-layout.tsx` for `enabled`, and `extended-warranty-section.tsx`
for `reminder_days_before`.

---

## Present context — where each attribute enters the flow

```
   ┌── enabled ──────────────► is the module visible / may we send at all
   │
   │   reminder_days_before ──► which customers are DUE, and at which stage
   │                            └─► the stage number is signed into the customer's link
   │
   │   daily_send_cap ────────► how many of the selected customers actually go out today
   │
   │   contact_phone ─────────┐
   │   whatsapp_number ───────┴► printed INSIDE the customer's WhatsApp message
   │
   ▼
 Staff open Custom → Extended Warranty → Due tab, select customers, click Send
   │
   ▼
 Customer receives the reminder and taps "I am interested…"
   │
   ▼
 Lead is saved  ──┬─► staff_whatsapp_number ──► WhatsApp alert to the company number
                  ├─► notify_email ───────────► email fallback
                  └─► (always) Interest tab + notification bell
   │
   ▼
 Staff follow up and close the lead
```

`auto_send_enabled` appears nowhere in that diagram — see below.

---

## The eight attributes

### `enabled` — the master switch

**Live value: `true`.** The add-on's on/off switch for this BU. Until the settings
consolidation it was its own `app_setting` row
(`extended_warranty_notifications_enabled`); it is now a field on this object.

Two independent consumers:

| Side | Where | Effect |
|---|---|---|
| Client | `client-layout.tsx` → Redux → `custom-menu-registry.ts:36` | Whether the **Custom** top-nav tab and the Extended Warranty screen exist. Also gates the notification bell's `COUNT_EW_NEW_INTEREST` query (`use-notifications-summary.ts`) |
| Server | `_is_ew_feature_enabled` (`sender.py:1155-1166`), called from `send_ew_reminders` | Whether a send is permitted at all. Returns `{"results": [], "disabled": true}` when off |

**Fails closed**, by strict `is True`: a missing key, a non-boolean, or the string
`"true"` all read as off. The client is never the gate — the server re-checks, because a
browser's copy of a flag is not proof of anything.

**This is not the only send gate.** `whatsapp_notifications.EXTENDED_WARRANTY` (a key on
`app_setting` row 15) must *also* be true before a message leaves. `enabled` answers "does
this tenant have the add-on"; that one answers "may messages go out right now". They are
separate so an owner can enter and review a copy-pasted customer list — or pause sending
during a problem — without the screen and its lead queue disappearing.

### `reminder_days_before` — the stage set

**Live value: `[30, 7, 0]`.** Days before warranty expiry at which a reminder is due.
`0` means on the expiry date itself. This is the single most load-bearing attribute: it is
**data, not code**, so adding a 60-day stage is a settings edit — no migration, no
deployment.

It drives four things:

1. **Who is due.** `GET_EW_DUE_CUSTOMERS` unnests the array and picks, per customer, the
   `MIN(stage)` whose threshold their remaining days have already crossed *and* which has
   not been sent successfully yet:
   ```sql
   SELECT MIN(s.stage) FROM unnest(%(stages)s::int[]) AS s(stage)
   WHERE (c.warranty_end_date - CURRENT_DATE) <= s.stage
     AND COALESCE(c.stages -> s.stage::text ->> 'delivery_status', 'NONE') IN ('NONE','FAILED')
   ```
   `MIN` picks the **most urgent** qualifying stage — a smaller number is nearer expiry. A
   customer entered late, with 5 days left and no reminder ever sent, gets the 7-day
   message once, not a backlog of 30 and 7. A stage whose last attempt `FAILED` is
   re-offered; one that succeeded never is.
2. **The stage key in `ew_customer.stages`.** Each stage's send state lives at
   `stages['30']`, `stages['7']`, `stages['0']` — keys created on demand, which is why a
   new stage needs no schema change.
3. **The signed customer link.** `sign_ew(db, schema, customer_id, stage)` embeds the
   stage, so a tap is attributed to the reminder that produced it.
4. **The screen.** `extended-warranty-section.tsx:52-57` reads the array to build the Due
   tab's stage selector and the dashboard funnel's columns — sorted descending, falling
   back to `[30, 7, 0]` only if the setting is absent or empty.

**Not configurable here:** how far *past* expiry a record stays eligible. That is
`_EW_GRACE_DAYS = -7`, hardcoded in `sender.py:1134` — a warranty that lapsed a week ago is
still worth a nudge, one that lapsed six months ago is not.

### `daily_send_cap` — the volume brake

**Live value: `250`.** Checked once, up front, in `send_ew_reminders` (`sender.py:1350-1362`):

```python
cap = int(settings_row.get("daily_send_cap") or 0)
if cap > 0:
    already_sent = <GET_EW_SENT_TODAY_COUNT>
    remaining = max(0, cap - already_sent)
else:
    remaining = len(rows)
allowed, capped = rows[:remaining], rows[remaining:]
```

Three things worth knowing:

- **`0` means unlimited**, not "send nothing". The `else` branch lets every selected row
  through.
- **The count is per BU schema, per day** — `GET_EW_SENT_TODAY_COUNT` has no branch filter
  and counts every non-`FAILED` send since `date_trunc('day', now())`. A tenant with three
  BUs can therefore send `cap × 3` in a day.
- **Checked once, not per message**, so an oversized selection degrades predictably: the
  first `remaining` go, the rest come back as `capped` and are reported to the user rather
  than half-sending.

This exists because the customer reminder is a **MARKETING**-category template to a
non-opt-in list. The cap is one of the several mitigations, alongside both switches
defaulting off, the once-per-stage guard, and the opt-out link.

### `contact_phone` and `whatsapp_number` — what the customer is told to call

**Live values: `9831052332` and `8910322267`.** These two are pure message content. They
are body parameters 5 and 6 of the `EXTENDED_WARRANTY` template, supplied by
`_build_ew_params` (`sender.py:1204-1205`):

```python
_sanitize(str(settings_row.get("contact_phone") or "-")),
_sanitize(str(settings_row.get("whatsapp_number") or "-")),
```

They render in the closing line — *"For details call {{contact_phone}} or WhatsApp
{{whatsapp_number}}"*. Nothing validates them at send time: **a blank one sends a literal
`-` to the customer**, which reads as a broken message rather than failing loudly. The new
settings dialog validates them on entry, which is where the real guard lives.

They are two fields rather than one because they are genuinely different channels — a
landline the shop answers versus a WhatsApp-capable number.

### `staff_whatsapp_number` — where a lead is announced

**Live value: `9831052332`.** The company number that receives the
`EXTENDED_WARRANTY_LEAD` alert the moment a customer taps "I am interested".
`send_ew_lead_alert` (`sender.py:1410-1423`) reads it and branches three ways:

| Value | Behaviour |
|---|---|
| Blank | Returns immediately — **silently**, no record anywhere |
| Not a valid mobile | Writes `FAILED` to `stages[n].interest.alert` with the reason, so the Interest grid shows a chip and offers a re-send |
| Valid | Sends the five-line lead alert, with an "Open in Service+" deep link |

That asymmetry is deliberate but worth knowing: **blank means "we don't want this channel",
invalid means "we wanted it and it broke"** — only the second is surfaced.

The whole call is best-effort and never raises into the customer's request. The lead is
committed to the database *before* any notification is attempted, so a Meta outage or a bad
number can never lose a customer's tap.

### `notify_email` — the email fallback

**Live value: `""` — this channel is off.** Read by `_notify_by_email`
(`extended_warranty_router.py:246-247`), which returns immediately when blank. When set, it
receives a plain-text summary of the lead — name, brand, product, expiry, which stage
triggered it, and whether they prefer a call or WhatsApp.

It is the second of two redundant notification channels for the same lead, not an
alternative: both fire on the same tap, and both are best-effort.

**With `notify_email` blank and `staff_whatsapp_number` set, as on `demo1`, a customer's
tap produces exactly one outbound notification** (the WhatsApp alert) plus the in-app
Interest tab and bell count, which are always updated regardless.

### `auto_send_enabled` — currently inert

**Live value: `false`, and it would change nothing if set to `true`.** The key exists in
`_EW_DEFAULT_SETTINGS` (`sender.py:1137`), in the seed, and in the TypeScript type — and is
read by **no code at all**. `app/scheduler.py` is the monthly stock-snapshot job and knows
nothing about Extended Warranty.

It is a placeholder for plan.md's **Step 9 (Scheduler)**, which is deliberately not built:
the prompt asked for "reminders are sent on button click", and manual sending is complete.
The setting was seeded ahead of time so that wiring a daily job later needs no schema
change and no migration.

The settings dialog labels it *"Not in effect yet — reminders are sent from the Due tab"*
rather than hiding it, since it is real stored state that a future release will honour.

---

## Key constraints

- **Every attribute is per BU schema.** Two BUs in one tenant have independent numbers,
  caps and stage sets. The cap in particular is not a tenant-wide ceiling.
- **The row is admin-editable JSON**, so `get_ew_settings` merges over defaults and repairs
  `reminder_days_before` when it is not a non-empty list. No consumer may assume a key is
  present.
- **`enabled` is one of two send gates**; `whatsapp_notifications.EXTENDED_WARRANTY` is the
  other, and both must be true.
- **Only `enabled` and `reminder_days_before` reach the client.** The four contact fields
  and the cap are server-side only — the browser never needs them, and the phone numbers
  are printed into messages by the server.

## Flags

- `contact_phone` and `whatsapp_number` **degrade to `-` in a live customer message** when
  blank. The only protection is entry-time validation in the settings dialog.
- A blank `staff_whatsapp_number` **silently** disables the staff alert. Combined with a
  blank `notify_email` — the shipped default for both — a tenant that switches the add-on
  on without configuring it will capture leads in-app but announce them nowhere.
- `daily_send_cap: 0` means unlimited. If someone sets it to zero intending "stop sending",
  they get the opposite.
