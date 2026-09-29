import { useEffect, useRef, useState } from "react";
import {
	GagalApi,
	fotoPresensiGuru,
	kehadiranGuru,
	tanggalWib,
	validasiPresensiGuru,
	type BarisMonitorGuru,
	type PresensiGuruMonitor,
	type TipeGuru,
} from "../lib/api";

const jamWib = (iso: string) =>
	new Date(iso).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });

const waktuWib = (iso: string) =>
	new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const ringkasJam = (p: PresensiGuruMonitor | null) => (p ? `${jamWib(p.waktu)}` : "—");

type Sasaran = { guru: BarisMonitorGuru; tipe: TipeGuru; ke: boolean };
type Foto = { status: "memuat" | "ada" | "galat"; url?: string; pesan?: string };

const MAKS_KETERANGAN = 200;

// Kepala sekolah/madrasah memantau kehadiran gerbang guru lembaganya dan dapat
// menandai presensi tidak valid — keterangan WAJIB sebelum status berubah.
// Guru tidak diberi tahu (layar guru tidak membaca status ini).
export function KehadiranGuru() {
	const [tanggal, setTanggal] = useState(tanggalWib);
	const [data, setData] = useState<BarisMonitorGuru[] | null>(null);
	const [galat, setGalat] = useState<string | null>(null);
	const [foto, setFoto] = useState<Record<string, Foto>>({});
	const [sasaran, setSasaran] = useState<Sasaran | null>(null);
	const urlFoto = useRef<string[]>([]);

	useEffect(() => {
		let aktif = true;
		kehadiranGuru(tanggal).then(
			(d) => {
				if (!aktif) return;
				setGalat(null);
				setData(d.guru);
			},
			(g) => {
				if (!aktif) return;
				setData(null);
				setGalat(g instanceof GagalApi ? g.message : "Gagal memuat kehadiran guru");
			},
		);
		return () => {
			aktif = false;
		};
	}, [tanggal]);

	// URL objek foto dilepas saat halaman ditutup.
	useEffect(() => {
		const daftar = urlFoto.current;
		return () => daftar.forEach((u) => URL.revokeObjectURL(u));
	}, []);

	function ubahTanggal(t: string) {
		if (!t) return;
		urlFoto.current.forEach((u) => URL.revokeObjectURL(u));
		urlFoto.current = [];
		setFoto({});
		setData(null);
		setTanggal(t);
	}

	async function lihatFoto(guruId: string, tipe: TipeGuru) {
		const kunci = `${guruId}-${tipe}`;
		setFoto((f) => ({ ...f, [kunci]: { status: "memuat" } }));
		try {
			const url = URL.createObjectURL(await fotoPresensiGuru(tanggal, guruId, tipe));
			urlFoto.current.push(url);
			setFoto((f) => ({ ...f, [kunci]: { status: "ada", url } }));
		} catch (g) {
			setFoto((f) => ({
				...f,
				[kunci]: { status: "galat", pesan: g instanceof GagalApi ? g.message : "Gagal memuat foto" },
			}));
		}
	}

	async function konfirmasi(keterangan: string) {
		if (!sasaran) return;
		await validasiPresensiGuru({
			tanggal,
			guru_id: sasaran.guru.guru_id,
			tipe: sasaran.tipe,
			valid: sasaran.ke,
			keterangan,
		});
		setSasaran(null);
		setData((await kehadiranGuru(tanggal)).guru);
	}

	return (
		<div className="container container--lebar">
			<div className="presensi-kepala">
				<div className="halaman-judul">
					<h1>Kehadiran Guru</h1>
					<p className="redup">Pantau presensi masuk dan pulang guru, lengkap dengan lokasi dan foto.</p>
				</div>
				<div className="kolom kolom--tanggal">
					<label htmlFor="kg-tanggal">Tanggal</label>
					<input id="kg-tanggal" type="date" value={tanggal} max={tanggalWib()} onChange={(e) => ubahTanggal(e.target.value)} />
				</div>
			</div>

			{galat && <p className="galat-kolom">{galat}</p>}
			{!data && !galat && <p className="redup">Memuat…</p>}
			{data && data.length === 0 && <p className="redup">Belum ada guru terdaftar untuk lembaga ini.</p>}

			{data && data.length > 0 && (
				<div className="daftar-kartu-guru">
					{data.map((g) => (
						<details className="kartu kartu-guru" key={g.guru_id}>
							<summary className="kartu-guru__ringkas">
								<span className="kartu-guru__nama">{g.guru_nama}</span>
								<span className="kartu-guru__jam redup">
									Masuk {ringkasJam(g.masuk)} · Pulang {ringkasJam(g.pulang)}
								</span>
								<StatusRingkas guru={g} />
							</summary>
							<div className="kartu-guru__isi">
								{g.dinas && (
									<p className="info-dinas" role="status">
										Tugas dinas: {g.dinas}
									</p>
								)}
								{(["masuk", "pulang"] as const).map((tipe) => (
									<BarisPresensi
										key={tipe}
										tipe={tipe}
										guruId={g.guru_id}
										data={g[tipe]}
										dinas={g.dinas !== null}
										foto={foto[`${g.guru_id}-${tipe}`]}
										onLihatFoto={() => void lihatFoto(g.guru_id, tipe)}
										onUbah={(ke) => setSasaran({ guru: g, tipe, ke })}
									/>
								))}
							</div>
						</details>
					))}
				</div>
			)}

			<DialogValidasi sasaran={sasaran} tanggal={tanggal} onTutup={() => setSasaran(null)} onKonfirmasi={konfirmasi} />
		</div>
	);
}

