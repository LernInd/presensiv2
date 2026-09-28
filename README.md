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
| `GET /api/jadwal-hari-ini` | cookie | jadwal mengajar guru hari ini; menerapkan `jadwal_pelajaran` → `sesi_pembelajaran` sekali per sesi (idempoten) |
| `GET /api/sesi/:id` | cookie | detail satu sesi (dijaga `bolehMembukaSesi`) |
| `GET /api/sesi/:id/presensi` | cookie | roster sesi; disemai sekali dari roster Supabase + `presensi_harian`/`surat_sakit`/`izin_santri` hari itu |
| `PATCH /api/sesi/:id/presensi/:santriId` | cookie | ubah status (`hadir`/`izin`/`alfa`); menolak bila terkunci surat sakit/izin (409), atau bila status berubah tanpa keterangan (400) |
| `POST /api/presensi/:tipe/pratinjau` | cookie (guru) | `:tipe` = `masuk`/`pulang`; pratinjau QR/manual sebelum dicatat — jalan yang sama dengan pencatatan |
| `POST /api/presensi/:tipe` | cookie (guru) | catat presensi gerbang, idempoten (`on conflict do nothing` + PK) |
| `GET /api/santri/cari?q=` | cookie (guru) | pencarian manual, minimal 3 huruf, 5 hasil paling relevan, dibatasi lembaga aktif |
| `GET /api/pengaturan/hari` | cookie (admin) | hari aktif per minggu + daftar tanggal libur lembaga |
| `PUT /api/pengaturan/hari` | cookie (admin) | simpan hari aktif (daftar 1–7) |
| `POST /api/pengaturan/hari/libur` | cookie (admin) | tambah/ubah tanggal libur (upsert per tanggal) |
| `DELETE /api/pengaturan/hari/libur/:tanggal` | cookie (admin) | hapus tanggal libur |
| `GET /api/pengaturan/kelas` | cookie (admin) | daftar kelas lembaga (untuk dropdown) |
| `GET /api/pengaturan/guru` | cookie (admin) | daftar guru lembaga (untuk penanggung jawab) |
| `GET /api/pengaturan/jadwal?kelas_id=&hari=` | cookie (admin) | jadwal satu kelas pada satu hari |
| `POST /api/pengaturan/jadwal` | cookie (admin) | tambah baris jadwal (409 bila bentrok jam di kelas+hari yang sama) |
| `PATCH /api/pengaturan/jadwal/:id` | cookie (admin) | ubah baris jadwal |
| `DELETE /api/pengaturan/jadwal/:id` | cookie (admin) | hapus baris jadwal |

Rute baru yang butuh login cukup didaftarkan setelah `app.use("*", pemanggil)`
di `src/worker/index.ts`, lalu pakai `c.get("orang")` (`peran`, `lembagaBoleh`,
`tingkat`, `bolehLembaga()`, `bolehAtur()`) dan `c.get("token")` untuk PostgREST.

## Struktur

