# Process to post purchase invoice from Service-Plus to Trace-Plus. This is a minimum implementation for testing purpose.
- Jobs > Accounts Posting: Landing Page: A button "Accounts Posting" is there
- At server accountsPosting mutation is already there which at present posts a single money receipt to server. Now extend this mutation to post a single purchase invoice to trace-server. this mutation will be executed when the user clicks on "Accounts Posting" button.

- service_plus-server "accountsPosting" mutation: add following functionality:
    - For purchaseInvoice, get clientCode, buCode, debitAccountId, creditAccountId, productId, defaultProductHsn, defaultGstRate from account_setting.
    - get purchase invoice data not posted to Trace-Plus. At present get one row only for testing purpose.
    - Format the fetched data in following sample format: Basically fetched data is to be converted in following sample format, no new data is to be added, only mapping is to be done. Replace accID in xData by debitAccountId or creditAccountId based on dc value. If dc is 'D' then replace accID by debitAccountId, if dc is 'C' then replace accID by creditAccountId. Also if some value is not present in fetched data then it is to be omitted.
    - Make xData an array which already has an entry for money receipt. Add an element to xData array corresponding to purchase invoice, whose sample data is as follows. In fact tableName, dbparams and buCode will be shared and xData will be array having at present two elements: one for money receipt and another for purchase invoice.
    {
  "tableName": "TranH",
  "dbParams": {
    "conn": "gAAAAABoV9HddymKguwTc-bIqmuPP1zSryUZkzvPg_Zv1hKwAjyHjW-zUYffWzZzCBTspVJzw-HgHksRY6iMyNULUh4EFzlDGVtqchBkiCtFb0I_BmZO20Y9ebLJj_9hhu13Migzxm_xA38rSpuUR-_DagtZ_PbPt_bunH8Yk-6jYRQNQiKRkpgS8MxM24YcgyDqyk6jklNGVcWW4_tfwADPqBrguQHJ8EdWMHaMbyL4AjewWMU5KUikUDXghsLX0CGiZW8IN9nEVrKRBN3MZnFJD22KdJrTEjfLCmlQOldt753XcdOvsfU="
  },
  "xData": {
    "tranDate": "2026-06-19",
    "userRefNo": "CD-Y30-SPD3784",
    "remarks": null,
    "tranTypeId": 5,
    "finYearId": 2026,
    "branchId": 1,
    "posId": 1,
    "autoRefNo": "H/PUR/1/2026",
    "xDetails": [
      {
        "tableName": "TranD",
        "fkeyName": "tranHeaderId",
        "xData": [
          {
            "accId": 168,
            "dc": "D",
            "amount": 27555,
            "xDetails": [
              {
                "tableName": "ExtGstTranD",
                "fkeyName": "tranDetailsId",
                "xData": {
                  "gstin": "07AAACC3448H1ZU",
                  "cgst": 0,
                  "sgst": 0,
                  "igst": 4203.36,
                  "isInput": true
                }
              },
              {
                "tableName": "SalePurchaseDetails",
                "fkeyName": "tranDetailsId",
                "xData": [
                  {
                    "productId": 278,
                    "qty": 1,
                    "price": 23352,
                    "priceGst": 27555.36,
                    "discount": 0,
                    "cgst": 0,
                    "sgst": 0,
                    "igst": 4203.36,
                    "amount": 27555.36,
                    "hsn": "91149091",
                    "gstRate": 18,
                    "jData": null
                  }
                ]
              }
            ]
          },
          {
            "accId": 390,
            "dc": "C",
            "amount": 27555
          }
        ]
      }
    ]
  },
  "buCode": "demounit1"
}
- trace-server "accountPosting" mutation: Will do the same as it is doing now but will include purchase invoice data also in the transaction.
