import { useCallback, useEffect, useState } from "react";

export type Rute = { pathname: string; params: URLSearchParams };

function bacaRute(): Rute {
	return { pathname: window.location.pathname, params: new URLSearchParams(window.location.search) };
}

// Router minimal berbasis History API — tanpa dependensi tambahan, cukup
// untuk lima halaman datar di sidebar. Worker (assets `single-page-application`)
// dan Vite dev sudah mengarahkan navigasi apa pun ke index.html, jadi memuat
// ulang langsung di jalur mana pun tetap berfungsi.
export function useRute(): [Rute, (tujuan: string) => void] {
	const [rute, setRute] = useState<Rute>(bacaRute);

	useEffect(() => {
		const dengar = () => setRute(bacaRute());
		window.addEventListener("popstate", dengar);
		return () => window.removeEventListener("popstate", dengar);
	}, []);

	const navigasi = useCallback((tujuan: string) => {
		window.history.pushState(null, "", tujuan);
		setRute(bacaRute());
	}, []);

	return [rute, navigasi];
}
