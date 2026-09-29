-- Perkiraan alamat (reverse geocoding dari koordinat) untuk presensi gerbang guru.
-- Diisi worker saat presensi dicatat dan sebagai isi susulan pada halaman
-- monitoring kepala sekolah; koordinat mentah tetap tersimpan.
--
-- Terapkan (sesudah 0002):
--   npx wrangler d1 execute presensi-db --local  --file migrasi/0003_alamat_presensi_guru.sql
--   npx wrangler d1 execute presensi-db --remote --file migrasi/0003_alamat_presensi_guru.sql
--
-- CATATAN: `alter table … add column` tidak idempoten — menjalankannya dua kali
-- di database yang sama gagal dengan "duplicate column name".

alter table presensi_gerbang_guru add column alamat text;
