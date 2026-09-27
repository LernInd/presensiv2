import { MenuAkun } from "./MenuAkun";

// Chrome aplikasi yang persisten di tahap pilihPeran/beranda: brand di kiri
// (disembunyikan di ponsel demi ruang), foto profil di kanan sebagai
// pemicu dropdown akun (Ganti peran, Keluar) — lihat MenuAkun.tsx.
export function Topbar({
	nama,
	fotoUrl,
	onKeluar,
	proses,
	onBukaSidebar,
	bisaGantiPeran = false,
	onGantiPeran,
}: {
	nama: string;
	fotoUrl: string | null;
	onKeluar: () => void;
	proses: boolean;
	onBukaSidebar?: () => void;
	bisaGantiPeran?: boolean;
	onGantiPeran?: () => void;
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

			<MenuAkun
				nama={nama}
				fotoUrl={fotoUrl}
				bisaGantiPeran={bisaGantiPeran}
				onGantiPeran={onGantiPeran ?? (() => {})}
				onKeluar={onKeluar}
				proses={proses}
			/>
		</header>
	);
}
