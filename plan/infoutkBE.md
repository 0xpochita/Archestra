# Info Kontrak untuk Backend

Dokumen ini khusus hal-hal yang menyentuh backend. Untuk alamat kontrak, tabel encoding step, dan daftar error lengkap, pakai `plan/infoutkFE.md`, isinya sama-sama berlaku dan tidak diulang di sini.

Yang perlu dibaca sekali sebelum mulai: `contracts/exports/README.md`. Yang bisa langsung diimpor: `contracts/exports/abi/*.json` dan `contracts/exports/addresses.arc-testnet.json`.

---

## 1. Baca ini dulu: `ChainAdapter` sekarang tidak cocok dengan kenyataan on chain

Port di `backend/agents/spec/mocks.md` berbentuk:

```ts
interface ChainAdapter {
  estimateGas(steps: StepRequest[]): Promise<bigint>;
  execute(step: StepRequest): Promise<StepResult>;   // satu step per panggilan
}
```

`MockChainAdapter` bisa mengeksekusi step satu per satu dengan jeda 700 ms, dan `BE-14` menulis baris `run_steps` sambil berjalan. Di chain asli itu tidak mungkin, karena:

1. **Satu run adalah satu transaksi.** `executor.run(workflowId)` menjalankan seluruh step dalam satu transaksi, all or nothing. Tidak ada titik di mana step 2 sudah jalan dan step 3 belum.
2. **Backend tidak boleh punya private key.** Yang mengirim transaksi adalah wallet user. Backend tidak bisa memanggil `execute()` apa pun.
3. Karena itu, per step tidak ada `txHash` sendiri dan tidak ada `gasUsed` sendiri. Yang ada satu `txHash` untuk seluruh run dan satu total gas.

Jadi `ArcChainAdapter` tidak bisa mengimplementasikan `execute(step)` dengan makna yang sama. Yang perlu dilakukan: **pisahkan portnya per mode**, bukan memaksa satu bentuk.

Usulan bentuk yang cocok untuk keduanya:

```ts
interface ChainAdapter {
  // dipakai simulate, sama untuk mock dan real
  estimateGas(steps: StepRequest[]): Promise<bigint>;

  // mode mock: jalankan sendiri step demi step (perilaku sekarang, tidak berubah)
  // mode arc: tidak diimplementasikan, throw NotSupported
  execute?(step: StepRequest): Promise<StepResult>;

  // mode arc: bangun calldata yang wallet user harus kirim
  buildRunCall?(workflowId: bigint): Promise<{ to: string; data: string }>;

  // mode arc: baca hasil satu transaksi run yang sudah masuk chain
  readRun?(txHash: string): Promise<{
    runId: string;
    stopped: boolean;
    stepsExecuted: number;
    gasUsed: bigint;
    steps: Array<{ position: number; stepType: number; adapter: string; tokenOut: string; amountOut: bigint }>;
  }>;
}
```

Konsekuensi ke endpoint yang sudah ada, ini keputusan produk yang perlu diambil sebelum koding:

- `POST /v1/workflows/:id/runs` di mode live **tidak bisa langsung menjalankan apa pun**. Pilihannya: (a) endpoint mengembalikan calldata plus alamat tujuan supaya frontend menyuruh wallet mengirim, lalu frontend melaporkan `txHash` ke endpoint lanjutan, atau (b) endpoint hanya mencatat niat run, dan backend menunggu event dari chain tanpa tahu txHash lebih dulu. Opsi (a) lebih mudah dilacak dan lebih ramah untuk SSE.
- `mode` di tabel `runs` mungkin perlu nilai ketiga, misal `live_pending`, untuk run yang sudah dicatat tapi transaksinya belum masuk chain. Atau pakai `status = queued` yang sudah ada, asal jelas artinya "menunggu wallet user".

## 2. Alamat dan konfigurasi

Backend hanya perlu **satu** alamat di config: registry `0x88d8Cd3009cd7905ec0E7f895c772Edd9878b42F` (chain 5042002, RPC `https://rpc.testnet.arc.io`).

Saat boot:

1. Panggil `registry.executor()` untuk mendapat alamat Executor yang aktif. Ini alamat yang di-listen untuk semua event run.
2. Kalau hasilnya `0x0`, artinya belum ada executor yang diterbitkan. Jangan crash, tandai sistem sebagai belum siap dan coba lagi nanti.
3. Alamat adapter per step type bisa dibaca dari `addresses.arc-testnet.json` atau disimpan di config, karena encoder butuh alamat itu untuk mengisi field `adapter` tiap step.

Reload config ketika muncul event `ExecutorPublished` atau `ExecutorRetired` dari registry.

