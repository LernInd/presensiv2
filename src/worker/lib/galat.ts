import type { ContentfulStatusCode } from "hono/utils/http-status";

// Galat yang pesannya aman ditampilkan ke pengguna. Selain kelas ini, semua
// galat dijawab 500 generik supaya detail server tidak bocor.
export class GagalTerkendali extends Error {
	constructor(
		readonly status: ContentfulStatusCode,
		pesan: string,
	) {
		super(pesan);
	}
}

export class GagalAuth extends GagalTerkendali {}
export class GagalRute extends GagalTerkendali {}
export class GagalSupabase extends GagalTerkendali {}
