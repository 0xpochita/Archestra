# Cara Pakai Smart Contract Archestra (untuk Frontend dan Backend)

Dokumen ini semua yang dibutuhkan untuk menyambungkan studio ke kontrak yang sudah live. Tidak perlu baca Solidity.

Sumber file yang bisa langsung diimpor:

- ABI: `contracts/exports/abi/*.json`
- Alamat: `contracts/exports/addresses.arc-testnet.json`
- Fixture event untuk tes indexer tanpa chain: `contracts/exports/fixtures/run-fixture.json`
- Referensi teknis lengkap: `contracts/exports/README.md`

**ABI mana yang dipakai untuk apa.** Yang berawalan `I` adalah interface, isinya cukup untuk alur inti dan stabil antar redeploy. Yang tanpa `I` adalah kontrak konkret, dipakai kalau butuh fungsi tambahan:

| File ABI | Dipakai untuk |
| --- | --- |
| `WorkflowRegistry.json` | `create`, `get`, `executor`, `isExecutor`, `isAdapterAllowed`, `MAX_STEPS` |
| `StrategyVault.json` | `setSession`, `revokeSession`, `sessionOf`, `sessionSpentToday`, `acceptedExecutor`, `acceptExecutor`, `deposit`, `withdraw`, event `Deposited` dan `Withdrawn` |
| `Executor.json` | `run`, `estimate`, `paused`, dan semua event run |
| `VaultFactory.json` | `vaultOf`, `predictVault` |
| `DemoToken.json` | token demo di testnet: `mint`, `balanceOf`, `approve`, `transfer`, `decimals` |
| `AutomationTrigger.json` | `checkUpkeep`, `performUpkeep`, `lastRunAt` |

Catatan: `sessionOf`, `sessionSpentToday`, `Deposited`, dan `Withdrawn` hanya ada di `StrategyVault.json`, tidak ada di `IStrategyVault.json`. Kalau memakai yang interface saja, panggilan itu akan gagal ditemukan.

---

## 1. Jaringan

| Item | Nilai |
| --- | --- |
| Nama | Arc Testnet |
| Chain ID | `5042002` |
| RPC | `https://rpc.testnet.arc.io` |
| Explorer | `https://testnet.arcscan.app` |
| Gas token | USDC (native, jadi tidak butuh ETH) |
| Faucet | `https://faucet.circle.com` (pilih Arc Testnet, 20 USDC per 2 jam) |

Semua kontrak sudah terverifikasi di explorer, jadi bisa dibaca dan dipanggil manual dari sana kalau perlu debugging.

## 2. Alamat kontrak (deployment aktif)

Satu-satunya alamat yang perlu disimpan di config adalah **registry**. Sisanya bisa dibaca dari file `addresses.arc-testnet.json` atau dari registry itu sendiri.

**Core**

| Kontrak | Alamat | Perlu tahu untuk |
| --- | --- | --- |
| WorkflowRegistry | `0x88d8Cd3009cd7905ec0E7f895c772Edd9878b42F` | simpan workflow, baca workflow, cek allow list |
| Executor | `0xde0733d8b262b40567bfaffF6AD8fFA17284241c` | jalankan workflow, sumber semua event run |
| VaultFactory | `0x72Ff9B08eAF59ce084Da2086C30F10710bA261b7` | cari alamat vault user |
| AutomationTrigger | `0x9c332aF974549025D8D686B634E233543178Bf32` | adapter untuk step TRIGGER |
| GuardModule | `0xA61b3C8a0720411e4F9A446A125e3D0A3D2052c7` | adapter untuk step GUARD |

**Adapter per jenis step**

