# _TEMPLATE MODULE — OFFICIAL BLUEPRINT

Bu modül, **AUTO-GEN COMMIT PACK** sistemi için referans şablondur.
Yeni bir modül eklemek istediğimizde:

1. ChatGPT'ye:
   "Bro, X modülü için auto-gen commit pack ver" deriz.
2. ChatGPT bize tek bir bash bloğu verir (bu dosyadaki gibi).
3. Biz bu bloğu proje root'unda terminale yapıştırırız.
4. Gerekli klasörler, dosyalar ve temel kod iskeleti otomatik oluşur.

## Standart Modül Yapısı

Her modül aşağıdaki dosya / klasör düzenini takip eder:

- \`src/modules/{moduleName}/api/controller.js\`
- \`src/modules/{moduleName}/api/routes.js\`
- \`src/modules/{moduleName}/service.js\`
- \`src/modules/{moduleName}/repo.js\`
- \`src/modules/{moduleName}/docs/{MODULE}.md\`
- \`src/modules/{moduleName}/docs/CHANGELOG.md\`

Bu _template modülü, canlı sistemle bağlı değildir.
Sadece **yeni modüller için blueprint** olarak kullanılır.

## AUTO-GEN COMMIT PACK MANTIĞI

- ChatGPT her modül için:
  - Klasörleri oluşturur (mkdir -p ...)
  - Dosya içeriklerini \`cat << 'EOF' > ...\` ile yazar
- Bizim tek işimiz:
  - Bloğu yapıştırmak
  - Gerekirse \`src/app.js\` içine router import & use eklemek

Bu sayede:
- Setup süresi çok kısalır
- Modüller arası mimari tutarlılık korunur
- Backend modül ekleme işi, "tek komutla modül kurulumuna" döner

## Kullanım Örneği

Yeni bir modül hayal edelim: \`brain\`.

ChatGPT'den:

> "brain modülü için auto-gen commit pack üret"

diye isteriz.
O da bize bu \`_template\` yapısına uygun bir paket verir.

Biz de:
- Terminalde backend projesi root'una geçeriz
- Script'i yapıştırırız
- Sonra \`src/app.js\` içine aşağıdaki gibi route ekleriz:

\`\`\`js
const { brainRouter } = require('./modules/brain/api/routes');
app.use('/api/brain', brainRouter);
\`\`\`

Hepsi bu.
