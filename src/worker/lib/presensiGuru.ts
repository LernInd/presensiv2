import { GagalRute } from "./galat";
import { liburPadaTanggal } from "./hariLibur";
import { ambilPengaturan } from "./pengaturanLembaga";
import type { Orang } from "./pengguna";
import { dinasPadaTanggal } from "./tugasDinas";
import { hariAktifBerlaku, hariLokal, tanggalLokal } from "./waktu";

export const TIPE_GURU = ["masuk", "pulang"] as const;
export type TipeGuru = (typeof TIPE_GURU)[number];

export const tipeGuruSah = (nilai: string): nilai is TipeGuru => (TIPE_GURU as readonly string[]).includes(nilai);

// Foto sudah dikecilkan di peramban (~30–60 KB); batas server sengaja longgar
// sedikit di atasnya, bukan untuk menerima foto besar.
export const MAKS_BYTE_FOTO = 150 * 1024;
export const MAKS_BYTE_BADAN = MAKS_BYTE_FOTO + 8 * 1024;

type BarisGerbang = { tipe: TipeGuru; waktu: string };

export type StatusGuruHariIni = {
	tanggal: string;
	dinas: { mulai: string; sampai: string; keterangan: string } | null;
	libur: { keterangan: string | null } | null;
	hari_aktif: boolean;
	masuk: { waktu: string } | null;
	pulang: { waktu: string } | null;
};

function lembagaGuru(orang: Orang): string {
	const lembaga = orang.lembagaBoleh[0];
	if (!lembaga) throw new GagalRute(403, "Anda tidak terdaftar pada lembaga mana pun");
	return lembaga.id;
}

/**
 * Keadaan guru hari ini: sedang dinas atau tidak, libur, dan presensi yang
 * sudah tercatat. Dipanggil layar SEBELUM guru diberi tugas masuk/pulang.
 * Koordinat dan foto sengaja tidak pernah ikut dikembalikan.
 */
export async function statusGuruHariIni(env: Env, orang: Orang): Promise<StatusGuruHariIni> {
	const lembagaId = lembagaGuru(orang);
	const pengaturan = await ambilPengaturan(env, lembagaId);
	const sekarang = new Date();
	const zona = pengaturan?.zona ?? "Asia/Jakarta";
	const tanggal = tanggalLokal(sekarang, zona);

	const [dinas, libur, { results }] = await Promise.all([
		dinasPadaTanggal(env, orang.uid, tanggal),
		liburPadaTanggal(env, lembagaId, tanggal),
		env.DB.prepare("select tipe, waktu from presensi_gerbang_guru where tanggal = ? and guru_id = ?")
			.bind(tanggal, orang.uid)
			.all<BarisGerbang>(),
	]);

	const cari = (t: TipeGuru) => {
		const b = results.find((r) => r.tipe === t);
		return b ? { waktu: b.waktu } : null;
	};

	return {
		tanggal,
		dinas: dinas ? { mulai: dinas.mulai, sampai: dinas.sampai, keterangan: dinas.keterangan } : null,
		libur: libur ? { keterangan: libur.keterangan } : null,
		// Lembaga tanpa baris pengaturan: semua hari dianggap aktif (sama seperti hariAktifBerlaku).
		hari_aktif: hariAktifBerlaku(pengaturan?.hari_aktif ?? "", hariLokal(sekarang, zona)),
		masuk: cari("masuk"),
		pulang: cari("pulang"),
	};
}

export type BadanGuru = { foto: ArrayBuffer; lat: number; lng: number; akurasi: number | null };

function angka(nilai: string | File | null, nama: string, min: number, maks: number): number {
	const n = typeof nilai === "string" && nilai.trim() !== "" ? Number(nilai) : Number.NaN;
	if (!Number.isFinite(n) || n < min || n > maks) throw new GagalRute(400, `${nama} tidak sah`);
	return n;
}

