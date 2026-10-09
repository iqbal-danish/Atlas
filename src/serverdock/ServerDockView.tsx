import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ConnectionSidebar } from './components/Sidebar/ConnectionSidebar';
import { FileBrowser } from './components/FileBrowser/FileBrowser';
import { LargeFileEditor } from './components/Editor/LargeFileEditor';
import { FileDiffViewer } from './components/Diff/FileDiffViewer';
import { TransferQueuePanel } from './components/TransferQueue/TransferQueuePanel';
import { AddConnectionModal } from './components/ConnectionDialog/AddConnectionModal';
import { SettingsModal } from './components/Settings/SettingsModal';
import { ActiveTab, ConnectionProfile } from './types';
import { useConnectionStore } from './stores/connectionStore';
import { useFileStore } from './stores/fileStore';
import { useTransferStore } from './stores/transferStore';
import { api } from './services/api';

export const ServerDockView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('files');
  const [isAddConnectionOpen, setIsAddConnectionOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ConnectionProfile | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isServerSidebarOpen, setIsServerSidebarOpen] = useState(false);

  const { loadProfiles, refreshStatus } = useConnectionStore();
  const { initLocalDirectory } = useFileStore();
  const { loadTransfers, updateTransferItem } = useTransferStore();

  useEffect(() => {
    // 1. Initialize profiles, directory, and transfers
    loadProfiles();
    initLocalDirectory();
    loadTransfers();
    refreshStatus();

    // 2. Subscribe to real-time Rust transfer progress events
    let isMounted = true;
    let unlistenFn: (() => void) | undefined;
    api
      .onTransferUpdate((item) => {
        if (isMounted) updateTransferItem(item);
      })
      .then((fn) => {
        if (!isMounted) {
          fn();
        } else {
          unlistenFn = fn;
        }
      })
      .catch((err) => {
        console.error('Failed to register transfer listener:', err);
      });

    return () => {
      isMounted = false;
      if (unlistenFn) unlistenFn();
    };
  }, []);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-[#0a0a0c] text-[#ededed]">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        openSettings={() => setIsSettingsOpen(true)}
        isServerSidebarOpen={isServerSidebarOpen}
        onToggleServerSidebar={() => setIsServerSidebarOpen((prev) => !prev)}
      />

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Connection Sidebar (Collapsible in Option A) */}
        {isServerSidebarOpen && (
          <ConnectionSidebar
            onOpenAddModal={() => {
              setEditingProfile(null);
              setIsAddConnectionOpen(true);
            }}
            onEditProfile={(profile) => {
              setEditingProfile(profile);
              setIsAddConnectionOpen(true);
            }}
          />
        )}

        {/* Central Workspace */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {activeTab === 'files' && (
            <FileBrowser
              onSwitchTab={(tab) => {
                setActiveTab(tab);
              }}
            />
          )}

          {activeTab === 'editor' && <LargeFileEditor />}

          {activeTab === 'diff' && <FileDiffViewer />}
        </main>
      </div>

      {/* Bottom Transfer Queue Drawer */}
      <TransferQueuePanel />

      {/* Add / Edit Connection Modal */}
      <AddConnectionModal
        isOpen={isAddConnectionOpen}
        onClose={() => {
          setIsAddConnectionOpen(false);
          setEditingProfile(null);
        }}
        initialProfile={editingProfile}
      />

      {/* Settings & Diagnostics Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

export default ServerDockView;
