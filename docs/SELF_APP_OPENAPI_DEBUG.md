# SELF_APP OpenAPI Debug

Your Alibaba app is a `SELF_APP` under `B2B国际站企业对接`.

For this app type, the browser OAuth endpoint
`https://oauth.alibaba.com/authorize` may reject the App Key with:

```text
param-appkey.not.exists
appkey不存在
```

That means the app likely belongs to the newer Alibaba.com OpenAPI / enterprise
integration flow, not the older third-party OAuth authorization flow.

## New Debug Endpoints

Check server-side configuration:

```text
https://api.viecart.com/api/alibaba/openapi/debug
```

Preview token request payload without sending secrets to Alibaba:

```text
https://api.viecart.com/api/alibaba/openapi/token/create?dryRun=1
```

Send a token request from the server:

```text
https://api.viecart.com/api/alibaba/openapi/token/create
```

Try form encoding if JSON is rejected:

```text
https://api.viecart.com/api/alibaba/openapi/token/create?format=form
```

## Vercel Variables

Required:

```env
ALIBABA_APP_KEY=your_app_key
ALIBABA_APP_SECRET=your_app_secret
ALIBABA_TOKEN_URL=https://openapi.alibaba.com/auth/token/create
ALIBABA_TOKEN_REQUEST_FORMAT=json
ALIBABA_OPENAPI_GATEWAY_URL=https://openapi.alibaba.com
```

Do not store real secrets in GitHub.

## What We Need From Alibaba Docs

To finish the production integration, confirm these from the official docs:

- Whether `SELF_APP` needs `code`, or can create a token directly.
- Exact `/auth/token/create` request body.
- Whether the token request must be JSON or form encoded.
- Whether OpenAPI calls require HMAC/RSA signing in addition to token.
- Exact gateway URL for business methods.

