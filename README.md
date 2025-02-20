# Telegram Search

一个功能强大的 Telegram 聊天记录搜索工具，支持向量搜索和语义匹配。基于 OpenAI 的语义向量技术，让你的 Telegram 消息检索更智能、更精准。

⚠️ **注意**：使用 UserBot 可能存在封号风险，请谨慎使用。由于项目处于快速迭代阶段，可能会出现数据库不兼容的情况，建议定期备份数据。

## ✨ 功能特点

- 🤖 **Client 模式**

  - 使用 Telegram Client API 访问完整历史记录
  - 支持增量同步和实时更新
  - 自动处理多媒体内容和消息元数据

- 📥 **数据管理**

  - 支持导入 Telegram 导出的 HTML 聊天记录
  - 支持导出消息为 JSON 或 HTML 格式
  - 支持文件夹管理和消息分类
  - 支持增量同步和实时更新

- 🔍 **智能搜索**

  - 基于 OpenAI 的语义向量搜索
  - 支持自然语言查询
  - 精准的相关性匹配
  - 支持多种消息类型的检索

- 📊 **全面的消息支持**
  - 文本、图片、视频、文件、贴纸等多种类型
  - 完整的消息元数据（回复、转发、查看次数等）
  - 支持媒体文件本地存储
  - 支持消息统计和分析
 
## 👀 预览

<img src="https://github.com/user-attachments/assets/407a3980-e8fe-4aa6-a23c-81082d9f7b52" width="60%" />

## 🚀 快速开始

### 环境要求

- Node.js >= 20
- PostgreSQL >= 15（需要 pgvector 扩展）
- OpenAI API Key
- Telegram API 凭据（API ID 和 API Hash）

### 安装步骤

1. 克隆仓库：

```bash
git clone https://github.com/luoling8192/telegram-search.git
cd telegram-search
```

2. 安装依赖：

```bash
pnpm install
```

3. 配置环境：

```bash
cp config/config.example.yaml config/config.yaml
```

4. 初始化数据库：

```bash
pnpm run db:migrate
```

5. 启动服务：

```bash
# 启动后端服务
pnpm run dev:server

# 启动前端界面
pnpm run dev:frontend
```

访问 `http://localhost:3333` 即可打开搜索界面。

## 📖 使用指南

### 消息采集

```bash
# 同步文件夹和会话信息
pnpm run dev:cli sync

# 监听指定会话的消息
pnpm run dev:cli watch
```

### 数据导入导出

1. 导入历史记录：

```bash
# 导入 HTML 格式的消息记录
pnpm run dev:cli import -p <path_to_html_files>

# 跳过向量嵌入
pnpm run dev:cli import -p <path_to_html_files> --no-embedding
```

2. 导出消息：

```bash
# 导出消息（支持 database 格式）
pnpm run dev:cli export
```

### 向量处理

```bash
# 处理所有消息的向量嵌入
pnpm run dev:cli embed
```

### 搜索服务

```bash
# 启动搜索服务
pnpm run dev:cli search
```

## 📚 开发文档

- [开发指南](docs/development-guide.md)
- [数据库设计](docs/database-design.md)
- [贡献指南](CONTRIBUTING.md)

## 🚀 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=luoling8192/telegram-search&type=Date)](https://star-history.com/#luoling8192/telegram-search&Date)

## 📝 License

MIT License © 2025
