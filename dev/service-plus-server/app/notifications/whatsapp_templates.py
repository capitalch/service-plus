"""BSP-approved WhatsApp template config. Deployed as code, not a database table —
whoever changes a template here is trusted to keep it in sync with what's actually
approved on the BSP side.
"""

from dataclasses import dataclass


@dataclass
class TemplateSpec:
    """One BSP-approved WhatsApp template."""

    name: str  # BSP-approved template name
    language: str
    has_document: bool  # whether this template expects a document header (a PDF)
    params: list[str]  # ordered placeholder names, must match the approved template's slot count


TEMPLATES: dict[str, TemplateSpec] = {
    "JOB_CREATION": TemplateSpec(
        name="job_creation_v1",
        language="en",
        has_document=True,
        params=["customer_name", "job_no", "branch_name"],
    ),
    "JOB_COMPLETION": TemplateSpec(
        name="job_completion_v1",
        language="en",
        has_document=False,
        params=["customer_name", "job_nos", "amount"],
    ),
    "JOB_DELIVERY": TemplateSpec(
        name="job_delivery_v1",
        language="en",
        has_document=True,
        params=["customer_name", "job_no", "amount"],
    ),
    "JOB_RECEIPT": TemplateSpec(
        name="job_receipt_v1",
        language="en",
        has_document=True,
        params=["customer_name", "receipt_no", "amount", "payment_mode"],
    ),
}
