# Plan for Implementation of overall Reporting and dashboard
## I want following informations from the system in a nice user friendly manner. For that design a complete system as a plan in plans/plan.md
## Group the reports as deemed necessary. Create dashboards and overviews. Follow industry patterns. Include missing reports dashbords and charts.
## Create chart based intuitive reports as deemed fit
- app_setting already contains a key fiscal_year_start_month_num. Use this to determine qtr
- Total warranty and out of warranty jobs received today, yesterday, this week, previous week, this month, last month, 1st qtr, 2nd qty, 3rd qtr, 4th qtr, year-to-date, last year, Monthwise graph for this year, last year, last 2 years, last 3 years, year wise graph
- Total warranty and out of warranty jobs repaired OK for same range
- Total warranty and out of warranty jobs deliverd OK for same range
- Total profits for same range
- technician wise Total warranty and out of warranty jobs repaired OK, Delivered OK, Profit, revenue. profit is selling_price - cost_price
- Job delivered OK detailed transaction report for same range
- Complete Job transaction report datewise decr sorted
- Spare parts opening, debits, credits, closing, value fiscal year wise
- Spare parts ageing report, Spare parts aged more than an year
- Spare parts detailed transaction report weekly, monthly, yearly, all sorted out decr on consumed date
- Dynamic Suggestions for ordering of spare parts based on monthly consumption in last 6 month and present stock. Weightage for consumption in last month is more than that of in last but one month and so on. A part consumed 10 in May 2026 has more weightage than a part consumed 10 in April 2026. We want to order in such a way that we stock for one month of likely consumption
- PDF printing of all reports