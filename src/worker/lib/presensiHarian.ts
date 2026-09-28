import { liburPadaTanggal } from "./hariLibur";
import { ambilPengaturan } from "./pengaturanLembaga";
import { kuncianStatus } from "./pembelajaran";
import { GagalRute } from "./galat";
import type { Orang } from "./pengguna";
import { santriById, urlBerkas, uuid, type Santri } from "./supabase";
import { bandingJam, hariAktifBerlaku, hariLokal, jamLokal, statusMasuk, tanggalLokal } from "./waktu";

export const TIPE = ["masuk", "pulang"] as const;
export type Tipe = (typeof TIPE)[number];

export function tipeSah(nilai: string): nilai is Tipe {
	return (TIPE as readonly string[]).includes(nilai);
}

export type SantriRingkas = {
	id: string;
	nama_lengkap: string;
	kelas_nama: string | null;
	lembaga_nama: string;
	foto_url: string | null;
};

export type Badan = { cara: "qr" | "manual"; santriId: string };

// Isi QR: "SANTRI:<uuid>" — awalan supaya QR asing (bukan kartu santri)
// ditolak nyaring, bukan diam-diam dicoba diproses sebagai id.
const POLA_KODE_QR = /^SANTRI:([0-9a-f-]{36})$/i;

export function periksaBadan(isi: unknown): Badan {
	if (typeof isi !== "object" || isi === null || Array.isArray(isi)) {
		throw new GagalRute(400, "Isian tidak sah");
	}
	const { cara, kode, santri_id: santriIdMentah } = isi as Record<string, unknown>;

	if (cara === "qr") {
		if (typeof kode !== "string") throw new GagalRute(400, "Kode QR tidak sah");
		const cocok = POLA_KODE_QR.exec(kode.trim());
		if (!cocok) throw new GagalRute(400, "Kode QR tidak dikenal");
		return { cara: "qr", santriId: cocok[1].toLowerCase() };
	}
	if (cara === "manual") {
		if (typeof santriIdMentah !== "string") throw new GagalRute(400, "Santri tidak sah");
		return { cara: "manual", santriId: uuid(santriIdMentah, "santri_id") };
	}
	throw new GagalRute(400, "Cara tidak sah");
}

type Konteks = {
	santri: Santri;
	lembagaId: string;
	kelasNama: string | null;
	tanggal: string;
	status: string;
	cara: Badan["cara"];
};

export type HasilScan =
	| { diblokir: true; alasan: string; santri: SantriRingkas }
	| { diblokir: false; sudah: true; status: string; waktu: string; santri: SantriRingkas }
	| { diblokir: false; sudah: false; status: string; santri: SantriRingkas; konteks: Konteks };

/**
 * Satu jalan bagi pratinjau MAUPUN pencatatan (mengikuti pola presensi-api
 * lama): penolakan yang muncul di layar konfirmasi pasti juga berlaku saat
 * disimpan, karena keduanya memanggil fungsi yang sama persis. Status di sini
 * tetap ancar-ancar — waktunya baru ditetapkan saat benar-benar dicatat.
 */
