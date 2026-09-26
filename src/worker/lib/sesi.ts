import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { CookieOptions } from "hono/utils/cookie";
import type { SesiSupabase } from "./authSupabase";

// Token hanya hidup di cookie HttpOnly (tak terbaca JavaScript) dan tanpa
// Max-Age/Expires, sehingga terhapus saat browser/aplikasi ditutup. Awalan
// __Host- memaksa Secure, Path=/, dan tanpa Domain (tak bisa ditimpa subdomain).
const OPSI: CookieOptions = {
	prefix: "host",
	httpOnly: true,
	secure: true,
	sameSite: "Strict",
	path: "/",
};
const AKSES = "pv2_at";
const SEGAR = "pv2_rt";

export function bacaSesi(c: Context) {
	return {
		akses: getCookie(c, AKSES, "host") ?? null,
		segar: getCookie(c, SEGAR, "host") ?? null,
	};
}

export function pasangSesi(c: Context, sesi: SesiSupabase) {
	setCookie(c, AKSES, sesi.access_token, OPSI);
	setCookie(c, SEGAR, sesi.refresh_token, OPSI);
}

export function hapusSesi(c: Context) {
	deleteCookie(c, AKSES, OPSI);
	deleteCookie(c, SEGAR, OPSI);
}
