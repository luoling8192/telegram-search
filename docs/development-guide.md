# 开发指南

## 开发环境

### 环境要求

- Node.js >= 20
- PostgreSQL >= 15（需要 pgvector 扩展）
- pnpm 包管理器

### 环境设置

1. 克隆仓库：

```bash
git clone https://github.com/luoling8192/telegram-search.git
cd telegram-search
```

2. 安装依赖：

```bash
pnpm install
```

3. 配置环境变量：

```bash
cp .env.example .env
# 编辑 .env 文件，填入配置信息
```

4. 初始化数据库：

```bash
pnpm -F @tg-search/cli db:migrate
```

### 开发工作流

1. 启动开发服务器：

```bash
pnpm dev
```

2. 运行测试：

```bash
pnpm test
```

3. 构建项目：

```bash
pnpm build
```

## 模块说明

### CLI 模块 (@tg-search/cli)

- 提供命令行界面
- 处理用户输入
- 执行数据同步和搜索操作

### 核心模块 (@tg-search/core)

- 实现核心业务逻辑
- 管理 Telegram 连接
- 处理消息同步和搜索

### 数据库模块 (@tg-search/db)

- 定义数据模型
- 管理数据库连接
- 处理数据迁移

### 公共模块 (@tg-search/common)

- 共享类型定义
- 工具函数
- 常量定义

## 调试指南

### 日志级别

```typescript
// 设置日志级别
setLogLevel('debug')
```

### 开发工具

- VS Code 配置已包含在 `.vscode/`
- 推荐使用 TypeScript 插件
- 调试配置已预设

### 常见问题

1. 数据库连接：

```bash
# 检查数据库状态
pnpm run dev:cli db:status
```

2. Telegram API：

```bash
# 测试 API 连接
pnpm run dev:cli test:api
```

3. 修改导出(export)之后，重新运行 stub

```bash
pnpm run stub
```

## 发布流程

1. 版本更新：

```bash
pnpm version <major|minor|patch>
```

2. 生成更新日志：

```bash
pnpm changelog
```

3. 发布：

```bash
pnpm publish
```

## 参与贡献

详见 [贡献指南](./CONTRIBUTING.md)
