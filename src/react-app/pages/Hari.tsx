import { useEffect, useState, type FormEvent } from "react";
import {
	GagalApi,
	ambilPengaturanHari,
	hapusHariLibur,
	simpanHariAktif,
	tambahHariLibur,
	type HariLibur,
} from "../lib/api";

const NAMA_HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

type Mode = "libur" | "aktif";

function formatTanggal(t: string): string {
	return new Date(`${t}T12:00:00Z`).toLocaleDateString("id-ID", {
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	});
}

export function Hari() {
	const [hariAktif, setHariAktif] = useState<number[] | null>(null);
	const [libur, setLibur] = useState<HariLibur[]>([]);
	const [memuat, setMemuat] = useState(true);
	const [galat, setGalat] = useState<string | null>(null);
	const [menyimpan, setMenyimpan] = useState(false);
	const [pesan, setPesan] = useState<string | null>(null);
	// Bawaan: tanggal libur (yang paling sering diubah); hari aktif mingguan jarang.
	const [mode, setMode] = useState<Mode>("libur");

	useEffect(() => {
		let aktif = true;
		ambilPengaturanHari().then(
			(d) => {
				if (aktif) {
					setHariAktif(d.hari_aktif);
					setLibur(d.libur);
					setMemuat(false);
				}
			},
			(g) => {
				if (aktif) {
					setGalat(g instanceof GagalApi ? g.message : "Gagal memuat pengaturan");
					setMemuat(false);
				}
			},
		);
		return () => {
			aktif = false;
		};
	}, []);

	function toggleHari(hari: number) {
		setHariAktif((h) => (h ?? []).includes(hari) ? (h ?? []).filter((x) => x !== hari) : [...(h ?? []), hari]);
	}

	async function simpan() {
		if (!hariAktif) return;
		setMenyimpan(true);
		setGalat(null);
		setPesan(null);
		try {
			await simpanHariAktif(hariAktif);
			setPesan("Hari aktif tersimpan.");
		} catch (g) {
			setGalat(g instanceof GagalApi ? g.message : "Gagal menyimpan");
		} finally {
			setMenyimpan(false);
		}
	}

	if (memuat) return <div className="container container--lebar">Memuat…</div>;

	// Susunan sama dengan halaman Siswa Masuk/Pulang: judul + toggle sebaris
	// (toggle penuh lebar di ponsel), lalu satu kartu untuk mode yang dipilih.
	return (
		<div className="container container--lebar">
			<div className="presensi-kepala">
				<div className="halaman-judul">
					<h1>Hari</h1>
					<p className="redup">Atur tanggal libur khusus dan hari aktif dalam seminggu.</p>
				</div>

				<div className="segmen" role="tablist" aria-label="Pengaturan hari">
					<button
						type="button"
						role="tab"
						aria-selected={mode === "libur"}
						className={`segmen__tombol ${mode === "libur" ? "segmen__tombol--aktif" : ""}`}
						onClick={() => setMode("libur")}
					>
						Hari Libur
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={mode === "aktif"}
						className={`segmen__tombol ${mode === "aktif" ? "segmen__tombol--aktif" : ""}`}
						onClick={() => setMode("aktif")}
					>
						Hari Aktif
					</button>
				</div>
			</div>

			{galat && <p className="galat-kolom">{galat}</p>}

			{mode === "libur" ? (
				<LiburLembaga libur={libur} onUbah={setLibur} />
			) : (
				<section className="kartu" aria-labelledby="judul-hari-aktif">
					<h2 id="judul-hari-aktif">Hari aktif</h2>
					<p className="redup">Hari yang dipilih dianggap hari sekolah; sisanya libur mingguan.</p>
					<div className="pilihan-hari" role="group" aria-labelledby="judul-hari-aktif">
						{NAMA_HARI.map((nama, i) => {
							const hari = i + 1;
							const aktif = (hariAktif ?? []).includes(hari);
							return (
								<button
									key={hari}
									type="button"
									className={`pilihan-hari__butir ${aktif ? "pilihan-hari__butir--aktif" : ""}`}
									aria-pressed={aktif}
									onClick={() => toggleHari(hari)}
								>
									{nama}
								</button>
							);
						})}
					</div>
					{pesan && <p className="pesan-sukses">{pesan}</p>}
					<button
						type="button"
						className="tombol tombol--simpan-hari"
						onClick={() => void simpan()}
						disabled={menyimpan || !hariAktif || hariAktif.length === 0}
					>
						{menyimpan ? "Menyimpan…" : "Simpan hari aktif"}
					</button>
				</section>
			)}
		</div>
	);
}

function LiburLembaga({ libur, onUbah }: { libur: HariLibur[]; onUbah: (l: HariLibur[]) => void }) {
	const [tanggal, setTanggal] = useState("");
	const [keterangan, setKeterangan] = useState("");
	const [proses, setProses] = useState(false);
	const [galat, setGalat] = useState<string | null>(null);

	async function tambah(e: FormEvent) {
		e.preventDefault();
		if (!tanggal) return;
		setProses(true);
		setGalat(null);
		try {
			const baru = await tambahHariLibur(tanggal, keterangan);
			onUbah([...libur.filter((l) => l.tanggal !== baru.tanggal), baru].sort((a, b) => a.tanggal.localeCompare(b.tanggal)));
			setTanggal("");
			setKeterangan("");
		} catch (g) {
			setGalat(g instanceof GagalApi ? g.message : "Gagal menambah libur");
		} finally {
			setProses(false);
		}
	}

	async function hapus(t: string) {
		setProses(true);
		setGalat(null);
		try {
			await hapusHariLibur(t);
			onUbah(libur.filter((l) => l.tanggal !== t));
		} catch (g) {
			setGalat(g instanceof GagalApi ? g.message : "Gagal menghapus libur");
		} finally {
			setProses(false);
		}
	}

	return (
		<section className="kartu" aria-labelledby="judul-libur">
			<h2 id="judul-libur">Tanggal libur</h2>
			<p className="redup">Tanggal tertentu (mis. libur nasional) yang mengalahkan hari aktif mingguan.</p>

			<form className="form-libur" onSubmit={(e) => void tambah(e)}>
				<input
					type="date"
					value={tanggal}
					onChange={(e) => setTanggal(e.target.value)}
					required
					aria-label="Tanggal libur"
				/>
				<input
					type="text"
					value={keterangan}
					onChange={(e) => setKeterangan(e.target.value)}
					placeholder="Keterangan (opsional)"
					maxLength={120}
					aria-label="Keterangan libur"
				/>
				<button type="submit" className="tombol tombol--kecil" disabled={proses}>
					Tambah
				</button>
			</form>

			{galat && <p className="galat-kolom">{galat}</p>}

			{libur.length === 0 ? (
				<p className="redup">Belum ada tanggal libur yang ditambahkan.</p>
			) : (
				<ul className="daftar-libur">
					{libur.map((l) => (
						<li key={l.tanggal} className="daftar-libur__baris">
							<div>
								<span className="daftar-libur__tanggal">{formatTanggal(l.tanggal)}</span>
								{l.keterangan && <span className="redup daftar-libur__ket">{l.keterangan}</span>}
							</div>
							<button
								type="button"
								className="tombol tombol--sekunder tombol--kecil"
								onClick={() => void hapus(l.tanggal)}
								disabled={proses}
							>
								Hapus
							</button>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
