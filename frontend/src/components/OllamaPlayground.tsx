/**
 * OllamaPlayground — Full-featured chat UI for Ollama models
 *
 * Features:
 * 1. RAG: Upload any file (PDF, DOCX, XLSX, CSV, code, images…) — extracted text
 *    becomes context for the conversation.
 * 2. Stop generation: AbortController lets you cancel streaming mid-response.
 * 3. Audio input: Record voice via Web Speech API (SpeechRecognition) and insert
 *    the transcription as your prompt.
 * 4. Copilot-style chatbox: rounded input bar with attachment, mic, and send
 *    buttons — matches the VS Code Copilot Chat aesthetic.
 * 5. Chat history sidebar (persisted per-user).
 * 6. Auto-scroll stays within the chat container, not the page.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  HiPlay, HiCog, HiClipboardCopy, HiTrash,
  HiLightningBolt, HiClock, HiServer,
  HiChat, HiCode, HiX, HiPlus,
  HiChevronLeft, HiChevronRight, HiChevronUp,
  HiPaperClip, HiMicrophone, HiStop,
  HiDocumentText, HiPhotograph,
  HiDownload, HiFolder, HiFolderOpen,
} from 'react-icons/hi';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import AgentWorkspace from './AgentWorkspace';

const API = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// ── Types ────────────────────────────────────────────────────────────────────

interface Props {
  model: string;
  label?: string;
  parameterSize?: string;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  attachments?: FileAttachment[];
}

interface FileAttachment {
  filename: string;
  type: 'text' | 'image' | 'audio' | 'unsupported';
  size: number;
  charCount?: number;
  preview?: string; // first 200 chars for text, or base64 for images
}

interface ConversationSummary {
  conversation_id: string;
  model: string;
  title: string | null;
  message_count: number;
  created_at: string;
  updated_at: string;
}

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

// ── Helpers ──────────────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('retomy_access_token');
  if (!token) return { 'Content-Type': 'application/json' };
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function humanSize(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} KB`;
  return `${n} B`;
}

// Icon for file type
function fileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['png','jpg','jpeg','gif','webp','bmp','svg','tiff'].includes(ext)) return HiPhotograph;
  return HiDocumentText;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function OllamaPlayground({ model, label, parameterSize }: Props) {
  const { isAuthenticated } = useAuthStore();

  const [mode, setMode] = useState<'chat' | 'generate'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [running, setRunning] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showParams, setShowParams] = useState(false);
  const [showCode, setShowCode] = useState(false);

  // Parameters
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(0.9);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [streaming, setStreaming] = useState(true);

  // Timing
  const [lastDuration, setLastDuration] = useState<number | null>(null);
  const [lastTokens, setLastTokens] = useState<number | null>(null);

  // ── Chat history state ──
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ── RAG state ──
  const [attachedFiles, setAttachedFiles] = useState<Array<{
    file: File;
    extracted?: { type: string; content: string; filename: string; char_count?: number };
    uploading: boolean;
    error?: string;
  }>>([]);
  const [fileContext, setFileContext] = useState('');

  // ── Audio state ──
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  // ── Chat mode selector (Ask vs Agent) ──
  const [chatMode, setChatMode] = useState<'ask' | 'agent'>('ask');
  const [showModeDropup, setShowModeDropup] = useState(false);
  const modeDropupRef = useRef<HTMLDivElement>(null);

  // ── Agent workspace state ──
  const [agentSession, setAgentSession] = useState<AgentSession | null>(null);
  const [agentStreaming, setAgentStreaming] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [agentStatus, setAgentStatus] = useState('');
  const [agentFilesFound, setAgentFilesFound] = useState<string[]>([]);
  const [agentTokenCount, setAgentTokenCount] = useState(0);

  // ── Abort controller for stop generation ──
  const abortControllerRef = useRef<AbortController | null>(null);

  // Refs
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Scroll only the inner chat container ──
  const scrollChatToBottom = useCallback(() => {
    const el = chatContainerRef.current;
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, []);

  useEffect(() => {
    scrollChatToBottom();
  }, [messages, streamingText, scrollChatToBottom]);

  // ── Load conversations on mount ──
  useEffect(() => {
    if (isAuthenticated) loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, model]);

  // ── Auto-resize textarea ──
  useEffect(() => {
    const ta = inputRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
    }
  }, [input]);

  // ── Close mode dropup on click outside ──
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modeDropupRef.current && !modeDropupRef.current.contains(e.target as Node)) {
        setShowModeDropup(false);
      }
    };
    if (showModeDropup) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showModeDropup]);

  // ── Conversation history helpers ──

  const loadConversations = async () => {
    try {
      const resp = await fetch(
        `${API}/chat-history/conversations?model=${encodeURIComponent(model)}&limit=50`,
        { headers: authHeaders() },
      );
      if (resp.ok) {
        const data = await resp.json();
        setConversations(data.conversations || []);
      }
    } catch { /* silent */ }
  };

  const createNewConversation = () => {
    setMessages([]);
    setStreamingText('');
    setError(null);
    setActiveConvId(null);
    setLastDuration(null);
    setLastTokens(null);
    setAttachedFiles([]);
    setFileContext('');
  };

  const loadConversation = async (convId: string) => {
    if (running) return;
    setLoadingHistory(true);
    setError(null);
    setStreamingText('');
    try {
      const resp = await fetch(`${API}/chat-history/conversations/${convId}`, {
        headers: authHeaders(),
      });
      if (resp.ok) {
        const data = await resp.json();
        setActiveConvId(convId);
        setMessages(
          (data.messages || []).map((m: any) => ({
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
          })),
        );
        if (data.system_prompt) setSystemPrompt(data.system_prompt);
      } else {
        toast.error('Failed to load conversation');
      }
    } catch {
      toast.error('Failed to load conversation');
    } finally {
      setLoadingHistory(false);
    }
  };

  const deleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`${API}/chat-history/conversations/${convId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (activeConvId === convId) {
        setActiveConvId(null);
        setMessages([]);
      }
      setConversations(prev => prev.filter(c => c.conversation_id !== convId));
      toast.success('Conversation deleted');
    } catch { /* silent */ }
  };

  const saveMessage = async (
    convId: string, role: string, content: string,
    tokenCount?: number, durationSecs?: number,
  ) => {
    if (!isAuthenticated || !convId) return;
    try {
      await fetch(`${API}/chat-history/conversations/${convId}/messages`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ role, content, token_count: tokenCount ?? null, duration_secs: durationSecs ?? null }),
      });
    } catch { /* silent */ }
  };

  // ── File upload (RAG) ──

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 50MB limit`);
        continue;
      }

      const entry = { file, uploading: true, extracted: undefined as any, error: undefined as string | undefined };
      setAttachedFiles(prev => [...prev, entry]);

      try {
        const formData = new FormData();
        formData.append('file', file);
        const resp = await fetch(`${API}/rag/upload`, { method: 'POST', body: formData });

        if (resp.ok) {
          const data = await resp.json();
          setAttachedFiles(prev =>
            prev.map(f => f.file === file ? { ...f, uploading: false, extracted: data } : f)
          );
          // Accumulate text context
          if (data.type === 'text' && data.content) {
            setFileContext(prev =>
              prev + `\n\n--- FILE: ${data.filename} ---\n${data.content}\n--- END FILE ---\n`
            );
          }
          toast.success(`${file.name} processed`);
        } else {
          const err = await resp.json().catch(() => ({ detail: 'Upload failed' }));
          setAttachedFiles(prev =>
            prev.map(f => f.file === file ? { ...f, uploading: false, error: err.detail } : f)
          );
          toast.error(err.detail || 'Upload failed');
        }
      } catch {
        setAttachedFiles(prev =>
          prev.map(f => f.file === file ? { ...f, uploading: false, error: 'Network error' } : f)
        );
      }
    }
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (idx: number) => {
    const removed = attachedFiles[idx];
    setAttachedFiles(prev => prev.filter((_, i) => i !== idx));
    // Remove from context if it was text
    if (removed?.extracted?.type === 'text') {
      const marker = `--- FILE: ${removed.extracted.filename} ---`;
      setFileContext(prev => {
        const start = prev.indexOf(marker);
        if (start === -1) return prev;
        const endMarker = '--- END FILE ---\n';
        const end = prev.indexOf(endMarker, start);
        if (end === -1) return prev;
        return prev.slice(0, start) + prev.slice(end + endMarker.length);
      });
    }
  };

  // ── Audio recording (Web Speech API) ──

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const startRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Speech recognition not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalTranscript = '';

    // Patterns that mean "send the message" when spoken at the very end.
    // We only trigger if there is actual prompt content before the trigger.
    const sendTriggers = /\b(send(?: it| that| this| the message| message)?|go ahead(?: and send)?|submit(?: it| that)?)\s*[.!]?\s*$/i;

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let newFinalChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
          newFinalChunk += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      const fullText = (finalTranscript + interimTranscript).trim();

      // Check if the latest final chunk ends with a send command
      if (newFinalChunk.trim() && sendTriggers.test(newFinalChunk.trim())) {
        // Strip the trigger phrase from the full prompt
        const cleanedPrompt = fullText.replace(sendTriggers, '').trim();
        // Only auto-send if there is real content before the trigger
        if (cleanedPrompt.length > 0) {
          setInput(cleanedPrompt);
          // Stop recording then send
          recognition.stop();
          recognitionRef.current = null;
          setIsRecording(false);
          // Small delay to let setInput settle before sending
          setTimeout(() => {
            const sendBtn = document.querySelector('[title="Send (Enter)"]') as HTMLButtonElement;
            if (sendBtn && !sendBtn.disabled) sendBtn.click();
          }, 150);
          return;
        }
      }

      setInput(fullText);
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'aborted') {
        toast.error(`Speech error: ${event.error}`);
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
    toast.success('Listening…');
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  };

  // ── Stop generation ──

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  // ── Send message ──

  const send = useCallback(async () => {
    if ((!input.trim() && attachedFiles.length === 0) || running) return;
    setError(null);
    setStreamingText('');
    if (isRecording) stopRecording();

    // Create abort controller
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // ── Agent mode: call /agent/generate instead ──
    if (chatMode === 'agent') {
      const prompt = input.trim();
      setInput('');
      setRunning(true);
      setMessages(prev => [...prev, { role: 'user', content: prompt }]);
      setAgentStreaming('');
      setAgentStatus('Connecting to model…');
      setAgentFilesFound([]);
      setAgentTokenCount(0);

      try {
        const resp = await fetch(`${API}/agent/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            prompt,
            temperature,
            max_tokens: maxTokens,
            session_id: agentSession?.sessionId || null,
          }),
          signal: abortController.signal,
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ detail: resp.statusText }));
          throw new Error(err.detail || resp.statusText);
        }

        const reader = resp.body?.getReader();
        const decoder = new TextDecoder();
        let lineBuf = '';
        let lastRawChunks = '';

        if (reader) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });
              lineBuf += chunk;
              const parts = lineBuf.split('\n');
              lineBuf = parts.pop() || '';
              for (const line of parts) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data:')) continue;
                const payload = trimmed.slice(5).trim();
                if (!payload) continue;
                try {
                  const d = JSON.parse(payload);
                  if (d.type === 'chunk') {
                    lastRawChunks += d.content;
                    setAgentStreaming(lastRawChunks);
                    setAgentTokenCount(prev => prev + 1);

                    // Parse file paths in real-time from <FILE path="..."> tags
                    const fileMatches = lastRawChunks.match(/<FILE\s+path="([^"]+)">/g);
                    if (fileMatches) {
                      const paths = fileMatches.map(m => m.match(/path="([^"]+)"/)?.[1] || '').filter(Boolean);
                      setAgentFilesFound(paths);
                      const latestFile = paths[paths.length - 1];
                      setAgentStatus(`Writing ${latestFile}…`);
                    } else if (lastRawChunks.includes('<PROJECT_INFO>')) {
                      setAgentStatus('Planning project structure…');
                    } else {
                      setAgentStatus('Generating code…');
                    }
                  } else if (d.type === 'status') {
                    setAgentStatus(d.message);
                    setMessages(prev => [...prev, { role: 'assistant', content: `⚡ ${d.message}` }]);
                  } else if (d.type === 'files') {
                    setAgentSession({
                      sessionId: d.session_id,
                      files: d.files,
                      projectName: d.project?.name || 'project',
                      description: d.project?.description || '',
                      status: 'complete',
                    });
                    setShowWorkspace(true);
                    setSelectedFile(d.files[0]?.path || null);
                    setMessages(prev => [...prev, {
                      role: 'assistant',
                      content: `✅ Generated **${d.files.length} files** for project "${d.project?.name || 'project'}". Open the workspace to view, edit, download, or deploy.`,
                    }]);
                  } else if (d.type === 'error') {
                    setError(d.message);
                    setMessages(prev => [...prev, { role: 'assistant', content: `❌ ${d.message}` }]);
                  }
                } catch { /* skip malformed */ }
              }
            }
          } catch (e) {
            if (e instanceof DOMException && e.name === 'AbortError') {
              toast('Generation stopped', { icon: '\u23F9\uFE0F' });
            } else {
              throw e;
            }
          } finally {
            reader.releaseLock();
          }
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') {
          toast('Generation stopped', { icon: '\u23F9\uFE0F' });
        } else {
          const msg = e instanceof Error ? e.message : String(e);
          setError(msg);
        }
      } finally {
        setRunning(false);
        setStreamingText('');
        setAgentStreaming('');
        setAgentStatus('');
        abortControllerRef.current = null;
      }
      return;
    }

    // Auto-create conversation if authenticated and none active
    let convId = activeConvId;
    if (isAuthenticated && !convId) {
      try {
        const resp = await fetch(`${API}/chat-history/conversations`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ model, title: null, system_prompt: systemPrompt || null }),
        });
        if (resp.ok) {
          const data = await resp.json();
          convId = data.conversation_id;
          setActiveConvId(convId);
        }
      } catch { /* continue */ }
    }

    if (mode === 'chat') {
      // Build user message content
      let userContent = input.trim();

      // Include file context in the message if files are attached
      const currentContext = fileContext;
      if (currentContext) {
        userContent = currentContext + '\n\n' + (userContent || 'Please analyze the attached file(s) and provide a detailed explanation.');
      } else if (!userContent) {
        return;
      }

      const attachmentInfo: FileAttachment[] = attachedFiles
        .filter(f => f.extracted)
        .map(f => ({
          filename: f.extracted!.filename || f.file.name,
          type: f.extracted!.type as any,
          size: f.file.size,
          charCount: f.extracted?.char_count,
          preview: f.extracted?.type === 'text' ? f.extracted.content.slice(0, 200) : undefined,
        }));

      const userMsg: ChatMessage = {
        role: 'user',
        content: input.trim() || 'Please analyze the attached file(s).',
        attachments: attachmentInfo.length > 0 ? attachmentInfo : undefined,
      };
      const history = [...messages, userMsg];
      setMessages(history);
      setInput('');
      setRunning(true);

      // Clear attachments after sending
      setAttachedFiles([]);
      setFileContext('');

      if (convId) saveMessage(convId, 'user', userMsg.content);

      // Build full messages array for Ollama
      const fullMessages = systemPrompt
        ? [{ role: 'system', content: systemPrompt }, ...history.map(m => ({ role: m.role, content: m.content }))]
        : history.map(m => ({ role: m.role, content: m.content }));

      // Replace the last user message content with the augmented version (with file context)
      if (currentContext && fullMessages.length > 0) {
        fullMessages[fullMessages.length - 1] = { role: 'user', content: userContent };
      }

      try {
        if (streaming) {
          const resp = await fetch(`${API}/ollama/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              messages: fullMessages,
              stream: true,
              temperature,
              top_p: topP,
              max_tokens: maxTokens,
            }),
            signal: abortController.signal,
          });
          if (!resp.ok) {
            const err = await resp.json().catch(() => ({ detail: resp.statusText }));
            throw new Error(err.detail || resp.statusText);
          }
          const reader = resp.body?.getReader();
          const decoder = new TextDecoder();
          let accumulated = '';
          let evalCount = 0;
          let totalDuration = 0;
          let lineBuf = '';

          if (reader) {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                lineBuf += chunk;
                const parts = lineBuf.split('\n');
                lineBuf = parts.pop() || '';
                for (const line of parts) {
                  const trimmed = line.trim();
                  if (!trimmed.startsWith('data:')) continue;
                  const payload = trimmed.slice(5).trim();
                  if (!payload || payload === '[DONE]') continue;
                  try {
                    const d = JSON.parse(payload);
                    if (d.message?.content) {
                      accumulated += d.message.content;
                      setStreamingText(accumulated);
                    }
                    if (d.eval_count) evalCount = d.eval_count;
                    if (d.total_duration) totalDuration = d.total_duration;
                  } catch { /* skip malformed */ }
                }
              }
            } catch (e) {
              if (e instanceof DOMException && e.name === 'AbortError') {
                // User stopped — keep what we have so far
              } else {
                throw e;
              }
            } finally {
              reader.releaseLock();
            }
            // Process leftover buffer
            if (lineBuf.trim().startsWith('data:')) {
              const payload = lineBuf.trim().slice(5).trim();
              if (payload && payload !== '[DONE]') {
                try {
                  const d = JSON.parse(payload);
                  if (d.message?.content) accumulated += d.message.content;
                  if (d.eval_count) evalCount = d.eval_count;
                  if (d.total_duration) totalDuration = d.total_duration;
                } catch { /* skip */ }
              }
            }
          }

          if (accumulated) {
            setMessages(prev => [...prev, { role: 'assistant', content: accumulated }]);
          }
          setStreamingText('');
          const durSecs = totalDuration ? totalDuration / 1e9 : undefined;
          if (totalDuration) setLastDuration(durSecs!);
          if (evalCount) setLastTokens(evalCount);

          if (convId && accumulated) {
            saveMessage(convId, 'assistant', accumulated, evalCount || undefined, durSecs);
            loadConversations();
          }
        } else {
          const resp = await fetch(`${API}/ollama/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              messages: fullMessages,
              stream: false,
              temperature,
              top_p: topP,
              max_tokens: maxTokens,
            }),
            signal: abortController.signal,
          });
          if (!resp.ok) {
            const err = await resp.json().catch(() => ({ detail: resp.statusText }));
            throw new Error(err.detail || resp.statusText);
          }
          const data = await resp.json();
          const assistantContent = data.message?.content || data.response || '';
          setMessages(prev => [...prev, { role: 'assistant', content: assistantContent }]);
          const durSecs = data.total_duration ? data.total_duration / 1e9 : undefined;
          if (data.total_duration) setLastDuration(durSecs!);
          if (data.eval_count) setLastTokens(data.eval_count);

          if (convId) {
            saveMessage(convId, 'assistant', assistantContent, data.eval_count || undefined, durSecs);
            loadConversations();
          }
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') {
          // Stopped by user — not an error
          toast('Generation stopped', { icon: '\u23F9\uFE0F' });
        } else {
          const msg = e instanceof Error ? e.message : String(e);
          setError(msg);
        }
      } finally {
        setRunning(false);
        abortControllerRef.current = null;
      }
    } else {
      // Generate mode
      const prompt = input.trim();
      setInput('');
      setRunning(true);

      try {
        const resp = await fetch(`${API}/ollama/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model, prompt,
            stream: false,
            system: systemPrompt || undefined,
            temperature, top_p: topP, max_tokens: maxTokens,
          }),
          signal: abortController.signal,
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ detail: resp.statusText }));
          throw new Error(err.detail || resp.statusText);
        }
        const data = await resp.json();
        setMessages(prev => [
          ...prev,
          { role: 'user', content: prompt },
          { role: 'assistant', content: data.response || '' },
        ]);
        if (data.total_duration) setLastDuration(data.total_duration / 1e9);
        if (data.eval_count) setLastTokens(data.eval_count);
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') {
          toast('Generation stopped', { icon: '\u23F9\uFE0F' });
        } else {
          const msg = e instanceof Error ? e.message : String(e);
          setError(msg);
        }
      } finally {
        setRunning(false);
        abortControllerRef.current = null;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, messages, mode, model, streaming, systemPrompt, temperature, topP, maxTokens, running, activeConvId, isAuthenticated, fileContext, attachedFiles, isRecording, chatMode, agentSession]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const copyAll = () => {
    const text = messages.map(m => `${m.role}: ${m.content}`).join('\n\n');
    navigator.clipboard.writeText(text);
    toast.success('Copied conversation');
  };

  const clearChat = () => {
    setMessages([]);
    setStreamingText('');
    setError(null);
    setLastDuration(null);
    setActiveConvId(null);
    setAttachedFiles([]);
    setFileContext('');
  };

  const codeSnippet = mode === 'chat'
    ? `curl ${window.location.origin}${API}/ollama/chat \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${model}",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": false,
    "temperature": ${temperature}
  }'`
    : `curl ${window.location.origin}${API}/ollama/generate \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${model}",
    "prompt": "Write a poem about AI",
    "stream": false,
    "temperature": ${temperature}
  }'`;

  // ── Drag-and-drop handlers ──
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length) {
      // Simulate file input change
      const dt = new DataTransfer();
      for (const f of Array.from(files)) dt.items.add(f);
      if (fileInputRef.current) {
        fileInputRef.current.files = dt.files;
        fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        // Fallback: direct upload
        handleFileSelect({ target: { files } } as any);
      }
    }
  };

  return (
    <div className="flex gap-3" style={{ minHeight: 520 }}>
      {/* ── Hidden file input ── */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.csv,.json,.jsonl,.txt,.md,.py,.js,.ts,.tsx,.jsx,.html,.css,.sql,.java,.c,.cpp,.go,.rs,.rb,.php,.swift,.yaml,.yml,.xml,.toml,.sh,.png,.jpg,.jpeg,.gif,.webp,.bmp,.svg,.mp3,.wav,.ogg,.m4a,.flac,.webm,.log,.env,.cfg,.conf"
      />

      {/* ── Sidebar: Conversation History ── */}
      {isAuthenticated && (
        <div className={`transition-all duration-200 flex-shrink-0 ${sidebarOpen ? 'w-56' : 'w-8'}`}>
          {sidebarOpen ? (
            <div className="border border-white/5 rounded-xl h-full flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5">
                <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">History</span>
                <div className="flex items-center gap-1">
                  <button onClick={createNewConversation}
                    className="p-1 rounded-md hover:bg-white/10 text-white/30 hover:text-purple-400 transition-all"
                    title="New chat">
                    <HiPlus className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setSidebarOpen(false)}
                    className="p-1 rounded-md hover:bg-white/10 text-white/30 hover:text-white transition-all"
                    title="Collapse">
                    <HiChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-1.5 py-1.5 space-y-0.5">
                {conversations.length === 0 ? (
                  <div className="text-center text-white/15 text-[10px] py-6">No conversations yet</div>
                ) : (
                  conversations.map(conv => (
                    <button
                      key={conv.conversation_id}
                      onClick={() => loadConversation(conv.conversation_id)}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-all group relative ${
                        activeConvId === conv.conversation_id
                          ? 'bg-purple-500/15 text-white border border-purple-500/20'
                          : 'text-white/50 hover:bg-white/5 hover:text-white/70 border border-transparent'
                      }`}
                    >
                      <div className="truncate font-medium text-[11px] pr-5">
                        {conv.title || 'New conversation'}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] text-white/20">{conv.message_count} msgs</span>
                        <span className="text-[9px] text-white/15">&middot;</span>
                        <span className="text-[9px] text-white/20">{relativeTime(conv.updated_at)}</span>
                      </div>
                      <button
                        onClick={(e) => deleteConversation(conv.conversation_id, e)}
                        className="absolute top-2 right-1.5 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-white/20 hover:text-red-400 transition-all"
                        title="Delete">
                        <HiTrash className="w-3 h-3" />
                      </button>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <button onClick={() => setSidebarOpen(true)}
              className="w-8 h-full bg-white/[0.02] border border-white/5 rounded-xl flex items-center justify-center hover:bg-white/5 transition-all"
              title="Show history">
              <HiChevronRight className="w-3.5 h-3.5 text-white/30" />
            </button>
          )}
        </div>
      )}

      {/* ── Main chat area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ── Header / model info ── */}
        <div className="flex items-center gap-3 flex-wrap mb-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-lg">
            <HiServer className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-medium text-purple-300">Ollama &middot; Server-Side</span>
          </div>
          <span className="text-xs text-white/30">{model}</span>
          {parameterSize && <span className="text-xs text-white/20">{parameterSize}</span>}
          {lastDuration != null && (
            <span className="flex items-center gap-1 text-[10px] text-white/25">
              <HiClock className="w-3 h-3" /> {lastDuration.toFixed(1)}s
              {lastTokens != null && <> &middot; {lastTokens} tokens</>}
            </span>
          )}
        </div>

        {/* ── Mode toggle + controls ── */}
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <button onClick={() => setMode('chat')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              mode === 'chat'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'
            }`}><HiChat className="w-3.5 h-3.5" /> Chat</button>
          <button onClick={() => setMode('generate')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              mode === 'generate'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'
            }`}><HiLightningBolt className="w-3.5 h-3.5" /> Generate</button>

          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={() => setShowParams(!showParams)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white transition-all" title="Parameters">
              <HiCog className="w-4 h-4" /></button>
            <button onClick={() => setShowCode(!showCode)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white transition-all" title="Code">
              <HiCode className="w-4 h-4" /></button>
            {agentSession && (
              <button onClick={() => setShowWorkspace(!showWorkspace)}
                className={`p-1.5 rounded-lg hover:bg-white/10 transition-all ${showWorkspace ? 'text-purple-400' : 'text-white/30 hover:text-white'}`}
                title={showWorkspace ? 'Hide workspace' : 'Show workspace'}>
                <HiFolder className="w-4 h-4" />
              </button>
            )}
            <button onClick={copyAll} className="p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white transition-all" title="Copy conversation">
              <HiClipboardCopy className="w-4 h-4" /></button>
            <button onClick={clearChat} className="p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white transition-all" title="New chat">
              <HiPlus className="w-4 h-4" /></button>
          </div>
        </div>

        {/* ── Parameters panel ── */}
        {showParams && (
          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 space-y-3 animate-fade-in mb-2">
            <div>
              <label className="text-[10px] text-white/40 font-medium block mb-1">System Prompt</label>
              <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} rows={2}
                placeholder="You are a helpful assistant..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-purple-500/40 resize-none" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-white/40 font-medium block mb-1">Temperature: {temperature}</label>
                <input type="range" min={0} max={2} step={0.1} value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500" />
              </div>
              <div>
                <label className="text-[10px] text-white/40 font-medium block mb-1">Top-P: {topP}</label>
                <input type="range" min={0} max={1} step={0.05} value={topP} onChange={e => setTopP(parseFloat(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500" />
              </div>
              <div>
                <label className="text-[10px] text-white/40 font-medium block mb-1">Max Tokens: {maxTokens}</label>
                <input type="range" min={64} max={4096} step={64} value={maxTokens} onChange={e => setMaxTokens(parseInt(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-white/40 font-medium">Streaming</label>
              <button onClick={() => setStreaming(!streaming)}
                className={`w-8 h-4 rounded-full transition-colors ${streaming ? 'bg-purple-500' : 'bg-white/10'}`}>
                <div className={`w-3 h-3 bg-white rounded-full transition-transform ${streaming ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
        )}

        {/* ── Code snippet ── */}
        {showCode && (
          <div className="bg-black/40 border border-white/5 rounded-xl p-4 animate-fade-in mb-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-white/30 font-medium">cURL Example</span>
              <button onClick={() => { navigator.clipboard.writeText(codeSnippet); toast.success('Copied'); }}
                className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors">Copy</button>
            </div>
            <pre className="text-[11px] text-purple-300/80 whitespace-pre-wrap font-mono leading-relaxed">{codeSnippet}</pre>
          </div>
        )}

        {/* ── Agent Workspace ── */}
        {showWorkspace && agentSession && (
          <div className="mb-2 animate-fade-in" style={{ height: 360 }}>
            <AgentWorkspace
              session={agentSession}
              onClose={() => setShowWorkspace(false)}
              selectedFile={selectedFile}
              onSelectFile={setSelectedFile}
            />
          </div>
        )}

        {/* ── Chat area — fixed-height scrollable container ── */}
        <div
          ref={chatContainerRef}
          className={`rounded-xl overflow-y-auto p-4 space-y-3 flex-1 transition-colors ${
            isDragOver ? 'border border-purple-500/40 bg-purple-500/5' : ''
          }`}
          style={{ maxHeight: showWorkspace && agentSession ? 200 : 400, minHeight: showWorkspace && agentSession ? 120 : 250 }}
          onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          {isDragOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-purple-500/10 rounded-xl z-10 pointer-events-none">
              <div className="text-purple-400 text-sm font-medium flex items-center gap-2">
                <HiPaperClip className="w-5 h-5" /> Drop files here
              </div>
            </div>
          )}

          {loadingHistory ? (
            <div className="text-center text-white/30 text-xs py-12">
              <div className="animate-spin w-5 h-5 border-2 border-purple-500/30 border-t-purple-400 rounded-full mx-auto mb-2" />
              Loading conversation&hellip;
            </div>
          ) : messages.length === 0 && !streamingText ? (
            <div className="text-center text-white/20 text-xs py-12">
              <HiServer className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Start a conversation with <span className="text-purple-400">{label || model}</span></p>
              <p className="text-[10px] text-white/10 mt-1">This model runs on the server via Ollama</p>
              <p className="text-[10px] text-white/15 mt-3">
                <HiPaperClip className="w-3 h-3 inline mr-1" />
                Attach files (PDF, DOCX, code, images…) or
                <HiMicrophone className="w-3 h-3 inline mx-1" />
                use voice input
              </p>
              {isAuthenticated && (
                <p className="text-[10px] text-purple-400/40 mt-2">Your conversations are saved automatically</p>
              )}
            </div>
          ) : null}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                m.role === 'user'
                  ? 'bg-purple-500/15 text-white/90 border border-purple-500/20'
                  : m.role === 'system'
                    ? 'bg-amber-500/10 text-amber-300/80 border border-amber-500/10 text-[11px]'
                    : 'bg-white/[0.04] text-white/80 border border-white/5'
              }`}>
                <div className="text-[9px] font-bold text-white/20 mb-1 uppercase tracking-wider">{m.role}</div>
                {/* Show attachment badges */}
                {m.attachments && m.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {m.attachments.map((att, j) => {
                      const Icon = fileIcon(att.filename);
                      return (
                        <span key={j} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/15 text-[10px] text-purple-300">
                          <Icon className="w-3 h-3" />
                          {att.filename}
                          <span className="text-white/20">{humanSize(att.size)}</span>
                        </span>
                      );
                    })}
                  </div>
                )}
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            </div>
          ))}

          {streamingText && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-xl px-3.5 py-2.5 bg-white/[0.04] text-white/80 border border-white/5">
                <div className="text-[9px] font-bold text-white/20 mb-1 uppercase tracking-wider">assistant</div>
                <div className="text-[13px] leading-relaxed whitespace-pre-wrap">{streamingText}<span className="animate-pulse text-purple-400">&#9612;</span></div>
              </div>
            </div>
          )}

          {running && !streamingText && chatMode !== 'agent' && (
            <div className="flex justify-start">
              <div className="rounded-xl px-3.5 py-2.5 bg-white/[0.04] border border-white/5">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-purple-400/50 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-purple-400/50 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                  <span className="w-2 h-2 bg-purple-400/50 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                </div>
              </div>
            </div>
          )}

          {/* Agent progress indicator */}
          {running && chatMode === 'agent' && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-xl px-4 py-3 bg-purple-500/[0.06] border border-purple-500/15">
                <div className="flex items-center gap-2 mb-2">
                  <div className="relative w-4 h-4 flex-shrink-0">
                    <svg className="w-4 h-4 animate-spin text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
                      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                    </svg>
                  </div>
                  <span className="text-[12px] font-medium text-purple-300">
                    {agentStatus || 'Starting agent…'}
                  </span>
                  <span className="text-[10px] text-white/20 ml-auto">
                    {agentTokenCount > 0 && `${agentTokenCount} tokens`}
                  </span>
                </div>

                {agentFilesFound.length > 0 && (
                  <div className="mt-2 space-y-0.5 border-t border-purple-500/10 pt-2">
                    <div className="text-[10px] text-white/25 font-medium uppercase tracking-wider mb-1">
                      Files ({agentFilesFound.length})
                    </div>
                    {agentFilesFound.map((fp, i) => (
                      <div key={fp} className="flex items-center gap-1.5 text-[11px]">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          i === agentFilesFound.length - 1
                            ? 'bg-purple-400 animate-pulse'
                            : 'bg-green-400/60'
                        }`} />
                        <span className={i === agentFilesFound.length - 1 ? 'text-purple-300' : 'text-white/40'}>
                          {fp}
                        </span>
                        {i < agentFilesFound.length - 1 && (
                          <span className="text-[9px] text-green-400/40">✓</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="flex items-start gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg mt-2">
            <span className="text-xs text-red-400">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-400/50 hover:text-red-300"><HiX className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* ── Copilot-style Input Area ── */}
        <div className="mt-3">
          {/* Main input container */}
          <div
            className={`relative rounded-xl transition-all duration-200 bg-white/[0.03] ${
              isRecording
                ? 'border border-red-500/40 shadow-[0_0_16px_rgba(239,68,68,0.08)]'
                : 'border border-white/[0.06] focus-within:border-purple-500/40 focus-within:shadow-[0_0_0_1px_rgba(168,85,247,0.12)]'
            }`}
          >
            {/* Attached files — inside the box, above textarea */}
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-3 pt-3 pb-0">
                {attachedFiles.map((af, i) => {
                  const Icon = fileIcon(af.file.name);
                  return (
                    <div
                      key={i}
                      className={`inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-md text-[11px] group transition-colors ${
                        af.error
                          ? 'bg-red-500/10 border border-red-500/20'
                          : 'bg-white/[0.04] border border-white/[0.06] hover:border-purple-500/25'
                      }`}
                    >
                      {af.uploading ? (
                        <div className="w-3.5 h-3.5 border-[1.5px] border-purple-400/60 border-t-transparent rounded-full animate-spin" />
                      ) : af.error ? (
                        <HiX className="w-3.5 h-3.5 text-red-400" />
                      ) : (
                        <Icon className="w-3.5 h-3.5 text-purple-400/70" />
                      )}
                      <span className={`max-w-[140px] truncate font-medium ${af.error ? 'text-red-400' : 'text-white/60'}`}>
                        {af.file.name}
                      </span>
                      <span className="text-white/20 text-[10px]">{humanSize(af.file.size)}</span>
                      <button
                        onClick={() => removeAttachment(i)}
                        className="p-0.5 rounded hover:bg-white/10 text-white/20 hover:text-red-400 transition-all ml-0.5"
                        title="Remove"
                      >
                        <HiX className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Textarea */}
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={
                isRecording
                  ? 'Listening… speak now'
                  : chatMode === 'agent'
                    ? 'Describe what you want to build…'
                    : mode === 'chat'
                      ? 'Ask anything, or @ to mention'
                      : 'Enter a prompt for text completion…'
              }
              disabled={running}
              className="w-full bg-transparent px-3.5 pt-3 pb-2 text-[13px] text-white placeholder-white/30 focus:outline-none resize-none disabled:opacity-40 leading-relaxed caret-white"
              style={{ height: 'auto', minHeight: '44px', maxHeight: '160px', colorScheme: 'dark' }}
            />

            {/* Bottom toolbar — actions row */}
            <div className="flex items-center justify-between px-2.5 pb-2 relative">
              {/* Left: action buttons */}
              <div className="flex items-center gap-0.5 overflow-visible">
                {/* Attach file */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 rounded-md text-white/70 hover:text-white transition-all disabled:opacity-30"
                  title="Attach file"
                  disabled={running}
                >
                  <HiPaperClip className="w-[18px] h-[18px]" />
                </button>

                {/* Microphone */}
                <button
                  onClick={toggleRecording}
                  className={`p-1.5 rounded-md transition-all ${
                    isRecording
                      ? 'text-red-400'
                      : 'text-white/70 hover:text-white'
                  } disabled:opacity-30`}
                  title={isRecording ? 'Stop recording' : 'Voice input'}
                  disabled={running}
                >
                  {isRecording ? (
                    <div className="relative">
                      <HiMicrophone className="w-[18px] h-[18px]" />
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    </div>
                  ) : (
                    <HiMicrophone className="w-[18px] h-[18px]" />
                  )}
                </button>

                {/* Mode selector dropup (Ask / Agent) */}
                <div className="relative" ref={modeDropupRef}>
                  <button
                    onClick={() => setShowModeDropup(!showModeDropup)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-white/70 hover:text-white transition-all text-[12px] font-medium"
                    title="Switch mode"
                  >
                    {chatMode === 'ask' ? (
                      <HiChat className="w-3.5 h-3.5" />
                    ) : (
                      <HiLightningBolt className="w-3.5 h-3.5 text-purple-400" />
                    )}
                    <span className={chatMode === 'agent' ? 'text-purple-400' : ''}>
                      {chatMode === 'ask' ? 'Ask' : 'Agent'}
                    </span>
                    <HiChevronUp className={`w-3 h-3 transition-transform ${showModeDropup ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropup menu */}
                  {showModeDropup && (
                    <div className="absolute bottom-full left-0 mb-1.5 w-56 rounded-lg border border-white/10 bg-[#1b2838] shadow-xl shadow-black/40 overflow-hidden" style={{ zIndex: 9999 }}>
                      <div className="p-1">
                        {/* Ask mode */}
                        <button
                          onClick={() => { setChatMode('ask'); setShowModeDropup(false); }}
                          className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-md text-left transition-all ${
                            chatMode === 'ask'
                              ? 'bg-white/[0.08] text-white'
                              : 'text-white/60 hover:bg-white/[0.04] hover:text-white/80'
                          }`}
                        >
                          <HiChat className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="text-[13px] font-medium flex items-center gap-1.5">
                              Ask
                              {chatMode === 'ask' && (
                                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                              )}
                            </div>
                            <div className="text-[11px] text-white/30 mt-0.5 leading-snug">
                              Chat with the model, ask questions, get answers
                            </div>
                          </div>
                        </button>

                        {/* Agent mode */}
                        <button
                          onClick={() => { setChatMode('agent'); setShowModeDropup(false); }}
                          className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-md text-left transition-all ${
                            chatMode === 'agent'
                              ? 'bg-purple-500/[0.12] text-purple-300'
                              : 'text-white/60 hover:bg-white/[0.04] hover:text-white/80'
                          }`}
                        >
                          <HiLightningBolt className="w-4 h-4 mt-0.5 flex-shrink-0 text-purple-400" />
                          <div>
                            <div className="text-[13px] font-medium flex items-center gap-1.5">
                              Agent
                              {chatMode === 'agent' && (
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                              )}
                            </div>
                            <div className="text-[11px] text-white/30 mt-0.5 leading-snug">
                              Generate full projects — code, folders, deploy
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Center: recording indicator */}
              {isRecording && (
                <span className="flex items-center gap-1.5 text-[11px] text-red-400/80 font-medium">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  Listening…
                </span>
              )}

              {/* Right: send / stop */}
              <div className="flex items-center gap-1">
                {running ? (
                  <button
                    onClick={stopGeneration}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/80 hover:bg-red-500 text-white text-[12px] font-medium transition-all"
                    title="Stop generation"
                  >
                    <HiStop className="w-3.5 h-3.5" />
                    Stop
                  </button>
                ) : (
                  <button
                    onClick={send}
                    disabled={!input.trim() && attachedFiles.length === 0}
                    className="flex items-center justify-center w-8 h-8 rounded-lg text-white hover:text-white disabled:text-white/30 transition-all disabled:cursor-not-allowed"
                    title="Send (Enter)"
                  >
                    <svg className="w-4 h-4 -rotate-45" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Hint text below */}
          <div className="flex items-center justify-between mt-1.5 px-1">
            <div className="flex items-center gap-2">
              {attachedFiles.length > 0 && (
                <span className="text-[10px] text-purple-400/40">
                  {attachedFiles.length} file{attachedFiles.length !== 1 ? 's' : ''} attached
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isAuthenticated && (
                <span className="text-[10px] text-[#8f98a0]/25">Sign in to save chats</span>
              )}
              <span className="text-[10px] text-[#8f98a0]/20">
                <kbd className="px-1 py-0.5 rounded bg-white/[0.03] text-[#8f98a0]/30 text-[9px] font-mono">Enter</kbd> send
                <span className="mx-1 text-white/[0.06]">&middot;</span>
                <kbd className="px-1 py-0.5 rounded bg-white/[0.03] text-[#8f98a0]/30 text-[9px] font-mono">Shift+Enter</kbd> new line
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
