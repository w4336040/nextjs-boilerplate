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
- Original-platform migration APIs such as
  `alibaba.icbu.product.schema.get` call
  `https://open-api.alibaba.com/sync?method={api_path}&{query}` and include
  `method` as a normal sorted request parameter in the signature base string.
- The product APIs use `session` for the seller access token in the common
  parameters.
- `simplify=true` should be sent to avoid response parsing issues noted in the
  official request-parameter doc.
