"""Sales/accounts mutation resolvers: sales invoice creation and the
accounts-posting pipeline (money receipt / purchase / job / sales invoice
tran_h builders + trace-plus posting). Split from mutation_helper.py — see
plans/plan.md Step 4."""

import json
from datetime import date
from typing import Any
from urllib.parse import quote

import httpx
import psycopg.sql as pgsql
from psycopg.rows import dict_row

from app.config import settings
from app.db.connection.psycopg_driver import exec_sql, get_service_db_connection, process_data
from app.db.sql.sql_base import SqlStore
from app.core.exceptions import AppMessages, ValidationException
from app.graphql.pubsub import pubsub
from app.graphql.resolvers.shared.generic_query import _decode_value, _serialize_row
from app.logger import logger


async def resolve_create_sales_invoice_helper(
    db_name: str, schema: str = "public", value: str = ""
) -> Any:
    """
    Create a sales invoice and atomically generate the invoice number in a single transaction.

    The client sends the sql_object for the sales_invoice insert (with nested xDetails for
    lines and stock_transactions), plus top-level `branch_id` and `division_id` used to claim
    the next SALES_INVOICE sequence number server-side. The claim (UPDATE ... RETURNING) and
    the insert share one transaction, so a failed insert rolls back the claimed number and
    concurrent creates never collide.
    """
    payload = _decode_value(value, "createSalesInvoice")
    x_data = payload.get("xData", {})

    branch_id = payload.pop("branch_id", None)
    division_id = payload.pop("division_id", None)

    if not branch_id or not division_id:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "branch_id/division_id"},
        )

    db_name_arg: str = db_name or ""
    schema_name = schema or "public"

    async with get_service_db_connection(db_name_arg) as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema_name))
            )

            # 1. Claim next invoice number atomically
            await cur.execute(
                SqlStore.CLAIM_NEXT_SALES_INVOICE_NUMBER,
                {"branch_id": branch_id, "division_id": division_id},
            )
            seq = await cur.fetchone()
            if not seq:
                raise ValidationException(
                    message=AppMessages.RESOURCE_NOT_FOUND,
                    extensions={
                        "detail": "SALES_INVOICE sequence not configured for this division"
                    },
                )

            # 2. Format invoice number
            invoice_no = (
                f"{seq['prefix'] or ''}"
                f"{seq['separator'] or ''}"
                f"{str(seq['assigned_number']).zfill(seq['padding'] or 0)}"
            )
            x_data["invoice_no"] = invoice_no

            # 3. Insert sales_invoice + lines + stock_transactions in the same transaction
            record_id = await process_data(x_data, cur, "sales_invoice", None, None)
            logger.info("Sales invoice created id=%s invoice_no=%s", record_id, invoice_no)

    return record_id

def _build_money_receipt_tran_h(
    row: dict, debit_account_id: Any, credit_account_id: Any, branch_id: Any
) -> dict:
    """Build a single money-receipt TranH voucher from a serialized job_payment row."""
    detail_entry_c: dict = {"accId": int(debit_account_id),  "dc": "D", "amount": row["amount"]}
    detail_entry_d: dict = {"accId": int(credit_account_id), "dc": "C", "amount": row["amount"]}
    for entry in (detail_entry_c, detail_entry_d):
        if row.get("remarks"):
            entry["remarks"]   = row["remarks"]
        entry["lineRefNo"] = "Service+ Posting"
        if row.get("reference_no"):
            entry["instrNo"]   = row["reference_no"]

    fin_year = int(str(row.get("payment_date", str(date.today())))[:4])

    x_data: dict = {
        "tranDate":   row["payment_date"],
        "tranTypeId": 3,
        "finYearId":  fin_year,
        "branchId":   branch_id,
        "posId":      1,
        "xDetails": [{
            "tableName": "TranD",
            "fkeyName":  "tranHeaderId",
            "xData":     [detail_entry_c, detail_entry_d],
        }],
    }
    if row.get("receipt_no"):
        x_data["userRefNo"] = row["receipt_no"]
    remarks_parts = [p for p in [
        f"JOB:{row['job_no']}" if row.get("job_no") else None,
        row.get("customer_name"),
        f"Mobile:{row['customer_mobile']}" if row.get("customer_mobile") else None,
        f"GSTIN:{row['customer_gstin']}" if row.get("customer_gstin") else None,
        f"Address:{row['customer_address']}" if row.get("customer_address") else None,
        f"PIN:{row['customer_pin']}" if row.get("customer_pin") else None,
    ] if p]
    if remarks_parts:
        x_data["remarks"] = ", ".join(remarks_parts)
    return x_data

