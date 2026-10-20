-- Batasi baca data santri per cakupan peran (gender / lembaga) di tingkat DATABASE.
--
-- Sebelumnya santri, santri_lembaga, dan santri_kelas memakai policy SELECT
-- `using (true)` untuk semua pengguna terautentikasi, sehingga siapa pun yang
-- punya akun dapat membaca seluruh santri lintas lembaga/gender lewat PostgREST.
-- Pembatasan "guru SMK hanya santri SMK" dsb. hanya ada di aplikasi.
--
-- Tabel acuan non-pribadi (lembaga, kelas, kamar, asrama, roles, wilayah) TIDAK
-- diubah. View (v_santri, v_kelas, …) berstatus security_invoker sehingga otomatis
-- mewarisi RLS ini. Peran tanpa baris di peran_cakupan tidak melihat santri sama
-- sekali (fail-closed) — peran baru HARUS diberi baris di sini.
--
-- Sumber kebenaran peran→lembaga untuk aplikasi presensi tetap D1 `peran_lembaga`;
-- tabel ini menduplikasinya untuk RLS. Ubah keduanya bersama.
--
-- Rollback: migrasi-supabase/rollback_batasi_rls_santri.sql

create table public.peran_cakupan (
  peran_code text primary key references public.roles(code) on update cascade on delete cascade,
  semua boolean not null default false,
  jenis_kelamin public.jenis_kelamin,                    -- laki_laki | perempuan
  lembaga_id uuid references public.lembaga(id) on delete cascade,
  constraint peran_cakupan_satu_cakupan check (
    num_nonnulls(jenis_kelamin, lembaga_id) <= 1
    and not (semua and num_nonnulls(jenis_kelamin, lembaga_id) > 0)
  )
);

comment on table public.peran_cakupan is
  'Cakupan baca data santri per peran (semua | gender | lembaga). Dipakai public.boleh_santri(); tidak dapat dibaca klien.';

alter table public.peran_cakupan enable row level security;   -- tanpa policy: hanya lewat fungsi definer
revoke all on public.peran_cakupan from anon, authenticated;

insert into public.peran_cakupan (peran_code, semua, jenis_kelamin, lembaga_id)
select r.code, v.semua, v.jk::public.jenis_kelamin, l.id
from (values
  ('admin_kegiatan',              true,  null,        null),
  ('admin_keuangan',              true,  null,        null),
  ('kesehatan',                   true,  null,        null),
  ('adminkesehatan',              true,  null,        null),
  ('adminperizinan',              true,  null,        null),
  ('psb_ma',                      true,  null,        null),
  ('psb_mts',                     true,  null,        null),
  ('psb_smk',                     true,  null,        null),
  ('psb_yayasan',                 true,  null,        null),
  ('kesehatanputra',              false, 'laki_laki', null),
  ('adminkesehatanputra',         false, 'laki_laki', null),
  ('adminperizinanputra',         false, 'laki_laki', null),
  ('ndalemputra',                 false, 'laki_laki', null),
  ('bendahara_putra',             false, 'laki_laki', null),
  ('fotografer_santribaru_putra', false, 'laki_laki', null),
  ('kesehatanputri',              false, 'perempuan', null),
  ('adminkesehatanputri',         false, 'perempuan', null),
  ('adminperizinanputri',         false, 'perempuan', null),
  ('ndalemputri',                 false, 'perempuan', null),
  ('bendahara_putri',             false, 'perempuan', null),
  ('fotografer_santribaru_putri', false, 'perempuan', null),
  ('gurusmk',                     false, null,        'SMK DARUN NAJAH'),
  ('adminpresensismk',            false, null,        'SMK DARUN NAJAH'),
  ('kssmk',                       false, null,        'SMK DARUN NAJAH'),
  ('gurumts',                     false, null,        'MTS DARUN NAJAH'),
  ('adminpresensimts',            false, null,        'MTS DARUN NAJAH'),
  ('ksmts',                       false, null,        'MTS DARUN NAJAH'),
  ('guruma',                      false, null,        'MA DARUN NAJAH'),
  ('adminpresensima',             false, null,        'MA DARUN NAJAH'),
  ('ksma',                        false, null,        'MA DARUN NAJAH'),
  ('gurudiniyah',                 false, null,        'MADRASAH DINIYAH'),
  ('adminpresensimadin',          false, null,        'MADRASAH DINIYAH'),
  ('ksmadin',                     false, null,        'MADRASAH DINIYAH')
) as v(kode, semua, jk, lembaga_nama)
join public.roles r on r.code = v.kode
left join public.lembaga l on l.nama = v.lembaga_nama;

-- Pengaman: setiap peran aktif punya cakupan, dan peran berlembaga benar-benar terpetakan.
do $$
begin
  if exists (
    select 1 from public.roles r
    where r.is_active and not exists (select 1 from public.peran_cakupan p where p.peran_code = r.code)
  ) then
    raise exception 'Ada peran aktif tanpa baris peran_cakupan: %',
      (select string_agg(r.code, ', ') from public.roles r
        where r.is_active and not exists (select 1 from public.peran_cakupan p where p.peran_code = r.code));
  end if;
  if exists (
    select 1 from public.peran_cakupan
    where peran_code ~ '^(guru|adminpresensi|ks)' and lembaga_id is null
  ) then
    raise exception 'Peran lembaga tanpa lembaga_id (nama lembaga tidak cocok)';
  end if;
end $$;

create or replace function public.boleh_santri(p_santri_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id and r.is_active
    join public.peran_cakupan pc on pc.peran_code = r.code
    where ur.user_id = (select auth.uid())
      and (
        pc.semua
        or (pc.jenis_kelamin is not null
            and pc.jenis_kelamin = (select s.jenis_kelamin from public.santri s where s.id = p_santri_id))
        or (pc.lembaga_id is not null
            and exists (select 1 from public.santri_lembaga sl
                        where sl.santri_id = p_santri_id and sl.lembaga_id = pc.lembaga_id))
      )
  );
$$;

revoke all on function public.boleh_santri(uuid) from public, anon;
grant execute on function public.boleh_santri(uuid) to authenticated;

drop policy santri_select_authenticated on public.santri;
create policy santri_select_cakupan on public.santri
  for select to authenticated using (public.boleh_santri(id));

drop policy santri_lembaga_select_authenticated on public.santri_lembaga;
create policy santri_lembaga_select_cakupan on public.santri_lembaga
  for select to authenticated using (public.boleh_santri(santri_id));

drop policy santri_kelas_select_authenticated on public.santri_kelas;
create policy santri_kelas_select_cakupan on public.santri_kelas
  for select to authenticated using (public.boleh_santri(santri_id));
