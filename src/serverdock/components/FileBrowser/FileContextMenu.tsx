import React, { useEffect, useRef } from "react";
import {
  FileText,
  Eye,
  Edit3,
  Download,
  Upload,
  Copy,
  Trash2,
  Info,
  GitCompare,
  Terminal,
  Activity,
  Zap,
  FileCode,
} from "lucide-react";
import { FileItem } from "../../types";
import { api } from "../../../api";
import { useRemoteDownloadStore } from "../../../stores/remoteDownloadStore";

interface FileContextMenuProps {
  x: number;
  y: number;
  item: FileItem;
  isRemote: boolean;
  onClose: () => void;
  onOpen: () => void;
  onPreview: () => void;
  onOpenEditor: () => void;
  onTransfer: () => void;
  onRename: () => void;
  onDelete: () => void;
  onCopyPath: () => void;
  onProperties: () => void;
  onCompare: () => void;
}

export const FileContextMenu: React.FC<FileContextMenuProps> = ({
  x,
  y,
  item,
  isRemote,
  onClose,
  onOpen,
  onPreview,
  onOpenEditor,
  onTransfer,
  onRename,
  onDelete,
  onCopyPath,
  onProperties,
  onCompare,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Adjust positioning to stay within viewport
  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - 340);

  const isTextFile =
    !item.is_dir &&
    (item.extension === "xml" ||
      item.extension === "json" ||
      item.extension === "txt" ||
      item.extension === "log" ||
      item.extension === "csv" ||
      item.extension === "tsv" ||
      item.extension === "yml" ||
      item.extension === "yaml" ||
      item.extension === "md" ||
      item.extension === "sql");

  return (
    <div
      ref={menuRef}
      style={{ left: adjustedX, top: adjustedY }}
      className="fixed z-50 w-52 bg-[#111114] border border-[#202026] rounded-md shadow-2xl py-1 text-xs select-none"
    >
      <button
        onClick={() => {
          onOpen();
          onClose();
        }}
        className="w-full px-3 py-1.5 text-left text-white hover:bg-blue-600 flex items-center space-x-2"
      >
        <FileText className="w-3.5 h-3.5 text-[#8e8e93]" />
        <span>Open</span>
      </button>

      {isTextFile && (
        <>
          <button
            onClick={() => {
              onPreview();
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left text-white hover:bg-blue-600 flex items-center space-x-2"
          >
            <Eye className="w-3.5 h-3.5 text-[#8e8e93]" />
            <span>Preview File</span>
          </button>

          {/* UltraViewer */}
          <button
            onClick={async () => {
              if (isRemote) {
                useRemoteDownloadStore.getState().startDownload({
                  appName: 'ultraviewer',
                  remotePath: item.path,
                  fileName: item.name,
                  totalBytes: item.size,
                });
              } else {
                try {
                  await api.openWithApp('ultraviewer', item.path);
                } catch (e) {
                  alert(`UltraViewer: ${e}`);
                }
              }
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left text-white hover:bg-blue-600 flex items-center space-x-2"
            title="Open in UltraViewer Large XML/JSON Editor"
          >
            <Eye className="w-3.5 h-3.5 text-amber-400" />
            <span>UltraViewer</span>
          </button>

          {/* FeedLens */}
          <button
            onClick={async () => {
              if (isRemote) {
                useRemoteDownloadStore.getState().startDownload({
                  appName: 'feedlens',
                  remotePath: item.path,
                  fileName: item.name,
                  totalBytes: item.size,
                });
              } else {
                try {
                  await api.openWithApp('feedlens', item.path);
                } catch (e) {
                  alert(`FeedLens: ${e}`);
                }
              }
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left text-white hover:bg-blue-600 flex items-center space-x-2"
            title="Open in FeedLens DuckDB Analyzer"
          >
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            <span>FeedLens</span>
          </button>

          {/* TransformLab */}
          <button
            onClick={async () => {
              if (isRemote) {
                useRemoteDownloadStore.getState().startDownload({
                  appName: 'transformlab',
                  remotePath: item.path,
                  fileName: item.name,
                  totalBytes: item.size,
                });
              } else {
                try {
                  await api.openWithApp('transformlab', item.path);
                } catch (e) {
                  alert(`TransformLab: ${e}`);
                }
              }
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left text-white hover:bg-blue-600 flex items-center space-x-2"
            title="Open in TransformLab XSLT 3.0 / JOLT"
          >
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span>TransformLab</span>
          </button>

          <button
            onClick={() => {
              onOpenEditor();
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left text-white hover:bg-blue-600 flex items-center space-x-2 font-medium"
          >
            <FileCode className="w-3.5 h-3.5 text-purple-400" />
            <span>XML/JSON Viewer</span>
          </button>
        </>
      )}

      <div className="h-px bg-[#202026] my-1" />

      {/* Transfer Action */}
      <button
        onClick={() => {
          onTransfer();
          onClose();
        }}
        className="w-full px-3 py-1.5 text-left text-white hover:bg-blue-600 flex items-center space-x-2"
      >
        {isRemote ? (
          <>
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Download to Local</span>
          </>
        ) : (
          <>
            <Upload className="w-3.5 h-3.5 text-blue-400" />
            <span>Upload to Remote</span>
          </>
        )}
      </button>

      {!item.is_dir && (
        <button
          onClick={() => {
            onCompare();
            onClose();
          }}
          className="w-full px-3 py-1.5 text-left text-white hover:bg-blue-600 flex items-center space-x-2"
        >
          <GitCompare className="w-3.5 h-3.5 text-[#8e8e93]" />
          <span>Compare With...</span>
        </button>
      )}

      <div className="h-px bg-[#202026] my-1" />

      <button
        onClick={() => {
          onCopyPath();
          onClose();
        }}
        className="w-full px-3 py-1.5 text-left text-white hover:bg-blue-600 flex items-center space-x-2"
      >
        <Copy className="w-3.5 h-3.5 text-[#8e8e93]" />
        <span>Copy Path</span>
      </button>

      <button
        onClick={() => {
          onRename();
          onClose();
        }}
        className="w-full px-3 py-1.5 text-left text-white hover:bg-blue-600 flex items-center space-x-2"
      >
        <Edit3 className="w-3.5 h-3.5 text-[#8e8e93]" />
        <span>Rename</span>
      </button>

      <button
        onClick={() => {
          onDelete();
          onClose();
        }}
        className="w-full px-3 py-1.5 text-left text-red-400 hover:bg-red-600 hover:text-white flex items-center space-x-2"
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span>Delete</span>
      </button>

      <div className="h-px bg-[#202026] my-1" />

      <button
        onClick={() => {
          onProperties();
          onClose();
        }}
        className="w-full px-3 py-1.5 text-left text-white hover:bg-blue-600 flex items-center space-x-2"
      >
        <Info className="w-3.5 h-3.5 text-[#8e8e93]" />
        <span>Properties</span>
      </button>
    </div>
  );
};
