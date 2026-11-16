# 低空产业协同平台

> 面向低空作业管理场景的任务协同、设备管理、异常处理和审计平台。当前包含工程骨架与 MVP 基础能力，适合在单一行业场景中试点验证。

## 当前状态

本仓库已包含：
- 前端管理端初始页面
- NestJS API 基础结构
- PostgreSQL 初始化迁移脚本
- 登录与 JWT 认证骨架
- 任务 / 设备 / 异常 / 审计的基础资源服务

## 文档

- `docs/product-blueprint.md`
- `docs/architecture.md`
- `docs/roadmap.md`
- `docs/development.md`

## 本地启动

1. 复制 `.env.example` 为 `.env`
2. 运行 `docker compose up -d postgres`
3. 运行 `pnpm install`
4. 启动 API: `pnpm dev:api`
5. 启动 Web: `pnpm dev:web`
6. 通过 `/api/auth/bootstrap` 创建第一个组织和管理员

## 说明

当前版本是低空作业协同平台的 MVP 起点，不具备飞行器控制能力和自动合规判定能力。所有任务、设备和异常逻辑以组织隔离和审计为前提，适合试点客户评估和迭代。
