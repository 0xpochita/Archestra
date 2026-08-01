# Laporan: Menyambungkan Studio ke Arc Testnet

Ringkasan pekerjaan frontend dari `f10235f` sampai `4df3e15`: 15 commit, 75 file, +13.982 / -927 baris.

Sebelum ini studio cuma mock: kanvas cantik, tombol Run yang menyalakan node pakai timer, nol koneksi ke chain. Sekarang seorang user bisa connect wallet, menyimpan workflow ke `WorkflowRegistry`, membuka sesi belanja, mengisi vault, menjalankan strategi, dan melihat kanvas menyala dari event on-chain yang asli.

Dokumen sumber: `plan/infoutkFE.md`, `contracts/exports/`. Rencana kerjanya ada di `frontend/agents/plan/` (architecture, roadmap, tasks).

---

## 1. Apa yang sekarang bisa dilakukan user

Alurnya satu tombol yang isinya berubah mengikuti syarat yang belum terpenuhi:

```
Connect wallet -> Create on chain -> Open a session -> Fund the vault -> Run strategy
```

Tombolnya tidak pernah meminta tanda tangan untuk keadaan yang pasti ditolak chain. Tanpa wallet, tombolnya jadi "Preview run" dan animasi mock lama tetap hidup, jadi orang bisa main-main tanpa punya wallet.

Panel kanan menampilkan alamat vault (dengan tautan explorer), saldo 5 token demo, status sesi per token, tombol Mint / Fund / Withdraw, dan versi executor yang diterima vault.

---

## 2. Temuan penting selama riset

Ini bagian yang mengubah bentuk pekerjaan, bukan sekadar detail implementasi.

### 2.1 Param blok lama tidak mungkin di-encode

Dulu tiap node menyimpan `BlockParam { label, value }` dengan isi teks tampilan: `"5,000"`, `"0.5%"`, `"Aave V3 Pool"`. Tidak ada cara mengubah itu jadi `abi.encode(...)`.

Sekarang tiap node punya `config: StepConfig`, sebuah zod discriminated union untuk 10 block kind. Teks di kartu kanvas **diturunkan** dari config lewat `describeStepConfig()`, jadi keduanya tidak bisa melenceng. Inspector tab Input sekarang render kontrol bertipe: select token dari registry, input jumlah dengan tombol Max, fee tier, comparator.

### 2.2 Siklus di graph tidak pernah terdeteksi (bug lama)

`getExecutionOrder` (Kahn) menempelkan node yang tidak terjangkau ke ekor hasil:

```ts
const unreached = graph.nodes.map(n => n.id).filter(id => !order.includes(id));
return [...order, ...unreached];  // <- ini
```

Artinya urutan selalu terlihat "lengkap", jadi graph bersiklus lolos validasi. Untuk animasi mock tidak kelihatan (semua node tetap menyala). Untuk `Step[]` yang dikirim on-chain itu fatal: urutan eksekusinya jadi ngawur. Ekornya dihapus, preflight sekarang menolak siklus. Ditemukan oleh unit test, bukan oleh mata.

### 2.3 Blok `condition` tidak bisa jalan di Arc testnet

`MockAggregator` cuma ada di `contracts/test/mocks/`, tidak pernah di-deploy. Sudah dicek di `broadcast/DeployCore` dan `broadcast/DeployAdapters`. Jadi `GuardModule` (sudah live di `0xA61b...52c7`) tidak punya price feed untuk dibaca.

Dampak: template `guarded-exit` dan `risk-off-unwind` tidak bisa dijalankan end to end. Field feed dibiarkan diisi manual, default `0x0`, dan preflight menolaknya dengan pesan penyebab sebenarnya.

**Perlu tindakan tim kontrak:** deploy aggregator lalu masukkan alamatnya ke `addresses.arc-testnet.json`.

### 2.4 Copy UI menjanjikan hal yang kontraknya tidak punya

Blok `condition` bertuliskan "Then: Rebalance" dan template `guarded-exit` bilang "Watch pool APY". Kontraknya cuma baca price feed lalu menghentikan run lebih awal, tidak ada cabang rebalance, tidak ada APY. Copy-nya dibetulkan.

### 2.5 Error CORS itu sebenarnya rate limit

`rpc.testnet.arc.network` membalas `429 request limit reached`, dan pada respons error itu header CORS-nya hilang, jadi browser melaporkannya sebagai pelanggaran CORS. Hasil probe lima endpoint:

| Endpoint | Status | CORS |
| --- | --- | --- |
| `rpc.testnet.arc.io` | 200 | ada |
| `arc-testnet.drpc.org` | 200 | `*` |
| `rpc.blockdaemon.testnet.arc.network` | 200 | `*` |
| `rpc.quicknode.testnet.arc.network` | 200 | ada |
| `rpc.testnet.arc.network` | **429** | hilang |

