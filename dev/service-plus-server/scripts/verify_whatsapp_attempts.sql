-- Verification for job.whatsapp_notifications[event_key].attempts
-- (plans/plan-completion-history.md). Table-free: every step evaluates the exact
-- expression from SqlStore.SET_JOB_WHATSAPP_ATTEMPT / _OUTCOME against a literal
-- jsonb value, so this reads and writes nothing. Safe on any database.
--   psql "<conn>" -f verify_whatsapp_attempts.sql

\echo === 1. first-ever send on a job with NULL whatsapp_notifications ===
WITH job AS (SELECT NULL::jsonb AS whatsapp_notifications)
SELECT jsonb_pretty(jsonb_set(
            COALESCE(whatsapp_notifications, '{}'::jsonb),
            ARRAY['JOB_COMPLETION'],
            jsonb_set(
                jsonb_set(
                    jsonb_set(
                        jsonb_set(
                            jsonb_set(
                                jsonb_set(
                                    jsonb_set(
                                        CASE WHEN jsonb_typeof(whatsapp_notifications -> 'JOB_COMPLETION') = 'object'
                                             THEN whatsapp_notifications -> 'JOB_COMPLETION'
                                             ELSE '{}'::jsonb END,
                                        '{attempt_count}',
                                        to_jsonb(
                                            COALESCE(
                                                CASE WHEN jsonb_typeof(whatsapp_notifications -> 'JOB_COMPLETION') = 'object'
                                                     THEN (whatsapp_notifications -> 'JOB_COMPLETION' ->> 'attempt_count')::int
                                                     ELSE NULL END,
                                                0
                                            ) + 1
                                        ),
                                        true
                                    ),
                                    '{last_wamid}',
                                    CASE WHEN 'wamid-1'::text IS NULL THEN 'null'::jsonb ELSE to_jsonb('wamid-1'::text) END,
                                    true
                                ),
                                '{last_status}', to_jsonb('ACCEPTED'::text), true
                            ),
                            '{last_sent_at}', to_jsonb('2026-09-04T09:00:00+00:00'::text), true
                        ),
                        '{last_error}',
                        CASE WHEN NULL::text IS NULL THEN 'null'::jsonb ELSE to_jsonb(NULL::text) END,
                        true
                    ),
                    '{fail_count}',
                    to_jsonb(
                        COALESCE(
                            CASE WHEN jsonb_typeof(whatsapp_notifications -> 'JOB_COMPLETION') = 'object'
                                 THEN (whatsapp_notifications -> 'JOB_COMPLETION' ->> 'fail_count')::int
                                 ELSE NULL END,
                            0
                        ) + CASE WHEN 'ACCEPTED' = 'FAILED' THEN 1 ELSE 0 END
                    ),
                    true
                ),
                '{attempts}',
                (
                    SELECT COALESCE(jsonb_agg(kept.elem ORDER BY kept.ord), '[]'::jsonb)
                    FROM (
                        SELECT elem, ord
                        FROM jsonb_array_elements(
                            CASE WHEN jsonb_typeof(whatsapp_notifications -> 'JOB_COMPLETION' -> 'attempts') = 'array'
                                 THEN whatsapp_notifications -> 'JOB_COMPLETION' -> 'attempts'
                                 ELSE '[]'::jsonb END
                        ) WITH ORDINALITY AS t(elem, ord)
                        ORDER BY ord DESC
                        LIMIT 19
                    ) kept
                ) || jsonb_build_array(jsonb_build_object(
                    'attempt_no',
                        COALESCE(
                            CASE WHEN jsonb_typeof(whatsapp_notifications -> 'JOB_COMPLETION') = 'object'
                                 THEN (whatsapp_notifications -> 'JOB_COMPLETION' ->> 'attempt_count')::int
                                 ELSE NULL END,
                            0
                        ) + 1,
                    'wamid',
                        CASE WHEN 'wamid-1'::text IS NULL THEN 'null'::jsonb ELSE to_jsonb('wamid-1'::text) END,
                    'sent_at',  to_jsonb('2026-09-04T09:00:00+00:00'::text),
                    'status',   to_jsonb('ACCEPTED'::text),
                    'status_at', 'null'::jsonb,
                    'error',
                        CASE WHEN NULL::text IS NULL THEN 'null'::jsonb ELSE to_jsonb(NULL::text) END
                )),
                true
            ),
            true
        )) FROM job;

