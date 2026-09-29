import { useState } from "react";
import { FilterRekap } from "../components/FilterRekap";
import { GagalApi, ambilRekapJamPelajaran, ambilRekapKehadiran } from "../lib/api";
import { unduhRekapXlsx } from "../lib/eksporRekap";
import { filterAwal, type NilaiFilter } from "../lib/filterRekap";

// Rekap tidak ditampilkan di layar (tabel santri × tanggal bisa ribuan baris
// dan memboroskan permintaan): admin memilih rentang lalu mengunduh .xlsx.
// Satu kali unduh = dua permintaan (gerbang + jam pelajaran) yang berjalan
// bersamaan, hanya saat tombol ditekan.
export function Rekap() {
	const [filter] = useState<NilaiFilter>(filterAwal);
	const [proses, setProses] = useState(false);
	const [galat, setGalat] = useState<string | null>(null);
	const [pesan, setPesan] = useState<string | null>(null);

	async function unduh(n: NilaiFilter) {
		setProses(true);
		setGalat(null);
		setPesan(null);
		try {
			const [kehadiran, jam] = await Promise.all([
				ambilRekapKehadiran(n.dari, n.sampai, n.kelasId),
				ambilRekapJamPelajaran(n.dari, n.sampai, n.kelasId),
			]);
			const nama = n.dari === n.sampai ? n.dari : `${n.dari}_sd_${n.sampai}`;
			await unduhRekapXlsx(kehadiran, jam, `rekap-presensi-${nama}.xlsx`);
			setPesan(
				`Berkas diunduh: ${kehadiran.baris.length} baris kehadiran gerbang dan ${jam.sesi.length} jam pelajaran.`,
			);
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
					Pilih tanggal awal hingga tanggal akhir (maksimal 31 hari), lalu unduh berkas Excel berisi rekap
					masuk/pulang gerbang dan rekap setiap jam pelajaran.
				</p>
			</div>

			<section className="kartu">
				<FilterRekap nilai={filter} memuat={proses} onUnduh={(n) => void unduh(n)} />
				{galat && <p className="galat-kolom">{galat}</p>}
				{pesan && <p className="pesan-sukses">{pesan}</p>}
				<p className="redup">
					Lembar &quot;Kehadiran Gerbang&quot;: jam dan keterangan masuk, keterangan pulang. Lembar &quot;Jam
					Pelajaran&quot;: status tiap siswa per jam, guru pengampu, guru yang mengabsen, dan keterangan saat
					status diubah ke tidak hadir (hanya jam yang absennya sudah dibuka guru).
				</p>
			</section>
		</div>
	);
}
