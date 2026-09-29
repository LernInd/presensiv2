import { Hono } from "hono";
import { lembagaAdmin } from "../lib/admin";
import { rekapJamPelajaran } from "../lib/rekapJamPelajaran";
import { periksaKelasOpsional, periksaRentang, rekapKehadiran } from "../lib/rekapKehadiran";
import { periksaTanggal } from "../lib/validasiPembelajaran";
import type { AppEnv } from "../middleware/pemanggil";

export const rekap = new Hono<AppEnv>();

// Rekap khusus tingkat admin, dibatasi ke lembaga admin itu sendiri.
function bacaParameter(c: { req: { query: (k: string) => string | undefined } }) {
	const rentang = periksaRentang(
		periksaTanggal(c.req.query("dari"), "dari"),
		periksaTanggal(c.req.query("sampai"), "sampai"),
	);
	return { rentang, kelasId: periksaKelasOpsional(c.req.query("kelas_id")) };
}

rekap.get("/rekap/kehadiran", async (c) => {
	const lembaga = lembagaAdmin(c.get("orang"), "Hanya admin presensi yang dapat melihat rekap");
	const { rentang, kelasId } = bacaParameter(c);
	return c.json(await rekapKehadiran(c.env, c.get("token"), lembaga.id, rentang, kelasId));
});

rekap.get("/rekap/jam-pelajaran", async (c) => {
	const lembaga = lembagaAdmin(c.get("orang"), "Hanya admin presensi yang dapat melihat rekap");
	const { rentang, kelasId } = bacaParameter(c);
	return c.json(await rekapJamPelajaran(c.env, lembaga.id, rentang, kelasId));
});