\echo === 2. second send on top of step 1 output (expect attempt_count 2, attempts len 2) ===
WITH job AS (SELECT '{"JOB_COMPLETION": {"attempt_count": 1, "fail_count": 0, "last_wamid": "wamid-1", "last_status": "DELIVERED", "last_sent_at": "2026-09-04T09:00:00+00:00", "last_error": null, "success_count": 1, "attempts": [{"error": null, "wamid": "wamid-1", "status": "DELIVERED", "sent_at": "2026-09-04T09:00:00+00:00", "status_at": "2026-09-04T09:00:20+00:00", "attempt_no": 1}]}}'::jsonb AS whatsapp_notifications)
SELECT jsonb_pretty(jsonb_set(
            COALESCE(whatsapp_notifications, '{}'::jsonb),
            ARRAY['JOB_COMPLETION'],
            jsonb_set(
                jsonb_set(
                    jsonb_set(
                        jsonb_set(
                            jsonb_set(
                                jsonb_set(
                                    jsonb_set(
                                        CASE WHEN jsonb_typeof(whatsapp_notifications -> 'JOB_COMPLETION') = 'object'
                                             THEN whatsapp_notifications -> 'JOB_COMPLETION'
                                             ELSE '{}'::jsonb END,
                                        '{attempt_count}',
                                        to_jsonb(
                                            COALESCE(
                                                CASE WHEN jsonb_typeof(whatsapp_notifications -> 'JOB_COMPLETION') = 'object'
                                                     THEN (whatsapp_notifications -> 'JOB_COMPLETION' ->> 'attempt_count')::int
                                                     ELSE NULL END,
                                                0
                                            ) + 1
                                        ),
                                        true
                                    ),
                                    '{last_wamid}',
                                    CASE WHEN 'wamid-2'::text IS NULL THEN 'null'::jsonb ELSE to_jsonb('wamid-2'::text) END,
                                    true
                                ),
                                '{last_status}', to_jsonb('ACCEPTED'::text), true
                            ),
                            '{last_sent_at}', to_jsonb('2026-09-04T11:30:00+00:00'::text), true
                        ),
                        '{last_error}',
                        CASE WHEN NULL::text IS NULL THEN 'null'::jsonb ELSE to_jsonb(NULL::text) END,
                        true
                    ),
                    '{fail_count}',
                    to_jsonb(
                        COALESCE(
                            CASE WHEN jsonb_typeof(whatsapp_notifications -> 'JOB_COMPLETION') = 'object'
                                 THEN (whatsapp_notifications -> 'JOB_COMPLETION' ->> 'fail_count')::int
                                 ELSE NULL END,
                            0
                        ) + CASE WHEN 'ACCEPTED' = 'FAILED' THEN 1 ELSE 0 END
                    ),
                    true
                ),
                '{attempts}',
                (
                    SELECT COALESCE(jsonb_agg(kept.elem ORDER BY kept.ord), '[]'::jsonb)
                    FROM (
                        SELECT elem, ord
                        FROM jsonb_array_elements(
                            CASE WHEN jsonb_typeof(whatsapp_notifications -> 'JOB_COMPLETION' -> 'attempts') = 'array'
                                 THEN whatsapp_notifications -> 'JOB_COMPLETION' -> 'attempts'
                                 ELSE '[]'::jsonb END
                        ) WITH ORDINALITY AS t(elem, ord)
                        ORDER BY ord DESC
                        LIMIT 19
                    ) kept
                ) || jsonb_build_array(jsonb_build_object(
                    'attempt_no',
                        COALESCE(
                            CASE WHEN jsonb_typeof(whatsapp_notifications -> 'JOB_COMPLETION') = 'object'
                                 THEN (whatsapp_notifications -> 'JOB_COMPLETION' ->> 'attempt_count')::int
                                 ELSE NULL END,
                            0
                        ) + 1,
                    'wamid',
                        CASE WHEN 'wamid-2'::text IS NULL THEN 'null'::jsonb ELSE to_jsonb('wamid-2'::text) END,
                    'sent_at',  to_jsonb('2026-09-04T11:30:00+00:00'::text),
                    'status',   to_jsonb('ACCEPTED'::text),
                    'status_at', 'null'::jsonb,
                    'error',
                        CASE WHEN NULL::text IS NULL THEN 'null'::jsonb ELSE to_jsonb(NULL::text) END
                )),
                true
            ),
            true
        )) FROM job;

