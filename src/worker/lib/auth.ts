import { createRemoteJWKSet, jwtVerify, errors, type JWTPayload } from "jose";
import { GagalAuth } from "./galat";

// Satu JWKS per URL project, disimpan di level modul agar kunci publik
// di-cache antarpermintaan dalam isolate yang sama (jose mengatur cooldown
// dan pengambilan ulang saat `kid` baru muncul setelah rotasi kunci).
const jwksPerProject = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function jwks(supabaseUrl: string) {
	let set = jwksPerProject.get(supabaseUrl);
	if (!set) {
		set = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`), {
			cacheMaxAge: 60 * 60 * 1000,
		});
		jwksPerProject.set(supabaseUrl, set);
	}
	return set;
}

export type IsiToken = JWTPayload & { sub: string; role?: string };

export async function verifikasiToken(env: Env, token: string): Promise<IsiToken> {
	try {
		const { payload } = await jwtVerify(token, jwks(env.SUPABASE_URL), {
			issuer: `${env.SUPABASE_URL}/auth/v1`,
			audience: "authenticated",
			algorithms: ["ES256"],
		});
		if (!payload.sub) throw new GagalAuth(401, "Token tidak memuat identitas");
		return payload as IsiToken;
	} catch (galat) {
		if (galat instanceof GagalAuth) throw galat;
		if (galat instanceof errors.JWTExpired) {
			throw new GagalAuth(401, "Sesi berakhir. Silakan masuk kembali.");
		}
		if (galat instanceof errors.JWKSTimeout || galat instanceof TypeError) {
			throw new GagalAuth(503, "Tidak bisa mengambil kunci publik Supabase");
		}
		throw new GagalAuth(401, "Token tidak sah");
	}
}

export function tokenDariHeader(nilai: string | undefined): string | null {
	if (!nilai?.startsWith("Bearer ")) return null;
	const token = nilai.slice(7).trim();
	return token || null;
}
