# Spesifikasi: Cloudflare Worker untuk backend APP Calendar

**Status:** menunggu tinjauan pengguna  
**Tanggal:** 6 Oktober 2026

## Tujuan

Pindahkan backend Google Calendar dari Firebase Functions ke Cloudflare Workers
agar aplikasi tidak memerlukan deployment Functions pada paket Blaze. Firebase
Authentication dan Firestore tetap dipakai untuk identitas dan data kalender.
Perubahan kalender dan alokasi tugas tetap mengikuti alur tinjau, setujui, dan
bisa dibatalkan.

## Batas implementasi

### Termasuk

- Cloudflare Worker menggantikan callable Firebase Functions.
- Worker memverifikasi Firebase ID token sebelum menerima permintaan pengguna.
- Pertukaran kode Google OAuth, refresh token, dan panggilan Google Calendar API
  dilakukan di Worker menggunakan HTTPS `fetch`.
- Refresh token disimpan di Cloudflare D1 dalam bentuk terenkripsi AES-GCM.
  Kunci enkripsi disimpan sebagai Worker secret.
- Firebase Auth dan Firestore tetap menjadi penyimpanan data aplikasi.
- Worker mengembalikan data acara Google yang sudah dinormalisasi; aplikasi
  menulis acara ke Firestore melalui SDK Firebase milik pengguna.
- Aturan Firestore membatasi data ke UID pengguna yang login dan memvalidasi
  bentuk jadwal/tugas yang ditulis aplikasi.
- Mesin penjadwal berjalan sebagai logika aplikasi. Aplikasi menampilkan usulan;
  pengguna menyetujui sebelum menyimpan, dengan pembatalan alokasi yang baru
  saja diterapkan.
- Worker menyediakan operasi koneksi, sinkronisasi, pengiriman/ubah acara
  manual ke Google setelah persetujuan pengguna, dan pemutusan koneksi.
- Pengguna dapat melihat daftar kalender Google dan memilih kalender yang
  disinkronkan. Pilihan disimpan per pengguna; sinkronisasi mencakup kalender
  terpilih, bukan hanya `primary`.
- Jadwal manual satu kali maupun berulang tetap didukung. Identitas occurrence
  dan pengecualian acara berulang Google dipertahankan untuk penjadwal.
- Operasi yang dicoba ulang setelah jaringan putus memakai kunci idempotensi
  agar tidak membuat acara Google ganda; kontrak API mendukung antrean offline
  aplikasi pada tahap UI.
- Dokumentasi setup Wrangler, D1 migration, Worker secrets, konfigurasi Firebase
  native, uji lokal, dan deployment.

### Tidak termasuk pada milestone pertama

- Mengganti Firebase Authentication atau memindahkan koleksi jadwal/tugas dari
  Firestore ke D1.
- Deployment otomatis ke akun Cloudflare/Firebase pengguna.
- Notifikasi push atau sinkronisasi latar belakang real-time.

## Arsitektur dan batas kepercayaan

1. Aplikasi mendapatkan Firebase ID token dari Firebase Auth dan mengirimkannya
   sebagai `Authorization: Bearer <idToken>` ke Worker.
2. Worker memverifikasi tanda tangan, issuer, audience, dan masa berlaku token.
   UID hanya diambil dari token yang sudah lolos verifikasi; UID dari body request
   tidak dipercaya.
3. Saat menghubungkan Google, aplikasi mengirim `serverAuthCode`. Worker menukar
   kode melalui endpoint OAuth Google, memeriksa identitas Google terhadap akun
   Google yang terhubung dengan Firebase, lalu mengenkripsi refresh token sebelum
   menyimpannya di D1.
4. Saat sinkronisasi, Worker membaca refresh token dari D1, memperbarui access
   token, mengambil acara dari Google, dan mengembalikan data normalisasi ke
   aplikasi. Aplikasi menulis hasil ke
   `users/{uid}/schedules/{scheduleId}` dengan ID dokumen deterministik.
5. Untuk acara buatan aplikasi yang akan dikirim ke Google, aplikasi harus
   mengirim tindakan yang sudah disetujui pengguna. Worker membuat atau mengubah
   acara lalu mengembalikan ID Google; aplikasi menyimpan hubungan kedua ID itu.
