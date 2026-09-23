import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useToggleInit } from './useToggleInit';

export const STT_PROVIDER_CSS = `
.aip-root {
  --aip-accent:var(--accent-primary); --aip-primary:rgba(255,255,255,.86);
  --aip-secondary:rgba(255,255,255,.56); --aip-tertiary:rgba(255,255,255,.34);
  --aip-border:rgba(255,255,255,.07); --aip-border-strong:rgba(255,255,255,.12);
  --aip-card-bg:var(--bg-item-surface); --aip-card-border:var(--border-subtle);
  --aip-well-bg:rgba(0,0,0,.22); --aip-btn-bg:rgba(255,255,255,.06);
  --aip-btn-bg-hover:rgba(255,255,255,.10); --aip-btn-border:rgba(255,255,255,.10);
  --aip-switch-off:var(--toggle-off); --aip-ok:#22c55e; --aip-ok-bg:rgba(34,197,94,.14);
  --aip-ok-border:rgba(34,197,94,.24); --aip-info:#3b82f6; --aip-info-bg:rgba(59,130,246,.14);
  --aip-info-border:rgba(59,130,246,.24); --aip-warn:#facc15; --aip-warn-bg:rgba(250,204,21,.12);
  --aip-warn-border:rgba(250,204,21,.22); --aip-danger:var(--text-danger);
  --aip-danger-bg:rgba(239,68,68,.12); --aip-danger-border:rgba(239,68,68,.24);
  --aip-r-sm:6px; --aip-r-md:10px; --aip-r-lg:12px; --aip-r-pill:9999px;
  --aip-ease-out:cubic-bezier(.23,1,.32,1); --aip-ease-spring:cubic-bezier(.34,1.56,.64,1);
  --aip-dur-press:110ms; --aip-dur-state:160ms; --aip-dur-travel:220ms;
}
.aip-root[data-theme='light'] {
  --aip-primary:#374151; --aip-secondary:#6b7280; --aip-tertiary:#8e8e93;
  --aip-border:rgba(0,0,0,.08); --aip-border-strong:rgba(0,0,0,.13);
  --aip-well-bg:rgba(0,0,0,.06); --aip-btn-bg:rgba(0,0,0,.04);
  --aip-btn-bg-hover:rgba(0,0,0,.075); --aip-btn-border:rgba(0,0,0,.08);
  --aip-ok:#15803d; --aip-ok-bg:rgba(34,197,94,.10); --aip-ok-border:rgba(21,128,61,.20);
  --aip-info:#1d4ed8; --aip-info-bg:rgba(59,130,246,.09); --aip-info-border:rgba(29,78,216,.18);
  --aip-warn:#a16207; --aip-warn-bg:rgba(250,204,21,.14); --aip-warn-border:rgba(161,98,7,.20);
}
@keyframes aip-spin { to { transform:rotate(360deg) } }
@keyframes aip-fade-up { from { opacity:0; transform:translateY(3px) } to { opacity:1; transform:none } }
@keyframes aip-check-in { from { opacity:0; transform:scale(.6) } to { opacity:1; transform:scale(1) } }
.aip-spinner{animation:aip-spin .65s linear infinite}.aip-panel-fade{animation:aip-fade-up var(--aip-dur-state) var(--aip-ease-out) both}
.aip-check{animation:aip-check-in 200ms var(--aip-ease-spring) both}
.aip-card{border:1px solid var(--aip-card-border);border-radius:var(--aip-r-lg);background:var(--aip-card-bg)}
.aip-provider{padding:14px;display:flex;flex-direction:column;gap:8px}
.aip-provider-head{display:flex;align-items:center;gap:12px;min-height:24px}
.aip-card-title{font-size:13px;font-weight:600;color:var(--aip-primary)}
.aip-well{background:var(--aip-well-bg);border:1px solid var(--aip-border);border-radius:var(--aip-r-md);overflow:hidden}
.aip-scroll-y{overflow-y:auto;overflow-x:hidden}
.aip-float{background:var(--bg-elevated);border:1px solid var(--aip-border-strong);border-radius:var(--aip-r-md);box-shadow:0 10px 28px rgba(0,0,0,.3)}
.aip-root :focus-visible{outline:2px solid var(--aip-accent);outline-offset:2px}
.aip-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 12px;border-radius:var(--aip-r-md);border:1px solid var(--aip-btn-border);background:var(--aip-btn-bg);color:var(--aip-primary);font-size:12px;font-weight:500;white-space:nowrap;transition:background var(--aip-dur-state)}
.aip-btn:hover:not(:disabled){background:var(--aip-btn-bg-hover)}.aip-btn:disabled{opacity:.5;cursor:not-allowed}
.aip-btn[data-size='sm']{height:26px;padding:0 9px;font-size:11px;border-radius:var(--aip-r-sm)}
.aip-btn[data-size='row']{height:28px;padding:0 10px}.aip-btn[data-icon='true']{width:28px;padding:0}
.aip-btn[data-variant='ghost']{background:transparent;border-color:transparent}.aip-btn[data-variant='danger-ghost']{color:var(--aip-danger);background:transparent}
.aip-badge{display:inline-flex;align-items:center;gap:4px;height:18px;padding:0 7px;border-radius:var(--aip-r-pill);border:1px solid transparent;font-size:9.5px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;line-height:1;white-space:nowrap}
.aip-badge-dot{width:5px;height:5px;border-radius:9999px;background:currentColor}.aip-badge-label{transition:opacity var(--aip-dur-state),filter var(--aip-dur-state)}
.aip-badge[data-fading='true'] .aip-badge-label{opacity:0;filter:blur(3px)}
.aip-badge[data-tone='ok']{color:var(--aip-ok);background:var(--aip-ok-bg);border-color:var(--aip-ok-border)}
.aip-badge[data-tone='info']{color:var(--aip-info);background:var(--aip-info-bg);border-color:var(--aip-info-border)}
.aip-badge[data-tone='warn']{color:var(--aip-warn);background:var(--aip-warn-bg);border-color:var(--aip-warn-border)}
.aip-badge[data-tone='danger']{color:var(--aip-danger);background:var(--aip-danger-bg);border-color:var(--aip-danger-border)}
.aip-badge[data-tone='neutral']{color:var(--aip-secondary);background:var(--aip-btn-bg);border-color:var(--aip-border)}
.aip-inline-warn{padding:8px 10px;border-radius:var(--aip-r-md);background:var(--aip-warn-bg);border:1px solid var(--aip-warn-border);color:var(--aip-warn);font-size:11px}
.aip-switch{width:44px;height:20px;--toggle-inset:2px;--toggle-thumb-w:26px;--toggle-thumb-h:16px;--toggle-travel:14px;--toggle-grow:2px;flex-shrink:0;background:var(--aip-switch-off)}
.aip-switch[aria-checked='true']{background:var(--toggle-on)}.aip-switch:disabled{opacity:.5}
.aip-select{position:relative}.aip-select-trigger{width:100%;height:32px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 10px;border:1px solid var(--aip-border-strong);border-radius:var(--aip-r-md);background:transparent;color:var(--aip-primary);font-size:12px}
.aip-select-chevron{color:var(--aip-tertiary);transition:transform var(--aip-dur-state)}[aria-expanded='true'] .aip-select-chevron{transform:rotate(180deg)}
.aip-select-list{max-height:220px;padding:4px}.aip-select-option{width:100%;display:flex;align-items:center;justify-content:space-between;padding:7px 8px;border-radius:var(--aip-r-sm);font-size:12px;color:var(--aip-secondary)}
.aip-select-option:hover,.aip-select-option[aria-selected='true']{background:var(--aip-btn-bg);color:var(--aip-primary)}
.aip-select-empty{padding:10px;font-size:11px;color:var(--aip-tertiary)}.aip-model-check{color:var(--aip-accent)}
`;

