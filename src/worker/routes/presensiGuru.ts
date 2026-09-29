import { Hono } from "hono";
import { GagalRute } from "../lib/galat";
import {
	MAKS_BYTE_BADAN,
	catatPresensiGuru,
	periksaBadanGuru,
	statusGuruHariIni,
	tipeGuruSah,
} from "../lib/presensiGuru";
import type { Orang } from "../lib/pengguna";
import type { AppEnv } from "../middleware/pemanggil";

export const presensiGuru = new Hono<AppEnv>();

// Presensi gerbang guru khusus tingkat guru.
function jagaGuru(orang: Orang) {
	if (orang.tingkat !== "guru") {
		throw new GagalRute(403, "Hanya guru yang dapat mencatat presensi gerbang guru");
	}
}

presensiGuru.get("/presensi-guru/hari-ini", async (c) => {
	const orang = c.get("orang");
	jagaGuru(orang);
	return c.json(await statusGuruHariIni(c.env, orang));
});

presensiGuru.post("/presensi-guru/:tipe", async (c) => {
	const tipe = c.req.param("tipe");
	if (!tipeGuruSah(tipe)) throw new GagalRute(404, "Jalur tidak dikenal");
	const orang = c.get("orang");
	jagaGuru(orang);

	// Tolak badan besar sebelum diurai (foto seharusnya sudah dikecilkan klien).
	const panjang = Number(c.req.header("Content-Length") ?? Number.NaN);
	if (!Number.isFinite(panjang) || panjang > MAKS_BYTE_BADAN) {
		throw new GagalRute(413, "Ukuran foto terlalu besar");
	}
	if (!(c.req.header("Content-Type") ?? "").startsWith("multipart/form-data")) {
		throw new GagalRute(415, "Isian tidak sah");
	}

	const form = await c.req.formData().catch(() => null);
	if (!form) throw new GagalRute(400, "Isian tidak sah");
	const badan = await periksaBadanGuru(form);

	const hasil = await catatPresensiGuru(c.env, orang, tipe, badan);
	return c.json({ tipe: hasil.tipe, waktu: hasil.waktu }, hasil.sudah ? 200 : 201);
});
