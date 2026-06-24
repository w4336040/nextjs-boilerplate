# Seller Authorization Introduction

Official doc:

```text
https://open.alibaba.com/doc/doc.htm#/?docId=72
```

Key points:

1. Seller private data such as products and orders requires seller
   authorization.
2. Alibaba.com International Station uses OAuth 2.0.
3. The current supported flow is `code -> access_token`.
4. The callback URL must be publicly accessible.

## Authorization URL

Use:

```text
https://open-api.alibaba.com/oauth/authorize?response_type=code&force_auth=true&redirect_uri=${callback}&client_id=${appkey}
```

For this project:

```text
https://open-api.alibaba.com/oauth/authorize?response_type=code&force_auth=true&redirect_uri=https%3A%2F%2Fapi.viecart.com%2Fapi%2Falibaba%2Foauth%2Fcallback&client_id=509776
```

## Token Exchange

API:

```text
/auth/token/create
```

SDK style:

```text
url = "https://open-api.alibaba.com/rest/auth/token/create?"
apiName = "/auth/token/create"
signMethod = "sha256"
```

HTTP calls should include:

```text
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
Accept-Encoding: gzip
```

## Vercel Variables

Use:

```env
ALIBABA_AUTH_URL=https://open-api.alibaba.com/oauth/authorize?force_auth=true
ALIBABA_REDIRECT_URI=https://api.viecart.com/api/alibaba/oauth/callback
ALIBABA_TOKEN_REQUEST_FORMAT=iop
ALIBABA_IOP_GATEWAY_URL=https://open-api.alibaba.com/rest
ALIBABA_IOP_SIGN_METHOD=sha256
```

