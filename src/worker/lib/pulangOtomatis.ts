import { liburPadaTanggal } from "./hariLibur";
import { hariAktifBerlaku, hariLokal, tanggalLokal } from "./waktu";

// Nilai penanda baris pulang buatan job ini di kolom `dicatat_oleh`. Rekap
// membedakan "scan pulang sungguhan" dari "tidak scan" lewat penanda ini —
// skema presensi_harian dipakai bersama worker lain, jadi tidak ada kolom baru.
export const PENANDA_SISTEM = "sistem";

export type HasilPulangOtomatis = {
	tanggal: string;
	perLembaga: { lembaga_id: string; dilewati: string | null; jumlah: number }[];
	total: number;
};

type BarisPengaturan = { lembaga_id: string; zona: string; hari_aktif: string };

/**
 * Dijalankan cron 19:00 WIB. Santri yang sudah scan masuk hari ini tetapi tidak
 * scan pulang dianggap pulang/kembali ke asrama lebih dulu — ketidakpatuhan,
 * jadi dicatat "tidak tepat waktu". Nilai yang tersimpan `terlambat` karena
 * itu satu-satunya nilai sah selain `pulang` di CHECK presensi_harian; layar
 * rekap menampilkannya sebagai "Tidak tepat waktu".
 *
 * Aman dijalankan berulang (`on conflict do nothing` pada PK tanggal+santri+
 * tipe). Santri yang tidak scan masuk (alfa/sakit/izin) tidak disentuh.
 * `dryRun` hanya menghitung baris yang akan disisipkan.
 */
export async function catatPulangOtomatis(
	env: Env,
	opsi: { sekarang?: Date; dryRun?: boolean } = {},
): Promise<HasilPulangOtomatis> {
	const sekarang = opsi.sekarang ?? new Date();
	const { results: pengaturan } = await env.DB.prepare(
		"select lembaga_id, zona, hari_aktif from pengaturan_lembaga",
	).all<BarisPengaturan>();

	const perLembaga: HasilPulangOtomatis["perLembaga"] = [];
	let tanggalUtama = "";

	for (const p of pengaturan) {
		const tanggal = tanggalLokal(sekarang, p.zona);
		tanggalUtama ||= tanggal;

		if (!hariAktifBerlaku(p.hari_aktif, hariLokal(sekarang, p.zona))) {
			perLembaga.push({ lembaga_id: p.lembaga_id, dilewati: "bukan hari aktif", jumlah: 0 });
			continue;
		}
		if (await liburPadaTanggal(env, p.lembaga_id, tanggal)) {
			perLembaga.push({ lembaga_id: p.lembaga_id, dilewati: "hari libur", jumlah: 0 });
			continue;
		}

		const syarat = `from presensi_harian m
			 where m.tanggal = ? and m.lembaga_id = ? and m.tipe = 'masuk'
			   and m.status in ('tepat_waktu', 'terlambat')
			   and not exists (
			     select 1 from presensi_harian x
			     where x.tanggal = m.tanggal and x.santri_id = m.santri_id and x.tipe = 'pulang'
			   )`;

		let jumlah: number;
		if (opsi.dryRun) {
			const baris = await env.DB.prepare(`select count(*) as n ${syarat}`)
				.bind(tanggal, p.lembaga_id)
				.first<{ n: number }>();
			jumlah = baris?.n ?? 0;
		} else {
			const hasil = await env.DB.prepare(
				`insert into presensi_harian
				   (tanggal, santri_id, tipe, lembaga_id, waktu, status, santri_nama, kelas_nama, dicatat_oleh, cara)
				 select m.tanggal, m.santri_id, 'pulang', m.lembaga_id, ?, 'terlambat', m.santri_nama, m.kelas_nama, ?, 'manual'
				 ${syarat}
				 on conflict (tanggal, santri_id, tipe) do nothing`,
			)
				.bind(sekarang.toISOString(), PENANDA_SISTEM, tanggal, p.lembaga_id)
				.run();
			jumlah = hasil.meta.changes ?? 0;
		}
		perLembaga.push({ lembaga_id: p.lembaga_id, dilewati: null, jumlah });
	}

	return { tanggal: tanggalUtama, perLembaga, total: perLembaga.reduce((n, l) => n + l.jumlah, 0) };
}
