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

## 使用 / Usage

需要 macOS、Google Chrome（已登录抖音网页版）、Node.js。

```bash
node scripts/huohua.js --self-test   # 纯逻辑自检，不碰 Chrome
node scripts/huohua.js --dry-run     # 只列出目标，不发送
node scripts/huohua.js --run         # 发送
node scripts/huohua.js --run --only "好友名"
```

首次使用请先 `--dry-run`。

## 定时任务 / Scheduled job

```bash
bash scripts/install.sh              # 每天 12:37 的 launchd 任务
bash scripts/install.sh --uninstall
```

launchd 标签默认为 `com.<你的用户名>.douyin-huohua`，可用环境变量覆盖（安装和卸载时要使用同一个值）：

```bash
HUOHUA_LABEL=com.example.douyin-huohua bash scripts/install.sh
HUOHUA_LABEL=com.example.douyin-huohua bash scripts/install.sh --uninstall
```

`state/`（运行记录与日志）保存在本地，已被 `.gitignore` 忽略。
