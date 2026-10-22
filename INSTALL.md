# Installation and Verification Guide

## Prerequisites

1. **Deep Harness installed**: `F:\CodingAgent\DeepSeekHarness\`
2. **Python 3.12+** in PATH
3. **F:\PR project** with working `state.json`
4. **Git** and **Node.js 20+**

## Installation

### Option 1: From Tarball (Recommended)
```bash
cd F:/CodingAgent/claude-code/work/PR/20261022-dsh-plugin/dsh-plugin-oss-contrib

# Install via Deep Harness GUI:
# 1. Start Deep Harness (double-click "DeepSeek Harness.exe")
# 2. Open Settings → Plugins
# 3. Click "Install Plugin"
# 4. Select: dsh-plugin-oss-contrib-0.1.0.tgz
```

### Option 2: From Directory (Development)
```bash
# Link plugin directory directly
# In Deep Harness GUI: Settings → Plugins → Install from Directory
# Select: F:\CodingAgent\claude-code\work\PR\20261022-dsh-plugin\dsh-plugin-oss-contrib
```

## Configuration

Create or edit `~/.dsh/profiles/<your-profile>/cordis.patch.yml`:

```yaml
oss-contrib:
  paths:
    root: F:/PR
    state: F:/PR/state
    tasks: F:/PR/tasks
    archive: F:/PR/archive
  github:
    user: BlueX888
    # token: leave empty to use $GITHUB_TOKEN
  quota:
    pauseThreshold: 24
  scheduler:
    enabled: false
```

Or use environment variables:
```bash
export OSS_ROOT=F:/PR
export OSS_STATE=F:/PR/state
export OSS_TASKS=F:/PR/tasks
export GITHUB_TOKEN=ghp_your_token_here
```

## Verification

### 1. Test Python Bridge (Command Line)
```bash
cd F:/CodingAgent/claude-code/work/PR/20261022-dsh-plugin/dsh-plugin-oss-contrib

# Run tests
npm test

# Expected output:
# ✔ Plugin structure validation
# ✔ TypeScript compilation successful
# ✔ Cordis patch file is valid YAML
# ✔ state.py brief returns valid output
# ✔ state.py summary returns valid output
# ✔ state.py worklist returns parseable output
# ✔ Python bridge returns valid JSON
# ✔ Python bridge handles module import errors
# ℹ tests 8
# ℹ pass 8
# ℹ fail 0
```

### 2. Test Real State Integration
```bash
# Verify state.py works
python F:/PR/bin/state.py brief

# Expected: Lines starting with META, PR, ISSUE...
```

### 3. Verify Plugin in Deep Harness

**Method 1: GUI Inspection**
1. Start Deep Harness
2. Go to Settings → Plugins
3. Look for "oss-contrib" in installed plugins list
4. Status should show "Active" or "Loaded"

**Method 2: Check Tools (if available via GUI)**
1. In a Deep Harness session, open Tools panel
2. Search for "oss_" prefix
3. Should see tools like:
   - `oss_state_brief`
   - `oss_hunt_discover`
   - `oss_ship_quota`
   - etc. (22 tools total)

**Method 3: Check Logs**
Look in Deep Harness logs for:
```
[oss-contrib] OSS Contribution Pipeline loaded
[oss-contrib] Root: F:/PR
[oss-contrib] State: F:/PR/state
[oss-contrib] Registered 4 phases: hunt, ship, track, homepage
```

## Using the Plugin

### From Deep Harness Agent

In a chat session, the agent can now use tools like:

```
Can you check the OSS pipeline status?
→ Agent calls: oss_state_brief()

Discover issues in microsoft/autogen
→ Agent calls: oss_hunt_discover({repo: "microsoft/autogen"})

Check if we can publish more PRs
→ Agent calls: oss_ship_quota()
```

### Manual Tool Testing (if dsh CLI available)

```bash
# This assumes dsh CLI is in PATH
# If not, use Deep Harness GUI instead

dsh --profile web tools list | grep oss_
# Should list 22 tools

dsh --profile web tools call oss_state_brief
# Should return JSON with PR counts
```

## Troubleshooting

### Plugin Not Showing Up

1. Check Deep Harness version supports plugins
2. Verify `package.json` has `dsh.bundle: true`
3. Restart Deep Harness completely (not just reload)
4. Check plugin directory permissions

### Python Bridge Errors

```bash
# Test Python directly
python --version
# Should be 3.12+

# Test state.py access
python F:/PR/bin/state.py brief
# Should output state info

# Check OSS_STATE
echo $OSS_STATE  # Linux/Mac
echo %OSS_STATE%  # Windows CMD
# Should be F:/PR/state or similar
```

### Tools Not Registered

1. Check plugin configuration in `cordis.patch.yml`
2. Verify paths.root points to F:/PR
3. Check Deep Harness logs for errors
4. Ensure no conflicting plugins use same tool names

### State.json Access Issues

```bash
# Verify state.json exists and is readable
ls -la F:/PR/state/state.json

# Check file permissions
# On Windows: Right-click → Properties → Security

# Test direct Python access
cd F:/PR
python bin/state.py brief
```

## Next Steps

1. **Test hunt phase**: Use `oss_hunt_discover` on a known repo
2. **Check quota**: Call `oss_ship_quota` to see current limits
3. **Run cycle**: Use `oss_run_prepare` to test full cycle
4. **Monitor state**: Watch `oss_state_worklist` during runs

## Uninstallation

In Deep Harness GUI:
1. Settings → Plugins
2. Find "oss-contrib"
3. Click "Remove" or "Uninstall"
4. Confirm removal

**Note**: Uninstalling does NOT affect F:\PR data or state.json.

## Support

- **Issues**: Check Deep Harness console logs
- **State problems**: Verify with `python F:/PR/bin/state.py brief`
- **Python errors**: Test bridge with `npm test`
