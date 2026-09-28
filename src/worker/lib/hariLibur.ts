export type HariLibur = {
	id: string;
	lembaga_id: string;
	tanggal: string;
	keterangan: string | null;
	dibuat_oleh_nama: string;
};

export function daftarLibur(env: Env, lembagaId: string): Promise<HariLibur[]> {
	return env.DB.prepare(
		"select id, lembaga_id, tanggal, keterangan, dibuat_oleh_nama from hari_libur where lembaga_id = ? order by tanggal",
	)
		.bind(lembagaId)
		.all<HariLibur>()
		.then((r) => r.results);
}

export function liburPadaTanggal(env: Env, lembagaId: string, tanggal: string): Promise<HariLibur | null> {
	return env.DB.prepare("select * from hari_libur where lembaga_id = ? and tanggal = ?")
		.bind(lembagaId, tanggal)
		.first<HariLibur>();
}

export async function tambahLibur(
	env: Env,
	lembagaId: string,
	tanggal: string,
	keterangan: string | null,
	oleh: string,
	olehNama: string,
): Promise<void> {
	await env.DB.prepare(
		`insert into hari_libur (id, lembaga_id, tanggal, keterangan, dibuat_oleh, dibuat_oleh_nama)
		 values (?, ?, ?, ?, ?, ?)
		 on conflict (lembaga_id, tanggal) do update set keterangan = excluded.keterangan`,
	)
		.bind(crypto.randomUUID(), lembagaId, tanggal, keterangan, oleh, olehNama)
		.run();
}

export async function hapusLibur(env: Env, lembagaId: string, tanggal: string): Promise<void> {
	await env.DB.prepare("delete from hari_libur where lembaga_id = ? and tanggal = ?").bind(lembagaId, tanggal).run();
}
