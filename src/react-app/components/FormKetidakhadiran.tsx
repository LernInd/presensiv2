import { useEffect, useState, type FormEvent } from "react";
import {
	GagalApi,
	NAMA_JENIS,
	ambilGuru,
	tambahKetidakhadiran,
	type GuruRingkas,
	type JenisKetidakhadiran,
} from "../lib/api";

// Form bersama Tugas Dinas dan Sakit & Kepentingan: admin memilih
// guru, tanggal, dan keterangan. Guru yang tercatat tidak diwajibkan presensi
// gerbang pada rentang itu (dicek layar guru dan server). Daftar yang sudah
// diinput ada di halaman Histori.
export function FormKetidakhadiran({
	judul,
	penjelasan,
	jenisPilihan,
	placeholderKeterangan,
}: {
	judul: string;
	penjelasan: string;
	/** Satu jenis = tetap; lebih dari satu = admin memilih lewat dropdown. */
	jenisPilihan: JenisKetidakhadiran[];
	placeholderKeterangan: string;
}) {
	const [guru, setGuru] = useState<GuruRingkas[]>([]);
	const [jenis, setJenis] = useState<JenisKetidakhadiran>(jenisPilihan[0]);
	const [guruId, setGuruId] = useState("");
	const [mulai, setMulai] = useState("");
	const [sampai, setSampai] = useState("");
	const [keterangan, setKeterangan] = useState("");
	const [proses, setProses] = useState(false);
	const [galat, setGalat] = useState<string | null>(null);
	const [pesan, setPesan] = useState<string | null>(null);

	useEffect(() => {
		let aktif = true;
		ambilGuru().then(
			(g) => aktif && setGuru(g),
			(e) => aktif && setGalat(e instanceof GagalApi ? e.message : "Gagal memuat daftar guru"),
		);
		return () => {
			aktif = false;
		};
	}, []);

	async function simpan(e: FormEvent) {
		e.preventDefault();
		if (!guruId || !mulai || !keterangan.trim()) {
			setGalat("Pilih guru, isi tanggal mulai, dan isi keterangan");
			return;
		}
		setProses(true);
		setGalat(null);
		setPesan(null);
		try {
			const hasil = await tambahKetidakhadiran({ jenis, guru_id: guruId, mulai, sampai: sampai || mulai, keterangan: keterangan.trim() });
			setPesan(`Tersimpan: ${hasil.guru_nama} — ${NAMA_JENIS[hasil.jenis]}. Lihat di halaman Histori.`);
			setGuruId("");
			setMulai("");
			setSampai("");
			setKeterangan("");
		} catch (g) {
			setGalat(g instanceof GagalApi ? g.message : "Gagal menyimpan");
		} finally {
			setProses(false);
		}
	}

	return (
		<div className="container container--lebar">
			<div className="halaman-judul">
				<h1>{judul}</h1>
				<p className="redup">{penjelasan}</p>
			</div>

			<section className="kartu" aria-labelledby="judul-form-ketidakhadiran">
				<h2 id="judul-form-ketidakhadiran">Tambah data</h2>
				<form className="form-dinas" onSubmit={(e) => void simpan(e)}>
					{jenisPilihan.length > 1 && (
						<div className="kolom form-dinas__guru">
							<label htmlFor="ket-jenis">Jenis</label>
							<select id="ket-jenis" value={jenis} onChange={(e) => setJenis(e.target.value as JenisKetidakhadiran)}>
								{jenisPilihan.map((j) => (
									<option key={j} value={j}>
										{NAMA_JENIS[j]}
									</option>
								))}
							</select>
						</div>
					)}
					<div className="kolom form-dinas__guru">
						<label htmlFor="ket-guru">Guru</label>
						<select id="ket-guru" value={guruId} onChange={(e) => setGuruId(e.target.value)} required>
							<option value="">Pilih guru…</option>
							{guru.map((g) => (
								<option key={g.id} value={g.id}>
									{g.nama_lengkap}
								</option>
							))}
						</select>
					</div>
					<div className="kolom">
						<label htmlFor="ket-mulai">Tanggal mulai</label>
						<input id="ket-mulai" type="date" value={mulai} onChange={(e) => setMulai(e.target.value)} required />
					</div>
					<div className="kolom">
						<label htmlFor="ket-sampai">Sampai tanggal (opsional)</label>
						<input id="ket-sampai" type="date" value={sampai} min={mulai} onChange={(e) => setSampai(e.target.value)} />
					</div>
					<div className="kolom form-dinas__ket">
						<label htmlFor="ket-keterangan">Keterangan</label>
						<input
							id="ket-keterangan"
							value={keterangan}
							onChange={(e) => setKeterangan(e.target.value)}
							placeholder={placeholderKeterangan}
							maxLength={200}
							required
						/>
					</div>
					{galat && <p className="galat-kolom form-dinas__ket">{galat}</p>}
					{pesan && <p className="pesan-sukses form-dinas__ket">{pesan}</p>}
					<button type="submit" className="tombol form-dinas__aksi" disabled={proses}>
						{proses ? "Menyimpan…" : "Simpan"}
					</button>
				</form>
			</section>
		</div>
	);
}
