import { useEffect, useState } from "react";
import {
	GagalApi,
	NAMA_JENIS,
	hapusKetidakhadiran,
	historiKetidakhadiran,
	tanggalWib,
	type JenisKetidakhadiran,
	type Ketidakhadiran,
} from "../lib/api";

const geser = (tanggal: string, hari: number) =>
	new Date(Date.parse(`${tanggal}T00:00:00Z`) + hari * 86_400_000).toISOString().slice(0, 10);

const tanggalPendek = (t: string) =>
	new Date(`${t}T12:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const rentang = (d: Ketidakhadiran) =>
	d.mulai === d.sampai ? tanggalPendek(d.mulai) : `${tanggalPendek(d.mulai)} – ${tanggalPendek(d.sampai)}`;

const KELAS_LENCANA: Record<JenisKetidakhadiran, string> = {
	dinas: "lencana-status--izin",
	sakit: "lencana-status--sakit",
	keluarga: "lencana-status--tidak_hadir",
};

type Saring = { dari: string; sampai: string; jenis: "" | JenisKetidakhadiran };

const PER_HALAMAN = 5;

/**
 * Nomor halaman yang ditampilkan: selalu halaman pertama dan terakhir, plus
 * tetangga halaman aktif; celah ditandai null ("…"). Mis. 1 … 4 5 6 … 12.
 */
function nomorHalaman(aktif: number, total: number): (number | null)[] {
	const tampil = new Set([1, total, aktif - 1, aktif, aktif + 1]);
	if (aktif <= 3) [2, 3, 4].forEach((n) => tampil.add(n));
	if (aktif >= total - 2) [total - 1, total - 2, total - 3].forEach((n) => tampil.add(n));
	const urut = [...tampil].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
	return urut.flatMap((n, i) => (i > 0 && n - urut[i - 1] > 1 ? [null, n] : [n]));
}

// Ketidakhadiran Guru › Histori (admin): semua guru yang tugas dinas, sakit, atau
// kepentingan pada rentang tanggal. Bawaan 30 hari ke belakang
// sampai 31 hari ke depan. Hapus membatalkan data (scan guru muncul kembali).
export function HistoriKetidakhadiran() {
	const [saring, setSaring] = useState<Saring>(() => {
		const hariIni = tanggalWib();
		return { dari: geser(hariIni, -30), sampai: geser(hariIni, 31), jenis: "" };
	});
	const [draf, setDraf] = useState(saring);
	const [daftar, setDaftar] = useState<Ketidakhadiran[] | null>(null);
	const [galat, setGalat] = useState<string | null>(null);
	const [proses, setProses] = useState(false);
	const [halaman, setHalaman] = useState(1);

	useEffect(() => {
		let aktif = true;
		historiKetidakhadiran(saring.dari, saring.sampai, saring.jenis).then(
			(d) => {
				if (!aktif) return;
				setGalat(null);
				setDaftar(d);
			},
			(g) => {
				if (!aktif) return;
				setDaftar(null);
				setGalat(g instanceof GagalApi ? g.message : "Gagal memuat histori");
			},
		);
		return () => {
			aktif = false;
		};
	}, [saring]);

	function terapkan(e: React.FormEvent) {
		e.preventDefault();
		if (!draf.dari || !draf.sampai) return setGalat("Isi tanggal awal dan tanggal akhir");
		if (draf.dari > draf.sampai) return setGalat("Tanggal awal tidak boleh setelah tanggal akhir");
		setGalat(null);
		setDaftar(null);
		setHalaman(1);
		setSaring(draf);
	}

	async function hapus(id: string) {
		setProses(true);
		setGalat(null);
		try {
			await hapusKetidakhadiran(id);
			setDaftar((d) => (d ?? []).filter((x) => x.id !== id));
		} catch (g) {
			setGalat(g instanceof GagalApi ? g.message : "Gagal menghapus");
		} finally {
			setProses(false);
		}
	}

	// Lima data per halaman; halaman aktif dijepit bila data berkurang (mis. setelah Hapus).
	const totalHalaman = Math.max(1, Math.ceil((daftar?.length ?? 0) / PER_HALAMAN));
	const halamanAktif = Math.min(halaman, totalHalaman);
	const tampil = (daftar ?? []).slice((halamanAktif - 1) * PER_HALAMAN, halamanAktif * PER_HALAMAN);

	return (
		<div className="container container--lebar">
			<div className="halaman-judul">
				<h1>Histori Ketidakhadiran Guru</h1>
				<p className="redup">Daftar guru yang tugas dinas, sakit, atau ada kepentingan.</p>
			</div>

			<section className="kartu">
				<form className="filter-rekap" onSubmit={terapkan}>
					<div className="kolom">
						<label htmlFor="hist-dari">Dari tanggal</label>
						<input id="hist-dari" type="date" value={draf.dari} onChange={(e) => setDraf({ ...draf, dari: e.target.value })} />
					</div>
					<div className="kolom">
						<label htmlFor="hist-sampai">Sampai tanggal</label>
						<input id="hist-sampai" type="date" value={draf.sampai} min={draf.dari} onChange={(e) => setDraf({ ...draf, sampai: e.target.value })} />
					</div>
					<div className="kolom">
						<label htmlFor="hist-jenis">Jenis</label>
						<select id="hist-jenis" value={draf.jenis} onChange={(e) => setDraf({ ...draf, jenis: e.target.value as Saring["jenis"] })}>
							<option value="">Semua</option>
							{(Object.keys(NAMA_JENIS) as JenisKetidakhadiran[]).map((j) => (
								<option key={j} value={j}>
									{NAMA_JENIS[j]}
								</option>
							))}
						</select>
					</div>
					<button type="submit" className="tombol">
						Tampilkan
					</button>
				</form>
			</section>

			{galat && <p className="galat-kolom">{galat}</p>}
			{!daftar && !galat && <p className="redup">Memuat…</p>}
			{daftar && daftar.length === 0 && (
				<section className="kartu">
					<p className="redup">Tidak ada data pada rentang ini.</p>
				</section>
			)}

			{daftar && daftar.length > 0 && (
				<>
					<ul className="daftar-histori" aria-label="Daftar ketidakhadiran guru">
						{tampil.map((d) => (
							<li key={d.id} className="kartu daftar-histori__kotak">
								<div className="daftar-histori__isi">
									<div className="daftar-histori__atas">
										<strong className="daftar-histori__nama">{d.guru_nama}</strong>
										<span className={`lencana-status ${KELAS_LENCANA[d.jenis]}`}>{NAMA_JENIS[d.jenis]}</span>
									</div>
									<dl className="daftar-histori__rincian">
										<div>
											<dt>Tanggal</dt>
											<dd>{rentang(d)}</dd>
										</div>
										<div>
											<dt>Keterangan</dt>
											<dd>{d.keterangan}</dd>
										</div>
									</dl>
								</div>
								<button type="button" className="tombol tombol--sekunder tombol--kecil" onClick={() => void hapus(d.id)} disabled={proses}>
									Hapus
								</button>
							</li>
						))}
					</ul>

					{totalHalaman > 1 && (
						<nav className="paginasi" aria-label="Pilih halaman">
							<button
								type="button"
								className="tombol tombol--sekunder tombol--kecil paginasi__tombol"
								onClick={() => setHalaman(halamanAktif - 1)}
								disabled={halamanAktif === 1}
							>
								Sebelumnya
							</button>
							{nomorHalaman(halamanAktif, totalHalaman).map((n, i) =>
								n === null ? (
									<span key={`celah-${i}`} className="paginasi__celah" aria-hidden="true">
										…
									</span>
								) : (
									<button
										key={n}
										type="button"
										className={`tombol tombol--kecil paginasi__tombol ${n === halamanAktif ? "" : "tombol--sekunder"}`}
										onClick={() => setHalaman(n)}
										aria-current={n === halamanAktif ? "page" : undefined}
										aria-label={n === totalHalaman ? `Halaman ${n} (terakhir)` : `Halaman ${n}`}
									>
										{n}
									</button>
								),
							)}
							<button
								type="button"
								className="tombol tombol--sekunder tombol--kecil paginasi__tombol"
								onClick={() => setHalaman(halamanAktif + 1)}
								disabled={halamanAktif === totalHalaman}
							>
								Berikutnya
							</button>
						</nav>
					)}
					<p className="redup paginasi__info">
						Menampilkan {(halamanAktif - 1) * PER_HALAMAN + 1}–{Math.min(halamanAktif * PER_HALAMAN, daftar.length)} dari{" "}
						{daftar.length} data
					</p>
				</>
			)}
		</div>
	);
}
