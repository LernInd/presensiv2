import { useEffect, useState, type FormEvent } from "react";
import {
	GagalApi,
	ambilGuru,
	ambilJadwalAdmin,
	ambilKelas,
	hapusJadwalAdmin,
	tambahJadwalAdmin,
	ubahJadwalAdmin,
	type BadanJadwalAdmin,
	type BarisJadwalAdmin,
	type GuruRingkas,
	type KelasRingkas,
} from "../lib/api";

const NAMA_HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

export function JadwalPelajaran() {
	const [kelas, setKelas] = useState<KelasRingkas[] | null>(null);
	const [guru, setGuru] = useState<GuruRingkas[]>([]);
	const [kelasId, setKelasId] = useState("");
	const [hari, setHari] = useState(1);
	const [galat, setGalat] = useState<string | null>(null);

	useEffect(() => {
		let aktif = true;
		Promise.all([ambilKelas(), ambilGuru()]).then(
			([k, g]) => {
				if (!aktif) return;
				setKelas(k);
				setGuru(g);
				if (k.length > 0) setKelasId(k[0].id);
			},
			(err) => aktif && setGalat(err instanceof GagalApi ? err.message : "Gagal memuat kelas/guru"),
		);
		return () => {
			aktif = false;
		};
	}, []);

	return (
		<div className="container">
			<div className="halaman-judul">
				<h1>Jadwal Pelajaran</h1>
				<p className="redup">Atur pelajaran, penanggung jawab, dan jam pelajaran per kelas untuk tiap hari.</p>
			</div>

			{galat && <p className="galat-kolom">{galat}</p>}

			{kelas && kelas.length === 0 && (
				<p className="redup">Belum ada kelas terdaftar untuk lembaga ini.</p>
			)}

			{kelas && kelas.length > 0 && (
				<>
					<div className="kolom kolom--pilih-kelas">
						<label htmlFor="pilih-kelas">Kelas</label>
						<select id="pilih-kelas" value={kelasId} onChange={(e) => setKelasId(e.target.value)}>
							{kelas.map((k) => (
								<option key={k.id} value={k.id}>
									{k.nama} ({k.jumlah_anggota} santri)
								</option>
							))}
						</select>
					</div>

					<div className="segmen segmen--hari" role="tablist" aria-label="Pilih hari">
						{NAMA_HARI.map((nama, i) => (
							<button
								key={nama}
								type="button"
								role="tab"
								aria-selected={hari === i + 1}
								className={`segmen__tombol ${hari === i + 1 ? "segmen__tombol--aktif" : ""}`}
								onClick={() => setHari(i + 1)}
							>
								{nama}
							</button>
						))}
					</div>

					{kelasId && <DaftarJadwalHari kelasId={kelasId} hari={hari} guru={guru} />}
				</>
			)}
		</div>
	);
}

type Draf = {
	id: string | null;
	mapel: string;
	mulai: string;
	selesai: string;
	guru_id: string;
};

const DRAF_KOSONG: Draf = { id: null, mapel: "", mulai: "", selesai: "", guru_id: "" };

