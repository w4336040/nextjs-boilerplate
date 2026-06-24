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

Optional parameters:

```text
start_date=2026-06-18
end_date=2026-06-24
page=1
page_size=20
gateway=gw
gateway=eco
gateway=api
product_id=1601815992580
campaign_id=your_campaign_id
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

- The app has not opened SCBP ad report permission.
- The authorized Alibaba account has no SCBP data.
- The TOP gateway does not recognize the app key.
- The parameter names need to be adjusted to the exact SCBP API schema.

Try:

```text
gateway=gw
gateway=eco
gateway=api
```

Then paste the JSON response here for debugging.
