# Giyim Yardımı Yönetimi

Windows x64 için çevrimdışı çalışan masaüstü uygulamasıdır. Tek bir `.exe` dosyası olarak yayımlanır. Personel ve işlem verileri `%LOCALAPPDATA%\GiyimYardimi\veriler.json` içinde saklanır. Uygulama arayüzü için Microsoft Edge WebView2 Runtime gerekir.

## Başlangıç

1. Kurumlar sayfasında İlçe Millî Eğitim Müdürlüğünü ve bağlı okul/kurumları tanımlayın.
2. Personel Havuzu sayfasında her personelin kurumunu ve unvanını kaydedin. CSV içe aktarma sütunları: `Ad Soyad;Kurum;Unvan;Hizmet Sınıfı`; `T.C. Kimlik No` isteğe bağlıdır.
3. İmza ve Talimat Ayarları sayfasında gerçekleştirme görevlisi, harcama yetkilisi ve gerekçe/hukuki dayanak varsayılanlarını kaydedin. Bu bilgiler yeni talimatlara otomatik aktarılır.
4. Yıllık Fiyat Listesi sayfasında **Bakanlık PDF fiyat listesini içe aktar** düğmesiyle Ek-1 ve/veya Ek-2 PDF'lerini seçin. Aktarım önizlemesinde yıl, yardım türü, satır sayısı ve fiyatları kontrol edip onaylayın. Elle fiyat girişi veya güncellemesi de mümkündür.
5. Ödeme Dönemi sayfasında yıl ve kurum seçin. Kurum personel listesinde yardım alacak kişileri işaretleyin; kişi kartındaki giyecek tablosunda verilecek kalemleri, yardım türünü (ayni/nakdi) ve miktarı seçin.
6. Seçimleri tamamlayıp listeyi kaydedin. Harcama talimatı ekranındaki alanları gözden geçirin; imza ve hukuki dayanak bilgileri varsayılanlardan gelir ve işlem bazında değiştirilebilir. İki PDF, gönderdiğiniz örneklerle aynı yönde hazırlanır: dikey A4 harcama talimatı ve yatay A4 dağıtım listesi. İkisi de **Masaüstü\Giyim Yardımı Çıktıları** klasörüne kaydedilir.

## Yıllık fiyatlar

2026 için ekli PDF'deki Ek-1 ayni ve Ek-2 nakdi fiyatları başlangıç listesine aktarılmıştır. Sonraki yıllar için Yıllık Fiyat Listesi sayfasındaki **Yeni yıl oluştur** düğmesi bir önceki yılın kalemlerini kopyalar; yeni genelge fiyatlarını kontrol edip düzenleyin. Kullanım süresi kaynak PDF'de belirtilmediğinden boş bırakılmıştır; geçerli süreyi yetkili mevzuat bilgisine göre girin. Uygulama Bakanlığın internet sayfasını otomatik takip etmez.

PDF aktarımı metin katmanı bulunan Bakanlık PDF'lerini okur; taranmış görüntü PDF'lerinde OCR yapmaz. İçe aktarma önizlemesinde eksik satır algılanırsa kaydetme engellenir. Resmî ödeme öncesi fiyat listesini kontrol edin.

## Önemli kullanım bilgileri

- Örnek Excel dosyasındaki mevcut personel ve kimlik kayıtları içe aktarılmamıştır. Personel havuzunu kurum kayıtlarınıza göre oluşturun.
- T.C. kimlik numarası isteğe bağlıdır; yedek dosyaları personel verisi içerebilir. Yedekleri kurumunuzun bilgi güvenliği kurallarına göre koruyun.
- Bütçe tertibi, ödenek ve imza yetkilisi bilgileri kurum tarafından doğrulanıp girilmelidir. Uygulama bu bilgileri kendisi belirlemez.
- Aynı kurum ve yıl için tek kayıtlı liste oluşturulur. Listeyi kaydetmeden önce personel, kalem, tür, miktar ve harcama talimatı bilgilerini kontrol edin.
- PDF oluşturma özelliği Windows masaüstü klasörüne yazar. Masaüstü OneDrive'a yönlendirilmişse dosyalar o konumdaki masaüstüne kaydedilir.

## Veri güvenliği ve yedekler

Uygulama, veri dosyasını `%LOCALAPPDATA%\GiyimYardimi\veriler.json` içinde tutar ve her kayıttan önce otomatik yedek alır:

- `yedekler\otomatik\` — son 20 kayıt öncesi kopya (saniye hassasiyetinde)
- `yedekler\gunluk\` — günlük kopya, son 30 gün
- `yedekler\veriler-BOZUK-*.json` — açılışta okunamayan dosyalar buraya taşınır

Yedekler sayfasındaki **Yedek klasörü** düğmesi bu klasörü açar. Bir yedeği geri yüklemek için ilgili `.json` dosyasını **Yedek yükle** ile seçin.

Veri dosyası açılışta okunamazsa uygulama en son geçerli otomatik yedeği kendiliğinden geri yükler ve hangi dosyadan döndüğünü bildirir.

Aynı anda yalnızca bir kopya açılabilir; ikinci kez açılırsa uyarı verip kapanır. Böylece iki pencerenin aynı veri dosyasına yazması engellenir.


## Sürüm notları

### 1.3.0

- Kurumlar ve Personel Havuzu listelerine **Düzenle** düğmesi eklendi.
- Açılan pencerelerde **Vazgeç** düğmesi artık uyarı vermeden kapatıyor.
- Yıllık Fiyat Listesi sıkıştırıldı: sabit başlık, kaydırmalı liste ve **kalem arama** alanı.
- Ödeme Dönemi'nde giyecek seçimi açılır listeye dönüştü; seçilen kişinin kalemleri ve toplamı ayrı tabloda görünüyor.
- Kayıtlı ödeme listelerine **Güncelle** ve **Sil** düğmeleri eklendi.
- İmza ve Talimat Ayarları'na **Düzenleyen** bilgisi eklendi.
- Harcama Talimatı'nda açıklama metni kuruma göre otomatik yazılır; imza alanları ayarlardan doldurulur.
- Dağıtım Listesi yatay A4 olarak, kişi adı tek satırda gruplanmış ve Düzenleyen · Kontrol Eden · Onaylayan imzalarıyla üretilir.
### 1.4.0

- Kurumlar sayfası sıkıştırıldı; sağ tarafa **kurum dağılımı** eklendi (İlkokul, Ortaokul, Ortaöğretim, Diğer kurum, İlçe idaresi). Kurum türü adından da otomatik çıkarılır.
- Ödeme Dönemi'nde onay kutusu yalnızca seçim yapar; **kişi adına tıklayınca** yardım bilgileri açılır pencerede açılır.
- Yıllık Fiyat Listesi'nden "Kullanım süresi" sütunu ve elle ekleme/yedek düğmeleri kaldırıldı; kalemler PDF içe aktarmayla gelir.
- Dağıtım listesindeki ikinci tablo kaldırıldı, yerine **genel toplam** satırı geldi; sayfa yatay üretilir.
- Harcama talimatında sayı **1** olarak sabitlendi, birim **Sivaslı İlçe Millî Eğitim Müdürlüğü** olarak yazılır, açıklama başlığı kaldırıldı, imzacı bilgileri ortalandı.
- Harcama talimatı ve dağıtım listesi artık **tek PDF** olarak kaydedilir.