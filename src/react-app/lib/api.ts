import { getSupabase } from "./supabase";

export class GagalApi extends Error {
	constructor(
		readonly status: number,
		pesan: string,
	) {
		super(pesan);
	}
}

let peranAktif: string | null = null;

// Peran aktif dikirim lewat header X-Peran; worker memastikan peran itu
// memang dimiliki pengguna, jadi ini hanya mempersempit, tidak menambah hak.
export function setPeranAktif(kode: string | null) {
	peranAktif = kode;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
	const supabase = await getSupabase();
	const {
		data: { session },
	} = await supabase.auth.getSession();

	const headers = new Headers(init.headers);
	if (session) headers.set("Authorization", `Bearer ${session.access_token}`);
	if (peranAktif) headers.set("X-Peran", peranAktif);
	if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

	const respons = await fetch(`/api${path}`, { ...init, headers });
	const isi = await respons.json().catch(() => ({}));
	if (!respons.ok) {
		throw new GagalApi(respons.status, (isi as { error?: string }).error ?? "Permintaan gagal");
	}
	return isi as T;
}

export type Saya = {
	uid: string;
	username: string;
	nama: string;
	jenis_kelamin: "laki_laki" | "perempuan" | null;
	foto_url: string | null;
	peran: string[];
	peran_aktif: string | null;
	peran_tersedia: { kode: string; lembaga_id: string; lembaga_nama: string; tingkat: string }[];
	lembaga: { id: string; nama: string; tingkat: string }[];
	boleh_atur: boolean;
	tingkat: string;
};
