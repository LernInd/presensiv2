import { GagalRute } from "./galat";
import type { Orang } from "./pengguna";
import { santriDiKelas, uuid } from "./supabase";

export type SesiRow = {
	id: string;
	lembaga_id: string;
	lembaga_nama: string;
	kelas_id: string;
	kelas_nama: string;
	mapel: string;
	jam_ke: number | null;
	tanggal: string;
	status: "buka" | "tutup";
	terisi: number;
	mulai: string | null;
	selesai: string | null;
	guru_id: string | null;
	guru_nama: string | null;
};

// "sakit" dan "izin" sengaja tidak termasuk di sini: keduanya hanya boleh
// lahir dari modul kesehatan/perizinan (surat sakit / izin_santri yang
// disetujui), dan begitu status hari itu sakit/izin, guru tidak bisa
// mengubahnya sama sekali (lih. kuncianStatus + pengecekan 409 di
// routes/pelajaran.ts). "tidak_hadir" beda dari "alfa": dipilih guru saat
// santri sudah scan masuk di gerbang (jadi bukan alfa) tapi tidak mengikuti
// pelajaran ini.
export const STATUS_SAH = ["hadir", "alfa", "tidak_hadir"] as const;
export type StatusSah = (typeof STATUS_SAH)[number];

function placeholder(n: number): string {
	return Array(n).fill("?").join(",");
}

export async function ambilSesi(env: Env, sesiId: string): Promise<SesiRow> {
	const sesi = await env.DB.prepare("select * from sesi_pembelajaran where id = ?")
		.bind(uuid(sesiId, "sesi_id"))
		.first<SesiRow>();
	if (!sesi) throw new GagalRute(404, "Sesi tidak ditemukan");
	return sesi;
}

/**
 * Fungsi murni: pengampu kosong berarti terbuka bagi siapa saja di lembaga
 * itu (bukan tertutup); pengampu sendiri selalu boleh; adminpresensi lembaga
 * itu boleh sebagai jalan darurat saat guru berhalangan. Penyaring SQL yang
 * membatasi jadwal per guru BUKAN penjaga ini — hanya menghindari kuota
 * `limit` habis terisi jadwal guru lain.
 */
export function bolehMembukaSesi(sesi: SesiRow, orang: Orang): boolean {
	if (!sesi.guru_id) return orang.bolehLembaga(sesi.lembaga_id);
	if (sesi.guru_id === orang.uid) return true;
	return orang.bolehAtur(sesi.lembaga_id);
}

export function jagaSesi(sesi: SesiRow, orang: Orang): void {
	if (!bolehMembukaSesi(sesi, orang)) {
		const pengampu = sesi.guru_nama ? ` Pengampunya adalah ${sesi.guru_nama}.` : "";
		throw new GagalRute(403, `Anda tidak berwenang atas sesi ini.${pengampu}`);
	}
}

async function santriDenganBaris(
	env: Env,
	klausa: string,
	parameter: string[],
	ids: string[],
): Promise<Set<string>> {
	if (ids.length === 0) return new Set();
	const { results } = await env.DB.prepare(`${klausa} and santri_id in (${placeholder(ids.length)})`)
		.bind(...parameter, ...ids)
		.all<{ santri_id: string }>();
	return new Set(results.map((r) => r.santri_id));
}

// Tiga penyaring "duduk di jalur panas" penyemaian daftar kelas — masing-masing
// satu kueri ber-IN, bukan satu kueri per santri.
const santriDenganMasuk = (env: Env, tanggal: string, ids: string[]) =>
	santriDenganBaris(
		env,
		"select santri_id from presensi_harian where tanggal = ? and tipe = 'masuk'",
		[tanggal],
		ids,
	);

const santriBersurat = (env: Env, tanggal: string, ids: string[]) =>
	santriDenganBaris(
		env,
		"select santri_id from surat_sakit where dibatalkan_pada is null and mulai <= ? and ? <= sampai",
		[tanggal, tanggal],
		ids,
	);

const santriBerizin = (env: Env, tanggal: string, ids: string[]) =>
	santriDenganBaris(
		env,
		"select santri_id from izin_santri where status = 'disetujui' and mulai <= ? and ? <= sampai",
		[tanggal, tanggal],
		ids,
	);

