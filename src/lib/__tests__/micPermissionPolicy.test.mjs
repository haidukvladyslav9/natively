import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyMicStatus, micSettingsUri } from '../micPermissionPolicy.mjs';

test('macOS can request a new microphone grant and links denied users to settings', () => {
  assert.deepEqual(classifyMicStatus('darwin', 'not-determined'), {
    usable: false,
    remedy: 'request',
  });
  assert.deepEqual(classifyMicStatus('darwin', 'denied'), {
    usable: false,
    remedy: 'settings',
  });
  assert.match(micSettingsUri('darwin'), /^x-apple\.systempreferences:/);
});

test('Windows sends every actionable denial to microphone privacy settings', () => {
  for (const status of ['not-determined', 'denied', 'restricted']) {
    assert.deepEqual(classifyMicStatus('win32', status), {
      usable: false,
      remedy: 'settings',
    });
  }
  assert.equal(micSettingsUri('win32'), 'ms-settings:privacy-microphone');
});

test('granted microphone access is usable on both supported platforms', () => {
  assert.deepEqual(classifyMicStatus('darwin', 'granted'), {
    usable: true,
    remedy: 'none',
  });
  assert.deepEqual(classifyMicStatus('win32', 'granted'), {
    usable: true,
    remedy: 'none',
  });
});
