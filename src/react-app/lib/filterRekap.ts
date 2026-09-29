import { tanggalWib } from "./api";

export type NilaiFilter = { dari: string; sampai: string; kelasId: string };

// Bawaan: hari ini (WIB) saja, semua kelas.
export const filterAwal = (): NilaiFilter => ({ dari: tanggalWib(), sampai: tanggalWib(), kelasId: "" });
