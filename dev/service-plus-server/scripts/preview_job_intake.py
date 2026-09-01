"""Local preview for the Job Intake status page + PDF (app/routers/public/
job_intake_router.py) — no server, no DB, no WhatsApp send required.

Both `_build_status_page_html` and `_build_pdf` are pure functions of
`_JobIntakeData`, so this just constructs a couple of representative payloads
(single job, batch, edge cases) and writes the outputs straight to disk for you
to open in a browser / PDF viewer. Re-run after every design tweak — this is the
fast loop for iterating without touching the real token/DB/Meta path at all.

Usage (from service-plus-server/, inside your venv):
    python scripts/preview_job_intake.py
    xdg-open /tmp/job-intake-preview/single.html
    xdg-open /tmp/job-intake-preview/single.pdf

Output goes to /tmp, not inside the repo — nothing to accidentally commit or
clean up. Pass a different directory as the one CLI argument if you want it
somewhere else: `python scripts/preview_job_intake.py /some/other/dir`.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.routers.public.job_intake_router import (  # noqa: E402
    _JobIntakeData,
    _JobIntakeItem,
    _build_pdf,
    _build_status_page_html,
)

OUT_DIR = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/tmp/job-intake-preview")

_TERMS = (
    "Material must be collected within 4 months from the Job Sheet date. Thereafter, "
    "the Company is not responsible for delivery; if delivery is possible, storage "
    "charges of Rs 100/day will apply. Material uncollected for 6 months may be "
    "disposed of without further notice or liability."
)


def _write(name: str, data: _JobIntakeData) -> None:
    OUT_DIR.mkdir(exist_ok=True)
    html_path = OUT_DIR / f"{name}.html"
    pdf_path = OUT_DIR / f"{name}.pdf"
    html_path.write_text(_build_status_page_html(data, pdf_url=f"/job-intake/pdf/preview-{name}"))
    pdf_path.write_bytes(_build_pdf(data))
    print(f"wrote {html_path} and {pdf_path}")


def main() -> None:
    single = _JobIntakeData(
        batch_no=None,
        job_no="JOB-1024",
        bu_name="Cellcare Services",
        branch_name="MG Road Branch",
        branch_address="12 MG Road, Bengaluru, Karnataka, 560001",
        branch_phone="080-4123 5566",
        branch_email="mgroad@cellcareservices.example",
        branch_gstin="29ABCDE1234F1Z5",
        customer_name="Rahul Sharma",
        customer_mobile="9876543210",
        customer_address="14/2 Residency Road, Bengaluru, Karnataka, 560025",
        received_date="30 Aug 2026",
        amount_payable=0,
        terms_and_conditions=_TERMS,
        items=[
            _JobIntakeItem(
                job_no="JOB-1024",
                device="Apple / iPhone 13 / A2482 / C7QX9K2LKX8N",
                status="In Progress",
                alternate_job_no=None,
                problem_reported="Screen flickers intermittently and battery drains fast.",
                remarks="Customer says issue started after a recent software update.",
                qty=1,
                job_type_name="Repair",
                receive_manner_name="Walk-in",
                receive_condition_name="Minor scratches on back panel",
                warranty_card_no=None,
                purchase_date="12 Jan 2024",
            )
        ],
    )
    _write("single", single)

    # Finalized single job with a settled bill — exercises the "Amount Payable" box.
    single_final = _JobIntakeData(
        batch_no=None,
        job_no="JOB-1030",
        bu_name="Cellcare Services",
        branch_name="MG Road Branch",
        branch_address="12 MG Road, Bengaluru, Karnataka, 560001",
        branch_phone="080-4123 5566",
        branch_email="mgroad@cellcareservices.example",
        branch_gstin="29ABCDE1234F1Z5",
        customer_name="Vikram Rao",
        customer_mobile="9845012233",
        customer_address=None,
        received_date="28 Aug 2026",
        amount_payable=1450.00,
        terms_and_conditions=_TERMS,
        items=[
            _JobIntakeItem(
                job_no="JOB-1030",
                device="Samsung / Galaxy A54 / RZ8N9988XY",
                status="Ready for pickup",
                alternate_job_no=None,
                problem_reported="Charging port not working.",
                remarks=None,
                qty=1,
                job_type_name="Repair",
                receive_manner_name="Courier",
                receive_condition_name="Good working condition otherwise",
                warranty_card_no="WC-88213",
                purchase_date=None,
            )
        ],
    )
    _write("single_final", single_final)

    batch = _JobIntakeData(
        batch_no=88,
        job_no=None,
        bu_name="Cellcare Services",
        branch_name="Salt Lake Branch",
        branch_address="Sector V, Salt Lake, Kolkata, West Bengal, 700091",
        branch_phone="033-6612 4477",
        branch_email="saltlake@cellcareservices.example",
        branch_gstin="19PQRSX5678K1Z2",
        customer_name="Priya Das",
        customer_mobile="9903456789",
        customer_address="22 Sector V, Salt Lake, Kolkata, West Bengal, 700091",
        received_date="30 Aug 2026",
        amount_payable=2100.00,
        terms_and_conditions=_TERMS,
        items=[
            _JobIntakeItem(
                job_no="JOB-2001", device="Samsung / Galaxy S21 / RZ8N40ABCDE", status="Received",
                alternate_job_no=None, problem_reported="Cracked display glass.", remarks=None,
                qty=1, job_type_name="Repair", receive_manner_name="Walk-in",
                receive_condition_name="Screen cracked", warranty_card_no=None, purchase_date="03 Feb 2025",
            ),
            _JobIntakeItem(
                job_no="JOB-2002", device="Dell / Inspiron 15 / 3520 / 5CD1234XYZ", status="Diagnosed",
                alternate_job_no="ALT-2002", problem_reported="Laptop does not power on.",
                remarks="Customer reports it was working fine until it was accidentally dropped.",
                qty=1, job_type_name="Repair", receive_manner_name="Walk-in",
                receive_condition_name=None, warranty_card_no=None, purchase_date=None,
            ),
            _JobIntakeItem(
                job_no="JOB-2003", device=None, status="Ready for pickup",
                alternate_job_no=None, problem_reported=None, remarks=None,
                qty=1, job_type_name="Estimate Only", receive_manner_name="Walk-in",
                receive_condition_name=None, warranty_card_no=None, purchase_date=None,
            ),
            _JobIntakeItem(
                job_no="JOB-2004", device="OnePlus / Nord CE 3 Lite", status="Delivered",
                alternate_job_no=None, problem_reported="Speaker not working.", remarks=None,
                qty=1, job_type_name="Repair", receive_manner_name="Walk-in",
                receive_condition_name="Good", warranty_card_no="WC-77004", purchase_date=None,
            ),
            _JobIntakeItem(
                job_no="JOB-2005", device="HP / Pavilion x360 / CND9012FQR", status="On hold",
                alternate_job_no=None, problem_reported="Hinge broken, keyboard sticking.",
                remarks="Awaiting customer approval for the estimate.",
                qty=1, job_type_name="Repair", receive_manner_name="Courier",
                receive_condition_name="Hinge visibly loose", warranty_card_no=None, purchase_date="19 Jun 2023",
            ),
        ],
    )
    _write("batch", batch)

    # A big batch, to sanity-check the layout doesn't fall apart with more rows
    # than fit on one screen/page.
    big_batch = _JobIntakeData(
        batch_no=142,
        job_no=None,
        bu_name="Cellcare Services",
        branch_name="Park Street Branch",
        branch_address="22 Park Street, Kolkata, West Bengal, 700016",
        branch_phone="033-4009 8811",
        branch_email="parkstreet@cellcareservices.example",
        branch_gstin=None,
        customer_name="Anjali Bose Chowdhury",
        customer_mobile="9830011223",
        customer_address=None,
        received_date="30 Aug 2026",
        amount_payable=0,
        terms_and_conditions=_TERMS,
        items=[
            _JobIntakeItem(
                job_no=f"JOB-{3000 + i}", device=f"Brand {i} / Model {i}", status="Received",
                alternate_job_no=None,
                problem_reported=f"Reported issue #{i} — device not functioning as expected." if i % 3 == 0 else None,
                remarks=None, qty=1, job_type_name="Repair", receive_manner_name="Walk-in",
                receive_condition_name=None, warranty_card_no=None, purchase_date=None,
            )
            for i in range(12)
        ],
    )
    _write("big_batch", big_batch)

    print(f"\nAll previews written to {OUT_DIR}/")


if __name__ == "__main__":
    main()
