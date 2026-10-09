import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { api } from '../api';
import { X, Sparkles, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';
import { BatchRenamePair } from '../types';

export const BatchRenameModal: React.FC = () => {
  const { batchRenameOpen, setBatchRenameOpen, tabs, activeTabId, navigateTab } = useAppStore();
  const tab = tabs.find((t) => t.id === activeTabId);

  const selectedPaths = tab?.selectedPaths || [];

  const [mode, setMode] = useState<'replace' | 'prefix' | 'number' | 'case'>('replace');
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [prefixText, setPrefixText] = useState('');
  const [suffixText, setSuffixText] = useState('');
  const [startNumber, setStartNumber] = useState(1);
  const [padDigits, setPadDigits] = useState(2);
  const [caseType, setCaseType] = useState<'lower' | 'upper' | 'title'>('lower');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Compute preview pairs
  const previewPairs = useMemo(() => {
    return selectedPaths.map((fullPath, idx) => {
      const parts = fullPath.split('\\');
      const oldName = parts.pop() || '';
      const parentDir = parts.join('\\');
      const dotIdx = oldName.lastIndexOf('.');
      const baseName = dotIdx > 0 ? oldName.slice(0, dotIdx) : oldName;
      const ext = dotIdx > 0 ? oldName.slice(dotIdx) : '';

      let newName = oldName;

      if (mode === 'replace') {
        if (findText) {
          newName = oldName.replaceAll(findText, replaceText);
        }
      } else if (mode === 'prefix') {
        newName = `${prefixText}${baseName}${suffixText}${ext}`;
      } else if (mode === 'number') {
        const num = String(startNumber + idx).padStart(padDigits, '0');
        newName = `${baseName}_${num}${ext}`;
      } else if (mode === 'case') {
        if (caseType === 'lower') {
          newName = `${baseName.toLowerCase()}${ext.toLowerCase()}`;
        } else if (caseType === 'upper') {
          newName = `${baseName.toUpperCase()}${ext.toUpperCase()}`;
        } else if (caseType === 'title') {
          const title = baseName.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
          newName = `${title}${ext}`;
        }
      }

      const newFullPath = parentDir ? `${parentDir}\\${newName}` : newName;
      return {
        oldPath: fullPath,
        newPath: newFullPath,
        oldName,
        newName,
      };
    });
  }, [selectedPaths, mode, findText, replaceText, prefixText, suffixText, startNumber, padDigits, caseType]);

  // Collision detection
  const hasCollisions = useMemo(() => {
    const newNames = previewPairs.map((p) => p.newName.toLowerCase());
    const unique = new Set(newNames);
    return unique.size !== newNames.length;
  }, [previewPairs]);

  if (!batchRenameOpen) return null;

  const handleApply = async () => {
    if (hasCollisions) {
      setErrorMessage('Collision detected! Multiple files would have the same name.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const pairs: BatchRenamePair[] = previewPairs
        .filter((p) => p.oldPath !== p.newPath)
        .map((p) => ({
          oldPath: p.oldPath,
          newPath: p.newPath,
        }));

      if (pairs.length > 0) {
        await api.batchRename(pairs);
      }

      if (tab) {
        navigateTab(tab.id, tab.path);
      }
      setBatchRenameOpen(false);
    } catch (err: any) {
      setErrorMessage(String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-sidebar/50">
          <div className="flex items-center gap-2 font-medium text-foreground text-sm">
            <Sparkles className="w-4 h-4 text-accent" />
            <span>Batch Rename ({selectedPaths.length} items)</span>
          </div>
          <button
            onClick={() => setBatchRenameOpen(false)}
            className="p-1 rounded hover:bg-surface-hover text-muted hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="flex border-b border-border px-4 py-2 gap-2 bg-background/50">
          <button
            onClick={() => setMode('replace')}
            className={`px-3 py-1.5 rounded font-medium transition-colors ${
              mode === 'replace' ? 'bg-primary text-primary-foreground' : 'hover:bg-surface text-muted'
            }`}
          >
            Find & Replace
          </button>
          <button
            onClick={() => setMode('prefix')}
            className={`px-3 py-1.5 rounded font-medium transition-colors ${
              mode === 'prefix' ? 'bg-primary text-primary-foreground' : 'hover:bg-surface text-muted'
            }`}
          >
            Prefix / Suffix
          </button>
          <button
            onClick={() => setMode('number')}
            className={`px-3 py-1.5 rounded font-medium transition-colors ${
              mode === 'number' ? 'bg-primary text-primary-foreground' : 'hover:bg-surface text-muted'
            }`}
          >
            Numbering
          </button>
          <button
            onClick={() => setMode('case')}
            className={`px-3 py-1.5 rounded font-medium transition-colors ${
              mode === 'case' ? 'bg-primary text-primary-foreground' : 'hover:bg-surface text-muted'
            }`}
          >
            Change Case
          </button>
        </div>

        {/* Inputs */}
        <div className="p-4 border-b border-border bg-sidebar/30">
          {mode === 'replace' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-muted mb-1">Find text</label>
                <input
                  type="text"
                  value={findText}
                  onChange={(e) => setFindText(e.target.value)}
                  placeholder="e.g. IMG_"
                  className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-foreground outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-muted mb-1">Replace with</label>
                <input
                  type="text"
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  placeholder="e.g. Photo_"
                  className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-foreground outline-none focus:border-primary"
                />
              </div>
            </div>
          )}

          {mode === 'prefix' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-muted mb-1">Add prefix</label>
                <input
                  type="text"
                  value={prefixText}
                  onChange={(e) => setPrefixText(e.target.value)}
                  placeholder="e.g. 2026_"
                  className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-foreground outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-muted mb-1">Add suffix</label>
                <input
                  type="text"
                  value={suffixText}
                  onChange={(e) => setSuffixText(e.target.value)}
                  placeholder="e.g. _v1"
                  className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-foreground outline-none focus:border-primary"
                />
              </div>
            </div>
          )}

          {mode === 'number' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-muted mb-1">Start number</label>
                <input
                  type="number"
                  value={startNumber}
                  onChange={(e) => setStartNumber(Number(e.target.value))}
                  className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-foreground outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-muted mb-1">Pad digits (e.g. 01, 001)</label>
                <input
                  type="number"
                  min="1"
                  max="6"
                  value={padDigits}
                  onChange={(e) => setPadDigits(Number(e.target.value))}
                  className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-foreground outline-none focus:border-primary"
                />
              </div>
            </div>
          )}

          {mode === 'case' && (
            <div className="flex gap-4 items-center">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="caseType"
                  checked={caseType === 'lower'}
                  onChange={() => setCaseType('lower')}
                />
                <span>lowercase</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="caseType"
                  checked={caseType === 'upper'}
                  onChange={() => setCaseType('upper')}
                />
                <span>UPPERCASE</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="caseType"
                  checked={caseType === 'title'}
                  onChange={() => setCaseType('title')}
                />
                <span>Title Case</span>
              </label>
            </div>
          )}
        </div>

        {/* Live Preview Table */}
        <div className="flex-1 overflow-auto p-4 max-h-64">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/80 text-muted">
                <th className="py-1 px-2 font-medium">Original Name</th>
                <th className="py-1 px-2 w-6 text-center"></th>
                <th className="py-1 px-2 font-medium">Renamed Name</th>
                <th className="py-1 px-2 w-20 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-mono">
              {previewPairs.map((p, idx) => {
                const changed = p.oldName !== p.newName;
                return (
                  <tr key={idx} className="hover:bg-surface-hover/50">
                    <td className="py-1.5 px-2 text-muted truncate max-w-[200px]" title={p.oldName}>
                      {p.oldName}
                    </td>
                    <td className="py-1.5 px-2 text-center text-muted">
                      <ArrowRight className="w-3 h-3 inline" />
                    </td>
                    <td
                      className={`py-1.5 px-2 truncate max-w-[200px] ${
                        changed ? 'text-accent font-semibold' : 'text-muted'
                      }`}
                      title={p.newName}
                    >
                      {p.newName}
                    </td>
                    <td className="py-1.5 px-2 text-right">
                      {changed ? (
                        <span className="text-emerald-400 inline-flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Ready
                        </span>
                      ) : (
                        <span className="text-muted">Unchanged</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Collision or Error Notice */}
        {hasCollisions && (
          <div className="px-4 py-2 bg-amber-500/10 border-t border-amber-500/30 text-amber-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Target collisions detected! Multiple files would be given the same name.</span>
          </div>
        )}

        {errorMessage && (
          <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/30 text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border bg-sidebar/50">
          <button
            onClick={() => setBatchRenameOpen(false)}
            className="px-3 py-1.5 rounded hover:bg-surface text-muted hover:text-foreground"
          >
            Cancel
          </button>
          <button
            disabled={hasCollisions || isSubmitting}
            onClick={handleApply}
            className="px-4 py-1.5 rounded bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-40 disabled:hover:bg-primary"
          >
            {isSubmitting ? 'Renaming...' : 'Apply Batch Rename'}
          </button>
        </div>
      </div>
    </div>
  );
};
