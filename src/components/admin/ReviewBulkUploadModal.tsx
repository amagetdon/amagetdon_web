import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'
import AdminFormModal from './AdminFormModal'
import { reviewService } from '../../services/reviewService'
import { maskEmail, maskPhone } from '../../utils/mask'
import type { CourseWithInstructor } from '../../types'

interface ParsedRow {
  author_name: string
  email: string   // 마스킹된 값
  phone: string   // 마스킹된 값
  rating: number  // 1~5 정수
  created_at: string  // ISO
  title: string
  content: string
}

interface ReviewBulkUploadModalProps {
  isOpen: boolean
  onClose: () => void
  courses: CourseWithInstructor[]
  onComplete: () => void
}

/** 엑셀 날짜/문자/숫자 어떤 형태든 ISO 문자열로 변환 */
function toISODate(v: unknown): string {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString()
  if (typeof v === 'number' && isFinite(v)) {
    // Excel 시리얼 날짜 (1900 기준)
    const d = new Date(Math.round((v - 25569) * 86400 * 1000))
    if (!isNaN(d.getTime())) return d.toISOString()
  }
  if (typeof v === 'string' && v.trim()) {
    const d = new Date(v.trim())
    if (!isNaN(d.getTime())) return d.toISOString()
  }
  return new Date().toISOString()
}

/** 내용 앞부분(첫 줄, 최대 30자)을 제목으로 파생 */
function deriveTitle(content: string): string {
  const firstLine = (content.split('\n').find((l) => l.trim()) || '').trim()
  const base = firstLine || content.trim()
  return base.length <= 30 ? base : `${base.slice(0, 30).trim()}…`
}

