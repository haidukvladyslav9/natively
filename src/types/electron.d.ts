export type Unsubscribe = () => void;
export type ThemeMode = 'system' | 'light' | 'dark';
export type MeetingRetention = 'forever' | '7d' | '30d' | 'never';
export type DisguiseMode = 'terminal' | 'settings' | 'activity' | 'none';

export interface ScreenshotAttachment {
  path: string;
  preview: string;
  cancelled?: boolean;
}

export interface RecentMeeting {
  id: string;
  title: string;
  date: string;
  duration: string;
  summary: string;
}

export interface Keybind {
  id: string;
  label: string;
  accelerator: string;
  isGlobal: boolean;
  defaultAccelerator: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  link?: string;
  source: 'google';
  attendees?: Array<{
    email: string;
    name?: string;
    photoUrl?: string;
    response?: 'accepted' | 'declined' | 'tentative' | 'needsAction';
  }>;
}

export interface ElectronAPI {
  updateContentDimensions: (dimensions: { width: number; height: number }) => Promise<void>;
  dismissOverlayPopovers: (options?: { settings?: boolean; model?: boolean }) => Promise<void>;
  sendOverlayUiAction: (action: { type: string }) => Promise<void>;
  sendOverlayGroupDrag: (delta: {
    dx?: number;
    dy?: number;
    phase?: 'start' | 'move' | 'end';
  }) => Promise<void>;
  isOverlayGroupDragManaged: () => Promise<boolean>;
  onOverlayUiState: (callback: (state: Record<string, unknown>) => void) => Unsubscribe;
  setWindowMode: (mode: 'launcher' | 'overlay', inactive?: boolean) => Promise<void>;
  getMeetingActive: () => Promise<boolean>;
  onMeetingStateChanged: (callback: (data: { isActive: boolean }) => void) => Unsubscribe;
  windowMinimize: () => Promise<void>;
  windowMaximize: () => Promise<void>;
  windowClose: () => Promise<void>;
  windowIsMaximized: () => Promise<boolean>;
  onWindowMaximizedChanged: (callback: (isMaximized: boolean) => void) => Unsubscribe;
  openSettingsTab: (tab: string) => Promise<void>;
  onOpenSettingsTab: (callback: (tab: string) => void) => Unsubscribe;
  quitApp: () => Promise<void>;

  takeScreenshot: () => Promise<ScreenshotAttachment>;
  takeSelectiveScreenshot: () => Promise<ScreenshotAttachment>;
  cropperConfirmed: (bounds: { x: number; y: number; width: number; height: number }) => void;
  cropperCancelled: () => void;
  onResetCropper: (
    callback: (data: { hudPosition: { x: number; y: number } }) => void,
  ) => Unsubscribe;

  startMeeting: (metadata?: unknown) => Promise<{ success: boolean; error?: string; code?: string }>;
  endMeeting: () => Promise<{ success: boolean; error?: string }>;
  getRecentMeetings: () => Promise<RecentMeeting[]>;
  getMeetingDetails: (id: string) => Promise<any>;
  updateMeetingTitle: (id: string, title: string) => Promise<boolean>;
  deleteMeeting: (id: string) => Promise<boolean>;
  onMeetingsUpdated: (callback: () => void) => Unsubscribe;

  openChatGptWeb: () => Promise<{ success: boolean; error?: string }>;
  sendToChatGptWeb: (payload: {
    prompt?: string;
    imagePaths?: string[];
    includeCurrentTranscript?: boolean;
    savedMeetingId?: string;
  }) => Promise<{ success: boolean; error?: string }>;

