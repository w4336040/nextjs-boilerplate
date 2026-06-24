# Direct TOP Product Schema Debug

The ICBU product schema APIs use TOP Router.

Official docs for `alibaba.icbu.product.schema.render.draft` show:

```text
HTTPS gateway: https://eco.taobao.com/router/rest
method: alibaba.icbu.product.schema.render.draft
sign_method: hmac or md5
session: required when the API is marked "需要授权"
business parameter: param_product_top_publish_request
```

## New Endpoint

Dry run:

```text
https://api.viecart.com/api/alibaba/openapi/product/schema/direct?dryRun=1
```

Real call without session:

```text
https://api.viecart.com/api/alibaba/openapi/product/schema/direct
```

If Alibaba returns a session/auth error, then the SELF_APP still needs a TOP
session/access token even though no browser authorization entry appears in the
app console.

## Vercel Variables

```env
ALIBABA_OPENAPI_GATEWAY_URL=https://eco.taobao.com/router/rest
ALIBABA_TOP_SIGN_METHOD=hmac
ALIBABA_TOP_SESSION=
```

Leave `ALIBABA_TOP_SESSION` empty until a valid session/token is confirmed.

