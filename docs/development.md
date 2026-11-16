# 本地开发与 MVP API

## 启动

1. 复制 `.env.example` 为 `.env`，设置随机 `JWT_SECRET`（至少 32 字符）和一次性 `BOOTSTRAP_KEY`。
2. 启动 PostgreSQL：`docker compose up -d postgres`。
3. 安装依赖：`corepack enable && pnpm install`。
4. 启动 API：`pnpm dev:api`。
5. 启动前端：`pnpm dev:web`。
6. 初始化第一个组织：
   - POST `/api/auth/bootstrap`
   - Header: `x-bootstrap-key: <BOOTSTRAP_KEY>`
   - Body: `{ "organizationName": "Demo Org", "slug": "demo-org", "email": "admin@example.com", "password": "12345678abcd", "fullName": "System Admin" }`
7. 登录 Web 管理端，默认 API 地址为 `http://localhost:3000/api`。

> 本仓库提交的是 MVP 基础实现，不是生产就绪的航空安全系统。上线前还需补齐附件私有存储、备份恢复、审计防篡改策略、限流、监控和完整自动化测试。不要接入飞控或用于自动决定是否能飞行。

## API

除健康检查、登录和一次性 bootstrap 外，接口需要 `Authorization: Bearer <JWT>`。

- `GET /api/health`
- `POST /api/auth/bootstrap`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET|POST /api/missions`
- `GET|PATCH /api/missions/:id`
- `POST /api/missions/:id/status`
- `GET|POST /api/assets`
- `GET|PATCH /api/assets/:id`
- `POST /api/assets/:id/maintenance`
- `GET|POST /api/incidents`
- `GET|PATCH /api/incidents/:id`
- `GET /api/audit-logs`

## 质量检查

运行：
- `pnpm build:api`
- `pnpm build:web`
- `pnpm lint`

这是 MVP 基础工程，不包括最终生产级安全测试；后续需要补齐权限/跨租户负向测试、数据库集成测试和端到端演示测试。
