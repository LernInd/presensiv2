import { useEffect, useState } from "react";
import { Beranda } from "./components/Beranda";
import { FormMasuk } from "./components/FormMasuk";
import { PilihPeran } from "./components/PilihPeran";
import { GagalApi, setPeranAktif, saya as ambilSaya, type Saya } from "./lib/api";

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
		return <PilihPeran saya={saya} onPilih={(kode) => setKeadaan({ tahap: "beranda", saya, peranAktif: kode })} />;
	}

	const { saya, peranAktif } = keadaan;
	return (
		<Beranda
			saya={saya}
			peranAktif={peranAktif}
			onGantiPeran={() => setKeadaan({ tahap: "pilihPeran", saya })}
			onKeluar={() => {
				setPeranAktif(null);
				setKeadaan({ tahap: "masuk" });
			}}
		/>
	);
}

export default App;
