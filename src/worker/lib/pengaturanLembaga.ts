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
