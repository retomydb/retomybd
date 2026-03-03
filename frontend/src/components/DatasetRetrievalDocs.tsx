import React from 'react';

type Props = {
  datasetId: string;
  dataset?: any;
};

export default function DatasetRetrievalDocs({ datasetId, dataset }: Props) {
  // Use Vite env variable; avoid `process` in the browser
  const apiBase = (import.meta as any).env?.VITE_API_BASE || '';
  const sampleFilePlaceholder = '<FILE_ID_OR_SAMPLE_ID>';

  return (
    <div className="prose prose-invert max-w-none">
      <h3>How to retrieve this dataset (programmatic + UI)</h3>
      <p className="text-sm text-retomy-text-secondary">This section shows the supported retrieval flows, exact endpoints, example commands, and common troubleshooting notes.</p>

      <h4>A — Browser / UI</h4>
      <p className="text-sm">If you are the dataset owner or have an active purchase/entitlement, the listing sidebar shows a <strong>Download Data</strong> button. Owners bypass entitlement checks and can download directly.</p>

      <h4>B — Programmatic flows (recommended)</h4>
      <p className="text-sm">There are three common programmatic flows you will use:</p>
      <ol className="text-sm">
        <li>Claim free access / create a purchase (for free datasets).</li>
        <li>Request a presigned URL for a file.</li>
        <li>Download the file using the presigned URL.</li>
      </ol>

      <h5>1) Claim free dataset (when Price = 0)</h5>
      <p className="text-sm">Use the purchases endpoint to claim free datasets. Important: this endpoint expects a GUID `dataset_id` (not the slug). Passing a slug will cause a server error (stored procedure expects a UNIQUEIDENTIFIER).</p>
      <pre className="rounded bg-retomy-bg p-3 text-xs overflow-x-auto whitespace-pre max-w-full">{`POST ${apiBase}/purchases
Headers: Authorization: Bearer <YOUR_JWT>
Body: {"dataset_id":"<DATASET_GUID>"}`}</pre>

      <h5>Example (curl)</h5>
      <pre className="rounded bg-retomy-bg p-3 text-xs overflow-x-auto whitespace-pre max-w-full">{`curl -s -X POST "${apiBase}/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"dataset_id":"<DATASET_GUID>"}' | jq .`}</pre>

      <p className="text-sm">The purchase response may include a `purchase` object and sometimes a `download_url`. If not, capture `purchase.PurchaseId` from the response and use the download endpoints below.</p>

      <h5>2) Request a presigned URL for a file</h5>
      <p className="text-sm">For individual files use the presign endpoint. Primary files require an active entitlement (or owning the dataset). Preview/sample files may be available without purchase depending on the seller.</p>
      <pre className="rounded bg-retomy-bg p-3 text-xs overflow-x-auto whitespace-pre max-w-full">{`GET ${apiBase}/datasets/${datasetId}/files/<FILE_ID>/presign
Headers: Authorization: Bearer <YOUR_JWT>  (required for primary files)`}</pre>

      <h5>Standard responses</h5>
      <pre className="rounded bg-retomy-bg p-3 text-xs overflow-x-auto whitespace-pre max-w-full">{`{
  "presigned_url": "https://...",
  "file_id": "..."
}`}</pre>

      <h5>curl example</h5>
      <pre className="rounded bg-retomy-bg p-3 text-xs overflow-x-auto whitespace-pre max-w-full">{`curl -s -H "Authorization: Bearer <TOKEN>" \
  "${apiBase}/datasets/${datasetId}/files/<FILE_ID>/presign" | jq .`}</pre>

      <h5>3) Alternate download endpoints</h5>
      <p className="text-sm">If you have a purchase id or want to request a download by dataset id, the API exposes:</p>
      <pre className="rounded bg-retomy-bg p-3 text-xs overflow-x-auto whitespace-pre max-w-full">{`GET ${apiBase}/purchases/<PURCHASE_ID>/download
GET ${apiBase}/purchases/download-by-dataset/<DATASET_GUID>`}</pre>

      <h5>Example (get download by dataset)</h5>
      <pre className="rounded bg-retomy-bg p-3 text-xs overflow-x-auto whitespace-pre max-w-full">{`curl -s -H "Authorization: Bearer <TOKEN>" \
  "${apiBase}/purchases/download-by-dataset/<DATASET_GUID>" | jq .`}</pre>

      <h5>4) Download using curl</h5>
      <pre className="rounded bg-retomy-bg p-3 text-xs overflow-x-auto whitespace-pre max-w-full">{`curl -L "<PRESIGNED_URL>" -o downloaded_file.ext`}</pre>

      <h5>Node example</h5>
      <p className="text-sm">See <span className="font-mono">frontend/examples/presigned_download.js</span> for a copy-paste Node script that (1) calls the presign endpoint and (2) streams the file to disk.</p>

      <h4>Implementation details & TTLs</h4>
      <ul>
        <li className="text-sm">API prefix: <code>{apiBase}</code> — examples above use this base (your Vite env <code>VITE_API_BASE</code> should include the API prefix such as <code>/api/v1</code>).</li>
        <li className="text-sm">Primary file presigned URLs: issued with a short TTL (typically 4 hours).</li>
        <li className="text-sm">Thumbnails and preview links: may use a longer TTL (typically 24 hours).</li>
        <li className="text-sm">Entitlement checks: primary files require an active entitlement (purchase). Owners and admins bypass entitlement checks and can download directly.</li>
        <li className="text-sm">Accounting: requesting a presigned URL for a primary file increments the entitlement's download count (server increments `Entitlements.DownloadCount` when issuing URLs).</li>
      </ul>

      <h4>Troubleshooting</h4>
      <ul>
        <li className="text-sm">If you receive a 500/internal error when claiming a dataset, confirm you passed the dataset GUID (UUID) to the <code>POST /purchases</code> call — passing a slug will cause a conversion error in the stored procedure.</li>
        <li className="text-sm">If a presign call returns 403, ensure your JWT is present and belongs to a user that purchased the dataset or is the owner.</li>
        <li className="text-sm">If a purchase response doesn&apos;t include <code>download_url</code>, capture the returned <code>PurchaseId</code> and call <code>GET /purchases/&lt;purchase_id&gt;/download</code>.</li>
      </ul>

      <div className="mt-4 text-sm">
        <strong>More examples</strong>: see <span className="font-mono">frontend/examples/presigned_examples.md</span> and <span className="font-mono">frontend/examples/presigned_download.js</span> in the repo for copy-paste commands and Node scripts.
      </div>
    </div>
  );
}
