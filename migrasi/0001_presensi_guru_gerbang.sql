-- Presensi gerbang guru (foto + lokasi) dan tugas dinas. Additive: tidak
-- mengubah tabel milik worker lain (presensi-api, perizinan-api, kesehatan-api).
--
-- Terapkan (setelah diuji di D1 lokal):
--   npx wrangler d1 execute presensi-db --local  --file migrasi/0001_presensi_guru_gerbang.sql
--   npx wrangler d1 execute presensi-db --remote --file migrasi/0001_presensi_guru_gerbang.sql

create table if not exists presensi_gerbang_guru (
  tanggal text not null,                 -- 'YYYY-MM-DD' waktu setempat
  guru_id text not null,
  tipe text not null check (tipe in ('masuk','pulang')),
  lembaga_id text not null,
  guru_nama text not null,
  waktu text not null,                   -- ISO-8601 UTC, dari jam SERVER
  lat real not null,
  lng real not null,
  akurasi_m real,
  foto_key text,                         -- objek R2; null setelah dihapus 23:00 WIB
  primary key (tanggal, guru_id, tipe)
);

create index if not exists presensi_gerbang_guru_lembaga_idx
  on presensi_gerbang_guru (lembaga_id, tanggal);

create table if not exists tugas_dinas (
  id text primary key,
  lembaga_id text not null,
  guru_id text not null,
  guru_nama text not null,
  mulai text not null,                   -- 'YYYY-MM-DD'
  sampai text not null,                  -- 'YYYY-MM-DD', >= mulai
  keterangan text not null,
  dibuat_oleh text not null,
  dibuat_oleh_nama text not null,
  dibuat_pada text not null default (datetime('now')),
  check (sampai >= mulai)
);

create index if not exists tugas_dinas_guru_idx on tugas_dinas (guru_id, mulai, sampai);
create index if not exists tugas_dinas_lembaga_idx on tugas_dinas (lembaga_id, mulai);
