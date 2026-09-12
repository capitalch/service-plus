"""Extended Warranty reminders — SQL for the single `ew_customer` table.

Everything about one warranty lead lives on one row: the per-stage reminder and
interest state in the `stages` jsonb, the staff follow-up history in the `follow_ups`
jsonb array, and denormalised flat columns for anything a grid filters or sorts on.
That split is deliberate and mirrors `job.whatsapp_notifications` (sql_jobs.py) — the
flat columns stay authoritative for badges/sorting/selection, the jsonb is history.

Four rules every write below obeys, all learned on the job path (see the comments above
SET_JOB_WHATSAPP_ATTEMPT in sql_jobs.py):

1. `jsonb_set` cannot auto-vivify a path more than one level deep. Build the new object
   as its own expression and attach it with ONE single-level `jsonb_set`. Nesting is
   built with the `||` merge operator, which has no such restriction.
2. Guard every read of a nested object with `jsonb_typeof(...) = 'object'`, so a legacy
   or corrupted value self-heals to '{}' instead of raising.
3. Read with chained `->` / `->>`, never `#>>` path arrays — those raise when a segment
   can't be resolved against the runtime type.
4. Cap every array. `follow_ups` keeps 50; the row is read on every page of every grid.

`stages` is keyed by the days-before bucket **as a string** ('30', '7', '0') because
jsonb object keys are always text. Always pass `%(stage)s` as text from Python and cast
on the way out (`(s.key)::smallint` in ew_stage_v).
"""


