"""Local preview for the Money Receipt PDF (app/routers/public/job_money_receipt_router.py)
— no server, no DB required.

`_build_receipt_pdf` is a pure function of `_ReceiptData`, so this just
constructs a representative payload and writes the PDF straight to disk for
you to open in a viewer.

Usage (from service-plus-server/, inside your venv):
    python scripts/preview_job_money_receipt.py
    xdg-open /tmp/job-money-receipt-preview/single.pdf

Output goes to /tmp, not inside the repo. Pass a different directory as the
one CLI argument if you want it somewhere else.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.routers.public.job_money_receipt_router import _build_receipt_pdf, _ReceiptData  # noqa: E402

OUT_DIR = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/tmp/job-money-receipt-preview")


def _write(name: str, data: _ReceiptData) -> None:
    OUT_DIR.mkdir(exist_ok=True)
    pdf_path = OUT_DIR / f"{name}.pdf"
    pdf_path.write_bytes(_build_receipt_pdf(data))
    print(f"wrote {pdf_path}")


def main() -> None:
    single = _ReceiptData(
        receipt_no="MR/00015",
        payment_date="2026-09-03",
        payment_mode="UPI",
        amount=14813.00,
        reference_no=None,
        remarks=None,
        job_no="N/00016",
        alternate_job_no="JE1122758",
        job_date="2026-09-03",
        branch_name="Head Office",
        division_name="Nav Technology Pvt Ltd",
        division_phone=None,
        division_email=None,
        division_gstin="19AABCN7935M1ZU",
        division_address="130A Bagmari Road, Scheme VII M, Kolkata, Pin: 700054",
        customer_name="Leo Nelson Xavier",
        customer_mobile="9830815413",
        customer_address="2A, onrait, 2nd lane, entllay, entllay post office kolkata, KOLKATA, West Bengal, Pin: 700014",
    )
    _write("single", single)

    # Edge cases: no receipt no yet, no alternate job no, ref no + remarks present.
    minimal = _ReceiptData(
        receipt_no=None,
        payment_date="2026-08-13",
        payment_mode="Cash",
        amount=1000.00,
        reference_no="CHQ-4521",
        remarks="Partial payment",
        job_no="JOB-2002",
        alternate_job_no=None,
        job_date="2026-08-10",
        branch_name="MG Road Branch",
        division_name=None,
        division_phone="080-4123 5566",
        division_email="mgroad@cellcareservices.example",
        division_gstin=None,
        division_address=None,
        customer_name="Priya Das",
        customer_mobile=None,
        customer_address=None,
    )
    _write("minimal", minimal)

    print(f"\nAll previews written to {OUT_DIR}/")


if __name__ == "__main__":
    main()
