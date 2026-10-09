import { create } from 'zustand';
import {
  ClipboardState,
  ConnectionHistoryItem,
  ConnectionLog,
  ConnectionProfile,
  DriveInfo,
  FsEntry,
  TabState,
  UndoRecord,
  ViewMode,
  SystemFolders,
} from './types';
import { api } from './api';

export interface FileOperation {
  id: string;
  type: 'copy' | 'move' | 'delete' | 'rename';
  sources: string[];
  destination?: string;
  status: 'running' | 'completed' | 'failed';
  error?: string;
  timestamp: number;
}

export interface AppStore {
  // Tabs & Navigation
  tabs: TabState[];
  activeTabId: string;
  splitPaneActive: boolean;
  rightPaneTabId?: string;

  // Global UI & Settings
  drives: DriveInfo[];
  systemFolders: SystemFolders | null;
  recentLocations: string[];
  showHiddenFiles: boolean;
  searchQuery: string;
  isSearching: boolean;
  commandPaletteOpen: boolean;
  previewPanelOpen: boolean;
  operationDrawerOpen: boolean;
  dropZoneFiles: string[];

  // Dialogs
  batchRenameOpen: boolean;
  propertiesOpen: boolean;
  compareOpen: boolean;
  largeFileEditorOpen: boolean;
  inspectingEntry?: FsEntry;

  // Clipboard & Undo
  clipboard: ClipboardState | null;
  undoStack: UndoRecord[];

  // File Operations Queue
  operations: FileOperation[];

  // Actions
  init: () => Promise<void>;
  createTab: (initialPath?: string) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  navigateTab: (tabId: string, path: string) => void;
  navigateBack: (tabId: string) => void;
  navigateForward: (tabId: string) => void;
  navigateUp: (tabId: string) => void;
  setViewMode: (tabId: string, mode: ViewMode) => void;

  // Selection actions
  setSelectedEntry: (tabId: string, entry?: FsEntry, multi?: boolean) => void;
  selectAll: (tabId: string, entries: FsEntry[]) => void;
  invertSelection: (tabId: string, entries: FsEntry[]) => void;
  selectByPattern: (tabId: string, pattern: string, entries: FsEntry[]) => void;
  setFilterPattern: (tabId: string, pattern: string) => void;

  // Clipboard & Operations
  cutSelection: (tabId: string) => void;
  copySelection: (tabId: string) => void;
  paste: (tabId: string, destDir?: string) => Promise<void>;
  duplicate: (tabId: string) => Promise<void>;
  executeUndo: () => Promise<void>;

  toggleSplitPane: () => void;
  toggleHiddenFiles: () => void;
  togglePreviewPanel: () => void;
  toggleCommandPalette: () => void;
  toggleOperationDrawer: () => void;
  setSearchQuery: (query: string) => void;

  setBatchRenameOpen: (open: boolean) => void;
  setPropertiesOpen: (open: boolean, entry?: FsEntry) => void;
  setCompareOpen: (open: boolean) => void;
  setLargeFileEditorOpen: (open: boolean) => void;

  addToDropZone: (paths: string[]) => void;
  removeFromDropZone: (path: string) => void;
  clearDropZone: () => void;

  executeCopy: (sources: string[], destination: string) => Promise<void>;
  executeMove: (sources: string[], destination: string) => Promise<void>;
  executeDelete: (paths: string[], permanent?: boolean) => Promise<void>;

  openRecycleBinTab: (tabId: string) => void;

  // Section 27 Remote Storage & ServerDock
  remoteProfiles: ConnectionProfile[];
  storageModalOpen: boolean;
  editingProfileId: string | null;
  activeRemoteProfileId: string | null;
  remoteHistory: ConnectionHistoryItem[];
  connectionLogs: ConnectionLog[];

