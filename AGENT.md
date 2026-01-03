# SecChat - 加密聊天应用

## 项目概述

SecChat 是一个类似微信的加密群聊应用，支持端到端加密的文本和图片消息传输。

## 技术栈

| 组件 | 技术 |
|------|------|
| 后端 | Golang + Gorilla WebSocket + SQLite |
| 前端 | uni-app (Vue 3) |
| 加密 | AES-256-GCM (客户端) + SHA256 (密码验证) |

## 项目结构

```
sec-chat/
├── AGENT.md                    # 本文件
├── server/                     # Golang 后端
│   ├── main.go                # 入口 (端口8080)
│   ├── config/                # 配置模块
│   ├── crypto/                # 加密模块 + 测试
│   ├── models/                # 数据模型 + 测试
│   ├── store/                 # SQLite存储 + 测试
│   └── handlers/              # HTTP/WebSocket处理器
└── client/                     # uni-app 前端
    └── src/
        ├── pages/login/       # 登录页 (黑白风格)
        ├── pages/chat/        # 聊天页
        ├── pages/members/     # 成员页
        └── utils/             # crypto.js, websocket.js
```

## 核心功能

- ✅ 服务器地址 + 密码认证
- ✅ 端到端加密消息
- ✅ 图片发送 (相册/拍照)
- ✅ 消息撤回
- ✅ 消息回复 (@引用)
- ✅ 表情包
- ✅ 在线成员列表
- ✅ 历史消息加载
- ✅ 输入状态指示
- ✅ 已读回执

## 快速开始

### 一键启动 (推荐)
```bash
make install      # 首次运行，安装依赖
make              # 启动前后端
# 或指定密码: make PASSWORD=mypassword
```

### 分别启动
```bash
# 启动服务器
make server PASSWORD=YOUR_PASSWORD

# 启动客户端
make client
# 访问 http://localhost:5173
```

### 连接测试
- 服务器地址: `ws://localhost:8080/ws`
- 密码: 启动服务器时设置的密码

## 后端测试

```bash
cd server
go test ./... -v
# 18个测试用例全部通过
```

## API 接口

| 端点 | 方法 | 功能 |
|------|------|------|
| `/ws` | WebSocket | 实时通信 |
| `/api/auth` | POST | 密码验证 |
| `/api/messages` | GET | 历史消息 |
| `/api/upload` | POST | 图片上传 |
| `/api/members` | GET | 成员列表 |

## Git 管理

### .gitignore 排除项

| 类别 | 排除项 |
|------|--------|
| 系统文件 | `.DS_Store` |
| IDE | `.idea/`, `.vscode/`, `*.suo`, `*.sw?` |
| 日志 | `*.log`, `logs/` |
| 依赖 | `node_modules/` |
| 构建产物 | `dist/`, `*.local` |
| 服务器 | `server/secchat-server`, `server/server.log`, `server/data/` |
| 测试文件 | `client/screenshots/`, `client/*_test.js`, `client/seed_messages.js` |
