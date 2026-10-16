import React, { useEffect, useState } from 'react';
import { useAppStore } from './store';
import { TabBar } from './components/TabBar';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { MillerColumns } from './components/MillerColumns';
import { ListView } from './components/ListView';
import { HomeView } from './components/HomeView';
import { RecycleBinView } from './components/RecycleBinView';
import { PreviewPanel } from './components/PreviewPanel';
import { CommandPalette } from './components/CommandPalette';
import { FastFuzzyFinder } from './components/FastFuzzyFinder';
import { StatusBar } from './components/StatusBar';
import { BatchRenameModal } from './components/BatchRenameModal';
import { PropertiesDialog } from './components/PropertiesDialog';
import { DirectoryCompareModal } from './components/DirectoryCompareModal';
import { OperationsDrawer } from './components/OperationsDrawer';
import { StorageConnectionsModal } from './components/StorageConnectionsModal';
import { QuickAuthModal } from './components/QuickAuthModal';
import { LargeFileEditorModal } from './components/LargeFileEditorModal';
import { RemoteDownloadModal } from './components/RemoteDownloadModal';
import { ServerDockView } from './serverdock/ServerDockView';

export function App() {
  const [fuzzyFinderOpen, setFuzzyFinderOpen] = useState(false);
  const {
    init,
    tabs,
    activeTabId,
    splitPaneActive,
    rightPaneTabId,
    toggleCommandPalette,
    toggleSplitPane,
    togglePreviewPanel,
    toggleHiddenFiles,
    toggleOperationDrawer,
    createTab,
    closeTab,
    cutSelection,
    copySelection,
    paste,
    duplicate,
    executeUndo,
    executeDelete,
    setPropertiesOpen,
    navigateTab,
    refreshTab,
    navigateUp,
    navigateBack,
    navigateForward,
    setViewMode,
    setBatchRenameOpen,
  } = useAppStore();

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    // Global keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      const isInputFocused = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '');

      // Toggle Preview & Inspector Panel: Alt+P, Ctrl+I, F3, or Space (when not focused on text input)
      if (
        (e.altKey && (e.key === 'p' || e.key === 'P')) ||
        (isCmdOrCtrl && (e.key === 'i' || e.key === 'I')) ||
        e.key === 'F3' ||
        (!isInputFocused && !isCmdOrCtrl && !e.altKey && !e.shiftKey && e.code === 'Space')
      ) {
        e.preventDefault();
        togglePreviewPanel();
      }
      // Command palette: Ctrl+K or Ctrl+Shift+P
      else if (
        (isCmdOrCtrl && e.key === 'k') ||
        (isCmdOrCtrl && e.shiftKey && (e.key === 'P' || e.key === 'p'))
      ) {
        e.preventDefault();
        toggleCommandPalette();
      }
      // Fast Fuzzy Finder: Ctrl+P or Ctrl+F
      else if (isCmdOrCtrl && (e.key === 'p' || e.key === 'f')) {
        e.preventDefault();
        setFuzzyFinderOpen(true);
      }
      // Refresh current directory: F5 or Ctrl+R
      else if (e.key === 'F5' || (isCmdOrCtrl && e.key === 'r')) {
        e.preventDefault();
        refreshTab(activeTabId);
      }
      // Switch View Mode: Ctrl+1 (List), Ctrl+2 (Columns)
      else if (isCmdOrCtrl && e.key === '1') {
        e.preventDefault();
        setViewMode(activeTabId, 'list');
      }
      else if (isCmdOrCtrl && e.key === '2') {
        e.preventDefault();
        setViewMode(activeTabId, 'columns');
      }
      // Batch Rename: F2
      else if (e.key === 'F2') {
        e.preventDefault();
        setBatchRenameOpen(true);
      }
      // Navigation: Alt+ArrowUp (Up directory), Alt+ArrowLeft (Back), Alt+ArrowRight (Forward)
      else if (e.altKey && e.key === 'ArrowUp') {
        e.preventDefault();
        navigateUp(activeTabId);
      }
      else if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateBack(activeTabId);
      }
      else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        navigateForward(activeTabId);
      }
      // New tab: Ctrl+T
      else if (isCmdOrCtrl && e.key === 't') {
        e.preventDefault();
        createTab();
      }
      // Close tab: Ctrl+W
      else if (isCmdOrCtrl && e.key === 'w') {
        e.preventDefault();
        closeTab(activeTabId);
      }
      // Split pane: Ctrl+\
      else if (isCmdOrCtrl && e.key === '\\') {
        e.preventDefault();
        toggleSplitPane();
      }
      // Hidden files: Ctrl+H
      else if (isCmdOrCtrl && e.key === 'h') {
        e.preventDefault();
        toggleHiddenFiles();
      }
      // Undo: Ctrl+Z
      else if (isCmdOrCtrl && e.key === 'z') {
        e.preventDefault();
        executeUndo();
      }
      // Cut: Ctrl+X
      else if (isCmdOrCtrl && e.key === 'x') {
        if (!isInputFocused) {
          e.preventDefault();
          cutSelection(activeTabId);
        }
      }
      // Copy: Ctrl+C (unless focused in text input)
      else if (isCmdOrCtrl && e.key === 'c') {
        if (!isInputFocused) {
          e.preventDefault();
          copySelection(activeTabId);
        }
      }
      // Paste: Ctrl+V (unless focused in text input)
      else if (isCmdOrCtrl && e.key === 'v') {
        if (!isInputFocused) {
          e.preventDefault();
          paste(activeTabId);
        }
      }
      // Duplicate: Ctrl+D
      else if (isCmdOrCtrl && e.key === 'd') {
        e.preventDefault();
        duplicate(activeTabId);
      }
      // Delete key
      else if (e.key === 'Delete') {
        if (!isInputFocused) {
          const tab = tabs.find((t) => t.id === activeTabId);
          if (tab && tab.selectedPaths.length > 0) {
            e.preventDefault();
            const permanent = e.shiftKey;
            executeDelete(tab.selectedPaths, permanent);
          }
        }
      }
      // Properties: Alt+Enter
      else if (e.altKey && e.key === 'Enter') {
        e.preventDefault();
        setPropertiesOpen(true);
      }
      // Toggle Operations Drawer: Ctrl+J
      else if (isCmdOrCtrl && e.key === 'j') {
        e.preventDefault();
        toggleOperationDrawer();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId, tabs]);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const rightTab = splitPaneActive ? tabs.find((t) => t.id === rightPaneTabId) || tabs[0] : null;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-foreground select-none">
      {/* Title / Tab Strip */}
      <TabBar />

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Sidebar */}
        <Sidebar tabId={activeTabId} />

        {/* Central Workspace Panes */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Main active tab toolbar */}
          <Toolbar tabId={activeTabId} />

          {/* View Container (Split or Single) */}
          <div className="flex-1 flex overflow-hidden divide-x divide-border">
            {/* Primary Pane */}
            <div className="flex-1 flex overflow-hidden">
              {activeTab?.viewMode === 'serverdock' || activeTab?.path === 'serverdock://' ? (
                <ServerDockView />
              ) : activeTab?.viewMode === 'home' || activeTab?.path === 'home' ? (
                <HomeView tabId={activeTabId} />
              ) : activeTab?.viewMode === 'recycle-bin' || activeTab?.path === 'recycle-bin://' ? (
                <RecycleBinView tabId={activeTabId} />
              ) : activeTab?.viewMode === 'columns' ? (
                <MillerColumns tabId={activeTabId} />
              ) : (
                <ListView tabId={activeTabId} />
              )}
            </div>

            {/* Optional Right Split Pane */}
            {splitPaneActive && rightTab && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <Toolbar tabId={rightTab.id} />
                <div className="flex-1 flex overflow-hidden">
                  {rightTab.viewMode === 'serverdock' || rightTab.path === 'serverdock://' ? (
                    <ServerDockView />
                  ) : rightTab.viewMode === 'home' || rightTab.path === 'home' ? (
                    <HomeView tabId={rightTab.id} />
                  ) : rightTab.viewMode === 'recycle-bin' || rightTab.path === 'recycle-bin://' ? (
                    <RecycleBinView tabId={rightTab.id} />
                  ) : rightTab.viewMode === 'columns' ? (
                    <MillerColumns tabId={rightTab.id} />
                  ) : (
                    <ListView tabId={rightTab.id} />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Real-time Preview and Inspector Panel */}
        <PreviewPanel tabId={activeTabId} />
      </div>

      {/* Status Bar */}
      <StatusBar />

      {/* Global Command Palette & Fast Fuzzy Finder */}
      <CommandPalette />
      <FastFuzzyFinder isOpen={fuzzyFinderOpen} onClose={() => setFuzzyFinderOpen(false)} />

      {/* Advanced Modals & Drawers */}
      <BatchRenameModal />
      <PropertiesDialog />
      <DirectoryCompareModal />
      <OperationsDrawer />
      <StorageConnectionsModal />
      <QuickAuthModal />
      <LargeFileEditorModal />
      <RemoteDownloadModal />
    </div>
  );
}

export default App;
