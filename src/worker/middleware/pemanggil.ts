import { createMiddleware } from "hono/factory";
import { tokenDariHeader, verifikasiToken } from "../lib/auth";
import { GagalAuth } from "../lib/galat";
import {
	lembagaUntukPeran,
	normalkanTingkat,
	tingkatTertinggi,
	type BarisPeranLembaga,
	type LembagaBoleh,
	type Tingkat,
} from "../lib/peran";
import { profilSaya, type Profil } from "../lib/supabase";

export type Orang = {
	token: string;
	uid: string;
	username: string;
	nama: string;
	jenisKelamin: Profil["jenis_kelamin"];
	fotoPath: string | null;
	peran: string[];
	peranAktif: string | null;
	peranTersedia: { kode: string; lembaga_id: string; lembaga_nama: string; tingkat: Tingkat }[];
	lembagaBoleh: LembagaBoleh[];
	tingkat: Tingkat;
	bolehLembaga: (lembagaId: string) => boolean;
	bolehAtur: (lembagaId: string) => boolean;
	adaYangDiatur: boolean;
};

export type AppEnv = { Bindings: Env; Variables: { orang: Orang } };

// Profil disimpan sebentar supaya tiap permintaan tidak memanggil Supabase.
// Pendek (5 menit) agar penonaktifan akun atau pencabutan peran cepat berlaku.
const UMUR_PROFIL_MS = 5 * 60 * 1000;
const cacheProfil = new Map<string, { profil: Profil; sampai: number }>();

export const pemanggil = createMiddleware<AppEnv>(async (c, next) => {
	const token = tokenDariHeader(c.req.header("Authorization"));
	if (!token) throw new GagalAuth(401, "Tidak ada token");

	const { sub: uid } = await verifikasiToken(c.env, token);

	const tersimpan = cacheProfil.get(uid);
	let profil = tersimpan && tersimpan.sampai > Date.now() ? tersimpan.profil : null;
	if (!profil) {
		profil = await profilSaya(c.env, token, uid);
		if (!profil) throw new GagalAuth(403, "Profil pengguna tidak ditemukan");
		cacheProfil.set(uid, { profil, sampai: Date.now() + UMUR_PROFIL_MS });
	}
	if (profil.is_active === false) throw new GagalAuth(403, "Akun ini dinonaktifkan");

	const peran = profil.peran ?? [];
	const { results } = await c.env.DB.prepare(
		"select peran_code, lembaga_id, lembaga_nama, tingkat from peran_lembaga",
	).all<BarisPeranLembaga>();

	const peranTersedia = results
		.filter((r) => peran.includes(r.peran_code))
		.flatMap((r) => {
			const tingkat = normalkanTingkat(r.tingkat);
			return tingkat
				? [{ kode: r.peran_code, lembaga_id: r.lembaga_id, lembaga_nama: r.lembaga_nama, tingkat }]
				: [];
		});

	// X-Peran hanya boleh MEMPERSEMPIT ke peran yang benar-benar dipegang.
	const peranAktif = c.req.header("X-Peran") || null;
	if (peranAktif && !peran.includes(peranAktif)) {
		throw new GagalAuth(403, `Anda tidak memegang peran ${peranAktif}`);
	}

	const lembagaBoleh = lembagaUntukPeran(peranAktif ? [peranAktif] : peran, results);
	if (lembagaBoleh.length === 0) {
		throw new GagalAuth(403, "Akun ini tidak punya peran presensi di lembaga mana pun.");
	}
	const tingkat = tingkatTertinggi(lembagaBoleh.map((l) => l.tingkat));
	if (!tingkat) throw new GagalAuth(500, "Tingkat peran tidak dikenal");

	c.set("orang", {
		token,
		uid,
		username: profil.username,
		nama: profil.nama_lengkap,
		jenisKelamin: profil.jenis_kelamin,
		fotoPath: profil.foto_path,
		peran,
		peranAktif,
		peranTersedia,
		lembagaBoleh,
		tingkat,
		bolehLembaga: (id) => lembagaBoleh.some((l) => l.id === id),
		bolehAtur: (id) => lembagaBoleh.some((l) => l.id === id && l.tingkat === "admin"),
		adaYangDiatur: lembagaBoleh.some((l) => l.tingkat === "admin"),
	});
	await next();
});
