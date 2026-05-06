import { supabase } from '../lib/supabase'
import type { Profile } from '../types'
import type { User } from '@supabase/supabase-js'

// "+82 10-1234-5678" / "+821012345678" / "010-1234-5678" 등 다양한 입력을 010-XXXX-XXXX 로 정규화
function normalizeKoreanPhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  let digits = String(raw).replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('82')) digits = '0' + digits.slice(2)
  if (!digits.startsWith('0')) digits = '0' + digits
  if (digits.length !== 10 && digits.length !== 11) return null
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
}

// "0815" + "1995" → "1995-08-15"
function combineBirthDate(birthyear?: string | null, birthday?: string | null): string | null {
  if (!birthyear || !birthday) return null
  const y = String(birthyear).match(/^\d{4}$/)?.[0]
  const md = String(birthday).replace(/\D/g, '')
  if (!y || md.length !== 4) return null
  const m = md.slice(0, 2)
  const d = md.slice(2, 4)
  if (Number(m) < 1 || Number(m) > 12 || Number(d) < 1 || Number(d) > 31) return null
  return `${y}-${m}-${d}`
}

// 카카오 age_range ("20~29" / "30~34" / "70~") 의 평균 연령을 기준으로 출생연도 추정 → "YYYY-01-01"
// 실제 생년월일이 아닌 추정치이므로 이후 사용자가 마이페이지/온보딩에서 수정 가능.
function estimateBirthDateFromAgeRange(range?: string | null): string | null {
  if (!range) return null
  const m = String(range).match(/^(\d+)\s*~\s*(\d+)?$/)
  if (!m) return null
  const min = Number(m[1])
  const max = m[2] ? Number(m[2]) : min + 9
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null
  const avg = Math.floor((min + max) / 2)
  const year = new Date().getFullYear() - avg
  return `${year}-01-01`
}

function normalizeGender(raw: unknown): 'male' | 'female' | null {
  const g = typeof raw === 'string' ? raw.toLowerCase() : ''
  if (g === 'male' || g === 'm') return 'male'
  if (g === 'female' || g === 'f') return 'female'
  return null
}

interface KakaoAccountShape {
  email?: string
  name?: string
  gender?: string
  age_range?: string
  birthday?: string
  birthyear?: string
  phone_number?: string
  profile?: { nickname?: string; profile_image_url?: string }
}

interface OAuthMetaShape {
  name?: string
  full_name?: string
  nickname?: string
  email?: string
  gender?: string
  age_range?: string
  birthday?: string
  birthyear?: string
  phone?: string
  phone_number?: string
  kakao_account?: KakaoAccountShape
}

export const profileService = {
  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) throw error
    return data as Profile
  },

  async updateProfile(userId: string, updates: {
    name?: string
    phone?: string | null
    birth_date?: string | null
    gender?: 'male' | 'female' | null
    address?: string | null
    provider?: string | null
  }) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates as never)
      .eq('id', userId)
      .select()
      .single()
    if (error) throw error
    return data as Profile
  },

  async updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })
    if (error) throw error
  },

  // 비회원 게스트 계정을 정규 이메일 계정으로 승격
  async promoteGuestToMember(userId: string) {
    const { error } = await supabase
      .from('profiles')
      .update({ provider: 'email' } as never)
      .eq('id', userId)
    if (error) throw error
  },

  // OAuth(카카오/구글) 가입자의 user_metadata + (선택) 외부에서 보강한 kakao_account 를 사용해
  // 프로필의 빈 필드만 채워 넣는다. 호출 결과 새로 채워진 필드가 있으면 true 를 반환.
  async applyOAuthMetadata(user: User, current: Profile | null, extraKakaoAccount?: Record<string, unknown>): Promise<boolean> {
    const md = (user.user_metadata || {}) as OAuthMetaShape
    // user_metadata.kakao_account (대부분 비어있음) + 외부에서 fetch 한 kakao_account 병합
    const acc = { ...(md.kakao_account || {}), ...(extraKakaoAccount as KakaoAccountShape || {}) } as KakaoAccountShape

    const candidate: { name?: string; gender?: 'male' | 'female' | null; phone?: string; birth_date?: string; provider?: string } = {}

    if (!current?.name) {
      const name = md.name || acc.name || md.full_name || md.nickname || acc.profile?.nickname
      if (name && String(name).trim()) candidate.name = String(name).trim()
    }
    if (!current?.gender) {
      const g = normalizeGender(md.gender ?? acc.gender)
      if (g) candidate.gender = g
    }
    if (!current?.phone) {
      const phone = normalizeKoreanPhone((md.phone_number || md.phone || acc.phone_number || '') as string)
      if (phone) candidate.phone = phone
    }
    if (!current?.birth_date) {
      // 1순위: 정확한 birthyear + birthday 조합
      let birth = combineBirthDate(md.birthyear || acc.birthyear, md.birthday || acc.birthday)
      // 2순위: age_range 기반 추정 (평균 나이 → YYYY-01-01)
      if (!birth) {
        birth = estimateBirthDateFromAgeRange(md.age_range || acc.age_range)
      }
      if (birth) candidate.birth_date = birth
    }
    if (!current?.provider) {
      const provider = user.app_metadata?.provider
      if (provider) candidate.provider = provider
    }

    if (Object.keys(candidate).length === 0) return false

    const { error } = await supabase
      .from('profiles')
      .update(candidate as never)
      .eq('id', user.id)
    if (error) throw error
    return true
  },
}
