# Modifications in Inventory > Sales Entry
- When different state consider IGST automatically and in case of same state conside CGST + SGST. User can change the same if required.
- When customer selected, automatically populate the state and other details from the customer master.
- Display GSTIN if available. User can provide GSTIN manually.
- When the division is gst then create GST invoice and when not then create normal invoice. 
- When gst invoice, allow entry for gst price. User can change gstPrice, then price will be backcalculated
- Do proper totalling of line items (Amount, Gst Amount, Total Amount) in the footer
- Provide an input box for Target Amount at footer and also provide button for back calculation of the prices. This will behave similar to "Final a Job" drill down "Target Amount" and back calculate
- The screen should work for both new and editing the invoice. If editing then it should fetch the data from the server and display the data in the screen.