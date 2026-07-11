# Architecture

Modular monolith dalam pnpm monorepo dengan tiga deployable units: web, API, dan worker. Domain packages tidak bergantung pada framework. PostgreSQL adalah source of truth. Scheduler in-process dipakai pada MVP; kontrak job dibuat agar dapat dipindahkan ke BullMQ/Redis tanpa mengubah domain service.

## Data flow
Binance REST/WS -> Worker validation -> Candle storage -> Indicators -> Market structure/regime -> Strategies -> Hard filters -> Score -> Risk engine -> Signal -> AI explanation (optional) -> Telegram/dashboard -> Paper execution -> Journal/analytics/audit.

## Safety boundaries
AI hanya membaca snapshot terstruktur. Order adapter tidak tersedia pada Phase 0. Emergency stop default aktif. Secret hanya dari environment/runtime secret store.