def _build_purchase_invoice_tran_h(
    pi_row: dict,
    pi_debit_acc_id: Any,
    pi_credit_acc_id: Any,
    pi_product_id: Any,
    pi_default_hsn: Any,
    pi_default_gst: Any,
    is_gst_division: bool,
    branch_id: Any,
) -> dict:
    """Build a single purchase-invoice TranH voucher from a serialized purchase_invoice row."""
    pi_lines = pi_row.get("lines") or []

    sale_purchase_lines = []
    for line in pi_lines:
        spd: dict = {
            "productId": int(pi_product_id),
            "qty":       float(line["qty"]),
            "price":     float(line["unit_price"]),
            "priceGst":  (float(line["total_amount"]) / float(line["qty"])
                          if line.get("qty") else 0),
            "amount":    float(line["total_amount"]),
            "hsn":       (line.get("hsn_code")
                          or (str(pi_default_hsn) if is_gst_division and pi_default_hsn else "0")),
            "gstRate":   (float(line["gst_rate"]) if line.get("gst_rate")
                          else (float(pi_default_gst) if is_gst_division and pi_default_gst else 0)),
        }
        if line.get("part_code"):
            spd["jData"] = json.dumps({"remarks": f"Part Code: {line['part_code']}"})
        for out_key, db_key in [
            ("cgst", "cgst_amount"),
            ("sgst", "sgst_amount"),
            ("igst", "igst_amount"),
        ]:
            if line.get(db_key) is not None:
                spd[out_key] = float(line[db_key])
        sale_purchase_lines.append(spd)

    ext_gst: dict = {"isInput": True}
    if pi_row.get("supplier_gstin"):
        ext_gst["gstin"] = pi_row["supplier_gstin"]
    for out_key, db_key in [
        ("cgst", "cgst_amount"),
        ("sgst", "sgst_amount"),
        ("igst", "igst_amount"),
    ]:
        if pi_row.get(db_key) is not None:
            ext_gst[out_key] = float(pi_row[db_key])

    debit_pi: dict = {
        "accId":  int(pi_debit_acc_id),
        "dc":     "D",
        "amount": float(pi_row["total_amount"]),
        "xDetails": [
            {"tableName": "ExtGstTranD",
             "fkeyName":  "tranDetailsId",
             "xData":     ext_gst},
            {"tableName": "SalePurchaseDetails",
             "fkeyName":  "tranDetailsId",
             "xData":     sale_purchase_lines},
        ],
    }
    credit_pi: dict = {
        "accId":  int(pi_credit_acc_id),
        "dc":     "C",
        "amount": float(pi_row["total_amount"]),
    }

    pi_fin_year = int(str(pi_row.get("invoice_date", str(date.today())))[:4])
    pi_x_data: dict = {
        "tranDate":   pi_row["invoice_date"],
        "tranTypeId": 5,
        "finYearId":  pi_fin_year,
        "branchId":   branch_id,
        "posId":      1,
        "xDetails": [{
            "tableName": "TranD",
            "fkeyName":  "tranHeaderId",
            "xData":     [debit_pi, credit_pi],
        }],
    }
    if pi_row.get("invoice_no"):
        pi_x_data["userRefNo"] = pi_row["invoice_no"]
    vendor_address_parts = [p for p in [
        pi_row.get("supplier_address_line1"),
        pi_row.get("supplier_address_line2"),
        pi_row.get("supplier_city"),
        pi_row.get("supplier_state"),
        f"PIN:{pi_row['supplier_pincode']}" if pi_row.get("supplier_pincode") else None,
    ] if p]
    if vendor_address_parts:
        pi_x_data["remarks"] = ", ".join(vendor_address_parts)
    return pi_x_data

