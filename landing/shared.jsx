/* global React */
const { useState } = React;

// ─────────────────────────────────────────────────────────────
// Nav — shared across all variations
// ─────────────────────────────────────────────────────────────
function LandingNav({ variant = 'A' }) {
  return (
    <nav className="nav">
      <div className="container nav-inner">
        <a href="#" className="nav-logo">
          <img src="../assets/gobang-logo-flat.png" alt="고방" />
          <span>고방 블로그</span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <a href="#why" style={{ fontSize: 15, fontWeight: 500, color: 'var(--fg-3)' }} className="nav-link-d">왜 이 가격</a>
          <a href="#price" style={{ fontSize: 15, fontWeight: 500, color: 'var(--fg-3)' }} className="nav-link-d">가격</a>
          <a href="#process" style={{ fontSize: 15, fontWeight: 500, color: 'var(--fg-3)' }} className="nav-link-d">진행 방식</a>
          <a href="#faq" style={{ fontSize: 15, fontWeight: 500, color: 'var(--fg-3)' }} className="nav-link-d">FAQ</a>
          <a href="#cta" className="nav-cta">신청하기</a>
        </div>
      </div>
      <style>{`@media(max-width:640px){.nav-link-d{display:none}}`}</style>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────
// SearchMockup — Naver-blog search-result chrome (the "before" picture)
// ─────────────────────────────────────────────────────────────
function NaverSearchMockup({ rank = 1 }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid var(--border-input)',
      borderRadius: 14, padding: '18px 18px 16px', maxWidth: 360,
      fontFamily: 'var(--font-sans)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: '#03C75A', letterSpacing: '-1px' }}>NAVER</span>
        <div style={{
          flex: 1, height: 32, background: 'var(--bg-app)', borderRadius: 6,
          display: 'flex', alignItems: 'center', padding: '0 10px',
          fontSize: 12, color: 'var(--fg-1)', fontWeight: 600,
        }}>마포구고시원</div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 8, fontWeight: 600 }}>VIEW</div>
      {[
        { ours: rank === 1, title: '합정역 도보 5분 · 신축 고시원 후기', date: '2일 전' },
        { ours: rank === 2, title: '마포구 고시원 추천 BEST 5', date: '5일 전' },
        { ours: rank === 3, title: '월세 40만원대 1인실 고시원', date: '1주 전' },
      ].map((r, i) => (
        <div key={i} style={{
          padding: '10px 0', borderBottom: i < 2 ? '1px solid var(--border-divider)' : 'none',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {r.ours && <span style={{
            fontSize: 9, fontWeight: 800, color: '#fff',
            background: 'var(--primary-400)', padding: '2px 6px', borderRadius: 4,
            flexShrink: 0,
          }}>OURS</span>}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: r.ours ? 'var(--primary-400)' : 'var(--fg-1)', lineHeight: 1.3 }}>{r.title}</div>
            <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 3 }}>blog.naver.com · {r.date}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// FAQ — accordion item
// ─────────────────────────────────────────────────────────────
function FaqItem({ q, a, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div style={{
      borderBottom: '1px solid var(--border-input)',
      padding: '20px 0',
    }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        textAlign: 'left', fontSize: 20, fontWeight: 600, color: 'var(--fg-1)',
        padding: 0,
      }}>
        <span style={{ flex: 1, paddingRight: 16, wordBreak: 'keep-all' }}>{q}</span>
        <span style={{
          width: 24, height: 24, flexShrink: 0,
          color: 'var(--primary-400)', fontSize: 22,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
          transition: 'transform 0.18s',
        }}>＋</span>
      </button>
      {open && (
        <div style={{
          marginTop: 14, fontSize: 17, color: 'var(--fg-2)',
          lineHeight: 1.7, wordBreak: 'keep-all',
        }} dangerouslySetInnerHTML={{ __html: a }} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Footer
// ─────────────────────────────────────────────────────────────
function LandingFooter() {
  return (
    <footer style={{
      background: 'var(--bg-app)', padding: '48px 0 36px',
      borderTop: '1px solid var(--border-input)',
    }}>
      <div className="container">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <img src="../assets/gobang-logo-flat.png" alt="고방" style={{ height: 24 }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-1)' }}>고방 · neoflatMKT</span>
        </div>
        <p style={{ fontSize: 16, color: 'var(--fg-3)', lineHeight: 1.7, maxWidth: 520 }}>
          전국 고시원·원룸·셰어하우스 지점주를 위한 네이버 블로그 상위노출 마케팅 서비스.<br />
          gobang.kr · u-ceo.kr
        </p>
        <div style={{ marginTop: 24, fontSize: 14, color: 'var(--fg-4)' }}>
          © 2026 neoflatMKT. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

Object.assign(window, { LandingNav, NaverSearchMockup, FaqItem, LandingFooter });