  authModalProfile: ConnectionProfile | null;
  setAuthModalProfile: (profile: ConnectionProfile | null) => void;
  setStorageModalOpen: (open: boolean) => void;
  setEditingProfileId: (id: string | null) => void;
  fetchRemoteProfiles: () => Promise<void>;
  saveRemoteProfile: (profile: ConnectionProfile, secret?: string) => Promise<void>;
  deleteRemoteProfile: (profileId: string) => Promise<void>;
  testRemoteConnection: (profileId: string) => Promise<string | null>;
  connectRemoteProfile: (profileId: string) => Promise<boolean>;
  disconnectRemoteProfile: (profileId: string) => Promise<void>;
  loadRemoteHistory: (profileId: string) => Promise<void>;
  navigateRemoteTab: (tabId: string, profileId: string, pathOrId?: string) => void;
  importServerDockProfiles: () => Promise<number>;
  forgetProfilePassword: (profileId: string) => Promise<void>;
  addConnectionLog: (message: string, level?: ConnectionLog['level'], profileId?: string) => void;
  clearConnectionLogs: () => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  tabs: [
    {
      id: 'tab-1',
      title: 'Home',
      path: 'home',
      history: ['home'],
      historyIndex: 0,
      viewMode: 'home',
      selectedPaths: [],
    },
  ],
  activeTabId: 'tab-1',
  splitPaneActive: false,
  drives: [],
  systemFolders: null,
  recentLocations: [],
  showHiddenFiles: false,
  searchQuery: '',
  isSearching: false,
  commandPaletteOpen: false,
  previewPanelOpen: false,
  operationDrawerOpen: false,
  dropZoneFiles: [],
  operations: [],

  // Dialog states
  batchRenameOpen: false,
  propertiesOpen: false,
  compareOpen: false,
  largeFileEditorOpen: false,
  inspectingEntry: undefined,

  // Section 27 Remote Storage State
  remoteProfiles: [],
  storageModalOpen: false,
  editingProfileId: null,
  activeRemoteProfileId: null,
  remoteHistory: [],
  connectionLogs: [],
  authModalProfile: null,
  setAuthModalProfile: (profile) => set({ authModalProfile: profile }),

  // Clipboard & Undo
  clipboard: null,
  undoStack: [],

  init: async () => {
    try {
      const drives = await api.getDrives();
      const recents = await api.getRecentLocations();
      let systemFolders: SystemFolders | null = null;
      try {
        systemFolders = await api.getSystemFolders();
      } catch (e) {
        console.warn('Initialization getSystemFolders:', e);
      }

      set((state) => ({
        drives,
        recentLocations: recents,
        systemFolders,
        tabs: state.tabs.map((tab, idx) =>
          idx === 0 && (tab.path === 'home' || tab.path === 'C:\\')
            ? {
                ...tab,
                title: 'Home',
                path: 'home',
                history: ['home'],
                viewMode: 'home',
              }
            : tab
        ),
      }));

      await get().fetchRemoteProfiles();
    } catch (err) {
      console.error('Initialization error:', err);
    }
  },

  createTab: (initialPath) => {
    const { tabs } = get();
    const defaultPath = initialPath || 'home';
    const newId = `tab-${Date.now()}`;
    const newTab: TabState = {
      id: newId,
      title: defaultPath === 'home' ? 'Home' : defaultPath.split('\\').filter(Boolean).pop() || defaultPath,
      path: defaultPath,
      history: [defaultPath],
      historyIndex: 0,
      viewMode: defaultPath === 'home' ? 'home' : 'columns',
      selectedPaths: [],
    };
    set({
      tabs: [...tabs, newTab],
      activeTabId: newId,
    });
  },

  closeTab: (tabId) => {
    const { tabs, activeTabId } = get();
    if (tabs.length <= 1) return; // Keep at least one tab

    const newTabs = tabs.filter((t) => t.id !== tabId);
    let nextActive = activeTabId;
    if (activeTabId === tabId) {
      nextActive = newTabs[newTabs.length - 1].id;
    }
    set({ tabs: newTabs, activeTabId: nextActive });
  },

  setActiveTab: (tabId) => {
    set({ activeTabId: tabId });
  },

