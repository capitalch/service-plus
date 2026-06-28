// ─── Types ────────────────────────────────────────────────────────────────────

export type ContentBlock =
    | { type: "para";    text: string }
    | { type: "steps";   items: string[] }
    | { type: "bullets"; items: string[] }
    | { type: "table";   headers: string[]; rows: string[][] }
    | { type: "note";    text: string }
    | { type: "warning"; text: string }
    | { type: "heading"; text: string };

export type HelpFaq     = { q: string; a: string };
export type HelpArticle = {
    id:       string;
    category: string;
    title:    string;
    summary:  string;
    tags:     string[];
    content:  ContentBlock[];
    faqs:     HelpFaq[];
};

// ─── Articles ─────────────────────────────────────────────────────────────────

export const HELP_ARTICLES: HelpArticle[] = [

    // ── Category 1: Getting Started ──────────────────────────────────────────

    {
        id: "what-is-service-plus",
        category: "Getting Started",
        title: "What is Service+?",
        summary: "Overview of the platform and its main areas.",
        tags: ["overview", "intro", "modes", "dashboard"],
        content: [
            { type: "para", text: "Service+ is a repair shop and service center management platform. It covers the complete job lifecycle — from device intake through repair, invoicing, payment collection, and delivery to the customer." },
            { type: "heading", text: "Who uses it" },
            { type: "table", headers: ["Role", "Primary Activities"], rows: [
                ["Front-desk staff",  "Create jobs, add customers, record payments, deliver jobs"],
                ["Technicians",       "View assigned jobs, update job status"],
                ["Managers",          "Monitor reports, track overdue jobs, review revenue"],
                ["Business Admins",   "Manage users, view audit logs, configure the system"],
            ]},
            { type: "heading", text: "Three operating modes" },
            { type: "bullets", items: [
                "Client Mode — day-to-day operations: jobs, inventory, reports, masters",
                "Admin Mode — user and business unit management (Type A users only)",
                "Super Admin — platform-level setup and client onboarding",
            ]},
            { type: "heading", text: "Main navigation areas" },
            { type: "table", headers: ["Section", "What you do there"], rows: [
                ["Jobs",           "Create, track, finalize, and deliver service jobs"],
                ["Inventory",      "Manage spare parts stock — purchases, sales, transfers"],
                ["Reports",        "Analytics: revenue, job pipeline, technician performance, GST"],
                ["Masters",        "Reference data: customers, technicians, parts, brands, models"],
                ["Configurations", "Divisions, document sequences, app settings, GST setup"],
                ["Admin",          "Post/unpost transactions to the accounting system"],
            ]},
        ],
        faqs: [
            { q: "What is a Division?", a: "A Division is your billing entity — it holds your business name, address, and GSTIN. It determines whether invoices are GST or non-GST. Every job and invoice is linked to a division." },
            { q: "What is a Branch?", a: "A Branch is a physical service center location. All jobs, inventory, and technicians are scoped to a branch. You can have multiple branches." },
            { q: "Can I switch between modes?", a: "Yes. Type A (Business Admin) users can switch between Client Mode and Admin Mode from the top-right menu." },
        ],
    },

    {
        id: "first-time-setup",
        category: "Getting Started",
        title: "First-Time Setup Checklist",
        summary: "Step-by-step guide to go from zero to your first job.",
        tags: ["setup", "onboarding", "configuration", "document sequence", "division", "getting started"],
        content: [
            { type: "para", text: "Complete these steps in order before creating your first job. Skipping steps — especially document sequences — will cause errors later." },
            { type: "steps", items: [
                "Create a Branch (Masters → Branch). At least one branch is required.",
                "Create a Division (Configurations → Divisions). Fill GSTIN for a GST division; leave GSTIN blank for non-GST.",
                "Configure Document Sequences (Configurations → Document Sequence). Set a prefix for JOB_SHEET, SERVICE_INVOICE, and MONEY_RECEIPT. Without these, jobs and invoices cannot be created.",
                "Set App Settings (Configurations → App Settings): default GST rate, default HSN codes, number of print copies.",
                "Add lookup values: Job Types, Job Statuses, Receive/Delivery Manners, Receive Conditions (Masters → Service Configuration).",
                "Add Brands, Products, and Models (Masters → Brand / Product / Model). Jobs require all three.",
                "Add Spare Parts with Cost Price, HSN code, and GST Rate (Masters → Parts).",
                "Add Customers and Technicians (Masters → Customer and Technician).",
                "Add Opening Stock if inventory already exists before the system goes live (Inventory → Opening Stock).",
                "Optionally: enter historical jobs as Opening Jobs (Jobs → Opening Jobs).",
            ]},
            { type: "warning", text: "If you skip Document Sequence setup, you will see the error: 'Document sequence not configured' when trying to create a job or invoice. Go to Configurations → Document Sequence and add a prefix to resolve it." },
        ],
        faqs: [
            { q: "Why can't I create a new job?", a: "The most common cause is a missing Document Sequence. Go to Configurations → Document Sequence, find JOB_SHEET, and set a prefix (e.g., 'SVC')." },
            { q: "Do I need to create the customer before the job?", a: "Yes. Search for an existing customer on the job form. If they are new, add them in Masters → Customer first." },
            { q: "Can I have multiple divisions?", a: "Yes. Create one division per billing entity (e.g., one GST and one non-GST, or divisions for different states)." },
            { q: "What is Opening Stock?", a: "Opening Stock records the parts inventory you already have before starting to use Service+. Go to Inventory → Opening Stock and enter each part with its quantity." },
        ],
    },

    {
        id: "dashboard",
        category: "Getting Started",
        title: "Understanding the Dashboard",
        summary: "KPI cards, charts, recent jobs, and overdue alerts explained.",
        tags: ["dashboard", "kpi", "overdue", "revenue", "chart", "metrics"],
        content: [
            { type: "heading", text: "KPI Cards" },
            { type: "table", headers: ["Card", "What it counts"], rows: [
                ["Jobs Received Today",  "New jobs created today; split shows warranty vs out-of-warranty"],
                ["Jobs Delivered Today", "Jobs closed (delivered) today"],
                ["Revenue Today",        "Total invoice amounts from jobs delivered today"],
                ["Open Jobs",            "Jobs not yet closed — all pending work"],
                ["Overdue Jobs",         "Jobs open more than 7 days from creation date"],
                ["Warranty Jobs (Today)", "Jobs with UNDER_WARRANTY type received today"],
                ["Out-of-Warranty (Today)", "Chargeable (non-warranty) jobs received today"],
            ]},
            { type: "heading", text: "Monthly Intake Chart" },
            { type: "para", text: "Shows the last 12 months of job intake. The bars are split into warranty vs out-of-warranty so you can see the mix trend over time." },
            { type: "heading", text: "Recent Jobs" },
            { type: "para", text: "The last 8 jobs in the system with their status, device, technician, and date. Status badges are color-coded: Blue = Received, Yellow = In Progress, Green = Completed/Delivered, Gray = On Hold." },
            { type: "heading", text: "Overdue Jobs Alert" },
            { type: "para", text: "The bottom panel lists jobs open more than 7 days. These require immediate attention. Click any row to open the full job detail. Rows older than 7 days are highlighted in red." },
            { type: "note", text: "Dashboard data is not auto-refreshed. Click the Refresh button to reload all KPIs and charts." },
        ],
        faqs: [
            { q: "Revenue Today shows ₹0 — why?", a: "Revenue counts invoice totals from jobs delivered today. If no deliveries have been made today, revenue is ₹0." },
            { q: "What counts as overdue?", a: "Any job that is not closed (not delivered or cancelled) and is more than 7 days old from its creation date." },
            { q: "Can I change the overdue threshold?", a: "The 7-day threshold is fixed in this version. Use Reports → Job Pipeline/Aging to see aging breakdowns with different time bands." },
        ],
    },

    // ── Category 2: Jobs ─────────────────────────────────────────────────────

    {
        id: "create-job",
        category: "Jobs",
        title: "Creating a New Job",
        summary: "All fields, validation rules, and how to save a new job.",
        tags: ["new job", "create job", "customer", "model", "division", "job type", "technician", "serial number"],
        content: [
            { type: "para", text: "Go to Jobs → New Job → Single Job. Fill the form and click Save. A job number is auto-assigned from the configured JOB_SHEET document sequence." },
            { type: "heading", text: "Required Fields" },
            { type: "table", headers: ["Field", "Notes"], rows: [
                ["Customer",      "Search by name or mobile. Must exist in Masters → Customer."],
                ["Job Date",      "Defaults to today. Can be backdated."],
                ["Job Type",      "Sets the workflow. UNDER_WARRANTY disables selling prices and sets final amount to ₹0."],
                ["Division",      "Determines GST or non-GST invoicing. Cannot change once a service invoice is created."],
                ["Receive Manner","How the device was received: Walk-in, Courier, Customer Drop, etc."],
                ["Brand / Product / Model", "All three levels required. Add missing entries in Masters first."],
                ["Quantity",      "Default 1. Use a higher number only for identical multiple units."],
            ]},
            { type: "heading", text: "Optional Fields" },
            { type: "table", headers: ["Field", "Notes"], rows: [
                ["Receive Condition", "Condition on arrival: Good, Damaged, Dead, Not Working, etc."],
                ["Serial No",        "Device serial number for future reference."],
                ["Alternate Job No", "External reference such as a customer's own tracking number or OEM job number."],
                ["Problem Reported", "Customer's description of the issue."],
                ["Warranty Card No", "Manufacturer warranty card reference if applicable."],
                ["GSTIN",            "Customer's GSTIN for B2B tax invoices. Auto-fills from the selected customer; edits are saved back to the customer. See 'Customer GSTIN on Jobs'."],
                ["Technician",       "Who will repair the device. Can be assigned or changed later."],
                ["Remarks",          "Internal notes."],
            ]},
            { type: "heading", text: "Available Actions after saving" },
            { type: "bullets", items: [
                "Print — generates a job sheet PDF (copies controlled by App Settings)",
                "Attach Files — upload images, documents, or receipts",
                "Edit — modify job details (blocked if job is finalized)",
                "Delete — remove the job (blocked if it has more than one transaction)",
            ]},
        ],
        faqs: [
            { q: "Can I change the Division after saving?", a: "Yes, until a service invoice is generated. Once an invoice exists for the job, division is locked. Delete the invoice first if you need to change it." },
            { q: "The model dropdown is empty — what do I do?", a: "Add the Brand, Product, and Model in Masters before creating the job. All three levels must exist." },
            { q: "Can one job cover multiple different devices?", a: "No. Create one job per device type. Use the Quantity field only for identical units of the same model." },
            { q: "Can I edit a finalized job?", a: "No. Jobs marked as Final are locked. Go to Final a Job → Finalized Jobs → click Undo to revert it (you must delete any existing invoice first)." },
            { q: "What is the difference between Receive Condition and Job Status?", a: "Receive Condition records the physical state of the device when it arrived (e.g., 'Damaged screen'). Job Status tracks where the job is in the repair workflow (e.g., In Progress, Completed)." },
        ],
    },

    {
        id: "job-lifecycle",
        category: "Jobs",
        title: "Job Lifecycle & Statuses",
        summary: "How jobs move from Received to Delivered and what each status means.",
        tags: ["job status", "lifecycle", "completed", "delivered", "on hold", "cancelled", "pipeline", "in progress"],
        content: [
            { type: "heading", text: "Status Flow" },
            { type: "bullets", items: [
                "RECEIVED → job created, work not yet started",
                "IN_PROGRESS → technician is actively working on the device",
                "COMPLETED_OK → work done, device is repaired and working",
                "COMPLETED_NOT_OK → work done, but device could not be fixed",
                "DELIVERED_OK → device returned to customer (was working)",
                "DELIVERED_NOT_OK → device returned to customer (still not fixed)",
                "ON_HOLD → work paused: awaiting parts, customer approval, or decision",
                "CANCELLED → job abandoned",
            ]},
            { type: "para", text: "To change a status: go to Job Pipeline, click the job card, and use Update Status. Delivered status is set automatically when you complete the Deliver Job workflow." },
            { type: "heading", text: "What determines if a job can be finalized?" },
            { type: "para", text: "Any job with status COMPLETED_OK or COMPLETED_NOT_OK appears in the Final a Job → Pending tab. You can finalize it there to add parts, charges, and set the invoice amount." },
            { type: "heading", text: "What determines if a job can be delivered?" },
            { type: "para", text: "A job must have been finalized (is_final = true) and have status COMPLETED_OK or COMPLETED_NOT_OK. It then appears in the Deliver Job screen." },
        ],
        faqs: [
            { q: "How do I reopen a delivered job?", a: "Go to Final a Job → Finalized Jobs tab → click Undo on the job row. This moves the job back to Pending. Any existing service invoice must be deleted before undoing." },
            { q: "Can a cancelled job be reopened?", a: "Yes — change the status back to RECEIVED or IN_PROGRESS using Update Status in Job Pipeline." },
            { q: "Where do I see all overdue jobs?", a: "Dashboard → Overdue Jobs panel shows jobs open more than 7 days. For detailed aging, use Reports → Job Pipeline / Aging." },
            { q: "Can two technicians work on the same job?", a: "Only one technician is assigned at a time. Re-assign as needed by editing the job. The most recently assigned technician is shown." },
            { q: "What happens to a job with COMPLETED_NOT_OK after delivery?", a: "It becomes DELIVERED_NOT_OK. An invoice can still be raised for diagnostic or inspection charges." },
        ],
    },

    {
        id: "batch-jobs",
        category: "Jobs",
        title: "Batch Jobs",
        summary: "Group multiple jobs from the same customer under one batch number.",
        tags: ["batch", "bulk jobs", "courier", "batch sheet"],
        content: [
            { type: "para", text: "A Batch groups multiple jobs from the same customer under one batch number. This is useful for courier deliveries, warranty returns, or when a customer brings in multiple devices at once." },
            { type: "steps", items: [
                "Go to Jobs → New Job → Batch Jobs.",
                "Select the customer and fill the batch-level details.",
                "Add individual jobs within the batch — each with its own model, problem, and technician.",
                "Save the batch. A batch number is auto-assigned.",
                "Print the batch sheet for the customer.",
            ]},
            { type: "note", text: "Finalization and delivery still happen per individual job. A batch is just a grouping — it does not change the job workflow." },
            { type: "para", text: "The customer's GSTIN can be captured or edited on the batch form just like on a single job — it auto-fills from the selected customer and is saved back to the customer record. See 'Customer GSTIN on Jobs'." },
            { type: "heading", text: "Editing a batch job" },
            { type: "para", text: "If a job has a Batch No, it must be edited from Batch Jobs — not from Single Job. Find the batch and edit the individual job within it." },
        ],
        faqs: [
            { q: "Why can't I edit a job from Single Job?", a: "The job belongs to a batch. Open Batch Jobs, find the batch by batch number or customer, and edit the job there." },
            { q: "Can I add a new job to an existing batch?", a: "Yes — open the batch in Batch Jobs and add more job lines before saving." },
            { q: "Can I remove a job from a batch?", a: "Yes — edit the batch and delete the job line. The job will be removed from the batch." },
        ],
    },

    {
        id: "opening-jobs",
        category: "Jobs",
        title: "Opening Jobs",
        summary: "Enter historical jobs that existed before the system was set up.",
        tags: ["opening jobs", "migration", "historical", "existing jobs", "Z-prefix"],
        content: [
            { type: "para", text: "Opening Jobs are used to migrate jobs that existed before Service+ was set up. These give you a complete historical record without affecting the live job workflow." },
            { type: "steps", items: [
                "Go to Jobs → Opening Jobs → New.",
                "Enter a job number (the system auto-prefixes 'Z-' if not already present).",
                "Fill all relevant fields: customer, job type, status, amount (if any), delivery date if already delivered.",
                "Set Is Closed = true for jobs that are already complete at the time of entry.",
                "Optionally check Is Final if the job was already finalized before migration.",
                "Click Save.",
            ]},
            { type: "note", text: "Opening jobs can be finalized and delivered through the normal workflow if they are not yet closed. If you set Is Final on creation, the job appears directly in the Finalized Jobs tab." },
        ],
        faqs: [
            { q: "Why does my job number get 'Z-' added?", a: "Opening job numbers are auto-prefixed with 'Z-' to distinguish them from live system-generated jobs. This prevents number conflicts." },
            { q: "What is the difference between Opening Jobs and Single Job?", a: "Opening Jobs is for historical/migrated records only. Use Single Job for all new work going forward." },
            { q: "Can I finalize an opening job later?", a: "Yes — go to Final a Job, find the job in the pending list, and finalize it normally." },
            { q: "What date should I use for opening jobs?", a: "Use the original job creation date (the date the device was received in your old system). This keeps historical reports accurate." },
        ],
    },

    {
        id: "finalize-job",
        category: "Jobs",
        title: "Finalizing a Job (Parts & Charges)",
        summary: "Add parts used and service charges, set prices, and lock the job for invoicing.",
        tags: ["finalize", "final", "parts", "charges", "cost price", "selling price", "HSN", "GST", "back calculate", "reset", "warranty"],
        content: [
            { type: "para", text: "Finalization records which parts were used and what to charge the customer. Go to Jobs → Final a Job → find the job → click Finalize." },
            { type: "heading", text: "Adding Parts" },
            { type: "steps", items: [
                "Click '+ Add Part' to add a new row.",
                "Select the Brand, then type or search the Part Code. Prices, HSN, and GST rate auto-fill from the part master.",
                "Set the Quantity.",
                "Adjust Selling Price if needed. Sale Price + GST is calculated automatically.",
                "Repeat for each part used.",
            ]},
            { type: "heading", text: "Adding Service Charges" },
            { type: "steps", items: [
                "Click '+ Add Charge' to add a charge row.",
                "Select the Charge Name from the dropdown (e.g., Diagnostic Fee, Labour Charge).",
                "Enter Selling Price and Quantity.",
                "HSN and GST rate auto-fill if configured in the Additional Charges master.",
            ]},
            { type: "heading", text: "Pricing Fields Explained" },
            { type: "table", headers: ["Field", "Meaning"], rows: [
                ["Cost Price",       "What the part costs you (from master data; editable)"],
                ["Selling Price",    "What you charge the customer before GST"],
                ["Sale Price + GST", "Selling Price with GST added — this is the invoice amount"],
                ["Profit",           "Selling Price minus Cost Price per row"],
                ["Amount",           "(Sale Price + GST) × Quantity"],
            ]},
            { type: "heading", text: "Back Calculate" },
            { type: "para", text: "Enter a target total amount in the 'Target Amount' field (e.g., ₹1,500), then click Back Calculate. The system proportionally adjusts all selling prices to reach that total, respecting cost price as the minimum floor." },
            { type: "heading", text: "Reset Prices" },
            { type: "para", text: "Click Reset to reload all prices from the part master for the current division's GST mode. This recalculates without deleting any rows — useful if master prices were updated after the job was opened." },
            { type: "heading", text: "Warranty Jobs" },
            { type: "para", text: "If the job type is UNDER_WARRANTY, selling prices are fixed at ₹0 (grayed out). Only cost prices are recorded for internal tracking. The final amount is always ₹0." },
            { type: "heading", text: "GST Divisions" },
            { type: "para", text: "In a GST division, HSN code is mandatory on every part and charge row. Rows with a missing HSN show a red border and Save is blocked until all HSN codes are filled." },
            { type: "heading", text: "Customer GSTIN" },
            { type: "para", text: "The finalize form shows the customer's GSTIN, pre-filled from the customer record. You can edit it here for B2B tax invoices; the value is saved back to the customer. It is optional, but if you enter an invalid value, 'Save & Mark Final' is blocked until you correct or clear it. See 'Customer GSTIN on Jobs'." },
            { type: "warning", text: "Once you click 'Save & Mark Final', the job is locked. No further edits are possible without using the Undo function in the Finalized Jobs tab." },
        ],
        faqs: [
            { q: "What does Reset do?", a: "Recalculates all prices from the part master data using the current division's GST mode. No rows are deleted. Use it if master prices were changed after opening the job." },
            { q: "What is Back Calculate?", a: "You set a target total (e.g., ₹1,500) and the system scales all selling prices proportionally to reach that total. Cost price is the floor — no selling price will drop below cost." },
            { q: "What does 'Show Parts in Invoice' mean?", a: "Checked: the invoice lists each part and charge individually. Unchecked: all lines are merged into a single description on the invoice (using the master setting for description and HSN)." },
            { q: "What is Force IGST?", a: "For supplies to customers in a different state. Check this to apply the full GST rate as IGST (inter-state) instead of splitting into CGST + SGST." },
            { q: "HSN shows a red border — what do I do?", a: "Enter a valid HSN code (4, 6, or 8 digits) on that row. Alternatively, set a default HSN in App Settings so it auto-fills for all parts." },
            { q: "Why are selling prices greyed out?", a: "The job type is UNDER_WARRANTY. Selling prices are always ₹0 for warranty jobs." },
            { q: "I changed the division — why did prices change?", a: "Switching division recalculates prices for the new GST mode using master data. Switching back produces the same values as the original — no data is corrupted by toggling." },
            { q: "Can I add a part that isn't in the master?", a: "You can type a part name directly without selecting from the master. However, cost price and HSN will not auto-fill; you must enter them manually." },
            { q: "Why is 'Save & Mark Final' blocked with a GSTIN error?", a: "The customer GSTIN field has an invalid value. Fix it to a valid 15-character GSTIN or clear the field (blank is allowed). GSTIN is saved to the customer record. See 'Customer GSTIN on Jobs'." },
        ],
    },

    {
        id: "deliver-job",
        category: "Jobs",
        title: "Delivering a Job",
        summary: "4-step process: invoice creation, payment collection, delivery details, and closure.",
        tags: ["deliver", "delivery", "invoice", "receipt", "payment", "close", "IGST", "CGST", "SGST"],
        content: [
            { type: "para", text: "Go to Jobs → Deliver Job. Select one or more completed jobs and proceed through 4 steps." },
            { type: "heading", text: "Step 1 — Select Jobs" },
            { type: "para", text: "Choose completed jobs (COMPLETED_OK or COMPLETED_NOT_OK). The summary panel shows Total Amount, Received Amount, and Due Amount. Due shows in red if payment is outstanding." },
            { type: "note", text: "Each job in the list has an editable customer GSTIN field (pre-filled from that job's customer). It is optional, but an invalid value blocks 'Deliver & Close', and any edit is saved back to the customer. See 'Customer GSTIN on Jobs'." },
            { type: "heading", text: "Step 2 — Service Invoice" },
            { type: "para", text: "Click 'Create Invoices & Receipts' to auto-generate invoices for eligible jobs. A job is eligible if: it is COMPLETED, has no existing invoice, and the amount is > ₹0. Invoice numbers come from the SERVICE_INVOICE document sequence." },
            { type: "bullets", items: [
                "Print individual invoices using the print icon on each row.",
                "Delete an invoice using the trash icon (only if not posted to accounts).",
                "Regenerate an invoice (only if not posted) using the refresh icon.",
            ]},
            { type: "heading", text: "Step 3 — Money Receipts (Payments)" },
            { type: "para", text: "For each job with an outstanding balance, click 'Add Receipt'. Fill the amount, payment mode (Cash / Cheque / Transfer), date, and reference number. Due balance must reach ₹0 before delivery is allowed. Multiple receipts per job are permitted." },
            { type: "heading", text: "Step 4 — Delivery Details & Close" },
            { type: "steps", items: [
                "Select Delivery Manner (Hand Delivery, Courier, Customer Pickup, etc.).",
                "Set Delivery Date (defaults to today).",
                "Add optional Remarks.",
                "Click 'Deliver & Close'. All selected jobs are marked as delivered and closed.",
            ]},
            { type: "heading", text: "Print Options" },
            { type: "table", headers: ["Button", "Output"], rows: [
                ["Delivery Note PDF",        "A delivery slip listing all jobs being handed over"],
                ["Invoice + Receipt PDF",    "Combined PDF: all invoices + all receipts for the selected jobs"],
            ]},
        ],
        faqs: [
            { q: "'Deliver & Close' is greyed out — why?", a: "At least one of these conditions is not met: (a) Due balance is not ₹0 — add a receipt, (b) Delivery Manner is not selected, (c) Delivery Date is empty, (d) a customer GSTIN field holds an invalid value — correct or clear it." },
            { q: "Can I deliver multiple jobs at once?", a: "Yes. Select all completed jobs before proceeding. Invoices and receipts are created per job; all are delivered in one action." },
            { q: "Can I regenerate an invoice after it was posted to accounts?", a: "No. You must unpost it first from Admin → Post/Unpost, then regenerate from the Deliver Job screen." },
            { q: "The customer paid by cheque and it bounced — what do I do?", a: "Delete the cheque receipt entry, note the dishonour in job remarks, and add a new receipt when a replacement payment clears." },
            { q: "Can I deliver a job that was 'Not Fixed' (COMPLETED_NOT_OK)?", a: "Yes. It becomes DELIVERED_NOT_OK. You can still invoice for diagnostic or inspection charges." },
            { q: "What is 'Invoice + Receipt PDF'?", a: "A single combined PDF containing all invoices and all receipts for the selected jobs — useful to give the customer a complete record." },
        ],
    },

    {
        id: "printing-documents",
        category: "Jobs",
        title: "Printing & Documents",
        summary: "What documents can be printed and how to generate them.",
        tags: ["print", "PDF", "invoice", "receipt", "job sheet", "delivery note", "batch sheet"],
        content: [
            { type: "table", headers: ["Document", "How to Generate", "When"], rows: [
                ["Job Sheet",            "Single Job → Print button",                       "After creating or editing a job"],
                ["Service Invoice",      "Deliver Job → Step 2 → Print icon on invoice row","After generating the invoice"],
                ["Money Receipt",        "Deliver Job → Step 3 → Print icon on receipt row","After adding a payment"],
                ["Delivery Note",        "Deliver Job → 'Delivery Note PDF' button",        "At the delivery step"],
                ["Invoice + Receipt PDF","Deliver Job → 'Invoice + Receipt PDF' button",    "At the delivery step"],
                ["Batch Sheet",          "Batch Jobs → Print button",                       "After saving a batch"],
            ]},
            { type: "note", text: "Print copy count is controlled by App Settings: 'no_of_job_sheets_per_print' for job sheets and 'no_of_invoice_copies_per_print' for invoices." },
            { type: "heading", text: "PDF not opening?" },
            { type: "para", text: "If clicking a print button does nothing or the PDF doesn't appear, your browser may be blocking pop-ups. Allow pop-ups for this site in your browser settings, then try again." },
        ],
        faqs: [
            { q: "Can I print a job sheet after the job is delivered?", a: "Yes — open the job from Single Job or Job Pipeline (View Details) and click Print." },
            { q: "Can I reprint a receipt?", a: "Yes — go to Deliver Job, select the delivered job, open the receipts step, and print any existing receipt." },
            { q: "How do I change the number of invoice copies?", a: "Go to Configurations → App Settings and update 'no_of_invoice_copies_per_print'." },
        ],
    },

    // ── Category 3: Inventory ────────────────────────────────────────────────

    {
        id: "stock-overview",
        category: "Inventory",
        title: "Stock Overview",
        summary: "View current stock quantities and values per part.",
        tags: ["stock", "inventory", "parts", "quantity", "value", "overview"],
        content: [
            { type: "para", text: "Inventory → Stock Overview shows the current stock quantity and cost value for every part at the current branch." },
            { type: "heading", text: "What you can do" },
            { type: "bullets", items: [
                "Filter by Brand using the brand dropdown.",
                "Search by Part Name or Part Code.",
                "Sort any column by clicking its header (ascending/descending).",
                "Navigate pages — 50 items per page.",
            ]},
            { type: "note", text: "Stock Overview shows quantities only. For a complete movement history (what came in or went out and when), use Reports → Stock Ledger." },
        ],
        faqs: [
            { q: "Why doesn't my new part appear in Stock Overview?", a: "Parts appear only once they have stock — i.e., after a Purchase Entry, Opening Stock entry, or Branch Transfer receives them." },
            { q: "What does 'Stock Value' mean?", a: "Stock Value = Current Quantity × Cost Price per unit (as recorded in the part master)." },
            { q: "How do I see stock across all branches?", a: "Stock Overview is branch-scoped. To see another branch, switch to that branch from the branch switcher in the top nav." },
        ],
    },

    {
        id: "purchase-entry",
        category: "Inventory",
        title: "Purchase Entry",
        summary: "Record spare parts received from a supplier to increase stock.",
        tags: ["purchase", "supplier", "vendor", "invoice", "stock in", "HSN", "GST", "CGST", "SGST"],
        content: [
            { type: "para", text: "Go to Inventory → Purchase Entry → New Invoice to record parts received from a vendor." },
            { type: "steps", items: [
                "Select the Supplier from the dropdown.",
                "Select the Division (determines GST treatment).",
                "Enter the Vendor's Invoice Number and Invoice Date.",
                "Add line items: enter Part Code (auto-fills Name, UOM, HSN, Cost Price), Quantity, and Unit Price.",
                "In a GST division, verify the HSN code on each line (mandatory). CGST / SGST / IGST auto-calculate.",
                "Click Save. A Physical Invoice Verification dialog appears.",
                "Compare the system totals with your physical invoice. Confirm to save and increase stock.",
            ]},
            { type: "heading", text: "Duplicate Detection" },
            { type: "para", text: "The system checks for the same Supplier + Invoice Number + Invoice Date within the current financial year. If a match is found, the save is blocked with a duplicate warning." },
            { type: "heading", text: "After Saving" },
            { type: "bullets", items: [
                "Stock quantity is incremented at the current branch.",
                "Download Excel — exports all line items to XLSX.",
                "Generate PDF — prints the purchase invoice summary.",
                "Post to Accounts — transfers the entry to the accounting system (if enabled).",
            ]},
        ],
        faqs: [
            { q: "'Invoice already exists' error — what does it mean?", a: "A purchase entry with the same supplier + invoice number + date already exists in this financial year. Check for duplicate entry before saving again." },
            { q: "Can I edit a purchase invoice after posting to accounts?", a: "No. Unpost it first from Admin → Post/Unpost, then edit." },
            { q: "What is the Physical Invoice Verification step?", a: "The system asks you to enter the totals from your paper invoice and compares them against the system's calculated totals. This catches data-entry errors before stock is updated." },
            { q: "What if the part is not in the master?", a: "You can type a part name directly without a master entry. However, cost price, HSN, and UOM will not auto-fill; enter them manually. Consider adding the part to Masters → Parts for future use." },
        ],
    },

    {
        id: "sales-entry",
        category: "Inventory",
        title: "Sales Entry",
        summary: "Sell spare parts directly to customers — not linked to a service job.",
        tags: ["sales", "sell parts", "direct sale", "inventory out", "GST", "HSN"],
        content: [
            { type: "para", text: "Use Sales Entry when selling parts directly (counter sales) without a service job. Go to Inventory → Sales Entry → New Invoice." },
            { type: "steps", items: [
                "Select the Division (determines GST or non-GST treatment).",
                "Set the Invoice Date.",
                "Add line items: Part Code, Quantity, Unit Price (selling price).",
                "In a GST division, verify HSN on each taxable line. GST auto-calculates.",
                "Click Save. Stock is decremented.",
            ]},
            { type: "note", text: "Sales Entry reduces stock. If you need to record a part sale that is linked to a specific service job, use the Parts Used section in the job finalization instead." },
        ],
        faqs: [
            { q: "Can I edit a sales invoice after saving?", a: "Yes, if it is not yet posted to accounts. Unpost from Admin → Post/Unpost first if needed." },
            { q: "Can I export a sales invoice to Excel?", a: "Yes — open the invoice in View mode and click 'Download Excel'." },
            { q: "Does a sales entry create a money receipt?", a: "No. Sales Entry creates an inventory invoice only. Record the payment separately if you need a receipt trail." },
        ],
    },

    {
        id: "stock-transactions",
        category: "Inventory",
        title: "Stock Adjustments, Transfers & More",
        summary: "Adjust stock, transfer between branches, record loans, and set part locations.",
        tags: ["stock adjustment", "branch transfer", "loan entry", "opening stock", "part location", "set location"],
        content: [
            { type: "heading", text: "Stock Adjustment" },
            { type: "para", text: "Correct stock counts for damage, theft, obsolescence, or physical count discrepancies." },
            { type: "steps", items: [
                "Inventory → Stock Adjustment → New.",
                "Select Adjustment Date and Reason.",
                "Add parts with quantity changes: positive = adding stock, negative = removing stock.",
                "Save. This is a quantity-only correction with no financial posting.",
            ]},
            { type: "heading", text: "Branch Transfer" },
            { type: "para", text: "Move stock from the current branch to another location." },
            { type: "steps", items: [
                "Inventory → Branch Transfer → New.",
                "Select the Destination Branch and Transfer Date.",
                "Add parts and quantities to transfer.",
                "Save. Stock is immediately debited from source and credited to destination.",
            ]},
            { type: "heading", text: "Loan Entry" },
            { type: "para", text: "Record parts loaned to a customer or another party temporarily. When the part is returned, record a Loan Return to restore the stock." },
            { type: "heading", text: "Opening Stock" },
            { type: "para", text: "Enter initial inventory balances when setting up the system for the first time. Go to Inventory → Opening Stock. This uses the 'Opening Balance' stock transaction type." },
            { type: "heading", text: "Set Part Location" },
            { type: "para", text: "Assign warehouse bin or shelf codes to parts for physical organization. Go to Inventory → Set Part Location. Location codes are unique per branch." },
        ],
        faqs: [
            { q: "Does a branch transfer need approval from the receiving branch?", a: "No. The transfer is immediate on both sides — stock is debited from source and credited to destination in real time." },
            { q: "Can I cancel a branch transfer?", a: "Only if it has not been posted. Delete the transfer entry before posting to reverse it." },
            { q: "What is the difference between Opening Stock and Stock Adjustment?", a: "Opening Stock is for initial balances when first setting up. Stock Adjustment is for ongoing corrections to existing stock quantities." },
        ],
    },

    // ── Category 4: Masters ──────────────────────────────────────────────────

    {
        id: "customers",
        category: "Masters",
        title: "Managing Customers",
        summary: "Add, edit, and manage customer records including validation rules.",
        tags: ["customer", "mobile", "GSTIN", "address", "customer type", "contact"],
        content: [
            { type: "para", text: "Go to Masters → Customer to manage customer records." },
            { type: "heading", text: "Required Fields" },
            { type: "table", headers: ["Field", "Validation"], rows: [
                ["Full Name",      "Required, any text"],
                ["Mobile",         "Required, 10 digits, must start with 6, 7, 8, or 9"],
                ["Address Line 1", "Required"],
                ["State",          "Required, select from the state list"],
                ["Customer Type",  "Required, select from the type list (Retail, Corporate, Warranty, etc.)"],
            ]},
            { type: "heading", text: "Optional Fields" },
            { type: "table", headers: ["Field", "Notes"], rows: [
                ["Alternate Mobile", "Same 10-digit format as Mobile"],
                ["Email",            "Standard email format"],
                ["GSTIN",            "15-character India GST format — for B2B customers only. Can also be added or edited from the job screens; all stages share this same customer field."],
                ["Address Line 2",   "Any text"],
                ["City, Landmark",   "Any text"],
                ["Postal Code",      "6 digits, must start with 1–9"],
                ["Remarks",          "Internal notes"],
            ]},
        ],
        faqs: [
            { q: "Mobile number not accepted — why?", a: "Indian mobile numbers must be exactly 10 digits and start with 6, 7, 8, or 9 (numbers starting with 0, 1–5 are not valid mobile numbers)." },
            { q: "When should I fill the customer's GSTIN?", a: "Only for B2B customers who need GST tax invoices addressed to their company (with their GSTIN on the invoice). Leave blank for individual/retail customers." },
            { q: "Can I add a customer's GSTIN without coming to Masters?", a: "Yes. The GSTIN field also appears when creating, finalizing, and delivering a job. Editing it there updates this same customer record. See 'Customer GSTIN on Jobs'." },
            { q: "Can I delete a customer?", a: "Only if no jobs, invoices, or receipts reference that customer. The system will block deletion and show an error if the customer is in use." },
            { q: "Is customer data shared across branches?", a: "Yes. Customer records are global — the same customer can be used by any branch." },
        ],
    },

    {
        id: "technicians",
        category: "Masters",
        title: "Managing Technicians",
        summary: "Add and manage repair technicians, their codes, and branch assignment.",
        tags: ["technician", "code", "branch", "leaving date", "specialization"],
        content: [
            { type: "para", text: "Go to Masters → Technician to manage your repair staff." },
            { type: "heading", text: "Fields" },
            { type: "table", headers: ["Field", "Notes"], rows: [
                ["Branch",         "Required. Technicians are branch-scoped."],
                ["Code",           "Required. Unique per branch. Alphanumeric + underscore only. Max 20 characters. Auto-uppercased."],
                ["Name",           "Required. Min 2 characters."],
                ["Phone",          "Optional."],
                ["Email",          "Optional. Standard email format."],
                ["Specialization", "Optional. Free text (e.g., 'Mobile repair, AC service')."],
                ["Leaving Date",   "Optional. Set when a technician leaves instead of deleting them."],
            ]},
            { type: "note", text: "Technician Code uniqueness is checked in real time as you type. A checkmark means the code is available; a red indicator means it is already taken in this branch." },
        ],
        faqs: [
            { q: "Can two branches have the same technician code?", a: "Yes. Codes are unique only within a branch, not across the entire system." },
            { q: "How do I remove a technician who has left?", a: "Set their Leaving Date rather than deleting. If they are linked to past jobs, deletion is blocked anyway." },
            { q: "My technician code shows red — what do I do?", a: "That code is already in use by another technician in this branch. Choose a different code." },
            { q: "Can I assign a technician to multiple branches?", a: "No. Each technician record belongs to one branch. If the same person works at two branches, create a technician record in each." },
        ],
    },

    {
        id: "parts",
        category: "Masters",
        title: "Spare Parts Master",
        summary: "Add and manage spare parts, pricing, HSN codes, and bulk import.",
        tags: ["parts", "spare parts", "HSN", "GST rate", "cost price", "selling price", "UOM", "bulk import", "brand", "category"],
        content: [
            { type: "para", text: "Go to Masters → Parts to manage the spare parts catalog." },
            { type: "heading", text: "Key Fields" },
            { type: "table", headers: ["Field", "Notes"], rows: [
                ["Brand",         "Required. Determines which brand this part belongs to."],
                ["Part Code",     "Required. Unique across all parts. Auto-uppercased."],
                ["Part Name",     "Required. Descriptive name."],
                ["UOM",           "Required. Unit of Measure. Default 'NOS' (numbers). Others: KG, Litre, Set, Pair."],
                ["Cost Price",    "Optional. What the part costs you. Used for profit calculations."],
                ["Selling Price", "Optional. Default selling price. Used as baseline on job finalization."],
                ["MRP",           "Optional. Must be greater than Cost Price if both are set."],
                ["HSN Code",      "Optional but required for GST invoices. Must be exactly 4, 6, or 8 digits."],
                ["GST Rate",      "Optional, 0–60%. Used for tax calculations on invoices."],
            ]},
            { type: "heading", text: "Bulk Import" },
            { type: "para", text: "Parts master supports importing from CSV or XLSX files. Click 'Bulk Import', upload your file, map your column headers to system fields, and import. Useful for initial setup with hundreds of parts." },
            { type: "heading", text: "How markup works" },
            { type: "para", text: "When a part is selected during job finalization, if no custom selling price is set, the selling price is calculated as: Cost Price × (1 + markup% / 100), using the 'markup_percent_over_cost' app setting." },
        ],
        faqs: [
            { q: "What does UOM mean?", a: "Unit of Measure — how the part is counted. 'NOS' means each unit counted individually. Other examples: KG (kilograms), Litre, Set, Pair." },
            { q: "What is an HSN code?", a: "Harmonized System of Nomenclature — a standardized classification code for goods under GST, required on all GST tax invoices. Check your supplier invoices or the official GST HSN directory for the correct code." },
            { q: "HSN validation is failing — what are valid lengths?", a: "Only 4, 6, or 8 digit codes are accepted. 5-digit and 7-digit codes are invalid." },
            { q: "Can I set a default HSN for parts that don't have one?", a: "Yes — set 'Default HSN for Spare Part' in Configurations → App Settings. It is used as a fallback when a part has no specific HSN." },
            { q: "MRP validation error — why?", a: "If you enter both MRP and Cost Price, MRP must be strictly greater than Cost Price. Either leave MRP blank or ensure it exceeds the cost." },
        ],
    },

    {
        id: "brands-models",
        category: "Masters",
        title: "Brands, Products & Models",
        summary: "Set up the product hierarchy required for job creation.",
        tags: ["brand", "product", "model", "hierarchy", "device"],
        content: [
            { type: "para", text: "Jobs require a three-level hierarchy to identify the device: Brand → Product → Model." },
            { type: "table", headers: ["Level", "Example"], rows: [
                ["Brand",   "Samsung"],
                ["Product", "Mobile Phone"],
                ["Model",   "Galaxy S24"],
            ]},
            { type: "steps", items: [
                "Add the Brand (Masters → Brand).",
                "Add the Product and link it to the Brand (Masters → Product).",
                "Add the Model and link it to the Brand + Product (Masters → Model).",
                "Now the model appears in the job creation form.",
            ]},
            { type: "note", text: "If the model dropdown is empty when creating a job, it means no models exist for the selected brand + product combination. Add the model in Masters → Model first." },
        ],
        faqs: [
            { q: "Can the same model exist under two brands?", a: "Yes. A model is linked to a specific Brand + Product combination, so the same model name can exist under different brands." },
            { q: "Can I delete a brand that has existing jobs?", a: "No. Deletion is blocked if the brand (or its models) is referenced by jobs, parts, or invoices." },
        ],
    },

    {
        id: "vendors-branches",
        category: "Masters",
        title: "Vendors, Branches & Financial Years",
        summary: "Manage suppliers, service center locations, and accounting periods.",
        tags: ["vendor", "supplier", "branch", "financial year", "head office"],
        content: [
            { type: "heading", text: "Vendors (Suppliers)" },
            { type: "para", text: "Masters → Vendor. Vendors are used in Purchase Entry. Vendor name must be unique per branch. Vendors cannot be deleted if they are referenced by purchase invoices." },
            { type: "heading", text: "Branches" },
            { type: "para", text: "Masters → Branch. A Branch is a physical service center location. All jobs, inventory, technicians, and document sequences are scoped to a branch." },
            { type: "bullets", items: [
                "At least one branch is required.",
                "The Head Office branch cannot be deleted.",
                "Users are assigned to specific branches, controlling which branch's data they can access.",
            ]},
            { type: "heading", text: "Financial Years" },
            { type: "para", text: "Masters → Financial Year. Defines your accounting periods (India standard: April 1 – March 31). Date ranges must not overlap between years. All date filters in the system default to the current financial year." },
        ],
        faqs: [
            { q: "Can I have the same vendor name at two branches?", a: "No. Vendor names must be unique per branch." },
            { q: "What happens if I delete a branch?", a: "Deletion is blocked if the branch has jobs, inventory, or users linked to it. Branches cannot be deleted if they contain data." },
            { q: "Can I change the financial year start date?", a: "Yes, but overlapping years are not allowed. Changing the current year's dates may affect existing reports." },
        ],
    },

    // ── Category 5: Configurations ───────────────────────────────────────────

    {
        id: "divisions",
        category: "Configurations",
        title: "Divisions Setup",
        summary: "Create and configure billing entities — GST and non-GST divisions.",
        tags: ["division", "GSTIN", "GST", "non-GST", "billing entity", "IGST", "CGST", "SGST", "state code"],
        content: [
            { type: "para", text: "Configurations → Divisions. A Division is your billing entity — every invoice is issued from a division. You can have multiple divisions (e.g., GST and non-GST, or separate divisions for different states)." },
            { type: "heading", text: "GST vs Non-GST Division" },
            { type: "table", headers: ["Setting", "GST Division", "Non-GST Division"], rows: [
                ["GSTIN",     "Filled (15-char India format)",     "Left blank"],
                ["Invoices",  "Show CGST + SGST (or IGST) breakdown", "Show total only"],
                ["HSN",       "Mandatory on all invoice lines",    "Not required"],
                ["Tax rates", "From part master or default setting", "All ₹0"],
            ]},
            { type: "heading", text: "Setup Steps" },
            { type: "steps", items: [
                "Go to Configurations → Divisions → New.",
                "Enter Code and Name (both unique per branch).",
                "Fill Address and State (required for invoice supply details).",
                "For a GST division: enter GSTIN in the GSTIN field.",
                "For a non-GST division: leave GSTIN blank.",
                "Save.",
            ]},
        ],
        faqs: [
            { q: "Can I have both GST and non-GST divisions?", a: "Yes. Create one division per billing entity. Each job is linked to one division, so you can issue GST invoices from one division and non-GST invoices from another." },
            { q: "What is Force IGST?", a: "For inter-state supplies (customer is in a different state from your division). Check 'Force IGST' on the job finalization form. This applies the full GST rate as IGST instead of splitting into CGST + SGST." },
            { q: "Can I change a division's GSTIN?", a: "Yes. Edit the division and update the GSTIN. Only future invoices are affected. Existing invoices retain the GSTIN at the time of creation." },
            { q: "Why does the division affect invoice calculation?", a: "The division's GSTIN determines whether the invoice is GST-compliant (with tax breakdown) or non-GST (total only). Each division can have different GST registration for different billing scenarios." },
        ],
    },

    {
        id: "document-sequences",
        category: "Configurations",
        title: "Document Sequences",
        summary: "Configure auto-numbering for jobs, invoices, and receipts.",
        tags: ["document sequence", "job number", "invoice number", "receipt number", "prefix", "sequence", "numbering"],
        content: [
            { type: "para", text: "Configurations → Document Sequence. Document sequences control how numbers are automatically generated for jobs and invoices." },
            { type: "heading", text: "Required Sequences" },
            { type: "table", headers: ["Sequence", "Used For", "Required Before"], rows: [
                ["JOB_SHEET",      "Job numbers (e.g., SVC-0001)",              "Creating any job"],
                ["SERVICE_INVOICE","Service invoice numbers",                   "Delivering a job and creating an invoice"],
                ["MONEY_RECEIPT",  "Payment receipt numbers",                   "Adding a payment receipt"],
                ["SALES_INVOICE",  "Direct parts sales invoice numbers",        "Inventory → Sales Entry"],
            ]},
            { type: "heading", text: "Setup Steps" },
            { type: "steps", items: [
                "Go to Configurations → Document Sequence.",
                "Click Edit on a sequence (e.g., JOB_SHEET).",
                "Enter a Prefix (e.g., 'SVC', 'INV', 'RCT').",
                "Set the starting number if needed (default 1).",
                "Save.",
            ]},
            { type: "warning", text: "Without configured sequences, you will see the error 'Document sequence not configured' when trying to create jobs or invoices." },
        ],
        faqs: [
            { q: "I get 'Document sequence not configured' — what do I do?", a: "Go to Configurations → Document Sequence. Find the sequence named in the error (JOB_SHEET, SERVICE_INVOICE, etc.) and set a Prefix." },
            { q: "Can I reset the sequence number?", a: "Yes — edit the sequence and change the 'Next Number' field. Be careful not to create duplicate numbers if you lower it." },
            { q: "Can different divisions have different numbering?", a: "Yes. Each division manages its own document sequences independently." },
            { q: "Can I use letters in the prefix?", a: "Yes. Prefixes are free text. Common examples: 'SVC', 'JOB', 'INV', 'RCT'." },
        ],
    },

    {
        id: "app-settings",
        category: "Configurations",
        title: "App Settings",
        summary: "Key application settings controlling defaults, print copies, and integrations.",
        tags: ["app settings", "default GST rate", "default HSN", "markup", "print copies", "post to accounts", "force GST"],
        content: [
            { type: "para", text: "Configurations → App Settings. These settings control system-wide defaults." },
            { type: "table", headers: ["Setting", "What It Controls"], rows: [
                ["default_gst_rate",                       "GST rate used when a part has no specific GST rate"],
                ["default_hsn_for_spare_part",             "Fallback HSN code for parts without a specific HSN"],
                ["default_hsn_for_service_charge",         "Fallback HSN for service charge lines"],
                ["no_of_job_sheets_per_print",             "Number of job sheet copies printed per job"],
                ["no_of_invoice_copies_per_print",         "Number of invoice copies printed"],
                ["show_parts_in_job_invoice",              "Default for 'Show Parts in Invoice' on job finalization"],
                ["markup_percent_over_cost",               "Auto-calculates selling price = cost × (1 + markup%)"],
                ["post_data_to_accounts",                  "Enables accounting system integration (Post to Accounts)"],
            ]},
        ],
        faqs: [
            { q: "How does markup_percent_over_cost work?", a: "When a part is added to a job, if no selling price is set on the part master, selling price is calculated as: Cost Price × (1 + markup% / 100). For example, 20% markup on ₹100 cost = ₹120 selling price." },
            { q: "Why can't I edit some settings?", a: "Some settings are marked as non-editable (system-fixed). These are managed by the platform administrator and cannot be changed from the UI." },
        ],
    },

    {
        id: "gst-checklist",
        category: "Configurations",
        title: "GST Configuration Checklist",
        summary: "Everything to set up before issuing your first GST invoice.",
        tags: ["GST", "GSTIN", "HSN", "checklist", "configuration", "invoice", "setup"],
        content: [
            { type: "para", text: "Before your first GST invoice, verify all these items are configured." },
            { type: "steps", items: [
                "Division → GSTIN field filled (15-character India GST format: two digits + five letters + four digits + letter + digit + Z + alphanumeric).",
                "Division → State is set (required for supply state code on invoices).",
                "Parts Master → HSN code set on each part (or Default HSN for Spare Part set in App Settings as fallback).",
                "Parts Master → GST Rate set on each part (or Default GST Rate set in App Settings as fallback).",
                "Additional Charges Master → HSN set for each service charge type.",
                "Document Sequence → SERVICE_INVOICE prefix configured.",
                "Document Sequence → MONEY_RECEIPT prefix configured.",
            ]},
        ],
        faqs: [
            { q: "What is the GSTIN format?", a: "15 characters: 2-digit state code + 5-letter PAN + 4-digit sequential number + 1 letter + 1 digit + 'Z' + 1 alphanumeric check digit. Example: 27AAPFU0939F1ZV" },
            { q: "Where do I find my GSTIN?", a: "On your GST registration certificate, on previous GST invoices issued to you, or on the GST portal at gstin.gov.in." },
            { q: "What HSN code should I use for general service charges?", a: "SAC code 9987 is commonly used for repair and maintenance services. Consult your CA for the correct code for your specific service type." },
        ],
    },

    // ── Category 6: Reports ──────────────────────────────────────────────────

    {
        id: "job-reports",
        category: "Reports",
        title: "Job Reports",
        summary: "Reports for job intake, repair, delivery, aging, and transaction history.",
        tags: ["job reports", "intake", "repaired", "delivered", "aging", "pipeline", "ledger", "trend"],
        content: [
            { type: "table", headers: ["Report", "What It Shows", "Best Used For"], rows: [
                ["Job Intake Summary",       "Cumulative jobs received over a period",          "Monitor inflow volume and trends"],
                ["Jobs Repaired",            "Count of jobs with COMPLETED status",             "Track technician output"],
                ["Jobs Delivered",           "Count of delivered (closed) jobs",                "Revenue recognition milestone"],
                ["Delivered Jobs - Detailed","Per-job delivery info with amounts",              "Customer billing audit"],
                ["Job Transaction Ledger",   "Full status-change history per job",              "Dispute resolution, audit trail"],
                ["Job Pipeline / Aging",     "How long jobs sit in each status",                "Identify operational bottlenecks"],
                ["Job Status Trend",         "Distribution of statuses over time",              "Operations health monitoring"],
            ]},
            { type: "note", text: "All job reports support date range filtering. Default range is the current financial year (April 1 to March 31)." },
        ],
        faqs: [
            { q: "How do I see how long a specific job has been open?", a: "Run Job Pipeline / Aging. It shows each job's age in days. Alternatively, the Job Transaction Ledger shows all status changes with timestamps for a specific job." },
            { q: "Can I export job reports?", a: "Yes. Most reports have an Export button that downloads a PDF or XLSX file." },
            { q: "Why doesn't a job appear in the delivered report?", a: "The job must have completed the Deliver Job workflow (status = DELIVERED_OK or DELIVERED_NOT_OK) within the selected date range." },
        ],
    },

    {
        id: "financial-reports",
        category: "Reports",
        title: "Financial Reports",
        summary: "Profit, revenue, cash register, sales, and GST summary reports.",
        tags: ["financial", "profit", "revenue", "cash register", "sales", "GST summary", "CGST", "SGST", "IGST"],
        content: [
            { type: "table", headers: ["Report", "What It Shows"], rows: [
                ["Profit Summary",  "Revenue minus cost by period — shows gross profit"],
                ["Revenue Report",  "Income broken down by job type and period"],
                ["Cash Register",   "Daily log of all cash receipts"],
                ["Sales Report",    "Parts sold directly via Sales Entry"],
                ["GST Summary",     "CGST, SGST, IGST collected — for GST return filing"],
            ]},
            { type: "heading", text: "Using GST Summary for GST Returns" },
            { type: "steps", items: [
                "Go to Reports → Financial Reports → GST Summary.",
                "Set the date range to the GST return period (monthly or quarterly).",
                "The report shows CGST, SGST, IGST, and aggregate taxable amounts split by GST rate.",
                "Use these figures to fill your GSTR-1 and GSTR-3B returns.",
            ]},
        ],
        faqs: [
            { q: "How do I prepare data for my GST return?", a: "Financial Reports → GST Summary → set the return period date range. The report shows CGST, SGST, IGST, and aggregate amounts split by GST rate." },
            { q: "Why does Profit show as negative?", a: "Profit = Selling Price − Cost Price. If cost prices are set higher than selling prices on some jobs, or if cost data is incomplete, profit can appear negative. Check the individual job finalization data." },
            { q: "What is the Cash Register report?", a: "A day-by-day log of all money receipts received. Useful for daily cash reconciliation and tracking payment modes (Cash, Cheque, Transfer)." },
        ],
    },

    {
        id: "technician-reports",
        category: "Reports",
        title: "Technician Performance Reports",
        summary: "Scorecard, productivity, and revenue attribution per technician.",
        tags: ["technician", "performance", "scorecard", "productivity", "heatmap", "revenue"],
        content: [
            { type: "table", headers: ["Report", "What It Shows"], rows: [
                ["Technician Scorecard",       "Jobs assigned, completed, and delivered per technician"],
                ["Repaired vs Delivered",      "What percentage of repaired jobs are actually delivered"],
                ["Profit & Revenue Attribution","Revenue and profit attributed to each technician"],
                ["Productivity Heatmap",       "Time-based activity patterns — busiest days and hours"],
            ]},
        ],
        faqs: [
            { q: "How is revenue attributed to a technician?", a: "Revenue is attributed to the technician assigned to the job at the time of delivery." },
            { q: "What does the Productivity Heatmap show?", a: "A calendar-style grid showing which days and hours have the most job completions — useful for staffing decisions." },
        ],
    },

    {
        id: "inventory-reports",
        category: "Reports",
        title: "Inventory Reports",
        summary: "Stock ledger, aging, slow movers, consumption, and reorder suggestions.",
        tags: ["inventory reports", "stock ledger", "aging", "slow movers", "consumption", "reorder", "movement", "spare parts ledger"],
        content: [
            { type: "table", headers: ["Report", "What It Shows"], rows: [
                ["Stock Ledger",               "All stock movements (in/out) for every part"],
                ["Spare Parts Ledger",         "Opening → debits → credits → closing stock per part"],
                ["Spare Parts Aging",          "How long stock has been sitting (5 age buckets)"],
                ["Slow Movers (> 1 year)",     "Parts with no movement in 12+ months"],
                ["Parts Consumption Detailed", "Which parts were used in which service jobs"],
                ["Stock Movement Summary",     "Aggregate in/out totals by period"],
                ["Reorder Suggestions",        "Parts that need restocking based on consumption rate"],
            ]},
            { type: "heading", text: "Spare Parts Aging Buckets" },
            { type: "bullets", items: [
                "0–30 days: Fresh stock",
                "31–90 days: Normal",
                "91–180 days: Moderate age",
                "181–365 days: Getting old",
                "> 365 days: Slow mover / consider write-off",
            ]},
        ],
        faqs: [
            { q: "How do I investigate an unexpected stock change?", a: "Run Reports → Inventory → Stock Ledger for the specific part. Every movement is recorded with its date, transaction type (Purchase, Consumption, Adjustment, Transfer), and reference number." },
            { q: "What is a Slow Mover?", a: "A part with no stock movement (no purchase or consumption) for more than 12 months. Review these for write-off, return to vendor, or reclassification." },
            { q: "How is Spare Parts Aging calculated?", a: "Based on the 'Last In Date' (when the stock was last received). Parts that haven't been restocked in a long time show higher ages." },
        ],
    },

    // ── Category 7: GST & Invoicing ──────────────────────────────────────────

    {
        id: "gst-invoicing",
        category: "GST & Invoicing",
        title: "GST vs Non-GST: How It Works",
        summary: "Understand the difference between GST and non-GST invoicing modes.",
        tags: ["GST", "non-GST", "CGST", "SGST", "IGST", "invoice", "HSN", "tax", "division"],
        content: [
            { type: "heading", text: "GST Division (GSTIN is filled)" },
            { type: "bullets", items: [
                "Service invoices break each line into: Taxable Amount + CGST + SGST (or IGST for inter-state).",
                "HSN code is mandatory on every invoice line.",
                "GST rate comes from the part master; falls back to the App Settings default if not set.",
                "Force IGST option is available for inter-state supplies.",
            ]},
            { type: "heading", text: "Non-GST Division (GSTIN is blank)" },
            { type: "bullets", items: [
                "Invoices show a single total amount — no tax breakdown.",
                "HSN codes are not required.",
                "All amounts are treated as the final price; no GST is calculated.",
            ]},
            { type: "heading", text: "Switching modes mid-job" },
            { type: "para", text: "You can change the division on a job right up until a service invoice is created. Once an invoice exists, the division is locked for that job. To switch after invoicing: delete the invoice first, change the division, then regenerate the invoice." },
            { type: "heading", text: "CGST vs SGST vs IGST" },
            { type: "table", headers: ["Tax Type", "When Applied"], rows: [
                ["CGST + SGST", "Default for intra-state supply (customer in the same state as your division)"],
                ["IGST",        "For inter-state supply (customer in a different state). Use 'Force IGST' checkbox on the finalization form."],
            ]},
        ],
        faqs: [
            { q: "Can the same job have both GST and non-GST charges?", a: "No. A job is linked to one division, which is either GST or non-GST. All parts and charges on that job follow the same tax mode." },
            { q: "What if my customer is in a different state?", a: "Check 'Force IGST' on the job finalization form. This changes CGST+SGST to IGST for inter-state tax compliance." },
            { q: "What is supply state code on the invoice?", a: "It is the two-digit code of the state where your division is registered (from your GSTIN's first two digits). It is required on GST invoices for B2B transactions." },
        ],
    },

    {
        id: "customer-gstin",
        category: "GST & Invoicing",
        title: "Customer GSTIN on Jobs",
        summary: "Capture, validate, and edit a customer's GSTIN at job creation, finalization, and delivery.",
        tags: ["gstin", "customer gstin", "B2B", "tax invoice", "validation", "GST", "trace plus", "auto-fill"],
        content: [
            { type: "para", text: "A customer's GSTIN can be entered or updated directly from the job screens — you no longer have to open Masters → Customer first. The GSTIN is stored once on the customer record and reused everywhere, so it is a single source of truth." },
            { type: "note", text: "This is the CUSTOMER's GSTIN (the B2B buyer's registration that appears on the tax invoice). It is different from the DIVISION GSTIN, which is your own business's registration. See 'Divisions Setup' and 'GST vs Non-GST' for the division side." },
            { type: "heading", text: "Where you can enter it" },
            { type: "table", headers: ["Stage", "Where", "Validation"], rows: [
                ["Job creation",   "New Single Job / Batch Jobs form", "Optional — saved with the job's customer"],
                ["Finalization",   "Final a Job → Finalize form",      "Optional, but an invalid value blocks 'Save & Mark Final'"],
                ["Delivery",       "Deliver Job → per-job field",      "Optional, but an invalid value blocks 'Deliver & Close'"],
            ]},
            { type: "heading", text: "How it behaves" },
            { type: "bullets", items: [
                "Auto-fills — selecting a customer fills the GSTIN field from that customer's stored value; clearing the customer clears the field.",
                "Optional everywhere — a blank GSTIN is always valid, so retail/individual customers need nothing here.",
                "Validated when filled — a non-empty value must be a valid 15-character GSTIN (example: 27AAPFU0939F1ZV).",
                "Auto-formatted — input is trimmed and converted to uppercase as you type.",
                "Saved back to the customer — editing it at any stage updates the customer master, so the next job for that customer is pre-filled.",
                "Per job on delivery — when delivering several jobs at once, each job's GSTIN is editable independently against its own customer.",
            ]},
            { type: "warning", text: "At finalization and delivery the GSTIN is hard-validated: if the field contains an invalid value, the action is blocked until you either correct it to a valid 15-character GSTIN or clear the field." },
            { type: "heading", text: "Where it is used" },
            { type: "para", text: "When a job invoice is posted to Trace Plus, the customer's stored GSTIN is sent automatically — there is no separate step. Whatever GSTIN is on the customer at that point (from creation, finalize, or delivery) flows through to the posted invoice." },
        ],
        faqs: [
            { q: "Do I have to enter a GSTIN?", a: "No. GSTIN is optional everywhere. Leave it blank for retail or individual customers. Fill it only for B2B customers who need their GSTIN on the tax invoice." },
            { q: "I edited the GSTIN while delivering — did it change the customer?", a: "Yes. The GSTIN is stored on the customer record, not the job. Editing it at creation, finalize, or delivery updates the customer master, so future jobs for that customer pick up the new value." },
            { q: "Finalize or Deliver is blocked with a GSTIN error — why?", a: "The GSTIN field has a value that is not a valid 15-character GSTIN. Either fix it to the correct format or clear the field (blank is allowed), then try again." },
            { q: "What's the difference between this and the Division GSTIN?", a: "The Division GSTIN is your own business's registration and drives whether the invoice is GST or non-GST. The Customer GSTIN is the buyer's registration printed on the invoice for B2B sales. They are separate fields." },
            { q: "The save toast said updating the customer's GSTIN failed — was my job lost?", a: "No. Saving the GSTIN to the customer is best-effort. If it fails you'll see a toast, but the job action (create / finalize / deliver) still completes. Re-enter the GSTIN later from the customer or the next job screen." },
        ],
    },

    {
        id: "invoice-troubleshooting",
        category: "GST & Invoicing",
        title: "Invoice Troubleshooting",
        summary: "Common invoice errors and how to resolve them.",
        tags: ["invoice", "error", "troubleshoot", "regenerate", "delete", "posted", "HSN error", "GST rate error"],
        content: [
            { type: "table", headers: ["Problem", "Likely Cause", "Resolution"], rows: [
                ["Cannot create invoice",              "SERVICE_INVOICE sequence has no prefix",         "Configurations → Document Sequence → add SERVICE_INVOICE prefix"],
                ["Invoice shows wrong total",           "Parts/charges changed after invoice was created","Delete invoice → regenerate from Deliver Job Step 2"],
                ["'Cannot regenerate' error",           "Invoice is posted to accounts",                  "Admin → Post/Unpost → unpost → then regenerate"],
                ["'HSN required' error on save",        "Missing HSN on one or more finalization rows",   "Final a Job → add HSN on every row showing a red border"],
                ["'GST rate must be > 0' error",       "A line has GST rate = 0 in a GST division",      "Set GST rate on each line, or set a default in App Settings"],
                ["'Deliver & Close' greyed out",        "Outstanding balance is not ₹0",                 "Deliver Job Step 3 → add receipt for remaining balance"],
                ["Division locked on job",              "Service invoice already exists",                 "Delete invoice first, then change division, then regenerate"],
                ["Invoice amount ≠ finalization total", "Back-Calculate target was used",                 "This is correct — invoice uses the target total, not the line sum"],
                ["Finalize/Deliver blocked by GSTIN",   "Customer GSTIN field has an invalid value",      "Enter a valid 15-character GSTIN or clear the field (blank is allowed)"],
            ]},
        ],
        faqs: [
            { q: "Can I delete an invoice that has been posted to accounts?", a: "No. Unpost it first from Admin → Post/Unpost, then delete it." },
            { q: "Can I issue a zero-value GST invoice?", a: "Yes — warranty jobs generate invoices with ₹0 selling prices. The invoice still has GST fields but with zero amounts." },
        ],
    },

    // ── Category 8: Admin & Users ────────────────────────────────────────────

    {
        id: "user-management",
        category: "Admin & Users",
        title: "Managing Users",
        summary: "Create, edit, assign branches, and manage user access.",
        tags: ["users", "admin", "password", "role", "branch", "activate", "deactivate", "credentials"],
        content: [
            { type: "para", text: "Switch to Admin Mode from the top-right user menu (available to Type A users). Go to Admin → Users." },
            { type: "heading", text: "Creating a User" },
            { type: "steps", items: [
                "Admin → Users → Add User.",
                "Enter Email (must be unique across the platform), Username (unique), and Full Name.",
                "Select Role and assign to a Business Unit.",
                "Assign one or more Branches the user can access.",
                "Save.",
                "Click 'Mail Credentials' to email a password reset link to the new user.",
            ]},
            { type: "heading", text: "User Types" },
            { type: "table", headers: ["Type", "Access"], rows: [
                ["Type A (Business Admin)", "Client Mode + Admin Mode (user management, audit logs)"],
                ["Type B (Regular User)",  "Client Mode only (daily operations: jobs, inventory, reports)"],
            ]},
            { type: "note", text: "Deactivating a user prevents them from logging in without deleting their history or records. Reactivate at any time." },
        ],
        faqs: [
            { q: "A user forgot their password — what do I do?", a: "Admin → Users → find the user → click 'Mail Credentials'. This sends a password reset link to their email." },
            { q: "Can I restrict a user to one branch?", a: "Yes. Assign only the allowed branches in the user form. The user will only see data for their assigned branches." },
            { q: "What is the difference between Type A and Type B users?", a: "Type A (Business Admin) can access Admin Mode to manage users and audit logs. Type B (Regular User) can only access Client Mode for day-to-day operations." },
            { q: "Can I change a user's role after creation?", a: "Yes. Edit the user and select a different role. The change takes effect on their next login." },
        ],
    },

    {
        id: "audit-logs",
        category: "Admin & Users",
        title: "Audit Logs",
        summary: "Track all create, edit, and delete actions across the system.",
        tags: ["audit", "audit log", "history", "compliance", "who changed", "tracking"],
        content: [
            { type: "para", text: "Admin → Audit Logs (in Admin Mode). All create, edit, and delete actions are automatically recorded." },
            { type: "heading", text: "Each log entry includes" },
            { type: "bullets", items: [
                "User who performed the action",
                "Action type (Create, Update, Delete)",
                "Record affected (table name and record ID)",
                "Timestamp",
            ]},
            { type: "heading", text: "Filtering and Export" },
            { type: "bullets", items: [
                "Filter by date range",
                "Filter by user",
                "Filter by action type",
                "Export to XLSX for compliance or investigation",
            ]},
        ],
        faqs: [
            { q: "Can I see who deleted a record?", a: "Yes. Filter audit logs by the Delete action type. The log shows the user who deleted the record and when." },
            { q: "How far back do audit logs go?", a: "Audit logs are retained for the full life of the system. There is no automatic expiry." },
            { q: "Can a regular user see audit logs?", a: "No. Audit logs are accessible only in Admin Mode, which requires a Type A (Business Admin) account." },
        ],
    },

    // ── Category 9: Troubleshooting ──────────────────────────────────────────

    {
        id: "common-errors",
        category: "Troubleshooting",
        title: "Common Errors & Resolutions",
        summary: "Quick reference for the most frequent error messages and how to fix them.",
        tags: ["error", "troubleshoot", "fix", "problem", "document sequence", "finalized", "invoice", "delete", "HSN", "GST", "duplicate"],
        content: [
            { type: "table", headers: ["Error / Symptom", "Cause", "Resolution"], rows: [
                ["'Document sequence not configured'",        "JOB_SHEET / SERVICE_INVOICE / etc. has no prefix",   "Configurations → Document Sequence → set the prefix"],
                ["'Job is finalized — edit not allowed'",     "Job has is_final = true",                            "Final a Job → Finalized Jobs → Undo → then re-edit"],
                ["'Invoice must be regenerated — void first'","Tried to change division after invoice exists",       "Deliver Job → delete invoice → change division → regenerate"],
                ["'Cannot delete — referenced by records'",   "Customer / Part / Technician is in use",             "Remove all references first, or deactivate instead of deleting"],
                ["'Invoice already exists for this vendor'",  "Duplicate purchase invoice entry",                   "Check existing Purchase Entry for that vendor before re-entering"],
                ["'HSN is required for all parts'",           "Missing HSN on one or more finalization rows",       "Final a Job → fill HSN on every row with a red border"],
                ["'GST rate must be greater than 0'",         "Zero GST rate line in a GST invoice",                "Set GST rate on each line or set a default in App Settings"],
                ["'Total due is not zero'",                   "Outstanding balance before delivery",                "Deliver Job → Step 3 → add receipt for remaining balance"],
                ["'Invalid GSTIN' on finalize/deliver",       "Customer GSTIN field has a malformed value",         "Enter a valid 15-character GSTIN or clear the field"],
                ["'Batch No is set — edit from batch'",       "Job belongs to a batch",                             "Jobs → Batch Jobs → open the batch → edit the job there"],
                ["Model dropdown is empty",                   "No models exist for selected brand + product",       "Masters → Model → add the missing model first"],
                ["Jobs not in Final a Job pending list",      "Job status is not COMPLETED",                        "Update status to COMPLETED in Job Pipeline first"],
                ["PDF not opening after clicking Print",      "Browser is blocking pop-ups",                        "Allow pop-ups for this site in browser settings"],
                ["'Stock transaction type not loaded'",       "CONSUMPTION type not seeded in reference data",      "Contact system administrator to reseed transaction types"],
            ]},
        ],
        faqs: [
            { q: "The screen is stuck loading — what do I do?", a: "Refresh the page (F5 or Ctrl+R). If the problem persists, check your internet connection and try again. If it continues for more than a few minutes, contact your system administrator." },
            { q: "I made a mistake on a finalized job — how do I fix it?", a: "Go to Final a Job → Finalized Jobs tab → Undo on the job. This reverts is_final to false. If an invoice was generated, delete it first. Then re-open and correct the finalization form." },
            { q: "I accidentally deleted a record — can it be recovered?", a: "Deletions are permanent in Service+. For important records (customers, jobs), the system blocks deletion if there are references, so accidental deletion of in-use records is prevented. Contact your administrator if data recovery is needed." },
        ],
    },
];

// ─── Search helper ────────────────────────────────────────────────────────────

export function searchArticles(query: string): HelpArticle[] {
    if (!query.trim()) return HELP_ARTICLES;
    const q = query.toLowerCase();
    return HELP_ARTICLES.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.tags.some(t => t.toLowerCase().includes(q)) ||
        a.faqs.some(f => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)) ||
        a.content.some(c =>
            (c.type === "para"    && c.text.toLowerCase().includes(q)) ||
            (c.type === "steps"  && c.items.some(i => i.toLowerCase().includes(q))) ||
            (c.type === "bullets"&& c.items.some(i => i.toLowerCase().includes(q))) ||
            (c.type === "heading"&& c.text.toLowerCase().includes(q)) ||
            (c.type === "note"   && c.text.toLowerCase().includes(q)) ||
            (c.type === "warning"&& c.text.toLowerCase().includes(q)) ||
            (c.type === "table"  && c.rows.some(r => r.some(cell => cell.toLowerCase().includes(q))))
        )
    );
}

export const HELP_CATEGORIES = [
    "Getting Started",
    "Jobs",
    "Inventory",
    "Masters",
    "Configurations",
    "Reports",
    "GST & Invoicing",
    "Admin & Users",
    "Troubleshooting",
] as const;
