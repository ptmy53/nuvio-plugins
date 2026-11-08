# PT Nuvio Türkçe

Nuvio için **yerel JavaScript sağlayıcı deposu**. Mobil, TV ve Android dahil
Nuvio'nun tam (sideload) sürümlerinde çalışır. Sağlayıcı kodları cihazda
Nuvio'nun kendi JavaScript motorunda çalışır; harici sunucu veya hesap gerekmez.

## Nuvio'ya ekle

Aşağıdaki adresi kopyala:

```
https://raw.githubusercontent.com/ptmy53/nuvio-plugins/main/manifest.json
```

### Nuvio Mobile (Android / iPhone, tam sürüm)

1. **Ayarlar → İçerik ve Keşif → Eklentiler** bölümünü aç.
2. **Depo ekle / Plugin manifest URL** alanına yukarıdaki adresi yapıştır.
3. **Kur** de, ardından **sağlayıcıları** tek tek etkinleştir.
4. **“Eklenti sağlayıcılarını genel olarak etkinleştir”** anahtarının açık olduğundan emin ol.

### Nuvio TV / Android TV (tam sürüm)

1. **Ayarlar → İçerik ve Keşif → Eklentiler → Depo ekle** bölümünü aç.
2. Adresi yapıştır (kumandayla yazmak istersen yalnızca `ptmy53/nuvio-plugins` de yeterli).
3. Depo yüklendikten sonra sağlayıcıları aç ve **Test** ile doğrula.

> Mağaza (Play Store / App Store) sürümlerinde eklentiler tamamen kapalıdır.
> GitHub Releases üzerinden kurulan **tam/sideload** sürüm gerekir.

## Kapsam

| | |
|---|---|
| Nuvio sağlayıcısı | **55** |
| Kaynak depo | 4 |
| Platform | Nuvio Mobile, Nuvio TV, Android TV (tam sürüm) |
| Dil | Türkçe ağırlıklı |
| Format | HLS / M3U8 / MP4 / MKV |

Sağlayıcıların tam listesi: **[PROVIDERS.md](PROVIDERS.md)**

### Kaynaklar ve lisanslar

| Depo | Seçilen | Lisans |
|---|---:|---|
| [falsisdev/anthology](https://github.com/falsisdev/anthology) | 34 | GPL-3.0 |
| [csprofesor/csnuvio](https://github.com/csprofesor/csnuvio) | 15 | belirtilmemiş |
| [mooncrown04/nuviotr](https://github.com/mooncrown04/nuviotr) | 4 | belirtilmemiş |
| [fmustafayaman/turkish-nuvio](https://github.com/fmustafayaman/turkish-nuvio) | 2 | GPL-3.0 |

Bu depo sağlayıcı kodlarını kopyalamaz; `manifest.json` her sağlayıcıyı kendi
kaynak deposundaki güncel dosyaya mutlak URL ile bağlar. Böylece upstream
düzeltmeleri yeniden derleme gerektirmeden kullanıcıya ulaşır.

## Aynı depodaki CloudStream dizini

`plugins.json`, beş CloudStream deposunun birleştirilmiş hâlidir (86 `.cs3`
uzantısı). Yalnızca CloudStream'de ve CS3 yükleyicisi olan Nuvio TV Android tam
sürümünde kullanılabilir; **Nuvio Mobile `.cs3` çalıştıramaz**.

```
https://raw.githubusercontent.com/ptmy53/nuvio-plugins/main/plugins.json
```

CloudStream: **Eklentiler → Depo ekle** yoluna bu adresi yapıştır.

## Neden 86 değil 55 sağlayıcı?

`plugins.json` içindeki 86 kayıt derlenmiş CloudStream uzantısıdır (`.cs3`).
Nuvio Mobile yalnızca JavaScript sağlayıcı çalıştırdığı için bu dosyalar orada
kullanılamaz. Bu depodaki `manifest.json`, aynı Türkçe siteler için mevcut ve
doğrulanmış Nuvio JavaScript portlarını bir araya getirir. JavaScript portu
bulunmayan CloudStream uzantıları yalnızca CS3 destekli istemcilerde kalır.

Canlı TV / kanal kataloğu sağlayıcıları, her dizi aramasında çalışıp gecikme
yaratmaması için akış manifestine alınmamıştır. Canlı kanallar için Anthology
deposunu ayrıca ekleyebilirsin.

## Yeniden üretme

```bash
npm run build            # plugins.json + manifest.json + PROVIDERS.md
npm run build:nuvio      # yalnızca Nuvio manifesti
npm run build:offline    # CloudStream dizinini son önbellekten üret
npm run validate         # yapı + tüm sağlayıcı URL'lerini doğrula
```

`.github/workflows/rebuild.yml` her hafta kaynakları yeniler ve değişiklikleri
otomatik commit eder.

## Yasal not

Bu depo hiçbir video içeriği barındırmaz ve hiçbir kaynağa erişim sağlamaz.
Sağlayıcı kodları ilgili yazarlara aittir ve kendi lisanslarına tabidir. Kaynak
sitelerin kullanım koşullarına ve bulunduğun ülkenin telif mevzuatına uymak
kullanıcının sorumluluğundadır.
