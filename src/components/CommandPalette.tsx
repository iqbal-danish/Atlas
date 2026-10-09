import React, { useEffect, useState, useRef } from 'react';
import { useAppStore } from '../store';
import {
  Search,
  Folder,
  File,
  Sparkles,
  Command,
  Columns3,
  List,
  SlidersHorizontal,
  Eye,
  Plus,
  Trash2,
  Terminal,
  GitCompare,
  ListTodo,
  Info,
  Copy,
  Undo2,
  FolderOpen,
  Cloud,
} from 'lucide-react';
import { api } from '../api';

export const CommandPalette: React.FC = () => {
  const {
    commandPaletteOpen,
    toggleCommandPalette,
    activeTabId,
    navigateTab,
    createTab,
    toggleSplitPane,
    toggleHiddenFiles,
    togglePreviewPanel,
    toggleOperationDrawer,
    setStorageModalOpen,
    setViewMode,
    setBatchRenameOpen,
    setPropertiesOpen,
    setCompareOpen,
    executeUndo,
    tabs,
  } = useAppStore();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentTab = tabs.find((t) => t.id === activeTabId);

  useEffect(() => {
    if (commandPaletteOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [commandPaletteOpen]);

  if (!commandPaletteOpen) return null;

  const actions = [
    {
      title: 'New Tab',
      subtitle: 'Open a fresh browsing tab',
      shortcut: 'Ctrl+T',
      icon: Plus,
      run: () => createTab(),
    },
    {
      title: 'Toggle Split Pane',
      subtitle: 'Side-by-side dual pane view',
      shortcut: 'Ctrl+\\',
      icon: Columns3,
      run: () => toggleSplitPane(),
    },
    {
      title: 'Switch to Miller Columns',
      subtitle: 'Cascading directory tree browser',
      shortcut: '',
      icon: Columns3,
      run: () => setViewMode(activeTabId, 'columns'),
    },
    {
      title: 'Switch to Details List View',
      subtitle: 'Sortable columns table',
      shortcut: '',
      icon: List,
      run: () => setViewMode(activeTabId, 'list'),
    },
    {
      title: 'Batch Rename',
      subtitle: 'Find/replace, sequence numbering, casing',
      shortcut: '',
      icon: Sparkles,
      run: () => setBatchRenameOpen(true),
    },
    {
      title: 'Compare Directories',
      subtitle: 'Compare contents between two directories',
      shortcut: '',
      icon: GitCompare,
      run: () => setCompareOpen(true),
    },
    {
      title: 'File Properties & Checksums',
      subtitle: 'Inspect metadata, async size, and SHA-256',
      shortcut: 'Alt+Enter',
      icon: Info,
      run: () => setPropertiesOpen(true),
    },
    {
      title: 'Open in Terminal',
      subtitle: 'Launch Windows Terminal at current path',
      shortcut: '',
      icon: Terminal,
      run: () => {
        if (currentTab) api.launchTerminal(currentTab.path);
      },
    },
    {
      title: 'Show in Windows Explorer',
      subtitle: 'Open native Windows Explorer at location',
      shortcut: '',
      icon: FolderOpen,
      run: () => {
        if (currentTab) api.showInExplorer(currentTab.path);
      },
    },
    {
      title: 'Copy Full Path',
      subtitle: 'Copy current location path to clipboard',
      shortcut: 'Ctrl+Shift+C',
      icon: Copy,
      run: () => {
        if (currentTab) navigator.clipboard.writeText(currentTab.path);
      },
    },
    {
      title: 'Undo Last Operation',
      subtitle: 'Revert last copy, move, or rename',
      shortcut: 'Ctrl+Z',
      icon: Undo2,
      run: () => executeUndo(),
    },
    {
      title: 'Operation Queue',
      subtitle: 'View background tasks and history',
      shortcut: 'Ctrl+J',
      icon: ListTodo,
      run: () => toggleOperationDrawer(),
    },
    {
      title: 'Toggle Hidden Files',
      subtitle: 'Show or hide system and dot files',
      shortcut: 'Ctrl+H',
      icon: SlidersHorizontal,
      run: () => toggleHiddenFiles(),
    },
    {
      title: 'Toggle File Preview & Inspector Panel',
      subtitle: 'Inspect properties, preview PDF, image, and documents',
      shortcut: 'Alt+P / Space / Ctrl+I',
      icon: Eye,
      run: () => togglePreviewPanel(),
    },
    {
      title: 'Add Cloud Storage (Google Drive / OneDrive)',
      subtitle: 'Connect Google Drive or Microsoft OneDrive cloud account',
      shortcut: '',
      icon: Cloud,
      run: () => setStorageModalOpen(true),
    },
  ];

  const filtered = actions.filter((a) =>
    a.title.toLowerCase().includes(query.toLowerCase()) ||
    a.subtitle.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      toggleCommandPalette();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].run();
        toggleCommandPalette();
      }
    }
  };

  return (
    <div
      onClick={toggleCommandPalette}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-24"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-sidebar border border-border shadow-2xl rounded-xl overflow-hidden flex flex-col text-xs animate-in zoom-in-95 duration-100"
      >
        <div className="flex items-center px-4 py-3 border-b border-border gap-2.5 bg-surface/50">
          <Search className="w-4 h-4 text-accent" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search actions..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted/60 outline-none"
          />
        </div>

        <div className="max-h-80 overflow-y-auto p-1.5 flex flex-col gap-0.5">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-muted/60 italic">No matching commands</div>
          ) : (
            filtered.map((action, idx) => {
              const isSelected = selectedIndex === idx;
              const Icon = action.icon;
              return (
                <div
                  key={action.title}
                  onClick={() => {
                    action.run();
                    toggleCommandPalette();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    isSelected ? 'bg-accent/20 text-foreground font-medium' : 'text-muted hover:bg-surface'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-1.5 rounded-md ${
                        isSelected ? 'bg-accent text-white' : 'bg-surface text-muted'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs text-foreground font-medium">{action.title}</div>
                      <div className="text-[10px] text-muted">{action.subtitle}</div>
                    </div>
                  </div>
                  {action.shortcut && (
                    <div className="text-[10px] bg-surface px-1.5 py-0.5 rounded border border-border text-muted font-mono">
                      {action.shortcut}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="px-4 py-2 border-t border-border bg-sidebar/80 text-[10px] text-muted flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>↑↓ to navigate</span>
            <span>↵ to select</span>
            <span>esc to close</span>
          </div>
          <span>Atlas Commands</span>
        </div>
      </div>
    </div>
  );
};
