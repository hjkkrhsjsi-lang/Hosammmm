// ============ !تك - بحث فيديوهات تيك توك ============
// يستخدم نقطة الاتصال العامة اللي موقع تيك توك نفسه يستخدمها
// بالبحث بالمتصفح - ما فيه توثيق رسمي، ممكن ينكسر لو تيك توك
// غيّروا هيكلة الموقع أو حطوا حماية إضافية (كابتشا/توكن).

async function searchTiktok(query, count = 10) {
  const q = (query || '').trim();
  if (!q) return [];

  const url =
    'https://www.tiktok.com/api/search/general/full/' +
    `?keyword=${encodeURIComponent(q)}&count=${count}&cursor=0`;

  let json;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
        Referer: 'https://www.tiktok.com/'
      }
    });
    console.log('[تيك توك] حالة الاستجابة (status):', res.status);
    if (!res.ok) {
      const errText = await res.text();
      console.log('[تيك توك] نص الخطأ:', errText.slice(0, 300));
      return [];
    }
    json = await res.json();
    console.log('[تيك توك] شكل الاستجابة (أول 500 حرف):', JSON.stringify(json).slice(0, 500));
  } catch (err) {
    console.error('خطأ بالبحث بتيك توك:', err.message);
    return [];
  }

  const items = (json && json.data) || [];
  console.log('[تيك توك] عدد النتايج بعد الاستخراج:', items.length);

  return items
    .filter((item) => item && item.item && item.item.video)
    .map((item) => {
      const v = item.item;
      return {
        videoUrl: `https://www.tiktok.com/@${v.author.uniqueId}/video/${v.id}`,
        thumbUrl: v.video.cover || v.video.originCover,
        title: v.desc || 'فيديو تيك توك',
        author: v.author.uniqueId
      };
    });
}

module.exports = { searchTiktok };
