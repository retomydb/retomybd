/**
 * AgentWorkspace — File tree + code viewer for agent-generated projects
 *
 * Shows:
 * - Collapsible file tree (left sidebar)
 * - Syntax-highlighted code viewer (main area)
 * - Deploy to GitHub / Download ZIP actions (top bar)
 */
import { useState, useMemo } from 'react';
import {
  HiFolder, HiFolderOpen, HiDocumentText, HiCode,
  HiDownload, HiX, HiChevronRight, HiChevronDown,
  HiClipboardCopy, HiExternalLink,
} from 'react-icons/hi';
import toast from 'react-hot-toast';
import JSZip from 'jszip';

const API = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// ── Types ────────────────────────────────────────────────────────────────────

interface GeneratedFile {
  path: string;
  content: string;
  language: string;
}

interface AgentSession {
  sessionId: string;
  files: GeneratedFile[];
  projectName: string;
  description: string;
  status: 'generating' | 'complete' | 'error';
}

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: TreeNode[];
  file?: GeneratedFile;
}

interface Props {
  session: AgentSession;
  onClose: () => void;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
}

// ── File icon colors by language ─────────────────────────────────────────────

function fileColor(lang: string): string {
  const colors: Record<string, string> = {
    typescript: '#3178c6', typescriptreact: '#3178c6',
    javascript: '#f7df1e', javascriptreact: '#f7df1e',
    python: '#3776ab', html: '#e34c26', css: '#1572b6',
    json: '#a8a8a8', yaml: '#cb171e', markdown: '#ffffff',
    shell: '#89e051', dockerfile: '#384d54', rust: '#dea584',
    go: '#00add8', java: '#b07219', ruby: '#cc342d',
    php: '#4f5d95', swift: '#fa7343', kotlin: '#a97bff',
  };
  return colors[lang] || '#8f98a0';
}

function fileExtIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const iconMap: Record<string, string> = {
    ts: '📘', tsx: '⚛️', js: '📒', jsx: '⚛️',
    py: '🐍', html: '🌐', css: '🎨', scss: '🎨',
    json: '📋', yml: '⚙️', yaml: '⚙️', md: '📝',
    sh: '🖥️', sql: '🗃️', env: '🔒', txt: '📄',
    rs: '🦀', go: '🐹', java: '☕', rb: '💎',
    gitignore: '🚫', dockerfile: '🐳', toml: '⚙️',
  };
  const basename = filename.toLowerCase();
  if (basename === 'dockerfile') return '🐳';
  if (basename === '.gitignore') return '🚫';
  if (basename === '.env' || basename === '.env.example') return '🔒';
  if (basename === 'readme.md') return '📖';
  return iconMap[ext] || '📄';
}

// ── Build tree structure from flat paths ─────────────────────────────────────

