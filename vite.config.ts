import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// 빌드마다 고유한 ID — 클라이언트가 새 배포를 감지하는 기준값
const buildId = Date.now().toString(36)

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // dist/version.json 생성 — 런타임 버전 비교용 (src/main.tsx 의 새 배포 감지)
    {
      name: 'emit-version-json',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({ id: buildId }),
        })
      },
    },
  ],
})
