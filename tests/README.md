# dsh-plugin-oss-contrib Tests

## Test Structure

- **unit/** - Unit tests for individual components (Python bridge, services)
- **integration/** - Integration tests (plugin loading, tool registration)

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
node --test tests/unit/python-bridge.test.js
```

## Test Coverage

### Unit Tests
- [x] Python bridge JSON IPC
- [x] Error handling in bridge
- [ ] State service methods (requires OSS_STATE)
- [ ] Scheduler service (requires state.json)

### Integration Tests
- [x] Plugin structure validation
- [x] TypeScript compilation check
- [x] Cordis patch YAML validation
- [ ] Full plugin load in Deep Harness (requires dsh runtime)
- [ ] Tool registration verification (requires dsh + tools service)

## Testing with Actual PR State

To test against real state.json:

1. Set environment variables:
   ```bash
   export OSS_ROOT=F:/PR
   export OSS_STATE=F:/PR/state
   ```

2. Run tests:
   ```bash
   npm test
   ```

## Integration with Original Tests

The original PR project tests are preserved at:
- `F:\PR\tests\test_*.py` - Python unit tests
- `F:\PR\tests\e2e\` - End-to-end tests

These can be run alongside plugin tests to verify compatibility:

```bash
# In PR directory
cd F:/PR
python -m pytest tests/

# In plugin directory
cd F:/CodingAgent/claude-code/work/PR/20261022-dsh-plugin/dsh-plugin-oss-contrib
npm test
```