Solusinya `fallback` bawaan viem: lima endpoint berurutan, yang kena limit ditaruh paling akhir, plus `batch: true` supaya jumlah request turun.

### 2.6 Deadline swap tersimpan permanen di chain

`deadline` masuk ke `params` saat `create`, tidak dihitung ulang tiap run. Deadline pendek berarti semua run terjadwal berikutnya gagal `DeadlinePassed`. Di UI disimpan sebagai **jumlah hari** (default 30) dan baru dijadikan timestamp absolut saat encode. Field-nya diberi keterangan risikonya.

---

## 3. Yang dibangun, per lapisan

### Lapisan chain (murni, bisa diuji tanpa browser)

| File | Isi |
| --- | --- |
| `src/lib/chain/generated/` | ABI + alamat hasil `scripts/sync-contracts.mjs`, di-commit, CI gagal kalau basi |
| `src/lib/chain/adapters.ts` | Peta block kind ke `stepType` + alamat adapter |
| `src/lib/chain/tokens.ts` | Registry 5 token demo: alamat, simbol, desimal (6 vs 18) |
| `src/lib/chain/encode-steps.ts` | Graph jadi `Step[]`, resolusi `max` ke `2^256-1` |
| `src/lib/chain/decode-run.ts` | Receipt jadi `RunOutcome` |
| `src/lib/chain/errors.ts` | 18 custom error jadi `{ code, title, detail, action }` |
| `src/lib/chain/run-stage.ts` | Mesin prasyarat run sebagai fungsi murni |
| `src/lib/schemas/step-config.ts` | Sumber tunggal tipe config per blok |

### Hooks

`useVault` (alamat vault, saldo, executor yang diterima), `useSession` (baca/atur/cabut sesi), `useVaultActions` (mint, fund, withdraw, acceptExecutor), `useWorkflowRun` (create, simulate, run, decode receipt).

Semua baca chain lewat react-query, tidak ada data chain yang disalin ke state komponen.

### Komponen baru

`WalletButton`, `VaultPanel`, `SessionSection`, `FundingSection`, `ActivateStrategyModal`, `OnChainStatus`, `PreflightNotice`, `RunReceiptPanel`, `ExecutorBanner`, `StepConfigFields`, `ui/Field`, `ui/AddressLink`.

---

## 4. Keputusan teknis dan alasannya

**Dependency:** viem (encode/decode ABI), wagmi (siklus koneksi), react-query (server state, aturan §9 melarang `useEffect` fetch), zod (batas kepercayaan), vitest.

**RainbowKit memaksa wagmi turun ke v2.** Rilis terbaru RainbowKit (2.2.11) peer-nya `wagmi ^2.9.0` dan tidak ada versi yang mendukung wagmi 3. Tiga call site menyesuaikan: `useConnection` -> `useAccount`, `.mutateAsync` -> `.writeContractAsync`. RainbowKit juga menarik `@coinbase/cdp-sdk` yang meng-import `@x402/*`, jadi paket itu ikut dipasang supaya build resolve.

**`RainbowKitProvider` merender `<div data-rk>` sungguhan**, bukan context kosong. Kalau ditaruh di antara container `h-svh` dan isi halaman, rantai flex putus dan kanvas kolaps. Providernya harus di luar container. Ini yang bikin tampilan studio sempat rusak.

**Katalog blok naik ke shared layer.** Begitu `(main)/index.tsx` memasang ChainProvider, halaman `/workflows` ikut menarik wagmi karena mengimpor `BLOCK_CATALOG` lewat public API `(main)`. Dipindah ke `src/constants/blocks.ts`, `src/types/block.ts`, `src/components/ui/BlockGlyph.tsx`.

**Provider di layout route group `(main)`.** Studio dan galeri berbagi satu koneksi dan satu cache. Landing ada di group lain, jadi tetap nol byte wallet.

**Simulasi sebelum tanda tangan.** Transaksi yang revert tidak memancarkan event apa pun dan `useWaitForTransactionReceipt` tidak melempar, dia cuma pulang dengan `status: "reverted"`. Alasan gagalnya hilang setelah gas terbakar. Jadi `useSimulateContract` dipakai duluan: `NoActiveSession`, `SessionCapExceeded`, `ExecutorNotAccepted` terbaca sebelum wallet terbuka.

**Isi vault pakai `transfer` langsung**, bukan `approve` + `vault.deposit`. Satu tanda tangan bukan dua. Konsekuensinya event `Deposited` tidak menyala, dan kita memang tidak memakainya.

**Tidak menambah token warna status.** Palet sengaja hitam-putih, jadi error field ditandai tebal + garis kiri. Kebetulan itu juga jawaban aksesibilitas yang benar: makna tidak boleh bergantung warna saja.

