import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type KonfigurasiPublik = {
	supabaseUrl: string;
	supabasePublishableKey: string;
	loginEmailDomain: string;
	zona: string;
};

// Konfigurasi dibaca dari worker saat runtime (Cloudflare Variables and
// Secrets), bukan ditanam saat build. Cukup diambil sekali per halaman.
let konfigurasi: Promise<KonfigurasiPublik> | null = null;
let klien: Promise<SupabaseClient> | null = null;

export function ambilKonfigurasi(): Promise<KonfigurasiPublik> {
	konfigurasi ??= fetch("/api/config").then(async (r) => {
		if (!r.ok) {
			konfigurasi = null;
			throw new Error("Konfigurasi server belum tersedia");
		}
		return r.json() as Promise<KonfigurasiPublik>;
	});
	return konfigurasi;
}

export function getSupabase(): Promise<SupabaseClient> {
	klien ??= ambilKonfigurasi().then(
		(k) =>
			createClient(k.supabaseUrl, k.supabasePublishableKey, {
				auth: { persistSession: true, autoRefreshToken: true },
			}),
		(galat) => {
			klien = null;
			throw galat;
		},
	);
	return klien;
}

// Login memakai username; akun Supabase dibuat dengan email
// `<username>@<LOGIN_EMAIL_DOMAIN>` (lihat komentar kolom profiles.username).
export async function masuk(username: string, password: string) {
	const [supabase, k] = await Promise.all([getSupabase(), ambilKonfigurasi()]);
	const email = `${username.trim().toLowerCase()}@${k.loginEmailDomain}`;
	const { error } = await supabase.auth.signInWithPassword({ email, password });
	if (error) throw new Error("Username atau kata sandi salah");
}

export async function keluar() {
	const supabase = await getSupabase();
	await supabase.auth.signOut();
}
