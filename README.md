# Nuvio / CloudStream Birleşik Eklenti Deposu

Beş ayrı CloudStream eklenti deposunun tek bir `plugins.json` dosyasında
birleştirilmiş hâli. Depoda uygulama kodu veya `.cs3` ikilisi barındırılmaz;
dosya yalnızca sağlayıcıların adreslerini, sürümlerini ve meta verilerini taşır.

| | |
|---|---|
| Sağlayıcı sayısı | **86** (128 kayıttan, 29 tekrar grubu birleştirildi) |
| Çalışan (`status: 1`) | 71 |
| Devre dışı (`status: 0`) | 14 |
| Sorunlu (`status: 3`) | 1 |
| Toplam ikili boyutu | ~6,1 MB |
| Kaynak depo | 5 |

## Kurulum

Depo adresi:

```
https://raw.githubusercontent.com/ptmy53/nuvio-plugins/main/plugins.json
```

### CloudStream

1. **Eklentiler → Depo ekle** bölümünü açın.
2. Yukarıdaki adresi yapıştırın.
3. Listeden istediğiniz sağlayıcıları etkinleştirin.

### Nuvio TV (sideload / tam sürüm)

1. **Ayarlar → İçerik ve Keşif → Eklentiler** bölümünü açın.
2. **Depo ekle** alanına aynı adresi yapıştırın.
3. Sağlayıcıları tek tek açın ve **Test** ile doğrulayın.

Nuvio TV'nin tam sürümü CloudStream `.cs3` uzantılarını yükleyebildiği için bu
dosya doğrudan kullanılabilir. Mağaza sürümlerinde ve Nuvio Mobile'da CS3
yürütücüsü yoktur; orada yalnızca Nuvio'nun JavaScript sağlayıcı formatı
çalışır. Bu depo bir JavaScript sağlayıcı deposu **değildir**.

## Kaynaklar

| Kaynak | Girdi | Depo |
|---|---:|---|
| PLT Stream | 5 | https://github.com/pltmustafa/plt-stream |
| Manitux CS Plugins | 9 | https://github.com/manitux-app/cs-plugins |
| BTVault | 64 | https://github.com/baristomruk-max/BTVault |
| CloudStreamHub | 25 | https://github.com/Emre-Kahveci/CloudStreamHub |
| Personal CloudStream | 25 | https://github.com/patr0nq/personal_cloudstream |

Her kayıt kendi `repositoryUrl` alanını korur. İkililer (`*.cs3`) orijinal
depolarda kalır; bu depo yalnızca dizin görevi görür.

## Birleştirme kuralları

- Aynı `internalName` değerine sahip kayıtlar tek sağlayıcıya indirilir.
- Seçim sırası: çalışan kayıt (`status: 1`) → en yüksek `version` → en büyük
  `fileSize`.
- Sürüm numaraları depolar arasında karşılaştırılabilir değildir; bu nedenle
  önce çalışır durumdaki kayıt tercih edilir.
- Hiçbir alan uydurulmaz; `name`, `internalName`, `url` ve `tvTypes` zorunludur.
- Çıktı, CloudStream'in beklediği düz JSON dizisi biçimindedir.

## Yeniden üretme

```bash
npm run build      # kaynakları çeker, plugins.json üretir
npm run validate   # yapıyı doğrular
```

`npm run build:offline` son çekilen kopyayı `.cache/fetched.json` üzerinden
kullanır. Birleştirme raporu `.cache/merge-report.json` dosyasına yazılır.

## Yasal not

Bu depo hiçbir içerik barındırmaz ve hiçbir kaynağa erişim sağlamaz. Tüm
eklentiler ilgili yazarlara aittir ve kendi lisanslarına tabidir. Kaynak
sitelerin kullanım koşullarına ve bulunduğunuz ülkenin telif mevzuatına uymak
kullanıcının sorumluluğundadır.
