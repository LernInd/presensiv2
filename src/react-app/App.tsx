import { useEffect, useState } from "react";
import { Beranda } from "./components/Beranda";
import { FormMasuk } from "./components/FormMasuk";
import { GagalApi, saya as ambilSaya, type Saya } from "./lib/api";

type Keadaan = { tahap: "memuat" } | { tahap: "masuk" } | { tahap: "beranda"; saya: Saya };

function App() {
	const [keadaan, setKeadaan] = useState<Keadaan>({ tahap: "memuat" });

	// Sesi hanya ada di cookie server. Bila cookie sudah hilang (browser
	// ditutup), /saya menjawab 401 dan pengguna kembali ke form login.
	useEffect(() => {
		ambilSaya().then(
			(saya) => setKeadaan({ tahap: "beranda", saya }),
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
		return <FormMasuk onMasuk={(saya) => setKeadaan({ tahap: "beranda", saya })} />;
	}
	return <Beranda saya={keadaan.saya} onKeluar={() => setKeadaan({ tahap: "masuk" })} />;
}

export default App;
