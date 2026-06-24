# Product Schema Get Integration

Official docs studied:

- `docId=211`: 商品发布接入文档
- `docId=305`: 海外货商品发布接入文档
- `docId=304`: 商品 XML 校验

## First Business API

```text
alibaba.icbu.product.schema.get
```

Purpose:

- Get category-specific product publishing XML schema.
- Parse field rules before generating or publishing product data.
- Build a dynamic mapping layer instead of hardcoding product fields.

## Endpoint Added

Dry run:

```text
https://api.viecart.com/api/alibaba/product/schema/get?dryRun=1&cat_id=333&language=en_US&publish_type=default
```

Real call:

```text
https://api.viecart.com/api/alibaba/product/schema/get?cat_id=333&language=en_US&publish_type=default
```

Overseas stock:

```text
https://api.viecart.com/api/alibaba/product/schema/get?cat_id=333&language=en_US&publish_type=overseastock
```

## Parameters

`param_product_top_publish_request`:

```json
{
  "cat_id": 333,
  "language": "en_US",
  "publish_type": "default",
  "version": "trade.1.1"
}
```

Optional:

```json
{
  "productId": 1
}
```

## Safety

This endpoint is read-only. It does not publish or edit products.

