import { Hono } from "hono";
import { lembagaAdmin } from "../lib/admin";
import { zona } from "../lib/env";
import { namaGuru } from "../lib/guruLembaga";
import {
	daftarHistori,
	hapusKetidakhadiran,
	periksaBadanKetidakhadiran,
	periksaSaringHistori,
	tambahKetidakhadiran,
} from "../lib/tugasDinas";
import { tanggalLokal } from "../lib/waktu";
import type { AppEnv } from "../middleware/pemanggil";

export const kedinasan = new Hono<AppEnv>();

// Ketidakhadiran guru (tugas dinas, izin sakit, izin keperluan keluarga) khusus
// tingkat admin, dibatasi ke lembaga admin itu sendiri.
const admin = (orang: Parameters<typeof lembagaAdmin>[0]) =>
	lembagaAdmin(orang, "Hanya admin presensi yang dapat mengatur ketidakhadiran guru");

const geser = (tanggal: string, hari: number) =>
	new Date(Date.parse(`${tanggal}T00:00:00Z`) + hari * 86_400_000).toISOString().slice(0, 10);

// Histori: bawaan 30 hari ke belakang sampai 31 hari ke depan; ?jenis= menyaring.
kedinasan.get("/ketidakhadiran-guru", async (c) => {
	const lembaga = admin(c.get("orang"));
	const hariIni = tanggalLokal(new Date(), zona(c.env));
	const saring = periksaSaringHistori(
		c.req.query("dari") ?? geser(hariIni, -30),
		c.req.query("sampai") ?? geser(hariIni, 31),
		c.req.query("jenis"),
	);
	return c.json(await daftarHistori(c.env, lembaga.id, saring));
});

kedinasan.post("/ketidakhadiran-guru", async (c) => {
	const orang = c.get("orang");
	const lembaga = admin(orang);
	const badan = periksaBadanKetidakhadiran(await c.req.json().catch(() => null));
	// Nama guru diambil dari daftar guru lembaga; klien hanya mengirim id.
	const nama = await namaGuru(c.env, lembaga.id, badan.guruId, c.get("token"));
	return c.json(await tambahKetidakhadiran(c.env, lembaga.id, nama!, badan, orang.uid, orang.nama), 201);
});

kedinasan.delete("/ketidakhadiran-guru/:id", async (c) => {
	const lembaga = admin(c.get("orang"));
	await hapusKetidakhadiran(c.env, lembaga.id, c.req.param("id"));
	return c.json({ dihapus: true });
});
