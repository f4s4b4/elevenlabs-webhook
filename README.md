# Twilio + ElevenLabs AI Agent Integration

Bu proje, Twilio telefon aramalarını ElevenLabs AI Agent'a bağlamak için webhook sunucusudur.

## 🚀 Hızlı Başlangıç

### Gereksinimler
- Node.js 18+
- Twilio hesabı
- ElevenLabs hesabı ve API anahtarı

### Yerel Kurulum

1. **Projeyi klonlayın veya dosyaları oluşturun**
```bash
mkdir elevenlabs-webhook
cd elevenlabs-webhook
```

2. **Bağımlılıkları yükleyin**
```bash
npm install
```

3. **.env dosyasını düzenleyin**
- `ELEVENLABS_API_KEY` değerini girin
- `AGENT_ID` değerini kontrol edin

4. **Sunucuyu başlatın**
```bash
npm start
```

Sunucu `http://localhost:3000` adresinde çalışacaktır.

## 📦 Render'da Deploy

### Adım 1: GitHub'a Yükleyin

1. GitHub'da yeni repo oluşturun: `elevenlabs-webhook`
2. Dosyaları yükleyin:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/elevenlabs-webhook.git
git push -u origin main
```

### Adım 2: Render'da Deploy Edin

1. [Render.com](https://render.com) hesabı açın
2. Dashboard → **New +** → **Web Service**
3. GitHub repo'nuzu bağlayın
4. Ayarlar:
   - **Name**: elevenlabs-webhook
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

5. **Environment Variables** ekleyin:
   - `ELEVENLABS_API_KEY` = Your API Key
   - `AGENT_ID` = agent_8201k870ff6ze1psrzbddpx32zyd

6. **Create Web Service** tıklayın

### Adım 3: Deploy Tamamlandıktan Sonra

Render size şöyle bir URL verecek:
```
https://elevenlabs-webhook.onrender.com
```

## 📞 Twilio'da Kullanım

### Python (Colab) ile Test:
```python
from twilio.rest import Client

RENDER_URL = "https://elevenlabs-webhook.onrender.com"

client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

# Test araması
call = client.calls.create(
    to="+905321234567",  # Hedef numara
    from_="+12545408791",  # Twilio numaranız
    url=f"{RENDER_URL}/voice"  # Webhook endpoint
)

print(f"Arama başlatıldı: {call.sid}")
```

### Twilio Phone Number Ayarları:
1. Twilio Console → Phone Numbers
2. Numaranızı seçin
3. Voice Configuration:
   - **When a call comes in**: `https://elevenlabs-webhook.onrender.com/voice`
   - **Method**: POST

## 🔧 Endpoints

- `GET /` - Sistem durumu
- `POST /voice` - Ana voice endpoint (ElevenLabs bağlantısı)
- `POST /voice-alt` - Alternatif voice endpoint
- `POST /test` - Test endpoint
- `GET /logs` - Arama logları
- `POST /webhook` - ElevenLabs webhook (opsiyonel)

## 🐛 Sorun Giderme

### "Application Error" Hatası
- ElevenLabs API anahtarını kontrol edin
- Agent ID'nin doğru olduğundan emin olun
- Render loglarını kontrol edin

### WebSocket Bağlantı Hatası
- `/voice-alt` endpoint'ini deneyin
- Twilio Console'da TwiML Bin kullanmayı deneyin

## 📝 Notlar

- Render ücretsiz planda 15 dakika inaktivite sonrası uyur
- İlk istekte 30-60 saniye gecikme olabilir
- Production için ücretli plan önerilir

## 📧 Destek

Sorunlar için GitHub Issues veya Twilio/ElevenLabs destek kanallarını kullanın.