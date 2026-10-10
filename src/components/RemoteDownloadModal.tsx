import React, { useEffect } from 'react';
import {
  Eye,
  Activity,
  Zap,
  FolderOpen,
  Download,
  AlertCircle,
  X,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { useRemoteDownloadStore } from '../stores/remoteDownloadStore';

function formatBytes(bytes: number): string {
  if (bytes === 0 || !bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const RemoteDownloadModal: React.FC = () => {
  const {
    isOpen,
    appName,
    fileName,
    totalBytes,
    transferredBytes,
    speedBytesPerSec,
    status,
    error,
    cancelDownload,
    closeModal,
  } = useRemoteDownloadStore();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelDownload();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, cancelDownload]);

  if (!isOpen) return null;

  const percent = totalBytes > 0
    ? Math.min(100, Math.max(0, Math.round((transferredBytes / totalBytes) * 100)))
    : status === 'completed'
    ? 100
    : 0;

  const getAppConfig = () => {
    switch (appName) {
      case 'ultraviewer':
        return {
          title: 'UltraViewer',
          desc: 'High-Performance XML/JSON Editor',
          accentBorder: 'border-amber-500/40',
          accentBg: 'bg-amber-500/10',
          accentText: 'text-amber-400',
          barColor: 'from-amber-500 to-amber-400',
          icon: <Eye className="w-5 h-5 text-amber-400" />,
        };
      case 'feedlens':
        return {
          title: 'FeedLens',
          desc: 'DuckDB Streaming Feed Analyzer',
          accentBorder: 'border-blue-500/40',
          accentBg: 'bg-blue-500/10',
          accentText: 'text-blue-400',
          barColor: 'from-blue-500 to-blue-400',
          icon: <Activity className="w-5 h-5 text-blue-400" />,
        };
      case 'transformlab':
        return {
          title: 'TransformLab',
          desc: 'XSLT 3.0 / JOLT Transformation Studio',
          accentBorder: 'border-emerald-500/40',
          accentBg: 'bg-emerald-500/10',
          accentText: 'text-emerald-400',
          barColor: 'from-emerald-500 to-emerald-400',
          icon: <Zap className="w-5 h-5 text-emerald-400" />,
        };
      default:
        return {
          title: 'Default Application',
          desc: 'Opening file with native registered handler',
          accentBorder: 'border-purple-500/40',
          accentBg: 'bg-purple-500/10',
          accentText: 'text-purple-400',
          barColor: 'from-purple-500 to-purple-400',
          icon: <FolderOpen className="w-5 h-5 text-purple-400" />,
        };
    }
  };

  const appConfig = getAppConfig();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className={`w-full max-w-md bg-[#131317] border ${appConfig.accentBorder} rounded-xl shadow-2xl p-5 select-none text-foreground flex flex-col gap-4 animate-in zoom-in-95 duration-150`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${appConfig.accentBg} border border-white/5 shrink-0`}>
              {appConfig.icon}
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground">
                  Downloading for {appConfig.title}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-muted border border-white/5">
                  Read-Only Cache
                </span>
              </div>
              <span className="text-xs text-muted truncate mt-0.5">{appConfig.desc}</span>
            </div>
          </div>
          <button
            onClick={cancelDownload}
            className="p-1 rounded-md text-muted hover:text-foreground hover:bg-white/10 transition-colors"
            title="Cancel Download"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* File info card */}
        <div className="bg-[#1a1a22] border border-white/5 rounded-lg p-3 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground truncate max-w-[260px]" title={fileName}>
              {fileName}
            </span>
            <span className="text-muted text-[11px] font-mono shrink-0">
              {formatBytes(totalBytes)}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/5 relative mt-1">
            <div
              className={`h-full bg-gradient-to-r ${appConfig.barColor} transition-all duration-150 rounded-full`}
              style={{ width: `${percent}%` }}
            />
          </div>

          {/* Telemetry row */}
          <div className="flex items-center justify-between text-[11px] text-muted font-mono mt-1">
            <span>
              {formatBytes(transferredBytes)} / {formatBytes(totalBytes)}
            </span>
            <div className="flex items-center gap-3">
              {speedBytesPerSec > 0 && status === 'downloading' && (
                <span className="text-muted/80">{formatBytes(speedBytesPerSec)}/s</span>
              )}
              <span className={`font-semibold ${appConfig.accentText}`}>{percent}%</span>
            </div>
          </div>
        </div>

        {/* Status text or error */}
        {status === 'failed' && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="truncate">{error || 'An error occurred during download.'}</span>
          </div>
        )}

        {status === 'completed' && (
          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Download completed. Launching {appConfig.title}...</span>
          </div>
        )}

        {status === 'downloading' && (
          <div className="flex items-center justify-between text-xs text-muted">
            <div className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted" />
              <span>Streaming remote file to cache...</span>
            </div>
            <span className="text-[10px] text-muted/60">Auto-purged on exit</span>
          </div>
        )}

        {/* Action button */}
        <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/5">
          {status === 'failed' ? (
            <button
              onClick={closeModal}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/15 text-foreground transition-colors"
            >
              Close
            </button>
          ) : (
            <button
              onClick={cancelDownload}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 transition-colors"
            >
              Cancel Download
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
