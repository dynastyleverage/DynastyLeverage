const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const dataDir = path.join(__dirname, "..", "data");
const dbPath = path.join(dataDir, "dynasty.db");
const seedPath = path.join(dataDir, "seed-values.json");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const assets = JSON.parse(fs.readFileSync(seedPath, "utf8"));
const db = new DatabaseSync(dbPath);

db.exec(`
  DROP TABLE IF EXISTS assets;

  CREATE TABLE assets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    team TEXT NOT NULL,
    position TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('player', 'pick')),
    value INTEGER NOT NULL,
    age REAL,
    tier INTEGER NOT NULL
  );

  CREATE INDEX idx_assets_value ON assets(value DESC);
  CREATE INDEX idx_assets_name ON assets(name);
`);

const insert = db.prepare(`
  INSERT INTO assets (id, name, team, position, type, value, age, tier)
  VALUES (@id, @name, @team, @position, @type, @value, @age, @tier)
`);

db.exec("BEGIN");
try {
  for (const row of assets) insert.run(row);
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}
console.log(`Seeded ${assets.length} assets into ${dbPath}`);
