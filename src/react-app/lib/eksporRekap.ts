import type { RekapJamPelajaran, RekapKehadiran, RekapKehadiranGuru } from "./api";
import { lembarPembelajaranPerKelas, lembarScanPerKelas, type Lembar, type Sel } from "./susunRekap";

const kepala = (teks: string) => ({ value: teks, fontWeight: "bold" as const });
const sel = (teks: Sel | undefined) => ({ value: teks === null || teks === undefined ? "" : String(teks) });

/**
 * Menulis lembar-lembar rekap ke satu berkas .xlsx lalu mengunduhnya. Berkas
 * dibuat di peramban dari satu jawaban API saat tombol Unduh ditekan, bukan
 * memuat tabel besar ke layar. Pustaka dimuat malas supaya bundel awal tidak
 * membengkak.
 */
async function tulisBerkas(lembar: Lembar[], namaBerkas: string): Promise<void> {
	const { default: tulisExcel } = await import("write-excel-file/browser");
	await tulisExcel(
		lembar.map((l) => ({
			data: [l.judul.map(kepala), ...l.baris.map((b) => b.map(sel))],
			sheet: l.nama,
			stickyRowsCount: 1,
			columns: l.lebar.map((width) => ({ width })),
		})),
	).toFile(namaBerkas);
}

/** Rekap Scan Masuk/Pulang: satu worksheet per kelas, urut nama santri lalu tanggal. */
export async function unduhRekapScanXlsx(data: RekapKehadiran, namaBerkas: string): Promise<number> {
	const lembar = lembarScanPerKelas(data);
	await tulisBerkas(lembar, namaBerkas);
	return lembar.length;
}

/** Rekap Per Pembelajaran: satu worksheet per kelas, urut nama santri, tanggal, jam ke. */
export async function unduhRekapPembelajaranXlsx(data: RekapJamPelajaran, namaBerkas: string): Promise<number> {
	const lembar = lembarPembelajaranPerKelas(data);
	await tulisBerkas(lembar, namaBerkas);
	return lembar.length;
}

/**
 * Satu lembar "Kehadiran Guru": jam masuk dan jam pulang per guru per tanggal.
 * Presensi yang ditandai tidak valid oleh kepala sekolah sudah dikosongkan
 * jamnya oleh server; tidak ada foto, lokasi, maupun alasan kepala sekolah.
 */
export async function unduhRekapGuruXlsx(data: RekapKehadiranGuru, namaBerkas: string): Promise<void> {
	await tulisBerkas(
		[
			{
				nama: "Kehadiran Guru",
				judul: ["Tanggal", "Guru", "Jam Masuk", "Jam Pulang", "Keterangan"],
				lebar: [12, 34, 12, 12, 40],
				baris: data.baris.map((b) => [b.tanggal, b.guru_nama, b.jam_masuk, b.jam_pulang, b.keterangan]),
			},
		],
		namaBerkas,
	);
}
