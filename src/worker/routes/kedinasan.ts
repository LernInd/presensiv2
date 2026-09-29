import { Hono } from "hono";
import { lembagaAdmin } from "../lib/admin";
import { zona } from "../lib/env";
import { namaGuru } from "../lib/guruLembaga";
import { daftarDinas, hapusDinas, periksaBadanDinas, tambahDinas } from "../lib/tugasDinas";
import { tanggalLokal } from "../lib/waktu";
import type { AppEnv } from "../middleware/pemanggil";

export const kedinasan = new Hono<AppEnv>();

// Kedinasan khusus tingkat admin, dibatasi ke lembaga admin itu sendiri.
const admin = (orang: Parameters<typeof lembagaAdmin>[0]) =>
	lembagaAdmin(orang, "Hanya admin presensi yang dapat mengatur kedinasan");

kedinasan.get("/kedinasan/tugas-dinas", async (c) => {
	const lembaga = admin(c.get("orang"));
	return c.json(await daftarDinas(c.env, lembaga.id, tanggalLokal(new Date(), zona(c.env))));
});

kedinasan.post("/kedinasan/tugas-dinas", async (c) => {
	const orang = c.get("orang");
	const lembaga = admin(orang);
	const badan = periksaBadanDinas(await c.req.json().catch(() => null));
	// Nama guru diambil dari daftar guru lembaga; klien hanya mengirim id.
	const nama = await namaGuru(c.env, lembaga.id, badan.guruId, c.get("token"));
	return c.json(await tambahDinas(c.env, lembaga.id, nama!, badan, orang.uid, orang.nama), 201);
});

kedinasan.delete("/kedinasan/tugas-dinas/:id", async (c) => {
	const lembaga = admin(c.get("orang"));
	await hapusDinas(c.env, lembaga.id, c.req.param("id"));
	return c.json({ dihapus: true });
});
