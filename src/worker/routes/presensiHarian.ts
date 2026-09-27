import { Hono } from "hono";
import { GagalRute } from "../lib/galat";
import { cariSantri } from "../lib/pencarianSantri";
import { catatScan, periksaBadan, siapkanScan, tipeSah } from "../lib/presensiHarian";
import type { AppEnv } from "../middleware/pemanggil";
import type { Orang } from "../lib/pengguna";

export const presensiHarian = new Hono<AppEnv>();

// Presensi gerbang milik guru saja (jalan darurat admin belum dibuka di
// putaran ini) — sejalan dengan presensi-api lama: "masuk.html/pulang.html
// guru saja".
function jagaGuru(orang: Orang) {
	if (orang.tingkat !== "guru") {
		throw new GagalRute(403, "Hanya guru yang dapat mencatat presensi gerbang");
	}
}

presensiHarian.post("/presensi/:tipe/pratinjau", async (c) => {
	const tipe = c.req.param("tipe");
	if (!tipeSah(tipe)) throw new GagalRute(404, "Jalur tidak dikenal");
	jagaGuru(c.get("orang"));

	const badan = periksaBadan(await c.req.json().catch(() => null));
	const hasil = await siapkanScan(c.env, c.get("token"), c.get("orang"), tipe, badan);
	return c.json(hasil);
});

presensiHarian.post("/presensi/:tipe", async (c) => {
	const tipe = c.req.param("tipe");
	if (!tipeSah(tipe)) throw new GagalRute(404, "Jalur tidak dikenal");
	const orang = c.get("orang");
	jagaGuru(orang);

	const badan = periksaBadan(await c.req.json().catch(() => null));
	const hasil = await siapkanScan(c.env, c.get("token"), orang, tipe, badan);
	const baruDicatat = !hasil.diblokir && !hasil.sudah;
	const dicatat = await catatScan(c.env, orang, tipe, hasil);
	return c.json(dicatat, baruDicatat ? 201 : 200);
});

presensiHarian.get("/santri/cari", async (c) => {
	const orang = c.get("orang");
	jagaGuru(orang);
	const hasil = await cariSantri(c.env, c.get("token"), orang, c.req.query("q") ?? "");
	return c.json(hasil);
});
