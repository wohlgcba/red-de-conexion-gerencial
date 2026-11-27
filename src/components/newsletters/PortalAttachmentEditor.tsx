import { Button } from '../common/UI'
import { ATTACHMENT_ACCEPT, attachmentFileType, MAX_ATTACHMENTS, needsPdfPreview } from '../../services/portalAttachments'
import type { AttachmentUpload, PortalAttachment } from '../../services/portalAttachments'
import './portal-attachments.css'

export function PortalAttachmentEditor({ saved, pending, setSaved, setPending, setError, disabled }: {
  saved: PortalAttachment[]; pending: AttachmentUpload[]
  setSaved: (files: PortalAttachment[]) => void; setPending: (files: AttachmentUpload[]) => void
  setError: (message: string) => void; disabled: boolean
}) {
  return <section className="editor-section portal-attachment-field">
    <h3>Archivos adjuntos</h3>
    <small>Hasta {MAX_ATTACHMENTS} archivos de 25 MB cada uno. Para Word y PowerPoint, adjuntá también una copia en PDF para la vista previa.</small>
    <label>PDF, DOC, DOCX, PPT, PPTX, JPG, PNG o WebP
      <input type="file" accept={ATTACHMENT_ACCEPT} multiple disabled={disabled || saved.length + pending.length >= MAX_ATTACHMENTS} onChange={event => {
        const files = Array.from(event.target.files ?? [])
        event.target.value = ''
        try {
          if (saved.length + pending.length + files.length > MAX_ATTACHMENTS) throw new Error(`Podés adjuntar hasta ${MAX_ATTACHMENTS} archivos.`)
          files.forEach(attachmentFileType)
          setPending([...pending, ...files.map(file => ({ file }))])
          setError('')
        } catch (cause) { setError((cause as Error).message) }
      }} />
    </label>
    {saved.map(file => <div className="portal-attachment-row" key={file.path}><span>{file.name}</span><Button disabled={disabled} onClick={() => setSaved(saved.filter(item => item !== file))}>Quitar archivo</Button></div>)}
    {pending.map((entry, index) => <div className="portal-attachment" key={`${index}-${entry.file.name}`}>
      <div className="portal-attachment-row"><span>{entry.file.name}</span><Button disabled={disabled} onClick={() => setPending(pending.filter((_, position) => index !== position))}>Quitar archivo</Button></div>
      {needsPdfPreview(attachmentFileType(entry.file).mime) && <label>PDF para ver {entry.file.name}{entry.preview && ` · ${entry.preview.name}`}
        <input type="file" accept=".pdf,application/pdf" disabled={disabled} onChange={event => {
          const preview = event.target.files?.[0]
          event.target.value = ''
          if (!preview) return
          try {
            if (attachmentFileType(preview).mime !== 'application/pdf') throw new Error('La vista previa debe ser un PDF.')
            setPending(pending.map((item, position) => position === index ? { ...item, preview } : item))
            setError('')
          } catch (cause) { setError((cause as Error).message) }
        }} />
      </label>}
    </div>)}
  </section>
}
