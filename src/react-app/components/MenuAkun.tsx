import { useEffect, useRef, useState } from "react";
import { inisial } from "../lib/format";

// Foto profil di header kanan jadi pemicu dropdown akun: Ganti peran dan
// Keluar dikumpulkan di satu tempat (pola umum GitHub/Slack/Google), bukan
// tombol Keluar terpisah yang selalu terlihat.
export function MenuAkun({
	nama,
	fotoUrl,
	bisaGantiPeran,
	onGantiPeran,
	onKeluar,
	proses,
}: {
	nama: string;
	fotoUrl: string | null;
	bisaGantiPeran: boolean;
	onGantiPeran: () => void;
	onKeluar: () => void;
	proses: boolean;
}) {
	const [terbuka, setTerbuka] = useState(false);
	const bungkusRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!terbuka) return;
		function tutupDiLuar(e: MouseEvent) {
			if (bungkusRef.current && !bungkusRef.current.contains(e.target as Node)) setTerbuka(false);
		}
		function tutupEsc(e: KeyboardEvent) {
			if (e.key === "Escape") setTerbuka(false);
		}
		document.addEventListener("mousedown", tutupDiLuar);
		document.addEventListener("keydown", tutupEsc);
		return () => {
			document.removeEventListener("mousedown", tutupDiLuar);
			document.removeEventListener("keydown", tutupEsc);
		};
	}, [terbuka]);

	return (
		<div className="menu-akun" ref={bungkusRef}>
			<button
				type="button"
				className="menu-akun__pemicu"
				onClick={() => setTerbuka((v) => !v)}
				aria-haspopup="menu"
				aria-expanded={terbuka}
			>
				{fotoUrl ? (
					<img className="avatar" src={fotoUrl} alt="" width={32} height={32} />
				) : (
					<div className="avatar" aria-hidden="true">
						{inisial(nama)}
					</div>
				)}
				<span className="menu-akun__nama">{nama}</span>
				<svg
					className={`menu-akun__panah ${terbuka ? "menu-akun__panah--terbuka" : ""}`}
					width="12"
					height="12"
					viewBox="0 0 12 12"
					fill="none"
					aria-hidden="true"
				>
					<path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
				</svg>
			</button>

			{terbuka && (
				<div className="menu-akun__daftar" role="menu" aria-label={`Akun ${nama}`}>
					{bisaGantiPeran && (
						<button
							type="button"
							role="menuitem"
							className="menu-akun__item"
							onClick={() => {
								setTerbuka(false);
								onGantiPeran();
							}}
						>
							Ganti peran
						</button>
					)}
					<button
						type="button"
						role="menuitem"
						className="menu-akun__item menu-akun__item--keluar"
						onClick={() => {
							setTerbuka(false);
							onKeluar();
						}}
						disabled={proses}
					>
						{proses ? "Keluar…" : "Keluar"}
					</button>
				</div>
			)}
		</div>
	);
}
