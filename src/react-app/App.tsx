import { useEffect, useState } from "react";
import { FormMasuk } from "./components/FormMasuk";
import { PilihPeran } from "./components/PilihPeran";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { useRute, type Rute } from "./lib/router";
import { GagalApi, keluar, setPeranAktif, saya as ambilSaya, type Saya } from "./lib/api";
import { Dashboard } from "./pages/Dashboard";
import { Hari } from "./pages/Hari";
import { KehadiranGuru } from "./pages/KehadiranGuru";
import { JadwalPelajaran } from "./pages/JadwalPelajaran";
import { JamPelajaran } from "./pages/JamPelajaran";
import { MasukGuru } from "./pages/MasukGuru";
import { MasukSiswa } from "./pages/MasukSiswa";
import { PulangGuru } from "./pages/PulangGuru";
import { PulangSiswa } from "./pages/PulangSiswa";
import { Rekap } from "./pages/Rekap";
import { RekapGuru } from "./pages/RekapGuru";
import { TugasDinas } from "./pages/TugasDinas";

type Keadaan =
	| { tahap: "memuat" }
	| { tahap: "masuk" }
	| { tahap: "pilihPeran"; saya: Saya }
	| { tahap: "aplikasi"; saya: Saya; peranAktif: string | null };

function keadaanSetelahMasuk(saya: Saya): Keadaan {
	// Satu peran saja: tidak ada yang perlu dipilih, langsung ke dashboard.
	if (saya.peran.length <= 1) {
		const kode = saya.peran[0]?.kode ?? null;
		setPeranAktif(kode);
		return { tahap: "aplikasi", saya, peranAktif: kode };
	}
	// Lebih dari satu peran: akses diterima, arahkan ke halaman pilih peran.
	return { tahap: "pilihPeran", saya };
}

// Rute datar di sidebar (Guru/Siswa/Pelajaran) dipetakan ke satu file per
// halaman di src/react-app/pages/ supaya masing-masing gampang dirawat sendiri.
function Halaman({
	rute,
	saya,
	peranAktif,
	tingkat,
	navigasi,
}: {
	rute: Rute;
	saya: Saya;
	peranAktif: string | null;
	tingkat: string;
	navigasi: (tujuan: string) => void;
}) {
	const bukaAbsen = (sesiId: string) => navigasi(`/jampelajaran?sesi=${encodeURIComponent(sesiId)}`);

	const beranda = <Dashboard saya={saya} peranAktif={peranAktif} onBukaAbsen={bukaAbsen} />;

	switch (rute.pathname) {
		// Presensi gerbang hanya untuk guru: admin → jatuh ke Dashboard.
		case "/masukguru":
			if (tingkat !== "guru") return beranda;
			return <MasukGuru />;
		case "/pulangguru":
			if (tingkat !== "guru") return beranda;
			return <PulangGuru />;
		case "/masuksiswa":
			if (tingkat !== "guru") return beranda;
			return <MasukSiswa />;
		case "/pulangsiswa":
			if (tingkat !== "guru") return beranda;
			return <PulangSiswa />;
		// Halaman khusus admin: bukan admin → jatuh ke Dashboard.
		case "/kehadiranguru":
			if (tingkat !== "kepsek") return beranda;
			return <KehadiranGuru />;
		case "/tugasdinas":
			if (tingkat !== "admin") return beranda;
			return <TugasDinas />;
		case "/rekap":
			if (tingkat !== "admin") return beranda;
			return <Rekap />;
		case "/rekapguru":
			if (tingkat !== "admin") return beranda;
			return <RekapGuru />;
		case "/hari":
			if (tingkat !== "admin") return <Dashboard saya={saya} peranAktif={peranAktif} onBukaAbsen={bukaAbsen} />;
			return <Hari />;
		case "/jadwalpelajaran":
			if (tingkat !== "admin") return <Dashboard saya={saya} peranAktif={peranAktif} onBukaAbsen={bukaAbsen} />;
			return <JadwalPelajaran />;
		case "/jampelajaran":
			if (tingkat !== "guru") return beranda;
			return (
				<JamPelajaran
					sesiId={rute.params.get("sesi")}
					onPilihSesi={bukaAbsen}
					onKembali={() => navigasi("/jampelajaran")}
				/>
			);
		default:
			return <Dashboard saya={saya} peranAktif={peranAktif} onBukaAbsen={bukaAbsen} />;
	}
}

