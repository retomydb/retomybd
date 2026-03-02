import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { datasetsApi, getApiError } from '../services/api';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import {
  FiUploadCloud, FiTrash2, FiFile, FiImage, FiBook,
  FiEye, FiArrowLeft, FiCheck, FiLoader, FiDatabase,
  FiPackage, FiSend
} from 'react-icons/fi';

interface DatasetFile {
  FileId: string;
  FileName: string;
  BlobPath?: string;
  FileSize: number;
  MimeType: string;
  FileCategory: string;
  Checksum?: string;
  SortOrder: number;
  UploadedAt: string;
}

const CATEGORY_LABELS: Record<string, { label: string; icon: any; desc: string }> = {
  primary: { label: 'Primary Data', icon: FiDatabase, desc: 'Main dataset files (CSV, Parquet, images, video, ZIP, etc.)' },
  sample: { label: 'Sample / Preview', icon: FiEye, desc: 'Free preview files buyers can access before purchase' },
  documentation: { label: 'Documentation', icon: FiBook, desc: 'README, data dictionary, methodology docs' },
  preview: { label: 'Preview Images', icon: FiImage, desc: 'Screenshots, charts, visualizations for the listing' },
};

const formatSize = (bytes: number) => {
  if (!bytes) return '0 B';
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
};

