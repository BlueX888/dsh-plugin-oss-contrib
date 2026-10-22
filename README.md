# dsh-plugin-oss-contrib

DSH 自动贡献插件，复用已有 OSS Python 核心，在宿主内执行任务、验证结果、结算并恢复中断周期。当前版本 **0.2.1**，验证宿主为 DSH **0.2.1-rc.2**。

## 已实现

- 23 个原生 DSH 工具：发现、筛选、证据执行、受门禁约束的发布、跟踪、状态与周期管理。
- DSH Agent 执行器：原生任务描述 → 独立 session → 持久化结果 → 原生结算。
- 定时器、心跳、任务步数与时间上限、取消、卸载清理、恢复与互斥。
- 沿用原生策略、配额、独立验证收据、文件锁、发布去重和账本格式。

这是现有核心的宿主适配版：需要配置根目录中的 `bin/` 和 `skill/oss-contrib/`，npm 包不包含整套 Python 核心。账户和配额以原生核心/账本为准；配置中的 `github.user`、`quota.*` 是一致性检查，不能用来更换账户或静默修改配额。

[安装](INSTALL.md) · [故障排查](TROUBLESHOOTING.md) · [验收证据及原规划映射](docs/VERIFICATION.md) · [测试说明](tests/README.md)

## 使用

先调用 `oss_doctor` 检查依赖和有效配置，再调用：

```json
{"mode":"followup","batchSize":3}
```

上面是 `oss_run_execute` 的参数，跟进已有贡献。定向任务可用：

```json
{"mode":"ship","targets":["owner/repo#123"],"batchSize":1}
```

`oss_run_status` 查看状态和 session ID；`oss_run_cancel` 中断并保留恢复记录；`oss_run_recover` 恢复最近未完成周期。恢复同一 run 必须保持 mode/targets。没有适合任务时返回 idle，不代表完成了新贡献。

手动 `oss_ship_publish` 默认 dry-run；明确 `execute:true` 才调用受原生门禁约束的外部写入。运行贡献周期会执行核心为任务授权的操作，包括满足门禁后的发布。不要把真实周期当成只读测试。

## 无人值守配置

在已有 `oss-contrib` 行上覆盖配置；不要再次 insert 同名插件：

```yaml
- id: oss-contrib
  config:
    paths:
      root: F:/PR
    agent:
      taskTimeoutMs: 3600000
      maxSteps: 160
    scheduler:
      enabled: true
      interval: '0 */6 * * *'
      timezone: Asia/Shanghai
      runOnStart: false
      mode: all
      batchSize: 3
      targets: []
```

安装默认 `enabled:false`，避免安装即发起贡献。宿主加载 agents/agentLoop 后开始调度，按同一账本串行运行；最近有未完成周期时优先恢复。默认模型继承宿主；可指定 `agent.provider/model/preset`。

工作 session 继承宿主权限；可用 `agent.permissionPreset` 指定已存在的 DSH 权限预设，仅作用于插件创建的 session。需要人工批准的工具请求返回拒绝，提示 worker 以 `needs_user` 记录所需操作，避免无限等待。身份登录、仓库策略、配额或维护者回复未满足时仍应等待或阻塞，不绕过门禁。

宿主退出后不运行定时任务；硬崩溃后的活跃原生租约不会被强抢，恢复会等待其失效。已保存结果会直接结算；尚未保存的工作可能重做，外部发布的幂等由原生发布器保证。运行日志保存在 `<state>/dsh-plugin/latest.json` 和 `runs/<runId>.json`，原生证据/结果仍由核心保存。日志不保存 token。

## 工具

| 分组 | 工具 |
|---|---|
| 状态 | oss_state_brief、oss_state_summary、oss_state_worklist、oss_state_ready_peek |
| 发现 | oss_hunt_discover、oss_hunt_probe、oss_hunt_screen、oss_hunt_preflight |
| 发布与证据 | oss_ship_quota、oss_ship_publish、oss_ship_evidence |
| 跟踪 | oss_track_snapshot、oss_track_cards、oss_homepage_status |
| 执行 | oss_run_execute、oss_run_recover、oss_run_status、oss_run_cancel |
| 高级周期接口 | oss_run_prepare、oss_run_heartbeat、oss_run_finish_task、oss_run_finish |
| 诊断 | oss_doctor |

高级接口用于已有协调器接入；通常只需 execute，不要与执行中的周期混用。旧 workflow 服务名称 oss-hunt/oss-ship/oss-followup/oss-round 分别路由至 hunt/ship/followup/all。原 CLI/Skill 保持可用；插件不修改 Claude Code 的 skill 或软链接。

## 开发

Node.js 22、Python 3.12+、Git；真实 GitHub 操作另需已认证 gh 和原生核心所需环境。

```powershell
npm ci
npm test
npm run format:check
npm pack
```

MIT
