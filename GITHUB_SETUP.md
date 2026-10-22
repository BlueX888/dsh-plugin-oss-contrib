# GitHub Repository Setup

This plugin is ready for GitHub publication. Follow these steps:

## 1. Create GitHub Repository

```bash
# On GitHub web: Create new repository
# Name: dsh-plugin-oss-contrib
# Description: Deep Harness plugin for OSS contribution pipeline (hunt/ship/track)
# Public/Private: Public (for community use)
# DO NOT initialize with README (we have one)
```

## 2. Push Local Repository

```bash
cd /f/CodingAgent/claude-code/work/PR/20261022-dsh-plugin/dsh-plugin-oss-contrib

# Add remote
git remote add origin https://github.com/BlueX888/dsh-plugin-oss-contrib.git

# Push
git push -u origin master
```

## 3. Add GitHub Topic

On GitHub repository page:
1. Click "About" gear icon (top right)
2. Add topic: `dsh-plugin`
3. Add other topics (optional): `deep-harness`, `oss-contribution`, `github-automation`
4. Save changes

## 4. Create Release

```bash
# Tag the current commit
git tag v0.1.0 -m "Initial release: Deep Harness OSS contribution plugin"
git push origin v0.1.0
```

On GitHub:
1. Go to Releases → Create new release
2. Choose tag: v0.1.0
3. Release title: "v0.1.0 - Initial Release"
4. Description:
```markdown
## Features

- 22 MCP tools for OSS contribution workflow
- Hunt/Ship/Track/Homepage phases
- Python bridge for compatibility with F:\PR project
- Cron-based scheduling
- Workflow integration for oss-hunt/ship/followup/round
- 11 passing tests (unit + integration)

## Installation

```bash
dsh plugin add dsh-plugin-oss-contrib-0.1.0.tgz
```

See [INSTALL.md](INSTALL.md) for detailed setup instructions.

## Requirements

- Deep Harness
- Python 3.12+
- Node.js 20+
- F:\PR project (or compatible state.json structure)
```

5. Attach file: `dsh-plugin-oss-contrib-0.1.0.tgz`
6. Publish release

## 5. Verify Topic Discovery

After adding `dsh-plugin` topic, verify:
- Repository appears in GitHub search: `topic:dsh-plugin`
- Deep Harness plugin discovery should find it (if supported)

## Current Status

- ✅ Local git repository initialized (2 commits)
- ✅ Package built (dsh-plugin-oss-contrib-0.1.0.tgz, 37.5 KB)
- ✅ Tests passing (11/11)
- ✅ Documentation complete (README, INSTALL, ROUTING, etc.)
- ❌ GitHub remote not added (awaits user action)
- ❌ GitHub topic not set (awaits GitHub repo creation)

## Automation Script (Optional)

```bash
#!/bin/bash
# github-publish.sh

set -e

REPO="BlueX888/dsh-plugin-oss-contrib"

echo "🚀 Publishing to GitHub..."

# Check if remote exists
if ! git remote get-url origin 2>/dev/null; then
  echo "Adding remote origin..."
  git remote add origin "https://github.com/$REPO.git"
fi

# Push
echo "Pushing to GitHub..."
git push -u origin master

# Tag and push tag
echo "Creating tag v0.1.0..."
git tag -f v0.1.0 -m "Initial release"
git push -f origin v0.1.0

echo "✅ Pushed to GitHub"
echo "⚠️  Manual step: Add 'dsh-plugin' topic on GitHub"
echo "⚠️  Manual step: Create release and attach .tgz file"
```

Run with:
```bash
chmod +x github-publish.sh
./github-publish.sh
```

## Notes

- Ensure you have GitHub CLI (`gh`) authenticated, or use HTTPS with credentials
- The `dsh-plugin` topic is **required** for Deep Harness plugin discovery
- Package size is 37.5 KB (compressed), 191.6 KB (uncompressed)
