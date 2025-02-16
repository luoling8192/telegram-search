# Telegram Search

一个功能强大的 Telegram 聊天记录搜索工具，支持向量搜索和语义匹配。基于 OpenAI 的语义向量技术，让你的 Telegram 消息检索更智能、更精准。

⚠️ **注意**：使用 userbot 可能存在封号风险，请谨慎使用。由于项目处于快速迭代阶段，可能会出现数据库不兼容的情况，建议定期备份数据。

## ✨ 功能特点

- 🤖 **实时消息采集**
  - 支持 Telegram Bot 实时收集消息
  - 自动处理多媒体内容
  - 保留完整的消息元数据

- 📥 **数据导入导出**
  - 支持导入 Telegram 导出的 HTML 聊天记录
  - 批量导入和处理能力
  - 支持选择性导入

- 🔍 **智能搜索**
  - 基于 OpenAI 的语义向量搜索
  - 支持自然语言查询
  - 精准的相关性匹配

- 📊 **全面的消息支持**
  - 文本、图片、视频、文件、贴纸等多种类型
  - 完整的消息元数据（回复、转发、查看次数等）
  - 支持媒体文件本地存储

## 🖼️ 功能预览

![image](https://github.com/user-attachments/assets/2ff088c1-41f2-455f-9cb1-ec31ce691c80)

## 🚀 快速开始

### 环境要求

- Node.js >= 20
- PostgreSQL >= 15
- OpenAI API Key
- Telegram Bot Token
- Telegram API 凭据

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

2. 使用分离的配置项（当 DATABASE_URL 未设置时使用）：
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

### 导入历史记录

从 Telegram Desktop 导出的 HTML 文件导入：

```bash
# 完整导入（包含向量嵌入）
pnpm run dev:cli import -c <chat_id> -p <path_to_html_files>

# 快速导入（跳过向量嵌入）
pnpm run dev:cli import -c <chat_id> -p <path_to_html_files> --no-embedding
```

### 生成向量嵌入

为已导入的消息生成向量表示：
```bash
# 处理所有聊天
pnpm run dev:cli embed -b 100

# 处理指定聊天
pnpm run dev:cli embed -b 100 -c <chat_id>
```

### 启动服务

```bash
# 启动 Bot 服务
pnpm run dev:cli bot

# 启动搜索服务
pnpm run dev:cli search

# 启动消息监听
pnpm run dev:cli watch
```

## 🔧 开发指南

### 数据库操作

```bash
# 生成迁移文件
pnpm -F @tg-search/cli db:generate

# 应用迁移
pnpm -F @tg-search/cli db:migrate

# 启动开发服务器
pnpm -F @tg-search/cli dev
```

### 项目结构

```
packages/
  ├── cli/           # 核心功能模块
  │   ├── src/
  │   │   ├── commands/   # CLI 命令
  │   │   ├── db/        # 数据库相关
  │   │   ├── services/  # 服务层
  │   │   └── adapter/   # 适配器
  │   └── package.json
  └── common/         # 共享工具和类型
```

### 数据库设计

- `messages` 表：消息主表
  - 支持向量搜索（pgvector）
  - 自动分区（按聊天 ID）
  - 完整的消息元数据（ID、内容、类型、时间等）
  - 高效的索引设计（向量索引、时间索引、类型索引）

- `chats` 表：聊天记录
  - 聊天基本信息（ID、名称、类型）
  - 最后消息和同步时间
  - 消息计数统计

- `folders` 表：文件夹管理
  - 文件夹信息（ID、标题、图标）
  - 同步状态跟踪

- `sync_state` 表：同步状态
  - 记录每个聊天的同步进度
  - 支持增量同步

## ⭐ Star History

![Star History Chart](https://api.star-history.com/svg?repos=luoling8192/telegram-search&type=Date)

## 📝 License

MIT License © 2025

