import { invoke } from '@tauri-apps/api/core';
import {
  ArchiveEntryInfo,
  BatchRenamePair,
  CompareResult,
  ConnectionHistoryItem,
  ConnectionProfile,
  DirSizeInfo,
  DirectoryListing,
  DriveInfo,
  FilePreview,
  FsEntry,
  HashResult,
  OAuthInitResult,
  ProviderCapabilities,
  RecycleBinEntry,
  RemoteItem,
  SearchResult,
  SystemFolders,
} from './types';

export const api = {
  getDrives: async (): Promise<DriveInfo[]> => {
    try {
      return await invoke('get_drives');
    } catch (e) {
      console.warn('invoke get_drives fallback:', e);
      return [
        {
          mountPoint: 'C:\\',
          volumeLabel: 'Local Disk (C:)',
          totalBytes: 512000000000,
          availableBytes: 256000000000,
          driveType: 'Local Disk',
          isRemovable: false,
        },
      ];
    }
  },

  readDirectory: async (path: string, showHidden = false): Promise<DirectoryListing> => {
    if (path.startsWith('remote://')) {
      const rest = path.slice('remote://'.length);
      const slashIdx = rest.indexOf('/');
      const profileId = slashIdx === -1 ? rest : rest.slice(0, slashIdx);
      const pathOrId = slashIdx === -1 ? 'root' : rest.slice(slashIdx + 1) || 'root';

      try {
        const remoteItems = await invoke<RemoteItem[]>('list_remote_directory', {
          profileId,
          pathOrId,
        });

        const entries: FsEntry[] = remoteItems.map((item) => ({
          name: item.name,
          path: `remote://${profileId}/${item.id}`,
          isDir: item.isDir,
          isSymlink: false,
          isHidden: item.name.startsWith('.'),
          isReadonly: false,
          size: item.size,
          extension: item.name.includes('.') ? item.name.split('.').pop() : undefined,
          modifiedTime: item.modifiedTime,
          createdTime: item.modifiedTime,
        }));

        return {
          currentPath: path,
          parentPath: pathOrId === 'root' ? undefined : `remote://${profileId}/root`,
          entries,
          totalCount: entries.length,
          totalSize: entries.reduce((acc, e) => acc + e.size, 0),
          isReadable: true,
        };
      } catch (err: any) {
        return {
          currentPath: path,
          parentPath: undefined,
          entries: [],
          totalCount: 0,
          totalSize: 0,
          isReadable: false,
          errorMessage: `Remote Storage Error: ${err}`,
        };
      }
    }

    try {
      return await invoke('read_directory', { path, showHidden });
    } catch (e: any) {
      console.warn('invoke read_directory fallback:', e);
      return {
        currentPath: path,
        entries: [],
        totalCount: 0,
        totalSize: 0,
        isReadable: false,
        errorMessage: String(e),
      };
    }
  },

  getEntryMetadata: async (path: string): Promise<FsEntry> => {
    return await invoke('get_entry_metadata', { path });
  },

  createFolder: async (parentPath: string, folderName: string): Promise<string> => {
    return await invoke('create_folder', { parentPath, folderName });
  },

  createFile: async (parentPath: string, fileName: string): Promise<string> => {
    return await invoke('create_file', { parentPath, fileName });
  },

  renameEntry: async (oldPath: string, newName: string): Promise<string> => {
    return await invoke('rename_entry', { oldPath, newName });
  },

  deleteEntries: async (paths: string[], permanent = false): Promise<string[]> => {
    return await invoke('delete_entries', { paths, permanent });
  },

  openFile: async (path: string): Promise<void> => {
    return await invoke('open_file', { path });
  },

  openWithApp: async (appName: 'ultraviewer' | 'feedlens' | 'transformlab', path: string): Promise<void> => {
    return await invoke('open_with_app', { appName, path });
  },

  getFilePreview: async (
    path: string,
    maxBytes?: number,
    isRemote?: boolean,
    profileId?: string
  ): Promise<FilePreview> => {
    if (isRemote || path.startsWith('remote://')) {
      try {
        return await invoke('get_remote_file_preview', { path, maxBytes, profileId });
      } catch (err) {
        console.warn('Remote file preview error:', err);
        throw err;
      }
    }
    return await invoke('get_file_preview', { path, maxBytes });
  },

  readFileBase64: async (path: string): Promise<string> => {
    return await invoke('read_file_base64', { path });
  },

  copyEntries: async (sources: string[], destination: string, policy?: string): Promise<void> => {
    return await invoke('copy_entries', { sources, destination, policy });
  },

  moveEntries: async (sources: string[], destination: string, policy?: string): Promise<void> => {
    return await invoke('move_entries', { sources, destination, policy });
  },

  searchFiles: async (path: string, query: string, maxResults?: number): Promise<SearchResult[]> => {
    return await invoke('search_files', { path, query, maxResults });
  },

  saveSetting: async (key: string, value: string): Promise<void> => {
    return await invoke('save_setting', { key, value });
  },

  loadSetting: async (key: string): Promise<string | null> => {
    return await invoke('load_setting', { key });
  },

  recordRecent: async (path: string): Promise<void> => {
    return await invoke('record_recent', { path });
  },

  getRecentLocations: async (): Promise<string[]> => {
    return await invoke('get_recent_locations');
  },

  showInExplorer: async (path: string): Promise<void> => {
    return await invoke('show_in_explorer', { path });
  },

  openRecycleBin: async (): Promise<void> => {
    return await invoke('open_recycle_bin');
  },

  launchTerminal: async (path: string, shell?: string): Promise<void> => {
    return await invoke('launch_terminal', { path, shell });
  },

  calculateDirectorySize: async (path: string): Promise<DirSizeInfo> => {
    return await invoke('calculate_directory_size', { path });
  },

  calculateFileHash: async (path: string, algorithm = 'sha256'): Promise<HashResult> => {
    return await invoke('calculate_file_hash', { path, algorithm });
  },

  listArchive: async (path: string): Promise<ArchiveEntryInfo[]> => {
    return await invoke('list_archive', { path });
  },

  extractArchive: async (path: string, destination: string): Promise<number> => {
    return await invoke('extract_archive', { path, destination });
  },

  createZipArchive: async (sources: string[], destination: string): Promise<string> => {
    return await invoke('create_zip_archive', { sources, destination });
  },

  compareDirectories: async (dirA: string, dirB: string): Promise<CompareResult> => {
    return await invoke('compare_directories', { dirA, dirB });
  },

  batchRename: async (pairs: BatchRenamePair[]): Promise<string[]> => {
    return await invoke('batch_rename', { pairs });
  },

  // Remote Storage & Cloud Methods (Section 27)
  listRemoteProfiles: async (): Promise<ConnectionProfile[]> => {
    return await invoke('list_remote_profiles');
  },

  saveRemoteProfile: async (profile: ConnectionProfile, secret?: string): Promise<void> => {
    return await invoke('save_remote_profile', { profile, secret });
  },

  deleteRemoteProfile: async (profileId: string): Promise<void> => {
    return await invoke('delete_remote_profile', { profileId });
  },

  testRemoteConnection: async (profileId: string): Promise<void> => {
    return await invoke('test_remote_connection', { profileId });
  },

  connectRemoteProfile: async (profileId: string): Promise<ProviderCapabilities> => {
    return await invoke('connect_remote_profile', { profileId });
  },

  disconnectRemoteProfile: async (profileId: string): Promise<void> => {
    return await invoke('disconnect_remote_profile', { profileId });
  },

  listRemoteDirectory: async (profileId: string, pathOrId: string): Promise<RemoteItem[]> => {
    return await invoke('list_remote_directory', { profileId, pathOrId });
  },

  createRemoteDirectory: async (profileId: string, parentId: string, name: string): Promise<RemoteItem> => {
    return await invoke('create_remote_directory', { profileId, parentId, name });
  },

  renameRemoteItem: async (profileId: string, itemId: string, newName: string): Promise<RemoteItem> => {
    return await invoke('rename_remote_item', { profileId, itemId, newName });
  },

  deleteRemoteItem: async (profileId: string, itemId: string, permanent = false): Promise<void> => {
    return await invoke('delete_remote_item', { profileId, itemId, permanent });
  },

  downloadRemoteFile: async (profileId: string, itemId: string, localPath: string): Promise<number> => {
    return await invoke('download_remote_file', { profileId, itemId, localPath });
  },

  uploadRemoteFile: async (
    profileId: string,
    localPath: string,
    parentId: string,
    remoteName: string
  ): Promise<RemoteItem> => {
    return await invoke('upload_remote_file', { profileId, localPath, parentId, remoteName });
  },

  getRemoteConnectionHistory: async (profileId: string): Promise<ConnectionHistoryItem[]> => {
    return await invoke('get_remote_connection_history', { profileId });
  },

  initRemoteOAuth: async (providerType: string, clientId: string, port = 8080): Promise<OAuthInitResult> => {
    return await invoke('init_remote_oauth', { providerType, clientId, port });
  },

  listRecycleBin: async (): Promise<RecycleBinEntry[]> => {
    try {
      return await invoke<RecycleBinEntry[]>('list_recycle_bin');
    } catch (e) {
      console.warn('list_recycle_bin error:', e);
      return [];
    }
  },

  restoreRecycleBinItem: async (path: string): Promise<void> => {
    return await invoke('restore_recycle_bin_item', { path });
  },

  restoreAllRecycleBin: async (): Promise<void> => {
    return await invoke('restore_all_recycle_bin');
  },

  emptyRecycleBin: async (): Promise<void> => {
    return await invoke('empty_recycle_bin');
  },

  deleteRecycleBinItem: async (path: string): Promise<void> => {
    return await invoke('delete_recycle_bin_item', { path });
  },

  importServerDockProfiles: async (): Promise<ConnectionProfile[]> => {
    return await invoke<ConnectionProfile[]>('import_serverdock_profiles');
  },

  forgetProfilePassword: async (profileId: string): Promise<void> => {
    return await invoke('forget_profile_password', { profileId });
  },

  getSystemFolders: async (): Promise<SystemFolders> => {
    return await invoke('get_system_folders');
  },
};