\echo === 3. webhook settles wamid-2 as READ (expect only attempt_no 2 changed) ===
WITH job AS (SELECT '{"JOB_COMPLETION": {"attempt_count": 2, "fail_count": 0, "last_wamid": "wamid-2", "last_status": "ACCEPTED", "last_sent_at": "2026-09-04T11:30:00+00:00", "last_error": null, "success_count": 1, "attempts": [{"error": null, "wamid": "wamid-1", "status": "DELIVERED", "sent_at": "2026-09-04T09:00:00+00:00", "status_at": "2026-09-04T09:00:20+00:00", "attempt_no": 1}, {"error": null, "wamid": "wamid-2", "status": "ACCEPTED", "sent_at": "2026-09-04T11:30:00+00:00", "status_at": null, "attempt_no": 2}]}}'::jsonb AS whatsapp_notifications)
SELECT jsonb_pretty(jsonb_set(
            COALESCE(whatsapp_notifications, '{}'::jsonb),
            ARRAY['JOB_COMPLETION'],
            jsonb_set(
                jsonb_set(
                    jsonb_set(
                        jsonb_set(
                            jsonb_set(
                                CASE WHEN jsonb_typeof(whatsapp_notifications -> 'JOB_COMPLETION') = 'object'
                                     THEN whatsapp_notifications -> 'JOB_COMPLETION'
                                     ELSE '{}'::jsonb END,
                                '{last_status}', to_jsonb('READ'::text), true
                            ),
                            '{last_error}',
                            CASE WHEN NULL::text IS NULL THEN 'null'::jsonb ELSE to_jsonb(NULL::text) END,
                            true
                        ),
                        '{success_count}',
                        to_jsonb(
                            COALESCE(
                                CASE WHEN jsonb_typeof(whatsapp_notifications -> 'JOB_COMPLETION') = 'object'
                                     THEN (whatsapp_notifications -> 'JOB_COMPLETION' ->> 'success_count')::int
                                     ELSE NULL END,
                                0
                            ) + CASE WHEN 'READ' = 'DELIVERED' THEN 1 ELSE 0 END
                        ),
                        true
                    ),
                    '{fail_count}',
                    to_jsonb(
                        COALESCE(
                            CASE WHEN jsonb_typeof(whatsapp_notifications -> 'JOB_COMPLETION') = 'object'
                                 THEN (whatsapp_notifications -> 'JOB_COMPLETION' ->> 'fail_count')::int
                                 ELSE NULL END,
                            0
                        ) + CASE WHEN 'READ' = 'FAILED' THEN 1 ELSE 0 END
                    ),
                    true
                ),
                '{attempts}',
                (
                    SELECT COALESCE(jsonb_agg(
                        CASE WHEN elem ->> 'wamid' = 'wamid-2'
                             THEN elem || jsonb_build_object(
                                 'status',    to_jsonb('READ'::text),
                                 'status_at', to_jsonb('2026-09-04T11:31:05+00:00'::text),
                                 'error',
                                     CASE WHEN NULL::text IS NULL THEN 'null'::jsonb ELSE to_jsonb(NULL::text) END
                             )
                             ELSE elem END
                        ORDER BY ord
                    ), '[]'::jsonb)
                    FROM jsonb_array_elements(
                        CASE WHEN jsonb_typeof(whatsapp_notifications -> 'JOB_COMPLETION' -> 'attempts') = 'array'
                             THEN whatsapp_notifications -> 'JOB_COMPLETION' -> 'attempts'
                             ELSE '[]'::jsonb END
                    ) WITH ORDINALITY AS t(elem, ord)
                ),
                true
            ),
            true
        )) FROM job;

