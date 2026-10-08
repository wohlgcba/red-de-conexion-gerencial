import { lazy, Suspense, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Bold, Eye, Italic, Link2, List, ListOrdered, PencilLine, Send, UploadCloud, X } from 'lucide-react'
import { Avatar } from '../components/common/Avatar'
import { Button, PageHeading, Surface } from '../components/common/UI'
import { TopicChip } from '../components/newsletters/NewsletterParts'
import { useCatalog } from '../app/useCatalog'
import type { Newsletter } from '../types'
import { formatDate } from '../utils/format'
import { getNewsletterAuthor, isOwnNewsletter } from '../utils/newsletterAuthor'
import { useObjectUrl } from '../app/useObjectUrl'
import { validateImageFile } from '../utils/imageCrop'
import './newsletter-editor.css'

const ImageCropDialog = lazy(() => import('../components/common/ImageCropDialog'))
const NewsletterPreviewDialog = lazy(() => import('../components/newsletters/NewsletterPreviewDialog'))

const topics = ['Innovación pública', 'Gestión', 'Datos', 'Participación', 'Ambiente', 'Procesos', 'Proyectos', 'Aprendizajes']

export function NewsletterEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { items, upsert, uploadCover, removeCover, people, currentPersonId, isAdmin, user } = useCatalog()
  const existing = items.find(item => item.id === id && isOwnNewsletter(item, currentPersonId, user.id))
  const author = getNewsletterAuthor({ authorId: currentPersonId ?? '' }, people)
  const [title, setTitle] = useState(existing?.title ?? '')
  const [subtitle, setSubtitle] = useState(existing?.subtitle ?? '')
  const [topic, setTopic] = useState(existing?.topic ?? '')
  const [content, setContent] = useState(existing?.body.join('\n\n') ?? '')
  const [image, setImage] = useState(existing?.image ?? '')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const croppedImage = useObjectUrl(imageFile)
  const displayedImage = croppedImage || image
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const fileInput = useRef<HTMLInputElement>(null)
  const contentInput = useRef<HTMLTextAreaElement>(null)

  const loadFile = (file?: File) => {
    if (!file || busy) return
    try { validateImageFile(file); setCropFile(file); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No pudimos abrir la imagen.') }
  }
  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => { loadFile(event.target.files?.[0]); event.target.value = '' }
  const onDrop = (event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); loadFile(event.dataTransfer.files[0]) }
  const formatContent = (before: string, after = before) => {
    const element = contentInput.current
    if (!element) return
    const selected = content.slice(element.selectionStart, element.selectionEnd) || 'texto'
    setContent(`${content.slice(0, element.selectionStart)}${before}${selected}${after}${content.slice(element.selectionEnd)}`)
    element.focus()
  }
  const save = async (status: 'borrador' | 'pendiente' | 'publicado') => {
    if (!currentPersonId && !isAdmin) { setError('Necesitás un perfil del directorio para publicar.'); return }
    if (status !== 'borrador' && (!title.trim() || !topic || !content.trim())) { setError('Completá título, temática y contenido para ' + (isAdmin ? 'publicar.' : 'enviar a revisión.')); return }
    setBusy(true); setError('')
    let uploadedPath: string | null = null
    try {
      uploadedPath = imageFile ? await uploadCover(imageFile) : null
      const imagePath = uploadedPath ?? (displayedImage ? existing?.imagePath ?? null : null)
      const item: Newsletter = {
        id: existing?.id ?? '', title: title.trim() || 'Newsletter sin título', subtitle: subtitle.trim(),
        topic: topic || 'Sin temática', image: displayedImage || '/assets/newsletter-placeholder.svg', imagePath,
        authorId: currentPersonId ?? '', authorUserId: user.id, date: existing?.date ?? today, updatedAt: today,
        readingMinutes: Math.max(1, Math.ceil(content.trim().split(/\s+/).length / 180)),
        featured: false, status, summary: subtitle.trim(), body: content.split(/\n\s*\n/).filter(Boolean),
        tags: topic ? [topic] : [], version: existing?.version,
      }
      const savedId = await upsert(item)
      if (existing?.imagePath && existing.imagePath !== imagePath) await removeCover(existing.imagePath).catch(() => undefined)
      navigate(status === 'publicado' ? `/newsletters/${savedId}` : '/mis-newsletters')
    } catch (cause) {
      if (uploadedPath) await removeCover(uploadedPath).catch(() => undefined)
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el newsletter.')
    }
    finally { setBusy(false) }
  }

  if (id && (!existing || !['borrador', 'cambios'].includes(existing.status))) return <Surface className="not-found"><h1>No podés editar este newsletter</h1><Link to="/mis-newsletters">Volver</Link></Surface>
  if (!currentPersonId && !isAdmin) return <Surface className="not-found"><h1>Tu cuenta no tiene perfil de autor en el directorio</h1><Link to="/newsletters">Volver</Link></Surface>

  const preview = <div className="quick-preview-card"><TopicChip topic={topic || 'Sin temática'} /><img src={displayedImage || '/assets/newsletter-placeholder.svg'} alt="Vista previa de portada" /><h3>{title || 'El título de tu newsletter'}</h3><p>{subtitle || 'El subtítulo aparecerá aquí cuando lo completes.'}</p><div className="quick-author"><Avatar name={author?.name} photoUrl={author.photoUrl} size={36} /><span><strong>{author?.name}</strong><small>{author?.role}<br />{author?.ministry}</small></span></div><div className="quick-footer"><span>{formatDate(today)}</span><span className="btn btn-outline">Leer newsletter</span></div></div>

  return <div className="page-stack"><Surface className="editor-surface"><PageHeading title={existing ? 'Editar mi newsletter' : 'Crear mi newsletter'} subtitle="Compartí una experiencia, proyecto o aprendizaje con la Red Gerencial." actions={<><Link className="btn btn-outline" to="/mis-newsletters">Cancelar</Link><Button variant="yellow" disabled={busy} onClick={() => setPreviewOpen(true)}><Eye size={20} /> Vista previa</Button></>} /><div className="editor-columns"><div className="editor-main"><section className="editor-section"><div className="section-title"><b>1</b><span><strong>Portada</strong><small>Subí una imagen que represente tu newsletter.</small></span></div><div className="upload-row"><button className="upload-zone" onClick={() => fileInput.current?.click()} onDragOver={event => event.preventDefault()} onDrop={onDrop}><UploadCloud size={40} /><strong>Arrastrá una imagen acá o hacé clic para seleccionar</strong><span>Formatos: JPG, PNG o WebP. Peso máximo: 5 MB.<br />Formato recomendado: 16:9 (ej. 1200 × 675 px).</span></button><div className="uploaded-image">{sourceFile && <Button className="cover-reframe" disabled={busy} onClick={() => setCropFile(sourceFile)}>Ajustar encuadre</Button>}<img src={displayedImage || '/assets/newsletter-placeholder.svg'} alt="Portada seleccionada" />{displayedImage && <button aria-label="Quitar imagen" onClick={() => { setImage(''); setImageFile(null); setSourceFile(null) }}><X size={17} /></button>}</div><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={onFileChange} hidden /></div></section><section className="editor-section"><div className="section-title"><b>2</b><span><strong>Datos principales</strong><small>Completá la información básica de tu newsletter.</small></span></div><div className="editor-fields"><label>Título <em>*</em><input value={title} onChange={event => setTitle(event.target.value.slice(0, 100))} placeholder="Simplificar procesos también es transformar" /><small>{title.length}/100</small></label><label>Subtítulo<textarea value={subtitle} onChange={event => setSubtitle(event.target.value.slice(0, 160))} placeholder="Una experiencia de articulación entre equipos." rows={2} /><small>{subtitle.length}/160</small></label><label>Temática <em>*</em><select value={topic} onChange={event => setTopic(event.target.value)}><option value="">Seleccionar temática</option>{topics.map(value => <option key={value}>{value}</option>)}</select></label></div></section><section className="editor-section"><div className="section-title"><b>3</b><span><strong>Contenido</strong><small>Desarrollá tu experiencia, contá los aprendizajes y resultados.</small></span></div><div className="text-editor"><div className="editor-toolbar"><span>Párrafo ▾</span><button aria-label="Negrita" onClick={() => formatContent('**')}><Bold size={18} /></button><button aria-label="Cursiva" onClick={() => formatContent('*')}><Italic size={18} /></button><button aria-label="Lista" onClick={() => formatContent('\n• ', '')}><List size={18} /></button><button aria-label="Lista numerada" onClick={() => formatContent('\n1. ', '')}><ListOrdered size={18} /></button><button aria-label="Enlace" onClick={() => formatContent('[', '](https://)')}><Link2 size={18} /></button></div><textarea ref={contentInput} value={content} onChange={event => setContent(event.target.value.slice(0, 5000))} placeholder="Escribí acá el contenido de tu newsletter..." /><span className="content-count">{content.length}/5000</span></div></section></div><div className="editor-side"><section className="editor-section"><div className="section-title"><b>4</b><span><strong>Autoría</strong><small>{isAdmin && !currentPersonId ? 'Publicación institucional de la Administración de la Red.' : 'Tu información se mostrará de forma automática.'}</small></span></div><div className="editor-author"><Avatar name={author?.name} photoUrl={author.photoUrl} size={72} /><span><strong>{author?.name}</strong><small>{author?.role}<br />{author?.ministry}</small></span></div></section><section className="editor-section"><div className="section-title"><b>5</b><span><strong>Vista rápida</strong><small>Así se verá tu newsletter en el directorio.</small></span></div>{preview}</section></div></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="editor-bottom"><Button disabled={busy} onClick={() => setPreviewOpen(true)}><Eye size={20} /> Vista previa</Button><Link className="btn btn-outline" to="/newsletters">Volver</Link><Button onClick={() => void save('borrador')} disabled={busy}><PencilLine size={18} /> Guardar borrador</Button><Button variant="primary" onClick={() => void save(isAdmin ? 'publicado' : 'pendiente')} disabled={busy}><Send size={18} /> {isAdmin ? 'Publicar newsletter' : 'Enviar a revisión'}</Button></div></Surface><Suspense fallback={<p role="status">Cargando herramientas de imagen y vista previa...</p>}>
    {cropFile && <ImageCropDialog file={cropFile} kind="cover" onClose={() => setCropFile(null)} onConfirm={file => { setImageFile(file); setSourceFile(cropFile); setCropFile(null); setError('') }} />}
    {previewOpen && <NewsletterPreviewDialog item={{ id: existing?.id ?? '', title: title || 'El t\u00edtulo de tu newsletter', subtitle, topic: topic || 'Sin tem\u00e1tica', image: displayedImage || '/assets/newsletter-placeholder.svg', authorId: currentPersonId ?? '', date: today, updatedAt: today, readingMinutes: Math.max(1, Math.ceil(content.trim().split(/\s+/).length / 180)), featured: false, status: 'borrador', summary: subtitle, body: content ? content.split(/\n\s*\n/).filter(Boolean) : ['El contenido aparecer\u00e1 ac\u00e1 cuando lo completes.'], tags: topic ? [topic] : [] }} author={author} isAdmin={isAdmin} busy={busy} error={error} onClose={() => setPreviewOpen(false)} onSave={status => void save(status)} />}
  </Suspense></div>
}
