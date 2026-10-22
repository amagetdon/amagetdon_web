import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PostList, Spinner } from '../../components/community/CommunityParts'
import { HEAD_LABEL } from '../../types/community'
import { useCommunity } from './communityState'
import { MoreButton } from './extra/ExtraParts'
import { readRecent, usePagedPosts, writeRecent } from './extra/hooks'

// 검색: 제목·본문·닉네임, 게시판·말머리로 좁히기. 조건은 주소(?q=&board=&head=)에 남김
export default function CommunitySearch() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { boards, readable, boardBySlug } = useCommunity()
  const [recent, setRecent] = useState<string[]>(() => readRecent())

  const q = (params.get('q') ?? '').trim()
  const boardSlug = params.get('board') ?? ''
  const head = params.get('head') ?? ''
  const board = boardSlug ? boardBySlug(boardSlug) : undefined
  const headOk = head && HEAD_LABEL[head] ? head : ''

  const key = q ? `${q}\u0000${board?.id ?? ''}\u0000${headOk}` : null
  const { posts, more, busy, loading, error, loadMore } = usePagedPosts(key, { q, boardId: board?.id, head: headOk || undefined })

  const setParam = (name: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(name, value); else next.delete(name)
    setParams(next, { replace: true })
  }

  const search = (text: string) => {
    const t = text.trim()
    if (!t) return
    const list = [t, ...recent.filter((r) => r !== t)].slice(0, 5)
    setRecent(list)
    writeRecent(list)
    const next = new URLSearchParams(params)
    next.set('q', t)
    setParams(next)
  }

  const removeRecent = (t: string | null) => {
    const list = t === null ? [] : recent.filter((r) => r !== t)
    setRecent(list)
    writeRecent(list)
  }

  const boardChips = boards.filter((b) => b.enabled && readable.has(b.id))

  return (
    <>
      <SearchBox key={q} initial={q} onBack={() => (window.history.length > 1 ? navigate(-1) : navigate('/community'))} onSearch={search} />
      <div className="cm-filter" aria-label="게시판 고르기">
        <button className={!board ? 'on' : ''} onClick={() => setParam('board', '')}>전체 게시판</button>
        {boardChips.map((b) => (
          <button key={b.id} className={board?.id === b.id ? 'on' : ''} onClick={() => setParam('board', b.slug)}>{b.name}</button>
        ))}
      </div>
      <div className="cm-filter" aria-label="말머리 고르기">
        <button className={!headOk ? 'on' : ''} onClick={() => setParam('head', '')}>전체</button>
        {Object.entries(HEAD_LABEL).map(([k, label]) => (
          <button key={k} className={headOk === k ? 'on' : ''} onClick={() => setParam('head', k)}>{label}</button>
        ))}
      </div>

      {!q ? (
        recent.length ? (
          <div>
            <div className="sec-h">
              <b style={{ fontSize: 14 }}>최근 검색어</b>
              <button style={{ fontSize: 12.5, color: 'var(--g5)' }} onClick={() => removeRecent(null)}>모두 지우기</button>
            </div>
            {recent.map((t) => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--g1)' }}>
                <button onClick={() => search(t)} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', fontSize: 14.5 }}>
                  <i className="ti ti-clock" style={{ fontSize: 17, color: 'var(--g4)' }} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t}</span>
                </button>
                <button aria-label={`'${t}' 지우기`} onClick={() => removeRecent(t)} style={{ padding: '12px 16px', color: 'var(--g4)' }}>
                  <i className="ti ti-x" style={{ fontSize: 16 }} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="cm-empty">제목·본문·닉네임으로 찾아보세요.</p>
        )
      ) : loading ? <Spinner /> : (
        <>
          {!error && posts.length > 0 && (
            <p style={{ padding: '12px 16px 4px', fontSize: 12.5, color: 'var(--g5)' }}>
              '{q}' 검색 결과{more ? '' : ` ${posts.length}개`}
            </p>
          )}
          <PostList posts={posts} showBoard empty={error ? '검색하지 못했어요. 잠시 후 다시 시도해 주세요.' : `'${q}'에 맞는 글이 없어요.`} />
          <MoreButton show={more} busy={busy} onClick={() => void loadMore()} />
        </>
      )}
    </>
  )
}

function SearchBox({ initial, onBack, onSearch }: { initial: string; onBack: () => void; onSearch: (t: string) => void }) {
  const [text, setText] = useState(initial)
  return (
    <form className="cm-search" role="search" onSubmit={(e) => { e.preventDefault(); onSearch(text) }}
      style={{ position: 'sticky', top: 0, zIndex: 20, background: '#fff' }}>
      <button type="button" aria-label="뒤로" onClick={onBack} style={{ width: 32, height: 40, display: 'grid', placeItems: 'center' }}>
        <i className="ti ti-chevron-left" />
      </button>
      <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="제목·본문·닉네임 검색"
        autoFocus={!initial} enterKeyHint="search" aria-label="검색어" maxLength={50} />
      <button aria-label="검색" style={{ width: 36, height: 40, display: 'grid', placeItems: 'center' }}>
        <i className="ti ti-search" />
      </button>
    </form>
  )
}
