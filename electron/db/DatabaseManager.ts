import Database from 'better-sqlite3';
import { app } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type MeetingSummaryStatus =
    | 'queued'
    | 'chunking'
    | 'summarizing_chunks'
    | 'reducing'
    | 'validating'
    | 'completed'
    | 'failed';

export interface MeetingTranscriptSegment {
    speaker: string;
    text: string;
    timestamp: number;
    final?: boolean;
    confidence?: number;
    origin?: string;
    speakerId?: string;
    sttProvider?: string;
    punctuationSource?: string;
}

/**
 * The persisted meeting shape used by the web-only workflow.
 *
 * summary/detailedSummary and usage remain readable for databases created by
 * older releases. They are opaque compatibility data here: this manager does
 * not generate, validate, index, or otherwise interpret them.
 */
export interface Meeting {
    id: string;
    title: string;
    date: string;
    duration: string;
    transcript?: MeetingTranscriptSegment[];
    calendarEventId?: string;
    source?: 'manual' | 'calendar';
    isProcessed?: boolean;
    summary?: string;
    detailedSummary?: Record<string, unknown>;
    summaryStatus?: MeetingSummaryStatus;
    usage?: Array<{
        type: 'assist' | 'followup' | 'chat' | 'followup_questions';
        timestamp: number;
        question?: string;
        answer?: string | string[];
        items?: string[];
    }>;
}

type MeetingRow = {
    id: string;
    title: string | null;
    start_time: number | null;
    duration_ms: number | null;
    summary_json: string | null;
    created_at: string | null;
    calendar_event_id: string | null;
    source: string | null;
    is_processed: number | null;
    summary_status: string | null;
    user_titled: number | null;
};

type LegacySummaryEnvelope = {
    legacySummary?: unknown;
    detailedSummary?: unknown;
};

/**
 * Local persistence for raw meeting history.
 *
 * This intentionally does not migrate or remove any legacy tables. Existing
 * sqlite-vec/RAG/profile/mode data remains on disk so upgrading does not destroy
 * user data, but this class no longer loads extensions or exposes those stores.
 */
export class DatabaseManager {
    private static instance: DatabaseManager | undefined;
    private db: Database.Database | null = null;
    private readonly dbPath: string;
    private initError: Error | null = null;

    private constructor() {
        this.dbPath = path.join(this.resolveUserDataPath(), 'natively.db');
        try {
            this.init();
        } catch (error) {
            this.initError = error instanceof Error ? error : new Error(String(error));
            console.error(
                '[DatabaseManager] Local meeting history is unavailable:',
                this.initError,
            );
        }
    }

    public static getInstance(): DatabaseManager {
        if (!DatabaseManager.instance) {
            DatabaseManager.instance = new DatabaseManager();
        }
        return DatabaseManager.instance;
    }

    private resolveUserDataPath(): string {
        const testPath = process.env.NATIVELY_TEST_USERDATA;
        if (testPath) return testPath;

        try {
            if (app && typeof app.getPath === 'function') return app.getPath('userData');
        } catch {
            // Electron is not initialized in some unit-test processes.
        }
        return path.join(os.tmpdir(), 'natively-no-electron-app');
    }

