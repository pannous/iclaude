# Bun Crash Investigation & Prevention

## Incident Report

**Date**: 2026-02-11
**Issue**: Bun server crashing in a loop with segmentation fault

### Symptoms
```
panic(main thread): Segmentation fault at address 0x0
oh no: Bun has crashed. This indicates a bug in Bun, not your code.
```

The server was auto-restarting repeatedly, attempting to restore 35 sessions with 23 live CLI processes, causing rapid WebSocket reconnections.

## Root Cause Analysis

### Primary Cause: Session Accumulation
- **No cleanup mechanism**: Sessions accumulated indefinitely in persistent storage
- **Server restart**: Attempted to restore all 35 sessions simultaneously
- **Process spawning**: 23 CLI processes reconnecting their WebSockets concurrently
- **Memory/race condition**: High concurrent load triggered Bun's internal segfault

### Technical Details
- **Segfault at address 0x0**: NULL pointer dereference
- **Location**: Likely in Bun's WebSocket handling code under concurrent load
- **Trigger**: Rapid connect/disconnect cycles during session reconnection
- **Bun version**: 1.1.29 (6d43b366) on macOS Silicon

### Contributing Factors
1. Some sessions connecting and immediately disconnecting
2. Git errors ("fatal: not a git repository") adding to instability
3. No rate limiting on concurrent CLI spawns
4. No session lifecycle management

## Prevention Measures Implemented

### 1. Automatic Session Cleanup

Added `cleanupOldSessions()` method to both `CliLauncher` and `WsBridge`:

**Cleanup Rules**:
- Remove disconnected/exited sessions older than 48 hours
- Limit total sessions to 100 max
- Only clean sessions with valid `createdAt` timestamps
- Skip sessions that are currently connected

**Execution**:
- Runs automatically after `restoreFromDisk()` on startup
- Runs periodically every 6 hours via `setInterval()`
- Manual cleanup via `cleanupOldSessions()` API

### 2. Session State Tracking

Improved session metadata:
- `createdAt` timestamp for age-based cleanup
- Proper state tracking (starting, connected, running, exited)
- PID verification before attempting reconnection

### 3. Graceful Reconnection

Existing reconnection logic now works with cleaner state:
- 10s grace period for CLI processes to reconnect WebSocket
- Exponential backoff for relaunch (5s → 60s max)
- Cooldown tracking to prevent rapid relaunch loops

## Files Modified

```
web/server/cli-launcher.ts  - Added cleanupOldSessions()
web/server/ws-bridge.ts     - Added cleanupOldSessions()
web/server/index.ts         - Added periodic cleanup interval
```

## Verification

- All 457 tests passing after changes
- No more session accumulation beyond 100 total
- Server restarts cleanly with reasonable session count

## Future Improvements

1. **Rate Limiting**: Add concurrency limits for CLI spawning
2. **Health Checks**: Monitor for rapid crash/restart cycles
3. **Bun Upgrade**: Monitor Bun releases for segfault fixes
4. **Session TTL**: Consider shorter TTL for inactive sessions (24h?)
5. **Manual Cleanup UI**: Add "Delete Old Sessions" button in UI

## Related Issues

- Session accumulation causing memory bloat
- No way to bulk-delete old sessions
- User confusion about archived vs active sessions

## Monitoring

To check for future issues:
```bash
# Count live sessions
ls -1 /var/folders/*/T/vibe-sessions/*.json | wc -l

# Check for zombie Claude processes
ps aux | grep "claude --sdk-url" | grep -v grep | wc -l

# Monitor Bun crashes
tail -f /path/to/bun/logs
```
