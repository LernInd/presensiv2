import type { RekapJamPelajaran, RekapKehadiran } from "./api";

const LABEL_STATUS: Record<string, string> = {
	hadir: "Hadir",
	tidak_hadir: "Tidak hadir",
	alfa: "Alfa",
	izin: "Izin",
	sakit: "Sakit",
};

// riwayat_presensi.pada bisa ISO ("…T…Z") atau `datetime('now')` (UTC) → WIB.
function waktuWib(utc: string | null): string {
	if (!utc) return "";
	const iso = utc.endsWith("Z") ? utc : `${utc.replace(" ", "T")}Z`;
	return new Date(iso).toLocaleString("id-ID", {
		timeZone: "Asia/Jakarta",
		day: "numeric",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

const kepala = (teks: string) => ({ value: teks, fontWeight: "bold" as const });
const sel = (teks: string | number | null | undefined) => ({ value: teks === null || teks === undefined ? "" : String(teks) });

/**
 * Menyusun satu berkas .xlsx berisi dua lembar (Kehadiran Gerbang dan Jam
 * Pelajaran) lalu mengunduhnya. Berkas dibuat di peramban dari dua jawaban API
 * — satu kali ambil per lembar saat tombol Unduh ditekan, bukan memuat tabel
 * besar ke layar. Pustaka dimuat malas supaya bundel awal tidak membengkak.
 */
export async function unduhRekapXlsx(
	kehadiran: RekapKehadiran,
	jam: RekapJamPelajaran,
	namaBerkas: string,
): Promise<void> {
	const { default: tulisExcel } = await import("write-excel-file/browser");

	const lembarGerbang = [
		["Tanggal", "Santri", "Kelas", "Jam Masuk", "Keterangan Masuk", "Jam Pulang", "Keterangan Pulang"].map(kepala),
		...kehadiran.baris.map((b) => [
			sel(b.tanggal),
			sel(b.santri_nama),
			sel(b.kelas_nama),
			sel(b.masuk.jam),
			sel(b.masuk.keterangan),
			sel(b.pulang.jam),
			sel(b.pulang.keterangan),
		]),
	];

	const lembarJam = [
		[
			"Tanggal",
			"Kelas",
			"Jam Ke",
			"Mulai",
			"Selesai",
			"Pelajaran",
			"Guru Pengampu",
			"Diabsen Oleh",
			"Santri",
			"Status",
			"Keterangan",
			"Diubah Oleh",
			"Diubah Pada",
		].map(kepala),
		...jam.sesi.flatMap((s) => {
			const depan = [sel(s.tanggal), sel(s.kelas_nama), sel(s.jam_ke), sel(s.mulai), sel(s.selesai), sel(s.mapel), sel(s.guru_nama), sel(s.dibuat_oleh_nama)];
			if (!s.diabsen || s.santri.length === 0) {
				return [[...depan, sel("(absen belum dibuka)"), sel(""), sel(""), sel(""), sel("")]];
			}
			return s.santri.map((p) => [
				...depan,
				sel(p.santri_nama),
				sel(LABEL_STATUS[p.status] ?? p.status),
				sel(p.keterangan),
				sel(p.status === "tidak_hadir" ? p.diubah_oleh : null),
				sel(p.status === "tidak_hadir" ? waktuWib(p.diubah_pada) : null),
			]);
		}),
	];

	await tulisExcel([
		{ data: lembarGerbang, sheet: "Kehadiran Gerbang", stickyRowsCount: 1, columns: [{ width: 12 }, { width: 30 }, { width: 14 }, { width: 11 }, { width: 18 }, { width: 11 }, { width: 34 }] },
		{ data: lembarJam, sheet: "Jam Pelajaran", stickyRowsCount: 1, columns: [{ width: 12 }, { width: 14 }, { width: 8 }, { width: 8 }, { width: 8 }, { width: 22 }, { width: 24 }, { width: 24 }, { width: 30 }, { width: 13 }, { width: 30 }, { width: 24 }, { width: 22 }] },
	]).toFile(namaBerkas);
}
