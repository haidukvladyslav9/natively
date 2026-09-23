import { app, BrowserWindow, desktopCapturer, dialog, ipcMain, shell, systemPreferences } from 'electron';
import path from 'node:path';
import { micSettingsUri } from '../src/lib/micPermissionPolicy.mjs';
import { AudioDevices } from './audio/AudioDevices';
import { RECOGNITION_LANGUAGES } from './config/languages';
import { DatabaseManager } from './db/DatabaseManager';
import type { AppState } from './main';
import { CredentialsManager, resolveSttTestKey } from './services/CredentialsManager';
import { SettingsManager } from './services/SettingsManager';

type SttProvider =
  | 'none'
  | 'google'
  | 'groq'
  | 'openai'
  | 'deepgram'
  | 'elevenlabs'
  | 'azure'
  | 'ibmwatson'
  | 'soniox'
  | 'nvidia_nim'
  | 'natively'
  | 'local-whisper';

const sendAll = (channel: string, payload?: unknown): void => {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
};

export function initializeIpcHandlers(appState: AppState): void {
  const handle = (channel: string, listener: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any): void => {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, listener);
  };

  handle('get-recognition-languages', () => RECOGNITION_LANGUAGES);
  handle('get-stt-language', () => CredentialsManager.getInstance().getSttLanguage());

  handle('update-content-dimensions', (event, dimensions: { width?: number; height?: number }) => {
    const width = Number(dimensions?.width);
    const height = Number(dimensions?.height);
    if (!width || !height) return;
    const helper = appState.getWindowHelper();
    const settings = appState.settingsWindowHelper.getSettingsWindow();
    const overlay = helper.getOverlayWindow();
    const pill = helper.getPillWindow();
    if (pill && !pill.isDestroyed() && pill.webContents.id === event.sender.id) {
      helper.setPillWindowSize(width, height);
    } else if (settings && !settings.isDestroyed() && settings.webContents.id === event.sender.id) {
      appState.settingsWindowHelper.setWindowDimensions(settings, width, height);
    } else if (overlay && !overlay.isDestroyed() && overlay.webContents.id === event.sender.id) {
      helper.setOverlayDimensions(width, height);
    }
  });
  handle('update-content-dimensions-centered', (event, dimensions: { width?: number; height?: number }) => {
    const overlay = appState.getWindowHelper().getOverlayWindow();
    if (overlay && !overlay.isDestroyed() && overlay.webContents.id === event.sender.id) {
      appState.getWindowHelper().setOverlayDimensionsAnchored(Number(dimensions?.width), Number(dimensions?.height));
    }
  });
  handle('overlay-ui-state', (event, state: Record<string, unknown>) => {
    const overlay = appState.getWindowHelper().getOverlayWindow();
    if (overlay?.webContents.id === event.sender.id) appState.getWindowHelper().setOverlayUiState(state ?? {});
  });
  handle('overlay-toggle-anchor', (event, payload: { panelRight?: number }) => {
    const overlay = appState.getWindowHelper().getOverlayWindow();
    if (overlay?.webContents.id === event.sender.id && typeof payload?.panelRight === 'number') {
      appState.getWindowHelper().setOverlayToggleAnchor(payload.panelRight);
    }
  });
  handle('overlay-hover-interactive', (event, interactive: boolean) => {
    const overlay = appState.getWindowHelper().getOverlayWindow();
    if (overlay?.webContents.id === event.sender.id) appState.getWindowHelper().setOverlayHoverInteractive(!!interactive);
  });
  handle('overlay-popovers:dismiss', (_event, opts?: { settings?: boolean; model?: boolean }) => {
    appState.getWindowHelper().dismissOverlayPopovers(opts);
  });
  handle('overlay-ui-action', (_event, action: { type?: string }) => {
    if (action?.type) appState.getWindowHelper().forwardOverlayUiAction(action);
  });
  handle('overlay-group-drag-managed', () => appState.getWindowHelper().isOverlayGroupDragManaged());
  handle('overlay-group-drag', (_event, delta: { dx?: number; dy?: number; phase?: 'start' | 'move' | 'end' }) => {
    const helper = appState.getWindowHelper();
    if (delta?.phase === 'start') helper.beginOverlayGroupDrag();
    else if (delta?.phase === 'end') helper.endOverlayGroupDrag();
    else helper.moveOverlayGroupTo(Number(delta?.dx) || 0, Number(delta?.dy) || 0);
  });

  handle('set-window-mode', (_event, mode: 'launcher' | 'overlay', inactive?: boolean) => {
    appState.getWindowHelper().setWindowMode(mode, inactive);
    return { success: true };
  });
  handle('toggle-window', () => appState.toggleMainWindow());
  handle('show-window', (_event, inactive?: boolean) => appState.showMainWindow(inactive));
  handle('hide-window', () => appState.hideMainWindow());
  handle('show-overlay', () => appState.getWindowHelper().showOverlay());
  handle('hide-overlay', () => appState.getWindowHelper().hideOverlay());
  handle('get-meeting-active', () => appState.getIsMeetingActive());
  handle('move-window-left', () => appState.moveWindowLeft());
  handle('move-window-right', () => appState.moveWindowRight());
  handle('move-window-up', () => appState.moveWindowUp());
  handle('move-window-down', () => appState.moveWindowDown());
  handle('window-minimize', () => appState.getWindowHelper().minimizeWindow());
  handle('window-maximize', () => appState.getWindowHelper().maximizeWindow());
  handle('window-close', () => appState.getWindowHelper().closeWindow());
  handle('window-is-maximized', () => appState.getWindowHelper().isMainWindowMaximized());

  handle('settings:open-tab', (_event, tab: string) => {
    const launcher = appState.getWindowHelper().getLauncherWindow();
    if (!launcher || launcher.isDestroyed()) return;
    launcher.webContents.send('settings:open-tab', tab);
    appState.getUndetectable() ? launcher.showInactive() : launcher.show();
    if (!appState.getUndetectable()) launcher.focus();
  });
  handle('toggle-settings-window', (_event, coords?: { x?: number; y?: number }) =>
    appState.settingsWindowHelper.toggleWindow(coords?.x, coords?.y));
  handle('close-settings-window', () => appState.settingsWindowHelper.closeWindow());

  handle('chatgpt-web:open', async () => {
    await appState.chatGptWebWindowHelper.showWindow();
    return { success: true };
  });
  handle('chatgpt-web:send', async (_event, payload: {
    prompt?: string;
    imagePaths?: string[];
    includeCurrentTranscript?: boolean;
    savedMeetingId?: string;
  }) => {
    const allowed = new Set([...appState.getScreenshotQueue(), ...appState.getExtraScreenshotQueue()].map(p => path.resolve(p)));
    const imagePaths = (Array.isArray(payload?.imagePaths) ? payload.imagePaths : []).map(p => path.resolve(p));
    if (imagePaths.some(p => !allowed.has(p))) {
      return { success: false, error: 'Only screenshots captured by Natively can be sent.' };
    }
    const blocks: string[] = [];
    if (payload?.includeCurrentTranscript) {
      blocks.push(formatTranscript('Current meeting raw transcript', appState.getMeetingSessionManager().getContext()));
    }
    if (payload?.savedMeetingId?.trim()) {
      const meeting = DatabaseManager.getInstance().getMeetingDetails(payload.savedMeetingId.trim());
      if (!meeting) return { success: false, error: 'The selected saved meeting was not found.' };
      blocks.push([
        'Selected saved meeting:',
        `Title: ${meeting.title}`,
        `Date: ${meeting.date}`,
        `Duration: ${meeting.duration}`,
        formatTranscript('Raw transcript', meeting.transcript ?? []),
      ].join('\n'));
    }
    if (typeof payload?.prompt === 'string' && payload.prompt) blocks.push(payload.prompt);
    return appState.chatGptWebWindowHelper.send({ prompt: blocks.join('\n\n'), imagePaths });
  });

  handle('take-screenshot', async () => {
    const screenshotPath = await appState.takeScreenshot();
    return { path: screenshotPath, preview: await appState.getImagePreview(screenshotPath) };
  });
  handle('take-selective-screenshot', async () => {
    try {
      const screenshotPath = await appState.takeSelectiveScreenshot();
      return { path: screenshotPath, preview: await appState.getImagePreview(screenshotPath) };
    } catch (error) {
      if ((error as Error).message === 'Selection cancelled') return { cancelled: true };
      throw error;
    }
  });
  handle('get-screenshots', async () => Promise.all(
    (appState.getView() === 'queue' ? appState.getScreenshotQueue() : appState.getExtraScreenshotQueue())
      .map(async filePath => ({ path: filePath, preview: await appState.getImagePreview(filePath) })),
  ));
  handle('delete-screenshot', (_event, filePath: string) => {
    const resolved = path.resolve(filePath);
    const root = app.getPath('userData');
    if (!resolved.startsWith(root + path.sep)) return { success: false, error: 'Path not allowed' };
    return appState.deleteScreenshot(resolved);
  });
  handle('reset-queues', () => {
    appState.clearQueues();
    return { success: true };
  });

  handle('start-meeting', async (_event, metadata?: any) => {
    try {
      await appState.startMeeting(metadata);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error?.message, code: error?.code };
    }
  });
  handle('end-meeting', async () => {
    try {
      await appState.endMeeting();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error?.message };
    }
  });
  handle('finalize-mic-stt', () => appState.finalizeMicSTT());
  handle('get-recent-meetings', () => DatabaseManager.getInstance().getRecentMeetings(50));
  handle('get-meeting-details', (_event, id: string) => DatabaseManager.getInstance().getMeetingDetails(id));
  handle('delete-meeting', (_event, id: string) => DatabaseManager.getInstance().deleteMeeting(id));
  handle('update-meeting-title', (_event, payload: { id: string; title: string }) =>
    DatabaseManager.getInstance().updateMeetingTitle(payload.id, payload.title));
  handle('update-meeting-speaker-labels', (_event, payload: { id: string; labels: Record<string, string> }) =>
    DatabaseManager.getInstance().updateSpeakerLabels(payload.id, payload.labels));
  handle('clear-all-data', () => DatabaseManager.getInstance().clearAllData());

  handle('native-audio-status', () => ({ connected: true }));
  handle('get-input-devices', () => AudioDevices.getInputDevices());
  handle('get-output-devices', () => AudioDevices.getOutputDevices());
  handle('start-audio-test', async (_event, deviceId?: string) => {
    await appState.startAudioTest(deviceId);
    return { success: true };
  });
  handle('stop-audio-test', () => {
    appState.stopAudioTest();
    return { success: true };
  });
  handle('set-recognition-language', (_event, key: string) => {
    appState.setRecognitionLanguage(key);
    return { success: true };
  });

  const credentialsChanged = (): void => sendAll('credentials-changed');
  const saveSttKey = async (setter: (key: string) => boolean | void, key: string, reconfigure = true) => {
    const persisted = setter(key);
    if (reconfigure) await appState.reconfigureSttProvider();
    credentialsChanged();
    if (persisted === false && key.trim()) {
      CredentialsManager.getInstance().emitStorageStatusDiagnostic('stt_save_failed');
      return { success: false, error: 'Could not save API key.' };
    }
    return { success: true };
  };
  handle('set-stt-provider', async (_event, provider: SttProvider) => {
    const persisted = CredentialsManager.getInstance().setSttProvider(provider);
    if (!persisted) return { success: false, error: 'Could not save STT provider.' };
    await appState.reconfigureSttProvider();
    credentialsChanged();
    return { success: true };
  });
  handle('get-stt-provider', () => CredentialsManager.getInstance().getSttProvider());
  handle('set-groq-stt-api-key', (_e, key: string) => saveSttKey(k => CredentialsManager.getInstance().setGroqSttApiKey(k), key));
  handle('set-openai-stt-api-key', (_e, key: string) => saveSttKey(k => CredentialsManager.getInstance().setOpenAiSttApiKey(k), key));
  handle('set-deepgram-api-key', (_e, key: string) => saveSttKey(k => CredentialsManager.getInstance().setDeepgramApiKey(k), key));
  handle('set-elevenlabs-api-key', (_e, key: string) => saveSttKey(k => CredentialsManager.getInstance().setElevenLabsApiKey(k), key));
  handle('set-azure-api-key', (_e, key: string) => saveSttKey(k => CredentialsManager.getInstance().setAzureApiKey(k), key));
  handle('set-ibmwatson-api-key', (_e, key: string) => saveSttKey(k => CredentialsManager.getInstance().setIbmWatsonApiKey(k), key));
  handle('set-soniox-api-key', (_e, key: string) => saveSttKey(k => CredentialsManager.getInstance().setSonioxApiKey(k), key));
  handle('set-nvidia-nim-api-key', (_e, key: string) => saveSttKey(k => CredentialsManager.getInstance().setNvidiaNimApiKey(k), key));
  handle('set-openai-stt-base-url', async (_e, url: string) => {
    const { validateSttBaseUrl } = await import('./utils/curlUtils');
    const verdict = validateSttBaseUrl(url);
    if (!verdict.isValid) return { success: false, error: `Invalid STT base URL: ${verdict.reason}` };
    CredentialsManager.getInstance().setOpenAiSttBaseUrl(url);
    await appState.reconfigureSttProvider();
    credentialsChanged();
    return { success: true };
  });
  handle('set-azure-region', async (_e, region: string) => {
    const { isValidSttRegion } = await import('./utils/curlUtils');
    if (!isValidSttRegion(region)) return { success: false, error: 'Invalid Azure region' };
    CredentialsManager.getInstance().setAzureRegion(region);
    await appState.reconfigureSttProvider();
    return { success: true };
  });
  handle('set-ibmwatson-region', async (_e, region: string) => {
    const { isValidSttRegion } = await import('./utils/curlUtils');
    if (!isValidSttRegion(region)) return { success: false, error: 'Invalid IBM Watson region' };
    CredentialsManager.getInstance().setIbmWatsonRegion(region);
    await appState.reconfigureSttProvider();
    return { success: true };
  });
  handle('set-groq-stt-model', async (_e, model: string) => {
    CredentialsManager.getInstance().setGroqSttModel(model);
    await appState.reconfigureSttProvider();
    return { success: true };
  });
  handle('set-nvidia-nim-stt-model', async (_e, model: string) => {
    const { isNvidiaNimSttModel } = await import('./audio/nvidiaNimSttModels');
    if (!isNvidiaNimSttModel(model)) return { success: false, error: 'Unsupported NVIDIA NIM speech model' };
    const success = CredentialsManager.getInstance().setNvidiaNimSttModel(model);
    if (success) await appState.reconfigureSttProvider();
    return { success };
  });
  handle('test-stt-connection', async (_e, provider: Exclude<SttProvider, 'none' | 'google' | 'natively' | 'local-whisper'>, apiKey: string, region?: string) =>
    testSttConnection(provider, apiKey, region));
  handle('get-stored-credentials', () => maskedSttCredentials());

  handle('select-service-account', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (result.canceled || !result.filePaths[0]) return { success: false, cancelled: true };
    const filePath = result.filePaths[0];
    const verdict = appState.updateGoogleCredentials(filePath);
    if (!verdict.usable) return { success: false, error: verdict.reason };
    const success = CredentialsManager.getInstance().setGoogleServiceAccountPath(filePath);
    credentialsChanged();
    return { success, path: filePath };
  });

  registerLocalWhisperHandlers(handle, appState);

  handle('theme:get-mode', () => ({
    mode: appState.getThemeManager().getMode(),
    resolved: appState.getThemeManager().getResolvedTheme(),
  }));
  handle('theme:set-mode', (_e, mode: 'system' | 'light' | 'dark') => {
    appState.getThemeManager().setMode(mode);
    return { success: true };
  });
  ipcMain.removeAllListeners('interface-theme:set');
  ipcMain.on('interface-theme:set', (_event, theme: string) => {
    if (!['default', 'liquid-glass', 'modern'].includes(theme)) return;
    sendAll('interface-theme:changed', theme);
  });
  handle('set-overlay-opacity', (_e, opacity: number) => {
    sendAll('overlay-opacity-changed', Math.min(1, Math.max(0.35, opacity)));
  });
  handle('set-launcher-opacity-preview', (_e, active: boolean) =>
    appState.getWindowHelper().setLauncherOpacityPreview(!!active));

  handle('set-undetectable', (_e, value: boolean) => {
    appState.setUndetectable(value);
    return { success: true, state: appState.getUndetectable() };
  });
  handle('get-undetectable', () => appState.getUndetectable());
  handle('set-overlay-mouse-passthrough', (_e, value: boolean) => {
    appState.setOverlayMousePassthrough(value);
    return { success: true, enabled: appState.getOverlayMousePassthrough() };
  });
  handle('toggle-overlay-mouse-passthrough', () => ({
    success: true,
    enabled: appState.toggleOverlayMousePassthrough(),
  }));
  handle('get-overlay-mouse-passthrough', () => appState.getOverlayMousePassthrough());
  handle('set-disguise', (_e, mode: 'terminal' | 'settings' | 'activity' | 'none') => {
    appState.setDisguise(mode);
    return { success: true };
  });
  handle('get-disguise', () => appState.getDisguise());
  handle('get-verbose-logging', () => appState.getVerboseLogging());
  handle('set-verbose-logging', (_e, value: boolean) => {
    appState.setVerboseLogging(value);
    return { success: true };
  });
  handle('set-open-at-login', (_e, value: boolean) => {
    app.setLoginItemSettings({ openAtLogin: value, openAsHidden: false, path: app.getPath('exe') });
    return { success: true };
  });
  handle('get-open-at-login', () => app.getLoginItemSettings().openAtLogin);
  handle('get-meeting-retention', () => SettingsManager.getInstance().get('meetingRetention') ?? 'forever');
  handle('set-meeting-retention', (_e, retention: 'forever' | '7d' | '30d' | 'never') => {
    if (!['forever', '7d', '30d', 'never'].includes(retention)) return { success: false, error: 'invalid_retention' };
    const success = SettingsManager.getInstance().set('meetingRetention', retention);
    if (success) sendAll('meeting-retention-changed', retention);
    return { success };
  });

  handle('permissions:check', async () => {
    if (process.platform !== 'darwin') {
      return { microphone: 'granted', screen: 'granted', platform: process.platform };
    }
    let screen = systemPreferences.getMediaAccessStatus('screen');
    if (screen !== 'granted' && screen !== 'restricted') {
      try {
        const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1, height: 1 } });
        if (sources.length) screen = 'granted';
      } catch {}
    }
    return {
      microphone: systemPreferences.getMediaAccessStatus('microphone'),
      screen,
      platform: process.platform,
    };
  });
  handle('permissions:request-mic', () =>
    process.platform === 'darwin' ? systemPreferences.askForMediaAccess('microphone') : true);
  handle('permissions:open-mic-settings', () => {
    const uri = micSettingsUri(process.platform);
    return uri ? shell.openExternal(uri) : false;
  });

  handle('calendar-connect', async () => {
    try {
      const { CalendarManager } = await import('./services/CalendarManager');
      await CalendarManager.getInstance().startAuthFlow();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error?.message };
    }
  });
  handle('calendar-disconnect', async () => {
    const { CalendarManager } = await import('./services/CalendarManager');
    await CalendarManager.getInstance().disconnect();
    return { success: true };
  });
  handle('get-calendar-status', async () => {
    const { CalendarManager } = await import('./services/CalendarManager');
    return CalendarManager.getInstance().getConnectionStatus();
  });
  handle('get-upcoming-events', async () => {
    const { CalendarManager } = await import('./services/CalendarManager');
    return CalendarManager.getInstance().getUpcomingEvents();
  });
  handle('calendar-refresh', async () => {
    const { CalendarManager } = await import('./services/CalendarManager');
    await CalendarManager.getInstance().refreshState();
    return { success: true };
  });

  handle('open-external', (_e, url: string) => {
    if (!/^https?:\/\//i.test(url)) return { success: false, error: 'URL not allowed' };
    void shell.openExternal(url);
    return { success: true };
  });
  handle('open-log-file', () => shell.openPath(appState.getLogFilePath()));
  handle('get-log-file-path', () => appState.getLogFilePath());
  handle('get-arch', () => process.arch);
  handle('quit-app', () => app.quit());
  handle('restart-app', () => {
    app.relaunch();
    app.exit(0);
  });
  handle('check-for-updates', async () => {
    await appState.checkForUpdates();
    return { success: true };
  });
  handle('download-update', async () => {
    await appState.downloadUpdate();
    return { success: true };
  });
  handle('get-can-auto-update', () => ({ canAutoUpdate: appState.canAutoUpdate() }));
  handle('quit-and-install-update', async () => {
    await appState.quitAndInstallUpdate();
    return { success: true };
  });
}

