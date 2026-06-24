# TOP Router Token Flow

The direct endpoint below returned `404` for this app:

```text
https://openapi.alibaba.com/auth/token/create
```

Alibaba.com Open API documentation also describes an older TOP Router flow for
access token creation:

```text
https://api.taobao.com/router/rest
method=taobao.top.auth.token.create
```

This flow requires:

- `app_key`
- `app_secret`
- authorization `code`
- `timestamp`
- `format=json`
- `v=2.0`
- `sign_method=md5`
- `sign`

The signature is:

```text
MD5(APP_SECRET + sorted_parameter_names_and_values + APP_SECRET)
```

## Vercel Variables

This was an intermediate test path. The seller authorization document now shows
that ICBU should use the IOP/GOP flow:

```text
Authorization URL: https://open-api.alibaba.com/oauth/authorize
Token URL: https://open-api.alibaba.com/rest/auth/token/create
```

Do not use TOP Router for this SELF_APP unless Alibaba support specifically
instructs you to.

Historical test values:

```env
ALIBABA_TOKEN_URL=https://api.taobao.com/router/rest
ALIBABA_TOKEN_REQUEST_FORMAT=top
```

## Test

Dry run:

```text
https://api.viecart.com/api/alibaba/openapi/token/create?dryRun=1
```

Real token request after you have a callback `code`:

```text
https://api.viecart.com/api/alibaba/openapi/token/create?code=AUTHORIZATION_CODE
```
