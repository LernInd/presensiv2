// Panggilan ke Supabase Auth (GoTrue). Kredensial dikirim sebagai JSON ke
// endpoint resmi; tidak ada SQL yang dirakit dari input pengguna.

export type SesiSupabase = {
	access_token: string;
	refresh_token: string;
	expires_in: number;
	user: { id: string };
};

type Hasil = { ok: true; sesi: SesiSupabase } | { ok: false; status: number };

async function token(env: Env, grant: "password" | "refresh_token", isi: object): Promise<Hasil> {
	let respons: Response;
	try {
		respons = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=${grant}`, {
			method: "POST",
			headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
			body: JSON.stringify(isi),
		});
	} catch (galat) {
		console.error("Supabase Auth tidak terjangkau", galat);
		return { ok: false, status: 503 };
	}
	if (!respons.ok) {
		// Isi galat GoTrue sengaja tidak diteruskan: bisa membedakan "email tak
		// dikenal" dan "sandi salah", padahal jawaban ke pengguna harus sama.
		await respons.body?.cancel();
		return { ok: false, status: respons.status };
	}
	const sesi = await respons.json<SesiSupabase>();
	if (!sesi.access_token || !sesi.refresh_token) return { ok: false, status: 502 };
	return { ok: true, sesi };
}

export function loginPassword(env: Env, email: string, password: string) {
	return token(env, "password", { email, password });
}

export function segarkanSesi(env: Env, refreshToken: string) {
	return token(env, "refresh_token", { refresh_token: refreshToken });
}

// Mencabut refresh token sesi ini di Supabase. Gagal pun tidak masalah bagi
// pemanggil: cookie tetap dihapus, dan access token berumur pendek.
export async function cabutSesi(env: Env, accessToken: string): Promise<void> {
	try {
		const respons = await fetch(`${env.SUPABASE_URL}/auth/v1/logout?scope=local`, {
			method: "POST",
			headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${accessToken}` },
		});
		await respons.body?.cancel();
	} catch (galat) {
		console.error("Gagal mencabut sesi Supabase", galat);
	}
}
