// ============ !بن - بحث صور بنترست (ScrapeCreators API) ============
// نستخدم خدمة موثقة رسمياً (scrapecreators.com) بدل التخمين - هذا
// endpoint فعلي وموثق وشغال، مو reverse-engineering.
//
// خطوات التفعيل:
// 1. سجّل بـ https://app.scrapecreators.com (مجاني، 100 طلب هدية،
//    ما يحتاج بطاقة ائتمان)
// 2. خذ الـ API Key من لوحة التحكم
// 3. حطه بمتغير بيئة اسمه SCRAPECREATORS_API_KEY على Railway

async function searchPinterest(query, count = 5) {
  const q = (query || '').trim();
  if (!q) return [];

  const apiKey = process.env.SCRAPECREATORS_API_KEY;
  if (!apiKey) {
    console.error('[بنترست] متغير SCRAPECREATORS_API_KEY مو موجود - سجّل بـ app.scrapecreators.com وحط المفتاح');
    return [];
  }

  const url = `https://api.scrapecreators.com/v1/pinterest/search?query=${encodeURIComponent(q)}`;

  let json;
  try {
    const res = await fetch(url, { headers: { 'x-api-key': apiKey } });
    console.log('[بنترست] حالة الاستجابة (status):', res.status);
    if (!res.ok) {
      const errText = await res.text();
      console.log('[بنترست] نص الخطأ:', errText.slice(0, 300));
      return [];
    }
    json = await res.json();
    console.log('[بنترست] شكل الرد (أول 500 حرف):', JSON.stringify(json).slice(0, 500));
  } catch (err) {
    console.error('[بنترست] خطأ بالاتصال:', err.message);
    return [];
  }

  const pins = json.pins || json.results || json.data || [];
  console.log('[بنترست] عدد النتائج الخام:', pins.length);

  const results = pins
    .map((p) => {
      const imageUrl =
        p.image ||
        p.image_url ||
        (p.images && (p.images.orig?.url || p.images['736x']?.url)) ||
        '';
      const pinUrl = p.link || p.pin_url || p.url || (p.id ? `https://www.pinterest.com/pin/${p.id}/` : '');
      const title = p.title || p.grid_title || p.description || 'صورة بنترست';
      return { imageUrl, pinUrl, title };
    })
    .filter((p) => p.imageUrl)
    .slice(0, count);

  console.log('[بنترست] عدد النتائج بعد الفلترة:', results.length);
  return results;
}

module.exports = { searchPinterest };
