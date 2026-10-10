import React, { useEffect, useState, useRef } from 'react';
import { useAppStore } from '../store';
import { api } from '../api';
import { DirectoryListing, FsEntry } from '../types';
import { ContextMenu } from './ContextMenu';
import {
  Folder,
  File,
  ChevronRight,
  FileCode,
  FileImage,
  FileText,
  AlertCircle,
  Loader2,
  Archive,
  Maximize2,
  Minimize2,
  ExternalLink,
  FileSpreadsheet,
} from 'lucide-react';
import { FolderIcon } from './FolderIcon';

interface MillerColumnsProps {
  tabId: string;
}

interface ColumnData {
  path: string;
  listing?: DirectoryListing;
  loading: boolean;
  error?: string;
  selectedEntryPath?: string;
}

export const MillerColumns: React.FC<MillerColumnsProps> = ({ tabId }) => {
  const {
    tabs,
    showHiddenFiles,
    searchQuery,
    setSelectedEntry,
    navigateTab,
    setViewMode,
    cutSelection,
    copySelection,
    paste,
    duplicate,
    executeDelete,
  } = useAppStore();

  const currentTab = tabs.find((t) => t.id === tabId);
  const containerRef = useRef<HTMLDivElement>(null);

  const [columns, setColumns] = useState<ColumnData[]>([]);
  const [expandedColumnPath, setExpandedColumnPath] = useState<string | null>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    entry?: FsEntry;
    currentDir: string;
    entries: FsEntry[];
  } | null>(null);

  // Inline Rename State
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');

  const fetchColumn = async (path: string, colIndex: number) => {
    try {
      const listing = await api.readDirectory(path, showHiddenFiles);
      setColumns((prev) => {
        const next = [...prev];
        if (next[colIndex]) {
          next[colIndex] = {
            ...next[colIndex],
            listing,
            loading: false,
            error: listing.errorMessage,
          };
        }
        return next;
      });
    } catch (err: any) {
      setColumns((prev) => {
        const next = [...prev];
        if (next[colIndex]) {
          next[colIndex] = {
            ...next[colIndex],
            loading: false,
            error: String(err),
          };
        }
        return next;
      });
    }
  };

  // Build column path hierarchy when tab path changes
  useEffect(() => {
    if (!currentTab) return;

    const parts = currentTab.path.split('\\').filter(Boolean);
    const initialColumns: ColumnData[] = [];

    // Drive root
    let accumulated = parts[0] ? `${parts[0]}\\` : 'C:\\';
    initialColumns.push({ path: accumulated, loading: true });

    for (let i = 1; i < parts.length; i++) {
      accumulated = `${accumulated}${parts[i]}\\`;
      initialColumns.push({ path: accumulated, loading: true });
    }

    setColumns(initialColumns);

    // Fetch listings for all hierarchy levels
    initialColumns.forEach((col, idx) => {
      fetchColumn(col.path, idx);
    });
  }, [currentTab?.path, showHiddenFiles]);

  const handleEntryClick = (entry: FsEntry, colIndex: number, e: React.MouseEvent) => {
    const isMulti = e.ctrlKey || e.metaKey;
    setSelectedEntry(tabId, entry, isMulti);

    setColumns((prev) => {
      const updated = [...prev];
      if (updated[colIndex]) {
        updated[colIndex].selectedEntryPath = entry.path;
      }

      // If it's a directory and not multi-selecting, open next column
      if (entry.isDir && !isMulti) {
        const truncated = updated.slice(0, colIndex + 1);
        truncated.push({ path: entry.path, loading: true });
        return truncated;
      } else if (!entry.isDir && !isMulti) {
        // Truncate any further columns when a file is clicked
        return updated.slice(0, colIndex + 1);
      }
      return updated;
    });

    if (entry.isDir && !isMulti) {
      fetchColumn(entry.path, colIndex + 1);
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollLeft = containerRef.current.scrollWidth;
        }
      }, 50);
    }
  };

  const handleEntryDoubleClick = (entry: FsEntry) => {
    if (entry.isDir) {
      navigateTab(tabId, entry.path);
    } else {
      api.openFile(entry.path).catch(console.error);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, entry?: FsEntry, colPath?: string, entries: FsEntry[] = []) => {
    e.preventDefault();
    e.stopPropagation();

    if (entry) {
      setSelectedEntry(tabId, entry, false);
    }

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      entry,
      currentDir: colPath || currentTab?.path || 'C:\\',
      entries,
    });
  };

  const handleStartRename = (entry: FsEntry) => {
    setRenamingPath(entry.path);
    setRenameValue(entry.name);
  };

  const handleFinishRename = async (entry: FsEntry, colIdx: number) => {
    if (!renameValue.trim() || renameValue === entry.name) {
      setRenamingPath(null);
      return;
    }
    try {
      await api.renameEntry(entry.path, renameValue.trim());
      setRenamingPath(null);
      if (columns[colIdx]) {
        fetchColumn(columns[colIdx].path, colIdx);
      }
    } catch (e) {
      alert(`Rename failed: ${e}`);
    }
  };

  const getEntryIcon = (entry: FsEntry) => {
    if (entry.isDir) {
      return <Folder className="w-4 h-4 text-slate-400 shrink-0" />;
    }
    const ext = entry.extension?.toLowerCase() || '';
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) {
      return <Archive className="w-4 h-4 text-amber-400 shrink-0" />;
    }
    if (ext === 'pdf') {
      return <FileText className="w-4 h-4 text-rose-400 shrink-0" />;
    }
    if (['xlsx', 'xls', 'csv', 'tsv'].includes(ext)) {
      return <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />;
    }
    if (['xml', 'xsl', 'xslt', 'svg'].includes(ext)) {
      return <FileCode className="w-4 h-4 text-orange-400 shrink-0" />;
    }
    if (['json', 'json5', 'jsonc', 'yaml', 'yml', 'toml'].includes(ext)) {
      return <FileCode className="w-4 h-4 text-violet-400 shrink-0" />;
    }
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'ico'].includes(ext)) {
      return <FileImage className="w-4 h-4 text-pink-400 shrink-0" />;
    }
    if (['rs', 'ts', 'tsx', 'js', 'jsx', 'py', 'html', 'css', 'sql'].includes(ext)) {
      return <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />;
    }
    if (['doc', 'docx', 'rtf', 'odt'].includes(ext)) {
      return <FileText className="w-4 h-4 text-blue-400 shrink-0" />;
    }
    if (['txt', 'log', 'md', 'ini', 'cfg', 'conf'].includes(ext)) {
      return <FileText className="w-4 h-4 text-slate-300 shrink-0" />;
    }
    return <FileText className="w-4 h-4 text-slate-400 shrink-0" />;
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 flex overflow-x-auto overflow-y-hidden bg-background h-full divide-x divide-border select-none"
    >
      {columns.map((column, colIdx) => {
        let entries = column.listing?.entries || [];
        const isColumnExpanded = expandedColumnPath === column.path;

        // Search query filter
        if (searchQuery) {
          entries = entries.filter((e) =>
            e.name.toLowerCase().includes(searchQuery.toLowerCase())
          );
        }

        // Wildcard / regex filter pattern
        if (currentTab?.filterPattern) {
          const pat = currentTab.filterPattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
          try {
            const rx = new RegExp(`^${pat}$`, 'i');
            entries = entries.filter((e) => rx.test(e.name));
          } catch {
            // fallback substring
            entries = entries.filter((e) =>
              e.name.toLowerCase().includes(currentTab.filterPattern!.toLowerCase())
            );
          }
        }

        return (
          <div
            key={column.path + colIdx}
            onContextMenu={(e) => handleContextMenu(e, undefined, column.path, entries)}
            className={`${
              isColumnExpanded
                ? 'flex-1 min-w-[480px] max-w-none shadow-lg z-10'
                : 'w-64 min-w-[256px] max-w-[280px]'
            } h-full flex flex-col bg-background/50 overflow-hidden transition-all duration-200`}
          >
            {/* Column Header with Expand / Full View Controls */}
            <div className="px-3 py-1.5 border-b border-border text-[11px] font-medium text-muted truncate bg-surface/30 flex items-center justify-between gap-1">
              <span className="truncate font-semibold text-foreground/90" title={column.path}>
                {column.path.split('\\').filter(Boolean).pop() || column.path}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] text-muted/60">{entries.length}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedColumnPath(isColumnExpanded ? null : column.path);
                  }}
                  className={`p-1 rounded transition-colors ${
                    isColumnExpanded
                      ? 'bg-accent text-white'
                      : 'text-muted hover:text-foreground hover:bg-surface'
                  }`}
                  title={isColumnExpanded ? 'Restore column width' : 'Expand this column window'}
                >
                  {isColumnExpanded ? (
                    <Minimize2 className="w-3 h-3" />
                  ) : (
                    <Maximize2 className="w-3 h-3" />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateTab(tabId, column.path);
                    setViewMode(tabId, 'list');
                  }}
                  className="p-1 rounded text-muted hover:text-accent hover:bg-surface transition-colors"
                  title="Open folder in full List View"
                >
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Column Body */}
            <div className="flex-1 overflow-y-auto p-1">
              {column.loading && (
                <div className="flex items-center justify-center py-8 text-muted gap-2 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin text-accent" />
                  Loading...
                </div>
              )}

              {column.error && (
                <div className="flex flex-col items-center justify-center p-4 text-center text-red-400 gap-1.5 text-xs">
                  <AlertCircle className="w-4 h-4" />
                  <span>{column.error}</span>
                </div>
              )}

              {!column.loading && !column.error && entries.length === 0 && (
                <div className="text-center py-8 text-muted/60 text-xs italic">
                  Empty folder
                </div>
              )}

              {!column.loading &&
                entries.map((entry) => {
                  const isSelected =
                    currentTab?.selectedPaths.includes(entry.path) ||
                    column.selectedEntryPath === entry.path;
                  const isRenaming = renamingPath === entry.path;

                  return (
                    <div
                      key={entry.path}
                      onClick={(e) => handleEntryClick(entry, colIdx, e)}
                      onDoubleClick={() => handleEntryDoubleClick(entry)}
                      onContextMenu={(e) => handleContextMenu(e, entry, column.path, entries)}
                      className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer text-xs mb-0.5 transition-colors ${
                        isSelected
                          ? 'bg-accent text-white font-medium shadow-sm'
                          : 'hover:bg-surface text-foreground/90'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate flex-1 mr-1">
                        {getEntryIcon(entry)}
                        {isRenaming ? (
                          <input
                            type="text"
                            value={renameValue}
                            autoFocus
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={() => handleFinishRename(entry, colIdx)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleFinishRename(entry, colIdx);
                              if (e.key === 'Escape') setRenamingPath(null);
                            }}
                            className="bg-background text-foreground border border-primary px-1 py-0.5 rounded text-xs outline-none w-full"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span className="truncate">{entry.name}</span>
                        )}
                      </div>
                      {entry.isDir && !isRenaming && (
                        <ChevronRight
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isSelected ? 'text-white' : 'text-muted/60 group-hover:text-muted'
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        );
      })}

      {/* Right Click Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          entry={contextMenu.entry}
          currentDir={contextMenu.currentDir}
          tabId={tabId}
          entries={contextMenu.entries}
          onClose={() => setContextMenu(null)}
          onRenameRequest={handleStartRename}
        />
      )}
    </div>
  );
};
