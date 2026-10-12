import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import worker from "../src";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

async function fetchWorker(path: string, init: RequestInit = {}): Promise<Response> {
  const request = new IncomingRequest(`https://agentwatch.test${path}`, init);
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

function adminHeaders(extra?: HeadersInit): HeadersInit {
  return { authorization: "Bearer test-admin-token", ...extra };
}

describe("worker HTTP", () => {
  it("serves health and a read-only status page", async () => {
    const health = await fetchWorker("/health");
    expect(health.status).toBe(200);
    expect(await health.text()).toBe("ok");

    const page = await fetchWorker("/");
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toContain("text/html");
    expect(await page.text()).toContain("agentwatch");
  });

  it("rejects admin calls without a token", async () => {
    const response = await fetchWorker("/admin/monitors");
    expect(response.status).toBe(401);
  });

  it("creates a monitor and accepts GET/POST pings", async () => {
    const created = await fetchWorker("/admin/monitors", {
      method: "POST",
      headers: adminHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({
        name: "supabase-keepalive",
        cron: "0 */6 * * *",
        graceSeconds: 300,
        maxRuntimeSeconds: 60,
      }),
    });
    expect(created.status).toBe(201);
    const body = (await created.json()) as {
      pingToken: string;
      urls: { start: string; success: string; fail: string };
    };

    const start = await fetchWorker(`/ping/${body.pingToken}/start`, { method: "POST" });
    expect(start.status).toBe(200);
    expect(await start.text()).toBe("ok");

    const success = await fetchWorker(`/ping/${body.pingToken}`);
    expect(success.status).toBe(200);

    const listed = await fetchWorker("/admin/monitors", { headers: adminHeaders() });
    const payload = (await listed.json()) as { monitors: Array<{ status: string; name: string }> };
    expect(payload.monitors[0]?.name).toBe("supabase-keepalive");
    expect(payload.monitors[0]?.status).toBe("ok");

    const publicStatus = await fetchWorker("/api/status");
    const statusBody = await publicStatus.text();
    expect(statusBody).toContain("supabase-keepalive");
    expect(statusBody).not.toContain(body.pingToken);
  });
});
