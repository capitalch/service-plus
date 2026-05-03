# Plan: Implement File Upload Hierarchy

## Objective
Change the file storage structure on the file server from:
```
{BASE_DIR}/{db_name}/files/{job_no}/
```
to:
```
{BASE_DIR}/{client_code}/{bu_code}/{branch_code}/{job_no_snake}/{filename_snake}.ext
```

---

## 1. Data Requirements

### Information Needed for File Path
| Field | Source | Description |
|-------|--------|-------------|
| `client_code` | Auth state (`selectSelectedClientId` → lookup) | Code of the client (from security DB `Bu` table) |
| `bu_code` | Context slice (`selectCurrentBu?.code`) | Business Unit code (== schema name) |
| `branch_code` | Job details (`JobDetailType.branch_code`) or context (`selectCurrentBranch?.code`) | Branch code |
| `job_no` | Job data | Job number, converted to snake_case |
| `filename` | Upload file | Original filename, converted to snake_case |

---

## 2. Client-Side Changes

### 2.1 Create Utility Function for snake_case Conversion
**File**: `src/lib/string-utils.ts` (new file)

```typescript
export function toSnakeCase(str: string): string {
    return str
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
}
```

### 2.2 Update `image-service.ts`
**File**: `src/lib/image-service.ts`

**Changes to `uploadJobFile()` function (lines 36-68)**:
- Add new parameters: `clientCode`, `buCode`, `branchCode`
- Add these to FormData
- Pass `jobNo` for snake_case conversion on server

```typescript
export async function uploadJobFile(
    dbName: string,
    schema: string,
    jobId: number,
    jobNo: string,
    about: string,
    file: File,
    clientCode: string,
    buCode: string,
    branchCode: string,
): Promise<JobFileRow> {
    // ... existing token refresh logic ...

    const form = new FormData();
    form.append("db_name", dbName);
    form.append("schema", schema);
    form.append("job_id", String(jobId));
    form.append("job_no", jobNo);
    form.append("about", about);
    form.append("files", file);
    // NEW: Hierarchy fields
    form.append("client_code", clientCode);
    form.append("bu_code", buCode);
    form.append("branch_code", branchCode);

    // ... rest of function ...
}
```

### 2.3 Update `job-image-upload.tsx`
**File**: `src/features/client/components/jobs/single-job/job-image-upload.tsx`

**Changes**:
1. Import `useAppSelector` and required selectors:
   - `selectCurrentBu` from context-slice
   - `selectSelectedClientId` from auth-slice (to get client ID, then need to fetch/store client_code)

2. Get `buCode` and `branchCode`:
```typescript
const currentBu = useAppSelector(selectCurrentBu);
const currentBranch = useAppSelector(selectCurrentBranch);
const buCode = currentBu?.code ?? "";
const branchCode = currentBranch?.code ?? "";
```

3. For `clientCode`: Need to either:
   - Store `client_code` in auth state during login
   - Or fetch it when needed

**Recommended**: Add `clientCode` to the auth user state during login.

4. Update `handleUploadAll()` (line 232-273) to pass new parameters:
```typescript
const uploaded = await uploadJobFile(
    dbName, schema, jobId, jobNo, pFile.about.trim(), pFile.file,
    clientCode, buCode, branchCode  // NEW
);
```

### 2.4 Update Auth State to Include `clientCode`
**File**: `src/features/auth/store/auth-slice.ts`

**Changes**:
1. Update `UserType` to include `clientCode?: string`
2. Set `clientCode` during login from the API response

**File**: `src/features/auth/types/index.ts`
```typescript
export type UserType = {
    id: number;
    username: string;
    email: string;
    fullName: string;
    // ... existing fields ...
    clientCode?: string;  // NEW
};
```

Then update `setCredentials` reducer to store `clientCode`.

### 2.5 Update `single-job-section.tsx` (if needed)
The file upload is triggered from `JobAttachDialog` → `JobImageUpload`, which already has access to `jobId` and `jobNo`. The component needs `clientCode`, `buCode`, and `branchCode`.

Options:
1. Pass these as props to `JobAttachDialog` → `JobImageUpload`
2. Get from Redux store inside `JobImageUpload`

