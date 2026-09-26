import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { periksaEnv, zona } from "./lib/env";
import { GagalTerkendali } from "./lib/galat";
import { ringkasOrang } from "./lib/pengguna";
import { pemanggil, type AppEnv } from "./middleware/pemanggil";
import { masuk } from "./routes/masuk";

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

app.notFound((c) => c.json({ error: "Jalur tidak dikenal" }, 404));

app.onError((galat, c) => {
	c.header("Cache-Control", "no-store");
	if (galat instanceof GagalTerkendali) {
		return c.json({ error: galat.message }, galat.status);
	}
	console.error("Kesalahan tak terduga", galat);
	return c.json({ error: "Terjadi kesalahan di server" }, 500);
});

export default app;
