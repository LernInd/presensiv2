import { createMiddleware } from "hono/factory";
import { TokenKedaluwarsa, verifikasiToken } from "../lib/auth";
import { segarkanSesi } from "../lib/authSupabase";
import { GagalAuth } from "../lib/galat";
import { muatOrang, type Orang } from "../lib/pengguna";
import { bacaSesi, hapusSesi, pasangSesi } from "../lib/sesi";

export type AppEnv = { Bindings: Env; Variables: { orang: Orang; token: string } };

const BELUM_MASUK = "Sesi tidak ditemukan. Silakan masuk.";

export const pemanggil = createMiddleware<AppEnv>(async (c, next) => {
	const { akses, segar } = bacaSesi(c);
	if (!akses && !segar) throw new GagalAuth(401, BELUM_MASUK);

	let token = akses;
	let uid: string | null = null;
	let disegarkan = false;

	if (token) {
		try {
			uid = (await verifikasiToken(c.env, token)).sub;
		} catch (galat) {
			if (!(galat instanceof TokenKedaluwarsa)) {
				hapusSesi(c);
				throw galat;
			}
		}
	}

	// Access token habis (atau cookienya hilang): segarkan di server memakai
	// refresh token. Frontend tidak pernah memegang token sama sekali.
	if (!uid) {
		const hasil = segar ? await segarkanSesi(c.env, segar) : null;
		if (!hasil?.ok) {
			hapusSesi(c);
			throw new GagalAuth(401, "Sesi berakhir. Silakan masuk kembali.");
		}
		token = hasil.sesi.access_token;
		uid = (await verifikasiToken(c.env, token)).sub;
		pasangSesi(c, hasil.sesi);
		disegarkan = true;
	}

	const orang = await muatOrang(c.env, token!, uid, {
		peranAktif: c.req.header("X-Peran") || null,
		// Saat token disegarkan, peran dibaca ulang dari Supabase, bukan cache.
		segarkan: disegarkan,
	});
	if (!orang) {
		hapusSesi(c);
		throw new GagalAuth(401, "Akses ditolak. Silakan masuk kembali.");
	}

	c.set("orang", orang);
	c.set("token", token!);
	await next();
});
