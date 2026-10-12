# Product Requirements Document — APP Calendar

| Kolom | Nilai |
|---|---|
| Status | Draft v1.0 untuk review |
| Tanggal | 5 Oktober 2026 |
| Nama kerja | APP Calendar |
| Platform awal | Mobile iOS dan Android |
| Dokumen desain | [Figma — APP Calendar Mobile UI Flow](https://www.figma.com/design/FOQ2xQ6Z4R96zXA5y0TyyN/APP-Calendar-%E2%80%94-Mobile-UI-Flow?node-id=0-1&t=ot71MfC9FfUtkluF-1) |

## 1. Ringkasan

APP Calendar adalah planner pribadi untuk mahasiswa yang menyatukan jadwal, tugas, dan penjadwalan berbantuan AI dalam satu aplikasi sederhana. Aplikasi menghubungkan acara dari Google Calendar, memungkinkan pengguna membuat dan mengelola acara tetap dari app, dan menyinkronkan perubahan acara secara dua arah pada kalender yang dipilih.

Pengguna memasukkan tugas beserta deadline, estimasi waktu, dan tingkat penting. AI menyusun usulan sesi pengerjaan di sela kuliah, perjalanan kampus, acara lain, dan waktu istirahat yang dilindungi. Pengguna meninjau usulan sebelum menerapkannya ke timeline dan kalender Google.

**Janji produk:** pengguna dapat melihat apa yang sudah mengisi harinya, apa yang masih perlu dikerjakan, dan kapan tugas itu realistis dikerjakan tanpa merakit sistem database seperti Notion atau berpindah-pindah tampilan kalender dan tugas.

## 2. Masalah

Pengguna mengelola beberapa jenis komitmen sekaligus: kuliah dan rutinitas berulang, perjalanan ke/dari kampus, serta tugas dengan deadline dan tingkat kepentingan yang berbeda. Kalender menunjukkan waktu, tetapi tidak otomatis memecah tugas ke waktu kosong. Daftar tugas menunjukkan pekerjaan, tetapi tidak menjelaskan kapan pekerjaan itu bisa dikerjakan. Menggabungkan keduanya secara manual membuat pengguna kesulitan memprioritaskan, memperkirakan kapasitas, dan memperbarui rencana ketika jadwal berubah.

## 3. Sasaran dan bukan sasaran

### Sasaran MVP

- Menyediakan satu timeline harian dan mingguan yang menggabungkan acara, sesi tugas, dan waktu luang.
- Memudahkan pencatatan tugas dan acara tetap, termasuk kelas serta perjalanan kampus yang berulang.
- Menghasilkan rencana pengerjaan tugas yang realistis dan dapat ditinjau, diubah, diterima, atau di-undo.
- Menjaga acara di app dan Google Calendar yang dipilih tetap sinkron dua arah.
- Mengurangi konflik jadwal dan pekerjaan perencanaan manual tanpa mengambil alih kendali pengguna.

### Bukan sasaran MVP

- Kolaborasi, kalender bersama buatan aplikasi, atau pengelolaan tugas untuk tim.
- Basis data, workspace, kanban, dan sistem proyek yang dapat dikustomisasi seperti Notion.
- Membaca Gmail untuk mengekstrak tugas atau deadline.
- Mencari rute perjalanan kampus secara otomatis atau memprediksi lalu lintas.
- Asisten chat sebagai cara utama untuk mengatur semua data.
- Analitik produktivitas kompleks, streak, atau penilaian performa pengguna.

## 4. Pengguna dan kebutuhan

### Persona utama

Mahasiswa yang memiliki jadwal kuliah berulang, waktu perjalanan, dan beberapa tugas berjalan. Ia memakai kalender untuk komitmen bertanggal dan daftar terpisah untuk mengingat tugas. Ia ingin menangkap tugas dengan cepat lalu mendapat saran jadwal yang mempertimbangkan kapasitas hariannya.

### Kebutuhan utama

> Saat jadwal kuliah dan deadline berubah-ubah, saya ingin melihat komitmen tetap dan waktu kosong bersama-sama, lalu mendapat usulan waktu untuk mengerjakan tugas supaya saya tidak perlu menyusun ulang minggu saya secara manual.

## 5. Prinsip pengalaman

- **Hari ini sebagai titik awal:** layar Today menunjukkan urutan jadwal dan tugas yang paling relevan.
- **Input singkat:** tugas cukup dimulai dari judul, deadline, estimasi durasi, dan tingkat penting.
- **Kalender tetap milik pengguna:** AI memberi usulan; pengguna memutuskan perubahan jadwal tugas.
- **Perubahan mudah dibatalkan:** tindakan sinkronisasi dan penjadwalan ulang harus memberi status yang jelas dan jalur undo/pemulihan.
- **Tidak membuat jadwal palsu:** bila kapasitas tidak cukup, app mengatakan demikian dan menunjukkan pilihan.
- **Bahasa sederhana:** gunakan istilah sehari-hari dan hindari konfigurasi kompleks sebelum benar-benar dibutuhkan.

## 6. Cakupan MVP

### Termasuk

- Masuk dengan akun Google dan menghubungkan Google Calendar.
- Memilih kalender yang dibaca dan kalender tujuan untuk acara yang dibuat atau diperbarui oleh app.
- Melihat tampilan Today dan Week, daftar Tasks, serta Settings.
- Membuat, mengedit, dan menghapus acara tetap langsung dari aplikasi; acara dapat sekali saja atau berulang.
- Menampilkan acara kalender Google pilihan di timeline dan memperbarui acara dua arah.
- Membuat dan mengelola tugas dengan deadline, estimasi durasi, prioritas, dan status.
- Menyusun dan meninjau rencana tugas berbantuan AI.
- Menampilkan status sinkronisasi, menangani konflik, dan mengantri perubahan saat offline.
- Pengingat deadline dan sesi kerja dengan waktu pengingat yang dapat diatur.

### Tidak termasuk

Fitur pada daftar bukan sasaran MVP di atas. Penjadwalan AI tidak mengubah acara tetap secara otomatis, meskipun ada ruang waktu kosong atau acara berubah.

## 7. Alur pengguna utama

### 7.1 Mulai menggunakan aplikasi

1. Pengguna masuk dengan Google.
2. Pengguna memilih kalender yang ingin ditampilkan dan kalender tujuan untuk acara buatan app.
3. App melakukan sinkronisasi awal dan memperlihatkan statusnya.
4. Pengguna memeriksa hasil sinkronisasi, membuat jadwal kuliah/perjalanan yang belum ada, dan mengatur jam kerja serta waktu istirahat.

### 7.2 Menambahkan acara tetap

1. Pengguna memilih tambah acara dari Today atau Week.
2. Pengguna mengisi judul, tanggal, jam mulai dan selesai, kalender tujuan, serta apakah acara berulang.
3. Untuk acara berulang, pengguna memilih hari/pola pengulangan dan tanggal akhir bila ada.
4. Saat mengedit atau menghapus acara berulang, app meminta pilihan antara kejadian ini atau seluruh rangkaian. Operasi “kejadian ini dan berikutnya” tidak wajib pada MVP.
5. App menyimpan acara lalu memperlihatkan status sinkronisasi.

### 7.3 Menambahkan tugas dan meninjau usulan AI

1. Pengguna menambahkan judul, deadline, estimasi total waktu, dan tingkat penting.
2. App menyimpan tugas ke daftar Tasks dan meminta AI menyusun atau memperbarui rencana.
3. App menampilkan sesi yang disarankan, termasuk alasan singkat seperti “deadline paling dekat” atau “slot kosong sebelum kelas”.
4. Pengguna dapat menerima rencana, memindahkan sesi sebelum menerima, atau menolak/undo.
5. Setelah diterima, sesi tugas ditambahkan ke timeline dan kalender Google tujuan.

### 7.4 Jadwal berubah

1. Acara tetap dibuat, dipindah, atau dihapus dari app maupun Google Calendar.
2. App menyinkronkan perubahan dan memeriksa apakah sesi tugas terdampak.
3. Jika ada bentrok, AI membuat usulan penyesuaian dan menjelaskan tugas atau sesi yang berubah.
4. Sesi hanya dipindah setelah pengguna menyetujui usulan. Versi sebelumnya tersedia untuk undo.

## 8. Persyaratan fungsional

| ID | Prioritas | Persyaratan | Kriteria penerimaan |
|---|---|---|---|
| FR-01 | Must | Pengguna dapat masuk dengan Google dan memilih kalender untuk sinkronisasi serta kalender tujuan. | Kalender yang dipilih ditampilkan; kalender yang tidak dipilih tidak masuk ke timeline sinkron. Status koneksi terlihat. |
| FR-02 | Must | Today menggabungkan acara, sesi tugas, dan waktu luang dalam urutan waktu. | Pengguna dapat membedakan acara tetap, sesi AI, serta waktu kosong; bentrok terlihat tanpa membuka layar lain. |
| FR-03 | Must | Week menampilkan komitmen tujuh hari dan menyediakan navigasi antarpekan. | Pengguna dapat memilih hari dan melihat acara serta tugas terkait. |
| FR-04 | Must | Pengguna dapat membuat, membaca, mengedit, dan menghapus acara tetap di app. | Acara satu kali dan berulang dapat dibuat; acara yang dapat diedit ikut tersinkron ke Google Calendar. |
| FR-05 | Must | Jadwal kuliah, perjalanan kampus, dan komitmen lain dapat berulang. | Pengguna bisa mengubah satu kejadian atau seluruh rangkaian; perubahan dari Google pada kejadian/rangkaian juga tercermin di app. |
| FR-06 | Must | Pengguna dapat membuat dan mengelola tugas. | Tugas mencatat judul, deadline tanggal (jam opsional), estimasi durasi dengan pilihan cepat 30 menit/1 jam/2 jam/kustom, tingkat penting rendah/sedang/tinggi, dan status belum dijadwalkan/terjadwal/selesai. |
| FR-07 | Must | Tasks menampilkan daftar tugas termasuk yang belum punya sesi kalender. | Daftar dapat diurutkan minimal berdasarkan deadline dan tingkat penting; pengguna dapat membuka, mengedit, menyelesaikan, atau menjadwalkan tugas. |
| FR-08 | Must | Pengguna dapat menentukan jam kerja, waktu yang dilindungi, durasi sesi fokus pilihan, dan apakah tugas boleh dibagi ke beberapa sesi. | Nilai awal sesi fokus adalah 60 menit; pengguna dapat mengubahnya. Jadwal tetap, istirahat, dan blok pribadi tidak ditimpa AI. |
| FR-09 | Must | AI mengusulkan sesi untuk tugas berdue date berdasarkan deadline, prioritas, estimasi sisa durasi, dan waktu tersedia. | AI tidak membuat sesi yang tumpang tindih dengan acara tetap; tugas tanpa deadline tetap di backlog sampai pengguna memilih kapan tugas perlu dijadwalkan. Jika waktu tidak cukup, app menyatakan konflik dan tidak membuat jadwal yang seolah-olah layak. |
| FR-10 | Must | Usulan AI dapat ditinjau, diterima, ditolak, diubah sebelum diterima, dan di-undo setelah diterapkan. | Tidak ada perubahan pada kalender dari usulan AI sebelum pengguna memilih terima; undo memulihkan versi sebelumnya bila masih tersedia. |
| FR-11 | Must | Perubahan pada kedua sisi Google Calendar tersinkron dua arah untuk kalender pilihan. | Membuat, mengubah, dan menghapus acara yang memiliki izin tampil pada sisi lain; satu acara tidak menjadi duplikat setelah sync ulang. |
| FR-12 | Must | App menangani perubahan bersamaan atas acara yang sama. | App menampilkan konflik dan pilihan perubahan; app tidak menimpa salah satu perubahan secara diam-diam. |
| FR-13 | Must | Status sinkronisasi dan kesalahan terlihat. | Pengguna melihat waktu sync terakhir, status berjalan/gagal/menunggu jaringan, dan memiliki aksi coba lagi. |
| FR-14 | Must | Perubahan lokal dapat menunggu saat offline. | Data yang sudah tersimpan tetap dapat dilihat; perubahan menunggu koneksi lalu disinkronkan, dengan konflik ditampilkan jika versi di Google berubah. |
| FR-15 | Should | Pengingat dapat diatur untuk deadline dan sesi kerja. | Pengguna dapat memilih apakah pengingat aktif serta jarak waktunya; perubahan pengaturan tidak mengubah waktu acara. |
| FR-16 | Must | Pengguna dapat memutuskan koneksi Google dan mengelola data aplikasi. | Memutus koneksi menghentikan sync dan mempertahankan salinan lokal app secara default; pengguna dapat menghapus data aplikasi secara terpisah dan mendapat konfirmasi. |

## 9. Aturan penjadwalan AI

### Data yang dipakai

- Deadline tugas, tingkat penting, estimasi durasi total dan sisa waktu.
- Slot sibuk dari kalender yang dipilih, tanpa perlu mengirim judul, deskripsi, atau lokasi acara kepada model penjadwalan.
- Jam kerja yang dipilih, blok istirahat/pribadi, durasi sesi pilihan, dan jeda perjalanan yang dibuat pengguna.

### Aturan wajib

1. Acara Google yang sinkron, acara tetap buatan pengguna, waktu istirahat yang dilindungi, dan blok pribadi dianggap tidak tersedia.
2. Tugas dengan tingkat penting tinggi dan deadline dekat diprioritaskan, tetapi AI juga mempertimbangkan sisa durasi agar tidak menunda tugas panjang hingga terlalu dekat dengan deadline.
3. Satu tugas dapat dibagi menjadi beberapa sesi jika pengguna mengizinkan dan slot kontinu tidak tersedia. App menggunakan durasi sesi pilihan pengguna (awal 60 menit); total sesi terjadwal tidak boleh melebihi estimasi waktu yang tersisa.
4. AI tidak menjadwalkan di luar jam kerja yang dipilih atau setelah deadline tugas.
5. AI tidak mengubah acara tetap dan tidak menerapkan perubahan sebelum pengguna menerima rencana.
6. Setiap usulan menyebutkan alasan singkat dan menunjukkan jika tugas berisiko tidak selesai tepat waktu.
7. Bila tidak ada jadwal yang layak, app menjelaskan penyebab dan menawarkan langkah yang dapat dipilih pengguna: melonggarkan durasi sesi, memperluas waktu kerja, menurunkan prioritas tugas lain, atau menerima risiko keterlambatan.

## 10. Kontrak sinkronisasi Google Calendar

### Arah dan cakupan

- **Google ke app:** acara dari kalender pilihan, termasuk perubahan waktu/judul, pembatalan, dan perubahan rangkaian berulang, diperbarui di app.
- **App ke Google:** acara tetap buatan app dan sesi tugas yang telah diterima AI dibuat atau diperbarui pada kalender tujuan yang dipilih.
- **Edit di kedua sisi:** perubahan judul, waktu, zona waktu, pola pengulangan, lokasi, dan deskripsi acara buatan app diteruskan di kedua arah selama akun memiliki izin menulis.
- **Izin terbatas:** acara kalender bersama yang hanya dapat dibaca tetap terlihat; app tidak menjanjikan edit yang ditolak Google dan menjelaskan bahwa acara tersebut read-only.
- Pengguna dapat memilih kalender sumber dan kalender tujuan secara terpisah.

### Tugas dan sesi kalender

Tugas adalah objek milik app; sesi terjadwalnya adalah blok waktu yang disinkronkan sebagai acara kalender. Jika pengguna menghapus satu sesi dari Google Calendar, sesi itu dihapus dari rencana tetapi tugasnya tetap ada di Tasks sebagai belum terjadwal. Jika tugas ditandai selesai di app, sesi mendatang yang belum dikerjakan dihapus setelah konfirmasi; sesi lampau tetap menjadi riwayat kalender. Menghapus tugas meminta konfirmasi apakah sesi mendatang yang terkait juga dihapus. Memindahkan sesi dari Google Calendar ke waktu lain memperbarui sesi di app dan menandainya sebagai waktu pilihan pengguna.

### Konflik, duplikasi, dan penghapusan

- App menyimpan hubungan stabil antara objek app dan acara Google agar sinkron ulang tidak membuat duplikat.
- Bila event yang sama berubah di Google dan app sejak versi terakhir dilihat, tampilkan nilai sebelum/sesudah dan pilihan untuk memakai versi Google, versi app, atau meninjau lalu mengedit.
- Penghapusan di salah satu sisi tercermin di sisi lain untuk acara yang terhubung dan dapat diedit. App menyimpan snapshot lokal sementara supaya pengguna bisa undo atau membuat ulang acara bila pemulihan langsung tidak tersedia.
- Pembatalan satu kejadian dari rangkaian tidak menghapus seluruh rangkaian. Pilihan penghapusan menjelaskan cakupannya.
- Sync gagal atau token sinkronisasi tidak berlaku harus menampilkan status dan menjalankan pemulihan/sinkron ulang tanpa membuang perubahan lokal yang belum terkirim.
- Saat koneksi terputus, app menampilkan antrean perubahan dan tidak menyebut sinkronisasi berhasil sebelum mendapat konfirmasi dari Google.

Google Calendar API menyediakan pola sinkronisasi awal lalu sinkronisasi bertahap, termasuk perubahan dan penghapusan; token yang kedaluwarsa dapat memerlukan sinkronisasi penuh. API juga menyediakan ETag untuk memeriksa versi sebelum mengubah resource, serta mendukung kejadian pengecualian pada acara berulang. Detail implementasi perlu mengikuti [panduan sinkronisasi](https://developers.google.com/workspace/calendar/api/guides/sync), [panduan ETag](https://developers.google.com/workspace/calendar/api/guides/version-resources), dan [panduan acara berulang](https://developers.google.com/workspace/calendar/api/guides/recurringevents).

## 11. Persyaratan nonfungsional

- **Privasi:** hanya sinkronkan kalender yang dipilih. Minta izin Google yang diperlukan untuk baca/tulis dengan penjelasan yang dapat dipahami. Minimalkan data kalender yang diteruskan ke layanan AI.
- **Keamanan:** token Google tidak disimpan sebagai teks biasa; pengguna dapat memutus akses dan menghapus data mereka.
- **Keandalan:** setiap perubahan punya status lokal dan status sync; error tidak boleh dilaporkan sebagai sukses.
- **Waktu dan zona waktu:** gunakan zona waktu kalender untuk acara dan pengulangan. Zona waktu awal mengikuti kalender Google; Asia/Jakarta menjadi nilai awal bila belum tersedia, dan pengguna dapat mengubahnya.
- **Aksesibilitas:** teks dapat diperbesar, kontrol utama dapat digunakan screen reader, dan warna kategori selalu disertai label/ikon.
- **Kinerja:** Today menampilkan data lokal tersimpan lebih dahulu lalu memperbarui ketika sync selesai. Saran AI memberi status sedang dibuat dan hasil yang dapat dipakai ulang jika permintaan gagal.
- **Platform:** mobile iOS dan Android sebagai target awal. Repo saat ini menggunakan Expo SDK 54; sebelum menulis kode, ikuti instruksi repo untuk membaca dokumentasi Expo versi v54.

## 12. Ukuran keberhasilan

Target berikut adalah hipotesis untuk uji pemakaian pribadi dua minggu pertama dan perlu dievaluasi ulang memakai hasil pemakaian nyata.

| Metrik | Target awal | Cara mengukur |
|---|---:|---|
| Waktu input tugas | Median ≤30 detik | Dari membuka form sampai tugas tersimpan |
| Penerimaan rencana AI | ≥70% sesi diterima tanpa dipindahkan manual | Sesi diterima dibanding sesi yang diusulkan |
| Bentrok AI dengan acara/waktu terlindungi | 0 pada rencana yang diterima | Bandingkan semua sesi AI dengan blok tetap |
| Sinkronisasi online | ≥95% perubahan terlihat di kedua sisi ≤60 detik | Perubahan sukses dibagi seluruh perubahan dengan jaringan tersedia |
| Konflik tertimpa diam-diam atau duplikasi | 0 | Audit konflik dan pasangan event selama uji |
| Tugas berdeadline tanpa waktu rencana | Tren menurun dari minggu pertama ke minggu kedua | Hitung tugas aktif yang belum memiliki sesi dan tenggatnya belum lewat |

## 13. Risiko dan mitigasi

| Risiko | Dampak | Mitigasi produk |
|---|---|---|
| Dua arah sync membuat duplikasi atau menimpa edit. | Kalender tidak dipercaya dan jadwal hilang. | Relasi event yang stabil, cek versi, konflik eksplisit, snapshot penghapusan, status sync. |
| Aturan acara berulang lebih rumit dari acara tunggal. | Perubahan satu kelas tanpa sengaja mengubah satu semester. | Pilihan “kejadian ini/seluruh rangkaian”, pratinjau perubahan, dan dukungan untuk pengecualian Google. |
| AI memberi sesi yang tidak realistis. | Pengguna mengabaikan saran. | Batas waktu tetap, kapasitas dan istirahat dihormati, alasan transparan, persetujuan sebelum perubahan. |
| Izin Google baca/tulis terasa terlalu luas. | Pengguna enggan menghubungkan akun. | Pemilihan kalender, penjelasan izin sebelum OAuth, minimalkan cakupan, dan tombol putuskan akses. |
| Jadwal pribadi dikirim ke model AI. | Risiko privasi. | Berikan AI interval sibuk dan metadata tugas seperlunya; jangan kirim detail acara tanpa alasan dan persetujuan pengguna. |
| Jaringan atau API Google tidak tersedia. | Perubahan tertunda atau data terlihat usang. | Antrean perubahan lokal, indikator waktu sync terakhir, percobaan ulang, dan pemulihan sinkronisasi penuh. |

## 14. Asumsi dan keputusan produk

- Nama APP Calendar masih nama kerja dari file Figma.
- Pengguna MVP adalah satu mahasiswa/pemilik akun; tidak ada anggota bersama.
- Google Calendar adalah integrasi kalender eksternal pertama dan sinkronisasi hanya berlaku pada kalender yang dipilih.
- Sinkronisasi dua arah mencakup acara tetap dan sesi tugas yang dibuat app; objek tugas dan status penyelesaiannya tetap milik app.
- Pengguna memberi persetujuan sebelum AI membuat atau memindahkan sesi tugas di kalender.
- Ambang prioritas awal rendah/sedang/tinggi dapat diubah setelah penggunaan nyata; model atau provider AI belum ditetapkan oleh PRD ini.
- Ketepatan zona waktu dan acara berulang lebih penting daripada mendukung semua variasi kalender pada versi pertama.

## 15. Referensi dan catatan prototipe

- [Prototipe Figma APP Calendar](https://www.figma.com/design/FOQ2xQ6Z4R96zXA5y0TyyN/APP-Calendar-%E2%80%94-Mobile-UI-Flow?node-id=0-1&t=ot71MfC9FfUtkluF-1) memperlihatkan login Google, timeline Today, form New Task dengan deadline dan durasi, serta dialog reschedule dengan Accept/Undo.
- Prioritas tugas dan pengelolaan acara tetap/komuter langsung dari app merupakan tambahan kebutuhan produk yang dijelaskan pengguna dan belum tampak lengkap di prototipe.
- [Google Calendar API — sinkronisasi](https://developers.google.com/workspace/calendar/api/guides/sync)
- [Google Calendar API — ETag dan versi resource](https://developers.google.com/workspace/calendar/api/guides/version-resources)
- [Google Calendar API — acara berulang](https://developers.google.com/workspace/calendar/api/guides/recurringevents)
