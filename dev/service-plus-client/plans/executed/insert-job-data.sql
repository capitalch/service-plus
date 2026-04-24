-- ─────────────────────────────────────────────────────────────────────────────
-- Test data: 300 job rows for branch_id = 2
-- job_no runs 1..300 (must not conflict with existing rows for branch_id = 2)
-- Run inside the relevant business-unit schema, e.g.:
--   SET search_path = <schema>, public;
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO job (
    job_no,
    job_date,
    customer_contact_id,
    branch_id,
    technician_id,
    job_status_id,
    job_type_id,
    job_receive_manner_id,
    job_receive_condition_id,
    product_brand_model_id,
    serial_no,
    problem_reported,
    diagnosis,
    work_done,
    remarks,
    amount,
    delivery_date,
    is_closed,
    is_final,
    address_snapshot,
    last_transaction_id,
    quantity,
    batch_no
)
SELECT
    n::text                                                                       AS job_no,
    CURRENT_DATE - (floor(random() * 60))::int                                   AS job_date,
    (floor(random() * 100) + 1)::bigint                                          AS customer_contact_id,
    2                                                                             AS branch_id,
    NULL::bigint                                                                  AS technician_id,
    1                                                                             AS job_status_id,
    (floor(random() * 10) + 1)::smallint                                         AS job_type_id,
    (floor(random() * 8)  + 1)::smallint                                         AS job_receive_manner_id,
    (floor(random() * 10) + 1)::smallint                                         AS job_receive_condition_id,
    (floor(random() * 500) + 1)::bigint                                          AS product_brand_model_id,
    upper(substring(md5(random()::text || n::text),
                    1, (floor(random() * 12) + 9)::int))                         AS serial_no,
    (p.arr)[(floor(random() * 30) + 1)::int]                                     AS problem_reported,
    NULL                                                                          AS diagnosis,
    NULL                                                                          AS work_done,
    'Created test data'                                                           AS remarks,
    0.00                                                                          AS amount,
    NULL::date                                                                    AS delivery_date,
    false                                                                         AS is_closed,
    false                                                                         AS is_final,
    (a.arr)[(floor(random() * 30) + 1)::int]                                     AS address_snapshot,
    NULL::bigint                                                                  AS last_transaction_id,
    1                                                                             AS quantity,
    0                                                                             AS batch_no

FROM generate_series(1, 300) AS n

CROSS JOIN (
    SELECT ARRAY[
        'Phone not turning on after drop',
        'Screen blank, only backlight visible',
        'Touchscreen unresponsive to all input',
        'Battery draining completely within 1–2 hours',
        'Device overheating during normal use',
        'Charging port not working, cable not detected',
        'WiFi keeps disconnecting every few minutes',
        'Camera app not opening, shows black screen',
        'No sound from speaker, microphone also not working',
        'Laptop keyboard partially not responding',
        'Laptop stuck on boot screen, will not start Windows',
        'Water damage, device not switching on at all',
        'Display flickering with horizontal lines on screen',
        'Device restarting randomly without warning',
        'Bluetooth not pairing with any device',
        'Phone stuck in headphone mode, no speaker sound',
        'Home button not working, stuck or unresponsive',
        'Power button stuck, not registering press',
        'SIM card not being detected by device',
        'Mobile data not working even with full signal',
        'Fingerprint sensor not recognising registered fingers',
        'Front camera cracked after fall, images blurry',
        'Screen shattered after drop, touch non-functional',
        'TV showing no signal on all channels',
        'AC running but not cooling the room',
        'Washing machine drum not spinning during cycle',
        'Refrigerator not cooling, making loud compressor noise',
        'Printer showing offline, not responding to print jobs',
        'Tablet screen has dead pixels and touch drift',
        'Earphones wire broken on one side, no audio'
    ] AS arr
) p

CROSS JOIN (
    SELECT ARRAY[
        '23, Park Street, Kolkata, West Bengal 700016',
        '7, Lake Road, Kolkata, West Bengal 700029',
        '14, Salt Lake Sector V, Kolkata, West Bengal 700091',
        '3, Gariahat Road, Kolkata, West Bengal 700019',
        '88, Rashbehari Avenue, Kolkata, West Bengal 700026',
        '56, Shyambazar Street, Kolkata, West Bengal 700004',
        '12, Ballygunge Circular Road, Kolkata, West Bengal 700019',
        '45, Dumdum Road, Kolkata, West Bengal 700028',
        '9, Howrah Station Road, Howrah, West Bengal 711101',
        '33, GT Road, Howrah, West Bengal 711102',
        '17, Salkia, Howrah, West Bengal 711106',
        '5, Serampore Station Road, Serampore, West Bengal 712201',
        '22, GT Road, Burdwan, West Bengal 713101',
        '41, Asansol Court Road, Asansol, West Bengal 713301',
        '8, Rambandhu Talab, Durgapur, West Bengal 713201',
        '19, Siliguri Station Road, Siliguri, West Bengal 734001',
        '6, Pradhan Nagar, Siliguri, West Bengal 734003',
        '30, Matigara, Siliguri, West Bengal 734010',
        '11, Krishnanagar Station Road, Krishnanagar, West Bengal 741101',
        '27, Barasat, North 24 Parganas, West Bengal 700124',
        '4, Basirhat Road, Basirhat, West Bengal 743411',
        '62, Diamond Harbour Road, South 24 Parganas, West Bengal 700063',
        '15, Baruipur, South 24 Parganas, West Bengal 700144',
        '38, Tamluk Road, Tamluk, West Bengal 721636',
        '2, Kharagpur Station Road, Kharagpur, West Bengal 721301',
        '50, Midnapore Town, Paschim Medinipur, West Bengal 721101',
        '18, Haldia Dock Road, Haldia, West Bengal 721607',
        '73, Baharampur Court Road, Baharampur, West Bengal 742101',
        '29, Malda Town, Malda, West Bengal 732101',
        '44, Cooch Behar Station Road, Cooch Behar, West Bengal 736101'
    ] AS arr
) a;