| Step type | Alamat adapter |
| --- | --- |
| SUPPLY (blok deposit) | `0x229537258e808b5289e092e0B086D6015481b76C` |
| REDEEM (blok withdraw) | `0x94887e966B9ed8F594e334ba7c399c45EF8e6F27` |
| SWAP (blok swap) | `0x6daA0D2A5E37EA2d4cD32695742c2931438066B2` |
| STAKE (blok yield) | `0x204Ae52F5174412c80bBA51b43F99D8f5b17ed28` |
| CLAIM (blok harvest) | `0x05482940D3772d0d7B058a8b0799d73B4f9389f5` |
| BRIDGE (blok bridge) | `0x82Cc9Cb942bD298EB984e05748fee0fa7E7580F2` |
| TRIGGER (blok trigger) | pakai alamat AutomationTrigger di atas |
| GUARD (blok condition) | pakai alamat GuardModule di atas |
| APPROVE dan NOTIFY | pakai alamat Executor di atas |

**Token demo di Arc testnet**

Aave, Uniswap, dan Curve yang asli belum ada di Arc, jadi deployment ini memakai protokol mock dan token demo. Mintnya terbuka untuk siapa saja, sengaja, supaya demo mudah.

| Token | Alamat | Desimal |
| --- | --- | --- |
| dUSDC | `0x91E5Bb4576F6871Dac3370dE39f5a772610Cc623` | 6 |
| dWETH | `0xa0c04ADb1933eEa299C72CdcABf085D0b68826a2` | 18 |
| aUSDC (bukti setoran Aave) | `0x56f59f816bEcFA38D03FCD51978D2177FA6eD157` | 6 |
| LP token Curve | `0x2cD1D64e39B980f7D5dCF920DfD4F592f8ce51bE` | 18 |
| Reward token gauge | `0x7166bDA7ee9Dc9cD4b4f2Cdcbb33b4Afdc8b414c` | 18 |

Mint token demo untuk testing: `dUSDC.mint(address, amount)`. Contoh 1.000 dUSDC berarti `amount = 1000000000` (6 desimal).

Alamat pool mock (dibutuhkan hanya untuk isi params step STAKE): curvePool `0xd4Ad99587B793f47F48dFe8Dc66A778bA342aE0E`, gauge `0x8b0B25dE221d2d37F5650DD8A3B98871E6b9D666`.

## 3. Alur lengkap dari sisi user

Yang menandatangani transaksi selalu wallet user. Backend tidak pernah memegang private key.

1. **User menggambar workflow** di canvas. Ini murni data di database backend, belum ada transaksi.
2. **Backend meng-encode graph menjadi `Step[]`** memakai tabel di bagian 5.
3. **User menekan Run pertama kali**, wallet mengirim `registry.create(steps)`. Transaksi ini sekaligus membuat vault pribadi user (kalau belum ada) dan menyimpan persetujuan versi executor pertama. Ambil `workflowId` dari event `WorkflowCreated`.
4. **User membuka sesi belanja** lewat `vault.setSession(...)` untuk setiap token yang akan dipakai strategi. Tanpa sesi, run akan gagal. Lihat bagian 4.
5. **User mengisi vault** dengan `dUSDC.transfer(vault, amount)` atau lewat `vault.deposit(token, amount)` setelah `approve` ke vault.
6. **Jalankan**: wallet mengirim `executor.run(workflowId)`. Kalau workflow punya step TRIGGER, jadwal juga bisa menjalankannya sendiri tanpa tanda tangan user lagi.
7. **Backend membaca event** dari alamat Executor dan mengisi tabel `run_steps`, lalu mendorong ke canvas via SSE. Lihat bagian 6.
8. **User bisa menarik dana kapan saja** lewat `vault.withdraw(token, amount, tujuan)`. Ini hanya bisa dipanggil pemilik vault, dan selalu berhasil dalam kondisi apa pun: sistem sedang paused, sesi habis, executor dipensiunkan, semuanya.

Mencari alamat vault user: `factory.vaultOf(ownerAddress)`. Kalau masih `0x0`, vault belum pernah dibuat. Untuk menampilkan alamat sebelum vault dibuat, pakai `factory.predictVault(ownerAddress)`, hasilnya identik.

## 4. Sesi belanja (wajib dipahami untuk UX)

Kontrak tidak boleh menyentuh dana user tanpa izin berjangka dari user. Izin itu disebut sesi, disetel per token:

```
vault.setSession(token, maxPerRun, maxPerDay, expiresAt)
```

| Parameter | Arti |
| --- | --- |
| `token` | alamat token yang diizinkan dipakai |
| `maxPerRun` | jumlah maksimal dalam satu kali eksekusi |
| `maxPerDay` | total maksimal dalam satu hari |
| `expiresAt` | unix timestamp detik, kapan izin berhenti berlaku |

Aturan yang mempengaruhi UI:

- Satu sesi per token. Strategi yang menyentuh dUSDC dan dWETH butuh dua sesi.
- Sesi juga menghitung step BRIDGE, jadi dana yang menyeberang chain ikut dibatasi.
- Kalau sesi tidak ada atau sudah kedaluwarsa, run gagal dengan `NoActiveSession`. Kalau plafon terlampaui, gagal dengan `SessionCapExceeded`.
- Cabut kapan saja: `vault.revokeSession(token)`. Efeknya langsung, tidak perlu izin siapa pun.
- Mencabut sesi tidak mengembalikan kuota harian yang sudah terpakai. Ini disengaja supaya cabut lalu buka lagi tidak bisa dipakai mengakali plafon harian.
- Baca sesi untuk ditampilkan: `vault.sessionOf(token)` mengembalikan `(maxPerRun, maxPerDay, expiresAt)`, dan `vault.sessionSpentToday(token)` mengembalikan yang sudah terpakai hari ini.

Saran UX: satu modal "Aktifkan strategi" yang menggabungkan pembuatan sesi untuk semua token yang dipakai strategi tersebut, dengan default masa berlaku 30 hari dan plafon yang diusulkan dari besaran strategi. Tampilkan sisa kuota harian dan tanggal kedaluwarsa di halaman workflow.

## 5. Cara meng-encode `Step[]`

`Step` adalah tuple `(uint8 stepType, address adapter, bytes params)`. Maksimal 16 step, minimal 1. Step dijalankan sesuai urutan array, jadi backend mengirim hasil topological sort miliknya.

Nilai `stepType`:

| Nilai | Step type | Blok di studio |
| --- | --- | --- |
| 0 | TRIGGER | trigger |
| 1 | APPROVE | approve |
| 2 | SUPPLY | deposit |
| 3 | SWAP | swap |
| 4 | STAKE | yield |
| 5 | CLAIM | harvest |
| 6 | BRIDGE | bridge |
| 7 | REDEEM | withdraw |
| 8 | GUARD | condition |
| 9 | NOTIFY | alert |

Isi `params` adalah `abi.encode(...)` sesuai jenis step:

| Step type | abi.encode(...) |
| --- | --- |
| TRIGGER | `(uint64 intervalSeconds, uint64 startAt)` |
| APPROVE | `(address token, address spender, uint256 amount)` |
| SUPPLY | `(address asset, uint256 amount)` |
| SWAP | `(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint24 feeTier, uint64 deadline)` |
| STAKE | `(address pool, address gauge, uint256 amount, uint256 minLpOut)` |
| CLAIM | `(address gauge, uint256 minValueOut)` |
| BRIDGE | `(uint64 destinationChainSelector, address receiver, address token, uint256 amount)` |
| REDEEM | `(address asset, uint256 amount)` |
| GUARD | `(address feed, int256 bound, uint8 comparator, uint64 maxStaleSeconds)` |
| NOTIFY | `(bytes32 channel, bytes32 messageId)` |

Aturan yang wajib dipatuhi encoder:

- `amount = 2^256 - 1` (max uint256) artinya "seluruh saldo token itu di vault". Berlaku untuk SUPPLY, SWAP, STAKE, dan REDEEM. Berguna untuk strategi compounding.
- `minAmountOut`, `minLpOut`, dan `minValueOut` **tidak boleh nol**. Nol ditolak kontrak karena artinya tanpa proteksi slippage. Isi dari input slippage user, misal 0,5 persen di bawah harga perkiraan.
- `deadline` pada SWAP adalah unix timestamp detik. Lewat deadline berarti gagal dengan `DeadlinePassed`.
- GUARD `comparator`: `0` berarti berhenti kalau nilai feed **di bawah** `bound`, `1` berarti berhenti kalau **di atas**.
- Adapter pada tiap step harus alamat dari tabel bagian 2. Kombinasi adapter dan step type yang tidak terdaftar ditolak dengan `AdapterNotAllowed`.

