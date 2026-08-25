"""Meta-approved WhatsApp template config. Deployed as code, not a database table —
whoever changes a template here is trusted to keep it in sync with what's actually
approved on Meta's side.
"""

from dataclasses import dataclass


@dataclass
class TemplateSpec:
    """One Meta-approved WhatsApp template. Named parameters only — Meta rejects
    positional (`{{1}}`) placeholders outright, and a template is either all-named
    or all-positional, never mixed."""

    name: str
    language: str
    category: str
    header_params: list[str]
    body_params: list[str]


TEMPLATES: dict[str, TemplateSpec] = {
    "JOB_COMPLETION": TemplateSpec(
        name="job_completed_ready_for_pickup_v2",
        language="en",
        category="UTILITY",
        header_params=["business_unit"],
        body_params=[
            "customer_name",
            "job_no",
            "device",
            "branch_name",
            "amount_payable",
            "branch_contact",
            "business_unit",
        ],
    ),
}
