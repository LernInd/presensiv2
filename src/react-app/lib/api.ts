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

export const keluar = () => api<{ keluar: true }>("/keluar", { method: "POST" });

export const saya = () => api<Saya>("/saya");
