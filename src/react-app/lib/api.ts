import type { GalatKolom } from "./validasi";

export class GagalApi extends Error {
	constructor(
		readonly status: number,
		pesan: string,
		readonly tunggu?: number,
		readonly kolom?: GalatKolom,
	) {
		super(pesan);
	}
}

let peranAktif: string | null = null;

// Peran aktif dikirim lewat header X-Peran; server memastikan peran itu
// memang milik pengguna, jadi ini hanya mempersempit, tidak menambah hak.
export function setPeranAktif(kode: string | null) {
	peranAktif = kode;
}

// Sesi dibawa cookie HttpOnly yang dipasang server; JavaScript tidak pernah
// melihat token. Cukup kirim permintaan ke origin yang sama.
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
	const headers = new Headers(init.headers);
	if (peranAktif) headers.set("X-Peran", peranAktif);
	if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

	let respons: Response;
	try {
		respons = await fetch(`/api${path}`, { ...init, headers, credentials: "same-origin" });
	} catch {
		throw new GagalApi(0, "Tidak dapat terhubung. Periksa koneksi internet Anda.");
	}
	const isi = (await respons.json().catch(() => ({}))) as {
		error?: string;
		tunggu?: number;
		kolom?: GalatKolom;
	};
	if (!respons.ok) {
		throw new GagalApi(respons.status, isi.error ?? "Permintaan gagal", isi.tunggu, isi.kolom);
	}
	return isi as T;
}

export type PeranPengguna = {
	kode: string;
	sebutan: string;
	tingkat: "admin" | "guru";
	lembaga: { id: string; nama: string }[];
};

export type Saya = {
	uid: string;
	username: string;
	nama: string;
	foto_url: string | null;
	peran: PeranPengguna[];
	peran_aktif: string | null;
	tingkat: string;
};

export const masuk = (username: string, password: string) =>
	api<Saya>("/masuk", { method: "POST", body: JSON.stringify({ username, password }) });

export const keluar = async () => {
	try {
		return await api<{ keluar: true }>("/keluar", { method: "POST" });
	} finally {
		// Cache jadwal-hari-ini (lih. jadwalHariIni di bawah) ikut dibuang saat
		// keluar — jangan sampai jadwal satu pengguna nyangkut untuk pengguna
		// berikutnya di perangkat/tab yang sama.
		bersihkanCacheJadwal();
	}
};

export const saya = () => api<Saya>("/saya");

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

export type JadwalHariIni = {
	tanggal: string;
	hari: number;
	sesi: SesiHariIni[];
	libur: { lembaga_id: string; tanggal: string; keterangan: string | null }[];
};

const ZONA_TAMPIL = "Asia/Jakarta";
const AWALAN_CACHE_JADWAL = "presensiv2:jadwal-hari-ini";

// Tanggal WIB (bukan zona perangkat pengguna) supaya kunci cache "reset"
// tepat tengah malam WIB, sesuai zona bawaan server (lih. lib/env.ts di
// worker — default juga Asia/Jakarta).
function tanggalWib(): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: ZONA_TAMPIL,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(new Date());
}

function kunciCacheJadwal(): string {
	return `${AWALAN_CACHE_JADWAL}:${tanggalWib()}:${peranAktif ?? "_"}`;
}

/** Dipanggil saat keluar supaya jadwal tidak nyangkut untuk sesi berikutnya. */
export function bersihkanCacheJadwal(): void {
	try {
		for (let i = sessionStorage.length - 1; i >= 0; i--) {
			const kunci = sessionStorage.key(i);
			if (kunci?.startsWith(AWALAN_CACHE_JADWAL)) sessionStorage.removeItem(kunci);
		}
	} catch {
		// sessionStorage bisa saja dilarang (mode privat dsb.) — bukan fatal.
	}
}

/**
 * Jadwal hari ini disimpan di sessionStorage (bukan diminta ulang ke server)
 * selama tanggal WIB belum berganti — kuncinya menyertakan tanggal, jadi
 * otomatis "reset" begitu lewat tengah malam WIB, dan ikut hilang saat tab
 * ditutup atau pengguna keluar (lih. bersihkanCacheJadwal). Ini cache di
 * level aplikasi, BUKAN header Cache-Control di server: jawaban API tetap
 * `no-store` seperti semula, supaya tidak ada risiko jadwal satu pengguna
 * kebaca dari cache HTTP oleh pengguna lain di perangkat yang sama.
 */
export async function jadwalHariIni(): Promise<JadwalHariIni> {
	const kunci = kunciCacheJadwal();
	try {
		const tersimpan = sessionStorage.getItem(kunci);
		if (tersimpan) return JSON.parse(tersimpan) as JadwalHariIni;
	} catch {
		// lanjut ambil dari server kalau sessionStorage bermasalah dibaca
	}

	const data = await api<JadwalHariIni>("/jadwal-hari-ini");
	try {
		sessionStorage.setItem(kunci, JSON.stringify(data));
	} catch {
		// penyimpanan penuh/dilarang — tidak fatal, cukup tidak tersimpan
	}
	return data;
}

