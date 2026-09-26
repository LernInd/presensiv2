import { GagalRute } from "./galat";

// Validasi daftar-putih: hanya bentuk yang PASTI sah yang diterima, sehingga
// karakter seperti ' " ; -- /* = atau spasi tidak pernah sampai ke Supabase.
// Pola username identik dengan CHECK pada kolom profiles.username.
export const POLA_USERNAME = /^[a-z0-9][a-z0-9._-]{2,29}$/;
export const SANDI_MIN = 6;
export const SANDI_MAKS = 72; // batas bcrypt yang dipakai Supabase Auth
// eslint-disable-next-line no-control-regex
const KARAKTER_KONTROL = /[\u0000-\u001f\u007f]/;

export type Kredensial = { username: string; password: string };
export type GalatKolom = Partial<Record<keyof Kredensial, string>>;

export function periksaKredensial(isi: unknown): Kredensial {
	if (typeof isi !== "object" || isi === null || Array.isArray(isi)) {
		throw new GagalRute(400, "Isian tidak sah");
	}
	const kunci = Object.keys(isi);
	if (kunci.some((k) => k !== "username" && k !== "password")) {
		throw new GagalRute(400, "Isian tidak sah");
	}
	const { username, password } = isi as Record<string, unknown>;
	const galat: GalatKolom = {};

	const u = typeof username === "string" ? username.trim().toLowerCase() : "";
	if (!u) galat.username = "Username wajib diisi";
	else if (!POLA_USERNAME.test(u)) galat.username = "Format username tidak valid";

	const p = typeof password === "string" ? password : "";
	if (!p) galat.password = "Kata sandi wajib diisi";
	else if (p.length < SANDI_MIN || p.length > SANDI_MAKS || KARAKTER_KONTROL.test(p)) {
		galat.password = "Format kata sandi tidak valid";
	}

	if (galat.username || galat.password) throw new GagalValidasi(galat);
	return { username: u, password: p };
}

export class GagalValidasi extends GagalRute {
	constructor(readonly kolom: GalatKolom) {
		super(400, "Periksa kembali isian Anda");
	}
}
