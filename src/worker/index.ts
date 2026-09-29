import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { periksaEnv, zona } from "./lib/env";
import { GagalTerkendali } from "./lib/galat";
import { ringkasOrang } from "./lib/pengguna";
import { pemanggil, type AppEnv } from "./middleware/pemanggil";
import { masuk } from "./routes/masuk";
import { pelajaran } from "./routes/pelajaran";
import { pengaturanPembelajaran } from "./routes/pengaturanPembelajaran";
import { presensiHarian } from "./routes/presensiHarian";
import { kedinasan } from "./routes/kedinasan";
import { monitoring } from "./routes/monitoring";
import { presensiGuru } from "./routes/presensiGuru";
import { rekap } from "./routes/rekap";
import { hapusFotoGuru } from "./lib/hapusFotoGuru";
import { catatPulangOtomatis } from "./lib/pulangOtomatis";

// Jadwal cron (lih. wrangler.json → triggers, dalam UTC). 16:00 UTC = 23:00 WIB.
const CRON_HAPUS_FOTO = "0 16 * * *";

const app = new Hono<AppEnv>().basePath("/api");

app.use(secureHeaders());
app.use(async (c, next) => {
	periksaEnv(c.env);
	// Perlindungan CSRF lapis kedua (lapis pertama: cookie SameSite=Strict):
	// permintaan yang mengubah keadaan wajib berasal dari origin aplikasi ini.
	if (c.req.method !== "GET" && c.req.method !== "HEAD") {
		const asal = c.req.header("Origin");
		if (!asal || asal !== new URL(c.req.url).origin) {
			throw new GagalTerkendali(403, "Asal permintaan tidak diizinkan");
		}
	}
	await next();
	// Jawaban API bergantung pada sesi, bukan URL: jangan pernah di-cache.
	c.header("Cache-Control", "no-store");
});

app.get("/config", (c) => c.json({ zona: zona(c.env) }));

app.get("/sehat", async (c) => {
	const d1 = await c.env.DB.prepare("select 1 as ok")
		.first<{ ok: number }>()
		.then((r) => r?.ok === 1)
		.catch(() => false);
	return c.json({ ok: d1, d1, waktu: new Date().toISOString() }, d1 ? 200 : 503);
});

app.route("/", masuk);

// Semua rute di bawah ini wajib login.
app.use("*", pemanggil);

app.get("/saya", (c) => c.json(ringkasOrang(c.env, c.get("orang"))));

app.route("/", pelajaran);
app.route("/", presensiHarian);
app.route("/", pengaturanPembelajaran);
app.route("/", rekap);
app.route("/", kedinasan);
app.route("/", monitoring);
app.route("/", presensiGuru);

app.notFound((c) => c.json({ error: "Jalur tidak dikenal" }, 404));

app.onError((galat, c) => {
	c.header("Cache-Control", "no-store");
	if (galat instanceof GagalTerkendali) {
		return c.json({ error: galat.message }, galat.status);
	}
	console.error("Kesalahan tak terduga", galat);
	return c.json({ error: "Terjadi kesalahan di server" }, 500);
});

export default {
	fetch: app.fetch,
	// Dua cron (lih. wrangler.json → triggers):
	// - 23:00 WIB: foto presensi guru dihapus dari R2 (koordinat/jam tetap ada).
	// - 19:00 WIB (selain itu): santri yang sudah scan masuk tetapi tidak scan
	//   pulang dicatat "tidak tepat waktu".
	async scheduled(event, env, ctx) {
		if (event.cron === CRON_HAPUS_FOTO) {
			ctx.waitUntil(
				hapusFotoGuru(env).then(
					(hasil) => console.log("Hapus foto guru", JSON.stringify(hasil)),
					(galat) => console.error("Hapus foto guru gagal", galat),
				),
			);
			return;
		}
		ctx.waitUntil(
			catatPulangOtomatis(env).then(
				(hasil) => console.log("Pulang otomatis", JSON.stringify(hasil)),
				(galat) => console.error("Pulang otomatis gagal", galat),
			),
		);
	},
} satisfies ExportedHandler<Env>;
