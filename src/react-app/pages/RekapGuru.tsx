import { useState } from "react";
import { FilterRekap } from "../components/FilterRekap";
import { GagalApi, ambilRekapKehadiranGuru } from "../lib/api";
import { unduhRekapGuruXlsx } from "../lib/eksporRekap";
import { filterAwal, type NilaiFilter } from "../lib/filterRekap";

// Rekap kehadiran gerbang guru untuk admin presensi: pilih rentang tanggal lalu
// unduh .xlsx (satu permintaan, tanpa tabel di layar). Berisi jam masuk dan jam
// pulang saja — tanpa foto/lokasi; presensi yang ditandai tidak valid oleh
// kepala sekolah dikosongkan jamnya.
export function RekapGuru() {
	const [filter] = useState<NilaiFilter>(filterAwal);
	const [proses, setProses] = useState(false);
	const [galat, setGalat] = useState<string | null>(null);
	const [pesan, setPesan] = useState<string | null>(null);

	async function unduh(n: NilaiFilter) {
		setProses(true);
		setGalat(null);
		setPesan(null);
		try {
			const data = await ambilRekapKehadiranGuru(n.dari, n.sampai);
			const nama = n.dari === n.sampai ? n.dari : `${n.dari}_sd_${n.sampai}`;
			await unduhRekapGuruXlsx(data, `rekap-guru-${nama}.xlsx`);
			setPesan(`Berkas diunduh: ${data.baris.length} baris kehadiran guru.`);
		} catch (g) {
			setGalat(g instanceof GagalApi ? g.message : "Gagal membuat berkas rekap");
		} finally {
			setProses(false);
		}
	}

	return (
		<div className="container container--sempit">
			<div className="halaman-judul">
				<h1>Rekap Kehadiran Guru</h1>
				<p className="redup">
					Pilih tanggal awal hingga tanggal akhir (maksimal 31 hari), lalu unduh berkas Excel berisi jam masuk
					dan jam pulang setiap guru.
				</p>
			</div>

			<section className="kartu">
				<FilterRekap nilai={filter} memuat={proses} onUnduh={(n) => void unduh(n)} tanpaKelas />
				{galat && <p className="galat-kolom">{galat}</p>}
				{pesan && <p className="pesan-sukses">{pesan}</p>}
				<p className="redup">
					Presensi yang ditandai tidak valid oleh kepala sekolah tidak menampilkan jamnya (kolom jam
					dikosongkan, keterangan menyebut mana yang tidak valid). Guru yang sedang tugas dinas ditandai di
					kolom keterangan. Berkas tidak memuat foto maupun lokasi.
				</p>
			</section>
		</div>
	);
}