class ExtendedWarrantySql:
    """SQL for Extended Warranty leads, reminders, interest and follow-ups."""

    # ── Writes — raw jsonb ────────────────────────────────────────────────────

    # The exactly-once guard, and the reason this feature needs no ew_reminder table.
    # Under READ COMMITTED an UPDATE that blocks on a concurrent writer re-evaluates
    # this WHERE against the *updated* row before proceeding (EvalPlanQual), so of two
    # senders racing for the same (customer, stage) exactly one gets a row back and the
    # other skips without ever calling Meta. Claimed BEFORE the send, as PENDING.
    #
    # `IN ('NONE', 'FAILED')` is what keeps a failed stage re-sendable: 'NONE' is a stage
    # never attempted, 'FAILED' one whose send failed. Anything else — PENDING, ACCEPTED,
    # SENT, DELIVERED, READ — means a message is already in flight or landed, and a
    # second one must not go out.
    #
    # DO NOT edit this WHERE clause without re-running the concurrency test. A unique
    # index enforces itself; a WHERE clause only works while it is correct.
    #
    # Every %(stage)s is cast to ::text deliberately. psycopg folds the repeated named
    # placeholder into ONE parameter, so Postgres unifies its type across all uses and the
    # `::smallint` below can drag the whole thing to smallint — which turns ARRAY[...] into
    # smallint[] (no jsonb_set overload; APPEND_EW_FOLLOW_UP failed exactly this way on
    # 2026-09-11) and turns `stages -> %(stage)s` into ARRAY indexing, which returns NULL
    # against an object. That second one is the dangerous half here: a NULL lookup makes
    # COALESCE(...) = 'NONE', the guard passes unconditionally, and exactly-once is gone
    # silently. The casts make the resolution explicit instead of order-dependent.
    CLAIM_EW_REMINDER_STAGE = """
        UPDATE ew_customer
        SET stages = jsonb_set(
                COALESCE(stages, '{}'::jsonb),
                ARRAY[%(stage)s::text],
                jsonb_build_object(
                    'delivery_status', 'PENDING',
                    'stage_status',    'MESSAGE_SENT',
                    'wamid',           NULL,
                    'sent_at',         %(sent_at)s::text,
                    'sent_by',         %(sent_by)s::bigint,
                    'settled_at',      NULL,
                    'error',           NULL
                ),
                true
            ),
            last_stage_sent = %(stage)s::smallint,
            last_sent_at    = %(sent_at)s::timestamptz,
            updated_at      = now()
        WHERE id = %(ew_customer_id)s
          AND is_active
          AND NOT is_opted_out
          AND COALESCE(stages -> %(stage)s::text ->> 'delivery_status', 'NONE') IN ('NONE', 'FAILED')
        RETURNING id
    """

    # Settles the claim immediately after the Meta call returns — ACCEPTED + wamid, or
    # FAILED + error. Merged with `||` so the stage's other keys (and any `interest`
    # sub-object on a re-send) survive untouched. Guarded only on the stage still being
    # PENDING: if a webhook somehow already advanced it, that later state wins.
    SET_EW_REMINDER_SENT = """
        UPDATE ew_customer
        SET stages = jsonb_set(
                stages,
                ARRAY[%(stage)s],
                (CASE WHEN jsonb_typeof(stages -> %(stage)s) = 'object'
                      THEN stages -> %(stage)s
                      ELSE '{}'::jsonb END)
                || jsonb_build_object(
                    'delivery_status', %(status)s::text,
                    'wamid',           %(wamid)s::text,
                    'settled_at',      %(settled_at)s::text,
                    'error',           %(error)s::text
                ),
                true
            ),
            updated_at = now()
        WHERE id = %(ew_customer_id)s
          AND jsonb_typeof(stages -> %(stage)s) = 'object'
          AND (stages -> %(stage)s ->> 'delivery_status') = 'PENDING'
        RETURNING id
    """

    # Webhook path. Same two guards SET_JOB_WHATSAPP_OUTCOME uses and for the same
    # reasons: the ladder must never move backwards, and the callback's wamid must match
    # the one currently stored, so a late/duplicate callback for a PRIOR wamid (e.g. its
    # own terminal FAILED) cannot clobber a re-send's success — FAILED outranks
    # everything on the ladder alone.
    SET_EW_REMINDER_OUTCOME = """
        UPDATE ew_customer
        SET stages = jsonb_set(
                stages,
                ARRAY[%(stage)s],
                (CASE WHEN jsonb_typeof(stages -> %(stage)s) = 'object'
                      THEN stages -> %(stage)s
                      ELSE '{}'::jsonb END)
                || jsonb_build_object(
                    'delivery_status', %(status)s::text,
                    'settled_at',      %(settled_at)s::text,
                    'error',           %(error)s::text
                ),
                true
            ),
            updated_at = now()
        WHERE id = %(ew_customer_id)s
          AND (stages -> %(stage)s ->> 'wamid') = %(wamid)s
          AND %(new_rank)s > COALESCE(
                CASE (stages -> %(stage)s ->> 'delivery_status')
                    WHEN 'PENDING'   THEN 0
                    WHEN 'ACCEPTED'  THEN 1
                    WHEN 'SENT'      THEN 2
                    WHEN 'DELIVERED' THEN 3
                    WHEN 'READ'      THEN 4
                    WHEN 'FAILED'    THEN 9
                END,
                -1
          )
        RETURNING id
    """

    # The customer tapped "I am interested". Idempotent on (customer, stage): the
    # `interest IS NULL` guard means a double-click, a retried form post, or the customer
    # re-opening the link days later all no-op. `RETURNING id` is therefore the signal
    # the public route keys its whole notification fan-out off — no row back means no
    # second lead, no second staff alert, no second email.
    SET_EW_INTEREST = """
        UPDATE ew_customer
        SET stages = jsonb_set(
                stages,
                ARRAY[%(stage)s],
                (stages -> %(stage)s)
                || jsonb_build_object(
                    'stage_status', 'INTERESTED',
                    'interest', jsonb_build_object(
                        'expressed_at',      %(expressed_at)s::text,
                        'preferred_contact', %(preferred_contact)s::text,
                        'customer_remarks',  %(customer_remarks)s::text,
                        'alert',             NULL
                    )
                ),
                true
            ),
            interest_count = interest_count + 1,
            updated_at     = now()
        WHERE id = %(ew_customer_id)s
          AND jsonb_typeof(stages -> %(stage)s) = 'object'
          AND stages -> %(stage)s -> 'interest' IS NULL
        RETURNING id
    """

    # The staff WhatsApp alert's own delivery state, at stages[n].interest.alert. A
    # failed alert must be visible and re-sendable, never swallowed — silent failure here
    # means staff never learn a customer raised a hand. Two `||` merges rather than a
    # two-level jsonb_set path, per rule 1.
    SET_EW_ALERT_OUTCOME = """
        UPDATE ew_customer
        SET stages = jsonb_set(
                stages,
                ARRAY[%(stage)s],
                (stages -> %(stage)s)
                || jsonb_build_object(
                    'alert_placeholder', NULL,
                    'interest',
                        (CASE WHEN jsonb_typeof(stages -> %(stage)s -> 'interest') = 'object'
                              THEN stages -> %(stage)s -> 'interest'
                              ELSE '{}'::jsonb END)
                        || jsonb_build_object(
                            'alert', jsonb_build_object(
                                'delivery_status', %(status)s::text,
                                'wamid',           %(wamid)s::text,
                                'sent_at',         %(sent_at)s::text,
                                'error',           %(error)s::text
                            )
                        )
                ) - 'alert_placeholder',
                true
            ),
            updated_at = now()
        WHERE id = %(ew_customer_id)s
          AND jsonb_typeof(stages -> %(stage)s) = 'object'
        RETURNING id
    """

    # Append-only staff activity log, capped at 50 (keep 49 + the new one) with the same
    # ORDER BY ord DESC / LIMIT / re-aggregate idiom SET_JOB_WHATSAPP_ATTEMPT uses for
    # `attempts`. The oldest entries are the ones dropped.
    #
    # This is the single close point for BOTH follow-up channels — the in-app Interest
    # grid and the deep link from the staff WhatsApp alert both land here, so there is
    # one lead and one history, never two records to reconcile.
    APPEND_EW_FOLLOW_UP = """
        UPDATE ew_customer
        SET follow_ups = (
                SELECT COALESCE(jsonb_agg(kept.elem ORDER BY kept.ord), '[]'::jsonb)
                FROM (
                    SELECT elem, ord
                    FROM jsonb_array_elements(
                        CASE WHEN jsonb_typeof(follow_ups) = 'array' THEN follow_ups ELSE '[]'::jsonb END
                    ) WITH ORDINALITY AS t(elem, ord)
                    ORDER BY ord DESC
                    LIMIT 49
                ) kept
            ) || jsonb_build_array(jsonb_build_object(
                'at',      %(at)s::text,
                'by',      %(by)s::bigint,
                'by_name', %(by_name)s::text,
                'stage',   %(stage)s::smallint,
                'action',  %(action)s::text,
                'outcome', %(outcome)s::text,
                'remarks', %(remarks)s::text
            )),
            -- Every %(stage)s here is cast explicitly. psycopg folds the repeated named
            -- placeholder into ONE parameter, so Postgres unifies its type across all
            -- uses: the `::smallint` above resolved the whole thing to smallint, and the
            -- uncast ARRAY[...] became smallint[] — jsonb_set has no such overload, which
            -- failed the mutation outright (2026-09-11). The `-> ` lookups need the cast
            -- for a second reason: `jsonb -> integer` is ARRAY indexing, so an uncast
            -- smallint would silently return NULL against an object and skip the update.
            stages = CASE
                WHEN %(stage)s IS NULL OR jsonb_typeof(stages -> %(stage)s::text) <> 'object' THEN stages
                ELSE jsonb_set(
                    stages,
                    ARRAY[%(stage)s::text],
                    (stages -> %(stage)s::text)
                    || jsonb_build_object('stage_status', %(stage_status)s::text),
                    true
                )
            END,
            outcome         = %(outcome)s::text,
            outcome_at      = CASE WHEN %(outcome)s::text <> 'OPEN' THEN now() ELSE outcome_at END,
            follow_up_count = follow_up_count + 1,
            updated_at      = now()
        WHERE id = %(ew_customer_id)s
        RETURNING id
    """

    SET_EW_OPT_OUT = """
        UPDATE ew_customer
        SET is_opted_out = true,
            opted_out_at = now(),
            updated_at   = now()
        WHERE id = %(ew_customer_id)s
          AND NOT is_opted_out
        RETURNING id
    """

    # ── Reads — plain SQL over ew_stage_v or the flat columns ─────────────────


    # Server-side re-filter for the send: never trusts the client's selection, exactly
    # like GET_JOBS_FOR_WHATSAPP_COMPLETION. branch_id is cross-checked here, so a list
    # of ids alone is never proof the caller is authorised for those customers' branch.
    GET_EW_CUSTOMERS_FOR_SEND = """
        SELECT c.id                                 AS ew_customer_id,
               c.full_name,
               c.mobile,
               b.name                               AS brand_name,
               COALESCE(NULLIF(c.model_name, ''), p.name, '') AS product_label,
               c.warranty_end_date
        FROM ew_customer c
        LEFT JOIN brand   b ON b.id = c.brand_id
        LEFT JOIN product p ON p.id = c.product_id
        WHERE c.id = ANY(%(ew_customer_ids)s::bigint[])
          AND c.branch_id = %(branch_id)s
          AND c.is_active
          AND NOT c.is_opted_out
        ORDER BY c.full_name
    """

    # Everything the five composed lines of the staff alert need, in one read.
    GET_EW_LEAD_DETAIL = """
        SELECT c.id                                 AS ew_customer_id,
               c.full_name,
               c.mobile,
               c.address,
               c.city,
               b.name                               AS brand_name,
               COALESCE(NULLIF(c.model_name, ''), p.name, '') AS product_label,
               c.serial_no,
               c.purchase_date,
               c.warranty_end_date,
               c.stages -> %(stage)s -> 'interest' ->> 'preferred_contact' AS preferred_contact,
               c.stages -> %(stage)s -> 'interest' ->> 'customer_remarks'  AS customer_remarks
        FROM ew_customer c
        LEFT JOIN brand   b ON b.id = c.brand_id
        LEFT JOIN product p ON p.id = c.product_id
        WHERE c.id = %(ew_customer_id)s
    """

    # Public landing page — no branch filter, the signed token is the credential.
    GET_EW_CUSTOMER_FOR_PUBLIC = """
        SELECT c.id                                 AS ew_customer_id,
               c.full_name,
               b.name                               AS brand_name,
               COALESCE(NULLIF(c.model_name, ''), p.name, '') AS product_label,
               c.warranty_end_date,
               c.is_opted_out,
               c.is_active,
               c.stages -> %(stage)s -> 'interest' IS NOT NULL AS has_interest
        FROM ew_customer c
        LEFT JOIN brand   b ON b.id = c.brand_id
        LEFT JOIN product p ON p.id = c.product_id
        WHERE c.id = %(ew_customer_id)s
    """


    # The prompt's cross-lookup: one mobile, searched in the customer master AND the
    # extended-warranty table, so staff entering a repeat customer don't retype anything.
    # UNION ALL with a `source` discriminator rather than two round trips.
    GET_EW_CUSTOMER_BY_MOBILE = """
        SELECT 'EW'::text     AS source,
               c.id           AS ew_customer_id,
               c.full_name,
               c.mobile,
               c.email,
               c.address,
               c.city,
               c.brand_id,
               c.product_id,
               c.model_name,
               c.serial_no,
               c.purchase_date,
               c.warranty_end_date
        FROM ew_customer c
        WHERE c.mobile = %(mobile)s
          AND c.is_active
        UNION ALL
        SELECT 'CUSTOMER'::text AS source,
               NULL::bigint     AS ew_customer_id,
               cc.full_name,
               cc.mobile,
               cc.email,
               TRIM(BOTH ', ' FROM CONCAT_WS(', ', cc.address_line1, cc.address_line2)) AS address,
               cc.city,
               NULL::bigint     AS brand_id,
               NULL::bigint     AS product_id,
               NULL::text       AS model_name,
               NULL::text       AS serial_no,
               NULL::date       AS purchase_date,
               NULL::date       AS warranty_end_date
        FROM customer_contact cc
        WHERE cc.mobile = %(mobile)s
          AND cc.is_active
        LIMIT 5
    """


    # The Leads screen's one read — replaces the three grids (Due / Interested /
    # Customers) with a single CUSTOMER-level row. ew_stage_v is per customer x stage, so
    # a customer with three stages would appear three times; the lateral below collapses
    # that to one "current" stage:
    #   1. the stage that carries interest (that is the one staff must act on), else
    #   2. the most recent stage actually sent, else
    #   3. nothing at all — a never-messaged lead, which has NO ew_stage_v row and would
    #      be invisible to any query built on the view. That is why this reads FROM
    #      ew_customer and joins the view sideways, not the other way round.
    #
    # `due_stage` answers "is a reminder owed right now" on the same row, so the Leads
    # screen needs no second query. This is now the ONLY place that rule is expressed for
    # reading — GET_EW_DUE_CUSTOMERS was deleted once the Leads screen replaced the Due
    # grid. The authority for *sending* remains CLAIM_EW_REMINDER_STAGE's WHERE clause;
    # this predicate only decides what the UI offers, and the claim still refuses anything
    # already sent.
    GET_EW_LEADS_PAGED = """
        SELECT c.id                                        AS ew_customer_id,
               c.full_name,
               c.mobile,
               c.email,
               c.address,
               c.city,
               c.brand_id,
               b.name                                      AS brand_name,
               c.product_id,
               COALESCE(NULLIF(c.model_name, ''), p.name, '') AS product_label,
               c.serial_no,
               c.purchase_date,
               c.warranty_end_date,
               (c.warranty_end_date - CURRENT_DATE)        AS days_left,
               c.remarks,
               c.outcome,
               c.outcome_at,
               c.interest_count,
               c.follow_up_count,
               c.is_opted_out,
               cur.stage,
               cur.stage_status,
               cur.delivery_status,
               cur.sent_at,
               cur.error                                   AS delivery_error,
               cur.interest_at,
               cur.preferred_contact,
               cur.customer_remarks,
               cur.alert_status,
               cur.alert_error,
               due.stage                                   AS due_stage,
               -- EVERY send for this customer, not just the current stage's. One stage is
               -- one send (there is no attempts array here), so a customer messaged at 30
               -- and again at 7 has two entries. Grids showed only the current stage
               -- before, which made an earlier reminder look as though it never went out.
               COALESCE(snd.sends, '[]'::jsonb)            AS sends,
               COUNT(*) OVER ()                            AS total_count
        FROM ew_customer c
        LEFT JOIN brand   b ON b.id = c.brand_id
        LEFT JOIN product p ON p.id = c.product_id
        LEFT JOIN LATERAL (
            SELECT v.stage, v.stage_status, v.delivery_status, v.sent_at, v.error,
                   v.interest_at, v.preferred_contact, v.customer_remarks,
                   v.alert_status, v.alert_error
            FROM ew_stage_v v
            WHERE v.ew_customer_id = c.id
            ORDER BY (v.interest_at IS NOT NULL) DESC, v.sent_at DESC NULLS LAST, v.stage
            LIMIT 1
        ) cur ON true
        LEFT JOIN LATERAL (
            SELECT jsonb_agg(
                       jsonb_build_object(
                           'stage',           sv.stage,
                           'delivery_status', sv.delivery_status,
                           'stage_status',    sv.stage_status,
                           'sent_at',         sv.sent_at,
                           'error',           sv.error
                       ) ORDER BY sv.stage DESC
                   ) AS sends
            FROM ew_stage_v sv
            WHERE sv.ew_customer_id = c.id
              AND sv.sent_at IS NOT NULL
        ) snd ON true
        LEFT JOIN LATERAL (
            SELECT MIN(s.stage) AS stage
            FROM unnest(%(stages)s::int[]) AS s(stage)
            WHERE (c.warranty_end_date - CURRENT_DATE) <= s.stage
              AND (c.warranty_end_date - CURRENT_DATE) >= %(grace_days)s
              AND c.is_active AND NOT c.is_opted_out
              AND COALESCE(c.stages -> s.stage::text ->> 'delivery_status', 'NONE') IN ('NONE', 'FAILED')
        ) due ON true
        WHERE c.is_active
          AND (%(branch_id)s::bigint IS NULL OR c.branch_id = %(branch_id)s)
          -- Search spans who they are AND what they own: staff look a lead up by whatever
          -- the customer says on the phone, which is as often "the Sony 55-inch" or a
          -- serial off the back of the set as it is a name.
          AND (%(search)s::text IS NULL OR %(search)s = ''
               OR c.full_name  ILIKE '%%' || %(search)s || '%%'
               OR c.mobile     ILIKE '%%' || %(search)s || '%%'
               OR c.serial_no  ILIKE '%%' || %(search)s || '%%'
               OR c.model_name ILIKE '%%' || %(search)s || '%%'
               OR b.name       ILIKE '%%' || %(search)s || '%%'
               OR p.name       ILIKE '%%' || %(search)s || '%%')
          AND (%(outcome)s::text IS NULL OR c.outcome = %(outcome)s)
          -- Bucket bounds come from the client as days-left range; both optional.
          AND (%(days_left_min)s::int IS NULL OR (c.warranty_end_date - CURRENT_DATE) >= %(days_left_min)s)
          AND (%(days_left_max)s::int IS NULL OR (c.warranty_end_date - CURRENT_DATE) <= %(days_left_max)s)
          -- One status filter, mapped here rather than in the client so the pill labels
          -- stay presentation and the predicate stays a contract.
          AND (%(status)s::text IS NULL
               OR (%(status)s = 'DUE'        AND due.stage IS NOT NULL)
               OR (%(status)s = 'MESSAGED'   AND cur.sent_at IS NOT NULL AND cur.interest_at IS NULL)
               OR (%(status)s = 'INTERESTED' AND cur.interest_at IS NOT NULL AND c.outcome = 'OPEN')
               OR (%(status)s = 'FOLLOWED_UP' AND c.follow_up_count > 0 AND c.outcome = 'OPEN')
               OR (%(status)s = 'WON'        AND c.outcome = 'CONVERTED')
               OR (%(status)s = 'LOST'       AND c.outcome IN ('NOT_INTERESTED', 'UNREACHABLE')))
        ORDER BY c.warranty_end_date, c.full_name
        LIMIT %(limit)s OFFSET %(offset)s
    """

    GET_EW_REMINDER_LOG_PAGED = """
        SELECT v.ew_customer_id,
               v.full_name,
               v.mobile,
               v.stage,
               v.delivery_status,
               v.wamid,
               v.sent_at,
               v.sent_by,
               u.full_name      AS sent_by_name,
               v.error,
               v.stage_status,
               COUNT(*) OVER () AS total_count
        FROM ew_stage_v v
        LEFT JOIN security."user" u ON u.id = v.sent_by
        WHERE v.sent_at IS NOT NULL
          AND (%(branch_id)s::bigint IS NULL OR v.branch_id = %(branch_id)s)
          AND (%(stage)s::int IS NULL OR v.stage = %(stage)s)
          AND (%(delivery_status)s::text IS NULL OR v.delivery_status = %(delivery_status)s)
        ORDER BY v.sent_at DESC
        LIMIT %(limit)s OFFSET %(offset)s
    """

    GET_EW_FOLLOW_UPS = """
        SELECT c.id AS ew_customer_id,
               c.full_name,
               c.mobile,
               c.outcome,
               c.outcome_at,
               COALESCE(c.follow_ups, '[]'::jsonb) AS follow_ups
        FROM ew_customer c
        WHERE c.id = %(ew_customer_id)s
    """

    # The display name stamped onto a follow-up entry. Looked up server-side from the
    # authenticated user_id — never taken from the client, same discipline as
    # verifyJobDeliveryOtp's staff_id.
    GET_EW_STAFF_NAME = """
        SELECT full_name
        FROM security."user"
        WHERE id = %(user_id)s
    """

    GET_EW_SENT_TODAY_COUNT = """
        SELECT COUNT(*) AS sent_today
        FROM ew_stage_v v
        WHERE v.sent_at >= date_trunc('day', now())
          AND v.delivery_status <> 'FAILED'
    """

    COUNT_EW_NEW_INTEREST = """
        SELECT COUNT(*) AS new_interest
        FROM ew_stage_v v
        WHERE v.interest_at IS NOT NULL
          AND v.outcome = 'OPEN'
          AND (%(branch_id)s::bigint IS NULL OR v.branch_id = %(branch_id)s)
    """

    # ── Dashboard ─────────────────────────────────────────────────────────────

    # `due_in_window` and `not_contacted` come from ew_customer directly, NOT from
    # ew_stage_v: the view unnests `stages`, so a customer who has never been sent
    # anything has no rows in it at all.
    # The rebuilt dashboard's single read. One row, so the whole screen costs one query.
    #
    # Two populations, deliberately counted from different places:
    #  * LEAD buckets come from ew_customer, so a customer who has never been messaged is
    #    counted. Anything built on ew_stage_v would miss exactly the leads most worth
    #    chasing, because a never-messaged customer has no row there.
    #  * Funnel counts (interested/won/lost/failed) come from ew_stage_v and are therefore
    #    customer x STAGE, matching the existing funnel ladder. `followed_up` is the
    #    exception: follow-ups are recorded at customer level, so it counts DISTINCT
    #    customers. The two semantics are not interchangeable and the help says so.
    #
    # `lead_buckets` is a jsonb object keyed by stage rather than fixed columns, because
    # the stage set is data (`reminder_days_before`) — fixed columns would hard-code it.
    # A lead lands in the TIGHTEST bucket it has reached: MIN(stage) over the stages whose
    # threshold its days-left has crossed. Leads further out than the widest stage are in
    # no bucket at all, which is correct — nothing is owed to them yet.
    #
    # Message-sent counts are CUMULATIVE, not exclusive: "this week" includes today and
    # "this month" includes this week, which is how the labels read. They do not sum.
    GET_EW_DASHBOARD_OVERVIEW = """
        WITH leads AS (
            SELECT c.id,
                   (c.warranty_end_date - CURRENT_DATE) AS days_left
            FROM ew_customer c
            WHERE c.is_active
              AND NOT c.is_opted_out
              AND (%(branch_id)s::bigint IS NULL OR c.branch_id = %(branch_id)s)
        ),
        bucketed AS (
            SELECT (
                SELECT MIN(s.stage)
                FROM unnest(%(stages)s::int[]) AS s(stage)
                WHERE l.days_left <= s.stage
            ) AS bucket
            FROM leads l
            WHERE l.days_left >= 0
        ),
        stage_rows AS (
            SELECT v.*
            FROM ew_stage_v v
            WHERE (%(branch_id)s::bigint IS NULL OR v.branch_id = %(branch_id)s)
        )
        SELECT
            COALESCE(
                (SELECT jsonb_object_agg(bucket::text, cnt)
                 FROM (SELECT bucket, COUNT(*) AS cnt FROM bucketed WHERE bucket IS NOT NULL GROUP BY bucket) q),
                '{}'::jsonb
            )                                                                    AS lead_buckets,
            (SELECT COUNT(*) FROM leads WHERE days_left < 0 AND days_left >= %(grace_days)s) AS leads_overdue,
            (SELECT COUNT(*) FROM leads)                                         AS leads_total,
            (SELECT COUNT(*) FROM stage_rows WHERE sent_at >= date_trunc('day', now()))   AS sent_today,
            (SELECT COUNT(*) FROM stage_rows WHERE sent_at >= date_trunc('week', now()))  AS sent_week,
            (SELECT COUNT(*) FROM stage_rows WHERE sent_at >= date_trunc('month', now())) AS sent_month,
            (SELECT COUNT(*) FROM stage_rows WHERE sent_at <  date_trunc('month', now())) AS sent_older,
            (SELECT COUNT(*) FROM stage_rows WHERE sent_at IS NOT NULL)          AS sent_total,
            (SELECT COUNT(*) FROM stage_rows WHERE delivery_status = 'FAILED')   AS failed,
            (SELECT COUNT(*) FROM stage_rows WHERE interest_at IS NOT NULL)      AS interested,
            (SELECT COUNT(*) FROM ew_customer c
              WHERE c.follow_up_count > 0
                AND (%(branch_id)s::bigint IS NULL OR c.branch_id = %(branch_id)s)
            )                                                                    AS followed_up,
            (SELECT COUNT(*) FROM stage_rows WHERE stage_status = 'CONVERTED')   AS won,
            (SELECT COUNT(*) FROM stage_rows
              WHERE stage_status IN ('NOT_INTERESTED', 'UNREACHABLE'))           AS lost
    """





    # One parameterised read behind every KPI card and every chart segment, so the whole
    # dashboard drills through a single dialog and a single sql id. Every filter is
    # optional; the caller supplies only the ones its card represents.
    GET_EW_DRILLDOWN = """
        SELECT v.ew_customer_id,
               v.full_name,
               v.mobile,
               v.stage,
               v.delivery_status,
               v.stage_status,
               v.sent_at,
               v.interest_at,
               v.preferred_contact,
               v.warranty_end_date,
               v.outcome,
               COALESCE(b.name, '')                                     AS brand_name,
               -- Same column names GET_EW_LEADS_PAGED returns, so the one drill-down
               -- dialog can render either source without branching on shape. serial_no
               -- is not on ew_stage_v, hence the join back to the customer row.
               COALESCE(NULLIF(v.model_name, ''), p.name, '')            AS product_label,
               c.serial_no
        FROM ew_stage_v v
        LEFT JOIN brand      b ON b.id = v.brand_id
        LEFT JOIN product    p ON p.id = v.product_id
        LEFT JOIN ew_customer c ON c.id = v.ew_customer_id
        WHERE (%(branch_id)s::bigint       IS NULL OR v.branch_id = %(branch_id)s)
          AND (%(date_from)s::date         IS NULL OR v.sent_at::date >= %(date_from)s)
          AND (%(date_to)s::date           IS NULL OR v.sent_at::date <= %(date_to)s)
          AND (%(stage)s::int              IS NULL OR v.stage = %(stage)s)
          AND (%(stage_status)s::text      IS NULL OR v.stage_status = %(stage_status)s)
          AND (%(delivery_status)s::text   IS NULL OR v.delivery_status = %(delivery_status)s)
          AND (%(brand_id)s::bigint        IS NULL OR v.brand_id = %(brand_id)s)
          AND (%(only_interested)s::boolean IS NOT TRUE OR v.interest_at IS NOT NULL)
          -- `lost` groups the two terminal negatives, which the UI shows as one tile.
          AND (%(lost)s::boolean IS NOT TRUE
               OR v.stage_status IN ('NOT_INTERESTED', 'UNREACHABLE'))
          -- follow-ups live on the customer, not the stage, hence the EXISTS rather than
          -- a column on the view.
          AND (%(has_follow_up)s::boolean IS NOT TRUE
               OR EXISTS (SELECT 1 FROM ew_customer fc
                           WHERE fc.id = v.ew_customer_id AND fc.follow_up_count > 0))
        ORDER BY v.sent_at DESC NULLS LAST, v.full_name
        LIMIT %(limit)s
    """
