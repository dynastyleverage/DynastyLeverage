const fs = require("fs");
const http = require("http");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const port = process.env.PORT || 3000;
const adminToken = process.env.ADMIN_TOKEN || "change-me";
const dbPath = path.join(__dirname, "..", "data", "dynasty.db");
const publicDir = path.join(__dirname, "..", "public");
const db = new DatabaseSync(dbPath);

function formatAsset(row) {
  return {
    id: row.id,
    name: row.name,
    team: row.team,
    position: row.position,
    type: row.type,
    value: row.value,
    age: row.age,
    tier: row.tier
  };
}

function validateAsset(asset, index) {
  const required = ["id", "name", "team", "position", "type", "value", "tier"];
  for (const field of required) {
    if (asset[field] === undefined || asset[field] === null || asset[field] === "") {
      throw new Error(`Row ${index + 1} is missing "${field}".`);
    }
  }

  if (!["player", "pick"].includes(asset.type)) {
    throw new Error(`Row ${index + 1} has type "${asset.type}". Use "player" or "pick".`);
  }

  if (!Number.isInteger(Number(asset.value)) || Number(asset.value) < 0) {
    throw new Error(`Row ${index + 1} needs a non-negative numeric value.`);
  }

  if (!Number.isInteger(Number(asset.tier)) || Number(asset.tier) < 1) {
    throw new Error(`Row ${index + 1} needs a positive numeric tier.`);
  }

  return {
    id: String(asset.id).trim(),
    name: String(asset.name).trim(),
    team: String(asset.team).trim().toUpperCase(),
    position: String(asset.position).trim().toUpperCase(),
    type: asset.type,
    value: Number(asset.value),
    age: asset.age === null || asset.age === undefined || asset.age === "" ? null : Number(asset.age),
    tier: Number(asset.tier)
  };
}

function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://localhost:${port}`);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const ext = path.extname(filePath);
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8"
  };
  res.writeHead(200, { "Content-Type": contentTypes[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

function getAssets(req, res) {
  const url = new URL(req.url, `http://localhost:${port}`);
  const q = String(url.searchParams.get("q") || "").trim().toLowerCase();
  const stmt = q
    ? db.prepare(`
        SELECT * FROM assets
        WHERE lower(name) LIKE @term
           OR lower(id) LIKE @term
           OR lower(team) LIKE @term
           OR lower(position) LIKE @term
        ORDER BY value DESC, name ASC
      `)
    : db.prepare("SELECT * FROM assets ORDER BY value DESC, name ASC");

  const rows = q ? stmt.all({ term: `%${q}%` }) : stmt.all();
  json(res, 200, rows.map(formatAsset));
}

async function evaluateTrade(req, res) {
  const body = await readBody(req);
  const sideA = Array.isArray(body.sideA) ? body.sideA : [];
  const sideB = Array.isArray(body.sideB) ? body.sideB : [];
  const ids = [...new Set([...sideA, ...sideB])];

  if (!ids.length) {
    return json(res, 200, {
      sideA: { total: 0, assets: [] },
      sideB: { total: 0, assets: [] },
      difference: 0,
      verdict: "Add assets to compare both sides."
    });
  }

  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT * FROM assets WHERE id IN (${placeholders})`)
    .all(...ids);
  const byId = new Map(rows.map((row) => [row.id, formatAsset(row)]));

  const pickAssets = (list) => list.map((id) => byId.get(id)).filter(Boolean);
  const assetsA = pickAssets(sideA);
  const assetsB = pickAssets(sideB);
  const totalA = assetsA.reduce((sum, asset) => sum + asset.value, 0);
  const totalB = assetsB.reduce((sum, asset) => sum + asset.value, 0);
  const difference = totalA - totalB;
  const absDiff = Math.abs(difference);
  const leader = difference > 0 ? "Side A" : "Side B";
  const verdict =
    absDiff <= 500
      ? "Fair deal"
      : absDiff <= 1500
        ? `${leader} has a slight edge`
        : `${leader} has a strong edge`;

  json(res, 200, {
    sideA: { total: totalA, assets: assetsA },
    sideB: { total: totalB, assets: assetsB },
    difference,
    verdict
  });
}

async function importAssets(req, res) {
  const body = await readBody(req);
  if (body.token !== adminToken) {
    return json(res, 401, { error: "Invalid admin token." });
  }

  const mode = body.mode === "replace" ? "replace" : "upsert";
  if (!Array.isArray(body.assets)) {
    return json(res, 400, { error: "Expected an assets array." });
  }

  const assets = body.assets.map(validateAsset);
  const ids = new Set();
  for (const asset of assets) {
    if (ids.has(asset.id)) {
      return json(res, 400, { error: `Duplicate id in import: ${asset.id}` });
    }
    ids.add(asset.id);
  }

  const before = db.prepare("SELECT COUNT(*) AS count FROM assets").get().count;
  const upsert = db.prepare(`
    INSERT INTO assets (id, name, team, position, type, value, age, tier)
    VALUES (@id, @name, @team, @position, @type, @value, @age, @tier)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      team = excluded.team,
      position = excluded.position,
      type = excluded.type,
      value = excluded.value,
      age = excluded.age,
      tier = excluded.tier
  `);

  db.exec("BEGIN");
  try {
    if (mode === "replace") db.exec("DELETE FROM assets");
    for (const asset of assets) upsert.run(asset);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  const after = db.prepare("SELECT COUNT(*) AS count FROM assets").get().count;
  json(res, 200, {
    mode,
    imported: assets.length,
    before,
    after,
    message: `${mode === "replace" ? "Replaced" : "Imported"} ${assets.length} assets.`
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url.startsWith("/api/assets")) {
      getAssets(req, res);
      return;
    }

    if (req.method === "POST" && req.url === "/api/trade/evaluate") {
      await evaluateTrade(req, res);
      return;
    }

    if (req.method === "POST" && req.url === "/api/admin/import") {
      await importAssets(req, res);
      return;
    }

    if (req.method === "GET") {
      serveStatic(req, res);
      return;
    }

    json(res, 405, { error: "Method not allowed" });
  } catch (error) {
    json(res, 500, { error: error.message });
  }
});

server.listen(port, () => {
  console.log(`Dynasty trade calculator running at http://localhost:${port}`);
});