Catatan penting: **event `ExecutorChanged` sudah tidak ada**. Penggantinya `ExecutorPublished(address indexed newExecutor)` dan `ExecutorRetired(address indexed oldExecutor)`. Kalau indexer sudah mengacu ke `ExecutorChanged`, itu harus diganti.

## 3. Estimasi gas untuk endpoint simulate

Dua pilihan, keduanya sah:

1. **Tetap pakai tabel gas milik `MockChainAdapter`.** Kontrak sengaja memakai tabel yang sama, jadi hasilnya konsisten. Ini yang paling murah dan tidak butuh koneksi chain.
2. **Panggil `executor.estimate(workflowId)`** untuk workflow yang sudah tersimpan di chain. Hasilnya sama rumusnya: jumlah tabel per step ditambah buffer 10 persen.

Pengukuran nyata sebagai patokan: demo strategy 6 step (trigger, approve, deposit, swap, yield, harvest) memakai **701.882 gas** on chain. Estimasi tabel memberi 771.100. Jadi tabel sedikit konservatif, dan itu memang yang diinginkan untuk simulate.

Satuan: gas, bukan biaya. Kalau mau tampilkan biaya, kalikan gas price yang dibaca dari RPC. Di Arc, gas dibayar dalam USDC native.

## 4. Memetakan event run ke tabel `run_steps`

Semua event run keluar dari alamat Executor. Urutan lengkapnya ada di `plan/infoutkFE.md` bagian 6 dan di `contracts/exports/README.md`.

Aturan pemetaan:

| Kolom `run_steps` | Sumber |
| --- | --- |
| `position` | field `position` dari `StepExecuted`, mulai dari 0, cocok langsung |
| `kind` | dipetakan dari `stepType` (uint8) memakai tabel enum di `infoutkFE.md` bagian 5 |
| `state` | `success` untuk setiap `StepExecuted`. Step yang tidak pernah muncul karena guard menghentikan run tidak punya baris, atau diberi state tersendiri kalau UI mau menampilkannya sebagai dilewati |
| `tx_hash` | hash transaksi run, **sama untuk semua step dalam satu run** |
| `gas_used` | tidak ada per step di chain. Biarkan null, dan simpan total gas transaksi di level run |
| `error` | null. Run yang gagal tidak memancarkan event sama sekali, lihat di bawah |
| `started_at`, `finished_at` | timestamp block dari transaksi run, sama untuk semua step |

Tiga hal yang mudah salah:

1. **Run yang gagal tidak memancarkan event apa pun.** Transaksi revert, jadi seluruh log dibatalkan. Untuk mendeteksi kegagalan, baca `status` pada transaction receipt: `0x1` sukses, `0x0` gagal. Kalau gagal, tandai run `failed` dan ambil pesan error dengan mendekode revert data memakai daftar custom error.
2. **Guard yang menghentikan run bukan kegagalan.** Yang muncul `GuardStopped` di posisi itu, tanpa `StepExecuted`, lalu `RunCompleted` dengan `stopped = true`. Status run tetap `succeeded`. Ini penting supaya template seperti `guarded-exit` tidak terlihat error di canvas padahal berjalan benar.
3. **Kunci indexer pada `runId`, jangan pada alamat pemancar.** Alamat Executor bisa berganti versi. Event lama tetap sah di alamat lama, dan `runId` unik lintas versi karena mengandung workflowId, block number, caller, dan nonce.

## 5. Progres real time untuk SSE

Di chain, seluruh step selesai dalam satu blok, jadi tidak ada progres bertahap seperti mode mock. Bentuk yang jujur:

1. Saat transaksi dikirim: kirim event SSE `step` dengan state `running` untuk posisi 0 sampai n, atau satu event `run` bertanda "menunggu konfirmasi".
2. Saat transaksi masuk blok: baca semua `StepExecuted` dari receipt, kirim satu batch event `step` dengan state `success` sesuai urutan `position`, lalu `done`.
3. Kalau receipt statusnya gagal: kirim `error` dengan pesan hasil dekode custom error.

Kalau ingin animasi bertahap di canvas tetap terasa seperti sekarang, lakukan penundaan di sisi frontend saat memutar batch event, jangan memalsukan waktu di backend. Data tetap jujur, tampilan tetap enak.

## 6. Yang perlu dibaca dari chain untuk kebutuhan UI

Ini bisa dibaca frontend langsung, atau diproksikan lewat backend kalau ingin caching. Semua read only, murah:

