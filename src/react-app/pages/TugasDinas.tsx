import { FormKetidakhadiran } from "../components/FormKetidakhadiran";

// Ketidakhadiran Guru › Tugas Dinas (admin): guru yang sedang dinas tidak
// diwajibkan absen masuk/pulang pada tanggal-tanggal ini.
export function TugasDinas() {
	return (
		<FormKetidakhadiran
			judul="Tugas Dinas"
			penjelasan="Guru yang sedang tugas dinas tidak diwajibkan absen masuk dan pulang pada tanggal yang ditentukan."
			jenisPilihan={["dinas"]}
			placeholderKeterangan="Mis. Workshop kurikulum di dinas pendidikan"
		/>
	);
}
