# Dynasty Trade Calculator

A starter dynasty fantasy football trade calculator website with player and rookie pick values stored in SQLite.

## Run locally

```bash
npm run seed
npm start
```

Open:

```text
http://localhost:3000
```

The app creates `data/dynasty.db` from `data/seed-values.json`.

## Admin import page

Start the app with an admin token:

```bash
$env:ADMIN_TOKEN="make-a-private-password"
npm start
```

Then open:

```text
http://localhost:3000/admin.html
```

Paste a JSON array of players/picks and choose:

- `Update/add players` to add new IDs or update matching IDs.
- `Replace all values` to delete old values and import only the pasted list.

Use this shape:

```json
[
  {
    "id": "patrick-mahomes",
    "name": "Patrick Mahomes",
    "team": "KC",
    "position": "QB",
    "type": "player",
    "value": 6700,
    "age": 30,
    "tier": 2
  }
]
```

## Manual value updates

This project uses Node's built-in SQLite support, so it does not need third-party npm packages. Edit `data/seed-values.json`, then run:

```bash
npm run seed
```

## API

- `GET /api/assets` returns all players and picks.
- `GET /api/assets?q=jefferson` filters assets.
- `POST /api/trade/evaluate` accepts `{ "sideA": ["player-id"], "sideB": ["pick-id"] }`.
- `POST /api/admin/import` imports player and pick values with `{ "token": "...", "mode": "upsert", "assets": [...] }`.

## Deploying with a GoDaddy domain

GoDaddy is your domain registrar. The app still needs Node hosting, such as Render, Railway, Fly.io, a VPS, or GoDaddy hosting that supports Node apps.

Deploy command:

```bash
npm run seed
npm start
```

Set an environment variable on the host:

```text
ADMIN_TOKEN=make-a-private-password
```

After the host gives you a public URL, update DNS for `dynastyleverage.com` at GoDaddy. Usually this means setting:

- `A` record for `@` if your host gives you an IP address.
- `CNAME` record for `www` if your host gives you a target hostname.
- Or the exact DNS records your hosting provider gives you.
