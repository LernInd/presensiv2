import { GagalRute } from "./galat";
import type { Orang } from "./pengguna";
import type { SantriRingkas } from "./presensiHarian";
import { ambil, urlBerkas } from "./supabase";

// Huruf/angka/spasi/titik/apostrof/tanda hubung saja: cukup untuk nama orang
// Indonesia, dan set karakter ini sekaligus AMAN disisipkan ke pola PostgREST
// `ilike.*...*` — tidak ada koma, tanda kurung, atau tanda bintang yang bisa
// mengubah arti filter.
const POLA_PENCARIAN = /^[\p{L}\p{N} .'-]{3,60}$/u;
const MAKS_HASIL = 5;
const MAKS_KANDIDAT = 30;

function skorRelevansi(nama: string, query: string): number {
	const n = nama.toLowerCase();
	const q = query.toLowerCase();
	if (n === q) return 0;
	if (n.startsWith(q)) return 1;
	if (n.split(/\s+/).some((kata) => kata.startsWith(q))) return 2;
	if (n.includes(q)) return 3;
	return 4;
}

type BarisSantri = {
	id: string;
	nama_lengkap: string;
	foto_path: string | null;
	kelas: { lembaga_id: string; kelas_nama: string }[] | null;
};

/**
 * Dibatasi 3 huruf agar tidak menyaring seluruh lembaga dari satu ketikan,
 * dan hasilnya disortir relevansi lalu dipotong 5 — bukan 5 pertama yang
 * kebetulan cocok, tapi 5 yang paling mirip kueri.
 */
export async function cariSantri(env: Env, token: string, orang: Orang, qMentah: string): Promise<SantriRingkas[]> {
	const query = qMentah.trim();
	if (!POLA_PENCARIAN.test(query)) {
		throw new GagalRute(400, "Pencarian minimal 3 huruf, hanya huruf/angka/spasi yang diterima");
	}

	const lembagaIds = orang.lembagaBoleh.map((l) => l.id);
	if (lembagaIds.length === 0) return [];
	const namaLembaga = new Map(orang.lembagaBoleh.map((l) => [l.id, l.nama]));

	const kandidat = await ambil<BarisSantri[]>(
		env,
		`v_santri?lembaga_id=ov.{${lembagaIds.join(",")}}` +
			`&nama_lengkap=ilike.*${encodeURIComponent(query)}*` +
			`&select=id,nama_lengkap,foto_path,kelas&order=nama_lengkap&limit=${MAKS_KANDIDAT}`,
		token,
	);

	return kandidat
		.map((s) => {
			const kelasEntri = s.kelas?.find((k) => lembagaIds.includes(k.lembaga_id)) ?? null;
			const ringkas: SantriRingkas = {
				id: s.id,
				nama_lengkap: s.nama_lengkap,
				kelas_nama: kelasEntri?.kelas_nama ?? null,
				lembaga_nama: kelasEntri ? (namaLembaga.get(kelasEntri.lembaga_id) ?? "") : "",
				foto_url: urlBerkas(env, "foto-santri", s.foto_path),
			};
			return { ringkas, skor: skorRelevansi(s.nama_lengkap, query) };
		})
		.sort((a, b) => a.skor - b.skor || a.ringkas.nama_lengkap.localeCompare(b.ringkas.nama_lengkap))
		.slice(0, MAKS_HASIL)
		.map((x) => x.ringkas);
}
