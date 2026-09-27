// Tanggal dan hari dihitung dari zona setempat, bukan UTC milik Worker/D1 —
// memindai pukul 06:00 WIB tidak boleh tercatat di tanggal sebelumnya.
export function tanggalLokal(waktu: Date, zona: string): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: zona,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(waktu);
}

export function jamLokal(waktu: Date, zona: string): string {
	return new Intl.DateTimeFormat("en-GB", {
		timeZone: zona,
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(waktu);
}

const HARI_INDEKS: Record<string, number> = {
	Monday: 1,
	Tuesday: 2,
	Wednesday: 3,
	Thursday: 4,
	Friday: 5,
	Saturday: 6,
	Sunday: 7,
};

// 1 = Senin … 7 = Minggu, sesuai kolom jadwal_pelajaran.hari.
export function hariLokal(waktu: Date, zona: string): number {
	const nama = new Intl.DateTimeFormat("en-US", { timeZone: zona, weekday: "long" }).format(waktu);
	return HARI_INDEKS[nama] ?? 1;
}
