import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { datasetsApi } from '../services/api';
import { FiChevronLeft, FiChevronRight, FiFileText, FiImage } from 'react-icons/fi';

interface Props {
  datasetId?: string;
  dataset?: any;
  rows?: number;
  maxBytes?: number;
}

export default function PreviewPane({ datasetId, dataset, rows = 5, maxBytes = 64 * 1024 }: Props) {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [textPreview, setTextPreview] = useState<string | null>(null);
  const [tableRows, setTableRows] = useState<string[][] | null>(null);

  useEffect(() => {
    if (!datasetId) return;
    setLoading(true);
    setError(null);
    Promise.all([datasetsApi.getFiles(datasetId), Promise.resolve()])
      .then(([filesRes]) => {
        const fl = filesRes.data.files || [];
        setFiles(fl);
        // Prefer sample then preview
        const sample = fl.find((f: any) => f.FileCategory === 'sample');
        const preview = fl.find((f: any) => f.FileCategory === 'preview');

        const candidate = sample || preview || fl[0];
        if (candidate) fetchAndParse(candidate);
      })
      .catch((e: any) => setError('Failed to load preview'))
      .finally(() => setLoading(false));
  }, [datasetId]);

  const isImage = (mime?: string) => !!mime && mime.startsWith('image/');

  const fetchAndParse = async (file: any) => {
    if (!file?.BlobPath) return;
    try {
      const res = await fetch(file.BlobPath, { method: 'GET' });
      const ct = file.MimeType || res.headers.get('content-type') || '';

      if (isImage(ct)) {
        setTextPreview(null);
        setTableRows(null);
        // images are rendered from BlobPath directly
        return;
      }

      // If this is an Excel spreadsheet, fetch as ArrayBuffer and parse with SheetJS
      const isXlsx = ct.includes('spreadsheet') || ct.includes('officedocument') || (file.FileName && file.FileName.toLowerCase().endsWith('.xlsx')) || (file.BlobPath && file.BlobPath.toLowerCase().endsWith('.xlsx'));
      if (isXlsx) {
        try {
          const ab = await res.arrayBuffer();
          const wb = XLSX.read(ab, { type: 'array' });
          const firstName = wb.SheetNames && wb.SheetNames[0];
          if (firstName) {
            const sheet = wb.Sheets[firstName];
            const aoa: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
            if (aoa && aoa.length > 0) {
              const limited = aoa.slice(0, rows).map(r => r.map((c: any) => (c === undefined || c === null) ? '' : String(c)));
              setTableRows(limited);
              setTextPreview(null);
              return;
            }
          }
        } catch (e) {
          // fall through to other parsing heuristics
        }
      }

      const blob = await res.blob();
      const size = blob.size || 0;
      const toRead = Math.min(size, maxBytes);
      const text = await blob.text();

      // Try JSON
      if (ct.includes('json')) {
        try {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // derive headers from keys of first object
            const keys = Object.keys(parsed[0]);
            const rowsOut = [keys].concat(parsed.slice(0, rows).map((r: any) => keys.map(k => String(r[k] ?? ''))));
            setTableRows(rowsOut);
            setTextPreview(null);
            return;
          }
        } catch (_) { }
      }

      // Try CSV: split lines and commas (simple heuristic)
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length > 0 && lines[0].includes(',')) {
        const parsedRows = lines.slice(0, rows).map((l: string) => l.split(',').map(c => c.trim()));
        setTableRows(parsedRows);
        setTextPreview(null);
        return;
      }

      // fallback to preformatted text
      setTextPreview(text.slice(0, toRead));
      setTableRows(null);
    } catch (e) {
      setError('Failed to fetch preview');
    }
  };

  const previewImages = files.filter(f => isImage(f.MimeType));

  const safeFileName = (base: string, ext: string) => {
    const name = (base || 'sample').replace(/[^a-z0-9\-_\.]/gi, '_').slice(0, 120);
    return `${name}.${ext}`;
  };

  const downloadSample = () => {
    try {
      if (tableRows && tableRows.length > 0) {
        const csv = tableRows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = safeFileName(dataset?.Title || datasetId || 'sample', 'csv');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }

      if (textPreview) {
        const blob = new Blob([textPreview], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = safeFileName(dataset?.Title || datasetId || 'sample', 'txt');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }

      // Fallback: if there are preview images, download the first image file
      if (previewImages.length > 0) {
        const url = previewImages[0].BlobPath;
        const a = document.createElement('a');
        a.href = url;
        a.download = previewImages[0].FileName || safeFileName(dataset?.Title || datasetId || 'image', 'jpg');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (e) {
      setError('Failed to prepare download');
    }
  };

  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-retomy-text-bright mb-3 flex items-center gap-2">
        <FiImage /> Preview
      </h3>

      {loading && <p className="text-xs text-retomy-text-secondary">Loading preview…</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {!loading && !error && (
        <div>
          {previewImages.length > 0 ? (
            <div className="space-y-2">
              <div className="w-full h-40 bg-retomy-bg rounded overflow-hidden flex items-center justify-center">
                <img src={previewImages[imageIndex].BlobPath} alt={previewImages[imageIndex].FileName} className="w-full h-full object-cover" />
              </div>
              {previewImages.length > 1 && (
                <div className="flex items-center justify-between">
                  <button onClick={() => setImageIndex(i => Math.max(0, i - 1))} className="btn-secondary text-xs px-2 py-1">
                    <FiChevronLeft />
                  </button>
                  <span className="text-xs text-retomy-text-secondary">{imageIndex + 1} / {previewImages.length}</span>
                  <button onClick={() => setImageIndex(i => Math.min(previewImages.length - 1, i + 1))} className="btn-secondary text-xs px-2 py-1">
                    <FiChevronRight />
                  </button>
                </div>
              )}
              <a href={previewImages[imageIndex].BlobPath} target="_blank" rel="noreferrer" className="text-xs text-retomy-accent">Open image</a>
            </div>
          ) : tableRows ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <tbody>
                  {tableRows.map((r, ri) => (
                    <tr key={ri} className={ri === 0 ? 'font-semibold' : ''}>
                      {r.map((c, ci) => <td key={ci} className="p-1 border-b border-retomy-border/10">{c}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center gap-3">
                <button onClick={downloadSample} className="text-xs text-retomy-accent">Download sample rows</button>
                {(dataset?.SampleUrl || (files[0] && files[0].BlobPath)) && (
                  <a href={dataset?.SampleUrl || (files[0] && files[0].BlobPath)} target="_blank" rel="noreferrer" className="text-xs text-retomy-text-secondary">Open full file</a>
                )}
              </div>
            </div>
          ) : textPreview ? (
            <div>
              <pre className="bg-retomy-bg p-3 rounded text-xs text-retomy-text overflow-x-auto whitespace-pre-wrap max-h-48">{textPreview}</pre>
              <div className="flex items-center gap-3">
                <button onClick={downloadSample} className="text-xs text-retomy-accent">Download sample rows</button>
                {(dataset?.SampleUrl || (files[0] && files[0].BlobPath)) && (
                  <a href={dataset?.SampleUrl || (files[0] && files[0].BlobPath)} target="_blank" rel="noreferrer" className="text-xs text-retomy-text-secondary">Open full file</a>
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs text-retomy-text-secondary">
              <FiFileText className="inline-block mr-2" /> No preview available
            </div>
          )}
        </div>
      )}
    </div>
  );
}
