"""
BU-schema seed data. Hand-maintained — not touched by the extractor.
All INSERTs use ON CONFLICT DO NOTHING and are safe to re-run.
"""


class SeedBuData:
    """Seed SQL for a newly created (or re-seeded) BU schema."""

    BU_SEED_SQL = """
        INSERT INTO customer_type (id, code, name, is_system) VALUES
            (1, 'INDIVIDUAL',      'Individual Customer',              true),
            (2, 'CORPORATE',       'Corporate / Company',              true),
            (3, 'DEALER',          'Dealer / Retail Partner',          true),
            (4, 'SERVICE_PARTNER', 'Authorized Service Partner',       true),
            (5, 'INSTITUTION',     'Institution (School, Govt, NGO)',  true),
            (6, 'MARKETPLACE',     'Online Marketplace Customer',      true),
            (7, 'MISCELLANEOUS',   'Miscellaneous',                    true)
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO document_type (id, code, prefix, name, description, is_system) VALUES
            (1, 'JOB_SHEET',               null,  'Job Sheet',               'Service job intake and tracking document',              true),
            (2, 'SERVICE_INVOICE',         'SI',  'Service Invoice',         'Service invoice issued to customer',                    true),
            (3, 'MONEY_RECEIPT',           'MR',  'Money Receipt',           'Receipt issued against payment received from customer',  true),
            (4, 'SALES_INVOICE',           'SAL', 'Sales Invoice',           'Sales invoice issued to customer',                      true),
            (5, 'PURCHASE_INVOICE',        'PI',  'Purchase Invoice',        'Purchase invoice from supplier',                        true),
            (6, 'SALES_RETURN_INVOICE',    'SRI', 'Sales Return Invoice',    'Sales return invoice issued to customer',               true),
            (7, 'PURCHASE_RETURN_INVOICE', 'PRI', 'Purchase Return Invoice', 'Purchase return invoice issued to supplier',            true),
            (8, 'SERVICE_RETURN_INVOICE',  'SVI', 'Service Return Invoice',  'Service return invoice issued to customer',             true)
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO job_delivery_manner (id, code, name, is_system) VALUES
            (1, 'SELF',           'Self',           true),
            (2, 'HOME_DELIVERY',  'Home Delivery',  true),
            (3, 'COURIER',        'Courier',        true),
            (4, 'POST',           'Post',           true),
            (5, 'OTHER',          'Other',          true),
            (6, 'NOT_APPLICABLE', 'Not Applicable', true)
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO additional_charge (id, name, hsn_code) VALUES
            (1,'Labour Charge','998726'),
            (2,'Service Charge','998726'),
            (3,'Inspection Fee','998726'),
            (4,'Installation Charge','998726'),
            (5,'Travelling Charge','998726'),
            (6,'Courier Charge','998726'),
            (7,'Packing & Forwarding','998726'),
            (8,'Calibration Fee','998726'),
            (9,'Emergency Service Charge','998726'),
            (10,'AMC Visit Charge','998726'),
            (11,'Software Installation','998726'),
            (12,'Data Recovery Charge','998726'),
            (13,'Handling Charge','998726'),
            (14,'Miscellaneous','998726'),
            (15,'Diagnosis Charge','998726'),
            (16,'Spare Parts','998726'),
            (17,'Transportation Charge','998726'),
            (18,'Repairing Cost','998726')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO job_receive_condition (id, code, name, description, is_system, display_order) VALUES
            (1,  'DEAD',           'Dead',                        'Item is completely dead',                                           true, 1),
            (2,  'NOT_WORKING',    'Not Working',                 'Item is completely non-functional at the time of receipt',          true, 2),
            (3,  'PARTIAL_WORKING','Partially Working',           'Item is working but with reported issues or faults',                true, 0),
            (4,  'DAMAGED',        'Damaged',                     'Item has visible physical damage affecting usability',             true, 3),
            (5,  'MINOR_DAMAGE',   'Minor Damage',                'Item has minor scratches, dents, or cosmetic issues',              true, 0),
            (6,  'MISSING_PARTS',  'Missing Parts / Accessories', 'Some parts or accessories are missing',                           true, 4),
            (7,  'WATER_DAMAGE',   'Water Damaged',               'Item shows signs of liquid damage',                               true, 5),
            (8,  'BURNT',          'Burnt / Electrical Damage',   'Item has electrical damage',                                      true, 6),
            (9,  'PHYSICAL_BREAK', 'Physically Broken',           'Item is broken',                                                  true, 7),
            (10, 'UNKNOWN',        'Condition Unknown',           'Condition not verified',                                          true, 0)
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO job_receive_manner (id, code, name, is_system, display_order) VALUES
            (1, 'WALKIN',       'Walk-in (Customer Visit)',  true, 1),
            (2, 'HOME_PICKUP',  'Home Pickup',              true, 2),
            (3, 'ONLINE',       'Online Booking',           true, 0),
            (4, 'PHONE',        'Phone Booking',            true, 0),
            (5, 'COURIER',      'Received via Courier',     true, 0),
            (6, 'AMC',          'AMC / Contract Service',   true, 0),
            (7, 'POST',         'Received via Postal Service', true, 0),
            (8, 'OTHER',        'Other',                    true, 0),
            (9, 'HOME_SERVICE', 'Home Service',             true, 0)
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO job_status (id, code, name, description, display_order) VALUES
            (1,  'RECEIVED',          'Received',         'Item received',               1),
            (2,  'ASSIGNED',          'Assigned',         'Assigned to technician',      2),
            (3,  'ESTIMATED',         'Estimated',        'Cost estimation is done',     4),
            (4,  'ESTIMATE_APPROVED', 'Estimate Approved','Customer approved estimate',  5),
            (5,  'ESTIMATE_REJECTED', 'Estimate Rejected','Customer rejected estimate',  6),
            (6,  'IN_PROGRESS',       'In Progress',      'Work in progress',            3),
            (7,  'PARTS_PENDING',     'Parts Pending',    'Waiting for parts',           7),
            (8,  'ON_HOLD',           'On Hold',          'Temporarily paused',          17),
            (9,  'OUTSOURCED',        'Outsourced',       'Sent to vendor',              12),
            (10, 'SENT_TO_COMPANY',   'Sent to Company',  'Sent to company',            8),
            (11, 'COMPLETED_OK',      'Completed OK',     'Work completed',             11),
            (12, 'RETURN',            'Return',           'Ready to return',            10),
            (13, 'DELIVERED_OK',      'Delivered OK',     'Delivered successfully',     15),
            (14, 'DELIVERED_NOT_OK',  'Delivered Not OK', 'Delivered but issue remains',16),
            (15, 'CANCELLED',         'Cancelled',        'Job cancelled',              13),
            (16, 'DISPOSED',          'Disposed',         'Item disposed',              14),
            (17, 'RECEIVED_BACK_FROM_COMPANY', 'Received Back From Company', 'Item received back from company', 9)
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO job_type (id, code, name, description, is_system, display_order) VALUES
            (1,  'MAKE_READY',     'Make Ready',    'Make item ready',          true, 1),
            (2,  'ESTIMATE',       'Estimate',      'Estimate for repair',      true, 2),
            (3,  'UNDER_WARRANTY', 'Under Warranty', 'Warranty service',        true, 3),
            (4,  'INSTALLATION',   'Installation',  'Installing product',       true, 0),
            (5,  'DEMO',           'Demo',          'Product demo',             true, 0),
            (6,  'MAINTENANCE',    'Maintenance',   'Preventive maintenance',   true, 0),
            (7,  'INSPECTION',     'Inspection',    'Diagnosis only',           true, 0),
            (8,  'AMC_SERVICE',    'AMC Service',   'AMC service',              true, 0),
            (9,  'UPGRADE',        'Upgrade',       'Upgrade components',       true, 0),
            (10, 'REFURBISH',      'Refurbishment', 'Restore item',             true, 0),
            (11, 'REPEAT_REPAIRS', 'Repeat Repairs', 'Repeat repairs',          true, 4)
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO stock_transaction_type (id, code, name, dr_cr, description, is_system) VALUES
            (1,  'CONSUMPTION',     'Consumption',    'C', 'Consumed',            true),
            (2,  'PURCHASE',        'Purchase',       'D', 'Stock received',      true),
            (3,  'SALES',           'Sales',          'C', 'Stock sold',          true),
            (4,  'SALES_RETURN',    'Sales Return',   'D', 'Customer return',     true),
            (5,  'PURCHASE_RETURN', 'Purchase Return','C', 'Return to supplier',  true),
            (6,  'OPENING',         'Opening Stock',  'D', 'Opening stock',       true),
            (7,  'ADJUSTMENT_IN',   'Adjustment In',  'D', 'Increase',            true),
            (8,  'ADJUSTMENT_OUT',  'Adjustment Out', 'C', 'Decrease',            true),
            (9,  'LOAN_IN',         'Loan In',        'D', 'Received loan',       true),
            (10, 'LOAN_OUT',        'Loan Out',       'C', 'Given loan',          true),
            (11, 'BRANCH_TRANSFER_IN',  'Branch Transfer In',   'D', 'Branch stock received',   true),
            (12, 'BRANCH_TRANSFER_OUT', 'Branch Transfer Out',  'C', 'Branch stock sent',       true),
            (13, 'WARRANTY_IN',             'Warranty In',              'D', 'Warranty In',            true),
            (14, 'WARRANTY_OUT',            'Warranty Out',             'C', 'Warranty Out',           true)
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO state (id, code, name, country_code, gst_state_code, is_union_territory) VALUES
            (1,  'AN', 'Andaman and Nicobar Islands',              'IN', '35', true),
            (2,  'AP', 'Andhra Pradesh',                           'IN', '37', false),
            (3,  'AR', 'Arunachal Pradesh',                        'IN', '12', false),
            (4,  'AS', 'Assam',                                    'IN', '18', false),
            (5,  'BR', 'Bihar',                                    'IN', '10', false),
            (6,  'CG', 'Chhattisgarh',                             'IN', '22', false),
            (7,  'GA', 'Goa',                                      'IN', '30', false),
            (8,  'GJ', 'Gujarat',                                  'IN', '24', false),
            (9,  'HR', 'Haryana',                                  'IN', '06', false),
            (10, 'HP', 'Himachal Pradesh',                         'IN', '02', false),
            (11, 'JH', 'Jharkhand',                                'IN', '20', false),
            (12, 'KA', 'Karnataka',                                'IN', '29', false),
            (13, 'KL', 'Kerala',                                   'IN', '32', false),
            (14, 'MP', 'Madhya Pradesh',                           'IN', '23', false),
            (15, 'MH', 'Maharashtra',                              'IN', '27', false),
            (16, 'MN', 'Manipur',                                  'IN', '14', false),
            (17, 'ML', 'Meghalaya',                                'IN', '17', false),
            (18, 'MZ', 'Mizoram',                                  'IN', '15', false),
            (19, 'NL', 'Nagaland',                                 'IN', '13', false),
            (20, 'OD', 'Odisha',                                   'IN', '21', false),
            (21, 'PB', 'Punjab',                                   'IN', '03', false),
            (22, 'RJ', 'Rajasthan',                                'IN', '08', false),
            (23, 'SK', 'Sikkim',                                   'IN', '11', false),
            (24, 'TN', 'Tamil Nadu',                               'IN', '33', false),
            (25, 'TS', 'Telangana',                                'IN', '36', false),
            (26, 'TR', 'Tripura',                                  'IN', '16', false),
            (27, 'UP', 'Uttar Pradesh',                            'IN', '09', false),
            (28, 'UK', 'Uttarakhand',                              'IN', '05', false),
            (29, 'WB', 'West Bengal',                              'IN', '19', false),
            (30, 'CH', 'Chandigarh',                               'IN', '04', true),
            (31, 'DN', 'Dadra and Nagar Haveli and Daman and Diu', 'IN', '26', true),
            (32, 'DL', 'Delhi',                                    'IN', '07', true),
            (33, 'JK', 'Jammu and Kashmir',                        'IN', '01', true),
            (34, 'LA', 'Ladakh',                                   'IN', '38', true),
            (35, 'LD', 'Lakshadweep',                              'IN', '31', true),
            (36, 'PY', 'Puducherry',                               'IN', '34', true)
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO branch (code, name, address_line1, state_id, pincode, is_head_office)
        SELECT 'HO', 'Head Office', '123 Main St', 29, '700001', true
        WHERE NOT EXISTS (SELECT 1 FROM branch WHERE code = 'HO');

        INSERT INTO financial_year (id, start_date, end_date) VALUES
            (2022, '2022-04-01', '2023-03-31'),
            (2023, '2023-04-01', '2024-03-31'),
            (2024, '2024-04-01', '2025-03-31'),
            (2025, '2025-04-01', '2026-03-31'),
            (2026, '2026-04-01', '2027-03-31'),
            (2027, '2027-04-01', '2028-03-31'),
            (2028, '2028-04-01', '2029-03-31'),
            (2029, '2029-04-01', '2030-03-31'),
            (2030, '2030-04-01', '2031-03-31'),
            (2031, '2031-04-01', '2032-03-31'),
            (2032, '2032-04-01', '2033-03-31'),
            (2033, '2033-04-01', '2034-03-31'),
            (2034, '2034-04-01', '2035-03-31'),
            (2035, '2035-04-01', '2036-03-31'),
            (2036, '2036-04-01', '2037-03-31'),
            (2037, '2037-04-01', '2038-03-31'),
            (2038, '2038-04-01', '2039-03-31'),
            (2039, '2039-04-01', '2040-03-31'),
            (2040, '2040-04-01', '2041-03-31'),
            (2041, '2041-04-01', '2042-03-31'),
            (2042, '2042-04-01', '2043-03-31'),
            (2043, '2043-04-01', '2044-03-31'),
            (2044, '2044-04-01', '2045-03-31'),
            (2045, '2045-04-01', '2046-03-31'),
            (2046, '2046-04-01', '2047-03-31'),
            (2047, '2047-04-01', '2048-03-31'),
            (2048, '2048-04-01', '2049-03-31'),
            (2049, '2049-04-01', '2050-03-31'),
            (2050, '2050-04-01', '2051-03-31'),
            (2051, '2051-04-01', '2052-03-31'),
            (2052, '2052-04-01', '2053-03-31'),
            (2053, '2053-04-01', '2054-03-31'),
            (2054, '2054-04-01', '2055-03-31'),
            (2055, '2055-04-01', '2056-03-31')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO app_setting (id, setting_key, setting_value, description, is_editable) VALUES
            (1, 'default_gst_rate',                          '18',    'Default GST rate (%%) applied to invoices',                                                       true),
            (2, 'show_parts_in_job_invoice',              '{"gst_rate":18,"hsn": 11236,"show": true,"text": "Overall repair cost"}',  'When showing parts in invoice, use a single combined line with this label and HSN code', true),
            (3, 'markup_percent_over_cost',                  '20',    'Default markup percent over cost price to get selling price',                                    true),
            (4, 'default_division_id',                       '1',     'Default division selected when creating a new job',                                              true),
            (5, 'default_hsn_for_spare_part',               '92099400',  'Default HSN code for Spare Part',                                                                true),
            (6, 'default_hsn_for_service_charge',           '998726',    'Default HSN code for labour charges, service charges etc.',                                      true),
            (7, 'no_of_job_sheets_per_print',               '2',         'The no of job sheets to be printed when print pdf',                                        true),
            (8, 'no_of_job_invoices_per_print',             '2',       'The no of job invoices to be printed when print pdf',                                          true),
            (9, 'post_data_to_accounts',             'true',       'Post purchase ,receipts, sale to Trace+ accounts',                                          true),
            (10, 'fiscal_year_start_month_num',             '4',       'Financial year start month number. e,g 4 for April,5 for May,1 for January',              true)
        ON CONFLICT (id) DO NOTHING;
    """
