import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const electron = require('electron');

// Behavioral coverage for the runtime retained by the ChatGPT Web migration.
// Older source-shape suites for answer generation intentionally remain outside
// this list because their modules no longer exist.
const tests = [
  'electron/services/__tests__/CredentialPersistenceBehavior.test.mjs',
  'electron/services/__tests__/CredentialStorage.test.mjs',
  'electron/services/__tests__/credentialFallbackCrypto.test.mjs',
  'electron/services/__tests__/ChatGptWebNavigation.test.mjs',
  'electron/services/__tests__/LocalModelDownloadService.test.mjs',
  'electron/services/__tests__/KeybindRegistrationState.test.mjs',
  'electron/services/__tests__/MicPermissionPolicy2026_08_22.test.mjs',
  'electron/services/__tests__/FormatPermissionMessageCrossPlatform.test.mjs',
  'electron/services/__tests__/GoogleServiceAccountValidation2026_08_05.test.mjs',
  'electron/services/__tests__/ToggleStateReducer.test.mjs',
  'electron/services/__tests__/WhisperWorkerPathResolver.test.mjs',
  'electron/services/__tests__/ZerofillDetectorPeakToPeak.test.mjs',
  'electron/services/__tests__/RollingTranscriptState.test.mjs',
  'electron/services/__tests__/RedactForLog.test.mjs',
  'electron/audio/__tests__/CorruptModelPurge2026_08_06.test.mjs',
  'electron/audio/__tests__/ModelPreloaderTakeWarmWorker.test.mjs',
  'electron/audio/__tests__/openaiTranscriptTurnCoalescer.test.mjs',
  'electron/audio/__tests__/WhisperProgressAggregator.test.mjs',
  'electron/audio/__tests__/WhisperLoadSentinel.test.mjs',
  'electron/audio/__tests__/NemotronLanguageFailClosed2026_08_12.test.mjs',
  'electron/audio/__tests__/ReconnectStormCap.test.mjs',
  'electron/audio/__tests__/SonioxSetSampleRateDebounced.test.mjs',
  'electron/audio/__tests__/RelayFlagGate.test.mjs',
  'electron/audio/__tests__/RelayLatencyProbes.test.mjs',
  'electron/audio/__tests__/RelayAuthFrameSelection.test.mjs',
  'electron/audio/__tests__/RelaySessionResolve.test.mjs',
  'electron/audio/__tests__/RelayFallbackLadder.test.mjs',
  'electron/audio/__tests__/SystemAudioHealthClassifier.test.mjs',
  'electron/audio/__tests__/ScreenRecordingPermissionCache.test.mjs',
  'electron/audio/__tests__/GoogleSTTDropsKeepaliveSilence.test.mjs',
  'electron/audio/__tests__/GoogleSttPendingLanguageChangeCleared.test.mjs',
  'electron/audio/__tests__/DeepgramStabilityTimerTracked.test.mjs',
  'electron/audio/__tests__/BluetoothHfpAvoidance.test.mjs',
  'electron/audio/__tests__/CaptureStopAwaitable.test.mjs',
  'electron/audio/__tests__/DefaultOutputWatcherEpoch.test.mjs',
  'electron/utils/__tests__/validateImagePathWindows.test.mjs',
  'electron/utils/__tests__/validateImagePath.test.mjs',
  'electron/utils/__tests__/lifecycleTracker.test.mjs',
  'electron/utils/__tests__/OnnxSlotWeightedAcquisition.test.mjs',
  'electron/utils/__tests__/OnnxAvailableMemoryGate.test.mjs',
  'electron/db/__tests__/RawMeetingHistoryPersistence.test.mjs',
];

const result = spawnSync(electron, ['--test', ...tests], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    NATIVELY_TEST_USERDATA:
      process.env.NATIVELY_TEST_USERDATA
      || path.join(os.tmpdir(), 'natively-test-userdata'),
  },
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
