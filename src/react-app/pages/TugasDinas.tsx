import { useEffect, useState, type FormEvent } from "react";
import {
	GagalApi,
	ambilGuru,
	daftarTugasDinas,
	hapusTugasDinas,
	tambahTugasDinas,
	type GuruRingkas,
	type TugasDinas as Dinas,
} from "../lib/api";

const tanggalPanjang = (t: string) =>
	new Date(`${t}T12:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const rentang = (d: Dinas) =>
	d.mulai === d.sampai ? tanggalPanjang(d.mulai) : `${tanggalPanjang(d.mulai)} – ${tanggalPanjang(d.sampai)}`;

// Kedinasan › Tugas Dinas (admin): guru yang sedang dinas tidak diwajibkan
// absen masuk/pulang pada tanggal-tanggal ini (dicek layar guru dan server).
export function TugasDinas() {
	const [guru, setGuru] = useState<GuruRingkas[]>([]);
	const [daftar, setDaftar] = useState<Dinas[] | null>(null);
	const [guruId, setGuruId] = useState("");
	const [mulai, setMulai] = useState("");
	const [sampai, setSampai] = useState("");
	const [keterangan, setKeterangan] = useState("");
	const [proses, setProses] = useState(false);
	const [galat, setGalat] = useState<string | null>(null);

	useEffect(() => {
		let aktif = true;
		Promise.all([ambilGuru(), daftarTugasDinas()]).then(
			([g, d]) => {
				if (!aktif) return;
				setGuru(g);
				setDaftar(d);
			},
			(e) => aktif && setGalat(e instanceof GagalApi ? e.message : "Gagal memuat data kedinasan"),
		);
		return () => {
			aktif = false;
		};
	}, []);

	async function tambah(e: FormEvent) {
		e.preventDefault();
		if (!guruId || !mulai || !keterangan.trim()) {
			setGalat("Pilih guru, isi tanggal mulai, dan isi keterangan kedinasan");
			return;
		}
		setProses(true);
		setGalat(null);
		try {
			await tambahTugasDinas({ guru_id: guruId, mulai, sampai: sampai || mulai, keterangan: keterangan.trim() });
			setDaftar(await daftarTugasDinas());
			setGuruId("");
			setMulai("");
			setSampai("");
			setKeterangan("");
		} catch (g) {
			setGalat(g instanceof GagalApi ? g.message : "Gagal menyimpan tugas dinas");
		} finally {
			setProses(false);
		}
	}

	async function hapus(id: string) {
		setProses(true);
		setGalat(null);
		try {
			await hapusTugasDinas(id);
			setDaftar((d) => (d ?? []).filter((x) => x.id !== id));
		} catch (g) {
			setGalat(g instanceof GagalApi ? g.message : "Gagal menghapus tugas dinas");
		} finally {
			setProses(false);
		}
	}

	return (
		<div className="container container--lebar">
			<div className="halaman-judul">
				<h1>Tugas Dinas</h1>
				<p className="redup">
					Guru yang sedang tugas dinas tidak diwajibkan absen masuk dan pulang pada tanggal yang ditentukan.
				</p>
			</div>

			{galat && <p className="galat-kolom">{galat}</p>}

			<section className="kartu" aria-labelledby="judul-form-dinas">
				<h2 id="judul-form-dinas">Tambah tugas dinas</h2>
				<form className="form-dinas" onSubmit={(e) => void tambah(e)}>
					<div className="kolom form-dinas__guru">
						<label htmlFor="dinas-guru">Guru</label>
						<select id="dinas-guru" value={guruId} onChange={(e) => setGuruId(e.target.value)} required>
							<option value="">Pilih guru…</option>
							{guru.map((g) => (
								<option key={g.id} value={g.id}>
									{g.nama_lengkap}
								</option>
							))}
						</select>
					</div>
					<div className="kolom">
						<label htmlFor="dinas-mulai">Tanggal mulai</label>
						<input id="dinas-mulai" type="date" value={mulai} onChange={(e) => setMulai(e.target.value)} required />
					</div>
					<div className="kolom">
						<label htmlFor="dinas-sampai">Sampai tanggal (opsional)</label>
						<input id="dinas-sampai" type="date" value={sampai} min={mulai} onChange={(e) => setSampai(e.target.value)} />
					</div>
					<div className="kolom form-dinas__ket">
						<label htmlFor="dinas-ket">Keterangan kedinasan</label>
						<input
							id="dinas-ket"
							value={keterangan}
							onChange={(e) => setKeterangan(e.target.value)}
							placeholder="Mis. Workshop kurikulum di dinas pendidikan"
							maxLength={200}
							required
						/>
					</div>
					<button type="submit" className="tombol form-dinas__aksi" disabled={proses}>
						{proses ? "Menyimpan…" : "Simpan tugas dinas"}
					</button>
				</form>
			</section>

			<section className="kartu" aria-labelledby="judul-daftar-dinas">
				<h2 id="judul-daftar-dinas">Daftar tugas dinas</h2>
				{!daftar && !galat && <p className="redup">Memuat…</p>}
				{daftar && daftar.length === 0 && <p className="redup">Belum ada tugas dinas.</p>}
				{daftar && daftar.length > 0 && (
					<ul className="daftar-libur">
						{daftar.map((d) => (
							<li key={d.id} className="daftar-libur__baris">
								<div>
									<span className="daftar-libur__tanggal">{d.guru_nama}</span>
									<span className="redup daftar-libur__ket">{rentang(d)}</span>
									<span className="daftar-libur__ket">{d.keterangan}</span>
								</div>
								<button
									type="button"
									className="tombol tombol--sekunder tombol--kecil"
									onClick={() => void hapus(d.id)}
									disabled={proses}
								>
									Hapus
								</button>
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	);
}
