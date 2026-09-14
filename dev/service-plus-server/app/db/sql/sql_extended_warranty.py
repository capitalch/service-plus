"""Extended Warranty — SQL for the lead state machine (plans/plan-ew-final.md §C4).

Three tables and one view (scripts/ew_schema.sql): `ew_lead` (one row per lead; `state`
is the state machine, `is_closed` is GENERATED from it), `ew_message` (one row per
WhatsApp send), `ew_lead_event` (history). The expiry-band rule, the 7-day grace window
and `can_send` live ONLY in `ew_lead_view` — every query below reads them from there.

Two classes, split on purpose:

- `ExtendedWarrantySql` — the reads the browser calls through genericQuery. Composed into
  SqlStore (sql_base.py); the client's sql-map.ts mirrors exactly these names.
- `ExtendedWarrantyServerSql` — every write, plus the reads only server code needs.
  Deliberately NOT in SqlStore: genericQuery runs any SqlStore constant by sqlId on an
  autocommit connection, so a write placed there could be called straight from the
  browser — TRANSITION_EW_LEAD with a hand-made allowed_from would bypass both the
  transition table and the CUSTOM_EXTENDED_WARRANTY access check. Same reasoning as
  PublicSql (sql_public.py).

Rules for every statement in this module:

1. A placeholder used more than once is bound ONCE in a `"p_<name>"` CTE and read back
   with `(table "p_<name>")` — the pattern sql_reports_audit.py uses. psycopg sends a
   repeated named placeholder as one parameter and Postgres must infer a single type for
   all its uses, which silently changes meaning when the uses disagree.
2. Every placeholder carries an explicit cast.
3. genericQuery passes sqlArgs straight to psycopg, which raises on a missing key — the
   client sends every key, with null meaning "no filter".
4. No percent sign in SQL comments; LIKE wildcards are written doubled.
5. `state` / `progress_stage` change only in CLAIM_EW_REMINDER, TRANSITION_EW_LEAD,
   ADD_EW_FOLLOW_UP and RECORD_EW_INTEREST. genericUpdate on ew_lead edits contact /
   device / remarks only (convention — plan §D4 R4).
"""

# The lead projection shared by GET_EW_LEADS_PAGED and GET_EW_LEAD_DETAIL, so the grid row
# and the detail dialog can never disagree about a column.
_LEAD_COLUMNS = """
            v.id AS ew_lead_id, v.branch_id, v.full_name, v.mobile, v.email, v.address, v.city,
            v.brand_id, b.name AS brand_name, v.product_id,
            COALESCE(NULLIF(v.model_name, ''), p.name, '') AS product_label, v.model_name,
            v.serial_no, v.purchase_date, v.warranty_end_date, v.days_left, v.band,
            v.remarks, v.state, v.progress_stage, v.is_closed, v.state_changed_at, v.closed_at,
            v.interest_at, v.preferred_contact, v.customer_remarks,
            v.next_follow_up_at, v.last_follow_up_at, v.follow_up_count,
            lf.action AS last_follow_up_action, lf.notes AS last_follow_up_notes,
            lf.created_by_name AS last_follow_up_by_name,
            v.is_opted_out, v.opted_out_at,
            v.last_message_id, v.last_delivery_status, v.last_sent_at, v.last_error,
            v.message_count, v.message_group, v.alert_status, v.alert_error, v.can_send,
            v.created_by, u.full_name AS created_by_name, v.created_at, v.updated_at"""

_LEAD_JOINS = """
        FROM ew_lead_view v
        LEFT JOIN brand           b ON b.id = v.brand_id
        LEFT JOIN product         p ON p.id = v.product_id
        LEFT JOIN security."user" u ON u.id = v.created_by
        LEFT JOIN LATERAL (
            SELECT e.action, e.notes, e.created_by_name
            FROM ew_lead_event e
            WHERE e.ew_lead_id = v.id AND e.event_type = 'FOLLOW_UP'
            ORDER BY e.created_at DESC, e.id DESC
            LIMIT 1
        ) lf ON true"""


