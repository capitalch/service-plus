# Modify field account_setting in division table:
- account_setting is a JSON field. This will now have an additional properties named as purchaseInvoice, salesInvoice, jobInvoice. It will have below mentioned structure:
{
  "buCode": "demounit1",
  "branchId": 1,
  "receipt": {
    "debitAccountId": "118",
    "creditAccountId": "389"
  },
  "purchaseInvoice":{
    "debitAccountId":"",
    "creditAccountId":"",
    "productCode":"*****",
    "defaultProductHsn":"",
    "defaultGstRate":"18"
  },
    "salesInvoice":{
    "debitAccountId":"",
    "creditAccountId":"",
    "productCode":"*****",
    "defaultProductHsn":"",
    "defaultGstRate":"18"
    },
    "jobInvoice":{
    "debitAccountId":"",
    "creditAccountId":"",
    "productCode":"*****",
    "defaultProductHsn":"",
    "defaultGstRate":"18"
    }
  "clientCode": "demoAccounts"
}
- Add / Edit divison modal dialog would be outside click non close. It will now have an additional tab named as "Trace+ Accounts Integration"
- This tab will be visible when post_data_to_accounts is true
- There will be 4 sections in this tab
  - Money Receipt
  - Purchase Invoice (new)
  - SalesInvoice and KobInvoice will be implemented later