import { GagalRute } from "./galat";
import { kodePeranGuruDiLembaga } from "./peran";
import { guruDenganPeran } from "./supabase";

/**
 * Nama guru dari daftar guru lembaga di Supabase (RLS token admin). Klien
 * hanya mengirim id; id yang bukan guru lembaga ini ditolak, dan nama tidak
 * pernah dipercaya dari klien.
 */
export async function namaGuru(env: Env, lembagaId: string, guruId: string | null, token: string): Promise<string | null> {
	if (!guruId) return null;
	const kode = await kodePeranGuruDiLembaga(env, lembagaId);
	const daftar = await guruDenganPeran(env, token, kode);
	const guru = daftar.find((g) => g.id === guruId);
	if (!guru) throw new GagalRute(400, "Guru yang dipilih bukan bagian dari lembaga ini");
	return guru.nama_lengkap;
}
