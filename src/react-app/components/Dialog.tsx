import { useEffect, useRef, type ReactNode } from "react";

type Props = {
	terbuka: boolean;
	judul: string;
	nada?: "galat" | "peringatan";
	onTutup: () => void;
	children: ReactNode;
};

// Pop-up memakai <dialog> bawaan browser: fokus otomatis terkunci di dalam,
// tombol Esc menutup, dan pembaca layar mengenalinya sebagai dialog modal.
export function Dialog({ terbuka, judul, nada = "galat", onTutup, children }: Props) {
	const ref = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		if (terbuka && !el.open) el.showModal();
		if (!terbuka && el.open) el.close();
	}, [terbuka]);

	return (
		<dialog
			ref={ref}
			className={`dialog dialog--${nada}`}
			aria-labelledby="dialog-judul"
			onClose={onTutup}
			onClick={(e) => e.target === e.currentTarget && onTutup()}
		>
			<div className="dialog__isi">
				<div className="dialog__ikon" aria-hidden="true">
					{nada === "galat" ? "!" : "⏱"}
				</div>
				<h2 id="dialog-judul">{judul}</h2>
				<div className="dialog__pesan">{children}</div>
				<button type="button" className="tombol" onClick={onTutup} autoFocus>
					Mengerti
				</button>
			</div>
		</dialog>
	);
}
