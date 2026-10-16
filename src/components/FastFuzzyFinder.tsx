import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import { api } from '../api';
import { FsEntry } from '../types';
import {
  Search,
  Folder,
  File,
  FileCode,
  FileSpreadsheet,
  FileText,
  Image,
  ArrowRight,
  X,
  ExternalLink,
  FolderOpen,
  Eye,
  Copy,
  Check,
  Trash2,
  Terminal,
  Info,
  Scissors,
  Layers,
  Activity,
  Zap,
} from 'lucide-react';
import { useEditorStore } from '../serverdock/stores/editorStore';
import { useRemoteDownloadStore } from '../stores/remoteDownloadStore';
import { SpreadsheetModal } from './SpreadsheetModal';

interface FastFuzzyFinderProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FuzzyResult {
  name: string;
  path: string;
  isDir: boolean;
  score: number;
  highlightIndices: number[];
  size?: number;
}

export const FastFuzzyFinder: React.FC<FastFuzzyFinderProps> = ({ isOpen, onClose }) => {
  const {
    tabs,
    activeTabId,
    navigateTab,
    setSelectedEntry,
    togglePreviewPanel,
    previewPanelOpen,
    cutSelection,
    copySelection,
    executeDelete,
    setPropertiesOpen,
    setLargeFileEditorOpen,
  } = useAppStore();
  const currentTab = tabs.find((t) => t.id === activeTabId);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FuzzyResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  // Dedicated Action Menu on Right-Click
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    result: FuzzyResult;
  } | null>(null);

  // Spreadsheet Viewer Modal state
  const [spreadsheetFile, setSpreadsheetFile] = useState<{
    fileName: string;
    filePath: string;
    content: string;
    fileSize?: number;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef(contextMenu);
  contextMenuRef.current = contextMenu;

  // Cached files pool for instant in-memory fuzzy search
  const filePoolRef = useRef<Array<{ name: string; path: string; isDir: boolean; size?: number }>>([]);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeSearchIdRef = useRef<number>(0);

  // Auto-focus and reset state when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setQuery('');
    setSelectedIndex(0);
    setContextMenu(null);
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [isOpen]);

  // Global Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (contextMenuRef.current) {
          setContextMenu(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onGlobalKeyDown, true);

    return () => {
      window.removeEventListener('keydown', onGlobalKeyDown, true);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      const populatePool = async () => {
        const pool: Array<{ name: string; path: string; isDir: boolean; size?: number }> = [];
        const currentPath = currentTab?.path || 'C:\\';

        try {
          const listing = await api.readDirectory(currentPath, false);
          if (listing.entries) {
            listing.entries.forEach((e) => {
              pool.push({ name: e.name, path: e.path, isDir: e.isDir, size: e.size });
            });
          }
        } catch {}

        filePoolRef.current = pool;
      };

      populatePool();
    }
  }, [isOpen, currentTab?.path]);

  // Fast fuzzy match algorithm
  const fuzzyMatch = (text: string, pattern: string): { score: number; indices: number[] } | null => {
    const textLower = text.toLowerCase();
    const patternLower = pattern.toLowerCase();

    if (textLower === patternLower) {
      return { score: 1000, indices: text.split('').map((_, i) => i) };
    }
    const idx = textLower.indexOf(patternLower);
    if (idx !== -1) {
      const indices = [];
      for (let i = 0; i < pattern.length; i++) indices.push(idx + i);
      const score = 500 - idx * 5 + (idx === 0 ? 200 : 0);
      return { score, indices };
    }

    let patternIdx = 0;
    let score = 0;
    const indices: number[] = [];
    let prevMatchedIdx = -2;

    for (let textIdx = 0; textIdx < textLower.length; textIdx++) {
      if (textLower[textIdx] === patternLower[patternIdx]) {
        indices.push(textIdx);
        if (textIdx === prevMatchedIdx + 1) {
          score += 30;
        } else {
          score += 10;
        }
        if (textIdx === 0 || text[textIdx - 1] === ' ' || text[textIdx - 1] === '_' || text[textIdx - 1] === '-') {
          score += 25;
        }
        prevMatchedIdx = textIdx;
        patternIdx++;
        if (patternIdx === patternLower.length) break;
      }
    }

    if (patternIdx === patternLower.length) {
      return { score, indices };
    }
    return null;
  };

  // Run fuzzy search on query change with debouncing to prevent C: freezes
  useEffect(() => {
    if (!query.trim()) {
      const defaults = filePoolRef.current.slice(0, 25).map((item) => ({
        ...item,
        score: 0,
        highlightIndices: [],
      }));
      setResults(defaults);
      setSelectedIndex(0);
      setIsSearching(false);
      return;
    }

    // 1. Instant in-memory search
    const scored: FuzzyResult[] = [];
    for (const item of filePoolRef.current) {
      const match = fuzzyMatch(item.name, query.trim());
      if (match) {
        scored.push({
          name: item.name,
          path: item.path,
          isDir: item.isDir,
          score: match.score,
          highlightIndices: match.indices,
          size: item.size,
        });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    setResults(scored.slice(0, 30));
    setSelectedIndex(0);

    // 2. Debounced asynchronous disk search (250ms)
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim().length >= 2) {
      const searchId = ++activeSearchIdRef.current;
      setIsSearching(true);

      searchTimeoutRef.current = setTimeout(() => {
        const currentPath = currentTab?.path || 'C:\\';
        api
          .searchFiles(currentPath, query.trim(), 40)
          .then((diskResults) => {
            if (searchId !== activeSearchIdRef.current) return;

            const diskScored: FuzzyResult[] = [];
            diskResults.forEach((dr) => {
              const match = fuzzyMatch(dr.name, query.trim());
              diskScored.push({
                name: dr.name,
                path: dr.path,
                isDir: dr.isDir,
                score: match ? match.score + 50 : 10,
                highlightIndices: match ? match.indices : [],
                size: dr.size,
              });
            });

            setResults((prev) => {
              const map = new Map<string, FuzzyResult>();
              [...prev, ...diskScored].forEach((r) => map.set(r.path, r));
              const merged = Array.from(map.values());
              merged.sort((a, b) => b.score - a.score);
              return merged.slice(0, 40);
            });
          })
          .catch(() => {})
          .finally(() => {
            if (searchId === activeSearchIdRef.current) {
              setIsSearching(false);
            }
          });
      }, 250);
    } else {
      setIsSearching(false);
    }

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [query]);

  // Helper to convert FuzzyResult into FsEntry
  const resultToFsEntry = (res: FuzzyResult): FsEntry => ({
    name: res.name,
    path: res.path,
    isDir: res.isDir,
    isSymlink: false,
    isHidden: false,
    isReadonly: false,
    size: res.size || 0,
    extension: res.name.split('.').pop(),
  });

  // Action Handlers
  const handleRevealInFolder = (result: FuzzyResult) => {
    setContextMenu(null);
    if (result.isDir) {
      navigateTab(activeTabId, result.path);
    } else {
      const parentDir = result.path.substring(0, result.path.lastIndexOf('\\')) || 'C:\\';
      navigateTab(activeTabId, parentDir);
      setSelectedEntry(activeTabId, resultToFsEntry(result), false);
    }
    onClose();
  };

  const handlePreview = (result: FuzzyResult) => {
    setContextMenu(null);
    const entry = resultToFsEntry(result);
    setSelectedEntry(activeTabId, entry, false);
    if (!previewPanelOpen) {
      togglePreviewPanel();
    }
    const parentDir = result.path.substring(0, result.path.lastIndexOf('\\')) || 'C:\\';
    navigateTab(activeTabId, parentDir);
    onClose();
  };

  const handleOpenSpreadsheet = async (result: FuzzyResult) => {
    setContextMenu(null);
    try {
      const preview = await api.getFilePreview(result.path, 128 * 1024, false);
      if (preview && preview.content) {
        setSpreadsheetFile({
          fileName: result.name,
          filePath: result.path,
          content: preview.content,
          fileSize: result.size,
        });
      } else {
        api.openFile(result.path).catch(console.error);
        onClose();
      }
    } catch {
      api.openFile(result.path).catch(console.error);
      onClose();
    }
  };

  const handleOpenExternal = (result: FuzzyResult) => {
    setContextMenu(null);
    if (result.path.startsWith('remote://')) {
      useRemoteDownloadStore.getState().startDownload({
        appName: 'default',
        remotePath: result.path,
        fileName: result.name,
        totalBytes: result.size || 0,
      });
    } else {
      api.openFile(result.path).catch(console.error);
    }
    onClose();
  };

  const handleCopyPath = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(path).then(() => {
      setCopiedPath(path);
      setTimeout(() => setCopiedPath(null), 1500);
    });
  };

  const handleDelete = async (e: React.MouseEvent, result: FuzzyResult) => {
    e.stopPropagation();
    setContextMenu(null);
    if (confirm(`Move "${result.name}" to Recycle Bin?`)) {
      await executeDelete([result.path], false);
      setResults((prev) => prev.filter((r) => r.path !== result.path));
    }
  };

  const handleContextMenu = (e: React.MouseEvent, result: FuzzyResult) => {
    e.preventDefault();
    e.stopPropagation();
    const entry = resultToFsEntry(result);
    setSelectedEntry(activeTabId, entry, false);

    const menuWidth = 240;
    const menuHeight = 440;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 10);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 10);

    setContextMenu({
      x: Math.max(10, x),
      y: Math.max(10, y),
      result,
    });
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (contextMenu) {
        setContextMenu(null);
      } else {
        onClose();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, results.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % Math.max(1, results.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = results[selectedIndex];
      if (target) {
        if (e.altKey) {
          handleOpenExternal(target);
        } else {
          handleRevealInFolder(target);
        }
      }
    } else if (e.key === ' ' && !query) {
      e.preventDefault();
      const target = results[selectedIndex];
      if (target) handlePreview(target);
    }
  };

  const getFileIcon = (isDir: boolean, name: string) => {
    if (isDir) {
      return <Folder className="w-4 h-4 text-slate-400 shrink-0" />;
    }
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') {
      return <FileText className="w-4 h-4 text-rose-400 shrink-0" />;
    }
    if (['xlsx', 'xls', 'csv'].includes(ext)) {
      return <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />;
    }
    if (['xml', 'xsl', 'xslt', 'svg'].includes(ext)) {
      return <FileCode className="w-4 h-4 text-orange-400 shrink-0" />;
    }
    if (['json', 'json5', 'jsonc', 'yaml', 'yml'].includes(ext)) {
      return <FileCode className="w-4 h-4 text-violet-400 shrink-0" />;
    }
    if (['docx', 'doc', 'txt', 'md'].includes(ext)) {
      return <FileText className="w-4 h-4 text-blue-400 shrink-0" />;
    }
    if (['js', 'ts', 'tsx', 'rs', 'py'].includes(ext)) {
      return <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />;
    }
    if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
      return <Image className="w-4 h-4 text-pink-400 shrink-0" />;
    }
    return <File className="w-4 h-4 text-slate-400 shrink-0" />;
  };

  const renderHighlightedName = (name: string, indices: number[]) => {
    if (indices.length === 0) return <span>{name}</span>;
    const indexSet = new Set(indices);
    return (
      <span>
        {name.split('').map((char, i) => (
          <span
            key={i}
            className={indexSet.has(i) ? 'text-slate-100 font-bold underline underline-offset-2' : ''}
          >
            {char}
          </span>
        ))}
      </span>
    );
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        onClick={() => {
          if (contextMenu) {
            setContextMenu(null);
          } else {
            onClose();
          }
        }}
        className="fixed inset-0 z-50 bg-black/65 flex items-start justify-center pt-20 p-4 select-none animate-in fade-in duration-100"
      >
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (contextMenu) setContextMenu(null);
          }}
          className="bg-[#0f1016] border border-white/10 rounded-xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[500px] animate-in zoom-in-95 duration-150"
        >
          {/* Spotlight Search Input */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.08] bg-[#141620]">
            <Search className="w-5 h-5 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Fuzzy search files and folders..."
              className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none font-medium"
            />
            {isSearching && (
              <span className="text-[10px] text-slate-400 animate-pulse font-mono">Searching...</span>
            )}
            {query ? (
              <button
                onClick={() => setQuery('')}
                className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <span className="text-[10px] text-slate-500 border border-white/10 px-1.5 py-0.5 rounded">
                ESC to close
              </span>
            )}
          </div>

          {/* Results List */}
          <div ref={listRef} className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
            {results.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
                <Search className="w-8 h-8 text-slate-600/40" />
                <span>{isSearching ? 'Searching disk...' : 'No matching files found'}</span>
              </div>
            ) : (
              results.map((result, idx) => {
                const isSelected = idx === selectedIndex;
                const parentPath = result.path.substring(0, result.path.lastIndexOf('\\')) || 'C:\\';
                const isSpreadsheet = Boolean(result.name.match(/\.(xlsx|xls|csv)$/i));

                return (
                  <div
                    key={result.path}
                    onClick={() => handleRevealInFolder(result)}
                    onContextMenu={(e) => handleContextMenu(e, result)}
                    className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-white/[0.08] text-white font-medium border border-white/15 shadow-sm'
                        : 'hover:bg-white/[0.04] text-slate-300 hover:text-white border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      {getFileIcon(result.isDir, result.name)}
                      <div className="min-w-0">
                        <div className="text-xs text-white truncate">
                          {renderHighlightedName(result.name, result.highlightIndices)}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">{parentPath}</div>
                      </div>
                    </div>

                    {/* Actions Rail on Item */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                        {/* Spreadsheet Viewer Button */}
                        {isSpreadsheet && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenSpreadsheet(result);
                            }}
                            className="p-1 rounded bg-emerald-950/60 hover:bg-emerald-800 text-emerald-300 border border-emerald-600/30"
                            title="Open in Built-in Spreadsheet Viewer"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Preview in Inspector */}
                        {!result.isDir && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreview(result);
                            }}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10"
                            title="Preview in Inspector (Space)"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-300" />
                          </button>
                        )}

                        {/* Reveal In Folder */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRevealInFolder(result);
                          }}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10"
                          title="Reveal in Folder (Enter)"
                        >
                          <FolderOpen className="w-3.5 h-3.5 text-slate-300" />
                        </button>

                        {/* Open Externally */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenExternal(result);
                          }}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10"
                          title="Open in Default App (Alt+Enter)"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-slate-300" />
                        </button>

                        {/* Copy Path */}
                        <button
                          onClick={(e) => handleCopyPath(e, result.path)}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10"
                          title="Copy full path"
                        >
                          {copiedPath === result.path ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-slate-300" />
                          )}
                        </button>

                        {/* Delete */}
                        <button
                          onClick={(e) => handleDelete(e, result)}
                          className="p-1 rounded bg-slate-800 hover:bg-red-900/60 text-slate-300 hover:text-red-300 border border-white/10"
                          title="Move to Recycle Bin"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {result.score > 0 && (
                        <span className="text-[9px] bg-white/[0.08] text-slate-400 px-1.5 py-0.5 rounded font-mono">
                          {result.score} pts
                        </span>
                      )}
                      <ArrowRight className={`w-3.5 h-3.5 ${isSelected ? 'text-slate-300' : 'opacity-0'}`} />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer shortcuts & helper */}
          <div className="px-4 py-2 border-t border-white/[0.08] bg-[#0c0d12] flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-3">
              <span>
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-300">Enter</kbd> Reveal
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-300">Alt+Enter</kbd> Open
              </span>
              <span>Right-click for full actions</span>
            </div>
            <span className="font-mono text-slate-400">{results.length} results</span>
          </div>
        </div>
      </div>

      {/* Dedicated In-Finder Action Context Menu & Dismissal Overlay */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-[9998]"
            onClick={(e) => {
              e.stopPropagation();
              setContextMenu(null);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setContextMenu(null);
            }}
          />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ left: contextMenu.x, top: contextMenu.y }}
            className="fixed z-[9999] w-60 max-h-[85vh] overflow-y-auto bg-[#161824] border border-white/15 rounded-xl shadow-2xl py-1.5 text-xs select-none flex flex-col text-slate-200 animate-in fade-in zoom-in-95 duration-100"
          >
            {/* Header with filename */}
            <div className="px-3 py-1 text-[10px] text-slate-400 font-mono border-b border-white/[0.08] mb-1 truncate">
              {contextMenu.result.name}
            </div>

            {/* Built-in Spreadsheet Viewer if xlsx/csv */}
            {Boolean(contextMenu.result.name.match(/\.(xlsx|xls|csv)$/i)) && (
              <button
                onClick={() => handleOpenSpreadsheet(contextMenu.result)}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-emerald-500/20 text-emerald-300 transition text-left"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Open in Spreadsheet Viewer</span>
              </button>
            )}

            {/* Reveal in Folder */}
            <button
              onClick={() => handleRevealInFolder(contextMenu.result)}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.08] text-slate-200 transition text-left"
            >
              <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
              <span>Reveal in Folder</span>
            </button>

            {/* Preview in Inspector */}
            {!contextMenu.result.isDir && (
              <button
                onClick={() => handlePreview(contextMenu.result)}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.08] text-slate-200 transition text-left"
              >
                <Eye className="w-3.5 h-3.5 text-slate-400" />
                <span>Preview in Inspector</span>
              </button>
            )}

            {/* Open with default app */}
            <button
              onClick={() => handleOpenExternal(contextMenu.result)}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.08] text-slate-200 transition text-left"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              <span>Open with Default App</span>
            </button>

            {/* Power Tools Section */}
            {!contextMenu.result.isDir && /^(xml|xsl|xslt|svg|xsd|wsdl|kml|gml|rss|atom|pom|plist|xib|storyboard|json|jsonc|json5|geojson|topojson|ipynb|har)$/i.test(contextMenu.result.name.split('.').pop() || '') && (
              <div className="py-1 my-0.5 border-y border-white/[0.08] bg-white/[0.02]">
                <div className="px-3 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Power Tools</span>
                  <span className="text-[9px] font-mono px-1 rounded bg-blue-500/20 text-blue-300">
                    {(contextMenu.result.name.split('.').pop() || '').toUpperCase()}
                  </span>
                </div>

                {/* UltraViewer */}
                <button
                  onClick={async () => {
                    if (contextMenu.result.path.startsWith('remote://')) {
                      useRemoteDownloadStore.getState().startDownload({
                        appName: 'ultraviewer',
                        remotePath: contextMenu.result.path,
                        fileName: contextMenu.result.name,
                        totalBytes: contextMenu.result.size || 0,
                      });
                    } else {
                      try {
                        await api.openWithApp('ultraviewer', contextMenu.result.path);
                      } catch (e) {
                        alert(`UltraViewer: ${e}`);
                      }
                    }
                    setContextMenu(null);
                    onClose();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.08] text-left transition-colors"
                  title="Open and edit large XML/JSON files in UltraViewer"
                >
                  <Eye className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-slate-200 text-xs leading-none">UltraViewer</span>
                    <span className="text-[9px] text-slate-400 truncate mt-0.5">Large XML/JSON Editor</span>
                  </div>
                </button>

                {/* FeedLens */}
                <button
                  onClick={async () => {
                    if (contextMenu.result.path.startsWith('remote://')) {
                      useRemoteDownloadStore.getState().startDownload({
                        appName: 'feedlens',
                        remotePath: contextMenu.result.path,
                        fileName: contextMenu.result.name,
                        totalBytes: contextMenu.result.size || 0,
                      });
                    } else {
                      try {
                        await api.openWithApp('feedlens', contextMenu.result.path);
                      } catch (e) {
                        alert(`FeedLens: ${e}`);
                      }
                    }
                    setContextMenu(null);
                    onClose();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.08] text-left transition-colors"
                  title="Load into FeedLens for DuckDB streaming feed analysis"
                >
                  <Activity className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-slate-200 text-xs leading-none">FeedLens</span>
                    <span className="text-[9px] text-slate-400 truncate mt-0.5">Feed Analyzer & DuckDB</span>
                  </div>
                </button>

                {/* TransformLab */}
                <button
                  onClick={async () => {
                    if (contextMenu.result.path.startsWith('remote://')) {
                      useRemoteDownloadStore.getState().startDownload({
                        appName: 'transformlab',
                        remotePath: contextMenu.result.path,
                        fileName: contextMenu.result.name,
                        totalBytes: contextMenu.result.size || 0,
                      });
                    } else {
                      try {
                        await api.openWithApp('transformlab', contextMenu.result.path);
                      } catch (e) {
                        alert(`TransformLab: ${e}`);
                      }
                    }
                    setContextMenu(null);
                    onClose();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.08] text-left transition-colors"
                  title="Load into TransformLab for XSLT 3.0 / JOLT transformations"
                >
                  <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-slate-200 text-xs leading-none">TransformLab</span>
                    <span className="text-[9px] text-slate-400 truncate mt-0.5">XSLT 3.0 / JOLT Transformer</span>
                  </div>
                </button>

                {/* ServerDock XML/JSON Viewer */}
                <button
                  onClick={() => {
                    useEditorStore.getState().openFile(
                      contextMenu.result.path,
                      contextMenu.result.name,
                      Boolean(contextMenu.result.path.startsWith('remote://'))
                    );
                    setLargeFileEditorOpen(true);
                    setContextMenu(null);
                    onClose();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.08] text-left transition-colors"
                  title="Open in embedded XML/JSON Viewer"
                >
                  <FileCode className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-slate-200 text-xs leading-none">XML/JSON Viewer</span>
                    <span className="text-[9px] text-slate-400 truncate mt-0.5">Streaming Editor & Regex</span>
                  </div>
                </button>
              </div>
            )}

            <div className="h-px bg-white/[0.08] my-1" />

            {/* Copy & Cut */}
            <button
              onClick={() => {
                const entry = resultToFsEntry(contextMenu.result);
                setSelectedEntry(activeTabId, entry, false);
                copySelection(activeTabId);
                setContextMenu(null);
                onClose();
              }}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.08] text-slate-200 transition text-left"
            >
              <Copy className="w-3.5 h-3.5 text-slate-400" />
              <span>Copy File</span>
            </button>

            <button
              onClick={() => {
                const entry = resultToFsEntry(contextMenu.result);
                setSelectedEntry(activeTabId, entry, false);
                cutSelection(activeTabId);
                setContextMenu(null);
                onClose();
              }}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.08] text-slate-200 transition text-left"
            >
              <Scissors className="w-3.5 h-3.5 text-slate-400" />
              <span>Cut File</span>
            </button>

            {/* Copy full path */}
            <button
              onClick={(e) => {
                handleCopyPath(e, contextMenu.result.path);
                setContextMenu(null);
                onClose();
              }}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.08] text-slate-200 transition text-left"
            >
              <Copy className="w-3.5 h-3.5 text-slate-400" />
              <span>Copy Full Path</span>
            </button>

            <div className="h-px bg-white/[0.08] my-1" />

            {/* Properties */}
            <button
              onClick={() => {
                const entry = resultToFsEntry(contextMenu.result);
                setSelectedEntry(activeTabId, entry, false);
                setPropertiesOpen(true, entry);
                setContextMenu(null);
                onClose();
              }}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.08] text-slate-200 transition text-left"
            >
              <Info className="w-3.5 h-3.5 text-slate-400" />
              <span>Properties & Hashes</span>
            </button>

            {/* Terminal */}
            <button
              onClick={() => {
                api.launchTerminal(contextMenu.result.path);
                setContextMenu(null);
                onClose();
              }}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.08] text-slate-200 transition text-left"
            >
              <Terminal className="w-3.5 h-3.5 text-slate-400" />
              <span>Open in Terminal</span>
            </button>

            {/* Show in Windows Explorer */}
            <button
              onClick={() => {
                api.showInExplorer(contextMenu.result.path);
                setContextMenu(null);
                onClose();
              }}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.08] text-slate-200 transition text-left"
            >
              <Folder className="w-3.5 h-3.5 text-slate-400" />
              <span>Show in Windows Explorer</span>
            </button>

            <div className="h-px bg-white/[0.08] my-1" />

            {/* Delete */}
            <button
              onClick={(e) => handleDelete(e, contextMenu.result)}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-red-500/20 text-red-400 transition text-left"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              <span>Move to Recycle Bin</span>
            </button>
          </div>
        </>
      )}

      {/* Built-in Full-Screen Spreadsheet Viewer Modal */}
      {spreadsheetFile && (
        <SpreadsheetModal
          isOpen={Boolean(spreadsheetFile)}
          onClose={() => setSpreadsheetFile(null)}
          fileName={spreadsheetFile.fileName}
          filePath={spreadsheetFile.filePath}
          rawContent={spreadsheetFile.content}
          fileSize={spreadsheetFile.fileSize}
        />
      )}
    </>
  );
};