function StatusRingkas({ guru }: { guru: BarisMonitorGuru }) {
	if (guru.dinas) return <span className="lencana-status lencana-status--izin">Dinas</span>;
	const ada = [guru.masuk, guru.pulang].filter((p): p is PresensiGuruMonitor => p !== null);
	if (ada.length === 0) return <span className="lencana-status lencana-status--sakit">Belum presensi</span>;
	const tidakValid = ada.some((p) => !p.valid);
	return (
		<span className={`lencana-status ${tidakValid ? "lencana-status--alfa" : "lencana-status--hadir"}`}>
			{tidakValid ? "Ada yang tidak valid" : "Valid"}
		</span>
	);
}

function BarisPresensi({
	tipe,
	guruId,
	data,
	dinas,
	foto,
	onLihatFoto,
	onUbah,
}: {
	tipe: TipeGuru;
	guruId: string;
	data: PresensiGuruMonitor | null;
	dinas: boolean;
	foto: Foto | undefined;
	onLihatFoto: () => void;
	onUbah: (ke: boolean) => void;
}) {
	const label = tipe === "masuk" ? "Masuk" : "Pulang";
	if (!data) {
		return (
			<div className="presensi-baris">
				<span className="presensi-baris__label">{label}</span>
				<span className="redup">{dinas ? "Tidak wajib (dinas)" : "Belum presensi"}</span>
			</div>
		);
	}

	return (
		<div className="presensi-baris">
			<div className="presensi-baris__kepala">
				<span className="presensi-baris__label">{label}</span>
				<strong>{jamWib(data.waktu)} WIB</strong>
				<span className={`lencana-status ${data.valid ? "lencana-status--hadir" : "lencana-status--alfa"}`}>
					{data.valid ? "Valid" : "Tidak valid"}
				</span>
			</div>

			<p className="redup">
				{data.alamat ? `Perkiraan alamat: ${data.alamat}` : "Alamat sedang dicari… muat ulang halaman sebentar lagi."} ·{" "}
				<a href={data.tautan_peta} target="_blank" rel="noopener noreferrer">
					Lihat di peta
				</a>
			</p>

			{!data.valid && data.catatan_validasi && (
				<p className="redup">
					Alasan: {data.catatan_validasi}
					{data.divalidasi_oleh_nama ? ` — ${data.divalidasi_oleh_nama}` : ""}
					{data.divalidasi_pada ? `, ${waktuWib(data.divalidasi_pada)}` : ""}
				</p>
			)}

			{foto?.status === "ada" && foto.url && (
				<img className="presensi-baris__foto" src={foto.url} alt={`Foto presensi ${label.toLowerCase()} ${guruId}`} />
			)}
			{foto?.status === "galat" && <p className="galat-kolom">{foto.pesan}</p>}

			<div className="presensi-baris__aksi">
				{data.ada_foto ? (
					foto?.status !== "ada" && (
						<button
							type="button"
							className="tombol tombol--sekunder tombol--kecil"
							onClick={onLihatFoto}
							disabled={foto?.status === "memuat"}
						>
							{foto?.status === "memuat" ? "Memuat foto…" : "Lihat foto"}
						</button>
					)
				) : (
					<span className="redup">Foto sudah dihapus (23:00)</span>
				)}
				<button type="button" className="tombol tombol--sekunder tombol--kecil" onClick={() => onUbah(!data.valid)}>
					{data.valid ? "Tandai tidak valid" : "Pulihkan jadi valid"}
				</button>
			</div>
		</div>
	);
}

