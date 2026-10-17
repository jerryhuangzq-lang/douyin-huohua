# douyin-huohua

自动在抖音网页版里为需要的会话发送「续火花」贴纸。Drives your logged-in Chrome (macOS) to keep Douyin chat streaks alive. Also usable as a Claude Code skill (see `SKILL.md`).

## 免责声明 / Disclaimer

**请在使用前阅读。**

- 本脚本会**代表你自动向其他用户发送消息**。这类自动化可能违反抖音（字节跳动）的用户协议或使用条款，可能导致账号被限制、警告甚至封禁。是否使用、风险与后果均由你自己承担。
- 本项目与抖音/字节跳动无任何关联，非官方工具。
- 仅供个人学习与研究。请勿用于骚扰、营销或任何批量/商业用途，请勿修改后向不知情的人群发送消息。
- 脚本使用你自己已登录的浏览器会话，不读取、不保存你的账号密码。页面结构变化后脚本可能失效，请自行检查 `config.json` 里的选择器。
- 软件按「现状」提供，不附带任何担保。

This script **automatically sends messages to other people on your behalf**. Such automation may violate Douyin's (ByteDance's) Terms of Service and could lead to warnings, restrictions or a ban on your account. Use at your own risk. This is an unofficial project, not affiliated with Douyin/ByteDance, intended for personal use only — not for spam, marketing or bulk/commercial use. Provided "as is", without warranty of any kind.

## 安装 / Install

```bash
git clone https://github.com/jerryhuangzq-lang/douyin-huohua.git
cd douyin-huohua
node scripts/huohua.js --self-test   # 确认环境正常，不碰 Chrome
```

## 使用 / Usage

需要 macOS、Google Chrome（已登录抖音网页版）、Node.js。以下命令在仓库目录执行。

```bash
node scripts/huohua.js --self-test   # 纯逻辑自检，不碰 Chrome
node scripts/huohua.js --dry-run     # 只列出目标，不发送
node scripts/huohua.js --run         # 发送
node scripts/huohua.js --run --only "好友名"
node scripts/huohua.js --mark-sent "好友名"   # 把指定会话标记为今天已发送（不发送，用于跳过）
node scripts/huohua.js --mark-failed          # 把本次运行里验证失败的会话标记为已发送
node scripts/huohua.js --version
```

首次使用请先 `--dry-run`。

## 定时任务 / Scheduled job

```bash
bash scripts/install.sh              # launchd 任务：醒着时每 10 分钟检查，每天最多成功跑一次
bash scripts/install.sh --uninstall
```

机器睡眠期间错过的检查会在唤醒时合并触发；当天成功后不再实际执行，失败则以 1 小时冷却重试。launchd 标签默认为 `com.<你的用户名>.douyin-huohua`，可用环境变量覆盖（安装和卸载时要使用同一个值）：

```bash
HUOHUA_LABEL=com.example.douyin-huohua bash scripts/install.sh
HUOHUA_LABEL=com.example.douyin-huohua bash scripts/install.sh --uninstall
```

运行记录与日志保存在 `~/.douyin-huohua/`（可用环境变量 `HUOHUA_HOME` 改位置；定时任务安装时会把该值写入 plist，手动运行与定时任务共用同一目录）。旧版放在包目录 `state/` 里的记录会在首次运行时一次性复制过来，之后只读新位置，旧文件不会被改动。
