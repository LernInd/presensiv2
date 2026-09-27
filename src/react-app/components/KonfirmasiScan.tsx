import { useEffect, useRef } from "react";
import type { HasilScan, TipeGerbang } from "../lib/api";

const SEBUTAN_STATUS: Record<string, string> = {
	tepat_waktu: "Tepat waktu",
	terlambat: "Terlambat",
	pulang: "Pulang",
};

// Pop-up konfirmasi ulang: wajib melihat foto, nama, dan kelas sebelum
// tercatat — kartu bisa berpindah tangan, wajah dan nama tidak.
export function KonfirmasiScan({
	terbuka,
	tipe,
	hasil,
	proses,
	onKonfirmasi,
	onTutup,
}: {
	terbuka: boolean;
	tipe: TipeGerbang;
	hasil: HasilScan | null;
	proses: boolean;
	onKonfirmasi: () => void;
	onTutup: () => void;
}) {
	const ref = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		if (terbuka && !el.open) el.showModal();
		if (!terbuka && el.open) el.close();
	}, [terbuka]);

	if (!hasil) return <dialog ref={ref} className="dialog" onClose={onTutup} />;

	const inisial = hasil.santri.nama_lengkap
		.split(/\s+/)
		.slice(0, 2)
		.map((k) => k[0]?.toUpperCase() ?? "")
		.join("");

	return (
		<dialog
			ref={ref}
			className="dialog dialog--konfirmasi"
			aria-labelledby="konfirmasi-nama"
			onClose={onTutup}
			onClick={(e) => e.target === e.currentTarget && !proses && onTutup()}
		>
			<div className="dialog__isi">
				{hasil.santri.foto_url ? (
					<img className="konfirmasi__foto" src={hasil.santri.foto_url} alt="" width={72} height={72} />
				) : (
					<div className="konfirmasi__foto konfirmasi__foto--inisial" aria-hidden="true">
						{inisial}
					</div>
				)}
				<h2 id="konfirmasi-nama">{hasil.santri.nama_lengkap}</h2>
				<p className="redup">
					{hasil.santri.kelas_nama ?? "Kelas belum diatur"} · {hasil.santri.lembaga_nama}
				</p>

				{hasil.diblokir ? (
					<>
						<p className="dialog__pesan galat-kolom">{hasil.alasan}</p>
						<button type="button" className="tombol tombol--sekunder" onClick={onTutup}>
							Tutup
						</button>
					</>
				) : hasil.sudah ? (
					<>
						<p className="dialog__pesan">
							Sudah tercatat <strong>{SEBUTAN_STATUS[hasil.status] ?? hasil.status}</strong> pukul{" "}
							{new Date(hasil.waktu).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}.
						</p>
						<button type="button" className="tombol tombol--sekunder" onClick={onTutup}>
							Tutup
						</button>
					</>
				) : (
					<>
						<p className="dialog__pesan">
							Akan dicatat <strong>{tipe === "masuk" ? "masuk" : "pulang"}</strong> dengan status{" "}
							<strong>{SEBUTAN_STATUS[hasil.status] ?? hasil.status}</strong>.
						</p>
						<div className="konfirmasi__aksi">
							<button type="button" className="tombol tombol--sekunder" onClick={onTutup} disabled={proses}>
								Batal
							</button>
							<button type="button" className="tombol" onClick={onKonfirmasi} disabled={proses} aria-busy={proses}>
								{proses ? "Menyimpan…" : "Konfirmasi"}
							</button>
						</div>
					</>
				)}
			</div>
		</dialog>
	);
}
