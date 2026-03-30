function TermsOfServicePage() {
  return (
    <>
      <section className="w-full bg-black py-20 flex items-center justify-center">
        <h1 className="text-3xl font-bold text-white tracking-tight">이용약관</h1>
      </section>

      <section className="w-full bg-white py-16 max-sm:py-10">
        <div className="max-w-[800px] mx-auto px-5">
          <p className="text-sm text-gray-400 mb-12">시행일: 2025년 1월 1일</p>

          {/* 제1조 목적 */}
          <article className="mb-10">
            <h3 className="text-lg font-bold text-gray-900 mb-3">제1조 (목적)</h3>
            <p className="text-sm text-gray-700 leading-relaxed">
              이 약관은 주식회사 아마겟돈 컴퍼니(이하 "회사")가 운영하는 아마겟돈 원격학원 온라인
              교육 플랫폼(이하 "서비스")의 이용과 관련하여 회사와 회원 간의 권리, 의무 및 책임사항,
              기타 필요한 사항을 규정함을 목적으로 합니다.
            </p>
          </article>

          {/* 제2조 정의 */}
          <article className="mb-10">
            <h3 className="text-lg font-bold text-gray-900 mb-3">제2조 (정의)</h3>
            <p className="text-sm text-gray-700 leading-relaxed mb-2">
              이 약관에서 사용하는 용어의 정의는 다음과 같습니다.
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700 leading-relaxed">
              <li>
                <strong>"회사"</strong>란 주식회사 아마겟돈 컴퍼니(사업자등록번호:
                231-88-03443)를 말하며, 대표자는 민태훈입니다.
              </li>
              <li>
                <strong>"서비스"</strong>란 회사가 제공하는 온라인 강의, 전자책 판매 및 관련 부가
                서비스를 말합니다.
              </li>
              <li>
                <strong>"회원"</strong>이란 회사에 개인정보를 제공하고 회원등록을 한 자로서,
                서비스를 계속적으로 이용할 수 있는 자를 말합니다.
              </li>
              <li>
                <strong>"콘텐츠"</strong>란 회사가 서비스를 통해 제공하는 강의 영상, 전자책, 학습
                자료 등 일체의 디지털 저작물을 말합니다.
              </li>
              <li>
                <strong>"이용계약"</strong>이란 서비스 이용과 관련하여 회사와 회원 간에 체결하는
                계약을 말합니다.
              </li>
            </ul>
          </article>

          {/* 제3조 약관의 효력 및 변경 */}
          <article className="mb-10">
            <h3 className="text-lg font-bold text-gray-900 mb-3">제3조 (약관의 효력 및 변경)</h3>
            <ul className="list-decimal pl-5 space-y-2 text-sm text-gray-700 leading-relaxed">
              <li>
                이 약관은 서비스 화면에 게시하거나 기타의 방법으로 회원에게 공지함으로써 효력이
                발생합니다.
              </li>
              <li>
                회사는 관련 법령을 위배하지 않는 범위에서 이 약관을 개정할 수 있으며, 약관을 개정할
                경우에는 적용일자 및 개정사유를 명시하여 현행 약관과 함께 서비스 초기화면에 그
                적용일자 7일 전부터 적용일자 전일까지 공지합니다. 다만, 회원에게 불리한 약관의
                개정의 경우에는 30일 전부터 공지합니다.
              </li>
              <li>
                회원이 개정약관의 적용에 동의하지 않는 경우, 회원은 이용계약을 해지할 수 있습니다.
                개정약관의 효력 발생일 이후에도 서비스를 계속 이용하는 경우 약관의 변경사항에
                동의한 것으로 간주합니다.
              </li>
            </ul>
          </article>

          {/* 제4조 서비스의 제공 및 변경 */}
          <article className="mb-10">
            <h3 className="text-lg font-bold text-gray-900 mb-3">
              제4조 (서비스의 제공 및 변경)
            </h3>
            <ul className="list-decimal pl-5 space-y-2 text-sm text-gray-700 leading-relaxed">
              <li>
                회사는 다음과 같은 서비스를 제공합니다.
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>온라인 강의(동영상 강의) 제공</li>
                  <li>전자책 판매 및 열람 서비스</li>
                  <li>학습 관련 부가 서비스</li>
                  <li>기타 회사가 정하는 서비스</li>
                </ul>
              </li>
              <li>
                회사는 서비스의 내용, 이용방법, 이용시간에 대하여 변경이 있는 경우에는 변경사유,
                변경될 서비스의 내용 및 제공일자 등을 그 변경 전에 해당 서비스 초기화면에
                게시합니다.
              </li>
              <li>
                회사는 상당한 이유가 있는 경우에 운영상, 기술상의 필요에 의해 제공하고 있는 서비스를
                변경할 수 있습니다.
              </li>
            </ul>
          </article>

          {/* 제5조 서비스 이용계약의 체결 */}
          <article className="mb-10">
            <h3 className="text-lg font-bold text-gray-900 mb-3">
              제5조 (서비스 이용계약의 체결)
            </h3>
            <ul className="list-decimal pl-5 space-y-2 text-sm text-gray-700 leading-relaxed">
              <li>
                이용계약은 회원이 되고자 하는 자(이하 "가입신청자")가 약관의 내용에 대하여 동의를
                한 다음 회원가입 신청을 하고, 회사가 이러한 신청에 대하여 승낙함으로써 체결됩니다.
              </li>
              <li>
                회사는 다음 각 호에 해당하는 신청에 대하여는 승낙을 하지 않거나 사후에 이용계약을
                해지할 수 있습니다.
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>가입신청자가 이 약관에 의하여 이전에 회원자격을 상실한 적이 있는 경우</li>
                  <li>실명이 아니거나 타인의 명의를 이용한 경우</li>
                  <li>허위의 정보를 기재하거나, 회사가 제시하는 내용을 기재하지 않은 경우</li>
                  <li>
                    기타 회원으로 등록하는 것이 회사의 기술상 현저히 지장이 있다고 판단되는 경우
                  </li>
                </ul>
              </li>
              <li>
                이용계약의 성립 시기는 회사가 가입완료를 신청절차 상에서 표시한 시점으로 합니다.
              </li>
            </ul>
          </article>

          {/* 제6조 회원정보의 변경 */}
          <article className="mb-10">
            <h3 className="text-lg font-bold text-gray-900 mb-3">제6조 (회원정보의 변경)</h3>
            <ul className="list-decimal pl-5 space-y-2 text-sm text-gray-700 leading-relaxed">
              <li>
                회원은 개인정보관리 화면을 통하여 언제든지 본인의 개인정보를 열람하고 수정할 수
                있습니다.
              </li>
              <li>
                회원은 회원가입 신청 시 기재한 사항이 변경되었을 경우 온라인으로 수정하거나 전자우편
                기타 방법으로 회사에 대하여 그 변경사항을 알려야 합니다.
              </li>
              <li>
                제2항의 변경사항을 회사에 알리지 않아 발생한 불이익에 대하여 회사는 책임지지
                않습니다.
              </li>
            </ul>
          </article>

          {/* 제7조 회원의 의무 */}
          <article className="mb-10">
            <h3 className="text-lg font-bold text-gray-900 mb-3">제7조 (회원의 의무)</h3>
            <ul className="list-decimal pl-5 space-y-2 text-sm text-gray-700 leading-relaxed">
              <li>
                회원은 다음 행위를 하여서는 안 됩니다.
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>신청 또는 변경 시 허위 내용의 등록</li>
                  <li>타인의 정보 도용</li>
                  <li>회사가 게시한 정보의 변경</li>
                  <li>
                    회사 및 기타 제3자의 저작권 등 지적재산권에 대한 침해(강의 영상, 전자책의 무단
                    복제, 배포, 공유 등 포함)
                  </li>
                  <li>회사 및 기타 제3자의 명예를 손상시키거나 업무를 방해하는 행위</li>
                  <li>외설 또는 폭력적인 메시지, 화상, 음성 등을 유포하는 행위</li>
                  <li>회사의 동의 없이 영리를 목적으로 서비스를 이용하는 행위</li>
                  <li>기타 불법적이거나 부당한 행위</li>
                </ul>
              </li>
              <li>
                회원은 관계 법령, 이 약관의 규정, 이용안내 및 서비스와 관련하여 공지한 주의사항,
                회사가 통지하는 사항 등을 준수하여야 하며, 기타 회사의 업무에 방해되는 행위를
                하여서는 안 됩니다.
              </li>
            </ul>
          </article>

          {/* 제8조 서비스 이용 제한 및 중지 */}
          <article className="mb-10">
            <h3 className="text-lg font-bold text-gray-900 mb-3">
              제8조 (서비스 이용 제한 및 중지)
            </h3>
            <ul className="list-decimal pl-5 space-y-2 text-sm text-gray-700 leading-relaxed">
              <li>
                회사는 회원이 이 약관의 의무를 위반하거나 서비스의 정상적인 운영을 방해한 경우,
                경고, 일시정지, 영구이용정지 등으로 서비스 이용을 단계적으로 제한할 수 있습니다.
              </li>
              <li>
                회사는 다음 각 호의 경우에 서비스의 전부 또는 일부를 제한하거나 중지할 수 있습니다.
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>서비스용 설비의 보수 등 공사로 인한 부득이한 경우</li>
                  <li>
                    정전, 제반 설비의 장애 또는 이용량의 폭주 등으로 정상적인 서비스 이용에 지장이
                    있는 경우
                  </li>
                  <li>천재지변, 국가비상사태 등 불가항력적 사유가 있는 경우</li>
                </ul>
              </li>
              <li>
                회사는 서비스의 이용을 제한하거나 중지한 때에는 그 사유 및 제한기간 등을 회원에게
                알립니다.
              </li>
            </ul>
          </article>

          {/* 제9조 결제 및 환불 정책 */}
          <article className="mb-10">
            <h3 className="text-lg font-bold text-gray-900 mb-3">제9조 (결제 및 환불 정책)</h3>
            <ul className="list-decimal pl-5 space-y-2 text-sm text-gray-700 leading-relaxed">
              <li>
                회원은 회사가 제공하는 유료 서비스(온라인 강의, 전자책 등)를 이용하기 위해 회사가
                정한 결제 수단을 통해 요금을 결제합니다.
              </li>
              <li>
                <strong>수강 시작 전 환불:</strong> 회원이 결제 후 수강을 시작하지 않은 경우, 결제일로부터
                7일 이내에 전액 환불을 요청할 수 있습니다. 단, 전자상거래 등에서의 소비자보호에 관한
                법률에 따라 디지털 콘텐츠의 경우 이용이 시작된 후에는 청약 철회가 제한될 수 있습니다.
              </li>
              <li>
                <strong>수강 시작 후 환불:</strong> 학원의 설립·운영 및 과외교습에 관한 법률 및 관련
                시행령에 따라 다음과 같이 환불합니다.
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>
                    수강 기간이 1개월 이내인 경우: 수강 시작 전 전액 환불, 총 수강 기간의 1/3
                    경과 전 수강료의 2/3 환불, 총 수강 기간의 1/2 경과 전 수강료의 1/2 환불,
                    총 수강 기간의 1/2 경과 후 환불 불가
                  </li>
                  <li>
                    수강 기간이 1개월을 초과하는 경우: 환불 사유가 발생한 해당 월의 반환액은 위의
                    기준을 적용하고, 나머지 월의 수강료는 전액 환불
                  </li>
                </ul>
              </li>
              <li>
                <strong>전자책 환불:</strong> 전자책은 디지털 콘텐츠의 특성상 다운로드 또는 열람이
                시작된 이후에는 환불이 불가합니다. 다만, 콘텐츠의 하자가 있는 경우에는 교환 또는
                환불이 가능합니다.
              </li>
              <li>
                환불 시 결제 수단에 따라 환불 처리 기간이 상이할 수 있으며, 회사의 귀책사유로 인한
                환불의 경우 관련 수수료는 회사가 부담합니다.
              </li>
              <li>
                회원의 귀책사유가 아닌 회사의 사정으로 서비스가 중단되는 경우, 이용하지 못한 기간에
                해당하는 금액을 환불합니다.
              </li>
            </ul>
          </article>

          {/* 제10조 저작권 및 콘텐츠 이용 */}
          <article className="mb-10">
            <h3 className="text-lg font-bold text-gray-900 mb-3">
              제10조 (저작권 및 콘텐츠 이용)
            </h3>
            <ul className="list-decimal pl-5 space-y-2 text-sm text-gray-700 leading-relaxed">
              <li>
                서비스에서 제공하는 모든 콘텐츠(강의 영상, 전자책, 학습자료, 이미지, 텍스트 등)에
                대한 저작권 및 지적재산권은 회사 또는 해당 저작권자에게 귀속됩니다.
              </li>
              <li>
                회원은 서비스를 통해 제공받은 콘텐츠를 개인 학습 목적으로만 이용할 수 있으며, 다음
                각 호의 행위를 하여서는 안 됩니다.
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>
                    강의 영상의 녹화, 캡처, 다운로드(회사가 허용한 경우 제외), 재배포, 공유
                  </li>
                  <li>전자책의 복제, 전송, 배포, 인쇄(회사가 허용한 범위를 초과하는 경우)</li>
                  <li>
                    콘텐츠를 이용하여 2차 저작물을 제작하거나 이를 상업적으로 이용하는 행위
                  </li>
                  <li>
                    계정 공유 등 콘텐츠를 제3자가 이용할 수 있도록 하는 일체의 행위
                  </li>
                </ul>
              </li>
              <li>
                회원이 본 조를 위반하여 회사 또는 제3자에게 손해를 발생시킨 경우, 회원은 그 손해를
                배상할 책임이 있으며, 회사는 해당 회원의 서비스 이용을 제한하거나 법적 조치를 취할
                수 있습니다.
              </li>
            </ul>
          </article>

          {/* 제11조 책임 제한 */}
          <article className="mb-10">
            <h3 className="text-lg font-bold text-gray-900 mb-3">제11조 (책임 제한)</h3>
            <ul className="list-decimal pl-5 space-y-2 text-sm text-gray-700 leading-relaxed">
              <li>
                회사는 천재지변 또는 이에 준하는 불가항력으로 인하여 서비스를 제공할 수 없는 경우에는
                서비스 제공에 관한 책임이 면제됩니다.
              </li>
              <li>
                회사는 회원의 귀책사유로 인한 서비스 이용의 장애에 대하여는 책임을 지지 않습니다.
              </li>
              <li>
                회사는 회원이 서비스와 관련하여 게재한 정보, 자료, 사실의 신뢰도, 정확성 등의
                내용에 관하여는 책임을 지지 않습니다.
              </li>
              <li>
                회사는 서비스를 통해 제공되는 강의의 학습 효과 및 성과에 대하여 보장하지 않으며, 이에
                대한 책임을 지지 않습니다.
              </li>
              <li>
                회사는 회원 간 또는 회원과 제3자 상호 간에 서비스를 매개로 하여 거래 등을 한 경우에는
                책임이 면제됩니다.
              </li>
            </ul>
          </article>

          {/* 제12조 분쟁 해결 */}
          <article className="mb-10">
            <h3 className="text-lg font-bold text-gray-900 mb-3">제12조 (분쟁 해결)</h3>
            <ul className="list-decimal pl-5 space-y-2 text-sm text-gray-700 leading-relaxed">
              <li>
                회사는 회원이 제기하는 정당한 의견이나 불만을 반영하고 그 피해를 보상 처리하기 위하여
                피해보상 처리기구를 설치·운영합니다.
              </li>
              <li>
                회사와 회원 간에 발생한 전자상거래 분쟁에 관한 소송은 서울중앙지방법원을 관할법원으로
                합니다.
              </li>
              <li>
                회사와 회원 간에 발생한 분쟁에 관하여는 대한민국 법을 적용합니다.
              </li>
            </ul>
          </article>

          {/* 부칙 */}
          <article className="mb-10">
            <h3 className="text-lg font-bold text-gray-900 mb-3">부칙</h3>
            <p className="text-sm text-gray-700 leading-relaxed">
              이 약관은 2025년 1월 1일부터 시행합니다.
            </p>
          </article>

          {/* 회사 정보 */}
          <div className="border-t border-gray-200 pt-8 mt-12">
            <div className="space-y-1 text-xs text-gray-400">
              <p>주식회사 아마겟돈 컴퍼니 (아마겟돈 원격학원)</p>
              <p>사업자등록번호: 231-88-03443 | 대표자: 민태훈</p>
              <p>소재지: 서울특별시 금천구 가산디지털2로 169-16, O706호</p>
              <p>이메일: info@amag-class.kr | 전화번호: 02-2088-2650</p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

export default TermsOfServicePage