  navigateTab: (tabId, path) => {
    const { tabs } = get();
    if (path === 'home') {
      set({
        tabs: tabs.map((t) => {
          if (t.id !== tabId) return t;
          const newHistory = t.history.slice(0, t.historyIndex + 1);
          newHistory.push('home');
          return {
            ...t,
            path: 'home',
            title: 'Home',
            viewMode: 'home',
            history: newHistory,
            historyIndex: newHistory.length - 1,
            selectedEntry: undefined,
            selectedPaths: [],
          };
        }),
      });
      return;
    }

    api.recordRecent(path).catch(console.error);

    set({
      tabs: tabs.map((t) => {
        if (t.id !== tabId) return t;
        const newHistory = t.history.slice(0, t.historyIndex + 1);
        newHistory.push(path);
        const shouldResetView =
          t.viewMode === 'home' ||
          t.viewMode === 'recycle-bin' ||
          t.viewMode === 'serverdock';
        return {
          ...t,
          path,
          viewMode: shouldResetView ? 'list' : t.viewMode,
          title: path.split('\\').filter(Boolean).pop() || path,
          history: newHistory,
          historyIndex: newHistory.length - 1,
          selectedEntry: undefined,
          selectedPaths: [],
        };
      }),
    });
  },

  openRecycleBinTab: (tabId) => {
    const { tabs } = get();
    set({
      tabs: tabs.map((t) => {
        if (t.id !== tabId) return t;
        const binPath = 'recycle-bin://';
        const newHistory = t.history.slice(0, t.historyIndex + 1);
        newHistory.push(binPath);
        return {
          ...t,
          path: binPath,
          title: 'Recycle Bin',
          viewMode: 'recycle-bin',
          history: newHistory,
          historyIndex: newHistory.length - 1,
          selectedEntry: undefined,
          selectedPaths: [],
        };
      }),
    });
  },

  navigateBack: (tabId) => {
    const { tabs } = get();
    set({
      tabs: tabs.map((t) => {
        if (t.id !== tabId || t.historyIndex <= 0) return t;
        const nextIndex = t.historyIndex - 1;
        const nextPath = t.history[nextIndex];
        return {
          ...t,
          path: nextPath,
          title: nextPath.split('\\').filter(Boolean).pop() || nextPath,
          historyIndex: nextIndex,
          selectedEntry: undefined,
          selectedPaths: [],
        };
      }),
    });
  },

  navigateForward: (tabId) => {
    const { tabs } = get();
    set({
      tabs: tabs.map((t) => {
        if (t.id !== tabId || t.historyIndex >= t.history.length - 1) return t;
        const nextIndex = t.historyIndex + 1;
        const nextPath = t.history[nextIndex];
        return {
          ...t,
          path: nextPath,
          title: nextPath.split('\\').filter(Boolean).pop() || nextPath,
          historyIndex: nextIndex,
          selectedEntry: undefined,
          selectedPaths: [],
        };
      }),
    });
  },

  navigateUp: (tabId) => {
    const { tabs } = get();
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;
    const parts = tab.path.split('\\').filter(Boolean);
    if (parts.length <= 1) return; // Already at root
    parts.pop();
    const parentPath = parts.join('\\') + (parts.length === 1 ? '\\' : '');
    get().navigateTab(tabId, parentPath);
  },

