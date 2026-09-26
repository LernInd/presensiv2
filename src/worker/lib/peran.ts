// Tingkat peran di presensi-db (kolom `peran_lembaga.tingkat`). Disalin dari
// presensi-api agar kedua aplikasi menafsirkan peran dengan cara yang sama.
export const TINGKAT = {
	admin: { sebutan: "Admin presensi", modul: "presensi" },
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
		} else if (tingkat === "admin") {
			sudah.tingkat = "admin";
		}
	}
	return [...perLembaga.values()];
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
} as const satisfies Record<string, { sebutan: string; tingkat: Tingkat }>;

export type KodePeranPresensi = keyof typeof PERAN_PRESENSI;

export function peranPresensi(kode: string): kode is KodePeranPresensi {
	return Object.hasOwn(PERAN_PRESENSI, kode);
}
