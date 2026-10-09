import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Search,
  ExternalLink,
  Download,
  X,
  Maximize2,
  Copy,
  Check,
} from 'lucide-react';
import { api } from '../api';

interface SpreadsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  filePath: string;
  rawContent: string;
  fileSize?: number;
}

interface SheetData {
  name: string;
  headers: string[];
  rows: string[][];
  totalRows: number;
}

export const SpreadsheetModal: React.FC<SpreadsheetModalProps> = ({
  isOpen,
  onClose,
  fileName,
  filePath,
  rawContent,
  fileSize,
}) => {
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>({ row: 0, col: 0 });
  const [copiedCell, setCopiedCell] = useState(false);

  // Parse raw content into sheets
  const sheets = useMemo<SheetData[]>(() => {
    if (!rawContent) return [];

    const parseCsvBlock = (block: string): { headers: string[]; rows: string[][]; totalRows: number } => {
      const rawLines = block.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const parsedRows = rawLines.map((line) => {
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
        headers: parsedRows[0] || [],
        rows: parsedRows.slice(1),
        totalRows: rawLines.length,
      };
    };

    // Check if multi-sheet format
    if (rawContent.includes('---SHEET:')) {
      const parts = rawContent.split(/---SHEET:([^-\n]+)---\r?\n/);
      const parsedSheets: SheetData[] = [];

      for (let i = 1; i < parts.length; i += 2) {
        const sheetName = parts[i]?.trim() || `Sheet ${Math.floor(i / 2) + 1}`;
        const sheetBody = parts[i + 1] || '';
        const { headers, rows, totalRows } = parseCsvBlock(sheetBody);
        parsedSheets.push({
          name: sheetName,
          headers,
          rows,
          totalRows,
        });
      }
      return parsedSheets;
    }

    // Single sheet (CSV or default)
    const { headers, rows, totalRows } = parseCsvBlock(rawContent);
    return [
      {
        name: 'Sheet 1',
        headers,
        rows,
        totalRows,
      },
    ];
  }, [rawContent]);

  const activeSheet = sheets[activeSheetIndex] || sheets[0];

  // Helper to get Excel column letter (0 -> A, 1 -> B, etc.)
  const getColLetter = (index: number): string => {
    let letter = '';
    let temp = index;
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  };

  // Filtered rows based on search
  const filteredRows = useMemo(() => {
    if (!activeSheet) return [];
    if (!searchFilter.trim()) return activeSheet.rows;

    const q = searchFilter.toLowerCase();
    return activeSheet.rows.filter((row) =>
      row.some((cell) => cell.toLowerCase().includes(q))
    );
  }, [activeSheet, searchFilter]);

  // Selected cell value
  const selectedCellValue = useMemo(() => {
    if (!selectedCell || !activeSheet) return '';
    if (selectedCell.row === -1) {
      return activeSheet.headers[selectedCell.col] || '';
    }
    const r = filteredRows[selectedCell.row];
    return r ? r[selectedCell.col] || '' : '';
  }, [selectedCell, activeSheet, filteredRows]);

  const handleCopyCell = () => {
    if (selectedCellValue) {
      navigator.clipboard.writeText(selectedCellValue).then(() => {
        setCopiedCell(true);
        setTimeout(() => setCopiedCell(false), 1500);
      });
    }
  };

  const handleExportCsv = () => {
    if (!activeSheet) return;
    const allLines = [activeSheet.headers.join(','), ...activeSheet.rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([allLines], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${fileName.replace(/\.[^/.]+$/, '')}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col p-4 sm:p-6 select-none animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex-1 bg-[#0e1017] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Top Header Toolbar */}
        <div className="px-5 py-3 bg-[#131622] border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white flex items-center gap-2 truncate">
                <span className="truncate">{fileName}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  Spreadsheet
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
                <span>{formatBytes(fileSize)}</span>
                <span>&bull;</span>
                <span>{activeSheet?.totalRows || 0} rows</span>
                <span>&bull;</span>
                <span>{activeSheet?.headers.length || 0} columns</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Filter */}
            <div className="relative">
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search cells..."
                className="bg-white/[0.05] border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 transition w-44 sm:w-56"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            </div>

            {/* Export CSV */}
            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs text-slate-300 hover:text-white transition flex items-center gap-1.5"
              title="Export active sheet as CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            {/* Open in Default App */}
            <button
              onClick={() => api.openFile(filePath)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs text-white font-medium shadow-sm transition flex items-center gap-1.5"
              title="Open with Microsoft Excel or default spreadsheet app"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in Excel</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition ml-1"
              title="Close Spreadsheet Viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Formula & Active Cell Bar (fx) */}
        <div className="px-5 py-2 bg-[#10121c] border-b border-white/[0.06] flex items-center gap-3 text-xs">
          <div className="px-2.5 py-1 rounded bg-white/[0.05] border border-white/10 font-mono font-semibold text-emerald-300 w-16 text-center shrink-0">
            {selectedCell
              ? `${getColLetter(selectedCell.col)}${selectedCell.row === -1 ? '1' : selectedCell.row + 2}`
              : 'A1'}
          </div>
          <span className="font-mono text-slate-500 font-semibold italic text-xs select-none">fx</span>
          <div className="flex-1 bg-white/[0.03] border border-white/10 rounded px-3 py-1 font-mono text-slate-200 text-xs truncate">
            {selectedCellValue || <span className="text-slate-600 italic">Empty cell</span>}
          </div>
          <button
            onClick={handleCopyCell}
            className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white shrink-0"
            title="Copy cell value"
          >
            {copiedCell ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Main Grid Stage */}
        <div className="flex-1 overflow-auto bg-[#0a0c12]">
          {!activeSheet || activeSheet.headers.length === 0 ? (
            <div className="py-24 text-center text-slate-500 font-mono text-xs flex flex-col items-center gap-2">
              <FileSpreadsheet className="w-10 h-10 opacity-30" />
              <span>Empty spreadsheet or unable to parse cells</span>
            </div>
          ) : (
            <table className="w-full border-collapse text-xs select-text">
              {/* Sticky Column Letters & Headers */}
              <thead className="sticky top-0 z-10 bg-[#141724] border-b border-white/10 text-slate-300 font-semibold shadow-sm">
                {/* Excel Letter Row */}
                <tr className="bg-[#101320] text-slate-500 font-mono text-[10px]">
                  <th className="p-1.5 px-3 text-center border-r border-b border-white/10 w-12 bg-[#0c0e18] select-none"></th>
                  {activeSheet.headers.map((_, colIdx) => (
                    <th key={colIdx} className="p-1 text-center border-r border-b border-white/10 select-none">
                      {getColLetter(colIdx)}
                    </th>
                  ))}
                </tr>

                {/* Header Labels */}
                <tr>
                  <th className="p-2 px-3 text-center border-r border-white/10 text-slate-500 font-mono text-[10px] w-12 bg-[#101320] select-none">
                    1
                  </th>
                  {activeSheet.headers.map((header, colIdx) => (
                    <th
                      key={colIdx}
                      onClick={() => setSelectedCell({ row: -1, col: colIdx })}
                      className={`p-2 px-3 text-left border-r border-white/10 font-semibold truncate max-w-[200px] cursor-pointer hover:bg-white/[0.04] transition ${
                        selectedCell?.row === -1 && selectedCell?.col === colIdx ? 'bg-emerald-500/15 text-emerald-200' : ''
                      }`}
                      title={header}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Data Rows */}
              <tbody className="divide-y divide-white/[0.03] font-mono text-[11px] text-slate-300">
                {filteredRows.map((row, rowIdx) => {
                  const isRowSelected = selectedCell?.row === rowIdx;

                  return (
                    <tr
                      key={rowIdx}
                      className={`hover:bg-white/[0.03] transition-colors ${
                        rowIdx % 2 === 1 ? 'bg-white/[0.012]' : ''
                      } ${isRowSelected ? 'bg-white/[0.05]' : ''}`}
                    >
                      {/* Row Number */}
                      <td className="p-1.5 px-3 text-center font-mono text-[10px] text-slate-500 border-r border-white/10 bg-[#0e111a] select-none">
                        {rowIdx + 2}
                      </td>

                      {/* Cells */}
                      {activeSheet.headers.map((_, colIdx) => {
                        const cell = row[colIdx] || '';
                        const isCellSelected = selectedCell?.row === rowIdx && selectedCell?.col === colIdx;
                        const isMatch = searchFilter.trim() && cell.toLowerCase().includes(searchFilter.toLowerCase());

                        return (
                          <td
                            key={colIdx}
                            onClick={() => setSelectedCell({ row: rowIdx, col: colIdx })}
                            className={`p-1.5 px-3 border-r border-white/[0.05] truncate max-w-[240px] cursor-pointer transition ${
                              isCellSelected
                                ? 'bg-emerald-500/20 text-white font-semibold outline outline-1 outline-emerald-400'
                                : ''
                            } ${isMatch ? 'bg-amber-500/20 text-amber-200 font-semibold' : ''}`}
                            title={cell}
                          >
                            {cell}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Bottom Sheet Selector Bar (Multi-sheet tabs) */}
        <div className="px-5 py-2 bg-[#12141f] border-t border-white/[0.08] flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {sheets.map((sheet, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setActiveSheetIndex(idx);
                  setSelectedCell({ row: 0, col: 0 });
                }}
                className={`px-3 py-1 rounded font-medium text-xs transition flex items-center gap-1.5 ${
                  activeSheetIndex === idx
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold'
                    : 'bg-white/[0.04] text-slate-400 hover:text-white border border-transparent'
                }`}
              >
                <span>{sheet.name}</span>
                <span className="text-[10px] opacity-60">({sheet.totalRows})</span>
              </button>
            ))}
          </div>

          <div className="text-[11px] text-slate-500 font-mono">
            Showing {filteredRows.length} of {activeSheet?.totalRows || 0} rows
          </div>
        </div>
      </div>
    </div>
  );
};