```
src/worker/
  index.ts                 header keamanan, cek Origin, rute, penanganan galat
  routes/masuk.ts          /masuk & /keluar: validasi, rate limit, jeda, cookie
  routes/pelajaran.ts      jadwal hari ini, detail sesi, roster, ubah status
  middleware/pemanggil.ts  sesi cookie → verifikasi/segarkan token → orang
  lib/pengguna.ts          muat profil + peran presensi + lembaga
  lib/peran.ts             PERAN_PRESENSI, tingkat, pemetaan lembaga
  lib/validasi.ts          validasi daftar-putih kredensial
  lib/auth.ts              verifikasi JWT Supabase (jose + JWKS)
  lib/authSupabase.ts      login / refresh / logout ke Supabase Auth
  lib/sesi.ts              cookie HttpOnly sesi
  lib/supabase.ts          PostgREST dengan token pengguna
  lib/waktu.ts             tanggal/hari/jam dari zona lembaga, bukan UTC D1
  lib/jadwal.ts            terapkan jadwal_pelajaran → sesi_pembelajaran hari ini
  lib/pembelajaran.ts      bolehMembukaSesi, seed roster, kunci sakit/izin, validasi status
  lib/pengaturanLembaga.ts baca/simpan jam gerbang/hari aktif per lembaga
  lib/presensiHarian.ts    siapkanScan (satu jalan pratinjau+catat), idempoten
  lib/pencarianSantri.ts   pencarian ≥3 huruf, skor relevansi, top 5, dibatasi lembaga
  lib/hariLibur.ts         CRUD tanggal libur per lembaga (tabel baru, additive)
  lib/validasiPembelajaran.ts validasi daftar-putih hari aktif/libur/baris jadwal
  lib/jadwalPelajaranAdmin.ts CRUD jadwal_pelajaran admin; jam_ke selalu diturunkan
                           ulang dari urutan `mulai` lewat hapus-lalu-sisip satu grup
                           (lembaga_id, kelas_id, hari) dalam satu `DB.batch()`
  routes/pengaturanPembelajaran.ts /pengaturan/hari, /pengaturan/jadwal, dst.
                           — khusus tingkat admin (`lembagaAdmin()`), nama
                           kelas/guru dari klien selalu diverifikasi ulang ke
                           Supabase, tidak pernah dipercaya begitu saja
src/react-app/
  components/FormMasuk.tsx form login, validasi per kolom, jeda 2 dtk, pop-up
  components/Dialog.tsx    pop-up <dialog> native (kredensial salah, batas percobaan)
  components/PilihPeran.tsx halaman pilih peran, tampil saat peran > 1
  components/Topbar.tsx    brand, identitas pengguna, keluar, tombol menu (mobile)
  components/Sidebar.tsx   navigasi: Guru, Siswa, Pelajaran, + Pembelajaran
                           khusus tingkat admin (off-canvas di ponsel)
  components/KotakJadwalHariIni.tsx box jadwal, dipakai Dashboard & Jam Pelajaran
  components/HalamanBelumTersedia.tsx placeholder untuk rute yang belum dibangun
  lib/router.ts            router minimal berbasis History API (tanpa dependensi)
  pages/Dashboard.tsx      peran aktif + kotak jadwal (khusus tingkat guru)
  pages/JamPelajaran.tsx   daftar sesi hari ini + roster ambil-presensi per sesi
  pages/MasukGuru.tsx, PulangGuru.tsx  placeholder — fungsi baru, belum dibangun
  pages/MasukSiswa.tsx, PulangSiswa.tsx  bungkus tipis PresensiSiswaHalaman
  pages/Hari.tsx           admin: toggle hari aktif + CRUD tanggal libur
  pages/JadwalPelajaran.tsx admin: pilih kelas + tab hari, CRUD jam pelajaran
                           (mapel, jam mulai/selesai, penanggung jawab)
  components/PresensiSiswaHalaman.tsx  toggle Pindai QR / Absen Manual + pop-up konfirmasi
  components/PemindaiQr.tsx    kamera + BarcodeDetector bawaan (tanpa dependensi jsQR)
  components/PencarianSiswa.tsx  input ≥3 huruf, daftar 5 hasil dari server
  components/KonfirmasiScan.tsx  pop-up: foto, nama, kelas, status, tombol Konfirmasi/Batal
  lib/api.ts, validasi.ts  fetch same-origin, aturan validasi (cermin server)
```

## Alur setelah login

- **1 peran** → langsung ke Dashboard, peran itu otomatis aktif.
- **>1 peran** → diarahkan ke halaman **Pilih Peran** (`PilihPeran.tsx`); menekan salah satu peran langsung mengaktifkannya dan lanjut ke Dashboard. Tombol "Ganti peran" di Dashboard kembali ke halaman ini tanpa perlu login ulang.

## Sidebar & rute halaman

| Kategori | Sub | Rute | Status |
| --- | --- | --- | --- |
| — | Dashboard | `/` | peran aktif + jadwal mengajar hari ini (tingkat guru) |
| Guru | Masuk / Pulang | `/masukguru`, `/pulangguru` | placeholder — fungsi baru, belum dibangun |
| Siswa | Masuk / Pulang | `/masuksiswa`, `/pulangsiswa` | **Pindai QR** (utama) atau **Absen Manual** (cadangan), keduanya lewat pop-up konfirmasi |
| Pelajaran | Jam Pelajaran | `/jampelajaran`, `/jampelajaran?sesi=<id>` | daftar sesi hari ini + ambil presensi kelas |
| Pembelajaran *(khusus admin)* | Hari | `/hari` | hari aktif per minggu + tanggal libur manual |
| Pembelajaran *(khusus admin)* | Jadwal Pelajaran | `/jadwalpelajaran` | atur mapel/penanggung jawab/jam per kelas per hari |

