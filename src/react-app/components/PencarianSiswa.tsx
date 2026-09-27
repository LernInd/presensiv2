import { useEffect, useState } from "react";
import { GagalApi, cariSantri, type SantriRingkas } from "../lib/api";

const MIN_HURUF = 3;
const JEDA_DEBOUNCE_MS = 300;

export function PencarianSiswa({ onPilih }: { onPilih: (santri: SantriRingkas) => void }) {
	const [teks, setTeks] = useState("");
	const [hasil, setHasil] = useState<SantriRingkas[]>([]);
	const [mencari, setMencari] = useState(false);
	const [galat, setGalat] = useState<string | null>(null);

	const query = teks.trim();
	const cukupHuruf = query.length >= MIN_HURUF;
	// Hasil pencarian sebelumnya disembunyikan begitu ketikan turun di bawah
	// ambang, tanpa perlu mengosongkan state-nya di dalam efek.
	const hasilTampil = cukupHuruf ? hasil : [];

	useEffect(() => {
		if (!cukupHuruf) return;
		let aktif = true;
		const waktu = setTimeout(() => {
			setMencari(true);
			cariSantri(query).then(
				(d) => {
					if (aktif) {
						setHasil(d);
						setGalat(null);
						setMencari(false);
					}
				},
				(g) => {
					if (aktif) {
						setGalat(g instanceof GagalApi ? g.message : "Pencarian gagal");
						setHasil([]);
						setMencari(false);
					}
				},
			);
		}, JEDA_DEBOUNCE_MS);
		return () => {
			aktif = false;
			clearTimeout(waktu);
		};
	}, [query, cukupHuruf]);

	return (
		<div className="pencarian">
			<input
				type="search"
				value={teks}
				onChange={(e) => setTeks(e.target.value)}
				placeholder="Ketik nama santri (minimal 3 huruf)…"
				autoComplete="off"
				autoCapitalize="words"
				maxLength={60}
			/>
			{query.length > 0 && !cukupHuruf && (
				<p className="redup">Ketik {MIN_HURUF - query.length} huruf lagi untuk mulai mencari.</p>
			)}
			{cukupHuruf && mencari && <p className="redup">Mencari…</p>}
			{cukupHuruf && galat && <p className="galat-kolom">{galat}</p>}
			{cukupHuruf && !mencari && !galat && hasilTampil.length === 0 && (
				<p className="redup">Tidak ada santri yang cocok di lembaga Anda.</p>
			)}
			{hasilTampil.length > 0 && (
				<ul className="daftar-santri">
					{hasilTampil.map((s) => (
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
