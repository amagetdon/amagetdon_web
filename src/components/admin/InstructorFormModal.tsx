import { useState } from 'react'
import toast from 'react-hot-toast'
import AdminFormModal from './AdminFormModal'
import ImageUploader from './ImageUploader'
import RichTextEditor from './RichTextEditor'
import { instructorService } from '../../services/instructorService'
import { textToHtml } from '../../utils/richText'
import type { Instructor } from '../../types'

const HEX_VALID = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
const HEX_VALUE_ONLY = /^([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

function normalizeHex(v: string | null | undefined, fallback: string): string {
  if (!v) return fallback
  const t = v.trim()
  if (HEX_VALID.test(t)) return t
  if (HEX_VALUE_ONLY.test(t)) return `#${t}`
  return fallback
}

/** 새 강사 입력 폼의 초기값 */
export function newInstructor(): Partial<Instructor> {
  return {
    name: '', title: '', headline: '', bio: '', careers: [], image_url: null,
    has_active_course: false, is_published: true,
  }
}

interface InstructorFormModalProps {
  /** null 이면 모달 닫힘. 값이 있으면 그 값으로 폼이 열린다. */
  editing: Partial<Instructor> | null
  /** 폼 입력 변경 콜백 (제어 컴포넌트) */
  onChange: (next: Partial<Instructor>) => void
  /** 모달 닫기 */
  onClose: () => void
  /** 저장 성공 후 호출 — 저장된 강사 레코드를 전달 */
  onSaved: (saved: Instructor) => void
}

/** 강사 등록/수정 모달 — 강사 관리 페이지와 강의 수정 페이지에서 공통 사용 */
export default function InstructorFormModal({ editing, onChange, onClose, onSaved }: InstructorFormModalProps) {
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!editing?.name) {
      toast.error('이름은 필수입니다.')
      return
    }
    try {
      setSaving(true)
      const saveData = {
        ...editing,
        careers: (editing.careers as string[] || []).filter((c: string) => c.trim()),
        bio_bullets: (editing.bio_bullets as string[] || []).filter((b: string) => b.trim()),
        hero_bullets: (editing.hero_bullets as string[] || []).filter((b: string) => b.trim()),
        hero_title_color: normalizeHex(editing.hero_title_color, '#FFFFFF'),
        hero_bg_from: normalizeHex(editing.hero_bg_from, '#1a1a1a'),
        hero_bg_to: normalizeHex(editing.hero_bg_to, '#2a2a2a'),
      }
      let saved: Instructor
      if (editing.id) {
        saved = await instructorService.update(editing.id, saveData)
        toast.success('강사 정보가 수정되었습니다.')
      } else {
        saved = await instructorService.create(saveData as Omit<Instructor, 'id' | 'created_at' | 'updated_at'>)
        toast.success('새 강사가 등록되었습니다.')
      }
      onSaved(saved)
      onClose()
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminFormModal
      isOpen={!!editing}
      onClose={onClose}
      title={editing?.id ? '강사 수정' : '새 강사 등록'}
      onSubmit={handleSave}
      loading={saving}
      maxWidthClass="max-w-[1640px]"
      bodyClassName="xl:overflow-hidden"
    >
      {editing && (
        <div className="grid grid-cols-[minmax(0,1fr)_1000px] max-xl:grid-cols-1 gap-6 items-start">
        <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4 min-w-0 content-start xl:overflow-y-auto xl:max-h-[calc(85vh_-_180px)] xl:pr-3">
          <div>
            <label className="text-sm font-bold block mb-1">이름 *</label>
            <input value={editing.name || ''} onChange={(e) => onChange({ ...editing, name: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
          </div>
          <div>
            <label className="text-sm font-bold block mb-1">직함</label>
            <input value={editing.title || ''} onChange={(e) => onChange({ ...editing, title: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
          </div>
          <div className="col-span-2 max-sm:col-span-1">
            <label className="text-sm font-bold block mb-1">헤드라인</label>
            <input value={editing.headline || ''} onChange={(e) => onChange({ ...editing, headline: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all" />
          </div>
          <div className="col-span-2 max-sm:col-span-1">
            <label className="text-sm font-bold block mb-1">경력 (줄바꿈으로 구분)</label>
            <textarea value={(editing.careers || []).join('\n')} onChange={(e) => onChange({ ...editing, careers: e.target.value.split('\n') })}
              rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none resize-none focus:border-[#2ED573]" />
          </div>
          <div className="col-span-2 max-sm:col-span-1">
            <label className="text-sm font-bold block mb-1">소개글</label>
            <RichTextEditor
              value={editing.bio || ''}
              onChange={(html) => onChange({ ...editing, bio: html })}
              placeholder="강사 소개 문단을 작성해 주세요"
              minHeight={180}
            />
          </div>
          <div>
            <label className="text-sm font-bold block mb-1">프로필 이미지</label>
            <ImageUploader
              bucket="instructors"
              path={`${editing.id || 'new'}/profile-${Date.now()}`}
              currentUrl={editing.image_url}
              onUpload={(url) => onChange({ ...editing, image_url: url })}
              className="h-[180px]"
            />
          </div>
          <div className="flex flex-col gap-3 justify-center">
            <label className="text-sm font-bold block mb-1">옵션</label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={editing.is_published ?? true} onChange={(e) => onChange({ ...editing, is_published: e.target.checked })} className="accent-[#2ED573]" /> 강사소개 페이지 공개 여부</label>
            </div>
          </div>

          {/* 홈 히어로 카드 (메인 페이지 강사 소개 영역) */}
          <div className="col-span-2 max-sm:col-span-1 mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900">홈 히어로 카드</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">메인 페이지 강사 소개 슬라이더에 표시되는 카드</p>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox"
                  checked={editing.hero_enabled ?? false}
                  onChange={(e) => onChange({ ...editing, hero_enabled: e.target.checked })}
                  className="accent-[#2ED573]" />
                <span className={`text-xs font-bold ${editing.hero_enabled ? 'text-emerald-600' : 'text-gray-400'}`}>
                  {editing.hero_enabled ? 'ON' : 'OFF'}
                </span>
              </label>
            </div>

            {editing.hero_enabled && (
              <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-3 bg-gray-50 border border-gray-200 rounded-xl p-4">
                <div className="col-span-2 max-sm:col-span-1">
                  <label className="text-xs font-bold block mb-1">제목 (줄바꿈 <code className="text-[10px] bg-white px-1">\n</code> 허용)</label>
                  <textarea value={editing.hero_title || ''}
                    onChange={(e) => onChange({ ...editing, hero_title: e.target.value })}
                    rows={2}
                    placeholder={"'릴스' 하나로 억대 매출 만드는\n은우입니다."}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none resize-none focus:border-[#2ED573]" />
                </div>

                <div>
                  <label className="text-xs font-bold block mb-1">제목 색상</label>
                  <div className="flex items-center gap-2">
                    <input type="color"
                      value={normalizeHex(editing.hero_title_color, '#FFFFFF')}
                      onChange={(e) => onChange({ ...editing, hero_title_color: e.target.value })}
                      className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer bg-white p-0.5" />
                    <input type="text"
                      value={editing.hero_title_color || '#FFFFFF'}
                      onChange={(e) => onChange({ ...editing, hero_title_color: e.target.value })}
                      onBlur={(e) => onChange({ ...editing, hero_title_color: normalizeHex(e.target.value, '#FFFFFF') })}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-[#2ED573]" />
                  </div>
                </div>

                <div className="col-span-2 max-sm:col-span-1">
                  <label className="text-xs font-bold block mb-1">배경 그라데이션 (시작 → 끝)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2">
                      <input type="color"
                        value={normalizeHex(editing.hero_bg_from, '#1a1a1a')}
                        onChange={(e) => onChange({ ...editing, hero_bg_from: e.target.value })}
                        title="시작색"
                        className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer bg-white p-0.5 shrink-0" />
                      <input type="text"
                        value={editing.hero_bg_from || '#1a1a1a'}
                        onChange={(e) => onChange({ ...editing, hero_bg_from: e.target.value })}
                        onBlur={(e) => onChange({ ...editing, hero_bg_from: normalizeHex(e.target.value, '#1a1a1a') })}
                        placeholder="#1a1a1a"
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-[#2ED573]" />
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="color"
                        value={normalizeHex(editing.hero_bg_to, '#2a2a2a')}
                        onChange={(e) => onChange({ ...editing, hero_bg_to: e.target.value })}
                        title="끝색"
                        className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer bg-white p-0.5 shrink-0" />
                      <input type="text"
                        value={editing.hero_bg_to || '#2a2a2a'}
                        onChange={(e) => onChange({ ...editing, hero_bg_to: e.target.value })}
                        onBlur={(e) => onChange({ ...editing, hero_bg_to: normalizeHex(e.target.value, '#2a2a2a') })}
                        placeholder="#2a2a2a"
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-[#2ED573]" />
                    </div>
                  </div>
                </div>

                <div className="col-span-2 max-sm:col-span-1">
                  <label className="text-xs font-bold block mb-1">내용 불릿 (줄바꿈 구분)</label>
                  <textarea
                    value={(editing.hero_bullets || []).join('\n')}
                    onChange={(e) => onChange({ ...editing, hero_bullets: e.target.value.split('\n') })}
                    rows={3}
                    placeholder={'운영중인 채널 월 평균 조회수 **수익만 1,500만 원** 이상\n한달 평균 조회수 **1억회** 이상\n\'릴스\' 하나로 광고비 한 푼 없이 브랜드 런칭 직후 **7천만 원** 매출'}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none resize-none focus:border-[#2ED573]" />
                  <p className="text-[10px] text-gray-400 mt-1">
                    한 줄에 한 항목씩 입력해주세요. 강조하려면 <code className="bg-white px-1 rounded">**볼드**</code> 로 감싸세요.
                  </p>

                  {/* 불릿 줄높이 슬라이더 */}
                  <div className="mt-3 flex items-center gap-3">
                    <label className="text-xs font-bold whitespace-nowrap">줄높이</label>
                    <input
                      type="range"
                      min="1.0"
                      max="2.0"
                      step="0.05"
                      value={editing.hero_bullets_line_height ?? 1.375}
                      onChange={(e) => onChange({ ...editing, hero_bullets_line_height: Number(e.target.value) })}
                      className="flex-1 accent-[#2ED573]"
                    />
                    <span className="text-xs font-mono text-gray-600 w-12 text-right">
                      {(editing.hero_bullets_line_height ?? 1.375).toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onChange({ ...editing, hero_bullets_line_height: 1.375 })}
                      className="text-[10px] text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer underline"
                    >
                      기본값
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold block mb-1">누끼 이미지 (오른쪽 인물)</label>
                  <ImageUploader
                    bucket="instructors"
                    path={`${editing.id || 'new'}/hero-${Date.now()}`}
                    currentUrl={editing.hero_portrait_url}
                    onUpload={(url) => onChange({ ...editing, hero_portrait_url: url })}
                    className="h-[140px]"
                    objectFit="contain"
                    crop
                    cropAspect={3 / 4}
                  />
                  <p className="text-[10px] text-gray-400 mt-1">자르기 비율 3:4 (세로형). 영역을 드래그·확대해서 미리보기처럼 보이게 맞춰주세요.</p>
                </div>

                <div>
                  <label className="text-xs font-bold block mb-1">카드 순서</label>
                  <input type="number"
                    value={editing.hero_sort_order ?? 0}
                    onChange={(e) => onChange({ ...editing, hero_sort_order: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573]" />
                  <p className="text-[10px] text-gray-400 mt-1">숫자가 작을수록 먼저 표시.</p>
                </div>

              </div>
            )}
          </div>
        </div>

        {/* 우측 컬럼 — 미리보기 (독립 스크롤) */}
        <div className="xl:overflow-y-auto xl:max-h-[calc(85vh_-_180px)] xl:pl-1">
          <h3 className="text-sm font-bold text-gray-900 mb-3">실시간 미리보기</h3>

          {/* 강사소개 페이지 미리보기 — 헤드라인 / 직함 / 경력 / 소개글 / 프로필 이미지 */}
          <div className="mb-6">
            <label className="text-xs font-bold block mb-2 text-gray-500">강사소개 페이지</label>
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h4 className="text-lg font-bold text-gray-900 mb-4">{editing.name || '강사명'} 강사</h4>
              <div className="flex gap-5 max-sm:flex-col">
                <div className="shrink-0">
                  <img
                    src={editing.image_url || `https://placehold.co/300x400/e5e7eb/999999?text=${encodeURIComponent(editing.name || '강사')}`}
                    alt=""
                    className="rounded-lg w-[200px] max-sm:w-full bg-gray-100"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="text-base font-bold text-gray-900 mb-1">{editing.title || '직함'}</h5>
                  {editing.headline && (
                    <p className="text-sm text-gray-500 mb-3">
                      {editing.headline}
                      <span className="block text-[10px] text-gray-400 mt-0.5">※ 헤드라인은 검색 결과 카드에만 포함됩니다.</span>
                    </p>
                  )}
                  {(editing.careers || []).filter((c) => c.trim()).length > 0 && (
                    <ul className="list-none p-0 mb-3">
                      {(editing.careers || []).filter((c) => c.trim()).map((c, i) => (
                        <li key={i} className="text-sm text-gray-700 mb-1.5">{c}</li>
                      ))}
                    </ul>
                  )}
                  {editing.bio && (
                    <div
                      className="rich-text-content text-sm text-gray-600 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: textToHtml(editing.bio) }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 홈 히어로 카드 미리보기 */}
          <label className="text-xs font-bold block mb-2 text-gray-500">홈 히어로 카드</label>
          {editing.hero_enabled ? (
            <div className="flex gap-5 items-start flex-wrap">
              {/* PC 변형 (620 × 320) */}
              <div className="shrink-0">
                <label className="text-xs font-bold block mb-2 text-gray-500">PC</label>
                <div className="relative w-[620px] h-[320px]">
                  <div
                    className="absolute inset-0 rounded-[32px] overflow-hidden shadow-2xl"
                    style={{ background: `linear-gradient(135deg, ${normalizeHex(editing.hero_bg_from, '#1a1a1a')} 0%, ${normalizeHex(editing.hero_bg_to, '#2a2a2a')} 100%)` }}
                  >
                    <div className="relative z-20 h-full flex flex-col items-start text-left px-10 pt-11 pb-9 max-w-full">
                      <h4
                        className="text-[22px] font-bold leading-[1.25] whitespace-pre-line"
                        style={{ color: normalizeHex(editing.hero_title_color, '#FFFFFF') }}
                      >
                        {editing.hero_title || `${editing.name || '강사'} 강사입니다.`}
                      </h4>
                      <p className="text-white/90 mt-5">
                        <span className="text-[18px] font-bold">{editing.name}</span>
                        {editing.title && <span className="ml-1.5 text-[15px] font-medium text-white/75">{editing.title}</span>}
                      </p>
                      {(editing.hero_bullets || []).filter((b) => b.trim()).length > 0 && (
                        <ul className="mt-3 space-y-1.5">
                          {(editing.hero_bullets || []).filter((b) => b.trim()).map((b, i) => {
                            const html = b.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                            return <li key={i} className="text-white/85 text-[14px]" style={{ lineHeight: editing.hero_bullets_line_height ?? 1.375 }} dangerouslySetInnerHTML={{ __html: html }} />
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                  {editing.hero_portrait_url && (
                    <img src={editing.hero_portrait_url} alt=""
                      className="absolute right-0 bottom-0 h-[115%] w-auto max-w-[55%] object-contain object-bottom rounded-br-[32px] pointer-events-none z-10" />
                  )}
                </div>
              </div>

              {/* 모바일 변형 (300 × 430) */}
              <div className="shrink-0">
                <label className="text-xs font-bold block mb-2 text-gray-500">모바일</label>
                <div className="relative w-[300px] h-[430px]">
                  <div
                    className="absolute inset-0 rounded-[24px] overflow-hidden shadow-2xl"
                    style={{ background: `linear-gradient(135deg, ${normalizeHex(editing.hero_bg_from, '#1a1a1a')} 0%, ${normalizeHex(editing.hero_bg_to, '#2a2a2a')} 100%)` }}
                  >
                    <div className="relative z-20 h-full flex flex-col items-start text-left px-6 pt-7 pb-[180px] max-w-full">
                      <h4
                        className="text-[17px] font-bold leading-[1.25] whitespace-pre-line"
                        style={{ color: normalizeHex(editing.hero_title_color, '#FFFFFF') }}
                      >
                        {editing.hero_title || `${editing.name || '강사'} 강사입니다.`}
                      </h4>
                      <p className="text-white/90 mt-3">
                        <span className="text-[16px] font-bold">{editing.name}</span>
                        {editing.title && <span className="ml-1.5 text-[14px] font-medium text-white/75">{editing.title}</span>}
                      </p>
                      {(editing.hero_bullets || []).filter((b) => b.trim()).length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {(editing.hero_bullets || []).filter((b) => b.trim()).map((b, i) => {
                            const html = b.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                            return <li key={i} className="text-white/85 text-[12.5px]" style={{ lineHeight: editing.hero_bullets_line_height ?? 1.375 }} dangerouslySetInnerHTML={{ __html: html }} />
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                  {editing.hero_portrait_url && (
                    <img src={editing.hero_portrait_url} alt=""
                      className="absolute right-0 bottom-0 h-[220px] w-auto max-w-[60%] object-contain object-bottom rounded-br-[24px] pointer-events-none z-10" />
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-10 text-center">
              <i className="ti ti-eye-off text-3xl text-gray-300 mb-2 block" />
              <p className="text-xs text-gray-400">홈 히어로 카드가 OFF 상태입니다.<br />ON으로 켜면 미리보기가 표시됩니다.</p>
            </div>
          )}
        </div>
        </div>
      )}
    </AdminFormModal>
  )
}
