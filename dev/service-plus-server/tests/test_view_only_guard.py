"""The view-only guard (plans/plan.md Step 11) — no DB: the billing lookup is stubbed.

The classification test keeps every mutation in exactly one of two lists, so a new
mutation cannot slip past the guard unnoticed: add it to GUARDED (it writes BU data and
must call require_bu_writable) or to ALLOWED (login-free, security, provisioning, Super
Admin, payment and plan work that view-only must not block).
"""
import asyncio
import inspect
from datetime import date
from types import SimpleNamespace

import pytest

from app.core.exceptions import AuthorizationException
from app.graphql.resolvers import mutation as mutation_module
from app.graphql.resolvers.auth_guards import require_bu_writable
from app.services import bu_billing
from app.services.bu_billing import billing_summary

GUARDED = {
    "accountsPosting",
    "addBranch",
    "addEwFollowUp",
    "createJobBatch",
    "createJobInvoice",
    "createJobPayment",
    "createSalesInvoice",
    "createSingleJob",
    "deleteJobBatch",
    "deleteUnusedPartsByBrand",
    "deliverJob",
    "genericUpdate",
    "genericUpdateScript",
    "importSpareParts",
    "regenerateJobInvoice",
    "resendEwLeadAlert",
    "sendEwReminders",
    "sendWhatsappCompletion",
    "sendWhatsappJobDelivery",
    "sendWhatsappJobIntake",
    "sendWhatsappJobInvoice",
    "sendWhatsappMoneyReceipt",
    "setJobDeliveryManualConfirmation",
    "transitionEwLead",
    "undeliverJob",
    "undoJobTransaction",
    "updateJob",
    "updateJobBatch",
    "updateOpeningJob",
    "verifyJobDeliveryOtp",
}

ALLOWED = {
    "approveSalesEnquiry",
    "changeBuPlan",
    "createAdminUser",
    "createBuSchemaAndFeedSeedData",
    "createBusinessUser",
    "createClient",
    "createServiceDb",
    "extendClientPaidThrough",
    "deleteBuSchema",
    "deleteClient",
    "dropDatabase",
    "feedBuSeedData",
    "mailAdminCredentials",
    "mailBusinessUserCredentials",
    "markEnterpriseEnquiryContacted",
    "markEnterpriseEnquiryPaymentFailed",
    "markSalesEnquiryPaymentFailed",
    "provisionEnterpriseEnquiry",
    "recordBuSubscriptionPayment",
    "recordClientSubscriptionPayment",
    "recordEnterpriseEnquiryPayment",
    "recordSalesEnquiryPayment",
    "rejectEnterpriseEnquiry",
    "rejectSalesEnquiry",
    "seedSecurityData",
    "setClientBillingHold",
    "setClientMonthlyFee",
    "setEnterpriseEnquiryFee",
    "startClientBilling",
    "setUserBuRole",
}


def _mutations() -> dict:
    return dict(mutation_module.mutation._resolvers)  # pylint: disable=protected-access


def test_every_mutation_is_classified_once():
    names = set(_mutations())
    assert not GUARDED & ALLOWED
    assert names - GUARDED - ALLOWED == set(), "classify the new mutation(s) in GUARDED or ALLOWED"
    assert (GUARDED | ALLOWED) - names == set(), "remove deleted mutation(s) from the lists"


def test_guarded_mutations_call_the_view_only_guard():
    resolvers = _mutations()
    missing = [n for n in GUARDED if "require_bu_writable(info" not in inspect.getsource(inspect.unwrap(resolvers[n]))]
    assert not missing, f"Missing require_bu_writable: {missing}"


def test_allowed_mutations_do_not():
    resolvers = _mutations()
    blocked = [n for n in ALLOWED if "require_bu_writable" in inspect.getsource(inspect.unwrap(resolvers[n]))]
    assert not blocked


# ── require_bu_writable ──────────────────────────────────────────────────────

def _info(**context):
    return SimpleNamespace(context=context)


def _stub(monkeypatch, status):
    calls = []

    async def fake(db_name, schema):
        calls.append((db_name, schema))
        return {"branchLimit": None, "paidThrough": "2026-10-01", "planCode": "basic", "status": status}

    monkeypatch.setattr(bu_billing, "get_bu_billing", fake)
    return calls


def test_read_only_bu_is_refused_with_paid_through(monkeypatch):
    _stub(monkeypatch, "read_only")
    with pytest.raises(AuthorizationException) as exc:
        asyncio.run(require_bu_writable(_info(user_type="B"), "service_plus_customers", "acme"))
    assert exc.value.code == "SUBSCRIPTION_READ_ONLY"
    assert exc.value.extensions["paidThrough"] == "2026-10-01"


def test_admin_is_refused_too(monkeypatch):
    _stub(monkeypatch, "read_only")
    with pytest.raises(AuthorizationException):
        asyncio.run(require_bu_writable(_info(user_type="A"), "service_plus_customers", "acme"))


@pytest.mark.parametrize("status", ["active", "due_soon", "not_billed"])
def test_writable_statuses_pass(monkeypatch, status):
    _stub(monkeypatch, status)
    asyncio.run(require_bu_writable(_info(user_type="B"), "service_plus_customers", "acme"))


@pytest.mark.parametrize("schema", ["security", "public", "", None])
def test_tenant_wide_schemas_are_never_checked(monkeypatch, schema):
    calls = _stub(monkeypatch, "read_only")
    asyncio.run(require_bu_writable(_info(user_type="B"), "service_plus_customers", schema))
    assert calls == []


def test_super_admin_is_exempt(monkeypatch):
    calls = _stub(monkeypatch, "read_only")
    asyncio.run(require_bu_writable(_info(user_type="S"), "service_plus_customers", "acme"))
    assert calls == []


# ── billing_summary ───────────────────────────────────────────────────────────

def test_summary_of_a_missing_bu_is_not_billed():
    assert billing_summary(None, date(2026, 10, 3))["status"] == "not_billed"


def test_summary_of_an_unpaid_billed_bu_is_read_only():
    row = {"billing_required": True, "branch_limit": 1, "paid_through": None, "plan_code": "basic"}
    summary = billing_summary(row, date(2026, 10, 3))
    assert summary == {"branchLimit": 1, "paidThrough": None, "planCode": "basic", "status": "read_only"}


def test_summary_dates_are_iso_text():
    row = {"billing_required": True, "paid_through": date(2026, 12, 31), "plan_code": "standard"}
    assert billing_summary(row, date(2026, 10, 3))["paidThrough"] == "2026-12-31"
