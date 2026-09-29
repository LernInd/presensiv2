// Cron 23:00 WIB: semua foto presensi guru dihapus dari R2 supaya penyimpanan
// tidak menumpuk. Hanya foto yang hilang — koordinat dan jam di D1 tetap ada.
const AWALAN_FOTO = "guru/";

export type HasilHapusFoto = { objek: number; baris_dibersihkan: number; dryRun: boolean };

export async function hapusFotoGuru(env: Env, opsi: { dryRun?: boolean } = {}): Promise<HasilHapusFoto> {
	const dryRun = opsi.dryRun ?? false;
	let objek = 0;
	let cursor: string | undefined;

	do {
		const halaman = await env.FOTO.list({ prefix: AWALAN_FOTO, cursor, limit: 1000 });
		const kunci = halaman.objects.map((o) => o.key);
		if (kunci.length > 0) {
			if (!dryRun) await env.FOTO.delete(kunci);
			objek += kunci.length;
		}
		cursor = halaman.truncated ? halaman.cursor : undefined;
	} while (cursor);

	let barisDibersihkan = 0;
	if (dryRun) {
		const baris = await env.DB.prepare("select count(*) as n from presensi_gerbang_guru where foto_key is not null").first<{
			n: number;
		}>();
		barisDibersihkan = baris?.n ?? 0;
	} else {
		const hasil = await env.DB.prepare("update presensi_gerbang_guru set foto_key = null where foto_key is not null").run();
		barisDibersihkan = hasil.meta.changes ?? 0;
	}

	return { objek, baris_dibersihkan: barisDibersihkan, dryRun };
}