function buildTree(files: GeneratedFile[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of files) {
    const parts = file.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isFile = i === parts.length - 1;
      const path = parts.slice(0, i + 1).join('/');

      const existing = current.find(n => n.name === name);
      if (existing) {
        if (!isFile && existing.children) {
          current = existing.children;
        }
      } else {
        const node: TreeNode = {
          name,
          path,
          type: isFile ? 'file' : 'folder',
          children: isFile ? undefined : [],
          file: isFile ? file : undefined,
        };
        current.push(node);
        if (!isFile && node.children) {
          current = node.children;
        }
      }
    }
  }

  // Sort: folders first, then alphabetically
  const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
    return nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    }).map(n => ({
      ...n,
      children: n.children ? sortNodes(n.children) : undefined,
    }));
  };

  return sortNodes(root);
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AgentWorkspace({ session, onClose, selectedFile, onSelectFile }: Props) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    // Auto-expand first 2 levels
    const expanded = new Set<string>();
    for (const f of session.files) {
      const parts = f.path.split('/');
      for (let i = 1; i < Math.min(parts.length, 3); i++) {
        expanded.add(parts.slice(0, i).join('/'));
      }
    }
    return expanded;
  });
  const [deploying, setDeploying] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [repoName, setRepoName] = useState(session.projectName || 'my-project');
  const [githubToken, setGithubToken] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);

  const tree = useMemo(() => buildTree(session.files), [session.files]);
  const currentFile = session.files.find(f => f.path === selectedFile);

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const downloadZip = async () => {
    try {
      const zip = new JSZip();
      const folderName = session.projectName || 'project';
      for (const file of session.files) {
        zip.file(`${folderName}/${file.path}`, file.content);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${folderName}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Project downloaded!');
    } catch (e) {
      toast.error('Download failed');
    }
  };

  const deployToGithub = async () => {
    if (!githubToken || !repoName) {
      toast.error('Please enter repository name and GitHub token');
      return;
    }
    setDeploying(true);
    try {
      const resp = await fetch(`${API}/agent/deploy-github`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.sessionId,
          repo_name: repoName,
          github_token: githubToken,
          private: isPrivate,
          description: session.description,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: 'Deploy failed' }));
        throw new Error(err.detail);
      }
      const data = await resp.json();
      toast.success(`Deployed to GitHub!`);
      setShowDeployModal(false);
      window.open(data.repo_url, '_blank');
    } catch (e: any) {
      toast.error(e.message || 'Deploy failed');
    } finally {
      setDeploying(false);
    }
  };

  const copyFile = () => {
    if (currentFile) {
      navigator.clipboard.writeText(currentFile.content);
      toast.success('Copied to clipboard');
    }
  };

  // ── Tree node renderer ──
  const renderNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = selectedFile === node.path;

    if (node.type === 'folder') {
      return (
        <div key={node.path}>
          <button
            onClick={() => toggleFolder(node.path)}
            className="w-full flex items-center gap-1.5 px-2 py-1 text-[12px] hover:bg-white/[0.04] rounded transition-all text-white/60 hover:text-white/80"
            style={{ paddingLeft: `${8 + depth * 16}px` }}
          >
            {isExpanded ? (
              <HiChevronDown className="w-3 h-3 flex-shrink-0 text-white/30" />
            ) : (
              <HiChevronRight className="w-3 h-3 flex-shrink-0 text-white/30" />
            )}
            {isExpanded ? (
              <HiFolderOpen className="w-4 h-4 flex-shrink-0 text-amber-400/70" />
            ) : (
              <HiFolder className="w-4 h-4 flex-shrink-0 text-amber-400/50" />
            )}
            <span className="truncate">{node.name}</span>
          </button>
          {isExpanded && node.children && (
            <div>
              {node.children.map(child => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <button
        key={node.path}
        onClick={() => onSelectFile(node.path)}
        className={`w-full flex items-center gap-1.5 px-2 py-1 text-[12px] rounded transition-all ${
          isSelected
            ? 'bg-white/[0.08] text-white'
            : 'text-white/50 hover:bg-white/[0.04] hover:text-white/70'
        }`}
        style={{ paddingLeft: `${8 + depth * 16 + 16}px` }}
        title={node.path}
      >
        <span className="text-[11px] flex-shrink-0">{fileExtIcon(node.name)}</span>
        <span className="truncate">{node.name}</span>
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full rounded-lg border border-white/[0.06] overflow-hidden bg-white/[0.02]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <HiCode className="w-4 h-4 text-purple-400" />
          <span className="text-[13px] font-medium text-white/80">
            {session.projectName || 'Generated Project'}
          </span>
          <span className="text-[11px] text-white/30 bg-white/[0.04] px-1.5 py-0.5 rounded">
            {session.files.length} files
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Download ZIP */}
          <button
            onClick={downloadZip}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium text-white/60 hover:text-white hover:bg-white/[0.06] transition-all"
            title="Download as ZIP"
          >
            <HiDownload className="w-3.5 h-3.5" />
            ZIP
          </button>

          {/* Deploy to GitHub */}
          <button
            onClick={() => setShowDeployModal(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 hover:text-purple-200 transition-all"
            title="Deploy to GitHub"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            Deploy
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1 rounded-md text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all"
            title="Close workspace"
          >
            <HiX className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main content: tree + viewer */}
      <div className="flex flex-1 min-h-0">
        {/* File tree sidebar */}
        <div className="w-52 flex-shrink-0 border-r border-white/[0.04] overflow-y-auto py-1.5" style={{ colorScheme: 'dark' }}>
          <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/20 mb-1">
            Explorer
          </div>
          {tree.map(node => renderNode(node))}
        </div>

        {/* Code viewer */}
        <div className="flex-1 flex flex-col min-w-0">
          {currentFile ? (
            <>
              {/* File tab bar */}
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.04] bg-white/[0.01]">
                <div className="flex items-center gap-1.5 text-[12px]">
                  <span>{fileExtIcon(currentFile.path.split('/').pop() || '')}</span>
                  <span className="text-white/60">{currentFile.path}</span>
                </div>
                <button
                  onClick={copyFile}
                  className="p-1 rounded text-white/20 hover:text-white/50 transition-all"
                  title="Copy file content"
                >
                  <HiClipboardCopy className="w-3.5 h-3.5" />
                </button>
              </div>
              {/* Code content */}
              <div className="flex-1 overflow-auto p-0" style={{ colorScheme: 'dark' }}>
                <pre
                  className="text-[12px] leading-[1.6] text-white/70 font-mono p-4 m-0"
                  style={{ tabSize: 2 }}
                >
                  {currentFile.content.split('\n').map((line, i) => (
                    <div key={i} className="flex hover:bg-white/[0.02]">
                      <span className="inline-block w-10 text-right pr-4 select-none text-white/15 flex-shrink-0">
                        {i + 1}
                      </span>
                      <span className="flex-1 whitespace-pre-wrap break-all">{line}</span>
                    </div>
                  ))}
                </pre>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-white/20 text-[13px]">
              <div className="text-center">
                <HiCode className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Select a file to view its contents</p>
                <p className="text-[11px] mt-1 text-white/10">
                  {session.files.length} files generated
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* GitHub Deploy Modal */}
      {showDeployModal && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 rounded-lg">
          <div className="bg-[#1b2838] rounded-xl border border-white/10 p-5 w-96 shadow-2xl">
            <h3 className="text-[15px] font-semibold text-white/90 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              Deploy to GitHub
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-white/40 block mb-1">Repository Name</label>
                <input
                  value={repoName}
                  onChange={e => setRepoName(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-white/80 focus:outline-none focus:border-purple-500/40"
                  placeholder="my-awesome-project"
                  style={{ colorScheme: 'dark' }}
                />
              </div>

              <div>
                <label className="text-[11px] text-white/40 block mb-1">GitHub Personal Access Token</label>
                <input
                  value={githubToken}
                  onChange={e => setGithubToken(e.target.value)}
                  type="password"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-white/80 focus:outline-none focus:border-purple-500/40"
                  placeholder="ghp_xxxxxxxxxxxx"
                  style={{ colorScheme: 'dark' }}
                />
                <p className="text-[10px] text-white/20 mt-1">
                  Needs 'repo' scope. <a href="https://github.com/settings/tokens/new" target="_blank" rel="noreferrer" className="text-purple-400/50 hover:text-purple-400">Create token</a>
                </p>
              </div>

              <label className="flex items-center gap-2 text-[12px] text-white/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={e => setIsPrivate(e.target.checked)}
                  className="rounded border-white/20 bg-white/[0.04]"
                />
                Private repository
              </label>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShowDeployModal(false)}
                className="px-3 py-1.5 rounded-lg text-[12px] text-white/40 hover:text-white/60 hover:bg-white/[0.04] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={deployToGithub}
                disabled={deploying || !githubToken || !repoName}
                className="px-4 py-1.5 rounded-lg text-[12px] font-medium bg-purple-500/80 hover:bg-purple-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
              >
                {deploying ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                    </svg>
                    Deploying…
                  </>
                ) : (
                  <>
                    <HiExternalLink className="w-3.5 h-3.5" />
                    Deploy
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
