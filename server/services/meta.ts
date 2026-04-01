/**
 * Meta Graph API service for Facebook and Instagram posting.
 * Handles OAuth token exchange, page posting, and Instagram content publishing.
 */

const GRAPH_API_VERSION = "v19.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export interface MetaTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  category?: string;
}

export interface InstagramAccount {
  id: string;
  name?: string;
  username?: string;
}

/**
 * Exchange a short-lived token for a long-lived token
 */
export async function exchangeForLongLivedToken(
  shortLivedToken: string,
  appId: string,
  appSecret: string
): Promise<MetaTokenResponse> {
  const url = new URL(`${GRAPH_API_BASE}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", shortLivedToken);

  const response = await fetch(url.toString());
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Meta token exchange failed: ${JSON.stringify(error)}`);
  }
  return response.json();
}

/**
 * Get list of Facebook Pages the user manages
 */
export async function getUserPages(accessToken: string): Promise<FacebookPage[]> {
  const url = new URL(`${GRAPH_API_BASE}/me/accounts`);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("fields", "id,name,access_token,category");

  const response = await fetch(url.toString());
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Failed to get user pages: ${JSON.stringify(error)}`);
  }
  const data = await response.json();
  return data.data || [];
}

/**
 * Get Instagram Business Account connected to a Facebook Page
 */
export async function getInstagramAccount(
  pageId: string,
  pageAccessToken: string
): Promise<InstagramAccount | null> {
  const url = new URL(`${GRAPH_API_BASE}/${pageId}`);
  url.searchParams.set("fields", "instagram_business_account{id,name,username}");
  url.searchParams.set("access_token", pageAccessToken);

  const response = await fetch(url.toString());
  if (!response.ok) return null;
  const data = await response.json();
  return data.instagram_business_account || null;
}

/**
 * Publish a post to a Facebook Page
 */
export async function publishToFacebook(
  pageId: string,
  pageAccessToken: string,
  message: string,
  imageUrl?: string
): Promise<{ id: string }> {
  const endpoint = imageUrl
    ? `${GRAPH_API_BASE}/${pageId}/photos`
    : `${GRAPH_API_BASE}/${pageId}/feed`;

  const body: Record<string, string> = {
    access_token: pageAccessToken,
  };

  if (imageUrl) {
    body.url = imageUrl;
    body.caption = message;
  } else {
    body.message = message;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Facebook publish failed: ${JSON.stringify(error)}`);
  }
  return response.json();
}

/**
 * Publish a post to Instagram Business Account
 * Two-step process: 1) Create media container 2) Publish container
 */
export async function publishToInstagram(
  instagramAccountId: string,
  accessToken: string,
  caption: string,
  imageUrl: string
): Promise<{ id: string }> {
  // Step 1: Create media container
  const containerUrl = `${GRAPH_API_BASE}/${instagramAccountId}/media`;
  const containerResponse = await fetch(containerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: imageUrl,
      caption,
      access_token: accessToken,
    }),
  });

  if (!containerResponse.ok) {
    const error = await containerResponse.json().catch(() => ({}));
    throw new Error(`Instagram container creation failed: ${JSON.stringify(error)}`);
  }

  const container = await containerResponse.json();

  // Step 2: Publish the container
  const publishUrl = `${GRAPH_API_BASE}/${instagramAccountId}/media_publish`;
  const publishResponse = await fetch(publishUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      creation_id: container.id,
      access_token: accessToken,
    }),
  });

  if (!publishResponse.ok) {
    const error = await publishResponse.json().catch(() => ({}));
    throw new Error(`Instagram publish failed: ${JSON.stringify(error)}`);
  }

  return publishResponse.json();
}

/**
 * Get post insights from Facebook
 */
export async function getFacebookPostInsights(
  postId: string,
  pageAccessToken: string
): Promise<Record<string, number>> {
  const url = new URL(`${GRAPH_API_BASE}/${postId}/insights`);
  url.searchParams.set("metric", "post_impressions,post_engaged_users,post_clicks,post_reactions_like_total");
  url.searchParams.set("access_token", pageAccessToken);

  const response = await fetch(url.toString());
  if (!response.ok) return {};

  const data = await response.json();
  const metrics: Record<string, number> = {};
  for (const item of data.data || []) {
    metrics[item.name] = item.values?.[0]?.value ?? 0;
  }
  return metrics;
}
