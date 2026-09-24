# wowpixel lab

Test bench for small apps and prototypes — **lab.wowpixel.app**.

A Turborepo monorepo (npm workspaces). Each folder under `apps/` is one
experiment and deploys as its **own Vercel project**; the hub lists them all.

## Structure

```
wowpixel-lab/
├── apps/
│   ├── hub/            # landing page → lab.wowpixel.app
│   └── arcade/         # 404-arcade game → arcade.lab.wowpixel.app
├── packages/
│   ├── ui/             # shared React components (Card, Button)
│   └── config/         # shared tsconfig base + eslint flat config
└── .github/workflows/ # CI: builds everything on push
```

## Local dev

```bash
npm install
npm run dev        # runs every app (turbo)
```

Open http://localhost:3000 for the hub.

## Add a new test app

1. Copy an existing app folder:
   ```bash
   cp -r apps/arcade apps/my-app
   ```
2. In `apps/my-app/package.json`, change `name` to `@wowpixel-lab/my-app`.
3. Build your app inside `apps/my-app/` (keep it a Next.js app so the
   Vercel preset works out of the box).
4. Add it to the hub: new entry in `apps/hub/lib/experiments.ts`
   with its public URL `https://my-app.lab.wowpixel.app`.
5. Commit and push.

## Push to GitHub (first time)

This repo is git-initialized with an initial commit. To publish it under
`@goandude`:

```bash
cd ~/workspace/wowpixel-lab
gh auth login                     # one-time: log in as goandude
gh repo create goandude/wowpixel-lab --public --source=. --remote=origin
git push -u origin main
```

## Deploy on Vercel

Each app is a **separate Vercel project** (so experiments deploy and scale
independently). Do this once per app:

1. `vercel login` (one-time)
2. In the Vercel dashboard: **Add New → Project → Import**
   `goandude/wowpixel-lab`, then set:
   - **Root Directory** → `apps/hub` (or `apps/arcade`, `apps/my-app`, …)
   - Framework preset → Next.js (auto-detected)
3. Deploy, then **Settings → Domains** → add:
   - hub → `lab.wowpixel.app`
   - arcade → `arcade.lab.wowpixel.app`
   - future apps → `<app>.lab.wowpixel.app`
4. DNS (one-time, at your registrar): add a wildcard so every future
   experiment resolves without new records —
   `CNAME *.lab → cname.vercel-dns.com`, plus `lab → 76.76.21.21`
   (or follow the exact values Vercel shows when you add the domain).

Every push to `main` redeploys all projects automatically.
