# File Upload Hierarchy - Implementation Summary

## Objective
Changed the file storage structure on the file server from:
```
{BASE_DIR}/{db_name}/files/{job_no}/
```
to:
```
{BASE_DIR}/{client_code}/{bu_code}/{branch_code}/{job_no_snake}/
```

---

## Changes Made

### 1. Client-Side Changes

#### New File: `src/lib/string-utils.ts`
- Added `toSnakeCase()` utility function to convert strings to snake_case

#### Modified: `src/lib/auth-service.ts`
- Added `clientCode?: string` to `UserInstanceType`

#### Modified: `src/features/auth/store/auth-slice.ts`
- Updated `setCredentials` reducer to store `clientCode` in localStorage
- Updated `logout` reducer to clear `clientCode` from localStorage
- Added `selectClientCode` selector

#### Modified: `src/lib/image-service.ts`
- Updated `uploadJobFile()` to accept new parameters: `clientCode`, `buCode`, `branchCode`
- These are passed as FormData fields to the server

#### Modified: `src/features/client/components/jobs/single-job/job-image-upload.tsx`
- Added imports for `selectClientCode`, `selectCurrentBu`, `selectCurrentBranch`
- Gets `clientCode`, `buCode`, `branchCode` from Redux store
- Passes hierarchy fields to `uploadJobFile()`

#### Modified: `src/features/client/components/jobs/batch-job/batch-job-section.tsx`
- Added imports for `selectClientCode`, `selectCurrentBu`
- Gets `clientCode`, `buCode`, `branchCode` from Redux store
- Updated `uploadJobFile()` call with new parameters

---

### 2. Server-Side Changes (File Server)

#### Modified: `deployment/file-server/service-plus-file-server/app/routers/files.py`
- Added `_to_snake_case()` utility function
- Updated `/upload` endpoint (`/files/upload` and `/api/images/upload`):
  - Accepts new Form fields: `client_code`, `bu_code`, `branch_code`
  - Creates hierarchical folder structure: `{client_snake}/{bu_snake}/{branch_snake}/{job_no_snake}/`
  - Converts filenames to snake_case
  - Returns URL in new format: `uploads/{client_snake}/{bu_snake}/{branch_snake}/{job_no_snake}/{filename}`
- Updated `/{db_name}/job/{job_no}` delete endpoint:
  - Accepts new Form fields for hierarchy
  - Falls back to old path format if new path not found
- Updated `/uploads/{path:path}` serve endpoint:
  - Tries new path first
  - Falls back to old path format for backward compatibility
- Added `api_router` with prefix `/api/images` for backward compatibility:
  - `/api/images/upload` → delegates to `upload_files()`
  - `/api/images/{db_name}/{schema}/{image_id}` → delete single file
  - `/api/images/{db_name}/{schema}/job/{job_id}` → delete job files
  - `/api/images/config` → get config

#### Modified: `deployment/file-server/service-plus-file-server/app/main.py`
- Imported `api_router`
- Added `app.include_router(api_router)`

---

## New Folder Structure

### Before:
```
{BASE_DIR}/
└── demo1/
    └── files/
        └── REP-001/
            ├── image_123.webp
            └── doc_456.pdf
```

### After:
```
{BASE_DIR}/
└── acme/
    └── mumbai/
        └── andheri/
            └── rep_001/
                ├── image_123.webp
                └── doc_456.pdf
```

---

## Backward Compatibility

1. **File Serving**: The `serve_file` endpoint tries the new path first, then falls back to the old path format
2. **Job Deletion**: The `delete_job_files` endpoint tries the new path first, then falls back to the old path
3. **API Endpoints**: Both `/files/*` and `/api/images/*` prefixes are supported via two routers

---

## Testing Checklist

- [x] Build passes (`npm run build`)
- [x] Lint passes for modified files
- [x] Server-side Python code compiles
- [ ] Upload file from "new job" mode
- [ ] Upload file from "view job" mode (job exists)
- [ ] Verify file is stored at correct path: `{BASE_DIR}/{client_code}/{bu_code}/{branch_code}/{job_no_snake}/`
- [ ] Verify file URL in database matches new format
- [ ] Verify file is served correctly (view/download)
- [ ] Verify file delete works correctly
- [ ] Verify backward compatibility with old file URLs
- [ ] Test with special characters in job_no and filename

---

## Migration Notes

Existing files stored in the old format will still be accessible because:
1. The `serve_file` endpoint falls back to the old path format
2. The `delete_job_files` endpoint falls back to the old path format

For a complete migration, you may want to:
1. Write a script to move existing files from old path to new path
2. Update URLs in the database
3. Requires knowing `client_code`, `bu_code`, `branch_code` for all existing jobs

---

## Files Modified

| File | Change Type |
|------|-------------|
| `src/lib/string-utils.ts` | NEW |
| `src/lib/auth-service.ts` | MODIFY |
| `src/features/auth/store/auth-slice.ts` | MODIFY |
| `src/lib/image-service.ts` | MODIFY |
| `src/features/client/components/jobs/single-job/job-image-upload.tsx` | MODIFY |
| `src/features/client/components/jobs/batch-job/batch-job-section.tsx` | MODIFY |
| `deployment/file-server/service-plus-file-server/app/routers/files.py` | MODIFY |
| `deployment/file-server/service-plus-file-server/app/main.py` | MODIFY |
