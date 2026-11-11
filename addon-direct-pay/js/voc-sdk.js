// 중앙 VoC 연동(스킬 voc-sdk). 서비스는 submitVoc만 부르고, 처리는 VoC관제센터가 맡는다.
const VOC_GAS = 'https://script.google.com/macros/s/AKfycbxu24IH7mD_DE4S5tB_Aebhtz-psa-qUlHmAtRVKlfh9tpprwSGE8Z1KFTL_XuC2sonLA/exec';
export const VOC_PROJECT = 'blog-pay-paste';

export const VOC_CATEGORIES = ['오류·안됨', '불편·개선', '새 기능 제안', '이용 문의', '기타'];

export async function submitVoc({ message, category, phone = '', channel = 'app' }) {
  const res = await fetch(VOC_GAS, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'submitVoc',
      project: VOC_PROJECT,
      message,
      category: category || '기타',
      channel,
      phone,
    }),
  });
  return res.json();
}