export type BarisPresensi = {
	santri_id: string;
	santri_nama: string;
	status: string;
	status_awal: string;
	keterangan: string | null;
};

export type DetailSesi = {
	sesi: SesiHariIni & { lembaga_nama: string; guru_nama: string | null };
	presensi: BarisPresensi[];
};

export const detailPresensiSesi = (sesiId: string) => api<DetailSesi>(`/sesi/${sesiId}/presensi`);

export const ubahPresensi = (sesiId: string, santriId: string, badan: { status: string; keterangan?: string }) =>
	api<{ status: string; keterangan: string | null }>(`/sesi/${sesiId}/presensi/${santriId}`, {
		method: "PATCH",
		body: JSON.stringify(badan),
	});

export type SantriRingkas = {
	id: string;
	nama_lengkap: string;
	kelas_nama: string | null;
	lembaga_nama: string;
	foto_url: string | null;
};

export type BadanScan = { cara: "qr"; kode: string } | { cara: "manual"; santri_id: string };

export type HasilScan =
	| { diblokir: true; alasan: string; santri: SantriRingkas }
	| { diblokir: false; sudah: true; status: string; waktu: string; santri: SantriRingkas }
	| { diblokir: false; sudah: false; status: string; santri: SantriRingkas };

export type TipeGerbang = "masuk" | "pulang";

export const pratinjauPresensi = (tipe: TipeGerbang, badan: BadanScan) =>
	api<HasilScan>(`/presensi/${tipe}/pratinjau`, { method: "POST", body: JSON.stringify(badan) });

export const catatPresensi = (tipe: TipeGerbang, badan: BadanScan) =>
	api<HasilScan>(`/presensi/${tipe}`, { method: "POST", body: JSON.stringify(badan) });

export const cariSantri = (q: string) => api<SantriRingkas[]>(`/santri/cari?q=${encodeURIComponent(q)}`);

// ---- Pembelajaran (admin: hari aktif, libur, jadwal mingguan) ----

export type HariLibur = { id: string; lembaga_id: string; tanggal: string; keterangan: string | null; dibuat_oleh_nama: string };
export type PengaturanHari = { hari_aktif: number[]; libur: HariLibur[] };

export const ambilPengaturanHari = () => api<PengaturanHari>("/pengaturan/hari");
export const simpanHariAktif = (hariAktif: number[]) =>
	api<{ tersimpan: true }>("/pengaturan/hari", { method: "PUT", body: JSON.stringify({ hari_aktif: hariAktif }) });
export const tambahHariLibur = (tanggal: string, keterangan: string) =>
	api<HariLibur>("/pengaturan/hari/libur", { method: "POST", body: JSON.stringify({ tanggal, keterangan }) });
export const hapusHariLibur = (tanggal: string) =>
	api<{ dihapus: true }>(`/pengaturan/hari/libur/${tanggal}`, { method: "DELETE" });

export type KelasRingkas = { id: string; nama: string; jumlah_anggota: number };
export const ambilKelas = () => api<KelasRingkas[]>("/pengaturan/kelas");

export type GuruRingkas = { id: string; nama_lengkap: string; peran_code: string };
export const ambilGuru = () => api<GuruRingkas[]>("/pengaturan/guru");

export type BarisJadwalAdmin = {
	id: string;
	kelas_id: string;
	kelas_nama: string;
	hari: number;
	jam_ke: number;
	mapel: string;
	mulai: string;
	selesai: string;
	guru_id: string | null;
	guru_nama: string | null;
};

export type BadanJadwalAdmin = {
	kelas_id: string;
	hari: number;
	mapel: string;
	mulai: string;
	selesai: string;
	guru_id: string | null;
};

export const ambilJadwalAdmin = (kelasId: string, hari: number) =>
	api<BarisJadwalAdmin[]>(`/pengaturan/jadwal?kelas_id=${encodeURIComponent(kelasId)}&hari=${hari}`);

export const tambahJadwalAdmin = (badan: BadanJadwalAdmin) =>
	api<BarisJadwalAdmin>("/pengaturan/jadwal", { method: "POST", body: JSON.stringify(badan) });

export const ubahJadwalAdmin = (id: string, badan: BadanJadwalAdmin) =>
	api<BarisJadwalAdmin>(`/pengaturan/jadwal/${id}`, { method: "PATCH", body: JSON.stringify(badan) });

export const hapusJadwalAdmin = (id: string) =>
	api<{ dihapus: true }>(`/pengaturan/jadwal/${id}`, { method: "DELETE" });