function DialogValidasi({
	sasaran,
	tanggal,
	onTutup,
	onKonfirmasi,
}: {
	sasaran: Sasaran | null;
	tanggal: string;
	onTutup: () => void;
	onKonfirmasi: (keterangan: string) => Promise<void>;
}) {
	const ref = useRef<HTMLDialogElement>(null);
	const [keterangan, setKeterangan] = useState("");
	const [proses, setProses] = useState(false);
	const [galat, setGalat] = useState<string | null>(null);
	const terbuka = sasaran !== null;

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		if (terbuka && !el.open) el.showModal();
		if (!terbuka && el.open) el.close();
	}, [terbuka]);

	function tutup() {
		setKeterangan("");
		setGalat(null);
		onTutup();
	}

	async function kirim() {
		if (!keterangan.trim()) {
			setGalat("Keterangan wajib diisi");
			return;
		}
		setProses(true);
		setGalat(null);
		try {
			await onKonfirmasi(keterangan.trim());
			setKeterangan("");
		} catch (g) {
			setGalat(g instanceof GagalApi ? g.message : "Gagal menyimpan perubahan");
		} finally {
			setProses(false);
		}
	}

	const judul = sasaran?.ke ? "Pulihkan presensi jadi valid" : "Tandai presensi tidak valid";

	return (
		<dialog
			ref={ref}
			className="dialog dialog--konfirmasi"
			aria-labelledby="validasi-judul"
			onClose={tutup}
			onClick={(e) => e.target === e.currentTarget && !proses && tutup()}
		>
			<div className="dialog__isi">
				<h2 id="validasi-judul">{judul}</h2>
				{sasaran && (
					<p className="redup">
						{sasaran.guru.guru_nama} · {sasaran.tipe === "masuk" ? "Masuk" : "Pulang"} ·{" "}
						{new Date(`${tanggal}T12:00:00Z`).toLocaleDateString("id-ID", {
							day: "numeric",
							month: "long",
							year: "numeric",
							timeZone: "UTC",
						})}
					</p>
				)}
				<div className="kolom validasi-kolom">
					<label htmlFor="validasi-ket">Keterangan (wajib)</label>
					<textarea
						id="validasi-ket"
						value={keterangan}
						onChange={(e) => setKeterangan(e.target.value.slice(0, MAKS_KETERANGAN))}
						maxLength={MAKS_KETERANGAN}
						rows={3}
						placeholder={sasaran?.ke ? "Alasan memulihkan presensi" : "Alasan presensi ditolak"}
						disabled={proses}
					/>
					<span className="redup">
						{keterangan.length}/{MAKS_KETERANGAN}
					</span>
				</div>
				{galat && <p className="galat-kolom">{galat}</p>}
				<div className="konfirmasi__aksi">
					<button type="button" className="tombol tombol--sekunder" onClick={tutup} disabled={proses}>
						Batal
					</button>
					<button type="button" className="tombol" onClick={() => void kirim()} disabled={proses || !keterangan.trim()}>
						{proses ? "Menyimpan…" : "Konfirmasi"}
					</button>
				</div>
			</div>
		</dialog>
	);
}
