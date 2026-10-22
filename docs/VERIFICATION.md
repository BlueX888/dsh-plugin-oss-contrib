# 验收记录（2026-10-22）

本文件只记录实际实现和可复查的验证，替代旧“完成/生产就绪”报告。交付为 **0.2.1，依赖原 OSS 核心的个人宿主适配版**，不是面向任意账号的独立产品。

## 三个交付里程碑

| 里程碑 | 实现 | 验收 |
|---|---|---|
| 可靠适配层 | bundle、依赖注入、23 个工具、真实 CLI 参数与输出解析、路径贯通、带锁状态修改、配额/身份断言 | 插件回归中的合同、临时账本、证据、注册/卸载测试 |
| 真实 DSH 执行闭环 | prepare/resume → 独立 Agent session → 持久化结果 → finish-task/finish；兼容旧 workflow 名称 | 实际模型完成本地修复提交，另一 session 独立复核；4 份原生收据全部验证通过 |
| 无人值守与交付 | cron/时区、心跳互斥、取消、进程树清理、崩溃恢复、结果重放、日志、文档和安装包 | 34 项插件测试全部通过；105 项核心隔离回归通过；真实 DSH profile 安装/运行验收 |

## 真实模型证据

使用本机 DSH 0.2.1-rc.2 的 agents、agentDefaultModel、agentPresets、permissionPresets 公共服务。验证中的 provider/model 使用宿主已有配置。

编码验收候选版本 0.2.0 的记录：

- run：coding-1792642475652。
- 实现 session：oss-4d809e89-0fa7-4d68-8ad6-23a4b5ce155d。
- 独立复核 session：oss-e0ba4225-e3c2-4617-b2c3-ed817b517c57。
- 原始提交：c51f291c221ccbeefc1f5f21d5449723a7da4e95。
- 修复提交：1adb813bda2e709b92c28e175db122267b109370。
- 50 次实际工具结果；2 个任务 done，0 retry/waiting/needs_user。
- 实现者和复核者各执行 red/green；原生 verify_receipt 检查签名关联/摘要/日志，red 返回 1、green 返回 0；复核使用独立 worktree，测试文件未修改。

本地原始记录：`F:/PR/dsh-plugin/.runtime-check/coding-result.json`；完整隔离核心、仓库、日志和收据：`.runtime-check/coding-1792642473399/`。这些运行产物不进入发布包。后续 0.2.1 增加恢复范围保护、卸载顺序修复和定时器测试，并完成最终包宿主检查。复现命令见 tests/README.md。

## 自动化回归

插件 `npm test`：34/34 通过，包含：

- 正确的 role/actor/runId、manifest kind、result 文件与 cards targets。
- 真正执行 Python/Git 证据命令，JSON IPC 隔离 stdout。
- 原生 adapter 拥有权、保存结果后恢复不重跑、失败结算 retry 后继续同周期其他任务。
- 取消/卸载释放资源、硬崩溃租约过期恢复、拒绝修改原 run 的范围而不污染恢复记录。
- cron 真正计时触发、串行、卸载停止；调用者 AbortSignal 传递至 worker。
- Python 超时终止子进程树，工作 session 的完成事件、时限和权限询问降级。

核心保持源码不变，执行：

| 原生测试集 | 通过数 |
|---|---:|
| test_workflow_adapter.py | 19 |
| test_publication.py | 25 |
| tests/e2e/test_lifecycle.py | 11 |
| test_cycle.py | 16 |
| test_repo_policy.py | 20 |
| test_evidence_layers.py | 14 |
| 合计 | 105 |

其中发布测试用替身验证拒绝/去重/远端成功但本地未提交时恢复等情况；e2e 生命周期使用 dry-run 发布。没有向真实上游发送测试 issue、评论或 PR。

CI 文件已配置；本机通过与远端 CI 通过分别记录，不能混为一谈。

## 与原 8 阶段规划的对应

| 原阶段 | 当前交付与必要调整 |
|---|---|
| 0–1 环境/骨架 | 使用实际宿主包/API；修复 bundle patch 并提供安装命令 |
| 2 状态 | 保留原账本/锁与 TaskModel，隔离测试，不迁移生产数据 |
| 3 工具 | 使用宿主 parameters/execute/output 合同，23 个工具 |
| 4 调度 | 用 agents/agentLoop 注入启动，execute/recover 工具和 cron 驱动完整周期；不使用宿主不存在的 ready 事件 |
| 5 阶段 | 直接复用原生发现/门禁/证据/发布/跟踪/主页状态逻辑；完整任务行为由原生 describe 合同驱动 |
| 6 兼容 | 旧 workflow 名映射 executor mode；核心 Skill 继续作为 describe 的合同来源。不执行专用宿主 DSL，也不修改另一宿主的 skill 软链接 |
| 7 测试 | 保留并执行核心断言；补充适配层/生命周期测试与实际模型验收；配置 CI |
| 8 交付 | 编译、版本化 tarball、独立 profile/desktop 安装及文档；GitHub 仓库已有 dsh-plugin topic |

原规划里的演示命令、旧工具接口、裸 Node 执行 workflow 以及固定“138 个 PR”验证值不能作为验收条件；已用实际 API 和隔离数据替代。

## 使用边界

- 需要匹配的本地核心 bin/skill、Python、Git、GitHub CLI 环境，以及可用的 DSH Agent/模型。没有把外部核心复制进发布包。
- 仍是 BlueX888 现有原生发布器的适配版。任意账号支持需先改造原核心中的身份来源。
- “无人值守”表示宿主运行时按配置调度并保留阻塞理由；不能保证任何任务都能完成、通过上游 CI 或被维护者合并。
- 默认不启动定时贡献。开启 scheduler 是明确的业务配置；安装包不会修改生产 hunt_enabled 或配额。
- 工作进程中断后，已保存结果直接结算；未保存工作可能重跑。不会抢占有效租约。
- 无远程实际发布验收、持续运行多日的可靠性数据或公开 npm registry 发布记录；不声称具备这些证据。

