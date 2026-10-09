import React from 'react';
import { useAppStore } from '../store';
import {
  X,
  ListTodo,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  Trash2,
  Undo2,
  Copy,
  Scissors,
} from 'lucide-react';

export const OperationsDrawer: React.FC = () => {
  const {
    operations,
    operationDrawerOpen,
    toggleOperationDrawer,
    executeUndo,
    undoStack,
    executeCopy,
    executeMove,
    executeDelete,
  } = useAppStore();

  if (!operationDrawerOpen) return null;

  const handleRetry = async (op: (typeof operations)[0]) => {
    if (op.type === 'copy' && op.destination) {
      await executeCopy(op.sources, op.destination);
    } else if (op.type === 'move' && op.destination) {
      await executeMove(op.sources, op.destination);
    } else if (op.type === 'delete') {
      await executeDelete(op.sources);
    }
  };

  const getOpIcon = (type: string) => {
    switch (type) {
      case 'copy':
        return <Copy className="w-3.5 h-3.5 text-blue-400" />;
      case 'move':
        return <Scissors className="w-3.5 h-3.5 text-amber-400" />;
      case 'delete':
        return <Trash2 className="w-3.5 h-3.5 text-red-400" />;
      default:
        return <ListTodo className="w-3.5 h-3.5 text-accent" />;
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-96 bg-surface/95 backdrop-blur-md border-l border-border shadow-2xl flex flex-col text-xs select-none animate-in slide-in-from-right duration-150">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-sidebar/50">
        <div className="flex items-center gap-2 font-medium text-foreground text-sm">
          <ListTodo className="w-4 h-4 text-accent" />
          <span>Operation Queue & History</span>
        </div>
        <div className="flex items-center gap-1">
          {undoStack.length > 0 && (
            <button
              onClick={() => executeUndo()}
              className="px-2 py-1 rounded bg-surface hover:bg-surface-hover border border-border text-foreground flex items-center gap-1"
              title="Undo last reversible operation (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Undo ({undoStack.length})</span>
            </button>
          )}
          <button
            onClick={toggleOperationDrawer}
            className="p-1 rounded hover:bg-surface-hover text-muted hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Operation list */}
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {operations.length === 0 ? (
          <div className="text-center text-muted py-12">No recent file operations.</div>
        ) : (
          operations.map((op) => (
            <div
              key={op.id}
              className="p-3 bg-background/50 border border-border/70 rounded-lg space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-medium uppercase tracking-wider text-[10px] text-muted">
                  {getOpIcon(op.type)}
                  <span>{op.type}</span>
                </div>
                <div className="flex items-center gap-1 text-[11px]">
                  {op.status === 'running' && (
                    <span className="text-amber-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 animate-spin" /> In Progress
                    </span>
                  )}
                  {op.status === 'completed' && (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Completed
                    </span>
                  )}
                  {op.status === 'failed' && (
                    <span className="text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Failed
                    </span>
                  )}
                </div>
              </div>

              {/* Items summary */}
              <div className="text-muted truncate font-mono text-[11px]" title={op.sources.join(', ')}>
                {op.sources.length} item(s): {op.sources.map((s) => s.split('\\').pop()).join(', ')}
              </div>

              {op.destination && (
                <div className="text-muted font-mono text-[10px] truncate" title={op.destination}>
                  To: {op.destination}
                </div>
              )}

              {op.error && (
                <div className="text-red-400 text-[10px] bg-red-500/10 p-1.5 rounded border border-red-500/20 break-all">
                  {op.error}
                </div>
              )}

              {op.status === 'failed' && (
                <button
                  onClick={() => handleRetry(op)}
                  className="w-full py-1 rounded bg-surface hover:bg-surface-hover border border-border text-foreground flex items-center justify-center gap-1 text-[11px]"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Retry Operation</span>
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border bg-sidebar/50 text-[11px] text-muted flex items-center justify-between">
        <span>{operations.filter((o) => o.status === 'running').length} active</span>
        <button
          onClick={() => useAppStore.setState({ operations: [] })}
          className="text-muted hover:text-foreground"
        >
          Clear History
        </button>
      </div>
    </div>
  );
};
