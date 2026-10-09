import React from 'react';
import { useAppStore } from '../store';
import { CheckCircle2, AlertTriangle, Loader2, Scissors, Copy, Undo2, ListTodo } from 'lucide-react';

export const StatusBar: React.FC = () => {
  const { operations, tabs, activeTabId, clipboard, undoStack, toggleOperationDrawer } = useAppStore();
  const currentTab = tabs.find((t) => t.id === activeTabId);

  const activeOp = operations.find((o) => o.status === 'running');
  const selectedCount = currentTab?.selectedPaths.length || 0;

  return (
    <div className="h-6 bg-sidebar border-t border-border flex items-center justify-between px-3 text-[11px] text-muted select-none">
      <div className="flex items-center gap-3 truncate">
        <span className="truncate max-w-sm font-mono text-[10px] text-muted">{currentTab?.path}</span>
        {selectedCount > 0 && (
          <span className="text-foreground">
            {selectedCount} item{selectedCount > 1 ? 's' : ''} selected
          </span>
        )}
        {clipboard && (
          <span className="flex items-center gap-1 text-accent font-medium">
            {clipboard.action === 'cut' ? <Scissors className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            <span>Clipboard: {clipboard.paths.length} {clipboard.action}</span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {undoStack.length > 0 && (
          <span className="flex items-center gap-1 text-muted text-[10px]" title="Ctrl+Z to undo">
            <Undo2 className="w-3 h-3" />
            <span>Undo ready ({undoStack.length})</span>
          </span>
        )}

        <button
          onClick={toggleOperationDrawer}
          className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer"
        >
          {activeOp ? (
            <div className="flex items-center gap-1 text-accent animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="capitalize">{activeOp.type}...</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-muted hover:text-foreground">
              <ListTodo className="w-3 h-3" />
              <span>Queue ({operations.length})</span>
            </div>
          )}
        </button>

        <span className="text-muted/60">Atlas Dark</span>
      </div>
    </div>
  );
};
