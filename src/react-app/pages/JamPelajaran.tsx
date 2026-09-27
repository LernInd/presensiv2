import { useEffect, useState } from "react";
import { KotakJadwalHariIni } from "../components/KotakJadwalHariIni";
import { GagalApi, detailPresensiSesi, ubahPresensi, type BarisPresensi, type DetailSesi } from "../lib/api";

const SEBUTAN_STATUS: Record<string, string> = { hadir: "Hadir", izin: "Izin", sakit: "Sakit", alfa: "Alfa" };
const OPSI_STATUS = ["hadir", "izin", "alfa"] as const;

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
								<span className="daftar-roster__nama">{p.santri_nama}</span>

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
								) : (
									<div className="daftar-roster__aksi" role="group" aria-label={`Status ${p.santri_nama}`}>
										{OPSI_STATUS.map((opsi) => (
											<button
												key={opsi}
												type="button"
												className={`status-tombol status-tombol--${opsi} ${p.status === opsi ? "status-tombol--aktif" : ""}`}
												disabled={prosesId === p.santri_id || p.status === "sakit"}
												aria-pressed={p.status === opsi}
												onClick={() => pilihStatus(p, opsi)}
											>
												{SEBUTAN_STATUS[opsi]}
											</button>
										))}
										{p.status === "sakit" && <span className="lencana lencana--admin">Sakit (terkunci)</span>}
									</div>
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
