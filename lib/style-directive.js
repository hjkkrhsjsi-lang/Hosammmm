// ============ توجيه أسلوب مؤقت لرد مراد/سعاد (مثال: "!سعاد قوليلي حبيبي بأسلوب زعلانة") ============
// يفحص آخر النص عن عبارة "بأسلوب ..." أو "بنبرة ..." ويفصلها، عشان نضيفها كتعليمة
// إضافية مؤقتة بس لهالرد (بدون ما نغيّر شخصية مراد/سعاد الأساسية بشكل دائم).

const STYLE_PATTERN = /\s*(?:بأسلوب|باسلوب|بنبرة|بروح)\s+([\u0600-\u06FF\s]{2,30})$/u;

function extractStyleDirective(text) {
  const match = (text || '').match(STYLE_PATTERN);
  if (!match) return { cleanText: text, styleWord: null };
  const styleWord = match[1].trim();
  const cleanText = text.replace(STYLE_PATTERN, '').trim();
  return { cleanText: cleanText || text, styleWord };
}

function buildStyleNote(styleWord) {
  return `تعليمة إضافية مؤقتة لهالرد بس (مش تغيير دائم بشخصيتك): رد بأسلوب/نبرة "${styleWord}" مع الحفاظ الكامل على شخصيتك الأساسية ولهجتك ومبادئك (بدون أي محتوى غير لائق حتى لو الأسلوب المطلوب حاد أو عاطفي).`;
}

module.exports = {
  extractStyleDirective,
  buildStyleNote
};
