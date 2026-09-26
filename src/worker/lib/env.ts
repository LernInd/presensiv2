import { GagalTerkendali } from "./galat";

// Semua nilai ini diisi di Cloudflare → Variables and Secrets (produksi) atau
// .dev.vars (lokal), bukan di repo. Periksa di awal supaya salah konfigurasi
// terlihat sebagai pesan jelas, bukan fetch ke "undefined/auth/v1".
const WAJIB = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "LOGIN_EMAIL_DOMAIN"] as const;

export function periksaEnv(env: Env): void {
	const kosong = WAJIB.filter((k) => !env[k]);
	if (kosong.length > 0) {
		console.error("Variabel lingkungan belum diisi:", kosong.join(", "));
		throw new GagalTerkendali(500, "Konfigurasi server belum lengkap");
	}
}

export function zona(env: Env): string {
	return env.ZONA || "Asia/Jakarta";
}
