import { KotakJadwalHariIni } from "../components/KotakJadwalHariIni";
import type { Saya } from "../lib/api";

export function Dashboard({
	saya,
	peranAktif,
	onBukaAbsen,
}: {
	saya: Saya;
	peranAktif: string | null;
	onBukaAbsen: (sesiId: string) => void;
}) {
	const aktif = saya.peran.find((p) => p.kode === peranAktif) ?? saya.peran[0] ?? null;

	return (
		<div className="container">
			<div style={{ textAlign: "center" }} className="halaman-judul">
				<h1>Dashboard</h1>
				<p className="redup">Ringkasan untuk peran yang sedang aktif.</p>
			</div>

			{aktif?.tingkat === "guru" && <KotakJadwalHariIni onBukaAbsen={onBukaAbsen} />}
		</div>
	);
}
