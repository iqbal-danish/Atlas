import React, { useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import { FsEntry } from '../types';
import { api } from '../api';
import {
  Scissors,
  Copy,
  ClipboardPaste,
  CopyPlus,
  Trash2,
  Edit2,
  Terminal,
  FolderOpen,
  FileText,
  FileCheck2,
  Archive,
  Info,
  Layers,
  Sparkles,
  FileCode,
  Eye,
  Activity,
  Zap,
} from 'lucide-react';
import { useEditorStore } from '../serverdock/stores/editorStore';

export interface ContextMenuProps {
  x: number;
  y: number;
  entry?: FsEntry;
  currentDir: string;
  tabId: string;
  entries: FsEntry[];
  onClose: () => void;
  onRenameRequest?: (entry: FsEntry) => void;
  onSelectByPatternRequest?: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  entry,
  currentDir,
  tabId,
  entries,
  onClose,
  onRenameRequest,
  onSelectByPatternRequest,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const {
    clipboard,
    cutSelection,
    copySelection,
    paste,
    duplicate,
    executeDelete,
    addToDropZone,
    selectAll,
    invertSelection,
    setBatchRenameOpen,
    setPropertiesOpen,
    setLargeFileEditorOpen,
    tabs,
  } = useAppStore();

  const tab = tabs.find((t) => t.id === tabId);
  const selectedPaths = tab?.selectedPaths || (entry ? [entry.path] : []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Adjust coordinates if menu would bleed offscreen
  const menuWidth = 224;
  const menuHeight = entry ? 570 : 360;
  const adjustedX = Math.max(8, Math.min(x, window.innerWidth - menuWidth - 8));
  const adjustedY = Math.max(8, Math.min(y, window.innerHeight - menuHeight - 16));

  const handleCopyPath = () => {
    if (entry) {
      navigator.clipboard.writeText(entry.path);
    } else {
      navigator.clipboard.writeText(currentDir);
    }
    onClose();
  };

  const handleCopyName = () => {
    if (entry) {
      navigator.clipboard.writeText(entry.name);
    }
    onClose();
  };

  const handleLaunchTerminal = async () => {
    const target = entry?.path || currentDir;
    await api.launchTerminal(target);
    onClose();
  };

  const handleShowInExplorer = async () => {
    const target = entry?.path || currentDir;
    await api.showInExplorer(target);
    onClose();
  };

  const handleOpenDefault = async () => {
    if (entry) {
      await api.openFile(entry.path);
    }
    onClose();
  };

  const handleExtractArchive = async () => {
    if (entry && entry.name.toLowerCase().endsWith('.zip')) {
      const parent = entry.path.substring(0, entry.path.lastIndexOf('\\'));
      try {
        await api.extractArchive(entry.path, parent);
        useAppStore.getState().navigateTab(tabId, currentDir);
      } catch (e) {
        alert(`Extraction failed: ${e}`);
      }
    }
    onClose();
  };

  const handleCompress = async () => {
    if (selectedPaths.length === 0) return;
    const baseName = entry ? entry.name.replace(/\.[^/.]+$/, '') : 'Archive';
    const destZip = `${currentDir}\\${baseName}.zip`;
    try {
      await api.createZipArchive(selectedPaths, destZip);
      useAppStore.getState().navigateTab(tabId, currentDir);
    } catch (e) {
      alert(`Compression failed: ${e}`);
    }
    onClose();
  };

  const isZip = entry?.name.toLowerCase().endsWith('.zip');

  return (
    <div
      ref={menuRef}
      style={{ left: adjustedX, top: adjustedY }}
      className="fixed z-50 w-56 max-h-[calc(100vh-24px)] overflow-y-auto bg-surface/95 backdrop-blur-md border border-border/80 rounded-lg shadow-2xl py-1 text-xs select-none flex flex-col text-foreground animate-in fade-in zoom-in-95 duration-100"
    >
      {/* File-specific primary actions */}
      {entry && (
        <>
          <button
            onClick={handleOpenDefault}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-hover text-left transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5 text-accent" />
            <span>Open with Default App</span>
          </button>

          {!entry.isDir && (
            <div className="py-1 my-0.5 border-y border-border/60 bg-white/[0.02]">
              <div className="px-3 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted/70 flex items-center justify-between">
                <span>Power Tools</span>
                <span className="text-[9px] font-mono px-1 rounded bg-blue-500/10 text-blue-400">
                  {(entry.extension || '').toUpperCase()}
                </span>
              </div>

              {/* UltraViewer */}
              <button
                onClick={async () => {
                  try {
                    await api.openWithApp('ultraviewer', entry.path);
                  } catch (e) {
                    alert(`UltraViewer: ${e}`);
                  }
                  onClose();
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-surface-hover text-left transition-colors"
                title="Open and edit large XML/JSON files in UltraViewer"
              >
                <Eye className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-foreground text-xs leading-none">UltraViewer</span>
                  <span className="text-[9px] text-muted truncate mt-0.5">Large XML/JSON Editor</span>
                </div>
              </button>

              {/* FeedLens */}
              <button
                onClick={async () => {
                  try {
                    await api.openWithApp('feedlens', entry.path);
                  } catch (e) {
                    alert(`FeedLens: ${e}`);
                  }
                  onClose();
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-surface-hover text-left transition-colors"
                title="Load into FeedLens for DuckDB streaming feed analysis"
              >
                <Activity className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-foreground text-xs leading-none">FeedLens</span>
                  <span className="text-[9px] text-muted truncate mt-0.5">Feed Analyzer & DuckDB</span>
                </div>
              </button>

              {/* TransformLab */}
              <button
                onClick={async () => {
                  try {
                    await api.openWithApp('transformlab', entry.path);
                  } catch (e) {
                    alert(`TransformLab: ${e}`);
                  }
                  onClose();
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-surface-hover text-left transition-colors"
                title="Load into TransformLab for XSLT 3.0 / JOLT transformations"
              >
                <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-foreground text-xs leading-none">TransformLab</span>
                  <span className="text-[9px] text-muted truncate mt-0.5">XSLT 3.0 / JOLT Transformer</span>
                </div>
              </button>

              {/* ServerDock XML/JSON Viewer */}
              <button
                onClick={() => {
                  useEditorStore.getState().openFile(entry.path, entry.name, false);
                  setLargeFileEditorOpen(true);
                  onClose();
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-surface-hover text-left transition-colors"
                title="Open in embedded XML/JSON Viewer"
              >
                <FileCode className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-foreground text-xs leading-none">XML/JSON Viewer</span>
                  <span className="text-[9px] text-muted truncate mt-0.5">Streaming Editor & Regex</span>
                </div>
              </button>
            </div>
          )}

          {isZip ? (
            <button
              onClick={handleExtractArchive}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-hover text-left transition-colors"
            >
              <Archive className="w-3.5 h-3.5 text-emerald-400" />
              <span>Extract ZIP Archive Here</span>
            </button>
          ) : (
            <button
              onClick={handleCompress}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-hover text-left transition-colors"
            >
              <Archive className="w-3.5 h-3.5 text-amber-400" />
              <span>Compress to ZIP</span>
            </button>
          )}

          <div className="h-px bg-border/60 my-1" />
        </>
      )}

      {/* Clipboard actions */}
      {entry && (
        <>
          <button
            onClick={() => {
              cutSelection(tabId);
              onClose();
            }}
            className="flex items-center justify-between px-3 py-1.5 hover:bg-surface-hover text-left transition-colors"
          >
            <span className="flex items-center gap-2">
              <Scissors className="w-3.5 h-3.5 text-muted" />
              <span>Cut</span>
            </span>
            <span className="text-[10px] text-muted">Ctrl+X</span>
          </button>
          <button
            onClick={() => {
              copySelection(tabId);
              onClose();
            }}
            className="flex items-center justify-between px-3 py-1.5 hover:bg-surface-hover text-left transition-colors"
          >
            <span className="flex items-center gap-2">
              <Copy className="w-3.5 h-3.5 text-muted" />
              <span>Copy</span>
            </span>
            <span className="text-[10px] text-muted">Ctrl+C</span>
          </button>
        </>
      )}

      <button
        disabled={!clipboard}
        onClick={async () => {
          await paste(tabId, currentDir);
          onClose();
        }}
        className="flex items-center justify-between px-3 py-1.5 hover:bg-surface-hover text-left transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <span className="flex items-center gap-2">
          <ClipboardPaste className="w-3.5 h-3.5 text-muted" />
          <span>Paste</span>
        </span>
        <span className="text-[10px] text-muted">Ctrl+V</span>
      </button>

      {entry && (
        <button
          onClick={async () => {
            await duplicate(tabId);
            onClose();
          }}
          className="flex items-center justify-between px-3 py-1.5 hover:bg-surface-hover text-left transition-colors"
        >
          <span className="flex items-center gap-2">
            <CopyPlus className="w-3.5 h-3.5 text-muted" />
            <span>Duplicate</span>
          </span>
          <span className="text-[10px] text-muted">Ctrl+D</span>
        </button>
      )}

      <div className="h-px bg-border/60 my-1" />

      {/* Rename & Delete */}
      {entry && (
        <>
          <button
            onClick={() => {
              if (onRenameRequest) onRenameRequest(entry);
              onClose();
            }}
            className="flex items-center justify-between px-3 py-1.5 hover:bg-surface-hover text-left transition-colors"
          >
            <span className="flex items-center gap-2">
              <Edit2 className="w-3.5 h-3.5 text-muted" />
              <span>Rename</span>
            </span>
            <span className="text-[10px] text-muted">F2</span>
          </button>

          {selectedPaths.length > 1 && (
            <button
              onClick={() => {
                setBatchRenameOpen(true);
                onClose();
              }}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-hover text-left transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <span>Batch Rename ({selectedPaths.length} items)...</span>
            </button>
          )}

          <button
            onClick={async () => {
              await executeDelete(selectedPaths, false);
              useAppStore.getState().navigateTab(tabId, currentDir);
              onClose();
            }}
            className="flex items-center justify-between px-3 py-1.5 hover:bg-red-500/20 text-red-400 text-left transition-colors"
          >
            <span className="flex items-center gap-2">
              <Trash2 className="w-3.5 h-3.5" />
              <span>Recycle Bin</span>
            </span>
            <span className="text-[10px] opacity-70">Del</span>
          </button>

          <button
            onClick={async () => {
              if (confirm('Permanently delete selected item(s)? This action cannot be undone.')) {
                await executeDelete(selectedPaths, true);
                useAppStore.getState().navigateTab(tabId, currentDir);
              }
              onClose();
            }}
            className="flex items-center justify-between px-3 py-1.5 hover:bg-red-500/20 text-red-500 text-left transition-colors"
          >
            <span className="flex items-center gap-2">
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Permanently</span>
            </span>
            <span className="text-[10px] opacity-70">Shift+Del</span>
          </button>

          <div className="h-px bg-border/60 my-1" />
        </>
      )}

      {/* Copy paths & Selection */}
      <button
        onClick={handleCopyPath}
        className="flex items-center justify-between px-3 py-1.5 hover:bg-surface-hover text-left transition-colors"
      >
        <span className="flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-muted" />
          <span>Copy Full Path</span>
        </span>
        <span className="text-[10px] text-muted">Ctrl+Shift+C</span>
      </button>

      {entry && (
        <button
          onClick={handleCopyName}
          className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-hover text-left transition-colors"
        >
          <FileCheck2 className="w-3.5 h-3.5 text-muted" />
          <span>Copy Filename</span>
        </button>
      )}

      {entry && (
        <button
          onClick={() => {
            addToDropZone(selectedPaths);
            onClose();
          }}
          className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-hover text-left transition-colors"
        >
          <Layers className="w-3.5 h-3.5 text-accent" />
          <span>Add to Drop Zone Stash</span>
        </button>
      )}

      <div className="h-px bg-border/60 my-1" />

      {/* Shell integrations */}
      <button
        onClick={handleLaunchTerminal}
        className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-hover text-left transition-colors"
      >
        <Terminal className="w-3.5 h-3.5 text-emerald-400" />
        <span>Open in Terminal</span>
      </button>

      <button
        onClick={handleShowInExplorer}
        className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-hover text-left transition-colors"
      >
        <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
        <span>Show in Windows Explorer</span>
      </button>

      {/* Selection helpers */}
      <div className="h-px bg-border/60 my-1" />

      <button
        onClick={() => {
          selectAll(tabId, entries);
          onClose();
        }}
        className="flex items-center justify-between px-3 py-1.5 hover:bg-surface-hover text-left transition-colors"
      >
        <span>Select All</span>
        <span className="text-[10px] text-muted">Ctrl+A</span>
      </button>

      <button
        onClick={() => {
          invertSelection(tabId, entries);
          onClose();
        }}
        className="flex items-center px-3 py-1.5 hover:bg-surface-hover text-left transition-colors"
      >
        <span>Invert Selection</span>
      </button>

      {onSelectByPatternRequest && (
        <button
          onClick={() => {
            onSelectByPatternRequest();
            onClose();
          }}
          className="flex items-center px-3 py-1.5 hover:bg-surface-hover text-left transition-colors"
        >
          <span>Select by Pattern...</span>
        </button>
      )}

      <div className="h-px bg-border/60 my-1" />

      {/* Properties & Hashes */}
      <button
        onClick={() => {
          setPropertiesOpen(true, entry);
          onClose();
        }}
        className="flex items-center justify-between px-3 py-1.5 hover:bg-surface-hover text-left transition-colors"
      >
        <span className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-muted" />
          <span>Properties & Hashes</span>
        </span>
        <span className="text-[10px] text-muted">Alt+Enter</span>
      </button>
    </div>
  );
};
