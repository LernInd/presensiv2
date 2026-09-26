import type { Saya } from "../lib/api";

// "Keluar" hidup di Topbar (lihat App.tsx), tidak diulang di badan halaman.
// Ganti peran tetap di sini karena itu aksi milik konteks halaman ini.
export function Beranda({
	saya,
	peranAktif,
	onGantiPeran,
}: {
	saya: Saya;
	peranAktif: string | null;
	onGantiPeran: () => void;
}) {
	const aktif = saya.peran.find((p) => p.kode === peranAktif) ?? saya.peran[0] ?? null;

	return (
		<div className="container container--sempit">
			<div className="halaman-judul">
				<h1>Beranda</h1>
				<p className="redup">Peran yang sedang aktif untuk sesi ini.</p>
			</div>

			{aktif && (
				<section className="kartu" aria-labelledby="judul-aktif">
					<h2 id="judul-aktif">Peran aktif</h2>
					<dl className="info-baris">
						<div className="info-baris__item">
							<dt>Peran</dt>
							<dd>{aktif.sebutan}</dd>
						</div>
						<div className="info-baris__item">
							<dt>Lembaga</dt>
							<dd>{aktif.lembaga.length > 0 ? aktif.lembaga.map((l) => l.nama).join(", ") : "Belum diatur"}</dd>
						</div>
						<div className="info-baris__item">
							<dt>Tingkat</dt>
							<dd>
								<span className={`lencana lencana--${aktif.tingkat}`}>
									{aktif.tingkat === "admin" ? "Admin" : "Guru"}
								</span>
							</dd>
						</div>
					</dl>
					{saya.peran.length > 1 && (
						<button type="button" className="tombol tombol--sekunder" onClick={onGantiPeran}>
							Ganti peran
						</button>
					)}
				</section>
			)}
		</div>
	);
}
