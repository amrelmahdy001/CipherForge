// worker.js
import { deriveSecretKey, deriveSeed } from "./crypto.js";
import { seedToPassword } from "./generator.js";

self.onmessage = async function(e) {
  const { platform, username, passkey, version } = e.data;
  try {
    const secretKey = await deriveSecretKey(passkey);
    const seed = await deriveSeed(secretKey, platform, username, version);
    const password = await seedToPassword(seed);
    self.postMessage({ success: true, password });
  } catch (err) {
    // إرسال تفاصيل الخطأ إلى الصفحة الرئيسية
    self.postMessage({
      success: false,
      error: err.message || err.toString(),
      stack: err.stack
    });
  }
};

// معالج للأخطاء غير المتوقعة (مثل فشل تحميل module)
self.onerror = function(event) {
  console.error("[worker] Unhandled error:", event.message, event.filename, event.lineno, event.colno);
  // يمكن أيضًا محاولة إرسال رسالة، لكن في هذه الحالة قد لا تصل
};