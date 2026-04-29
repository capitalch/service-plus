# Advice needed for upload file destination
- At present files are uploaded to relative path code created with settings in config.py (upload_base_dir). This works fine.
- When the server changes, so file urls point to different location and becomes unaccessible. 
- Suggest a robust solution to this.
- One option might be to use a secured file server at cloud with the base url set in config.py. Authentication can be fixed authentication by existing server's image_router.

