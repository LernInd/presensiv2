-- Validasi presensi guru oleh kepala sekolah (ksmts, ksma, kssmk, ksmadin):
-- presensi dapat ditandai tidak valid dengan keterangan wajib, dan setiap
-- perubahan tercatat di riwayat. Additive; baris lama otomatis valid (default 1).
--
-- Terapkan (sesudah 0001):
--   npx wrangler d1 execute presensi-db --local  --file migrasi/0002_validasi_presensi_guru.sql
--   npx wrangler d1 execute presensi-db --remote --file migrasi/0002_validasi_presensi_guru.sql
--
-- CATATAN: `alter table … add column` tidak idempoten — menjalankan berkas ini
-- dua kali di database yang sama gagal dengan "duplicate column name".
-- Bagian `create table/index if not exists` di bawah aman diulang.

alter table presensi_gerbang_guru
  add column valid integer not null default 1 check (valid in (0, 1));
alter table presensi_gerbang_guru add column catatan_validasi text;
alter table presensi_gerbang_guru add column divalidasi_oleh text;
alter table presensi_gerbang_guru add column divalidasi_oleh_nama text;
alter table presensi_gerbang_guru add column divalidasi_pada text;  -- ISO-8601 UTC

-- Jejak audit setiap perubahan valid/invalid oleh kepala sekolah.
create table if not exists riwayat_validasi_guru (
  id integer primary key autoincrement,
  tanggal text not null,
  guru_id text not null,
  tipe text not null check (tipe in ('masuk','pulang')),
  lembaga_id text not null,
  dari_valid integer not null,
  ke_valid integer not null,
  keterangan text not null check (length(trim(keterangan)) > 0),
  oleh text not null,
  oleh_nama text not null,
  pada text not null                     -- ISO-8601 UTC
);

create index if not exists riwayat_validasi_guru_idx
  on riwayat_validasi_guru (lembaga_id, tanggal);