  setViewMode: (tabId, mode) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, viewMode: mode } : t)),
    }));
  },

  setSelectedEntry: (tabId, entry, multi = false) => {
    set((state) => ({
      tabs: state.tabs.map((t) => {
        if (t.id !== tabId) return t;
        if (!entry) {
          return { ...t, selectedEntry: undefined, selectedPaths: [] };
        }
        if (multi) {
          const exists = t.selectedPaths.includes(entry.path);
          const newPaths = exists
            ? t.selectedPaths.filter((p) => p !== entry.path)
            : [...t.selectedPaths, entry.path];
          return {
            ...t,
            selectedEntry: entry,
            selectedPaths: newPaths,
          };
        }
        return {
          ...t,
          selectedEntry: entry,
          selectedPaths: [entry.path],
        };
      }),
    }));
  },

  selectAll: (tabId, entries) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId
          ? {
              ...t,
              selectedPaths: entries.map((e) => e.path),
              selectedEntry: entries[0],
            }
          : t
      ),
    }));
  },

  invertSelection: (tabId, entries) => {
    set((state) => ({
      tabs: state.tabs.map((t) => {
        if (t.id !== tabId) return t;
        const currentSet = new Set(t.selectedPaths);
        const inverted = entries
          .filter((e) => !currentSet.has(e.path))
          .map((e) => e.path);
        return {
          ...t,
          selectedPaths: inverted,
          selectedEntry: entries.find((e) => inverted.includes(e.path)),
        };
      }),
    }));
  },

  selectByPattern: (tabId, pattern, entries) => {
    if (!pattern.trim()) return;
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`, 'i');

    const matched = entries.filter((e) => regex.test(e.name)).map((e) => e.path);
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId
          ? {
              ...t,
              selectedPaths: matched,
              selectedEntry: entries.find((e) => matched.includes(e.path)),
            }
          : t
      ),
    }));
  },

  setFilterPattern: (tabId, pattern) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, filterPattern: pattern } : t
      ),
    }));
  },

  cutSelection: (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || tab.selectedPaths.length === 0) return;
    set({
      clipboard: {
        action: 'cut',
        paths: [...tab.selectedPaths],
      },
    });
    if (navigator.clipboard) {
      navigator.clipboard.writeText(tab.selectedPaths.join('\r\n')).catch(console.warn);
    }
  },

  copySelection: (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || tab.selectedPaths.length === 0) return;
    set({
      clipboard: {
        action: 'copy',
        paths: [...tab.selectedPaths],
      },
    });
    if (navigator.clipboard) {
      navigator.clipboard.writeText(tab.selectedPaths.join('\r\n')).catch(console.warn);
    }
  },

  paste: async (tabId, destDir) => {
    const { clipboard, tabs, executeCopy, executeMove } = get();
    if (!clipboard || clipboard.paths.length === 0) return;
    const tab = tabs.find((t) => t.id === tabId);
    const targetDir = destDir || tab?.path;
    if (!targetDir) return;

    if (clipboard.action === 'copy') {
      await executeCopy(clipboard.paths, targetDir);
    } else if (clipboard.action === 'cut') {
      await executeMove(clipboard.paths, targetDir);
      set({ clipboard: null });
    }
    if (tab) {
      get().navigateTab(tabId, tab.path);
    }
  },

  duplicate: async (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || tab.selectedPaths.length === 0) return;
    await get().executeCopy(tab.selectedPaths, tab.path);
    get().navigateTab(tabId, tab.path);
  },

  executeUndo: async () => {
    const { undoStack } = get();
    if (undoStack.length === 0) return;
    const lastOp = undoStack[undoStack.length - 1];
    const newStack = undoStack.slice(0, -1);

    try {
      if (lastOp.type === 'move' || lastOp.type === 'rename') {
        for (const item of lastOp.items) {
          await api.moveEntries([item.to], item.from);
        }
      } else if (lastOp.type === 'copy') {
        const pathsToDelete = lastOp.items.map((i) => i.to);
        await api.deleteEntries(pathsToDelete, false);
      }
      set({ undoStack: newStack });
      const activeTab = get().tabs.find((t) => t.id === get().activeTabId);
      if (activeTab) {
        get().navigateTab(activeTab.id, activeTab.path);
      }
    } catch (e) {
      console.error('Failed to undo operation:', e);
    }
  },

  toggleSplitPane: () => {
    const { splitPaneActive, tabs, activeTabId } = get();
    if (!splitPaneActive) {
      let rightTab = tabs.find((t) => t.id !== activeTabId);
      if (!rightTab) {
        const newId = `tab-${Date.now()}`;
        const activeTab = tabs.find((t) => t.id === activeTabId);
        rightTab = {
          id: newId,
          title: activeTab?.title || 'C:\\',
          path: activeTab?.path || 'C:\\',
          history: activeTab ? [...activeTab.history] : ['C:\\'],
          historyIndex: activeTab?.historyIndex || 0,
          viewMode: 'columns',
          selectedPaths: [],
        };
        set({ tabs: [...tabs, rightTab] });
      }
      set({ splitPaneActive: true, rightPaneTabId: rightTab.id });
    } else {
      set({ splitPaneActive: false, rightPaneTabId: undefined });
    }
  },

  toggleHiddenFiles: () => {
    set((state) => ({ showHiddenFiles: !state.showHiddenFiles }));
  },

  togglePreviewPanel: () => {
    set((state) => ({ previewPanelOpen: !state.previewPanelOpen }));
  },

  toggleCommandPalette: () => {
    set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen }));
  },

  toggleOperationDrawer: () => {
    set((state) => ({ operationDrawerOpen: !state.operationDrawerOpen }));
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query, isSearching: Boolean(query.trim()) });
  },

  setBatchRenameOpen: (open) => {
    set({ batchRenameOpen: open });
  },

  setPropertiesOpen: (open, entry) => {
    set({ propertiesOpen: open, inspectingEntry: entry });
  },

  setCompareOpen: (open) => {
    set({ compareOpen: open });
  },

  setLargeFileEditorOpen: (open) => {
    set({ largeFileEditorOpen: open });
  },

  addToDropZone: (paths) => {
    set((state) => ({
      dropZoneFiles: Array.from(new Set([...state.dropZoneFiles, ...paths])),
    }));
  },

  removeFromDropZone: (path) => {
    set((state) => ({
      dropZoneFiles: state.dropZoneFiles.filter((p) => p !== path),
    }));
  },

  clearDropZone: () => {
    set({ dropZoneFiles: [] });
  },

  executeCopy: async (sources, destination) => {
    const opId = `op-${Date.now()}`;
    const opRecord: FileOperation = {
      id: opId,
      type: 'copy',
      sources,
      destination,
      status: 'running',
      timestamp: Date.now(),
    };

    set((state) => ({
      operations: [...state.operations, opRecord],
    }));

    try {
      await api.copyEntries(sources, destination);
      set((state) => ({
        operations: state.operations.map((o) =>
          o.id === opId ? { ...o, status: 'completed' } : o
        ),
        undoStack: [
          ...state.undoStack,
          {
            type: 'copy',
            items: sources.map((s) => ({
              from: s,
              to: `${destination}\\${s.split('\\').pop()}`,
            })),
          },
        ],
      }));
    } catch (err: any) {
      set((state) => ({
        operations: state.operations.map((o) =>
          o.id === opId ? { ...o, status: 'failed', error: String(err) } : o
        ),
      }));
    }
  },

  executeMove: async (sources, destination) => {
    const opId = `op-${Date.now()}`;
    const opRecord: FileOperation = {
      id: opId,
      type: 'move',
      sources,
      destination,
      status: 'running',
      timestamp: Date.now(),
    };

    set((state) => ({
      operations: [...state.operations, opRecord],
    }));

    try {
      await api.moveEntries(sources, destination);
      set((state) => ({
        operations: state.operations.map((o) =>
          o.id === opId ? { ...o, status: 'completed' } : o
        ),
        undoStack: [
          ...state.undoStack,
          {
            type: 'move',
            items: sources.map((s) => ({
              from: s,
              to: `${destination}\\${s.split('\\').pop()}`,
            })),
          },
        ],
      }));
    } catch (err: any) {
      set((state) => ({
        operations: state.operations.map((o) =>
          o.id === opId ? { ...o, status: 'failed', error: String(err) } : o
        ),
      }));
    }
  },

  executeDelete: async (paths, permanent = false) => {
    const opId = `op-${Date.now()}`;
    const opRecord: FileOperation = {
      id: opId,
      type: 'delete',
      sources: paths,
      status: 'running',
      timestamp: Date.now(),
    };

    set((state) => ({
      operations: [...state.operations, opRecord],
    }));

    try {
      await api.deleteEntries(paths, permanent);
      set((state) => ({
        operations: state.operations.map((o) =>
          o.id === opId ? { ...o, status: 'completed' } : o
        ),
      }));
    } catch (err: any) {
      set((state) => ({
        operations: state.operations.map((o) =>
          o.id === opId ? { ...o, status: 'failed', error: String(err) } : o
        ),
      }));
    }
  },

  // Remote Storage Actions
  setStorageModalOpen: (open) => set({ storageModalOpen: open }),
  setEditingProfileId: (id) => set({ editingProfileId: id }),

  fetchRemoteProfiles: async () => {
    try {
      const profiles = await api.listRemoteProfiles();
      set({ remoteProfiles: profiles });
    } catch (e) {
      console.error('Failed to fetch remote profiles:', e);
    }
  },

  saveRemoteProfile: async (profile, secret) => {
    await api.saveRemoteProfile(profile, secret);
    await get().fetchRemoteProfiles();
  },

  deleteRemoteProfile: async (profileId) => {
    await api.deleteRemoteProfile(profileId);
    await get().fetchRemoteProfiles();
  },

  testRemoteConnection: async (profileId) => {
    try {
      await api.testRemoteConnection(profileId);
      return null;
    } catch (err: any) {
      return String(err);
    }
  },

  connectRemoteProfile: async (profileId) => {
    const profile = get().remoteProfiles.find((p) => p.id === profileId);
    const hostInfo = profile?.host ? `${profile.host}:${profile.port || 22}` : profileId;

    // If profile has no saved password, immediately open password prompt modal
    if (profile && !profile.hasSecret) {
      get().addConnectionLog(`Password required for ${profile.name}. Prompting for credentials...`, 'info', profileId);
      set({ authModalProfile: profile });
      return false;
    }

    get().addConnectionLog(`Initiating connection to ${profile?.name || profileId} (${hostInfo})...`, 'info', profileId);

    try {
      get().addConnectionLog(`Verifying credentials and SSH host key...`, 'info', profileId);
      await api.connectRemoteProfile(profileId);
      set({ activeRemoteProfileId: profileId });
      get().addConnectionLog(`Connected successfully to ${profile?.name || profileId}. Remote root active.`, 'success', profileId);
      await get().fetchRemoteProfiles();
      return true;
    } catch (err: any) {
      const errStr = String(err?.message || err);
      // If error indicates missing or invalid credentials, pop up password modal
      if (errStr.includes('credentials missing') || errStr.includes('Password required') || errStr.includes('Authentication')) {
        if (profile) {
          get().addConnectionLog(`Credentials required for ${profile.name}. Opening password prompt...`, 'info', profileId);
          set({ authModalProfile: profile });
        }
      }
      get().addConnectionLog(`Connection failed to ${profile?.name || profileId}: ${errStr}`, 'error', profileId);
      await get().fetchRemoteProfiles();
      return false;
    }
  },

  disconnectRemoteProfile: async (profileId) => {
    const profile = get().remoteProfiles.find((p) => p.id === profileId);
    get().addConnectionLog(`Disconnecting from ${profile?.name || profileId}...`, 'info', profileId);
    await api.disconnectRemoteProfile(profileId);
    set((state) => ({
      activeRemoteProfileId: state.activeRemoteProfileId === profileId ? null : state.activeRemoteProfileId,
    }));
    get().addConnectionLog(`Disconnected from ${profile?.name || profileId}.`, 'info', profileId);
    await get().fetchRemoteProfiles();
  },

  loadRemoteHistory: async (profileId) => {
    try {
      const history = await api.getRemoteConnectionHistory(profileId);
      set({ remoteHistory: history });
    } catch (e) {
      set({ remoteHistory: [] });
    }
  },

  navigateRemoteTab: (tabId, profileId, pathOrId = 'root') => {
    const remotePath = `remote://${profileId}/${pathOrId}`;
    get().navigateTab(tabId, remotePath);
  },

  importServerDockProfiles: async () => {
    try {
      get().addConnectionLog(`Scanning for ServerDock database and credentials...`, 'info');
      const imported = await api.importServerDockProfiles();
      set({ remoteProfiles: imported });
      get().addConnectionLog(`Successfully imported ${imported.length} connections from ServerDock.`, 'success');
      return imported.length;
    } catch (err: any) {
      get().addConnectionLog(`Failed to import ServerDock connections: ${err?.message || err}`, 'error');
      throw err;
    }
  },

  forgetProfilePassword: async (profileId) => {
    try {
      await api.forgetProfilePassword(profileId);
      get().addConnectionLog(`Cleared saved credentials from Windows Credential Manager.`, 'info', profileId);
      await get().fetchRemoteProfiles();
    } catch (err: any) {
      get().addConnectionLog(`Failed to forget password: ${err?.message || err}`, 'error', profileId);
      throw err;
    }
  },

  addConnectionLog: (message, level = 'info', profileId) => {
    const newLog: ConnectionLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      profileId,
    };
    set((state) => ({
      connectionLogs: [...state.connectionLogs.slice(-199), newLog],
    }));
  },

  clearConnectionLogs: () => set({ connectionLogs: [] }),
}));

