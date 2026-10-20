import type { RekapJamPelajaran, RekapKehadiran } from "./api";

// Penyusun lembar rekap siswa (murni, tanpa pustaka Excel supaya mudah diuji).
// Setiap berkas dipecah per kelas — satu worksheet per kelas — dengan baris
// diurut nama santri lalu tanggal; `eksporRekap.ts` yang menuliskannya ke .xlsx.

export type Sel = string | number | null;
export type Lembar = { nama: string; judul: string[]; lebar: number[]; baris: Sel[][] };

const TANPA_KELAS = "Tanpa Kelas";

const LABEL_STATUS: Record<string, string> = {
	hadir: "Hadir",
	tidak_hadir: "Tidak hadir",
	alfa: "Alfa",
	izin: "Izin",
	sakit: "Sakit",
};

const banding = (a: string, b: string) => a.localeCompare(b, "id", { sensitivity: "base" });

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

/**
 * Nama worksheet Excel: tanpa karakter terlarang `[ ] : * ? / \`, maksimal 31
 * karakter, dan unik (tanpa beda huruf besar/kecil) di dalam satu berkas.
 */
export function namaLembar(kelas: string, terpakai: Set<string>): string {
	const bersih = kelas.replace(/[[\]:*?/\\]/g, "-").trim() || "Kelas";
	let nama = bersih.slice(0, 31);
	for (let n = 2; terpakai.has(nama.toLowerCase()); n++) {
		const akhiran = ` (${n})`;
		nama = bersih.slice(0, 31 - akhiran.length) + akhiran;
	}
	terpakai.add(nama.toLowerCase());
	return nama;
}

/** Urutan kelas: alami ("Kelas 2" < "Kelas 10"), "Tanpa Kelas" paling akhir. */
function urutKelas(a: string, b: string): number {
	if (a === TANPA_KELAS) return b === TANPA_KELAS ? 0 : 1;
	if (b === TANPA_KELAS) return -1;
	return a.localeCompare(b, "id", { numeric: true, sensitivity: "base" });
}

/** Mengelompokkan baris per kelas (kelas kosong → "Tanpa Kelas"), kelas terurut. */
export function kelompokPerKelas<T>(baris: T[], kelasDari: (b: T) => string | null): [string, T[]][] {
	const peta = new Map<string, T[]>();
	for (const b of baris) {
		const kelas = kelasDari(b)?.trim() || TANPA_KELAS;
		const daftar = peta.get(kelas);
		if (daftar) daftar.push(b);
		else peta.set(kelas, [b]);
	}
	return [...peta.entries()].sort((a, b) => urutKelas(a[0], b[0]));
}

function jadikanLembar<T>(
	kelompok: [string, T[]][],
	judul: string[],
	lebar: number[],
	barisDari: (b: T) => Sel[],
): Lembar[] {
	const terpakai = new Set<string>();
	// Tanpa data sama sekali tetap menghasilkan satu lembar (hanya judul): berkas Excel butuh minimal satu.
	if (kelompok.length === 0) return [{ nama: namaLembar("Rekap", terpakai), judul, lebar, baris: [] }];
	return kelompok.map(([kelas, isi]) => ({ nama: namaLembar(kelas, terpakai), judul, lebar, baris: isi.map(barisDari) }));
}

/** Scan Masuk/Pulang: lembar per kelas; urut nama santri, lalu tanggal. */
export function lembarScanPerKelas(data: RekapKehadiran): Lembar[] {
	const kelompok = kelompokPerKelas(data.baris, (b) => b.kelas_nama).map(
		([kelas, isi]): [string, typeof isi] => [
			kelas,
			[...isi].sort((a, b) => banding(a.santri_nama, b.santri_nama) || a.tanggal.localeCompare(b.tanggal)),
		],
	);
	return jadikanLembar(
		kelompok,
		["Santri", "Tanggal", "Jam Masuk", "Keterangan Masuk", "Jam Pulang", "Keterangan Pulang"],
		[30, 12, 11, 18, 11, 34],
		(b) => [b.santri_nama, b.tanggal, b.masuk.jam, b.masuk.keterangan, b.pulang.jam, b.pulang.keterangan],
	);
}

type BarisPembelajaran = {
	santri: string;
	tanggal: string;
	jamKe: number | null;
	mulai: string;
	kelas: string;
	sel: Sel[];
};

/**
 * Per Pembelajaran: lembar per kelas, satu baris per santri per jam pelajaran;
 * urut nama santri, tanggal, lalu jam ke. Sesi yang absennya belum dibuka
 * menjadi satu baris tanpa santri di akhir lembar kelasnya.
 */
export function lembarPembelajaranPerKelas(data: RekapJamPelajaran): Lembar[] {
	const semua: BarisPembelajaran[] = data.sesi.flatMap((s) => {
		const depan = [s.tanggal, s.jam_ke, s.mulai, s.selesai, s.mapel, s.guru_nama, s.dibuat_oleh_nama] as Sel[];
		const dasar = { tanggal: s.tanggal, jamKe: s.jam_ke, mulai: s.mulai ?? "", kelas: s.kelas_nama };
		if (!s.diabsen || s.santri.length === 0) {
			return [{ ...dasar, santri: "", sel: ["(absen belum dibuka)", ...depan, "", "", "", ""] }];
		}
		return s.santri.map((p) => ({
			...dasar,
			santri: p.santri_nama,
			sel: [
				p.santri_nama,
				...depan,
				LABEL_STATUS[p.status] ?? p.status,
				p.keterangan,
				p.status === "tidak_hadir" ? p.diubah_oleh : null,
				p.status === "tidak_hadir" ? waktuWib(p.diubah_pada) : null,
			],
		}));
	});

	const urut = (a: BarisPembelajaran, b: BarisPembelajaran) => {
		if ((a.santri === "") !== (b.santri === "")) return a.santri === "" ? 1 : -1; // tanpa santri di akhir
		return (
			banding(a.santri, b.santri) ||
			a.tanggal.localeCompare(b.tanggal) ||
			(a.jamKe ?? 99) - (b.jamKe ?? 99) ||
			a.mulai.localeCompare(b.mulai)
		);
	};

	const kelompok = kelompokPerKelas(semua, (b) => b.kelas).map(([kelas, isi]): [string, BarisPembelajaran[]] => [
		kelas,
		[...isi].sort(urut),
	]);
	return jadikanLembar(
		kelompok,
		["Santri", "Tanggal", "Jam Ke", "Mulai", "Selesai", "Pelajaran", "Guru Pengampu", "Diabsen Oleh", "Status", "Keterangan", "Diubah Oleh", "Diubah Pada"],
		[30, 12, 8, 8, 8, 22, 24, 24, 13, 30, 24, 22],
		(b) => b.sel,
	);
}
