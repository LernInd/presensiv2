// Aturan yang sama dengan src/worker/lib/validasi.ts. Di sini hanya untuk
// umpan balik cepat; penegakan sebenarnya tetap di server.
export const POLA_USERNAME = /^[a-z0-9][a-z0-9._-]{2,29}$/;
export const USERNAME_MAKS = 30;
export const SANDI_MIN = 6;
export const SANDI_MAKS = 72;
// eslint-disable-next-line no-control-regex
const KARAKTER_KONTROL = /[\u0000-\u001f\u007f]/;

export type GalatKolom = { username?: string; password?: string };

export function normalkanUsername(nilai: string): string {
	return nilai.trim().toLowerCase();
}

export function periksaUsername(nilai: string): string | undefined {
	const u = normalkanUsername(nilai);
	if (!u) return "Username wajib diisi";
	if (u.length < 3) return "Username minimal 3 karakter";
	if (!POLA_USERNAME.test(u)) return "Hanya huruf kecil, angka, titik, garis bawah, atau tanda hubung";
	return undefined;
}

export function periksaSandi(nilai: string): string | undefined {
	if (!nilai) return "Kata sandi wajib diisi";
	if (nilai.length < SANDI_MIN) return `Kata sandi minimal ${SANDI_MIN} karakter`;
	if (nilai.length > SANDI_MAKS) return `Kata sandi maksimal ${SANDI_MAKS} karakter`;
	if (KARAKTER_KONTROL.test(nilai)) return "Kata sandi mengandung karakter tidak sah";
	return undefined;
}
