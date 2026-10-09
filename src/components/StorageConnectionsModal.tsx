import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { ConnectionProfile, StorageProviderType } from '../types';
import {
  Cloud,
  Server,
  FolderSync,
  Plus,
  Trash2,
  Plug,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  ShieldAlert,
  X,
  Key,
  FolderOpen,
  History,
  KeyRound,
  DownloadCloud,
  Loader2,
} from 'lucide-react';
import { ConnectionLogConsole } from './ConnectionLogConsole';

const createProfileId = () => `prof_${Date.now()}`;

export const StorageConnectionsModal: React.FC = () => {
  const {
    storageModalOpen,
    setStorageModalOpen,
    editingProfileId,
    setEditingProfileId,
    remoteProfiles,
    saveRemoteProfile,
    deleteRemoteProfile,
    testRemoteConnection,
    connectRemoteProfile,
    disconnectRemoteProfile,
    navigateRemoteTab,
    activeTabId,
    remoteHistory,
    loadRemoteHistory,
    importServerDockProfiles,
    forgetProfilePassword,
  } = useAppStore();

  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; msg: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [providerType, setProviderType] = useState<StorageProviderType>('sftp');
  const [host, setHost] = useState('');
  const [port, setPort] = useState<number>(22);
  const [username, setUsername] = useState('');
  const [remoteRoot, setRemoteRoot] = useState('/');
  const [timeoutSecs, setTimeoutSecs] = useState(30);
  const [secret, setSecret] = useState('');
  const [useFtps, setUseFtps] = useState(true);
  const [passiveMode, setPassiveMode] = useState(true);
  const [trustHostKey, setTrustHostKey] = useState(true);
  const [clientId, setClientId] = useState('');
  const [accountType, setAccountType] = useState('personal');

  useEffect(() => {
    if (editingProfileId) {
      const p = remoteProfiles.find((x) => x.id === editingProfileId);
      if (p) {
        setSelectedProfileId(p.id);
        setIsEditing(true);
        setName(p.name);
        setProviderType(p.providerType);
        setHost(p.host || '');
        setPort(p.port || (p.providerType === 'sftp' ? 22 : 21));
        setUsername(p.username || '');
        setRemoteRoot(p.remoteRoot || '/');
        setTimeoutSecs(p.timeoutSecs || 30);
        setSecret('');
      }
    } else if (remoteProfiles.length > 0 && !selectedProfileId) {
      setSelectedProfileId(remoteProfiles[0].id);
    }
  }, [editingProfileId, remoteProfiles, selectedProfileId]);

  if (!storageModalOpen) return null;

  const currentProfile = remoteProfiles.find((p) => p.id === selectedProfileId);

  const handleStartNew = (type: StorageProviderType = 'sftp') => {
    setIsEditing(true);
    setSelectedProfileId(null);
    setName(`My ${type.toUpperCase()}`);
    setProviderType(type);
    setHost(type === 'sftp' ? 'sftp.example.com' : type === 'ftp' ? 'ftp.example.com' : '');
    setPort(type === 'sftp' ? 22 : type === 'ftp' ? 21 : 0);
    setUsername('admin');
    setRemoteRoot('/');
    setTimeoutSecs(30);
    setSecret('');
    setUseFtps(true);
    setPassiveMode(true);
    setTrustHostKey(true);
    setClientId(type === 'google_drive' ? 'google-client-id.apps.googleusercontent.com' : 'onedrive-client-id');
    setAccountType('personal');
    setTestResult(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = currentProfile?.id || createProfileId();
    const newProfile: ConnectionProfile = {
      id,
      name,
      providerType,
      host: ['sftp', 'ftp'].includes(providerType) ? host : undefined,
      port: ['sftp', 'ftp'].includes(providerType) ? port : undefined,
      username: ['sftp', 'ftp'].includes(providerType) ? username : undefined,
      remoteRoot,
      timeoutSecs,
      status: 'disconnected',
      hasSecret: Boolean(secret) || (currentProfile?.hasSecret ?? false),
      config: {
        use_ftps: useFtps,
        passive_mode: passiveMode,
        trust_host_key: trustHostKey,
        client_id: clientId,
        account_type: accountType,
      },
    };

    await saveRemoteProfile(newProfile, secret || undefined);
    setIsEditing(false);
    setSelectedProfileId(id);
    setSecret('');
  };

  const handleTestConnection = async (profileId: string) => {
    setTestingId(profileId);
    setTestResult(null);
    const err = await testRemoteConnection(profileId);
    setTestingId(null);
    if (!err) {
      setTestResult({ id: profileId, success: true, msg: 'Connection verified successfully!' });
    } else {
      setTestResult({ id: profileId, success: false, msg: err });
    }
  };

  const handleConnectToggle = async (profile: ConnectionProfile) => {
    if (profile.status === 'connected') {
      await disconnectRemoteProfile(profile.id);
    } else {
      await connectRemoteProfile(profile.id);
    }
  };

  const handleBrowse = (profileId: string) => {
    navigateRemoteTab(activeTabId, profileId, 'root');
    setStorageModalOpen(false);
  };

  const handleViewHistory = async (profileId: string) => {
    await loadRemoteHistory(profileId);
    setShowHistory(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-4xl h-[620px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-surface/50">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-accent/15 text-accent rounded-lg">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Storage Connections & Cloud</h2>
              <p className="text-[11px] text-muted">
                Manage SFTP, FTP/FTPS, Google Drive, and OneDrive storage profiles
              </p>
            </div>
          </div>
          <button
            onClick={() => setStorageModalOpen(false)}
            className="p-1.5 text-muted hover:text-foreground rounded-md hover:bg-surface transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body: Profiles Sidebar + Detail/Edit Pane */}
        <div className="flex-1 flex overflow-hidden">
          {/* Profiles Column */}
          <div className="w-72 border-r border-border bg-sidebar/50 flex flex-col">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase text-muted tracking-wider">
                Profiles ({remoteProfiles.length})
              </span>
              <button
                onClick={() => handleStartNew('sftp')}
                className="flex items-center gap-1 text-[11px] bg-accent text-accent-foreground px-2 py-1 rounded-md font-medium hover:bg-accent/90 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>

            <div className="p-2 border-b border-border/50">
              <button
                onClick={async () => {
                  try {
                    const count = await importServerDockProfiles();
                    if (count > 0 && remoteProfiles.length > 0) {
                      setSelectedProfileId(remoteProfiles[0].id);
                    }
                  } catch (e) {
                    console.error('Import error:', e);
                  }
                }}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-accent/15 hover:bg-accent/25 text-accent text-xs font-medium border border-accent/20 transition-colors"
              >
                <DownloadCloud className="w-3.5 h-3.5" />
                Import from ServerDock
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
              {remoteProfiles.length === 0 ? (
                <div className="p-4 text-center text-muted text-xs italic">
                  No remote connections configured. Click "Add" above to connect SFTP, FTP, or Cloud storage.
                </div>
              ) : (
                remoteProfiles.map((p) => {
                  const isSelected = p.id === selectedProfileId && !isEditing;
                  const isConnected = p.status === 'connected';

                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedProfileId(p.id);
                        setIsEditing(false);
                        setShowHistory(false);
                        setTestResult(null);
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-surface-active border border-accent/30 text-foreground shadow-sm'
                          : 'hover:bg-surface text-muted hover:text-foreground border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {p.providerType === 'sftp' && <Server className="w-4 h-4 text-cyan-400 shrink-0" />}
                        {p.providerType === 'ftp' && <FolderSync className="w-4 h-4 text-amber-400 shrink-0" />}
                        {p.providerType === 'google_drive' && <Cloud className="w-4 h-4 text-emerald-400 shrink-0" />}
                        {p.providerType === 'onedrive' && <Cloud className="w-4 h-4 text-blue-400 shrink-0" />}
                        {p.providerType === 'mock' && <Cloud className="w-4 h-4 text-purple-400 shrink-0" />}

                        <div className="min-w-0">
                          <div className="text-xs font-medium truncate text-foreground">{p.name}</div>
                          <div className="text-[10px] text-muted truncate">
                            {p.host || p.providerType.replace('_', ' ').toUpperCase()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isConnected
                              ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                              : p.status === 'error'
                              ? 'bg-rose-500'
                              : 'bg-muted/40'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick Provider Add Buttons */}
            <div className="p-2 border-t border-border bg-surface/30 grid grid-cols-2 gap-1 text-[10px]">
              <button
                onClick={() => handleStartNew('sftp')}
                className="p-1.5 rounded hover:bg-surface text-muted hover:text-foreground text-left"
              >
                + SFTP (SSH)
              </button>
              <button
                onClick={() => handleStartNew('ftp')}
                className="p-1.5 rounded hover:bg-surface text-muted hover:text-foreground text-left"
              >
                + FTP / FTPS
              </button>
              <button
                onClick={() => handleStartNew('google_drive')}
                className="p-1.5 rounded hover:bg-surface text-muted hover:text-foreground text-left"
              >
                + Google Drive
              </button>
              <button
                onClick={() => handleStartNew('onedrive')}
                className="p-1.5 rounded hover:bg-surface text-muted hover:text-foreground text-left"
              >
                + OneDrive
              </button>
            </div>
          </div>

          {/* Details / Form View */}
          <div className="flex-1 flex flex-col overflow-y-auto bg-background/50 p-6">
            {isEditing ? (
              /* Profile Edit / Create Form */
              <form onSubmit={handleSave} className="flex flex-col gap-4 max-w-xl">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground">
                    {currentProfile ? 'Edit Connection Profile' : 'Configure New Remote Connection'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="text-xs text-muted hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-foreground">Profile Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      placeholder="e.g. Production Web Server"
                      className="px-2.5 py-1.5 bg-surface border border-border rounded-md text-xs text-foreground focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-foreground">Storage Provider</label>
                    <select
                      value={providerType}
                      onChange={(e) => {
                        const val = e.target.value as StorageProviderType;
                        setProviderType(val);
                        if (val === 'sftp') setPort(22);
                        if (val === 'ftp') setPort(21);
                      }}
                      className="px-2.5 py-1.5 bg-surface border border-border rounded-md text-xs text-foreground focus:outline-none focus:border-accent"
                    >
                      <option value="sftp">SFTP over SSH</option>
                      <option value="ftp">FTP / FTPS (TLS)</option>
                      <option value="google_drive">Google Drive (OAuth)</option>
                      <option value="onedrive">Microsoft OneDrive (Graph API)</option>
                      <option value="mock">Mock Test Provider (Offline Simulation)</option>
                    </select>
                  </div>
                </div>

                {/* SFTP / FTP Server settings */}
                {['sftp', 'ftp'].includes(providerType) && (
                  <div className="flex flex-col gap-3 p-3 bg-surface/30 rounded-lg border border-border">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2 flex flex-col gap-1">
                        <label className="text-[11px] font-medium text-foreground">Host / IP Address</label>
                        <input
                          type="text"
                          value={host}
                          onChange={(e) => setHost(e.target.value)}
                          required
                          placeholder="sftp.yourdomain.com"
                          className="px-2.5 py-1.5 bg-surface border border-border rounded-md text-xs text-foreground focus:outline-none focus:border-accent"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-medium text-foreground">Port</label>
                        <input
                          type="number"
                          value={port}
                          onChange={(e) => setPort(Number(e.target.value))}
                          required
                          className="px-2.5 py-1.5 bg-surface border border-border rounded-md text-xs text-foreground focus:outline-none focus:border-accent"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-medium text-foreground">Username</label>
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          required
                          className="px-2.5 py-1.5 bg-surface border border-border rounded-md text-xs text-foreground focus:outline-none focus:border-accent"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-medium text-foreground">Remote Root Path</label>
                        <input
                          type="text"
                          value={remoteRoot}
                          onChange={(e) => setRemoteRoot(e.target.value)}
                          placeholder="/ or /var/www"
                          className="px-2.5 py-1.5 bg-surface border border-border rounded-md text-xs text-foreground focus:outline-none focus:border-accent"
                        />
                      </div>
                    </div>

                    {/* Unencrypted FTP Warning Banner */}
                    {providerType === 'ftp' && !useFtps && (
                      <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-md flex items-start gap-2 text-amber-400 text-[11px]">
                        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <strong>Security Warning:</strong> Plain unencrypted FTP transmits passwords and transferred
                          file data in plaintext over the network. It is strongly recommended to enable Explicit FTPS
                          below.
                        </div>
                      </div>
                    )}

                    {providerType === 'ftp' && (
                      <div className="flex items-center gap-4 text-xs">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={useFtps}
                            onChange={(e) => setUseFtps(e.target.checked)}
                            className="rounded border-border text-accent focus:ring-accent"
                          />
                          <span>Explicit FTPS (TLS)</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={passiveMode}
                            onChange={(e) => setPassiveMode(e.target.checked)}
                            className="rounded border-border text-accent focus:ring-accent"
                          />
                          <span>Passive Mode (PASV)</span>
                        </label>
                      </div>
                    )}

                    {providerType === 'sftp' && (
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={trustHostKey}
                          onChange={(e) => setTrustHostKey(e.target.checked)}
                          className="rounded border-border text-accent focus:ring-accent"
                        />
                        <span>Verify and remember SSH host key fingerprint</span>
                      </label>
                    )}
                  </div>
                )}

                {/* OAuth Client Settings for Google Drive / OneDrive */}
                {['google_drive', 'onedrive'].includes(providerType) && (
                  <div className="flex flex-col gap-3 p-3 bg-surface/30 rounded-lg border border-border">
                    <div className="flex items-center gap-2 text-xs font-medium text-accent">
                      <ShieldCheck className="w-4 h-4" />
                      OAuth 2.0 PKCE Authorization (Desktop Secure)
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-medium text-foreground">Application Client ID</label>
                      <input
                        type="text"
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        placeholder="Enter registered OAuth Client ID"
                        className="px-2.5 py-1.5 bg-surface border border-border rounded-md text-xs text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>
                    {providerType === 'onedrive' && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-medium text-foreground">Account Type</label>
                        <select
                          value={accountType}
                          onChange={(e) => setAccountType(e.target.value)}
                          className="px-2.5 py-1.5 bg-surface border border-border rounded-md text-xs text-foreground focus:outline-none focus:border-accent"
                        >
                          <option value="personal">Personal Microsoft Account</option>
                          <option value="work_school">Work or School (Entra ID / Office 365)</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {/* Password / Secret Field */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium text-foreground flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-muted" />
                      {['sftp', 'ftp'].includes(providerType)
                        ? 'Password or Private Key Passphrase'
                        : 'OAuth Access / Refresh Token'}
                    </label>
                    <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      Secured by Windows Credential Manager
                    </span>
                  </div>
                  <input
                    type="password"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    placeholder={
                      currentProfile?.hasSecret
                        ? '•••••••••••••••• (Leave blank to keep existing stored secret)'
                        : 'Enter secret...'
                    }
                    className="px-2.5 py-1.5 bg-surface border border-border rounded-md text-xs text-foreground focus:outline-none focus:border-accent"
                  />
                  <p className="text-[10px] text-muted">
                    Secrets are encrypted and never stored in plaintext SQLite database or settings files.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 rounded-md text-xs text-muted hover:text-foreground hover:bg-surface"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-md text-xs bg-accent text-accent-foreground font-medium hover:bg-accent/90 shadow-sm"
                  >
                    Save Profile
                  </button>
                </div>
              </form>
            ) : currentProfile ? (
              /* Selected Profile Overview View */
              <div className="flex flex-col gap-5 max-w-xl">
                <div className="flex items-start justify-between pb-4 border-b border-border">
                  <div>
                    <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                      {currentProfile.name}
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          currentProfile.status === 'connected'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : currentProfile.status === 'error'
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            : 'bg-muted/15 text-muted border border-border'
                        }`}
                      >
                        {currentProfile.status.toUpperCase()}
                      </span>
                    </h3>
                    <p className="text-xs text-muted mt-0.5">
                      {currentProfile.providerType.replace('_', ' ').toUpperCase()} •{' '}
                      {currentProfile.host || 'Cloud Provider API'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setIsEditing(true);
                        setName(currentProfile.name);
                        setProviderType(currentProfile.providerType);
                        setHost(currentProfile.host || '');
                        setPort(currentProfile.port || 22);
                        setUsername(currentProfile.username || '');
                        setRemoteRoot(currentProfile.remoteRoot || '/');
                        setTimeoutSecs(currentProfile.timeoutSecs);
                        setSecret('');
                      }}
                      className="px-2.5 py-1 rounded-md text-xs bg-surface hover:bg-surface-active text-foreground border border-border"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteRemoteProfile(currentProfile.id)}
                      className="p-1 rounded-md text-rose-400 hover:bg-rose-500/10 border border-transparent"
                      title="Delete Profile"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleConnectToggle(currentProfile)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors shadow-sm ${
                      currentProfile.status === 'connected'
                        ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30'
                        : 'bg-accent text-accent-foreground hover:bg-accent/90'
                    }`}
                  >
                    <Plug className="w-3.5 h-3.5" />
                    {currentProfile.status === 'connected' ? 'Disconnect' : 'Connect'}
                  </button>

                  <button
                    onClick={() => handleBrowse(currentProfile.id)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-surface hover:bg-surface-active text-foreground border border-border shadow-sm"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-accent" />
                    Open in Tab
                  </button>

                  <button
                    onClick={() => handleTestConnection(currentProfile.id)}
                    disabled={testingId === currentProfile.id}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs text-muted hover:text-foreground hover:bg-surface border border-border transition-colors"
                  >
                    {testingId === currentProfile.id ? (
                      <Clock className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-muted" />
                    )}
                    Test Connection
                  </button>

                  <button
                    onClick={() => handleViewHistory(currentProfile.id)}
                    className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs text-muted hover:text-foreground hover:bg-surface border border-border"
                    title="View Connection History"
                  >
                    <History className="w-3.5 h-3.5" />
                  </button>

                  {currentProfile.hasSecret && (
                    <button
                      onClick={async () => {
                        await forgetProfilePassword(currentProfile.id);
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs text-rose-400 hover:bg-rose-500/10 border border-border transition-colors ml-auto"
                      title="Forget saved password from Windows Credential Manager"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      Forget Password
                    </button>
                  )}
                </div>

                {/* Test Result Message */}
                {testResult && testResult.id === currentProfile.id && (
                  <div
                    className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
                      testResult.success
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{testResult.msg}</span>
                  </div>
                )}

                {/* Connection Details Metadata */}
                <div className="grid grid-cols-2 gap-3 p-3.5 bg-surface/30 rounded-lg border border-border text-xs">
                  <div>
                    <span className="text-[10px] text-muted uppercase font-semibold">Remote Root</span>
                    <div className="font-mono text-foreground mt-0.5">{currentProfile.remoteRoot || '/'}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted uppercase font-semibold">Credential Storage</span>
                    <div className="text-foreground mt-0.5 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      Windows Credential Manager
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted uppercase font-semibold">Timeout</span>
                    <div className="text-foreground mt-0.5">{currentProfile.timeoutSecs} seconds</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted uppercase font-semibold">Last Connection</span>
                    <div className="text-foreground mt-0.5">
                      {currentProfile.lastConnected
                        ? new Date(currentProfile.lastConnected * 1000).toLocaleString()
                        : 'Never connected'}
                    </div>
                  </div>
                </div>

                {/* Connection History Drawer */}
                {showHistory && (
                  <div className="flex flex-col gap-2 p-3 bg-surface/40 rounded-lg border border-border">
                    <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                      <span>Connection History (Excludes Secrets)</span>
                      <button
                        onClick={() => setShowHistory(false)}
                        className="text-[10px] text-muted hover:text-foreground"
                      >
                        Hide
                      </button>
                    </div>
                    {remoteHistory.length === 0 ? (
                      <div className="text-xs text-muted italic">No recorded connections yet.</div>
                    ) : (
                      <div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
                        {remoteHistory.map((h) => (
                          <div
                            key={h.id}
                            className="flex items-center justify-between text-[11px] p-1.5 bg-surface rounded"
                          >
                            <span className="text-muted">
                              {new Date(h.connectedAt * 1000).toLocaleTimeString()}
                            </span>
                            <span
                              className={`font-medium ${
                                h.status === 'connected' ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {h.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Live Connection & Handshake Logs */}
                <div className="pt-2">
                  <ConnectionLogConsole profileIdFilter={currentProfile.id} maxHeight="max-h-36" />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted">
                <Cloud className="w-12 h-12 text-muted/40 mb-3" />
                <h3 className="text-sm font-semibold text-foreground">No Connection Profile Selected</h3>
                <p className="text-xs max-w-sm mt-1">
                  Select an existing profile on the left or click "Add" to configure a new SFTP, FTP, or cloud
                  connection.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
