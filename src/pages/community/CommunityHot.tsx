import { useSearchParams } from 'react-router-dom'
import { AppBar, SearchButton, Spinner } from '../../components/community/CommunityParts'
import { communityService } from '../../services/communityService'
import { HotList } from './extra/ExtraParts'
import { hourLabel, useKeyedLoad } from './extra/hooks'

type HotKind = 'now' | 'week'

const TABS: { kind: HotKind; label: string; ttlMs: number }[] = [
  { kind: 'now', label: '실시간 HOT', ttlMs: 3600_000 },
  { kind: 'week', label: '주간 TOP', ttlMs: 86400_000 },
]

// 인기글: 실시간 HOT(최근 24시간·1시간마다) / 주간 TOP(최근 7일·하루마다)
export default function CommunityHot() {
  const [params, setParams] = useSearchParams()
  const kind: HotKind = params.get('tab') === 'week' ? 'week' : 'now'
  const tab = TABS.find((t) => t.kind === kind)!
  const { data, loading, error } = useKeyedLoad(kind, (k) => communityService.hot(k as HotKind))

  const at = data?.computedAt ? new Date(data.computedAt) : null
  const next = at ? new Date(at.getTime() + tab.ttlMs) : null

  return (
    <>
      <AppBar title={<span style={{ display: 'block', textAlign: 'center', paddingLeft: 30 }}>인기글</span>} right={<SearchButton />} />
      <div className="tabs6" style={{ top: 48 }} role="tablist">
        {TABS.map((t) => (
          <button key={t.kind} role="tab" aria-selected={t.kind === kind} className={t.kind === kind ? 'on' : ''}
            onClick={() => setParams(t.kind === 'now' ? {} : { tab: t.kind }, { replace: true })}>
            {t.label}
          </button>
        ))}
      </div>
      {loading ? <Spinner /> : (
        <>
          <p className="hotcap">
            {at && next
              ? <>{hourLabel(at)} 기준 인기글 (다음 업데이트 {hourLabel(next)})</>
              : kind === 'now' ? '최근 24시간 동안 반응이 많은 글이에요' : '최근 7일 동안 반응이 많은 글이에요'}
            <i className="ti ti-help-circle" title={kind === 'now' ? '최근 24시간 글을 1시간마다 다시 모아요' : '최근 7일 글을 하루마다 다시 모아요'} />
          </p>
          {data && data.posts.length > 0
            ? <HotList posts={data.posts} />
            : <p className="cm-empty">{error ? '인기글을 불러오지 못했어요.' : '아직 인기글이 없어요'}</p>}
        </>
      )}
    </>
  )
}