def _build_job_invoice_tran_h(
    ji_row: dict,
    ji_debit_acc_id: Any,
    ji_credit_acc_id: Any,
    ji_product_id: Any,
    ji_default_hsn: Any,
    ji_default_gst: Any,
    is_gst_division: bool,
    branch_id: Any,
    contacts_id: Any = None,
) -> dict:
    """Build a single job-invoice TranH voucher (tranTypeId=4, output GST)."""
    ji_lines = ji_row.get("lines") or []

    sale_lines = []
    for line in ji_lines:
        spd: dict = {
            "productId": int(ji_product_id),
            # Post each line as a single unit so job_invoice_line.amount maps 1:1
            # into trace-plus's priceGst. Trace's edit form re-derives the line
            # total as round(qty * priceGst, 2); with qty=1 that reproduces the
            # posted amount exactly, so the grid and edit-form totals match. See
            # plans/plan.md.
            "qty":       1,
            "price":     float(line["aggregate"]),
            "priceGst":  float(line["amount"]),
            "amount":    float(line["amount"]),
            "hsn":       (line.get("hsn_code")
                          or (str(ji_default_hsn) if is_gst_division and ji_default_hsn else "0")),
            "gstRate":   (float(line["gst_rate"]) if line.get("gst_rate")
                          else (float(ji_default_gst) if is_gst_division and ji_default_gst else 0)),
        }
        if line.get("part_code"):
            spd["jData"] = json.dumps({"remarks": f"Part Code: {line['part_code']}, {line.get('description', '')}"})
        elif line.get("description"):
            spd["jData"] = json.dumps({"remarks": line["description"]})
        for out_key, db_key in [
            ("cgst", "cgst_amount"),
            ("sgst", "sgst_amount"),
            ("igst", "igst_amount"),
        ]:
            if line.get(db_key) is not None:
                spd[out_key] = float(line[db_key])
        sale_lines.append(spd)

    ext_gst: dict = {"isInput": False}
    if ji_row.get("customer_gstin"):
        ext_gst["gstin"] = ji_row["customer_gstin"]
    for out_key, db_key in [
        ("cgst", "cgst_amount"),
        ("sgst", "sgst_amount"),
        ("igst", "igst_amount"),
    ]:
        if ji_row.get(db_key) is not None:
            ext_gst[out_key] = float(ji_row[db_key])

    debit_ji: dict = {
        "accId":  int(ji_debit_acc_id),
        "dc":     "D",
        "amount": float(ji_row["amount"]),
        "xDetails": [
            {"tableName": "ExtGstTranD",
             "fkeyName":  "tranDetailsId",
             "xData":     ext_gst},
            {"tableName": "SalePurchaseDetails",
             "fkeyName":  "tranDetailsId",
             "xData":     sale_lines},
        ],
    }
    credit_ji: dict = {
        "accId":  int(ji_credit_acc_id),
        "dc":     "C",
        "amount": float(ji_row["amount"]),
    }

    ji_fin_year = int(str(ji_row.get("invoice_date", str(date.today())))[:4])
    ji_x_data: dict = {
        "tranDate":   ji_row["invoice_date"],
        "tranTypeId": 4,
        "finYearId":  ji_fin_year,
        "branchId":   branch_id,
        "posId":      1,
        "xDetails": [{
            "tableName": "TranD",
            "fkeyName":  "tranHeaderId",
            "xData":     [debit_ji, credit_ji],
        }],
    }
    if ji_row.get("invoice_no"):
        ji_x_data["userRefNo"] = ji_row["invoice_no"]
    if contacts_id:
        ji_x_data["contactsId"] = int(contacts_id)
    remarks_parts = [p for p in [
        f"JOB:{ji_row['job_no']}" if ji_row.get("job_no") else None,
        ji_row.get("customer_name"),
        f"Mobile:{ji_row['mobile']}" if ji_row.get("mobile") else None,
        ji_row.get("customer_address") or None,
        f"PIN:{ji_row['customer_pin']}" if ji_row.get("customer_pin") else None,
    ] if p]
    if remarks_parts:
        ji_x_data["remarks"] = ", ".join(remarks_parts)
    return ji_x_data

