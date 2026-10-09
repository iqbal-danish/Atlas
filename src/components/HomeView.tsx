import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { FsEntry } from '../types';
import { api } from '../api';
import {
  FileText,
  Clock,
  Star,
  Share2,
  FileSpreadsheet,
  FileCode,
  Image,
  File,
  Sparkles,
  ExternalLink,
  Pin,
} from 'lucide-react';
import { ContextMenu } from './ContextMenu';
import { FolderIcon, FolderIconName } from './FolderIcon';

interface HomeViewProps {
  tabId: string;
}

interface QuickFolder {
  id: string;
  name: string;
  path: string;
  iconName: FolderIconName;
}

export const HomeView: React.FC<HomeViewProps> = ({ tabId }) => {
  const {
    navigateTab,
    setSelectedEntry,
    systemFolders,
  } = useAppStore();

  const [activeSubTab, setActiveSubTab] = useState<'recent' | 'favorites' | 'shared'>('recent');
  const [recentEntries, setRecentEntries] = useState<FsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    entry: FsEntry;
    currentDir: string;
    entries: FsEntry[];
  } | null>(null);

  // Dynamic Quick Access folders resolved from Windows
  const quickFolders: QuickFolder[] = [
    {
      id: 'desktop',
      name: 'Desktop',
      path: systemFolders?.desktop || 'C:\\Users\\diqbal\\Desktop',
      iconName: 'desktop',
    },
    {
      id: 'downloads',
      name: 'Downloads',
      path: systemFolders?.downloads || 'C:\\Users\\diqbal\\Downloads',
      iconName: 'downloads',
    },
    {
      id: 'documents',
      name: 'Documents',
      path: systemFolders?.documents || 'C:\\Users\\diqbal\\Documents',
      iconName: 'documents',
    },
    {
      id: 'pictures',
      name: 'Pictures',
      path: systemFolders?.pictures || 'C:\\Users\\diqbal\\Pictures',
      iconName: 'pictures',
    },
    {
      id: 'music',
      name: 'Music',
      path: systemFolders?.music || 'C:\\Users\\diqbal\\Music',
      iconName: 'music',
    },
    {
      id: 'videos',
      name: 'Videos',
      path: systemFolders?.videos || 'C:\\Users\\diqbal\\Videos',
      iconName: 'videos',
    },
  ];

  // Stable string dependencies to prevent any blinking or infinite fetch loops
  const documentsPath = systemFolders?.documents;
  const downloadsPath = systemFolders?.downloads;
  const desktopPath = systemFolders?.desktop;

  useEffect(() => {
    let mounted = true;
    const fetchRecentItems = async () => {
      setLoading(true);
      const scanDirs = [
        downloadsPath,
        documentsPath,
        desktopPath,
      ].filter(Boolean) as string[];

      if (scanDirs.length === 0) {
        scanDirs.push('C:\\Users\\diqbal\\Downloads', 'C:\\Users\\diqbal\\Documents');
      }

      const collected: FsEntry[] = [];
      for (const dir of scanDirs) {
        try {
          const listing = await api.readDirectory(dir, false);
          if (listing.isReadable && listing.entries) {
            const files = listing.entries.slice(0, 15);
            collected.push(...files);
          }
        } catch (e) {
          // ignore directory access errors
        }
      }

      if (mounted) {
        collected.sort((a, b) => (b.modifiedTime || 0) - (a.modifiedTime || 0));
        setRecentEntries(collected);
        setLoading(false);
      }
    };

    fetchRecentItems();
    return () => {
      mounted = false;
    };
  }, [documentsPath, downloadsPath, desktopPath]);

  const getFileIcon = (entry: FsEntry) => {
    if (entry.isDir) {
      return <FolderIcon name="default" size={20} />;
    }
    const ext = entry.extension?.toLowerCase() || '';
    if (['xlsx', 'xls', 'csv'].includes(ext)) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-400 shrink-0" />;
    }
    if (['docx', 'doc', 'txt', 'rtf', 'pdf'].includes(ext)) {
      return <FileText className="w-5 h-5 text-blue-400 shrink-0" />;
    }
    if (['json', 'js', 'ts', 'tsx', 'rs', 'py', 'html', 'css', 'sql'].includes(ext)) {
      return <FileCode className="w-5 h-5 text-purple-400 shrink-0" />;
    }
    if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'ico'].includes(ext)) {
      return <Image className="w-5 h-5 text-amber-400 shrink-0" />;
    }
    return <File className="w-5 h-5 text-muted shrink-0" />;
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'Recent';
    const date = new Date(timestamp * 1000);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${mins}`;
  };

  const getParentFolderName = (path: string) => {
    const parts = path.split('\\').filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 2] : 'Local Disk';
  };

  const handleRowClick = (entry: FsEntry) => {
    setSelectedPath(entry.path);
    setSelectedEntry(tabId, entry, false);
  };

  const handleRowDoubleClick = (entry: FsEntry) => {
    if (entry.isDir) {
      navigateTab(tabId, entry.path);
    } else {
      api.openFile(entry.path).catch(console.error);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, entry: FsEntry) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedPath(entry.path);
    setSelectedEntry(tabId, entry, false);
    const parentDir = entry.path.substring(0, entry.path.lastIndexOf('\\')) || 'C:\\';
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      entry,
      currentDir: parentDir,
      entries: recentEntries,
    });
  };

  const recommendedItems = recentEntries.slice(0, 4);

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto select-none text-xs">
      {/* 1. Quick Access Pinned Folders (AtlasX Fluent Icons Style) */}
      <div className="p-6 pb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-3">
          <Pin className="w-4 h-4 text-accent rotate-45" />
          <span>Quick access</span>
        </div>

        <div className="grid grid-cols-6 gap-3">
          {quickFolders.map((folder) => (
            <div
              key={folder.id}
              onClick={() => navigateTab(tabId, folder.path)}
              className="p-3 rounded-xl bg-surface/40 hover:bg-surface transition-all cursor-pointer flex flex-col items-center justify-center gap-2 h-26 group hover:-translate-y-0.5"
              title={`Open ${folder.name} (${folder.path})`}
            >
              <div className="group-hover:scale-110 transition-transform duration-200">
                <FolderIcon name={folder.iconName} size={42} />
              </div>
              <span className="font-medium text-foreground truncate text-xs group-hover:text-accent transition-colors">
                {folder.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Recommended Section (Matching Windows 11 Explorer Home) */}
      <div className="p-6 pt-2 pb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-3">
          <Sparkles className="w-4 h-4 text-accent" />
          <span>Recommended</span>
        </div>

        {recommendedItems.length === 0 && !loading ? (
          <div className="p-4 rounded-lg bg-surface/30 text-muted text-center text-xs">
            No recently opened items. Browse files to see recommended items here.
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {recommendedItems.map((item) => (
              <div
                key={item.path}
                onClick={() => handleRowClick(item)}
                onDoubleClick={() => handleRowDoubleClick(item)}
                onContextMenu={(e) => handleContextMenu(e, item)}
                className={`p-3 rounded-xl transition-all cursor-pointer flex flex-col justify-between h-28 group ${
                  selectedPath === item.path
                    ? 'bg-surface-active shadow-sm'
                    : 'bg-surface/40 hover:bg-surface'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-lg bg-surface/80 shrink-0 group-hover:scale-105 transition-transform">
                    {getFileIcon(item)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate text-xs" title={item.name}>
                      {item.name}
                    </div>
                    <div className="text-[10px] text-muted truncate mt-0.5">
                      {getParentFolderName(item.path)}
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-muted flex items-center justify-between border-t border-white/[0.04] pt-1.5">
                  <span>{formatDate(item.modifiedTime)}</span>
                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-accent" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Filter Tabs: Recent | Favorites | Shared */}
      <div className="px-6 pt-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <button
            onClick={() => setActiveSubTab('recent')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              activeSubTab === 'recent'
                ? 'bg-accent text-accent-foreground shadow-sm'
                : 'text-muted hover:text-foreground hover:bg-surface'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Recent
          </button>

          <button
            onClick={() => setActiveSubTab('favorites')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              activeSubTab === 'favorites'
                ? 'bg-accent text-accent-foreground shadow-sm'
                : 'text-muted hover:text-foreground hover:bg-surface'
            }`}
          >
            <Star className="w-3.5 h-3.5" />
            Favorites
          </button>

          <button
            onClick={() => setActiveSubTab('shared')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              activeSubTab === 'shared'
                ? 'bg-accent text-accent-foreground shadow-sm'
                : 'text-muted hover:text-foreground hover:bg-surface'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            Shared
          </button>
        </div>
      </div>

      {/* 4. Detailed Items Table */}
      <div className="flex-1 px-6 py-2 overflow-y-auto">
        <div className="w-full text-left">
          {/* Table Header */}
          <div className="grid grid-cols-12 px-3 py-2 text-[11px] font-semibold text-muted border-b border-border">
            <div className="col-span-6">Name</div>
            <div className="col-span-3">Date accessed</div>
            <div className="col-span-3">Location / Activity</div>
          </div>

          {/* Table Body */}
          {loading ? (
            <div className="py-8 text-center text-muted text-xs flex items-center justify-center gap-2">
              <Clock className="w-4 h-4 animate-spin text-accent" />
              Loading home items...
            </div>
          ) : recentEntries.length === 0 ? (
            <div className="py-8 text-center text-muted text-xs italic">
              No files to display in this view.
            </div>
          ) : (
            <div className="flex flex-col py-1">
              {recentEntries.map((entry) => {
                const isSelected = selectedPath === entry.path;
                const parentFolder = getParentFolderName(entry.path);

                return (
                  <div
                    key={entry.path}
                    onClick={() => handleRowClick(entry)}
                    onDoubleClick={() => handleRowDoubleClick(entry)}
                    onContextMenu={(e) => handleContextMenu(e, entry)}
                    className={`grid grid-cols-12 items-center px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-surface-active text-foreground font-medium'
                        : 'hover:bg-surface text-muted hover:text-foreground'
                    }`}
                  >
                    {/* Name column */}
                    <div className="col-span-6 flex items-center gap-2.5 min-w-0 pr-2">
                      {getFileIcon(entry)}
                      <div className="min-w-0">
                        <div className="text-xs text-foreground truncate" title={entry.name}>
                          {entry.name}
                        </div>
                        <div className="text-[10px] text-muted truncate">
                          {parentFolder}
                        </div>
                      </div>
                    </div>

                    {/* Date accessed */}
                    <div className="col-span-3 text-[11px] text-muted">
                      {formatDate(entry.modifiedTime)}
                    </div>

                    {/* Location / Activity */}
                    <div className="col-span-3 text-[11px] text-muted truncate flex items-center gap-1.5">
                      <FolderIcon name="default" size={14} />
                      <span className="truncate" title={entry.path}>
                        {parentFolder}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Context Menu on Right Click */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          entry={contextMenu.entry}
          currentDir={contextMenu.currentDir}
          entries={contextMenu.entries}
          tabId={tabId}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};