6. Aplikasi mengakses Firestore langsung dengan Firebase Auth. Worker tidak
   memakai Firebase Admin atau service-account key, sehingga tidak ada secret
   Firestore admin yang perlu dipasang ke Cloudflare.

Worker menggunakan API web standar (`fetch`, Web Crypto), bukan `googleapis`,
agar tidak bergantung pada API Node.js yang tidak seluruhnya tersedia di Workers.
Cloudflare menyediakan batas gratis untuk Workers dan D1; penggunaan di luar
kuota dapat gagal atau memerlukan paket berbayar, sehingga penggunaan perlu
dipantau.

## API Worker yang diusulkan

- `POST /v1/google/connect` — input berisi `serverAuthCode`; output status koneksi.
- `GET /v1/google/calendars` — mengembalikan daftar kalender yang dapat diakses
  pengguna untuk dipilih di aplikasi.
- `PUT /v1/google/calendars/selection` — menyimpan daftar kalender terpilih.
- `POST /v1/google/sync` — input berisi kalender dan rentang sinkronisasi; output
  daftar acara yang dinormalisasi, token sinkronisasi baru bila digunakan, serta
  ringkasan perubahan.
- `POST /v1/google/events/upsert` — input berisi ID jadwal aplikasi dan isi acara
  yang telah disetujui; output ID Google dan ETag.
- `POST /v1/google/events/cancel` — membatalkan acara terkait setelah tindakan
  pengguna disetujui.
- `POST /v1/google/disconnect` — mencabut atau menghapus kredensial tersimpan.

Semua rute selain pemeriksaan kesehatan memerlukan Firebase ID token. Body
dibatasi ukurannya; parameter, tanggal, zona waktu, kalender, dan kepemilikan
jadwal divalidasi sebelum memanggil Google API. CORS dibatasi ke origin web resmi;
request native tetap harus lolos autentikasi token.

## Penyimpanan

### D1: rahasia koneksi Google

Tabel `google_connections` menyimpan UID, Google account ID, ciphertext refresh
token, IV, scope yang diberikan, waktu koneksi, dan waktu sinkronisasi. Tabel
`calendar_sync_state` menyimpan sync token per UID dan kalender, dan
`selected_calendars` menyimpan ID kalender yang dipilih pengguna. Tidak ada
refresh token di Firestore atau di bundle aplikasi.

### Firestore: data aplikasi

Data tetap menggunakan model canonical `camelCase`, Firestore Timestamp, dan
jalur `users/{uid}/schedules` serta `users/{uid}/tasks`. Jadwal Google memakai ID
deterministik dari kalender dan Google event ID; jadwal manual menyimpan pasangan
ID Google setelah operasi push berhasil. Kejadian berulang mempertahankan
`recurringEventId` dan `originalStartTime` agar pengecualian serta kejadian yang
dipindahkan tetap cocok dengan sumbernya.

## Sinkronisasi Google

Implementasi awal boleh mempertahankan pemindaian penuh berjendela waktu untuk
memindahkan backend. Sebelum rilis dua arah, implementasikan sync token dengan
query konsisten yang mencakup kalender terpilih dan pagination. Sync token
disimpan per kalender di D1. Jika Google mengembalikan HTTP 410, buang token dan
lakukan full sync ulang. Jangan memakai parameter query yang dilarang bersama
`syncToken`; jika filter waktu diperlukan, pertahankan pemindaian berjendela
berkala tanpa token inkremental.

Untuk dua arah, event manual hanya dipush setelah persetujuan pengguna. Simpan
ETag Google dan gunakan precondition saat update agar perubahan dari Google tidak
tertindih diam-diam. Konflik ditampilkan untuk ditinjau. Penghapusan Google
diterapkan sebagai status `cancelled` pada Firestore; jangan menghapus riwayat
tanpa kebijakan retensi yang disepakati.

Untuk acara berulang, simpan aturan recurrence master dan identitas occurrence.
Kembangkan instance pada horizon penjadwalan agar seluruh occurrence terhitung
sebagai waktu sibuk. Perubahan satu occurrence tidak boleh mengubah master tanpa
persetujuan pengguna.

