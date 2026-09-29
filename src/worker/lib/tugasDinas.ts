import { GagalRute } from "./galat";
import { periksaTanggal } from "./validasiPembelajaran";
import { uuid } from "./supabase";

const MAKS_HARI_DINAS = 31;
const MAKS_KETERANGAN = 200;

export type TugasDinas = {
	id: string;
	lembaga_id: string;
	guru_id: string;
	guru_nama: string;
	mulai: string;
	sampai: string;
	keterangan: string;
	dibuat_oleh_nama: string;
};

export type BadanDinas = { guruId: string; mulai: string; sampai: string; keterangan: string };

const hariAntara = (a: string, b: string) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000 + 1;

export function periksaBadanDinas(isi: unknown): BadanDinas {
	if (typeof isi !== "object" || isi === null || Array.isArray(isi)) throw new GagalRute(400, "Isian tidak sah");
	const { guru_id: guruMentah, mulai: mulaiMentah, sampai: sampaiMentah, keterangan } = isi as Record<string, unknown>;

	const guruId = uuid(String(guruMentah ?? ""), "guru_id");
	const mulai = periksaTanggal(mulaiMentah, "mulai");
	const sampai = sampaiMentah == null || sampaiMentah === "" ? mulai : periksaTanggal(sampaiMentah, "sampai");
	if (sampai < mulai) throw new GagalRute(400, "Tanggal akhir tidak boleh sebelum tanggal mulai");
	if (hariAntara(mulai, sampai) > MAKS_HARI_DINAS) throw new GagalRute(400, `Tugas dinas maksimal ${MAKS_HARI_DINAS} hari`);

	const ket = typeof keterangan === "string" ? keterangan.trim() : "";
	if (!ket) throw new GagalRute(400, "Keterangan kedinasan wajib diisi");
	if (ket.length > MAKS_KETERANGAN) throw new GagalRute(400, `Keterangan maksimal ${MAKS_KETERANGAN} karakter`);

	return { guruId, mulai, sampai, keterangan: ket };
}

/** Dinas yang mencakup `tanggal` untuk guru itu; null bila tidak sedang dinas. */
export function dinasPadaTanggal(env: Env, guruId: string, tanggal: string): Promise<TugasDinas | null> {
	return env.DB.prepare(
		`select id, lembaga_id, guru_id, guru_nama, mulai, sampai, keterangan, dibuat_oleh_nama
		 from tugas_dinas where guru_id = ? and mulai <= ? and sampai >= ? limit 1`,
	)
		.bind(guruId, tanggal, tanggal)
		.first<TugasDinas>();
}

/** Daftar dinas lembaga yang belum lewat lebih dari 30 hari, terbaru dulu. */
export async function daftarDinas(env: Env, lembagaId: string, hariIni: string): Promise<TugasDinas[]> {
	const batas = new Date(Date.parse(`${hariIni}T00:00:00Z`) - 30 * 86_400_000).toISOString().slice(0, 10);
	const { results } = await env.DB.prepare(
		`select id, lembaga_id, guru_id, guru_nama, mulai, sampai, keterangan, dibuat_oleh_nama
		 from tugas_dinas where lembaga_id = ? and sampai >= ? order by mulai desc, guru_nama`,
	)
		.bind(lembagaId, batas)
		.all<TugasDinas>();
	return results;
}

export async function tambahDinas(
	env: Env,
	lembagaId: string,
	guruNama: string,
	badan: BadanDinas,
	oleh: string,
	olehNama: string,
): Promise<TugasDinas> {
	const bentrok = await env.DB.prepare(
		"select id from tugas_dinas where guru_id = ? and mulai <= ? and sampai >= ? limit 1",
	)
		.bind(badan.guruId, badan.sampai, badan.mulai)
		.first();
	if (bentrok) throw new GagalRute(409, "Guru ini sudah punya tugas dinas yang beririsan dengan tanggal tersebut");

	const id = crypto.randomUUID();
	await env.DB.prepare(
		`insert into tugas_dinas (id, lembaga_id, guru_id, guru_nama, mulai, sampai, keterangan, dibuat_oleh, dibuat_oleh_nama)
		 values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	)
		.bind(id, lembagaId, badan.guruId, guruNama, badan.mulai, badan.sampai, badan.keterangan, oleh, olehNama)
		.run();
	return {
		id,
		lembaga_id: lembagaId,
		guru_id: badan.guruId,
		guru_nama: guruNama,
		mulai: badan.mulai,
		sampai: badan.sampai,
		keterangan: badan.keterangan,
		dibuat_oleh_nama: olehNama,
	};
}

/** Hanya menghapus dinas milik lembaga admin itu; 404 bila bukan miliknya. */
export async function hapusDinas(env: Env, lembagaId: string, id: string): Promise<void> {
	const hasil = await env.DB.prepare("delete from tugas_dinas where id = ? and lembaga_id = ?")
		.bind(uuid(id, "id"), lembagaId)
		.run();
	if (!hasil.meta.changes) throw new GagalRute(404, "Tugas dinas tidak ditemukan");
}
