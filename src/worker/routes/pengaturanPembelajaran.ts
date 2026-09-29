import { Hono } from "hono";
import { lembagaAdmin as lembagaAdminBersama } from "../lib/admin";
import { namaGuru } from "../lib/guruLembaga";
import { GagalRute } from "../lib/galat";
import { daftarLibur, hapusLibur, liburPadaTanggal, tambahLibur } from "../lib/hariLibur";
import {
	ambilBarisJadwal,
	daftarJadwal,
	hapusJadwal,
	tambahJadwal,
	ubahJadwal,
} from "../lib/jadwalPelajaranAdmin";
import { kodePeranGuruDiLembaga } from "../lib/peran";
import type { Orang } from "../lib/pengguna";
import { ambilPengaturan, simpanHariAktif } from "../lib/pengaturanLembaga";
import { guruDenganPeran, kelasDiLembaga, uuid } from "../lib/supabase";
import {
	periksaBadanJadwal,
	periksaBadanLibur,
	periksaHariAktif,
	periksaTanggal,
} from "../lib/validasiPembelajaran";
import type { AppEnv } from "../middleware/pemanggil";

export const pengaturanPembelajaran = new Hono<AppEnv>();

// Seluruh halaman "Pembelajaran" (Hari + Jadwal Pelajaran) khusus tingkat
// admin — sejalan dengan presensi-api lama: mengatur jadwal adalah wilayah
// adminpresensi, bukan guru.
const lembagaAdmin = (orang: Orang) =>
	lembagaAdminBersama(orang, "Hanya admin presensi yang dapat mengatur pembelajaran");

pengaturanPembelajaran.get("/pengaturan/hari", async (c) => {
	const lembaga = lembagaAdmin(c.get("orang"));
	const [pengaturan, libur] = await Promise.all([
		ambilPengaturan(c.env, lembaga.id),
		daftarLibur(c.env, lembaga.id),
	]);
	const hariAktif = pengaturan?.hari_aktif
		? pengaturan.hari_aktif
				.split(",")
				.map((s) => Number(s.trim()))
				.filter((n) => Number.isInteger(n))
		: [1, 2, 3, 4, 5, 6];
	return c.json({ hari_aktif: hariAktif, libur });
});

pengaturanPembelajaran.put("/pengaturan/hari", async (c) => {
	const lembaga = lembagaAdmin(c.get("orang"));
	const csv = periksaHariAktif(await c.req.json().catch(() => null));
	await simpanHariAktif(c.env, lembaga.id, lembaga.nama, csv);
	return c.json({ tersimpan: true });
});

pengaturanPembelajaran.post("/pengaturan/hari/libur", async (c) => {
	const orang = c.get("orang");
	const lembaga = lembagaAdmin(orang);
	const { tanggal, keterangan } = periksaBadanLibur(await c.req.json().catch(() => null));
	await tambahLibur(c.env, lembaga.id, tanggal, keterangan, orang.uid, orang.nama);
	return c.json(await liburPadaTanggal(c.env, lembaga.id, tanggal), 201);
});

pengaturanPembelajaran.delete("/pengaturan/hari/libur/:tanggal", async (c) => {
	const lembaga = lembagaAdmin(c.get("orang"));
	const tanggal = periksaTanggal(c.req.param("tanggal"));
	await hapusLibur(c.env, lembaga.id, tanggal);
	return c.json({ dihapus: true });
});

pengaturanPembelajaran.get("/pengaturan/kelas", async (c) => {
	const lembaga = lembagaAdmin(c.get("orang"));
	return c.json(await kelasDiLembaga(c.env, c.get("token"), lembaga.id));
});

pengaturanPembelajaran.get("/pengaturan/guru", async (c) => {
	const lembaga = lembagaAdmin(c.get("orang"));
	const kode = await kodePeranGuruDiLembaga(c.env, lembaga.id);
	return c.json(await guruDenganPeran(c.env, c.get("token"), kode));
});

function periksaHari(nilai: string | undefined): number {
	const hari = Number(nilai);
	if (!Number.isInteger(hari) || hari < 1 || hari > 7) throw new GagalRute(400, "Parameter hari harus 1–7");
	return hari;
}

pengaturanPembelajaran.get("/pengaturan/jadwal", async (c) => {
	const lembaga = lembagaAdmin(c.get("orang"));
	const kelasId = uuid(c.req.query("kelas_id") ?? "", "kelas_id");
	const hari = periksaHari(c.req.query("hari"));
	return c.json(await daftarJadwal(c.env, lembaga.id, kelasId, hari));
});

async function namaKelas(env: Env, lembagaId: string, kelasId: string, token: string): Promise<string> {
	const daftar = await kelasDiLembaga(env, token, lembagaId);
	const kelas = daftar.find((k) => k.id === kelasId);
	if (!kelas) throw new GagalRute(400, "Kelas yang dipilih bukan bagian dari lembaga ini");
	return kelas.nama;
}

pengaturanPembelajaran.post("/pengaturan/jadwal", async (c) => {
	const lembaga = lembagaAdmin(c.get("orang"));
	const token = c.get("token");
	const badan = periksaBadanJadwal(await c.req.json().catch(() => null));
	const [kelasNama, guruNama] = await Promise.all([
		namaKelas(c.env, lembaga.id, badan.kelasId, token),
		namaGuru(c.env, lembaga.id, badan.guruId, token),
	]);
	return c.json(await tambahJadwal(c.env, lembaga.id, kelasNama, badan, guruNama), 201);
});

pengaturanPembelajaran.patch("/pengaturan/jadwal/:id", async (c) => {
	const lembaga = lembagaAdmin(c.get("orang"));
	const token = c.get("token");
	const badan = periksaBadanJadwal(await c.req.json().catch(() => null));
	const [kelasNama, guruNama] = await Promise.all([
		namaKelas(c.env, lembaga.id, badan.kelasId, token),
		namaGuru(c.env, lembaga.id, badan.guruId, token),
	]);
	return c.json(await ubahJadwal(c.env, lembaga.id, c.req.param("id"), kelasNama, badan, guruNama));
});

pengaturanPembelajaran.delete("/pengaturan/jadwal/:id", async (c) => {
	const lembaga = lembagaAdmin(c.get("orang"));
	// Pastikan barisnya memang milik lembaga ini sebelum dihapus.
	await ambilBarisJadwal(c.env, lembaga.id, c.req.param("id"));
	await hapusJadwal(c.env, lembaga.id, c.req.param("id"));
	return c.json({ dihapus: true });
});
