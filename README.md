# Cyber Trash Sorter

Game arcade cyberpunk: sampah jatuh dari atas, kamu gerakkan hover-cart supaya tiap barang
masuk ke bin **Organik / Anorganik / B3** yang benar. Skor dari sampah yang benar jadi poin,
dan poin bisa ditukar dengan background permainan.

- **Frontend**: HTML + CSS + JavaScript vanilla, rendering pakai Canvas 2D (tanpa library game)
- **Backend**: Node.js + Express + SQLite (`better-sqlite3`) untuk sign-in, penyimpanan poin, dan toko
- **Tema**: neon cyberpunk — 6 background yang bisa dibuka

---

## Cara menjalankan (VSCode)

Pastikan Node.js versi 20 atau lebih baru sudah terpasang (`node -v`).

```bash
cd cyber-trash
npm install
npm start
```

Buka **http://localhost:3000**.

Mau otomatis restart saat kamu mengubah `server.js` / `lib/`?

```bash
npm run dev
```

Untuk menghentikan server: tekan `Ctrl + C` di terminal.

> Folder `data/` berisi database SQLite dan akan dibuat otomatis saat pertama kali jalan.
> Hapus folder itu kalau mau mulai dari nol (semua akun & poin terhapus).

### Catatan instalasi

`better-sqlite3` adalah modul native. `npm install` akan mengunduh binary jadi untuk
Windows / macOS / Linux x64, jadi biasanya tidak perlu langkah tambahan. Kalau prosesnya
gagal dan meminta `node-gyp`, pasang build tool lebih dulu — di Windows berarti
"Visual Studio Build Tools" dengan workload *Desktop development with C++*.

---

## Alur permainan

1. **Sign in dulu.** Belum punya akun? Klik tab **Daftar** di halaman depan.
   Username 3–20 karakter (huruf kecil, angka, underscore), password minimal 6 karakter.
2. Klik **Mulai Bermain**. Cart bergerak mengikuti mouse/sentuhan, atau pakai `←` `→` / `A` `D`.
3. Arahkan bin yang benar ke bawah sampah yang jatuh.
4. Tekan `P` atau `Esc` untuk jeda. Shield habis = sesi selesai.
5. Skor sesi otomatis dikirim ke server dan menjadi **poin** di saldomu.
6. Buka **Toko** untuk membeli lalu **Pasang** background baru.

### Sistem poin

| Peristiwa | Efek |
| --- | --- |
| Sampah masuk bin yang benar | `+ (10 + level × 2) × kombo × bonus item` |
| Kombo | Naik tiap sampah benar beruntun: ×1 → ×5 (reset kalau salah atau lolos) |
| Item khusus (🔋 baterai, ⚗️ sisa kimia) | Bonus 2–3× poin |
| Salah bin | −1 shield (mulai dari 4), kombo reset |
| Sampah jatuh ke tanah | Tidak mengurangi shield, tapi kombo reset dan akurasi turun |
| Naik level | Tiap 12 sampah benar: kecepatan jatuh & jumlah sampah serentak bertambah |

Lima background terkunci: Acid Rain (350), Chrome Skyline (800), Circuit Void (1500),
Hyper Tunnel (2600), Solar Grid (4200).

---

## Struktur proyek

```
cyber-trash/
├─ server.js              # Express: routing API + static file
├─ lib/
│  ├─ db.js               # koneksi SQLite + skema tabel
│  ├─ auth.js             # hash password (scrypt), sesi cookie, validasi
│  ├─ gameStore.js        # tiket sesi main, transfer poin, leaderboard
│  └─ backgrounds.js      # daftar & harga background (sumber kebenaran tunggal)
├─ data/                  # game.db dibuat otomatis
└─ public/
   ├─ index.html          # halaman sign in / daftar
   ├─ play.html           # arena + HUD + toko
   ├─ css/base.css        # tema cyberpunk yang dipakai bersama
   ├─ css/game.css        # layout arena, HUD, toko
   └─ js/
      ├─ data.js          # 26 jenis sampah + 3 kategori
      ├─ game.js          # mesin game (fisika, tabrakan, skor, gambar)
      ├─ backgrounds.js   # painter 6 gaya latar (grid, rain, skyline, circuit, tunnel, solar)
      ├─ play-page.js     # penyatu UI: input, HUD, toko, kirim skor
      ├─ auth-page.js     # logika form sign in
      └─ net.js           # helper fetch ke API
```

## API

| Method | Path | Fungsi |
| --- | --- | --- |
| `POST` | `/api/auth/signup` | buat akun + mulai sesi |
| `POST` | `/api/auth/login` | masuk |
| `POST` | `/api/auth/logout` | keluar |
| `GET` | `/api/me` | profil, saldo poin, background milikmu |
| `GET` | `/api/backgrounds` | daftar semua background |
| `POST` | `/api/backgrounds/buy` | tukar poin dengan background |
| `POST` | `/api/backgrounds/select` | pasang background |
| `POST` | `/api/game/start` | mulai tiket sesi main |
| `POST` | `/api/game/finish` | kirim hasil sesi, poin ditransfer |
| `GET` | `/api/leaderboard` | 10 skor terbaik |

Poin divalidasi di server, bukan di browser: setiap sesi main butuh tiket dari
`/api/game/start` dan hanya bisa dipakai sekali, dengan batas wajar poin per detik.

---

## Sesuaikan sendiri

**Tambah jenis sampah** — edit `public/js/data.js`, array `TRASH`:

```js
{ glyph: '🍄', name: 'Jamur Busuk', category: 'organik' },
```

`category` harus salah satu `organik` | `anorganik` | `b3`. Tambahkan `bonus: 2` untuk item bernilai ganda.

**Tambah background** — edit `lib/backgrounds.js` (tambah satu objek, harga dalam poin), lalu
tambahkan gayanya di fungsi `draw()` pada `public/js/backgrounds.js` kalau mau visual baru.
Background baru langsung muncul di toko tanpa mengubah file lain.

**Ubah tingkat kesulitan** — konstanta di bagian atas `public/js/game.js`:

```js
const BIN_W = 118;            // lebar satu bin
const POINTS_PER_CATCH = 10;  // poin dasar
```

dan di dalam `update()`: `speed` (kecepatan cart), `interval` (jarak antar sampah),
`vy` pada `spawn()` (kecepatan jatuh).

**Ubah harga** — kolom `cost` pada tiap background di `lib/backgrounds.js`.

---

## Catatan

- Password disimpan sebagai hash scrypt + salt, bukan teks asli. Cookie sesi `HttpOnly`
  dan token-nya di-hash sebelum masuk database.
- Game ini dirancang untuk Chrome / Edge / Firefox terbaru, desktop maupun HP.
- Font Orbitron & Rajdhani diambil dari Google Fonts; kalau offline, tampilan otomatis
  memakai font sistem dan game tetap berjalan normal.
- Repo ini berisi kode saja. Untuk menjalankannya secara online dibutuhkan proses Node,
  jadi GitHub Pages tidak cukup — pakai host seperti Render, Railway, atau Fly.io.
  `server.js` sudah membaca `process.env.PORT`, jadi tidak perlu diubah untuk deploy.

---

## Lisensi

Distribusi di bawah lisensi MIT — lihat [LICENSE](LICENSE).
