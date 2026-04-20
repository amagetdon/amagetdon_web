export type ExternalCodeType = 'script' | 'noscript' | 'hrefScript' | 'link' | 'style'
export type ExternalCodePosition = 'head' | 'body'

export interface ExternalCode {
  id: string
  name: string
  type: ExternalCodeType
  content: string
  position: ExternalCodePosition
  enabled: boolean
  createdAt: string
}

export const EXTERNAL_CODE_TYPE_OPTIONS: { value: ExternalCodeType; label: string; description: string; placeholder: string }[] = [
  {
    value: 'script',
    label: '<script> 삽입 형',
    description: '자바스크립트 코드를 그대로 삽입합니다. <script> 태그 포함 또는 내부 JS만 입력 가능합니다.',
    placeholder: '<script>\n  // 자바스크립트 코드\n</script>',
  },
  {
    value: 'noscript',
    label: '<noscript> 삽입 형',
    description: '자바스크립트가 비활성화된 환경에서만 렌더되는 HTML을 삽입합니다.',
    placeholder: '<noscript>\n  <iframe src="..." ></iframe>\n</noscript>',
  },
  {
    value: 'hrefScript',
    label: '<script> 호출 형',
    description: '외부 스크립트 URL을 src 속성으로 불러옵니다. URL 또는 <script src="..."></script> 형태 입력.',
    placeholder: 'https://example.com/script.js',
  },
  {
    value: 'link',
    label: '<link> 호출 형',
    description: '외부 CSS(혹은 기타 자원)를 link 태그로 불러옵니다. URL 또는 <link> 태그 전체 입력 가능.',
    placeholder: 'https://example.com/style.css',
  },
  {
    value: 'style',
    label: '<style> 삽입 형',
    description: 'CSS를 <style> 태그로 직접 삽입합니다.',
    placeholder: '<style>\n  body { ... }\n</style>',
  },
]

export const EXTERNAL_CODE_POSITION_OPTIONS: { value: ExternalCodePosition; label: string }[] = [
  { value: 'head', label: '<head> 영역 맨 끝에 삽입' },
  { value: 'body', label: '<body> 영역 맨 마지막 삽입' },
]
