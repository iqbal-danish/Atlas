import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../api';
import { RecycleBinEntry } from '../types';
import {
  Trash2,
  RotateCcw,
  RefreshCw,
  Folder,
  FileText,
  FileCode,
  FileImage,
  Search,
  ExternalLink,
  AlertTriangle,
  Loader2,
  HardDrive,
} from 'lucide-react';

interface RecycleBinViewProps {
  tabId: string;
}

export const RecycleBinView: React.FC<RecycleBinViewProps> = () => {
  const [items, setItems] = useState<RecycleBinEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await api.listRecycleBin();
      setItems(data);
      setSelectedPaths([]);
    } catch (err) {
      console.error('Failed to load recycle bin:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const filteredItems = useMemo(() => {
    if (!searchFilter.trim()) return items;
    const q = searchFilter.toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.originalPath.toLowerCase().includes(q)
    );
  }, [items, searchFilter]);

  const handleSelectAll = () => {
    if (selectedPaths.length === filteredItems.length) {
      setSelectedPaths([]);
    } else {
      setSelectedPaths(filteredItems.map((i) => i.id));
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPaths((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleRestoreSelected = async () => {
    if (selectedPaths.length === 0) return;
    setActionInProgress('Restoring selected items...');
    try {
      for (const id of selectedPaths) {
        await api.restoreRecycleBinItem(id);
      }
      await loadItems();
    } catch (err) {
      console.error('Restore error:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedPaths.length === 0) return;
    setActionInProgress('Deleting selected items permanently...');
    try {
      for (const id of selectedPaths) {
        await api.deleteRecycleBinItem(id);
      }
      await loadItems();
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRestoreAll = async () => {
    setActionInProgress('Restoring all items...');
    try {
      await api.restoreAllRecycleBin();
      await loadItems();
    } catch (err) {
      console.error('Restore all error:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleEmptyBin = async () => {
    setConfirmEmpty(false);
    setActionInProgress('Emptying Recycle Bin...');
    try {
      await api.emptyRecycleBin();
      await loadItems();
    } catch (err) {
      console.error('Empty bin error:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  const getEntryIcon = (item: RecycleBinEntry) => {
    if (item.isDir) return <Folder className="w-4 h-4 text-blue-400 shrink-0" />;
    const ext = item.name.split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) {
      return <FileImage className="w-4 h-4 text-purple-400 shrink-0" />;
    }
    if (['ts', 'tsx', 'js', 'jsx', 'json', 'rs', 'py', 'html', 'css'].includes(ext)) {
      return <FileCode className="w-4 h-4 text-emerald-400 shrink-0" />;
    }
    return <FileText className="w-4 h-4 text-muted shrink-0" />;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden select-none">
      {/* Top Banner Toolbar */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-border bg-sidebar/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <Trash2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground flex items-center gap-2">
              Recycle Bin
              <span className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border text-muted font-normal">
                {items.length} {items.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <div className="text-[11px] text-muted">
              Manage deleted items, restore them to their original location, or permanently purge them
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <div className="relative mr-2">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter deleted files..."
              className="bg-surface border border-border rounded-md pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted focus:outline-none focus:border-accent w-52"
            />
          </div>

          <button
            onClick={loadItems}
            disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-surface hover:bg-surface-active text-muted hover:text-foreground text-xs font-medium transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {selectedPaths.length > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleRestoreSelected}
                disabled={!!actionInProgress}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-white hover:bg-accent/90 text-xs font-medium shadow-sm transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restore Selected ({selectedPaths.length})
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={!!actionInProgress}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 text-xs font-medium shadow-sm transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Permanently ({selectedPaths.length})
              </button>
            </div>
          )}

          {items.length > 0 && selectedPaths.length === 0 && (
            <button
              onClick={handleRestoreAll}
              disabled={!!actionInProgress}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-surface hover:bg-surface-active text-foreground text-xs font-medium transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restore All
            </button>
          )}

          {items.length > 0 && (
            <button
              onClick={() => setConfirmEmpty(true)}
              disabled={!!actionInProgress}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Empty Recycle Bin
            </button>
          )}

          <button
            onClick={() => api.openRecycleBin()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-surface hover:bg-surface-active text-muted hover:text-foreground text-xs transition-colors"
            title="Open native Windows Explorer Recycle Bin folder"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            OS Window
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Emptying */}
      {confirmEmpty && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">Empty Recycle Bin?</h3>
                <p className="text-xs text-muted mt-0.5">
                  Are you sure you want to permanently delete all items in the Recycle Bin? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => setConfirmEmpty(false)}
                className="px-3 py-1.5 rounded-md text-xs font-medium border border-border hover:bg-surface-active text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleEmptyBin}
                className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-red-500 hover:bg-red-600 text-white shadow-sm"
              >
                Empty Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-progress status banner */}
      {actionInProgress && (
        <div className="bg-accent/10 border-b border-accent/20 px-6 py-2 flex items-center gap-2 text-xs text-accent">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>{actionInProgress}</span>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
            <span className="text-xs">Reading deleted items from Windows Recycle Bin...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-80 text-muted gap-3 text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center text-muted/50 mb-1">
              <Trash2 className="w-8 h-8" />
            </div>
            <div className="text-sm font-medium text-foreground">
              {searchFilter ? 'No matching deleted files found' : 'The Recycle Bin is empty'}
            </div>
            <p className="text-xs text-muted max-w-sm">
              {searchFilter
                ? 'Try a different search term.'
                : 'Files and folders deleted from your drives will appear here until they are permanently removed.'}
            </p>
          </div>
        ) : (
          <div className="border border-border rounded-lg bg-surface/40 overflow-hidden shadow-xs">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-2.5 bg-surface/80 border-b border-border text-[11px] font-semibold text-muted uppercase tracking-wider items-center">
              <div className="col-span-5 flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedPaths.length === filteredItems.length && filteredItems.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-border accent-accent cursor-pointer"
                />
                <span>Name</span>
              </div>
              <div className="col-span-4">Original Location</div>
              <div className="col-span-2">Date Deleted</div>
              <div className="col-span-1 text-right">Size</div>
            </div>

            {/* Item Rows */}
            <div className="divide-y divide-border/60">
              {filteredItems.map((item) => {
                const isSelected = selectedPaths.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={(e) => toggleSelect(item.id, e)}
                    className={`grid grid-cols-12 gap-4 px-4 py-2 text-xs items-center cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-accent/15 text-foreground font-medium'
                        : 'hover:bg-surface text-foreground/90'
                    }`}
                  >
                    <div className="col-span-5 flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleSelect(item.id, e as any);
                        }}
                        className="rounded border-border accent-accent cursor-pointer"
                      />
                      {getEntryIcon(item)}
                      <span className="truncate" title={item.name}>
                        {item.name}
                      </span>
                    </div>

                    <div className="col-span-4 truncate text-muted text-[11px] flex items-center gap-1.5" title={item.originalPath}>
                      <HardDrive className="w-3 h-3 text-muted/60 shrink-0" />
                      <span className="truncate">{item.originalPath}</span>
                    </div>

                    <div className="col-span-2 text-muted text-[11px] whitespace-nowrap">
                      {item.dateDeleted || 'Unknown'}
                    </div>

                    <div className="col-span-1 text-right text-muted text-[11px]">
                      {item.isDir ? '--' : formatBytes(item.size)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