function DaftarJadwalHari({ kelasId, hari, guru }: { kelasId: string; hari: number; guru: GuruRingkas[] }) {
	const [baris, setBaris] = useState<BarisJadwalAdmin[] | null>(null);
	const [galat, setGalat] = useState<string | null>(null);
	const [draf, setDraf] = useState<Draf | null>(null);
	const [menyimpan, setMenyimpan] = useState(false);

	useEffect(() => {
		let aktif = true;
		setBaris(null);
		setDraf(null);
		setGalat(null);
		ambilJadwalAdmin(kelasId, hari).then(
			(d) => aktif && setBaris(d),
			(g) => aktif && setGalat(g instanceof GagalApi ? g.message : "Gagal memuat jadwal"),
		);
		return () => {
			aktif = false;
		};
	}, [kelasId, hari]);

	// Menambah/mengubah/menghapus satu baris bisa membuat server menomori
	// ulang jam_ke baris LAIN dalam grup yang sama (lih. jadwalPelajaranAdmin.ts
	// di worker). Menambal state lokal hanya untuk baris yang diubah akan
	// meninggalkan jam_ke basi pada baris lain, jadi selalu ambil ulang
	// seluruh daftar hari ini dari server sesudah tiap mutasi.
	async function segarkan() {
		setBaris(await ambilJadwalAdmin(kelasId, hari));
	}

	async function simpanDraf(e: FormEvent) {
		e.preventDefault();
		if (!draf) return;
		const badan: BadanJadwalAdmin = {
			kelas_id: kelasId,
			hari,
			mapel: draf.mapel.trim(),
			mulai: draf.mulai,
			selesai: draf.selesai,
			guru_id: draf.guru_id || null,
		};
		setMenyimpan(true);
		setGalat(null);
		try {
			if (draf.id) {
				await ubahJadwalAdmin(draf.id, badan);
			} else {
				await tambahJadwalAdmin(badan);
			}
			await segarkan();
			setDraf(null);
		} catch (g) {
			setGalat(g instanceof GagalApi ? g.message : "Gagal menyimpan");
		} finally {
			setMenyimpan(false);
		}
	}

	async function hapus(id: string) {
		setMenyimpan(true);
		setGalat(null);
		try {
			await hapusJadwalAdmin(id);
			await segarkan();
		} catch (g) {
			setGalat(g instanceof GagalApi ? g.message : "Gagal menghapus");
		} finally {
			setMenyimpan(false);
		}
	}

	return (
		<section className="kartu" aria-label={`Jadwal ${NAMA_HARI[hari - 1]}`}>
			{galat && <p className="galat-kolom">{galat}</p>}
			{!baris && <p className="redup">Memuat…</p>}

			{baris && (
				<ul className="daftar-jadwal-admin">
					{baris.map((b) => (
						<li key={b.id} className="daftar-jadwal-admin__baris">
							<span className="daftar-jadwal-admin__jamke">Jam ke-{b.jam_ke}</span>
							<div className="daftar-jadwal-admin__info">
								<span className="daftar-jadwal-admin__mapel">{b.mapel}</span>
								<span className="redup">
									{b.mulai}–{b.selesai} · {b.guru_nama ?? "Penanggung jawab belum ditentukan"}
								</span>
							</div>
							<div className="daftar-jadwal-admin__aksi">
								<button
									type="button"
									className="tombol tombol--sekunder tombol--kecil"
									onClick={() =>
										setDraf({ id: b.id, mapel: b.mapel, mulai: b.mulai, selesai: b.selesai, guru_id: b.guru_id ?? "" })
									}
									disabled={menyimpan}
								>
									Ubah
								</button>
								<button
									type="button"
									className="tombol tombol--sekunder tombol--kecil"
									onClick={() => void hapus(b.id)}
									disabled={menyimpan}
								>
									Hapus
								</button>
							</div>
						</li>
					))}
					{baris.length === 0 && !draf && <p className="redup">Belum ada pelajaran di hari ini.</p>}
				</ul>
			)}

			{draf ? (
				<form className="form-jadwal" onSubmit={(e) => void simpanDraf(e)}>
					<div className="kolom">
						<label htmlFor="mapel">Pelajaran</label>
						<input
							id="mapel"
							value={draf.mapel}
							onChange={(e) => setDraf({ ...draf, mapel: e.target.value })}
							maxLength={60}
							required
						/>
					</div>
					<div className="form-jadwal__jam">
						<div className="kolom">
							<label htmlFor="mulai">Mulai</label>
							<input
								id="mulai"
								type="time"
								value={draf.mulai}
								onChange={(e) => setDraf({ ...draf, mulai: e.target.value })}
								required
							/>
						</div>
						<div className="kolom">
							<label htmlFor="selesai">Selesai</label>
							<input
								id="selesai"
								type="time"
								value={draf.selesai}
								onChange={(e) => setDraf({ ...draf, selesai: e.target.value })}
								required
							/>
						</div>
					</div>
					<div className="kolom">
						<label htmlFor="guru">Penanggung jawab</label>
						<select id="guru" value={draf.guru_id} onChange={(e) => setDraf({ ...draf, guru_id: e.target.value })}>
							<option value="">Belum ditentukan</option>
							{guru.map((g) => (
								<option key={g.id} value={g.id}>
									{g.nama_lengkap}
								</option>
							))}
						</select>
					</div>
					<div className="form-jadwal__aksi">
						<button type="button" className="tombol tombol--sekunder" onClick={() => setDraf(null)} disabled={menyimpan}>
							Batal
						</button>
						<button type="submit" className="tombol" disabled={menyimpan}>
							{menyimpan ? "Menyimpan…" : "Simpan"}
						</button>
					</div>
				</form>
			) : (
				<button type="button" className="tombol tombol--sekunder" onClick={() => setDraf(DRAF_KOSONG)}>
					+ Tambah pelajaran
				</button>
			)}
		</section>
	);
}
