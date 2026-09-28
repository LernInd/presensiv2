import { useEffect, useState } from "react";
import { GagalApi, jadwalHariIni, type JadwalHariIni } from "../lib/api";

// Dipakai di Dashboard (ringkas) maupun halaman Jam Pelajaran (daftar penuh)
// supaya keduanya selalu menampilkan data yang sama tanpa kode berulang.
export function KotakJadwalHariIni({ onBukaAbsen }: { onBukaAbsen: (sesiId: string) => void }) {
	const [data, setData] = useState<JadwalHariIni | null>(null);
	const [galat, setGalat] = useState<string | null>(null);
	const [memuat, setMemuat] = useState(true);

	useEffect(() => {
		let aktif = true;
		jadwalHariIni().then(
			(d) => {
				if (aktif) {
					setData(d);
					setMemuat(false);
				}
			},
			(g) => {
				if (aktif) {
					setGalat(g instanceof GagalApi ? g.message : "Gagal memuat jadwal");
					setMemuat(false);
				}
			},
		);
		return () => {
			aktif = false;
		};
	}, []);

	return (
		<section className="kartu" aria-labelledby="judul-jadwal">
			<h2 id="judul-jadwal">Jam Pelajaran Hari Ini</h2>
			{memuat && <p className="redup">Memuat jadwal…</p>}
			{galat && <p className="galat-kolom">{galat}</p>}
			{!memuat && !galat && data && data.libur.length > 0 && (
				<p className="redup">
					Hari ini libur{data.libur[0].keterangan ? `: ${data.libur[0].keterangan}` : ""}.
				</p>
			)}
			{!memuat && !galat && data && data.libur.length === 0 && data.sesi.length === 0 && (
				<p className="redup">Tidak ada jadwal mengajar untuk hari ini.</p>
			)}
			{!memuat && !galat && data && data.sesi.length > 0 && (
				<ul className="daftar-jadwal">
					{data.sesi.map((s) => (
						<li key={s.id} className="daftar-jadwal__baris">
							<div className="daftar-jadwal__info">
								<span className="daftar-jadwal__jam">
									{s.mulai}–{s.selesai}
								</span>
								<span className="daftar-jadwal__mapel">{s.mapel}</span>
								<span className="redup">
									{s.kelas_nama}
									{s.jam_ke ? ` · Jam ke-${s.jam_ke}` : ""}
								</span>
							</div>
							<button type="button" className="tombol tombol--sekunder tombol--kecil" onClick={() => onBukaAbsen(s.id)}>
								Buka Absen
							</button>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
