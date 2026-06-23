# Alibaba.com Open Platform local setup

This workspace is a safe local template for getting an Alibaba.com Open Platform
`access_token` and then calling APIs from scripts.

## 1. Rotate the leaked secret first

The App Secret was shared in chat, so treat it as leaked:

1. Open Alibaba Open Platform.
2. Go to your app.
3. Reset the App Secret.
4. Do not paste the new secret into chat.

## 2. Configure the app callback URL

In the Alibaba Open Platform app settings, set the OAuth callback / redirect URL
to:

```text
http://127.0.0.1:8765/callback
```

If Alibaba requires an HTTPS production URL, use your own server callback later.
For local development, this localhost callback is the simplest path if allowed.

## 3. Create local environment file

Copy `.env.example` to `.env`, then fill in your values:

```powershell
Copy-Item .env.example .env
notepad .env
```

The two URLs must come from the official Alibaba Open Platform authorization
documentation for your app/API family:

- `ALIBABA_AUTH_URL`: the authorization page URL
- `ALIBABA_TOKEN_URL`: the endpoint that exchanges `code` for `access_token`

## 4. Get an access token

Run:

```powershell
python tools\oauth_token.py
```

The script will:

1. Build an authorization URL.
2. Open the browser.
3. Wait for Alibaba to redirect to the local callback.
4. Capture the `code`.
5. Exchange the `code` for a token.
6. Save the raw response to `tokens\alibaba_token.json`.

## 5. Next step

After `tokens\alibaba_token.json` exists, use it to call:

```text
alibaba.icbu.product.schema.render.draft
```

That API is mainly for rendering product draft schema rules, so it is useful for
product publishing, product validation, and category-specific listing templates.

