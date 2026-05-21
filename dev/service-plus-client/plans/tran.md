# Modification in "Final a Job" feature
## Price
- If user gives a part code, it is searched in spare_part_master for cost_price and gst_rate
- effective gst rate = gst_rate from spare_part_master OR default_gst_rate whatever in non zero
- For non-gst
        - gst rate should always be 0
        - if force_gst_on_parts_for_non_gst_invoices is true
                cost price = cost *(1 + (effective gst rate)/100)
                sale price = cost price + markup
        - else
                cost price = cost_price
                sale price = cost price + markup
- For gst
        - if gst_rate in spare_part_master is 0 then default_gst_rate is taken and accordingly cost and sale price are calculated.

## Functionality
- Internally use a calculate method which does all the calculations of gst sale price, gst, aggregate, amount, summary etc. for each row. This method is fired when any of the user input changes in any row or when division changes, But except when user changes gst sale price. When user changes gst sale price then sale price is back calculated and then calculate metod is fired. The purpose is to keep UI updated against any user input or change.

- write a detailed plan to plans/plan.md