**Zod tidak dipakai di atas hasil decode ABI.** ABI sudah jadi schema-nya, mismatch langsung throw di dalam decoder viem. Zod tetap untuk env, JSON (fixture), form, dan storage.

---

## 5. Janji produk yang dijaga di UI

1. **Withdraw tidak pernah dikunci.** Tidak oleh sesi, tidak oleh executor, tidak oleh status pause. Satu-satunya syarat: angkanya valid.
2. **Vault cuma menuruti executor yang pemiliknya setujui.** Run dikirim ke `vault.acceptedExecutor()`, bukan `registry.executor()`. Banner persetujuan muncul hanya kalau `registry.executor()` bukan `0x0` **dan** berbeda dari yang diterima vault.
3. **Guard stop bukan kegagalan.** `stopped: true` dirender sebagai run sukses yang berhenti lebih awal.
4. **Gas dilaporkan per run, bukan per step**, karena chain memang tidak punya angka per step.

---

## 6. Keamanan

Header sudah dikirim dan diverifikasi lewat `curl -D-`:

- `connect-src` dibatasi ke self + lima origin RPC Arc
- `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`
- `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS

Tidak ada private key di frontend. Semua transaksi ditandatangani wallet user. Alamat kontrak selalu dari modul generated, tidak pernah dari input user atau query param, jadi tautan jahat tidak bisa mengalihkan approval.

**Utang yang dicatat:** `script-src` masih memuat `'unsafe-inline'` dan `'unsafe-eval'` karena CSP berbasis nonce butuh middleware. Tercatat sebagai FE-34, bukan disembunyikan.

---

## 7. Testing

42 test di 6 file, semua lapisan murni:

- `encode-steps`: 10 kind, 8 template, skala desimal (1 dUSDC = `1000000`, bukan 18 desimal), `max` = `2^256-1`, penolakan minimum nol dan swap token sama
- `decode-run`: diuji lawan `contracts/exports/fixtures/run-fixture.json` asli, 5 baris `run_steps` cocok persis, gas 685.001
- `errors`: 8 kasus termasuk selector tak dikenal dan penolakan tanda tangan
- `run-stage`: urutan prasyarat
- `preflight`: graph kosong, 17 step, siklus, feed kosong, peringatan percabangan
- `step-config`: pemilihan token untuk sesi, format kedaluwarsa

CI menjalankan sync check, format, lint, type-check, test, build.

---

## 8. Ukuran bundle

| Route | Total | Kode wallet |
| --- | --- | --- |
| `/` landing | 781 kB | 0 |
| `/workflows` | 1794 kB | 603 kB |
| `/studio` | 1956 kB | 603 kB |

Landing bersih karena ada di route group terpisah. Galeri membayar 603 kB sejak tombol connect wallet ditaruh di sana.

---

## 9. Sisa pekerjaan

| Id | Isi | Kenapa belum |
| --- | --- | --- |
| FE-32 | Walkthrough Arc testnet: mint, create, session, fund, run, guarded stop, withdraw | Butuh wallet berisi dana |
| FE-33 | `/studio` tidak ter-prerender sama sekali; `useSearchParams` menaruh seluruh studio di balik `Suspense fallback={null}` | Kondisi lama, bikin target LCP tidak berarti |
| FE-34 | CSP berbasis nonce | Butuh middleware, keputusan tersendiri |
| FE-35 | Component test (Testing Library) | Butuh 3 dev dependency baru dan mock transport wagmi; logika di bawahnya sudah tertutup test murni |

Di luar frontend: **tim kontrak perlu men-deploy price feed** supaya blok `condition` bisa dipakai.

---

## 10. Daftar commit

```
0efab1c docs(frontend): plan the arc testnet integration
9a6f02f build(frontend): add the chain client stack and raise the ts target
b1a640a feat(chain): generate abi and address modules from the contract exports
ef90af2 feat(chain): configure arc testnet with an rpc fallback list
7278c6a refactor(blocks): promote the block catalog to the shared layer
e93b658 feat(studio): give every block a typed step configuration
2adc8e0 feat(ui): add form fields, an address link and three icons
8955ae2 feat(chain): encode a workflow into contract steps
a743f0a fix(studio): detect cycles instead of appending unreachable nodes
27398b9 feat(chain): decode a run receipt and map every custom error
d337cf8 feat(studio): read the vault, sessions and run state from chain
c8912cf feat(studio): wire the canvas to arc testnet
b6a58e8 feat(security): send a content security policy and hardening headers
81b99f0 feat(studio): connect wallets through rainbowkit
4df3e15 feat(workflows): offer the wallet connect button on the gallery
```
