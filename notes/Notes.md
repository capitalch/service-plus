## Service management software

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
