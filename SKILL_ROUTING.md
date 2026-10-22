> 历史文档：其中的完成状态、安装和路由描述已过时。当前行为与验证范围以 [README](README.md) 和 [验收记录](docs/VERIFICATION.md) 为准。

# Skill Routing Guide for oss-contrib Plugin

This plugin provides MCP tools that replace the original skill invocations.

## Original Skill → Plugin Tool Mapping

### `/oss-bug-hunter` (Hunt mode)
Maps to hunt phase tools:
- `oss_hunt_discover` - Discover issues from repositories
- `oss_hunt_probe` - Investigate specific issues
- `oss_hunt_screen` - Pre-screen for policy compliance
- `oss_hunt_preflight` - Check circuit breaker status

### `/oss-contributor` (Ship + Follow mode)
Maps to ship and track phase tools:
- `oss_ship_quota` - Check publishing quota
- `oss_ship_publish` - Publish PRs/issues
- `oss_ship_evidence` - Generate red/green receipts
- `oss_track_snapshot` - Track PR status
- `oss_track_cards` - Generate change cards

### `/pr-tracker` (Track + Homepage mode)
Maps to track and homepage phase tools:
- `oss_track_snapshot` - Take tracking snapshot
- `oss_track_cards` - Generate PR/issue cards
- `oss_track_homepage` - Homepage sync diagnostics

## Direct Tool Invocation

Instead of calling skills, agents should directly invoke the appropriate tool:

```typescript
// Old skill invocation (via skill file)
/oss-bug-hunter owner/repo

// New tool invocation (via MCP)
oss_hunt_discover({ repo: "owner/repo" })
```

## Run Cycle

For full cycle orchestration:

```typescript
// 1. Prepare cycle
oss_run_prepare({ runId: "run-001", mode: "all" })

// 2. Check status
oss_state_worklist()

// 3. Finish task
oss_run_finish_task({ runId: "run-001", taskId: "task-xyz", result: {...} })
```

## Environment Variables

The plugin respects the same environment variables as the original skills:
- `OSS_ROOT` - Root directory
- `OSS_STATE` / `OSS_STATE_DIR` - State directory
- `OSS_RUN_ID` - Run identifier
- `OSS_LEASE_OWNER` - Lease owner
- `GITHUB_TOKEN` - GitHub API token

## Configuration

Configure via `cordis.patch.yml` in your profile:

```yaml
oss-contrib:
  paths:
    root: F:/PR
    state: F:/PR/state
  github:
    user: YourUsername
  quota:
    pauseThreshold: 24
```
