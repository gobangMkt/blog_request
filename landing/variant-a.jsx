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
        background: 'var(--primary-100)', color: 'var(--primary-400)',
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
          boxShadow: '0 4px 24px rgba(0,0,0,0.22)',
          textAlign: 'left', pointerEvents: 'none',
        }}>{text}</span>
      )}
    </span>
  );
}

// ── 혜택 캐러셀 (자동 재생) ────────────────────────────────────
function BenefitsCarousel() {
  const [page, setPage] = React.useState(0);
  const items = [
    { e: '📝', t: '고방 공식 블로그 정식 발행', d: '월 17만 명이 보는 공식 블로그에 내 지점 포스팅이 올라가요.' },
    { e: '🎨', t: '템플릿 직접 선택', d: 'A타입(설명형) / B타입(스토리형) 중 원하는 방식을 골라요.' },
    { e: '🎯', t: '키워드 직접 제출', d: '원하는 키워드를 1~3개 직접 입력해요.' },
    { e: '✨', t: '강조 포인트 반영', d: '꼭 들어갔으면 하는 내용을 자유롭게 추가할 수 있어요.' },
    { e: '🔗', t: '발행 URL 카카오 알림톡 발송', d: '완료 후 카카오 알림톡으로 발행 링크를 바로 전달해요.' },
    { e: '⚡', t: '결제 후 1~2주 내 발행', d: '선정 안내 후 빠르게 진행돼요.' },
  ];
  const perPage = 2;
  const totalPages = Math.ceil(items.length / perPage);
  const visible = items.slice(page * perPage, page * perPage + perPage);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setPage(p => (p + 1) % totalPages);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div>
      <div key={page} style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
        animation: 'carouselFade 0.4s ease both',
      }}>
        {visible.map((f, i) => (
          <div key={i} style={{
            display: 'flex', flexDirection: 'column', gap: 16,
            padding: '36px 28px',
            background: 'var(--bg-app)', borderRadius: 20,
            minHeight: 220,
          }}>
            <div style={{ fontSize: 48, lineHeight: 1 }}>{f.e}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--fg-1)', lineHeight: 1.3, wordBreak: 'keep-all' }}>{f.t}</div>
            <div style={{ fontSize: 17, color: 'var(--fg-2)', lineHeight: 1.7, wordBreak: 'keep-all' }}>{f.d}</div>
          </div>
        ))}
      </div>

      {/* 페이지 인디케이터 */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 28 }}>
        <button onClick={() => setPage(p => (p - 1 + totalPages) % totalPages)} style={{
          width: 40, height: 40, borderRadius: '50%',
          border: '1.5px solid var(--border-input)', background: '#fff',
          cursor: 'pointer', fontSize: 18, color: 'var(--fg-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>←</button>
        {Array.from({ length: totalPages }).map((_, i) => (
          <button key={i} onClick={() => setPage(i)} style={{
            width: i === page ? 32 : 10, height: 10, borderRadius: 5,
            background: i === page ? 'var(--primary-400)' : 'var(--border-input)',
            border: 'none', cursor: 'pointer', padding: 0,
            transition: 'all 0.25s ease',
          }} />
        ))}
        <button onClick={() => setPage(p => (p + 1) % totalPages)} style={{
          width: 40, height: 40, borderRadius: '50%',
          border: '1.5px solid var(--border-input)', background: '#fff',
          cursor: 'pointer', fontSize: 18, color: 'var(--fg-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>→</button>
      </div>
      <div style={{ textAlign: 'center', marginTop: 12, fontSize: 14, color: 'var(--fg-4)' }}>
        {page * perPage + 1}–{Math.min((page + 1) * perPage, items.length)} / {items.length}가지 혜택
      </div>
    </div>
  );
}

// ── VARIANT A ─────────────────────────────────────────────────
function VariantA() {
  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>

      {/* 1. HERO */}
      <section style={{ padding: '90px 0 110px', background: '#fff' }}>
        <div className="container center-stack" style={{ maxWidth: 820 }}>
          <span className="eyebrow" style={{
            background: '#FFE9D9', color: '#D14000',
            fontSize: 18, padding: '10px 22px',
            animation: 'fadeInUp 0.5s ease both',
          }}>
            🎉 Beta 오픈 이벤트 · 05.01~05.31
          </span>
          <h1 style={{
            fontSize: 68, fontWeight: 900, lineHeight: 1.1,
            color: 'var(--fg-1)', letterSpacing: '-2px', wordBreak: 'keep-all',
            marginBottom: 24, marginTop: 8,
            animation: 'fadeInUp 0.5s 0.1s ease both',
          }}>
            <span style={{ color: 'var(--primary-400)' }}>67% 할인.</span><br />
            5월 한 달, 딱 한 번.
          </h1>
          <p style={{
            fontSize: 24, color: 'var(--fg-2)', lineHeight: 1.65,
            wordBreak: 'keep-all', marginBottom: 16, fontWeight: 500,
            animation: 'fadeInUp 0.5s 0.2s ease both',
          }}>
            월 17만 명이 보는 고방 공식 블로그에<br />
            <strong style={{ color: 'var(--fg-1)' }}>내 지점 포스팅을 10만 원에</strong> 올려드려요.
          </p>

          <div style={{ animation: 'fadeInUp 0.5s 0.3s ease both', marginTop: 32 }}>
            <a href="https://gobangmkt.github.io/blog_request/" target="_blank"
               className="btn btn-primary btn-lg" style={{ animation: 'ctaPulse 2.5s 1.2s ease infinite' }}>
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
                background: 'var(--bg-app)', textDecoration: 'none',
              }}>{item.label} ↓</a>
            ))}
          </div>

          {/* stat strip */}
          <div style={{
            marginTop: 48, display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 1, background: 'var(--border-divider)',
            border: '1px solid var(--border-divider)', borderRadius: 18, overflow: 'hidden',
            width: '100%', maxWidth: 720,
            animation: 'fadeInUp 0.5s 0.5s ease both',
          }}>
            {[
              { n: '67%', l: '할인율' },
              { n: '30건', l: '한정 수량' },
              { n: '31일', l: '판매 기간' },
              { n: '1~2주', l: '발행까지' },
            ].map((s, i) => (
              <div key={i} style={{ background: '#fff', padding: '28px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 34, fontWeight: 800, color: 'var(--primary-400)', letterSpacing: '-0.6px', lineHeight: 1.1 }}>{s.n}</div>
                <div style={{ fontSize: 18, color: 'var(--fg-3)', marginTop: 10, fontWeight: 500 }}>{s.l}</div>
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

            <div style={{ background: '#fff', borderRadius: 18, padding: '36px 28px', border: '1px solid var(--border-input)' }}>
              <div style={{ fontSize: 42, fontWeight: 800, color: 'var(--primary-400)', letterSpacing: '-1px', lineHeight: 1.1, marginBottom: 16 }}>17~18만</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 8 }}>월 방문자</div>
              <div style={{ fontSize: 17, color: 'var(--fg-3)' }}>일 평균 4,500명+</div>
            </div>

            <div style={{ background: '#fff', borderRadius: 18, padding: '36px 28px', border: '1px solid var(--border-input)' }}>
              <div style={{ fontSize: 42, fontWeight: 800, color: 'var(--primary-400)', letterSpacing: '-1px', lineHeight: 1.1, marginBottom: 16, display: 'flex', alignItems: 'center' }}>
                최적화 2+
                <InfoTooltip text={'네이버가 제공하는 블로그 종합 평가 등급\n일반 → 준최적화 → 최적화 1~4+\n고방 블로그는 전체 상위 2.8% 수준이에요.'} />
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 8 }}>네이버 블로그 지수</div>
              <div style={{ fontSize: 17, color: 'var(--fg-3)' }}>전체 블로그 상위 2.8%</div>
            </div>

            <div style={{ background: '#fff', borderRadius: 18, padding: '36px 28px', border: '1px solid var(--border-input)' }}>
              <div style={{ fontSize: 42, fontWeight: 800, color: 'var(--primary-400)', letterSpacing: '-1px', lineHeight: 1.1, marginBottom: 16 }}>1인주거</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 10 }}>특화 채널</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {['고시원', '셰어하우스'].map((kw, i) => (
                  <span key={i} style={{
                    fontSize: 15, fontWeight: 700, padding: '5px 14px',
                    background: 'var(--primary-100)', color: 'var(--primary-400)',
                    borderRadius: 100,
                  }}>{kw}</span>
                ))}
              </div>
              <div style={{ fontSize: 17, color: 'var(--fg-3)' }}>관련 키워드 대부분 블로그탭 상위권</div>
            </div>
          </div>

          {/* 가격 비교 — 바 차트 */}
          <div style={{ background: '#fff', borderRadius: 20, padding: '44px 40px', border: '1px solid var(--border-input)' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--fg-3)', letterSpacing: '0.3px', marginBottom: 36 }}>
              같은 서비스, 얼마나 차이날까요?
            </div>

            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', marginBottom: 28 }}>
              {/* 일반 블로그 */}
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--fg-2)', marginBottom: 14 }}>30만 원~</div>
                <div style={{
                  height: 160, background: 'var(--bg-app)',
                  borderRadius: '12px 12px 0 0',
                  border: '2px solid var(--border-input)', borderBottom: 'none',
                  transformOrigin: 'bottom',
                  animation: 'growBar 0.9s 0.3s ease both',
                }} />
                <div style={{
                  padding: '14px 0', borderTop: '3px solid var(--border-input)',
                  fontSize: 16, color: 'var(--fg-3)', fontWeight: 600,
                }}>일반 블로그 마케팅</div>
              </div>

              {/* 고방 */}
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{
                  display: 'inline-block', fontSize: 14, fontWeight: 800,
                  background: 'var(--primary-400)', color: '#fff',
                  padding: '4px 14px', borderRadius: 100, marginBottom: 10,
                  animation: 'ctaPulse 2.5s 2s ease infinite',
                }}>67% 절약</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--primary-400)', marginBottom: 14 }}>10만 원</div>
                <div style={{
                  height: 54, background: 'var(--primary-400)',
                  borderRadius: '12px 12px 0 0',
                  transformOrigin: 'bottom',
                  animation: 'growBar 0.9s 0.6s ease both',
                }} />
                <div style={{
                  padding: '14px 0', borderTop: '3px solid var(--primary-400)',
                  fontSize: 16, color: 'var(--primary-400)', fontWeight: 700,
                }}>고방 Beta 이벤트</div>
              </div>
            </div>

            <div style={{
              padding: '18px 24px', background: 'var(--primary-50)',
              borderRadius: 12, border: '1px solid var(--primary-200)',
              fontSize: 17, color: 'var(--fg-1)', fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
            }}>
              <span>💡 같은 포스팅, <strong style={{ color: 'var(--primary-400)' }}>20만 원 절약</strong>이에요.</span>
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
            그걸 저희는 <span className="accent">10만 원</span>에 드려요.
          </h2>

          <div style={{
            width: '100%',
            background: 'linear-gradient(180deg, #fff 0%, var(--primary-100) 100%)',
            border: '2px solid var(--primary-400)',
            borderRadius: 28, padding: '48px 40px',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: 24, right: 24,
              background: 'var(--primary-400)', color: '#fff',
              fontSize: 16, fontWeight: 800,
              padding: '8px 20px', borderRadius: 100,
            }}>67% OFF</div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{ fontSize: 19, color: 'var(--fg-3)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
                정가 <span style={{ fontSize: 27, fontWeight: 700, textDecoration: 'line-through', color: 'var(--fg-3)' }}>300,000원</span>
              </div>
              <div style={{ fontSize: 32, color: 'var(--fg-3)' }}>↓</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary-400)', letterSpacing: '0.5px', marginBottom: 12 }}>Beta 이벤트가</div>
                <div style={{ fontSize: 92, fontWeight: 900, color: 'var(--primary-400)', letterSpacing: '-3px', lineHeight: 1 }}>
                  100,000<span style={{ fontSize: 38 }}>원</span>
                </div>
                <div style={{ fontSize: 19, color: 'var(--fg-3)', marginTop: 14 }}>VAT 별도 · 1건 기준</div>
              </div>
              <div style={{
                marginTop: 20, padding: '20px 28px', background: '#fff',
                borderRadius: 12, border: '1px solid var(--primary-300)',
                fontSize: 18, color: 'var(--fg-1)', fontWeight: 600, lineHeight: 1.6,
                textAlign: 'center', wordBreak: 'keep-all',
              }}>
                💡 일반 블로그 마케팅 대비 <strong style={{ color: 'var(--primary-400)' }}>3분의 1 가격</strong>,
                채널 품질은 그 이상이에요.
              </div>
            </div>
          </div>

          {/* 혜택 캐러셀 */}
          <div style={{ width: '100%', marginTop: 56 }}>
            <div style={{ marginBottom: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--fg-1)', marginBottom: 10 }}>10만 원에 모두 포함돼요</div>
              <div style={{ fontSize: 17, color: 'var(--fg-3)' }}>추가 비용 없이 신청부터 발행 완료까지</div>
            </div>
            <BenefitsCarousel />
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
              { n: 1, t: '구매 / 신청', d: '신청 폼에서 지점 정보·키워드·강조 내용 입력', tag: '사장님' },
              { n: 2, t: '대상자 선정', d: '내부 검토 후 알림톡으로 연락 (30건 한정)', tag: '고방' },
              { n: 3, t: '결제', d: '안내받은 방법으로 결제 — 100,000원 (VAT 별도)', tag: '사장님' },
              { n: 4, t: '블로그 작성 · 발행', d: '결제 후 1~2주 내 작성 → 공식 블로그 발행', tag: '고방' },
              { n: 5, t: '결과 안내', d: '발행 URL을 카카오 알림톡으로 발송', tag: '완료' },
            ].map((s, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '56px 1fr', gap: 20, alignItems: 'flex-start',
                padding: '22px 26px', background: '#fff', borderRadius: 16, border: '1px solid var(--border-input)',
              }}>
                <div style={{
                  width: 46, height: 46, borderRadius: '50%',
                  background: 'var(--primary-400)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 800, flexShrink: 0,
                }}>{s.n}</div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: 21, fontWeight: 700, color: 'var(--fg-1)' }}>{s.t}</h3>
                    <span style={{
                      fontSize: 14, fontWeight: 700, color: 'var(--primary-400)',
                      background: 'var(--primary-100)', padding: '4px 12px', borderRadius: 100,
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
              q="내 지점 글이 네이버 검색에 꼭 뜨나요?"
              a="보장 상품이 아니에요. 이 상품의 목표는 신청하신 키워드의 <strong>네이버 '블로그'탭 10위권 진입</strong>이에요. 검색 알고리즘 특성상 결과는 다를 수 있어요. 자세한 내용은 <strong>신청서에서 확인</strong>할 수 있어요." />
            <FaqItem
              q="여러 번 신청할 수 있나요?"
              a="아니요. 이번 이벤트 기간 동안 <strong>고방에 등록된 지점당 1회만 신청 가능</strong>해요." />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="cta" style={{ padding: '100px 0' }}>
        <div className="container" style={{
          background: 'linear-gradient(135deg, #3182F6 0%, #1B6CF2 100%)',
          borderRadius: 26, padding: '72px 48px', color: '#fff', textAlign: 'center',
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.5px', opacity: 0.9, marginBottom: 20 }}>
            05.01~05.31 · 30건 한정
          </div>
          <h2 style={{ fontSize: 42, fontWeight: 800, lineHeight: 1.25, letterSpacing: '-0.8px', wordBreak: 'keep-all', marginBottom: 24 }}>
            10만 원으로<br />가볍게 시작해 보세요.
          </h2>
          <a href="https://gobangmkt.github.io/blog_request/" target="_blank"
             className="btn btn-lg"
             style={{
               background: '#fff', color: 'var(--primary-400)',
               animation: 'ctaPulse 2.5s 0.5s ease infinite',
             }}>
            지금 신청하기 →
          </a>
        </div>
      </section>

      <LandingFooter />

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes carouselFade {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes growBar {
          from { transform: scaleY(0); }
          to   { transform: scaleY(1); }
        }
        @keyframes ctaPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(49, 130, 246, 0.35); }
          50%       { box-shadow: 0 0 0 14px rgba(49, 130, 246, 0); }
        }
        @media (max-width: 640px) {
          h1 { font-size: 40px !important; }
          #price h2 { font-size: 26px !important; }
          #cta .container { padding: 48px 24px !important; }
          #cta h2 { font-size: 28px !important; }
        }
      `}</style>
    </div>
  );
}

window.VariantA = VariantA;
