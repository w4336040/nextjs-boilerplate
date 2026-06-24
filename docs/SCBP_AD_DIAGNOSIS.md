# SCBP Ad Product Report Diagnosis

This module connects the Alibaba.com SCBP product advertising report and turns
raw report rows into read-only diagnosis.

## API Endpoints

### 1. Dry Run

Use this first to confirm request signing and parameters. It does not call the
Alibaba report API with real data.

```text
https://api.viecart.com/api/alibaba/ad/product-report?dryRun=1&days=7
```

### 2. Product Report

Use this to call the SCBP product report API.

```text
https://api.viecart.com/api/alibaba/ad/product-report?days=7&page_size=20
```

For a single product, pass the product ID:

```text
https://api.viecart.com/api/alibaba/ad/product-report?product_id=1601815992580&days=7&page_size=20
```

Default protocol:

```text
protocol=sync
```

This uses the current Alibaba.com International Station open-platform flow:

```text
https://open-api.alibaba.com/sync
```

TOP mode is kept only for comparison:

```text
protocol=top&gateway=eco
protocol=top&gateway=api
protocol=top&gateway=gw
```

If TOP mode returns `Invalid app Key`, it means the Taobao TOP gateway does not
recognize the current ICBU app key. Use `protocol=sync` first.

Optional parameters:

```text
product_line_id=110101
start_date=2026-06-18
end_date=2026-06-24
page=1
page_size=10
gateway=gw
gateway=eco
gateway=api
product_id=1601815992580
campaign_id=your_campaign_id
```

The SCBP product report API requires `top_context.product_line_id`. The default
is `110101`, and it can be overridden with:

```text
product_line_id=your_product_line_id
```

Report operation fields are sent with the SCBP API names:

```text
date_begin
date_end
date_range
page_index
page_size
get_detail_data
order_field=ctr
order_type=asc
key
campaign_id
campaign_type
```

### 3. Diagnosis

Use this after the report API works.

```text
https://api.viecart.com/api/alibaba/ad/product-diagnosis?days=7&page_size=20
```

The diagnosis calculates:

- CTR
- CPC
- Inquiry conversion rate
- Cost per inquiry
- Waste-spend warning
- Low-CTR content warning
- Scale candidate warning

## Diagnosis Rules

The first rule set is intentionally conservative:

- High impressions + low CTR: title, keyword, or first image mismatch.
- Clicks + no inquiries: price, MOQ, detail page, or product-market mismatch.
- Spend + no inquiries: reduce bid or pause after checking search terms.
- Good CTR + inquiries: keep budget and test a small bid increase.

This module is read-only. It does not change budget, bid, campaign, product, or
keyword settings.

## If Alibaba Returns An Error

Common causes:

- Missing `product_line_id` in `top_context`.
- The app has not opened SCBP ad report permission.
- The authorized Alibaba account has no SCBP data.
- The TOP gateway does not recognize the app key.
- The parameter names need to be adjusted to the exact SCBP API schema.

Try:

```text
gateway=gw
gateway=eco
gateway=api
protocol=sync
protocol=top
```

Then paste the JSON response here for debugging.
