// Netlify Function — Persistance de l'état de démo partagé
// Stockage : Netlify Blobs (clé/valeur native)
// TTL : 3 jours, auto-reset si expiré
//
// Endpoints :
//   GET    /api/state?app=gluc          → lit l'état partagé (ou {empty:true} si jamais écrit)
//   POST   /api/state?app=gluc          → écrit l'état (body JSON), pose le timestamp serveur
//   DELETE /api/state?app=gluc          → réinitialise (efface l'état)
//
// Le param app accepte uniquement "gluc" ou "golac" pour cloisonner les deux démos.

import { getStore } from "@netlify/blobs";

const TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 jours

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

export default async (req) => {
  // Préflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const app = url.searchParams.get("app") || "";
  if (!["gluc", "golac"].includes(app)) {
    return json({ error: "Paramètre app invalide (attendu: gluc|golac)" }, 400);
  }

  let store;
  try {
    store = getStore({ name: "demo-state", consistency: "strong" });
  } catch (e) {
    return json({ error: "Blobs indisponible: " + e.message }, 500);
  }

  const key = `${app}-state`;

  // ── GET : lecture
  if (req.method === "GET") {
    try {
      const raw = await store.get(key);
      if (!raw) return json({ empty: true });
      const data = JSON.parse(raw);
      const initAt = data._serverInitAt || 0;
      const age = Date.now() - initAt;
      if (age > TTL_MS) {
        await store.delete(key);
        return json({ empty: true, expired: true, expiredAfterMs: age });
      }
      return json({
        data,
        serverInitAt: initAt,
        remainingMs: Math.max(0, TTL_MS - age),
        remainingDays: Math.max(0, Math.ceil((TTL_MS - age) / (24 * 60 * 60 * 1000))),
      });
    } catch (e) {
      return json({ error: "Lecture impossible: " + e.message }, 500);
    }
  }

  // ── POST : écriture
  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (!body || typeof body !== "object") {
        return json({ error: "Body JSON requis" }, 400);
      }
      // Préserve le timestamp d'origine si fourni, sinon premier-write = now
      const existing = await store.get(key);
      let initAt = Date.now();
      if (existing) {
        try {
          const parsed = JSON.parse(existing);
          if (parsed._serverInitAt && Date.now() - parsed._serverInitAt < TTL_MS) {
            initAt = parsed._serverInitAt;
          }
        } catch (_) {}
      }
      body._serverInitAt = initAt;
      body._serverLastWriteAt = Date.now();
      await store.set(key, JSON.stringify(body));
      return json({
        ok: true,
        serverInitAt: initAt,
        remainingMs: Math.max(0, TTL_MS - (Date.now() - initAt)),
      });
    } catch (e) {
      return json({ error: "Écriture impossible: " + e.message }, 500);
    }
  }

  // ── DELETE : réinitialisation
  if (req.method === "DELETE") {
    try {
      await store.delete(key);
      return json({ ok: true, reset: true });
    } catch (e) {
      return json({ error: "Suppression impossible: " + e.message }, 500);
    }
  }

  return json({ error: "Méthode non supportée" }, 405);
};

export const config = {
  path: "/api/state",
};