def _build_sales_invoice_tran_h(
    si_row: dict,
    si_debit_acc_id: Any,
    si_credit_acc_id: Any,
    si_product_id: Any,
    si_default_hsn: Any,
    si_default_gst: Any,
    is_gst_division: bool,
    branch_id: Any,
    contacts_id: Any = None,
) -> dict:
    """Build a single sales-invoice TranH voucher (tranTypeId=4/9, output GST)."""
    si_lines = si_row.get("lines") or []

    sale_lines = []
    for line in si_lines:
        spd: dict = {
            "productId": int(si_product_id),
            "qty":       float(line["qty"]),
            "price":     float(line["unit_price"]),
            "priceGst":  (float(line["total_amount"]) / float(line["qty"])
                          if line.get("qty") else 0),
            "amount":    float(line["total_amount"]),
            "hsn":       (line.get("hsn_code")
                          or (str(si_default_hsn) if is_gst_division and si_default_hsn else "0")),
            "gstRate":   (float(line["gst_rate"]) if line.get("gst_rate")
                          else (float(si_default_gst) if is_gst_division and si_default_gst else 0)),
        }
        if line.get("part_code"):
            spd["jData"] = json.dumps({"remarks": f"Part Code: {line['part_code']}, {line.get('part_name', '')}"})
        elif line.get("item_description"):
            spd["jData"] = json.dumps({"remarks": line["item_description"]})
        for out_key, db_key in [
            ("cgst", "cgst_amount"),
            ("sgst", "sgst_amount"),
            ("igst", "igst_amount"),
        ]:
            if line.get(db_key) is not None:
                spd[out_key] = float(line[db_key])
        sale_lines.append(spd)

    ext_gst: dict = {"isInput": False}
    if si_row.get("customer_gstin"):
        ext_gst["gstin"] = si_row["customer_gstin"]
    for out_key, db_key in [
        ("cgst", "cgst_amount"),
        ("sgst", "sgst_amount"),
        ("igst", "igst_amount"),
    ]:
        if si_row.get(db_key) is not None:
            ext_gst[out_key] = float(si_row[db_key])

    debit_si: dict = {
        "accId":  int(si_debit_acc_id),
        "dc":     "D",
        "amount": float(si_row["total_amount"]),
        "xDetails": [
            {"tableName": "ExtGstTranD",
             "fkeyName":  "tranDetailsId",
             "xData":     ext_gst},
            {"tableName": "SalePurchaseDetails",
             "fkeyName":  "tranDetailsId",
             "xData":     sale_lines},
        ],
    }
    credit_si: dict = {
        "accId":  int(si_credit_acc_id),
        "dc":     "C",
        "amount": float(si_row["total_amount"]),
    }

    tran_type_id = 9 if si_row.get("is_return") else 4
    si_fin_year = int(str(si_row.get("invoice_date", str(date.today())))[:4])
    si_x_data: dict = {
        "tranDate":   si_row["invoice_date"],
        "tranTypeId": tran_type_id,
        "finYearId":  si_fin_year,
        "branchId":   branch_id,
        "posId":      1,
        "xDetails": [{
            "tableName": "TranD",
            "fkeyName":  "tranHeaderId",
            "xData":     [debit_si, credit_si],
        }],
    }
    if si_row.get("invoice_no"):
        si_x_data["userRefNo"] = si_row["invoice_no"]
    if contacts_id:
        si_x_data["contactsId"] = int(contacts_id)
    remarks_parts = [p for p in [
        "Sale Return" if si_row.get("is_return") else "Sale Invoice",
        si_row.get("customer_name"),
        f"Mobile:{si_row['mobile']}" if si_row.get("mobile") else None,
        si_row.get("customer_address") or None,
        f"PIN:{si_row['customer_pin']}" if si_row.get("customer_pin") else None,
        f"GSTIN:{si_row['customer_gstin']}" if si_row.get("customer_gstin") else None,
    ] if p]
    if remarks_parts:
        si_x_data["remarks"] = ", ".join(remarks_parts)
    return si_x_data

async def _post_tran_h_to_trace_plus(
    http_client: httpx.AsyncClient,
    client_code: str,
    bu_code: str,
    tran_h: dict,
) -> dict:
    """Post a single TranH voucher to trace-plus internal endpoint and return its result."""
    tran_h_payload = {
        "tableName": "TranH",
        "dbParams":  {"conn": ""},
        "xData":     [tran_h],
        "buCode":    bu_code,
    }
    trace_value = quote(json.dumps({
        "clientCode": client_code,
        "buCode":     bu_code,
        "data":       tran_h_payload,
    }))
    resp = await http_client.post(
        f"{settings.trace_plus_url}/api/internal/accounts-posting",
        json={"value": trace_value},
        headers={"X-Service-Key": settings.trace_plus_service_key},
        timeout=30.0,
    )
    resp.raise_for_status()
    return resp.json()

