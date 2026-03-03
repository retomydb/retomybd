// Node example: fetch presigned URL for a dataset file and download it
// Usage: node presigned_download.js <API_BASE> <DATASET_ID> <FILE_ID> <BEARER_TOKEN>
// Example: node presigned_download.js http://localhost:8000 api-dataset-id file-id "Bearer ey..."

const fs = require('fs');
const https = require('https');
const http = require('http');
const fetch = require('node-fetch');

async function main() {
  const [,, apiBase, datasetId, fileId, bearer] = process.argv;
  if (!apiBase || !datasetId || !fileId || !bearer) {
    console.error('Usage: node presigned_download.js <API_BASE> <DATASET_ID> <FILE_ID> <BEARER_TOKEN>');
    process.exit(1);
  }

  const url = `${apiBase.replace(/\/$/, '')}/datasets/${datasetId}/files/${fileId}/presign`;

  // Request presigned URL
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': bearer,
      'Accept': 'application/json'
    }
  });

  if (!res.ok) {
    console.error('Failed to get presigned URL', res.status, await res.text());
    process.exit(2);
  }

  const data = await res.json();
  const presigned = data.presigned_url;
  console.log('Presigned URL:', presigned);

  // Download using native http/https
  const outPath = `downloaded_${fileId}`;
  const client = presigned.startsWith('https') ? https : http;
  client.get(presigned, (resp) => {
    if (resp.statusCode !== 200) {
      console.error('Download failed:', resp.statusCode);
      process.exit(3);
    }
    const file = fs.createWriteStream(outPath);
    resp.pipe(file);
    file.on('finish', () => {
      file.close();
      console.log('Saved to', outPath);
    });
  }).on('error', (err) => {
    console.error('Download error', err.message);
  });
}

main().catch(err => { console.error(err); process.exit(99); });
