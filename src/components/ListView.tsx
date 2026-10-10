import React, { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '../store';
import {
  Folder,
  FileText,
  FileCode,
  FileImage,
  ArrowUpDown,
  Archive,
  Columns3,
  Copy,
  Eye,
  Check,
  HardDrive,
  Monitor,
  ChevronRight,
  Trash2,
  Settings,
  User,
  Database,
  Search,
  FileSpreadsheet,
  Music,
  Video,
} from 'lucide-react';
import { api } from '../api';
import { FsEntry } from '../types';
import { ContextMenu } from './ContextMenu';

interface ListViewProps {
  tabId: string;
}

type SortField = 'name' | 'size' | 'modifiedTime' | 'extension';
type SortOrder = 'asc' | 'desc';
type FilterCategory = 'all' | 'folders' | 'files';

export const ListView: React.FC<ListViewProps> = ({ tabId }) => {
  const {
    tabs,
    drives,
    showHiddenFiles,
    searchQuery,
    setSelectedEntry,
    navigateTab,
    setViewMode,
    togglePreviewPanel,
    previewPanelOpen,
  } = useAppStore();

  const currentTab = tabs.find((t) => t.id === tabId);

  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Filter category & inline filter query
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');
  const [inlineFilter, setInlineFilter] = useState('');
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    entry?: FsEntry;
    currentDir: string;
    entries: FsEntry[];
  } | null>(null);

  // Inline rename
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');

  const loadDir = () => {
    if (!currentTab?.path) return;
    setLoading(true);
    api
      .readDirectory(currentTab.path, showHiddenFiles)
      .then((listing) => {
        setEntries(listing.entries);
      })
      .catch((err) => {
        console.error('List view read error:', err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDir();
  }, [currentTab?.path, showHiddenFiles]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Filter with search query, inline filter, category, and tab filterPattern
  let filtered = [...entries];

  if (filterCategory === 'folders') {
    filtered = filtered.filter((e) => e.isDir);
  } else if (filterCategory === 'files') {
    filtered = filtered.filter((e) => !e.isDir);
  }

  const activeSearch = inlineFilter || searchQuery;
  if (activeSearch) {
    const q = activeSearch.toLowerCase();
    filtered = filtered.filter((e) => e.name.toLowerCase().includes(q));
  }

  if (currentTab?.filterPattern) {
    const pat = currentTab.filterPattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    try {
      const rx = new RegExp(`^${pat}$`, 'i');
      filtered = filtered.filter((e) => rx.test(e.name));
    } catch {
      filtered = filtered.filter((e) =>
        e.name.toLowerCase().includes(currentTab.filterPattern!.toLowerCase())
      );
    }
  }

  const sortedEntries = filtered.sort((a, b) => {
    // Keep folders on top
    if (a.isDir !== b.isDir) {
      return b.isDir ? 1 : -1;
    }

    let comparison = 0;
    if (sortField === 'name') {
      comparison = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    } else if (sortField === 'size') {
      comparison = (a.size || 0) - (b.size || 0);
    } else if (sortField === 'modifiedTime') {
      comparison = (a.modifiedTime || 0) - (b.modifiedTime || 0);
    } else if (sortField === 'extension') {
      comparison = (a.extension || '').localeCompare(b.extension || '');
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '--';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '--';
    return new Date(timestamp * 1000).toLocaleString();
  };

  // Option B style descriptive "Kind"
  const getEntryKind = (entry: FsEntry): string => {
    if (entry.isDir) {
      const nameLower = entry.name.toLowerCase();
      if (nameLower === '$recycle.bin' || nameLower === 'recycle bin') return 'System Folder';
      if (nameLower === 'windows' || nameLower === 'system32') return 'System Folder';
      if (nameLower.startsWith('program files') || nameLower === 'programdata') return 'Application Folder';
      if (nameLower === 'users') return 'User Directory';
      if (nameLower === 'perflogs') return 'Log Folder';
      return 'Folder';
    }
    const ext =
      entry.extension?.toLowerCase() ||
      (entry.name.includes('.') ? entry.name.split('.').pop()?.toLowerCase() : '') ||
      '';
    if (!ext) return 'Document';

    switch (ext) {
      case 'xml': case 'xsl': case 'xslt': return 'XML Document';
      case 'json': case 'json5': case 'jsonc': return 'JSON Document';
      case 'pdf': return 'PDF Document';
      case 'csv': return 'CSV Document';
      case 'xls': case 'xlsx': return 'Excel Spreadsheet';
      case 'doc': case 'docx': return 'Word Document';
      case 'ppt': case 'pptx': return 'PowerPoint Presentation';
      case 'txt': return 'Plain Text Document';
      case 'md': return 'Markdown Document';
      case 'log': return 'Log Document';
      case 'sql': return 'SQL Database Script';
      case 'yaml': case 'yml': return 'YAML Document';
      case 'dll': return 'Dynamic Library';
      case 'sys': return 'System File';
      case 'rdb': case 'db': case 'sqlite': case 'sqlite3': return 'Database File';
      case 'exe': return 'Executable Application';
      case 'msi': return 'Windows Installer Package';
      case 'cmd': case 'bat': case 'ps1': return 'Command Script';
      case 'zip': case 'rar': case '7z': case 'tar': case 'gz': return 'Compressed Archive';
      case 'png': case 'jpg': case 'jpeg': case 'gif': case 'webp': case 'svg': case 'ico': return 'Image File';
      case 'mp3': case 'wav': case 'flac': case 'm4a': return 'Audio File';
      case 'mp4': case 'mkv': case 'avi': case 'mov': return 'Video File';
      case 'ts': case 'tsx': case 'js': case 'jsx': return 'JavaScript/TypeScript Source';
      case 'py': return 'Python Source';
      case 'rs': return 'Rust Source';
      case 'c': case 'cpp': case 'h': case 'hpp': return 'C/C++ Source';
      case 'html': case 'css': return 'Web Document';
      case 'ini': case 'conf': case 'cfg': case 'toml': return 'Configuration File';
      default: return `${ext.toUpperCase()} File`;
    }
  };

  // High-Contrast Contextual Iconography
  const getEntryIcon = (entry: FsEntry) => {
    if (entry.isDir) {
      const nameLower = entry.name.toLowerCase();
      if (nameLower === '$recycle.bin' || nameLower === 'recycle bin') {
        return <Trash2 className="w-4 h-4 text-rose-400/90 shrink-0" />;
      }
      if (nameLower === 'windows') {
        return <Monitor className="w-4 h-4 text-sky-400/90 shrink-0" />;
      }
      if (nameLower.startsWith('program files') || nameLower === 'programdata') {
        return <Settings className="w-4 h-4 text-slate-400 shrink-0" />;
      }
      if (nameLower === 'users') {
        return <User className="w-4 h-4 text-slate-400 shrink-0" />;
      }
      return <Folder className="w-4 h-4 text-slate-400 shrink-0" />;
    }

    const ext = entry.extension?.toLowerCase() || '';

    // Archives (ZIP, RAR, 7Z, TAR, GZ) - Amber
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) {
      return <Archive className="w-4 h-4 text-amber-400 shrink-0" />;
    }

    // PDF Documents - Rose Red
    if (ext === 'pdf') {
      return <FileText className="w-4 h-4 text-rose-400 shrink-0" />;
    }

    // Spreadsheets & Tabular Data (Excel, CSV) - Emerald Green
    if (['xlsx', 'xls', 'csv', 'tsv'].includes(ext)) {
      return <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />;
    }

    // XML & Structured Markup - Warm Orange
    if (['xml', 'xsl', 'xslt', 'svg'].includes(ext)) {
      return <FileCode className="w-4 h-4 text-orange-400 shrink-0" />;
    }

    // JSON Data - Violet / Purple
    if (['json', 'json5', 'jsonc', 'yaml', 'yml', 'toml'].includes(ext)) {
      return <FileCode className="w-4 h-4 text-violet-400 shrink-0" />;
    }

    // Images - Bright Pink
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'ico'].includes(ext)) {
      return <FileImage className="w-4 h-4 text-pink-400 shrink-0" />;
    }

    // Code & Script Files - Electric Cyan / Sky
    if (['rs', 'ts', 'tsx', 'js', 'jsx', 'py', 'html', 'css', 'sql', 'cpp', 'c', 'h', 'hpp', 'java', 'go', 'php'].includes(ext)) {
      return <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />;
    }

    // Word & Rich Docs - Clean Blue
    if (['doc', 'docx', 'rtf', 'odt'].includes(ext)) {
      return <FileText className="w-4 h-4 text-blue-400 shrink-0" />;
    }

    // Audio Files - Fuchsia
    if (['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg'].includes(ext)) {
      return <Music className="w-4 h-4 text-fuchsia-400 shrink-0" />;
    }

    // Video Files - Indigo
    if (['mp4', 'mkv', 'avi', 'mov', 'wmv', 'webm'].includes(ext)) {
      return <Video className="w-4 h-4 text-indigo-400 shrink-0" />;
    }

    // System / Executables / Binaries - Slate / Cyan
    if (['dll', 'sys', 'rdb', 'exe', 'msi', 'bat', 'cmd', 'ps1', 'sh'].includes(ext)) {
      return <Database className="w-4 h-4 text-slate-400 shrink-0" />;
    }

    // Text & Logs - Slate Blue
    if (['txt', 'log', 'md', 'ini', 'cfg', 'conf'].includes(ext)) {
      return <FileText className="w-4 h-4 text-slate-300 shrink-0" />;
    }

    // Default File
    return <FileText className="w-4 h-4 text-slate-400 shrink-0" />;
  };

  // Breadcrumbs builder
  const breadcrumbs = useMemo(() => {
    const p = currentTab?.path || '';
    if (!p) return [];
    const normalized = p.replace(/\//g, '\\');
    const parts = normalized.split('\\').filter(Boolean);

    const crumbs: { name: string; fullPath: string }[] = [];
    let accum = '';

    parts.forEach((part, index) => {
      if (index === 0 && part.includes(':')) {
        accum = `${part}\\`;
        crumbs.push({ name: part, fullPath: accum });
      } else {
        accum = accum.endsWith('\\') ? `${accum}${part}` : `${accum}\\${part}`;
        crumbs.push({ name: part, fullPath: accum });
      }
    });
    return crumbs;
  }, [currentTab?.path]);

  // Active drive computation for telemetry footer
  const activeDrive = useMemo(() => {
    if (!currentTab?.path || !drives) return null;
    return drives.find((d) =>
      currentTab.path.toUpperCase().startsWith(d.mountPoint.toUpperCase())
    );
  }, [currentTab?.path, drives]);

  const handleCopyPath = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(path).then(() => {
      setCopiedPath(path);
      setTimeout(() => setCopiedPath(null), 1500);
    });
  };

  const handleQuickPreview = (e: React.MouseEvent, entry: FsEntry) => {
    e.stopPropagation();
    setSelectedEntry(tabId, entry, false);
    if (!previewPanelOpen) {
      togglePreviewPanel();
    }
  };

  const handleContextMenu = (e: React.MouseEvent, entry?: FsEntry) => {
    e.preventDefault();
    e.stopPropagation();

    if (entry) {
      setSelectedEntry(tabId, entry, false);
    }

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      entry,
      currentDir: currentTab?.path || 'C:\\',
      entries,
    });
  };

  const handleFinishRename = async (entry: FsEntry) => {
    if (!renameValue.trim() || renameValue === entry.name) {
      setRenamingPath(null);
      return;
    }
    try {
      await api.renameEntry(entry.path, renameValue.trim());
      setRenamingPath(null);
      loadDir();
    } catch (e) {
      alert(`Rename failed: ${e}`);
    }
  };

  const selectedCount = currentTab?.selectedPaths.length || 0;
  const usedDrivePercent = activeDrive
    ? Math.max(
        0,
        Math.min(
          100,
          Math.round(
            ((activeDrive.totalBytes - activeDrive.availableBytes) / activeDrive.totalBytes) * 100
          )
        )
      )
    : 0;

  return (
    <div
      onContextMenu={(e) => handleContextMenu(e)}
      className="flex-1 flex flex-col h-full bg-[#0f1016] text-slate-200 overflow-hidden select-none text-xs"
    >
      {/* Top Breadcrumb & Actions Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-[#141620] border-b border-white/[0.06] gap-2">
        {/* Clickable Breadcrumbs */}
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            onClick={() => {
              if (activeDrive) navigateTab(tabId, activeDrive.mountPoint);
            }}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/[0.05] transition shrink-0"
            title="Drive Root"
          >
            <HardDrive className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium text-[11px]">
              {activeDrive ? `${activeDrive.mountPoint}` : 'Root'}
            </span>
          </button>

          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={crumb.fullPath}>
                <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
                <button
                  onClick={() => navigateTab(tabId, crumb.fullPath)}
                  className={`px-2 py-0.5 rounded text-[11px] truncate max-w-[140px] transition ${
                    isLast
                      ? 'bg-white/[0.08] text-white font-semibold border border-white/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                  }`}
                  title={crumb.fullPath}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            );
          })}

          <span className="ml-1 text-[11px] text-slate-500 font-mono shrink-0">
            ({sortedEntries.length} items)
          </span>
        </div>

        {/* Filter Pills, Inline Search & View Switcher */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Category Filter Pills */}
          <div className="flex items-center bg-white/[0.04] p-0.5 rounded border border-white/[0.06] text-[11px]">
            <button
              onClick={() => setFilterCategory('all')}
              className={`px-2 py-0.5 rounded transition font-medium ${
                filterCategory === 'all'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterCategory('folders')}
              className={`px-2 py-0.5 rounded transition font-medium ${
                filterCategory === 'folders'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Folders
            </button>
            <button
              onClick={() => setFilterCategory('files')}
              className={`px-2 py-0.5 rounded transition font-medium ${
                filterCategory === 'files'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Files
            </button>
          </div>

          {/* Quick Filter Search */}
          <div className="relative">
            <input
              type="text"
              value={inlineFilter}
              onChange={(e) => setInlineFilter(e.target.value)}
              placeholder="Filter list..."
              className="bg-white/[0.04] border border-white/10 rounded px-2.5 py-0.5 pl-6 text-[11px] text-slate-200 placeholder-slate-500 outline-none focus:border-slate-400 transition w-32 focus:w-44"
            />
            <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1.5" />
          </div>

          {/* Columns View Button */}
          <button
            onClick={() => setViewMode(tabId, 'columns')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-300 hover:text-white transition"
            title="Switch to Miller Columns View"
          >
            <Columns3 className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px]">Columns</span>
          </button>
        </div>
      </div>

      {/* Titanium Table Header */}
      <div className="flex items-center px-4 py-2 border-b border-white/[0.06] bg-[#111219] text-[11px] font-semibold text-slate-400 uppercase tracking-wider select-none">
        <div
          onClick={() => handleSort('name')}
          className="flex-1 flex items-center gap-1.5 cursor-pointer hover:text-slate-200 transition"
        >
          <span>Name</span>
          {sortField === 'name' && <ArrowUpDown className="w-3 h-3 text-slate-300" />}
        </div>
        <div
          onClick={() => handleSort('modifiedTime')}
          className="w-44 flex items-center gap-1.5 cursor-pointer hover:text-slate-200 transition"
        >
          <span>Date modified</span>
          {sortField === 'modifiedTime' && <ArrowUpDown className="w-3 h-3 text-slate-300" />}
        </div>
        <div
          onClick={() => handleSort('extension')}
          className="w-40 flex items-center gap-1.5 cursor-pointer hover:text-slate-200 transition"
        >
          <span>Kind</span>
          {sortField === 'extension' && <ArrowUpDown className="w-3 h-3 text-slate-300" />}
        </div>
        <div
          onClick={() => handleSort('size')}
          className="w-28 text-right flex items-center justify-end gap-1.5 cursor-pointer hover:text-slate-200 transition"
        >
          <span>Size</span>
          {sortField === 'size' && <ArrowUpDown className="w-3 h-3 text-slate-300" />}
        </div>
      </div>

      {/* Table Rows Body */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="text-center py-16 text-slate-500 font-mono text-xs">Loading directory...</div>
        ) : sortedEntries.length === 0 ? (
          <div className="text-center py-16 text-slate-500/70 italic text-xs">No matching files in directory</div>
        ) : (
          sortedEntries.map((entry, index) => {
            const isSelected = currentTab?.selectedPaths.includes(entry.path);
            const isRenaming = renamingPath === entry.path;

            return (
              <div
                key={entry.path}
                onClick={(e) => setSelectedEntry(tabId, entry, e.ctrlKey || e.metaKey)}
                onDoubleClick={() => {
                  if (entry.isDir) {
                    navigateTab(tabId, entry.path);
                  } else {
                    api.openFile(entry.path).catch(console.error);
                  }
                }}
                onContextMenu={(e) => handleContextMenu(e, entry)}
                className={`group flex items-center px-4 py-1.5 cursor-pointer transition-colors border-b border-white/[0.025] ${
                  index % 2 === 1 ? 'bg-white/[0.012]' : ''
                } ${
                  isSelected
                    ? 'bg-white/[0.08] text-white font-medium border-l-2 border-slate-300 shadow-sm'
                    : 'hover:bg-white/[0.04] text-slate-200'
                }`}
              >
                {/* Name & Quick Action Rail */}
                <div className="flex-1 flex items-center gap-2.5 truncate pr-2 min-w-0">
                  {getEntryIcon(entry)}
                  {isRenaming ? (
                    <input
                      type="text"
                      value={renameValue}
                      autoFocus
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => handleFinishRename(entry)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleFinishRename(entry);
                        if (e.key === 'Escape') setRenamingPath(null);
                      }}
                      className="bg-black text-white border border-slate-400 px-1 py-0.5 rounded text-xs outline-none w-full max-w-sm"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="truncate">{entry.name}</span>
                  )}

                  {/* On-Hover Action Rail */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ml-auto shrink-0 pr-1">
                    <button
                      onClick={(e) => handleQuickPreview(e, entry)}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 text-[10px] flex items-center gap-1 transition"
                      title="Quick Preview (Space)"
                    >
                      <Eye className="w-3 h-3 text-slate-400" />
                      <span>Preview</span>
                    </button>
                    <button
                      onClick={(e) => handleCopyPath(e, entry.path)}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 text-[10px] flex items-center gap-1 transition"
                      title="Copy full path"
                    >
                      {copiedPath === entry.path ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-300">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-400" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Date Modified */}
                <div className="w-44 text-slate-400 font-mono truncate text-[11px]">
                  {formatDate(entry.modifiedTime)}
                </div>

                {/* Kind / Descriptive Type */}
                <div className="w-40 text-slate-400 truncate text-[11px]">
                  {getEntryKind(entry)}
                </div>

                {/* Size */}
                <div className="w-28 text-right text-slate-400 font-mono text-[11px] tabular-nums">
                  {entry.isDir ? (entry.itemCount ? `${entry.itemCount} items` : '--') : formatBytes(entry.size)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Titanium Storage & Telemetry Footer Bar (Eliminates the Empty Void) */}
      <div className="px-4 py-2 bg-[#0c0d12] border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-medium text-slate-300">
            <span className="w-2 h-2 rounded-full bg-slate-400 inline-block shadow-sm"></span>
            <span>
              {sortedEntries.length} items
              {selectedCount > 0 && ` (${selectedCount} selected)`}
            </span>
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Shortcuts: <kbd className="px-1 py-0.2 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] text-slate-300">Space</kbd> Preview &bull;{' '}
            <kbd className="px-1 py-0.2 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] text-slate-300">F2</kbd> Rename &bull;{' '}
            <kbd className="px-1 py-0.2 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] text-slate-300">Alt+P</kbd> Inspector
          </span>
        </div>

        {/* Disk Storage Telemetry Gauge */}
        {activeDrive && (
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-medium text-slate-400">
              {activeDrive.mountPoint} Storage
            </span>
            <div className="w-24 sm:w-32 h-1.5 rounded-full bg-white/10 overflow-hidden flex">
              <div
                className="bg-gradient-to-r from-slate-500 to-slate-300 h-full transition-all duration-300"
                style={{ width: `${usedDrivePercent}%` }}
                title={`Used: ${usedDrivePercent}%`}
              />
            </div>
            <span className="text-[11px] font-mono text-slate-300 font-medium">
              {formatBytes(activeDrive.availableBytes)} free of {formatBytes(activeDrive.totalBytes)}
            </span>
          </div>
        )}
      </div>

      {/* Right click menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          entry={contextMenu.entry}
          currentDir={contextMenu.currentDir}
          tabId={tabId}
          entries={contextMenu.entries}
          onClose={() => setContextMenu(null)}
          onRenameRequest={(entry) => {
            setRenamingPath(entry.path);
            setRenameValue(entry.name);
          }}
        />
      )}
    </div>
  );
};
