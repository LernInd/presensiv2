# Presensi v2

Frontend presensi baru (React + Vite) dengan API Hono di Cloudflare Workers.
Menghubungkan dua database yang sudah ada:

| Database | Platform | Isi | Cara diakses |
| --- | --- | --- | --- |
| **activity-db** | Supabase (Postgres + Auth) | pengguna, peran, lembaga, kelas, santri | Login lewat worker ke Supabase Auth; worker membaca PostgREST **memakai token pengguna** (RLS tetap berlaku) |
| **presensi-db** | Cloudflare D1 | presensi harian, sesi, jadwal, pengaturan, `peran_lembaga` | Hanya dari worker, lewat binding `DB` dengan prepared statement |

## Alur keamanan

```
Browser ──POST /api/masuk {username, password}──▶ Worker
  1. Origin wajib sama, JSON ≤ 1 KB, hanya field username & password
  2. Rate limit: 5/10 dtk per IP (≈1 per 2 dtk) dan 5/60 dtk per username
  3. Validasi daftar-putih (username ^[a-z0-9][a-z0-9._-]{2,29}$, sandi 6–72)
  4. Login ke Supabase Auth → cek akun aktif + peran presensi
  5. Gagal apa pun → 401 "Username atau kata sandi salah", ditahan ≥1 dtk
  6. Berhasil → cookie __Host-pv2_at / __Host-pv2_rt
     (HttpOnly, Secure, SameSite=Strict, tanpa Max-Age → hilang saat browser ditutup)
Permintaan berikutnya: cookie → verifikasi JWT (ES256/JWKS) → token kedaluwarsa
disegarkan otomatis di server → profil & peran (RLS) → D1 dengan .bind()
```

- **Peran yang boleh masuk** (`src/worker/lib/peran.ts` → `PERAN_PRESENSI`):
  `gurusmk`, `gurumts`, `guruma`, `gurudiniyah`, `adminpresensismk`,
  `adminpresensimts`, `adminpresensima`, `adminpresensimadin`. Peran lain
  ditolak dengan pesan yang sama seperti kredensial salah, dan sesi yang
  sempat terbit langsung dicabut. Aturan ini juga ditegakkan di setiap rute
  API, jadi token dari login langsung ke Supabase pun tidak bisa dipakai.
- Token **tidak pernah** sampai ke JavaScript, localStorage, atau sessionStorage.
- Tidak ada `service_role` key; browser tidak pernah menyentuh D1.
- Tidak ada SQL yang dirakit dari input: D1 memakai prepared statement,
  PostgREST menerima ID tervalidasi UUID, kredensial dikirim sebagai JSON.
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
menghapus variabel yang diset di dashboard. Frontend tidak membutuhkan
variabel apa pun (tidak ada `VITE_*`).

Rate limiting memakai binding `RL_LOGIN_IP` dan `RL_LOGIN_USER` (lihat
`wrangler.json`, `namespace_id` 2001/2002 harus unik di akun Cloudflare).

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
| `GET /api/config` | publik | zona waktu |
| `GET /api/sehat` | publik | cek koneksi D1 |
| `POST /api/masuk` | publik (rate limited) | login, memasang cookie sesi, mengembalikan profil + peran |
| `POST /api/keluar` | cookie | mencabut sesi di Supabase + menghapus cookie |
| `GET /api/saya` | cookie | profil, daftar peran presensi + lembaga |

Rute baru yang butuh login cukup didaftarkan setelah `app.use("*", pemanggil)`
di `src/worker/index.ts`, lalu pakai `c.get("orang")` (`peran`, `lembagaBoleh`,
`tingkat`, `bolehLembaga()`, `bolehAtur()`) dan `c.get("token")` untuk PostgREST.

## Struktur

```
src/worker/
  index.ts                 header keamanan, cek Origin, rute, penanganan galat
  routes/masuk.ts          /masuk & /keluar: validasi, rate limit, jeda, cookie
  middleware/pemanggil.ts  sesi cookie → verifikasi/segarkan token → orang
  lib/pengguna.ts          muat profil + peran presensi + lembaga
  lib/peran.ts             PERAN_PRESENSI, tingkat, pemetaan lembaga
  lib/validasi.ts          validasi daftar-putih kredensial
  lib/auth.ts              verifikasi JWT Supabase (jose + JWKS)
  lib/authSupabase.ts      login / refresh / logout ke Supabase Auth
  lib/sesi.ts              cookie HttpOnly sesi
  lib/supabase.ts          PostgREST dengan token pengguna
src/react-app/
  components/FormMasuk.tsx form login, validasi per kolom, jeda 2 dtk, pop-up
  components/Dialog.tsx    pop-up <dialog> native
  components/Beranda.tsx   profil + daftar peran
  lib/api.ts, validasi.ts  fetch same-origin, aturan validasi (cermin server)
```

## Deploy

```bash
npm run build && npm run deploy
```