async def resolve_accounts_posting_helper(
    db_name: str, schema: str = "public", value: str = ""
) -> dict:
    """Post unposted money receipts, purchase invoices, job invoices, and sales invoices for every division in a branch.

    The server determines the divisions to post from the branch: each division with a
    valid account_setting and unposted data is posted separately, using its own account
    settings. Each record is posted in its own trace-plus call and marked
    ``is_posted = true`` only when its own post succeeds. A failing record is recorded and
    skipped so the remaining records still post (partial success, continue on error).
    """
    # pylint: disable=too-many-locals,too-many-branches,too-many-statements
    payload = _decode_value(value, "accountsPosting")
    branch_id_arg = payload.get("branchId")

    if not branch_id_arg:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "branchId"},
        )

    # 1. Get all divisions in the branch (includes account_setting)
    divisions = await exec_sql(
        db_name=db_name, schema=schema,
        sql=SqlStore.GET_DIVISIONS_BY_BRANCH,
        sql_args={"branch_id": branch_id_arg},
    )

    # 2. Build the work list: divisions with valid account settings AND unposted data.
    #    Divisions with incomplete settings or no unposted data are skipped silently.
    work: list[dict] = []
    total = 0
    for div in divisions:
        if not div.get("is_active"):
            continue
        account_setting   = div.get("account_setting") or {}
        client_code       = account_setting.get("clientCode", "")
        bu_code           = account_setting.get("buCode", "")
        branch_id         = account_setting.get("branchId")
        debit_account_id  = account_setting.get("receipt", {}).get("debitAccountId")
        credit_account_id = account_setting.get("receipt", {}).get("creditAccountId")
        if not (client_code and bu_code and branch_id
                and debit_account_id and credit_account_id):
            continue

        division_code = (div.get("code") or "").strip()
        is_gst_division = bool(div.get("gstin"))
        receipts = await exec_sql(
            db_name=db_name, schema=schema,
            sql=SqlStore.GET_UNPOSTED_MONEY_RECEIPTS,
            sql_args={"division_code": division_code},
        )
        pi_rows = await exec_sql(
            db_name=db_name, schema=schema,
            sql=SqlStore.GET_UNPOSTED_PURCHASE_INVOICES,
            sql_args={"division_code": division_code},
        )
        ji_rows = await exec_sql(
            db_name=db_name, schema=schema,
            sql=SqlStore.GET_UNPOSTED_JOB_INVOICES,
            sql_args={"division_code": division_code},
        )
        si_rows = await exec_sql(
            db_name=db_name, schema=schema,
            sql=SqlStore.GET_UNPOSTED_SALES_INVOICES,
            sql_args={"division_code": division_code},
        )
        if not receipts and not pi_rows and not ji_rows and not si_rows:
            continue

        pi_settings = account_setting.get("purchaseInvoice", {})
        ji_settings = account_setting.get("jobInvoice", {})
        si_settings = account_setting.get("salesInvoice", {})
        work.append({
            "division_code":     division_code,
            "division_name":     div.get("name") or division_code,
            "client_code":       client_code,
            "bu_code":           bu_code,
            "branch_id":         branch_id,
            "debit_account_id":  debit_account_id,
            "credit_account_id": credit_account_id,
            "is_gst_division":   is_gst_division,
            "pi_debit_acc_id":   pi_settings.get("debitAccountId"),
            "pi_credit_acc_id":  pi_settings.get("creditAccountId"),
            "pi_product_id":     pi_settings.get("productId"),
            "pi_default_hsn":    pi_settings.get("defaultProductHsn"),
            "pi_default_gst":    pi_settings.get("defaultGstRate"),
            "ji_debit_acc_id":   ji_settings.get("debitAccountId"),
            "ji_credit_acc_id":  ji_settings.get("creditAccountId"),
            "ji_product_id":     ji_settings.get("productId"),
            "ji_default_hsn":    ji_settings.get("defaultProductHsn"),
            "ji_default_gst":    ji_settings.get("defaultGstRate"),
            "ji_contacts_id":    ji_settings.get("contactsId"),
            "si_debit_acc_id":   si_settings.get("debitAccountId"),
            "si_credit_acc_id":  si_settings.get("creditAccountId"),
            "si_product_id":     si_settings.get("productId"),
            "si_default_hsn":    si_settings.get("defaultProductHsn"),
            "si_default_gst":    si_settings.get("defaultGstRate"),
            "si_contacts_id":    si_settings.get("contactsId"),
            "receipts":          receipts,
            "pi_rows":           pi_rows,
            "ji_rows":           ji_rows,
            "si_rows":           si_rows,
        })
        total += len(receipts) + len(pi_rows) + len(ji_rows) + len(si_rows)

    if not work:
        return {"message": "No unposted records found."}

    posted_money_receipts = 0
    posted_purchase_invoices = 0
    posted_job_invoices = 0
    posted_sales_invoices = 0
    failed: list[dict] = []

    async def publish_progress(
        current_ref: Any = None, current_division: str = "",
        done: bool = False, message: str = "",
    ) -> None:
        """Emit a progress event for live UI updates (best-effort, never fatal)."""
        try:
            await pubsub.publish("accounts_posting_progress", {
                "branchId":        str(branch_id_arg),
                "total":           total,
                "posted":          posted_money_receipts + posted_purchase_invoices + posted_job_invoices + posted_sales_invoices,
                "failed":          len(failed),
                "currentRef":      current_ref,
                "currentDivision": current_division,
                "done":            done,
                "message":         message,
            })
        except Exception as e:  # pylint: disable=broad-except
            logger.error("Failed to publish accounts posting progress: %s", e)

    # 3. Reuse a single HTTP client for the whole run
    async with httpx.AsyncClient() as http_client:
        for w in work:
            division_name = w["division_name"]
            # 4. Post each money receipt for this division, marking it on success
            for raw in w["receipts"]:
                row = _serialize_row(raw)
                try:
                    tran_h = _build_money_receipt_tran_h(
                        row, w["debit_account_id"], w["credit_account_id"], w["branch_id"]
                    )
                    await _post_tran_h_to_trace_plus(
                        http_client, w["client_code"], w["bu_code"], tran_h
                    )
                    await exec_sql(
                        db_name=db_name, schema=schema,
                        sql=SqlStore.MARK_MONEY_RECEIPT_POSTED,
                        sql_args={"id": row["id"]},
                    )
                    posted_money_receipts += 1
                except Exception as e:  # pylint: disable=broad-except
                    logger.error("Failed to post money receipt %s: %s", row.get("id"), e)
                    failed.append({
                        "type":  "moneyReceipt",
                        "id":    row.get("id"),
                        "ref":   row.get("receipt_no"),
                        "error": str(e),
                    })
                await publish_progress(
                    current_ref=row.get("receipt_no"), current_division=division_name
                )

            # 5. Post each purchase invoice (only if PI account settings are present)
            pi_settings_ok = bool(
                w["pi_debit_acc_id"] and w["pi_credit_acc_id"] and w["pi_product_id"]
            )
            for raw in w["pi_rows"]:
                pi_row = _serialize_row(raw)
                if not pi_settings_ok:
                    failed.append({
                        "type":  "purchaseInvoice",
                        "id":    pi_row.get("id"),
                        "ref":   pi_row.get("invoice_no"),
                        "error": "Skipped: purchaseInvoice account settings missing",
                    })
                    await publish_progress(
                        current_ref=pi_row.get("invoice_no"), current_division=division_name
                    )
                    continue
                try:
                    pi_tran_h = _build_purchase_invoice_tran_h(
                        pi_row, w["pi_debit_acc_id"], w["pi_credit_acc_id"], w["pi_product_id"],
                        w["pi_default_hsn"], w["pi_default_gst"], w["is_gst_division"], w["branch_id"],
                    )
                    await _post_tran_h_to_trace_plus(
                        http_client, w["client_code"], w["bu_code"], pi_tran_h
                    )
                    await exec_sql(
                        db_name=db_name, schema=schema,
                        sql=SqlStore.MARK_PURCHASE_INVOICE_POSTED,
                        sql_args={"id": pi_row["id"]},
                    )
                    posted_purchase_invoices += 1
                except Exception as e:  # pylint: disable=broad-except
                    logger.error("Failed to post purchase invoice %s: %s", pi_row.get("id"), e)
                    failed.append({
                        "type":  "purchaseInvoice",
                        "id":    pi_row.get("id"),
                        "ref":   pi_row.get("invoice_no"),
                        "error": str(e),
                    })
                await publish_progress(
                    current_ref=pi_row.get("invoice_no"), current_division=division_name
                )

            # 6. Post each job invoice (only if jobInvoice account settings are present)
            ji_settings_ok = bool(
                w["ji_debit_acc_id"] and w["ji_credit_acc_id"] and w["ji_product_id"]
            )
            for raw in w["ji_rows"]:
                ji_row = _serialize_row(raw)
                if not ji_settings_ok:
                    failed.append({
                        "type":  "jobInvoice",
                        "id":    ji_row.get("id"),
                        "ref":   ji_row.get("invoice_no"),
                        "error": "Skipped: jobInvoice account settings missing",
                    })
                    await publish_progress(
                        current_ref=ji_row.get("invoice_no"), current_division=division_name
                    )
                    continue
                try:
                    ji_tran_h = _build_job_invoice_tran_h(
                        ji_row, w["ji_debit_acc_id"], w["ji_credit_acc_id"], w["ji_product_id"],
                        w["ji_default_hsn"], w["ji_default_gst"], w["is_gst_division"], w["branch_id"],
                        contacts_id=w["ji_contacts_id"],
                    )
                    await _post_tran_h_to_trace_plus(
                        http_client, w["client_code"], w["bu_code"], ji_tran_h
                    )
                    await exec_sql(
                        db_name=db_name, schema=schema,
                        sql=SqlStore.MARK_JOB_INVOICE_POSTED,
                        sql_args={"id": ji_row["id"]},
                    )
                    posted_job_invoices += 1
                except Exception as e:  # pylint: disable=broad-except
                    logger.error("Failed to post job invoice %s: %s", ji_row.get("id"), e)
                    failed.append({
                        "type":  "jobInvoice",
                        "id":    ji_row.get("id"),
                        "ref":   ji_row.get("invoice_no"),
                        "error": str(e),
                    })
                await publish_progress(
                    current_ref=ji_row.get("invoice_no"), current_division=division_name
                )

            # 7. Post each sales invoice (only if salesInvoice account settings are present)
            si_settings_ok = bool(
                w["si_debit_acc_id"] and w["si_credit_acc_id"] and w["si_product_id"]
            )
            for raw in w["si_rows"]:
                si_row = _serialize_row(raw)
                if not si_settings_ok:
                    failed.append({
                        "type":  "salesInvoice",
                        "id":    si_row.get("id"),
                        "ref":   si_row.get("invoice_no"),
                        "error": "Skipped: salesInvoice account settings missing",
                    })
                    await publish_progress(
                        current_ref=si_row.get("invoice_no"), current_division=division_name
                    )
                    continue
                try:
                    si_tran_h = _build_sales_invoice_tran_h(
                        si_row, w["si_debit_acc_id"], w["si_credit_acc_id"], w["si_product_id"],
                        w["si_default_hsn"], w["si_default_gst"], w["is_gst_division"], w["branch_id"],
                        contacts_id=w["si_contacts_id"],
                    )
                    await _post_tran_h_to_trace_plus(
                        http_client, w["client_code"], w["bu_code"], si_tran_h
                    )
                    await exec_sql(
                        db_name=db_name, schema=schema,
                        sql=SqlStore.MARK_SALES_INVOICE_POSTED,
                        sql_args={"id": si_row["id"]},
                    )
                    posted_sales_invoices += 1
                except Exception as e:  # pylint: disable=broad-except
                    logger.error("Failed to post sales invoice %s: %s", si_row.get("id"), e)
                    failed.append({
                        "type":  "salesInvoice",
                        "id":    si_row.get("id"),
                        "ref":   si_row.get("invoice_no"),
                        "error": str(e),
                    })
                await publish_progress(
                    current_ref=si_row.get("invoice_no"), current_division=division_name
                )

    message = (
        f"Posted {posted_money_receipts} money receipt(s), "
        f"{posted_purchase_invoices} purchase invoice(s), "
        f"{posted_job_invoices} job invoice(s), and "
        f"{posted_sales_invoices} sales invoice(s) "
        f"across {len(work)} division(s)."
    )
    if failed:
        message += f" {len(failed)} record(s) failed."
    await publish_progress(done=True, message=message)
    return {
        "postedMoneyReceipts":    posted_money_receipts,
        "postedPurchaseInvoices": posted_purchase_invoices,
        "postedJobInvoices":      posted_job_invoices,
        "postedSalesInvoices":    posted_sales_invoices,
        "divisionsPosted":        len(work),
        "failed":                 failed,
        "message":                message,
    }
