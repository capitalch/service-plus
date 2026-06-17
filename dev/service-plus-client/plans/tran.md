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