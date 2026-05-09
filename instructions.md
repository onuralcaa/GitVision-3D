# Project: GitVision 3D - Instruction Manual
## 1. Project Goal
GitHub API'sini kullanarak bir repository'nin dosya yapısını, commit
yoğunluğunu ve bağımlılıklarını Three.js tabanlı bir "3D Kod
Şehri" (Code City) olarak görselleştiren bir web uygulaması
geliştirmek.
## 2. Tech Stack
- **Frontend:** React.js, React Three Fiber (R3F), Three.js
- **API:** GitHub GraphQL API (derinlikli veri çekmek için)
- **Styling:** Tailwind CSS
- **State Management:** Zustand veya React Context
## 3. Core Features
- **3D Visualization:** Klasörler platformlar, dosyalar (binalar) ve
kod satırları (bina yüksekliği) olarak temsil edilecek.
- **Dynamic Fetching:** Kullanıcı bir repo URL'si girdiğinde veriler
asenkron çekilecek.
- **Interactive Camera:** OrbitControls ile şehir içinde gezinti ve
binalara tıklayınca dosya detaylarını görme.
- **Heatmap:** Son 24 saatte değişen dosyaların neon kırmızı/turuncu
renklerle vurgulanması.
## 4. Implementation Steps
1. GitHub Octokit istemcisinin kurulumu.
2. Klasör hiyerarşisini 3D koordinat sistemine (x, z düzlemi)
yerleştiren algoritmanın yazılması.
3. React Three Fiber ile mesh yapılarının oluşturulması.
4. Hover ve Click eventlerinin tanımlanması.