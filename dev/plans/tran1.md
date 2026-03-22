# Plan: Execute tran.md — Create & Run Seed Data File

## Objective
Create a SQL seed data file for the BU schema (`demo1`) and insert all reference/lookup table data defined in `plans/tran.md`.

---

## Workflow

```
plans/tran.md (data definitions)
        │
        ▼
Step 1: Create seed SQL file
        service-plus-server/app/db/seed_demo1.sql
        │
        ▼
Step 2: Validate column mapping against db-schema-service.ts
        │
        ▼
Step 3: Run seed SQL against demo1 schema in service_plus_service DB
        │
        ▼
Result: All lookup tables populated with reference data
```

---

## Step 1 — Create `service-plus-server/app/db/seed_demo1.sql`

Create the file with `INSERT ... ON CONFLICT DO NOTHING` for idempotency.
All inserts target the `demo1` schema.

### Table: `customer_type`
Columns: `id, code, name`
```sql
INSERT INTO demo1.customer_type (id, code, name) VALUES
    (1, 'INDIVIDUAL',      'Individual Customer'),
    (2, 'CORPORATE',       'Corporate / Company'),
    (3, 'DEALER',          'Dealer / Retail Partner'),
    (4, 'SERVICE_PARTNER', 'Authorized Service Partner'),
    (5, 'INSTITUTION',     'Institution (School, Govt, NGO)'),
    (6, 'MARKETPLACE',     'Online Marketplace Customer'),
    (7, 'MISCELLANEOUS',   'Miscellaneous')
ON CONFLICT (id) DO NOTHING;
```

### Table: `document_type`
Columns: `id, code, prefix, name, description`
```sql
INSERT INTO demo1.document_type (id, code, prefix, name, description) VALUES
    (1, 'JOB_SHEET',              'JS',  'Job Sheet',              'Service job intake and tracking document'),
    (2, 'SERVICE_INVOICE',        'SI',  'Service Invoice',        'Service invoice issued to customer'),
    (3, 'MONEY_RECEIPT',          'MR',  'Money Receipt',          'Receipt issued against payment received from customer'),
    (4, 'SALES_INVOICE',          'SAL', 'Sales Invoice',          'Sales invoice issued to customer'),
    (5, 'PURCHASE_INVOICE',       'PI',  'Purchase Invoice',       'Purchase invoice from supplier'),
    (6, 'SALES_RETURN_INVOICE',   'SRI', 'Sales Return Invoice',   'Sales return invoice issued to customer'),
    (7, 'PURCHASE_RETURN_INVOICE','PRI', 'Purchase Return Invoice','Purchase return invoice issued to supplier'),
    (8, 'SERVICE_RETURN_INVOICE', 'SVI', 'Service Return Invoice', 'Service return invoice issued to customer')
ON CONFLICT (id) DO NOTHING;
```

### Table: `job_delivery_manner`
Columns: `id, code, name, description`
```sql
INSERT INTO demo1.job_delivery_manner (id, code, name, description) VALUES
    (1, 'SELF',           'Self',           'Customer picked up the item themselves'),
    (2, 'HOME_DELIVERY',  'Home Delivery',  'Item delivered to customer''s home'),
    (3, 'COURIER',        'Courier',        'Item sent via courier or shipping service'),
    (4, 'POST',           'Post',           'Item sent via post'),
    (5, 'OTHER',          'Other',          'Other delivery method'),
    (6, 'NOT_APPLICABLE', 'Not Applicable', 'Not applicable')
ON CONFLICT (id) DO NOTHING;
```

### Table: `job_receive_condition`
Columns: `id, code, name, description`
```sql
INSERT INTO demo1.job_receive_condition (id, code, name, description) VALUES
    (1,  'DEAD',           'Dead',                      'Item is completely dead'),
    (2,  'NOT_WORKING',    'Not Working',               'Item is completely non-functional at the time of receipt'),
    (3,  'PARTIAL_WORKING','Partially Working',         'Item is working but with reported issues or faults'),
    (4,  'DAMAGED',        'Damaged',                   'Item has visible physical damage affecting usability'),
    (5,  'MINOR_DAMAGE',   'Minor Damage',              'Item has minor scratches, dents, or cosmetic issues'),
    (6,  'MISSING_PARTS',  'Missing Parts / Accessories','Some parts or accessories are missing'),
    (7,  'WATER_DAMAGE',   'Water Damaged',             'Item shows signs of liquid damage'),
    (8,  'BURNT',          'Burnt / Electrical Damage', 'Item has electrical damage'),
    (9,  'PHYSICAL_BREAK', 'Physically Broken',         'Item is broken'),
    (10, 'UNKNOWN',        'Condition Unknown',         'Condition not verified')
ON CONFLICT (id) DO NOTHING;
```

### Table: `job_receive_manner`
Columns: `id, code, name`
```sql
INSERT INTO demo1.job_receive_manner (id, code, name) VALUES
    (1, 'WALKIN', 'Walk-in (Customer Visit)'),
    (2, 'PICKUP', 'Home Pickup'),
    (3, 'ONLINE', 'Online Booking'),
    (4, 'PHONE',  'Phone Booking'),
    (5, 'COURIER','Received via Courier'),
    (6, 'AMC',    'AMC / Contract Service'),
    (7, 'POST',   'Received via Postal Service'),
    (8, 'OTHER',  'Other')
ON CONFLICT (id) DO NOTHING;
```

