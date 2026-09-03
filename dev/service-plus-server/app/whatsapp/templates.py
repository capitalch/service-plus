"""Meta-approved WhatsApp template config. Deployed as code, not a database table —
whoever changes a template here is trusted to keep it in sync with what's actually
approved on Meta's side.
"""

from dataclasses import dataclass


@dataclass
class TemplateSpec:
    """One Meta-approved WhatsApp template.

    Header/body use **named** parameters for `category="UTILITY"` (and
    Marketing) templates — Meta rejects positional (`{{1}}`) placeholders
    outright there, and a component is either all-named or all-positional,
    never mixed (`header_params`/`body_params` below list the names, in
    order). `category="AUTHENTICATION"` templates are the exception: Meta
    supplies the body wording itself (not authored here), takes positional
    parameters only, and has no header component at all — `header_params=[]`
    signals that to `client.py`'s `send_template()`, which skips the header
    component entirely rather than sending one with no parameters.

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
    # Two separate Meta sends for one logical event, not one template — Meta's own
    # category classifier flags any body containing a numeric "confirmation code"
    # variable as Authentication, and will reject it if submitted as Utility
    # regardless of what else is in the message (confirmed directly in Meta's
    # template editor, 2026-09-02: "Category does not match... This message
    # template will be rejected"). Splitting is not a style choice — it's the only
    # way to keep the rich delivery summary (which is genuinely Utility content)
    # without the OTP code poisoning its classification. See plans/plan.md's
    # Step 3 for the full two-send design.
    "JOB_DELIVERY": TemplateSpec(
        name="job_delivery_notice_v1",
        language="en",
        category="UTILITY",
        header_params=["business_unit"],
        body_params=[
            "customer_name",
            "reference_line",
            "amount_line",
            "branch_name",
            "branch_contact",
        ],
        # "Download Delivery Note" / "Download Invoice" — same "one token, two
        # routes" trick JOB_CREATION's two buttons already use.
        button_count=2,
    ),
    # The OTP itself, alone — Authentication category, Meta's fixed body format
    # (not authored here the way Utility/Marketing body text is; Meta supplies
    # the wording, we only supply the code value). No header component exists on
    # this category at all. Approved by Meta with a "Copy Code" button (2026-09-02)
    # — purely a client-side convenience for the customer (copies the code to
    # their clipboard; no callback, nothing for our server to handle), which our
    # verbal-readout flow doesn't need but can't opt out of, since Meta requires
    # some button on this category. `button_count=1` here reuses the same code
    # value already sent as the body's one positional parameter — see
    # client.py's Authentication button branch, which sends it in the URL-button
    # shape Meta creates this button as.
    "JOB_DELIVERY_OTP": TemplateSpec(
        name="job_delivery_otp_v1",
        language="en",
        category="AUTHENTICATION",
        header_params=[],
        body_params=["otp_code"],
        button_count=1,
    ),
    # One send per job_payment row, not per job — a job can have several
    # receipts, each triggered independently from the Receipts grid. Plain
    # Utility, no companion Authentication send: nothing in this body is a
    # numeric confirmation code, so none of JOB_DELIVERY's classification risk
    # applies here (plans/plan.md, Step 3 v2 in plan-delivery.md is the
    # cautionary tale). Approved by Meta 2026-09-03.
    "JOB_MONEY_RECEIPT": TemplateSpec(
        name="job_money_receipt_v1",
        language="en",
        category="UTILITY",
        header_params=["business_unit"],
        body_params=[
            "customer_name",
            "amount_line",
            "payment_mode",
            "payment_date",
            "reference_line",
            "receipt_no",
            "branch_name",
            "branch_contact",
        ],
        # "Download Money Receipt" — single dynamic-URL button, same
        # bare-prefix-no-placeholder registration discipline the other
        # dynamic-URL buttons already needed.
        button_count=1,
    ),
}