  getRecognitionLanguages: () => Promise<Record<string, any>>;
  getSttLanguage: () => Promise<string>;
  setRecognitionLanguage: (key: string) => Promise<{ success: boolean; error?: string }>;
  getStoredCredentials: () => Promise<any>;
  selectServiceAccount: () => Promise<{
    success: boolean;
    path?: string;
    cancelled?: boolean;
    error?: string;
  }>;
  setSttProvider: (provider: string) => Promise<{ success: boolean; error?: string }>;
  setGroqSttApiKey: (key: string) => Promise<{ success: boolean; error?: string }>;
  setOpenAiSttApiKey: (key: string) => Promise<{ success: boolean; error?: string }>;
  setOpenAiSttBaseUrl: (url: string) => Promise<{ success: boolean; error?: string }>;
  setDeepgramApiKey: (key: string) => Promise<{ success: boolean; error?: string }>;
  setElevenLabsApiKey: (key: string) => Promise<{ success: boolean; error?: string }>;
  setAzureApiKey: (key: string) => Promise<{ success: boolean; error?: string }>;
  setAzureRegion: (region: string) => Promise<{ success: boolean; error?: string }>;
  setIbmWatsonApiKey: (key: string) => Promise<{ success: boolean; error?: string }>;
  setIbmWatsonRegion: (region: string) => Promise<{ success: boolean; error?: string }>;
  setSonioxApiKey: (key: string) => Promise<{ success: boolean; error?: string }>;
  setNvidiaNimApiKey: (key: string) => Promise<{ success: boolean; error?: string }>;
  setGroqSttModel: (model: string) => Promise<{ success: boolean; error?: string }>;
  setNvidiaNimSttModel: (model: string) => Promise<{ success: boolean; error?: string }>;
  testSttConnection: (
    provider: string,
    key: string,
    region?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  getInputDevices: () => Promise<Array<{ id: string; name: string }>>;
  getOutputDevices: () => Promise<Array<{ id: string; name: string }>>;
  startAudioTest: (deviceId?: string) => Promise<{ success: boolean }>;
  stopAudioTest: () => Promise<{ success: boolean }>;
  onCredentialsChanged: (callback: () => void) => Unsubscribe;
  onSttLanguageAutoDetected: (callback: (language: string) => void) => Unsubscribe;
  onDeviceSelectionApplied: (
    callback: (payload: {
      kind: 'input' | 'output';
      requested: string | null;
      actual: string | null;
      fellBack: boolean;
      reason?: string;
    }) => void,
  ) => Unsubscribe;
  onAudioTestLevel: (callback: (level: number) => void) => Unsubscribe;
  onAudioTestSystemLevel: (callback: (level: number) => void) => Unsubscribe;
  onAudioTestSystemError: (callback: (message: string) => void) => Unsubscribe;

  localWhisperGetModels: () => Promise<{ models: any[]; activeModelId: string }>;
  localWhisperGetRecoveryNotice: () => Promise<{
    recovered: true;
    badModelId: string;
    fallbackModelId: string;
    message: string;
  } | null>;
  localWhisperGetChannelConfig: () => Promise<{
    enabled: boolean;
    micModelId: string;
    systemModelId: string;
    globalModelId: string;
  }>;
  localWhisperSetModel: (modelId: string) => Promise<{ success: boolean; error?: string }>;
  localWhisperSetChannelConfig: (config: {
    enabled?: boolean;
    micModelId?: string;
    systemModelId?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  localWhisperDeleteModel: (modelId: string) => Promise<{ success: boolean; error?: string }>;
  localWhisperStartDownload: (modelId: string) => Promise<{ success: boolean; error?: string }>;
  localWhisperCancelDownload: (modelId: string) => Promise<{ success: boolean; error?: string }>;
  localWhisperGetDownloadState: (modelId?: string) => Promise<any[]>;
  localWhisperGetHardware: () => Promise<any>;
  onLocalWhisperDownloadProgress: (
    callback: (data: { modelId: string; progress: number }) => void,
  ) => Unsubscribe;
  onLocalWhisperDownloadComplete: (
    callback: (data: { modelId: string }) => void,
  ) => Unsubscribe;
  onLocalWhisperDownloadError: (
    callback: (data: { modelId: string; error: string }) => void,
  ) => Unsubscribe;

  getThemeMode: () => Promise<{ mode: ThemeMode; resolved: 'light' | 'dark' }>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  onThemeChanged: (
    callback: (theme: { mode: ThemeMode; resolved: 'light' | 'dark' }) => void,
  ) => Unsubscribe;
  setMeetingInterfaceTheme: (theme: string) => void;
  onMeetingInterfaceThemeChanged: (callback: (theme: string) => void) => Unsubscribe;
  setOverlayOpacity: (opacity: number) => Promise<void>;
  setLauncherOpacityPreview: (active: boolean) => Promise<void>;
  setUndetectable: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
  getUndetectable: () => Promise<boolean>;
  onUndetectableChanged: (callback: (enabled: boolean) => void) => Unsubscribe;
  setOverlayMousePassthrough: (enabled: boolean) => Promise<{ success: boolean }>;
  getOverlayMousePassthrough: () => Promise<boolean>;
  onOverlayMousePassthroughChanged: (callback: (enabled: boolean) => void) => Unsubscribe;
  setDisguise: (mode: DisguiseMode) => Promise<{ success: boolean; error?: string }>;
  getDisguise: () => Promise<DisguiseMode>;
  onDisguiseChanged: (callback: (mode: DisguiseMode) => void) => Unsubscribe;
  setOpenAtLogin: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
  getOpenAtLogin: () => Promise<boolean>;
  getVerboseLogging: () => Promise<boolean>;
  setVerboseLogging: (enabled: boolean) => Promise<{ success: boolean }>;
  getMeetingRetention: () => Promise<MeetingRetention>;
  setMeetingRetention: (
    retention: MeetingRetention,
  ) => Promise<{ success: boolean; error?: string }>;
  onMeetingRetentionChanged: (callback: (retention: MeetingRetention) => void) => Unsubscribe;

  checkPermissions: () => Promise<{
    microphone: 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown';
    screen: 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown';
    platform: string;
  }>;
  requestMicPermission: () => Promise<boolean>;
  openMicSettings: () => Promise<{ ok?: boolean; reason?: string } | boolean>;

  calendarConnect: () => Promise<{ success: boolean; error?: string }>;
  calendarDisconnect: () => Promise<{ success: boolean; error?: string }>;
  getCalendarStatus: () => Promise<{ connected: boolean; email?: string }>;
  getUpcomingEvents: () => Promise<CalendarEvent[]>;
  calendarRefresh: () => Promise<{ success: boolean; error?: string }>;

  getKeybinds: () => Promise<Keybind[]>;
  setKeybind: (id: string, accelerator: string) => Promise<boolean>;
  resetKeybinds: () => Promise<Keybind[]>;
  getKeybindRegistrationFailures: () => Promise<Array<{ id: string; accelerator: string }>>;
  onKeybindsUpdate: (callback: (keybinds: Keybind[]) => void) => Unsubscribe;
  onKeybindRegistrationFailed: (
    callback: (data: { id: string; accelerator: string }) => void,
  ) => Unsubscribe;
  onKeybindRegistrationSucceeded: (
    callback: (data: { id: string; accelerator: string }) => void,
  ) => Unsubscribe;

  onUpdateAvailable: (callback: (info: any) => void) => Unsubscribe;
  onUpdateDownloaded: (callback: (info: any) => void) => Unsubscribe;
  onUpdateChecking: (callback: () => void) => Unsubscribe;
  onUpdateNotAvailable: (callback: (info: any) => void) => Unsubscribe;
  onUpdateError: (callback: (message: string) => void) => Unsubscribe;
  onDownloadProgress: (callback: (progress: any) => void) => Unsubscribe;
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  getCanAutoUpdate: () => Promise<{ canAutoUpdate: boolean }>;
  restartAndInstall: () => Promise<void>;
  getArch: () => Promise<string>;

  openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
  openLogFile: () => Promise<{ success?: boolean; error?: string } | string>;
  platform: NodeJS.Platform;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
