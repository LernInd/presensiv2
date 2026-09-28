import { GagalRute } from "./galat";
import { uuid } from "./supabase";

export const NAMA_HARI = ["", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"] as const;
const POLA_JAM = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAKS_MAPEL = 60;
const MAKS_KETERANGAN_LIBUR = 120;

export function periksaHariAktif(isi: unknown): string {
	if (typeof isi !== "object" || isi === null || Array.isArray(isi)) throw new GagalRute(400, "Isian tidak sah");
	const { hari_aktif: hariAktif } = isi as Record<string, unknown>;
	if (!Array.isArray(hariAktif) || hariAktif.some((h) => !Number.isInteger(h) || h < 1 || h > 7)) {
		throw new GagalRute(400, "hari_aktif harus daftar angka 1–7");
	}
	return [...new Set(hariAktif as number[])].sort((a, b) => a - b).join(",");
}

export type BadanLibur = { tanggal: string; keterangan: string | null };
const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

export function periksaTanggal(nilai: unknown, nama = "tanggal"): string {
	if (typeof nilai !== "string" || !POLA_TANGGAL.test(nilai) || Number.isNaN(Date.parse(nilai))) {
		throw new GagalRute(400, `${nama} harus berformat YYYY-MM-DD`);
	}
	return nilai;
}

export function periksaBadanLibur(isi: unknown): BadanLibur {
	if (typeof isi !== "object" || isi === null || Array.isArray(isi)) throw new GagalRute(400, "Isian tidak sah");
	const { tanggal, keterangan } = isi as Record<string, unknown>;
	const t = periksaTanggal(tanggal);
	const k = typeof keterangan === "string" ? keterangan.trim().slice(0, MAKS_KETERANGAN_LIBUR) : null;
	return { tanggal: t, keterangan: k || null };
}

export type BadanJadwal = {
	kelasId: string;
	hari: number;
	mapel: string;
	mulai: string;
	selesai: string;
	guruId: string | null;
};

export function periksaBadanJadwal(isi: unknown): BadanJadwal {
	if (typeof isi !== "object" || isi === null || Array.isArray(isi)) throw new GagalRute(400, "Isian tidak sah");
	const { kelas_id: kelasIdMentah, hari, mapel, mulai, selesai, guru_id: guruIdMentah } = isi as Record<
		string,
		unknown
	>;

	const kelasId = uuid(String(kelasIdMentah ?? ""), "kelas_id");
	if (!Number.isInteger(hari) || (hari as number) < 1 || (hari as number) > 7) {
		throw new GagalRute(400, "Hari harus 1–7 (Senin–Minggu)");
	}
	const namaMapel = typeof mapel === "string" ? mapel.trim() : "";
	if (!namaMapel) throw new GagalRute(400, "Nama pelajaran wajib diisi");
	if (namaMapel.length > MAKS_MAPEL) throw new GagalRute(400, `Nama pelajaran maksimal ${MAKS_MAPEL} karakter`);

	if (typeof mulai !== "string" || !POLA_JAM.test(mulai)) throw new GagalRute(400, "Jam mulai harus berformat HH:MM");
	if (typeof selesai !== "string" || !POLA_JAM.test(selesai)) {
		throw new GagalRute(400, "Jam selesai harus berformat HH:MM");
	}
	if (selesai <= mulai) throw new GagalRute(400, "Jam selesai harus setelah jam mulai");

	const guruId = guruIdMentah == null || guruIdMentah === "" ? null : uuid(String(guruIdMentah), "guru_id");

	return { kelasId, hari: hari as number, mapel: namaMapel, mulai, selesai, guruId };
}
