# OAuth And Token Management

This project uses a safe-by-default OAuth flow for Alibaba Open Platform.

## What This Module Does

- Builds the Alibaba authorization URL from `.env`.
- Opens a browser for seller authorization.
- Listens on the local callback URL.
- Validates OAuth `state`.
- Exchanges authorization `code` for a token response.
- Stores the local token response in `tokens/alibaba_token.json`.
- Redacts secrets when showing status.
- Refreshes tokens when `refresh_token` is available.
- Provides a command to print a current `access_token` for API calls.

## Local Files

Ignored secret files:

```text
.env
tokens/
```

Committed template files:

```text
.env.example
tools/auth_manager.py
tools/oauth_token.py
```

## Commands

Use the bundled Python runtime on this Windows machine:

```powershell
$Py = "C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
```

Login:

```powershell
& $Py tools\auth_manager.py login
```

Check token status:

```powershell
& $Py tools\auth_manager.py status
```

Refresh token:

```powershell
& $Py tools\auth_manager.py refresh
```

Print a usable access token for the next API call:

```powershell
& $Py tools\auth_manager.py access-token
```

Delete local token:

```powershell
& $Py tools\auth_manager.py logout
```

## Required Environment Variables

```env
ALIBABA_APP_KEY=your_app_key_here
ALIBABA_APP_SECRET=your_new_app_secret_here
ALIBABA_REDIRECT_URI=http://127.0.0.1:8765/callback
ALIBABA_AUTH_URL=official_alibaba_authorize_url
ALIBABA_TOKEN_URL=official_alibaba_token_url
ALIBABA_SCOPE=
ALIBABA_STATE=local-dev
```

## Provider Parameter Overrides

If Alibaba's official OAuth docs use different parameter names, configure them
without changing code:

```env
ALIBABA_AUTH_CLIENT_ID_PARAM=client_id
ALIBABA_AUTH_REDIRECT_URI_PARAM=redirect_uri
ALIBABA_AUTH_RESPONSE_TYPE_PARAM=response_type
ALIBABA_AUTH_STATE_PARAM=state
ALIBABA_AUTH_SCOPE_PARAM=scope

ALIBABA_TOKEN_GRANT_TYPE_PARAM=grant_type
ALIBABA_TOKEN_CLIENT_ID_PARAM=client_id
ALIBABA_TOKEN_CLIENT_SECRET_PARAM=client_secret
ALIBABA_TOKEN_REDIRECT_URI_PARAM=redirect_uri
ALIBABA_TOKEN_CODE_PARAM=code
ALIBABA_TOKEN_REFRESH_TOKEN_PARAM=refresh_token
```

## Production Rules

For production deployment:

- Store `APP_SECRET` in Vercel Environment Variables or a secret manager.
- Store tokens in a database with encryption at rest.
- Never print full tokens in logs.
- Rotate leaked secrets immediately.
- Refresh tokens through a scheduled job.
- Keep a token audit log with timestamps and result status.

