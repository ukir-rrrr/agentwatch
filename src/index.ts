import { runDeadlineChecks } from "./checker";
import { json, requireAdmin, text } from "./http";
import { handleAdmin } from "./routes/admin";
import { handlePing, type PingAction } from "./routes/ping";
import { handleStatusJson, handleStatusPage } from "./routes/status";

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const now = Date.now();

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/status")) {
      return handleStatusPage(env);
    }
    if (request.method === "GET" && url.pathname === "/api/status") {
      return handleStatusJson(env);
    }
    if (request.method === "GET" && url.pathname === "/health") {
      return text("ok");
    }

    const ping = url.pathname.match(/^\/ping\/([0-9a-f]+)(?:\/(start|fail))?$/);
    if (ping) {
      if (request.method !== "GET" && request.method !== "POST") {
        return text("method not allowed", 405);
      }
      const action: PingAction = ping[2] === "start" ? "start" : ping[2] === "fail" ? "fail" : "success";
      return handlePing(env, ping[1], action, now);
    }

    const admin = url.pathname.match(/^\/admin\/monitors(?:\/([0-9a-f-]{36}))?$/);
    if (admin) {
      const unauthorized = requireAdmin(request, env);
      if (unauthorized) return unauthorized;
      return handleAdmin(request, env, admin[1], now);
    }

    return json({ error: "not found" }, 404);
  },

  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    await runDeadlineChecks(env, controller.scheduledTime || Date.now());
  },
} satisfies ExportedHandler<Env>;

export default worker;
