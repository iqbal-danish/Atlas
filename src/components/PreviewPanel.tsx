import React, { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { api } from '../api';
import { FilePreview, ArchiveEntryInfo } from '../types';
import { convertFileSrc } from '@tauri-apps/api/core';
import {
  FileText,
  HardDrive,
  Loader2,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  WrapText,
  ListOrdered,
  Code,
  Copy,
  Archive,
  FolderOpen,
  Info,
  FileSpreadsheet,
  Presentation,
  BookOpen,
  Sparkles,
  FileCode,
} from 'lucide-react';

import { SpreadsheetModal } from './SpreadsheetModal';
import { useEditorStore } from '../serverdock/stores/editorStore';
import { useRemoteDownloadStore } from '../stores/remoteDownloadStore';

interface PreviewPanelProps {
  tabId: string;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({ tabId }) => {
  const { tabs, previewPanelOpen, setPropertiesOpen, setLargeFileEditorOpen } = useAppStore();
  const currentTab = tabs.find((t) => t.id === tabId);
  const selectedEntry = currentTab?.selectedEntry;

  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [archiveEntries, setArchiveEntries] = useState<ArchiveEntryInfo[] | null>(null);
  const [loading, setLoading] = useState(false);

  // Text preview options
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [wordWrap, setWordWrap] = useState(true);
  const [formatJson, setFormatJson] = useState(true);

  // Image zoom options
  const [zoomLevel, setZoomLevel] = useState(1);
  const [fitWindow, setFitWindow] = useState(true);

  // PDF Preview state
  const [isPdfExpanded, setIsPdfExpanded] = useState(false);

  // Spreadsheet (Excel / CSV) Preview state
  const [isSpreadsheetExpanded, setIsSpreadsheetExpanded] = useState(false);

  const pdfBlobUrl = useMemo(() => {
    if (!preview?.content || preview.previewType !== 'pdf') return null;
    try {
      const binaryString = atob(preview.content);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error('Failed to parse PDF binary preview:', e);
      return null;
    }
  }, [preview?.content, preview?.previewType]);

  useEffect(() => {
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [pdfBlobUrl]);

  // Escape key listener for expanded PDF view
  useEffect(() => {
    if (!isPdfExpanded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPdfExpanded(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isPdfExpanded]);

  useEffect(() => {
    if (!selectedEntry || selectedEntry.isDir) {
      setPreview(null);
      setArchiveEntries(null);
      return;
    }

    setLoading(true);
    setArchiveEntries(null);

    // If ZIP, load archive listing
    if (selectedEntry.name.toLowerCase().endsWith('.zip')) {
      api.listArchive(selectedEntry.path)
        .then((entries) => setArchiveEntries(entries))
        .catch(console.error);
    }

    api.getFilePreview(
      selectedEntry.path,
      128 * 1024,
      selectedEntry.isRemote,
      selectedEntry.remoteProfileId
    )
      .then((data) => {
        setPreview(data);
        setZoomLevel(1);
        setFitWindow(true);
      })
      .catch((err) => {
        console.error('Preview error:', err);
        setPreview(null);
      })
      .finally(() => setLoading(false));
  }, [selectedEntry?.path]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp * 1000).toLocaleString();
  };

  // Formatted content for JSON
  const formattedContent = useMemo(() => {
    if (!preview?.content) return '';
    if (preview.previewType === 'json' && formatJson) {
      try {
        const parsed = JSON.parse(preview.content);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return preview.content;
      }
    }
    return preview.content;
  }, [preview?.content, preview?.previewType, formatJson]);

  const lines = useMemo(() => {
    return formattedContent.split('\n');
  }, [formattedContent]);

  // Parsed CSV Grid
  const csvData = useMemo(() => {
    if (!preview?.content || preview.previewType !== 'csv') return null;
    const rawLines = preview.content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const rows = rawLines.slice(0, 100).map((line) => {
      const cells: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          cells.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      cells.push(current.trim());
      return cells;
    });

    return {
      headers: rows[0] || [],
      rows: rows.slice(1),
      totalRows: rawLines.length,
    };
  }, [preview?.content, preview?.previewType]);

  if (!previewPanelOpen) return null;

  const isImage = preview?.previewType === 'image' || selectedEntry?.extension?.match(/^(png|jpg|jpeg|gif|webp|svg|bmp|ico)$/i);

  return (
    <div className="w-80 bg-sidebar border-l border-border flex flex-col h-full overflow-hidden select-none text-xs">
      {/* Top Header */}
      <div className="px-3 py-2 border-b border-border font-medium text-foreground text-xs flex items-center justify-between bg-sidebar/80">
        <span className="truncate">Inspector & Preview</span>
        <div className="flex items-center gap-1">
          {selectedEntry && (
            <button
              onClick={() => setPropertiesOpen(true, selectedEntry)}
              className="p-1 rounded hover:bg-surface text-muted hover:text-foreground"
              title="Properties & Checksums"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          )}
          {selectedEntry && !selectedEntry.isDir && (
            <button
              onClick={() => api.openFile(selectedEntry.path)}
              className="p-1 rounded hover:bg-surface text-muted hover:text-accent"
              title="Open with default application"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
        {!selectedEntry ? (
          <div className="text-center py-20 text-muted/60 italic flex flex-col items-center gap-2">
            <FileText className="w-8 h-8 opacity-40" />
            <span>Select a file or folder to preview</span>
          </div>
        ) : (
          <>
            {/* Header Thumbnail/Card */}
            <div className="flex flex-col items-center justify-center p-3 bg-surface/50 rounded-xl border border-border gap-1.5">
              <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center text-accent shadow-sm">
                {selectedEntry.isDir ? (
                  <HardDrive className="w-5 h-5 text-blue-400" />
                ) : selectedEntry.name.toLowerCase().endsWith('.zip') ? (
                  <Archive className="w-5 h-5 text-amber-400" />
                ) : (
                  <FileText className="w-5 h-5 text-accent" />
                )}
              </div>
              <div className="text-xs font-semibold text-foreground text-center break-all">
                {selectedEntry.name}
              </div>
              <div className="text-[11px] text-muted flex items-center gap-1.5">
                {selectedEntry.isRemote && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 font-mono font-medium">
                    REMOTE
                  </span>
                )}
                <span>{selectedEntry.isDir ? 'Directory' : formatBytes(selectedEntry.size)}</span>
              </div>
            </div>

            {/* Content Previews */}
            {!selectedEntry.isDir && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-semibold text-muted tracking-wider">
                    Content Preview
                  </span>

                  {/* Image zoom controls */}
                  {isImage && (
                    <div className="flex items-center gap-1 bg-surface border border-border rounded px-1.5 py-0.5">
                      <button
                        onClick={() => {
                          setFitWindow(false);
                          setZoomLevel((z) => Math.max(0.2, z - 0.25));
                        }}
                        className="p-0.5 hover:text-foreground text-muted"
                        title="Zoom out"
                      >
                        <ZoomOut className="w-3 h-3" />
                      </button>
                      <span className="text-[10px] font-mono w-8 text-center">
                        {Math.round(zoomLevel * 100)}%
                      </span>
                      <button
                        onClick={() => {
                          setFitWindow(false);
                          setZoomLevel((z) => Math.min(3, z + 0.25));
                        }}
                        className="p-0.5 hover:text-foreground text-muted"
                        title="Zoom in"
                      >
                        <ZoomIn className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => {
                          setFitWindow(true);
                          setZoomLevel(1);
                        }}
                        className={`p-0.5 ${fitWindow ? 'text-primary' : 'text-muted hover:text-foreground'}`}
                        title="Fit window"
                      >
                        <Maximize2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Text options */}
                  {!isImage && preview?.content && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setShowLineNumbers((v) => !v)}
                        className={`p-1 rounded ${showLineNumbers ? 'text-primary bg-surface' : 'text-muted hover:text-foreground'}`}
                        title="Toggle Line Numbers"
                      >
                        <ListOrdered className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setWordWrap((v) => !v)}
                        className={`p-1 rounded ${wordWrap ? 'text-primary bg-surface' : 'text-muted hover:text-foreground'}`}
                        title="Toggle Word Wrap"
                      >
                        <WrapText className="w-3 h-3" />
                      </button>
                      {preview.previewType === 'json' && (
                        <button
                          onClick={() => setFormatJson((v) => !v)}
                          className={`p-1 rounded ${formatJson ? 'text-primary bg-surface' : 'text-muted hover:text-foreground'}`}
                          title="Toggle JSON Pretty Format"
                        >
                          <Code className="w-3 h-3" />
                        </button>
                      )}
                      {selectedEntry && (
                        <button
                          onClick={() => {
                            useEditorStore.getState().openFile(selectedEntry.path, selectedEntry.name, false);
                            setLargeFileEditorOpen(true);
                          }}
                          className="p-1 rounded text-muted hover:text-blue-400 hover:bg-surface"
                          title="Open in XML/JSON Viewer (Streaming pagination, syntax validation & regex search)"
                        >
                          <Sparkles className="w-3 h-3 text-blue-400" />
                        </button>
                      )}
                      <button
                        onClick={() => navigator.clipboard.writeText(formattedContent)}
                        className="p-1 rounded text-muted hover:text-foreground"
                        title="Copy content"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {loading && (
                  <div className="flex items-center justify-center py-10 text-muted gap-2 bg-surface/30 rounded-lg border border-border/50">
                    <Loader2 className="w-4 h-4 animate-spin text-accent" />
                    <span>Loading preview...</span>
                  </div>
                )}

                {/* Image Render */}
                {!loading && isImage && (
                  <div className="bg-background/80 border border-border rounded-lg p-2 flex items-center justify-center overflow-hidden min-h-[160px] max-h-60">
                    <img
                      src={
                        preview?.content && isImage
                          ? `data:${preview.mimeType};base64,${preview.content}`
                          : `file://${selectedEntry.path.replace(/\\/g, '/')}`
                      }
                      alt={selectedEntry.name}
                      style={{
                        transform: fitWindow ? 'none' : `scale(${zoomLevel})`,
                        maxHeight: fitWindow ? '220px' : 'none',
                        maxWidth: fitWindow ? '100%' : 'none',
                      }}
                      className="object-contain transition-transform duration-100 rounded"
                      onError={(e) => {
                        // Fallback message if image local protocol is blocked
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}

                {/* PDF Viewer */}
                {!loading && preview?.previewType === 'pdf' && (
                  <div className="bg-surface border border-border rounded-lg overflow-hidden flex flex-col h-80">
                    <div className="px-2.5 py-1.5 bg-red-500/10 border-b border-red-500/20 text-red-400 font-semibold text-[11px] flex items-center justify-between">
                      <div className="flex items-center gap-1.5 truncate max-w-[150px]">
                        <FileText className="w-3.5 h-3.5 shrink-0 text-red-400" />
                        <span className="truncate">{selectedEntry.name}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {pdfBlobUrl && (
                          <button
                            onClick={() => setIsPdfExpanded(true)}
                            className="p-1 rounded hover:bg-surface text-muted hover:text-foreground"
                            title="Expand PDF View"
                          >
                            <Maximize2 className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={() => api.openFile(selectedEntry.path)}
                          className="p-1 rounded hover:bg-surface text-muted hover:text-foreground"
                          title="Open with Default PDF App"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    {pdfBlobUrl ? (
                      <iframe
                        src={`${pdfBlobUrl}#toolbar=1`}
                        title={selectedEntry.name}
                        className="w-full flex-1 border-none bg-white"
                      />
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center p-4 text-center gap-2">
                        <FileText className="w-10 h-10 text-muted/60" />
                        <p className="text-[11px] text-muted">
                          {preview?.isTruncated
                            ? `PDF file exceeds 30MB preview limit (${formatBytes(preview.size)})`
                            : 'Unable to render inline PDF.'}
                        </p>
                        <button
                          onClick={() => api.openFile(selectedEntry.path)}
                          className="mt-1 px-3 py-1 bg-red-500/20 text-red-300 border border-red-500/30 rounded text-[11px] font-medium flex items-center gap-1.5 hover:bg-red-500/30"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Open in Default App</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* CSV Data Table Viewer */}
                {!loading && preview?.previewType === 'csv' && csvData && (
                  <div className="bg-surface/90 border border-border rounded-lg overflow-hidden flex flex-col max-h-72">
                    <div className="px-2.5 py-1.5 bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-400 font-semibold text-[11px] flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>
                          {preview?.mimeType?.includes('spreadsheetml') || selectedEntry?.name.toLowerCase().endsWith('.xlsx')
                            ? 'Excel Spreadsheet (.xlsx)'
                            : 'CSV Spreadsheet'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted font-mono">{csvData.totalRows} rows</span>
                        <button
                          onClick={() => setIsSpreadsheetExpanded(true)}
                          className="p-1 rounded hover:bg-surface text-muted hover:text-emerald-400 transition"
                          title="Open Full Built-in Spreadsheet Viewer"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => api.openFile(selectedEntry.path)}
                          className="p-1 rounded hover:bg-surface text-muted hover:text-foreground transition"
                          title="Open in Microsoft Excel"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="overflow-auto flex-1">
                      <table className="w-full text-[10px] border-collapse">
                        <thead className="bg-surface-active sticky top-0 border-b border-border text-foreground font-semibold">
                          <tr>
                            <th className="p-1 px-1.5 text-center text-muted border-r border-border/40 w-6">#</th>
                            {csvData.headers.map((h, i) => (
                              <th key={i} className="p-1 px-2 text-left border-r border-border/40 truncate max-w-[120px]">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30 font-mono text-muted">
                          {csvData.rows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-surface-hover">
                              <td className="p-1 px-1.5 text-center text-muted/50 border-r border-border/40">{rIdx + 1}</td>
                              {row.map((cell, cIdx) => (
                                <td key={cIdx} className="p-1 px-2 border-r border-border/40 truncate max-w-[120px]" title={cell}>
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Word DOCX Viewer */}
                {!loading && preview?.previewType === 'docx' && (
                  <div className="bg-surface/90 border border-border rounded-lg overflow-hidden flex flex-col max-h-72">
                    <div className="px-2.5 py-1.5 bg-blue-500/10 border-b border-blue-500/20 text-blue-400 font-semibold text-[11px] flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Word Document (.docx)</span>
                      </div>
                      <span className="text-[10px] text-muted font-mono">{preview.lineCount || 1} paragraphs</span>
                    </div>
                    <div className="p-3 overflow-auto max-h-60 text-xs text-foreground/90 leading-relaxed select-text whitespace-pre-line font-sans">
                      {preview.content || 'Document is empty'}
                    </div>
                  </div>
                )}

                {/* PowerPoint PPTX Viewer */}
                {!loading && preview?.previewType === 'pptx' && (
                  <div className="bg-surface/90 border border-border rounded-lg overflow-hidden flex flex-col max-h-72">
                    <div className="px-2.5 py-1.5 bg-orange-500/10 border-b border-orange-500/20 text-orange-400 font-semibold text-[11px] flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Presentation className="w-3.5 h-3.5" />
                        <span>PowerPoint Presentation (.pptx)</span>
                      </div>
                      <span className="text-[10px] text-muted font-mono">{preview.lineCount || 1} slides</span>
                    </div>
                    <div className="p-3 overflow-auto max-h-60 text-xs text-foreground/90 leading-relaxed select-text whitespace-pre-line font-sans space-y-3">
                      {preview.content ? (
                        preview.content.split('\n\n---\n\n').map((slideText, idx) => (
                          <div key={idx} className="p-2 rounded bg-surface border border-border/50 text-[11px]">
                            {slideText}
                          </div>
                        ))
                      ) : (
                        'Presentation is empty'
                      )}
                    </div>
                  </div>
                )}

                {/* Text / Code Render with line numbers */}
                {!loading && !isImage && !['pdf', 'csv', 'docx', 'pptx'].includes(preview?.previewType || '') && preview?.content && (
                  <div className="bg-surface/80 border border-border rounded-lg overflow-hidden flex flex-col max-h-64">
                    <div className="px-2.5 py-1.5 bg-blue-500/10 border-b border-blue-500/20 text-blue-400 font-semibold text-[11px] flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-1.5 truncate max-w-[120px]">
                        <FileCode className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                        <span className="truncate">{selectedEntry.name}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            if (selectedEntry.isRemote || selectedEntry.path.startsWith('remote://')) {
                              useRemoteDownloadStore.getState().startDownload({
                                appName: 'ultraviewer',
                                remotePath: selectedEntry.path,
                                fileName: selectedEntry.name,
                                totalBytes: selectedEntry.size,
                                remoteProfileId: selectedEntry.remoteProfileId,
                              });
                            } else {
                              api.openWithApp('ultraviewer', selectedEntry.path);
                            }
                          }}
                          className="px-1.5 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-[10px] font-medium transition"
                          title="Open in UltraViewer (Large XML/JSON Editor)"
                        >
                          UltraViewer
                        </button>
                        <button
                          onClick={() => {
                            if (selectedEntry.isRemote || selectedEntry.path.startsWith('remote://')) {
                              useRemoteDownloadStore.getState().startDownload({
                                appName: 'feedlens',
                                remotePath: selectedEntry.path,
                                fileName: selectedEntry.name,
                                totalBytes: selectedEntry.size,
                                remoteProfileId: selectedEntry.remoteProfileId,
                              });
                            } else {
                              api.openWithApp('feedlens', selectedEntry.path);
                            }
                          }}
                          className="px-1.5 py-0.5 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-[10px] font-medium transition"
                          title="Open in FeedLens (Feed Analyzer & DuckDB)"
                        >
                          FeedLens
                        </button>
                        <button
                          onClick={() => {
                            if (selectedEntry.isRemote || selectedEntry.path.startsWith('remote://')) {
                              useRemoteDownloadStore.getState().startDownload({
                                appName: 'transformlab',
                                remotePath: selectedEntry.path,
                                fileName: selectedEntry.name,
                                totalBytes: selectedEntry.size,
                                remoteProfileId: selectedEntry.remoteProfileId,
                              });
                            } else {
                              api.openWithApp('transformlab', selectedEntry.path);
                            }
                          }}
                          className="px-1.5 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-medium transition"
                          title="Open in TransformLab (XSLT 3.0 / JOLT)"
                        >
                          TransformLab
                        </button>
                        <button
                          onClick={() => {
                            if (selectedEntry) {
                              useEditorStore.getState().openFile(
                                selectedEntry.path,
                                selectedEntry.name,
                                Boolean(selectedEntry.isRemote || selectedEntry.path.startsWith('remote://'))
                              );
                              setLargeFileEditorOpen(true);
                            }
                          }}
                          className="p-1 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 transition"
                          title="Open in embedded XML/JSON Viewer"
                        >
                          <Sparkles className="w-3 h-3 text-purple-300" />
                        </button>
                      </div>
                    </div>
                    <div className="overflow-auto font-mono text-[11px] leading-relaxed select-text flex flex-1">
                      {showLineNumbers && (
                        <div className="bg-background/40 border-r border-border/40 py-2 px-2 text-right text-muted/40 select-none shrink-0 font-mono text-[10px]">
                          {lines.map((_, i) => (
                            <div key={i}>{i + 1}</div>
                          ))}
                        </div>
                      )}
                      <div
                        className={`p-2 flex-1 text-foreground/90 ${
                          wordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre overflow-x-auto'
                        }`}
                      >
                        {formattedContent}
                      </div>
                    </div>
                  </div>
                )}

                {/* ZIP Archive Content Preview */}
                {!loading && archiveEntries && (
                  <div className="bg-surface/80 border border-border rounded-lg p-2 max-h-56 overflow-auto">
                    <div className="font-semibold text-muted text-[10px] uppercase mb-1.5 flex items-center gap-1">
                      <Archive className="w-3 h-3 text-accent" />
                      <span>Archive Contents ({archiveEntries.length} files)</span>
                    </div>
                    <div className="space-y-1 font-mono text-[10px]">
                      {archiveEntries.map((ae, i) => (
                        <div key={i} className="flex justify-between items-center py-0.5 border-b border-border/30">
                          <span className="truncate max-w-[180px] text-foreground" title={ae.name}>
                            {ae.name}
                          </span>
                          <span className="text-muted shrink-0">{formatBytes(ae.size)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Truncated notice */}
                {preview?.isTruncated && (
                  <div className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                    Preview truncated for performance (showing first 128 KB).
                  </div>
                )}

                {!loading && preview && preview.previewType === 'binary' && !archiveEntries && (
                  <div className="p-4 bg-surface/40 border border-dashed border-border rounded-lg text-center text-muted/70 italic text-[11px]">
                    Binary content preview not supported
                  </div>
                )}
              </div>
            )}

            {/* Metadata Properties */}
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <span className="text-[10px] uppercase font-semibold text-muted tracking-wider">
                File Information
              </span>

              <div className="flex flex-col gap-1.5 text-[11px]">
                <div className="flex items-center justify-between text-muted">
                  <span>Location</span>
                  <span className="text-foreground max-w-[170px] truncate" title={selectedEntry.path}>
                    {selectedEntry.path}
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted">
                  <span>Modified</span>
                  <span className="text-foreground">{formatDate(selectedEntry.modifiedTime)}</span>
                </div>
                <div className="flex items-center justify-between text-muted">
                  <span>Created</span>
                  <span className="text-foreground">{formatDate(selectedEntry.createdTime)}</span>
                </div>
                <div className="flex items-center justify-between text-muted">
                  <span>Read Only</span>
                  <span className="text-foreground">{selectedEntry.isReadonly ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Expanded PDF View Modal */}
      {isPdfExpanded && pdfBlobUrl && selectedEntry && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col p-6 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-3 text-white border-b border-border/40 mb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-red-400" />
              <span className="font-semibold text-sm">{selectedEntry.name}</span>
              <span className="text-xs text-muted">({formatBytes(selectedEntry.size)})</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => api.openFile(selectedEntry.path)}
                className="px-3 py-1.5 text-xs bg-surface border border-border rounded hover:bg-surface-active flex items-center gap-1.5 text-foreground transition-colors"
                title="Open in System Default PDF Reader"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Default App</span>
              </button>
              <button
                onClick={() => setIsPdfExpanded(false)}
                className="px-3 py-1.5 text-xs bg-red-500/20 text-red-300 border border-red-500/30 rounded hover:bg-red-500/30 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
          <div className="flex-1 bg-white rounded-lg overflow-hidden shadow-2xl border border-border/50">
            <iframe
              src={`${pdfBlobUrl}#toolbar=1`}
              title={selectedEntry.name}
              className="w-full h-full border-none"
            />
          </div>
        </div>
      )}

      {/* Expanded Spreadsheet View Modal */}
      {isSpreadsheetExpanded && selectedEntry && preview?.content && (
        <SpreadsheetModal
          isOpen={isSpreadsheetExpanded}
          onClose={() => setIsSpreadsheetExpanded(false)}
          fileName={selectedEntry.name}
          filePath={selectedEntry.path}
          rawContent={preview.content}
          fileSize={selectedEntry.size}
        />
      )}
    </div>
  );
};
