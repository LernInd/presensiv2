import { GagalRute } from "./galat";
import type { Orang } from "./pengguna";

// Kepala sekolah/madrasah: hanya tingkat `kepsek`, dan hanya lembaganya sendiri.
export function lembagaKepsek(orang: Orang): { id: string; nama: string } {
	if (orang.tingkat !== "kepsek") {
		throw new GagalRute(403, "Hanya kepala sekolah yang dapat memantau kehadiran guru");
	}
	const lembaga = orang.lembagaBoleh[0];
	if (!lembaga) throw new GagalRute(403, "Anda tidak berwenang atas lembaga mana pun");
	return lembaga;
}

// Halaman khusus tingkat admin (Pembelajaran, Rekap, Kedinasan) — sejalan
// dengan presensi-api lama: mengatur dan merekap adalah wilayah adminpresensi,
// bukan guru. Dipakai bersama supaya aturannya tidak berbeda antar rute.
export function lembagaAdmin(orang: Orang, pesan = "Hanya admin presensi yang dapat mengakses halaman ini"): {
	id: string;
	nama: string;
} {
	if (orang.tingkat !== "admin") {
		throw new GagalRute(403, pesan);
	}
	const lembaga = orang.lembagaBoleh[0];
	if (!lembaga) throw new GagalRute(403, "Anda tidak berwenang atas lembaga mana pun");
	return lembaga;
}
