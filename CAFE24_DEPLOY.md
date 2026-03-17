# Cafe24 Node.js 호스팅 배포 가이드

## 접속 정보

| 항목 | 값 |
|------|-----|
| 앱 URL | http://amag9.cafe24app.com |
| git 저장소 | amag9@amag9.cafe24app.com:amag9_amag9 |
| 앱 PORT | 8001 |
| git remote | `cafe24` |

## 주의사항

### 1. 서버 시작 파일은 반드시 `web.js`
- Cafe24 Node.js 호스팅은 `web.js`만 인식
- `index.js`, `server.js` 사용 불가
- `package.json`의 start 스크립트: `"start": "node web.js"`

### 2. dist 폴더를 git에 포함
- Cafe24 서버에서는 빌드 불가
- `.gitignore`에서 `dist` 제거 필수
- 로컬에서 `npm run build` 후 빌드 결과물과 함께 push

### 3. Node.js 버전
- 초기 설정: Node 14 (EOL)
- 가능하면 16/18로 업그레이드 권장

## SSH 인증 설정

비밀번호 인증이 안 되는 경우가 많음 (최신 Git과 Cafe24 OpenSSH 호환성 문제)

### SSH 키 인증으로 해결

1. RSA 키 생성
```bash
ssh-keygen -t rsa -C "amag9" -f ~/.ssh/id_rsa
```

2. `~/.ssh/config` 파일 생성
```
PubkeyAcceptedKeyTypes +ssh-rsa
```

3. Cafe24 호스팅센터 → 나의 서비스 관리 → **공개키 등록** 메뉴에서 `id_rsa.pub` 등록

## 배포 절차

```bash
# 1. 빌드
npm run build

# 2. 커밋
git add .
git commit -m "커밋 메시지"

# 3. push
git push cafe24 master
```

push 후 Cafe24 호스팅센터에서 **앱 재시작** 필요

## 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| Permission denied (publickey,password) | SSH 키 미등록 또는 비밀번호 호환 문제 | SSH RSA 키 생성 + 공개키 등록 |
| STATUS_ACCESS_VIOLATION | Node.js 버전 호환 문제 또는 Express 버전 문제 | Express 4로 다운그레이드, Node 버전 확인 |
| 앱 세팅 완료 페이지만 표시 | 앱 재시작 안 함 | 호스팅센터에서 앱 재시작 |
| 비밀번호 입력 시 화면에 안 보임 | 정상 (보안 블라인드 처리) | 그냥 타이핑 후 Enter |
