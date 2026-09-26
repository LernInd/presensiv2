import { GagalRute, GagalSupabase } from "./galat";

// Semua akses ke activity-db lewat PostgREST MEMAKAI TOKEN PENGGUNA, bukan
// service_role. Dengan begitu RLS di Supabase tetap menjadi penjaga data induk:
// worker hanya bisa membaca apa yang memang boleh dibaca orang itu.
export async function ambil<T>(env: Env, jalur: string, token: string): Promise<T> {
	const respons = await fetch(`${env.SUPABASE_URL}/rest/v1/${jalur}`, {
		headers: {
			apikey: env.SUPABASE_PUBLISHABLE_KEY,
			Authorization: `Bearer ${token}`,
			Accept: "application/json",
		},
	});
	if (!respons.ok) {
		const teks = await respons.text();
		console.error(`PostgREST ${respons.status} untuk ${jalur.split("?")[0]}: ${teks.slice(0, 300)}`);
		throw new GagalSupabase(
			respons.status === 401 || respons.status === 403 ? 403 : 502,
			"Supabase menolak permintaan",
		);
	}
	return respons.json<T>();
}

const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ID disisipkan ke query string PostgREST, jadi wajib dipastikan berbentuk UUID
// agar tidak bisa dipakai menyelipkan operator/penyaring tambahan.
export function uuid(nilai: string, nama = "id"): string {
	if (!POLA_UUID.test(nilai)) throw new GagalRute(400, `${nama} tidak sah`);
	return nilai.toLowerCase();
}

export type Profil = {
	id: string;
	username: string;
	nama_lengkap: string;
	jenis_kelamin: "laki_laki" | "perempuan" | null;
	peran: string[] | null;
	is_active: boolean;
	foto_path: string | null;
};

export type Santri = {
	id: string;
	nama_lengkap: string;
	jenis_kelamin: "laki_laki" | "perempuan";
	kamar_nama: string | null;
	lembaga_id: string[] | null;
	kelas_id: string[] | null;
	kelas: unknown;
	foto_path: string | null;
};

export async function profilSaya(env: Env, token: string, uid: string): Promise<Profil | null> {
	const baris = await ambil<Profil[]>(
		env,
		`v_pengguna?id=eq.${uuid(uid)}&select=id,username,nama_lengkap,jenis_kelamin,peran,is_active,foto_path&limit=1`,
		token,
	);
	return baris[0] ?? null;
}

export async function santriById(env: Env, token: string, santriId: string): Promise<Santri | null> {
	const baris = await ambil<Santri[]>(
		env,
		`v_santri?id=eq.${uuid(santriId, "santri_id")}&select=id,nama_lengkap,jenis_kelamin,kamar_nama,lembaga_id,kelas_id,kelas,foto_path&limit=1`,
		token,
	);
	return baris[0] ?? null;
}

export function santriDiKelas(env: Env, token: string, kelasId: string) {
	return ambil<Pick<Santri, "id" | "nama_lengkap" | "kamar_nama">[]>(
		env,
		`v_santri?kelas_id=cs.{${uuid(kelasId, "kelas_id")}}&select=id,nama_lengkap,kamar_nama&order=nama_lengkap`,
		token,
	);
}

export function santriDiLembaga(env: Env, token: string, lembagaId: string) {
	return ambil<Pick<Santri, "id" | "nama_lengkap" | "kamar_nama">[]>(
		env,
		`v_santri?lembaga_id=cs.{${uuid(lembagaId, "lembaga_id")}}&select=id,nama_lengkap,kamar_nama&order=nama_lengkap`,
		token,
	);
}

export function urlBerkas(env: Env, bucket: string, path: string | null): string | null {
	return path
		? `${env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`
		: null;
}
