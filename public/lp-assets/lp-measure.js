/* 받은 HTML 랜딩(/lp/:slug) 측정 — 스크롤 깊이·머문 시간·섹션 도달·버튼 클릭을 Umami 이벤트로 보낸다.
   랜딩은 앱 안의 iframe 으로 뜨므로 바깥 창(앱)의 Umami 를 쓴다. Umami 가 없으면 아무 일도 하지 않는다.
   개인정보는 보내지 않는다(랜딩 이름·버튼 이름·상품 번호만).
   결제 버튼을 누르면 어느 랜딩에서 왔는지를 이 브라우저에 적어 둔다 → 결제창 기록(payment_attempts.landing)에 쓰인다. */
(function () {
  'use strict'
  var slug = (location.pathname.match(/\/lp-assets\/([^/]+)\//) || [])[1] || 'unknown'

  /* Umami 가 아직 안 떴으면 잠깐 모아 두었다가 보낸다(최대 15초) */
  var queue = []
  var waited = 0
  function tracker() {
    try { return (window.parent && window.parent !== window && window.parent.umami) || window.umami || null } catch (e) { return window.umami || null }
  }
  function flush() {
    var u = tracker()
    if (!u || typeof u.track !== 'function') return false
    while (queue.length) { var q = queue.shift(); try { u.track(q[0], q[1]) } catch (e) { /* 측정 실패는 화면에 영향을 주지 않는다 */ } }
    return true
  }
  function send(name, data) {
    var d = { landing: slug }
    for (var k in data) if (Object.prototype.hasOwnProperty.call(data, k)) d[k] = data[k]
    queue.push([name, d])
    if (flush()) return
    if (waited === 2) { queue = []; return }
    if (waited) return
    waited = 1
    var tries = 0
    var timer = setInterval(function () { if (flush() || ++tries >= 30) { clearInterval(timer); queue = []; waited = tries >= 30 ? 2 : 0 } }, 500)
  }

  /* ── 스크롤 깊이 25·50·75·100% (한 번씩) ── */
  var marks = [25, 50, 75, 100]
  var sent = {}
  function onScroll() {
    var doc = document.documentElement
    var max = Math.max(1, doc.scrollHeight - window.innerHeight)
    var pct = Math.min(100, Math.round(((window.scrollY || doc.scrollTop || 0) / max) * 100))
    for (var i = 0; i < marks.length; i++) {
      if (pct >= marks[i] - (marks[i] === 100 ? 2 : 0) && !sent[marks[i]]) { sent[marks[i]] = 1; send('lp_scroll', { depth: marks[i] }) }
    }
  }
  var ticking = false
  window.addEventListener('scroll', function () {
    if (ticking) return
    ticking = true
    setTimeout(function () { ticking = false; onScroll() }, 250)
  }, { passive: true })

  /* ── 머문 시간: 화면이 보이는 동안만 세고 10·30·60·120·300초에 한 번씩 ── */
  var steps = [10, 30, 60, 120, 300]
  var seconds = 0
  setInterval(function () {
    if (document.visibilityState !== 'visible') return
    seconds += 1
    if (steps.length && seconds >= steps[0]) send('lp_dwell', { seconds: steps.shift() })
  }, 1000)

  /* ── 섹션 도달: 섹션이 화면에 처음 들어올 때 한 번 ── */
  function sectionName(el, index) {
    var h = el.querySelector('h1, h2, h3')
    var title = h ? (h.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30) : ''
    return (index < 9 ? '0' : '') + (index + 1) + (el.id ? ' #' + el.id : '') + (title ? ' ' + title : '')
  }
  function watchSections() {
    if (!('IntersectionObserver' in window)) return
    var sections = document.querySelectorAll('section')
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return
        io.unobserve(en.target)
        send('lp_section', { section: en.target.getAttribute('data-lp-name') })
      })
    }, { rootMargin: '-35% 0px -35% 0px' }) // 섹션이 화면 가운데 띠에 걸리면 도달(긴 섹션도 잡힘)
    for (var i = 0; i < sections.length; i++) {
      sections[i].setAttribute('data-lp-name', sectionName(sections[i], i))
      io.observe(sections[i])
    }
  }

  /* ── 버튼 클릭 ── */
  function productOf(href) {
    var m = String(href || '').match(/\/(course|ebook)\/(\d+)/)
    return m ? m[1] + '/' + m[2] : ''
  }
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a') : null
    if (!a) return
    var key = a.getAttribute('data-link')
    var href = a.getAttribute('href') || ''
    var product = productOf(href)
    var where = a.closest('.y-sticky') ? 'sticky' : 'page'
    if (product) {
      // 결제 버튼: 어느 랜딩에서 왔는지 적어 둔다(결제창 기록에 쓰임)
      try { localStorage.setItem('amag_lp_from', JSON.stringify({ slug: slug, product: product, at: Date.now() })) } catch (err) { /* 저장 못 해도 진행 */ }
      send('lp_click', { button: key || 'pay', kind: 'pay', product: product })
    } else if (key === 'survey' || /amagclass-survey/.test(href)) {
      send('lp_click', { button: 'survey', kind: 'survey' })
    } else if (a.classList.contains('y-ask') || /pf\.kakao\.com/.test(href)) {
      send('lp_click', { button: 'ask', kind: 'ask' })
    } else if (href === '#buy') {
      send('lp_click', { button: 'to_buy_' + where, kind: 'to_buy' })
    }
  }, true)

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchSections)
  else watchSections()
  send('lp_view', {})
})()
