// 불편 신고 위젯: 헤더 오른쪽 버튼 → 페이지의 확인 팝업 그릇(.modal/.sheet)과 같은 모양의 신고 창.
import { submitVoc, VOC_CATEGORIES } from './voc-sdk.js';

const $ = (id) => document.getElementById(id);

function el(tag, attrs = {}, text) {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
  if (text) n.textContent = text;
  return n;
}

function toast(msg) {
  const t = el('div', { class: 'voc-toast', role: 'status' }, msg);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

function build() {
  const modal = el('div', { class: 'modal', id: 'vocModal', hidden: '' });
  const sheet = el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'vocTitle' });
  sheet.appendChild(el('h2', { id: 'vocTitle' }, '불편 신고'));

  const f1 = el('div', { class: 'fld' });
  f1.appendChild(el('label', { for: 'vocCat' }, '종류'));
  const cat = el('select', { id: 'vocCat', class: 'sel voc-sel' });
  VOC_CATEGORIES.forEach((c) => cat.appendChild(el('option', { value: c }, c)));
  f1.appendChild(cat);

  const f2 = el('div', { class: 'fld' });
  f2.appendChild(el('label', { for: 'vocMsg' }, '내용'));
  const msg = el('textarea', { id: 'vocMsg', class: 'voc-msg', maxlength: '2000', placeholder: '어느 화면에서 무엇이 안 되거나 불편했는지 적어 주세요' });
  f2.appendChild(msg);

  const f3 = el('div', { class: 'fld' });
  f3.appendChild(el('label', { for: 'vocPhone' }, '연락처 (선택)'));
  const phone = el('input', { id: 'vocPhone', type: 'tel', maxlength: '13', autocomplete: 'off', placeholder: '답을 받고 싶으면 적어 주세요' });
  f3.appendChild(phone);

  const btns = el('div', { class: 'btns' });
  const no = el('button', { class: 'no', type: 'button' }, '취소');
  const yes = el('button', { class: 'yes', type: 'button' });
  btns.appendChild(no); btns.appendChild(yes);

  [f1, f2, f3, btns].forEach((n) => sheet.appendChild(n));
  modal.appendChild(sheet);
  document.body.appendChild(modal);

  const sync = () => {
    const ok = !!msg.value.trim();
    yes.disabled = !ok;
    yes.textContent = ok ? '보내기' : '내용을 적어 주세요';
  };
  msg.addEventListener('input', sync);

  const close = () => { modal.hidden = true; document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  no.addEventListener('click', close);

  yes.addEventListener('click', async () => {
    yes.disabled = true; yes.textContent = '보내는 중이에요';
    try {
      const r = await submitVoc({ message: msg.value.trim(), category: cat.value, phone: phone.value.trim() });
      if (r && (r.ok || r.success)) { close(); toast('접수되었어요. 고맙습니다.'); return; }
      toast('잠시 후 다시 시도해 주세요.');
    } catch (e) {
      toast('잠시 후 다시 시도해 주세요.');
    }
    sync();
  });

  return {
    open() {
      cat.value = VOC_CATEGORIES[0]; msg.value = ''; phone.value = ''; sync();
      modal.hidden = false; msg.focus();
      document.addEventListener('keydown', onKey);
    },
  };
}

const trigger = $('vocOpen');
if (trigger) {
  let box = null;
  trigger.addEventListener('click', () => { (box = box || build()).open(); });
}
