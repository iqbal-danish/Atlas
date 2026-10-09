import React, { useRef, useEffect } from 'react';
import { useAppStore } from '../store';
import { Terminal, Trash2, Copy, Check, Info, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ConnectionLogConsoleProps {
  profileIdFilter?: string;
  maxHeight?: string;
}

export const ConnectionLogConsole: React.FC<ConnectionLogConsoleProps> = ({
  profileIdFilter,
  maxHeight = 'max-h-64',
}) => {
  const { connectionLogs, clearConnectionLogs } = useAppStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState(false);

  const logs = profileIdFilter
    ? connectionLogs.filter((l) => !l.profileId || l.profileId === profileIdFilter)
    : connectionLogs;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length]);

  const handleCopy = () => {
    const text = logs
      .map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />;
      case 'warn':
        return <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />;
      case 'success':
        return <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />;
      default:
        return <Info className="w-3 h-3 text-cyan-400 shrink-0" />;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-400';
      case 'warn':
        return 'text-amber-400';
      case 'success':
        return 'text-emerald-400 font-medium';
      default:
        return 'text-foreground/90';
    }
  };

  return (
    <div className="border border-border rounded-lg bg-surface/80 overflow-hidden flex flex-col font-mono text-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-sidebar/90 border-b border-border select-none">
        <div className="flex items-center gap-2 text-muted text-[11px] font-sans font-medium">
          <Terminal className="w-3.5 h-3.5 text-accent" />
          <span>Connection & Transfer Logs</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface border border-border text-muted">
            {logs.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            disabled={logs.length === 0}
            className="p-1 text-muted hover:text-foreground rounded hover:bg-surface transition-colors"
            title="Copy logs to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={clearConnectionLogs}
            disabled={logs.length === 0}
            className="p-1 text-muted hover:text-red-400 rounded hover:bg-surface transition-colors"
            title="Clear logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Log list */}
      <div
        ref={scrollRef}
        className={`p-2.5 overflow-y-auto flex flex-col gap-1 ${maxHeight} min-h-[80px] bg-black/40 text-[11px] leading-relaxed`}
      >
        {logs.length === 0 ? (
          <div className="text-muted/50 italic text-center py-4 font-sans text-xs">
            No connection events recorded yet. Connect to an FTP/SFTP server to view live handshake and transfer logs.
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2 hover:bg-white/5 px-1 py-0.5 rounded">
              <span className="text-muted/60 shrink-0 text-[10px] select-none">[{log.timestamp}]</span>
              <span className="mt-0.5">{getLevelBadge(log.level)}</span>
              <span className={`break-all ${getLevelColor(log.level)}`}>{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
