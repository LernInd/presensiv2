import { FormKetidakhadiran } from "../components/FormKetidakhadiran";

// Ketidakhadiran Guru › Sakit & Kepentingan (admin): guru sakit atau ada
// kepentingan (keluarga, urusan pribadi, dll.) — logikanya sama dengan tugas
// dinas (tidak wajib absen, menimpa scan).
export function SakitKepentingan() {
	return (
		<FormKetidakhadiran
			judul="Sakit & Kepentingan"
			penjelasan="Untuk guru yang sakit atau ada kepentingan (keluarga, urusan pribadi, dll.). Selama tanggal tersebut guru tidak diwajibkan absen masuk dan pulang."
			jenisPilihan={["sakit", "keluarga"]}
			placeholderKeterangan="Mis. Rawat inap / mengurus keperluan keluarga"
		/>
	);
}
