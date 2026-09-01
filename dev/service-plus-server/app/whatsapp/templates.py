"""Meta-approved WhatsApp template config. Deployed as code, not a database table —
whoever changes a template here is trusted to keep it in sync with what's actually
approved on Meta's side.
"""

from dataclasses import dataclass


@dataclass
class TemplateSpec:
    """One Meta-approved WhatsApp template.

    Header/body use **named** parameters — Meta rejects positional (`{{1}}`)
    placeholders outright there, and a component is either all-named or
    all-positional, never mixed (`header_params`/`body_params` below list the
    names, in order).

    Button URL variables are a different story, worked out the hard way against
    two real, broken production sends (2026-08-30): a `{{token}}`-named variable
    was stored as literal text and the sent value just appended after it; the
    documented positional form `{{1}}` failed *identically* — also stored as
    literal text, also just appended after. Both attempts produced the exact same
    "leftover placeholder + appended value" URL, which points away from any
    in-text placeholder syntax working at all for buttons — the current theory
    (untested as of this writing) is that the "Dynamic URL" type alone drives the
    append behavior, and the URL text field is purely a static prefix with no
    placeholder needed. `button_count` below is just how many dynamic-URL buttons
    this template has (in button order) — there was never a real name to track for
    these, in any of the three attempts."""

    name: str
    language: str
    category: str
    header_params: list[str]
    body_params: list[str]
    # How many URL buttons carry a dynamic variable, in button order (index 0,
    # 1, ...) — 0 for a template with no buttons or only static ones, like
    # JOB_COMPLETION.
    button_count: int = 0


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
    # v1 (`{{token}}` named button variable) and its edited-in-place successor
    # (`{{1}}` positional) both shipped broken — see TemplateSpec's docstring
    # above. v2, created fresh since v1 could no longer be edited, registers both
    # button URLs with NO placeholder text in the field at all (just the fixed
    # prefix, URL type still "Dynamic") — current best theory, not yet confirmed
    # by a real send as of this writing. See plans/plan-whatsapp.md, "Meta
    # template" section, for the full registered wording, both button URLs, and
    # the sample URL registered per button for Meta's review preview.
    "JOB_CREATION": TemplateSpec(
        name="job_intake_notice_v2",
        language="en",
        category="UTILITY",
        header_params=["business_unit"],
        body_params=[
            "customer_name",
            "item_summary",
            "reference_line",
            "branch_name",
            "branch_contact",
            "business_unit",
        ],
        # Both buttons ("Check Repair Status", "Download Job Slip") carry the same
        # signed token as their one dynamic-URL variable — see
        # plans/plan-whatsapp.md, "Meta template" section, for the exact registered
        # button URLs and the "one token, no new parameter" rationale.
        button_count=2,
    ),
}
