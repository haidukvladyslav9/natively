import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import Database from 'better-sqlite3';

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'natively-raw-meetings-'));
const dbPath = path.join(userData, 'natively.db');

// Simulate an existing user's database, including opaque legacy summary data
// and an unrelated table that the slim manager must neither migrate nor drop.
const seed = new Database(dbPath);
seed.exec(`
  CREATE TABLE meetings (
    id TEXT PRIMARY KEY,
    title TEXT,
    start_time INTEGER,
    duration_ms INTEGER,
    summary_json TEXT,
    created_at TEXT,
    calendar_event_id TEXT,
    source TEXT,
    is_processed INTEGER DEFAULT 1
  );
  CREATE TABLE transcripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id TEXT,
    speaker TEXT,
    content TEXT,
    timestamp_ms INTEGER
  );
  CREATE TABLE legacy_profile_data (value TEXT);
  INSERT INTO legacy_profile_data VALUES ('keep-me');
`);
seed.prepare(`
  INSERT INTO meetings (
    id, title, start_time, duration_ms, summary_json, created_at,
    calendar_event_id, source, is_processed
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  'legacy-meeting',
  'Existing meeting',
  1_700_000_000_000,
  65_000,
  JSON.stringify({
    legacySummary: 'Existing summary',
    detailedSummary: { customLegacyField: { nested: true } },
    unknownEnvelopeField: 'preserved',
  }),
  '2023-11-14T22:13:20.000Z',
  null,
  'manual',
  1,
);
seed.prepare(
  'INSERT INTO transcripts (meeting_id, speaker, content, timestamp_ms) VALUES (?, ?, ?, ?)',
).run('legacy-meeting', 'speaker_1', 'Original transcript', 1234);
seed.pragma('user_version = 17');
seed.close();

process.env.NATIVELY_TEST_USERDATA = userData;
const compiledManager = process.env.NATIVELY_DB_MANAGER_BUILD
  ?? path.resolve('dist-electron/electron/db/DatabaseManager.js');
const { DatabaseManager } = await import(pathToFileURL(compiledManager).href);
const manager = DatabaseManager.getInstance();

after(() => {
  manager.close();
  fs.rmSync(userData, { recursive: true, force: true });
});

test('opens legacy database without changing its version or unrelated data', () => {
  assert.equal(manager.isAvailable(), true);
  const db = manager.getDb();
  assert.equal(db.pragma('user_version', { simple: true }), 17);
  assert.equal(
    db.prepare('SELECT value FROM legacy_profile_data').get().value,
    'keep-me',
  );
});

test('reads existing summaries and transcript rows without reshaping JSON', () => {
  const details = manager.getMeetingDetails('legacy-meeting');
  assert.equal(details.summary, 'Existing summary');
  assert.deepEqual(details.detailedSummary.customLegacyField, { nested: true });
  assert.deepEqual(details.transcript, [{
    speaker: 'speaker_1',
    text: 'Original transcript',
    timestamp: 1234,
  }]);

  const raw = manager.getDb()
    .prepare('SELECT summary_json FROM meetings WHERE id = ?')
    .get('legacy-meeting').summary_json;
  assert.equal(JSON.parse(raw).unknownEnvelopeField, 'preserved');
});

test('raw saves are idempotent and preserve user-updated titles', () => {
  manager.updateMeetingTitle('legacy-meeting', 'My title');
  manager.saveMeeting({
    id: 'legacy-meeting',
    title: 'Generated title',
    date: '2023-11-14T22:13:20.000Z',
    duration: '1:05',
    transcript: [
      {
        speaker: 'speaker_1',
        text: 'Replacement one',
        timestamp: 2000,
        final: true,
        confidence: 0.91,
        origin: 'stt',
      },
      { speaker: 'speaker_2', text: 'Replacement two', timestamp: 3000 },
    ],
  }, 1_700_000_000_000, 65_000);

  const details = manager.getMeetingDetails('legacy-meeting');
  assert.equal(details.title, 'My title');
  assert.equal(details.summary, 'Existing summary');
  assert.equal(details.transcript.length, 2);
  assert.equal(details.transcript[0].final, true);
  assert.equal(details.transcript[0].confidence, 0.91);
  assert.equal(details.transcript[0].origin, 'stt');
  assert.equal(
    manager.getDb()
      .prepare('SELECT COUNT(*) AS count FROM transcripts WHERE meeting_id = ?')
      .get('legacy-meeting').count,
    2,
  );
});

test('speaker labels merge into legacy summary JSON', () => {
  assert.equal(
    manager.updateSpeakerLabels('legacy-meeting', { speaker_1: 'Alex' }),
    true,
  );
  const raw = manager.getDb()
    .prepare('SELECT summary_json FROM meetings WHERE id = ?')
    .get('legacy-meeting').summary_json;
  const parsed = JSON.parse(raw);
  assert.equal(parsed.unknownEnvelopeField, 'preserved');
  assert.deepEqual(parsed.detailedSummary.customLegacyField, { nested: true });
  assert.deepEqual(parsed.detailedSummary.speakerLabels, { speaker_1: 'Alex' });
});
