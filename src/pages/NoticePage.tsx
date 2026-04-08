function NoticePage() {
  return (
    <section className="w-full bg-white py-10 max-sm:py-6">
      <div className="max-w-[600px] mx-auto px-5 mt-10">
        {/* Profile Card */}
        <div className="bg-gray-50 rounded-xl p-8 max-sm:p-5">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-gray-200 rounded-full flex items-center justify-center shrink-0 overflow-hidden">
              <span className="text-[8px] font-bold text-gray-600 text-center leading-tight">
                Ama Get Don
                <br />
                Class
              </span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-gray-900">아마겟돈 클래스</span>
                <i className="ti ti-circle-check-filled text-[#2ED573] text-lg" />
              </div>
              <p className="text-sm text-gray-500">May be get money</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button className="w-9 h-9 rounded-full border border-gray-300 flex items-center justify-center cursor-pointer bg-white">
                <i className="ti ti-message-circle text-gray-500 text-lg" />
              </button>
              <button className="w-9 h-9 rounded-full border border-gray-300 flex items-center justify-center cursor-pointer bg-white">
                <i className="ti ti-hash text-gray-500 text-lg" />
              </button>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-3">
            친구 <span className="font-bold text-gray-700">15,725</span>
          </p>
        </div>

        {/* CTA Button */}
        <button className="w-full py-3 bg-yellow-400 rounded-lg text-center font-bold text-gray-900 mt-4 cursor-pointer flex items-center justify-center gap-2">
          <span className="bg-gray-900 text-yellow-400 text-[10px] font-extrabold px-1 rounded">
            Ch+
          </span>
          <span>채널 친구 추가하고 혜택 알림 받기</span>
        </button>

        {/* Basic Info */}
        <div className="border border-gray-200 rounded-xl p-6 mt-4">
          <p className="font-bold text-gray-900 mb-3">기본 정보</p>
          <button className="border border-gray-300 rounded-full px-4 py-1 text-sm text-gray-600 cursor-pointer">
            웹사이트 보러가기
          </button>
        </div>

        {/* Location Info */}
        <div className="border border-gray-200 rounded-xl p-6 mt-4">
          <p className="font-bold text-gray-900 mb-3">장소 정보</p>
          <div className="bg-gray-200 rounded-xl h-[250px] flex items-center justify-center">
            <span className="text-sm text-gray-400">카카오맵</span>
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-900">가산하우스디퍼스타지식산업센터</p>
            <p className="text-sm text-gray-500 mt-1">서울 금천구 가산디지털2로 169-16</p>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button className="border border-gray-300 rounded-lg px-6 py-2 text-sm text-gray-700 cursor-pointer">
              길찾기
            </button>
            <button className="border border-gray-300 rounded-lg px-6 py-2 text-sm text-gray-700 cursor-pointer">
              안내시작
            </button>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="flex items-center justify-center gap-2 mt-6 mb-4">
          <span className="bg-yellow-400 text-gray-900 text-[9px] font-extrabold px-1 rounded">
            Ch
          </span>
          <p className="text-xs text-gray-400">이 정보는 채널 운영자가 등록한 정보입니다.</p>
        </div>
      </div>
    </section>
  )
}

export default NoticePage