Rute-rute ini adalah URL sungguhan (bukan hash), ditangani `lib/router.ts` di
sisi klien. Reload langsung di jalur mana pun tetap berfungsi karena Worker
(`not_found_handling: single-page-application`, `run_worker_first: ["/api/*"]`
di `wrangler.json`) dan Vite dev sama-sama jatuh ke `index.html` untuk apa pun
selain `/api/*`.

### Jam Pelajaran — logika yang diporting dari presensi-api lama

- `jadwal_pelajaran` → `sesi_pembelajaran` diterapkan lazy saat guru membuka
  dashboard/Jam Pelajaran hari itu (`on conflict do nothing` + indeks unik
  parsial `sesi_unik_idx`), bukan lewat cron — aman dipanggil berkali-kali.
- Roster kelas disemai sekali dari `v_santri` (Supabase) + status hari itu:
  **sakit** (surat aktif) mengalahkan **izin** (disetujui ndalem), keduanya
  mengalahkan hasil pindai **masuk** dari `presensi_harian`; selain itu **alfa**.
  Jadi status awal hanya empat kemungkinan: **hadir** (sudah scan masuk hari
  itu, termasuk yang terlambat), **alfa** (belum scan masuk sama sekali),
  **sakit**, atau **izin** — lihat tabel keterangan lengkap di bawah.
- **Tidak Hadir** bukan status otomatis — guru memilihnya secara manual lewat
  "Ubah status" saat santri sudah scan masuk (jadi bukan alfa) tapi tidak
  mengikuti pelajaran tersebut. Nilai `status` di `presensi_pembelajaran`
  (tabel produksi bersama) di-`ALTER`-CHECK lewat pembangunan ulang tabel
  (`create table baru → copy → drop → rename`, diverifikasi dulu di D1 lokal
  dan dicocokkan baris-per-baris sebelum ditukar di produksi) untuk menambah
  nilai ini; `status_awal` sengaja **tidak** ikut diubah karena tidak pernah
  diisi otomatis dengan "tidak_hadir".
- Guru tidak bisa menandai `sakit` (hanya lahir dari surat modul kesehatan).
  Mengubah status ke selain status awal mewajibkan keterangan — ditegakkan
  CHECK di D1 dan diperiksa ulang di `lib/pembelajaran.ts` untuk pesan yang ramah.
- Status yang terkunci surat sakit/izin disetujui **dicek ulang ke tabel
  sungguhan** saat PATCH (bukan hanya `status_awal` yang bisa basi), dan
  ditolak 409.
- Tiap perubahan nyata menulis `presensi_pembelajaran` + `riwayat_presensi`
  dalam satu `DB.batch()`, supaya baris dan jejaknya tidak pernah menyimpang.
- Di layar (`pages/JamPelajaran.tsx`), tiap santri tampil sebagai nama +
  lencana status ringkas; tombol "Ubah status" baru memunculkan pilihan lain
  saat ditekan (bukan selalu menampilkan semua tombol status berjajar),
  supaya tetap rapi di layar ponsel walau sekarang ada 4 pilihan.

#### Tabel keterangan status

| Status | Kapan diberikan | Sumber | Bisa diubah guru? |
| --- | --- | --- | --- |
| **Hadir** | Sudah scan masuk hari itu (termasuk yang terlambat) | Otomatis dari `presensi_harian` (scan gerbang) | Ya |
| **Alfa** | Belum scan masuk sama sekali hari itu | Otomatis (fallback) | Ya |
| **Tidak Hadir** | Sudah scan masuk di gerbang, tapi tidak hadir di pelajaran ini | Dipilih manual lewat "Ubah status" | Ya |
| **Sakit** | Punya surat sakit aktif yang disetujui | Otomatis, hanya dari modul kesehatan | Tidak — terkunci |
| **Izin** | Izin disetujui ndalem (`izin_santri`) | Otomatis, hanya dari aplikasi perizinan | Tidak — terkunci |

### Siswa Masuk/Pulang — Pindai QR (utama) & Absen Manual (cadangan)

