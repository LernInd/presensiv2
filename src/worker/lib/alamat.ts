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

/** Mencari lalu menyimpan alamat satu baris presensi; gagal → dibiarkan kosong. */
export async function simpanAlamat(
	env: Env,
	kunci: { tanggal: string; guruId: string; tipe: string },
	lat: number,
	lng: number,
): Promise<void> {
	const alamat = await perkiraanAlamat(lat, lng);
	if (!alamat) return;
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
	const { results } = await env.DB.prepare(
		`select guru_id, tipe, lat, lng from presensi_gerbang_guru
		 where lembaga_id = ? and tanggal = ? and alamat is null limit ?`,
	)
		.bind(lembagaId, tanggal, batas)
		.all<{ guru_id: string; tipe: string; lat: number; lng: number }>();

	for (const [i, baris] of results.entries()) {
		if (i > 0) await new Promise((selesai) => setTimeout(selesai, JEDA_ANTAR_PERMINTAAN_MS));
		await simpanAlamat(env, { tanggal, guruId: baris.guru_id, tipe: baris.tipe }, baris.lat, baris.lng);
	}
}
