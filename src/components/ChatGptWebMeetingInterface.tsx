import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Camera,
  Check,
  ExternalLink,
  Image,
  LoaderCircle,
  MessageSquare,
  Scissors,
  Send,
  Settings,
  Square,
  X,
} from 'lucide-react';
import { useResolvedTheme } from '../hooks/useResolvedTheme';

interface MeetingSummary {
  id: string;
  title: string;
  date: string;
  duration: string;
  summary: string;
}

interface ScreenshotAttachment {
  path: string;
  preview: string;
}

interface ChatGptWebMeetingInterfaceProps {
  onEndMeeting?: () => void;
}

const ChatGptWebMeetingInterface: React.FC<ChatGptWebMeetingInterfaceProps> = ({
  onEndMeeting,
}) => {
  const isLight = useResolvedTheme() === 'light';
  const [question, setQuestion] = useState('');
  const [screenshots, setScreenshots] = useState<ScreenshotAttachment[]>([]);
  const [meetings, setMeetings] = useState<MeetingSummary[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState('');
  const [includeCurrentTranscript, setIncludeCurrentTranscript] = useState(true);
  const [includeSavedMeeting, setIncludeSavedMeeting] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const attachScreenshot = useCallback((attachment: ScreenshotAttachment) => {
    if (!attachment?.path) return;
    setScreenshots((current) => {
      if (current.some((item) => item.path === attachment.path)) return current;
      return [...current, attachment].slice(-5);
    });
  }, []);

  useEffect(() => {
    void window.electronAPI.getRecentMeetings()
      .then(setMeetings)
      .catch((error) => console.error('Failed to load saved meetings:', error));
  }, []);

  const canSend = question.trim().length > 0 && !sending;
  const contextSummary = useMemo(() => {
    const parts = [];
    if (includeCurrentTranscript) parts.push('current transcript');
    if (screenshots.length) parts.push(`${screenshots.length} screenshot${screenshots.length === 1 ? '' : 's'}`);
    if (includeSavedMeeting && selectedMeetingId) parts.push('saved meeting');
    return parts.join(', ');
  }, [includeCurrentTranscript, screenshots.length, includeSavedMeeting, selectedMeetingId]);

  const captureScreen = async (selective: boolean) => {
    setStatus(null);
    try {
      const result = selective
        ? await window.electronAPI.takeSelectiveScreenshot()
        : await window.electronAPI.takeScreenshot();
      if (result && 'path' in result && result.path && !('cancelled' in result && result.cancelled)) {
        attachScreenshot(result as ScreenshotAttachment);
      }
    } catch (error) {
      setStatus({ kind: 'error', text: error instanceof Error ? error.message : 'Screenshot capture failed.' });
    }
  };

  const sendToChatGpt = async () => {
    if (!canSend) return;
    setSending(true);
    setStatus(null);
    try {
      const result = await window.electronAPI.sendToChatGptWeb({
        prompt: `Question:\n${question.trim()}`,
        imagePaths: screenshots.map((item) => item.path),
        includeCurrentTranscript,
        savedMeetingId: includeSavedMeeting && selectedMeetingId ? selectedMeetingId : undefined,
      });
      if (!result.success) throw new Error(result.error || 'Could not send to ChatGPT Web.');
      setQuestion('');
      setScreenshots([]);
      setStatus({ kind: 'success', text: 'Sent to ChatGPT Web. Continue there to read the reply.' });
    } catch (error) {
      setStatus({ kind: 'error', text: error instanceof Error ? error.message : 'Could not send to ChatGPT Web.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="w-full h-full flex items-start justify-center bg-transparent p-3 text-text-primary">
      <section
        className={`w-[620px] max-w-full max-h-full overflow-y-auto rounded-2xl border shadow-2xl backdrop-blur-2xl no-drag ${
          isLight ? 'bg-white/95 border-black/10' : 'bg-[#171719]/95 border-white/10'
        }`}
      >
        <header className="drag-region flex items-center justify-between gap-3 px-4 py-3 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <div>
              <h1 className="text-sm font-semibold">Ask ChatGPT Web</h1>
              <p className="text-[11px] text-text-tertiary">Natively sends context but never reads replies.</p>
            </div>
          </div>
          <div className="no-drag flex items-center gap-2">
            <button
              type="button"
              onClick={() => void window.electronAPI.openSettingsTab('audio')}
              className="p-2 rounded-lg hover:bg-bg-subtle text-text-secondary"
              title="Open transcription settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => void window.electronAPI.openChatGptWeb()}
              className="p-2 rounded-lg hover:bg-bg-subtle text-text-secondary"
              title="Open ChatGPT Web"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onEndMeeting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-medium"
            >
              <Square className="w-3 h-3 fill-current" />
              End
            </button>
          </div>
        </header>

        <div className="p-4 space-y-4">
          <label className="flex items-center gap-2 rounded-xl border border-border-subtle bg-bg-subtle/30 p-3 text-xs font-semibold">
            <input
              type="checkbox"
              checked={includeCurrentTranscript}
              onChange={(event) => setIncludeCurrentTranscript(event.target.checked)}
            />
            Include the current meeting transcript
            <span className="ml-auto text-[11px] font-normal text-text-tertiary">
              Added securely when sent
            </span>
          </label>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold">Pending screenshots</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void captureScreen(false)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border-subtle hover:bg-bg-subtle text-[11px]"
                >
                  <Camera className="w-3.5 h-3.5" /> Capture
                </button>
                <button
                  type="button"
                  onClick={() => void captureScreen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border-subtle hover:bg-bg-subtle text-[11px]"
                >
                  <Scissors className="w-3.5 h-3.5" /> Select area
                </button>
              </div>
            </div>
            {screenshots.length ? (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {screenshots.map((screenshot) => (
                  <div key={screenshot.path} className="relative shrink-0 group">
                    <img src={screenshot.preview} alt="Pending screenshot" className="h-16 rounded-lg border border-border-subtle" />
                    <button
                      type="button"
                      onClick={() => setScreenshots((items) => items.filter((item) => item.path !== screenshot.path))}
                      className="absolute -top-1.5 -right-1.5 rounded-full bg-red-500 p-1 opacity-0 group-hover:opacity-100"
                      aria-label="Remove screenshot"
                    >
                      <X className="w-2.5 h-2.5 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[11px] text-text-tertiary py-2">
                <Image className="w-4 h-4" /> Captures will queue here until sent.
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border-subtle p-3">
            <label className="flex items-center gap-2 text-xs font-semibold mb-2">
              <input
                type="checkbox"
                checked={includeSavedMeeting}
                onChange={(event) => setIncludeSavedMeeting(event.target.checked)}
              />
              Include a saved meeting transcript and notes
            </label>
            <select
              value={selectedMeetingId}
              onChange={(event) => setSelectedMeetingId(event.target.value)}
              disabled={!includeSavedMeeting}
              className="w-full rounded-lg border border-border-subtle bg-bg-input px-3 py-2 text-xs disabled:opacity-50"
            >
              <option value="">Select a saved meeting…</option>
              {meetings.map((meeting) => (
                <option key={meeting.id} value={meeting.id}>
                  {meeting.title} — {new Date(meeting.date).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="chatgpt-question" className="block text-xs font-semibold mb-2">
              Question
            </label>
            <textarea
              id="chatgpt-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  void sendToChatGpt();
                }
              }}
              placeholder="Type the question to send to ChatGPT Web…"
              rows={3}
              className="w-full resize-none rounded-xl border border-border-subtle bg-bg-input px-3 py-2.5 text-sm outline-none focus:border-emerald-500/50"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] text-text-tertiary">
              {status ? (
                <span className={status.kind === 'error' ? 'text-red-400' : 'text-emerald-400'}>
                  {status.text}
                </span>
              ) : contextSummary ? (
                `Will include: ${contextSummary}`
              ) : (
                'Only your typed question will be sent.'
              )}
            </div>
            <button
              type="button"
              disabled={!canSend}
              onClick={() => void sendToChatGpt()}
              className="shrink-0 flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sending ? <LoaderCircle className="w-4 h-4 animate-spin" /> : status?.kind === 'success' ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              Send to ChatGPT Web
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ChatGptWebMeetingInterface;
