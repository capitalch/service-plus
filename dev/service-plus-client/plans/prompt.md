# Spare Parts Sale on the Web — Modify Design
- There is an existing design in plans/plan.md
- I want to create a separate table in database named as "spare_part_web". This is for part catalogue exclusively on web.
    - Define the columns in it. Requirement is, nullable part_id, part_name, part_description, price, model, hsn_code, is_active, image_url, created_at, updated_at.
    - User can input parts from market which do not have any part code.
    - Create a complete interface to maintain the data in this table.
    - Make necessary changes to service-plus-server and client.
    - image_url is url for image file in service_plus_file_server. Provide seamless interface for uploading the part image through file server which is existing. Design the location to save the image in file server. If possible provide for multiple images for a part.
    - Images will be stored in file server with proper hierarchy with service center folder, so that if required entire folder can be deleted.
    - Design complete set of changes in client, server and file server.  
- Service plus web:
    - Every client name - business unit has a separate spare part sale page and data will be shown from respective database table
    - At the top the user will select a client + bu as in job query. The parts catalogue will be shown in paginated form with thumbnail images. Detailed image / multiple images if available can be seen after selection
    - It will show all the active parts in this table in nice manner with good ux. Prices of parts are indicative and can change without any prior information
    - Parts once shipped cannot be taken back. No return / replace policy
    - At present customer can select part and order. Email will be received by staff. Delivery and billing will be manual process by staff. Phone no of staff will be visible on web.
- Merge / modify existing plan.md with this design. don't implement now.

