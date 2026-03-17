#!/bin/bash
# Cafe24 배포 스크립트
# 사용법: bash deploy-cafe24.sh

echo "=== Cafe24 배포 시작 ==="

# 1. 현재 변경사항 커밋 (있으면)
git add .
git diff --cached --quiet || git commit -m "Pre-deploy commit"

# 2. node_modules를 임시로 force add
echo "node_modules 추가 중..."
git add -f node_modules/

# 3. 임시 배포 커밋
git commit -m "cafe24 deploy (include node_modules)"

# 4. Cafe24에 push
echo "Cafe24에 push 중..."
git push cafe24 master

# 5. node_modules 커밋 되돌리기 (GitHub에는 안 올라가게)
echo "node_modules 커밋 되돌리는 중..."
git reset HEAD~1

echo "=== Cafe24 배포 완료 ==="
echo "앱 재시작 필요: Cafe24 호스팅센터에서 앱 중지 후 실행"
