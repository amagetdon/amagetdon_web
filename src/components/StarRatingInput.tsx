import { useState } from 'react'

interface StarRatingInputProps {
  value: number
  onChange: (rating: number) => void
  size?: 'sm' | 'md'
}

export default function StarRatingInput({
  value,
  onChange,
  size = 'md',
}: StarRatingInputProps) {
  const [hovered, setHovered] = useState(0)

  const sizePx = size === 'sm' ? 20 : 28

  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHovered(0)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= (hovered || value)
        return (
          <button
            key={star}
            type="button"
            className={`cursor-pointer transition-transform hover:scale-110 bg-transparent border-none p-0 leading-none ${filled ? 'text-yellow-400' : 'text-gray-300'}`}
            onMouseEnter={() => setHovered(star)}
            onClick={() => onChange(star)}
            aria-label={`${star}점`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width={sizePx}
              height={sizePx}
              viewBox="0 0 24 24"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinejoin="round"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
        )
      })}
    </div>
  )
}
