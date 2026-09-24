// ============ !تحليل_شخصية - تحليل مرح (مو جدي) لعضو بناءً على آخر رسايله ============
const R = require('./responses');

const ANALYSIS_SYSTEM_PROMPT = R.personalityAnalysis.systemPrompt;

function buildUserPrompt(messages) {
  const sample = messages.slice(-15).map((m) => `- ${m.text}`).join('\n');
  return `هذي آخر رسايل الشخص بالجروب:\n${sample}\n\nاكتب تحليل شخصية مرح قصير عنه.`;
}

function analysisBanner(nameTag, analysisText) {
  return R.personalityAnalysis.banner(nameTag, analysisText);
}

function notEnoughDataMessage() {
  return R.personalityAnalysis.notEnoughData;
}

module.exports = {
  ANALYSIS_SYSTEM_PROMPT,
  buildUserPrompt,
  analysisBanner,
  notEnoughDataMessage
};
