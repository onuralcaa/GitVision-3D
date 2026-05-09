# GitVision 3D — Kod Şehri Görselleştirici (İskelet)

Bu proje React + React Three Fiber kullanarak bir GitHub repo dosya yapısını 3B "Kod Şehri" olarak görselleştiren bir iskelettir.

Özellikler (iskelet):
- Octokit ile GraphQL kullanarak repo varsayılan dalını alır.
- REST `git/trees?recursive=1` ile dosya ağacını alır.
- Dosyaları, klasörleri grup olarak, dosyaları yükseklikleri kod satırı sayısına göre kutular olarak render eder.
- `OrbitControls` ile kamera kontrolü.
- Son commit tarihine göre dinamik renk: yeni=parlak, eski=mat.

## Hızlı başlangıç

### 1. Node.js kurulu mu kontrol edin
```bash
node --version
npm --version
```

### 2. Bağımlılıkları yükleyin
```bash
npm install
```

### 3. GitHub Personal Access Token alın

GitHub API kullanabilmek için bir token gereklidir:

1. https://github.com/settings/tokens adresine gidin
2. "Generate new token (classic)" butonuna tıklayın
3. Token adı girin (ör. "GitVision 3D")
4. Kapsamlar: `public_repo` seçin (yeterlidir)
5. Token oluşturun ve kopyalayın

### 4. `.env` dosyasını oluşturun

Proje kök dizininde:
```bash
cp .env.example .env
```

`.env` dosyasını açıp token'ı ekleyin:
```
VITE_GITHUB_TOKEN=ghp_your_actual_token_here
```

### 5. Dev sunucusunu çalıştırın
```bash
npm run dev
```

Tarayıcıda `http://localhost:5173` adresine gidin.

### 6. Bir GitHub repo URL'si girin

Örnek:
- `https://github.com/facebook/react`
- `https://github.com/torvalds/linux`

"Fetch" butonuna tıklayın ve 3D şehir oluşacaktır!

## Kontroller

- **Mouse Scroll**: Yakınlaş/Uzaklaş
- **Mouse Drag**: Kamera döndür
- **Right Click Drag**: Kamera pan

## Notlar

- Bu iskelett gösterim amaçlıdır; çok büyük repolar (10000+ dosya) yavaş olabilir.
- Commit tarihleri per-file REST çağrıları ile çekilir; performans için batch işlemler optimize edilebilir.
- Renk, yükseklik, düzenleme `src/components/City.jsx` içinde özelleştirilebilir.

## Bağımlılıklar

- **React**: UI framework
- **@react-three/fiber**: React-Three.js entegrasyonu
- **@react-three/drei**: R3F yardımcı bileşenleri (OrbitControls vb.)
- **Three.js**: 3D grafikleri
- **@octokit/core**: GitHub API client
- **Vite**: Build tool

## Sorun giderme

**Hata: "API rate limit exceeded"**
- `.env` dosyasında token'ı düzgün ayarladığınız kontrol edin.

**Hata: "Failed to fetch repo"**
- Repo URL'si doğru olduğundan emin olun (formatı: `https://github.com/owner/repo`).
- Token'ın `public_repo` kapsamına sahip olduğunu kontrol edin.

**3D şehir görünmüyor**
- Tarayıcı konsolunu açın (F12) ve hataları kontrol edin.
- WebGL desteğini kontrol edin (modern tarayıcılarda varsayılan desteklenmiştir).

