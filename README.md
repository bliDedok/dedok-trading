# Dedok Trading Assistant

Phase 0 foundation untuk dashboard crypto risk-first. Paper trading adalah mode bawaan dan live trading belum tersedia.

## Prasyarat
- Node.js 22+
- pnpm 11+
- Docker dan Docker Compose

## Menjalankan
```bash
cp .env.example .env
docker compose up -d postgres
pnpm install
pnpm db:generate
pnpm db:migrate -- --name phase_0_foundation
pnpm dev
```

Web: http://localhost:3000  
API health: http://localhost:4000/health

## Verifikasi
```bash
pnpm typecheck
pnpm test
pnpm build
curl http://localhost:4000/health
```

Jangan gunakan kredensial exchange dengan izin withdrawal. Jangan commit `.env`.
