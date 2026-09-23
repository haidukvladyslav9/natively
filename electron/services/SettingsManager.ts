import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export interface AppSettings {
  isUndetectable?: boolean;
  disguiseMode?: 'terminal' | 'settings' | 'activity' | 'none';
  verboseLogging?: boolean;
  localWhisperModel?: string;
  localWhisperPerChannelEnabled?: boolean;
  localWhisperModelMic?: string;
  localWhisperModelSystem?: string;
  whisperAppleSiliconDtype?: string;
  speakerDiarizationV1Enabled?: boolean;
  telemetryEnabled?: boolean;
  meetingRetention?: 'forever' | '7d' | '30d' | 'never';
  seenStartup?: boolean;
  permsShown?: boolean;
  regionalSttRelayEnabled?: boolean;
  regionalSttRelayPercent?: number;
  forceSttRelayRegion?: 'us' | 'asia' | null;
  sttRailwayFallbackEnabled?: boolean;
  sttMaxSampleRate?: number;
  sttMaxChannels?: number;
  sttAllowDualStream?: boolean;
}

const RETAINED_KEYS = new Set<keyof AppSettings>([
  'isUndetectable',
  'disguiseMode',
  'verboseLogging',
  'localWhisperModel',
  'localWhisperPerChannelEnabled',
  'localWhisperModelMic',
  'localWhisperModelSystem',
  'whisperAppleSiliconDtype',
  'speakerDiarizationV1Enabled',
  'telemetryEnabled',
  'meetingRetention',
  'seenStartup',
  'permsShown',
  'regionalSttRelayEnabled',
  'regionalSttRelayPercent',
  'forceSttRelayRegion',
  'sttRailwayFallbackEnabled',
  'sttMaxSampleRate',
  'sttMaxChannels',
  'sttAllowDualStream',
]);

export function fnv1aBucket(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = (
      hash
      + (hash << 1)
      + (hash << 4)
      + (hash << 7)
      + (hash << 8)
      + (hash << 24)
    ) >>> 0;
  }
  return hash % 100;
}

export class SettingsManager {
  private static instance: SettingsManager | undefined;
  private settings: AppSettings = {};
  private readonly settingsPath: string;
  private settingsUnreadable = false;

  private constructor() {
    if (!app.isReady()) {
      throw new Error('[SettingsManager] Cannot initialize before app.whenReady()');
    }
    this.settingsPath = path.join(app.getPath('userData'), 'settings.json');
    this.loadSettings();
  }

  public static getInstance(): SettingsManager {
    const globalSettings = globalThis as unknown as Record<string, SettingsManager | undefined>;
    if (!globalSettings.__nativelySettingsManagerV1__) {
      globalSettings.__nativelySettingsManagerV1__ =
        SettingsManager.instance ?? new SettingsManager();
    }
    SettingsManager.instance = globalSettings.__nativelySettingsManagerV1__;
    return globalSettings.__nativelySettingsManagerV1__;
  }

  public get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.settings[key];
  }

  public set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): boolean {
    if (this.settingsUnreadable) {
      console.warn(`[SettingsManager] Refusing to set "${String(key)}" while settings are unreadable.`);
      return false;
    }
    this.settings[key] = value;
    return this.saveSettings();
  }

  public isDegraded(): boolean {
    return this.settingsUnreadable;
  }

  public getRegionalSttRelayEnabled(): boolean {
    return this.settings.regionalSttRelayEnabled === true;
  }

  public getRegionalSttRelayPercent(): number {
    const value = this.settings.regionalSttRelayPercent;
    if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, Math.floor(value)));
  }

  public getForceSttRelayRegion(): 'us' | 'asia' | null {
    const value = this.settings.forceSttRelayRegion;
    return value === 'us' || value === 'asia' ? value : null;
  }

  public getSttRailwayFallbackEnabled(): boolean {
    return this.settings.sttRailwayFallbackEnabled !== false;
  }

  public getSttMaxSampleRate(): number {
    const value = this.settings.sttMaxSampleRate;
    return typeof value === 'number' && Number.isFinite(value) && value > 0
      ? Math.floor(value)
      : 16_000;
  }

  public getSttMaxChannels(): number {
    const value = this.settings.sttMaxChannels;
    return typeof value === 'number' && Number.isFinite(value) && value > 0
      ? Math.floor(value)
      : 1;
  }

  public getSttAllowDualStream(): boolean {
    return this.settings.sttAllowDualStream === true;
  }

  public isRegionalSttRelayEnabledForKey(apiKey: string | null | undefined): boolean {
    if (!this.getRegionalSttRelayEnabled()) return false;
    const percent = this.getRegionalSttRelayPercent();
    if (percent <= 0 || percent >= 100) return true;
    return fnv1aBucket(apiKey ?? '') < percent;
  }

  private loadSettings(): void {
    if (!fs.existsSync(this.settingsPath)) return;
    try {
      const parsed = JSON.parse(fs.readFileSync(this.settingsPath, 'utf8')) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Settings JSON is not an object');
      }
      this.settings = Object.fromEntries(
        Object.entries(parsed).filter(([key]) => RETAINED_KEYS.has(key as keyof AppSettings)),
      ) as AppSettings;
    } catch (error) {
      this.quarantineUnreadableSettings(error);
    }
  }

  private quarantineUnreadableSettings(cause: unknown): void {
    this.settings = {};
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const quarantinePath = `${this.settingsPath}.corrupt-${stamp}`;
    try {
      fs.renameSync(this.settingsPath, quarantinePath);
      this.settingsUnreadable = false;
      console.error(
        `[SettingsManager] Invalid settings moved to ${quarantinePath}; using defaults.`,
        cause,
      );
    } catch (renameError) {
      this.settingsUnreadable = true;
      console.error(
        '[SettingsManager] Invalid settings could not be quarantined; continuing read-only.',
        cause,
        renameError,
      );
    }
  }

  private saveSettings(): boolean {
    if (this.settingsUnreadable) return false;
    const temporaryPath = `${this.settingsPath}.tmp`;
    try {
      const descriptor = fs.openSync(temporaryPath, 'w');
      try {
        fs.writeFileSync(descriptor, JSON.stringify(this.settings, null, 2));
        fs.fsyncSync(descriptor);
      } finally {
        fs.closeSync(descriptor);
      }
      fs.renameSync(temporaryPath, this.settingsPath);
      return true;
    } catch (error) {
      console.error('[SettingsManager] Failed to save settings:', error);
      try {
        fs.rmSync(temporaryPath, { force: true });
      } catch {
        // Best effort cleanup.
      }
      return false;
    }
  }
}
