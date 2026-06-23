# Strategy for job cost price / sale price and job final and Parts & charges
- 
# Strategy for change in division
- One branch can have many divisions. Each division can post data to specific accounts database, based on its account_setting
- User can receive a job in any available division.
- Invoicing should be done GST or non-gst, based on account_setting of the division
- User should be able to change division anytime before it is final and accordingly gst aspects change
- User should not be allowed to change division once it is done final
- GST aspects of an invoice should depend on whether division is GST or non-gst.
- A division is gst if gstin no is there in account_setting, non-gst otherwise
# provide a new restricted menu item
- Create a new menu item "Admin" at top level menu
  - Add submenu item as "Post / Unpost"
  - "Post / Unpost" has 4 tabs named as Money Receipts, Purchase Invoice,  Sales Invoice, "Job Invoice"
  - Each tab shows corresponding receipts, purchase invoices, sales invoices, job invoices and a checkbox representing is_posted. Division name and GST, NON-Gst should also be shown
  - Each tab has Search Box and refresh buttons
  - Show total count of posted, unposted, total for each tab
  - User can manually post / unpost entries
  - There should be a submit button to save posted /unposted entries
# Receipt + purchase invoice payload
{
  "clientCode": "demoAccounts",
  "buCode": "demounit1",
  "data": {
    "tableName": "TranH",
    "dbParams": {
      "conn": ""
    },
    "xData": [
      {
        "tranDate": "2026-06-18",
        "tranTypeId": 3,
        "finYearId": 2026,
        "branchId": 1,
        "posId": 1,
        "xDetails": [
          {
            "tableName": "TranD",
            "fkeyName": "tranHeaderId",
            "xData": [
              {
                "accId": 118,
                "dc": "D",
                "amount": 1000.0,
                "remarks": "This is an advance",
                "lineRefNo": "Service+ Posting",
                "instrNo": "reference 1"
              },
              {
                "accId": 389,
                "dc": "C",
                "amount": 1000.0,
                "remarks": "This is an advance",
                "lineRefNo": "Service+ Posting",
                "instrNo": "reference 1"
              }
            ]
          }
        ],
        "userRefNo": "CAP/00015",
        "remarks": "JOB:143, Usha Nambiar, Mobile:9577777778, GSTIN:08AABC00018R1ZP, Address:18, Service Road, Block 8, Pune, PIN:411006"
      },
      {
        "tranDate": "2026-06-19",
        "tranTypeId": 5,
        "finYearId": 2026,
        "branchId": 1,
        "posId": 1,
        "xDetails": [
          {
            "tableName": "TranD",
            "fkeyName": "tranHeaderId",
            "xData": [
              {
                "accId": 168,
                "dc": "D",
                "amount": 236.0,
                "xDetails": [
                  {
                    "tableName": "ExtGstTranD",
                    "fkeyName": "tranDetailsId",
                    "xData": {
                      "isInput": true,
                      "gstin": "27AAACC3448H1ZA",
                      "cgst": 0.0,
                      "sgst": 0.0,
                      "igst": 36.0
                    }
                  },
                  {
                    "tableName": "SalePurchaseDetails",
                    "fkeyName": "tranDetailsId",
                    "xData": [
                      {
                        "productId": 278,
                        "qty": 1.0,
                        "price": 200.0,
                        "priceGst": 236.0,
                        "amount": 236.0,
                        "hsn": "2312",
                        "gstRate": 18.0,
                        "cgst": 0.0,
                        "sgst": 0.0,
                        "igst": 36.0
                      }
                    ]
                  }
                ]
              },
              {
                "accId": 390,
                "dc": "C",
                "amount": 236.0
              }
            ]
          }
        ],
        "userRefNo": "AAVV-132"
      }
    ],
    "buCode": "demounit1"
  }
}
# New field in divison
- A new field account_setting of type jsonb is added to divison table
- In Configurations > Divisons for Add / Edit divison provide form entry in the form for following JSON type in the account_setting field. This field entry will be visible only when post_data_to_accounts is true
        - {
                "clientCode":"demoAccounts",
                "buCode":"demounit1",
                "branchId":1,
                "receipt":{
                        "debitAccountId":"",
                        "creditAccountId":""
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
          }
- Set typescript type and put proper validations in place.
- The above setting will be used for posting of data to accounts software


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
                

# Process to post money receipt from Service-Plus to Trace-Plus. This is a minimum implementation for testing purpose.
- Jobs > Accounts Posting: Landing Page: Create a button "Accounts Posting"
- Create a new mutation at server as "accountsPosting" this mutation will be executed when the user clicks on "Accounts Posting" button. This mutation will fetch the data from Service-Plus server and format it in desired format consumable by Trace-Plus server. This will then call a new mutation at trace-plus-server named as "accountsPosting" passing it the data.
- In fact "accountsPosing" mutation is to be created at service-plus-server as well as trace-plus-server with individual functionalities.
- service_plus-server "accountsPosting" mutation:
    - receives parameter: divisonCode only
    - get account_setting field against this divisonCode from divison table.
    - get clientCode, buCode, debitAccountId, creditAccountId from account_setting.
    - get moneyreceipts data not posted to Trace-Plus. At present get one row only for testing purpose.
    - Format the fetched data in following sample format: Basically fetched data is to be converted in following sample format, no new data is to be added, only mapping is to be done. Replace accID in xData by debitAccountId or creditAccountId based on dc value. If dc is 'C' then replace accID by debitAccountId, if dc is 'D' then replace accID by creditAccountId. Also if some value is not present in fetched data then it is to be omitted.
    {
        "tableName": "TranH",
        "dbParams": {
            "conn": "Encrypted string"
        },
        "xData": {
            "tranDate": "2026-06-17",
            "userRefNo": "user ref no",
            "remarks": "common remarks",
            "tranTypeId": 3,
            "finYearId": 2026,
            "branchId": 1,
            "posId": 1,
            "xDetails": [
            {
                "tableName": "TranD",
                "fkeyName": "tranHeaderId",
                "xData": [
                    {
                        "accId": 389,
                        "remarks": "Line Remarks 1",
                        "dc": "C",
                        "amount": 1000,
                        "lineRefNo": "line ref 1",
                        "instrNo": null
                    },
                    {
                        "accId": 118,
                        "remarks": "Line Remarks 1",
                        "dc": "D",
                        "amount": 1000,
                        "lineRefNo": "line ref 1",
                        "instrNo": "instr1"
                    }
                ]
            }]
        },
        "buCode": "demounit1"
    }

- trace-server "accountPosting" mutation:
    -receives parameter: clientCode, buCode, data as above
    - connect to "traceAuth" database. fetch dbName and dbparams from "ClientM" table against clientCode received.
    - Fill in this encrypted value of dbparams in xData as "conn": "encrypted_string"
    - Once data is available and fully formatted, call the mutation validateDebitCreditAndUpdate of trace-server, passing in the formatted data and other parameters.
- Take care of authentication in between service-plus-server and trace-server.

# Original Money receipt payload

{
  "tableName": "TranH",
  "dbParams": {
    "conn": "Encrypted string"
  },
  "xData": {
    "tranDate": "2026-06-17",
    "userRefNo": "user ref no",
    "remarks": "common remarks",
    "tranTypeId": 3,
    "finYearId": 2026,
    "branchId": 1,
    "posId": 1,
    "xDetails": [
      {
        "tableName": "TranD",
        "fkeyName": "tranHeaderId",
        "xData": [
          {
            "accId": 389,
            "remarks": "Line Remarks 1",
            "dc": "C",
            "amount": 1000,
            "lineRefNo": "line ref 1",
            "instrNo": null
          },
          {
            "accId": 118,
            "remarks": "Line Remarks 1",
            "dc": "D",
            "amount": 1000,
            "lineRefNo": "line ref 1",
            "instrNo": "instr1"
          }
        ],
        "deletedIds": [
          
        ]
      }
    ]
  },
  "buCode": "demounit1"
}


# Service management software Post data to accounts
## Trace plus is an accounting software with postgresql database and GraphQL based API. The app server is written in fastApi. It is in folder /projects/trace-plus/dev/trace-server. Service plus is service jobs management software. its server is in folder /projects/service-plus/dev/service-plus-server. DB schema is in files /projects/service-plus/db/service-plus-demo.sql and /projects/service-plus/db/service-plus-client.sql
- A need is felt to post the data for Purchase Invoices, Sales Invoices, Job Invoices and Money Receipts from service-plus to trace-plus. The process should be robust and in service plus, is_posted flag is to be made true after successful posting to accounts.
- Posting data is in JSON format and data transfer is to be done in secured manner
- In service plus client, There is already a menu item named as "Accounts Posting". A "Post Selected" button should initiate the posting process. After posting of data a proper message is to be given to user
- You need to design  a complete system in details as follows:
        - Design a complete handshake between service plus client and trace plus. Will it be better that service plus client makes a secured call to service plus server api and the service plus server then calls to trace plus server and transfers data
        - Trace plus api to receive the data in Json format in authenticated manner and post it to relevant tables
        - Implement the service plus client method for "Post Selected" button click. This generates the json and calls to relevant apis in secured manner
- Create a complete plan with available options
- At this stage give a detailed overview of entire process incorporating best practises. No need to write detaied code. This is only the design phase
- Write you plan to plans/plan.md. 

# Account Setting
{
        "clientCode":"demoAccounts",
        "buCode":"demounit1",
        "purchase":{
                "debitAccountCode":"",
                "creditAccountCode":"",
                "productCode":"*****",
                "defaultPartHsn":"",
                "defaultGstRate":"18"
        },
        "sale":{
                "debitAccountCode":"",
                "creditAccountCode":"",
                "productCode":"*****",
                "defaultPartHsn":"",
                "defaultGstRate":"18"
        },
        "receipt":{
                "debitAccountCode":"",
                "creditAccountCode":""
        }
        
}

###
- For "Assigned" as target status, selection of technician through drop down is mandatory in modal window if not already selected earlier.
- For all transactions, remarks and date field will appear by default in modal window.
- When completed OK as target status, there should be provision to register part used through a grid in the existing dialog window, which stores data in job_part_used. If already some part used, that should show up. User should be able to add / delete new parts.
- When target status is IN_PROGRESS, then also there should be provision to add / delete parts
- When existing status is COMPLETED_OK, RETURN, DELIVERED_OK, DELIVERED_NOT_OK then make sure that no     
actions / transactions can be performed on these jobs. That means, Actions options      
will not appear for them. This function is already existing.
- Please incorporate the following logical steps table for options in dropdown of actions column
Present Status                  Job Type                Allowed Options
        RECEIVED                Estimate                Assigned, Estimated (estimate_amount)
                                Any other               Assigned, IN_PROGRESS, 
        ASSIGNED                Any                     Assigned, IN_PROGRESS
        ESTIMATED               Any                     ESTIMATE_APPROVED, ESTIMATE_REJECTED, IN_PROGRESS
        ESTIMATE_APPROVED       Any                     IN_PROGRESS
        ESTIMATE_REJECTED       Any                     RETURN
        IN_PROGRESS             Any                     Assigned, SENT_TO_COMPANY, OUTSOURCED, PARTS_PENDING, ON_HOLD, COMPLETED_OK. RETURN, CANCELLED, DISPOSED, In_progress
        PARTS_PENDING           Any                     IN_PROGRESS
        ON_HOLD                 Any                     IN_PROGRESS
        OUTSOURCED              Any                     IN_PROGRESS
        SENT_TO_COMPANY         Any                     RECEIVED_BACK_FROM_COMPANY
        COMPLETED_OK            Any                     No transactions
        RETURN                  Any                     No transactions
        DELIVERED_OK            Any                     No transactions
        DELIVERED_NOT_OK        Any                     No transactions
        CANCELLED               Any                     IN_PROGRESS
        DISPOSED                Any                     IN_PROGRESS
        RECEIVED_BACK_FROM_COMPANY                      IN_PROGRESS
        
# Old Service DB extracts

# Service

- defect

- item

- receive_type
  
        rec_id,rec_type,rec_descr,sync_key
       1,'MR','Make Ready','I'
       2,'NC','No Charge','I'
       3,'TW','Tourist warranty','I'
       4,'ES','Estimate','I'
       5,'LR','Last Repairs','I'
       6,'UG','Under Guaranty','I'
       7,'HSW','Home Service Warranty','Y'
       8,'HSC','Home Service Chargable','Y'
       9,'RP','Replacement','Y'
       10,'DEMO','Demonstration','Y'

- cust_details
  
        name,addr1,addr2,pin, phone,email,city, state,mobile

- serv_main
  
        job_id,job_no,job_date,sl_no,serv_charge,purchase_date,last_tran_id,cust_id,product_id,opening,cost_amount,sale_amount,other_charges,discount,rec_condition,mech_id,remarks,status_id,rec_id,defect_id,amount,advance,dues,storage_id,sync_key,junk,final,accessory,complaint,prev_job_no,cst,sales_tax,service_tax,surcharge,roundoff,transport,handling,card_charges,estimate,vat,tot,estimate_charges,job_work,job_sheet_rec_id,job_sheet_details,profit,gst,local,multi,mold,imei

- serv_main_part_details
  
        details_id,part_name,part_code,cost_price,sale_price,qty,job_id,exp_id,cst,sales_tax,ref_no

- serv_main_receipt
  
        recid,job_id,rec_date,rec_amt,prefix_id,rectype,rec_no

- serv_mech_details
  
        mech_id,short_name,name,grade

- serv_product_table
  
        product_id,model,item_id,company_id

- serv_transaction
  
        tran_id,tran_date,prev_tran_id,job_id,mech_id,status_id,mech_remarks

- service_status
  
        currency_id,job_no_numeric,company_id,id,name,address1,address2,pin,phone,fax,email,service_tax,sales_tax,advanced,security,last_adv_no,host,company_pwd,rec_prefix_id,cst,lst,working_hours,holidays,payment_terms,surcharge,job_sheet_details,tot,updateacc,accdatabase,autofinal,gst,autoroundoff,autoreceipt,version,isis,job_no_prefix,multi,cellport,cellno,autosms,sms_no
       4,74114,'capiele',1,'Capital Electronics','12 J.L Nehru Rd','KOL-700013','700013','033-40030342','','capitalch@gmail.com',0.00,10.00,'fGEVVV','dVGZ',0,'https://capital-electronics.com/','capital',1,'GSTN-19AAMFC2182P1ZT',,'10 .30AM to 7.30 PM','Sunday.','Cash',0.00,'N',0.00,'N','ELE2014','N',0.00,,'Y','2.05.040407','N',,0,'COM1','111111111111','N',''

- status_master
  
        status_id,status,sync_key
       1,'UNTOUCHED','Y'
       2,'ESTIMATED','Y'
       3,'APPROVED','Y'
       4,'NOT APPROVED','Y'
       5,'READY(STOCK)','Y'
       6,'RETURN(STOCK)','Y'
       7,'PENDING','Y'
       8,'UNDER PROCESS','Y'
       9,'DELIVERED(OK)','Y'
       10,'DELIVERED NOT OK','Y'
       11,'SALES RETURN','Y'
       12,'READY CANCEL','Y'
       13,'DISPOSED','Y'
       14,'ASSIGNED','Y'
       15,'DISPATCH TO COM','I'
  
  # casioe

- inv_master
    part_code,name,price,spec,rank,equ,prev_equ,model,available,part_id

- inv_main
    op_bal,db,cr,adjust,bin_place,part_id,inv_main_id,supp_currorder,supp_cancelled,supp_ordtodate,supp_rectodate,supp_pending,cust_billtodate,cust_booktodate,cust_cancelled,cust_pending,loan_bal,job_booking