### Table: `job_status`
Columns: `id, code, name, description, display_order` (`display_order` is required)
```sql
INSERT INTO demo1.job_status (id, code, name, description, display_order) VALUES
    (1,  'RECEIVED',         'Received',         'Item received',                  1),
    (2,  'ASSIGNED',         'Assigned',         'Assigned to technician',         2),
    (3,  'ESTIMATED',        'Estimated',        'Cost estimation is done',        3),
    (4,  'ESTIMATE_APPROVED','Estimate Approved', 'Customer approved estimate',    4),
    (5,  'ESTIMATE_REJECTED','Estimate Rejected', 'Customer rejected estimate',    5),
    (6,  'IN_PROGRESS',      'In Progress',       'Work in progress',              6),
    (7,  'PARTS_PENDING',    'Parts Pending',     'Waiting for parts',             7),
    (8,  'ON_HOLD',          'On Hold',           'Temporarily paused',            8),
    (9,  'OUTSOURCED',       'Outsourced',        'Sent to vendor',                9),
    (10, 'SENT_TO_COMPANY',  'Sent to Company',   'Sent to company',              10),
    (11, 'COMPLETED_OK',     'Completed OK',      'Work completed',               11),
    (12, 'RETURN',           'Return',            'Ready to return',              12),
    (13, 'DELIVERED_OK',     'Delivered OK',      'Delivered successfully',       13),
    (14, 'DELIVERED_NOT_OK', 'Delivered Not OK',  'Delivered but issue remains',  14),
    (15, 'CANCELLED',        'Cancelled',         'Job cancelled',                15),
    (16, 'DISPOSED',         'Disposed',          'Item disposed',                16)
ON CONFLICT (id) DO NOTHING;
```

### Table: `job_type`
Columns: `id, code, name, description`
```sql
INSERT INTO demo1.job_type (id, code, name, description) VALUES
    (1,  'MAKE_READY',    'Make Ready',    'Make item ready'),
    (2,  'ESTIMATE',      'Estimate',      'Estimate for repair'),
    (3,  'UNDER_WARRANTY','Under Warranty','Warranty service'),
    (4,  'INSTALLATION',  'Installation',  'Installing product'),
    (5,  'DEMO',          'Demo',          'Product demo'),
    (6,  'MAINTENANCE',   'Maintenance',   'Preventive maintenance'),
    (7,  'INSPECTION',    'Inspection',    'Diagnosis only'),
    (8,  'AMC_SERVICE',   'AMC Service',   'AMC service'),
    (9,  'UPGRADE',       'Upgrade',       'Upgrade components'),
    (10, 'REFURBISH',     'Refurbishment', 'Restore item')
ON CONFLICT (id) DO NOTHING;
```

### Table: `stock_transaction_type`
Columns: `id, code, name, dr_cr, description`
```sql
INSERT INTO demo1.stock_transaction_type (id, code, name, dr_cr, description) VALUES
    (1,  'CONSUMPTION',    'Consumption',    'C', 'Consumed'),
    (2,  'PURCHASE',       'Purchase',       'D', 'Stock received'),
    (3,  'SALES',          'Sales',          'C', 'Stock sold'),
    (4,  'SALES_RETURN',   'Sales Return',   'D', 'Customer return'),
    (5,  'PURCHASE_RETURN','Purchase Return','C', 'Return to supplier'),
    (6,  'OPENING',        'Opening Stock',  'D', 'Opening stock'),
    (7,  'ADJUSTMENT_IN',  'Adjustment In',  'D', 'Increase'),
    (8,  'ADJUSTMENT_OUT', 'Adjustment Out', 'C', 'Decrease'),
    (9,  'LOAN_IN',        'Loan In',        'D', 'Received loan'),
    (10, 'LOAN_OUT',       'Loan Out',       'C', 'Given loan')
ON CONFLICT (id) DO NOTHING;
```

### Table: `state`
Columns: `id, code, name, country_code, gst_state_code, is_union_territory`
```sql
INSERT INTO demo1.state (id, code, name, country_code, gst_state_code, is_union_territory) VALUES
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
```

---

## Step 2 — Column Mapping Validation

| Table | Required columns | Notes |
|-------|-----------------|-------|
| `customer_type` | id, code, name | — |
| `document_type` | id, code, prefix, name | prefix sourced from tran.md |
| `job_delivery_manner` | id, code, name | description optional, included |
| `job_receive_condition` | id, code, name | description optional, included |
| `job_receive_manner` | id, code, name | — |
| `job_status` | id, code, name, display_order | display_order = sequential id |
| `job_type` | id, code, name | description optional, included |
| `stock_transaction_type` | id, code, name, dr_cr | C=Credit (out), D=Debit (in) |
| `state` | id, code, name | country_code defaults to 'IN', is_union_territory per data |

---

## Step 3 — Run the Seed File

```bash
psql -U webadmin -d service_plus_service -f service-plus-server/app/db/seed_demo1.sql
```

Verify row counts after run:
```sql
SELECT 'customer_type'        AS tbl, COUNT(*) FROM demo1.customer_type        UNION ALL
SELECT 'document_type',              COUNT(*) FROM demo1.document_type              UNION ALL
SELECT 'job_delivery_manner',        COUNT(*) FROM demo1.job_delivery_manner        UNION ALL
SELECT 'job_receive_condition',      COUNT(*) FROM demo1.job_receive_condition      UNION ALL
SELECT 'job_receive_manner',         COUNT(*) FROM demo1.job_receive_manner         UNION ALL
SELECT 'job_status',                 COUNT(*) FROM demo1.job_status                 UNION ALL
SELECT 'job_type',                   COUNT(*) FROM demo1.job_type                   UNION ALL
SELECT 'stock_transaction_type',     COUNT(*) FROM demo1.stock_transaction_type     UNION ALL
SELECT 'state',                      COUNT(*) FROM demo1.state;
```

Expected counts: 7, 8, 6, 10, 8, 16, 10, 10, 36.
