import { useEffect, useState, type FormEvent } from "react";
import { ambilKelas, type KelasRingkas } from "../lib/api";
import type { NilaiFilter } from "../lib/filterRekap";

// Filter halaman Rekap: tanggal dipilih hingga tanggal terakhir dipilih
// (maks. 31 hari — dijaga juga di server) dan kelas opsional. Tombolnya
// mengunduh, bukan menampilkan.
export function FilterRekap({
	nilai,
	memuat,
	onUnduh,
	tanpaKelas = false,
}: {
	nilai: NilaiFilter;
	memuat: boolean;
	onUnduh: (n: NilaiFilter) => void;
	/** Rekap guru tidak dipilah per kelas: dropdown kelas disembunyikan. */
	tanpaKelas?: boolean;
}) {
	const [draf, setDraf] = useState(nilai);
	const [kelas, setKelas] = useState<KelasRingkas[]>([]);
	const [galat, setGalat] = useState<string | null>(null);

	useEffect(() => {
		if (tanpaKelas) return;
		ambilKelas().then(setKelas, () => setKelas([]));
	}, [tanpaKelas]);

	function kirim(e: FormEvent) {
		e.preventDefault();
		if (!draf.dari || !draf.sampai) return setGalat("Isi tanggal awal dan tanggal akhir");
		if (draf.dari > draf.sampai) return setGalat("Tanggal awal tidak boleh setelah tanggal akhir");
		setGalat(null);
		onUnduh(draf);
	}

	return (
		<form className="filter-rekap" onSubmit={kirim}>
			<div className="kolom">
				<label htmlFor="rekap-dari">Dari tanggal</label>
				<input id="rekap-dari" type="date" value={draf.dari} onChange={(e) => setDraf({ ...draf, dari: e.target.value })} />
			</div>
			<div className="kolom">
				<label htmlFor="rekap-sampai">Sampai tanggal</label>
				<input
					id="rekap-sampai"
					type="date"
					value={draf.sampai}
					min={draf.dari}
					onChange={(e) => setDraf({ ...draf, sampai: e.target.value })}
				/>
			</div>
			{!tanpaKelas && (
			<div className="kolom">
				<label htmlFor="rekap-kelas">Kelas</label>
				<select id="rekap-kelas" value={draf.kelasId} onChange={(e) => setDraf({ ...draf, kelasId: e.target.value })}>
					<option value="">Semua kelas</option>
					{kelas.map((k) => (
						<option key={k.id} value={k.id}>
							{k.nama}
						</option>
					))}
				</select>
			</div>
			)}
			<button type="submit" className="tombol" disabled={memuat}>
				{memuat ? "Menyiapkan berkas…" : "Unduh Excel (.xlsx)"}
			</button>
			{galat && <p className="galat-kolom filter-rekap__galat">{galat}</p>}
		</form>
	);
}
