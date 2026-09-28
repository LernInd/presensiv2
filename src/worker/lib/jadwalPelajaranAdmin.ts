import { GagalRute } from "./galat";
import type { BadanJadwal } from "./validasiPembelajaran";

export type BarisJadwalAdmin = {
	id: string;
	lembaga_id: string;
	kelas_id: string;
	kelas_nama: string;
	hari: number;
	jam_ke: number;
	mapel: string;
	mulai: string;
	selesai: string;
	guru_id: string | null;
	guru_nama: string | null;
};

const MAKS_JAM_PER_HARI = 20;

function tumpangTindih(aMulai: string, aSelesai: string, bMulai: string, bSelesai: string): boolean {
	// Bersentuhan tepat (satu selesai 09:00, berikutnya mulai 09:00) BUKAN
	// tumpang tindih — itu jadwal rapat sebagaimana mestinya.
	return aMulai < bSelesai && bMulai < aSelesai;
}

export function daftarJadwal(env: Env, lembagaId: string, kelasId: string, hari: number): Promise<BarisJadwalAdmin[]> {
	return env.DB.prepare(
		"select * from jadwal_pelajaran where lembaga_id = ? and kelas_id = ? and hari = ? order by mulai",
	)
		.bind(lembagaId, kelasId, hari)
		.all<BarisJadwalAdmin>()
		.then((r) => r.results);
}

type BarisTanpaJamKe = {
	id: string;
	kelas_nama: string;
	mapel: string;
	mulai: string;
	selesai: string;
	guru_id: string | null;
	guru_nama: string | null;
};

// jam_ke tidak pernah diketik siapa pun — selalu diturunkan dari urutan
// `mulai`. Menulis seluruh isi akhir satu grup (lembaga_id, kelas_id, hari)
// sekaligus dalam satu batch hapus-lalu-sisip, bukan UPDATE di tempat:
// menukar/menyisipkan nomor secara langsung bisa menabrak UNIQUE
// (lembaga_id, kelas_id, hari, jam_ke) atau CHECK (jam_ke between 1 and 20)
// di tengah proses, karena nilai baru sempat bentrok dengan baris lain yang
// belum sempat diperbarui. Hapus-lalu-sisip mengosongkan grup lebih dulu
// sehingga tidak ada susunan angka yang bisa bertabrakan.
async function tulisGrup(
	env: Env,
	lembagaId: string,
	kelasId: string,
	hari: number,
	isiAkhir: BarisTanpaJamKe[],
): Promise<void> {
	if (isiAkhir.length > MAKS_JAM_PER_HARI) {
		throw new GagalRute(400, `Maksimal ${MAKS_JAM_PER_HARI} jam pelajaran per hari untuk satu kelas`);
	}
	const lama = await daftarJadwal(env, lembagaId, kelasId, hari);
	const terurut = [...isiAkhir].sort((a, b) => a.mulai.localeCompare(b.mulai));
	await env.DB.batch([
		...lama.map((b) => env.DB.prepare("delete from jadwal_pelajaran where id = ?").bind(b.id)),
		...terurut.map((b, i) =>
			env.DB.prepare(
				`insert into jadwal_pelajaran
				   (id, lembaga_id, kelas_id, kelas_nama, hari, jam_ke, mapel, mulai, selesai, guru_id, guru_nama)
				 values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			).bind(b.id, lembagaId, kelasId, b.kelas_nama, hari, i + 1, b.mapel, b.mulai, b.selesai, b.guru_id, b.guru_nama),
		),
	]);
}

async function periksaBentrok(
	env: Env,
	lembagaId: string,
	badan: BadanJadwal,
	abaikanId?: string,
): Promise<void> {
	const lain = await daftarJadwal(env, lembagaId, badan.kelasId, badan.hari);
	const bentrok = lain.find(
		(b) => b.id !== abaikanId && tumpangTindih(badan.mulai, badan.selesai, b.mulai, b.selesai),
	);
	if (bentrok) {
		throw new GagalRute(
			409,
			`Bentrok dengan "${bentrok.mapel}" (${bentrok.mulai}–${bentrok.selesai}) di kelas dan hari yang sama`,
		);
	}
}

export async function tambahJadwal(
	env: Env,
	lembagaId: string,
	kelasNama: string,
	badan: BadanJadwal,
	guruNama: string | null,
): Promise<BarisJadwalAdmin> {
	await periksaBentrok(env, lembagaId, badan);
	const id = crypto.randomUUID();
	const grup = await daftarJadwal(env, lembagaId, badan.kelasId, badan.hari);
	const baru: BarisTanpaJamKe = {
		id,
		kelas_nama: kelasNama,
		mapel: badan.mapel,
		mulai: badan.mulai,
		selesai: badan.selesai,
		guru_id: badan.guruId,
		guru_nama: guruNama,
	};
	await tulisGrup(env, lembagaId, badan.kelasId, badan.hari, [...grup, baru]);
	const baris = await env.DB.prepare("select * from jadwal_pelajaran where id = ?").bind(id).first<BarisJadwalAdmin>();
	return baris!;
}

export async function ambilBarisJadwal(env: Env, lembagaId: string, id: string): Promise<BarisJadwalAdmin> {
	const baris = await env.DB.prepare("select * from jadwal_pelajaran where id = ? and lembaga_id = ?")
		.bind(id, lembagaId)
		.first<BarisJadwalAdmin>();
	if (!baris) throw new GagalRute(404, "Jadwal tidak ditemukan");
	return baris;
}

export async function ubahJadwal(
	env: Env,
	lembagaId: string,
	id: string,
	kelasNama: string,
	badan: BadanJadwal,
	guruNama: string | null,
): Promise<BarisJadwalAdmin> {
	const lama = await ambilBarisJadwal(env, lembagaId, id);
	await periksaBentrok(env, lembagaId, badan, id);
	const diperbarui: BarisTanpaJamKe = {
		id,
		kelas_nama: kelasNama,
		mapel: badan.mapel,
		mulai: badan.mulai,
		selesai: badan.selesai,
		guru_id: badan.guruId,
		guru_nama: guruNama,
	};

	if (lama.kelas_id === badan.kelasId && lama.hari === badan.hari) {
		const grup = await daftarJadwal(env, lembagaId, badan.kelasId, badan.hari);
		const isiAkhir = grup.map((b) => (b.id === id ? diperbarui : b));
		await tulisGrup(env, lembagaId, badan.kelasId, badan.hari, isiAkhir);
	} else {
		// Kelas/hari berpindah: kosongkan baris ini dari grup lama, lalu
		// tulis ulang grup baru dengan baris ini disisipkan — dua batch
		// terpisah supaya id tidak pernah dobel-hitung di kedua grup sekaligus.
		const grupLama = await daftarJadwal(env, lembagaId, lama.kelas_id, lama.hari);
		await tulisGrup(env, lembagaId, lama.kelas_id, lama.hari, grupLama.filter((b) => b.id !== id));

		const grupBaru = await daftarJadwal(env, lembagaId, badan.kelasId, badan.hari);
		await tulisGrup(env, lembagaId, badan.kelasId, badan.hari, [...grupBaru, diperbarui]);
	}

	return ambilBarisJadwal(env, lembagaId, id);
}

export async function hapusJadwal(env: Env, lembagaId: string, id: string): Promise<void> {
	const lama = await ambilBarisJadwal(env, lembagaId, id);
	const grup = await daftarJadwal(env, lembagaId, lama.kelas_id, lama.hari);
	await tulisGrup(env, lembagaId, lama.kelas_id, lama.hari, grup.filter((b) => b.id !== id));
}
