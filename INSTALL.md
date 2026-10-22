# 安装与验证

本机验证目标：Windows、DSH 0.2.1-rc.2、插件 0.2.1。以下命令经过实际 CLI 安装验证；不依赖推测的 GUI 安装入口。

## 构建

```powershell
Set-Location F:\PR\dsh-plugin
npm ci
npm test
npm pack
```

产物为 `dsh-plugin-oss-contrib-0.2.1.tgz`，prepack 自动编译。需要现有 OSS 核心根目录（默认 F:/PR），包括 bin/ 和 skill/oss-contrib/。现有账本保持原格式。

## 本机安装

仓库提供脚本调用本机 Desktop 所带 CLI，隐藏辅助窗口并保留退出码：

```powershell
node scripts/run-dsh.mjs plugin --profile oss-contrib-verify add ./dsh-plugin-oss-contrib-0.2.1.tgz
node scripts/run-dsh.mjs --profile oss-contrib-verify --dump-config
node scripts/run-dsh.mjs plugin --profile desktop add ./dsh-plugin-oss-contrib-0.2.1.tgz
```

其他机器使用自身 `dsh plugin --profile <profile> add <tgz>`；或者设置脚本使用的 DSH_EXECUTABLE、DSH_ENTRY、DSH_HOME。本机默认位置分别指向 F:/CodingAgent/DeepSeekHarness 下的 exe、app.asar 中的 CLI 和 data/dsh。此辅助脚本不随 npm 包分发。

安装按 profile 隔离。已启动的 Desktop 需要重新加载/重启才能使用磁盘上的新版本；安装命令不会替换内存中的旧代码。desktop 是 Desktop 保留 profile，普通 headless 启动/配置 dump 使用独立验证 profile。

不要反复覆盖相同版本、相同路径的 tgz 做验证：pnpm 可能复用缓存。正式变更应提升版本；开发验收可使用带内容哈希的新包路径。

## 上线检查

1. 在实际宿主调用 oss_doctor，检查 compatible、路径、publisher、quota。
2. 调用 oss_state_brief 和 oss_run_status 检查账本可读。
3. 默认模型/Agent 驱动必须可用。工具注册成功不代表模型执行成功。
4. 用隔离 fixture 做真实模型验收（见 tests/README.md）；其结果不能替代真实上游仓库的策略审核。
5. 需要持续贡献时，按 README 配置 scheduler.enabled。默认安装不启动周期。

Python 可用 runtime.python 指定。paths.state/tasks/archive 省略时从 root 推导，传给所有 Python 子进程。GitHub token 优先使用现有 gh/进程环境；可配置 github.token，但不要把凭据提交到仓库。github.user 和 quota.* 只是预期值，若与核心/账本不一致，执行会报错，不会覆盖生产设置。
