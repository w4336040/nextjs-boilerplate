# Alibaba.com International Station Smart Operations

This project is for building an Alibaba.com International Station smart
operations assistant.

目标不是只调通一个 API，而是逐步建设一个成熟系统：

- 安全接入 Alibaba Open Platform
- 获取并刷新店铺授权 token
- 拉取商品、询盘、广告、订单和经营数据
- 建立店铺经营数据仓库
- 用 AI 做商品优化、询盘跟进、广告诊断和每日经营建议
- 对所有写操作加入人工审批，避免误操作店铺

## Current Stage

当前仓库已经包含：

- OAuth 本地接入模板
- 安全的 `.env.example`
- 本地 token 获取脚本
- GitHub 同步脚本
- 智能运营系统方案文档

核心文档：

- [Smart Operations Plan](docs/SMART_OPERATIONS_PLAN.md)
- [API Permission Map](docs/API_PERMISSION_MAP.md)
- [Implementation Roadmap](docs/IMPLEMENTATION_ROADMAP.md)

## Security First

Do not commit secrets.

Never put these values into GitHub:

- App Secret
- Access Token
- Refresh Token
- GitHub Token
- Store password

The previous App Secret and GitHub token should be treated as leaked and rotated.

## Local Setup

Copy `.env.example` to `.env`, then fill in your own values:

```powershell
Copy-Item .env.example .env
notepad .env
```

Required values:

```env
ALIBABA_APP_KEY=your_app_key_here
ALIBABA_APP_SECRET=your_new_app_secret_here
ALIBABA_REDIRECT_URI=http://127.0.0.1:8765/callback
ALIBABA_AUTH_URL=official_alibaba_authorize_url
ALIBABA_TOKEN_URL=official_alibaba_token_url
ALIBABA_SCOPE=
ALIBABA_STATE=local-dev
```

Run OAuth locally:

```powershell
C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe tools\oauth_token.py
```

The token response will be saved locally to:

```text
tokens/alibaba_token.json
```

This file is ignored by Git.

## First API Milestone

The first business API to test is:

```text
alibaba.icbu.product.schema.render.draft
```

This API helps render product draft schema rules. It is useful for:

- Product category field checklist
- Required attribute detection
- Product draft validation
- AI-assisted product publishing preparation

## Next Input Needed

Provide only the Alibaba API permission names that your app has opened.

Safe example:

```text
alibaba.icbu.product.schema.render.draft
api.method.name.two
api.method.name.three
```

Do not send secrets or tokens.

