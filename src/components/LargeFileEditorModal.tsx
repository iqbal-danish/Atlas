import React, { useEffect } from 'react';
import { useAppStore } from '../store';
import { useEditorStore } from '../serverdock/stores/editorStore';
import { LargeFileEditor } from '../serverdock/components/Editor/LargeFileEditor';
import { api } from '../api';
import { FileCode, X, ExternalLink, Sparkles, FileText } from 'lucide-react';

export const LargeFileEditorModal: React.FC = () => {
  const { largeFileEditorOpen, setLargeFileEditorOpen } = useAppStore();
  const { filePath, fileName, syntaxType, totalSize, totalLines, isDirty, saveFile } = useEditorStore();

  useEffect(() => {
    if (!largeFileEditorOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLargeFileEditorOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [largeFileEditorOpen, setLargeFileEditorOpen]);

  if (!largeFileEditorOpen) return null;

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col p-4 md:p-6 animate-in fade-in duration-150 select-none">
      {/* Top Modal Navigation Header */}
      <div className="bg-[#111114] border border-[#202026] rounded-t-xl px-4 py-2.5 flex items-center justify-between text-xs shadow-xl">
        <div className="flex items-center gap-3 truncate">
          <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
            {syntaxType === 'xml' || syntaxType === 'json' ? (
              <Sparkles className="w-4 h-4 text-blue-400" />
            ) : (
              <FileCode className="w-4 h-4 text-cyan-400" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white truncate text-sm" title={fileName}>
                {fileName || 'Large File Editor'}
              </span>
              {isDirty && (
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" title="Modified" />
              )}
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono uppercase bg-blue-500/10 text-blue-400 border border-blue-500/25">
                {syntaxType.toUpperCase()}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 truncate max-w-xl font-mono" title={filePath || ''}>
              {filePath || 'No file selected'} • {formatSize(totalSize)}
              {totalLines ? ` • ${totalLines.toLocaleString()} lines` : ''}
            </span>
          </div>
        </div>

        {/* Modal Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {filePath && (
            <button
              onClick={() => api.openFile(filePath)}
              className="px-2.5 py-1.5 rounded-md bg-[#16161a] hover:bg-[#202026] text-slate-300 hover:text-white border border-[#202026] transition flex items-center gap-1.5 text-xs"
              title="Open with system default application"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">External App</span>
            </button>
          )}
          <button
            onClick={() => setLargeFileEditorOpen(false)}
            className="p-1.5 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/25 transition flex items-center gap-1 text-xs font-medium"
            title="Close editor (Esc)"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Close</span>
          </button>
        </div>
      </div>

      {/* Embedded High-Performance Streaming Large File Editor */}
      <div className="flex-1 bg-[#0a0a0c] border-x border-b border-[#202026] rounded-b-xl overflow-hidden shadow-2xl flex flex-col">
        <LargeFileEditor />
      </div>
    </div>
  );
};
