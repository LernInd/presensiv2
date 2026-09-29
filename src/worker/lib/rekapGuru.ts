import { zona as zonaBawaan } from "./env";
import { GagalRute } from "./galat";
import { daftarLibur } from "./hariLibur";
import { urutNamaDepan } from "./monitoringGuru";
import { ambilPengaturan } from "./pengaturanLembaga";
import { kodePeranGuruDiLembaga } from "./peran";
import { hariDariTanggal, semuaTanggal, type Rentang } from "./rekapKehadiran";
import { guruDenganPeran } from "./supabase";
import { hariAktifBerlaku, jamLokal, tanggalLokal } from "./waktu";

const MAKS_BARIS = 20000;

export type BarisRekapGuru = {
	tanggal: string;
	guru_id: string;
	guru_nama: string;
	jam_masuk: string | null;
	jam_pulang: string | null;
	keterangan: string;
};

export type RekapKehadiranGuru = {
	dari: string;
	sampai: string;
	tanggal_dilewati: { tanggal: string; alasan: string }[];
	baris: BarisRekapGuru[];
};

// Hanya kolom yang dibutuhkan rekap: sengaja TANPA foto, koordinat, alamat, dan
// catatan validasi — admin presensi hanya mendapat jam dan statusnya.
type Catatan = { tanggal: string; guru_id: string; guru_nama: string; tipe: "masuk" | "pulang"; waktu: string; valid: number };

/**
 * Jam dan keterangan satu guru pada satu tanggal. Presensi yang ditandai tidak
 * valid oleh kepala sekolah TIDAK menampilkan jamnya (dikosongkan) — per
 * presensi: masuk invalid mengosongkan jam masuk saja, pulang invalid jam
 * pulang saja. Alasan kepala sekolah tidak ikut. Fungsi murni (diuji).
 */
export function jamDanKeterangan(
	masuk: Pick<Catatan, "waktu" | "valid"> | undefined,
	pulang: Pick<Catatan, "waktu" | "valid"> | undefined,
	dinas: string | null,
	zona: string,
): Pick<BarisRekapGuru, "jam_masuk" | "jam_pulang" | "keterangan"> {
	const masukValid = masuk?.valid === 1;
	const pulangValid = pulang?.valid === 1;
	const masukInvalid = masuk !== undefined && !masukValid;
	const pulangInvalid = pulang !== undefined && !pulangValid;

	let keterangan: string;
	if (masukInvalid && pulangInvalid) keterangan = "Presensi masuk dan pulang tidak valid";
	else if (masukInvalid) keterangan = "Presensi masuk tidak valid";
	else if (pulangInvalid) keterangan = "Presensi pulang tidak valid";
	else if (!masuk && !pulang) keterangan = dinas ? `Tugas dinas: ${dinas}` : "Belum presensi";
	else if (masuk && !pulang) keterangan = "Hadir (belum presensi pulang)";
	else keterangan = "Hadir";

	return {
		jam_masuk: masuk && masukValid ? jamLokal(new Date(masuk.waktu), zona) : null,
		jam_pulang: pulang && pulangValid ? jamLokal(new Date(pulang.waktu), zona) : null,
		keterangan,
	};
}

/**
 * Rekap kehadiran gerbang semua guru satu lembaga per tanggal aktif pada
 * rentang. Tanggal libur, hari nonaktif, dan tanggal setelah hari ini dilewati.
 */
export async function rekapKehadiranGuru(
	env: Env,
	token: string,
	lembagaId: string,
	rentang: Rentang,
): Promise<RekapKehadiranGuru> {
	const pengaturan = await ambilPengaturan(env, lembagaId);
	const zona = pengaturan?.zona ?? zonaBawaan(env);
	const hariIni = tanggalLokal(new Date(), zona);

	const libur = new Map((await daftarLibur(env, lembagaId)).map((l) => [l.tanggal, l.keterangan]));
	const dilewati: RekapKehadiranGuru["tanggal_dilewati"] = [];
	const tanggalAktif: string[] = [];
	for (const t of semuaTanggal(rentang)) {
		if (t > hariIni) continue;
		if (libur.has(t)) dilewati.push({ tanggal: t, alasan: `Libur${libur.get(t) ? `: ${libur.get(t)}` : ""}` });
		else if (!hariAktifBerlaku(pengaturan?.hari_aktif ?? "", hariDariTanggal(t))) dilewati.push({ tanggal: t, alasan: "Bukan hari aktif" });
		else tanggalAktif.push(t);
	}

	const kode = await kodePeranGuruDiLembaga(env, lembagaId);
	const [daftarGuru, catatan, dinas] = await Promise.all([
		guruDenganPeran(env, token, kode),
		env.DB.prepare(
			`select tanggal, guru_id, guru_nama, tipe, waktu, valid from presensi_gerbang_guru
			 where lembaga_id = ? and tanggal between ? and ?`,
		)
			.bind(lembagaId, rentang.dari, rentang.sampai)
			.all<Catatan>(),
		env.DB.prepare(
			`select guru_id, guru_nama, mulai, sampai, keterangan from tugas_dinas
			 where lembaga_id = ? and mulai <= ? and sampai >= ?`,
		)
			.bind(lembagaId, rentang.sampai, rentang.dari)
			.all<{ guru_id: string; guru_nama: string; mulai: string; sampai: string; keterangan: string }>(),
	]);

	// Satu guru bisa memegang beberapa peran → satu baris per orang; guru yang punya
	// catatan/dinas tetapi tak lagi terdaftar tetap ikut.
	const nama = new Map(daftarGuru.map((g) => [g.id, g.nama_lengkap]));
	for (const c of catatan.results) if (!nama.has(c.guru_id)) nama.set(c.guru_id, c.guru_nama);
	for (const d of dinas.results) if (!nama.has(d.guru_id)) nama.set(d.guru_id, d.guru_nama);
	const guru = [...nama.entries()].sort((a, b) => urutNamaDepan(a[1], b[1]));

	if (guru.length * tanggalAktif.length > MAKS_BARIS) {
		throw new GagalRute(400, "Data terlalu banyak; persempit rentang tanggal");
	}

	const peta = new Map(catatan.results.map((c) => [`${c.tanggal}|${c.guru_id}|${c.tipe}`, c]));
	const baris: BarisRekapGuru[] = [];
	for (const t of tanggalAktif) {
		for (const [id, guruNama] of guru) {
			const ketDinas = dinas.results.find((d) => d.guru_id === id && d.mulai <= t && d.sampai >= t)?.keterangan ?? null;
			baris.push({
				tanggal: t,
				guru_id: id,
				guru_nama: guruNama,
				...jamDanKeterangan(peta.get(`${t}|${id}|masuk`), peta.get(`${t}|${id}|pulang`), ketDinas, zona),
			});
		}
	}

	return { dari: rentang.dari, sampai: rentang.sampai, tanggal_dilewati: dilewati, baris };
}