class ExtendedWarrantySql:
    """Extended Warranty reads the browser calls via genericQuery (composed into SqlStore)."""

    # Details tab and every dashboard drill-down. All filters optional (null = off).
    # follow_up_due = true narrows to In Progress leads whose next follow-up is due and
    # orders them by that date; otherwise newest entered first.
    GET_EW_LEADS_PAGED = f"""
        with
            "p_band"           as (values(%(band)s::text)),
            "p_branch_id"      as (values(%(branch_id)s::bigint)),
            "p_follow_up_due"  as (values(%(follow_up_due)s::boolean)),
            "p_is_closed"      as (values(%(is_closed)s::boolean)),
            "p_limit"          as (values(%(limit)s::int)),
            "p_message_group"  as (values(%(message_group)s::text)),
            "p_offset"         as (values(%(offset)s::int)),
            "p_progress_stage" as (values(%(progress_stage)s::smallint)),
            "p_search"         as (values('%%' || NULLIF(TRIM(%(search)s::text), '') || '%%')),
            "p_state"          as (values(%(state)s::text))
        SELECT {_LEAD_COLUMNS},
            COUNT(*) OVER () AS total_count
        {_LEAD_JOINS}
        WHERE ((table "p_branch_id") IS NULL OR v.branch_id = (table "p_branch_id"))
          AND ((table "p_state") IS NULL OR v.state = (table "p_state"))
          AND ((table "p_band") IS NULL OR v.band = (table "p_band"))
          AND ((table "p_message_group") IS NULL OR v.message_group = (table "p_message_group"))
          AND ((table "p_progress_stage") IS NULL OR v.progress_stage = (table "p_progress_stage"))
          AND ((table "p_is_closed") IS NULL OR v.is_closed = (table "p_is_closed"))
          AND ((table "p_follow_up_due") IS NOT TRUE
               OR (v.state = 'IN_PROGRESS' AND v.next_follow_up_at <= now()))
          AND ((table "p_search") IS NULL
               OR v.full_name  ILIKE (table "p_search")
               OR v.mobile     ILIKE (table "p_search")
               OR v.serial_no  ILIKE (table "p_search")
               OR v.model_name ILIKE (table "p_search")
               OR b.name       ILIKE (table "p_search")
               OR p.name       ILIKE (table "p_search"))
        ORDER BY CASE WHEN (table "p_follow_up_due") IS TRUE THEN v.next_follow_up_at END ASC NULLS LAST,
                 v.created_at DESC, v.id DESC
        LIMIT (table "p_limit") OFFSET (table "p_offset")
    """

    # Detail dialog, staff deep link, staff alert composition. branch_id null = any branch
    # (the server composing the staff alert knows only the lead id).
    GET_EW_LEAD_DETAIL = f"""
        with "p_branch_id" as (values(%(branch_id)s::bigint))
        SELECT {_LEAD_COLUMNS}
        {_LEAD_JOINS}
        WHERE v.id = %(ew_lead_id)s::bigint
          AND ((table "p_branch_id") IS NULL OR v.branch_id = (table "p_branch_id"))
    """

    # Events and messages merged, newest first. `source` says which table a row came from;
    # ids are unique only within a source.
    GET_EW_LEAD_TIMELINE = """
        with "p_ew_lead_id" as (values(%(ew_lead_id)s::bigint))
        SELECT 'EVENT' AS source, e.id, e.created_at AS occurred_at, e.event_type AS item_type,
               e.from_state, e.to_state, e.progress_stage, e.action, e.notes, e.next_follow_up_at,
               e.ew_message_id, e.created_by_name AS by_name,
               NULL::text AS kind, NULL::text AS band, NULL::text AS delivery_status, NULL::text AS error
        FROM ew_lead_event e
        WHERE e.ew_lead_id = (table "p_ew_lead_id")
        UNION ALL
        SELECT 'MESSAGE', m.id, m.sent_at, 'MESSAGE',
               NULL, NULL, NULL, NULL, NULL, NULL,
               m.id, u.full_name,
               m.kind, m.band, m.delivery_status, m.error
        FROM ew_message m
        LEFT JOIN security."user" u ON u.id = m.sent_by
        WHERE m.ew_lead_id = (table "p_ew_lead_id")
        ORDER BY occurred_at DESC, id DESC
        LIMIT 200
    """

    # New / Edit Lead lookup: earlier Extended Warranty leads first (they carry device
    # fields), then customers from Jobs (person fields only). At most 5 rows.
    GET_EW_LEAD_BY_MOBILE = """
        with "p_mobile" as (values(NULLIF(TRIM(%(mobile)s::text), '')))
        SELECT x.* FROM (
            (SELECT 'EW' AS source, l.full_name, l.mobile, l.email, l.address, l.city,
                    l.brand_id, l.product_id, l.model_name, l.serial_no, l.purchase_date,
                    l.warranty_end_date, l.created_at
             FROM ew_lead l
             WHERE l.mobile = (table "p_mobile")
             ORDER BY l.created_at DESC, l.id DESC
             LIMIT 5)
            UNION ALL
            (SELECT 'CUSTOMER', c.full_name, c.mobile, c.email,
                    concat_ws(', ', c.address_line1, NULLIF(c.address_line2, '')), c.city,
                    NULL, NULL, NULL, NULL, NULL, NULL, c.created_at
             FROM customer_contact c
             WHERE c.mobile = (table "p_mobile") AND c.is_active
             ORDER BY c.created_at DESC, c.id DESC
             LIMIT 5)
        ) x
        ORDER BY CASE WHEN x.source = 'EW' THEN 0 ELSE 1 END, x.created_at DESC
        LIMIT 5
    """

    # One row. Column names are <metric>_<period>, periods today | week | month | older.
    # Periods are cumulative (D11): week includes today, month includes week; older = before
    # the 1st of this month. Each metric buckets by its own timestamp. Message statuses are
    # mutually exclusive by current status (D12): read + delivered + failed + awaiting = total.
    # Won / Lost / Cancelled by period count leads CURRENTLY in that state whose closed_at
    # falls in the period.
    GET_EW_DASHBOARD = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            bounds AS (
                SELECT date_trunc('day', now())                       AS d,
                       date_trunc('week', now())                      AS w,
                       date_trunc('month', now())                     AS m,
                       date_trunc('month', now()) - interval '1 month' AS pm,
                       date_trunc('year', now())                      AS y,
                       date_trunc('year', now()) - interval '1 year'  AS ly
            ),
            l AS (
                SELECT v.* FROM ew_lead_view v
                WHERE (table "p_branch_id") IS NULL OR v.branch_id = (table "p_branch_id")
            ),
            msg AS (
                SELECT x.sent_at, x.delivery_status
                FROM ew_message x
                JOIN ew_lead y ON y.id = x.ew_lead_id
                WHERE x.kind = 'REMINDER'
                  AND ((table "p_branch_id") IS NULL OR y.branch_id = (table "p_branch_id"))
            ),
            lead_counts AS (
                SELECT
                    -- Lead Pipeline (current state)
                    COUNT(*)                                                                AS leads_total,
                    COUNT(*) FILTER (WHERE l.state = 'NEW_LEAD')                            AS new_all,
                    COUNT(*) FILTER (WHERE l.state = 'NEW_LEAD' AND l.band = 'D31_60')      AS new_31_60,
                    COUNT(*) FILTER (WHERE l.state = 'NEW_LEAD' AND l.band = 'D8_30')       AS new_8_30,
                    COUNT(*) FILTER (WHERE l.state = 'NEW_LEAD' AND l.band = 'D0_7')        AS new_0_7,
                    COUNT(*) FILTER (WHERE l.state = 'NEW_LEAD' AND l.band = 'OVERDUE')     AS new_overdue,
                    COUNT(*) FILTER (WHERE l.state = 'NEW_LEAD' AND l.band = 'D61_PLUS')    AS new_61_plus,
                    COUNT(*) FILTER (WHERE l.state = 'MESSAGE_SENT')                        AS sent_all,
                    COUNT(*) FILTER (WHERE l.message_group = 'AWAITING')                    AS sent_awaiting,
                    COUNT(*) FILTER (WHERE l.message_group = 'DELIVERED')                   AS sent_delivered,
                    COUNT(*) FILTER (WHERE l.message_group = 'READ')                        AS sent_read,
                    COUNT(*) FILTER (WHERE l.message_group = 'FAILED')                      AS sent_failed,
                    COUNT(*) FILTER (WHERE l.state = 'INTERESTED')                          AS interested,
                    COUNT(*) FILTER (WHERE l.state = 'IN_PROGRESS')                         AS in_progress_all,
                    COUNT(*) FILTER (WHERE l.state = 'IN_PROGRESS' AND l.progress_stage = 1) AS in_progress_1,
                    COUNT(*) FILTER (WHERE l.state = 'IN_PROGRESS' AND l.progress_stage = 2) AS in_progress_2,
                    COUNT(*) FILTER (WHERE l.state = 'IN_PROGRESS' AND l.progress_stage = 3) AS in_progress_3,
                    COUNT(*) FILTER (WHERE l.state = 'WON')                                 AS won,
                    COUNT(*) FILTER (WHERE l.state = 'LOST')                                AS lost,
                    COUNT(*) FILTER (WHERE l.state = 'CANCELLED')                           AS cancelled,
                    COUNT(*) FILTER (WHERE l.state = 'IN_PROGRESS' AND l.next_follow_up_at <= now()) AS follow_ups_due,

                    -- Overall summary — leads entered (created_at). Six periods: the four
                    -- cumulative windows (today/week/month/this_year, each a superset of the
                    -- one before it), plus two discrete calendar windows (prev_month,
                    -- last_year) that do not nest with the rest or each other.
                    COUNT(*) FILTER (WHERE l.created_at >= bounds.d)                              AS leads_today,
                    COUNT(*) FILTER (WHERE l.created_at >= bounds.w)                              AS leads_week,
                    COUNT(*) FILTER (WHERE l.created_at >= bounds.m)                              AS leads_month,
                    COUNT(*) FILTER (WHERE l.created_at >= bounds.y)                              AS leads_this_year,
                    COUNT(*) FILTER (WHERE l.created_at >= bounds.pm AND l.created_at < bounds.m) AS leads_prev_month,
                    COUNT(*) FILTER (WHERE l.created_at >= bounds.ly AND l.created_at < bounds.y) AS leads_last_year,

                    -- customer interest (interest_at)
                    COUNT(*) FILTER (WHERE l.interest_at >= bounds.d)                               AS interested_today,
                    COUNT(*) FILTER (WHERE l.interest_at >= bounds.w)                               AS interested_week,
                    COUNT(*) FILTER (WHERE l.interest_at >= bounds.m)                               AS interested_month,
                    COUNT(*) FILTER (WHERE l.interest_at >= bounds.y)                               AS interested_this_year,
                    COUNT(*) FILTER (WHERE l.interest_at >= bounds.pm AND l.interest_at < bounds.m) AS interested_prev_month,
                    COUNT(*) FILTER (WHERE l.interest_at >= bounds.ly AND l.interest_at < bounds.y) AS interested_last_year,

                    -- closed (state + closed_at)
                    COUNT(*) FILTER (WHERE l.state = 'WON' AND l.closed_at >= bounds.d)                             AS won_today,
                    COUNT(*) FILTER (WHERE l.state = 'WON' AND l.closed_at >= bounds.w)                             AS won_week,
                    COUNT(*) FILTER (WHERE l.state = 'WON' AND l.closed_at >= bounds.m)                             AS won_month,
                    COUNT(*) FILTER (WHERE l.state = 'WON' AND l.closed_at >= bounds.y)                             AS won_this_year,
                    COUNT(*) FILTER (WHERE l.state = 'WON' AND l.closed_at >= bounds.pm AND l.closed_at < bounds.m) AS won_prev_month,
                    COUNT(*) FILTER (WHERE l.state = 'WON' AND l.closed_at >= bounds.ly AND l.closed_at < bounds.y) AS won_last_year,
                    COUNT(*) FILTER (WHERE l.state = 'LOST' AND l.closed_at >= bounds.d)                             AS lost_today,
                    COUNT(*) FILTER (WHERE l.state = 'LOST' AND l.closed_at >= bounds.w)                             AS lost_week,
                    COUNT(*) FILTER (WHERE l.state = 'LOST' AND l.closed_at >= bounds.m)                             AS lost_month,
                    COUNT(*) FILTER (WHERE l.state = 'LOST' AND l.closed_at >= bounds.y)                             AS lost_this_year,
                    COUNT(*) FILTER (WHERE l.state = 'LOST' AND l.closed_at >= bounds.pm AND l.closed_at < bounds.m) AS lost_prev_month,
                    COUNT(*) FILTER (WHERE l.state = 'LOST' AND l.closed_at >= bounds.ly AND l.closed_at < bounds.y) AS lost_last_year,
                    COUNT(*) FILTER (WHERE l.state = 'CANCELLED' AND l.closed_at >= bounds.d)                             AS cancelled_today,
                    COUNT(*) FILTER (WHERE l.state = 'CANCELLED' AND l.closed_at >= bounds.w)                             AS cancelled_week,
                    COUNT(*) FILTER (WHERE l.state = 'CANCELLED' AND l.closed_at >= bounds.m)                             AS cancelled_month,
                    COUNT(*) FILTER (WHERE l.state = 'CANCELLED' AND l.closed_at >= bounds.y)                             AS cancelled_this_year,
                    COUNT(*) FILTER (WHERE l.state = 'CANCELLED' AND l.closed_at >= bounds.pm AND l.closed_at < bounds.m) AS cancelled_prev_month,
                    COUNT(*) FILTER (WHERE l.state = 'CANCELLED' AND l.closed_at >= bounds.ly AND l.closed_at < bounds.y) AS cancelled_last_year
                FROM l CROSS JOIN bounds
            ),
            msg_counts AS (
                SELECT
                    -- Reminders by sent_at
                    COUNT(*) FILTER (WHERE m.sent_at >= bounds.d)                           AS msg_total_today,
                    COUNT(*) FILTER (WHERE m.sent_at >= bounds.w)                           AS msg_total_week,
                    COUNT(*) FILTER (WHERE m.sent_at >= bounds.m)                           AS msg_total_month,
                    COUNT(*) FILTER (WHERE m.sent_at >= bounds.y)                           AS msg_total_this_year,
                    COUNT(*) FILTER (WHERE m.sent_at >= bounds.pm AND m.sent_at < bounds.m) AS msg_total_prev_month,
                    COUNT(*) FILTER (WHERE m.sent_at >= bounds.ly AND m.sent_at < bounds.y) AS msg_total_last_year,
                    COUNT(*) FILTER (WHERE m.delivery_status = 'READ' AND m.sent_at >= bounds.d)                           AS msg_read_today,
                    COUNT(*) FILTER (WHERE m.delivery_status = 'READ' AND m.sent_at >= bounds.w)                           AS msg_read_week,
                    COUNT(*) FILTER (WHERE m.delivery_status = 'READ' AND m.sent_at >= bounds.m)                           AS msg_read_month,
                    COUNT(*) FILTER (WHERE m.delivery_status = 'READ' AND m.sent_at >= bounds.y)                           AS msg_read_this_year,
                    COUNT(*) FILTER (WHERE m.delivery_status = 'READ' AND m.sent_at >= bounds.pm AND m.sent_at < bounds.m) AS msg_read_prev_month,
                    COUNT(*) FILTER (WHERE m.delivery_status = 'READ' AND m.sent_at >= bounds.ly AND m.sent_at < bounds.y) AS msg_read_last_year,
                    COUNT(*) FILTER (WHERE m.delivery_status = 'DELIVERED' AND m.sent_at >= bounds.d)                           AS msg_delivered_today,
                    COUNT(*) FILTER (WHERE m.delivery_status = 'DELIVERED' AND m.sent_at >= bounds.w)                           AS msg_delivered_week,
                    COUNT(*) FILTER (WHERE m.delivery_status = 'DELIVERED' AND m.sent_at >= bounds.m)                           AS msg_delivered_month,
                    COUNT(*) FILTER (WHERE m.delivery_status = 'DELIVERED' AND m.sent_at >= bounds.y)                           AS msg_delivered_this_year,
                    COUNT(*) FILTER (WHERE m.delivery_status = 'DELIVERED' AND m.sent_at >= bounds.pm AND m.sent_at < bounds.m) AS msg_delivered_prev_month,
                    COUNT(*) FILTER (WHERE m.delivery_status = 'DELIVERED' AND m.sent_at >= bounds.ly AND m.sent_at < bounds.y) AS msg_delivered_last_year,
                    COUNT(*) FILTER (WHERE m.delivery_status = 'FAILED' AND m.sent_at >= bounds.d)                           AS msg_failed_today,
                    COUNT(*) FILTER (WHERE m.delivery_status = 'FAILED' AND m.sent_at >= bounds.w)                           AS msg_failed_week,
                    COUNT(*) FILTER (WHERE m.delivery_status = 'FAILED' AND m.sent_at >= bounds.m)                           AS msg_failed_month,
                    COUNT(*) FILTER (WHERE m.delivery_status = 'FAILED' AND m.sent_at >= bounds.y)                           AS msg_failed_this_year,
                    COUNT(*) FILTER (WHERE m.delivery_status = 'FAILED' AND m.sent_at >= bounds.pm AND m.sent_at < bounds.m) AS msg_failed_prev_month,
                    COUNT(*) FILTER (WHERE m.delivery_status = 'FAILED' AND m.sent_at >= bounds.ly AND m.sent_at < bounds.y) AS msg_failed_last_year,
                    COUNT(*) FILTER (WHERE m.delivery_status IN ('PENDING', 'ACCEPTED', 'SENT') AND m.sent_at >= bounds.d)                           AS msg_awaiting_today,
                    COUNT(*) FILTER (WHERE m.delivery_status IN ('PENDING', 'ACCEPTED', 'SENT') AND m.sent_at >= bounds.w)                           AS msg_awaiting_week,
                    COUNT(*) FILTER (WHERE m.delivery_status IN ('PENDING', 'ACCEPTED', 'SENT') AND m.sent_at >= bounds.m)                           AS msg_awaiting_month,
                    COUNT(*) FILTER (WHERE m.delivery_status IN ('PENDING', 'ACCEPTED', 'SENT') AND m.sent_at >= bounds.y)                           AS msg_awaiting_this_year,
                    COUNT(*) FILTER (WHERE m.delivery_status IN ('PENDING', 'ACCEPTED', 'SENT') AND m.sent_at >= bounds.pm AND m.sent_at < bounds.m) AS msg_awaiting_prev_month,
                    COUNT(*) FILTER (WHERE m.delivery_status IN ('PENDING', 'ACCEPTED', 'SENT') AND m.sent_at >= bounds.ly AND m.sent_at < bounds.y) AS msg_awaiting_last_year
                FROM msg m CROSS JOIN bounds
            )
        SELECT lead_counts.*, msg_counts.*
        FROM lead_counts CROSS JOIN msg_counts
    """

    # Bell: leads waiting in Interested.
    COUNT_EW_OPEN_INTEREST = """
        with "p_branch_id" as (values(%(branch_id)s::bigint))
        SELECT COUNT(*) AS open_interest
        FROM ew_lead
        WHERE state = 'INTERESTED'
          AND ((table "p_branch_id") IS NULL OR branch_id = (table "p_branch_id"))
    """


class ExtendedWarrantyServerSql:
    """Extended Warranty writes and server-only reads. NOT in SqlStore — see the module docstring."""

    # ── Reads (server only) ───────────────────────────────────────────────────

    # Re-filter at send time: the client's selection may be stale. can_send is the view's.
    GET_EW_LEADS_FOR_SEND = """
        SELECT v.id AS ew_lead_id, v.full_name, v.mobile, b.name AS brand_name,
               COALESCE(NULLIF(v.model_name, ''), p.name, '') AS product_label,
               v.warranty_end_date, v.band
        FROM ew_lead_view v
        LEFT JOIN brand   b ON b.id = v.brand_id
        LEFT JOIN product p ON p.id = v.product_id
        WHERE v.id = ANY(%(ew_lead_ids)s::bigint[])
          AND v.branch_id = %(branch_id)s::bigint
          AND v.can_send
        ORDER BY v.id
    """

    # Public landing page. Binds the token's lead AND message: the message must be a
    # REMINDER that belongs to the lead, so a valid token cannot be pointed at another lead.
    GET_EW_LEAD_FOR_PUBLIC = """
        SELECT l.id AS ew_lead_id, l.full_name, b.name AS brand_name,
               COALESCE(NULLIF(l.model_name, ''), p.name, '') AS product_label,
               l.warranty_end_date, l.is_opted_out, l.state, (l.interest_at IS NOT NULL) AS has_interest
        FROM ew_lead l
        JOIN ew_message m ON m.id = %(ew_message_id)s::bigint AND m.ew_lead_id = l.id AND m.kind = 'REMINDER'
        LEFT JOIN brand   b ON b.id = l.brand_id
        LEFT JOIN product p ON p.id = l.product_id
        WHERE l.id = %(ew_lead_id)s::bigint
    """

    # Daily cap — reminders that went out (or are in flight) today in this BU schema.
    GET_EW_SENT_TODAY_COUNT = """
        SELECT COUNT(*) AS sent_today
        FROM ew_message
        WHERE kind = 'REMINDER'
          AND delivery_status <> 'FAILED'
          AND sent_at >= date_trunc('day', now())
    """

    # Stamps created_by_name on events so the timeline survives a renamed or deleted user.
    GET_EW_STAFF_NAME = """
        SELECT full_name FROM security."user" WHERE id = %(user_id)s::bigint
    """

    # ── Writes — send path ────────────────────────────────────────────────────

    # The exactly-once claim AND the New Lead → Message Sent move, in one statement.
    # Claimed BEFORE calling Meta, as PENDING. The partial unique index
    # ew_message_once_per_band_idx serialises concurrent claims for one (lead, band):
    # the loser waits on the winner's row and then DOES NOTHING, so it gets no row back
    # and skips without calling Meta. FAILED rows drop out of the index, so a failed band
    # can be claimed again. Sending again from Message Sent keeps the state (the UPDATE
    # matches only NEW_LEAD) and writes no second event.
    CLAIM_EW_REMINDER = """
        with
            "p_sent_by" as (values(%(sent_by)s::bigint)),
            claimed AS (
                INSERT INTO ew_message (ew_lead_id, kind, band, delivery_status, status_rank, sent_by)
                SELECT v.id, 'REMINDER', v.band, 'PENDING', 0, (table "p_sent_by")
                FROM ew_lead_view v
                WHERE v.id = %(ew_lead_id)s::bigint
                  AND v.branch_id = %(branch_id)s::bigint
                  AND v.can_send
                ON CONFLICT (ew_lead_id, band) WHERE kind = 'REMINDER' AND delivery_status <> 'FAILED'
                DO NOTHING
                RETURNING id, ew_lead_id, band
            ),
            moved AS (
                UPDATE ew_lead l
                SET state = 'MESSAGE_SENT', state_changed_at = now(), updated_at = now()
                FROM claimed c
                WHERE l.id = c.ew_lead_id AND l.state = 'NEW_LEAD'
                RETURNING l.id
            ),
            ev AS (
                INSERT INTO ew_lead_event (ew_lead_id, event_type, from_state, to_state, created_by, created_by_name)
                SELECT id, 'STATE_CHANGE', 'NEW_LEAD', 'MESSAGE_SENT', (table "p_sent_by"), %(sent_by_name)s::text
                FROM moved
            )
        SELECT id AS ew_message_id, ew_lead_id, band FROM claimed
    """

    # Settles a claim right after Meta replies: ACCEPTED (rank 1) + wamid, or FAILED
    # (rank 9) + error. Only a still-PENDING row is touched — if a webhook already moved
    # it on, the later state stands.
    SET_EW_MESSAGE_SENT = """
        UPDATE ew_message
        SET wamid           = %(wamid)s::text,
            delivery_status = %(status)s::text,
            status_rank     = %(rank)s::smallint,
            error           = %(error)s::text,
            settled_at      = now()
        WHERE id = %(id)s::bigint
          AND delivery_status = 'PENDING'
        RETURNING id
    """

    # Staff alert row: PENDING before a real send, or FAILED straight away when the staff
    # number is invalid — so the failure is visible and the alert can be re-sent.
    CLAIM_EW_LEAD_ALERT = """
        INSERT INTO ew_message (ew_lead_id, kind, delivery_status, status_rank, error)
        VALUES (%(ew_lead_id)s::bigint, 'LEAD_ALERT', %(status)s::text, %(rank)s::smallint, %(error)s::text)
        RETURNING id
    """

    # Webhook status callback, both kinds. Keyed on wamid (unique, authoritative).
    # status_rank never moves backwards: a late DELIVERED after READ matches no row.
    SET_EW_MESSAGE_OUTCOME = """
        with "p_new_rank" as (values(%(new_rank)s::smallint))
        UPDATE ew_message
        SET delivery_status = %(status)s::text,
            status_rank     = (table "p_new_rank"),
            error           = %(error)s::text,
            settled_at      = now()
        WHERE wamid = %(wamid)s::text
          AND status_rank < (table "p_new_rank")
        RETURNING id AS ew_message_id, ew_lead_id, kind, delivery_status
    """

    # ── Writes — state machine ────────────────────────────────────────────────

    # transitionEwLead. `allowed_from` is computed by the resolver from EW_TRANSITIONS;
    # no row back = the lead changed under the user or the move is not allowed (STALE).
    # Stage advance is In Progress → In Progress with a strictly higher stage. Entering
    # In Progress from any other state always starts at Stage 1 (D3), whatever stage is
    # passed. Leaving In Progress clears the stage and the next follow-up; closing stamps
    # closed_at, reopening clears it.
    TRANSITION_EW_LEAD = """
        with
            "p_progress_stage" as (values(%(progress_stage)s::smallint)),
            "p_to_state"       as (values(%(to_state)s::text)),
            cur AS (
                SELECT id, state, progress_stage FROM ew_lead
                WHERE id = %(ew_lead_id)s::bigint
                  AND branch_id = %(branch_id)s::bigint
                FOR UPDATE
            ),
            moved AS (
                UPDATE ew_lead l
                SET state             = (table "p_to_state"),
                    progress_stage    = CASE WHEN (table "p_to_state") <> 'IN_PROGRESS' THEN NULL
                                             WHEN cur.state = 'IN_PROGRESS' THEN (table "p_progress_stage")
                                             ELSE 1 END,
                    next_follow_up_at = CASE WHEN (table "p_to_state") = 'IN_PROGRESS' THEN l.next_follow_up_at END,
                    closed_at         = CASE WHEN (table "p_to_state") IN ('WON', 'LOST', 'CANCELLED') THEN now() END,
                    interest_at       = CASE WHEN (table "p_to_state") = 'INTERESTED'
                                             THEN COALESCE(l.interest_at, now()) ELSE l.interest_at END,
                    state_changed_at  = CASE WHEN cur.state <> (table "p_to_state") THEN now()
                                             ELSE l.state_changed_at END,
                    updated_at        = now()
                FROM cur
                WHERE l.id = cur.id
                  AND cur.state = ANY(%(allowed_from)s::text[])
                  AND (cur.state <> 'IN_PROGRESS' OR (table "p_to_state") <> 'IN_PROGRESS'
                       OR (table "p_progress_stage") > cur.progress_stage)
                RETURNING l.id, cur.state AS from_state, l.state AS to_state, l.progress_stage
            )
        INSERT INTO ew_lead_event (ew_lead_id, event_type, from_state, to_state, progress_stage, notes,
                                   created_by, created_by_name)
        SELECT id, CASE WHEN from_state = to_state THEN 'STAGE_CHANGE' ELSE 'STATE_CHANGE' END,
               from_state, to_state, progress_stage, %(notes)s::text, %(by)s::bigint, %(by_name)s::text
        FROM moved
        RETURNING ew_lead_id, from_state, to_state, progress_stage
    """

    # addEwFollowUp — In Progress only (no row back = NOT_IN_PROGRESS). next_follow_up_at
    # is replaced each time; null clears it. The stage never decreases; when it rises a
    # STAGE_CHANGE event is logged alongside the FOLLOW_UP one.
    ADD_EW_FOLLOW_UP = """
        with
            "p_by"                as (values(%(by)s::bigint)),
            "p_by_name"           as (values(%(by_name)s::text)),
            "p_next_follow_up_at" as (values(%(next_follow_up_at)s::timestamptz)),
            cur AS (
                SELECT id, progress_stage FROM ew_lead
                WHERE id = %(ew_lead_id)s::bigint
                  AND branch_id = %(branch_id)s::bigint
                  AND state = 'IN_PROGRESS'
                FOR UPDATE
            ),
            moved AS (
                UPDATE ew_lead l
                SET next_follow_up_at = (table "p_next_follow_up_at"),
                    progress_stage    = GREATEST(cur.progress_stage,
                                                 COALESCE(%(progress_stage)s::smallint, cur.progress_stage)),
                    follow_up_count   = l.follow_up_count + 1,
                    last_follow_up_at = now(),
                    updated_at        = now()
                FROM cur
                WHERE l.id = cur.id
                RETURNING l.id, cur.progress_stage AS old_stage, l.progress_stage
            ),
            stage_ev AS (
                INSERT INTO ew_lead_event (ew_lead_id, event_type, from_state, to_state, progress_stage,
                                           created_by, created_by_name)
                SELECT id, 'STAGE_CHANGE', 'IN_PROGRESS', 'IN_PROGRESS', progress_stage,
                       (table "p_by"), (table "p_by_name")
                FROM moved
                WHERE progress_stage > old_stage
            )
        INSERT INTO ew_lead_event (ew_lead_id, event_type, to_state, progress_stage, action, notes,
                                   next_follow_up_at, created_by, created_by_name)
        SELECT id, 'FOLLOW_UP', 'IN_PROGRESS', progress_stage, %(action)s::text, %(notes)s::text,
               (table "p_next_follow_up_at"), (table "p_by"), (table "p_by_name")
        FROM moved
        RETURNING id, ew_lead_id, progress_stage
    """

    # ── Writes — public customer routes ───────────────────────────────────────

    # The customer's "I am interested" — first tap only (a second tap matches no row, so no
    # second staff alert). The state moves only from Message Sent; from any other state the
    # interest is still recorded. An opted-out lead records nothing. Commits before any
    # notification is attempted.
    RECORD_EW_INTEREST = """
        with
            "p_customer_remarks" as (values(NULLIF(TRIM(%(customer_remarks)s::text), ''))),
            cur AS (
                SELECT id, state FROM ew_lead
                WHERE id = %(ew_lead_id)s::bigint
                  AND interest_at IS NULL
                  AND NOT is_opted_out
                FOR UPDATE
            ),
            moved AS (
                UPDATE ew_lead l
                SET interest_at       = now(),
                    preferred_contact = %(preferred_contact)s::text,
                    customer_remarks  = (table "p_customer_remarks"),
                    state             = CASE WHEN cur.state = 'MESSAGE_SENT' THEN 'INTERESTED' ELSE l.state END,
                    state_changed_at  = CASE WHEN cur.state = 'MESSAGE_SENT' THEN now() ELSE l.state_changed_at END,
                    updated_at        = now()
                FROM cur
                WHERE l.id = cur.id
                RETURNING l.id, cur.state AS from_state, l.state AS to_state
            ),
            ev AS (
                INSERT INTO ew_lead_event (ew_lead_id, event_type, from_state, to_state, notes, ew_message_id)
                SELECT id, 'INTEREST', from_state, to_state, (table "p_customer_remarks"), %(ew_message_id)s::bigint
                FROM moved
            )
        SELECT id AS ew_lead_id, from_state, to_state FROM moved
    """

    # "Don't send me warranty reminders". State is unchanged (plan §D4 R5); can_send turns
    # false through the view. Idempotent: a second opt-out matches no row.
    SET_EW_OPT_OUT = """
        with moved AS (
            UPDATE ew_lead
            SET is_opted_out = true, opted_out_at = now(), updated_at = now()
            WHERE id = %(ew_lead_id)s::bigint
              AND NOT is_opted_out
            RETURNING id, state
        )
        INSERT INTO ew_lead_event (ew_lead_id, event_type, from_state, to_state, ew_message_id)
        SELECT id, 'OPT_OUT', state, state, %(ew_message_id)s::bigint
        FROM moved
        RETURNING ew_lead_id
    """