**Recommended**: Get from Redux store inside `JobImageUpload` (as described in 2.3).

---

## 3. Server-Side Changes (File Server)

### 3.1 Update `files.py`
**File**: `deployment/file-server/service-plus-file-server/app/routers/files.py`

#### 3.1.1 Add snake_case Utility
```python
def _to_snake_case(s: str) -> str:
    """Convert string to snake_case."""
    slug = re.sub(r'[^a-z0-9]', '_', s.lower())
    return re.sub(r'_+', '_', slug).strip('_')
```

#### 3.1.2 Update Upload Endpoint (lines 102-162)
Update the `/upload` endpoint to:
1. Accept new form fields: `client_code`, `bu_code`, `branch_code`
2. Build new path structure
3. Convert `job_no` and filename to snake_case

```python
@router.post("/upload")
async def upload_files(
    db_name: str = Form(...),
    job_no: str = Form(...),
    about: str = Form(...),
    client_code: str = Form(...),   # NEW
    bu_code: str = Form(...),       # NEW
    branch_code: str = Form(...),   # NEW
    files: list[UploadFile] | None = None,
    _api_key: str = Depends(verify_api_key),
) -> list[dict[str, str]]:
    # ... validation ...
    
    epoch_ms = int(time.time() * 1000)
    stem = _derive_stem(about, epoch_ms)
    job_no_snake = _to_snake_case(job_no)
    client_snake = _to_snake_case(client_code)
    bu_snake = _to_snake_case(bu_code)
    branch_snake = _to_snake_case(branch_code)
    
    # NEW path structure
    dest_dir = _BASE_DIR / client_snake / bu_snake / branch_snake / job_no_snake
    dest_dir.mkdir(parents=True, exist_ok=True)
    
    for file in files:
        # ... existing compression logic ...
        
        # Convert filename to snake_case
        orig_stem = Path(file.filename).stem if file.filename else "file"
        file_stem_snake = _to_snake_case(orig_stem)
        filename = f"{file_stem_snake}{ext}"
        
        dest_dir.joinpath(filename).write_bytes(data)
        
        # NEW relative URL format
        rel_url = f"uploads/{client_snake}/{bu_snake}/{branch_snake}/{job_no_snake}/{filename}"
        
        results.append({"url": rel_url, "about": about.strip()})
    
    return results
```

#### 3.1.3 Update Delete Endpoints

**Single file delete by URL** (lines 165-184):
- URL now contains the new path structure
- `_resolve_path()` should still work since it resolves relative to `_BASE_DIR`

**Job folder delete** (lines 187-205):
```python
@router.delete("/{db_name}/job/{job_no}")
async def delete_job_files(
    db_name: str,
    job_no: str,
    client_code: str = Form(...),   # NEW
    bu_code: str = Form(...),        # NEW
    branch_code: str = Form(...),    # NEW
    _api_key: str = Depends(verify_api_key),
) -> dict[str, int]:
    job_no_snake = _to_snake_case(job_no)
    client_snake = _to_snake_case(client_code)
    bu_snake = _to_snake_case(bu_code)
    branch_snake = _to_snake_case(branch_code)
    
    # NEW path
    job_dir = _BASE_DIR / client_snake / bu_snake / branch_snake / job_no_snake
    # ... rest of function ...
```

#### 3.1.4 Update Serve Endpoint (lines 208-225)
The serve endpoint uses the URL path directly, so it should work with the new structure as long as the URL in the database matches the new format.

**Important**: The `serve_file` endpoint needs to correctly resolve the new path structure.

```python
@router.get("/uploads/{path:path}")
async def serve_file(path: str, _api_key: str = Depends(verify_api_key)) -> StreamingResponse:
    """Serve a file by its stored URL path."""
    # path will be like: "client_code/bu_code/branch_code/job_no/file.ext"
    relative = "/".join(path.split("/")[1:]) if path.startswith("uploads/") else path
    file_path = _resolve_path(relative)
    # ... rest of function ...
```

---

## 4. Database Migration Considerations

### 4.1 Existing File URLs in Database
The `url` field in the job files table stores the relative path. After this change:
- New uploads will have URLs like: `uploads/acme/mumbai/andheri/repair_001/image_123.webp`
- Old uploads have URLs like: `uploads/demo1/files/REP-001/image_123.webp`