function formatTranscript(title: string, transcript: Array<{ speaker: string; text: string; timestamp: number }>): string {
  return [
    `${title}:`,
    ...transcript.map(segment => `[${new Date(segment.timestamp).toISOString()}] ${segment.speaker}: ${segment.text}`),
  ].join('\n');
}

function maskedSttCredentials(): Record<string, unknown> {
  const creds = CredentialsManager.getInstance().getAllCredentials();
  const has = (value?: string) => !!value?.trim();
  const mask = (value?: string) => value ? `sk-...${value.slice(-4)}` : '';
  return {
    googleServiceAccountPath: creds.googleServiceAccountPath || null,
    sttProvider: creds.sttProvider || 'none',
    nvidiaNimSttModel: creds.nvidiaNimSttModel || 'nemotron-asr-streaming',
    groqSttModel: creds.groqSttModel || 'whisper-large-v3-turbo',
    hasSttGroqKey: has(creds.groqSttApiKey),
    hasSttOpenaiKey: has(creds.openAiSttApiKey),
    hasDeepgramKey: has(creds.deepgramApiKey),
    hasElevenLabsKey: has(creds.elevenLabsApiKey),
    hasAzureKey: has(creds.azureApiKey),
    hasIbmWatsonKey: has(creds.ibmWatsonApiKey),
    hasSonioxKey: has(creds.sonioxApiKey),
    hasNvidiaNimKey: has(creds.nvidiaNimApiKey),
    azureRegion: creds.azureRegion || 'eastus',
    ibmWatsonRegion: creds.ibmWatsonRegion || 'us-south',
    openAiSttBaseUrl: creds.openAiSttBaseUrl || '',
    sttGroqKey: mask(creds.groqSttApiKey),
    sttOpenaiKey: mask(creds.openAiSttApiKey),
    sttDeepgramKey: mask(creds.deepgramApiKey),
    sttElevenLabsKey: mask(creds.elevenLabsApiKey),
    sttAzureKey: mask(creds.azureApiKey),
    sttIbmKey: mask(creds.ibmWatsonApiKey),
    sttSonioxKey: mask(creds.sonioxApiKey),
  };
}

