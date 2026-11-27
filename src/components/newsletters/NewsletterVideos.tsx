import { useState } from 'react'
import { ExternalLink, Play } from 'lucide-react'

export function NewsletterVideos({ ids }: { ids: string[] }) {
  if (!ids.length) return null
  return <section className="newsletter-videos">
    <h2>{ids.length === 1 ? 'Video de YouTube' : 'Videos de YouTube'}</h2>
    {ids.map((id, index) => <YouTubeVideo key={id} id={id} label={ids.length > 1 ? `Video ${index + 1} de YouTube` : 'Video de YouTube'} />)}
  </section>
}

function YouTubeVideo({ id, label }: { id: string; label: string }) {
  const [playing, setPlaying] = useState(false)
  return <div className="newsletter-video">
    {playing ? <iframe
      src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
      title={label}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
    /> : <button type="button" className="btn btn-primary" onClick={() => setPlaying(true)} aria-label={`Reproducir ${label} en el Portal`}>
      <Play size={18} aria-hidden="true" /> Reproducir en el Portal
    </button>}
    <a href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noopener noreferrer">
      Abrir en YouTube <ExternalLink size={14} aria-hidden="true" />
    </a>
  </div>
}