### 4.2 Options for Handling Existing Files

**Option A: Migrate Existing Files**
1. Write a migration script to move files from old path to new path
2. Update URLs in database
3. Requires knowing `client_code`, `bu_code`, `branch_code` for all existing jobs

**Option B: Support Both Path Formats**
1. Keep old path resolution logic
2. Try new path first, fall back to old path
3. Less clean but easier to implement

**Recommended**: Option B for immediate compatibility, then gradually migrate.

### 4.3 Backward Compatibility in `files.py`
Update `serve_file` endpoint to try new path first, then fall back to old path:

```python
@router.get("/uploads/{path:path}")
async def serve_file(path: str, _api_key: str = Depends(verify_api_key)) -> StreamingResponse:
    relative = "/".join(path.split("/")[1:]) if path.startswith("uploads/") else path
    
    # Try new path first
    file_path = _resolve_path(relative)
    
    # Fall back to old path format if not found
    if not file_path.exists():
        # Try old format: {db_name}/files/{job_no}/{filename}
        parts = relative.split("/")
        if len(parts) >= 3:
            # Attempt old path reconstruction
            old_path = f"{parts[0]}/files/{parts[-2]}/{parts[-1]}"
            file_path = _resolve_path(old_path)
    
    # ... rest of function ...
```

---

## 5. Sequence of Implementation

1. **Create `string-utils.ts`** with `toSnakeCase()` function
2. **Update auth types and state** to include `clientCode`
3. **Update `image-service.ts`** to pass hierarchy fields
4. **Update `job-image-upload.tsx`** to get and pass hierarchy fields
5. **Update file server `files.py`**:
   - Add `_to_snake_case()` utility
   - Update upload endpoint
   - Update delete endpoints
   - Add backward compatibility to serve endpoint
6. **Test upload flow** with new hierarchy
7. **Plan and execute migration** of existing files (if required)

---

## 6. Testing Checklist

- [ ] Upload file from "new job" mode (before job is created - may need special handling)
- [ ] Upload file from "view job" mode (job exists)
- [ ] Verify file is stored at correct path: `{BASE_DIR}/{client_code}/{bu_code}/{branch_code}/{job_no_snake}/`
- [ ] Verify file URL in database matches new format
- [ ] Verify file is served correctly (view/download)
- [ ] Verify file delete works correctly
- [ ] Verify backward compatibility with old file URLs
- [ ] Test with special characters in job_no and filename

---

## 7. Edge Cases to Handle

1. **Job number with special characters**: Convert to snake_case properly
2. **Filename with special characters**: Convert to snake_case properly
3. **Missing `clientCode`/`buCode`/`branchCode`**: Provide fallback or show error
4. **New job (no job_id yet)**: Files may need to be stored temporarily and moved after job creation
5. **Branch code changes**: Unlikely but need to handle
6. **Multiple clients with same BU code**: Path includes client_code so should be unique

---

## 8. Files to Modify (Summary)

| File | Change Type | Description |
|------|-------------|-------------|
| `src/lib/string-utils.ts` | NEW | Utility for snake_case conversion |
| `src/features/auth/types/index.ts` | MODIFY | Add `clientCode` to `UserType` |
| `src/features/auth/store/auth-slice.ts` | MODIFY | Store `clientCode` during login |
| `src/lib/image-service.ts` | MODIFY | Pass hierarchy fields to server |
| `src/features/client/components/jobs/single-job/job-image-upload.tsx` | MODIFY | Get and pass hierarchy fields |
| `deployment/file-server/service-plus-file-server/app/routers/files.py` | MODIFY | New path structure, snake_case conversion |
| `deployment/file-server/service-plus-file-server/.env` | CHECK | No changes needed (BASE_DIR remains same) |

---

## 9. Environment/Config Changes

**No changes needed to `.env` file**. The `BASE_DIR` remains the same; only the subfolder structure changes.

---

## 10. Documentation Updates

Update any API documentation to reflect new upload endpoint parameters:
- `client_code` (string, required)
- `bu_code` (string, required)
- `branch_code` (string, required)
