import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { periksaEnv, zona } from "./lib/env";
import { GagalTerkendali } from "./lib/galat";
import { urlBerkas } from "./lib/supabase";
import { pemanggil, type AppEnv } from "./middleware/pemanggil";

const app = new Hono<AppEnv>().basePath("/api");

app.use(secureHeaders());
app.use(async (c, next) => {
	periksaEnv(c.env);
	await next();
	// Jawaban API bergantung pada token, bukan URL: jangan pernah di-cache.
	c.header("Cache-Control", "no-store");
});

// Konfigurasi publik untuk frontend, dibaca dari Variables and Secrets di
// runtime. Hanya nilai yang memang aman untuk browser.
app.get("/config", (c) =>
	c.json({
		supabaseUrl: c.env.SUPABASE_URL,
		supabasePublishableKey: c.env.SUPABASE_PUBLISHABLE_KEY,
		loginEmailDomain: c.env.LOGIN_EMAIL_DOMAIN,
		zona: zona(c.env),
	}),
);

app.get("/sehat", async (c) => {
	const d1 = await c.env.DB.prepare("select 1 as ok")
		.first<{ ok: number }>()
		.then((r) => r?.ok === 1)
		.catch(() => false);
	return c.json({ ok: d1, d1, waktu: new Date().toISOString() }, d1 ? 200 : 503);
});

// Semua rute di bawah ini wajib login.
app.use("*", pemanggil);

app.get("/saya", (c) => {
	const orang = c.get("orang");
	return c.json({
		uid: orang.uid,
		username: orang.username,
		nama: orang.nama,
		jenis_kelamin: orang.jenisKelamin,
		foto_url: urlBerkas(c.env, "avatars", orang.fotoPath),
		peran: orang.peran,
		peran_aktif: orang.peranAktif,
		peran_tersedia: orang.peranTersedia,
		lembaga: orang.lembagaBoleh,
		boleh_atur: orang.adaYangDiatur,
		tingkat: orang.tingkat,
	});
});

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
