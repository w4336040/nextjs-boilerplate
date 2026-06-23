# Alibaba.com Smart Store Operations Plan

## Goal

Build a mature Alibaba.com International Station operations system that connects
Alibaba Open Platform APIs, stores business data safely, analyzes store health,
and produces AI-assisted actions for products, inquiries, ads, and orders.

The first version should be decision-support first. It can generate drafts,
diagnostics, alerts, and recommendations. Direct write operations, such as
publishing products, editing prices, changing ads, or replying to buyers, should
require human approval.

## Core Principles

1. Keep credentials out of GitHub.
2. Start with read-only APIs before write APIs.
3. Store raw API responses for audit, then normalize into business tables.
4. Use AI to recommend and draft, not blindly execute.
5. Add approval gates before every store-changing action.
6. Track every API call, generated suggestion, and approved action.

## System Modules

### 1. Authentication And Token Management

Purpose:

- Complete OAuth authorization.
- Store `access_token` and `refresh_token` securely.
- Refresh tokens before expiration.
- Provide a reusable API client for Alibaba calls.

Local development:

- `.env` stores app configuration.
- `tokens/alibaba_token.json` stores temporary local token data.
- Neither file should be committed.

Production:

- Use Vercel Environment Variables, database encryption, or a secret manager.
- Never place secrets in source code.

### 2. Alibaba API Client

Purpose:

- Centralize API request signing.
- Add retry, timeout, rate limit, and logging.
- Normalize errors into readable messages.
- Keep all API method names in one registry.

Suggested first methods:

- Product schema rendering:
  `alibaba.icbu.product.schema.render.draft`
- Product list/detail APIs, depending on your authorized permissions.
- Inquiry/communication APIs, if authorized.
- Analytics/report APIs, if authorized.
- Advertising APIs, if authorized.
- Order/trade APIs, if authorized.

### 3. Data Warehouse

Purpose:

- Save daily store snapshots.
- Compare trends over time.
- Avoid repeatedly calling APIs for historical analysis.

Minimum tables:

- `api_credentials`
- `api_call_logs`
- `products`
- `product_daily_metrics`
- `inquiries`
- `buyers`
- `orders`
- `ad_campaigns`
- `ad_daily_metrics`
- `ai_recommendations`
- `approval_tasks`

### 4. Operations Dashboard

Purpose:

- Give a daily operating command center.

First screens:

- Store overview
- Product health
- Inquiry follow-up
- Ad performance
- Order and buyer summary
- AI recommendations
- Pending approvals

### 5. AI Operations Engine

Purpose:

- Convert data into specific business actions.

Initial AI jobs:

- Daily store diagnosis
- Product title and keyword optimization
- Product missing-field detection
- Low-exposure product diagnosis
- High-click low-inquiry product diagnosis
- Inquiry reply drafting
- Buyer follow-up prioritization
- Ad waste detection
- Weekly growth plan

### 6. Approval Workflow

Purpose:

- Prevent accidental damage to the store.

Every write operation should create an approval task first:

- Product publish
- Product edit
- Price or MOQ change
- Ad budget or bid change
- Buyer reply send
- Order-related operation

Approval task fields:

- Object type
- Object ID
- Proposed change
- Business reason
- Risk level
- Created by AI or user
- Approved by user
- Execution result

## Recommended Development Phases

### Phase 1: Safe Foundation

Outcome:

- OAuth works.
- Token can be saved locally.
- API client can call one Alibaba method.
- API responses are logged.

Build:

- OAuth setup
- Environment configuration
- API client
- API call log
- Product schema render test

### Phase 2: Product Intelligence

Outcome:

- The system can diagnose product listing quality.

Build:

- Product list import
- Product detail import
- Category schema import
- Missing required fields report
- Title and keyword optimization drafts
- Product quality scoring

### Phase 3: Store Operations Dashboard

Outcome:

- Daily business status is visible.

Build:

- Store overview
- Product funnel
- Inquiry summary
- Buyer country distribution
- Daily report generator

### Phase 4: Inquiry And Buyer Assistant

Outcome:

- The system helps convert buyers faster.

Build:

- Inquiry import
- Buyer profile summary
- Reply drafting
- Follow-up reminders
- Hot buyer scoring

### Phase 5: Advertising And Growth

Outcome:

- The system identifies wasted spend and growth opportunities.

Build:

- Ad spend import
- Keyword performance analysis
- Product-ad matching
- Budget suggestions
- Negative keyword or pause suggestions

### Phase 6: Controlled Automation

Outcome:

- The system can execute approved changes.

Build:

- Approval queue
- Write API integration
- Execution logs
- Rollback notes
- Human confirmation UI

## First Practical Milestone

The next concrete milestone is:

1. Confirm your Alibaba API permission list.
2. Complete OAuth and token refresh.
3. Call `alibaba.icbu.product.schema.render.draft`.
4. Save the response.
5. Generate a product-publishing field checklist from the schema.

This proves the full path:

```text
GitHub code -> local config -> Alibaba OAuth -> Alibaba API -> stored response -> AI analysis
```

After this milestone, the project can expand safely into real store operations.