export type SttProviderTone = 'ok' | 'info' | 'warn' | 'danger' | 'neutral';

export const SttProviderBadge: React.FC<{
  tone: SttProviderTone;
  label: string;
  busy?: boolean;
  title?: string;
  className?: string;
}> = ({ tone, label, busy = false, title, className = '' }) => {
  const [fading, setFading] = useState(false);
  const previousLabel = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (previousLabel.current !== undefined && previousLabel.current !== label) {
      setFading(true);
      const timer = window.setTimeout(() => setFading(false), 170);
      previousLabel.current = label;
      return () => window.clearTimeout(timer);
    }
    previousLabel.current = label;
  }, [label]);
  return (
    <span className={`aip-badge ${className}`} data-tone={tone} data-fading={String(fading)} title={title}>
      {busy ? <Loader2 size={10} className="aip-spinner" /> : <span className="aip-badge-dot" />}
      <span className="aip-badge-label">{label}</span>
    </span>
  );
};

export const SttProviderSwitch: React.FC<{
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  title?: string;
  disabled?: boolean;
  hardDisabled?: boolean;
  className?: string;
}> = ({ checked, onChange, label, title, disabled = false, hardDisabled = false, className = '' }) => {
  const toggleInit = useToggleInit();
  return (
    <button
      type="button"
      role="switch"
      data-on={String(checked)}
      aria-checked={checked}
      aria-disabled={disabled || hardDisabled || undefined}
      aria-label={label}
      title={title}
      disabled={hardDisabled}
      onClick={() => {
        if (hardDisabled) return;
        if (!disabled) toggleInit.arm();
        onChange(!checked);
      }}
      className={`t-toggle aip-switch ${toggleInit.className} ${className}`}
    >
      <span className="t-toggle-thumb aip-switch-thumb" aria-hidden="true" />
    </button>
  );
};