Contoh satu step SUPPLY 200 dUSDC dengan viem:

```ts
import { encodeAbiParameters, parseAbiParameters } from "viem";

const params = encodeAbiParameters(
  parseAbiParameters("address, uint256"),
  ["0x91E5Bb4576F6871Dac3370dE39f5a772610Cc623", 200_000_000n],
);

const step = {
  stepType: 2,
  adapter: "0x229537258e808b5289e092e0B086D6015481b76C",
  params,
};
```

## 6. Event yang dibaca indexer

Semua event run keluar dari alamat **Executor**. Satu run adalah satu transaksi, gagal berarti seluruhnya dibatalkan, jadi transaksi yang gagal tidak memancarkan event apa pun.

Urutan event dalam satu run:

1. `RunStarted(bytes32 indexed runId, uint256 indexed workflowId, address indexed caller)`
2. Per step yang tereksekusi, berurutan: `StepExecuted(bytes32 indexed runId, uint256 indexed position, uint8 stepType, address adapter, address tokenOut, uint256 amountOut)`. `position` mulai dari 0 dan dipetakan ke `run_steps.position`.
3. Step NOTIFY juga memancarkan `AlertRaised(bytes32 indexed runId, bytes32 indexed channel, bytes32 messageId)` sebelum `StepExecuted` miliknya.
4. GUARD yang gagal bound memancarkan `GuardStopped(bytes32 indexed runId, uint256 indexed position, int256 answer)`, tidak memancarkan `StepExecuted` untuk posisi itu, lalu run berakhir lebih awal. **Ini bukan kegagalan**, ini run yang sukses dengan `stopped = true`.
5. `RunCompleted(bytes32 indexed runId, bool stopped, uint256 stepsExecuted)` selalu menutup rangkaian.

`runId = keccak256(abi.encode(uint256 workflowId, uint256 blockNumber, address caller, uint256 nonce))`, dengan nonce adalah penghitung di dalam executor.

Event dari registry: `WorkflowCreated`, `WorkflowUpdated`, `ExecutorPublished`, `ExecutorRetired`.

Event dari vault: `ExecutorAccepted`, `SessionSet`, `SessionRevoked`, `Deposited`, `Withdrawn`.

Catatan penting untuk indexer:

- Kunci utama adalah `runId`, jangan mengunci pada alamat pemancar. Alamat Executor bisa berganti saat ada versi baru, dan event lama tetap sah di alamat lama.
- Simpan alamat registry di config, lalu resolve alamat executor dengan memanggil `registry.executor()` saat boot. Anggap event `ExecutorPublished` atau `ExecutorRetired` sebagai sinyal reload config.
- `gasUsed` per step tidak ada di chain karena satu run adalah satu transaksi. Yang ada hanya total gas transaksi. Boleh dibiarkan null per step, atau totalnya disimpan di level run.
- Untuk mengetes indexer tanpa chain, pakai `contracts/exports/fixtures/run-fixture.json`. Bentuk event di dalamnya masih akurat, tetapi alamat di file itu milik deployment lama, jadi jangan dipakai sebagai sumber alamat.

## 7. Error yang mungkin muncul dan artinya untuk user

Kontrak memakai custom error, jadi frontend perlu mencocokkan selector atau memakai `decodeErrorResult` dari ABI.

