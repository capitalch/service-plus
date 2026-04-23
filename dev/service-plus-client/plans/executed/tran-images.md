# Requirement for uploading and deleting multiple images for a job at the time of job entry.
- This should be a reusable control for multiple upload of images, view images, delete images for a given job at various lifecycle stages of a job.
- The images should be uploaded to the server in folders and their urls should be stored in the database. The urls should be relative so that server shifting is easy.
- Max image size can be 500KB. Image will be resized to 500KB if it is greater than 500KB.
- Image will be stored in the folder /upload/db_name/images/job_id/image_name.jpg.
- Explore the options of Image format as jpeg or WebP, choose the one which is most suitable for this application.
- UI component can be taken from https://react-dropzone.js.org/ or https://www.npmjs.com/package/react-image-crop.
- Give a detailed in plan.md file for implementing the same at client and server side. Do not put the code in the plan file. Create a separate file for that.
