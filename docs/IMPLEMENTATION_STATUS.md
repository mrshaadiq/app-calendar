# Status APP Calendar — 7 Oktober 2026

## Sudah ada di kode

- Firebase Auth dan Firestore tetap dipakai pada paket gratis. `firebase.json` hanya berisi Firestore; aplikasi tidak lagi memanggil Firebase Functions.
- Cloudflare Worker di `worker/` memverifikasi Firebase ID token, menukar Google authorization code, menyimpan refresh token terenkripsi AES-GCM di D1, membaca pilihan kalender, mengimpor acara dalam jendela 30 hari ke belakang dan 90 hari ke depan, serta membuat/memperbarui acara Google dengan ID deterministik dan kunci idempotensi.
- Agenda lokal memakai `camelCase` di `users/{uid}/schedules` dan `users/{uid}/tasks`. Impor Google memakai ID dokumen deterministik, sehingga sinkronisasi ulang tidak membuat dokumen ganda. Acara yang hilang dalam jendela sinkronisasi ditandai batal.
- Pengguna memilih kalender, menjalankan sinkronisasi manual, dan dapat mengirim jadwal manual ke kalender Google yang dipilih. Aplikasi meminta scope `calendar.events` dan `calendar.calendarlist.readonly` pada login native.
- Penjadwal lokal menampilkan usulan dulu. Tombol persetujuan menyimpan alokasi; pembatalan tersedia selama 10 menit selama ID usulan masih ada di sesi layar. Perubahan tugas dan status usulan memakai transaksi Firestore.
- Firestore rules membatasi data ke UID pemilik. Aturan baru memungkinkan aplikasi menyimpan hasil impor dan alokasi tugas. Rules harus di-deploy terpisah pada Firebase Spark.
- Sinkronisasi Google kini membaca perubahan bertahap per kalender memakai `nextSyncToken`, termasuk pagination dan acara yang dibatalkan. Token baru diakui di D1 hanya setelah penulisan Firestore selesai. HTTP 410 memicu pembacaan penuh ulang; perubahan hari pada jendela 30/90 hari juga memicu pembacaan penuh agar acara yang baru masuk jendela tidak terlewat.
- Navigasi mobile kini memakai empat tab: Today, Week, Tasks, dan Settings. Today serta Week mengurutkan acara tetap, sesi tugas, dan waktu luang; keduanya menandai bentrok. Week dapat berpindah pekan dan memilih hari. Form acara satu kali tersedia dari Today/Week, sedangkan form tugas, pratinjau penjadwalan, persetujuan, dan undo berada di Tasks. Settings menampilkan akun, pilihan kalender, status sinkronisasi sesi, dan tombol sinkronisasi.

## Yang masih dibutuhkan agar bisa dipakai

1. **Cloudflare akun dan D1.** Pastikan `database_id` di `worker/wrangler.jsonc` menunjuk ke D1 milik proyek yang benar. Terapkan migrasi `0001_initial.sql` dan `0002_sync_checkpoint.sql`, pasang secret, lalu deploy Worker. Keberadaan ID dalam konfigurasi belum membuktikan database, migrasi, secret, atau deployment aktif.
2. **Kredensial Google/Firebase nyata.** Aktifkan Google provider Firebase Auth dan Calendar API, atur OAuth consent dan client Web/Android/iOS. `GOOGLE_CLIENT_ID` Worker harus sama dengan `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`; `GOOGLE_CLIENT_SECRET` hanya di Worker. Isi `FIREBASE_PROJECT_ID` dan kunci enkripsi 32 byte base64 sebagai secret Worker. Isi `EXPO_PUBLIC_WORKER_URL` setelah deploy. Native Google Sign-In memerlukan development build.
3. **Deploy Firestore rules.** Gunakan `firebase deploy --only firestore:rules,firestore:indexes` pada proyek Firebase yang benar. Langkah ini tidak memerlukan deployment Functions.
4. **Uji perangkat dan akun nyata.** Login, pertukaran kode OAuth, impor, penulisan acara Google, pilihan kalender, persetujuan dan pembatalan tugas belum terbukti end-to-end.

## Batas implementasi saat ini

- Sinkronisasi masih dipicu tombol. Implementasi token bertahap dan pemulihan HTTP 410 sudah ada di kode, tetapi belum diuji dengan akun Google, D1 remote, dan perangkat nyata.
- Jika agenda Google hasil kiriman aplikasi diedit di Google, aplikasi saat ini mempertahankan agenda manual asal dan tidak menyelesaikan konflik secara otomatis. Impor menghindari duplikat berdasarkan private `appScheduleId`.
- UI belum membuat aturan pengulangan. Acara berulang dari Google tampil sebagai kejadian dalam jendela impor; agenda manual berulang dan blok waktunya belum didukung penuh.
- Tasks masih memakai model lama: deadline wajib, belum ada prioritas, edit, atau aksi selesai. Tampilan Week belum memakai pengaturan jam kerja pengguna; waktu luang dihitung antara 08.00 dan 21.00. Pengiriman acara app ke Google masih lewat tombol per acara dan tujuan sementara adalah kalender terpilih pertama.
- Status sinkronisasi di Settings hanya berlaku selama sesi aplikasi. Penyimpanan agenda offline yang tahan setelah aplikasi ditutup dan antrean perubahan offline belum diterapkan.
- Tombol undo hanya muncul selama sesi layar. Riwayat usulan tersimpan di Firestore, tetapi UI belum memuat ulang riwayat setelah aplikasi dibuka kembali.
- Jika ada koleksi lama dengan skema `snake_case`, data itu perlu dicadangkan dan dimigrasikan. Kode baru tidak membacanya.
- `functions/` adalah implementasi lama yang tidak dirujuk oleh konfigurasi deployment atau aplikasi. Setelah migrasi terverifikasi, folder ini dapat diarsipkan.
- Audit dependensi sebelumnya masih menunjukkan advisori transitif; jangan jalankan `npm audit fix --force` karena pernah menyarankan downgrade Expo/Firebase yang tidak cocok.

## Verifikasi lokal terbaru

- Tes timeline memeriksa urutan acara/sesi/waktu luang, bentrok, penyaringan acara Google, dan rentang pekan.
- TypeScript aplikasi, lint, dan export bundle Android lulus. Worker tetap memiliki tujuh tes lulus serta pemeriksaan TypeScript dan dry-run bundle dari tahap sebelumnya.
- Wrangler `whoami` gagal karena layanan autentikasi Cloudflare tidak dapat dijangkau; migrasi D1 remote serta deployment tetap belum terverifikasi.

## Langkah Cloudflare

Jalankan dari folder `worker/` setelah login dengan `npx wrangler login`:

```powershell
npx wrangler d1 create app-calendar-tokens
# Jika D1 belum ada, salin database_id hasilnya ke worker/wrangler.jsonc.
npx wrangler d1 migrations apply app-calendar-tokens --remote
npx wrangler secret put FIREBASE_PROJECT_ID
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put TOKEN_ENCRYPTION_KEY
npx wrangler deploy
```

Untuk membuat `TOKEN_ENCRYPTION_KEY` 32 byte base64, gunakan generator acak kriptografis lokal dan jangan simpan hasilnya di Git. Setelah deploy, isi URL Worker pada `.env` aplikasi sesuai `.env.example`.
