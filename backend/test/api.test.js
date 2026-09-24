import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";
import { User } from "../src/models/User.js";
import { Track } from "../src/models/Track.js";

let server, base;

test.before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => server.close());

test("health sans dépendre de MongoDB", async () => {
  const r = await fetch(base + "/api/health");
  assert.equal(r.status, 200);
  assert.equal((await r.json()).status, "ok");
});

test("schémas Mongoose et relation", () => {
  const u = new User({
    name: "Test",
    email: "TEST@example.com",
    password: "12345678",
  });

  assert.equal(u.email, "test@example.com");
  const t = new Track({
    ownerId: new mongoose.Types.ObjectId(),
    title: "Blues",
    originalName: "b.mp3",
    storedName: "x.mp3",
    mimeType: "audio/mpeg",
    size: 42,
  });
  
  assert.equal(t.title, "Blues");
  assert.equal(Track.schema.path("ownerId").options.ref, "User");
});

/*
 * Extension TP3 Mission 7 — tests de contrat et de sécurité.
 *
 * Ces tests n'ajoutent ni ne modifient aucune route : ils vérifient que le
 * contrat annoncé dans API_CONTRACT.md est respecté. Ils fonctionnent SANS
 * MongoDB, car chacun des cas testés est rejeté avant le moindre accès à la
 * base : le middleware `auth` ne fait que vérifier la signature du JWT, et
 * Multer refuse un fichier absent ou d'un mauvais type avant tout Track.create.
 */

// Même valeur par défaut que dans src/app.js : `npm test` ne charge pas .env,
// les tests signent donc des jetons avec le secret de développement.
const SECRET = process.env.JWT_SECRET || "tp1-development-secret";

/** Fabrique un JWT valide sans passer par la route de connexion. */
function signToken(sub = new mongoose.Types.ObjectId().toString()) {
  return jwt.sign({ sub, email: "demo@example.com" }, SECRET, {
    expiresIn: "2h",
  });
}

test("GET /api/tracks sans JWT renvoie 401", async () => {
  const r = await fetch(base + "/api/tracks");

  assert.equal(r.status, 401);
  assert.equal((await r.json()).message, "Authentification requise");
});

test("GET /api/tracks avec un JWT invalide renvoie 401", async () => {
  const r = await fetch(base + "/api/tracks", {
    headers: { Authorization: "Bearer jeton.completement.invalide" },
  });

  assert.equal(r.status, 401);
  assert.equal((await r.json()).message, "Jeton invalide ou expiré");
});

test("GET /api/tracks avec un JWT signé par un autre secret renvoie 401", async () => {
  // Un attaquant qui fabrique un token sans connaître le secret est rejeté :
  // c'est la signature, et non le contenu du token, qui est vérifiée.
  const forged = jwt.sign({ sub: "1", email: "x@y.z" }, "mauvais-secret");
  const r = await fetch(base + "/api/tracks", {
    headers: { Authorization: `Bearer ${forged}` },
  });

  assert.equal(r.status, 401);
});

test("GET /api/tracks sans le préfixe Bearer renvoie 401", async () => {
  const r = await fetch(base + "/api/tracks", {
    headers: { Authorization: signToken() },
  });

  assert.equal(r.status, 401);
  assert.equal((await r.json()).message, "Authentification requise");
});

test("POST /api/tracks sans fichier renvoie 400", async () => {
  const body = new FormData();
  body.append("title", "Sans fichier");

  const r = await fetch(base + "/api/tracks", {
    method: "POST",
    headers: { Authorization: `Bearer ${signToken()}` },
    body,
  });

  assert.equal(r.status, 400);
  assert.equal((await r.json()).message, "Fichier audio requis");
});

test("POST /api/tracks avec un type MIME refusé renvoie 400", async () => {
  const body = new FormData();
  body.append("title", "Pas de l'audio");
  body.append("audio", new Blob(["texte"], { type: "text/plain" }), "note.txt");

  const r = await fetch(base + "/api/tracks", {
    method: "POST",
    headers: { Authorization: `Bearer ${signToken()}` },
    body,
  });

  assert.equal(r.status, 400);
  assert.equal((await r.json()).message, "Format audio non accepté");
});

test("DELETE /api/tracks/:id sans JWT renvoie 401", async () => {
  const r = await fetch(base + "/api/tracks/000000000000000000000000", {
    method: "DELETE",
  });

  assert.equal(r.status, 401);
});

test("GET /api/tracks/:id/audio sans JWT renvoie 401", async () => {
  const r = await fetch(base + "/api/tracks/000000000000000000000000/audio");

  assert.equal(r.status, 401);
});

test("PUT /api/users/me sans JWT renvoie 401", async () => {
  const r = await fetch(base + "/api/users/me", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Pirate" }),
  });

  assert.equal(r.status, 401);
});
