import { contextBridge, ipcRenderer } from 'electron';

type Unsubscribe = () => void;

function on<T>(channel: string, callback: (payload: T) => void): Unsubscribe {
  const listener = (_event: Electron.IpcRendererEvent, payload: T) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

function onVoid(channel: string, callback: () => void): Unsubscribe {
  const listener = () => callback();
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Window and overlay lifecycle.
  updateContentDimensions: (dimensions: { width: number; height: number }) =>
    ipcRenderer.invoke('update-content-dimensions', dimensions),
  dismissOverlayPopovers: (options?: { settings?: boolean; model?: boolean }) =>
    ipcRenderer.invoke('overlay-popovers:dismiss', options),
  sendOverlayUiAction: (action: { type: string }) =>
    ipcRenderer.invoke('overlay-ui-action', action),
  sendOverlayGroupDrag: (delta: { dx?: number; dy?: number; phase?: 'start' | 'move' | 'end' }) =>
    ipcRenderer.invoke('overlay-group-drag', delta),
  isOverlayGroupDragManaged: () => ipcRenderer.invoke('overlay-group-drag-managed'),
  onOverlayUiState: (callback: (state: Record<string, unknown>) => void) =>
    on('overlay-ui-state', callback),
  setWindowMode: (mode: 'launcher' | 'overlay', inactive?: boolean) =>
    ipcRenderer.invoke('set-window-mode', mode, inactive),
  getMeetingActive: () => ipcRenderer.invoke('get-meeting-active'),
  onMeetingStateChanged: (callback: (data: { isActive: boolean }) => void) =>
    on('meeting-state-changed', callback),
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onWindowMaximizedChanged: (callback: (isMaximized: boolean) => void) =>
    on('window-maximized-changed', callback),
  openSettingsTab: (tab: string) => ipcRenderer.invoke('settings:open-tab', tab),
  onOpenSettingsTab: (callback: (tab: string) => void) => on('settings:open-tab', callback),
  quitApp: () => ipcRenderer.invoke('quit-app'),

  // Screenshots and cropper.
  takeScreenshot: () => ipcRenderer.invoke('take-screenshot'),
  takeSelectiveScreenshot: () => ipcRenderer.invoke('take-selective-screenshot'),
  cropperConfirmed: (bounds: Electron.Rectangle) => ipcRenderer.send('cropper-confirmed', bounds),
  cropperCancelled: () => ipcRenderer.send('cropper-cancelled'),
  onResetCropper: (callback: (data: { hudPosition: { x: number; y: number } }) => void) =>
    on('reset-cropper', callback),

  // Meeting capture and raw history.
  startMeeting: (metadata?: unknown) => ipcRenderer.invoke('start-meeting', metadata),
  endMeeting: () => ipcRenderer.invoke('end-meeting'),
  getRecentMeetings: () => ipcRenderer.invoke('get-recent-meetings'),
  getMeetingDetails: (id: string) => ipcRenderer.invoke('get-meeting-details', id),
  updateMeetingTitle: (id: string, title: string) =>
    ipcRenderer.invoke('update-meeting-title', { id, title }),
  deleteMeeting: (id: string) => ipcRenderer.invoke('delete-meeting', id),
  onMeetingsUpdated: (callback: () => void) => onVoid('meetings-updated', callback),

  // User-operated ChatGPT website window. Transcript and saved-meeting context
  // are resolved in the main process; raw context never crosses into renderer.
  openChatGptWeb: () => ipcRenderer.invoke('chatgpt-web:open'),
  sendToChatGptWeb: (payload: {
    prompt?: string;
    imagePaths?: string[];
    includeCurrentTranscript?: boolean;
    savedMeetingId?: string;
  }) => ipcRenderer.invoke('chatgpt-web:send', payload),

  // STT provider settings and audio devices.
  getRecognitionLanguages: () => ipcRenderer.invoke('get-recognition-languages'),
  getSttLanguage: () => ipcRenderer.invoke('get-stt-language'),
  setRecognitionLanguage: (key: string) => ipcRenderer.invoke('set-recognition-language', key),
  getStoredCredentials: () => ipcRenderer.invoke('get-stored-credentials'),
  selectServiceAccount: () => ipcRenderer.invoke('select-service-account'),
  setSttProvider: (provider: string) => ipcRenderer.invoke('set-stt-provider', provider),
  setGroqSttApiKey: (key: string) => ipcRenderer.invoke('set-groq-stt-api-key', key),
  setOpenAiSttApiKey: (key: string) => ipcRenderer.invoke('set-openai-stt-api-key', key),
  setOpenAiSttBaseUrl: (url: string) => ipcRenderer.invoke('set-openai-stt-base-url', url),
  setDeepgramApiKey: (key: string) => ipcRenderer.invoke('set-deepgram-api-key', key),
  setElevenLabsApiKey: (key: string) => ipcRenderer.invoke('set-elevenlabs-api-key', key),
  setAzureApiKey: (key: string) => ipcRenderer.invoke('set-azure-api-key', key),
  setAzureRegion: (region: string) => ipcRenderer.invoke('set-azure-region', region),
  setIbmWatsonApiKey: (key: string) => ipcRenderer.invoke('set-ibmwatson-api-key', key),
  setIbmWatsonRegion: (region: string) => ipcRenderer.invoke('set-ibmwatson-region', region),
  setSonioxApiKey: (key: string) => ipcRenderer.invoke('set-soniox-api-key', key),
  setNvidiaNimApiKey: (key: string) => ipcRenderer.invoke('set-nvidia-nim-api-key', key),
  setGroqSttModel: (model: string) => ipcRenderer.invoke('set-groq-stt-model', model),
  setNvidiaNimSttModel: (model: string) => ipcRenderer.invoke('set-nvidia-nim-stt-model', model),
  testSttConnection: (provider: string, key: string, region?: string) =>
    ipcRenderer.invoke('test-stt-connection', provider, key, region),
  getInputDevices: () => ipcRenderer.invoke('get-input-devices'),
  getOutputDevices: () => ipcRenderer.invoke('get-output-devices'),
  startAudioTest: (deviceId?: string) => ipcRenderer.invoke('start-audio-test', deviceId),
  stopAudioTest: () => ipcRenderer.invoke('stop-audio-test'),
  onCredentialsChanged: (callback: () => void) => onVoid('credentials-changed', callback),
  onSttLanguageAutoDetected: (callback: (language: string) => void) =>
    on('stt-language-auto-detected', callback),
  onDeviceSelectionApplied: (callback: (payload: unknown) => void) =>
    on('device-selection-applied', callback),
  onAudioTestLevel: (callback: (level: number) => void) => on('audio-test-level', callback),
  onAudioTestSystemLevel: (callback: (level: number) => void) =>
    on('audio-test-system-level', callback),
  onAudioTestSystemError: (callback: (message: string) => void) =>
    on('audio-test-system-error', callback),

  // Local Whisper model management.
  localWhisperGetModels: () => ipcRenderer.invoke('local-whisper-get-models'),
  localWhisperGetRecoveryNotice: () => ipcRenderer.invoke('local-whisper-get-recovery-notice'),
  localWhisperGetChannelConfig: () => ipcRenderer.invoke('local-whisper-get-channel-config'),
  localWhisperSetModel: (modelId: string) => ipcRenderer.invoke('local-whisper-set-model', modelId),
  localWhisperSetChannelConfig: (config: unknown) =>
    ipcRenderer.invoke('local-whisper-set-channel-config', config),
  localWhisperDeleteModel: (modelId: string) =>
    ipcRenderer.invoke('local-whisper-delete-model', modelId),
  localWhisperStartDownload: (modelId: string) =>
    ipcRenderer.invoke('local-whisper-start-download', modelId),
  localWhisperCancelDownload: (modelId: string) =>
    ipcRenderer.invoke('local-whisper-cancel-download', modelId),
  localWhisperGetDownloadState: (modelId?: string) =>
    ipcRenderer.invoke('local-whisper-get-download-state', modelId),
  localWhisperGetHardware: () => ipcRenderer.invoke('local-whisper-get-hardware'),
  onLocalWhisperDownloadProgress: (callback: (data: { modelId: string; progress: number }) => void) =>
    on('local-whisper-download-progress', callback),
  onLocalWhisperDownloadComplete: (callback: (data: { modelId: string }) => void) =>
    on('local-whisper-download-complete', callback),
  onLocalWhisperDownloadError: (callback: (data: { modelId: string; error: string }) => void) =>
    on('local-whisper-download-error', callback),

  // Appearance and privacy.
  getThemeMode: () => ipcRenderer.invoke('theme:get-mode'),
  setThemeMode: (mode: 'system' | 'light' | 'dark') => ipcRenderer.invoke('theme:set-mode', mode),
  onThemeChanged: (callback: (theme: { mode: 'system' | 'light' | 'dark'; resolved: 'light' | 'dark' }) => void) =>
    on('theme:changed', callback),
  setMeetingInterfaceTheme: (theme: string) => ipcRenderer.send('interface-theme:set', theme),
  onMeetingInterfaceThemeChanged: (callback: (theme: string) => void) =>
    on('interface-theme:changed', callback),
  setOverlayOpacity: (opacity: number) => ipcRenderer.invoke('set-overlay-opacity', opacity),
  setLauncherOpacityPreview: (active: boolean) =>
    ipcRenderer.invoke('set-launcher-opacity-preview', active),
  setUndetectable: (enabled: boolean) => ipcRenderer.invoke('set-undetectable', enabled),
  getUndetectable: () => ipcRenderer.invoke('get-undetectable'),
  onUndetectableChanged: (callback: (enabled: boolean) => void) =>
    on('undetectable-changed', callback),
  setOverlayMousePassthrough: (enabled: boolean) =>
    ipcRenderer.invoke('set-overlay-mouse-passthrough', enabled),
  getOverlayMousePassthrough: () => ipcRenderer.invoke('get-overlay-mouse-passthrough'),
  onOverlayMousePassthroughChanged: (callback: (enabled: boolean) => void) =>
    on('overlay-mouse-passthrough-changed', callback),
  setDisguise: (mode: 'terminal' | 'settings' | 'activity' | 'none') =>
    ipcRenderer.invoke('set-disguise', mode),
  getDisguise: () => ipcRenderer.invoke('get-disguise'),
  onDisguiseChanged: (callback: (mode: 'terminal' | 'settings' | 'activity' | 'none') => void) =>
    on('disguise-changed', callback),
  setOpenAtLogin: (enabled: boolean) => ipcRenderer.invoke('set-open-at-login', enabled),
  getOpenAtLogin: () => ipcRenderer.invoke('get-open-at-login'),
  getVerboseLogging: () => ipcRenderer.invoke('get-verbose-logging'),
  setVerboseLogging: (enabled: boolean) => ipcRenderer.invoke('set-verbose-logging', enabled),
  getMeetingRetention: () => ipcRenderer.invoke('get-meeting-retention'),
  setMeetingRetention: (retention: 'forever' | '7d' | '30d' | 'never') =>
    ipcRenderer.invoke('set-meeting-retention', retention),
  onMeetingRetentionChanged: (callback: (retention: 'forever' | '7d' | '30d' | 'never') => void) =>
    on('meeting-retention-changed', callback),

  // Permissions.
  checkPermissions: () => ipcRenderer.invoke('permissions:check'),
  requestMicPermission: () => ipcRenderer.invoke('permissions:request-mic'),
  openMicSettings: () => ipcRenderer.invoke('permissions:open-mic-settings'),

  // Calendar.
  calendarConnect: () => ipcRenderer.invoke('calendar-connect'),
  calendarDisconnect: () => ipcRenderer.invoke('calendar-disconnect'),
  getCalendarStatus: () => ipcRenderer.invoke('get-calendar-status'),
  getUpcomingEvents: () => ipcRenderer.invoke('get-upcoming-events'),
  calendarRefresh: () => ipcRenderer.invoke('calendar-refresh'),

  // Keybinds.
  getKeybinds: () => ipcRenderer.invoke('keybinds:get-all'),
  setKeybind: (id: string, accelerator: string) =>
    ipcRenderer.invoke('keybinds:set', id, accelerator),
  resetKeybinds: () => ipcRenderer.invoke('keybinds:reset'),
  getKeybindRegistrationFailures: () =>
    ipcRenderer.invoke('keybinds:get-registration-failures'),
  onKeybindsUpdate: (callback: (keybinds: unknown[]) => void) =>
    on('keybinds:update', callback),
  onKeybindRegistrationFailed: (callback: (data: { id: string; accelerator: string }) => void) =>
    on('keybinds:registration-failed', callback),
  onKeybindRegistrationSucceeded: (callback: (data: { id: string; accelerator: string }) => void) =>
    on('keybinds:registration-succeeded', callback),

  // Updater.
  onUpdateAvailable: (callback: (info: unknown) => void) => on('update-available', callback),
  onUpdateDownloaded: (callback: (info: unknown) => void) => on('update-downloaded', callback),
  onUpdateChecking: (callback: () => void) => onVoid('update-checking', callback),
  onUpdateNotAvailable: (callback: (info: unknown) => void) =>
    on('update-not-available', callback),
  onUpdateError: (callback: (message: string) => void) => on('update-error', callback),
  onDownloadProgress: (callback: (progress: unknown) => void) =>
    on('download-progress', callback),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  getCanAutoUpdate: () => ipcRenderer.invoke('get-can-auto-update'),
  restartAndInstall: () => ipcRenderer.invoke('quit-and-install-update'),
  getArch: () => ipcRenderer.invoke('get-arch'),

  // Diagnostics and safe external navigation.
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  openLogFile: () => ipcRenderer.invoke('open-log-file'),

  platform: process.platform,
});
