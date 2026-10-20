import { GagalRute } from "./galat";
import type { Orang } from "./pengguna";
import type { LembagaBoleh, Tingkat } from "./peran";

// Hak khusus dinilai PER LEMBAGA: lembaga yang dipakai adalah lembaga tempat
// pengguna benar-benar bertingkat itu. Memakai `orang.tingkat` (tertinggi dari
// semua peran) + `lembagaBoleh[0]` membuat pengguna berperan ganda (mis. guru
// MTs + admin SMK, tanpa header X-Peran) mendapat hak admin untuk lembaga yang
// hanya ia ajar. Header X-Peran dikendalikan klien, jadi tidak boleh jadi satu-satunya penjaga.
function lembagaBertingkat(orang: Orang, tingkat: Tingkat, pesan: string): { id: string; nama: string } {
	const lembaga: LembagaBoleh | undefined = orang.lembagaBoleh.find((l) => l.tingkat === tingkat);
	if (!lembaga) throw new GagalRute(403, pesan);
	return { id: lembaga.id, nama: lembaga.nama };
}

// Kepala sekolah/madrasah: hanya lembaga tempat ia bertingkat `kepsek`.
export function lembagaKepsek(orang: Orang): { id: string; nama: string } {
	return lembagaBertingkat(orang, "kepsek", "Hanya kepala sekolah yang dapat memantau kehadiran guru");
}

// Halaman khusus tingkat admin (Pembelajaran, Rekap, Kedinasan) — sejalan
// dengan presensi-api lama: mengatur dan merekap adalah wilayah adminpresensi,
// bukan guru. Dipakai bersama supaya aturannya tidak berbeda antar rute.
export function lembagaAdmin(orang: Orang, pesan = "Hanya admin presensi yang dapat mengakses halaman ini"): {
	id: string;
	nama: string;
} {
	return lembagaBertingkat(orang, "admin", pesan);
}