\echo === 4. legacy row: counters but no attempts key (expect attempts created, len 1) ===
WITH job AS (SELECT '{"JOB_COMPLETION": {"attempt_count": 3, "fail_count": 1, "last_wamid": "old-wamid", "last_status": "FAILED", "last_sent_at": "2026-08-01T09:00:00+00:00", "last_error": "Re-engagement message", "success_count": 2}}'::jsonb AS whatsapp_notifications)
SELECT jsonb_pretty(jsonb_set(
            COALESCE(whatsapp_notifications, '{}'::jsonb),
            ARRAY['JOB_COMPLETION'],
            jsonb_set(
                jsonb_set(
                    jsonb_set(
                        jsonb_set(
                            jsonb_set(
                                jsonb_set(
                                    jsonb_set(
                                        CASE WHEN jsonb_typeof(whatsapp_notifications -> 'JOB_COMPLETION') = 'object'
                                             THEN whatsapp_notifications -> 'JOB_COMPLETION'
                                             ELSE '{}'::jsonb END,
                                        '{attempt_count}',
                                        to_jsonb(
                                            COALESCE(
                                                CASE WHEN jsonb_typeof(whatsapp_notifications -> 'JOB_COMPLETION') = 'object'
                                                     THEN (whatsapp_notifications -> 'JOB_COMPLETION' ->> 'attempt_count')::int
                                                     ELSE NULL END,
                                                0
                                            ) + 1
                                        ),
                                        true
                                    ),
                                    '{last_wamid}',
                                    CASE WHEN 'wamid-9'::text IS NULL THEN 'null'::jsonb ELSE to_jsonb('wamid-9'::text) END,
                                    true
                                ),
                                '{last_status}', to_jsonb('ACCEPTED'::text), true
                            ),
                            '{last_sent_at}', to_jsonb('2026-09-04T12:00:00+00:00'::text), true
                        ),
                        '{last_error}',
                        CASE WHEN NULL::text IS NULL THEN 'null'::jsonb ELSE to_jsonb(NULL::text) END,
                        true
                    ),
                    '{fail_count}',
                    to_jsonb(
                        COALESCE(
                            CASE WHEN jsonb_typeof(whatsapp_notifications -> 'JOB_COMPLETION') = 'object'
                                 THEN (whatsapp_notifications -> 'JOB_COMPLETION' ->> 'fail_count')::int
                                 ELSE NULL END,
                            0
                        ) + CASE WHEN 'ACCEPTED' = 'FAILED' THEN 1 ELSE 0 END
                    ),
                    true
                ),
                '{attempts}',
                (
                    SELECT COALESCE(jsonb_agg(kept.elem ORDER BY kept.ord), '[]'::jsonb)
                    FROM (
                        SELECT elem, ord
                        FROM jsonb_array_elements(
                            CASE WHEN jsonb_typeof(whatsapp_notifications -> 'JOB_COMPLETION' -> 'attempts') = 'array'
                                 THEN whatsapp_notifications -> 'JOB_COMPLETION' -> 'attempts'
                                 ELSE '[]'::jsonb END
                        ) WITH ORDINALITY AS t(elem, ord)
                        ORDER BY ord DESC
                        LIMIT 19
                    ) kept
                ) || jsonb_build_array(jsonb_build_object(
                    'attempt_no',
                        COALESCE(
                            CASE WHEN jsonb_typeof(whatsapp_notifications -> 'JOB_COMPLETION') = 'object'
                                 THEN (whatsapp_notifications -> 'JOB_COMPLETION' ->> 'attempt_count')::int
                                 ELSE NULL END,
                            0
                        ) + 1,
                    'wamid',
                        CASE WHEN 'wamid-9'::text IS NULL THEN 'null'::jsonb ELSE to_jsonb('wamid-9'::text) END,
                    'sent_at',  to_jsonb('2026-09-04T12:00:00+00:00'::text),
                    'status',   to_jsonb('ACCEPTED'::text),
                    'status_at', 'null'::jsonb,
                    'error',
                        CASE WHEN NULL::text IS NULL THEN 'null'::jsonb ELSE to_jsonb(NULL::text) END
                )),
                true
            ),
            true
        )) FROM job;

