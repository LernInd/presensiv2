import { inisial } from "../lib/format";

// Chrome aplikasi yang persisten di tahap pilihPeran/beranda: brand di kiri,
// identitas pengguna + aksi akun di kanan. Menaruh "Keluar" di sini (bukan
// tombol besar di body halaman) mengikuti pola aplikasi profesional
// (GitHub/Slack menaruh keluar di area akun, bukan di tengah halaman).
export function Topbar({
	nama,
	fotoUrl,
	onKeluar,
	proses,
	onBukaSidebar,
}: {
	nama: string;
	fotoUrl: string | null;
	onKeluar: () => void;
	proses: boolean;
	onBukaSidebar?: () => void;
}) {
	return (
		<header className="topbar">
			<div className="topbar__kiri">
				{onBukaSidebar && (
					<button type="button" className="topbar__menu" onClick={onBukaSidebar} aria-label="Buka menu navigasi">
						<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
							<path
								d="M3 5h14M3 10h14M3 15h14"
								stroke="currentColor"
								strokeWidth="1.6"
								strokeLinecap="round"
							/>
						</svg>
					</button>
				)}
				<div className="topbar__brand">
					<img src="/icon.svg" alt="" width={26} height={26} />
					<span>Presensi</span>
				</div>
			</div>
			<div className="topbar__akun">
				{fotoUrl ? (
					<img className="avatar" src={fotoUrl} alt="" width={32} height={32} />
				) : (
					<div className="avatar" aria-hidden="true">
						{inisial(nama)}
					</div>
				)}
				<span className="topbar__nama">{nama}</span>
				<button type="button" className="topbar__keluar" onClick={onKeluar} disabled={proses}>
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
						<path
							d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M10.5 11 14 8l-3.5-3M14 8H6"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
					{proses ? "Keluar…" : "Keluar"}
				</button>
			</div>
		</header>
	);
}
