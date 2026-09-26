import {
	PERAN_PRESENSI,
	lembagaUntukPeran,
	peranPresensi,
	tingkatTertinggi,
	type BarisPeranLembaga,
	type KodePeranPresensi,
	type LembagaBoleh,
	type Tingkat,
} from "./peran";
import { profilSaya, urlBerkas, type Profil } from "./supabase";

export type PeranPengguna = {
	kode: KodePeranPresensi;
	sebutan: string;
	tingkat: Tingkat;
	lembaga: { id: string; nama: string }[];
};

export type Orang = {
	uid: string;
	username: string;
	nama: string;
	jenisKelamin: Profil["jenis_kelamin"];
	fotoPath: string | null;
	peran: PeranPengguna[];
	peranAktif: KodePeranPresensi | null;
	lembagaBoleh: LembagaBoleh[];
	tingkat: Tingkat;
	bolehLembaga: (lembagaId: string) => boolean;
	bolehAtur: (lembagaId: string) => boolean;
};

// Profil disimpan sebentar supaya tiap permintaan tidak memanggil Supabase.
// Pendek (5 menit) agar penonaktifan akun atau pencabutan peran cepat berlaku.
const UMUR_PROFIL_MS = 5 * 60 * 1000;
const cacheProfil = new Map<string, { profil: Profil; sampai: number }>();

export function lupakanProfil(uid: string) {
	cacheProfil.delete(uid);
}

/**
 * Memuat pengguna beserta peran presensinya. Mengembalikan null bila akun
 * tidak ada, nonaktif, atau tidak memegang satu pun peran presensi — ketiga
 * kasus itu sengaja tidak dibedakan bagi pemanggil.
 */
export async function muatOrang(
	env: Env,
	token: string,
	uid: string,
	opsi: { peranAktif?: string | null; segarkan?: boolean } = {},
): Promise<Orang | null> {
	const tersimpan = opsi.segarkan ? undefined : cacheProfil.get(uid);
	let profil = tersimpan && tersimpan.sampai > Date.now() ? tersimpan.profil : null;
	if (!profil) {
		profil = await profilSaya(env, token, uid);
		if (!profil) return null;
		cacheProfil.set(uid, { profil, sampai: Date.now() + UMUR_PROFIL_MS });
	}
	if (profil.is_active === false) return null;

	const kodePresensi = (profil.peran ?? []).filter(peranPresensi);
	if (kodePresensi.length === 0) return null;

	const peranAktif = opsi.peranAktif ?? null;
	if (peranAktif !== null && !kodePresensi.includes(peranAktif as KodePeranPresensi)) {
		return null;
	}

	const { results } = await env.DB.prepare(
		"select peran_code, lembaga_id, lembaga_nama, tingkat from peran_lembaga",
	).all<BarisPeranLembaga>();

	const peran: PeranPengguna[] = kodePresensi.map((kode) => ({
		kode,
		sebutan: PERAN_PRESENSI[kode].sebutan,
		tingkat: PERAN_PRESENSI[kode].tingkat,
		lembaga: results
			.filter((r) => r.peran_code === kode)
			.map((r) => ({ id: r.lembaga_id, nama: r.lembaga_nama })),
	}));

	const dipakai = peranAktif ? [peranAktif] : kodePresensi;
	const lembagaBoleh = lembagaUntukPeran(dipakai, results);
	const tingkat =
		tingkatTertinggi(peran.filter((p) => dipakai.includes(p.kode)).map((p) => p.tingkat)) ?? "guru";

	return {
		uid,
		username: profil.username,
		nama: profil.nama_lengkap,
		jenisKelamin: profil.jenis_kelamin,
		fotoPath: profil.foto_path,
		peran,
		peranAktif: peranAktif as KodePeranPresensi | null,
		lembagaBoleh,
		tingkat,
		bolehLembaga: (id) => lembagaBoleh.some((l) => l.id === id),
		bolehAtur: (id) => lembagaBoleh.some((l) => l.id === id && l.tingkat === "admin"),
	};
}

// Bentuk jawaban yang dibaca frontend, dipakai oleh /masuk dan /saya.
export function ringkasOrang(env: Env, orang: Orang) {
	return {
		uid: orang.uid,
		username: orang.username,
		nama: orang.nama,
		foto_url: urlBerkas(env, "avatars", orang.fotoPath),
		peran: orang.peran,
		peran_aktif: orang.peranAktif,
		tingkat: orang.tingkat,
	};
}
