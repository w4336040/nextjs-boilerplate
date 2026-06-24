# Alibaba Official Docs Studied

Source pages:

- docId 72: seller authorization
- docId 67: authorization configuration
- docId 133: request parameters
- docId 132: API call steps
- docId 134: HTTP request examples
- docId 135: signature algorithm

Key implementation rule:

- New-platform registered APIs such as `/auth/token/create` call
  `https://open-api.alibaba.com/rest{api_path}` and prepend the API name to the
  signature base string.
- Original-platform migration APIs call
  `https://open-api.alibaba.com/sync?method={api_path}&{query}` and include
  `method` as a normal sorted request parameter in the signature base string.
- `alibaba.icbu.product.schema.get` requires `access_token` and a business
  object parameter named `param_product_top_publish_request`.
- `simplify=true` should be sent to avoid response parsing issues noted in the
  official request-parameter doc.
