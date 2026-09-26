import { useState } from "react";
import { keluar, type Saya } from "../lib/api";

export function Beranda({
	saya,
	peranAktif,
	onGantiPeran,
	onKeluar,
}: {
	saya: Saya;
	peranAktif: string | null;
	onGantiPeran: () => void;
	onKeluar: () => void;
}) {
	const [proses, setProses] = useState(false);
	const aktif = saya.peran.find((p) => p.kode === peranAktif) ?? saya.peran[0] ?? null;

	async function klikKeluar() {
		setProses(true);
		try {
			await keluar();
		} finally {
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

			{aktif && (
				<section className="kartu" aria-labelledby="judul-aktif">
					<h2 id="judul-aktif">Peran aktif</h2>
					<div className="peran peran--tampil">
						<span className="peran__nama">{aktif.sebutan}</span>
						<span className="peran__lembaga redup">
							{aktif.lembaga.length > 0 ? aktif.lembaga.map((l) => l.nama).join(", ") : "Lembaga belum diatur"}
						</span>
						<span className={`lencana lencana--${aktif.tingkat}`}>
							{aktif.tingkat === "admin" ? "Admin" : "Guru"}
						</span>
					</div>
					{saya.peran.length > 1 && (
						<button type="button" className="tombol tombol--sekunder" onClick={onGantiPeran}>
							Ganti peran
						</button>
					)}
				</section>
			)}

			<button type="button" className="tombol tombol--garis" onClick={klikKeluar} disabled={proses}>
				{proses ? "Keluar…" : "Keluar"}
			</button>
		</main>
	);
}