async function testSttConnection(provider: string, suppliedKey: string, region?: string) {
  const resolved = resolveSttTestKey(provider as any, suppliedKey);
  if (!resolved.ok) return { success: false, error: resolved.error };
  const key = resolved.apiKey;
  if (provider === 'nvidia_nim') {
    const { probeNvidiaNimStt } = await import('./audio/nvidiaNimSttProbe');
    return probeNvidiaNimStt(key, CredentialsManager.getInstance().getNvidiaNimSttModel());
  }
  if (provider === 'deepgram' || provider === 'soniox') {
    const WebSocket = (await import('ws')).default;
    const url = provider === 'deepgram'
      ? 'wss://api.deepgram.com/v1/listen?model=nova-2&encoding=linear16&sample_rate=16000&channels=1'
      : 'wss://stt-rt.soniox.com/transcribe-websocket';
    return new Promise(resolve => {
      const ws = new WebSocket(url, provider === 'deepgram' ? { headers: { Authorization: `Token ${key}` } } : undefined);
      const timeout = setTimeout(() => { ws.close(); resolve({ success: provider === 'soniox' }); }, 3000);
      ws.on('open', () => {
        if (provider === 'deepgram') {
          clearTimeout(timeout); ws.close(); resolve({ success: true });
        } else {
          ws.send(JSON.stringify({ api_key: key, model: 'stt-rt-v5', audio_format: 'pcm_s16le', sample_rate: 16000, num_channels: 1 }));
        }
      });
      ws.on('error', (error: Error) => { clearTimeout(timeout); resolve({ success: false, error: error.message }); });
      ws.on('message', (message: Buffer) => {
        try {
          const response = JSON.parse(message.toString());
          if (response.error_code) { clearTimeout(timeout); ws.close(); resolve({ success: false, error: response.error_message }); }
        } catch {}
      });
    });
  }
  const axios = (await import('axios')).default;
  try {
    if (provider === 'elevenlabs') {
      await axios.get('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key }, timeout: 10_000 });
    } else {
      const endpoint = provider === 'groq'
        ? 'https://api.groq.com/openai/v1/audio/transcriptions'
        : provider === 'azure'
          ? `https://${region || 'eastus'}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`
          : provider === 'ibmwatson'
            ? `https://api.${region || 'us-south'}.speech-to-text.watson.cloud.ibm.com/v1/recognize`
            : `${(CredentialsManager.getInstance().getOpenAiSttBaseUrl() || 'https://api.openai.com/v1').replace(/\/$/, '')}/audio/transcriptions`;
      await axios.post(endpoint, Buffer.alloc(44), {
        headers: provider === 'azure'
          ? { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'audio/wav' }
          : provider === 'ibmwatson'
            ? { Authorization: `Basic ${Buffer.from(`apikey:${key}`).toString('base64')}`, 'Content-Type': 'audio/wav' }
            : { Authorization: `Bearer ${key}`, 'Content-Type': 'audio/wav' },
        timeout: 10_000,
      });
    }
    return { success: true };
  } catch (error: any) {
    const status = error?.response?.status;
    return status && status !== 401 && status !== 403
      ? { success: true }
      : { success: false, error: error?.response?.data?.error?.message || error?.message || 'Connection failed' };
  }
}

function registerLocalWhisperHandlers(
  handle: (channel: string, listener: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any) => void,
  appState: AppState,
): void {
  handle('local-whisper-get-models', async () => {
    const { getAvailableModels } = await import('./audio/whisper/modelManager');
    const { getLocalModelLanguageSupport } = await import('./audio/whisper/modelLanguageSupport');
    return {
      models: getAvailableModels().map(model => ({ ...model, languageSupport: getLocalModelLanguageSupport(model.id) })),
      activeModelId: SettingsManager.getInstance().get('localWhisperModel') ?? '',
    };
  });
  handle('local-whisper-get-recovery-notice', () => appState.takeLocalWhisperRecoveryNotice());
  handle('local-whisper-get-channel-config', () => {
    const settings = SettingsManager.getInstance();
    return {
      enabled: !!settings.get('localWhisperPerChannelEnabled'),
      micModelId: settings.get('localWhisperModelMic') ?? '',
      systemModelId: settings.get('localWhisperModelSystem') ?? '',
      globalModelId: settings.get('localWhisperModel') ?? '',
    };
  });
  handle('local-whisper-set-model', async (_e, modelId: string) => {
    const { MODEL_CATALOG_IDS } = await import('./audio/whisper/modelManager');
    if (!MODEL_CATALOG_IDS.has(modelId)) return { success: false, error: 'Unknown model' };
    return { success: SettingsManager.getInstance().set('localWhisperModel', modelId) };
  });
  handle('local-whisper-set-channel-config', async (_e, config: { enabled?: boolean; micModelId?: string; systemModelId?: string }) => {
    const { MODEL_CATALOG_IDS } = await import('./audio/whisper/modelManager');
    for (const id of [config?.micModelId, config?.systemModelId]) {
      if (id && !MODEL_CATALOG_IDS.has(id)) return { success: false, error: `Unknown model: ${id}` };
    }
    const settings = SettingsManager.getInstance();
    if (typeof config?.enabled === 'boolean') settings.set('localWhisperPerChannelEnabled', config.enabled);
    if (typeof config?.micModelId === 'string') settings.set('localWhisperModelMic', config.micModelId);
    if (typeof config?.systemModelId === 'string') settings.set('localWhisperModelSystem', config.systemModelId);
    return { success: true };
  });
  handle('local-whisper-reset-to-default', () => {
    const modelId = 'Xenova/whisper-tiny.en';
    return { success: SettingsManager.getInstance().set('localWhisperModel', modelId), modelId };
  });
  handle('local-whisper-delete-model', async (_e, modelId: string) => {
    const { deleteModel, MODEL_CATALOG_IDS } = await import('./audio/whisper/modelManager');
    if (!MODEL_CATALOG_IDS.has(modelId)) return { success: false, error: 'Unknown model' };
    deleteModel(modelId as any);
    return { success: true };
  });
  handle('local-whisper-start-download', async (_e, modelId: string) => {
    const { LocalModelDownloadService, resolveLocalModelProviderName } = await import('./services/LocalModelDownloadService');
    return LocalModelDownloadService.getInstance().start(resolveLocalModelProviderName(modelId), modelId);
  });
  handle('local-whisper-cancel-download', async (_e, modelId: string) => {
    const { LocalModelDownloadService, resolveLocalModelProviderName } = await import('./services/LocalModelDownloadService');
    return LocalModelDownloadService.getInstance().cancel(resolveLocalModelProviderName(modelId), modelId);
  });
  handle('local-whisper-get-download-state', async (_e, modelId?: string) => {
    const { LocalModelDownloadService, resolveLocalModelProviderName } = await import('./services/LocalModelDownloadService');
    return LocalModelDownloadService.getInstance().getState(modelId ? resolveLocalModelProviderName(modelId) : undefined, modelId);
  });
  handle('local-whisper-preload', async (_e, modelId?: string) => {
    const { modelPreloader } = await import('./audio/whisper/modelPreloader');
    const id = modelId || SettingsManager.getInstance().get('localWhisperModel') || 'Xenova/whisper-tiny.en';
    modelPreloader.preload(id);
    return { success: true };
  });
  handle('local-whisper-get-hardware', async () => {
    const { detectHardware } = await import('./audio/whisper/hardwareDetect');
    return detectHardware();
  });
}
