import { GagalRute } from "./galat";
import type { Orang } from "./pengguna";
import { kodePeranGuruDiLembaga } from "./peran";
import { tipeGuruSah, type TipeGuru } from "./presensiGuru";
import { guruDenganPeran, uuid } from "./supabase";
import { periksaTanggal } from "./validasiPembelajaran";

const MAKS_KETERANGAN = 200;

type BarisGerbang = {
	guru_id: string;
	guru_nama: string;
	tipe: TipeGuru;
	waktu: string;
	lat: number;
	lng: number;
	alamat: string | null;
	foto_key: string | null;
	valid: number;
	catatan_validasi: string | null;
	divalidasi_oleh_nama: string | null;
	divalidasi_pada: string | null;
};

// Koordinat mentah sengaja TIDAK ikut dikirim ke layar: yang tampil adalah
// perkiraan alamat (null bila belum berhasil dicari) dan tautan ke peta.
export type PresensiGuruMonitor = {
	waktu: string;
	alamat: string | null;
	tautan_peta: string;
	ada_foto: boolean;
	valid: boolean;
	catatan_validasi: string | null;
	divalidasi_oleh_nama: string | null;
	divalidasi_pada: string | null;
};

export type BarisMonitorGuru = {
	guru_id: string;
	guru_nama: string;
	dinas: string | null;
	masuk: PresensiGuruMonitor | null;
	pulang: PresensiGuruMonitor | null;
};

// Gelar/sapaan yang dilewati saat mencari nama depan (mis. "Drs. Ahmad" → "Ahmad").
const GELAR = new Set(["drs", "dr", "dra", "h", "hj", "kh", "ust", "ustz", "ustadz", "ustadzah", "ir", "prof", "bapak", "ibu", "pak", "bu"]);

/** Nama depan = kata pertama yang bukan gelar/sapaan. Fungsi murni (diuji). */
export function namaDepan(nama: string): string {
	const kata = nama.trim().split(/\s+/).filter(Boolean);
	const depan = kata.find((k) => !GELAR.has(k.toLowerCase().replace(/[.,]/g, "")));
	return depan ?? kata[0] ?? "";
}

/** Urut menurut nama depan (tanpa beda huruf besar/kecil), lalu nama lengkap. */
export function urutNamaDepan(a: string, b: string): number {
	return (
		namaDepan(a).localeCompare(namaDepan(b), "id", { sensitivity: "base" }) ||
		a.localeCompare(b, "id", { sensitivity: "base" })
	);
}

const ringkas = (b: BarisGerbang | undefined): PresensiGuruMonitor | null =>
	b
		? {
				waktu: b.waktu,
				alamat: b.alamat,
				tautan_peta: `https://www.openstreetmap.org/?mlat=${b.lat}&mlon=${b.lng}#map=18/${b.lat}/${b.lng}`,
				ada_foto: b.foto_key !== null,
				valid: b.valid === 1,
				catatan_validasi: b.catatan_validasi,
				divalidasi_oleh_nama: b.divalidasi_oleh_nama,
				divalidasi_pada: b.divalidasi_pada,
			}
		: null;

/**
 * Kehadiran gerbang semua guru satu lembaga pada satu tanggal, untuk kepala
 * sekolah. Daftar guru dari Supabase (token kepala sekolah, RLS berlaku)
 * digabung presensi_gerbang_guru dan tugas_dinas pada tanggal itu.
 */
export async function kehadiranGuru(
	env: Env,
	token: string,
	lembagaId: string,
	tanggal: string,
): Promise<{ tanggal: string; guru: BarisMonitorGuru[] }> {
	const kode = await kodePeranGuruDiLembaga(env, lembagaId);
	const [daftarGuru, gerbang, dinas] = await Promise.all([
		guruDenganPeran(env, token, kode),
		env.DB.prepare(
			`select guru_id, guru_nama, tipe, waktu, lat, lng, alamat, foto_key, valid,
			        catatan_validasi, divalidasi_oleh_nama, divalidasi_pada
			 from presensi_gerbang_guru where lembaga_id = ? and tanggal = ?`,
		)
			.bind(lembagaId, tanggal)
			.all<BarisGerbang>(),
		env.DB.prepare(
			"select guru_id, keterangan from tugas_dinas where lembaga_id = ? and mulai <= ? and sampai >= ?",
		)
			.bind(lembagaId, tanggal, tanggal)
			.all<{ guru_id: string; keterangan: string }>(),
	]);

	// Satu guru bisa memegang beberapa peran → satu baris saja per orang.
	const nama = new Map(daftarGuru.map((g) => [g.id, g.nama_lengkap]));
	for (const g of gerbang.results) if (!nama.has(g.guru_id)) nama.set(g.guru_id, g.guru_nama);
	const ketDinas = new Map(dinas.results.map((d) => [d.guru_id, d.keterangan]));
	for (const d of dinas.results) if (!nama.has(d.guru_id)) nama.set(d.guru_id, "(guru tidak terdaftar)");

	const guru = [...nama.entries()]
		.map(([id, guruNama]): BarisMonitorGuru => {
			const baris = gerbang.results.filter((g) => g.guru_id === id);
			return {
				guru_id: id,
				guru_nama: guruNama,
				dinas: ketDinas.get(id) ?? null,
				masuk: ringkas(baris.find((b) => b.tipe === "masuk")),
				pulang: ringkas(baris.find((b) => b.tipe === "pulang")),
			};
		})
		.sort((a, b) => urutNamaDepan(a.guru_nama, b.guru_nama));

	return { tanggal, guru };
}

