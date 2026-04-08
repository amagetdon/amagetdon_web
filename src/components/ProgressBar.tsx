interface ProgressBarProps {
  value: number
  size?: 'sm' | 'md'
}

function ProgressBar({ value, size = 'md' }: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value))
  const height = size === 'sm' ? 'h-2' : 'h-3'
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm'

  return (
    <div className="flex items-center gap-3">
      <div className={`flex-1 bg-gray-200 rounded-full overflow-hidden ${height}`}>
        <div
          className={`${height} rounded-full transition-all duration-500 ease-out`}
          style={{
            width: `${clampedValue}%`,
            backgroundColor: '#2ED573',
          }}
        />
      </div>
      <span className={`${textSize} font-semibold text-gray-600 shrink-0 min-w-[40px] text-right`}>
        {clampedValue}%
      </span>
    </div>
  )
}

export default ProgressBar
