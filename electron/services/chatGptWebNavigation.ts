const EMBEDDED_HOSTS = [
  'chatgpt.com',
  'openai.com',
  'auth0.openai.com',
  'accounts.google.com',
  'appleid.apple.com',
  'login.microsoftonline.com',
  'account.live.com',
] as const;

function matchesHost(hostname: string, allowedHost: string): boolean {
  return hostname === allowedHost || hostname.endsWith(`.${allowedHost}`);
}

/**
 * Top-level destinations that may stay inside the manual ChatGPT window.
 * Identity-provider hosts are included so users can complete an interactive
 * sign-in without Natively reading credentials or page content.
 */
export function isAllowedChatGptNavigation(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:') return false;
    const hostname = url.hostname.toLowerCase();
    return EMBEDDED_HOSTS.some(host => matchesHost(hostname, host));
  } catch {
    return false;
  }
}

/** URLs that are safe to hand off to the user's normal browser. */
export function isSafeExternalUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'https:' || url.protocol === 'mailto:';
  } catch {
    return false;
  }
}