export default function DatasetManagePage() {
  const { id } = useParams<{ id: string }>();
  const { user, loadUser } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const justCreated = (location.state as any)?.justCreated === true;

  const [dataset, setDataset] = useState<any>(null);
  const [files, setFiles] = useState<DatasetFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null); // category being uploaded
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState<string | null>(null);

  useEffect(() => {
    console.log('[DatasetManagePage] mounted, id =', id, 'user =', user?.user_id, 'justCreated =', justCreated);
    // If user is null but token exists, rehydrate the user first
    const token = localStorage.getItem('retomy_access_token');
    if (!user && token) {
      console.log('[DatasetManagePage] user is null, rehydrating...');
      loadUser().then(() => {
        if (id) loadAll();
      });
    } else if (id) {
      loadAll();
    }
  }, [id]);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [detailRes, filesRes] = await Promise.all([
        datasetsApi.getDetail(id!),
        datasetsApi.getFiles(id!),
      ]);
      const ds = detailRes.data.dataset || null;
      const fl = filesRes.data.files || [];
      console.log('[DatasetManagePage] loadAll success:', { dataset: ds?.Title, files: fl.length, sellerId: ds?.SellerId });
      setDataset(ds);
      setFiles(fl);
      if (!ds) {
        setError('Dataset not found. It may have been deleted.');
      }
    } catch (err: any) {
      console.error('[DatasetManagePage] loadAll FAILED:', err?.response?.status, err?.response?.data, err?.message);
      const msg = err?.response?.data?.detail || err?.message || 'Failed to load dataset';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = useCallback(async (uploadFiles: FileList | File[], category: string) => {
    if (!uploadFiles.length) return;

    setUploading(category);
    let successCount = 0;

    for (let i = 0; i < uploadFiles.length; i++) {
      const file = uploadFiles[i];
      setUploadProgress(Math.round(((i) / uploadFiles.length) * 100));
      try {
        await datasetsApi.uploadFile(id!, file, category);
        successCount++;
      } catch (e: any) {
        toast.error(`Failed to upload ${file.name}: ${getApiError(e, 'Error')}`);
      }
    }

    setUploading(null);
    setUploadProgress(0);

    if (successCount > 0) {
      toast.success(`${successCount} file${successCount > 1 ? 's' : ''} uploaded`);
      // Reload files list
      try {
        const { data } = await datasetsApi.getFiles(id!);
        setFiles(data.files || []);
      } catch { }
    }
  }, [id]);

  const handleDelete = async (fileId: string, fileName: string) => {
    if (!confirm(`Delete "${fileName}"? This cannot be undone.`)) return;
    try {
      await datasetsApi.deleteFile(id!, fileId);
      setFiles(prev => prev.filter(f => f.FileId !== fileId));
      toast.success('File deleted');
    } catch {
      toast.error('Failed to delete file');
    }
  };

  const handlePublish = async () => {
    const primaryFiles = files.filter(f => f.FileCategory === 'primary');
    if (primaryFiles.length === 0) {
      toast.error('Upload at least one primary data file before publishing');
      return;
    }
    try {
      const { data } = await datasetsApi.publish(id!);
      toast.success(data.message || 'Dataset published!');
      loadAll();
    } catch (e: any) {
      toast.error(getApiError(e, 'Failed to publish'));
    }
  };

  const handleThumbnail = async (file: File) => {
    try {
      await datasetsApi.uploadThumbnail(id!, file);
      toast.success('Thumbnail updated');
      loadAll();
    } catch {
      toast.error('Failed to upload thumbnail');
    }
  };

  // Drag & drop handlers
  const onDragOver = (e: React.DragEvent, category: string) => {
    e.preventDefault();
    setDragOver(category);
  };
  const onDragLeave = () => setDragOver(null);
  const onDrop = (e: React.DragEvent, category: string) => {
    e.preventDefault();
    setDragOver(null);
    if (e.dataTransfer.files.length) {
      handleUpload(e.dataTransfer.files, category);
    }
  };

  if (loading) {
    return (
      <div className="page-container max-w-4xl">
        <div className="flex items-center gap-3 mb-4">
          <FiLoader className="animate-spin text-retomy-accent" size={20} />
          <p className="text-sm text-retomy-text-secondary">Loading dataset…</p>
        </div>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-retomy-bg-hover rounded w-1/3" />
          <div className="h-64 bg-retomy-bg-hover rounded" />
        </div>
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="page-container max-w-4xl">
        <div className="card p-8 text-center">
          <FiDatabase className="mx-auto text-retomy-text-secondary mb-3" size={40} />
          <h2 className="text-lg font-semibold text-retomy-text-bright mb-2">
            {error || 'Dataset not found'}
          </h2>
          <p className="text-sm text-retomy-text-secondary mb-4">
            The dataset could not be loaded. This may be a temporary issue.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => loadAll()}
              className="btn-primary text-sm !px-4 !py-2 flex items-center gap-2"
            >
              <FiLoader size={14} /> Try Again
            </button>
            <Link to="/seller" className="btn-secondary text-sm !px-4 !py-2 flex items-center gap-2">
              <FiArrowLeft size={14} /> Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Determine ownership: check user match, admin role, or justCreated flag from navigation
  const isOwner = justCreated || (
    user && (
      user.user_id.toLowerCase() === (dataset.SellerId || '').toLowerCase() ||
      ['admin', 'superadmin'].includes(user.role)
    )
  );
  const primaryFiles = files.filter(f => f.FileCategory === 'primary');
  const sampleFiles = files.filter(f => f.FileCategory === 'sample');
  const docFiles = files.filter(f => f.FileCategory === 'documentation');
  const previewFiles = files.filter(f => f.FileCategory === 'preview');

  const fileSections = [
    { key: 'primary', files: primaryFiles },
    { key: 'sample', files: sampleFiles },
    { key: 'documentation', files: docFiles },
    { key: 'preview', files: previewFiles },
  ];

  return (
    <div className="page-container max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Link to="/seller" className="text-retomy-text-secondary hover:text-retomy-accent">
          <FiArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-retomy-text-bright">{dataset.Title}</h1>
          <p className="text-xs text-retomy-text-secondary mt-0.5">
            Status: <span className="capitalize">{dataset.Status}</span>
            {' · '}Format: {dataset.FileFormat || 'Not set'}
            {' · '}{files.length} file{files.length !== 1 ? 's' : ''} uploaded
          </p>
        </div>
        <div className="flex gap-2">
          <Link to={`/dataset/${id}`} className="btn-secondary text-xs !px-3 !py-1.5 flex items-center gap-1">
            <FiEye size={12} /> Preview
          </Link>
          {isOwner && dataset.Status === 'draft' && (
            <button onClick={handlePublish} className="btn-primary text-xs !px-3 !py-1.5 flex items-center gap-1">
              <FiSend size={12} /> Publish
            </button>
          )}
        </div>
      </div>

      {/* Thumbnail */}
      {isOwner && (
        <div className="card p-4 mb-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-lg bg-retomy-bg-hover flex items-center justify-center overflow-hidden border border-retomy-border/30">
              {dataset.ThumbnailUrl ? (
                <img src={dataset.ThumbnailUrl} alt="thumb" className="w-full h-full object-cover" />
              ) : (
                <FiPackage className="text-retomy-text-secondary" size={24} />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-retomy-text-bright">Thumbnail</p>
              <p className="text-xs text-retomy-text-secondary">Recommended: 400x300, PNG or JPG</p>
            </div>
            <label className="btn-secondary text-xs !px-3 !py-1.5 cursor-pointer">
              Upload
              <input type="file" accept="image/*" className="hidden" onChange={e => {
                if (e.target.files?.[0]) handleThumbnail(e.target.files[0]);
              }} />
            </label>
          </div>
        </div>
      )}

      {/* File Sections */}
      {fileSections.map(({ key, files: sectionFiles }) => {
        const meta = CATEGORY_LABELS[key];
        const Icon = meta.icon;
        const isUploadingThis = uploading === key;

        return (
          <div key={key} className="card mb-4">
            <div className="px-5 py-3 border-b border-retomy-border/20 flex items-center gap-2">
              <Icon className="text-retomy-accent" size={16} />
              <h2 className="font-semibold text-retomy-text-bright text-sm">{meta.label}</h2>
              <span className="text-xs text-retomy-text-secondary ml-1">({sectionFiles.length})</span>
            </div>

            {/* File list */}
            {sectionFiles.length > 0 && (
              <div className="divide-y divide-retomy-border/10">
                {sectionFiles.map(f => (
                  <div key={f.FileId} className="px-5 py-2.5 flex items-center gap-3 hover:bg-retomy-bg-hover/30 transition-colors">
                    <FiFile className="text-retomy-text-secondary flex-shrink-0" size={14} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-retomy-text-bright truncate">{f.FileName}</p>
                      <p className="text-xs text-retomy-text-secondary">
                        {formatSize(f.FileSize)}
                        {f.MimeType ? ` · ${f.MimeType}` : ''}
                      </p>
                    </div>
                    {isOwner && (
                      <button
                        onClick={() => handleDelete(f.FileId, f.FileName)}
                        className="text-retomy-text-secondary hover:text-red-400 transition-colors p-1"
                        title="Delete file"
                      >
                        <FiTrash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Upload zone */}
            {isOwner && (
              <div
                className={`m-3 border-2 border-dashed rounded-lg p-5 text-center transition-colors cursor-pointer
                  ${dragOver === key
                    ? 'border-retomy-accent bg-retomy-accent/5'
                    : 'border-retomy-border/30 hover:border-retomy-accent/50'
                  }
                  ${isUploadingThis ? 'opacity-60 pointer-events-none' : ''}`}
                onDragOver={e => onDragOver(e, key)}
                onDragLeave={onDragLeave}
                onDrop={e => onDrop(e, key)}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.multiple = true;
                  input.onchange = () => {
                    if (input.files) handleUpload(input.files, key);
                  };
                  input.click();
                }}
              >
                {isUploadingThis ? (
                  <div className="flex flex-col items-center gap-2">
                    <FiLoader className="animate-spin text-retomy-accent" size={24} />
                    <p className="text-sm text-retomy-text-secondary">Uploading… {uploadProgress}%</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <FiUploadCloud className="text-retomy-text-secondary" size={24} />
                    <p className="text-sm text-retomy-text-secondary">
                      Drag & drop or <span className="text-retomy-accent">browse</span>
                    </p>
                    <p className="text-xs text-retomy-text-secondary/60">{meta.desc}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Info banner */}
      {isOwner && dataset.Status === 'draft' && primaryFiles.length === 0 && (
        <div className="card p-4 border-l-4 border-retomy-gold/60">
          <p className="text-sm text-retomy-text-bright font-medium">Upload data files to publish</p>
          <p className="text-xs text-retomy-text-secondary mt-1">
            Add at least one primary data file. You can upload any format — CSV, JSON, Parquet, Excel,
            images, videos, PDFs, ZIP archives, SQL dumps, GeoJSON, ML models, and more.
          </p>
        </div>
      )}
    </div>
  );
}
