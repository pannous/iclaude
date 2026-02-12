# Security Updates from AppleLamps Fork

## Overview

Integrated security improvements from [AppleLamps/companion](https://github.com/AppleLamps/companion) fork, which addressed 9 critical/high severity vulnerabilities plus additional stability improvements.

**Integration Date**: 2026-02-10
**Commit**: 2f6a19c

## Security Fixes Applied

### 1. ✅ Input Validation (routes.ts)
**Issue**: API endpoints accepted arbitrary parameters without validation
**Impact**: Command injection, path traversal, DoS
**Fix**: Comprehensive validation for all session creation parameters:
- Model name: type checking, length limit (< 100 chars)
- Permission mode: whitelist validation
- Claude binary: regex validation `/^[a-zA-Z0-9_\-\/\.]+$/`
- Allowed tools: array validation with element limits
- Branch name: type and length validation
- Env slug: type validation

### 2. ✅ Path Traversal Prevention (routes.ts)
**Issue**: Filesystem API allowed access to arbitrary paths
**Impact**: Could access `/etc/passwd`, SSH keys, system files
**Fix**:
- Added `realpath()` resolution to handle symlinks
- Enforced home directory boundary checks
- Return 403 for paths outside allowed scope
- Applied to both session `cwd` and `/api/fs/list` endpoint

```typescript
const realPath = await realpath(basePath).catch(() => basePath);
const allowedBase = homedir();
if (!realPath.startsWith(allowedBase + sep) && realPath !== allowedBase) {
  return c.json({ error: "Access denied" }, 403);
}
```

### 3. ✅ React Error Boundaries (ErrorBoundary.tsx)
**Issue**: Unhandled React errors caused complete app crashes
**Impact**: Poor user experience, lost work
**Fix**: Created ErrorBoundary component with:
- Graceful error display
- Error details (expandable)
- Reload button
- Console logging for debugging

### 4. ✅ Command Injection Prevention (cli-launcher.ts)
**Issue**: Already fixed in current codebase
**Status**: Verified `execFileSync` is used instead of `execSync` with string interpolation

## Additional Improvements

### Error Handling
- Better error logging in routes
- Proper error state management in UI components
- Try-catch blocks around async operations

### Title Generation
- Improved summarization algorithm
- Pattern-based extraction for common request types
- Better truncation at word boundaries

### Code Quality
- Added TypeScript type safety
- Input sanitization throughout
- Security-focused code comments

## Files Modified

### Server (1 file)
- `web/server/routes.ts` - Input validation, path traversal fixes

### Client (3 files)
- `web/src/components/ErrorBoundary.tsx` - NEW: Error boundary component
- `web/src/api.ts` - Error handling improvements
- `web/src/components/Sidebar.tsx` - Error handling

### Other
- `web/server/title-generator.ts` - Improved title generation
- `SECURITY_UPDATES.md` - This file

## Security Improvements Not Yet Applied

The following improvements from AppleLamps are documented but not yet implemented:

### 1. WebSocket Message Schema Validation (ws-bridge.ts)
**Issue**: JSON messages parsed without structure validation
**Impact**: Type confusion attacks
**Status**: Not yet applied - would require careful testing

### 2. Session ID Validation (index.ts)
**Issue**: Accepts any UUID-shaped string
**Impact**: Resource exhaustion
**Status**: Not yet applied - existing session management may handle this differently

### 3. Resource Cleanup Improvements
**Issue**: Stream readers not released, timers not cleared
**Impact**: Memory leaks
**Status**: Partially addressed, but full audit needed

### 4. Stream Timeouts (cli-launcher.ts)
**Issue**: No timeout on stream reads
**Impact**: Hung processes
**Status**: Not yet applied - needs testing with real workloads

### 5. Graceful Shutdown Handlers
**Issue**: No SIGTERM/SIGINT handlers
**Impact**: Orphaned processes on server restart
**Status**: Not yet applied

## Testing Recommendations

Before deploying to production:

1. **Path Traversal**: Try to access `/etc/passwd` via filesystem API
2. **Input Validation**: Send malformed session creation requests
3. **Error Boundaries**: Trigger React errors to verify graceful handling
4. **Command Injection**: Verify binary name validation works
5. **Performance**: Check if validation adds noticeable latency

## References

- AppleLamps Fork: https://github.com/AppleLamps/companion
- Security Audit: `notes/applelamps-security-fork.md`
- Original PR Discussion: (not yet created)

## Next Steps

Consider implementing the remaining security improvements:
- WebSocket message validation (medium priority)
- Session ID validation (medium priority)
- Stream timeouts (low priority - stability over security)
- Graceful shutdown (low priority - DevEx improvement)
