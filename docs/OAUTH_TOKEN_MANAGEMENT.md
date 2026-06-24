# OAuth And Token Management

This project supports a safe-by-default Alibaba OAuth flow.

## What This Module Does

- Builds the Alibaba authorization URL from `.env`.
- Opens a browser for seller authorization.
- Validates OAuth `state`.
- Exchanges authorization `code` for a token response.
- Stores the token response in a server-side encrypted token store when configured.
- Falls back to an encrypted HttpOnly cookie for local browser-only use.
- Redacts secrets when showing status.
- Refreshes tokens when `refresh_token` is available.

## Production Flow

1. Seller authorizes once in the browser.
2. OAuth callback receives the token response.
3. The callback encrypts and writes the token to server-side storage.
4. APIs read token from server storage first, then cookie as fallback.
5. Refresh jobs can update the stored token later.

## Recommended Storage

- Vercel KV
- Upstash Redis

## Environment Variables

```env
ALIBABA_TOKEN_STORE_KEY=alibaba:default
ALIBABA_TOKEN_STORE_SECRET=your_random_secret
UPSTASH_REDIS_REST_URL=https://your-upstash-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_rest_token
```

## Manual Sync

If the browser already has a valid token cookie, you can push it to server storage:

```http
POST /api/alibaba/token/sync
```

## Production Rules

- Store tokens server-side and encrypt before write.
- Never print full tokens in logs.
- Rotate leaked secrets immediately.
- Refresh tokens through a scheduled job.
- Keep a token audit log with timestamps and result status.
