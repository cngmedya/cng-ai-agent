---

# CHANGELOG – Shared AI (LLM Client)

## [1.1.0] – 2025-12-05
- `chatJson` fonksiyonuna `response_format: { type: 'json_object' }` eklendi.
- Model cevabında ```json ... ``` code block veya ekstra metin olsa bile:
  - JSON gövdesi otomatik olarak ayıklanıp parse edilmeye çalışılıyor.
- Hata yönetimi iyileştirildi:
  - Parse edilemeyen cevaplarda, ham content’in sadece ilk ~600 karakteri preview olarak hata mesajına yazılıyor.
- `research` modülü ve `intel` pipeline’ındaki JSON parse hataları pratikte ortadan kaldırıldı.

## [1.0.0] – 2025-12-03
- `chat` fonksiyonu eklendi (serbest metin cevaplar için).
- `chatJson` fonksiyonu eklendi (JSON tabanlı cevaplar için).
- Ortak OpenAI client (`OPENAI_API_KEY` + `OPENAI_MODEL`) yapılandırıldı.