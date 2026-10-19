-- Ketidakhadiran guru: tabel `tugas_dinas` kini memuat tiga jenis — tugas dinas,
-- izin sakit, dan izin keperluan keluarga — dengan logika yang sama (guru tidak
-- diwajibkan presensi gerbang pada rentang tanggalnya). Nama tabel dipertahankan
-- agar migrasi 0001 tidak berubah; baris lama otomatis berjenis 'dinas'.
--
-- Terapkan (sesudah 0003):
--   npx wrangler d1 execute presensi-db --local  --file migrasi/0004_ketidakhadiran_guru.sql
--   npx wrangler d1 execute presensi-db --remote --file migrasi/0004_ketidakhadiran_guru.sql
--
-- CATATAN: `alter table … add column` tidak idempoten — menjalankannya dua kali
-- di database yang sama gagal dengan "duplicate column name".

alter table tugas_dinas
  add column jenis text not null default 'dinas' check (jenis in ('dinas', 'sakit', 'keluarga'));
