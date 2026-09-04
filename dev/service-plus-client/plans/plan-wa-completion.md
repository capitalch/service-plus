# Customer Connect — Job Completion: full send history (implemented)

## Goal

The Job Completion tab showed only *when the last message went out*. A customer
can be sent several completion messages for the same job (a resend after a
failure, a nudge before pickup), and each one has its own outcome — accepted,
delivered, read, failed. Show all of them, with their times and results.

## The shape chosen — an `attempts` array *inside* the existing event object

`prompt.md` floated "maybe we require an array in whatsapp_notifications for job
completion." Two readings of that:

- **Replace** `JOB_COMPLETION`'s flat object with an array, the way
  `JOB_MONEY_RECEIPT` is shaped (`plan-money-receipt.md`).
- **Nest** an array inside the object it already has.

Nesting won, and not narrowly. `JOB_MONEY_RECEIPT` is an array because its
elements are *different subjects* — one per `payment_id`, each with its own
independent ladder. `JOB_COMPLETION`'s attempts are all the same subject: one
job, messaged repeatedly. Replacing the object would have meant rewriting
`SET_JOB_WHATSAPP_ATTEMPT`/`_OUTCOME` (shared verbatim by three events),
`GET_WHATSAPP_EVENT_LOG_PAGED`'s `jsonb_typeof(...) = 'object'` filter and its
`last_sent_at` sort, `hasAnyPriorAttempt` (which gates every checkbox on the
grid), the live-subscription patch, and a data migration for every job already
messaged — to display something the flat fields could carry alongside.

So the flat fields stay exactly as they were and stay authoritative for
everything that sorts, badges, counts, or gates selection. `attempts` is purely
additive: a job messaged before this existed has no `attempts` key and renders
precisely as it did.

```jsonc
"JOB_COMPLETION": {
  "attempt_count": 2, "success_count": 1, "fail_count": 1,     // unchanged
  "last_wamid": "wamid-2", "last_sent_at": "…",                // unchanged
  "last_status": "READ", "last_error": null,                   // unchanged
  "attempts": [                                                // new, newest last
    { "attempt_no": 1, "wamid": "wamid-1", "sent_at": "…",
      "status": "FAILED", "status_at": "…", "error": "Re-engagement message" },
    { "attempt_no": 2, "wamid": "wamid-2", "sent_at": "…",
      "status": "READ",  "status_at": "…", "error": null }
  ]
}
```

`status` starts at `ACCEPTED` (what the send itself knows) and is settled later
by Meta's webhook; `status_at` is null until that callback lands, which is
itself the useful signal — "sent, nothing back yet."

## Capped at 20

This is a display history for a log tab, not a compliance audit log. The array
lives inside a column read by every job grid on every page, so an uncapped one
grows without bound in the hot path. `SET_JOB_WHATSAPP_ATTEMPT` keeps the 19
most recent and appends the new one. `attempt_no` is carried explicitly rather
than inferred from array position, so a capped array still reads "12, 13, 14…"
and never lies about which send it was.

## Changes

### Server

- **`sql_jobs.py` · `SET_JOB_WHATSAPP_ATTEMPT`** — one more single-level
  `jsonb_set` on `'{attempts}'`, wrapping the existing chain. Prior elements are
  re-aggregated through `WITH ORDINALITY … ORDER BY ord DESC LIMIT 19`, then the
  new element is appended with `||`. Same defensive
  `jsonb_typeof(…) = 'array'` guard the rest of this file uses, so a missing or
  corrupted value self-heals to `[]` instead of erroring. The single-level rule
  documented above this query (jsonb_set cannot auto-vivify a nested path) is
  why the array is built as its own expression and attached in one step.
- **`sql_jobs.py` · `SET_JOB_WHATSAPP_OUTCOME`** — rewrites the element whose
  `wamid` matches the callback, setting `status`/`status_at`/`error`. Keyed on
  wamid, not position; the row-level `WHERE` already pins this to the current
  `last_wamid`, so at most one element can match.
