import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modulePath = path.resolve(
  __dirname,
  '../../../dist-electron/electron/services/chatGptWebNavigation.js',
);

async function load() {
  return import(pathToFileURL(modulePath).href);
}

test('ChatGPT and supported identity providers stay in the isolated window', async () => {
  const { isAllowedChatGptNavigation } = await load();

  for (const url of [
    'https://chatgpt.com/',
    'https://auth.openai.com/log-in',
    'https://accounts.google.com/o/oauth2/auth',
    'https://login.microsoftonline.com/common/oauth2/authorize',
  ]) {
    assert.equal(isAllowedChatGptNavigation(url), true, url);
  }
});

test('lookalike, insecure, and script destinations are rejected', async () => {
  const { isAllowedChatGptNavigation } = await load();

  for (const url of [
    'https://chatgpt.com.evil.example/',
    'http://chatgpt.com/',
    'javascript:alert(1)',
    'file:///tmp/token',
    'not a url',
  ]) {
    assert.equal(isAllowedChatGptNavigation(url), false, url);
  }
});

test('external handoff only accepts https and mailto URLs', async () => {
  const { isSafeExternalUrl } = await load();

  assert.equal(isSafeExternalUrl('https://help.openai.com/'), true);
  assert.equal(isSafeExternalUrl('mailto:support@example.com'), true);
  assert.equal(isSafeExternalUrl('http://example.com/'), false);
  assert.equal(isSafeExternalUrl('file:///etc/passwd'), false);
});
