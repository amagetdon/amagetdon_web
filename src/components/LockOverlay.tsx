interface LockOverlayProps {
  message?: string
}

function LockOverlay({ message = '수강 신청 후 이용 가능합니다' }: LockOverlayProps) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 rounded-xl backdrop-blur-sm">
      <i className="ti ti-lock text-3xl text-gray-400 mb-2" />
      <p className="text-sm text-gray-500 font-medium text-center px-4">{message}</p>
    </div>
  )
}

export default LockOverlay
