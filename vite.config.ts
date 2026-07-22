import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // SharedArrayBuffer için gerekli izolasyon başlıkları. Worker'a geçtiğimizde
    // (Faz 3) bunlar olmadan SAB kullanılamaz; yoksa transferable ArrayBuffer'a düşeriz.
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    target: 'es2022',
  },
});
