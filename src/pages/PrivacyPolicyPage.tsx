function PrivacyPolicyPage() {
  return (
    <>
      <section className="w-full bg-black py-20 flex items-center justify-center">
        <h1 className="text-3xl font-bold text-white tracking-tight">
          개인정보처리방침
        </h1>
      </section>

      <section className="w-full bg-white py-16 max-sm:py-10">
        <div className="max-w-[800px] mx-auto px-5">
          <p className="text-sm text-gray-500 mb-12 text-center">
            주식회사 아마겟돈 컴퍼니(이하 &quot;회사&quot;)는 개인정보 보호법 등
            관련 법령에 따라 이용자의 개인정보를 보호하고 이와 관련한 고충을
            신속하고 원활하게 처리하기 위하여 다음과 같이
            개인정보처리방침을 수립·공개합니다.
          </p>

          {/* 제1조 */}
          <article className="mb-10">
            <h3 className="text-lg font-bold text-gray-900 mb-3">
              제1조 (개인정보의 처리 목적)
            </h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              회사는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고
              있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며,
              이용 목적이 변경되는 경우에는 별도의 동의를 받는 등 필요한
              조치를 이행할 예정입니다.
            </p>
            <ul className="list-disc pl-5 text-gray-700 leading-relaxed space-y-1">
              <li>
                <strong>회원가입 및 관리:</strong> 회원제 서비스 이용에 따른
                본인 확인, 회원자격 유지·관리, 서비스 부정이용 방지, 각종
                고지·통지 등
              </li>
              <li>
                <strong>서비스 제공:</strong> 온라인 강의 제공, 전자책 판매,
                콘텐츠 제공, 맞춤형 서비스 제공 등
              </li>
              <li>
                <strong>결제 및 환불:</strong> 재화·서비스의 결제, 청구서
                발송, 환불 처리 등
              </li>
              <li>
                <strong>마케팅 및 광고 활용:</strong> 이벤트 정보 및 참여
                기회 제공, 서비스 이용 통계 분석 등 (선택 동의 시)
              </li>
              <li>
                <strong>민원 처리:</strong> 민원인의 신원 확인, 민원사항
                확인, 사실 조사를 위한 연락·통지, 처리 결과 통보 등
              </li>
            </ul>
          </article>

          {/* 제2조 */}
          <article className="mb-10">
            <h3 className="text-lg font-bold text-gray-900 mb-3">
              제2조 (수집하는 개인정보 항목)
            </h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              회사는 서비스 제공을 위해 다음과 같은 개인정보 항목을
              수집합니다.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm text-gray-700 mb-4">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                      구분
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                      수집 항목
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2 whitespace-nowrap">
                      필수항목
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      이름, 이메일 주소, 전화번호, 생년월일, 성별, 비밀번호
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2 whitespace-nowrap">
                      선택항목
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      주소
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2 whitespace-nowrap">
                      결제 시
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      신용카드 정보, 은행계좌 정보, 결제 기록
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2 whitespace-nowrap">
                      자동 수집
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      IP 주소, 쿠키, 서비스 이용 기록, 접속 로그, 기기 정보
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>

          {/* 제3조 */}
          <article className="mb-10">
            <h3 className="text-lg font-bold text-gray-900 mb-3">
              제3조 (개인정보의 처리 및 보유기간)
            </h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터
              개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서
              개인정보를 처리·보유합니다.
            </p>
            <ul className="list-disc pl-5 text-gray-700 leading-relaxed space-y-1">
              <li>
                <strong>회원정보:</strong> 회원 탈퇴 시까지 (단, 관련 법령에
                따라 보존할 필요가 있는 경우 해당 기간까지 보존)
              </li>
              <li>
                <strong>계약 또는 청약철회 등에 관한 기록:</strong> 5년
                (전자상거래 등에서의 소비자보호에 관한 법률)
              </li>
              <li>
                <strong>대금결제 및 재화 등의 공급에 관한 기록:</strong> 5년
                (전자상거래 등에서의 소비자보호에 관한 법률)
              </li>
              <li>
                <strong>소비자 불만 또는 분쟁 처리에 관한 기록:</strong> 3년
                (전자상거래 등에서의 소비자보호에 관한 법률)
              </li>
              <li>
                <strong>웹사이트 방문 기록:</strong> 3개월
                (통신비밀보호법)
              </li>
            </ul>
          </article>

          {/* 제4조 */}
          <article className="mb-10">
            <h3 className="text-lg font-bold text-gray-900 mb-3">
              제4조 (개인정보의 제3자 제공)
            </h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              회사는 정보주체의 개인정보를 제1조에서 명시한 범위 내에서만
              처리하며, 정보주체의 동의, 법률의 특별한 규정 등 개인정보
              보호법 제17조 및 제18조에 해당하는 경우에만 개인정보를
              제3자에게 제공합니다.
            </p>
            <p className="text-gray-700 leading-relaxed">
              현재 회사는 이용자의 개인정보를 제3자에게 제공하고 있지
              않습니다. 향후 제3자 제공이 필요한 경우 이용자에게 별도의
              동의를 받은 후 제공하겠습니다.
            </p>
          </article>

          {/* 제5조 */}
          <article className="mb-10">
            <h3 className="text-lg font-bold text-gray-900 mb-3">
              제5조 (개인정보처리 위탁)
            </h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              회사는 원활한 서비스 제공을 위해 다음과 같이 개인정보
              처리업무를 위탁하고 있습니다.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm text-gray-700 mb-4">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                      수탁업체
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                      위탁 업무 내용
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">
                      PG사(결제대행사)
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      결제 처리 및 환불 업무
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-gray-700 leading-relaxed">
              위탁계약 시 개인정보가 안전하게 관리될 수 있도록 필요한 사항을
              규정하고 있으며, 위탁받은 업체가 개인정보를 안전하게 처리하는지
              감독하고 있습니다.
            </p>
          </article>

          {/* 제6조 */}
          <article className="mb-10">
            <h3 className="text-lg font-bold text-gray-900 mb-3">
              제6조 (정보주체의 권리·의무 및 행사방법)
            </h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              정보주체는 회사에 대해 언제든지 다음 각 호의 개인정보 보호
              관련 권리를 행사할 수 있습니다.
            </p>
            <ul className="list-disc pl-5 text-gray-700 leading-relaxed space-y-1">
              <li>개인정보 열람 요구</li>
              <li>오류 등이 있을 경우 정정 요구</li>
              <li>삭제 요구</li>
              <li>처리정지 요구</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-3">
              위 권리 행사는 서면, 전자우편(info@amag-class.kr) 등을 통해
              하실 수 있으며, 회사는 이에 대해 지체 없이 조치하겠습니다.
              정보주체가 개인정보의 오류 등에 대한 정정 또는 삭제를 요구한
              경우 회사는 정정 또는 삭제를 완료할 때까지 당해 개인정보를
              이용하거나 제공하지 않습니다.
            </p>
          </article>

          {/* 제7조 */}
          <article className="mb-10">
            <h3 className="text-lg font-bold text-gray-900 mb-3">
              제7조 (개인정보의 파기)
            </h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가
              불필요하게 되었을 때에는 지체 없이 해당 개인정보를
              파기합니다.
            </p>
            <ul className="list-disc pl-5 text-gray-700 leading-relaxed space-y-1">
              <li>
                <strong>전자적 파일:</strong> 복원이 불가능한 방법으로
                영구 삭제
              </li>
              <li>
                <strong>종이 문서:</strong> 분쇄기로 분쇄하거나 소각하여
                파기
              </li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-3">
              다만, 다른 법령에 따라 보존하여야 하는 경우에는 해당 기간
              동안 별도의 데이터베이스(DB)로 옮기거나 보관 장소를 달리하여
              보존합니다.
            </p>
          </article>

          {/* 제8조 */}
          <article className="mb-10">
            <h3 className="text-lg font-bold text-gray-900 mb-3">
              제8조 (개인정보의 안전성 확보 조치)
            </h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를
              취하고 있습니다.
            </p>
            <ul className="list-disc pl-5 text-gray-700 leading-relaxed space-y-1">
              <li>
                <strong>관리적 조치:</strong> 내부관리계획 수립·시행,
                정기적 직원 교육
              </li>
              <li>
                <strong>기술적 조치:</strong> 개인정보처리시스템 등의
                접근권한 관리, 접근통제시스템 설치, 고유식별정보 등의 암호화,
                보안 프로그램 설치
              </li>
              <li>
                <strong>물리적 조치:</strong> 전산실, 자료보관실 등의
                접근 통제
              </li>
            </ul>
          </article>

          {/* 제9조 */}
          <article className="mb-10">
            <h3 className="text-lg font-bold text-gray-900 mb-3">
              제9조 (개인정보 보호책임자)
            </h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고,
              개인정보 처리와 관련한 정보주체의 불만 처리 및 피해 구제 등을
              위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 text-gray-700 leading-relaxed">
              <p>
                <strong>개인정보 보호책임자</strong>
              </p>
              <p className="mt-1">성명: 민태훈</p>
              <p>직책: 대표이사</p>
              <p>
                이메일:{' '}
                <a
                  href="mailto:info@amag-class.kr"
                  className="text-[#2ED573] hover:underline"
                >
                  info@amag-class.kr
                </a>
              </p>
              <p>전화번호: 02-2088-2650</p>
            </div>
            <p className="text-gray-700 leading-relaxed mt-4">
              정보주체는 회사의 서비스를 이용하면서 발생한 모든 개인정보
              보호 관련 문의, 불만 처리, 피해 구제 등에 관한 사항을 개인정보
              보호책임자에게 문의하실 수 있습니다. 회사는 정보주체의 문의에
              대해 지체 없이 답변 및 처리해 드리겠습니다.
            </p>
            <p className="text-gray-700 leading-relaxed mt-3">
              기타 개인정보 침해에 대한 신고나 상담이 필요하신 경우, 아래
              기관에 문의하시기 바랍니다.
            </p>
            <ul className="list-disc pl-5 text-gray-700 leading-relaxed space-y-1 mt-2">
              <li>
                개인정보분쟁조정위원회:{' '}
                <a
                  href="https://www.kopico.go.kr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#2ED573] hover:underline"
                >
                  www.kopico.go.kr
                </a>{' '}
                / 1833-6972
              </li>
              <li>
                개인정보침해신고센터:{' '}
                <a
                  href="https://privacy.kisa.or.kr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#2ED573] hover:underline"
                >
                  privacy.kisa.or.kr
                </a>{' '}
                / 118
              </li>
              <li>
                대검찰청 사이버수사과:{' '}
                <a
                  href="https://www.spo.go.kr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#2ED573] hover:underline"
                >
                  www.spo.go.kr
                </a>{' '}
                / 1301
              </li>
              <li>
                경찰청 사이버수사국:{' '}
                <a
                  href="https://ecrm.police.go.kr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#2ED573] hover:underline"
                >
                  ecrm.police.go.kr
                </a>{' '}
                / 182
              </li>
            </ul>
          </article>

          {/* 제10조 */}
          <article className="mb-10">
            <h3 className="text-lg font-bold text-gray-900 mb-3">
              제10조 (개인정보 처리방침 변경)
            </h3>
            <p className="text-gray-700 leading-relaxed">
              이 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에
              따른 변경 내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항의
              시행 7일 전부터 공지사항을 통하여 고지할 것입니다. 다만,
              이용자의 권리에 중요한 변경이 있을 경우에는 최소 30일 전에
              고지합니다.
            </p>
          </article>

          {/* 제11조 (부칙) */}
          <article className="mb-10">
            <h3 className="text-lg font-bold text-gray-900 mb-3">
              부칙
            </h3>
            <p className="text-gray-700 leading-relaxed">
              이 개인정보처리방침은 <strong>2025년 1월 1일</strong>부터
              시행합니다.
            </p>
          </article>

          {/* 회사 정보 */}
          <div className="border-t border-gray-200 pt-8 mt-12 text-sm text-gray-500 leading-relaxed">
            <p className="font-semibold text-gray-700 mb-2">
              주식회사 아마겟돈 컴퍼니 (아마겟돈 원격학원)
            </p>
            <p>사업자등록번호: 231-88-03443 | 대표자: 민태훈</p>
            <p>통신판매업신고번호: 제 2025-서울금천-1122호</p>
            <p>원격학원 신고번호: 제6235호</p>
            <p>
              소재지: 서울특별시 금천구 가산디지털2로 169-16, O706호
            </p>
            <p>
              이메일:{' '}
              <a
                href="mailto:info@amag-class.kr"
                className="text-[#2ED573] hover:underline"
              >
                info@amag-class.kr
              </a>{' '}
              | 전화번호: 02-2088-2650
            </p>
          </div>
        </div>
      </section>
    </>
  )
}

export default PrivacyPolicyPage