export async function siapkanScan(env: Env, token: string, orang: Orang, tipe: Tipe, badan: Badan): Promise<HasilScan> {
	const santri = await santriById(env, token, badan.santriId);
	if (!santri) throw new GagalRute(404, "Santri tidak ditemukan");

	// "GuruSMK hanya bisa scan siswa SMK, dst." — ditegakkan di sini, bukan
	// hanya di layar pencarian, supaya QR kartu dari lembaga lain juga tertolak.
	const lembagaId = (santri.lembaga_id ?? []).find((id) => orang.bolehLembaga(id));
	if (!lembagaId) {
		throw new GagalRute(403, "Santri ini bukan bagian dari lembaga yang Anda kelola");
	}

	const lembagaNama = orang.lembagaBoleh.find((l) => l.id === lembagaId)?.nama ?? "";
	const kelasList = Array.isArray(santri.kelas)
		? (santri.kelas as { lembaga_id: string; kelas_nama: string }[])
		: [];
	const kelasNama = kelasList.find((k) => k.lembaga_id === lembagaId)?.kelas_nama ?? null;

	const ringkas: SantriRingkas = {
		id: santri.id,
		nama_lengkap: santri.nama_lengkap,
		kelas_nama: kelasNama,
		lembaga_nama: lembagaNama,
		foto_url: urlBerkas(env, "foto-santri", santri.foto_path),
	};

	const pengaturan = await ambilPengaturan(env, lembagaId);
	if (!pengaturan) {
		return { diblokir: true, alasan: "Jam gerbang lembaga ini belum diatur. Hubungi admin presensi.", santri: ringkas };
	}

	const sekarang = new Date();
	const tanggal = tanggalLokal(sekarang, pengaturan.zona);
	const hari = hariLokal(sekarang, pengaturan.zona);
	const jamSekarang = jamLokal(sekarang, pengaturan.zona);

	if (!hariAktifBerlaku(pengaturan.hari_aktif, hari)) {
		return { diblokir: true, alasan: "Hari ini bukan hari aktif untuk lembaga ini", santri: ringkas };
	}
	const libur = await liburPadaTanggal(env, lembagaId, tanggal);
	if (libur) {
		return {
			diblokir: true,
			alasan: `Hari ini libur${libur.keterangan ? `: ${libur.keterangan}` : ""}`,
			santri: ringkas,
		};
	}

	// Dua hal mengalahkan hasil pindai: surat sakit dan izin yang sudah
	// disetujui. Presensi gerbang tidak menuliskan status itu sendiri — itu
	// wilayah modul kesehatan/perizinan, di sini hanya menahan diri.
	const kunci = await kuncianStatus(env, tanggal, santri.id);
	if (kunci === "sakit") {
		return { diblokir: true, alasan: "Santri sedang sakit (surat aktif); tidak perlu dicatat di sini", santri: ringkas };
	}
	if (kunci === "izin") {
		return { diblokir: true, alasan: "Santri sedang izin yang sudah disetujui; tidak perlu dicatat di sini", santri: ringkas };
	}

	// Idempoten: sudah tercatat hari ini → kembalikan apa adanya, jangan ditimpa.
	const sudahAda = await env.DB.prepare(
		"select waktu, status from presensi_harian where tanggal = ? and santri_id = ? and tipe = ?",
	)
		.bind(tanggal, santri.id, tipe)
		.first<{ waktu: string; status: string }>();
	if (sudahAda) {
		return { diblokir: false, sudah: true, status: sudahAda.status, waktu: sudahAda.waktu, santri: ringkas };
	}

	const batasAwal = tipe === "masuk" ? pengaturan.jam_masuk : pengaturan.batas_awal_pulang;
	if (batasAwal && bandingJam(jamSekarang, batasAwal) < 0) {
		const label = tipe === "masuk" ? "Gerbang belum dibuka" : "Belum waktunya pulang";
		return { diblokir: true, alasan: `${label} (mulai ${batasAwal})`, santri: ringkas };
	}

	const status = tipe === "masuk" ? statusMasuk(jamSekarang, pengaturan.batas_terlambat) : "pulang";

	return {
		diblokir: false,
		sudah: false,
		status,
		santri: ringkas,
		konteks: { santri, lembagaId, kelasNama, tanggal, status, cara: badan.cara },
	};
}

/**
 * Menulis hasil `siapkanScan` bila memang ada yang perlu ditulis. Idempoten
 * tiga lapis: klien menahan kode yang sama 3 detik + mengunci saat dialog
 * terbuka, di sini `on conflict do nothing`, dan `primary key (tanggal,
 * santri_id, tipe)` di D1 sebagai lapis terakhir yang tidak bisa dilewati.
 */
export async function catatScan(env: Env, orang: Orang, tipe: Tipe, hasil: HasilScan): Promise<HasilScan> {
	if (hasil.diblokir || hasil.sudah) return hasil;
	const { konteks } = hasil;

	await env.DB.prepare(
		`insert into presensi_harian
		   (tanggal, santri_id, tipe, lembaga_id, waktu, status, santri_nama, kelas_nama, dicatat_oleh, cara)
		 values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		 on conflict (tanggal, santri_id, tipe) do nothing`,
	)
		.bind(
			konteks.tanggal,
			konteks.santri.id,
			tipe,
			konteks.lembagaId,
			new Date().toISOString(),
			konteks.status,
			konteks.santri.nama_lengkap,
			konteks.kelasNama,
			orang.uid,
			konteks.cara,
		)
		.run();

	const baris = await env.DB.prepare(
		"select waktu, status from presensi_harian where tanggal = ? and santri_id = ? and tipe = ?",
	)
		.bind(konteks.tanggal, konteks.santri.id, tipe)
		.first<{ waktu: string; status: string }>();

	return { diblokir: false, sudah: true, status: baris!.status, waktu: baris!.waktu, santri: hasil.santri };
}
