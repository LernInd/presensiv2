import { useState } from "react";
import { FilterRekap } from "../components/FilterRekap";
import { GagalApi, ambilRekapJamPelajaran, ambilRekapKehadiran } from "../lib/api";
import { unduhRekapPembelajaranXlsx, unduhRekapScanXlsx } from "../lib/eksporRekap";
import { filterAwal, type NilaiFilter } from "../lib/filterRekap";

const AKSI = [
	{ kunci: "pembelajaran", label: "Unduh Rekap Per Pembelajaran" },
	{ kunci: "scan", label: "Unduh Rekap Scan Masuk/Pulang" },
];

// Rekap tidak ditampilkan di layar (tabel santri × tanggal bisa ribuan baris
// dan memboroskan permintaan): admin memilih rentang lalu mengunduh .xlsx.
// Ada dua jenis unduhan, masing-masing SATU permintaan yang hanya berjalan saat
// tombolnya ditekan; di dalam berkas, setiap kelas punya worksheet sendiri.
export function Rekap() {
	const [filter] = useState<NilaiFilter>(filterAwal);
	const [proses, setProses] = useState(false);
	const [galat, setGalat] = useState<string | null>(null);
	const [pesan, setPesan] = useState<string | null>(null);

	async function unduh(n: NilaiFilter, kunci: string) {
		setProses(true);
		setGalat(null);
		setPesan(null);
		try {
			const nama = n.dari === n.sampai ? n.dari : `${n.dari}_sd_${n.sampai}`;
			if (kunci === "pembelajaran") {
				const data = await ambilRekapJamPelajaran(n.dari, n.sampai, n.kelasId);
				const lembar = await unduhRekapPembelajaranXlsx(data, `rekap-pembelajaran-${nama}.xlsx`);
				setPesan(`Berkas diunduh: ${data.sesi.length} jam pelajaran dalam ${lembar} worksheet (per kelas).`);
			} else {
				const data = await ambilRekapKehadiran(n.dari, n.sampai, n.kelasId);
				const lembar = await unduhRekapScanXlsx(data, `rekap-scan-${nama}.xlsx`);
				setPesan(`Berkas diunduh: ${data.baris.length} baris scan masuk/pulang dalam ${lembar} worksheet (per kelas).`);
			}
		} catch (g) {
			setGalat(g instanceof GagalApi ? g.message : "Gagal membuat berkas rekap");
		} finally {
			setProses(false);
		}
	}

	return (
		<div className="container container--sempit">
			<div className="halaman-judul">
				<h1>Rekap Kehadiran</h1>
				<p className="redup">
					Pilih tanggal awal hingga tanggal akhir (maksimal 31 hari), lalu pilih jenis rekap yang diunduh.
				</p>
			</div>

			<section className="kartu">
				<FilterRekap nilai={filter} memuat={proses} onUnduh={(n, k) => void unduh(n, k)} aksi={AKSI} />
				{galat && <p className="galat-kolom">{galat}</p>}
				{pesan && <p className="pesan-sukses">{pesan}</p>}
				<p className="redup">
					<strong>Per Pembelajaran</strong>: status tiap siswa pada setiap jam pelajaran, guru pengampu, guru yang
					mengabsen, dan keterangan saat status diubah ke tidak hadir (hanya jam yang absennya sudah dibuka guru).{" "}
					<strong>Scan Masuk/Pulang</strong>: jam dan keterangan masuk, serta keterangan pulang.
				</p>
				<p className="redup">
					Di kedua berkas, setiap kelas punya worksheet sendiri dan barisnya diurutkan menurut nama santri, lalu
					tanggal. Pilih satu kelas di atas bila hanya butuh satu worksheet.
				</p>
			</section>
		</div>
	);
}
