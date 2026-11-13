# Giyim Yardımı Yönetimi

İlçe millî eğitim müdürlükleri ve bağlı okul/kurumlar için **giyecek (giyim) yardımı** işlemlerini yürüten çevrimdışı Windows masaüstü uygulaması.

- Personel havuzu ve kurum tanımları
- Yıllık fiyat listesi (Bakanlık PDF'inden içe aktarma veya elle giriş)
- Ayni/nakdi yardım hesaplama, kullanım süresi ve önceki ödeme kontrolü
- Resmî çıktılar: **Harcama Talimatı** (dikey A4) ve **Dağıtım Listesi** (yatay A4) PDF
- CSV içe aktarma, yedek alma/yükleme

Tek bir `.exe` olarak yayımlanır; veriler `%LOCALAPPDATA%\GiyimYardimi\veriler.json` içinde tutulur. Arayüz için Microsoft Edge WebView2 Runtime gerekir.

## Klasör yapısı

| Yol | İçerik |
| --- | --- |
| `index.html`, `app.js`, `styles.css`, `print.css` | Arayüz (uygulamanın içine gömülür) |
| `Exe/Program.cs` | Masaüstü kabuğu: yerel HTTP sunucusu, WebView2, PDF oluşturma, PDF fiyat listesi okuma |
| `Exe/GiyimYardimiExe.csproj` | .NET 9 WinForms projesi (self-contained, single-file) |
| `build.ps1` | Yayın derlemesi |
| `KULLANIM.md` | Son kullanıcı kılavuzu |
| `server.ps1`, `stop.ps1`, `Baslat.bat`, `Durdur.bat` | Tarayıcıda önizleme için geliştirme sunucusu |

## Derleme

Gereksinim: .NET 9 SDK (x64).

```powershell
.\build.ps1
```

Çıktı: `publish\Giyim Yardımı.exe`. Başka bir makineye tek dosya olarak kopyalanabilir.

İnternet olmayan bir makinede derlerken NuGet paketlerinin önbelleği kullanılabilir:

```powershell
.\build.ps1 -PackagesPath C:\yol\nuget-cache
```

## Geliştirme önizlemesi

```powershell
.\Baslat.bat   # http://127.0.0.1:38117 adresinde tarayıcıda açar
.\Durdur.bat
```

Önizleme sunucusu veriyi bu klasördeki `veriler.json` dosyasında tutar; yayımlanan uygulama ise `%LOCALAPPDATA%\GiyimYardimi\veriler.json` dosyasını kullanır.

## Sürüm

`Exe/GiyimYardimiExe.csproj` içindeki `<Version>` alanı yayın sürümünü belirler.
