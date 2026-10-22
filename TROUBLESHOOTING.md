# 故障排查

当前验收依据是 [VERIFICATION.md](docs/VERIFICATION.md)。早期 COMPLETION_REPORT、GITHUB_SETUP、SKILL_ROUTING 及规划目录的完成报告不作为当前行为依据。

| 现象 | 已核对原因 / 处理 |
|---|---|
| dsh.bundle.patch 格式校验失败 | 旧 0.1.0 包曾使用 bundle:true / patchFile。当前采用 bundle:{patch:"./cordis.patch.yml"}，路径字符串或列表均合法。检查实际安装包，不能只看源码。 |
| 安装了但插件未挂载 | bundle patch 必须 insert 带 name:dsh-plugin-oss-contrib 的插件行。用独立 profile dump 检查配置组合。 |
| 代码更新后行为没变 | 已运行宿主仍在使用旧代码，或 pnpm 复用了同路径/版本 tgz。使用新版本包并重新加载宿主。 |
| 工具未注册 | 当前宿主要求 parameters/execute/output 接口和 Cordis 依赖注入；本版等待服务后注册 23 个工具。 |
| brief/summary/worklist 解析失败 | 原生输出是文本；ready-peek 是 JSON Lines。不能给这些命令统一追加 --json。 |
| evidence / publish / finish-task 报 argparse 错误 | 本版修复 actor/runId/role、publish kind、结果文件路径等原生调用合同。 |
| 工具有注册，Agent 却 transport failed | 本机曾因 followup 传了裸 content 而失败；必须传有 id/role/source 的 UserMessage。也应检查宿主模型配置，勿把所有错误归因于网络。 |
| scheduler.enabled 后不触发 | 当前宿主不发 ready 事件。本版依赖 agents/agentLoop 注入启动；检查模型服务、cron、timezone 和宿主是否仍运行。 |
| 运行返回 busy / another adapter | 原生账本或会话存在活跃拥有者。不抢占；检查前一实例及租约。 |
| configured ... does not match | 配置的身份或配额预期与原生核心不一致；修改错误的预期或通过原生流程调整账本。 |
| worker 返回 retry / needs_user | 查看 run journal 的 sessionId、原生结果和具体拒绝原因。未满足权限/仓库条件不属于“自动完成”。 |
| 取消或卸载卡住 | 本版传播 AbortSignal，终止 Python 子进程树，先等待 executor 释放 adapter session，再关闭 bridge。硬崩溃需按租约恢复。 |

程序接入应调用 oss_run_execute/recover/status，不要用 node 直接执行宿主专用 workflow DSL。旧文档中的 dsh tools list/call 不适用于本机 CLI；实际工具必须在运行宿主中验证。

## 发布验证范围

本次真实 DSH 验收执行了本地代码修复和独立复核。远程发布的拒绝、重试、去重和账本提交由原生隔离测试覆盖，未向真实开源项目发测试 issue/PR。真实仓库的政策、CI 和维护者反馈不能用本地通过替代。
