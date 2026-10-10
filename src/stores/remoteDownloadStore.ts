import { create } from 'zustand';
import { api } from '../api';
import { api as serverdockApi } from '../serverdock/services/api';
import { useTransferStore } from '../serverdock/stores/transferStore';
import { UnlistenFn } from '@tauri-apps/api/event';

export type PowerToolApp = 'ultraviewer' | 'feedlens' | 'transformlab' | 'default';

interface RemoteDownloadState {
  isOpen: boolean;
  appName: PowerToolApp;
  fileName: string;
  remotePath: string;
  destPath: string;
  totalBytes: number;
  transferredBytes: number;
  speedBytesPerSec: number;
  status: 'idle' | 'downloading' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  transferId?: string;

  startDownload: (params: {
    appName: PowerToolApp;
    remotePath: string;
    fileName: string;
    totalBytes: number;
    remoteProfileId?: string;
  }) => Promise<void>;
  cancelDownload: () => Promise<void>;
  closeModal: () => void;
}

let activeUnlisten: UnlistenFn | null = null;

export const useRemoteDownloadStore = create<RemoteDownloadState>((set, get) => ({
  isOpen: false,
  appName: 'default',
  fileName: '',
  remotePath: '',
  destPath: '',
  totalBytes: 0,
  transferredBytes: 0,
  speedBytesPerSec: 0,
  status: 'idle',
  error: undefined,
  transferId: undefined,

  startDownload: async ({ appName, remotePath, fileName, totalBytes, remoteProfileId }) => {
    // 1. Resolve cached local file destination in %TEMP%\Atlas\remote_cache
    let destPath = '';
    try {
      destPath = await api.getRemoteCachePath(remotePath, fileName);
    } catch (e) {
      console.warn('Failed to resolve cache path, falling back:', e);
      destPath = `C:\\Temp\\Atlas\\remote_cache\\${fileName}`;
    }

    // 2. Check if already cached with exact matching size
    try {
      const isCached = await api.checkCachedRemoteFile(destPath, totalBytes);
      if (isCached) {
        if (appName === 'default') {
          await api.openFile(destPath);
        } else {
          await api.openWithApp(appName, destPath);
        }
        return;
      }
    } catch (e) {
      console.warn('Cache verification check error:', e);
    }

    // Clean up any prior transfer listener
    if (activeUnlisten) {
      activeUnlisten();
      activeUnlisten = null;
    }

    // 3. Open download progress modal
    set({
      isOpen: true,
      appName,
      fileName,
      remotePath,
      destPath,
      totalBytes,
      transferredBytes: 0,
      speedBytesPerSec: 0,
      status: 'downloading',
      error: undefined,
      transferId: undefined,
    });

    // 4. Handle Atlas legacy remote profile vs ServerDock SFTP download
    if (remotePath.startsWith('remote://')) {
      const rest = remotePath.slice('remote://'.length);
      const slashIdx = rest.indexOf('/');
      const profileId = remoteProfileId || (slashIdx === -1 ? rest : rest.slice(0, slashIdx));
      const pathOrId = slashIdx === -1 ? fileName : rest.slice(slashIdx + 1) || fileName;

      try {
        set({ transferredBytes: Math.round(totalBytes * 0.1) });
        await api.downloadRemoteFile(profileId, pathOrId, destPath);

        set({
          transferredBytes: totalBytes,
          status: 'completed',
        });

        // Launch target desktop tool
        setTimeout(async () => {
          try {
            if (appName === 'default') {
              await api.openFile(destPath);
            } else {
              await api.openWithApp(appName, destPath);
            }
          } catch (launchErr: any) {
            console.error('Failed to launch application:', launchErr);
          }
          get().closeModal();
        }, 350);
      } catch (err: any) {
        set({
          status: 'failed',
          error: String(err?.message || err),
        });
      }
      return;
    }

    // 5. ServerDock pipelined SFTP transfer with live streaming telemetry
    try {
      const id = await serverdockApi.queueTransfer(
        fileName,
        'Download',
        remotePath,
        destPath,
        totalBytes
      );

      set({ transferId: id });
      useTransferStore.getState().loadTransfers();

      activeUnlisten = await serverdockApi.onTransferUpdate((item) => {
        if (item.id !== id) return;

        set({
          transferredBytes: item.transferred_bytes,
          speedBytesPerSec: item.speed_bytes_per_sec,
          totalBytes: item.total_bytes || totalBytes,
        });

        if (item.status === 'Completed') {
          if (activeUnlisten) {
            activeUnlisten();
            activeUnlisten = null;
          }
          set({ status: 'completed' });

          setTimeout(async () => {
            try {
              if (appName === 'default') {
                await api.openFile(destPath);
              } else {
                await api.openWithApp(appName, destPath);
              }
            } catch (launchErr: any) {
              console.error('Failed to launch tool:', launchErr);
            }
            get().closeModal();
          }, 350);
        } else if (item.status === 'Failed') {
          if (activeUnlisten) {
            activeUnlisten();
            activeUnlisten = null;
          }
          set({
            status: 'failed',
            error: item.error || 'SFTP download transfer failed.',
          });
        }
      });
    } catch (queueErr: any) {
      set({
        status: 'failed',
        error: String(queueErr?.message || queueErr),
      });
    }
  },

  cancelDownload: async () => {
    const { transferId } = get();
    if (activeUnlisten) {
      activeUnlisten();
      activeUnlisten = null;
    }

    if (transferId) {
      try {
        await serverdockApi.cancelTransfer(transferId);
      } catch (e) {
        console.warn('Failed to cancel transfer:', e);
      }
    }

    set({ status: 'cancelled', isOpen: false });
  },

  closeModal: () => {
    if (activeUnlisten) {
      activeUnlisten();
      activeUnlisten = null;
    }
    set({ isOpen: false, status: 'idle' });
  },
}));
