# Modify field account_setting in division table:
- account_setting is a JSON field. Made certain changes based on users inputs. It will have below mentioned structure:
{
  "buCode": "demounit1",
  "branchId": 1,
  "receipt": {
    "debitAccountId": 118,
    "creditAccountId": 389
  },
  "purchaseInvoice":{
    "debitAccountId":0,
    "creditAccountId":0,
    "productId":278,
    "defaultProductHsn":0,
    "defaultGstRate":18
  },
    "salesInvoice":{
    "debitAccountId":0,
    "creditAccountId":0,
    "productId":278,
    "defaultProductHsn":0,
    "defaultGstRate":18
    },
    "jobInvoice":{
    "debitAccountId":0,
    "creditAccountId":0,
    "productId":278,
    "defaultProductHsn":0,
    "defaultGstRate":18
    }
  "clientCode": "demoAccounts"
}
- Change the UI and types to accommodate the above structure.
- Make appropriate changes in codebase so that entire flow of accountsPosting works for receipts fine as before changing the types