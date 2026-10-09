import React, { useState } from 'react';
import { useAppStore } from '../store';
import { api } from '../api';
import { DirSizeInfo, HashResult } from '../types';
import {
  X,
  Info,
  HardDrive,
  Calendar,
  FileCheck2,
  Copy,
  RefreshCw,
  Hash,
  ShieldAlert,
} from 'lucide-react';

export const PropertiesDialog: React.FC = () => {
  const { propertiesOpen, setPropertiesOpen, inspectingEntry, tabs, activeTabId } = useAppStore();
  const tab = tabs.find((t) => t.id === activeTabId);
  const entry = inspectingEntry || tab?.selectedEntry;

  const [dirSizeInfo, setDirSizeInfo] = useState<DirSizeInfo | null>(null);
  const [isCalculatingSize, setIsCalculatingSize] = useState(false);
  const [hashResult, setHashResult] = useState<HashResult | null>(null);
  const [isCalculatingHash, setIsCalculatingHash] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!propertiesOpen || !entry) return null;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatDate = (epochSec?: number) => {
    if (!epochSec) return 'Unknown';
    return new Date(epochSec * 1000).toLocaleString();
  };

  const handleCalculateDirSize = async () => {
    setIsCalculatingSize(true);
    try {
      const res = await api.calculateDirectorySize(entry.path);
      setDirSizeInfo(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsCalculatingSize(false);
    }
  };

  const handleCalculateHash = async () => {
    setIsCalculatingHash(true);
    try {
      const res = await api.calculateFileHash(entry.path, 'sha256');
      setHashResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsCalculatingHash(false);
    }
  };

  const handleCopyMetadata = () => {
    const meta = {
      name: entry.name,
      path: entry.path,
      type: entry.isDir ? 'Directory' : 'File',
      sizeBytes: entry.size,
      sizeFormatted: formatBytes(entry.size),
      modified: formatDate(entry.modifiedTime),
      created: formatDate(entry.createdTime),
      isReadOnly: entry.isReadonly,
      isHidden: entry.isHidden,
      sha256: hashResult?.hash,
      recursiveFolderSize: dirSizeInfo?.totalBytes,
    };
    navigator.clipboard.writeText(JSON.stringify(meta, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-sidebar/50">
          <div className="flex items-center gap-2 font-medium text-foreground text-sm">
            <Info className="w-4 h-4 text-accent" />
            <span>Properties: {entry.name}</span>
          </div>
          <button
            onClick={() => setPropertiesOpen(false)}
            className="p-1 rounded hover:bg-surface-hover text-muted hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[70vh] overflow-auto">
          {/* Main Info */}
          <div className="flex items-start gap-3 bg-background/50 border border-border/60 p-3 rounded-lg">
            <div className="p-2.5 rounded bg-surface border border-border text-primary shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div className="flex-1 overflow-hidden space-y-1">
              <div className="font-semibold text-foreground text-sm truncate">{entry.name}</div>
              <div className="text-muted font-mono text-[11px] truncate" title={entry.path}>
                {entry.path}
              </div>
              <div className="text-muted">
                {entry.isDir ? 'Directory' : entry.extension ? `${entry.extension.toUpperCase()} File` : 'File'}
              </div>
            </div>
          </div>

          {/* Details Table */}
          <div className="border border-border/60 rounded-lg divide-y divide-border/40 text-foreground bg-background/30">
            <div className="flex justify-between px-3 py-2">
              <span className="text-muted">Size:</span>
              <span className="font-mono">
                {formatBytes(entry.size)} ({entry.size.toLocaleString()} bytes)
              </span>
            </div>
            <div className="flex justify-between px-3 py-2">
              <span className="text-muted flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Date Modified:
              </span>
              <span>{formatDate(entry.modifiedTime)}</span>
            </div>
            <div className="flex justify-between px-3 py-2">
              <span className="text-muted flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Date Created:
              </span>
              <span>{formatDate(entry.createdTime)}</span>
            </div>
            <div className="flex justify-between px-3 py-2">
              <span className="text-muted">Attributes:</span>
              <span className="flex items-center gap-2">
                {entry.isReadonly && <span className="text-amber-400">Read-only</span>}
                {entry.isHidden && <span className="text-purple-400">Hidden</span>}
                {entry.isSymlink && <span className="text-cyan-400">Symlink</span>}
                {!entry.isReadonly && !entry.isHidden && !entry.isSymlink && (
                  <span className="text-muted">Normal</span>
                )}
              </span>
            </div>
          </div>

          {/* Directory Size Async Calculation */}
          {entry.isDir && (
            <div className="border border-border/60 rounded-lg p-3 bg-sidebar/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">Recursive Folder Size</span>
                <button
                  disabled={isCalculatingSize}
                  onClick={handleCalculateDirSize}
                  className="px-2.5 py-1 rounded bg-surface hover:bg-surface-hover border border-border text-foreground flex items-center gap-1.5 disabled:opacity-40"
                >
                  <RefreshCw className={`w-3 h-3 ${isCalculatingSize ? 'animate-spin' : ''}`} />
                  <span>{isCalculatingSize ? 'Calculating...' : 'Calculate Size'}</span>
                </button>
              </div>

              {dirSizeInfo && (
                <div className="space-y-1 font-mono text-[11px] text-muted pt-1">
                  <div className="flex justify-between">
                    <span>Total Size:</span>
                    <span className="text-accent font-semibold">
                      {formatBytes(dirSizeInfo.totalBytes)} ({dirSizeInfo.totalBytes.toLocaleString()} bytes)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Files:</span>
                    <span>{dirSizeInfo.fileCount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Subfolders:</span>
                    <span>{dirSizeInfo.dirCount.toLocaleString()}</span>
                  </div>
                  {dirSizeInfo.inaccessibleCount > 0 && (
                    <div className="flex justify-between text-amber-400">
                      <span>Inaccessible items:</span>
                      <span>{dirSizeInfo.inaccessibleCount}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Cryptographic Hash Calculator */}
          {!entry.isDir && (
            <div className="border border-border/60 rounded-lg p-3 bg-sidebar/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-accent" />
                  <span>SHA-256 Checksum</span>
                </span>
                <button
                  disabled={isCalculatingHash}
                  onClick={handleCalculateHash}
                  className="px-2.5 py-1 rounded bg-surface hover:bg-surface-hover border border-border text-foreground flex items-center gap-1.5 disabled:opacity-40"
                >
                  <RefreshCw className={`w-3 h-3 ${isCalculatingHash ? 'animate-spin' : ''}`} />
                  <span>{isCalculatingHash ? 'Computing...' : 'Compute Hash'}</span>
                </button>
              </div>

              {hashResult && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    readOnly
                    value={hashResult.hash}
                    className="flex-1 bg-background border border-border rounded px-2 py-1 font-mono text-[11px] text-accent select-all"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(hashResult.hash)}
                    className="p-1.5 rounded hover:bg-surface border border-border text-muted hover:text-foreground"
                    title="Copy hash"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-sidebar/50">
          <button
            onClick={handleCopyMetadata}
            className="px-3 py-1.5 rounded bg-surface hover:bg-surface-hover border border-border text-muted hover:text-foreground flex items-center gap-1.5"
          >
            <FileCheck2 className="w-3.5 h-3.5 text-accent" />
            <span>{copied ? 'Copied to Clipboard!' : 'Copy Metadata'}</span>
          </button>
          <button
            onClick={() => setPropertiesOpen(false)}
            className="px-4 py-1.5 rounded bg-primary text-primary-foreground font-medium hover:bg-primary/90"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
