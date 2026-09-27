import { useState } from "react";
import {
	GagalApi,
	catatPresensi,
	pratinjauPresensi,
	type BadanScan,
	type HasilScan,
	type SantriRingkas,
	type TipeGerbang,
} from "../lib/api";
import { KonfirmasiScan } from "./KonfirmasiScan";
import { PemindaiQr } from "./PemindaiQr";
import { PencarianSiswa } from "./PencarianSiswa";

type Mode = "qr" | "manual";

// Dipakai MasukSiswa.tsx dan PulangSiswa.tsx — hanya `tipe` dan `judul` yang
// berbeda, seluruh alur pindai/pratinjau/konfirmasi sama persis.
export function PresensiSiswaHalaman({ tipe, judul }: { tipe: TipeGerbang; judul: string }) {
	const [mode, setMode] = useState<Mode>("qr");
	const [badan, setBadan] = useState<BadanScan | null>(null);
	const [hasil, setHasil] = useState<HasilScan | null>(null);
	const [proses, setProses] = useState(false);
	const [galat, setGalat] = useState<string | null>(null);
	const [pesan, setPesan] = useState<string | null>(null);

	const dialogTerbuka = badan !== null;

	async function mulaiPratinjau(b: BadanScan, santriSementara?: SantriRingkas) {
		setPesan(null);
		setBadan(b);
		// Tampilkan identitas secepat yang diketahui (dari hasil pencarian)
		// supaya popup tidak kosong menunggu jaringan; ditimpa hasil sungguhan.
		if (santriSementara) {
			setHasil({ diblokir: false, sudah: false, status: "", santri: santriSementara });
		} else {
			setHasil(null);
		}
		try {
			setHasil(await pratinjauPresensi(tipe, b));
		} catch (g) {
			setBadan(null);
			setHasil(null);
			setGalat(g instanceof GagalApi ? g.message : "Gagal memuat pratinjau");
		}
	}

	async function konfirmasi() {
		if (!badan) return;
		setProses(true);
		try {
			const akhir = await catatPresensi(tipe, badan);
			if (!akhir.diblokir) {
				setPesan(`${akhir.santri.nama_lengkap} berhasil dicatat ${tipe}.`);
			}
			tutup();
		} catch (g) {
			setGalat(g instanceof GagalApi ? g.message : "Gagal menyimpan");
			tutup();
		} finally {
			setProses(false);
		}
	}

	function tutup() {
		setBadan(null);
		setHasil(null);
	}

	return (
		<div className="container">
			<div className="halaman-judul">
				<h1>{judul}</h1>
				<p className="redup">Pindai QR pada kartu santri, atau gunakan absen manual bila kartu tidak tersedia.</p>
			</div>

			<div className="segmen" role="tablist" aria-label="Cara mencatat presensi">
				<button
					type="button"
					role="tab"
					aria-selected={mode === "qr"}
					className={`segmen__tombol ${mode === "qr" ? "segmen__tombol--aktif" : ""}`}
					onClick={() => setMode("qr")}
				>
					Pindai QR
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={mode === "manual"}
					className={`segmen__tombol ${mode === "manual" ? "segmen__tombol--aktif" : ""}`}
					onClick={() => setMode("manual")}
				>
					Absen Manual
				</button>
			</div>

			{pesan && <p className="pesan-sukses">{pesan}</p>}
			{galat && <p className="galat-kolom">{galat}</p>}

			<section className="kartu">
				{mode === "qr" ? (
					<PemindaiQr
						aktif={!dialogTerbuka}
						onKode={(kode) => void mulaiPratinjau({ cara: "qr", kode })}
						onTakDidukung={() => setMode("manual")}
					/>
				) : (
					<PencarianSiswa
						onPilih={(s) => void mulaiPratinjau({ cara: "manual", santri_id: s.id }, s)}
					/>
				)}
			</section>

			<KonfirmasiScan
				terbuka={dialogTerbuka}
				tipe={tipe}
				hasil={hasil}
				proses={proses}
				onKonfirmasi={() => void konfirmasi()}
				onTutup={tutup}
			/>
		</div>
	);
}