\echo === 5. corrupted non-object value under the event key (expect self-heal, no error) ===
WITH job AS (SELECT '{"JOB_COMPLETION": ["junk"]}'::jsonb AS whatsapp_notifications)
SELECT jsonb_pretty(jsonb_set(
            COALESCE(whatsapp_notifications, '{}'::jsonb),
            ARRAY['JOB_COMPLETION'],
            jsonb_set(
                jsonb_set(
                    jsonb_set(
                        jsonb_set(
                            jsonb_set(
                                jsonb_set(
                                    jsonb_set(
                                        CASE WHEN jsonb_typeof(whatsapp_notifications -> 'JOB_COMPLETION') = 'object'
                                             THEN whatsapp_notifications -> 'JOB_COMPLETION'
                                             ELSE '{}'::jsonb END,
                                        '{attempt_count}',
                                        to_jsonb(
                                            COALESCE(
                                                CASE WHEN jsonb_typeof(whatsapp_notifications -> 'JOB_COMPLETION') = 'object'
                                                     THEN (whatsapp_notifications -> 'JOB_COMPLETION' ->> 'attempt_count')::int
                                                     ELSE NULL END,
                                                0
                                            ) + 1
                                        ),
                                        true
                                    ),
                                    '{last_wamid}',
                                    CASE WHEN 'wamid-x'::text IS NULL THEN 'null'::jsonb ELSE to_jsonb('wamid-x'::text) END,
                                    true
                                ),
                                '{last_status}', to_jsonb('FAILED'::text), true
                            ),
                            '{last_sent_at}', to_jsonb('2026-09-04T12:00:00+00:00'::text), true
                        ),
                        '{last_error}',
                        CASE WHEN 'Invalid parameter'::text IS NULL THEN 'null'::jsonb ELSE to_jsonb('Invalid parameter'::text) END,
                        true
                    ),
                    '{fail_count}',
                    to_jsonb(
                        COALESCE(
                            CASE WHEN jsonb_typeof(whatsapp_notifications -> 'JOB_COMPLETION') = 'object'
                                 THEN (whatsapp_notifications -> 'JOB_COMPLETION' ->> 'fail_count')::int
                                 ELSE NULL END,
                            0
                        ) + CASE WHEN 'FAILED' = 'FAILED' THEN 1 ELSE 0 END
                    ),
                    true
                ),
                '{attempts}',
                (
                    SELECT COALESCE(jsonb_agg(kept.elem ORDER BY kept.ord), '[]'::jsonb)
                    FROM (
                        SELECT elem, ord
                        FROM jsonb_array_elements(
                            CASE WHEN jsonb_typeof(whatsapp_notifications -> 'JOB_COMPLETION' -> 'attempts') = 'array'
                                 THEN whatsapp_notifications -> 'JOB_COMPLETION' -> 'attempts'
                                 ELSE '[]'::jsonb END
                        ) WITH ORDINALITY AS t(elem, ord)
                        ORDER BY ord DESC
                        LIMIT 19
                    ) kept
                ) || jsonb_build_array(jsonb_build_object(
                    'attempt_no',
                        COALESCE(
                            CASE WHEN jsonb_typeof(whatsapp_notifications -> 'JOB_COMPLETION') = 'object'
                                 THEN (whatsapp_notifications -> 'JOB_COMPLETION' ->> 'attempt_count')::int
                                 ELSE NULL END,
                            0
                        ) + 1,
                    'wamid',
                        CASE WHEN 'wamid-x'::text IS NULL THEN 'null'::jsonb ELSE to_jsonb('wamid-x'::text) END,
                    'sent_at',  to_jsonb('2026-09-04T12:00:00+00:00'::text),
                    'status',   to_jsonb('FAILED'::text),
                    'status_at', 'null'::jsonb,
                    'error',
                        CASE WHEN 'Invalid parameter'::text IS NULL THEN 'null'::jsonb ELSE to_jsonb('Invalid parameter'::text) END
                )),
                true
            ),
            true
        )) FROM job;

