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
```

3. 配置环境：

```bash
cp .env.example .env
# 编辑 .env 文件，填入必要的配置
```

4. 初始化数据库：

```bash
pnpm -F @tg-search/cli db:migrate
```

## ⚙️ 配置说明

### 核心配置

```env
# Telegram Bot Token（从 @BotFather 获取）
BOT_TOKEN="your_bot_token"

# Telegram API 凭据（从 https://my.telegram.org 获取）
API_ID="your_api_id"
API_HASH="your_api_hash"
PHONE_NUMBER="+8613800138000"  # 国际格式的手机号

# OpenAI API Key（用于向量嵌入）
OPENAI_API_KEY="your_openai_api_key"
```

### 数据库配置

支持两种配置方式：

1. 使用完整的数据库 URL：

```env
DATABASE_URL="postgres://user:password@host:5432/dbname"
```

2. 使用分离的配置项：

```env
DB_HOST="localhost"
DB_PORT="5432"
DB_USER="postgres"
DB_PASSWORD="postgres"
DB_NAME="tg_search"
```

### 数据存储路径

自定义数据存储位置（支持 ~ 表示用户主目录）：

```env
SESSION_PATH="~/.telegram-search/session"  # Telegram 会话文件
MEDIA_PATH="~/.telegram-search/media"      # 媒体文件目录
```

### 可选配置

```env
# OpenAI API 代理（可选，用于改善国内访问）
OPENAI_API_BASE="https://your-api-proxy/v1"
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

## 🔧 开发指南

### 项目结构

```
packages/
  ├── cli/           # 命令行工具
  │   ├── src/
  │   │   ├── commands/   # CLI 命令实现
  │   │   └── command.ts  # 命令基类
  │   └── package.json
  ├── core/          # 核心功能模块
  │   ├── src/
  │   │   ├── adapter/    # Telegram 适配器
  │   │   └── services/   # 核心服务
  │   └── package.json
  ├── db/            # 数据库模块
  │   ├── src/
  │   │   ├── models/     # 数据模型
  │   │   └── schema/     # 数据库模式
  │   └── package.json
  └── common/        # 共享工具和类型
      └── src/
          ├── helper/     # 工具函数
          └── types/      # 类型定义
```

### 数据库设计

- `messages` 表：消息主表

  - 支持向量搜索（pgvector）
  - 自动分区（按聊天 ID）
  - 完整的消息元数据
  - 高效的索引设计

- `chats` 表：聊天记录

  - 聊天基本信息
  - 最后消息和同步时间
  - 消息计数统计

- `folders` 表：文件夹管理

  - 文件夹信息
  - 同步状态跟踪

## 📝 License

MIT License © 2025
