import { useEffect, useState } from "react";
import { Beranda } from "./components/Beranda";
import { FormMasuk } from "./components/FormMasuk";
import { PilihPeran } from "./components/PilihPeran";
import { Topbar } from "./components/Topbar";
import { GagalApi, keluar, setPeranAktif, saya as ambilSaya, type Saya } from "./lib/api";

type Keadaan =
	| { tahap: "memuat" }
	| { tahap: "masuk" }
	| { tahap: "pilihPeran"; saya: Saya }
	| { tahap: "beranda"; saya: Saya; peranAktif: string | null };

function keadaanSetelahMasuk(saya: Saya): Keadaan {
	// Satu peran saja: tidak ada yang perlu dipilih, langsung ke beranda.
	if (saya.peran.length <= 1) {
		const kode = saya.peran[0]?.kode ?? null;
		setPeranAktif(kode);
		return { tahap: "beranda", saya, peranAktif: kode };
	}
	// Lebih dari satu peran: akses diterima, arahkan ke halaman pilih peran.
	return { tahap: "pilihPeran", saya };
}

function App() {
	const [keadaan, setKeadaan] = useState<Keadaan>({ tahap: "memuat" });
	const [keluarProses, setKeluarProses] = useState(false);

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

	// pilihPeran & beranda berbagi chrome aplikasi (topbar dengan identitas
	// pengguna dan aksi keluar) — hanya konten di bawahnya yang berbeda.
	const { saya } = keadaan;
	return (
		<div className="app-shell">
			<Topbar nama={saya.nama} fotoUrl={saya.foto_url} onKeluar={klikKeluar} proses={keluarProses} />
			<main className="app-shell__konten">
				{keadaan.tahap === "pilihPeran" ? (
					<PilihPeran saya={saya} onPilih={(kode) => setKeadaan({ tahap: "beranda", saya, peranAktif: kode })} />
				) : (
					<Beranda
						saya={saya}
						peranAktif={keadaan.peranAktif}
						onGantiPeran={() => setKeadaan({ tahap: "pilihPeran", saya })}
					/>
				)}
			</main>
		</div>
	);
}

export default App;
