import { KotakJadwalHariIni } from "../components/KotakJadwalHariIni";
import type { Saya } from "../lib/api";

export function Dashboard({
	saya,
	peranAktif,
	onGantiPeran,
	onBukaAbsen,
}: {
	saya: Saya;
	peranAktif: string | null;
	onGantiPeran: () => void;
	onBukaAbsen: (sesiId: string) => void;
}) {
	const aktif = saya.peran.find((p) => p.kode === peranAktif) ?? saya.peran[0] ?? null;

	return (
		<div className="container">
			<div className="halaman-judul">
				<h1>Dashboard</h1>
				<p className="redup">Ringkasan untuk peran yang sedang aktif.</p>
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

			{aktif?.tingkat === "guru" && <KotakJadwalHariIni onBukaAbsen={onBukaAbsen} />}
		</div>
	);
}
