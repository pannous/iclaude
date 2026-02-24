import { vi, describe, it, expect, beforeEach } from "vitest";
import { homedir } from "node:os";
import { join } from "node:path";

// Mock Bun.file so the /fs/image handler works under Vitest (Node)
const mockExists = vi.fn();
const mockFile = vi.fn((_path: string) => ({
  exists: mockExists,
  type: "image/jpeg",
  // Bun.file returns a Blob-compatible object
  text: () => Promise.resolve("image-bytes"),
  stream: () => new ReadableStream(),
  size: 11,
  slice: () => new Blob(),
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
}));
vi.stubGlobal("Bun", { file: mockFile });

import { Hono } from "hono";
import { registerFsRoutes } from "./fs-routes.js";

const app = new Hono();
registerFsRoutes(app);

describe("/fs/image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when path is missing", async () => {
    const res = await app.request("/fs/image");
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent file", async () => {
    mockExists.mockResolvedValue(false);
    const res = await app.request("/fs/image?path=/nonexistent/file.jpg");
    expect(res.status).toBe(404);
  });

  it("expands tilde to homedir before resolving", async () => {
    mockExists.mockResolvedValue(true);
    const res = await app.request(
      `/fs/image?path=${encodeURIComponent("~/Pictures/cat.jpg")}`,
    );
    expect(res.status).toBe(200);
    // Verify Bun.file was called with the expanded path, not the raw tilde
    const calledPath = (mockFile.mock.calls.at(-1) as string[])?.[0];
    expect(calledPath).toBe(join(homedir(), "Pictures/cat.jpg"));
    expect(calledPath).not.toContain("~");
  });

  it("passes absolute paths through unchanged", async () => {
    mockExists.mockResolvedValue(true);
    const absPath = "/Users/someone/photo.jpg";
    const res = await app.request(
      `/fs/image?path=${encodeURIComponent(absPath)}`,
    );
    expect(res.status).toBe(200);
    expect((mockFile.mock.calls.at(-1) as string[])?.[0]).toBe(absPath);
  });
});
