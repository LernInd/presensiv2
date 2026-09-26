import { useState } from "react";
import { keluar, setPeranAktif, type Saya } from "../lib/api";

export function Beranda({ saya, onKeluar }: { saya: Saya; onKeluar: () => void }) {
	const [aktif, setAktif] = useState<string | null>(saya.peran.length === 1 ? saya.peran[0].kode : null);
	const [proses, setProses] = useState(false);

	function pilih(kode: string) {
		setAktif(kode);
		setPeranAktif(kode);
	}

	async function klikKeluar() {
		setProses(true);
		try {
			await keluar();
		} finally {
			setPeranAktif(null);
			onKeluar();
		}
	}

	const inisial = saya.nama
		.split(/\s+/)
		.slice(0, 2)
		.map((k) => k[0]?.toUpperCase() ?? "")
		.join("");

	return (
		<main className="halaman">
			<header className="profil kartu">
				{saya.foto_url ? (
					<img className="avatar" src={saya.foto_url} alt="" width={48} height={48} />
				) : (
					<div className="avatar" aria-hidden="true">
						{inisial}
					</div>
				)}
				<div className="profil__teks">
					<h1>{saya.nama}</h1>
					<p className="redup">@{saya.username}</p>
				</div>
			</header>

			<section className="kartu" aria-labelledby="judul-peran">
				<h2 id="judul-peran">Peran Anda</h2>
				<p className="redup">Pilih peran untuk melanjutkan presensi.</p>
				<ul className="daftar-peran" role="radiogroup" aria-labelledby="judul-peran">
					{saya.peran.map((p) => (
						<li key={p.kode}>
							<button
								type="button"
								role="radio"
								aria-checked={aktif === p.kode}
								className="peran"
								onClick={() => pilih(p.kode)}
							>
								<span className="peran__nama">{p.sebutan}</span>
								<span className="peran__lembaga redup">
									{p.lembaga.length > 0 ? p.lembaga.map((l) => l.nama).join(", ") : "Lembaga belum diatur"}
								</span>
								<span className={`lencana lencana--${p.tingkat}`}>
									{p.tingkat === "admin" ? "Admin" : "Guru"}
								</span>
							</button>
						</li>
					))}
				</ul>
			</section>

			<button type="button" className="tombol tombol--garis" onClick={klikKeluar} disabled={proses}>
				{proses ? "Keluar…" : "Keluar"}
			</button>
		</main>
	);
}