- **`whatsapp_webhook_router.py`** — passes the new `settled_at` (ISO-8601 UTC,
  stamped once per callback, same convention as `sender.py`'s `sent_at`).

Both writes are still SQL-side atomic — no read-modify-write from Python, which
is what protects a concurrent send and webhook on the same job.

Not forked per event: `SET_JOB_WHATSAPP_ATTEMPT`/`_OUTCOME` are shared by
`JOB_COMPLETION`, `JOB_CREATION` and `JOB_DELIVERY` and take `%(event_key)s` as
a bind param, so all three start recording attempts. Forking a
completion-only copy to keep the change narrower would have meant maintaining
two divergent copies of the most delicate query in the file. `JOB_MONEY_RECEIPT`
has its own array-shaped writer and is untouched.

### Client

- **`customer-connect-schema.ts`** — `WhatsappAttempt`; `attempts?:` on
  `WhatsappCompletionState` (optional, because older rows genuinely don't have
  it).
- **`customer-connect-helpers.ts` · `resolveAttemptHistory`** — reconciles the
  recorded array against `attempt_count`, and this is the part that makes the
  feature visible on day one rather than after everyone has been messaged twice
  more. `attempts` only starts filling from this release, so every job in an
  existing database has counters proving several sends and nothing to show for
  them. The most recent send is still known — that is exactly what the flat
  `last_*` fields are — so it is synthesized into the list; the ones before it
  were never written down, so they are reported as a count of missing entries,
  never invented.
- **`whatsapp-status-cell.tsx`** — a numbered attempt list below the counters,
  newest first, each row carrying its time, status badge, and a tooltip with the
  settle time and failure reason. Shown whenever there is **any** attempt record
  at all, which replaces the flat "Last try" line and the lone status badge —
  both only repeat the newest row. A collapse toggle ("N sends") appears only
  when there is more than one row to collapse, and the list is expanded by
  default: a job messaged repeatedly is the row someone opens this screen to
  look at, and putting it behind a click reproduces the original complaint. Put
  in the shared cell rather than in the completion grid, so the other log tabs
  get it too.
- **The gate was wrong once, and it hid the whole feature.** It first read
  `totalSends > 1`, on the reasoning that one attempt is already described by
  the lines above it. But a job messaged exactly once has a complete, correctly
  recorded attempt — and that gate rendered the *old* flat display for it, so a
  freshly sent test job looked byte-for-byte as it did before any of this
  existed. Every send made after the feature shipped was a single-attempt job,
  so in practice the list almost never appeared. Show the record whenever there
  is a record; let the toggle, not the list, be what depends on the count.
- **`whatsapp-status-cell.tsx`** — the `—` fallback now also requires
  `attempts.length === 0`. A send that Meta hasn't settled yet has neither a
  success nor a failure to count, and used to fall through to `—`; with an
  attempt on record, "a message went out" is now sayable.
- **`customer-connect-helpers.ts` / `customer-connect-section.tsx`** —
  `applyOutcomeToAttempts` mirrors the server's settle rule for the live
  `whatsappDeliveryStatus` patch. Without it a live outcome would blank the
  expander until the next refresh.
- **`dev-help-content.ts`** — the "Is there an audit trail of every individual
  WhatsApp send attempt?" FAQ said "No"; that is no longer true.

## Verification

Both queries were executed against the live Postgres as pure expressions over
literal jsonb (no table touched): first send onto a NULL column, webhook settle,
resend, second settle. Append, in-place settle by wamid, and element order all
behave. The settle was additionally replayed against a verbatim copy of a real
row's value (`J/00001`, real wamid) and produced the correct result.

`scripts/verify_whatsapp_attempts.sql` (server repo) is the standalone form of
that check, plus the cases the ad-hoc run didn't cover — legacy row with no
`attempts` key, corrupted non-object value, the 20-element cap, and the
`JOB_MONEY_RECEIPT` array shape. Table-free, so it is safe against any database:

```
psql "<conn>" -f scripts/verify_whatsapp_attempts.sql
```

**One live row looks wrong and is not**: `J/00001`'s attempt shows `ACCEPTED`
with a null `status_at` while the flat fields say `DELIVERED`. Its callback was
processed while uvicorn's `--reload` was cycling through the edits that added
this feature, so the append ran under the new query and the settle under the
old one. Replaying that callback against today's code settles it correctly.
Sends from here on record both halves.
