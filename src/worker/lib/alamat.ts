// Perkiraan alamat dari koordinat (reverse geocoding) lewat Nominatim milik
// OpenStreetMap. Koordinat guru dikirim ke server pihak ketiga itu — hanya dari
// worker (bukan dari peramban) dan hanya saat presensi dicatat/diisi susulan.
// Kebijakan OSM: maks. 1 permintaan/detik, wajib mengidentifikasi aplikasi lewat
// User-Agent. Hasilnya disimpan di D1 (kolom `alamat`) supaya tiap titik hanya
// dicari sekali. Penyedia lain dapat menggantikan berkas ini tanpa mengubah
// bagian lain.
const NOMINATIM = "https://nominatim.openstreetmap.org/reverse";
const USER_AGENT = "presensiv2/1.0 (presensi madrasah Darun Najah)";
const BATAS_WAKTU_MS = 4000;
const JEDA_ANTAR_PERMINTAAN_MS = 1100;

type AlamatNominatim = Record<string, string | undefined>;
type JawabanNominatim = { display_name?: string; address?: AlamatNominatim; error?: string };

const pertama = (a: AlamatNominatim, ...kunci: string[]) => kunci.map((k) => a[k]).find((v) => v && v.trim());

/**
 * Menyusun alamat ringkas dari jawaban Nominatim: jalan, dusun/RT, desa/
 * kelurahan, kecamatan, kabupaten/kota, provinsi. Cadangan: display_name.
 * Fungsi murni (diuji tanpa jaringan).
 */
export function susunAlamat(jawaban: JawabanNominatim): string | null {
	const a = jawaban.address ?? {};
	const bagian = [
		pertama(a, "road", "pedestrian", "footway", "path"),
		pertama(a, "neighbourhood", "hamlet", "quarter"),
		pertama(a, "village", "suburb"),
		pertama(a, "city_district", "municipality"),
		pertama(a, "county", "city", "town"),
		pertama(a, "state"),
	].filter((b): b is string => !!b);

	const unik = bagian.filter((b, i) => bagian.indexOf(b) === i);
	if (unik.length > 0) return unik.join(", ");
	return jawaban.display_name?.trim() || null;
}

export async function perkiraanAlamat(lat: number, lng: number): Promise<string | null> {
	const url = new URL(NOMINATIM);
	url.searchParams.set("format", "jsonv2");
	url.searchParams.set("lat", lat.toFixed(6));
	url.searchParams.set("lon", lng.toFixed(6));
	url.searchParams.set("zoom", "18");
	url.searchParams.set("addressdetails", "1");
	url.searchParams.set("accept-language", "id");

	try {
		const respons = await fetch(url, {
			headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
			signal: AbortSignal.timeout(BATAS_WAKTU_MS),
		});
		if (!respons.ok) return null; // termasuk 429: dicoba lagi pada isi susulan berikutnya
		const isi = await respons.json<JawabanNominatim>();
		if (isi.error) return null;
		return susunAlamat(isi);
	} catch {
		return null;
	}
}

// Penanda di Cache API (per lokasi data pusat Cloudflare, tanpa tabel/migrasi) agar
// pencarian alamat tidak membanjiri OSM: (a) titik yang baru gagal tidak dicoba
// lagi selama 1 jam, (b) isi susulan per lembaga hanya satu eksekusi dalam 30
// detik — membuka halaman monitoring berulang kali tidak menambah permintaan keluar.
const TTL_GAGAL_DETIK = 3600;
const TTL_KUNCI_DETIK = 30;

const penanda = (jenis: string, id: string) => new Request(`https://penanda.presensiv2.invalid/${jenis}/${id}`);

async function adaPenanda(jenis: string, id: string): Promise<boolean> {
	try {
		return (await caches.default.match(penanda(jenis, id))) !== undefined;
	} catch {
		return false; // cache tak tersedia: lanjut tanpa penanda
	}
}

async function pasangPenanda(jenis: string, id: string, detik: number): Promise<void> {
	try {
		await caches.default.put(penanda(jenis, id), new Response("1", { headers: { "Cache-Control": `max-age=${detik}` } }));
	} catch {
		// abaikan: penanda hanya optimasi
	}
}

const idBaris = (k: { tanggal: string; guruId: string; tipe: string }) => `${k.tanggal}/${k.guruId}/${k.tipe}`;

/** Mencari lalu menyimpan alamat satu baris presensi; gagal → dibiarkan kosong (dan ditandai gagal 1 jam). */
export async function simpanAlamat(
	env: Env,
	kunci: { tanggal: string; guruId: string; tipe: string },
	lat: number,
	lng: number,
): Promise<void> {
	const alamat = await perkiraanAlamat(lat, lng);
	if (!alamat) {
		await pasangPenanda("gagal", idBaris(kunci), TTL_GAGAL_DETIK);
		return;
	}
	await env.DB.prepare(
		"update presensi_gerbang_guru set alamat = ? where tanggal = ? and guru_id = ? and tipe = ? and alamat is null",
	)
		.bind(alamat, kunci.tanggal, kunci.guruId, kunci.tipe)
		.run();
}

/**
 * Mengisi alamat baris yang belum punya (mis. presensi sebelum kolom ada, atau
 * pencarian sebelumnya gagal): maksimal `batas` baris per panggilan, berurutan
 * dengan jeda agar tidak melampaui 1 permintaan/detik.
 */
export async function isiAlamatSusulan(env: Env, lembagaId: string, tanggal: string, batas = 5): Promise<void> {
	// Satu eksekusi per lembaga dalam 30 detik: muat ulang berulang tidak menambah permintaan keluar.
	if (await adaPenanda("kunci", lembagaId)) return;
	await pasangPenanda("kunci", lembagaId, TTL_KUNCI_DETIK);

	const { results } = await env.DB.prepare(
		`select guru_id, tipe, lat, lng from presensi_gerbang_guru
		 where lembaga_id = ? and tanggal = ? and alamat is null limit 20`,
	)
		.bind(lembagaId, tanggal)
		.all<{ guru_id: string; tipe: string; lat: number; lng: number }>();

	let dicoba = 0;
	for (const baris of results) {
		if (dicoba >= batas) break;
		const kunci = { tanggal, guruId: baris.guru_id, tipe: baris.tipe };
		if (await adaPenanda("gagal", idBaris(kunci))) continue; // baru gagal: tunggu 1 jam
		if (dicoba > 0) await new Promise((selesai) => setTimeout(selesai, JEDA_ANTAR_PERMINTAAN_MS));
		dicoba++;
		await simpanAlamat(env, kunci, baris.lat, baris.lng);
	}
}