    private init(): void {
        fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
        this.db = new Database(this.dbPath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('busy_timeout = 5000');
        this.db.pragma('foreign_keys = ON');
        this.ensureMeetingSchema();
    }

    /**
     * Create only the tables/columns required by raw meeting history. We do not
     * change user_version: legacy installs retain their migration marker and a
     * fresh database remains readable by an older release if a user rolls back.
     */
    private ensureMeetingSchema(): void {
        if (!this.db) return;
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS meetings (
                id TEXT PRIMARY KEY,
                title TEXT,
                start_time INTEGER,
                duration_ms INTEGER,
                summary_json TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                calendar_event_id TEXT,
                source TEXT,
                is_processed INTEGER DEFAULT 1,
                summary_status TEXT DEFAULT 'completed',
                user_titled INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS transcripts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                meeting_id TEXT,
                speaker TEXT,
                content TEXT,
                timestamp_ms INTEGER,
                raw_json TEXT,
                FOREIGN KEY(meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_transcripts_meeting_id
                ON transcripts(meeting_id);
        `);

        this.ensureColumns('meetings', {
            title: 'TEXT',
            start_time: 'INTEGER',
            duration_ms: 'INTEGER',
            summary_json: 'TEXT',
            created_at: 'TEXT',
            calendar_event_id: 'TEXT',
            source: 'TEXT',
            is_processed: 'INTEGER DEFAULT 1',
            summary_status: "TEXT DEFAULT 'completed'",
            user_titled: 'INTEGER NOT NULL DEFAULT 0',
        });
        this.ensureColumns('transcripts', {
            meeting_id: 'TEXT',
            speaker: 'TEXT',
            content: 'TEXT',
            timestamp_ms: 'INTEGER',
            raw_json: 'TEXT',
        });
    }

    private ensureColumns(table: string, columns: Record<string, string>): void {
        if (!this.db) return;
        const existing = new Set(
            (this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>)
                .map(column => column.name),
        );
        for (const [name, declaration] of Object.entries(columns)) {
            if (!existing.has(name)) this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${declaration}`);
        }
    }

    public isAvailable(): boolean {
        return this.db !== null;
    }

    public getInitError(): Error | null {
        return this.initError;
    }

    /** Kept for the few backend readers that still need the shared connection. */
    public getDb(): Database.Database | null {
        return this.db;
    }

    public getDbPath(): string {
        return this.dbPath;
    }

    public checkpoint(): void {
        if (!this.db) return;
        try {
            this.db.pragma('wal_checkpoint(TRUNCATE)');
        } catch (error) {
            console.warn('[DatabaseManager] WAL checkpoint failed:', error);
        }
    }

    public close(): void {
        if (!this.db) return;
        this.checkpoint();
        this.closeHandle();
    }

    public closeWithoutCheckpoint(): void {
        this.closeHandle();
    }

    private closeHandle(): void {
        if (!this.db) return;
        try {
            this.db.close();
        } catch (error) {
            console.warn('[DatabaseManager] Database close failed:', error);
        } finally {
            this.db = null;
        }
    }

    public saveMeeting(meeting: Meeting, startTimeMs: number, durationMs: number): void {
        if (!this.db) return;

        const existing = this.db.prepare(
            'SELECT title, summary_json, COALESCE(user_titled, 0) AS user_titled FROM meetings WHERE id = ?',
        ).get(meeting.id) as { title: string | null; summary_json: string | null; user_titled: number } | undefined;
        const preserveUserTitle = existing?.user_titled === 1;
        const summaryJson = this.summaryJsonForSave(meeting, existing?.summary_json ?? null);

        const write = this.db.transaction(() => {
            this.db!.prepare(`
                INSERT INTO meetings (
                    id, title, start_time, duration_ms, summary_json, created_at,
                    calendar_event_id, source, is_processed, summary_status, user_titled
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    start_time = excluded.start_time,
                    duration_ms = excluded.duration_ms,
                    summary_json = excluded.summary_json,
                    created_at = excluded.created_at,
                    calendar_event_id = excluded.calendar_event_id,
                    source = excluded.source,
                    is_processed = excluded.is_processed,
                    summary_status = excluded.summary_status,
                    user_titled = excluded.user_titled
            `).run(
                meeting.id,
                preserveUserTitle && existing?.title ? existing.title : meeting.title,
                startTimeMs,
                durationMs,
                summaryJson,
                meeting.date,
                meeting.calendarEventId ?? null,
                meeting.source ?? 'manual',
                meeting.isProcessed === false ? 0 : 1,
                meeting.summaryStatus ?? 'completed',
                preserveUserTitle ? 1 : 0,
            );

            this.db!.prepare('DELETE FROM transcripts WHERE meeting_id = ?').run(meeting.id);
            const insertTranscript = this.db!.prepare(
                'INSERT INTO transcripts (meeting_id, speaker, content, timestamp_ms, raw_json) VALUES (?, ?, ?, ?, ?)',
            );
            for (const segment of meeting.transcript ?? []) {
                insertTranscript.run(
                    meeting.id,
                    segment.speaker,
                    segment.text,
                    segment.timestamp,
                    JSON.stringify(segment),
                );
            }
        });
        write();
    }

    private summaryJsonForSave(meeting: Meeting, existingJson: string | null): string {
        const hasIncomingSummary = meeting.summary !== undefined || meeting.detailedSummary !== undefined;
        if (!hasIncomingSummary && existingJson) return existingJson;
        return JSON.stringify({
            legacySummary: meeting.summary ?? '',
            detailedSummary: meeting.detailedSummary,
        });
    }

    public getRecentMeetings(limit = 50): Meeting[] {
        if (!this.db) return [];
        const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.trunc(limit)) : 50;
        const rows = this.db.prepare(
            'SELECT * FROM meetings ORDER BY created_at DESC LIMIT ?',
        ).all(safeLimit) as MeetingRow[];
        return rows.map(row => this.rowToMeeting(row, []));
    }

