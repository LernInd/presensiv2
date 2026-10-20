import { GagalRute } from "./galat";
import { periksaTanggal } from "./validasiPembelajaran";
import { uuid } from "./supabase";

// Ketidakhadiran guru: tugas dinas, sakit, dan kepentingan
// memakai satu tabel (`tugas_dinas`, kolom `jenis`) dengan logika yang sama.
const MAKS_HARI = 31;
const MAKS_RENTANG_HISTORI_HARI = 366;
const MAKS_BARIS_HISTORI = 500;
const MAKS_KETERANGAN = 200;

export const JENIS = ["dinas", "sakit", "keluarga"] as const;
export type Jenis = (typeof JENIS)[number];

export const jenisSah = (nilai: unknown): nilai is Jenis => typeof nilai === "string" && (JENIS as readonly string[]).includes(nilai);

// Nilai `keluarga` bersifat historis (CHECK di D1 sudah memakainya, mengubahnya butuh
// membangun ulang tabel): artinya "Kepentingan" secara umum — keluarga, urusan
// pribadi, dll. — dan keterangan menjelaskan kepentingannya.
const NAMA_JENIS: Record<Jenis, string> = {
	dinas: "Tugas dinas",
	sakit: "Sakit",
	keluarga: "Kepentingan",
};

/** "Tugas dinas: <keterangan>" / "Sakit: …" / "Kepentingan: …". */
export const labelKetidakhadiran = (jenis: Jenis, keterangan: string) => `${NAMA_JENIS[jenis]}: ${keterangan}`;

export type Ketidakhadiran = {
	id: string;
	lembaga_id: string;
	guru_id: string;
	guru_nama: string;
	jenis: Jenis;
	mulai: string;
	sampai: string;
	keterangan: string;
	dibuat_oleh_nama: string;
};

/** Alasan guru tidak wajib presensi, dipakai pesan layar guru dan penolakan server. */
export function pesanTidakWajib(jenis: Jenis, keterangan: string): string {
	const sebab = jenis === "dinas" ? "sedang tugas dinas" : jenis === "sakit" ? "sedang sakit" : "ada kepentingan";
	return `Anda tidak diwajibkan absen masuk dan pulang karena ${sebab}: ${keterangan}`;
}

export type BadanKetidakhadiran = { jenis: Jenis; guruId: string; mulai: string; sampai: string; keterangan: string };

const hariAntara = (a: string, b: string) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000 + 1;

export function periksaBadanKetidakhadiran(isi: unknown): BadanKetidakhadiran {
	if (typeof isi !== "object" || isi === null || Array.isArray(isi)) throw new GagalRute(400, "Isian tidak sah");
	const { jenis, guru_id: guruMentah, mulai: mulaiMentah, sampai: sampaiMentah, keterangan } = isi as Record<string, unknown>;

	if (!jenisSah(jenis)) throw new GagalRute(400, "Jenis ketidakhadiran tidak sah");
	const guruId = uuid(String(guruMentah ?? ""), "guru_id");
	const mulai = periksaTanggal(mulaiMentah, "mulai");
	const sampai = sampaiMentah == null || sampaiMentah === "" ? mulai : periksaTanggal(sampaiMentah, "sampai");
	if (sampai < mulai) throw new GagalRute(400, "Tanggal akhir tidak boleh sebelum tanggal mulai");
	if (hariAntara(mulai, sampai) > MAKS_HARI) throw new GagalRute(400, `Maksimal ${MAKS_HARI} hari per pengajuan`);

	const ket = typeof keterangan === "string" ? keterangan.trim() : "";
	if (!ket) throw new GagalRute(400, "Keterangan wajib diisi");
	if (ket.length > MAKS_KETERANGAN) throw new GagalRute(400, `Keterangan maksimal ${MAKS_KETERANGAN} karakter`);

	return { jenis, guruId, mulai, sampai, keterangan: ket };
}

const KOLOM = "id, lembaga_id, guru_id, guru_nama, jenis, mulai, sampai, keterangan, dibuat_oleh_nama";

