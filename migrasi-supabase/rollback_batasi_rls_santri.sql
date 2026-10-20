-- Membatalkan 20261020_batasi_rls_santri_per_cakupan.sql: kembalikan policy SELECT
-- lama (semua pengguna terautentikasi) pada tiga tabel santri. Jalankan segera
-- bila ada aplikasi yang rusak. peran_cakupan dan boleh_santri() boleh dibiarkan
-- (tidak dipakai policy mana pun setelah ini) atau dihapus di akhir.

drop policy if exists santri_select_cakupan on public.santri;
create policy santri_select_authenticated on public.santri
  for select to authenticated using (true);

drop policy if exists santri_lembaga_select_cakupan on public.santri_lembaga;
create policy santri_lembaga_select_authenticated on public.santri_lembaga
  for select to authenticated using (true);

drop policy if exists santri_kelas_select_cakupan on public.santri_kelas;
create policy santri_kelas_select_authenticated on public.santri_kelas
  for select to authenticated using (true);

-- Opsional, setelah memastikan aplikasi pulih:
-- drop function if exists public.boleh_santri(uuid);
-- drop table if exists public.peran_cakupan;
