export interface FsEntry {
  name: string;
  path: string;
  isDir: boolean;
  isSymlink: boolean;
  isHidden: boolean;
  isReadonly: boolean;
  size: number;
  extension?: string;
  modifiedTime?: number;
  createdTime?: number;
  itemCount?: number;
  isRemote?: boolean;
  remoteProfileId?: string;
}

export interface DriveInfo {
  mountPoint: string;
  volumeLabel: string;
  totalBytes: number;
  availableBytes: number;
  driveType: string;
  isRemovable: boolean;
}

export interface DirectoryListing {
  currentPath: string;
  parentPath?: string;
  entries: FsEntry[];
  totalCount: number;
  totalSize: number;
  isReadable: boolean;
  errorMessage?: string;
}

export interface FilePreview {
  path: string;
  mimeType: string;
  previewType: string; // 'text' | 'image' | 'json' | 'code' | 'binary'
  content?: string;
  size: number;
  lineCount?: number;
  isTruncated: boolean;
}

export interface SearchResult {
  path: string;
  name: string;
  isDir: boolean;
  size: number;
  modifiedTime?: number;
  matchIndices?: number[];
}

export interface DirSizeInfo {
  path: string;
  totalBytes: number;
  fileCount: number;
  dirCount: number;
  inaccessibleCount: number;
}

export interface SystemFolders {
  desktop: string;
  downloads: string;
  documents: string;
  pictures: string;
  music: string;
  videos: string;
  home: string;
}

export interface HashResult {
  path: string;
  algorithm: string;
  hash: string;
}

export interface ArchiveEntryInfo {
  name: string;
  size: number;
  compressedSize: number;
  isDir: boolean;
}

export interface CompareItem {
  name: string;
  relativePath: string;
  status: 'onlyInLeft' | 'onlyInRight' | 'identical' | 'differentSize' | 'differentDate';
  sizeA?: number;
  sizeB?: number;
  modifiedA?: number;
  modifiedB?: number;
}

export interface CompareResult {
  dirA: string;
  dirB: string;
  items: CompareItem[];
  totalCompared: number;
}

export interface BatchRenamePair {
  oldPath: string;
  newPath: string;
}

export interface ClipboardState {
  action: 'cut' | 'copy';
  paths: string[];
}

export interface UndoRecord {
  type: 'move' | 'rename' | 'copy';
  items: Array<{ from: string; to: string }>;
}

export type ViewMode = 'home' | 'columns' | 'list' | 'grid' | 'recycle-bin' | 'serverdock';

export interface RecycleBinEntry {
  id: string;
  name: string;
  originalPath: string;
  dateDeleted: string;
  size: number;
  isDir: boolean;
}

export interface ConnectionLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  profileId?: string;
}

export interface TabState {
  id: string;
  title: string;
  path: string;
  history: string[];
  historyIndex: number;
  viewMode: ViewMode;
  selectedEntry?: FsEntry;
  selectedPaths: string[];
  filterPattern?: string;
}

// ==========================================
// Section 27: Remote Storage & Cloud Models
// ==========================================

export type StorageProviderType = 'local' | 'sftp' | 'ftp' | 'google_drive' | 'onedrive' | 'mock';

export interface ProviderCapabilities {
  canUpload: boolean;
  canDownload: boolean;
  canCreateDir: boolean;
  canRename: boolean;
  canDelete: boolean;
  canTrash: boolean;
  canExportDocs: boolean;
  canResumeTransfer: boolean;
  supportsPermissions: boolean;
  supportsThumbnails: boolean;
  isEncrypted: boolean;
}

export interface RemoteItem {
  id: string;
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modifiedTime?: number;
  mimeType?: string;
  permissions?: string;
  etag?: string;
  thumbnailUrl?: string;
  isTrashed: boolean;
  isWorkspaceDoc: boolean;
  exportTypes: string[];
}

export interface ConnectionProfile {
  id: string;
  name: string;
  providerType: StorageProviderType;
  host?: string;
  port?: number;
  username?: string;
  remoteRoot?: string;
  timeoutSecs: number;
  lastConnected?: number;
  status: 'disconnected' | 'connected' | 'connecting' | 'error';
  errorMessage?: string;
  hasSecret: boolean;
  config: Record<string, any>;
}

export interface ConnectionHistoryItem {
  id: number;
  profileId: string;
  connectedAt: number;
  status: string;
  errorMessage?: string;
}

export interface OAuthInitResult {
  authUrl: string;
  state: string;
  codeVerifier: string;
  redirectUri: string;
}