export default function ReviewBulkUploadModal({ isOpen, onClose, courses, onComplete }: ReviewBulkUploadModalProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [courseId, setCourseId] = useState<number | ''>('')
  const [courseSearch, setCourseSearch] = useState('')
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<ParsedRow[]>([])
  const [skipped, setSkipped] = useState(0)
  const [parseError, setParseError] = useState('')
  const [importing, setImporting] = useState(false)

  const reset = () => {
    setCourseId('')
    setCourseSearch('')
    setFileName('')
    setParsed([])
    setSkipped(0)
    setParseError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleClose = () => {
    if (importing) return
    reset()
    onClose()
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setFileName(file.name)
    setParsed([])
    setSkipped(0)
    setParseError('')
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      if (!ws) { setParseError('시트를 찾을 수 없습니다.'); return }
      const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })
      if (raw.length < 2) { setParseError('데이터 행이 없습니다.'); return }

      const header = (raw[0] as unknown[]).map((h) => String(h ?? '').trim())
      const findCol = (...keywords: string[]) =>
        header.findIndex((h) => keywords.some((k) => h.includes(k)))
      const iName = findCol('이름', '성함')
      const iEmail = findCol('이메일', '메일')
      const iPhone = findCol('연락처', '전화', '휴대')
      const iRating = findCol('평점', '별점', '점수')
      const iDate = findCol('작성일', '날짜')
      const iContent = findCol('내용', '후기')

      if (iContent < 0) {
        setParseError('"리뷰 내용" 컬럼을 찾을 수 없습니다. 헤더를 확인해 주세요.')
        return
      }

      const rows: ParsedRow[] = []
      let skip = 0
      for (let r = 1; r < raw.length; r++) {
        const row = raw[r] as unknown[]
        const cell = (i: number) => (i >= 0 ? row[i] : undefined)
        const content = String(cell(iContent) ?? '')
          .replace(/<br\s*\/?>/gi, '\n')
          .trim()
        const name = String(cell(iName) ?? '').trim()
        if (!content) { skip++; continue }  // 내용 없는 행은 건너뜀

        const ratingNum = Math.round(Number(cell(iRating)))
        const rating = Number.isFinite(ratingNum)
          ? Math.min(5, Math.max(1, ratingNum))
          : 5

        rows.push({
          author_name: name || '익명',
          email: maskEmail(String(cell(iEmail) ?? '')),
          phone: maskPhone(String(cell(iPhone) ?? '')),
          rating,
          created_at: toISODate(cell(iDate)),
          title: deriveTitle(content),
          content,
        })
      }
      setParsed(rows)
      setSkipped(skip)
      if (rows.length === 0) setParseError('등록할 수 있는 후기 행이 없습니다.')
    } catch {
      setParseError('엑셀 파일을 읽지 못했습니다. .xlsx 형식인지 확인해 주세요.')
    }
  }

  const handleImport = async () => {
    if (courseId === '') { toast.error('강의를 선택해 주세요.'); return }
    if (parsed.length === 0) { toast.error('업로드할 후기가 없습니다.'); return }
    const course = courses.find((c) => c.id === courseId)
    try {
      setImporting(true)
      await reviewService.createMany(
        parsed.map((p) => ({
          user_id: null,
          course_id: courseId as number,
          instructor_id: course?.instructor_id ?? null,
          author_name: p.author_name,
          title: p.title,
          content: p.content,
          rating: p.rating,
          email: p.email,
          phone: p.phone,
          created_at: p.created_at,
        })),
      )
      toast.success(`후기 ${parsed.length}건이 등록되었습니다.`)
      reset()
      onComplete()
      onClose()
    } catch {
      toast.error('일괄 등록에 실패했습니다.')
    } finally {
      setImporting(false)
    }
  }

  const sortedCourses = [...courses].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
  const filteredCourses = sortedCourses.filter(
    (c) => !courseSearch
      || c.title.includes(courseSearch)
      || (c.instructor?.name || '').includes(courseSearch),
  )
  const selectedCourse = courseId !== '' ? courses.find((c) => c.id === courseId) : undefined

  return (
    <AdminFormModal
      isOpen={isOpen}
      onClose={handleClose}
      title="후기 엑셀 일괄 업로드"
      onSubmit={handleImport}
      loading={importing}
      submitText={parsed.length > 0 ? `${parsed.length}건 등록` : '등록'}
      maxWidthClass="max-w-[900px]"
    >
      <div className="space-y-4">
        <div>
          <label className="text-sm font-bold block mb-1">강의 선택 *</label>
          {selectedCourse && (
            <p className="text-xs text-[#2ED573] font-medium mb-1">
              선택됨: {selectedCourse.instructor?.name ? `[${selectedCourse.instructor.name}] ` : ''}{selectedCourse.title}
            </p>
          )}
          <div className="border border-gray-300 rounded-xl overflow-hidden">
            <div className="relative">
              <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
              <input
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                placeholder="강의 검색 (강의명·강사명)..."
                className="w-full pl-8 pr-3 py-2 text-sm border-none outline-none"
                style={{ borderBottom: '1px solid #e5e7eb' }}
              />
            </div>
            <div className="max-h-[220px] overflow-y-auto">
              {filteredCourses.length === 0 ? (
                <p className="px-3 py-3 text-sm text-gray-400">검색 결과가 없습니다.</p>
              ) : filteredCourses.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCourseId(courseId === c.id ? '' : c.id)}
                  className={`w-full text-left px-3 py-2 text-sm border-none cursor-pointer transition-colors flex items-center justify-between ${
                    courseId === c.id ? 'bg-[#2ED573]/10 text-gray-900' : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span>
                    {c.instructor?.name && <span className="text-xs text-gray-400 mr-1">[{c.instructor.name}]</span>}
                    {c.title}
                  </span>
                  {courseId === c.id && <i className="ti ti-check text-[#2ED573] text-sm shrink-0 ml-2" />}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">엑셀 파일에는 강의 정보가 없어 파일마다 강의를 직접 지정합니다.</p>
        </div>

        <div>
          <label className="text-sm font-bold block mb-1">엑셀 파일 (.xlsx)</label>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => handleFile(e.target.files?.[0])}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full py-3 rounded-lg text-sm font-medium border border-dashed border-gray-300 text-gray-500 bg-white cursor-pointer hover:border-[#2ED573] hover:text-[#2ED573] transition-colors flex items-center justify-center gap-1.5"
          >
            <i className="ti ti-file-spreadsheet text-base" />
            {fileName || '엑셀 파일 선택'}
          </button>
          <p className="text-[11px] text-gray-400 mt-1">
            컬럼: 이름 · 이메일 · 연락처 · 평점 · 리뷰 작성일 · 리뷰 내용 — 이메일/연락처는 마스킹되어 저장되며, 제목은 내용 앞부분으로 자동 생성됩니다.
          </p>
        </div>

        {parseError && (
          <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            <i className="ti ti-alert-circle mr-1" />{parseError}
          </p>
        )}

        {parsed.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm font-bold text-gray-900">미리보기 — {parsed.length}건</span>
              {skipped > 0 && <span className="text-xs text-gray-400">(내용 없는 {skipped}행 제외)</span>}
            </div>
            <div className="border border-gray-200 rounded-lg overflow-auto max-h-[340px]">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left font-bold text-gray-600">작성자</th>
                    <th className="px-2 py-2 text-center font-bold text-gray-600">평점</th>
                    <th className="px-2 py-2 text-left font-bold text-gray-600">작성일</th>
                    <th className="px-2 py-2 text-left font-bold text-gray-600">이메일</th>
                    <th className="px-2 py-2 text-left font-bold text-gray-600">연락처</th>
                    <th className="px-2 py-2 text-left font-bold text-gray-600">제목 / 내용</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {parsed.map((p, i) => (
                    <tr key={i} className="align-top">
                      <td className="px-2 py-1.5 whitespace-nowrap">{p.author_name}</td>
                      <td className="px-2 py-1.5 text-center text-yellow-500 whitespace-nowrap">{'★'.repeat(p.rating)}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-gray-500">{p.created_at.slice(0, 10)}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-gray-500">{p.email || '-'}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-gray-500">{p.phone || '-'}</td>
                      <td className="px-2 py-1.5">
                        <span className="font-medium text-gray-800">{p.title}</span>
                        <span className="block text-gray-400 line-clamp-2">{p.content}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminFormModal>
  )
}
