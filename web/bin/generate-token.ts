#!/usr/bin/env bun
/**
 * Show the current in-memory auth token (requires the server to be running).
 * The token is generated fresh on each server start and never written to disk.
 * Use the QR code in the UI to authenticate remote devices.
 */
import { getToken, regenerateToken } from "../server/auth-manager.ts";

const force = process.argv.includes("--force");
const token = force ? regenerateToken() : getToken();

console.log(`\n  ${force ? "New" : "Current"} auth token: ${token}\n`);
console.log(`  Note: token is in-memory only — scan the QR code in the UI to authenticate remotely.\n`);
