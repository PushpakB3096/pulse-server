const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const IGDB_BASE = 'https://api.igdb.com/v4';

const REFRESH_BUFFER_MS = 10 * 60 * 1000; // 10 minutes before expiry

let cachedToken: { accessToken: string; expiresAtMs: number } | null = null;

function getClientId(): string {
  const id = process.env.IGDB_CLIENT_ID?.trim();
  if (!id) {
    throw new Error('IGDB_CLIENT_ID is not set');
  }
  return id;
}

function getClientSecret(): string {
  const secret = process.env.IGDB_CLIENT_SECRET?.trim();
  if (!secret) {
    throw new Error('IGDB_CLIENT_SECRET is not set');
  }
  return secret;
}

async function fetchAccessToken(): Promise<{ access_token: string; expires_in: number }> {
  const body = new URLSearchParams({
    client_id: getClientId(),
    client_secret: getClientSecret(),
    grant_type: 'client_credentials'
  });

  const res = await fetch(TWITCH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twitch token error ${res.status}: ${text}`);
  }

  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

export async function getIgdbAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < cachedToken.expiresAtMs - REFRESH_BUFFER_MS) {
    return cachedToken.accessToken;
  }

  const data = await fetchAccessToken();
  const expiresInMs = (data.expires_in ?? 3600) * 1000;
  cachedToken = {
    accessToken: data.access_token,
    expiresAtMs: now + expiresInMs
  };
  return cachedToken.accessToken;
}

export async function postIgdb<T = unknown>(
  endpoint: string,
  apicalypseBody: string
): Promise<T> {
  const token = await getIgdbAccessToken();
  const url = `${IGDB_BASE}/${endpoint.replace(/^\//, '')}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Client-ID': getClientId(),
      Authorization: `Bearer ${token}`
    },
    body: apicalypseBody
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IGDB ${endpoint} ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

/** Normalize IGDB image URL (may be protocol-relative). */
export function normalizeIgdbImageUrl(url: string | undefined | null): string | undefined {
  if (!url || typeof url !== 'string') {
    return undefined;
  }
  const t = url.trim();
  if (!t) {
    return undefined;
  }
  if (t.startsWith('//')) {
    return `https:${t}`;
  }
  return t;
}