/** Validasi daftar-putih isian foto+lokasi: tipe, ukuran, dan magic bytes JPEG. */
export async function periksaBadanGuru(form: FormData): Promise<BadanGuru> {
	const foto = form.get("foto");
	if (!(foto instanceof File)) throw new GagalRute(400, "Foto wajib diambil");
	if (foto.type !== "image/jpeg") throw new GagalRute(400, "Foto harus berformat JPEG");
	if (foto.size === 0 || foto.size > MAKS_BYTE_FOTO) {
		throw new GagalRute(400, `Ukuran foto maksimal ${Math.round(MAKS_BYTE_FOTO / 1024)} KB`);
	}
	const isi = await foto.arrayBuffer();
	const kepala = new Uint8Array(isi.slice(0, 3));
	if (kepala[0] !== 0xff || kepala[1] !== 0xd8 || kepala[2] !== 0xff) throw new GagalRute(400, "Berkas foto tidak sah");

	const lat = angka(form.get("lat"), "Lokasi", -90, 90);
	const lng = angka(form.get("lng"), "Lokasi", -180, 180);
	const mentahAkurasi = form.get("akurasi");
	const akurasi = mentahAkurasi === null || mentahAkurasi === "" ? null : angka(mentahAkurasi, "Akurasi lokasi", 0, 100_000);
	return { foto: isi, lat, lng, akurasi };
}

/**
 * Mencatat presensi gerbang guru. Urutan penjagaan sengaja ketat dan semuanya
 * di server (bukan hanya layar): dinas → hari aktif/libur → pulang butuh masuk
 * → idempoten. Waktu diambil dari jam SERVER. Tidak ada penolakan berdasarkan
 * lokasi di putaran ini (kelak wewenang kepala sekolah); foto + lokasi yang
 * lengkap berarti hadir pada jam itu.
 */
export async function catatPresensiGuru(
	env: Env,
	orang: Orang,
	tipe: TipeGuru,
	badan: BadanGuru,
): Promise<{ tipe: TipeGuru; waktu: string; sudah: boolean }> {
	const status = await statusGuruHariIni(env, orang);
	if (status.dinas) {
		throw new GagalRute(
			409,
			`Anda tidak diwajibkan absen masuk dan pulang karena sedang tugas dinas: ${status.dinas.keterangan}`,
		);
	}
	if (!status.hari_aktif) throw new GagalRute(409, "Hari ini bukan hari aktif");
	if (status.libur) {
		throw new GagalRute(409, `Hari ini libur${status.libur.keterangan ? `: ${status.libur.keterangan}` : ""}`);
	}

	const sudahAda = tipe === "masuk" ? status.masuk : status.pulang;
	if (sudahAda) return { tipe, waktu: sudahAda.waktu, sudah: true };
	if (tipe === "pulang" && !status.masuk) throw new GagalRute(409, "Presensi masuk hari ini belum tercatat");

	const lembagaId = lembagaGuru(orang);
	const waktu = new Date().toISOString();
	// Kunci objek dibangun dari id pengguna + tanggal server, bukan dari isian klien.
	const kunci = `guru/${status.tanggal}/${orang.uid}-${tipe}.jpg`;

	// Baris ditulis lebih dulu (PK menahan permintaan ganda); foto baru disimpan
	// bila barisnya benar-benar baru, jadi permintaan ganda tidak menimpa foto.
	const hasil = await env.DB.prepare(
		`insert into presensi_gerbang_guru
		   (tanggal, guru_id, tipe, lembaga_id, guru_nama, waktu, lat, lng, akurasi_m, foto_key)
		 values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		 on conflict (tanggal, guru_id, tipe) do nothing`,
	)
		.bind(status.tanggal, orang.uid, tipe, lembagaId, orang.nama, waktu, badan.lat, badan.lng, badan.akurasi, kunci)
		.run();
	if (!hasil.meta.changes) {
		const baris = await env.DB.prepare(
			"select waktu from presensi_gerbang_guru where tanggal = ? and guru_id = ? and tipe = ?",
		)
			.bind(status.tanggal, orang.uid, tipe)
			.first<{ waktu: string }>();
		return { tipe, waktu: baris?.waktu ?? waktu, sudah: true };
	}

	try {
		await env.FOTO.put(kunci, badan.foto, { httpMetadata: { contentType: "image/jpeg" } });
	} catch (galat) {
		// Tanpa foto tidak ada presensi: batalkan barisnya agar guru bisa mengulang.
		await env.DB.prepare("delete from presensi_gerbang_guru where tanggal = ? and guru_id = ? and tipe = ?")
			.bind(status.tanggal, orang.uid, tipe)
			.run();
		throw galat;
	}

	return { tipe, waktu, sudah: false };
}