| Error | Arti untuk user | Solusi di UI |
| --- | --- | --- |
| `NoActiveSession(token)` | belum ada izin belanja atau izinnya habis | tawarkan buka atau perpanjang sesi |
| `SessionCapExceeded(token, requested, remaining)` | melebihi plafon, `remaining` adalah sisa yang masih boleh | tampilkan sisa, tawarkan naikkan plafon |
| `ExecutorNotAccepted(given, accepted)` | ada versi mesin baru yang belum disetujui pemilik vault | tawarkan tombol setujui versi baru |
| `NotOwner()` | yang memanggil bukan pemilik workflow atau vault | cek wallet yang terhubung |
| `SystemPaused()` | sistem sedang dihentikan sementara | tampilkan status pemeliharaan, tarik dana tetap bisa |
| `WorkflowInactive()` | workflow dimatikan | tawarkan aktifkan kembali |
| `EmptyWorkflow()` | tidak ada step | validasi di frontend sebelum kirim |
| `TooManySteps(given, max)` | lebih dari 16 step | validasi di frontend |
| `AdapterNotAllowed(adapter, stepType)` | pasangan adapter dan step type salah | biasanya bug encoder, cek tabel bagian 2 |
| `InsufficientOutput(got, min)` | hasil di bawah minimum, slippage | tawarkan longgarkan slippage atau coba lagi |
| `DeadlinePassed(deadline)` | deadline swap terlewat | perbarui deadline lalu coba lagi |
| `StaleFeed(updatedAt, maxStale)` | data harga terlalu tua | naikkan toleransi staleness di blok condition |
| `InvalidFeedAnswer(answer)` | feed harga mengembalikan nilai tidak wajar | masalah oracle, tampilkan pesan coba lagi nanti |
| `TriggerNotDue(nextRunAt)` | jadwal belum waktunya | tampilkan waktu jalan berikutnya |
| `NoTriggerStep()` | workflow tidak punya step trigger untuk dijadwalkan | validasi di frontend |
| `RunInFlight()` | workflow sedang berjalan, tidak bisa diubah | disable tombol simpan selama run |

## 8. Yang perlu ditampilkan di UI (rangkuman kebutuhan baru)

1. **Modal aktifkan strategi**: buat sesi per token dengan input plafon per run, plafon harian, dan masa berlaku.
2. **Panel status sesi** di halaman workflow: sisa kuota hari ini, tanggal kedaluwarsa, tombol cabut.
3. **Banner setujui versi baru**: muncul hanya ketika `registry.executor()` bukan `0x0` **dan** berbeda dari `vault.acceptedExecutor()`. Tombolnya memanggil `vault.acceptExecutor(alamatBaru)`. Jangan tampilkan banner saat `registry.executor()` masih `0x0`, itu artinya belum ada versi yang diterbitkan, bukan ada versi baru.
4. **Tombol tarik dana** yang selalu aktif, tanpa syarat apa pun.
5. **Alamat vault user** ditampilkan dengan tautan ke explorer, supaya user bisa memverifikasi sendiri bahwa dananya ada di kontrak miliknya.

Poin 3 dan 4 adalah inti janji produk: platform tidak bisa mengganti mesin yang mengelola dana user tanpa persetujuan user, dan penarikan dana tidak butuh izin siapa pun.

## 9. Hal yang penting diketahui soal keamanan

- Dana user tidak pernah berada di server, tidak pernah dicampur dengan dana user lain, dan tidak pernah dipegang platform. Setiap user punya kontrak vault sendiri.
- Backend tidak pernah menyimpan private key. Semua transaksi ditandatangani wallet user.
- Executor tidak boleh menyimpan saldo. Setiap hasil langkah wajib kembali ke vault dalam transaksi yang sama.
- Kalau kunci admin kami bocor, penyerang bisa menerbitkan mesin baru, tetapi vault user tidak akan mematuhinya sampai pemiliknya menyetujui, dan bahkan mesin yang sah pun terbatas plafon sesi. Ini sudah diuji langsung di Arc testnet: percobaan mesin terdaftar yang belum disetujui ditolak dengan `ExecutorNotAccepted`.
- Untuk mainnet nanti masih ada pekerjaan tambahan: multisig plus timelock untuk peran admin, dan review keamanan pihak kedua.
