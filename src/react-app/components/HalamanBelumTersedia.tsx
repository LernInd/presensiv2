// Placeholder untuk rute yang sudah tersambung tapi fungsinya belum dibangun.
export function HalamanBelumTersedia({ judul }: { judul: string }) {
	return (
		<div className="container">
			<div className="halaman-judul">
				<h1>{judul}</h1>
				<p className="redup">Fitur ini sedang disiapkan dan akan menyusul.</p>
			</div>
			<div className="kartu kartu--kosong">
				<p className="redup">Belum ada yang bisa ditampilkan di sini.</p>
			</div>
		</div>
	);
}