/** Objek foto R2 milik baris presensi lembaga ini; 404 bila tidak ada/sudah dihapus. */
export async function ambilFotoGuru(
	env: Env,
	lembagaId: string,
	tanggalMentah: string,
	guruIdMentah: string,
	tipeMentah: string,
): Promise<R2ObjectBody> {
	const tanggal = periksaTanggal(tanggalMentah);
	const guruId = uuid(guruIdMentah, "guru_id");
	if (!tipeGuruSah(tipeMentah)) throw new GagalRute(404, "Jalur tidak dikenal");

	const baris = await env.DB.prepare(
		"select foto_key from presensi_gerbang_guru where tanggal = ? and guru_id = ? and tipe = ? and lembaga_id = ?",
	)
		.bind(tanggal, guruId, tipeMentah, lembagaId)
		.first<{ foto_key: string | null }>();
	if (!baris) throw new GagalRute(404, "Presensi tidak ditemukan");
	if (!baris.foto_key) throw new GagalRute(404, "Foto sudah dihapus (23:00)");

	const objek = await env.FOTO.get(baris.foto_key);
	if (!objek) {
		// foto_key terisi tetapi objeknya tidak ada: bukan penghapusan 23:00 (itu
		// mengosongkan foto_key) — biasanya salah bucket/lingkungan. Catat untuk dilacak.
		console.error("Objek foto tidak ditemukan di R2", baris.foto_key);
		throw new GagalRute(404, "Foto tidak ditemukan di penyimpanan");
	}
	return objek;
}

export type BadanValidasi = { tanggal: string; guruId: string; tipe: TipeGuru; valid: boolean; keterangan: string };

export function periksaBadanValidasi(isi: unknown): BadanValidasi {
	if (typeof isi !== "object" || isi === null || Array.isArray(isi)) throw new GagalRute(400, "Isian tidak sah");
	const { tanggal, guru_id: guruId, tipe, valid, keterangan } = isi as Record<string, unknown>;

	if (typeof tipe !== "string" || !tipeGuruSah(tipe)) throw new GagalRute(400, "Tipe presensi tidak sah");
	if (typeof valid !== "boolean") throw new GagalRute(400, "Status valid harus true atau false");
	// Keterangan wajib untuk kedua arah: menolak maupun memulihkan.
	const ket = typeof keterangan === "string" ? keterangan.trim() : "";
	if (!ket) throw new GagalRute(400, "Keterangan wajib diisi sebelum mengubah status presensi");
	if (ket.length > MAKS_KETERANGAN) throw new GagalRute(400, `Keterangan maksimal ${MAKS_KETERANGAN} karakter`);

	return {
		tanggal: periksaTanggal(tanggal),
		guruId: uuid(String(guruId ?? ""), "guru_id"),
		tipe,
		valid,
		keterangan: ket,
	};
}

/**
 * Menandai presensi guru valid/tidak valid. Baris harus milik lembaga kepala
 * sekolah itu. Tanpa perubahan nyata tidak ada yang ditulis; bila berubah,
 * baris presensi dan jejak audit ditulis dalam satu batch. Guru tidak diberi
 * tahu (layar guru tidak pernah membaca kolom ini).
 */
export async function ubahValidasi(
	env: Env,
	lembagaId: string,
	orang: Orang,
	badan: BadanValidasi,
): Promise<{ valid: boolean; berubah: boolean }> {
	const baris = await env.DB.prepare(
		"select valid from presensi_gerbang_guru where tanggal = ? and guru_id = ? and tipe = ? and lembaga_id = ?",
	)
		.bind(badan.tanggal, badan.guruId, badan.tipe, lembagaId)
		.first<{ valid: number }>();
	if (!baris) throw new GagalRute(404, "Presensi tidak ditemukan");

	const sekarang = badan.valid ? 1 : 0;
	if (baris.valid === sekarang) return { valid: badan.valid, berubah: false };

	const pada = new Date().toISOString();
	await env.DB.batch([
		env.DB.prepare(
			`update presensi_gerbang_guru
			 set valid = ?, catatan_validasi = ?, divalidasi_oleh = ?, divalidasi_oleh_nama = ?, divalidasi_pada = ?
			 where tanggal = ? and guru_id = ? and tipe = ? and lembaga_id = ?`,
		).bind(sekarang, badan.keterangan, orang.uid, orang.nama, pada, badan.tanggal, badan.guruId, badan.tipe, lembagaId),
		env.DB.prepare(
			`insert into riwayat_validasi_guru
			   (tanggal, guru_id, tipe, lembaga_id, dari_valid, ke_valid, keterangan, oleh, oleh_nama, pada)
			 values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		).bind(badan.tanggal, badan.guruId, badan.tipe, lembagaId, baris.valid, sekarang, badan.keterangan, orang.uid, orang.nama, pada),
	]);
	return { valid: badan.valid, berubah: true };
}
