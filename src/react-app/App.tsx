import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { api, type Saya } from "./lib/api";
import { getSupabase, keluar, masuk } from "./lib/supabase";
import "./App.css";

function App() {
	const [siap, setSiap] = useState(false);
	const [sesi, setSesi] = useState<Session | null>(null);
	const [galatAwal, setGalatAwal] = useState<string | null>(null);

	useEffect(() => {
		let batal: (() => void) | undefined;
		getSupabase()
			.then(async (supabase) => {
				const { data } = await supabase.auth.getSession();
				setSesi(data.session);
				const { data: langganan } = supabase.auth.onAuthStateChange((_e, s) => setSesi(s));
				batal = () => langganan.subscription.unsubscribe();
			})
			.catch((g: Error) => setGalatAwal(g.message))
			.finally(() => setSiap(true));
		return () => batal?.();
	}, []);

	if (!siap) return <p>Memuat…</p>;
	if (galatAwal) return <p className="galat">{galatAwal}</p>;
	return sesi ? <Beranda /> : <FormMasuk />;
}

function FormMasuk() {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [galat, setGalat] = useState<string | null>(null);
	const [proses, setProses] = useState(false);

	async function kirim(e: FormEvent) {
		e.preventDefault();
		setProses(true);
		setGalat(null);
		try {
			await masuk(username, password);
		} catch (g) {
			setGalat((g as Error).message);
		} finally {
			setProses(false);
		}
	}

	return (
		<form className="kartu" onSubmit={kirim}>
			<h1>Presensi</h1>
			<label>
				Username
				<input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
			</label>
			<label>
				Kata sandi
				<input
					type="password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					autoComplete="current-password"
					required
				/>
			</label>
			{galat && <p className="galat">{galat}</p>}
			<button type="submit" disabled={proses}>
				{proses ? "Memproses…" : "Masuk"}
			</button>
		</form>
	);
}

function Beranda() {
	const [saya, setSaya] = useState<Saya | null>(null);
	const [galat, setGalat] = useState<string | null>(null);

	useEffect(() => {
		api<Saya>("/saya").then(setSaya, (g: Error) => setGalat(g.message));
	}, []);

	return (
		<div className="kartu">
			{galat && <p className="galat">{galat}</p>}
			{!saya && !galat && <p>Memuat profil…</p>}
			{saya && (
				<>
					<h1>Assalamu'alaikum, {saya.nama}</h1>
					<p>
						@{saya.username} · tingkat <strong>{saya.tingkat}</strong>
					</p>
					<h2>Lembaga</h2>
					<ul>
						{saya.lembaga.map((l) => (
							<li key={l.id}>
								{l.nama} — {l.tingkat}
							</li>
						))}
					</ul>
				</>
			)}
			<button onClick={() => keluar()}>Keluar</button>
		</div>
	);
}

export default App;
