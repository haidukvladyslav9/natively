import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Download,
  MessageSquare,
  MoreHorizontal,
  Play,
  RefreshCw,
  Settings,
  Trash2,
} from 'lucide-react';
import { generateMeetingPDF } from '../utils/pdfGenerator';
import { useResolvedTheme } from '../hooks/useResolvedTheme';
import { isMac } from '../utils/platformUtils';
import WindowControls from './WindowControls';
import MeetingDetails from './MeetingDetails';

interface Meeting {
  id: string;
  title: string;
  date: string;
  duration: string;
  transcript?: Array<{ speaker: string; text: string; timestamp: number }>;
}

interface LauncherProps {
  onStartMeeting: () => void;
  onOpenSettings: (tab?: string) => void;
  onPageChange?: (isMain: boolean) => void;
}

function formatDuration(value: string): string {
  if (!value) return '00:00';
  if (value.includes(':')) return value;
  const minutes = Number.parseInt(value, 10);
  return `${Number.isFinite(minutes) ? String(minutes).padStart(2, '0') : '00'}:00`;
}

const Launcher: React.FC<LauncherProps> = ({
  onStartMeeting,
  onOpenSettings,
  onPageChange,
}) => {
  const isLight = useResolvedTheme() === 'light';
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [forwardMeeting, setForwardMeeting] = useState<Meeting | null>(null);
  const [isMeetingActive, setIsMeetingActive] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const loadMeetings = async () => {
    const recent = await window.electronAPI.getRecentMeetings();
    setMeetings(recent);
  };

  useEffect(() => {
    void loadMeetings().catch((error) => console.error('Failed to load meetings:', error));
    void window.electronAPI.getMeetingActive?.().then(setIsMeetingActive).catch(() => {});
    const removeMeetings = window.electronAPI.onMeetingsUpdated?.(() => {
      void loadMeetings().catch((error) => console.error('Failed to refresh meetings:', error));
    });
    const removeMeetingState = window.electronAPI.onMeetingStateChanged?.(({ isActive }) => {
      setIsMeetingActive(isActive);
    });
    return () => {
      removeMeetings?.();
      removeMeetingState?.();
    };
  }, []);

  useEffect(() => {
    onPageChange?.(!selectedMeeting);
  }, [selectedMeeting, onPageChange]);

  const groupedMeetings = useMemo(() => {
    return meetings.reduce<Record<string, Meeting[]>>((groups, meeting) => {
      const date = new Date(meeting.date);
      const label = Number.isNaN(date.getTime())
        ? 'Recent'
        : date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      (groups[label] ||= []).push(meeting);
      return groups;
    }, {});
  }, [meetings]);

  const openMeeting = async (meeting: Meeting) => {
    setForwardMeeting(null);
    try {
      const details = await window.electronAPI.getMeetingDetails(meeting.id);
      setSelectedMeeting(details || meeting);
    } catch {
      setSelectedMeeting(meeting);
    }
  };

  const refresh = async () => {
    setIsRefreshing(true);
    try {
      await window.electronAPI.calendarRefresh?.();
      await loadMeetings();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-bg-primary text-text-primary overflow-hidden">
      <header className={`h-10 shrink-0 flex items-center justify-between border-b border-border-subtle drag-region ${isLight ? 'bg-bg-primary' : 'bg-bg-secondary'}`}>
        <div className="flex items-center gap-1 no-drag">
          {isMac && <div className="w-[70px]" />}
          <button
            type="button"
            disabled={!selectedMeeting}
            onClick={() => {
              setForwardMeeting(selectedMeeting);
              setSelectedMeeting(null);
            }}
            className="p-1.5 text-text-secondary disabled:opacity-30"
            aria-label="Back"
          >
            <ArrowLeft size={16} />
          </button>
          <button
            type="button"
            disabled={!forwardMeeting}
            onClick={() => {
              setSelectedMeeting(forwardMeeting);
              setForwardMeeting(null);
            }}
            className="p-1.5 text-text-secondary disabled:opacity-30"
            aria-label="Forward"
          >
            <ArrowRight size={16} />
          </button>
        </div>

        <div className="flex items-center gap-1 no-drag">
          <button
            type="button"
            onClick={() => void window.electronAPI.openChatGptWeb()}
            className="p-2 text-text-secondary hover:text-text-primary"
            title="Open ChatGPT Web"
          >
            <MessageSquare size={18} />
          </button>
          <button
            type="button"
            onClick={() => onOpenSettings('general')}
            className="p-2 text-text-secondary hover:text-text-primary"
            title="Settings"
          >
            <Settings size={18} />
          </button>
          {!isMac && <WindowControls />}
        </div>
      </header>

      {selectedMeeting ? (
        <div className="flex-1 min-h-0">
          <MeetingDetails
            meeting={selectedMeeting as any}
            onBack={() => {
              setForwardMeeting(selectedMeeting);
              setSelectedMeeting(null);
            }}
            onOpenSettings={onOpenSettings}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          <section className={`${isLight ? 'bg-bg-secondary' : 'bg-bg-elevated'} border-b border-border-subtle px-8 py-7`}>
            <div className="max-w-4xl mx-auto flex items-center justify-between gap-6">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">My Natively</h1>
                <p className="mt-1 text-sm text-text-secondary">
                  Capture meetings, keep transcripts, and send context to ChatGPT Web.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void refresh()}
                  disabled={isRefreshing}
                  className="p-2.5 rounded-full border border-border-subtle text-text-secondary hover:text-text-primary disabled:opacity-50"
                  title="Refresh meetings"
                >
                  <RefreshCw size={17} className={isRefreshing ? 'animate-spin' : ''} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (isMeetingActive) {
                      void window.electronAPI.setWindowMode('overlay', true);
                    } else {
                      onStartMeeting();
                    }
                  }}
                  className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white ${
                    isMeetingActive ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-sky-500 hover:bg-sky-400'
                  }`}
                >
                  <Play size={15} fill="currentColor" />
                  {isMeetingActive ? 'Meeting ongoing' : 'Start meeting'}
                </button>
              </div>
            </div>
          </section>

          <main className="flex-1 min-h-0 overflow-y-auto px-8 py-7">
            <div className="max-w-4xl mx-auto space-y-7">
              {Object.entries(groupedMeetings).map(([label, items]) => (
                <section key={label}>
                  <h2 className="mb-2 px-2 text-xs font-semibold text-text-secondary">{label}</h2>
                  <div className="space-y-1">
                    {items.map((meeting) => (
                      <div
                        key={meeting.id}
                        className="relative flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-bg-elevated cursor-pointer"
                        onClick={() => void openMeeting(meeting)}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{meeting.title}</div>
                        </div>
                        <div className="flex items-center gap-3 pl-4">
                          <span className="text-[10px] rounded-full bg-bg-elevated px-2 py-1 text-text-secondary">
                            {formatDuration(meeting.duration)}
                          </span>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setActiveMenuId((current) => current === meeting.id ? null : meeting.id);
                            }}
                            className="p-1.5 text-text-secondary hover:text-text-primary"
                            aria-label="Meeting actions"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                        </div>
                        {activeMenuId === meeting.id && (
                          <div
                            className="absolute right-2 top-10 z-20 w-28 rounded-lg border border-border-subtle bg-bg-elevated p-1 shadow-xl"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={async () => {
                                const details = await window.electronAPI.getMeetingDetails(meeting.id).catch(() => meeting);
                                generateMeetingPDF(details || meeting);
                                setActiveMenuId(null);
                              }}
                              className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-bg-item-surface"
                            >
                              <Download size={13} /> Export
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (await window.electronAPI.deleteMeeting(meeting.id)) {
                                  setMeetings((current) => current.filter((item) => item.id !== meeting.id));
                                }
                                setActiveMenuId(null);
                              }}
                              className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
              {meetings.length === 0 && (
                <div className="py-16 text-center text-sm text-text-tertiary">No saved meetings yet.</div>
              )}
            </div>
          </main>
        </div>
      )}
    </div>
  );
};

export default Launcher;
