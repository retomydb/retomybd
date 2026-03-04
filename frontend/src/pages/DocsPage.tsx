import { useState } from 'react';
import { FiBook, FiKey, FiSearch, FiDownload, FiShoppingCart, FiCopy, FiCheck, FiCode, FiDatabase, FiLock, FiArrowRight } from 'react-icons/fi';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://retomy.com/api/v1';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors" title="Copy">
      {copied ? <FiCheck className="w-4 h-4 text-green-400" /> : <FiCopy className="w-4 h-4" />}
    </button>
  );
}

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  return (
    <div className="relative group">
      <CopyButton text={code} />
      <pre className="bg-[#0d1117] border border-white/10 rounded-lg p-4 overflow-x-auto text-sm text-gray-300 font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

const sections = [
  { id: 'overview', label: 'Overview', icon: FiBook },
  { id: 'authentication', label: 'Authentication', icon: FiKey },
  { id: 'datasets', label: 'Browse Datasets', icon: FiSearch },
  { id: 'purchase', label: 'Purchase & Claim', icon: FiShoppingCart },
  { id: 'download', label: 'Download Files', icon: FiDownload },
  { id: 'python-sdk', label: 'Python Quick Start', icon: FiCode },
];

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('overview');

  return (
    <div className="min-h-screen bg-retomy-surface py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 rounded-full px-4 py-1.5 mb-4">
            <FiDatabase className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-medium text-indigo-300">Developer Documentation</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">retomY API Reference</h1>
          <p className="text-retomy-text-secondary max-w-2xl mx-auto text-lg">
            Programmatically discover, purchase, and download datasets using our REST API.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 bg-[#0d1117] border border-white/10 rounded-lg px-4 py-2 text-sm font-mono text-gray-400">
            Base URL: <span className="text-indigo-400">{API_BASE}</span>
          </div>
        </div>

        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <nav className="hidden lg:block w-56 shrink-0 sticky top-24 self-start">
            <ul className="space-y-1">
              {sections.map((s) => {
                const Icon = s.icon;
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => {
                        setActiveSection(s.id);
                        document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                        activeSection === s.id
                          ? 'bg-indigo-500/15 text-indigo-400 font-medium'
                          : 'text-retomy-text-secondary hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {s.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-16">

            {/* Overview */}
            <section id="overview">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                <FiBook className="text-indigo-400" /> Overview
              </h2>
              <div className="bg-retomy-card border border-white/10 rounded-xl p-6 space-y-4">
                <p className="text-retomy-text-secondary leading-relaxed">
                  The retomY API lets you integrate data marketplace capabilities directly into your applications and
                  data pipelines. All endpoints return JSON and use standard HTTP methods.
                </p>
                <div className="grid sm:grid-cols-3 gap-4 mt-6">
                  <div className="bg-white/5 rounded-lg p-4 border border-white/5">
                    <FiLock className="w-5 h-5 text-indigo-400 mb-2" />
                    <h3 className="text-white font-medium text-sm mb-1">JWT Authentication</h3>
                    <p className="text-xs text-retomy-text-secondary">Bearer token auth with refresh support</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-4 border border-white/5">
                    <FiDatabase className="w-5 h-5 text-purple-400 mb-2" />
                    <h3 className="text-white font-medium text-sm mb-1">RESTful JSON</h3>
                    <p className="text-xs text-retomy-text-secondary">All responses in standard JSON format</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-4 border border-white/5">
                    <FiDownload className="w-5 h-5 text-emerald-400 mb-2" />
                    <h3 className="text-white font-medium text-sm mb-1">Presigned URLs</h3>
                    <p className="text-xs text-retomy-text-secondary">Secure time-limited download links</p>
                  </div>
                </div>
                <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <p className="text-sm text-amber-200">
                    <strong>Rate Limiting:</strong> API requests are rate-limited. For bulk operations, add reasonable
                    delays between calls.
                  </p>
                </div>
              </div>
            </section>

            {/* Authentication */}
            <section id="authentication">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                <FiKey className="text-indigo-400" /> Authentication
              </h2>
              <div className="bg-retomy-card border border-white/10 rounded-xl p-6 space-y-6">
                <p className="text-retomy-text-secondary leading-relaxed">
                  Most endpoints require a JWT bearer token. Obtain one by logging in with your email and password.
                </p>

                <div>
                  <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                    <span className="bg-green-500/20 text-green-400 text-xs font-mono px-2 py-0.5 rounded">POST</span>
                    <code className="text-sm">/api/v1/auth/login</code>
                  </h3>
                  <CodeBlock code={`curl -X POST ${API_BASE}/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "you@example.com",
    "password": "your_password"
  }'`} />
                </div>

                <div>
                  <h3 className="text-white font-semibold mb-2">Response</h3>
                  <CodeBlock language="json" code={`{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 86400,
  "user": {
    "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "email": "you@example.com",
    "display_name": "Your Name",
    "role": "buyer"
  }
}`} />
                </div>

                <div>
                  <h3 className="text-white font-semibold mb-2">Using the token</h3>
                  <p className="text-retomy-text-secondary text-sm mb-3">
                    Include the token in the <code className="text-indigo-400">Authorization</code> header for authenticated requests:
                  </p>
                  <CodeBlock code={`curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  ${API_BASE}/auth/me`} />
                </div>

                <div>
                  <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                    <span className="bg-green-500/20 text-green-400 text-xs font-mono px-2 py-0.5 rounded">POST</span>
                    <code className="text-sm">/api/v1/auth/refresh</code>
                  </h3>
                  <p className="text-retomy-text-secondary text-sm mb-3">
                    Refresh an expired access token without re-entering credentials:
                  </p>
                  <CodeBlock code={`curl -X POST ${API_BASE}/auth/refresh \\
  -H "Content-Type: application/json" \\
  -d '{"refresh_token": "YOUR_REFRESH_TOKEN"}'`} />
                </div>
              </div>
            </section>

            {/* Browse Datasets */}
            <section id="datasets">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                <FiSearch className="text-indigo-400" /> Browse Datasets
              </h2>
              <div className="bg-retomy-card border border-white/10 rounded-xl p-6 space-y-6">
                <p className="text-retomy-text-secondary leading-relaxed">
                  Discover datasets with powerful search and filtering. No authentication required.
                </p>

                <div>
                  <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                    <span className="bg-blue-500/20 text-blue-400 text-xs font-mono px-2 py-0.5 rounded">GET</span>
                    <code className="text-sm">/api/v1/datasets</code>
                  </h3>
                  <div className="mb-3">
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Query Parameters</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/10 text-left">
                            <th className="py-2 pr-4 text-gray-400 font-medium">Parameter</th>
                            <th className="py-2 pr-4 text-gray-400 font-medium">Type</th>
                            <th className="py-2 text-gray-400 font-medium">Description</th>
                          </tr>
                        </thead>
                        <tbody className="text-retomy-text-secondary">
                          <tr className="border-b border-white/5">
                            <td className="py-2 pr-4 font-mono text-indigo-400 text-xs">query</td>
                            <td className="py-2 pr-4">string</td>
                            <td className="py-2">Full-text search across title and description</td>
                          </tr>
                          <tr className="border-b border-white/5">
                            <td className="py-2 pr-4 font-mono text-indigo-400 text-xs">category_id</td>
                            <td className="py-2 pr-4">int</td>
                            <td className="py-2">Filter by category</td>
                          </tr>
                          <tr className="border-b border-white/5">
                            <td className="py-2 pr-4 font-mono text-indigo-400 text-xs">pricing_model</td>
                            <td className="py-2 pr-4">string</td>
                            <td className="py-2"><code className="text-xs">free</code> or <code className="text-xs">paid</code></td>
                          </tr>
                          <tr className="border-b border-white/5">
                            <td className="py-2 pr-4 font-mono text-indigo-400 text-xs">file_format</td>
                            <td className="py-2 pr-4">string</td>
                            <td className="py-2">e.g. <code className="text-xs">csv</code>, <code className="text-xs">json</code>, <code className="text-xs">parquet</code></td>
                          </tr>
                          <tr className="border-b border-white/5">
                            <td className="py-2 pr-4 font-mono text-indigo-400 text-xs">sort_by</td>
                            <td className="py-2 pr-4">string</td>
                            <td className="py-2"><code className="text-xs">newest</code>, <code className="text-xs">downloads</code>, <code className="text-xs">rating</code>, <code className="text-xs">price_asc</code>, <code className="text-xs">price_desc</code></td>
                          </tr>
                          <tr>
                            <td className="py-2 pr-4 font-mono text-indigo-400 text-xs">page / page_size</td>
                            <td className="py-2 pr-4">int</td>
                            <td className="py-2">Pagination (default page_size: 12)</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <CodeBlock code={`# Search for free CSV datasets
curl "${API_BASE}/datasets?query=finance&pricing_model=free&file_format=csv&page=1"

# Get trending datasets
curl "${API_BASE}/datasets?sort_by=downloads&page_size=5"`} />
                </div>

                <div>
                  <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                    <span className="bg-blue-500/20 text-blue-400 text-xs font-mono px-2 py-0.5 rounded">GET</span>
                    <code className="text-sm">/api/v1/datasets/categories</code>
                  </h3>
                  <p className="text-retomy-text-secondary text-sm mb-3">
                    List all available categories to use in filters.
                  </p>
                  <CodeBlock code={`curl ${API_BASE}/datasets/categories`} />
                </div>

                <div>
                  <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                    <span className="bg-blue-500/20 text-blue-400 text-xs font-mono px-2 py-0.5 rounded">GET</span>
                    <code className="text-sm">{'/api/v1/datasets/{dataset_id}'}</code>
                  </h3>
                  <p className="text-retomy-text-secondary text-sm mb-3">
                    Get full details for a specific dataset by its GUID.
                  </p>
                  <CodeBlock code={`curl ${API_BASE}/datasets/58E1A57C-9EEE-4301-A9D1-EA3DD2BC862D`} />
                </div>
              </div>
            </section>

            {/* Purchase & Claim */}
            <section id="purchase">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                <FiShoppingCart className="text-indigo-400" /> Purchase & Claim
              </h2>
              <div className="bg-retomy-card border border-white/10 rounded-xl p-6 space-y-6">
                <p className="text-retomy-text-secondary leading-relaxed">
                  Claim free datasets instantly or initiate Stripe checkout for paid datasets. All dataset IDs must be
                  UUID/GUID format.
                </p>

                <div>
                  <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                    <span className="bg-green-500/20 text-green-400 text-xs font-mono px-2 py-0.5 rounded">POST</span>
                    <code className="text-sm">/api/v1/purchases</code>
                    <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">Auth Required</span>
                  </h3>
                  <p className="text-retomy-text-secondary text-sm mb-3">
                    Claim a free dataset. For paid datasets this returns a 402 status with a redirect URL to Stripe checkout.
                  </p>
                  <CodeBlock code={`curl -X POST ${API_BASE}/purchases \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"dataset_id": "58E1A57C-9EEE-4301-A9D1-EA3DD2BC862D"}'`} />
                </div>

                <div>
                  <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                    <span className="bg-green-500/20 text-green-400 text-xs font-mono px-2 py-0.5 rounded">POST</span>
                    <code className="text-sm">/api/v1/payments/create-checkout-session</code>
                    <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">Auth Required</span>
                  </h3>
                  <p className="text-retomy-text-secondary text-sm mb-3">
                    Create a Stripe Checkout session for one or more paid datasets:
                  </p>
                  <CodeBlock code={`curl -X POST ${API_BASE}/payments/create-checkout-session \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"dataset_ids": ["DATASET_GUID_1", "DATASET_GUID_2"]}'

# Response: {"checkout_url": "https://checkout.stripe.com/...", "session_id": "cs_live_..."}`} />
                </div>

                <div>
                  <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                    <span className="bg-blue-500/20 text-blue-400 text-xs font-mono px-2 py-0.5 rounded">GET</span>
                    <code className="text-sm">/api/v1/purchases/my-purchases</code>
                    <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">Auth Required</span>
                  </h3>
                  <p className="text-retomy-text-secondary text-sm mb-3">
                    List all your purchased datasets:
                  </p>
                  <CodeBlock code={`curl -H "Authorization: Bearer YOUR_TOKEN" \\
  "${API_BASE}/purchases/my-purchases?page=1"`} />
                </div>
              </div>
            </section>

            {/* Download Files */}
            <section id="download">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                <FiDownload className="text-indigo-400" /> Download Files
              </h2>
              <div className="bg-retomy-card border border-white/10 rounded-xl p-6 space-y-6">
                <p className="text-retomy-text-secondary leading-relaxed">
                  After purchasing a dataset, download its files via presigned URLs. These are temporary links valid
                  for approximately 4 hours.
                </p>

                <div>
                  <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                    <span className="bg-blue-500/20 text-blue-400 text-xs font-mono px-2 py-0.5 rounded">GET</span>
                    <code className="text-sm">{'/api/v1/datasets/{dataset_id}/files'}</code>
                  </h3>
                  <p className="text-retomy-text-secondary text-sm mb-3">
                    List all files in a dataset. Non-authenticated users see only sample/preview files.
                    Owners and buyers see all files including primary data.
                  </p>
                  <CodeBlock code={`curl -H "Authorization: Bearer YOUR_TOKEN" \\
  ${API_BASE}/datasets/58E1A57C-9EEE-4301-A9D1-EA3DD2BC862D/files`} />
                </div>

                <div>
                  <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                    <span className="bg-blue-500/20 text-blue-400 text-xs font-mono px-2 py-0.5 rounded">GET</span>
                    <code className="text-sm">{'/api/v1/datasets/{dataset_id}/files/{file_id}/presign'}</code>
                    <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">Auth Required</span>
                  </h3>
                  <p className="text-retomy-text-secondary text-sm mb-3">
                    Get a temporary presigned download URL for a specific file:
                  </p>
                  <CodeBlock code={`curl -H "Authorization: Bearer YOUR_TOKEN" \\
  ${API_BASE}/datasets/DATASET_GUID/files/FILE_GUID/presign

# Response:
# {"url": "https://storage.blob.core.windows.net/...", "expires_in": 14400}`} />
                </div>

                <div>
                  <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                    <span className="bg-blue-500/20 text-blue-400 text-xs font-mono px-2 py-0.5 rounded">GET</span>
                    <code className="text-sm">{'/api/v1/purchases/download-by-dataset/{dataset_id}'}</code>
                    <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">Auth Required</span>
                  </h3>
                  <p className="text-retomy-text-secondary text-sm mb-3">
                    Convenience endpoint — get a download URL using only the dataset GUID:
                  </p>
                  <CodeBlock code={`curl -H "Authorization: Bearer YOUR_TOKEN" \\
  ${API_BASE}/purchases/download-by-dataset/58E1A57C-9EEE-4301-A9D1-EA3DD2BC862D`} />
                </div>

                <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                  <p className="text-sm text-indigo-200">
                    <strong>Tip:</strong> Download the file immediately using <code className="text-indigo-400">curl -L -o output.csv "PRESIGNED_URL"</code>.
                    Presigned URLs expire after ~4 hours for primary files and ~24 hours for thumbnails/previews.
                  </p>
                </div>
              </div>
            </section>

            {/* Python Quick Start */}
            <section id="python-sdk">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                <FiCode className="text-indigo-400" /> Python Quick Start
              </h2>
              <div className="bg-retomy-card border border-white/10 rounded-xl p-6 space-y-6">
                <p className="text-retomy-text-secondary leading-relaxed">
                  Complete example: authenticate, find a dataset, claim it, and download the file — all in Python.
                </p>
                <CodeBlock language="python" code={`import requests

API = "${API_BASE}"

# 1. Authenticate
resp = requests.post(f"{'{'}API{'}'}/auth/login", json={'{'}
    "email": "you@example.com",
    "password": "your_password"
{'}'})
token = resp.json()["access_token"]
headers = {"Authorization": f"Bearer {'{'}token{'}'}"}

# 2. Search for datasets
datasets = requests.get(f"{'{'}API{'}'}/datasets", params={'{'}
    "query": "finance",
    "pricing_model": "free",
    "page_size": 5
{'}'}).json()

for ds in datasets.get("datasets", []):
    print(f"{'{'}ds['title']{'}'} — {'{'}ds['pricing_model']{'}'} — {'{'}ds['id']{'}'}")

# 3. Claim a free dataset
dataset_id = datasets["datasets"][0]["id"]
purchase = requests.post(f"{'{'}API{'}'}/purchases",
    headers=headers,
    json={"dataset_id": dataset_id}
).json()
print("Purchase:", purchase)

# 4. List files in the dataset
files = requests.get(f"{'{'}API{'}'}/datasets/{'{'}dataset_id{'}'}/files",
    headers=headers
).json()

# 5. Get presigned URL and download
for f in files.get("files", []):
    presign = requests.get(
        f"{'{'}API{'}'}/datasets/{'{'}dataset_id{'}'}/files/{'{'}f['id']{'}'}/presign",
        headers=headers
    ).json()
    
    # Download the file
    download = requests.get(presign["url"])
    with open(f["original_filename"], "wb") as out:
        out.write(download.content)
    print(f"Downloaded {'{'}f['original_filename']{'}'} ({'{'}len(download.content){'}'} bytes)")`} />
              </div>
            </section>

            {/* Additional Endpoints */}
            <section id="more">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                <FiArrowRight className="text-indigo-400" /> Additional Endpoints
              </h2>
              <div className="bg-retomy-card border border-white/10 rounded-xl p-6 space-y-4">
                <p className="text-retomy-text-secondary leading-relaxed mb-4">
                  The API also supports user profiles, wishlists, reviews, seller dashboards, and admin operations.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-left">
                        <th className="py-2 pr-4 text-gray-400 font-medium">Method</th>
                        <th className="py-2 pr-4 text-gray-400 font-medium">Endpoint</th>
                        <th className="py-2 pr-4 text-gray-400 font-medium">Auth</th>
                        <th className="py-2 text-gray-400 font-medium">Description</th>
                      </tr>
                    </thead>
                    <tbody className="text-retomy-text-secondary font-mono text-xs">
                      <tr className="border-b border-white/5">
                        <td className="py-2 pr-4"><span className="text-blue-400">GET</span></td>
                        <td className="py-2 pr-4 text-indigo-300">/api/v1/auth/me</td>
                        <td className="py-2 pr-4 text-yellow-400">Yes</td>
                        <td className="py-2 font-sans">Get current user profile</td>
                      </tr>
                      <tr className="border-b border-white/5">
                        <td className="py-2 pr-4"><span className="text-green-400">POST</span></td>
                        <td className="py-2 pr-4 text-indigo-300">/api/v1/auth/signup</td>
                        <td className="py-2 pr-4 text-gray-500">No</td>
                        <td className="py-2 font-sans">Register a new account</td>
                      </tr>
                      <tr className="border-b border-white/5">
                        <td className="py-2 pr-4"><span className="text-orange-400">PUT</span></td>
                        <td className="py-2 pr-4 text-indigo-300">/api/v1/users/profile</td>
                        <td className="py-2 pr-4 text-yellow-400">Yes</td>
                        <td className="py-2 font-sans">Update your profile</td>
                      </tr>
                      <tr className="border-b border-white/5">
                        <td className="py-2 pr-4"><span className="text-green-400">POST</span></td>
                        <td className="py-2 pr-4 text-indigo-300">{'/api/v1/datasets/{id}/reviews'}</td>
                        <td className="py-2 pr-4 text-yellow-400">Yes</td>
                        <td className="py-2 font-sans">Submit a dataset review</td>
                      </tr>
                      <tr className="border-b border-white/5">
                        <td className="py-2 pr-4"><span className="text-green-400">POST</span></td>
                        <td className="py-2 pr-4 text-indigo-300">{'/api/v1/datasets/{id}/wishlist'}</td>
                        <td className="py-2 pr-4 text-yellow-400">Yes</td>
                        <td className="py-2 font-sans">Toggle wishlist add/remove</td>
                      </tr>
                      <tr className="border-b border-white/5">
                        <td className="py-2 pr-4"><span className="text-blue-400">GET</span></td>
                        <td className="py-2 pr-4 text-indigo-300">/api/v1/dashboard/buyer</td>
                        <td className="py-2 pr-4 text-yellow-400">Yes</td>
                        <td className="py-2 font-sans">Buyer dashboard & stats</td>
                      </tr>
                      <tr className="border-b border-white/5">
                        <td className="py-2 pr-4"><span className="text-blue-400">GET</span></td>
                        <td className="py-2 pr-4 text-indigo-300">/api/v1/dashboard/seller</td>
                        <td className="py-2 pr-4 text-yellow-400">Yes</td>
                        <td className="py-2 font-sans">Seller dashboard & revenue</td>
                      </tr>
                      <tr className="border-b border-white/5">
                        <td className="py-2 pr-4"><span className="text-blue-400">GET</span></td>
                        <td className="py-2 pr-4 text-indigo-300">/api/v1/datasets/categories</td>
                        <td className="py-2 pr-4 text-gray-500">No</td>
                        <td className="py-2 font-sans">List all categories</td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-4"><span className="text-blue-400">GET</span></td>
                        <td className="py-2 pr-4 text-indigo-300">/api/v1/datasets/featured</td>
                        <td className="py-2 pr-4 text-gray-500">No</td>
                        <td className="py-2 font-sans">Featured, trending & new arrivals</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
