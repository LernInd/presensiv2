import { zona } from "./env";
import type { Orang } from "./pengguna";
import { hariLokal, tanggalLokal } from "./waktu";

export type SesiHariIni = {
	id: string;
	lembaga_id: string;
	kelas_id: string;
	kelas_nama: string;
	mapel: string;
	jam_ke: number | null;
	mulai: string;
	selesai: string;
	status: "buka" | "tutup";
	terisi: number;
};

type BarisJadwal = {
	id: string;
	lembaga_id: string;
	kelas_id: string;
	kelas_nama: string;
	mapel: string;
	jam_ke: number;
	mulai: string;
	selesai: string;
	guru_id: string | null;
	guru_nama: string | null;
};

function placeholder(n: number): string {
	return Array(n).fill("?").join(",");
}

/**
 * Jadwal mingguan seorang guru untuk hari ini, dengan sesi_pembelajaran-nya
 * disisipkan bila belum ada (aman diulang: `on conflict do nothing` + indeks
 * unik parsial `sesi_unik_idx`). Membuka dashboard sekaligus menerapkan
 * jadwal hari itu — santri yang tercatat "hadir dari scan masuk" mencerminkan
 * siapa yang sudah memindai sampai detik sesi ini dibuka, bukan pukul nol.
 */
export async function jadwalHariIni(
	env: Env,
	orang: Orang,
): Promise<{ tanggal: string; hari: number; sesi: SesiHariIni[] }> {
	const zonaPakai = zona(env); // penyederhanaan: satu zona untuk seluruh lembaga
	const sekarang = new Date();
	const tanggal = tanggalLokal(sekarang, zonaPakai);
	const hari = hariLokal(sekarang, zonaPakai);

	const lembagaIds = orang.lembagaBoleh.map((l) => l.id);
	if (lembagaIds.length === 0) return { tanggal, hari, sesi: [] };
	const namaLembaga = new Map(orang.lembagaBoleh.map((l) => [l.id, l.nama]));

	const { results: jadwal } = await env.DB.prepare(
		`select id, lembaga_id, kelas_id, kelas_nama, mapel, jam_ke, mulai, selesai, guru_id, guru_nama
		 from jadwal_pelajaran
		 where guru_id = ? and hari = ? and lembaga_id in (${placeholder(lembagaIds.length)})
		 order by mulai`,
	)
		.bind(orang.uid, hari, ...lembagaIds)
		.all<BarisJadwal>();

	if (jadwal.length > 0) {
		await env.DB.batch(
			jadwal.map((j) =>
				env.DB.prepare(
					`insert into sesi_pembelajaran
					   (id, lembaga_id, lembaga_nama, kelas_id, kelas_nama, mapel, jam_ke, tanggal,
					    status, terisi, dibuat_oleh, dibuat_oleh_nama, jadwal_id, mulai, selesai, guru_id, guru_nama)
					 values (?, ?, ?, ?, ?, ?, ?, ?, 'buka', 0, ?, ?, ?, ?, ?, ?, ?)
					 on conflict do nothing`,
				).bind(
					crypto.randomUUID(),
					j.lembaga_id,
					namaLembaga.get(j.lembaga_id) ?? "",
					j.kelas_id,
					j.kelas_nama,
					j.mapel,
					j.jam_ke,
					tanggal,
					orang.uid,
					orang.nama,
					j.id,
					j.mulai,
					j.selesai,
					j.guru_id,
					j.guru_nama,
				),
			),
		);
	}

	const { results: sesi } = await env.DB.prepare(
		`select id, lembaga_id, kelas_id, kelas_nama, mapel, jam_ke, mulai, selesai, status, terisi
		 from sesi_pembelajaran
		 where tanggal = ? and guru_id = ? and lembaga_id in (${placeholder(lembagaIds.length)})
		 order by mulai`,
	)
		.bind(tanggal, orang.uid, ...lembagaIds)
		.all<SesiHariIni>();

	return { tanggal, hari, sesi };
}