    public getMeetingDetails(id: string): Meeting | null {
        if (!this.db) return null;
        const row = this.db.prepare('SELECT * FROM meetings WHERE id = ?').get(id) as MeetingRow | undefined;
        if (!row) return null;
        const transcript = this.db.prepare(`
            SELECT speaker, content, timestamp_ms, raw_json
            FROM transcripts
            WHERE meeting_id = ?
            ORDER BY timestamp_ms ASC, id ASC
        `).all(id) as Array<{ speaker: string; content: string; timestamp_ms: number; raw_json: string | null }>;
        return this.rowToMeeting(row, transcript.map(segment => {
            let raw: Record<string, unknown> = {};
            if (segment.raw_json) {
                try {
                    raw = this.asRecord(JSON.parse(segment.raw_json)) ?? {};
                } catch {
                    // Legacy/corrupt optional JSON never hides canonical transcript text.
                }
            }
            return {
                ...raw,
                speaker: segment.speaker,
                text: segment.content,
                timestamp: segment.timestamp_ms,
            } as MeetingTranscriptSegment;
        }));
    }

    private rowToMeeting(row: MeetingRow, transcript: MeetingTranscriptSegment[]): Meeting {
        const summary = this.parseSummary(row.summary_json);
        const durationMs = Math.max(0, row.duration_ms ?? 0);
        const minutes = Math.floor(durationMs / 60_000);
        const seconds = Math.floor((durationMs % 60_000) / 1_000);
        return {
            id: row.id,
            title: row.title ?? '',
            date: row.created_at ?? new Date(row.start_time ?? 0).toISOString(),
            duration: `${minutes}:${String(seconds).padStart(2, '0')}`,
            summary: typeof summary.legacySummary === 'string' ? summary.legacySummary : '',
            detailedSummary: this.asRecord(summary.detailedSummary),
            calendarEventId: row.calendar_event_id ?? undefined,
            source: row.source === 'calendar' ? 'calendar' : 'manual',
            isProcessed: row.is_processed !== 0,
            summaryStatus: this.asSummaryStatus(row.summary_status),
            transcript,
            usage: [],
        };
    }

    private parseSummary(value: string | null): LegacySummaryEnvelope {
        if (!value) return {};
        try {
            const parsed: unknown = JSON.parse(value);
            return this.asRecord(parsed) ?? {};
        } catch {
            // A malformed legacy summary must not hide the meeting or transcript.
            return {};
        }
    }

    private asRecord(value: unknown): Record<string, unknown> | undefined {
        return value !== null && typeof value === 'object' && !Array.isArray(value)
            ? value as Record<string, unknown>
            : undefined;
    }

    private asSummaryStatus(value: string | null): MeetingSummaryStatus | undefined {
        const statuses: MeetingSummaryStatus[] = [
            'queued', 'chunking', 'summarizing_chunks', 'reducing',
            'validating', 'completed', 'failed',
        ];
        return statuses.includes(value as MeetingSummaryStatus)
            ? value as MeetingSummaryStatus
            : undefined;
    }

    public updateMeetingTitle(id: string, title: string): boolean {
        if (!this.db) return false;
        const result = this.db.prepare(
            'UPDATE meetings SET title = ?, user_titled = 1 WHERE id = ?',
        ).run(title, id);
        return result.changes > 0;
    }

    public updateSpeakerLabels(id: string, speakerLabels: Record<string, string>): boolean {
        if (!this.db) return false;
        const row = this.db.prepare('SELECT summary_json FROM meetings WHERE id = ?')
            .get(id) as { summary_json: string | null } | undefined;
        if (!row) return false;

        const envelope = this.parseSummary(row.summary_json);
        const detailedSummary = {
            ...(this.asRecord(envelope.detailedSummary) ?? {}),
            speakerLabels,
        };
        const result = this.db.prepare('UPDATE meetings SET summary_json = ? WHERE id = ?')
            .run(JSON.stringify({ ...envelope, detailedSummary }), id);
        return result.changes > 0;
    }

    public deleteMeeting(id: string): boolean {
        if (!this.db) return false;
        const result = this.db.transaction(() => {
            // Old databases may predate foreign-key enforcement or constraints.
            this.db!.prepare('DELETE FROM transcripts WHERE meeting_id = ?').run(id);
            return this.db!.prepare('DELETE FROM meetings WHERE id = ?').run(id);
        })();
        return result.changes > 0;
    }

    /** Clear meeting history only; unrelated legacy tables are deliberately retained. */
    public clearAllData(): boolean {
        if (!this.db) return false;
        try {
            this.db.transaction(() => {
                this.db!.prepare('DELETE FROM transcripts').run();
                this.db!.prepare('DELETE FROM meetings').run();
            })();
            return true;
        } catch (error) {
            console.error('[DatabaseManager] Failed to clear meeting history:', error);
            return false;
        }
    }
}