function App() {
	const [keadaan, setKeadaan] = useState<Keadaan>({ tahap: "memuat" });
	const [keluarProses, setKeluarProses] = useState(false);
	const [sidebarTerbuka, setSidebarTerbuka] = useState(false);
	const [rute, navigasi] = useRute();

	// Sesi hanya ada di cookie server. Bila cookie sudah hilang (browser
	// ditutup), /saya menjawab 401 dan pengguna kembali ke form login.
	useEffect(() => {
		ambilSaya().then(
			(saya) => setKeadaan(keadaanSetelahMasuk(saya)),
			(g) => {
				if (!(g instanceof GagalApi) || g.status !== 401) console.error(g);
				setKeadaan({ tahap: "masuk" });
			},
		);
	}, []);

	async function klikKeluar() {
		setKeluarProses(true);
		try {
			await keluar();
		} finally {
			// URL ikut direset: tanpa ini, pengguna berikutnya yang masuk mendarat
			// di halaman terakhir pengguna sebelumnya, bukan Dashboard.
			navigasi("/");
			setPeranAktif(null);
			setKeluarProses(false);
			setKeadaan({ tahap: "masuk" });
		}
	}

	if (keadaan.tahap === "memuat") {
		return (
			<main className="halaman halaman--tengah" aria-busy="true">
				<span className="putar putar--besar" aria-label="Memuat" />
			</main>
		);
	}

	if (keadaan.tahap === "masuk") {
		return <FormMasuk onMasuk={(saya) => setKeadaan(keadaanSetelahMasuk(saya))} />;
	}

	if (keadaan.tahap === "pilihPeran") {
		const { saya } = keadaan;
		return (
			<div className="app-shell">
				<Topbar nama={saya.nama} fotoUrl={saya.foto_url} onKeluar={klikKeluar} proses={keluarProses} />
				<main className="app-shell__konten">
					<PilihPeran saya={saya} onPilih={(kode) => setKeadaan({ tahap: "aplikasi", saya, peranAktif: kode })} />
				</main>
			</div>
		);
	}

	const { saya, peranAktif } = keadaan;
	// Tingkat peran yang SEDANG aktif, bukan saya.tingkat (yang dihitung dari
	// gabungan seluruh peran saat login, sebelum satu peran dipilih).
	const tingkatAktif = saya.peran.find((p) => p.kode === peranAktif)?.tingkat ?? saya.tingkat;
	return (
		<div className="app-shell app-shell--sidebar">
			<Topbar
				nama={saya.nama}
				fotoUrl={saya.foto_url}
				onKeluar={klikKeluar}
				proses={keluarProses}
				onBukaSidebar={() => setSidebarTerbuka(true)}
				bisaGantiPeran={saya.peran.length > 1}
				onGantiPeran={() => setKeadaan({ tahap: "pilihPeran", saya })}
			/>
			<div className="app-shell__badan">
				<Sidebar
					pathname={rute.pathname}
					navigasi={navigasi}
					terbuka={sidebarTerbuka}
					onTutup={() => setSidebarTerbuka(false)}
					tingkat={tingkatAktif}
				/>
				<main className="app-shell__konten">
					<Halaman rute={rute} saya={saya} peranAktif={peranAktif} tingkat={tingkatAktif} navigasi={navigasi} />
				</main>
			</div>
		</div>
	);
}

export default App;
