import React, { useState } from 'react';
import { useAppStore } from '../store';
import { api } from '../api';
import { CompareResult, CompareItem } from '../types';
import {
  X,
  GitCompare,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  FilePlus2,
  FileMinus2,
  RefreshCw,
} from 'lucide-react';

export const DirectoryCompareModal: React.FC = () => {
  const { compareOpen, setCompareOpen, tabs, activeTabId, rightPaneTabId } = useAppStore();
  const leftTab = tabs.find((t) => t.id === activeTabId);
  const rightTab = tabs.find((t) => t.id === rightPaneTabId) || tabs[1] || tabs[0];

  const [dirA, setDirA] = useState(leftTab?.path || 'C:\\');
  const [dirB, setDirB] = useState(rightTab?.path || 'C:\\');
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'diff' | 'identical'>('diff');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!compareOpen) return null;

  const handleRunCompare = async () => {
    setComparing(true);
    setErrorMessage(null);
    try {
      const res = await api.compareDirectories(dirA, dirB);
      setResult(res);
    } catch (e: any) {
      setErrorMessage(String(e));
    } finally {
      setComparing(false);
    }
  };

  const filteredItems = (result?.items || []).filter((item) => {
    if (filterMode === 'diff') return item.status !== 'identical';
    if (filterMode === 'identical') return item.status === 'identical';
    return true;
  });

  const getStatusBadge = (status: CompareItem['status']) => {
    switch (status) {
      case 'identical':
        return (
          <span className="text-emerald-400 inline-flex items-center gap-1 font-mono">
            <CheckCircle2 className="w-3 h-3" /> Identical
          </span>
        );
      case 'onlyInLeft':
        return (
          <span className="text-blue-400 inline-flex items-center gap-1 font-mono">
            <FilePlus2 className="w-3 h-3" /> Only in A
          </span>
        );
      case 'onlyInRight':
        return (
          <span className="text-purple-400 inline-flex items-center gap-1 font-mono">
            <FileMinus2 className="w-3 h-3" /> Only in B
          </span>
        );
      case 'differentSize':
        return (
          <span className="text-amber-400 inline-flex items-center gap-1 font-mono">
            <AlertCircle className="w-3 h-3" /> Different Size
          </span>
        );
      case 'differentDate':
        return (
          <span className="text-orange-400 inline-flex items-center gap-1 font-mono">
            <AlertCircle className="w-3 h-3" /> Different Date
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh] overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-sidebar/50">
          <div className="flex items-center gap-2 font-medium text-foreground text-sm">
            <GitCompare className="w-4 h-4 text-accent" />
            <span>Compare Directory Contents</span>
          </div>
          <button
            onClick={() => setCompareOpen(false)}
            className="p-1 rounded hover:bg-surface-hover text-muted hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Directory Inputs */}
        <div className="p-4 border-b border-border bg-sidebar/20 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-muted mb-1 font-medium">Directory A (Left)</label>
            <input
              type="text"
              value={dirA}
              onChange={(e) => setDirA(e.target.value)}
              className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-foreground outline-none font-mono text-[11px] focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-muted mb-1 font-medium">Directory B (Right)</label>
            <input
              type="text"
              value={dirB}
              onChange={(e) => setDirB(e.target.value)}
              className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-foreground outline-none font-mono text-[11px] focus:border-primary"
            />
          </div>
        </div>

        {/* Action & Filter Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background/50">
          <div className="flex gap-2">
            <button
              onClick={() => setFilterMode('diff')}
              className={`px-2.5 py-1 rounded transition-colors ${
                filterMode === 'diff' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted hover:bg-surface'
              }`}
            >
              Differences Only
            </button>
            <button
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded transition-colors ${
                filterMode === 'all' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted hover:bg-surface'
              }`}
            >
              All Items ({result?.items.length ?? 0})
            </button>
            <button
              onClick={() => setFilterMode('identical')}
              className={`px-2.5 py-1 rounded transition-colors ${
                filterMode === 'identical' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted hover:bg-surface'
              }`}
            >
              Identical
            </button>
          </div>

          <button
            disabled={comparing}
            onClick={handleRunCompare}
            className="px-3 py-1.5 rounded bg-primary text-primary-foreground font-medium flex items-center gap-1.5 hover:bg-primary/90 disabled:opacity-40"
          >
            <RefreshCw className={`w-3 h-3 ${comparing ? 'animate-spin' : ''}`} />
            <span>{comparing ? 'Comparing...' : 'Run Comparison'}</span>
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 bg-red-500/10 border-b border-red-500/30 text-red-400">
            {errorMessage}
          </div>
        )}

        {/* Results Table */}
        <div className="flex-1 overflow-auto p-4">
          {!result && !comparing && (
            <div className="text-center text-muted py-12">
              Select two directories and click "Run Comparison" to inspect differences.
            </div>
          )}

          {result && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/80 text-muted">
                  <th className="py-1 px-2 font-medium">Item Name</th>
                  <th className="py-1 px-2 font-medium w-36">Status</th>
                  <th className="py-1 px-2 font-medium text-right w-24">Size in A</th>
                  <th className="py-1 px-2 font-medium text-right w-24">Size in B</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                {filteredItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-surface-hover/50">
                    <td className="py-1.5 px-2 truncate max-w-[280px]" title={item.name}>
                      {item.name}
                    </td>
                    <td className="py-1.5 px-2">{getStatusBadge(item.status)}</td>
                    <td className="py-1.5 px-2 text-right text-muted">
                      {item.sizeA !== undefined ? `${item.sizeA.toLocaleString()} B` : '—'}
                    </td>
                    <td className="py-1.5 px-2 text-right text-muted">
                      {item.sizeB !== undefined ? `${item.sizeB.toLocaleString()} B` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-sidebar/50">
          <span className="text-muted">
            {result ? `Compared ${result.totalCompared} entries.` : 'Ready'}
          </span>
          <button
            onClick={() => setCompareOpen(false)}
            className="px-4 py-1.5 rounded bg-surface hover:bg-surface-hover border border-border text-foreground"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