/** `null` = tidak terkunci; selain itu alasan mengapa guru tidak boleh mengubahnya. */
export async function kuncianStatus(env: Env, tanggal: string, santriId: string): Promise<"sakit" | "izin" | null> {
	if ((await santriBersurat(env, tanggal, [santriId])).size > 0) return "sakit";
	if ((await santriBerizin(env, tanggal, [santriId])).size > 0) return "izin";
	return null;
}

export type BarisPresensi = {
	santri_id: string;
	santri_nama: string;
	status: string;
	status_awal: string;
	keterangan: string | null;
};

/**
 * Daftar presensi satu sesi, disemai sekali dari roster Supabase + status
 * hari ini bila belum ada barisnya. Sakit mengalahkan izin, keduanya
 * mengalahkan hasil pindai masuk — urutan yang sama dipakai penerap surat
 * dan izin di sisi kesehatan/perizinan.
 */
export async function daftarPresensi(env: Env, token: string, sesi: SesiRow): Promise<BarisPresensi[]> {
	const { results: sudahAda } = await env.DB.prepare(
		"select santri_id, santri_nama, status, status_awal, keterangan from presensi_pembelajaran where sesi_id = ? order by santri_nama",
	)
		.bind(sesi.id)
		.all<BarisPresensi>();
	if (sudahAda.length > 0) return sudahAda;

	const santri = await santriDiKelas(env, token, sesi.kelas_id);
	if (santri.length === 0) return [];

	const ids = santri.map((s) => s.id);
	const [masuk, sakit, izin] = await Promise.all([
		santriDenganMasuk(env, sesi.tanggal, ids),
		santriBersurat(env, sesi.tanggal, ids),
		santriBerizin(env, sesi.tanggal, ids),
	]);

	const baris: BarisPresensi[] = santri.map((s) => {
		const status = sakit.has(s.id) ? "sakit" : izin.has(s.id) ? "izin" : masuk.has(s.id) ? "hadir" : "alfa";
		return { santri_id: s.id, santri_nama: s.nama_lengkap, status, status_awal: status, keterangan: null };
	});

	await env.DB.batch(
		baris.map((b) =>
			env.DB.prepare(
				"insert into presensi_pembelajaran (sesi_id, santri_id, santri_nama, status, status_awal) values (?,?,?,?,?) on conflict do nothing",
			).bind(sesi.id, b.santri_id, b.santri_nama, b.status, b.status_awal),
		),
	);
	await env.DB.prepare("update sesi_pembelajaran set terisi = 1 where id = ?").bind(sesi.id).run();

	return baris;
}

export type UbahStatusBadan = { status: StatusSah; keterangan: string | null };

/**
 * Validasi daftar-putih untuk PATCH presensi. CHECK di D1 sudah menegakkan
 * "status = status_awal atau keterangan tidak kosong"; pemeriksaan di sini
 * hanya membuat pesannya ramah sebelum menyentuh basis data.
 */
export function periksaUbahStatus(isi: unknown, statusAwal: string): UbahStatusBadan {
	if (typeof isi !== "object" || isi === null || Array.isArray(isi)) {
		throw new GagalRute(400, "Isian tidak sah");
	}
	const kunci = Object.keys(isi);
	if (kunci.some((k) => k !== "status" && k !== "keterangan")) {
		throw new GagalRute(400, "Isian tidak sah");
	}
	const { status, keterangan } = isi as Record<string, unknown>;
	// "sakit"/"izin" sengaja tidak termasuk STATUS_SAH — lihat komentar di
	// definisinya.
	if (typeof status !== "string" || !(STATUS_SAH as readonly string[]).includes(status)) {
		throw new GagalRute(400, "Status tidak sah");
	}
	if (status === statusAwal) return { status: status as StatusSah, keterangan: null };

	const ket = typeof keterangan === "string" ? keterangan.trim() : "";
	if (!ket) throw new GagalRute(400, "Keterangan wajib diisi karena status diubah dari semula");
	if (ket.length > 200) throw new GagalRute(400, "Keterangan maksimal 200 karakter");
	return { status: status as StatusSah, keterangan: ket };
}
