# Presensi v2

Frontend presensi baru (React + Vite) dengan API Hono di Cloudflare Workers.
Menghubungkan dua database yang sudah ada:

| Database | Platform | Isi | Cara diakses |
| --- | --- | --- | --- |
| **activity-db** | Supabase (Postgres + Auth) | pengguna, peran, lembaga, kelas, santri | Login via Supabase Auth; worker membaca lewat PostgREST **memakai token pengguna** (RLS tetap berlaku) |
| **presensi-db** | Cloudflare D1 | presensi harian, sesi, jadwal, pengaturan, `peran_lembaga` | Hanya dari worker, lewat binding `DB` dengan prepared statement |

## Alur keamanan

```
Browser ──login (publishable key)──▶ Supabase Auth
   │ Authorization: Bearer <access_token>   (satu origin, tanpa CORS)
   ▼
Worker /api/*
  1. verifikasi JWT: ES256, JWKS Supabase, issuer + audience + exp
  2. profil & peran dari v_pengguna (token pengguna → RLS)
  3. peran → lembaga dari D1 `peran_lembaga`; header X-Peran hanya mempersempit
  4. query D1 dengan .bind(), jawaban selalu Cache-Control: no-store
```

- Tidak ada `service_role` key di mana pun.
- Browser tidak pernah menyentuh D1 secara langsung.
- Akun `is_active = false` ditolak.
- Schema presensi-db **dipakai bersama** worker `presensi-api`, `perizinan-api`, `kesehatan-api` — jangan diubah tanpa koordinasi.

## Variables & Secrets (wajib)

Konfigurasi **tidak disimpan di repo**. Isi di Cloudflare Dashboard →
Workers & Pages → `presensiv2` → Settings → **Variables and Secrets**:

| Nama | Jenis | Contoh |
| --- | --- | --- |
| `SUPABASE_URL` | Variable | `https://<project-ref>.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Secret | `sb_publishable_…` |
| `LOGIN_EMAIL_DOMAIN` | Variable | `admin-kegiatan.internal` |
| `ZONA` | Variable (opsional) | `Asia/Jakarta` |

Atau lewat CLI:

```bash
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY
npx wrangler secret put SUPABASE_URL
npx wrangler secret put LOGIN_EMAIL_DOMAIN
```

`wrangler.json` memakai `"keep_vars": true` agar `wrangler deploy` tidak
menghapus variabel yang diset di dashboard. Frontend membaca nilai publiknya
saat runtime dari `GET /api/config`, jadi tidak perlu `VITE_*` saat build.

## Pengembangan lokal

```bash
npm install
cp .dev.vars.example .dev.vars   # isi nilainya; .dev.vars tidak di-commit
npm run cf-typegen               # regenerasi tipe Env bila binding/variabel berubah
npm run dev
```

Catatan: saat `npm run dev`, binding `DB` memakai D1 **lokal** (kosong), bukan
presensi-db produksi. Isi data uji lokal dengan `npx wrangler d1 execute presensi-db --local --command "..."`.

## Endpoint yang tersedia

| Endpoint | Auth | Keterangan |
| --- | --- | --- |
| `GET /api/config` | publik | URL Supabase, publishable key, domain email login, zona |
| `GET /api/sehat` | publik | cek koneksi D1 |
| `GET /api/saya` | Bearer | profil, peran, lembaga yang boleh diakses, tingkat |

Rute baru yang butuh login cukup didaftarkan setelah `app.use("*", pemanggil)`
di `src/worker/index.ts`, lalu pakai `c.get("orang")` (`bolehLembaga`,
`bolehAtur`, `lembagaBoleh`, `tingkat`, `token`).

## Struktur

```
src/worker/
  index.ts                 rute Hono, header keamanan, penanganan galat
  middleware/pemanggil.ts  autentikasi + otorisasi per permintaan
  lib/auth.ts              verifikasi JWT Supabase (jose + JWKS)
  lib/supabase.ts          akses PostgREST dengan token pengguna
  lib/peran.ts             tingkat peran & pemetaan lembaga
  lib/env.ts, galat.ts     validasi env, kelas galat
src/react-app/
  lib/supabase.ts          klien Supabase dari /api/config, masuk/keluar
  lib/api.ts               fetch ke /api dengan Authorization + X-Peran
  App.tsx                  login & beranda (bukti koneksi)
```

## Deploy

```bash
npm run build && npm run deploy
```
