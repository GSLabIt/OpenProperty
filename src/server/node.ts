// Node entrypoint for self-hosting (Docker / Berth). Serves the API, the built
// SPA and a single-admin login (ADMIN_EMAIL / ADMIN_PASSWORD, signed cookie).
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createHmac, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import api from "./index";
import it, { refreshFoi } from "./it";

const SECRET = process.env.AUTH_SECRET ?? "";
const EMAIL = process.env.ADMIN_EMAIL ?? "";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "";
if (!SECRET || !EMAIL || !PASSWORD) {
  console.error("AUTH_SECRET, ADMIN_EMAIL and ADMIN_PASSWORD are required");
  process.exit(1);
}

const TTL = 7 * 24 * 3600;
const sign = (v: string) => createHmac("sha256", SECRET).update(v).digest("hex");
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

function validSession(token?: string): boolean {
  if (!token) return false;
  const [exp, mac] = token.split(".");
  return !!mac && same(mac, sign(exp)) && Number(exp) > Date.now() / 1000;
}

const LOGIN_PAGE = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>OpenProperty</title><body style="font-family:system-ui;max-width:320px;margin:15vh auto">
<h2>OpenProperty</h2><form method=post action=/login style="display:grid;gap:8px">
<input name=email type=email placeholder=Email required><input name=password type=password placeholder=Password required>
<button>Sign in</button></form>`;

const app = new Hono();

app.get("/api/health", (c) => c.json({ ok: true })); // unauthenticated: container healthcheck

app.get("/login", (c) => c.html(LOGIN_PAGE));
app.post("/login", async (c) => {
  const f = await c.req.parseBody();
  if (same(String(f.email ?? ""), EMAIL) && same(String(f.password ?? ""), PASSWORD)) {
    const exp = String(Math.floor(Date.now() / 1000) + TTL);
    setCookie(c, "op_session", `${exp}.${sign(exp)}`, { httpOnly: true, sameSite: "Lax", secure: true, path: "/", maxAge: TTL });
    return c.redirect("/");
  }
  return c.html(LOGIN_PAGE + "<p style=color:#b00>Invalid credentials</p>", 401);
});
app.post("/logout", (c) => {
  deleteCookie(c, "op_session", { path: "/" });
  return c.redirect("/login");
});

app.use("*", async (c, next) => {
  if (validSession(getCookie(c, "op_session"))) return next();
  return c.req.path.startsWith("/api/") ? c.json({ error: "Unauthorized" }, 401) : c.redirect("/login");
});

app.route("/", it);
app.route("/", api);
app.use("*", serveStatic({ root: "./dist" }));
app.get("*", (c) => c.html(fs.readFileSync("./dist/index.html", "utf8"))); // SPA fallback

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, () => console.log(`OpenProperty listening on :${port}`));

// Daily FOI refresh when a source URL is configured; failures are logged, never fatal.
setInterval(() => refreshFoi().catch((e) => console.error("FOI refresh:", e.message)), 24 * 3600 * 1000);
