import React from 'react';
import { useAppStore } from '../store';
import { Plus, X, SplitSquareVertical, Home, Folder, Trash2, Cloud } from 'lucide-react';

export const TabBar: React.FC = () => {
  const { tabs, activeTabId, createTab, closeTab, setActiveTab, splitPaneActive, toggleSplitPane } =
    useAppStore();

  return (
    <div className="flex items-center bg-sidebar border-b border-border px-2 pt-2 select-none">
      <div className="flex items-center gap-1.5 pr-2.5 pb-1 shrink-0 select-none">
        <img
          src="/app-icon.png"
          alt="Atlas"
          className="w-5 h-5 rounded shadow-sm object-contain"
        />
        <span className="text-[11px] font-bold tracking-tight text-foreground/90 hidden sm:inline font-sans">
          Atlas
        </span>
      </div>
      <div className="flex items-center gap-1 overflow-x-auto flex-1 no-scrollbar">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isHome = tab.path === 'home' || tab.viewMode === 'home';
          const isBin = tab.path === 'recycle-bin://' || tab.viewMode === 'recycle-bin';
          const isServerDock = (tab.path === 'serverdock://' || tab.viewMode === 'serverdock') && !tab.path.includes(':');
          const title = isHome ? 'Home' : isBin ? 'Recycle Bin' : isServerDock ? 'Remote & Cloud' : tab.title;

          return (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`group flex items-center gap-2 px-3 py-1.5 text-xs rounded-t-md cursor-pointer transition-colors max-w-[200px] border-t border-x ${
                isActive
                  ? 'bg-background text-foreground border-border font-medium shadow-sm'
                  : 'bg-surface/50 text-muted hover:bg-surface border-transparent hover:text-foreground'
              }`}
            >
              {isHome ? (
                <Home className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              ) : isBin ? (
                <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              ) : isServerDock ? (
                <Cloud className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              ) : (
                <Folder className="w-3.5 h-3.5 text-muted shrink-0" />
              )}
              <span className="truncate">{title}</span>
              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:bg-white/10 p-0.5 rounded text-muted hover:text-foreground transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
        <button
          onClick={() => createTab()}
          className="p-1.5 text-muted hover:text-foreground hover:bg-surface rounded-md transition-colors"
          title="New Tab (Ctrl+T)"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center pl-2">
        <button
          onClick={toggleSplitPane}
          className={`p-1.5 rounded-md transition-colors ${
            splitPaneActive
              ? 'bg-accent/20 text-accent'
              : 'text-muted hover:text-foreground hover:bg-surface'
          }`}
          title="Toggle Split Pane (Ctrl+\\)"
        >
          <SplitSquareVertical className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
