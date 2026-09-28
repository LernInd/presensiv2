import { useEffect, useState } from "react";
import { KotakJadwalHariIni } from "../components/KotakJadwalHariIni";
import { GagalApi, detailPresensiSesi, ubahPresensi, type BarisPresensi, type DetailSesi } from "../lib/api";

const SEBUTAN_STATUS: Record<string, string> = {
	hadir: "Hadir",
	izin: "Izin",
	sakit: "Sakit",
	alfa: "Alfa",
	tidak_hadir: "Tidak Hadir",
};
// "izin"/"sakit" hanya lahir dari modul perizinan/kesehatan, dan "alfa"
// hanya boleh berubah lewat scan masuk yang sungguhan (lih. STATUS_SAH +
// perbaruiAlfaKeHadir di worker) — guru tidak punya opsi untuk ketiganya.
// Baris dengan salah satu status itu langsung tampil terkunci di bawah,
// masing-masing dengan pesan yang menjelaskan kenapa.
const OPSI_STATUS = ["hadir", "tidak_hadir"] as const;
const PESAN_TERKUNCI: Record<string, string> = {
	sakit: "Terkunci oleh surat sakit",
	izin: "Terkunci oleh izin yang disetujui",
	alfa: "Menunggu santri scan masuk gerbang",
};

export function JamPelajaran({
	sesiId,
	onPilihSesi,
	onKembali,
}: {
	sesiId: string | null;
	onPilihSesi: (sesiId: string) => void;
	onKembali: () => void;
}) {
	return sesiId ? <Roster sesiId={sesiId} onKembali={onKembali} /> : <DaftarSesi onBukaAbsen={onPilihSesi} />;
}

function DaftarSesi({ onBukaAbsen }: { onBukaAbsen: (sesiId: string) => void }) {
	return (
		<div className="container">
			<div className="halaman-judul">
				<h1>Jam Pelajaran</h1>
				<p className="redup">Jadwal mengajar Anda hari ini. Tekan "Buka Absen" untuk mengisi kehadiran.</p>
			</div>
			<KotakJadwalHariIni onBukaAbsen={onBukaAbsen} />
		</div>
	);
}

type Draf = { santriId: string; status: string; keterangan: string };

function Roster({ sesiId, onKembali }: { sesiId: string; onKembali: () => void }) {
	const [data, setData] = useState<DetailSesi | null>(null);
	const [galat, setGalat] = useState<string | null>(null);
	const [prosesId, setProsesId] = useState<string | null>(null);
	const [galatBaris, setGalatBaris] = useState<string | null>(null);
	const [draf, setDraf] = useState<Draf | null>(null);
	// Baris yang sedang menampilkan pilihan ubah status (bukan tombol status
	// selalu tampil) — supaya di mobile baris tetap ringkas walau opsinya 4.
	const [ubahId, setUbahId] = useState<string | null>(null);

	useEffect(() => {
		let aktif = true;
		setData(null);
		setGalat(null);
		setDraf(null);
		detailPresensiSesi(sesiId).then(
			(d) => aktif && setData(d),
			(g) => aktif && setGalat(g instanceof GagalApi ? g.message : "Gagal memuat sesi"),
		);
		return () => {
			aktif = false;
		};
	}, [sesiId]);

	function tetapkan(baris: BarisPresensi[], santriId: string, status: string, keterangan: string | null) {
		return baris.map((b) => (b.santri_id === santriId ? { ...b, status, keterangan } : b));
	}

	async function kirim(santriId: string, status: string, keterangan: string) {
		setProsesId(santriId);
		setGalatBaris(null);
		try {
			const hasil = await ubahPresensi(sesiId, santriId, { status, keterangan: keterangan || undefined });
			setData((d) => d && { ...d, presensi: tetapkan(d.presensi, santriId, hasil.status, hasil.keterangan) });
			setDraf(null);
		} catch (g) {
			setGalatBaris(g instanceof GagalApi ? g.message : "Gagal menyimpan perubahan");
		} finally {
			setProsesId(null);
		}
	}

	function pilihStatus(p: BarisPresensi, status: string) {
		setUbahId(null);
		if (status === p.status) return;
		if (status === p.status_awal) {
			void kirim(p.santri_id, status, "");
		} else {
			setGalatBaris(null);
			setDraf({ santriId: p.santri_id, status, keterangan: "" });
		}
	}

	return (
		<div className="container">
			<button type="button" className="tombol tombol--sekunder tombol--kecil tombol--kembali" onClick={onKembali}>
				← Kembali ke Jam Pelajaran
			</button>

			{galat && <p className="galat-kolom">{galat}</p>}
			{!data && !galat && <p className="redup">Memuat…</p>}

			{data && (
				<>
					<div className="halaman-judul">
						<h1>{data.sesi.mapel}</h1>
						<p className="redup">
							{data.sesi.kelas_nama} · {data.sesi.mulai}–{data.sesi.selesai}
						</p>
					</div>

					{galatBaris && <p className="galat-kolom">{galatBaris}</p>}

					<ul className="daftar-roster">
						{data.presensi.map((p) => (
							<li key={p.santri_id} className="daftar-roster__baris">
								<div className="daftar-roster__info">
									<span className="daftar-roster__nama">{p.santri_nama}</span>
									<span className={`lencana-status lencana-status--${p.status}`}>{SEBUTAN_STATUS[p.status]}</span>
								</div>

								{draf?.santriId === p.santri_id ? (
									<form
										className="daftar-roster__draf"
										onSubmit={(e) => {
											e.preventDefault();
											if (draf.keterangan.trim()) void kirim(p.santri_id, draf.status, draf.keterangan.trim());
										}}
									>
										<input
											autoFocus
											value={draf.keterangan}
											onChange={(e) => setDraf({ ...draf, keterangan: e.target.value })}
											placeholder={`Keterangan untuk status ${SEBUTAN_STATUS[draf.status]}`}
											maxLength={200}
											required
										/>
										<button type="submit" className="tombol tombol--kecil" disabled={prosesId === p.santri_id}>
											Simpan
										</button>
										<button
											type="button"
											className="tombol tombol--sekunder tombol--kecil"
											onClick={() => setDraf(null)}
										>
											Batal
										</button>
									</form>
								) : PESAN_TERKUNCI[p.status] ? (
									<span className="redup daftar-roster__terkunci">{PESAN_TERKUNCI[p.status]}</span>
								) : ubahId === p.santri_id ? (
									<div className="daftar-roster__opsi" role="group" aria-label={`Ubah status ${p.santri_nama}`}>
										{OPSI_STATUS.filter((opsi) => opsi !== p.status).map((opsi) => (
											<button
												key={opsi}
												type="button"
												className="tombol tombol--sekunder tombol--kecil"
												disabled={prosesId === p.santri_id}
												onClick={() => pilihStatus(p, opsi)}
											>
												{SEBUTAN_STATUS[opsi]}
											</button>
										))}
										<button type="button" className="tombol--tautan" onClick={() => setUbahId(null)}>
											Batal
										</button>
									</div>
								) : (
									<button
										type="button"
										className="tombol tombol--sekunder tombol--kecil"
										disabled={prosesId === p.santri_id}
										onClick={() => setUbahId(p.santri_id)}
									>
										Ubah status
									</button>
								)}
							</li>
						))}
						{data.presensi.length === 0 && <p className="redup">Belum ada santri terdaftar di kelas ini.</p>}
					</ul>
				</>
			)}
		</div>
	);
}
