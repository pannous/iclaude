import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { registerProxyRoutes } from "./proxy-routes.js";

// Mock settings-manager
let mockForwards: Array<{ prefix: string; port: number; name: string }> = [];
vi.mock("../settings-manager.js", () => ({
  getSettings: vi.fn(() => ({ proxyForwards: mockForwards })),
  updateSettings: vi.fn((patch: { proxyForwards?: typeof mockForwards }) => {
    if (patch.proxyForwards) mockForwards = patch.proxyForwards;
    return { proxyForwards: mockForwards };
  }),
}));

describe("proxy-routes", () => {
  let app: Hono;

  beforeEach(() => {
    mockForwards = [];
    app = new Hono();
    const api = new Hono();
    registerProxyRoutes(api);
    app.route("/api", api);
  });

  describe("GET /api/proxy-forwards", () => {
    it("returns empty array when no forwards configured", async () => {
      const res = await app.request("/api/proxy-forwards");
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
    });

    it("returns configured forwards", async () => {
      mockForwards = [{ prefix: "jobs", port: 8777, name: "Jobs App" }];
      const res = await app.request("/api/proxy-forwards");
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([{ prefix: "jobs", port: 8777, name: "Jobs App" }]);
    });
  });

  describe("PUT /api/proxy-forwards", () => {
    it("saves valid forwards", async () => {
      const res = await app.request("/api/proxy-forwards", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([{ prefix: "jobs", port: 8777, name: "Jobs" }]),
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([{ prefix: "jobs", port: 8777, name: "Jobs" }]);
    });

    it("rejects non-array body", async () => {
      const res = await app.request("/api/proxy-forwards", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix: "x", port: 1234 }),
      });
      expect(res.status).toBe(400);
    });

    it("rejects invalid prefix characters", async () => {
      const res = await app.request("/api/proxy-forwards", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([{ prefix: "bad prefix!", port: 8777 }]),
      });
      expect(res.status).toBe(400);
    });

    it("rejects port out of range", async () => {
      const res = await app.request("/api/proxy-forwards", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([{ prefix: "ok", port: 99999 }]),
      });
      expect(res.status).toBe(400);
    });

    it("defaults name to prefix when omitted", async () => {
      const res = await app.request("/api/proxy-forwards", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([{ prefix: "api", port: 3000 }]),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data[0].name).toBe("api");
    });
  });

  describe("proxy forwarding", () => {
    it("returns 404 for unconfigured prefix", async () => {
      const res = await app.request("/api/proxy/unknown/path");
      expect(res.status).toBe(404);
    });

    it("returns 502 when target is unreachable", async () => {
      // Use a port that's very unlikely to be in use
      mockForwards = [{ prefix: "dead", port: 59999, name: "Dead" }];
      const res = await app.request("/api/proxy/dead/test");
      expect(res.status).toBe(502);
    });
  });
});