\echo === 6. cap: 25 prior attempts in, expect exactly 20 out (attempt_no 7..26) ===
WITH job AS (
    SELECT jsonb_build_object('JOB_COMPLETION', jsonb_build_object(
        'attempt_count', 25, 'success_count', 0, 'fail_count', 0,
        'last_wamid', 'w25', 'last_status', 'ACCEPTED',
        'last_sent_at', '2026-09-04T12:00:00+00:00', 'last_error', NULL,
        'attempts', (SELECT jsonb_agg(jsonb_build_object(
            'attempt_no', i, 'wamid', 'w' || i, 'sent_at', '2026-09-04T00:00:00+00:00'::text,
            'status', 'DELIVERED', 'status_at', NULL, 'error', NULL) ORDER BY i)
            FROM generate_series(1, 25) i)
    )) AS whatsapp_notifications
)
SELECT jsonb_array_length(x -> 'JOB_COMPLETION' -> 'attempts')              AS kept,
       x -> 'JOB_COMPLETION' -> 'attempts' -> 0  ->> 'attempt_no'           AS first_attempt_no,
       x -> 'JOB_COMPLETION' -> 'attempts' -> -1 ->> 'attempt_no'           AS last_attempt_no
FROM job, LATERAL (SELECT jsonb_set(
            COALESCE(whatsapp_notifications, '{}'::jsonb),
            ARRAY['JOB_COMPLETION'],
            jsonb_set(
                jsonb_set(
                    jsonb_set(
                        jsonb_set(
                            jsonb_set(
                                jsonb_set(
                                    jsonb_set(
                                        CASE WHEN jsonb_typeof(whatsapp_notifications -> 'JOB_COMPLETION') = 'object'
                                             THEN whatsapp_notifications -> 'JOB_COMPLETION'
                                             ELSE '{}'::jsonb END,
                                        '{attempt_count}',
                                        to_jsonb(
                                            COALESCE(
                                                CASE WHEN jsonb_typeof(whatsapp_notifications -> 'JOB_COMPLETION') = 'object'
                                                     THEN (whatsapp_notifications -> 'JOB_COMPLETION' ->> 'attempt_count')::int
                                                     ELSE NULL END,
                                                0
                                            ) + 1
                                        ),
                                        true
                                    ),
                                    '{last_wamid}',
                                    CASE WHEN 'w26'::text IS NULL THEN 'null'::jsonb ELSE to_jsonb('w26'::text) END,
                                    true
                                ),
                                '{last_status}', to_jsonb('ACCEPTED'::text), true
                            ),
                            '{last_sent_at}', to_jsonb('2026-09-04T13:00:00+00:00'::text), true
                        ),
                        '{last_error}',
                        CASE WHEN NULL::text IS NULL THEN 'null'::jsonb ELSE to_jsonb(NULL::text) END,
                        true
                    ),
                    '{fail_count}',
                    to_jsonb(
                        COALESCE(
                            CASE WHEN jsonb_typeof(whatsapp_notifications -> 'JOB_COMPLETION') = 'object'
                                 THEN (whatsapp_notifications -> 'JOB_COMPLETION' ->> 'fail_count')::int
                                 ELSE NULL END,
                            0
                        ) + CASE WHEN 'ACCEPTED' = 'FAILED' THEN 1 ELSE 0 END
                    ),
                    true
                ),
                '{attempts}',
                (
                    SELECT COALESCE(jsonb_agg(kept.elem ORDER BY kept.ord), '[]'::jsonb)
                    FROM (
                        SELECT elem, ord
                        FROM jsonb_array_elements(
                            CASE WHEN jsonb_typeof(whatsapp_notifications -> 'JOB_COMPLETION' -> 'attempts') = 'array'
                                 THEN whatsapp_notifications -> 'JOB_COMPLETION' -> 'attempts'
                                 ELSE '[]'::jsonb END
                        ) WITH ORDINALITY AS t(elem, ord)
                        ORDER BY ord DESC
                        LIMIT 19
                    ) kept
                ) || jsonb_build_array(jsonb_build_object(
                    'attempt_no',
                        COALESCE(
                            CASE WHEN jsonb_typeof(whatsapp_notifications -> 'JOB_COMPLETION') = 'object'
                                 THEN (whatsapp_notifications -> 'JOB_COMPLETION' ->> 'attempt_count')::int
                                 ELSE NULL END,
                            0
                        ) + 1,
                    'wamid',
                        CASE WHEN 'w26'::text IS NULL THEN 'null'::jsonb ELSE to_jsonb('w26'::text) END,
                    'sent_at',  to_jsonb('2026-09-04T13:00:00+00:00'::text),
                    'status',   to_jsonb('ACCEPTED'::text),
                    'status_at', 'null'::jsonb,
                    'error',
                        CASE WHEN NULL::text IS NULL THEN 'null'::jsonb ELSE to_jsonb(NULL::text) END
                )),
                true
            ),
            true
        ) AS x) t;