- Toggle di atas halaman menentukan sumber santri; keduanya berujung ke
  fungsi server yang sama, `siapkanScan` — pratinjau dan pencatatan **melewati
  jalan yang sama**, jadi penolakan yang tampil di pop-up pasti berlaku juga
  saat dikonfirmasi.
- **Pindai QR**: kode `SANTRI:<uuid>` dibaca via `BarcodeDetector` bawaan
  peramban (tanpa dependensi `jsQR` tambahan). Kode sama diabaikan 3 detik,
  dan kamera dijeda selama pop-up konfirmasi terbuka.
- **Absen Manual**: pencarian nama minimal 3 huruf, dipicu tombol/ikon cari
  (bukan otomatis saat mengetik), server mengembalikan maksimal 5 hasil
  terurut skor relevansi (cocok persis → awalan nama → awalan salah satu
  kata → mengandung kata), dibatasi ke lembaga peran aktif saja.
- **"GuruSMK hanya bisa scan siswa SMK, dst."** ditegakkan di server
  (`siapkanScan`), bukan cuma di layar pencarian — kartu QR dari lembaga lain
  pun ditolak 403, karena santri dicocokkan ke `orang.lembagaBoleh` sebelum
  apa pun lain diproses.
- **Pop-up konfirmasi** menampilkan foto, nama, dan kelas sebelum status
  benar-benar ditulis; tiga bentuk: siap dikonfirmasi, diblokir (dengan
  alasan — hari libur, terlalu awal, sedang sakit/izin, jam gerbang belum
  diatur), atau sudah tercatat sebelumnya (idempoten, tidak ditimpa).
- Presensi gerbang tidak pernah menulis status `sakit`/`izin` — bila santri
  sedang sakit/izin, tombol Konfirmasi tidak muncul sama sekali (wilayah itu
  milik modul kesehatan/perizinan, belum dibangun di sini).

### Pembelajaran — khusus tingkat admin (`adminpresensi{smk,mts,ma,madin}`)

- **Hari**: toggle hari aktif (1–7, disimpan sebagai CSV di
  `pengaturan_lembaga.hari_aktif`) + tabel tanggal libur manual di tabel baru
  `hari_libur` (additive — bukan mengubah tabel lama, hanya dibaca-tulis
  presensiv2). Tanggal libur mengalahkan hari aktif mingguan: `jadwal-hari-ini`
  dan `siapkanScan` (pindai gerbang) sama-sama memeriksa `hari_libur` sebelum
  menerapkan jadwal/menerima presensi hari itu.
- **Jadwal Pelajaran**: pilih kelas lalu tab hari (Senin–Minggu), CRUD baris
  `jadwal_pelajaran` (mapel, jam mulai/selesai, penanggung jawab opsional).
  Peran guru penanggung jawab diambil dari `peran_lembaga.tingkat='guru'` milik
  lembaga yang sama (bukan tebakan pola nama peran, karena akhiran peran admin
  `madin` tidak cocok teks dengan akhiran peran guru `diniyah`).
  - Jam tumpang tindih di kelas+hari yang sama ditolak 409 sebelum ditulis.
  - `jam_ke` tidak pernah datang dari klien — selalu diturunkan ulang dari
    urutan `mulai` sesudah tiap tambah/ubah/hapus, dengan menulis ulang
    **seluruh isi grup** (lembaga_id, kelas_id, hari) dalam satu
    hapus-lalu-sisip `DB.batch()`. Ini sengaja dipilih setelah pengujian
    langsung ke D1 lokal menemukan bahwa UPDATE bertahap atau nilai
    sementara di luar `CHECK (jam_ke between 1 and 20)` sama-sama bisa
    menabrak constraint saat dua baris perlu bertukar nomor.
  - Karena penomoran ulang bisa mengubah `jam_ke` baris lain yang sedang
    tampil, layar mengambil ulang seluruh daftar hari itu dari server
    sesudah tiap mutasi alih-alih menambal satu baris secara lokal.

## Deploy

```bash
npm run build && npm run deploy
```

Perintah di atas harus dijalankan dari mesin yang sudah `wrangler login` ke
akun Cloudflare terkait (bukan dari sandbox pengembangan ini, yang tidak
memiliki kredensial deploy). Belum ada CI/CD di repo ini — setiap kali kode
berubah, `npm run deploy` perlu dijalankan ulang secara manual agar Worker
produksi memakai versi terbaru.
