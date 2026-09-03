"""Local preview for the Delivery Note and Invoice PDFs
(app/routers/public/job_delivery_router.py) — no server, no DB required.

`_build_delivery_note_pdf`/`_build_invoice_pdf` are pure functions of their
respective dataclasses, so this just constructs a couple of representative
payloads and writes the PDFs straight to disk for you to open in a viewer.
Re-run after every design tweak. The invoice sample data below mirrors the
manual, staff-triggered Tax Invoice format (deliver-job-pdf.ts's
drawInvoiceContent) this PDF was redesigned to match.

Usage (from service-plus-server/, inside your venv):
    python scripts/preview_job_delivery.py
    xdg-open /tmp/job-delivery-preview/single.pdf
    xdg-open /tmp/job-delivery-preview/invoice_single.pdf

Output goes to /tmp, not inside the repo. Pass a different directory as the one
CLI argument if you want it somewhere else.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.routers.public.job_delivery_router import (  # noqa: E402
    _build_delivery_note_pdf,
    _build_invoice_pdf,
    _DeliveryData,
    _DeliveryItem,
    _InvoiceData,
    _InvoiceJob,
    _InvoiceLine,
    _InvoicePayment,
)

OUT_DIR = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/tmp/job-delivery-preview")


def _write(name: str, pdf_bytes: bytes) -> None:
    OUT_DIR.mkdir(exist_ok=True)
    pdf_path = OUT_DIR / f"{name}.pdf"
    pdf_path.write_bytes(pdf_bytes)
    print(f"wrote {pdf_path}")


def main() -> None:
    single = _DeliveryData(
        bu_name="Cellcare Services",
        branch_name="MG Road Branch",
        branch_address="12 MG Road, Bengaluru, Karnataka, 560001",
        customer_name="Rahul Sharma",
        total_amount=1450.00,
        total_paid=1450.00,
        items=[
            _DeliveryItem(
                job_no="JOB-1024",
                device="Apple / iPhone 13 / A2482 / C7QX9K2LKX8N",
                serial_no="C7QX9K2LKX8N",
                batch_no=None,
            )
        ],
    )
    _write("single", _build_delivery_note_pdf(single))

    batch = _DeliveryData(
        bu_name="Cellcare Services",
        branch_name="Salt Lake Branch",
        branch_address="Sector V, Salt Lake, Kolkata, West Bengal, 700091",
        customer_name="Priya Das",
        total_amount=3200.00,
        total_paid=2000.00,
        items=[
            _DeliveryItem(
                job_no="JOB-2001", device="Samsung / Galaxy S21 / RZ8N40ABCDE",
                serial_no="RZ8N40ABCDE", batch_no=88,
            ),
            _DeliveryItem(
                job_no="JOB-2002", device="Dell / Inspiron 15 / 3520 / 5CD1234XYZ",
                serial_no="5CD1234XYZ", batch_no=88,
            ),
            _DeliveryItem(
                job_no="JOB-2003", device=None, serial_no=None, batch_no=None,
            ),
            _DeliveryItem(
                job_no="JOB-2004", device="OnePlus / Nord CE 3 Lite",
                serial_no=None, batch_no=88,
            ),
        ],
    )
    _write("batch", _build_delivery_note_pdf(batch))

    # ── Invoice preview — mirrors the manual "Capital Electronics" sample ──────
    invoice_single = _InvoiceData(
        bu_name="Capital Electronics",
        jobs=[
            _InvoiceJob(
                job_no="HO/00110",
                device="LED_TELEVISION Sony KD-55X8500F",
                serial_no="1234567",
                branch_name="Head Office",
                division_code="CAPITAL",
                division_name="Capital Electronics",
                division_address="12, J. L. Nehru Road, Esplanade, Below Peerless Inn Hotel, Pin: 700013",
                division_phone="9831052332",
                division_email="capitalch@gmail.com",
                division_gstin="27ABCDE1234F2Z5",
                division_web_site="https://capitalch.com",
                division_gst_state_code="19",
                customer_name="ALI IMAM",
                customer_mobile="9831052332",
                customer_gstin=None,
                customer_email=None,
                customer_address="130A BAGMARI ROAD, KOLKATA, West Bengal, Pin: 700054",
                invoice_no="CAP/00086",
                invoice_date="2/9/2026",
                aggregate=3311.86,
                cgst=298.07,
                sgst=298.07,
                igst=0.0,
                total=3908.00,
                paid_amount=3908.00,
                lines=[
                    _InvoiceLine(
                        description="lcd panel", part_code="181220022", hsn_code="92099400",
                        qty=1.0, price=1533.90, aggregate=1533.90, gst_rate=18.0,
                        tax_amount=276.10, line_amount=1810.00,
                    ),
                    _InvoiceLine(
                        description="Labour Charge", part_code=None, hsn_code="998726",
                        qty=1.0, price=500.00, aggregate=500.00, gst_rate=18.0,
                        tax_amount=90.00, line_amount=590.00,
                    ),
                    _InvoiceLine(
                        description="Transporting Charge", part_code=None, hsn_code="998726",
                        qty=1.0, price=600.00, aggregate=600.00, gst_rate=18.0,
                        tax_amount=108.00, line_amount=708.00,
                    ),
                    _InvoiceLine(
                        description="Speaker repairs", part_code=None, hsn_code="998726",
                        qty=1.0, price=254.24, aggregate=254.24, gst_rate=18.0,
                        tax_amount=45.76, line_amount=300.00,
                    ),
                    _InvoiceLine(
                        description="Spare Parts", part_code="12345678, LM130, PA76, GW-92", hsn_code="998726",
                        qty=1.0, price=423.73, aggregate=423.72, gst_rate=18.0,
                        tax_amount=76.28, line_amount=500.00,
                    ),
                ],
                payments=[
                    _InvoicePayment(payment_date="2026-09-01", payment_mode="Cash", reference_no=None, remarks=None, amount=2908.00),
                    _InvoicePayment(payment_date="2026-08-13", payment_mode="UPI", reference_no=None, remarks=None, amount=1000.00),
                ],
            )
        ],
    )
    _write("invoice_single", _build_invoice_pdf(invoice_single))

    invoice_multi = _InvoiceData(
        bu_name="Cellcare Services",
        jobs=[
            *invoice_single.jobs,
            _InvoiceJob(
                job_no="JOB-2002",
                device="Dell / Inspiron 15 / 3520",
                serial_no="5CD1234XYZ",
                branch_name="Salt Lake Branch",
                division_code="CELL",
                division_name="Cellcare Services",
                division_address="Sector V, Salt Lake, Kolkata, West Bengal, Pin: 700091",
                division_phone="033-6612 4477",
                division_email="saltlake@cellcareservices.example",
                division_gstin="19PQRSX5678K1Z2",
                division_web_site=None,
                division_gst_state_code="19",
                customer_name="Priya Das",
                customer_mobile="9903456789",
                customer_gstin=None,
                customer_email=None,
                customer_address="22 Sector V, Salt Lake, Kolkata, West Bengal, Pin: 700091",
                invoice_no=None,
                invoice_date=None,
                aggregate=0.0,
                cgst=0.0,
                sgst=0.0,
                igst=0.0,
                total=None,
                paid_amount=0.0,
                lines=[],
                payments=[],
            ),
        ],
    )
    _write("invoice_multi", _build_invoice_pdf(invoice_multi))

    print(f"\nAll previews written to {OUT_DIR}/")


if __name__ == "__main__":
    main()
