// Inisial dari nama, dipakai sebagai avatar fallback di Topbar dan halaman.
export function inisial(nama: string): string {
	return nama
		.split(/\s+/)
		.slice(0, 2)
		.map((k) => k[0]?.toUpperCase() ?? "")
		.join("");
}
