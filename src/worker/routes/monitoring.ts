import { Hono } from "hono";
import { lembagaKepsek } from "../lib/admin";
import { zona } from "../lib/env";
import { isiAlamatSusulan } from "../lib/alamat";
import { ambilFotoGuru, kehadiranGuru, periksaBadanValidasi, ubahValidasi } from "../lib/monitoringGuru";
import { periksaTanggal } from "../lib/validasiPembelajaran";
import { tanggalLokal } from "../lib/waktu";
import type { AppEnv } from "../middleware/pemanggil";

export const monitoring = new Hono<AppEnv>();

// Monitoring khusus kepala sekolah/madrasah (tingkat `kepsek`), dibatasi ke
// lembaganya sendiri — lembaga diambil dari peran pengguna, bukan dari klien.

monitoring.get("/monitoring/kehadiran-guru", async (c) => {
	const lembaga = lembagaKepsek(c.get("orang"));
	const mentah = c.req.query("tanggal");
	const tanggal = mentah ? periksaTanggal(mentah) : tanggalLokal(new Date(), zona(c.env));
	const hasil = await kehadiranGuru(c.env, c.get("token"), lembaga.id, tanggal);
	// Alamat yang belum ada dicari di belakang layar (maks. 5 baris, berjeda) —
	// tampilan berikutnya sudah membawanya.
	c.executionCtx.waitUntil(
		isiAlamatSusulan(c.env, lembaga.id, tanggal).catch((galat) => console.error("Isi alamat susulan gagal", galat)),
	);
	return c.json(hasil);
});

// Foto diambil klien lewat fetch (bukan <img src>) supaya header X-Peran ikut
// terkirim, dan tidak pernah di-cache oleh peramban/perantara.
monitoring.get("/monitoring/foto/:tanggal/:guruId/:tipe", async (c) => {
	const lembaga = lembagaKepsek(c.get("orang"));
	const objek = await ambilFotoGuru(c.env, lembaga.id, c.req.param("tanggal"), c.req.param("guruId"), c.req.param("tipe"));
	return new Response(objek.body, {
		headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
	});
});

monitoring.post("/monitoring/kehadiran-guru/validasi", async (c) => {
	const orang = c.get("orang");
	const lembaga = lembagaKepsek(orang);
	const badan = periksaBadanValidasi(await c.req.json().catch(() => null));
	return c.json(await ubahValidasi(c.env, lembaga.id, orang, badan));
});
