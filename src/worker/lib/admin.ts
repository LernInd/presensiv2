import { GagalRute } from "./galat";
import type { Orang } from "./pengguna";

// Halaman khusus tingkat admin (Pembelajaran, Rekap) — sejalan dengan
// presensi-api lama: mengatur dan merekap adalah wilayah adminpresensi, bukan
// guru. Dipakai bersama supaya aturannya tidak berbeda antar rute.
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
