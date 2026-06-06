# Setup Online Kasir Warung

## 1. Supabase

1. Buka project Supabase.
2. Masuk ke SQL Editor.
3. Copy isi `supabase-schema.sql`.
4. Paste ke SQL Editor, lalu Run.
5. Buka Project Settings > API.
6. Copy `Project URL` dan `anon public key`.
7. Buka file `config.js`, lalu isi:

```js
window.WARUNG_POS_CONFIG = {
  supabaseUrl: "https://project-id.supabase.co",
  supabaseAnonKey: "anon-public-key",
};
```

Jangan gunakan `service_role key` di aplikasi frontend.

## 2. Login

Cara paling simpel untuk 1 warung:

1. Buka aplikasi.
2. Isi email dan password.
3. Klik `Buat Akun Baru`.
4. Kalau Supabase meminta konfirmasi email, buka email lalu klik link konfirmasi.
5. Login lagi dengan email dan password yang sama.

Gunakan akun yang sama di HP kasir dan HP pemilik supaya data produk, stok, dan penjualan sama.

## 3. GitHub Pages

Opsi folder paling mudah:

1. Copy semua file di folder ini ke repo GitHub.
2. Pastikan `index.html` ada di root repo.
3. Commit dan push ke branch `main`.
4. Di GitHub repo, buka Settings > Pages.
5. Source: `Deploy from a branch`.
6. Branch: `main`, folder: `/root`.
7. Save.
8. Tunggu beberapa menit sampai URL GitHub Pages muncul.

Setelah URL muncul, buka aplikasi dari HP kasir dan HP pemilik, lalu login dengan akun yang sama.

## 4. Supabase Auth URL

Setelah punya URL GitHub Pages:

1. Buka Supabase Dashboard.
2. Masuk ke Authentication > URL Configuration.
3. Isi `Site URL` dengan URL GitHub Pages.
4. Tambahkan URL yang sama ke `Redirect URLs` jika email confirmation dipakai.

Ini membantu link konfirmasi email kembali ke aplikasi yang benar.
