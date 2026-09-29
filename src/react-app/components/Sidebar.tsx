type Butir = { label: string; tujuan: string };
type Kategori = { label: string; butir: Butir[] };

// Presensi gerbang (Guru/Siswa Masuk-Pulang) hanya untuk tingkat guru; admin
// tidak mencatat gerbang, ia merekap (lihat KATEGORI_ADMIN).
const KATEGORI_GURU: Kategori[] = [
	{
		label: "Guru",
		butir: [
			{ label: "Masuk", tujuan: "/masukguru" },
			{ label: "Pulang", tujuan: "/pulangguru" },
		],
	},
	{
		label: "Siswa",
		butir: [
			{ label: "Masuk", tujuan: "/masuksiswa" },
			{ label: "Pulang", tujuan: "/pulangsiswa" },
		],
	},
];

const KATEGORI_PELAJARAN: Kategori = {
	label: "Pelajaran",
	butir: [{ label: "Jam Pelajaran", tujuan: "/jampelajaran" }],
};

// Khusus tingkat admin: mengatur hari aktif/libur dan jadwal mingguan.
// Labelnya sengaja "Jadwal Pelajaran" (bukan "Jam Pelajaran" seperti milik
// guru di atas) supaya tidak tertukar dengan layar ambil-presensi guru,
// walau keduanya bicara soal jadwal.
const KATEGORI_ADMIN: Kategori[] = [
	{
		label: "Pembelajaran",
		butir: [
			{ label: "Hari", tujuan: "/hari" },
			{ label: "Jadwal Pelajaran", tujuan: "/jadwalpelajaran" },
		],
	},
	{
		label: "Kedinasan",
		butir: [{ label: "Tugas Dinas", tujuan: "/tugasdinas" }],
	},
	{
		label: "Rekap",
		butir: [{ label: "Rekap Kehadiran", tujuan: "/rekap" }],
	},
];

export function Sidebar({
	pathname,
	navigasi,
	terbuka,
	onTutup,
	tingkat,
}: {
	pathname: string;
	navigasi: (tujuan: string) => void;
	terbuka: boolean;
	onTutup: () => void;
	tingkat: string;
}) {
	function pergi(tujuan: string) {
		navigasi(tujuan);
		onTutup();
	}

	const kategori =
		tingkat === "admin"
			? KATEGORI_ADMIN
			: [...KATEGORI_GURU, KATEGORI_PELAJARAN];

	return (
		<>
			{terbuka && <div className="sidebar__latar" onClick={onTutup} aria-hidden="true" />}
			<nav className={`sidebar ${terbuka ? "sidebar--terbuka" : ""}`} aria-label="Navigasi utama">
				<button
					type="button"
					className="sidebar__butir"
					aria-current={pathname === "/" ? "page" : undefined}
					onClick={() => pergi("/")}
				>
					Dashboard
				</button>
				{kategori.map((k) => (
					<div className="sidebar__kategori" key={k.label}>
						<span className="sidebar__label">{k.label}</span>
						{k.butir.map((b) => (
							<button
								key={b.tujuan}
								type="button"
								className="sidebar__butir"
								aria-current={pathname === b.tujuan ? "page" : undefined}
								onClick={() => pergi(b.tujuan)}
							>
								{b.label}
							</button>
						))}
					</div>
				))}
			</nav>
		</>
	);
}
