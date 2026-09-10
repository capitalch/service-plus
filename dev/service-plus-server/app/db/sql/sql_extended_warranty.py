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
    CLAIM_EW_REMINDER_STAGE = """
        UPDATE ew_customer
        SET stages = jsonb_set(
                COALESCE(stages, '{}'::jsonb),
                ARRAY[%(stage)s],
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
          AND COALESCE(stages -> %(stage)s ->> 'delivery_status', 'NONE') IN ('NONE', 'FAILED')
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
            stages = CASE
                WHEN %(stage)s IS NULL OR jsonb_typeof(stages -> %(stage)s) <> 'object' THEN stages
                ELSE jsonb_set(
                    stages,
                    ARRAY[%(stage)s],
                    (stages -> %(stage)s)
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

    # `stages` here is the configured reminder_days_before list, passed as int[]; the
    # lateral picks the SMALLEST configured bucket the customer has fallen into and not
    # yet been sent, so someone 5 days from expiry gets the 7-day message rather than the
    # 30-day one. `grace_days` (negative) bounds how far past expiry a record stays due,
    # so a long-dormant list doesn't suddenly fire at everyone on stage 0.
    GET_EW_DUE_CUSTOMERS = """
        SELECT c.id                                        AS ew_customer_id,
               c.full_name,
               c.mobile,
               c.address,
               c.city,
               c.brand_id,
               b.name                                      AS brand_name,
               c.product_id,
               p.name                                      AS product_name,
               c.model_name,
               c.serial_no,
               c.purchase_date,
               c.warranty_end_date,
               (c.warranty_end_date - CURRENT_DATE)        AS days_left,
               due.stage,
               COALESCE(c.stages -> due.stage::text ->> 'delivery_status', 'NONE') AS delivery_status
        FROM ew_customer c
        LEFT JOIN brand   b ON b.id = c.brand_id
        LEFT JOIN product p ON p.id = c.product_id
        CROSS JOIN LATERAL (
            SELECT MIN(s.stage) AS stage
            FROM unnest(%(stages)s::int[]) AS s(stage)
            WHERE (c.warranty_end_date - CURRENT_DATE) <= s.stage
              AND COALESCE(c.stages -> s.stage::text ->> 'delivery_status', 'NONE') IN ('NONE', 'FAILED')
        ) due
        WHERE c.is_active
          AND NOT c.is_opted_out
          AND due.stage IS NOT NULL
          AND (c.warranty_end_date - CURRENT_DATE) >= %(grace_days)s
          AND (%(branch_id)s::bigint IS NULL OR c.branch_id = %(branch_id)s)
        ORDER BY c.warranty_end_date, c.full_name
    """

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

    GET_EW_CUSTOMERS_PAGED = """
        SELECT c.id,
               c.full_name,
               c.mobile,
               c.email,
               c.address,
               c.city,
               c.brand_id,
               b.name                               AS brand_name,
               c.product_id,
               p.name                               AS product_name,
               c.model_name,
               c.serial_no,
               c.purchase_date,
               c.warranty_end_date,
               (c.warranty_end_date - CURRENT_DATE) AS days_left,
               c.remarks,
               c.outcome,
               c.outcome_at,
               c.last_stage_sent,
               c.last_sent_at,
               c.interest_count,
               c.follow_up_count,
               c.is_opted_out,
               c.is_active,
               COUNT(*) OVER ()                     AS total_count
        FROM ew_customer c
        LEFT JOIN brand   b ON b.id = c.brand_id
        LEFT JOIN product p ON p.id = c.product_id
        WHERE (%(branch_id)s::bigint IS NULL OR c.branch_id = %(branch_id)s)
          AND (%(search)s::text IS NULL OR %(search)s = ''
               OR c.full_name ILIKE '%%' || %(search)s || '%%'
               OR c.mobile    ILIKE '%%' || %(search)s || '%%'
               OR c.serial_no ILIKE '%%' || %(search)s || '%%')
          AND (%(outcome)s::text IS NULL OR c.outcome = %(outcome)s)
          AND (%(show_inactive)s::boolean OR c.is_active)
        ORDER BY c.warranty_end_date, c.full_name
        LIMIT %(limit)s OFFSET %(offset)s
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

    GET_EW_INTEREST_PAGED = """
        SELECT v.ew_customer_id,
               v.full_name,
               v.mobile,
               v.stage,
               v.interest_at,
               v.preferred_contact,
               v.customer_remarks,
               v.stage_status,
               v.alert_status,
               v.alert_error,
               v.warranty_end_date,
               v.outcome,
               c.follow_up_count,
               COUNT(*) OVER () AS total_count
        FROM ew_stage_v v
        JOIN ew_customer c ON c.id = v.ew_customer_id
        WHERE v.interest_at IS NOT NULL
          AND (%(branch_id)s::bigint IS NULL OR v.branch_id = %(branch_id)s)
          AND (%(outcome)s::text IS NULL OR v.outcome = %(outcome)s)
        ORDER BY v.interest_at DESC
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
    GET_EW_DASHBOARD_KPIS = """
        WITH sent AS (
            SELECT v.*
            FROM ew_stage_v v
            WHERE (%(branch_id)s::bigint IS NULL OR v.branch_id = %(branch_id)s)
              AND (%(date_from)s::date IS NULL OR v.sent_at::date >= %(date_from)s)
              AND (%(date_to)s::date   IS NULL OR v.sent_at::date <= %(date_to)s)
        )
        SELECT
            (SELECT COUNT(*) FROM ew_customer c
              WHERE c.is_active AND NOT c.is_opted_out
                AND (%(branch_id)s::bigint IS NULL OR c.branch_id = %(branch_id)s)
                AND (c.warranty_end_date - CURRENT_DATE) BETWEEN %(grace_days)s AND %(window_days)s
            )                                                                    AS due_in_window,
            (SELECT COUNT(*) FROM ew_customer c
              WHERE c.is_active AND NOT c.is_opted_out AND c.stages = '{}'::jsonb
                AND (%(branch_id)s::bigint IS NULL OR c.branch_id = %(branch_id)s)
            )                                                                    AS not_contacted,
            COUNT(*) FILTER (WHERE sent_at IS NOT NULL)                          AS messages_sent,
            COUNT(*) FILTER (WHERE delivery_status IN ('DELIVERED', 'READ'))     AS delivered,
            COUNT(*) FILTER (WHERE delivery_status = 'FAILED')                   AS failed,
            COUNT(*) FILTER (WHERE interest_at IS NOT NULL)                      AS interested,
            COUNT(*) FILTER (WHERE stage_status = 'FOLLOWED_UP')                 AS followed_up,
            COUNT(*) FILTER (WHERE stage_status = 'CONVERTED')                   AS converted,
            COUNT(*) FILTER (WHERE stage_status = 'NOT_INTERESTED')              AS not_interested,
            COUNT(*) FILTER (WHERE stage_status = 'UNREACHABLE')                 AS unreachable,
            (SELECT COUNT(*) FROM ew_customer c
              WHERE c.is_opted_out
                AND (%(branch_id)s::bigint IS NULL OR c.branch_id = %(branch_id)s)
            )                                                                    AS opted_out
        FROM sent
    """

    GET_EW_FUNNEL_BY_STAGE = """
        SELECT v.stage,
               v.stage_status,
               COUNT(*) AS cnt
        FROM ew_stage_v v
        WHERE (%(branch_id)s::bigint IS NULL OR v.branch_id = %(branch_id)s)
          AND (%(date_from)s::date IS NULL OR v.sent_at::date >= %(date_from)s)
          AND (%(date_to)s::date   IS NULL OR v.sent_at::date <= %(date_to)s)
        GROUP BY v.stage, v.stage_status
        ORDER BY v.stage DESC, v.stage_status
    """

    GET_EW_BY_BRAND = """
        SELECT COALESCE(b.name, 'Unknown')                              AS brand_name,
               COUNT(*)                                                 AS sent,
               COUNT(*) FILTER (WHERE v.interest_at IS NOT NULL)        AS interested,
               COUNT(*) FILTER (WHERE v.stage_status = 'CONVERTED')     AS converted
        FROM ew_stage_v v
        LEFT JOIN brand b ON b.id = v.brand_id
        WHERE (%(branch_id)s::bigint IS NULL OR v.branch_id = %(branch_id)s)
          AND (%(date_from)s::date IS NULL OR v.sent_at::date >= %(date_from)s)
          AND (%(date_to)s::date   IS NULL OR v.sent_at::date <= %(date_to)s)
        GROUP BY 1
        ORDER BY sent DESC, brand_name
    """

    GET_EW_MONTHLY_TREND = """
        SELECT to_char(date_trunc('month', v.sent_at), 'YYYY-MM')       AS month,
               COUNT(*)                                                 AS sent,
               COUNT(*) FILTER (WHERE v.interest_at IS NOT NULL)        AS interested,
               COUNT(*) FILTER (WHERE v.stage_status = 'CONVERTED')     AS converted
        FROM ew_stage_v v
        WHERE v.sent_at IS NOT NULL
          AND (%(branch_id)s::bigint IS NULL OR v.branch_id = %(branch_id)s)
          AND v.sent_at >= date_trunc('month', now()) - make_interval(months => %(months)s)
        GROUP BY 1
        ORDER BY 1
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
               COALESCE(b.name, '')                                     AS brand_name
        FROM ew_stage_v v
        LEFT JOIN brand b ON b.id = v.brand_id
        WHERE (%(branch_id)s::bigint       IS NULL OR v.branch_id = %(branch_id)s)
          AND (%(date_from)s::date         IS NULL OR v.sent_at::date >= %(date_from)s)
          AND (%(date_to)s::date           IS NULL OR v.sent_at::date <= %(date_to)s)
          AND (%(stage)s::int              IS NULL OR v.stage = %(stage)s)
          AND (%(stage_status)s::text      IS NULL OR v.stage_status = %(stage_status)s)
          AND (%(delivery_status)s::text   IS NULL OR v.delivery_status = %(delivery_status)s)
          AND (%(brand_id)s::bigint        IS NULL OR v.brand_id = %(brand_id)s)
          AND (%(only_interested)s::boolean IS NOT TRUE OR v.interest_at IS NOT NULL)
        ORDER BY v.sent_at DESC NULLS LAST, v.full_name
        LIMIT %(limit)s
    """
