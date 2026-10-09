import React from "react";
import {
  ArrowLeftRight,
  Server,
  Cloud,
  FileCode,
  GitCompare,
  Power,
  PowerOff,
  Settings as SettingsIcon,
  Terminal,
} from "lucide-react";
import { ActiveTab } from "../types";
import { useConnectionStore } from "../stores/connectionStore";
import { useTransferStore } from "../stores/transferStore";
import { useLogStore } from "../stores/logStore";

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  openSettings: () => void;
  isServerSidebarOpen?: boolean;
  onToggleServerSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  openSettings,
  isServerSidebarOpen = false,
  onToggleServerSidebar,
}) => {
  const { status, connectedProfiles, disconnect } = useConnectionStore();
  const { transfers, isOpen, setIsOpen } = useTransferStore();
  const { logs, isOpen: isLogOpen, toggleOpen: toggleLogOpen } = useLogStore();

  const activeTransfers = transfers.filter(
    (t) => t.status === "Running" || t.status === "Queued"
  ).length;

  const errorCount = logs.filter((l) => l.level === "ERROR").length;

  return (
    <header className="h-12 bg-[#111114] border-b border-[#202026] px-3 flex items-center justify-between select-none">
      {/* Brand & Tabs */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 font-semibold text-white tracking-wide">
          <div className="w-6 h-6 rounded bg-[#0c7bea]/15 border border-[#0c7bea]/30 flex items-center justify-center">
            <Cloud className="w-3.5 h-3.5 text-[#0c7bea]" />
          </div>
          <span className="text-sm">Remote & Cloud</span>
          <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-[#16161a] text-[#8e8e93] border border-[#202026]">
            SFTP / FTP
          </span>
        </div>

        {/* Toggle Server Sidebar */}
        {onToggleServerSidebar && (
          <button
            onClick={onToggleServerSidebar}
            title={isServerSidebarOpen ? "Hide Servers panel" : "Show Servers panel"}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
              isServerSidebarOpen
                ? "bg-[#0c7bea]/15 border-[#0c7bea]/40 text-[#0c7bea]"
                : "bg-[#16161a] border-[#202026] text-[#8e8e93] hover:text-white hover:bg-[#16161a]/80"
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Servers</span>
          </button>
        )}

        <div className="h-4 w-px bg-[#202026]" />

        {/* Navigation Tabs */}
        <nav className="flex items-center space-x-1">
          <button
            onClick={() => setActiveTab("files")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === "files"
                ? "bg-[#16161a] text-white border border-[#202026]"
                : "text-[#8e8e93] hover:text-white hover:bg-[#16161a]/50"
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>File Transfer</span>
          </button>

          <button
            onClick={() => setActiveTab("editor")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === "editor"
                ? "bg-[#16161a] text-white border border-[#202026]"
                : "text-[#8e8e93] hover:text-white hover:bg-[#16161a]/50"
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Large-File Editor</span>
          </button>

          <button
            onClick={() => setActiveTab("diff")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === "diff"
                ? "bg-[#16161a] text-white border border-[#202026]"
                : "text-[#8e8e93] hover:text-white hover:bg-[#16161a]/50"
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Diff Viewer</span>
          </button>
        </nav>
      </div>

      {/* Right Status & Controls */}
      <div className="flex items-center space-x-3">
        {/* Connection Status Pill */}
        <div className="flex items-center space-x-2 text-xs px-2.5 py-1 rounded bg-[#0a0a0c] border border-[#202026]">
          {status.connected ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-white font-mono-code text-[11px]">
                {status.username ? `${status.username}@` : ""}
                {status.host}
              </span>
              {connectedProfiles.length > 1 && (
                <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/30">
                  +{connectedProfiles.length - 1} more
                </span>
              )}
              <button
                onClick={() => disconnect()}
                title="Disconnect all servers"
                className="text-red-400 hover:text-red-300 ml-1 p-0.5"
              >
                <PowerOff className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-gray-500" />
              <span className="text-[#8e8e93]">Disconnected</span>
            </>
          )}
        </div>

        {/* Transfer Queue Toggle Pill */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center space-x-1.5 text-xs px-2.5 py-1 rounded border transition-colors ${
            isOpen
              ? "bg-blue-600/20 border-blue-500/50 text-blue-300"
              : "bg-[#16161a] border-[#202026] text-[#8e8e93] hover:text-white"
          }`}
        >
          <span>Transfers</span>
          {activeTransfers > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-blue-500 text-white font-semibold text-[10px]">
              {activeTransfers}
            </span>
          )}
        </button>

        {/* Connection Logs Toggle Pill */}
        <button
          onClick={() => {
            if (activeTab !== "files") {
              setActiveTab("files");
            }
            toggleLogOpen();
          }}
          className={`flex items-center space-x-1.5 text-xs px-2.5 py-1 rounded border transition-colors ${
            isLogOpen
              ? "bg-purple-600/20 border-purple-500/50 text-purple-300"
              : "bg-[#16161a] border-[#202026] text-[#8e8e93] hover:text-white"
          }`}
          title="Toggle Connection Logs"
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Logs</span>
          {errorCount > 0 ? (
            <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white font-semibold text-[10px]">
              {errorCount}
            </span>
          ) : logs.length > 0 ? (
            <span className="px-1.5 py-0.2 rounded-full bg-[#202026] text-[#8e8e93] text-[10px]">
              {logs.length}
            </span>
          ) : null}
        </button>

        {/* Settings Button */}
        <button
          onClick={openSettings}
          title="Settings & Logs"
          className="p-1.5 rounded text-[#8e8e93] hover:text-white hover:bg-[#16161a] transition-colors"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
