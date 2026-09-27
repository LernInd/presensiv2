import { useState, type FormEvent } from "react";
import { GagalApi, cariSantri, type SantriRingkas } from "../lib/api";

const MIN_HURUF = 3;

// Pencarian dipicu lewat tombol/ikon (atau Enter), bukan otomatis saat
// mengetik — mencegah permintaan beruntun ke server untuk tiap huruf.
export function PencarianSiswa({ onPilih }: { onPilih: (santri: SantriRingkas) => void }) {
	const [teks, setTeks] = useState("");
	const [hasil, setHasil] = useState<SantriRingkas[] | null>(null);
	const [mencari, setMencari] = useState(false);
	const [galat, setGalat] = useState<string | null>(null);

	async function cari(e: FormEvent) {
		e.preventDefault();
		const query = teks.trim();
		if (query.length < MIN_HURUF) {
			setGalat(`Ketik minimal ${MIN_HURUF} huruf untuk mencari`);
			setHasil(null);
			return;
		}
		setMencari(true);
		setGalat(null);
		try {
			setHasil(await cariSantri(query));
		} catch (g) {
			setGalat(g instanceof GagalApi ? g.message : "Pencarian gagal");
			setHasil(null);
		} finally {
			setMencari(false);
		}
	}

	return (
		<div className="pencarian">
			<form className="pencarian__form" onSubmit={(e) => void cari(e)}>
				<input
					type="search"
					value={teks}
					onChange={(e) => {
						setTeks(e.target.value);
						setGalat(null);
					}}
					placeholder="Ketik nama santri (minimal 3 huruf), lalu cari…"
					autoComplete="off"
					autoCapitalize="words"
					maxLength={60}
				/>
				<button type="submit" className="pencarian__tombol" disabled={mencari} aria-label="Cari santri">
					{mencari ? (
						<span className="putar" aria-hidden="true" />
					) : (
						<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
							<circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.6" />
							<path d="M12.5 12.5 16 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
						</svg>
					)}
					<span>Cari</span>
				</button>
			</form>

			{galat && <p className="galat-kolom">{galat}</p>}
			{!mencari && !galat && hasil !== null && hasil.length === 0 && (
				<p className="redup">Tidak ada santri yang cocok di lembaga Anda.</p>
			)}
			{hasil && hasil.length > 0 && (
				<ul className="daftar-santri">
					{hasil.map((s) => (
						<li key={s.id}>
							<button type="button" className="daftar-santri__baris" onClick={() => onPilih(s)}>
								{s.foto_url ? (
									<img className="avatar" src={s.foto_url} alt="" width={36} height={36} />
								) : (
									<div className="avatar" aria-hidden="true">
										{s.nama_lengkap
											.split(/\s+/)
											.slice(0, 2)
											.map((k) => k[0]?.toUpperCase() ?? "")
											.join("")}
									</div>
								)}
								<span className="daftar-santri__teks">
									<span className="daftar-santri__nama">{s.nama_lengkap}</span>
									<span className="redup">{s.kelas_nama ?? "Kelas belum diatur"}</span>
								</span>
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
