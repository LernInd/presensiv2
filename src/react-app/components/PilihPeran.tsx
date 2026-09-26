import { setPeranAktif, type PeranPengguna, type Saya } from "../lib/api";

// Halaman tersendiri yang tampil begitu akses diterima (saat peran > 1).
// Menekan satu peran langsung memilih dan melanjutkan — pola "tap untuk
// lanjut" yang lazim di pemilih workspace/akun (mis. Slack, Google) —
// tanpa tombol "Lanjutkan" tambahan.
export function PilihPeran({ saya, onPilih }: { saya: Saya; onPilih: (kode: string) => void }) {
	function pilih(peran: PeranPengguna) {
		setPeranAktif(peran.kode);
		onPilih(peran.kode);
	}

	return (
		<main className="halaman">
			<header className="profil kartu">
				{saya.foto_url ? (
					<img className="avatar" src={saya.foto_url} alt="" width={48} height={48} />
				) : (
					<div className="avatar" aria-hidden="true">
						{inisial(saya.nama)}
					</div>
				)}
				<div className="profil__teks">
					<h1>{saya.nama}</h1>
					<p className="redup">@{saya.username}</p>
				</div>
			</header>

			<section className="kartu" aria-labelledby="judul-peran">
				<h2 id="judul-peran">Pilih Peran</h2>
				<p className="redup">Anda memegang lebih dari satu peran. Pilih salah satu untuk melanjutkan.</p>
				<ul className="daftar-peran" role="list" aria-labelledby="judul-peran">
					{saya.peran.map((p) => (
						<li key={p.kode}>
							<button type="button" className="peran" onClick={() => pilih(p)}>
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
		</main>
	);
}

function inisial(nama: string): string {
	return nama
		.split(/\s+/)
		.slice(0, 2)
		.map((k) => k[0]?.toUpperCase() ?? "")
		.join("");
}
