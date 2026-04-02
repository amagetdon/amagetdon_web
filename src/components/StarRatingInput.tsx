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

  const sizeClass = size === 'sm' ? 'text-lg' : 'text-2xl'

  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHovered(0)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= (hovered || value)
        return (
          <button
            key={star}
            type="button"
            className={`${sizeClass} text-yellow-400 cursor-pointer transition-transform hover:scale-110 bg-transparent border-none p-0`}
            onMouseEnter={() => setHovered(star)}
            onClick={() => onChange(star)}
            aria-label={`${star}점`}
          >
            <i className={filled ? 'ti ti-star-filled' : 'ti ti-star'} />
          </button>
        )
      })}
    </div>
  )
}
