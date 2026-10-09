import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { api } from '../api';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  RefreshCw,
  Search,
  Eye,
  SlidersHorizontal,
  Columns3,
  List,
  LayoutGrid,
  Scissors,
  Copy,
  ClipboardPaste,
  Undo2,
  Terminal,
  GitCompare,
  ListTodo,
  X,
  Filter,
  Cloud,
} from 'lucide-react';

interface ToolbarProps {
  tabId: string;
}

export const Toolbar: React.FC<ToolbarProps> = ({ tabId }) => {
  const {
    tabs,
    navigateBack,
    navigateForward,
    navigateUp,
    navigateTab,
    setViewMode,
    searchQuery,
    setSearchQuery,
    togglePreviewPanel,
    previewPanelOpen,
    toggleHiddenFiles,
    showHiddenFiles,
    clipboard,
    cutSelection,
    copySelection,
    paste,
    executeUndo,
    undoStack,
    setCompareOpen,
    toggleOperationDrawer,
    operations,
    setFilterPattern,
    setStorageModalOpen,
  } = useAppStore();

  const tab = tabs.find((t) => t.id === tabId);
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [pathInput, setPathInput] = useState(tab?.path || '');
  const [filterInput, setFilterInput] = useState(tab?.filterPattern || '');

  useEffect(() => {
    if (tab?.path) {
      setPathInput(tab.path);
    }
  }, [tab?.path]);

  if (!tab) return null;

  const pathParts = tab.path.split('\\').filter(Boolean);

  const handleBreadcrumbClick = (index: number) => {
    const newPath = pathParts.slice(0, index + 1).join('\\') + (index === 0 ? '\\' : '');
    navigateTab(tabId, newPath);
  };

  const handlePathSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditingPath(false);
    if (pathInput.trim()) {
      navigateTab(tabId, pathInput.trim());
    }
  };

  const handleFilterChange = (val: string) => {
    setFilterInput(val);
    setFilterPattern(tabId, val);
  };

  const activeOpCount = operations.filter((o) => o.status === 'running').length;

  return (
    <div className="flex items-center justify-between gap-1.5 px-3 py-1.5 bg-sidebar/80 border-b border-border select-none text-xs">
      {/* Navigation History Controls */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => navigateBack(tabId)}
          disabled={tab.historyIndex <= 0}
          className="p-1.5 rounded hover:bg-surface text-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
          title="Back (Alt+Left)"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => navigateForward(tabId)}
          disabled={tab.historyIndex >= tab.history.length - 1}
          className="p-1.5 rounded hover:bg-surface text-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
          title="Forward (Alt+Right)"
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => navigateUp(tabId)}
          className="p-1.5 rounded hover:bg-surface text-muted hover:text-foreground"
          title="Up (Alt+Up)"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => navigateTab(tabId, tab.path)}
          className="p-1.5 rounded hover:bg-surface text-muted hover:text-foreground"
          title="Refresh (Ctrl+R)"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Quick Clipboard & Workflow Actions */}
      <div className="flex items-center gap-0.5 border-l border-border/60 pl-1.5">
        <button
          disabled={tab.selectedPaths.length === 0}
          onClick={() => cutSelection(tabId)}
          className="p-1.5 rounded hover:bg-surface text-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
          title="Cut (Ctrl+X)"
        >
          <Scissors className="w-3.5 h-3.5" />
        </button>
        <button
          disabled={tab.selectedPaths.length === 0}
          onClick={() => copySelection(tabId)}
          className="p-1.5 rounded hover:bg-surface text-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
          title="Copy (Ctrl+C)"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button
          disabled={!clipboard}
          onClick={() => paste(tabId)}
          className="p-1.5 rounded hover:bg-surface text-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
          title="Paste (Ctrl+V)"
        >
          <ClipboardPaste className="w-3.5 h-3.5" />
        </button>
        {undoStack.length > 0 && (
          <button
            onClick={() => executeUndo()}
            className="p-1.5 rounded hover:bg-surface text-muted hover:text-foreground"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Breadcrumb Path Bar */}
      <div className="flex-1 max-w-xl mx-1 bg-surface/60 border border-border rounded-md px-2 py-1 flex items-center overflow-hidden">
        {isEditingPath ? (
          <form onSubmit={handlePathSubmit} className="w-full">
            <input
              type="text"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              onBlur={() => setIsEditingPath(false)}
              autoFocus
              className="w-full bg-transparent outline-none font-mono text-[11px] text-foreground select-all"
            />
          </form>
        ) : (
          <div
            onClick={() => setIsEditingPath(true)}
            className="w-full flex items-center gap-1 font-mono text-[11px] truncate cursor-text"
          >
            {tab.path === 'recycle-bin://' ? (
              <span className="text-foreground font-medium px-1">Recycle Bin</span>
            ) : tab.path === 'home' ? (
              <span className="text-foreground font-medium px-1">Home</span>
            ) : (
              pathParts.map((part, idx) => (
                <React.Fragment key={idx}>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBreadcrumbClick(idx);
                    }}
                    className="hover:bg-surface-hover px-1 rounded text-foreground font-medium cursor-pointer truncate max-w-[150px]"
                  >
                    {part}
                  </span>
                  {idx < pathParts.length - 1 && <span className="text-muted/60">\</span>}
                </React.Fragment>
              ))
            )}
          </div>
        )}
      </div>

      {/* Wildcard / Pattern Filter */}
      <div className="relative w-36">
        <Filter className="w-3 h-3 absolute left-2 top-2 text-muted pointer-events-none" />
        <input
          type="text"
          placeholder="Filter (e.g. *.ts)"
          value={filterInput}
          onChange={(e) => handleFilterChange(e.target.value)}
          className="w-full bg-surface border border-border rounded-md pl-6 pr-5 py-1 text-xs text-foreground placeholder:text-muted/60 outline-none focus:border-accent"
        />
        {filterInput && (
          <button
            onClick={() => handleFilterChange('')}
            className="absolute right-1.5 top-1.5 text-muted hover:text-foreground"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Terminal & Tools */}
      <div className="flex items-center gap-0.5 border-l border-border/60 pl-1.5">
        <button
          onClick={() => api.launchTerminal(tab.path)}
          className="p-1.5 rounded hover:bg-surface text-muted hover:text-emerald-400"
          title="Launch Terminal here"
        >
          <Terminal className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setCompareOpen(true)}
          className="p-1.5 rounded hover:bg-surface text-muted hover:text-accent"
          title="Compare directories"
        >
          <GitCompare className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={toggleOperationDrawer}
          className="p-1.5 rounded hover:bg-surface text-muted hover:text-foreground relative"
          title="Operation Queue"
        >
          <ListTodo className="w-3.5 h-3.5" />
          {activeOpCount > 0 && (
            <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-accent animate-pulse" />
          )}
        </button>
        <button
          onClick={() => setStorageModalOpen(true)}
          className="p-1.5 rounded hover:bg-surface text-muted hover:text-accent"
          title="Storage Connections & Cloud Profiles"
        >
          <Cloud className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* View Mode toggles and Panels */}
      <div className="flex items-center gap-0.5 border-l border-border/60 pl-1.5">
        <button
          onClick={() => setViewMode(tabId, 'columns')}
          className={`p-1.5 rounded ${
            tab.viewMode === 'columns'
              ? 'bg-accent/20 text-accent font-semibold'
              : 'text-muted hover:text-foreground hover:bg-surface'
          }`}
          title="Miller Columns"
        >
          <Columns3 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setViewMode(tabId, 'list')}
          className={`p-1.5 rounded ${
            tab.viewMode === 'list'
              ? 'bg-accent/20 text-accent font-semibold'
              : 'text-muted hover:text-foreground hover:bg-surface'
          }`}
          title="Details List"
        >
          <List className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setViewMode(tabId, 'grid')}
          className={`p-1.5 rounded ${
            tab.viewMode === 'grid'
              ? 'bg-accent/20 text-accent font-semibold'
              : 'text-muted hover:text-foreground hover:bg-surface'
          }`}
          title="Grid Icons"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={toggleHiddenFiles}
          className={`p-1.5 rounded ml-0.5 ${
            showHiddenFiles ? 'text-accent bg-accent/20' : 'text-muted hover:text-foreground hover:bg-surface'
          }`}
          title="Toggle Hidden Files (Ctrl+H)"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={togglePreviewPanel}
          className={`p-1.5 rounded ${
            previewPanelOpen ? 'text-accent bg-accent/20' : 'text-muted hover:text-foreground hover:bg-surface'
          }`}
          title="Toggle Preview Panel"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
