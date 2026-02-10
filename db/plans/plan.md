# Plan: Execute tran.md - Job Type Status Mapping Table

## Objective
Create a third table that maps valid transitions/outcomes between job_type and job_status_type tables for the electronic gadgets repair shop system.

---

## Step 1: Define IDs for job_status_type Table
Assign numeric IDs to all 24 status values:
- 1: UNTOUCHED
- 2: ESTIMATED
- 3: APPROVED
- 4: NOT_APPROVED
- 5: SENT_TO_COMPANY
- 6: RECEIVED_READY_FROM_COMPANY
- 7: RECEIVED_RETURN_FROM_COMPANY
- 8: WAITING_FOR_PARTS
- 9: IN_REPAIR
- 10: READY_STOCK
- 11: RETURN_STOCK
- 12: DELIVERED
- 13: CANCELLED
- 14: DISPOSED
- 15: FOR_DISPOSAL
- 16: DEMO_REQUESTED
- 17: DEMO_COMPLETED
- 18: HOME_SERVICE_REQUESTED
- 19: HOME_SERVICE_ATTENDED
- 20: HOME_SERVICE_WAITING_FOR_PARTS
- 21: HOME_SERVICE_COMPLETED
- 22: INSTALLATION_REQUESTED
- 23: INSTALLATION_COMPLETED

---

## Step 2: Define IDs for job_type Table
Assign numeric IDs to job types (removing duplicates from tran.md):
- 1: IN_WARRANTY_WORKSHOP
- 2: DEMO
- 3: CHARGABLE_REPAIRS
- 4: ESTIMATE
- 5: REPLACEMENT
- 6: REPEAT_REPAIRS
- 7: IN_WARRANTY_HOME_SERVICE
- 8: CHARGABLE_HOME_SERVICE
- 9: SERVICE_CONTRACT

---

## Step 3: Design the Third Mapping Table
Create table `job_type_status_transition` with structure:
- `id` - INT PRIMARY KEY AUTO_INCREMENT
- `job_type_id` - INT (FK to job_type.id)
- `current_status_id` - INT (FK to job_status_type.id)
- `next_status_id` - INT (FK to job_status_type.id)
- `created_at` - TIMESTAMP
- `updated_at` - TIMESTAMP

---

## Step 4: Define Valid Status Transitions for Each Job Type
Map allowed transitions for each job_type:
- DEMO: DEMO_REQUESTED -> DEMO_COMPLETED or CANCELLED
- IN_WARRANTY_WORKSHOP: UNTOUCHED -> ESTIMATED -> APPROVED/NOT_APPROVED -> IN_REPAIR -> READY_STOCK -> DELIVERED
- CHARGABLE_REPAIRS: Similar workshop flow
- HOME_SERVICE types: HOME_SERVICE_REQUESTED -> HOME_SERVICE_ATTENDED -> HOME_SERVICE_COMPLETED or CANCELLED
- And so on for all job types

---

## Step 5: Generate Seed Data SQL Scripts
Create INSERT statements for:
1. job_status_type table with all 23 statuses and IDs
2. job_type table with all 9 types and IDs
3. job_type_status_transition table with all valid mappings

---

## Step 6: Document the Design
- Add table schema to db design.md
- Include relationship diagram explanation
- Document business rules for transitions
