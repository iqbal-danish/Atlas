import React, { useState } from 'react';
import { useAppStore } from '../store';
import { api } from '../api';
import {
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  X,
  ShieldCheck,
  Server,
  AlertCircle,
} from 'lucide-react';

export const QuickAuthModal: React.FC = () => {
  const {
    authModalProfile,
    setAuthModalProfile,
    connectRemoteProfile,
    fetchRemoteProfiles,
    addConnectionLog,
  } = useAppStore();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!authModalProfile) return null;

  const handleClose = () => {
    if (connecting) return;
    setAuthModalProfile(null);
    setPassword('');
    setErrorMsg(null);
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMsg('Please enter a password');
      return;
    }

    setConnecting(true);
    setErrorMsg(null);

    try {
      addConnectionLog(`Saving credentials to Windows Credential Manager for ${authModalProfile.name}...`, 'info', authModalProfile.id);
      
      // Save profile with secret
      await api.saveRemoteProfile(
        authModalProfile,
        rememberPassword ? password : password
      );

      await fetchRemoteProfiles();
      
      addConnectionLog(`Connecting to ${authModalProfile.name}...`, 'info', authModalProfile.id);
      await api.connectRemoteProfile(authModalProfile.id);

      useAppStore.setState({ activeRemoteProfileId: authModalProfile.id });
      addConnectionLog(`Connected successfully to ${authModalProfile.name}.`, 'success', authModalProfile.id);

      setAuthModalProfile(null);
      setPassword('');
    } catch (err: any) {
      const msg = String(err?.message || err);
      setErrorMsg(msg);
      addConnectionLog(`Authentication failed: ${msg}`, 'error', authModalProfile.id);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 select-none animate-in fade-in duration-100">
      <div className="bg-background border border-border rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface/50">
          <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
            <div className="w-7 h-7 rounded-lg bg-accent/15 text-accent flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <span>Authentication Required</span>
          </div>
          <button
            onClick={handleClose}
            disabled={connecting}
            className="p-1 text-muted hover:text-foreground rounded hover:bg-surface disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleConnect} className="p-4 flex flex-col gap-4 text-xs">
          {/* Server Info Card */}
          <div className="p-3 bg-surface/40 rounded-lg border border-border/50 flex items-start gap-2.5">
            <Server className="w-4 h-4 text-accent mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="font-semibold text-foreground text-xs truncate">
                {authModalProfile.name}
              </div>
              <div className="text-[11px] text-muted font-mono truncate mt-0.5">
                {authModalProfile.username || 'user'}@{authModalProfile.host}:{authModalProfile.port || 22}
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Password Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-muted font-medium text-[11px]">
              Password / Private Key Passphrase
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                autoFocus
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password to connect..."
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted focus:outline-none focus:border-accent pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground p-0.5"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Remember Password Checkbox */}
          <label className="flex items-center gap-2 cursor-pointer text-muted hover:text-foreground">
            <input
              type="checkbox"
              checked={rememberPassword}
              onChange={(e) => setRememberPassword(e.target.checked)}
              className="rounded border-border accent-accent"
            />
            <span className="flex items-center gap-1.5 text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Save password securely in Windows Credential Manager
            </span>
          </label>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border mt-1">
            <button
              type="button"
              onClick={handleClose}
              disabled={connecting}
              className="px-3 py-1.5 rounded-lg border border-border hover:bg-surface text-muted hover:text-foreground text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={connecting || !password.trim()}
              className="px-4 py-1.5 rounded-lg bg-accent text-accent-foreground font-medium text-xs shadow-sm hover:bg-accent/90 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
            >
              {connecting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Connect</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
