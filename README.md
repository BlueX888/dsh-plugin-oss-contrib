# dsh-plugin-oss-contrib

Open source contribution pipeline plugin for DeepSeek Harness.

## Features

- **Hunt**: Discover and analyze bugs in GitHub repositories
- **Ship**: Publish PRs with evidence and reviewer approval
- **Track**: Monitor PR status, CI failures, and maintainer feedback
- **Homepage**: Sync contributions to GitHub profile repository

## Installation

```bash
# From local directory (development)
dsh plugin add /path/to/dsh-plugin-oss-contrib

# From npm (once published)
dsh plugin add dsh-plugin-oss-contrib

# From tarball
dsh plugin add ./dsh-plugin-oss-contrib-0.1.0.tgz
```

## Configuration

Edit your profile's `cordis.patch.yml`:

```yaml
oss-contrib:
  paths:
    root: F:/PR
    state: F:/PR/state
  github:
    user: YourGitHubUsername
  quota:
    pauseThreshold: 24
```

Or use environment variables:
- `OSS_ROOT`: Root directory
- `OSS_STATE`: State directory
- `GITHUB_TOKEN`: GitHub API token

## Available Tools

### State Management
- `oss_state_brief`: Get pipeline status summary

### Hunt Phase
- `oss_hunt_discover`: Discover issues from a repository

### More tools coming in later migration phases...

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Test
npm test
```

## Requirements

- Python 3.12+
- Node.js 20+
- Git
- GitHub CLI (`gh`) authenticated

## License

MIT
