import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { verifikasiToken } from "../lib/auth";
import { cabutSesi, loginPassword } from "../lib/authSupabase";
import { GagalRute } from "../lib/galat";
import { lupakanProfil, muatOrang, ringkasOrang } from "../lib/pengguna";
import { bacaSesi, hapusSesi, pasangSesi } from "../lib/sesi";
import { GagalValidasi, periksaKredensial } from "../lib/validasi";
import type { AppEnv } from "../middleware/pemanggil";

// Pesan tunggal untuk SEMUA penolakan kredensial: username tak ada, sandi
// salah, akun nonaktif, atau peran bukan presensi. Membedakannya berarti
// membantu penyerang memetakan akun.
const KREDENSIAL_SALAH = "Username atau kata sandi salah";

// Setiap jawaban gagal ditahan minimal selama ini sejak permintaan tiba, agar
// waktu respons tidak membocorkan di tahap mana penolakan terjadi dan agar
// tebakan beruntun menjadi lambat.
const JEDA_GAGAL_MS = 1000;

const tunggu = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jedaSejak = (mulai: number) => tunggu(Math.max(0, JEDA_GAGAL_MS - (Date.now() - mulai)));

export const masuk = new Hono<AppEnv>();

masuk.post(
	"/masuk",
	bodyLimit({
		maxSize: 1024,
		onError: (c) => c.json({ error: "Isian terlalu besar" }, 413),
	}),
	async (c) => {
		const mulai = Date.now();

		// Batas per IP dicek paling awal: murah dan menahan banjir permintaan
		// sebelum ada kerja lain (≈ 1 permintaan per 2 detik).
		const ip = c.req.header("CF-Connecting-IP") ?? "tanpa-ip";
		if (!(await c.env.RL_LOGIN_IP.limit({ key: `ip:${ip}` })).success) {
			await jedaSejak(mulai);
			return c.json({ error: "Terlalu banyak percobaan. Tunggu sebentar.", tunggu: 10 }, 429);
		}

		if (!c.req.header("Content-Type")?.startsWith("application/json")) {
			throw new GagalRute(415, "Format permintaan tidak didukung");
		}
		const isi = await c.req.json().catch(() => null);

		let kredensial;
		try {
			kredensial = periksaKredensial(isi);
		} catch (galat) {
			await jedaSejak(mulai);
			if (galat instanceof GagalValidasi) {
				return c.json({ error: galat.message, kolom: galat.kolom }, 400);
			}
			throw galat;
		}

		// Batas per akun: menahan tebakan sandi ke satu username dari banyak IP.
		if (!(await c.env.RL_LOGIN_USER.limit({ key: `user:${kredensial.username}` })).success) {
			await jedaSejak(mulai);
			return c.json({ error: "Terlalu banyak percobaan untuk akun ini. Tunggu 1 menit.", tunggu: 60 }, 429);
		}

		const email = `${kredensial.username}@${c.env.LOGIN_EMAIL_DOMAIN}`;
		const hasil = await loginPassword(c.env, email, kredensial.password);
		if (!hasil.ok) {
			await jedaSejak(mulai);
			if (hasil.status === 429) {
				return c.json({ error: "Terlalu banyak percobaan. Tunggu 1 menit.", tunggu: 60 }, 429);
			}
			if (hasil.status >= 500) throw new GagalRute(503, "Layanan login sedang bermasalah");
			return c.json({ error: KREDENSIAL_SALAH }, 401);
		}

		const { sub: uid } = await verifikasiToken(c.env, hasil.sesi.access_token);
		const orang = await muatOrang(c.env, hasil.sesi.access_token, uid, { segarkan: true });
		if (!orang) {
			// Kredensial benar tetapi bukan pengguna presensi: sesi yang sudah
			// terbit dicabut, dan jawabannya sama persis dengan sandi salah.
			await cabutSesi(c.env, hasil.sesi.access_token);
			lupakanProfil(uid);
			await jedaSejak(mulai);
			return c.json({ error: KREDENSIAL_SALAH }, 401);
		}

		pasangSesi(c, hasil.sesi);
		return c.json(ringkasOrang(c.env, orang));
	},
);

masuk.post("/keluar", async (c) => {
	const { akses } = bacaSesi(c);
	if (akses) await cabutSesi(c.env, akses);
	hapusSesi(c);
	return c.json({ keluar: true });
});
