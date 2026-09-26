import { setPeranAktif, type PeranPengguna, type Saya } from "../lib/api";

// Halaman tersendiri yang tampil begitu akses diterima (saat peran > 1).
// Menekan satu peran langsung memilih dan melanjutkan — pola "tap untuk
// lanjut" yang lazim di pemilih workspace/akun (mis. Slack, Google) —
// tanpa tombol "Lanjutkan" tambahan. Profil pengguna ditampilkan di Topbar,
// bukan diulang lagi di sini.
export function PilihPeran({ saya, onPilih }: { saya: Saya; onPilih: (kode: string) => void }) {
	function pilih(peran: PeranPengguna) {
		setPeranAktif(peran.kode);
		onPilih(peran.kode);
	}

	return (
		<div className="container">
			<div className="halaman-judul">
				<h1>Pilih Peran</h1>
				<p className="redup">Anda memegang lebih dari satu peran. Pilih salah satu untuk melanjutkan.</p>
			</div>

			<ul className="grid-peran" aria-label="Daftar peran">
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
		</div>
	);
}
