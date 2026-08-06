# New feature: Spare parts sale on the web
- There is an another project in the peer named as service-plus-web in next.js static, where We want to make sale and search os spare parts. No payment gateway required at the moment.
- The query will be made through api in service-plus-server. Parts will be displayed here with partcode, description, model, price, image(if available) etc. 
- The spare_part_master in database may have thousands of parts which may not be meaningful to display on web. We should display only the parts which are current or have stock. The part image we can store in service-plus-file-server project, if so required. You can suggest some better way to do so.
- You give me a complete detailed design for this new feature in plans/plan.md.