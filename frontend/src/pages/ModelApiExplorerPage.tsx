import { useState, useEffect } from 'react';
import { HiCode, HiClipboardCopy, HiCheck, HiExternalLink } from 'react-icons/hi';

const API = import.meta.env.VITE_API_BASE_URL || '/api/v1';

interface EndpointDoc {
  method: string;
  path: string;
  description: string;
  params?: { name: string; type: string; required: boolean; description?: string }[];
  example_response?: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="text-white/30 hover:text-violet-400 transition-colors" title="Copy">
      {copied ? <HiCheck className="w-4 h-4 text-green-400" /> : <HiClipboardCopy className="w-4 h-4" />}
    </button>
  );
}

function EndpointCard({ ep }: { ep: EndpointDoc }) {
  const [open, setOpen] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const tryIt = async () => {
    setLoading(true);
    try {
      const url = `${window.location.origin}${ep.path.replace(/{[^}]+}/g, 'example')}`;
      const res = await fetch(url);
      const text = await res.text();
      try {
        setResponse(JSON.stringify(JSON.parse(text), null, 2).slice(0, 3000));
      } catch {
        setResponse(text.slice(0, 3000));
      }
    } catch (e: any) {
      setResponse(`Error: ${e.message}`);
    }
    setLoading(false);
  };

  const curlExample = `curl '${window.location.origin}${ep.path}'`;

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
      {/* Header */}
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/[0.02] transition-colors">
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
          ep.method === 'GET' ? 'bg-green-500/15 text-green-400' :
          ep.method === 'POST' ? 'bg-blue-500/15 text-blue-400' :
          ep.method === 'PUT' ? 'bg-amber-500/15 text-amber-400' :
          ep.method === 'PATCH' ? 'bg-violet-500/15 text-violet-400' :
          'bg-red-500/15 text-red-400'
        }`}>{ep.method}</span>
        <code className="text-sm text-white/70 font-mono flex-1 text-left">{ep.path}</code>
        <span className="text-xs text-white/30">{ep.description}</span>
        <span className={`text-white/20 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {/* Expanded */}
      {open && (
        <div className="px-5 pb-5 border-t border-white/5 pt-4 space-y-4 animate-fade-in">
          <p className="text-sm text-white/50">{ep.description}</p>

          {/* Parameters */}
          {ep.params && ep.params.length > 0 && (
            <div>
              <h4 className="text-xs text-white/40 font-semibold uppercase mb-2">Parameters</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left py-1.5 text-white/30 font-medium w-32">Name</th>
                      <th className="text-left py-1.5 text-white/30 font-medium w-20">Type</th>
                      <th className="text-left py-1.5 text-white/30 font-medium w-16">Req.</th>
                      <th className="text-left py-1.5 text-white/30 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ep.params.map(p => (
                      <tr key={p.name} className="border-b border-white/[0.02]">
                        <td className="py-1.5 text-violet-300 font-mono">{p.name}</td>
                        <td className="py-1.5 text-cyan-400/60">{p.type}</td>
                        <td className="py-1.5">{p.required ? <span className="text-amber-400">yes</span> : <span className="text-white/20">no</span>}</td>
                        <td className="py-1.5 text-white/40">{p.description || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* cURL example */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="text-xs text-white/40 font-semibold uppercase">cURL Example</h4>
              <CopyButton text={curlExample} />
            </div>
            <pre className="bg-black/30 rounded-lg p-3 text-xs text-green-400/80 font-mono overflow-x-auto">
              {curlExample}
            </pre>
          </div>

          {/* Python example */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="text-xs text-white/40 font-semibold uppercase">Python Example</h4>
              <CopyButton text={`import requests\nres = requests.get("${window.location.origin}${ep.path}")\nprint(res.json())`} />
            </div>
            <pre className="bg-black/30 rounded-lg p-3 text-xs text-blue-400/80 font-mono overflow-x-auto">
{`import requests
res = requests.get("${window.location.origin}${ep.path}")
print(res.json())`}
            </pre>
          </div>

          {/* JavaScript example */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="text-xs text-white/40 font-semibold uppercase">JavaScript Example</h4>
            </div>
            <pre className="bg-black/30 rounded-lg p-3 text-xs text-amber-400/80 font-mono overflow-x-auto">
{`const res = await fetch("${ep.path}");
const data = await res.json();
console.log(data);`}
            </pre>
          </div>

          {/* Try it */}
          <div>
            <button onClick={tryIt} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-300 text-xs font-medium hover:bg-violet-600/30 transition-all disabled:opacity-50">
              <HiExternalLink className="w-3.5 h-3.5" />
              {loading ? 'Loading…' : 'Try it →'}
            </button>
            {response && (
              <pre className="mt-3 bg-black/30 rounded-lg p-3 text-[11px] text-white/50 font-mono overflow-x-auto max-h-60 overflow-y-auto">
                {response}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ModelApiExplorerPage() {
  const [schema, setSchema] = useState<{ endpoints: EndpointDoc[]; base_url: string; auth: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/models/analytics/api-schema`)
      .then(r => r.json())
      .then(d => { setSchema(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center gap-3 mb-6">
        <HiCode className="w-5 h-5 text-violet-400" />
        <div>
          <h2 className="text-lg font-semibold text-white">API Explorer</h2>
          <p className="text-xs text-white/30">Explore the retomY Model API — try endpoints live in your browser</p>
        </div>
      </div>

      {/* Auth info */}
      <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl px-5 py-3 mb-6">
        <p className="text-xs text-amber-400/80">
          <strong className="font-semibold">Authentication:</strong> Most read endpoints are public. For write operations, include a Bearer token in the Authorization header.
        </p>
      </div>

      {/* Endpoints */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-white/[0.03] rounded-xl animate-pulse" />)}
        </div>
      ) : schema ? (
        <div className="space-y-3">
          {schema.endpoints.map(ep => <EndpointCard key={`${ep.method}-${ep.path}`} ep={ep} />)}
        </div>
      ) : (
        <p className="text-white/30 text-center py-12">Failed to load API schema</p>
      )}

      {/* Rate limits */}
      <div className="mt-8 bg-white/[0.02] border border-white/5 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white/60 mb-3 uppercase tracking-wider">Rate Limits & Usage</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="bg-white/[0.03] rounded-lg p-3">
            <p className="text-white/50 font-medium">Public</p>
            <p className="text-white/30 mt-1">100 req/min, no auth required</p>
          </div>
          <div className="bg-white/[0.03] rounded-lg p-3">
            <p className="text-white/50 font-medium">Authenticated</p>
            <p className="text-white/30 mt-1">1,000 req/min with Bearer token</p>
          </div>
          <div className="bg-white/[0.03] rounded-lg p-3">
            <p className="text-white/50 font-medium">Format</p>
            <p className="text-white/30 mt-1">JSON responses, UTF-8 encoding</p>
          </div>
        </div>
      </div>
    </div>
  );
}
