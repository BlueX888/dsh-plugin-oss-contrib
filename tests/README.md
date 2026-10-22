# 测试与复现

## 插件测试

```powershell
npm ci
npm test
```

34 项测试覆盖工具注册与卸载、真实 Python 调用合同、临时账本、证据收据、执行/恢复/互斥、取消、进程树超时和定时器。集成测试从 OSS_TEST_ROOT（默认父目录）读取核心代码，但为状态/任务/归档创建临时目录，不使用生产账本。

没有核心源码时可执行构建与单元测试：

```powershell
npm run build
node --test tests/unit/*.test.js
```

## 原生核心回归

```powershell
$env:OSS_TEST_ROOT = 'F:/PR'
npm run test:core
```

runner 执行 cycle、workflow_adapter、publication、repo_policy、evidence_layers 和 e2e 生命周期测试，总计本次 105 项。GitHub 由测试替身隔离，不能声称通过了真实远程发布。

## 真实 DSH 编码验收

先安装当前 tarball 到 oss-contrib-verify，配置可用的模型凭据，然后：

```powershell
node scripts/prepare-coding-check.mjs
node scripts/run-dsh.mjs --profile oss-contrib-verify --patch F:/PR/dsh-plugin/.runtime-check/coding.patch.yml
```

准备脚本复制核心 bin/skill 到全新隔离根目录。验收脚本生成真实 Git 缺陷仓库，为实现和独立复核分别创建 DSH session。两者使用本地工具生成四份真实、SHA 绑定的收据，原生验证器检查收据；验证提交只改实现、测试未削弱、独立 worktree 结果一致，最终两任务均结算 done。

该验收消耗实际模型调用，使用已有 danger-full-access 权限预设，仅给本地验收 worker。不会自动设置生产 scheduler。运行日志/收据位于 .runtime-check/coding-<timestamp>/，汇总为 .runtime-check/coding-result.json。目录已 gitignore，不随 npm 包分发。

## CI

.github/workflows/verify.yml 配置 Windows 构建、单测和打包；手动 workflow_dispatch 提供 core_ref 才运行依赖外部核心的集成测试，私有核心可配置 OSS_CORE_TOKEN。此轮验证使用本机命令，未将“已写 CI 文件”计为“远端 CI 通过”。
