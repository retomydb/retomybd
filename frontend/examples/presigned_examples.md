# Presigned URL examples

## 1) Obtain presigned URL (curl)

Request a presigned URL for a specific file (requires Bearer token if protected):

curl -H "Authorization: Bearer <TOKEN>" \
  "http://localhost:8000/datasets/<DATASET_ID>/files/<FILE_ID>/presign"

Response (JSON):

{
  "presigned_url": "https://...",
  "file_id": "<FILE_ID>"
}

## 2) Download with curl (directly using presigned URL)

Once you have the presigned URL, you can download the file without auth:

curl -L "<PRESIGNED_URL>" -o downloaded_file

## 3) Node example

Use the provided Node script `presigned_download.js`:

node frontend/examples/presigned_download.js http://localhost:8000 <DATASET_ID> <FILE_ID> "Bearer <TOKEN>"

This script will call the presign endpoint, print the URL and save the file locally as `downloaded_<FILE_ID>`.


## Notes
- Presigned URLs are time-limited; download before expiry.
- For primary files the API enforces entitlement checks. For non-primary files (samples/previews) the endpoint may return a presigned URL without purchase if dataset owner allows it.
- Replace `http://localhost:8000` with your API base URL and provide a valid JWT in the `Authorization` header when required.
