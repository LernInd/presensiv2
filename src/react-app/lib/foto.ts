// Foto presensi guru dikecilkan di peramban sebelum dikirim: sisi terpanjang
// 640 px, JPEG dengan kualitas diturunkan bertahap sampai ~60 KB. Server
// hanya menerima ≤ 150 KB (lih. MAKS_BYTE_FOTO di worker/lib/presensiGuru.ts).
const SISI_MAKS = 640;
const TARGET_BYTE = 60 * 1024;
const KUALITAS_AWAL = 0.7;
const KUALITAS_MIN = 0.35;

function keBlob(kanvas: HTMLCanvasElement, kualitas: number): Promise<Blob> {
	return new Promise((selesai, gagal) => {
		kanvas.toBlob((b) => (b ? selesai(b) : gagal(new Error("Gagal membuat foto"))), "image/jpeg", kualitas);
	});
}

export async function ambilFotoKecil(video: HTMLVideoElement): Promise<Blob> {
	const lebar = video.videoWidth;
	const tinggi = video.videoHeight;
	if (!lebar || !tinggi) throw new Error("Kamera belum siap, coba lagi sebentar");

	const skala = Math.min(1, SISI_MAKS / Math.max(lebar, tinggi));
	const kanvas = document.createElement("canvas");
	kanvas.width = Math.round(lebar * skala);
	kanvas.height = Math.round(tinggi * skala);
	const gambar = kanvas.getContext("2d");
	if (!gambar) throw new Error("Peramban tidak mendukung pengambilan foto");
	gambar.drawImage(video, 0, 0, kanvas.width, kanvas.height);

	let kualitas = KUALITAS_AWAL;
	let blob = await keBlob(kanvas, kualitas);
	while (blob.size > TARGET_BYTE && kualitas > KUALITAS_MIN) {
		kualitas = Math.max(KUALITAS_MIN, kualitas - 0.1);
		blob = await keBlob(kanvas, kualitas);
	}
	return blob;
}

export type LokasiGuru = { lat: number; lng: number; akurasi: number | null };

const PESAN_LOKASI: Record<number, string> = {
	1: "Izin lokasi ditolak. Aktifkan izin lokasi untuk situs ini di pengaturan peramban, lalu coba lagi.",
	2: "Lokasi tidak dapat ditentukan. Pastikan GPS/lokasi perangkat menyala, lalu coba lagi.",
	3: "Pencarian lokasi terlalu lama. Coba lagi di tempat yang lebih terbuka.",
};

export function ambilLokasi(): Promise<LokasiGuru> {
	return new Promise((selesai, gagal) => {
		if (!("geolocation" in navigator)) {
			gagal(new Error("Perangkat ini tidak mendukung lokasi."));
			return;
		}
		navigator.geolocation.getCurrentPosition(
			(p) =>
				selesai({
					lat: p.coords.latitude,
					lng: p.coords.longitude,
					akurasi: Number.isFinite(p.coords.accuracy) ? p.coords.accuracy : null,
				}),
			(e) => gagal(new Error(PESAN_LOKASI[e.code] ?? "Gagal mengambil lokasi.")),
			{ enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
		);
	});
}
