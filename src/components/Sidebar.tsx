import React, { useState } from 'react';
import { useAppStore } from '../store';
import { api } from '../api';
import { FsEntry } from '../types';
import {
  HardDrive,
  Home,
  Trash2,
  ChevronRight,
  ChevronDown,
  Layers,
  Cloud,
  Loader2,
} from 'lucide-react';
import { FolderIcon, FolderIconName } from './FolderIcon';

interface SidebarProps {
  tabId: string;
}

// Recursive Folder Tree Node component allowing arbitrary depth expansion
const FolderTreeNode: React.FC<{
  folder: FsEntry;
  tabId: string;
  depth?: number;
}> = ({ folder, tabId, depth = 0 }) => {
  const { tabs, navigateTab } = useAppStore();
  const currentTab = tabs.find((t) => t.id === tabId);
  const isSelected = currentTab?.path === folder.path;

  const [isExpanded, setIsExpanded] = useState(false);
  const [subfolders, setSubfolders] = useState<FsEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleExpand = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isExpanded && subfolders === null) {
      setLoading(true);
      try {
        const listing = await api.readDirectory(folder.path, false);
        const dirs = listing.entries.filter((entry) => entry.isDir);
        setSubfolders(dirs);
      } catch (err) {
        console.error('Failed to load subfolders:', err);
        setSubfolders([]);
      } finally {
        setLoading(false);
      }
    }
    setIsExpanded(!isExpanded);
  };

  const handleFolderClick = () => {
    navigateTab(tabId, folder.path);
  };

  return (
    <div className="flex flex-col">
      <div
        onClick={handleFolderClick}
        className={`flex items-center gap-1.5 py-1 px-1.5 rounded-md cursor-pointer transition-colors text-[11px] group ${
          isSelected
            ? 'bg-surface-active text-foreground font-semibold shadow-xs'
            : 'hover:bg-surface text-muted hover:text-foreground'
        }`}
        title={folder.path}
      >
        <button
          onClick={toggleExpand}
          className="p-0.5 hover:bg-surface-active rounded text-muted hover:text-foreground shrink-0 transition-transform"
          title={isExpanded ? 'Collapse' : 'Expand'}
        >
          {loading ? (
            <Loader2 className="w-3 h-3 animate-spin text-accent" />
          ) : isExpanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3 text-muted/60 group-hover:text-foreground" />
          )}
        </button>

        <FolderIcon name="default" size={16} />
        <span className="truncate flex-1">{folder.name}</span>
      </div>

      {isExpanded && (
        <div className="pl-3.5 border-l border-border/50 ml-2.5 my-0.5 flex flex-col gap-0.5">
          {subfolders && subfolders.length === 0 ? (
            <div className="text-[10px] text-muted/60 italic py-0.5 pl-2">No subfolders</div>
          ) : (
            subfolders?.map((sub) => (
              <FolderTreeNode
                key={sub.path}
                folder={sub}
                tabId={tabId}
                depth={depth + 1}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ tabId }) => {
  const {
    drives,
    systemFolders,
    navigateTab,
    openRecycleBinTab,
    tabs,
    dropZoneFiles,
    clearDropZone,
    setViewMode,
  } = useAppStore();

  const currentTab = tabs.find((t) => t.id === tabId);

  const [expandedDrives, setExpandedDrives] = useState<Record<string, boolean>>({});
  const [driveFolders, setDriveFolders] = useState<Record<string, FsEntry[]>>({});

  const toggleExpandDrive = async (e: React.MouseEvent, mountPoint: string) => {
    e.stopPropagation();
    const isExpanded = !!expandedDrives[mountPoint];
    setExpandedDrives((prev) => ({ ...prev, [mountPoint]: !isExpanded }));

    if (!isExpanded && !driveFolders[mountPoint]) {
      try {
        const listing = await api.readDirectory(mountPoint, false);
        const subdirs = listing.entries.filter((entry) => entry.isDir);
        setDriveFolders((prev) => ({ ...prev, [mountPoint]: subdirs }));
      } catch (err) {
        console.error('Failed to load drive folders:', err);
      }
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const quickLinks: Array<{ name: string; path: string; iconName: FolderIconName }> = [
    {
      name: 'Desktop',
      path: systemFolders?.desktop || 'C:\\Users\\diqbal\\Desktop',
      iconName: 'desktop',
    },
    {
      name: 'Downloads',
      path: systemFolders?.downloads || 'C:\\Users\\diqbal\\Downloads',
      iconName: 'downloads',
    },
    {
      name: 'Documents',
      path: systemFolders?.documents || 'C:\\Users\\diqbal\\Documents',
      iconName: 'documents',
    },
    {
      name: 'Pictures',
      path: systemFolders?.pictures || 'C:\\Users\\diqbal\\Pictures',
      iconName: 'pictures',
    },
    {
      name: 'Music',
      path: systemFolders?.music || 'C:\\Users\\diqbal\\Music',
      iconName: 'music',
    },
    {
      name: 'Videos',
      path: systemFolders?.videos || 'C:\\Users\\diqbal\\Videos',
      iconName: 'videos',
    },
  ];

  return (
    <div className="w-64 bg-sidebar border-r border-border flex flex-col h-full select-none text-xs overflow-y-auto">
      {/* 1. Windows Explorer-Style Home & In-App Recycle Bin */}
      <div className="p-3 pb-2 flex flex-col gap-0.5 border-b border-border/50 shrink-0">
        <div
          onClick={() => navigateTab(tabId, 'home')}
          className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
            currentTab?.path === 'home' || currentTab?.viewMode === 'home'
              ? 'bg-surface-active text-foreground font-semibold shadow-xs'
              : 'hover:bg-surface text-muted hover:text-foreground'
          }`}
        >
          <Home className={`w-4 h-4 ${currentTab?.path === 'home' ? 'text-accent' : 'text-blue-400'}`} />
          <span className="text-xs">Home</span>
        </div>

        <div
          onClick={() => openRecycleBinTab(tabId)}
          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
            currentTab?.viewMode === 'recycle-bin'
              ? 'bg-surface-active text-foreground font-semibold shadow-xs'
              : 'text-muted hover:text-foreground hover:bg-surface'
          }`}
          title="Open In-App Windows Recycle Bin"
        >
          <div className="flex items-center gap-2.5">
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span className="text-xs">Recycle Bin</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-muted">
            In-App
          </span>
        </div>

        <div
          onClick={() => {
            navigateTab(tabId, 'serverdock://');
            setViewMode(tabId, 'serverdock');
          }}
          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
            currentTab?.viewMode === 'serverdock' || currentTab?.path === 'serverdock://'
              ? 'bg-blue-600/20 text-blue-400 font-semibold shadow-xs border border-blue-500/30'
              : 'text-muted hover:text-foreground hover:bg-surface'
          }`}
          title="Open Remote & Cloud SFTP/FTP Workspace"
        >
          <div className="flex items-center gap-2.5">
            <Cloud className="w-4 h-4 text-blue-400" />
            <span className="text-xs">Remote & Cloud</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-medium">
            SFTP/FTP
          </span>
        </div>
      </div>

      {/* 2. Expandable Tree Drives Section ("This PC") */}
      <div className="p-3 pb-2 border-b border-border/50 shrink-0">
        <div className="text-[10px] uppercase font-semibold text-muted tracking-wider mb-2 flex items-center justify-between">
          <span>This PC / Drives</span>
          <span className="text-[10px] text-muted">{drives.length}</span>
        </div>
        <div className="flex flex-col gap-1">
          {drives.map((drive) => {
            const isSelected = currentTab?.path.startsWith(drive.mountPoint);
            const isExpanded = !!expandedDrives[drive.mountPoint];
            const folders = driveFolders[drive.mountPoint] || [];
            const percentUsed =
              drive.totalBytes > 0
                ? Math.round(((drive.totalBytes - drive.availableBytes) / drive.totalBytes) * 100)
                : 0;

            return (
              <div key={drive.mountPoint} className="flex flex-col">
                <div
                  onClick={() => {
                    navigateTab(tabId, drive.mountPoint);
                    setViewMode(tabId, 'list');
                  }}
                  className={`flex flex-col gap-1 p-2 rounded-lg cursor-pointer transition-colors ${
                    isSelected ? 'bg-surface-active text-foreground' : 'hover:bg-surface text-muted hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        onClick={(e) => toggleExpandDrive(e, drive.mountPoint)}
                        className="p-0.5 hover:bg-surface-active rounded text-muted hover:text-foreground transition-transform"
                        title={isExpanded ? 'Collapse' : 'Expand Folders'}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <HardDrive className={`w-4 h-4 shrink-0 ${isSelected ? 'text-accent' : 'text-blue-400'}`} />
                      <span className="font-medium truncate">{drive.volumeLabel}</span>
                    </div>
                  </div>

                  {drive.totalBytes > 0 && (
                    <div className="flex flex-col gap-0.5 pl-6">
                      <div className="w-full bg-border h-1 rounded-full overflow-hidden">
                        <div
                          className="bg-accent h-full rounded-full transition-all"
                          style={{ width: `${percentUsed}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-muted">
                        {formatBytes(drive.availableBytes)} free of {formatBytes(drive.totalBytes)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Recursive Subfolder Tree Node Expansion */}
                {isExpanded && (
                  <div className="pl-4 pr-1 py-1 flex flex-col gap-0.5 border-l border-border/60 ml-3.5 my-1">
                    {folders.length === 0 ? (
                      <div className="text-[10px] text-muted italic p-1">No accessible subfolders</div>
                    ) : (
                      folders.map((folder) => (
                        <FolderTreeNode
                          key={folder.path}
                          folder={folder}
                          tabId={tabId}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Quick Access Favorites */}
      <div className="p-3 shrink-0">
        <div className="text-[10px] uppercase font-semibold text-muted tracking-wider mb-2">
          Favorites
        </div>
        <div className="flex flex-col gap-0.5">
          {quickLinks.map((link) => {
            const isSelected = currentTab?.path === link.path;
            return (
              <div
                key={link.path}
                onClick={() => {
                  navigateTab(tabId, link.path);
                  setViewMode(tabId, 'list');
                }}
                className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                  isSelected ? 'bg-surface-active text-foreground font-medium' : 'hover:bg-surface text-muted hover:text-foreground'
                }`}
                title={link.path}
              >
                <FolderIcon name={link.iconName} size={18} />
                <span className="truncate">{link.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Drop Zone Stash Area (Atlas Feature) */}
      <div className="mt-auto p-3 border-t border-border bg-surface/30 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1 text-[10px] uppercase font-semibold text-accent tracking-wider">
            <Layers className="w-3 h-3" />
            Drop Zone
          </div>
          {dropZoneFiles.length > 0 && (
            <button
              onClick={clearDropZone}
              className="text-[10px] text-muted hover:text-foreground hover:underline"
            >
              Clear
            </button>
          )}
        </div>
        {dropZoneFiles.length === 0 ? (
          <div className="text-[11px] text-muted/70 italic border border-dashed border-border p-2 rounded text-center">
            Drop or stage files here for multi-destination movement
          </div>
        ) : (
          <div className="flex flex-col gap-1 max-h-24 overflow-y-auto">
            {dropZoneFiles.map((p) => (
              <div key={p} className="text-[10px] truncate bg-surface px-1.5 py-0.5 rounded text-foreground">
                {p.split('\\').pop()}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
