# Alibaba API Permission Map

Use this file to map your Alibaba Open Platform permissions into business value.
When you receive an API permission list, paste the method names here and classify
them before building features.

## Permission Categories

### Authentication

Business value:

- Get authorized access to the store.
- Refresh token safely.
- Identify which seller account is connected.

Needed for all other modules.

### Product Publishing And Product Management

Example method already identified:

- `alibaba.icbu.product.schema.render.draft`

Business value:

- Render category-specific product draft fields.
- Identify required product attributes.
- Validate listing completeness.
- Generate product templates.
- Prepare product drafts before publishing.

Use cases:

- Product quality diagnosis
- Bulk product field checklist
- AI title and keyword draft
- AI product description draft
- Human-approved product publish or edit

Risk:

- Read/schema APIs are low risk.
- Publish/edit/delete APIs are high risk and require approval.

### Product Data And Metrics

Business value:

- Read product list and product details.
- Connect product content to performance data.
- Detect products with poor exposure, click, inquiry, or conversion.

Use cases:

- Product health score
- Low-performing product repair list
- Hot product discovery
- Duplicate or incomplete listing detection

### Store Analytics

Business value:

- Understand exposure, visitors, clicks, inquiries, and conversion.
- Build daily and weekly operating reports.

Use cases:

- Store funnel dashboard
- Traffic source diagnosis
- Country and buyer trend analysis
- Daily anomaly detection

### Inquiry And Communication

Business value:

- Import buyer inquiries.
- Detect unreplied or delayed inquiries.
- Draft high-quality replies.
- Prioritize buyers with high intent.

Use cases:

- Inquiry reply assistant
- Follow-up reminders
- Buyer profile summary
- Sales conversion diagnosis

Risk:

- Reading inquiries is medium risk.
- Sending messages is high risk and requires approval.

### Advertising

Business value:

- Analyze spend, clicks, inquiries, and ROI.
- Find wasted keywords or campaigns.
- Recommend budget and bid changes.

Use cases:

- High-spend low-return alert
- Keyword cleanup
- Campaign optimization plan
- Product-ad matching diagnosis

Risk:

- Read reports first.
- Budget, bid, pause, or launch actions require approval.

### Orders And Trade

Business value:

- Analyze confirmed orders.
- Understand products, buyers, countries, and repeat customers.
- Monitor fulfillment and transaction risk.

Use cases:

- Order summary
- Buyer value ranking
- Country opportunity analysis
- Repeat purchase follow-up

Risk:

- Read order data carefully.
- Any trade operation requires explicit approval.

## Capability Levels

### Level 1: Read And Diagnose

Allowed:

- Read API data.
- Store snapshots.
- Generate reports.
- Generate recommendations.

This is the safest first production stage.

### Level 2: Draft And Approve

Allowed:

- Generate product drafts.
- Generate reply drafts.
- Generate ad changes.
- Create approval tasks.

The user approves before execution.

### Level 3: Controlled Execution

Allowed:

- Execute approved product edits.
- Send approved replies.
- Apply approved ad changes.

Requirements:

- Approval record
- Execution log
- Error handling
- Rollback note when possible

## What To Send Next

To design the exact implementation, provide the API permission names only. Do not
send secrets or tokens.

Safe format:

```text
alibaba.icbu.product.schema.render.draft
api.method.name.two
api.method.name.three
```

Do not send:

- App Secret
- Access Token
- Refresh Token
- GitHub Token
- Store password

