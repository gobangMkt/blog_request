/* global React */
const { useState: useStateA } = React;

// ── 툴팁 ──────────────────────────────────────────────────────
function InfoTooltip({ text }) {
  const [show, setShow] = React.useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'help' }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 22, height: 22, borderRadius: '50%',
        background: 'rgba(49,130,246,0.12)', color: 'var(--primary-400)',
        fontSize: 12, fontWeight: 800, marginLeft: 8, flexShrink: 0,
      }}>i</span>
      {show && (
        <span style={{
          position: 'absolute', bottom: '130%', left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--fg-1)', color: '#fff',
          padding: '14px 18px', borderRadius: 12,
          fontSize: 14, fontWeight: 500, lineHeight: 1.7,
          whiteSpace: 'pre-line', zIndex: 100, width: 260,
          boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
          textAlign: 'left', pointerEvents: 'none',
        }}>{text}</span>
      )}
    </span>
  );
}

// ── 혜택 그리드 (3×2 정적 레이아웃) ───────────────────────────
function BenefitsGrid() {
  const items = [
    { e: '📝', t: '고방 공식 블로그 정식 발행', d: '월 17만 명이 보는 공식 블로그에 내 지점 포스팅이 올라가요.' },
    { e: '🎨', t: '템플릿 직접 선택', d: 'A타입(설명형) / B타입(스토리형) 중 원하는 방식을 골라요.' },
    { e: '🎯', t: '키워드 직접 제출', d: '원하는 키워드를 1~3개 직접 입력해요.' },
    { e: '✨', t: '강조 포인트 반영', d: '꼭 들어갔으면 하는 내용을 자유롭게 추가할 수 있어요.' },
    { e: '🔔', t: '발행 URL 카카오 알림톡 발송', d: '완료 후 카카오 알림톡으로 발행 링크를 바로 전달해요.' },
    { e: '⚡', t: '결제 후 1~2주 내 발행', d: '선정 안내 후 빠르게 진행돼요.' },
  ];
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 16,
    }}>
      {items.map((f, i) => (
        <div key={i} style={{
          display: 'flex', flexDirection: 'column', gap: 14,
          padding: '32px 24px',
          background: '#fff',
          borderRadius: 20,
          border: '1px solid var(--border-input)',
          transition: 'box-shadow 0.18s',
        }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 24px rgba(49,130,246,0.10)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
        >
          <div style={{
            fontSize: 42, lineHeight: 1,
            display: 'inline-block',
            animation: `emojiPop 0.55s ${i * 0.08}s cubic-bezier(0.34,1.56,0.64,1) both`,
          }}>{f.e}</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--fg-1)', lineHeight: 1.3, wordBreak: 'keep-all' }}>{f.t}</div>
          <div style={{ fontSize: 15, color: 'var(--fg-3)', lineHeight: 1.65, wordBreak: 'keep-all' }}>{f.d}</div>
        </div>
      ))}
      <style>{`
        @media (max-width: 640px) {
          .benefits-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}

// ── VARIANT A ─────────────────────────────────────────────────
function VariantA() {
  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>

      {/* 1. HERO */}
      <section style={{ padding: '80px 0 100px', background: 'linear-gradient(180deg, #f0f8ff 0%, #fff 100%)' }}>
        <div className="container center-stack" style={{ maxWidth: 820 }}>

          {/* 서비스 로고 */}
          <div style={{ animation: 'gemFloat 3.5s ease-in-out infinite', marginBottom: 28 }}>
            <img
              src="../assets/gobang-logo-new.png"
              alt="고방 neoflatMKT"
              style={{ height: 108, width: 'auto', filter: 'drop-shadow(0 8px 24px rgba(49,130,246,0.22))' }}
            />
          </div>

          <span className="eyebrow" style={{
            background: 'linear-gradient(90deg, #e6faf4 0%, #e0f0ff 100%)',
            color: '#0a6e3f',
            fontSize: 17, padding: '10px 22px',
            animation: 'fadeInUp 0.5s 0.05s ease both',
            border: '1px solid #b2ead3',
          }}>
            🎉 Beta 오픈 이벤트 · 05.01~05.31
          </span>

          <h1 style={{
            fontSize: 66, fontWeight: 900, lineHeight: 1.1,
            letterSpacing: '-2px', wordBreak: 'keep-all',
            marginBottom: 22, marginTop: 16,
            animation: 'fadeInUp 0.5s 0.1s ease both',
            background: 'linear-gradient(100deg, #0D9E5C 0%, #3182F6 80%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            67% 할인.<br />
            <span style={{
              background: 'none', WebkitTextFillColor: 'var(--fg-1)', color: 'var(--fg-1)',
            }}>5월 한 달, 딱 한 번.</span>
          </h1>

          <p style={{
            fontSize: 23, color: 'var(--fg-2)', lineHeight: 1.65,
            wordBreak: 'keep-all', marginBottom: 12, fontWeight: 500,
            animation: 'fadeInUp 0.5s 0.2s ease both',
          }}>
            월 17만 명이 보는 고방 공식 블로그에<br />
            <strong style={{ color: 'var(--fg-1)' }}>내 지점 포스팅을 10만 원에</strong> 올려드려요.
          </p>

          <div style={{ animation: 'fadeInUp 0.5s 0.3s ease both', marginTop: 36 }}>
            <a href="https://gobangmkt.github.io/blog_request/" target="_blank"
               className="btn btn-primary btn-lg"
               style={{
                 background: 'linear-gradient(90deg, #0D9E5C 0%, #3182F6 100%)',
                 border: 'none',
                 animation: 'ctaPulse 2.5s 1.2s ease infinite',
                 fontSize: 20, padding: '20px 44px',
               }}>
              지금 신청하기 →
            </a>
          </div>

          {/* 섹션 TOC */}
          <div style={{
            display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 24,
            animation: 'fadeInUp 0.5s 0.4s ease both',
          }}>
            {[
              { label: '채널 소개', href: '#why' },
              { label: '가격 확인', href: '#price' },
              { label: '진행 방식', href: '#process' },
              { label: 'FAQ', href: '#faq' },
            ].map((item, i) => (
              <a key={i} href={item.href} style={{
                fontSize: 15, fontWeight: 600, color: 'var(--fg-3)',
                padding: '9px 20px', borderRadius: 100,
                background: '#fff', border: '1px solid var(--border-input)',
                textDecoration: 'none',
              }}>{item.label} ↓</a>
            ))}
          </div>

          {/* stat strip */}
          <div style={{
            marginTop: 52, display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 1, background: 'var(--border-divider)',
            border: '1px solid var(--border-divider)', borderRadius: 20, overflow: 'hidden',
            width: '100%', maxWidth: 720,
            animation: 'fadeInUp 0.5s 0.5s ease both',
          }}>
            {[
              { n: '67%', l: '할인율', c: '#0D9E5C' },
              { n: '30건', l: '한정 수량', c: '#26C6B0' },
              { n: '31일', l: '판매 기간', c: '#4BB8D8' },
              { n: '1~2주', l: '발행까지', c: 'var(--primary-400)' },
            ].map((s, i) => (
              <div key={i} style={{ background: '#fff', padding: '26px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, fontWeight: 900, color: s.c, letterSpacing: '-0.6px', lineHeight: 1.1 }}>{s.n}</div>
                <div style={{ fontSize: 16, color: 'var(--fg-3)', marginTop: 8, fontWeight: 600 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 2. WHY */}
      <section id="why" style={{ background: 'var(--bg-app)', padding: '100px 0' }}>
        <div className="container">
          <div className="center-stack" style={{ marginBottom: 56, maxWidth: 720, margin: '0 auto 56px' }}>
            <span className="eyebrow">어떤 채널인가요</span>
            <h2 className="section-h">고방 공식 블로그에 발행됩니다.</h2>
            <p className="section-sub">
              아무 블로그가 아니에요. 1인주거 검색에 최적화된 <strong style={{ color: 'var(--fg-1)' }}>고방 공식 블로그</strong>.
            </p>
          </div>

          {/* 채널 스탯 카드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>

            <div style={{ background: '#fff', borderRadius: 20, padding: '36px 28px', border: '1px solid var(--border-input)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0D9E5C', background: '#e6faf4', padding: '5px 14px', borderRadius: 100, display: 'inline-block', marginBottom: 16 }}>방문자 수</div>
              <div style={{ fontSize: 44, fontWeight: 900, color: '#0D9E5C', letterSpacing: '-1px', lineHeight: 1.1, marginBottom: 12 }}>17~18만</div>
              <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 6 }}>월 방문자</div>
              <div style={{ fontSize: 16, color: 'var(--fg-3)' }}>일 평균 4,500명+</div>
            </div>

            <div style={{ background: '#fff', borderRadius: 20, padding: '36px 28px', border: '1px solid var(--border-input)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#26C6B0', background: '#e0faf7', padding: '5px 14px', borderRadius: 100, display: 'inline-block', marginBottom: 16 }}>블로그 지수</div>
              <div style={{ fontSize: 44, fontWeight: 900, color: '#26C6B0', letterSpacing: '-1px', lineHeight: 1.1, marginBottom: 12, display: 'flex', alignItems: 'center' }}>
                최적화 2+
                <InfoTooltip text={'네이버가 제공하는 블로그 종합 평가 등급\n일반 → 준최적화 → 최적화 1~4+\n고방 블로그는 전체 상위 2.8% 수준이에요.'} />
              </div>
              <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 6 }}>네이버 블로그 지수</div>
              <div style={{ fontSize: 16, color: 'var(--fg-3)' }}>전체 블로그 상위 2.8%</div>
            </div>

            <div style={{ background: '#fff', borderRadius: 20, padding: '36px 28px', border: '1px solid var(--border-input)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary-400)', background: 'var(--primary-100)', padding: '5px 14px', borderRadius: 100, display: 'inline-block', marginBottom: 16 }}>특화 채널</div>
              <div style={{ fontSize: 44, fontWeight: 900, color: 'var(--primary-400)', letterSpacing: '-1px', lineHeight: 1.1, marginBottom: 12 }}>1인주거</div>
              <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 10 }}>특화 채널</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {['고시원', '셰어하우스'].map((kw, i) => (
                  <span key={i} style={{
                    fontSize: 15, fontWeight: 700, padding: '5px 14px',
                    background: 'var(--primary-100)', color: 'var(--primary-400)',
                    borderRadius: 100,
                  }}>{kw}</span>
                ))}
              </div>
              <div style={{ fontSize: 16, color: 'var(--fg-3)' }}>관련 키워드 대부분 블로그탭 상위권</div>
            </div>
          </div>

          {/* 가격 비교 — 바 차트 (슬림) */}
          <div style={{ background: '#fff', borderRadius: 20, padding: '44px 48px', border: '1px solid var(--border-input)' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--fg-3)', letterSpacing: '0.3px', marginBottom: 40, textAlign: 'center' }}>
              같은 서비스, 얼마나 차이날까요?
            </div>

            <div style={{ display: 'flex', gap: 48, alignItems: 'flex-end', justifyContent: 'center', marginBottom: 28 }}>
              {/* 일반 블로그 */}
              <div style={{ width: 72, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--fg-2)', marginBottom: 12 }}>30만 원~</div>
                <div style={{
                  height: 168, width: '100%',
                  background: 'var(--bg-app)',
                  borderRadius: '10px 10px 0 0',
                  border: '2px solid var(--border-input)', borderBottom: 'none',
                  transformOrigin: 'bottom',
                  animation: 'growBar 0.9s 0.3s ease both',
                }} />
                <div style={{
                  padding: '12px 0', borderTop: '3px solid var(--border-input)',
                  fontSize: 15, color: 'var(--fg-3)', fontWeight: 600, wordBreak: 'keep-all',
                }}>일반 블로그<br />마케팅</div>
              </div>

              {/* 고방 */}
              <div style={{ width: 72, textAlign: 'center' }}>
                <div style={{
                  display: 'inline-block', fontSize: 13, fontWeight: 800,
                  background: 'linear-gradient(90deg,#0D9E5C,#3182F6)',
                  color: '#fff',
                  padding: '4px 12px', borderRadius: 100, marginBottom: 8,
                  animation: 'ctaPulse 2.5s 2s ease infinite',
                }}>67% 절약</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#0D9E5C', marginBottom: 12 }}>10만 원</div>
                <div style={{
                  height: 56, width: '100%',
                  background: 'linear-gradient(180deg, #26C6B0 0%, #0D9E5C 100%)',
                  borderRadius: '10px 10px 0 0',
                  transformOrigin: 'bottom',
                  animation: 'growBar 0.9s 0.6s ease both',
                }} />
                <div style={{
                  padding: '12px 0', borderTop: '3px solid #0D9E5C',
                  fontSize: 15, color: '#0D9E5C', fontWeight: 700, wordBreak: 'keep-all',
                }}>고방<br />Beta 이벤트</div>
              </div>
            </div>

            <div style={{
              padding: '18px 24px',
              background: 'linear-gradient(90deg,#e6faf4 0%,#e0f0ff 100%)',
              borderRadius: 12, border: '1px solid #b2ead3',
              fontSize: 17, color: 'var(--fg-1)', fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
            }}>
              <span>💡 같은 포스팅, <strong style={{ color: '#0D9E5C' }}>20만 원 절약</strong>이에요.</span>
              <a href="https://soomgo.com/prices/%EB%B8%94%EB%A1%9C%EA%B7%B8-%EB%A7%88%EC%BC%80%ED%8C%85"
                 target="_blank" style={{ fontSize: 14, color: 'var(--fg-4)', textDecoration: 'underline' }}>
                * 블로그 마케팅 플랫폼 평균 가격 기준 →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 3. PRICE REVEAL */}
      <section id="price" style={{ padding: '110px 0', background: '#fff' }}>
        <div className="container center-stack" style={{ maxWidth: 720 }}>
          <span className="eyebrow">5월 한 달, 딱 한 번</span>
          <h2 className="section-h" style={{ marginBottom: 48 }}>
            그걸 저희는 <span style={{ color: '#0D9E5C' }}>10만 원</span>에 드려요.
          </h2>

          <div style={{
            width: '100%',
            background: 'linear-gradient(160deg, #f0fdf7 0%, #e8f5ff 100%)',
            border: '2px solid #26C6B0',
            borderRadius: 28, padding: '48px 40px',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: 24, right: 24,
              background: 'linear-gradient(90deg,#0D9E5C,#3182F6)',
              color: '#fff',
              fontSize: 15, fontWeight: 800,
              padding: '8px 20px', borderRadius: 100,
            }}>67% OFF</div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{ fontSize: 19, color: 'var(--fg-3)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
                정가 <span style={{ fontSize: 26, fontWeight: 700, textDecoration: 'line-through', color: 'var(--fg-3)' }}>300,000원</span>
              </div>
              <div style={{ fontSize: 30, color: '#26C6B0' }}>↓</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0D9E5C', letterSpacing: '0.5px', marginBottom: 12 }}>Beta 이벤트가</div>
                <div style={{
                  fontSize: 90, fontWeight: 900, letterSpacing: '-3px', lineHeight: 1,
                  background: 'linear-gradient(100deg,#0D9E5C 0%,#3182F6 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>
                  100,000<span style={{ fontSize: 36 }}>원</span>
                </div>
                <div style={{ fontSize: 18, color: 'var(--fg-3)', marginTop: 14 }}>VAT 별도 · 1건 기준</div>
              </div>
              <div style={{
                marginTop: 20, padding: '20px 28px', background: '#fff',
                borderRadius: 12, border: '1px solid #b2ead3',
                fontSize: 18, color: 'var(--fg-1)', fontWeight: 600, lineHeight: 1.6,
                textAlign: 'center', wordBreak: 'keep-all',
              }}>
                💡 일반 블로그 마케팅 대비 <strong style={{ color: '#0D9E5C' }}>3분의 1 가격</strong>,
                채널 품질은 그 이상이에요.
              </div>
            </div>
          </div>

          {/* 혜택 그리드 */}
          <div style={{ width: '100%', marginTop: 56 }}>
            <div style={{ marginBottom: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--fg-1)', marginBottom: 10 }}>10만 원에 모두 포함돼요</div>
              <div style={{ fontSize: 17, color: 'var(--fg-3)' }}>추가 비용 없이 신청부터 발행 완료까지</div>
            </div>
            <BenefitsGrid />
          </div>
        </div>
      </section>

      {/* 4. PROCESS */}
      <section id="process" style={{ background: 'var(--bg-app)', padding: '100px 0' }}>
        <div className="container" style={{ maxWidth: 760 }}>
          <div className="center-stack" style={{ marginBottom: 56 }}>
            <span className="eyebrow">진행 방식</span>
            <h2 className="section-h">신청부터 발행까지</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { n: 1, t: '구매 / 신청', d: '신청 폼에서 지점 정보·키워드·강조 내용 입력', tag: '사장님', c: '#0D9E5C' },
              { n: 2, t: '대상자 선정', d: '내부 검토 후 알림톡으로 연락 (30건 한정)', tag: '고방', c: '#26C6B0' },
              { n: 3, t: '결제', d: '안내받은 방법으로 결제 — 100,000원 (VAT 별도)', tag: '사장님', c: '#4BB8D8' },
              { n: 4, t: '블로그 작성 · 발행', d: '결제 후 1~2주 내 작성 → 공식 블로그 발행', tag: '고방', c: 'var(--primary-400)' },
              { n: 5, t: '결과 안내', d: '발행 URL을 카카오 알림톡으로 발송', tag: '완료', c: 'var(--primary-400)' },
            ].map((s, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '56px 1fr', gap: 20, alignItems: 'flex-start',
                padding: '22px 26px', background: '#fff', borderRadius: 16, border: '1px solid var(--border-input)',
              }}>
                <div style={{
                  width: 46, height: 46, borderRadius: '50%',
                  background: s.c, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 800, flexShrink: 0,
                }}>{s.n}</div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: 21, fontWeight: 700, color: 'var(--fg-1)' }}>{s.t}</h3>
                    <span style={{
                      fontSize: 14, fontWeight: 700, color: s.c,
                      background: `${s.c}18`, padding: '4px 12px', borderRadius: 100,
                    }}>{s.tag}</span>
                  </div>
                  <p style={{ fontSize: 18, color: 'var(--fg-3)', lineHeight: 1.7, wordBreak: 'keep-all' }}>{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. FAQ */}
      <section id="faq" style={{ padding: '100px 0' }}>
        <div className="container" style={{ maxWidth: 760 }}>
          <div className="center-stack" style={{ marginBottom: 50 }}>
            <span className="eyebrow">자주 묻는 질문</span>
            <h2 className="section-h">신청 전에 확인해 주세요</h2>
          </div>
          <div style={{ background: '#fff', borderRadius: 18, padding: '8px 28px', border: '1px solid var(--border-input)' }}>
            <FaqItem defaultOpen
              q="05.31이 지나면 10만 원에 구매할 수 없나요?"
              a="맞아요. <strong>05.31 자정까지</strong>만 10만 원 (VAT 별도)이에요. 05.31 이전이라도 30건이 모두 마감되면 신청이 종료돼요. 이번 Beta 이벤트는 1회성으로 운영되며, 이후 판매 방식은 별도 안내 예정이에요." />
            <FaqItem
              q="고방 광고 6개월 상품 없이도 신청할 수 있나요?"
              a="네, <strong>이번 Beta 이벤트는 단독 구매가 가능</strong>해요. 기존에는 고방 광고상품 6개월 이용 고객에게만 제공됐는데, Beta 기간 한정으로 1건 단독 구매가 가능해졌어요." />
            <FaqItem
              q="원하는 키워드로 글을 쓸 수 있나요?"
              a="네, 키워드는 <strong>1~3개 직접 입력</strong>해요. 단, 현재 고방 블로그가 상위노출 중인 키워드에 한하며, 최근 사용된 키워드는 60일 제한이 있어 일부 키워드는 사용이 어려울 수 있어요. 자세한 내용은 <strong>신청서에서 확인</strong>할 수 있어요." />
            <FaqItem
              q="발행한 글이 네이버 검색에 뜨긴 하나요?"
              a="네, 발행한 글은 <strong>네이버 검색에 100% 노출</strong>돼요. 고방 공식 블로그에 정식 발행되는 글이기 때문에 네이버 검색 결과에 반드시 노출됩니다.<br/><br/>다만 <strong>상위노출(검색 결과 상단 1~3위 진입)은 보장드리기 어려워요.</strong> 고방 블로그는 네이버 최적화 2+ 등급으로 상위노출 확률이 높은 편이지만, 검색 알고리즘 특성상 순위는 달라질 수 있어요." />
            <FaqItem
              q="여러 번 신청할 수 있나요?"
              a="아니요. 이번 이벤트 기간 동안 <strong>고방에 등록된 지점당 1회만 신청 가능</strong>해요." />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="cta" style={{ padding: '100px 0' }}>
        <div className="container">
          <div style={{
            background: 'linear-gradient(135deg, #0D9E5C 0%, #26C6B0 45%, #3182F6 100%)',
            borderRadius: 28, padding: '72px 48px', color: '#fff', textAlign: 'center',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* 장식용 로고 */}
            <div style={{
              position: 'absolute', right: 48, top: '50%', transform: 'translateY(-50%)',
              opacity: 0.15,
              animation: 'gemFloat 4s ease-in-out infinite',
            }}>
              <img src="../assets/gobang-logo-new.png" alt="" style={{ height: 160, filter: 'brightness(10)' }} />
            </div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.5px', opacity: 0.92, marginBottom: 20 }}>
                05.01~05.31 · 30건 한정
              </div>
              <h2 style={{ fontSize: 42, fontWeight: 800, lineHeight: 1.25, letterSpacing: '-0.8px', wordBreak: 'keep-all', marginBottom: 28 }}>
                10만 원으로<br />가볍게 시작해 보세요.
              </h2>
              <a href="https://gobangmkt.github.io/blog_request/" target="_blank"
                 className="btn btn-lg"
                 style={{
                   background: '#fff', color: '#0D9E5C',
                   animation: 'ctaPulse 2.5s 0.5s ease infinite',
                   fontWeight: 900,
                 }}>
                지금 신청하기 →
              </a>
            </div>
          </div>
        </div>
      </section>

      <LandingFooter />

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes growBar {
          from { transform: scaleY(0); }
          to   { transform: scaleY(1); }
        }
        @keyframes ctaPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(13,158,92,0.35); }
          50%       { box-shadow: 0 0 0 14px rgba(13,158,92,0); }
        }
        @keyframes gemFloat {
          0%, 100% { transform: translateY(0px); }
          50%      { transform: translateY(-12px); }
        }
        @keyframes emojiPop {
          from { opacity: 0; transform: scale(0.4) rotate(-10deg); }
          to   { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @media (max-width: 640px) {
          h1 { font-size: 40px !important; letter-spacing: -1px !important; }
          #price h2 { font-size: 26px !important; }
          #cta > .container > div { padding: 48px 24px !important; }
          #cta h2 { font-size: 28px !important; }
          .benefits-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}

window.VariantA = VariantA;
