import React, { useState } from 'react';
import { ArrowLeft, Check, Copy, Settings } from 'lucide-react';
import { useResolvedTheme } from '../hooks/useResolvedTheme';

interface TranscriptEntry {
  speaker: string;
  text: string;
  timestamp: number;
}

interface Meeting {
  id: string;
  title: string;
  date: string;
  duration: string;
  transcript?: TranscriptEntry[];
}

interface MeetingDetailsProps {
  meeting: Meeting;
  onBack: () => void;
  onOpenSettings: (tab?: string) => void;
}

const MeetingDetails: React.FC<MeetingDetailsProps> = ({
  meeting: initialMeeting,
  onBack,
  onOpenSettings,
}) => {
  const isLight = useResolvedTheme() === 'light';
  const [meeting, setMeeting] = useState(initialMeeting);
  const [copied, setCopied] = useState(false);

  const copyTranscript = async () => {
    const text = (meeting.transcript || []).map((item) => `${item.speaker}: ${item.text}`).join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const rename = async () => {
    const title = window.prompt('Meeting title', meeting.title)?.trim();
    if (!title || title === meeting.title) return;
    const updated = await window.electronAPI.updateMeetingTitle(meeting.id, title);
    if (updated) setMeeting((current) => ({ ...current, title }));
  };

  return (
    <div className={`h-full w-full flex flex-col ${isLight ? 'bg-bg-secondary' : 'bg-bg-elevated'} text-text-primary`}>
      <header className="shrink-0 border-b border-border-subtle px-8 py-5">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between gap-4">
            <button type="button" onClick={onBack} className="flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary">
              <ArrowLeft size={15} /> Back to meetings
            </button>
            <button type="button" onClick={() => onOpenSettings('audio')} className="p-2 text-text-secondary hover:text-text-primary" title="Transcription settings">
              <Settings size={16} />
            </button>
          </div>
          <button type="button" onClick={() => void rename()} className="mt-4 text-left">
            <h1 className="text-2xl font-semibold tracking-tight">{meeting.title}</h1>
            <p className="mt-1 text-xs text-text-tertiary">
              {new Date(meeting.date).toLocaleString()} · {meeting.duration || '00:00'}
            </p>
          </button>
          <div className="mt-5 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">Transcript</h2>
            <button type="button" onClick={() => void copyTranscript()} className="flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary">
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy transcript'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto px-8 py-7">
        <div className="max-w-4xl mx-auto">
          <div className="space-y-4">
            {(meeting.transcript || []).map((entry, index) => (
              <div key={`${entry.timestamp}-${index}`} className="border-b border-border-subtle pb-4 last:border-0">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold capitalize text-text-primary">{entry.speaker || 'Speaker'}</span>
                  {entry.timestamp ? (
                    <span className="text-text-tertiary">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                  ) : null}
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{entry.text}</p>
              </div>
            ))}
            {!meeting.transcript?.length && (
              <p className="text-sm text-text-tertiary">No transcript was saved for this meeting.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default MeetingDetails;
