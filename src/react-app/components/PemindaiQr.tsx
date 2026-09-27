import { useEffect, useRef, useState } from "react";

// Memakai BarcodeDetector bawaan peramban saja (tanpa dependensi jsQR
// tambahan, demi ukuran bundel). Bila tidak tersedia, pengguna diarahkan ke
// Absen Manual — sama seperti fallback di presensi-api lama.
const DIDUKUNG = typeof window !== "undefined" && "BarcodeDetector" in window;
const JEDA_KODE_SAMA_MS = 3000;

export function PemindaiQr({
	aktif,
	onKode,
	onTakDidukung,
}: {
	aktif: boolean;
	onKode: (kode: string) => void;
	onTakDidukung: () => void;
}) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const kodeTerakhir = useRef<{ kode: string; pada: number } | null>(null);
	const [galat, setGalat] = useState<string | null>(null);

	useEffect(() => {
		if (!DIDUKUNG) {
			onTakDidukung();
			return;
		}
		if (!aktif) return; // pindaian baru diblokir selama dialog konfirmasi terbuka

		let berhenti = false;
		let stream: MediaStream | null = null;
		let frame = 0;

		async function mulai() {
			try {
				stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
			} catch {
				setGalat("Tidak bisa mengakses kamera. Periksa izin kamera di peramban Anda.");
				return;
			}
			if (berhenti || !videoRef.current) {
				stream.getTracks().forEach((t) => t.stop());
				return;
			}
			videoRef.current.srcObject = stream;
			await videoRef.current.play().catch(() => {});

			// @ts-expect-error BarcodeDetector belum ada di lib.dom.d.ts baku
			const pendeteksi = new window.BarcodeDetector({ formats: ["qr_code"] });
			const putar = async () => {
				if (berhenti || !videoRef.current) return;
				try {
					const hasil = await pendeteksi.detect(videoRef.current);
					const nilai: string | undefined = hasil[0]?.rawValue;
					if (nilai) {
						const sekarang = Date.now();
						const sama = kodeTerakhir.current?.kode === nilai;
						const masihDalamJeda = sama && sekarang - kodeTerakhir.current!.pada < JEDA_KODE_SAMA_MS;
						if (!masihDalamJeda) {
							kodeTerakhir.current = { kode: nilai, pada: sekarang };
							onKode(nilai);
						}
					}
				} catch {
					// bingkai buruk sesekali bukan galat — coba lagi bingkai berikutnya
				}
				frame = requestAnimationFrame(putar);
			};
			frame = requestAnimationFrame(putar);
		}

		void mulai();
		return () => {
			berhenti = true;
			cancelAnimationFrame(frame);
			stream?.getTracks().forEach((t) => t.stop());
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [aktif]);

	if (!DIDUKUNG) return null;

	return (
		<div className="pemindai">
			<video ref={videoRef} className="pemindai__video" muted playsInline aria-label="Pratayang kamera pemindai QR" />
			{!aktif && <div className="pemindai__jeda">Konfirmasi sebelumnya masih terbuka…</div>}
			{galat && <p className="galat-kolom">{galat}</p>}
			<p className="redup pemindai__petunjuk">Arahkan kamera ke kode QR pada kartu santri.</p>
		</div>
	);
}
