import { GagalRute } from "./galat";
import { daftarLibur } from "./hariLibur";
import { PENANDA_SISTEM } from "./pulangOtomatis";
import { ambilPengaturan } from "./pengaturanLembaga";
import { santriDiLembaga, uuid } from "./supabase";
import { hariAktifBerlaku, jamLokal, tanggalLokal } from "./waktu";

const MAKS_HARI = 31;
const MAKS_BARIS = 20000;

export type Rentang = { dari: string; sampai: string };

/** Validasi rentang tanggal rekap: urut, dan tidak lebih dari 31 hari. */
export function periksaRentang(dari: string, sampai: string): Rentang {
	if (dari > sampai) throw new GagalRute(400, "Tanggal awal tidak boleh setelah tanggal akhir");
	const hari = (Date.parse(`${sampai}T00:00:00Z`) - Date.parse(`${dari}T00:00:00Z`)) / 86_400_000 + 1;
	if (hari > MAKS_HARI) throw new GagalRute(400, `Rentang tanggal maksimal ${MAKS_HARI} hari`);
	return { dari, sampai };
}

export function periksaKelasOpsional(nilai: string | undefined): string | null {
	return nilai ? uuid(nilai, "kelas_id") : null;
}

export function semuaTanggal({ dari, sampai }: Rentang): string[] {
	const hasil: string[] = [];
	for (let t = Date.parse(`${dari}T00:00:00Z`); t <= Date.parse(`${sampai}T00:00:00Z`); t += 86_400_000) {
		hasil.push(new Date(t).toISOString().slice(0, 10));
	}
	return hasil;
}

// 1 = Senin … 7 = Minggu, sama dengan kolom jadwal_pelajaran.hari.
export function hariDariTanggal(tanggal: string): number {
	const d = new Date(`${tanggal}T12:00:00Z`).getUTCDay();
	return d === 0 ? 7 : d;
}

type BarisHarian = {
	tanggal: string;
	santri_id: string;
	tipe: "masuk" | "pulang";
	waktu: string;
	status: string;
	dicatat_oleh: string;
};

export type SelRekap = { jam: string | null; keterangan: string };

export type BarisRekapHarian = {
	tanggal: string;
	santri_id: string;
	santri_nama: string;
	kelas_nama: string | null;
	masuk: SelRekap;
	pulang: SelRekap;
};

export type RekapKehadiran = { dari: string; sampai: string; tanggal_dilewati: { tanggal: string; alasan: string }[]; baris: BarisRekapHarian[] };

const KET_STATUS: Record<string, string> = {
	tepat_waktu: "Tepat waktu",
	terlambat: "Terlambat",
	sakit: "Sakit",
	izin: "Izin",
};

function selMasuk(baris: BarisHarian | undefined, zona: string): SelRekap {
	if (!baris) return { jam: null, keterangan: "Tidak scan" };
	const ada = baris.status === "sakit" || baris.status === "izin";
	return {
		jam: ada ? null : jamLokal(new Date(baris.waktu), zona),
		keterangan: KET_STATUS[baris.status] ?? baris.status,
	};
}

// Pulang: scan sungguhan = tepat waktu. Tidak scan (baris buatan job 19:00,
// atau — bila job belum jalan — tanggal yang sudah lewat) = dianggap pulang/
// kembali ke asrama lebih dulu = tidak tepat waktu.
function selPulang(
	pulang: BarisHarian | undefined,
	masuk: BarisHarian | undefined,
	zona: string,
	sudahLewat: boolean,
): SelRekap {
	if (pulang) {
		if (pulang.status === "sakit" || pulang.status === "izin") {
			return { jam: null, keterangan: KET_STATUS[pulang.status] };
		}
		if (pulang.dicatat_oleh === PENANDA_SISTEM) return { jam: null, keterangan: "Tidak tepat waktu (tidak scan pulang)" };
		if (pulang.status === "pulang") return { jam: jamLokal(new Date(pulang.waktu), zona), keterangan: "Tepat waktu" };
		return { jam: jamLokal(new Date(pulang.waktu), zona), keterangan: "Tidak tepat waktu" };
	}
	if (!masuk || masuk.status === "sakit" || masuk.status === "izin") return { jam: null, keterangan: "—" };
	return sudahLewat
		? { jam: null, keterangan: "Tidak tepat waktu (tidak scan pulang)" }
		: { jam: null, keterangan: "Belum pulang" };
}

/**
 * Rekap gerbang semua santri lembaga per tanggal pada rentang. Tanggal libur
 * dan hari nonaktif dilewati (dilaporkan di `tanggal_dilewati`), tanggal
 * setelah hari ini tidak ikut. Baris dibentuk dari roster Supabase (token
 * admin, RLS berlaku) digabung satu kueri `presensi_harian` untuk seluruh
 * rentang.
 */
export async function rekapKehadiran(
	env: Env,
	token: string,
	lembagaId: string,
	rentang: Rentang,
	kelasId: string | null,
): Promise<RekapKehadiran> {
	const pengaturan = await ambilPengaturan(env, lembagaId);
	if (!pengaturan) throw new GagalRute(409, "Pengaturan lembaga (hari aktif dan jam gerbang) belum diatur");
	const zona = pengaturan.zona;
	const hariIni = tanggalLokal(new Date(), zona);

	const libur = new Map((await daftarLibur(env, lembagaId)).map((l) => [l.tanggal, l.keterangan]));
	const dilewati: RekapKehadiran["tanggal_dilewati"] = [];
	const tanggalAktif: string[] = [];
	for (const t of semuaTanggal(rentang)) {
		if (t > hariIni) continue;
		if (libur.has(t)) dilewati.push({ tanggal: t, alasan: `Libur${libur.get(t) ? `: ${libur.get(t)}` : ""}` });
		else if (!hariAktifBerlaku(pengaturan.hari_aktif, hariDariTanggal(t))) dilewati.push({ tanggal: t, alasan: "Bukan hari aktif" });
		else tanggalAktif.push(t);
	}

	const roster = (await santriDiLembaga(env, token, lembagaId)).filter(
		(s) => !kelasId || (s.kelas_id ?? []).includes(kelasId),
	);
	if (roster.length * tanggalAktif.length > MAKS_BARIS) {
		throw new GagalRute(400, "Data terlalu banyak; persempit rentang tanggal atau pilih satu kelas");
	}

	const { results } = await env.DB.prepare(
		`select tanggal, santri_id, tipe, waktu, status, dicatat_oleh from presensi_harian
		 where lembaga_id = ? and tanggal between ? and ?`,
	)
		.bind(lembagaId, rentang.dari, rentang.sampai)
		.all<BarisHarian>();
	const peta = new Map(results.map((r) => [`${r.tanggal}|${r.santri_id}|${r.tipe}`, r]));

	const baris: BarisRekapHarian[] = [];
	for (const t of tanggalAktif) {
		for (const s of roster) {
			const kelasList = Array.isArray(s.kelas) ? (s.kelas as { lembaga_id: string; kelas_nama: string }[]) : [];
			const masuk = peta.get(`${t}|${s.id}|masuk`);
			const pulang = peta.get(`${t}|${s.id}|pulang`);
			baris.push({
				tanggal: t,
				santri_id: s.id,
				santri_nama: s.nama_lengkap,
				kelas_nama: kelasList.find((k) => k.lembaga_id === lembagaId)?.kelas_nama ?? null,
				masuk: selMasuk(masuk, zona),
				pulang: selPulang(pulang, masuk, zona, t < hariIni),
			});
		}
	}

	return { dari: rentang.dari, sampai: rentang.sampai, tanggal_dilewati: dilewati, baris };
}
