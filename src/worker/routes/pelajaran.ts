import { Hono } from "hono";
import { jadwalHariIni } from "../lib/jadwal";
import { GagalRute } from "../lib/galat";
import type { AppEnv } from "../middleware/pemanggil";
import {
	ambilSesi,
	daftarPresensi,
	jagaSesi,
	kuncianStatus,
	periksaUbahStatus,
} from "../lib/pembelajaran";
import { uuid } from "../lib/supabase";

export const pelajaran = new Hono<AppEnv>();

pelajaran.get("/jadwal-hari-ini", async (c) => {
	return c.json(await jadwalHariIni(c.env, c.get("orang")));
});

pelajaran.get("/sesi/:id", async (c) => {
	const sesi = await ambilSesi(c.env, c.req.param("id"));
	jagaSesi(sesi, c.get("orang"));
	return c.json(sesi);
});

pelajaran.get("/sesi/:id/presensi", async (c) => {
	const sesi = await ambilSesi(c.env, c.req.param("id"));
	jagaSesi(sesi, c.get("orang"));
	const presensi = await daftarPresensi(c.env, c.get("token"), sesi);
	return c.json({ sesi, presensi });
});

pelajaran.patch("/sesi/:id/presensi/:santriId", async (c) => {
	const sesi = await ambilSesi(c.env, c.req.param("id"));
	jagaSesi(sesi, c.get("orang"));
	const santriId = uuid(c.req.param("santriId"), "santri_id");

	const baris = await c.env.DB.prepare(
		"select status, status_awal, keterangan from presensi_pembelajaran where sesi_id = ? and santri_id = ?",
	)
		.bind(sesi.id, santriId)
		.first<{ status: string; status_awal: string; keterangan: string | null }>();
	if (!baris) throw new GagalRute(404, "Santri tidak ada di daftar sesi ini");

	// Dua kunci, keduanya 409: status yang ditetapkan poliklinik atau ndalem
	// tidak boleh ditimpa guru dari sini — dicek ulang terhadap keadaan
	// SEKARANG, bukan status_awal yang mungkin sudah basi.
	const kunci = await kuncianStatus(c.env, sesi.tanggal, santriId);
	if (kunci === "sakit") throw new GagalRute(409, "Status dikunci surat sakit, tidak bisa diubah dari sini");
	if (kunci === "izin") throw new GagalRute(409, "Status dikunci izin yang sudah disetujui ndalem");

	const isi = await c.req.json().catch(() => null);
	const { status, keterangan } = periksaUbahStatus(isi, baris.status_awal);

	if (status === baris.status && keterangan === baris.keterangan) {
		// Tidak ada perubahan nyata: berhenti sebelum menulis jejak apa pun.
		return c.json({ status, keterangan });
	}

	const orang = c.get("orang");
	const catatan = keterangan ?? "(dikembalikan ke status awal)";
	await c.env.DB.batch([
		c.env.DB.prepare(
			"update presensi_pembelajaran set status = ?, keterangan = ?, diubah_oleh = ?, diubah_pada = datetime('now') where sesi_id = ? and santri_id = ?",
		).bind(status, keterangan, orang.uid, sesi.id, santriId),
		c.env.DB.prepare(
			"insert into riwayat_presensi (sesi_id, santri_id, dari_status, ke_status, keterangan, oleh, oleh_nama) values (?,?,?,?,?,?,?)",
		).bind(sesi.id, santriId, baris.status, status, catatan, orang.uid, orang.nama),
	]);

	return c.json({ status, keterangan });
});
