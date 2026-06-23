# Implementation Roadmap

This roadmap turns the Alibaba.com smart operations goal into buildable tasks.

## Stack Recommendation

Frontend and API:

- Next.js
- TypeScript
- Tailwind or the existing project styling

Database:

- PostgreSQL for production
- SQLite can be used for early local tests

Auth and secrets:

- Alibaba OAuth
- Vercel Environment Variables for production
- `.env` for local development only

AI:

- Use an AI service for diagnosis, drafting, and prioritization.
- Store AI outputs as recommendations, not final actions.

Jobs:

- Daily scheduled sync
- Manual sync button
- Retry queue for failed API calls

## Build Order

### Step 1: Protect Secrets

Tasks:

- Keep `.env` ignored.
- Keep token files ignored.
- Store production secrets in Vercel.
- Rotate leaked credentials.

Done when:

- No secrets are present in GitHub.
- Local `.env.example` documents required variables.

### Step 2: Alibaba OAuth

Tasks:

- Confirm official authorization URL.
- Confirm official token exchange URL.
- Complete browser authorization.
- Save token response locally.
- Add refresh token logic when the docs confirm the refresh endpoint.

Done when:

- A valid access token exists locally.
- Token refresh can be tested.

### Step 3: API Client

Tasks:

- Create a typed Alibaba client.
- Implement request signing according to the official docs.
- Add timeout and retry.
- Save request and response metadata.

Done when:

- One read-only API call succeeds.
- Errors are readable.

### Step 4: Product Schema Test

Tasks:

- Call `alibaba.icbu.product.schema.render.draft`.
- Save raw response.
- Parse required fields.
- Generate a human-readable checklist.

Done when:

- A category-specific product checklist is generated.

### Step 5: Product Import

Tasks:

- Import product list.
- Import product details.
- Store data.
- Score product completeness.

Done when:

- The system can show which products need repair.

### Step 6: Daily Store Report

Tasks:

- Import traffic, inquiry, ad, and order data as permissions allow.
- Generate daily report.
- Highlight anomalies and priorities.

Done when:

- The system can answer: what should I do today?

### Step 7: AI Recommendation Center

Tasks:

- Generate product optimization recommendations.
- Generate inquiry reply drafts.
- Generate ad optimization recommendations.
- Assign priority and risk level.

Done when:

- The dashboard shows actionable recommendations.

### Step 8: Approval And Execution

Tasks:

- Add approval queue.
- Add change preview.
- Add execution logs.
- Call write APIs only after approval.

Done when:

- Store-changing actions are traceable and user-approved.

## Minimum Viable Product

The MVP should include:

- OAuth setup
- API client
- Product schema render
- Product checklist generation
- Daily manual sync
- AI product optimization draft
- Approval queue placeholder

Do not start with:

- Fully automated product publishing
- Fully automated buyer replies
- Fully automated ad budget changes

Those are valuable later, but risky before the system has data quality,
approval, and audit logs.

