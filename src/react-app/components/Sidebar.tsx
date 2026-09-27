type Butir = { label: string; tujuan: string };
type Kategori = { label: string; butir: Butir[] };

const KATEGORI: Kategori[] = [
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
	{
		label: "Pelajaran",
		butir: [{ label: "Jam Pelajaran", tujuan: "/jampelajaran" }],
	},
];

export function Sidebar({
	pathname,
	navigasi,
	terbuka,
	onTutup,
}: {
	pathname: string;
	navigasi: (tujuan: string) => void;
	terbuka: boolean;
	onTutup: () => void;
}) {
	function pergi(tujuan: string) {
		navigasi(tujuan);
		onTutup();
	}

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
				{KATEGORI.map((k) => (
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
