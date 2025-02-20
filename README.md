# Telegram Search

一个功能强大的 Telegram 聊天记录搜索工具，支持向量搜索和语义匹配。基于 OpenAI 的语义向量技术，让你的 Telegram 消息检索更智能、更精准。

⚠️ **注意**：使用 userbot 可能存在封号风险，请谨慎使用。由于项目处于快速迭代阶段，可能会出现数据库不兼容的情况，建议定期备份数据。

## ✨ 功能特点

- 🤖 **多模式支持**

  - Bot 模式：使用 Telegram Bot API 实时收集消息
  - Client 模式：使用 Telegram Client API 访问完整历史记录
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
- Telegram Bot Token（Bot 模式）
- Telegram API 凭据（Client 模式）

### 安装步骤

1. 克隆仓库：

```bash
git clone https://github.com/luoling8192/telegram-search.git
cd telegram-search
```

2. 安装依赖：

```bash
pnpm install
pnpm run build
```

3. 配置环境：

```bash
cp config/config.example.yaml config/config.yaml
```

4. 初始化数据库：

```bash
pnpm run db:migrate
```

## 📖 使用指南

### 消息采集

1. 使用 Bot 模式：

```bash
# 启动 Bot 服务
pnpm run dev:cli bot

# 启动消息监听
pnpm run dev:cli watch
```

2. 使用 Client 模式：

```bash
# 连接到 Telegram
pnpm run dev:cli connect

# 同步指定会话
pnpm run dev:cli sync -c <chat_id>
```

### 数据导入导出

1. 导入历史记录：

```bash
# 完整导入（包含向量嵌入）
pnpm run dev:cli import -c <chat_id> -p <path_to_html_files>

# 快速导入（跳过向量嵌入）
pnpm run dev:cli import -c <chat_id> -p <path_to_html_files> --no-embedding
```

2. 导出消息：

```bash
# 导出为 JSON 格式
pnpm run dev:cli export -c <chat_id> --format json

# 导出为 HTML 格式
pnpm run dev:cli export -c <chat_id> --format html
```

### 向量处理

```bash
# 处理所有聊天的向量嵌入
pnpm run dev:cli embed -b 100

# 处理指定聊天的向量嵌入
pnpm run dev:cli embed -b 100 -c <chat_id>
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