## Keamanan

- Worker secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `FIREBASE_PROJECT_ID`, dan `TOKEN_ENCRYPTION_KEY`.
- ID token Firebase diverifikasi menggunakan issuer `https://securetoken.google.com/<projectId>`
  dan audience project ID yang sama.
- UID request berasal dari claim token, bukan dari field body.
- Refresh token dienkripsi AES-GCM; jangan mencatat kode OAuth, access token,
  refresh token, atau secret dalam log.
- Firestore rules memvalidasi kepemilikan dan tipe field. Dokumen koneksi D1
  hanya dapat diakses Worker.
- Endpoint dibatasi ukuran request, validasi input, dan dilindungi dari replay
  operasi yang membuat event ganda.
- Consent scope dibuat seminimal mungkin. Untuk tulis acara diperlukan scope
  edit acara dan persetujuan ulang dari pengguna.

## Strategi migrasi

- Jangan menghapus Functions lama atau mengubah project Firebase aktif sebelum
  Worker lulus uji lokal dan preview deployment.
- Jika Functions belum pernah di-deploy, hilangkan konfigurasi Functions dari
  deployment Firebase setelah Worker siap.
- Jika Functions pernah aktif, deploy Worker lebih dahulu, pindahkan pemanggil
  aplikasi, verifikasi traffic dan error, baru hapus Functions.
- Jika data lama memakai koleksi atau field `snake_case`, lakukan backup dan
  migrasi idempoten dengan dry-run; verifikasi jumlah serta contoh dokumen
  sebelum menjadikan data lama tidak aktif.
- Pertahankan Firebase Auth dan Firestore selama migrasi; jangan memindahkan
  atau menghapus data pengguna sebagai bagian dari perubahan runtime.

## Rencana penerimaan

1. Worker lokal memverifikasi token valid dan menolak token hilang, salah audience,
   atau kedaluwarsa.
2. OAuth code ditukar sekali; refresh token terenkripsi dan hanya dapat dibaca
   melalui Worker; disconnect menghapus kredensialnya.
3. Sinkronisasi dua kali tidak menggandakan event. Perubahan dan penghapusan
   Google tercermin di Firestore; pagination dan zona waktu benar.
4. Push acara manual yang disetujui membuat satu event; retry tidak membuat
   duplikat; ETag mencegah update yang menimpa konflik.
5. Pengguna tidak dapat membaca/menulis data UID lain melalui Firestore rules
   maupun memanggil Worker dengan UID palsu di body.
6. Usulan penjadwalan tidak mengubah Firestore sebelum disetujui; undo memulihkan
   keadaan sebelumnya dan menolak jika tugas berubah dari perangkat lain.
7. `npm run lint`, TypeScript, unit tests, Cloudflare Worker tests, Firebase rules
   tests, Expo config checks, dan bundle builds lulus.
8. Cloudflare preview deployment lulus smoke test sebelum production deployment.

## Risiko dan keputusan lanjutan

- Cloudflare Free memiliki kuota harian dan batas CPU; evaluasi pemakaian D1,
  Worker request, dan subrequest Google sebelum rilis luas.
- D1 adalah tempat baru untuk token. Penghapusan database atau encryption key
  dapat memutus semua koneksi Google; dokumentasikan backup dan rotasi kunci.
- Public OAuth application dapat membutuhkan verifikasi Google untuk scope
  sensitif, terutama saat fitur tulis kalender diaktifkan.
- Antrean offline harus memakai kunci idempotensi dan menangani konflik saat
  koneksi pulih; Worker tidak boleh menerapkan ulang operasi yang sama.
- Undo saat ini hanya tersedia selama sesi layar. Implementasi harus memuat
  proposal aktif dari backend/state tersimpan dan memeriksa perubahan bersamaan.

## Tinjauan mandiri

- Tidak menaruh Google client secret atau refresh token di bundle Expo.
- Tidak mengirim service-account key Firestore ke Cloudflare.
- Tidak memindahkan Firebase Auth atau koleksi pengguna ke D1.
- Semua perubahan Google dan penjadwalan mengikuti persetujuan pengguna.
- Free tier disebut memiliki kuota, bukan dijanjikan selalu tanpa biaya.
