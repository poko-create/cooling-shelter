import { z } from "zod";

export interface Env {
  DB?: D1Database;
  CACHE?: KVNamespace;
  ORS_API_KEY?: string;
  STAFF_UPDATE_TOKEN?: string;
  AI_API_KEY?: string;
}

const availabilitySchema = z.object({
  shelterId: z.string().min(1),
  status: z.enum(["open", "busy", "full"]),
  token: z.string().optional()
});

const routeRequestSchema = z.object({
  coordinates: z.array(z.tuple([z.number(), z.number()])).length(2),
  preference: z.string().optional(),
  instructions: z.boolean().optional(),
  alternative_routes: z.object({
    target_count: z.number().int().min(1).max(3),
    share_factor: z.number().min(0).max(1),
    weight_factor: z.number().min(1)
  }).optional()
});

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }));
    }

    if (url.pathname === "/api/health") {
      return json({ ok: true });
    }

    if (url.pathname === "/api/config" && request.method === "GET") {
      return json({
        openRouteServiceConfigured: Boolean(env.ORS_API_KEY)
      });
    }

    if (url.pathname === "/api/availability" && request.method === "GET") {
      return getAvailability(env);
    }

    if (url.pathname === "/api/availability" && request.method === "POST") {
      return updateAvailability(request, env);
    }

    if (url.pathname === "/api/routes" && request.method === "POST") {
      return routeProxy(request, env);
    }

    return json({ error: "Not found" }, 404);
  }
};

async function getAvailability(env: Env) {
  if (!env.DB) return json({ items: [] });

  const result = await env.DB.prepare(
    "select shelter_id as shelterId, status, updated_at as updatedAt from availability"
  ).all();

  return json({ items: result.results ?? [] });
}

async function updateAvailability(request: Request, env: Env) {
  const body = availabilitySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return json({ error: "Invalid request" }, 400);

  if (env.STAFF_UPDATE_TOKEN && body.data.token !== env.STAFF_UPDATE_TOKEN) {
    return json({ error: "Unauthorized" }, 401);
  }

  const updatedAt = new Date().toISOString();

  if (env.DB) {
    await env.DB.prepare(
      `insert into availability (shelter_id, status, updated_at)
       values (?1, ?2, ?3)
       on conflict(shelter_id) do update set status = excluded.status, updated_at = excluded.updated_at`
    ).bind(body.data.shelterId, body.data.status, updatedAt).run();

    await env.DB.prepare(
      "insert into availability_history (shelter_id, status, updated_at) values (?1, ?2, ?3)"
    ).bind(body.data.shelterId, body.data.status, updatedAt).run();
  }

  return json({
    shelterId: body.data.shelterId,
    status: body.data.status,
    updatedAt
  });
}

async function routeProxy(request: Request, env: Env) {
  if (!env.ORS_API_KEY) {
    return json({
      error: "OpenRouteService API key is not configured",
      code: "ORS_API_KEY_MISSING"
    }, 503);
  }

  const requestJson = await request.json().catch(() => null);
  const parsed = routeRequestSchema.safeParse(requestJson);
  if (!parsed.success) {
    return json({
      error: "Invalid route request",
      code: "INVALID_ROUTE_REQUEST",
      issues: parsed.error.issues
    }, 400);
  }

  const upstream = await fetch("https://api.openrouteservice.org/v2/directions/foot-walking/geojson", {
    method: "POST",
    headers: {
      "Authorization": env.ORS_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(parsed.data)
  });

  if (!upstream.ok) {
    const upstreamText = await upstream.text().catch(() => "");
    return json({
      error: "OpenRouteService request failed",
      code: "ORS_UPSTREAM_ERROR",
      status: upstream.status,
      detail: upstreamText.slice(0, 800)
    }, upstream.status);
  }

  return withCors(new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/json"
    }
  }));
}

function json(payload: unknown, status = 200) {
  return withCors(new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  }));
}

function withCors(response: Response) {
  const next = new Response(response.body, response);
  next.headers.set("Access-Control-Allow-Origin", "*");
  next.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  next.headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
  return next;
}
