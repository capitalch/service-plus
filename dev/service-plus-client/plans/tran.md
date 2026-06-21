# Modify Accounts Posting
- At present we are posting only one division, the division code being sent from client to server
- We need to modify this to post all the divisions for which valid account setting exists an for which unposted data exists.
- No need to send the division code from client to server. Server can itself determine the divisions to post as per their respective account setting.
- The accounts posting should be done for each division separately. 
- The clint should show the unposted counts for each division separately for money receipt and purchase invoice, sales invoices and job invoices.
