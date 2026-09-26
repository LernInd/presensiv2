import { useEffect, useState, type FormEvent } from "react";
import { GagalApi, masuk, type Saya } from "../lib/api";
import {
	SANDI_MAKS,
	USERNAME_MAKS,
	normalkanUsername,
	periksaSandi,
	periksaUsername,
	type GalatKolom,
} from "../lib/validasi";
import { Dialog } from "./Dialog";

// Jeda minimum antar percobaan di sisi pengguna. Server menegakkan batasnya
// sendiri; ini hanya mencegah klik beruntun sebelum sampai ke jaringan.
const JEDA_ANTAR_PERCOBAAN_MS = 2000;

type Popup = { judul: string; pesan: string; nada: "galat" | "peringatan" } | null;

export function FormMasuk({ onMasuk }: { onMasuk: (saya: Saya) => void }) {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [lihatSandi, setLihatSandi] = useState(false);
	const [galat, setGalat] = useState<GalatKolom>({});
	const [disentuh, setDisentuh] = useState<{ username?: boolean; password?: boolean }>({});
	const [proses, setProses] = useState(false);
	const [kunciSampai, setKunciSampai] = useState(0);
	const [sekarang, setSekarang] = useState(() => Date.now());
	const [popup, setPopup] = useState<Popup>(null);

	const sisaDetik = Math.max(0, Math.ceil((kunciSampai - sekarang) / 1000));
	const terkunci = proses || sisaDetik > 0;

	// Hitung mundur hanya berjalan selama tombol terkunci.
	useEffect(() => {
		if (kunciSampai <= Date.now()) return;
		const id = setInterval(() => {
			const t = Date.now();
			setSekarang(t);
			if (t >= kunciSampai) clearInterval(id);
		}, 250);
		return () => clearInterval(id);
	}, [kunciSampai]);

	function validasi(u = username, p = password): GalatKolom {
		return { username: periksaUsername(u), password: periksaSandi(p) };
	}

	async function kirim(e: FormEvent) {
		e.preventDefault();
		if (terkunci) return;

		const hasil = validasi();
		setGalat(hasil);
		setDisentuh({ username: true, password: true });
		if (hasil.username || hasil.password) return;

		setProses(true);
		const mulai = Date.now();
		setSekarang(mulai);
		setKunciSampai(mulai + JEDA_ANTAR_PERCOBAAN_MS);
		try {
			onMasuk(await masuk(normalkanUsername(username), password));
		} catch (g) {
			const gagal = g instanceof GagalApi ? g : new GagalApi(0, "Terjadi kesalahan");
			setPassword("");
			if (gagal.status === 429) {
				const detik = gagal.tunggu ?? 10;
				setKunciSampai(Date.now() + detik * 1000);
				setPopup({
					judul: "Terlalu banyak percobaan",
					pesan: `Demi keamanan, silakan tunggu ${detik} detik sebelum mencoba lagi.`,
					nada: "peringatan",
				});
			} else if (gagal.status === 400 && gagal.kolom) {
				setGalat(gagal.kolom);
			} else if (gagal.status === 401) {
				setPopup({
					judul: "Gagal masuk",
					pesan: "Username atau kata sandi salah. Periksa kembali lalu coba lagi.",
					nada: "galat",
				});
			} else {
				setPopup({ judul: "Tidak dapat masuk", pesan: gagal.message, nada: "galat" });
			}
		} finally {
			setProses(false);
			setSekarang(Date.now());
		}
	}

	const tampilGalat = (k: keyof GalatKolom) => (disentuh[k] ? galat[k] : undefined);

	return (
		<main className="halaman halaman--tengah">
			<form className="kartu" onSubmit={kirim} noValidate>
				<header className="kepala">
					<img src="/icon.svg" alt="" width={44} height={44} />
					<h1>Presensi</h1>
					<p className="redup">Masuk dengan akun guru atau admin presensi</p>
				</header>

				<div className="kolom">
					<label htmlFor="username">Username</label>
					<input
						id="username"
						name="username"
						value={username}
						onChange={(e) => {
							const v = e.target.value.slice(0, USERNAME_MAKS);
							setUsername(v);
							if (disentuh.username) setGalat((g) => ({ ...g, username: periksaUsername(v) }));
						}}
						onBlur={() => {
							setDisentuh((d) => ({ ...d, username: true }));
							setGalat((g) => ({ ...g, username: periksaUsername(username) }));
						}}
						maxLength={USERNAME_MAKS}
						autoComplete="username"
						autoCapitalize="none"
						autoCorrect="off"
						spellCheck={false}
						inputMode="text"
						enterKeyHint="next"
						aria-invalid={!!tampilGalat("username")}
						aria-describedby={tampilGalat("username") ? "galat-username" : undefined}
						disabled={proses}
						required
					/>
					{tampilGalat("username") && (
						<p id="galat-username" className="galat-kolom" role="alert">
							{tampilGalat("username")}
						</p>
					)}
				</div>

				<div className="kolom">
					<label htmlFor="password">Kata sandi</label>
					<div className="sandi">
						<input
							id="password"
							name="password"
							type={lihatSandi ? "text" : "password"}
							value={password}
							onChange={(e) => {
								const v = e.target.value.slice(0, SANDI_MAKS);
								setPassword(v);
								if (disentuh.password) setGalat((g) => ({ ...g, password: periksaSandi(v) }));
							}}
							onBlur={() => {
								setDisentuh((d) => ({ ...d, password: true }));
								setGalat((g) => ({ ...g, password: periksaSandi(password) }));
							}}
							maxLength={SANDI_MAKS}
							autoComplete="current-password"
							enterKeyHint="go"
							aria-invalid={!!tampilGalat("password")}
							aria-describedby={tampilGalat("password") ? "galat-password" : undefined}
							disabled={proses}
							required
						/>
						<button
							type="button"
							className="sandi__lihat"
							onClick={() => setLihatSandi((v) => !v)}
							aria-label={lihatSandi ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
							aria-pressed={lihatSandi}
						>
							{lihatSandi ? "Sembunyikan" : "Tampilkan"}
						</button>
					</div>
					{tampilGalat("password") && (
						<p id="galat-password" className="galat-kolom" role="alert">
							{tampilGalat("password")}
						</p>
					)}
				</div>

				<button type="submit" className="tombol" disabled={terkunci} aria-busy={proses}>
					{proses ? (
						<>
							<span className="putar" aria-hidden="true" /> Memeriksa…
						</>
					) : sisaDetik > 0 ? (
						`Tunggu ${sisaDetik} detik`
					) : (
						"Masuk"
					)}
				</button>
			</form>

			<Dialog
				terbuka={popup !== null}
				judul={popup?.judul ?? ""}
				nada={popup?.nada}
				onTutup={() => {
					setPopup(null);
					document.getElementById("password")?.focus();
				}}
			>
				<p>{popup?.pesan}</p>
			</Dialog>
		</main>
	);
}
