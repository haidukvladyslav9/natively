import React, { useEffect, useRef, useState } from 'react';
import { Camera, Ghost, MessageSquare } from 'lucide-react';
import { useShortcuts } from '../hooks/useShortcuts';
import { getModifierSymbol } from '../utils/platformUtils';

const Toggle = ({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
}) => (
  <button
    type="button"
    role="switch"
    aria-label={label}
    aria-checked={checked}
    onClick={onChange}
    className={`relative h-4 w-8 rounded-full transition-colors ${checked ? 'bg-accent-primary' : 'bg-bg-toggle-switch'}`}
  >
    <span
      className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
        checked ? 'translate-x-4' : 'translate-x-0.5'
      }`}
    />
  </button>
);

const SettingsPopup: React.FC = () => {
  const panelRef = useRef<HTMLDivElement>(null);
  const { shortcuts } = useShortcuts();
  const [isUndetectable, setIsUndetectable] = useState(
    () => localStorage.getItem('natively_undetectable') === 'true',
  );
  const [showTranscript, setShowTranscript] = useState(
    () => localStorage.getItem('natively_interviewer_transcript') !== 'false',
  );

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const updateSize = () => {
      const rect = panel.getBoundingClientRect();
      void window.electronAPI.updateContentDimensions?.({
        width: Math.ceil(rect.width),
        height: Math.ceil(rect.height),
      });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  const shortcut = (keys: string[] | undefined, fallback: string[]) => (
    <div className="flex gap-1">
      {(keys || fallback).map((key, index) => (
        <kbd key={`${key}-${index}`} className="min-w-5 rounded border border-border-subtle px-1 py-0.5 text-center text-[9px] text-text-secondary">
          {key}
        </kbd>
      ))}
    </div>
  );

  return (
    <div ref={panelRef} className="w-[190px] rounded-[14px] border border-border-subtle bg-bg-elevated/95 p-2 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-bg-subtle/50">
        <div className="flex items-center gap-2 text-xs text-text-primary">
          <Ghost className="h-4 w-4" />
          Undetectable
        </div>
        <Toggle
          checked={isUndetectable}
          label="Undetectable"
          onChange={() => {
            const next = !isUndetectable;
            setIsUndetectable(next);
            localStorage.setItem('natively_undetectable', String(next));
            void window.electronAPI.setUndetectable(next);
          }}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-bg-subtle/50">
        <div className="flex items-center gap-2 text-xs text-text-primary">
          <MessageSquare className="h-4 w-4" />
          Transcript
        </div>
        <Toggle
          checked={showTranscript}
          label="Transcript"
          onChange={() => {
            const next = !showTranscript;
            setShowTranscript(next);
            localStorage.setItem('natively_interviewer_transcript', String(next));
            window.dispatchEvent(new Event('storage'));
          }}
        />
      </div>

      <div className="my-1 h-px bg-border-subtle" />

      <div className="flex items-center justify-between rounded-lg px-2 py-2 text-xs text-text-primary">
        <span>Show / hide</span>
        {shortcut(shortcuts.toggleVisibility, [getModifierSymbol('cmd'), 'B'])}
      </div>
      <div className="flex items-center justify-between rounded-lg px-2 py-2 text-xs text-text-primary">
        <span className="flex items-center gap-2"><Camera className="h-3.5 w-3.5" /> Screenshot</span>
        {shortcut(shortcuts.takeScreenshot, [getModifierSymbol('cmd'), 'H'])}
      </div>
    </div>
  );
};

export default SettingsPopup;
