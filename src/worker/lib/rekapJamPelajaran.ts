import type { Rentang } from "./rekapKehadiran";

type BarisSesi = {
	id: string;
	tanggal: string;
	kelas_id: string;
	kelas_nama: string;
	mapel: string;
	jam_ke: number | null;
	mulai: string | null;
	selesai: string | null;
	guru_nama: string | null;
	dibuat_oleh_nama: string;
	terisi: number;
};

type BarisSantri = {
	sesi_id: string;
	santri_id: string;
	santri_nama: string;
	status: string;
	status_awal: string;
	keterangan: string | null;
};

type BarisRiwayat = { sesi_id: string; santri_id: string; oleh_nama: string; pada: string };

export type SantriRekapSesi = {
	santri_id: string;
	santri_nama: string;
	status: string;
	keterangan: string | null;
	// Hanya terisi bila status diubah guru (mis. jadi tidak_hadir): siapa dan kapan.
	diubah_oleh: string | null;
	diubah_pada: string | null;
};

export type SesiRekap = Omit<BarisSesi, "terisi"> & {
	diabsen: boolean;
	santri: SantriRekapSesi[];
};

/**
 * Rekap setiap jam pelajaran pada rentang: kehadiran tiap siswa, guru
 * pengampu, guru yang membuka/mengabsen sesi (`dibuat_oleh_nama`), dan
 * keterangan saat status diubah ke tidak hadir. Hanya sesi yang sudah dibuka
 * guru yang ada di D1 (sesi dibuat lazy dari jadwal), jadi jam yang tak pernah
 * dibuka tidak muncul di sini.
 */
export async function rekapJamPelajaran(
	env: Env,
	lembagaId: string,
	rentang: Rentang,
	kelasId: string | null,
): Promise<{ dari: string; sampai: string; sesi: SesiRekap[] }> {
	const kelasSql = kelasId ? "and s.kelas_id = ?" : "";
	const param = kelasId ? [lembagaId, rentang.dari, rentang.sampai, kelasId] : [lembagaId, rentang.dari, rentang.sampai];

	const [sesi, santri, riwayat] = await Promise.all([
		env.DB.prepare(
			`select s.id, s.tanggal, s.kelas_id, s.kelas_nama, s.mapel, s.jam_ke, s.mulai, s.selesai,
			        s.guru_nama, s.dibuat_oleh_nama, s.terisi
			 from sesi_pembelajaran s
			 where s.lembaga_id = ? and s.tanggal between ? and ? ${kelasSql}
			 order by s.tanggal, s.kelas_nama, s.jam_ke, s.mulai`,
		)
			.bind(...param)
			.all<BarisSesi>(),
		env.DB.prepare(
			`select p.sesi_id, p.santri_id, p.santri_nama, p.status, p.status_awal, p.keterangan
			 from presensi_pembelajaran p join sesi_pembelajaran s on s.id = p.sesi_id
			 where s.lembaga_id = ? and s.tanggal between ? and ? ${kelasSql}
			 order by p.santri_nama`,
		)
			.bind(...param)
			.all<BarisSantri>(),
		env.DB.prepare(
			`select r.sesi_id, r.santri_id, r.oleh_nama, r.pada
			 from riwayat_presensi r join sesi_pembelajaran s on s.id = r.sesi_id
			 where s.lembaga_id = ? and s.tanggal between ? and ? ${kelasSql}
			   and r.id = (select max(r2.id) from riwayat_presensi r2
			               where r2.sesi_id = r.sesi_id and r2.santri_id = r.santri_id)`,
		)
			.bind(...param)
			.all<BarisRiwayat>(),
	]);

	const terakhir = new Map(riwayat.results.map((r) => [`${r.sesi_id}|${r.santri_id}`, r]));
	const perSesi = new Map<string, SantriRekapSesi[]>();
	for (const p of santri.results) {
		const diubah = p.status !== p.status_awal ? terakhir.get(`${p.sesi_id}|${p.santri_id}`) : undefined;
		const daftar = perSesi.get(p.sesi_id) ?? [];
		daftar.push({
			santri_id: p.santri_id,
			santri_nama: p.santri_nama,
			status: p.status,
			keterangan: p.keterangan,
			diubah_oleh: diubah?.oleh_nama ?? null,
			diubah_pada: diubah?.pada ?? null,
		});
		perSesi.set(p.sesi_id, daftar);
	}

	return {
		dari: rentang.dari,
		sampai: rentang.sampai,
		sesi: sesi.results.map(({ terisi, ...s }) => ({ ...s, diabsen: terisi === 1, santri: perSesi.get(s.id) ?? [] })),
	};
}
