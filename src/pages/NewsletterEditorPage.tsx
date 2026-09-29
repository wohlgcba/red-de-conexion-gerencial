import { useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Bold, Eye, Italic, Link2, List, ListOrdered, PencilLine, Send, UploadCloud, X } from 'lucide-react'
import { Avatar } from '../components/common/Avatar'
import { Button, PageHeading, Surface } from '../components/common/UI'
import { TopicChip } from '../components/newsletters/NewsletterParts'
import { useCatalog } from '../app/useCatalog'
import type { Newsletter } from '../types'
import { formatDate } from '../utils/format'

const topics = ['Innovación pública', 'Gestión', 'Datos', 'Participación', 'Ambiente', 'Procesos', 'Proyectos', 'Aprendizajes']

export function NewsletterEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { items, upsert, uploadCover, removeCover, people, currentPersonId } = useCatalog()
  const existing = items.find(item => item.id === id && item.authorId === currentPersonId)
  const author = people.find(person => person.id === currentPersonId)
  const [title, setTitle] = useState(existing?.title ?? '')
  const [subtitle, setSubtitle] = useState(existing?.subtitle ?? '')
  const [topic, setTopic] = useState(existing?.topic ?? '')
  const [content, setContent] = useState(existing?.body.join('\n\n') ?? '')
  const [image, setImage] = useState(existing?.image ?? '')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const fileInput = useRef<HTMLInputElement>(null)
  const contentInput = useRef<HTMLTextAreaElement>(null)

  const loadFile = (file?: File) => {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError('Elegí una imagen JPG, PNG o WebP de hasta 5 MB.'); return }
    const reader = new FileReader()
    reader.onload = () => { setImage(String(reader.result)); setImageFile(file); setError('') }
    reader.readAsDataURL(file)
  }
  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => loadFile(event.target.files?.[0])
  const onDrop = (event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); loadFile(event.dataTransfer.files[0]) }
  const formatContent = (before: string, after = before) => {
    const element = contentInput.current
    if (!element) return
    const selected = content.slice(element.selectionStart, element.selectionEnd) || 'texto'
    setContent(`${content.slice(0, element.selectionStart)}${before}${selected}${after}${content.slice(element.selectionEnd)}`)
    element.focus()
  }
  const save = async (status: 'borrador' | 'pendiente') => {
    if (!currentPersonId) { setError('Necesitás un perfil del directorio para publicar.'); return }
    if (status === 'pendiente' && (!title.trim() || !topic || !content.trim())) { setError('Completá título, temática y contenido para enviar a revisión.'); return }
    setBusy(true); setError('')
    let uploadedPath: string | null = null
    try {
      uploadedPath = imageFile ? await uploadCover(imageFile) : null
      const imagePath = uploadedPath ?? (image ? existing?.imagePath ?? null : null)
      const item: Newsletter = {
        id: existing?.id ?? '', title: title.trim() || 'Newsletter sin título', subtitle: subtitle.trim(),
        topic: topic || 'Sin temática', image: image || '/assets/newsletter-placeholder.svg', imagePath,
        authorId: currentPersonId, date: existing?.date ?? today, updatedAt: today,
        readingMinutes: Math.max(1, Math.ceil(content.trim().split(/\s+/).length / 180)),
        featured: false, status, summary: subtitle.trim(), body: content.split(/\n\s*\n/).filter(Boolean),
        tags: topic ? [topic] : [], version: existing?.version,
      }
      await upsert(item)
      if (existing?.imagePath && existing.imagePath !== imagePath) await removeCover(existing.imagePath).catch(() => undefined)
      navigate('/mis-newsletters')
    } catch (cause) {
      if (uploadedPath) await removeCover(uploadedPath).catch(() => undefined)
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el newsletter.')
    }
    finally { setBusy(false) }
  }

  if (id && (!existing || !['borrador', 'cambios'].includes(existing.status))) return <Surface className="not-found"><h1>No podés editar este newsletter</h1><Link to="/mis-newsletters">Volver</Link></Surface>
  if (!currentPersonId) return <Surface className="not-found"><h1>Tu cuenta no tiene perfil de autor en el directorio</h1><Link to="/newsletters">Volver</Link></Surface>

  const preview = <div className="quick-preview-card"><TopicChip topic={topic || 'Sin temática'} /><img src={image || '/assets/newsletter-placeholder.svg'} alt="Vista previa de portada" /><h3>{title || 'El título de tu newsletter'}</h3><p>{subtitle || 'El subtítulo aparecerá aquí cuando lo completes.'}</p><div className="quick-author"><Avatar name={author?.name} size={36} /><span><strong>{author?.name}</strong><small>{author?.role}<br />{author?.ministry}</small></span></div><div className="quick-footer"><span>{formatDate(today)}</span><span className="btn btn-outline">Leer newsletter</span></div></div>

  return <div className="page-stack"><Surface className="editor-surface"><PageHeading title={existing ? 'Editar mi newsletter' : 'Crear mi newsletter'} subtitle="Compartí una experiencia, proyecto o aprendizaje con la Red Gerencial." actions={<><Link className="btn btn-outline" to="/mis-newsletters">Cancelar</Link><Button variant="yellow" onClick={() => setPreviewOpen(true)}><Eye size={20} /> Vista previa</Button></>} /><div className="editor-columns"><div className="editor-main"><section className="editor-section"><div className="section-title"><b>1</b><span><strong>Portada</strong><small>Subí una imagen que represente tu newsletter.</small></span></div><div className="upload-row"><button className="upload-zone" onClick={() => fileInput.current?.click()} onDragOver={event => event.preventDefault()} onDrop={onDrop}><UploadCloud size={40} /><strong>Arrastrá una imagen acá o hacé clic para seleccionar</strong><span>Formatos: JPG, PNG o WebP. Peso máximo: 5 MB.<br />Formato recomendado: 16:9 (ej. 1200 × 675 px).</span></button><div className="uploaded-image"><img src={image || '/assets/newsletter-placeholder.svg'} alt="Portada seleccionada" />{image && <button aria-label="Quitar imagen" onClick={() => { setImage(''); setImageFile(null) }}><X size={17} /></button>}</div><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={onFileChange} hidden /></div></section><section className="editor-section"><div className="section-title"><b>2</b><span><strong>Datos principales</strong><small>Completá la información básica de tu newsletter.</small></span></div><div className="editor-fields"><label>Título <em>*</em><input value={title} onChange={event => setTitle(event.target.value.slice(0, 100))} placeholder="Simplificar procesos también es transformar" /><small>{title.length}/100</small></label><label>Subtítulo<textarea value={subtitle} onChange={event => setSubtitle(event.target.value.slice(0, 160))} placeholder="Una experiencia de articulación entre equipos." rows={2} /><small>{subtitle.length}/160</small></label><label>Temática <em>*</em><select value={topic} onChange={event => setTopic(event.target.value)}><option value="">Seleccionar temática</option>{topics.map(value => <option key={value}>{value}</option>)}</select></label></div></section><section className="editor-section"><div className="section-title"><b>3</b><span><strong>Contenido</strong><small>Desarrollá tu experiencia, contá los aprendizajes y resultados.</small></span></div><div className="text-editor"><div className="editor-toolbar"><span>Párrafo ▾</span><button aria-label="Negrita" onClick={() => formatContent('**')}><Bold size={18} /></button><button aria-label="Cursiva" onClick={() => formatContent('*')}><Italic size={18} /></button><button aria-label="Lista" onClick={() => formatContent('\n• ', '')}><List size={18} /></button><button aria-label="Lista numerada" onClick={() => formatContent('\n1. ', '')}><ListOrdered size={18} /></button><button aria-label="Enlace" onClick={() => formatContent('[', '](https://)')}><Link2 size={18} /></button></div><textarea ref={contentInput} value={content} onChange={event => setContent(event.target.value.slice(0, 5000))} placeholder="Escribí acá el contenido de tu newsletter..." /><span className="content-count">{content.length}/5000</span></div></section></div><div className="editor-side"><section className="editor-section"><div className="section-title"><b>4</b><span><strong>Autoría</strong><small>Tu información se mostrará de forma automática.</small></span></div><div className="editor-author"><Avatar name={author?.name} size={72} /><span><strong>{author?.name}</strong><small>{author?.role}<br />{author?.ministry}</small></span></div></section><section className="editor-section"><div className="section-title"><b>5</b><span><strong>Vista rápida</strong><small>Así se verá tu newsletter en el directorio.</small></span></div>{preview}</section></div></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="editor-bottom"><Link className="btn btn-outline" to="/newsletters">Volver</Link><Button onClick={() => void save('borrador')} disabled={busy}><PencilLine size={18} /> Guardar borrador</Button><Button variant="primary" onClick={() => void save('pendiente')} disabled={busy}><Send size={18} /> Enviar a revisión</Button></div></Surface>{previewOpen && <div className="modal-backdrop" role="presentation" onClick={() => setPreviewOpen(false)}><div className="preview-modal" role="dialog" aria-modal="true" aria-label="Vista previa del newsletter" onClick={event => event.stopPropagation()}><div className="panel-heading"><h2>Vista previa</h2><button onClick={() => setPreviewOpen(false)} aria-label="Cerrar vista previa"><X size={20} /></button></div><img src={image || '/assets/newsletter-placeholder.svg'} alt="Portada" /><TopicChip topic={topic || 'Sin temática'} /><h2>{title || 'El título de tu newsletter'}</h2><p>{subtitle || 'El subtítulo aparecerá aquí.'}</p><div className="preview-body">{content || 'El contenido de tu newsletter aparecerá acá.'}</div></div></div>}</div>
}