/** Ketidakhadiran yang mencakup `tanggal` untuk guru itu; null bila tidak ada. */
export function ketidakhadiranPadaTanggal(env: Env, guruId: string, tanggal: string): Promise<Ketidakhadiran | null> {
	return env.DB.prepare(`select ${KOLOM} from tugas_dinas where guru_id = ? and mulai <= ? and sampai >= ? limit 1`)
		.bind(guruId, tanggal, tanggal)
		.first<Ketidakhadiran>();
}

export type SaringHistori = { dari: string; sampai: string; jenis: Jenis | null };

export function periksaSaringHistori(dari: unknown, sampai: unknown, jenis: unknown): SaringHistori {
	const d = periksaTanggal(dari, "dari");
	const s = periksaTanggal(sampai, "sampai");
	if (s < d) throw new GagalRute(400, "Tanggal awal tidak boleh setelah tanggal akhir");
	if (hariAntara(d, s) > MAKS_RENTANG_HISTORI_HARI) throw new GagalRute(400, `Rentang maksimal ${MAKS_RENTANG_HISTORI_HARI} hari`);
	if (jenis !== undefined && jenis !== "" && !jenisSah(jenis)) throw new GagalRute(400, "Jenis tidak sah");
	return { dari: d, sampai: s, jenis: jenisSah(jenis) ? jenis : null };
}

/** Histori ketidakhadiran lembaga yang beririsan dengan rentang, terbaru dulu. */
export async function daftarHistori(env: Env, lembagaId: string, saring: SaringHistori): Promise<Ketidakhadiran[]> {
	const { results } = await env.DB.prepare(
		`select ${KOLOM} from tugas_dinas
		 where lembaga_id = ? and mulai <= ? and sampai >= ? ${saring.jenis ? "and jenis = ?" : ""}
		 order by mulai desc, guru_nama limit ${MAKS_BARIS_HISTORI}`,
	)
		.bind(...[lembagaId, saring.sampai, saring.dari, ...(saring.jenis ? [saring.jenis] : [])])
		.all<Ketidakhadiran>();
	return results;
}

export async function tambahKetidakhadiran(
	env: Env,
	lembagaId: string,
	guruNama: string,
	badan: BadanKetidakhadiran,
	oleh: string,
	olehNama: string,
): Promise<Ketidakhadiran> {
	// Satu guru tidak bisa punya dua ketidakhadiran yang beririsan (apa pun jenisnya).
	const bentrok = await env.DB.prepare(
		"select jenis from tugas_dinas where guru_id = ? and mulai <= ? and sampai >= ? limit 1",
	)
		.bind(badan.guruId, badan.sampai, badan.mulai)
		.first<{ jenis: Jenis }>();
	if (bentrok) {
		throw new GagalRute(409, `Guru ini sudah punya data ketidakhadiran (${NAMA_JENIS[bentrok.jenis]}) yang beririsan dengan tanggal tersebut`);
	}

	const id = crypto.randomUUID();
	await env.DB.prepare(
		`insert into tugas_dinas (id, lembaga_id, guru_id, guru_nama, jenis, mulai, sampai, keterangan, dibuat_oleh, dibuat_oleh_nama)
		 values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	)
		.bind(id, lembagaId, badan.guruId, guruNama, badan.jenis, badan.mulai, badan.sampai, badan.keterangan, oleh, olehNama)
		.run();
	return {
		id,
		lembaga_id: lembagaId,
		guru_id: badan.guruId,
		guru_nama: guruNama,
		jenis: badan.jenis,
		mulai: badan.mulai,
		sampai: badan.sampai,
		keterangan: badan.keterangan,
		dibuat_oleh_nama: olehNama,
	};
}

/** Hanya menghapus milik lembaga admin itu; 404 bila bukan miliknya. */
export async function hapusKetidakhadiran(env: Env, lembagaId: string, id: string): Promise<void> {
	const hasil = await env.DB.prepare("delete from tugas_dinas where id = ? and lembaga_id = ?")
		.bind(uuid(id, "id"), lembagaId)
		.run();
	if (!hasil.meta.changes) throw new GagalRute(404, "Data tidak ditemukan");
}
