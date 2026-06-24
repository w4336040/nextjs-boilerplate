# IOP/GOP Token Create

The official `/auth/token/create` API page shows:

```text
IopClient client = new IopClient(url, appkey, appSecret);
IopRequest request = new IopRequest();
request.setApiName("/auth/token/create");
request.addApiParameter("code", "0_100132_...");
IopResponse response = client.execute(request, Protocol.GOP);
```

Common parameters:

- `app_key`
- `timestamp`, milliseconds
- `sign_method`, usually `sha256`
- `sign`
- `access_token`, optional

Business parameters:

- `code`, required
- `uuid`, optional and currently invalid according to the docs

The current debug implementation uses:

```text
ALIBABA_IOP_GATEWAY_URL=https://openapi-api.alibaba.com/rest
ALIBABA_IOP_SIGN_METHOD=sha256
```

Dry run:

```text
https://api.viecart.com/api/alibaba/iop/token/create?dryRun=1
```

Real request when a code is available:

```text
https://api.viecart.com/api/alibaba/iop/token/create?code=YOUR_CODE
```

