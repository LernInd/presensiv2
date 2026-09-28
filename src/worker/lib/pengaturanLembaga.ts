export type PengaturanLembaga = {
	lembaga_id: string;
	lembaga_nama: string;
	jam_masuk: string;
	batas_terlambat: string;
	jam_pulang: string | null;
	batas_awal_pulang: string | null;
	zona: string;
	hari_aktif: string;
};

export function ambilPengaturan(env: Env, lembagaId: string): Promise<PengaturanLembaga | null> {
	return env.DB.prepare("select * from pengaturan_lembaga where lembaga_id = ?")
		.bind(lembagaId)
		.first<PengaturanLembaga>();
}

const JAM_MASUK_BAWAAN = "06:00";
const BATAS_TERLAMBAT_BAWAAN = "07:00";

/**
 * Hanya `hari_aktif` yang diubah di sini (halaman "Hari"). Bila lembaga
 * belum punya baris pengaturan sama sekali, baris dibuat dengan jam gerbang
 * bawaan yang aman — jam_masuk/batas_terlambat NOT NULL di skema dan
 * pengaturan jam sungguhan menyusul lewat halaman pengaturan gerbang
 * (belum dibangun). Bila baris sudah ada, jam yang sudah diatur admin
 * TIDAK ikut ditimpa oleh nilai bawaan itu.
 */
export async function simpanHariAktif(
	env: Env,
	lembagaId: string,
	lembagaNama: string,
	hariAktifCsv: string,
): Promise<void> {
	await env.DB.prepare(
		`insert into pengaturan_lembaga (lembaga_id, lembaga_nama, jam_masuk, batas_terlambat, hari_aktif)
		 values (?, ?, ?, ?, ?)
		 on conflict (lembaga_id) do update set hari_aktif = excluded.hari_aktif`,
	)
		.bind(lembagaId, lembagaNama, JAM_MASUK_BAWAAN, BATAS_TERLAMBAT_BAWAAN, hariAktifCsv)
		.run();
}