| Kebutuhan | Panggilan |
| --- | --- |
| Alamat vault user | `factory.vaultOf(owner)`, atau `factory.predictVault(owner)` untuk yang belum dibuat |
| Status sesi per token | `vault.sessionOf(token)` mengembalikan `(maxPerRun, maxPerDay, expiresAt)` |
| Kuota harian terpakai | `vault.sessionSpentToday(token)` |
| Versi executor yang disetujui vault | `vault.acceptedExecutor()` |
| Versi executor terbaru yang diterbitkan | `registry.executor()` |
| Cek adapter boleh dipakai | `registry.isAdapterAllowed(adapter, stepType)` |
| Workflow tersimpan on chain | `registry.get(workflowId)` |

Saran: biarkan frontend yang membaca ini langsung ke RPC. Backend tidak perlu menyimpannya, dan data sesi berubah tanpa event yang backend pantau kalau user memakai wallet dari luar studio.

## 7. Endpoint baru yang mungkin dibutuhkan

Ini usulan, bukan keharusan dari sisi kontrak:

1. `POST /v1/workflows/:id/runs` versi live: mengembalikan `{ to, data, chainId }` untuk dikirim wallet, plus id run yang sudah dicatat sebagai menunggu.
2. `POST /v1/runs/:id/tx`: frontend melaporkan `txHash` setelah wallet mengirim, backend mulai memantau receipt dan mengisi `run_steps`.
3. `GET /v1/workflows/:id/onchain`: ringkasan status on chain untuk halaman workflow, yaitu alamat vault, sesi per token, dan apakah ada versi executor baru yang belum disetujui. Ini murni agregasi dari bagian 6.

Kalau ingin tetap minimal, cukup nomor 1 dan 2. Nomor 3 bisa dikerjakan frontend langsung ke RPC.

## 8. Angka dan tipe data

- Semua jumlah token adalah bilangan bulat dalam satuan terkecil. `numeric(78, 0)` di skema sudah cocok untuk `uint256`.
- Desimal token demo di Arc testnet: dUSDC 6, dWETH 18, aUSDC 6, LP token 18, reward token 18. Jangan hardcode 18 di mana pun.
- `runId` adalah `bytes32`, simpan sebagai string hex 0x dengan panjang 66 karakter.
- `workflowId` adalah `uint256` dan mulai dari 1. Ini id on chain, berbeda dari id ULID `wf_...` milik database. Simpan keduanya dan petakan satu ke satu.
- `stepType` adalah `uint8` 0 sampai 9. Simpan `kind` string seperti sekarang untuk frontend, dan simpan `stepType` numeriknya kalau mau debug lebih mudah.

## 9. Tes indexer tanpa chain

Pakai `contracts/exports/fixtures/run-fixture.json`. Isinya rangkaian event dari run asli yang sudah didekode, plus bentuk baris `run_steps` yang diharapkan. Bentuk event di dalamnya masih akurat dan tidak berubah karena session layer.

Satu catatan: alamat di dalam fixture itu milik deployment lama. Untuk alamat aktif selalu baca `contracts/exports/addresses.arc-testnet.json`.

## 10. Hal yang tidak berubah dan tidak perlu dikerjakan

- Seluruh CRUD workflow, katalog blok, template, dan assistant tidak menyentuh chain sama sekali. Tidak ada yang perlu diubah di sana.
- Graph tetap milik database backend. Kontrak hanya menyimpan `Step[]` hasil encoding, tanpa koordinat dan tanpa metadata canvas.
- Urutan eksekusi tetap ditentukan backend. Kontrak menjalankan array apa adanya dan tidak pernah mengurutkan ulang.
- Validasi graph tetap di backend. Kontrak hanya menegakkan hal yang murah dan penting: minimal 1 step, maksimal 16 step, adapter harus terdaftar, dan slippage minimum tidak boleh nol.
- Backend tetap tidak memegang private key, dan tidak perlu memegangnya untuk fitur apa pun yang sudah ada.

## 11. Perubahan karena session layer yang menyentuh backend

1. Event `ExecutorChanged` diganti `ExecutorPublished` dan `ExecutorRetired`.
2. Ada tiga event baru dari vault yang boleh diindeks kalau ingin menampilkan riwayat izin: `ExecutorAccepted`, `SessionSet`, `SessionRevoked`.
3. Alamat semua kontrak berubah karena redeploy. Ambil dari `addresses.arc-testnet.json`.
4. Run bisa gagal karena alasan baru: `NoActiveSession`, `SessionCapExceeded`, `ExecutorNotAccepted`. Tiga error ini sebaiknya dipetakan ke `code` yang bisa dipahami frontend, misal `session_required`, `session_cap_exceeded`, dan `executor_approval_required`, supaya UI bisa menawarkan tindakan yang tepat.
5. Alur user punya langkah baru sebelum run pertama, yaitu membuka sesi. Kalau backend menyimpan status onboarding user, tambahkan langkah ini.
