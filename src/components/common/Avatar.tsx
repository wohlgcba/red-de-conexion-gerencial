export function Avatar({ index = 0, size = 48, className = '' }: { index?: number, size?: number, className?: string }) {
  const col = index % 3
  const row = Math.floor(index / 3) % 2
  return <span aria-hidden="true" className={`avatar ${className}`} style={{ width: size, height: size, backgroundPosition: `${col * 50}% ${row * 100}%` }} />
}