\echo === 7. JOB_MONEY_RECEIPT (array value): the expression must EVALUATE without error ===
\echo     (the real query never writes it - its WHERE clause reads last_wamid via ->>,
\echo      which is NULL against an array, so no row ever matches. This only proves no crash.)
WITH job AS (SELECT '{"JOB_MONEY_RECEIPT": [{"payment_id": 1, "last_wamid": "mr-1"}]}'::jsonb AS whatsapp_notifications)
SELECT jsonb_pretty(jsonb_set(
            COALESCE(whatsapp_notifications, '{}'::jsonb),
            ARRAY['JOB_MONEY_RECEIPT'],
            jsonb_set(
                jsonb_set(
                    jsonb_set(
                        jsonb_set(
                            jsonb_set(
                                CASE WHEN jsonb_typeof(whatsapp_notifications -> 'JOB_MONEY_RECEIPT') = 'object'
                                     THEN whatsapp_notifications -> 'JOB_MONEY_RECEIPT'
                                     ELSE '{}'::jsonb END,
                                '{last_status}', to_jsonb('READ'::text), true
                            ),
                            '{last_error}',
                            CASE WHEN NULL::text IS NULL THEN 'null'::jsonb ELSE to_jsonb(NULL::text) END,
                            true
                        ),
                        '{success_count}',
                        to_jsonb(
                            COALESCE(
                                CASE WHEN jsonb_typeof(whatsapp_notifications -> 'JOB_MONEY_RECEIPT') = 'object'
                                     THEN (whatsapp_notifications -> 'JOB_MONEY_RECEIPT' ->> 'success_count')::int
                                     ELSE NULL END,
                                0
                            ) + CASE WHEN 'READ' = 'DELIVERED' THEN 1 ELSE 0 END
                        ),
                        true
                    ),
                    '{fail_count}',
                    to_jsonb(
                        COALESCE(
                            CASE WHEN jsonb_typeof(whatsapp_notifications -> 'JOB_MONEY_RECEIPT') = 'object'
                                 THEN (whatsapp_notifications -> 'JOB_MONEY_RECEIPT' ->> 'fail_count')::int
                                 ELSE NULL END,
                            0
                        ) + CASE WHEN 'READ' = 'FAILED' THEN 1 ELSE 0 END
                    ),
                    true
                ),
                '{attempts}',
                (
                    SELECT COALESCE(jsonb_agg(
                        CASE WHEN elem ->> 'wamid' = 'mr-1'
                             THEN elem || jsonb_build_object(
                                 'status',    to_jsonb('READ'::text),
                                 'status_at', to_jsonb('2026-09-04T12:00:00+00:00'::text),
                                 'error',
                                     CASE WHEN NULL::text IS NULL THEN 'null'::jsonb ELSE to_jsonb(NULL::text) END
                             )
                             ELSE elem END
                        ORDER BY ord
                    ), '[]'::jsonb)
                    FROM jsonb_array_elements(
                        CASE WHEN jsonb_typeof(whatsapp_notifications -> 'JOB_MONEY_RECEIPT' -> 'attempts') = 'array'
                             THEN whatsapp_notifications -> 'JOB_MONEY_RECEIPT' -> 'attempts'
                             ELSE '[]'::jsonb END
                    ) WITH ORDINALITY AS t(elem, ord)
                ),
                true
            ),
            true
        )) FROM job;
