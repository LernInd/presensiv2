// Tingkat peran di presensi-db (kolom `peran_lembaga.tingkat`). Disalin dari
// presensi-api agar kedua aplikasi menafsirkan peran dengan cara yang sama.
export const TINGKAT = {
	admin: { sebutan: "Admin presensi", modul: "presensi" },
	// Kepala sekolah/madrasah: memantau dan dapat menolak presensi guru
	// lembaganya. Tingkat ini hanya ada di aplikasi ini (kode), TIDAK ada di
	// CHECK peran_lembaga milik worker lain — lihat turunanKepsek.
	kepsek: { sebutan: "Kepala sekolah", modul: "presensi" },
	guru: { sebutan: "Guru", modul: "presensi" },
	kesehatanputra: { sebutan: "Petugas kesehatan putra", modul: "kesehatan", bagian: "laki_laki" },
	kesehatanputri: { sebutan: "Petugas kesehatan putri", modul: "kesehatan", bagian: "perempuan" },
	adminkesehatanputra: { sebutan: "Admin kesehatan putra", modul: "kesehatan", bagian: "laki_laki" },
	adminkesehatanputri: { sebutan: "Admin kesehatan putri", modul: "kesehatan", bagian: "perempuan" },
	adminperizinanputra: { sebutan: "Admin perizinan putra", modul: "perizinan", bagian: "laki_laki" },
	adminperizinanputri: { sebutan: "Admin perizinan putri", modul: "perizinan", bagian: "perempuan" },
	ndalemputra: { sebutan: "Ndalem putra", modul: "perizinan", bagian: "laki_laki" },
	ndalemputri: { sebutan: "Ndalem putri", modul: "perizinan", bagian: "perempuan" },
} as const;

export type Tingkat = keyof typeof TINGKAT;

// Urutan prioritas saat pengguna memegang beberapa tingkat sekaligus.
export const URUTAN_TINGKAT = Object.keys(TINGKAT) as Tingkat[];

export function normalkanTingkat(nilai: unknown): Tingkat | null {
	const teks = String(nilai ?? "");
	return Object.hasOwn(TINGKAT, teks) ? (teks as Tingkat) : null;
}

export function tingkatTertinggi(daftar: Tingkat[]): Tingkat | null {
	return URUTAN_TINGKAT.find((t) => daftar.includes(t)) ?? null;
}

export type BarisPeranLembaga = {
	peran_code: string;
	lembaga_id: string;
	lembaga_nama: string;
	tingkat: string;
};

export type LembagaBoleh = { id: string; nama: string; tingkat: Tingkat };

export function lembagaUntukPeran(peran: string[], baris: BarisPeranLembaga[]): LembagaBoleh[] {
	const dimiliki = new Set(peran);
	const perLembaga = new Map<string, LembagaBoleh>();
	for (const r of baris) {
		if (!dimiliki.has(r.peran_code)) continue;
		const tingkat = normalkanTingkat(r.tingkat);
		if (!tingkat) continue;
		const sudah = perLembaga.get(r.lembaga_id);
		if (!sudah) {
			perLembaga.set(r.lembaga_id, { id: r.lembaga_id, nama: r.lembaga_nama, tingkat });
		} else if (URUTAN_TINGKAT.indexOf(tingkat) < URUTAN_TINGKAT.indexOf(sudah.tingkat)) {
			// Tingkat yang lebih tinggi (admin > kepsek > guru) menang di lembaga yang sama.
			sudah.tingkat = tingkat;
		}
	}
	return [...perLembaga.values()];
}

// Peran kepala sekolah tidak punya baris di peran_lembaga (tabel bersama, CHECK
// tingkat-nya tidak mengizinkan nilai baru). Lembaganya diturunkan dari peran
// admin presensi lembaga yang sama.
export const PASANGAN_KEPSEK = {
	ksmts: "adminpresensimts",
	ksma: "adminpresensima",
	kssmk: "adminpresensismk",
	ksmadin: "adminpresensimadin",
} as const;

/** Baris sintetis untuk peran kepala sekolah; dilewati bila pasangan admin-nya tak ada. */
export function turunanKepsek(baris: BarisPeranLembaga[]): BarisPeranLembaga[] {
	return Object.entries(PASANGAN_KEPSEK).flatMap(([kode, pasangan]) => {
		const admin = baris.find((r) => r.peran_code === pasangan);
		return admin ? [{ peran_code: kode, lembaga_id: admin.lembaga_id, lembaga_nama: admin.lembaga_nama, tingkat: "kepsek" }] : [];
	});
}

// Satu-satunya peran yang boleh memakai aplikasi presensi. Peran lain
// (kesehatan, perizinan, admin_kegiatan, …) ditolak saat login dengan pesan
// yang sama seperti kredensial salah.
export const PERAN_PRESENSI = {
	gurusmk: { sebutan: "Guru SMK", tingkat: "guru" },
	gurumts: { sebutan: "Guru MTs", tingkat: "guru" },
	guruma: { sebutan: "Guru MA", tingkat: "guru" },
	gurudiniyah: { sebutan: "Guru Diniyah", tingkat: "guru" },
	adminpresensismk: { sebutan: "Admin Presensi SMK", tingkat: "admin" },
	adminpresensimts: { sebutan: "Admin Presensi MTs", tingkat: "admin" },
	adminpresensima: { sebutan: "Admin Presensi MA", tingkat: "admin" },
	adminpresensimadin: { sebutan: "Admin Presensi Madin", tingkat: "admin" },
	ksmts: { sebutan: "Kepala Sekolah MTs", tingkat: "kepsek" },
	ksma: { sebutan: "Kepala Sekolah MA", tingkat: "kepsek" },
	kssmk: { sebutan: "Kepala Sekolah SMK", tingkat: "kepsek" },
	ksmadin: { sebutan: "Kepala Madrasah Diniyah", tingkat: "kepsek" },
} as const satisfies Record<string, { sebutan: string; tingkat: Tingkat }>;

export type KodePeranPresensi = keyof typeof PERAN_PRESENSI;

export function peranPresensi(kode: string): kode is KodePeranPresensi {
	return Object.hasOwn(PERAN_PRESENSI, kode);
}

// Dipakai layar admin (Pembelajaran) untuk mencari daftar guru satu lembaga:
// kode peran guru diturunkan dari peran_lembaga sendiri (bukan ditebak dari
// pola nama seperti "madin" vs "diniyah" yang memang tidak selalu sama).
export async function kodePeranGuruDiLembaga(env: Env, lembagaId: string): Promise<string[]> {
	const { results } = await env.DB.prepare(
		"select distinct peran_code from peran_lembaga where lembaga_id = ? and tingkat = 'guru'",
	)
		.bind(lembagaId)
		.all<{ peran_code: string }>();
	return results.map((r) => r.peran_code);
}
