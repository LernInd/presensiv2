import { useCallback, useEffect, useRef, useState } from "react";
import {
	GagalApi,
	kirimPresensiGuru,
	presensiGuruHariIni,
	type StatusGuruHariIni,
	type TipeGuru,
} from "../lib/api";
import { ambilFotoKecil, ambilLokasi, type LokasiGuru } from "../lib/foto";

const jamWib = (iso: string) =>
	new Date(iso).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });

const tanggalPanjang = (t: string) =>
	new Date(`${t}T12:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

// Dipakai MasukGuru.tsx dan PulangGuru.tsx. Urutannya sengaja: PERIKSA dulu
// (dinas, hari aktif/libur, sudah tercatat) sebelum kamera dan lokasi
// dinyalakan — guru yang sedang dinas tidak pernah diminta izin kamera/GPS.
export function PresensiGuruHalaman({ tipe, judul }: { tipe: TipeGuru; judul: string }) {
	const [status, setStatus] = useState<StatusGuruHariIni | null>(null);
	const [galatMuat, setGalatMuat] = useState<string | null>(null);
	const [foto, setFoto] = useState<{ blob: Blob; url: string } | null>(null);
	const [lokasi, setLokasi] = useState<LokasiGuru | null>(null);
	const [galatLokasi, setGalatLokasi] = useState<string | null>(null);
	const [galatKamera, setGalatKamera] = useState<string | null>(null);
	const [galat, setGalat] = useState<string | null>(null);
	const [proses, setProses] = useState(false);
	const [berhasil, setBerhasil] = useState<string | null>(null);
	const videoRef = useRef<HTMLVideoElement>(null);

	useEffect(() => {
		let aktif = true;
		presensiGuruHariIni().then(
			(s) => aktif && setStatus(s),
			(g) => aktif && setGalatMuat(g instanceof GagalApi ? g.message : "Gagal memuat status hari ini"),
		);
		return () => {
			aktif = false;
		};
	}, []);

	const sudahAda = status ? (tipe === "masuk" ? status.masuk : status.pulang) : null;
	const perluMasuk = tipe === "pulang" && status !== null && !status.masuk;
	const boleh =
		status !== null && !status.dinas && !status.libur && status.hari_aktif && !sudahAda && !perluMasuk && !berhasil;
	const kameraNyala = boleh && foto === null;

	// Kamera depan menyala hanya selama menunggu foto; dimatikan begitu foto
	// diambil, halaman ditutup, atau status melarang.
	useEffect(() => {
		if (!kameraNyala) return;
		let berhenti = false;
		let stream: MediaStream | null = null;
		navigator.mediaDevices
			?.getUserMedia({ video: { facingMode: "user" }, audio: false })
			.then(async (s) => {
				if (berhenti || !videoRef.current) {
					s.getTracks().forEach((t) => t.stop());
					return;
				}
				stream = s;
				setGalatKamera(null);
				videoRef.current.srcObject = s;
				await videoRef.current.play().catch(() => {});
			})
			.catch(() => {
				if (!berhenti) setGalatKamera("Tidak bisa mengakses kamera. Periksa izin kamera di peramban Anda.");
			});
		if (!navigator.mediaDevices) setTimeout(() => setGalatKamera("Perangkat ini tidak mendukung kamera."), 0);
		return () => {
			berhenti = true;
			stream?.getTracks().forEach((t) => t.stop());
		};
	}, [kameraNyala]);

	const cariLokasi = useCallback(() => {
		setGalatLokasi(null);
		setLokasi(null);
		ambilLokasi().then(setLokasi, (e: Error) => setGalatLokasi(e.message));
	}, []);

	async function ambilFoto() {
		if (!videoRef.current) return;
		setGalat(null);
		try {
			const blob = await ambilFotoKecil(videoRef.current);
			setFoto({ blob, url: URL.createObjectURL(blob) });
			cariLokasi();
		} catch (e) {
			setGalat(e instanceof Error ? e.message : "Gagal mengambil foto");
		}
	}

	function ulangi() {
		if (foto) URL.revokeObjectURL(foto.url);
		setFoto(null);
		setLokasi(null);
		setGalatLokasi(null);
		setGalat(null);
	}

	async function kirim() {
		if (!foto || !lokasi) return;
		setProses(true);
		setGalat(null);
		try {
			const hasil = await kirimPresensiGuru(tipe, foto.blob, lokasi);
			URL.revokeObjectURL(foto.url);
			setFoto(null);
			setBerhasil(`Presensi ${tipe} tercatat pukul ${jamWib(hasil.waktu)} WIB.`);
		} catch (g) {
			setGalat(g instanceof GagalApi ? g.message : "Gagal mengirim presensi");
		} finally {
			setProses(false);
		}
	}

	return (
		<div className="container container--lebar">
			<div className="halaman-judul">
				<h1>{judul}</h1>
				<p className="redup">Ambil foto diri di tempat Anda bertugas. Lokasi dicatat bersama foto.</p>
			</div>

			<section className="kartu">
				{galatMuat && <p className="galat-kolom">{galatMuat}</p>}
				{!status && !galatMuat && <p className="redup">Memeriksa status hari ini…</p>}

				{status?.dinas && (
					<div className="info-dinas" role="status">
						<h2>Tidak perlu absen hari ini</h2>
						<p>
							Anda tidak diwajibkan absen masuk dan pulang karena sedang tugas dinas:{" "}
							<strong>{status.dinas.keterangan}</strong>
						</p>
						<p className="redup">
							{status.dinas.mulai === status.dinas.sampai
								? tanggalPanjang(status.dinas.mulai)
								: `${tanggalPanjang(status.dinas.mulai)} – ${tanggalPanjang(status.dinas.sampai)}`}
						</p>
					</div>
				)}

				{status && !status.dinas && !status.hari_aktif && <p className="redup">Hari ini bukan hari aktif.</p>}
				{status && !status.dinas && status.hari_aktif && status.libur && (
					<p className="redup">Hari ini libur{status.libur.keterangan ? `: ${status.libur.keterangan}` : ""}.</p>
				)}
				{status && !status.dinas && !status.libur && status.hari_aktif && sudahAda && !berhasil && (
					<p className="pesan-sukses">Presensi {tipe} sudah tercatat pukul {jamWib(sudahAda.waktu)} WIB.</p>
				)}
				{status && !status.dinas && !status.libur && status.hari_aktif && !sudahAda && perluMasuk && (
					<p className="redup">Presensi masuk hari ini belum tercatat. Lakukan presensi masuk terlebih dahulu.</p>
				)}

				{berhasil && <p className="pesan-sukses">{berhasil}</p>}

				{boleh && !foto && (
					<div className="pemindai">
						<video
							ref={videoRef}
							className="pemindai__video kamera-guru"
							muted
							playsInline
							aria-label="Pratayang kamera depan"
						/>
						{galatKamera && <p className="galat-kolom">{galatKamera}</p>}
						<button type="button" className="tombol" onClick={() => void ambilFoto()} disabled={!!galatKamera}>
							Ambil foto
						</button>
					</div>
				)}

				{boleh && foto && (
					<div className="pemindai">
						<img className="pemindai__video" src={foto.url} alt="Foto yang akan dikirim" />
						{!lokasi && !galatLokasi && <p className="redup">Mencari lokasi…</p>}
						{lokasi && <p className="redup">Lokasi didapat{lokasi.akurasi ? ` (± ${Math.round(lokasi.akurasi)} m)` : ""}.</p>}
						{galatLokasi && (
							<>
								<p className="galat-kolom">{galatLokasi}</p>
								<button type="button" className="tombol tombol--sekunder" onClick={cariLokasi}>
									Coba lagi ambil lokasi
								</button>
							</>
						)}
						{galat && <p className="galat-kolom">{galat}</p>}
						<div className="aksi-foto">
							<button type="button" className="tombol tombol--sekunder" onClick={ulangi} disabled={proses}>
								Ulangi foto
							</button>
							<button type="button" className="tombol" onClick={() => void kirim()} disabled={proses || !lokasi}>
								{proses ? "Mengirim…" : `Kirim presensi ${tipe}`}
							</button>
						</div>
					</div>
				)}
				{boleh && !foto && galat && <p className="galat-kolom">{galat}</p>}
			</section>
		</div>
	);
}
