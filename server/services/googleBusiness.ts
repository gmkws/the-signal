/**
 * Google Business Profile (GBP) API service.
 * Handles OAuth 2.0 token exchange/refresh, account/location listing,
 * and Local Post publishing — all via raw fetch (no new npm packages).
 *
 * Pattern mirrors server/services/meta.ts.
 */

const OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const ACCOUNT_API_BASE = "https://mybusinessaccountmanagement.googleapis.com/v1";
const BUSINESS_INFO_API_BASE = "https://mybusinessbusinessinformation.googleapis.com/v1";
const LOCAL_POSTS_API_BASE = "https://mybusiness.googleapis.com/v4";

// Scope required for reading locations and creating posts.
const GBP_SCOPE = "https://www.googleapis.com/auth/business.manage";

// ── Types ────────────────────────────────────────────────────────────────────

export interface GBPTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface GBPAccount {
  name: string;        // e.g. "accounts/123456789"
  accountName: string; // human-readable display name
  type: string;
}

export interface GBPLocation {
  name: string;  // e.g. "accounts/123456789/locations/987654321"
  title: string; // business display name
  websiteUri?: string;
}

export interface GBPLocalPost {
  name: string;        // resource name of the created post
  topicType: string;
  summary: string;
  state: string;
}

// ── OAuth helpers ─────────────────────────────────────────────────────────────

/**
 * Build the Google OAuth 2.0 authorization URL for the connect popup.
 */
export function buildGBPOAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string
): string {
  const url = new URL(OAUTH_AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GBP_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent"); // always return refresh_token
  url.searchParams.set("state", state);
  return url.toString();
}

/**
 * Exchange an authorization code for access + refresh tokens.
 */
export async function exchangeGoogleCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<GBPTokenResponse> {
  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`GBP token exchange failed: ${JSON.stringify(error)}`);
  }
  return response.json();
}

/**
 * Refresh an expired access token using the stored refresh token.
 */
export async function refreshGoogleToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<GBPTokenResponse> {
  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`GBP token refresh failed: ${JSON.stringify(error)}`);
  }
  return response.json();
}

// ── Account & Location queries ────────────────────────────────────────────────

/**
 * List all GBP accounts the authenticated user manages.
 */
export async function getGBPAccounts(accessToken: string): Promise<GBPAccount[]> {
  const response = await fetch(`${ACCOUNT_API_BASE}/accounts`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Failed to list GBP accounts: ${JSON.stringify(error)}`);
  }
  const data = await response.json();
  return data.accounts ?? [];
}

/**
 * List all locations under a GBP account.
 * accountName format: "accounts/{accountId}"
 */
export async function getGBPLocations(
  accountName: string,
  accessToken: string
): Promise<GBPLocation[]> {
  const url = new URL(`${BUSINESS_INFO_API_BASE}/${accountName}/locations`);
  url.searchParams.set("readMask", "name,title,websiteUri");

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Failed to list GBP locations: ${JSON.stringify(error)}`);
  }
  const data = await response.json();
  return data.locations ?? [];
}

// ── Publishing ────────────────────────────────────────────────────────────────

/**
 * Create a Local Post on a Google Business Profile location.
 * locationName format: "accounts/{accountId}/locations/{locationId}"
 */
export async function publishToGBP(
  locationName: string,
  accessToken: string,
  content: string,
  mediaUrl?: string
): Promise<GBPLocalPost> {
  const body: Record<string, unknown> = {
    languageCode: "en-US",
    summary: content,
    topicType: "STANDARD",
  };

  if (mediaUrl) {
    body.media = [
      {
        mediaFormat: "PHOTO",
        sourceUrl: mediaUrl,
      },
    ];
  }

  const response = await fetch(`${LOCAL_POSTS_API_BASE}/${locationName}/localPosts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`GBP publish failed: ${JSON.stringify(error)}`);
  }
  return response.json();
}
