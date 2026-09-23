import { BrowserWindow } from 'electron';
import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';
import { DatabaseManager, type Meeting } from './db/DatabaseManager';
import { SettingsManager } from './services/SettingsManager';

export interface RawTranscriptSegment {
  speaker: string;
  speakerId?: string;
  text: string;
  timestamp: number;
  final: boolean;
  confidence?: number;
  origin?: 'stt' | 'test' | 'manual_chat' | 'assistant';
  sttProvider?: string;
  punctuationSource?: string;
}

interface MeetingMetadata {
  title?: string;
  calendarEventId?: string;
  source?: 'manual' | 'calendar';
  doNotPersist?: boolean;
}

/**
 * Generation-free meeting session store.
 *
 * This replaces IntelligenceManager for the web-only product. It retains every
 * finalized STT segment verbatim and persists raw meetings without invoking a
 * model, embedding pipeline, summarizer, profile router, or answer engine.
 */
export class MeetingSessionManager extends EventEmitter {
  private transcript: RawTranscriptSegment[] = [];
  private startedAt = Date.now();
  private metadata: MeetingMetadata | null = null;

  public startMeeting(metadata?: MeetingMetadata | null): void {
    this.transcript = [];
    this.startedAt = Date.now();
    this.metadata = metadata ?? null;
  }

  public setMeetingMetadata(metadata: MeetingMetadata): void {
    this.metadata = { ...(this.metadata ?? {}), ...metadata };
  }

  public handleTranscript(segment: RawTranscriptSegment): void {
    if (!segment.final) return;
    if (!segment.text.trim()) return;
    this.transcript.push({ ...segment });
  }

  public getContext(_maxAgeSeconds?: number): RawTranscriptSegment[] {
    return [...this.transcript];
  }

  public async stopMeeting(): Promise<{ meetingId: string; memoryEligibleCount: number } | null> {
    const durationMs = Math.max(0, Date.now() - this.startedAt);
    const snapshot = [...this.transcript];
    const metadata = this.metadata;
    this.transcript = [];
    this.metadata = null;

    const retention = SettingsManager.getInstance().get('meetingRetention');
    if (retention === 'never' || metadata?.doNotPersist) return null;
    if (durationMs < 1000 && snapshot.length === 0) return null;

    const meetingId = crypto.randomUUID();
    const started = new Date(this.startedAt);
    const minutes = Math.floor(durationMs / 60_000);
    const seconds = Math.floor((durationMs % 60_000) / 1000);
    const title = metadata?.title?.trim() || `Meeting ${started.toLocaleString()}`;
    const meeting: Meeting = {
      id: meetingId,
      title,
      date: started.toISOString(),
      duration: `${minutes}:${String(seconds).padStart(2, '0')}`,
      summary: '',
      detailedSummary: { actionItems: [], keyPoints: [] },
      transcript: snapshot,
      usage: [],
      calendarEventId: metadata?.calendarEventId,
      source: metadata?.source ?? 'manual',
      isProcessed: true,
      summaryStatus: 'completed',
    };

    DatabaseManager.getInstance().saveMeeting(meeting, this.startedAt, durationMs);
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('meetings-updated');
    }
    return { meetingId, memoryEligibleCount: snapshot.length };
  }

}
