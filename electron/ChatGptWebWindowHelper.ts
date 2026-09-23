import { BrowserWindow, clipboard, nativeImage, shell } from 'electron';
import {
  isAllowedChatGptNavigation,
  isSafeExternalUrl,
} from './services/chatGptWebNavigation';

const CHATGPT_URL = 'https://chatgpt.com/';
const CHATGPT_PARTITION = 'persist:natively-chatgpt-web';
const PROMPT_SELECTORS = [
  '#prompt-textarea',
  'textarea[data-testid="prompt-textarea"]',
  'textarea',
  '[contenteditable="true"][data-testid="prompt-textarea"]',
  'main [contenteditable="true"]',
] as const;

export interface ChatGptWebSendPayload {
  prompt?: string;
  imagePaths?: string[];
}

export interface ChatGptWebSendResult {
  success: boolean;
  error?: string;
}

/**
 * User-operated ChatGPT browser surface.
 *
 * This window intentionally has no preload and never reads prompts,
 * credentials, or replies from the remote page. The only page interaction is
 * focusing ChatGPT's composer so explicit user-requested text and screenshots
 * can be pasted into it.
 */
export class ChatGptWebWindowHelper {
  private window: BrowserWindow | null = null;
  private contentProtection = false;

  public getWindow(): BrowserWindow | null {
    return this.window;
  }

  public async showWindow(options: { activate?: boolean } = {}): Promise<void> {
    if (!this.window || this.window.isDestroyed()) {
      this.createWindow(options.activate ?? true);
      return;
    }

    const win = this.window;
    if (!win || win.isDestroyed()) return;

    if (win.webContents.getURL() === '') {
      await win.loadURL(CHATGPT_URL);
    }

    if (win.isMinimized()) win.restore();
    if (options.activate === false) {
      win.showInactive();
    } else {
      win.show();
      win.focus();
    }
  }

  public setContentProtection(enabled: boolean): void {
    this.contentProtection = enabled;
    if (this.window && !this.window.isDestroyed()) {
      this.window.setContentProtection(enabled);
    }
  }

  public reassertContentProtection(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.setContentProtection(this.contentProtection);
    }
  }

  public async send(payload: ChatGptWebSendPayload): Promise<ChatGptWebSendResult> {
    const prompt = payload.prompt?.trim() ?? '';
    const imagePaths = (payload.imagePaths ?? []).slice(0, 5);
    if (!prompt && imagePaths.length === 0) {
      return { success: false, error: 'Enter a question or attach a screenshot first.' };
    }

    await this.showWindow();
    const win = this.window;
    if (!win || win.isDestroyed()) {
      return { success: false, error: 'ChatGPT window is unavailable.' };
    }

    try {
      await this.waitForPage(win);
      win.show();
      win.focus();

      const composerFound = await this.focusComposer(win);
      if (!composerFound) {
        return {
          success: false,
          error: 'Sign in to ChatGPT, then click its message box and try again.',
        };
      }

      for (const imagePath of imagePaths) {
        const image = nativeImage.createFromPath(imagePath);
        if (image.isEmpty()) {
          return { success: false, error: 'A selected screenshot could not be opened.' };
        }
        await this.pasteImage(win, image);
      }

      if (prompt) {
        await win.webContents.insertText(prompt);
      }

      // ChatGPT disables its send button while an image upload is still being
      // prepared. Wait briefly for that explicit UI state instead of firing an
      // Enter key on a timer and racing the upload.
      await this.submitWhenReady(win);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[ChatGptWebWindowHelper] Failed to send content:', error);
      return { success: false, error: message || 'Failed to send content to ChatGPT.' };
    }
  }

  private async waitForPage(win: BrowserWindow): Promise<void> {
    if (!win.webContents.isLoadingMainFrame()) return;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('ChatGPT took too long to load.'));
      }, 30_000);
      const onReady = () => {
        cleanup();
        resolve();
      };
      const onFailure = (_event: Electron.Event, _code: number, description: string, url: string, isMainFrame: boolean) => {
        if (!isMainFrame) return;
        cleanup();
        reject(new Error(`ChatGPT failed to load ${url}: ${description}`));
      };
      const cleanup = () => {
        clearTimeout(timeout);
        win.webContents.removeListener('did-finish-load', onReady);
        win.webContents.removeListener('did-fail-load', onFailure);
      };
      win.webContents.once('did-finish-load', onReady);
      win.webContents.on('did-fail-load', onFailure);
    });
  }

  private async focusComposer(win: BrowserWindow): Promise<boolean> {
    const selectors = JSON.stringify(PROMPT_SELECTORS);
    return win.webContents.executeJavaScript(
      `(() => {
        const selectors = ${selectors};
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element instanceof HTMLElement && element.offsetParent !== null) {
            element.focus();
            return true;
          }
        }
        return false;
      })()`,
      true,
    );
  }

  private async pasteImage(win: BrowserWindow, image: Electron.NativeImage): Promise<void> {
    const previousClipboard = {
      text: clipboard.readText(),
      html: clipboard.readHTML(),
      rtf: clipboard.readRTF(),
      image: clipboard.readImage(),
    };
    try {
      clipboard.writeImage(image);
      win.webContents.paste();
      await new Promise(resolve => setTimeout(resolve, 150));
    } finally {
      clipboard.write(previousClipboard);
    }
  }

  private async submitWhenReady(win: BrowserWindow): Promise<void> {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const submitted = await win.webContents.executeJavaScript(
        `(() => {
          const button = document.querySelector(
            '[data-testid="send-button"], button[aria-label="Send prompt"]'
          );
          if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
          button.click();
          return true;
        })()`,
        true,
      );
      if (submitted) return;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error('The content was pasted, but ChatGPT was not ready to submit it.');
  }

  private createWindow(activate = true): void {
    const win = new BrowserWindow({
      title: 'Natively — ChatGPT Web',
      width: 1100,
      height: 780,
      minWidth: 720,
      minHeight: 520,
      show: false,
      autoHideMenuBar: true,
      backgroundColor: '#212121',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        partition: CHATGPT_PARTITION,
      },
    });

    this.window = win;
    win.setContentProtection(this.contentProtection);

    win.webContents.on('will-navigate', (event, url) => {
      if (isAllowedChatGptNavigation(url)) return;
      event.preventDefault();
      if (isSafeExternalUrl(url)) {
        void shell.openExternal(url);
      }
    });

    win.webContents.setWindowOpenHandler(({ url }) => {
      if (isAllowedChatGptNavigation(url)) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            parent: win,
            modal: false,
            autoHideMenuBar: true,
            webPreferences: {
              nodeIntegration: false,
              contextIsolation: true,
              sandbox: true,
              webSecurity: true,
              allowRunningInsecureContent: false,
              partition: CHATGPT_PARTITION,
            },
          },
        };
      }

      if (isSafeExternalUrl(url)) {
        void shell.openExternal(url);
      }
      return { action: 'deny' };
    });

    win.once('ready-to-show', () => {
      if (win.isDestroyed()) return;
      if (activate) win.show();
      else win.showInactive();
    });

    win.on('closed', () => {
      if (this.window === win) this.window = null;
    });

    void win.loadURL(CHATGPT_URL).catch(error => {
      console.error('[ChatGptWebWindowHelper] Failed to load ChatGPT:', error);
    });
  }
}
