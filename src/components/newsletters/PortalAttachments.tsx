import { useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { Button } from '../common/UI'
import { getAttachmentUrl, needsPdfPreview } from '../../services/portalAttachments'
import type { PortalAttachment } from '../../services/portalAttachments'
import './portal-attachments.css'

export function PortalAttachments({ files }: { files: PortalAttachment[] }) {
  if (!files.length) return null
  return <section className="portal-attachments"><h2>Archivos adjuntos</h2>
    {files.map(file => <Attachment key={file.path} file={file} />)}
  </section>
}

function Attachment({ file }: { file: PortalAttachment }) {
  const [previewUrl, setPreviewUrl] = useState('')
  const [downloadUrl, setDownloadUrl] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function showPreview() {
    setBusy(true)
    setError('')
    try { setPreviewUrl(await getAttachmentUrl(file, false)) }
    catch (cause) { setError((cause as Error).message) }
    finally { setBusy(false) }
  }

  async function download() {
    setBusy(true)
    setError('')
    try {
      const url = await getAttachmentUrl(file, true)
      setDownloadUrl(url)
      const link = document.createElement('a')
      link.href = url
      link.click()
    } catch (cause) { setError((cause as Error).message) }
    finally { setBusy(false) }
  }

  const canPreview = file.previewPath || !needsPdfPreview(file.mime)
  return <div className="portal-attachment">
    <div className="portal-attachment-row">
      <span><FileText size={19} aria-hidden="true" />{file.name}</span>
      {canPreview && <Button disabled={busy} onClick={() => previewUrl ? setPreviewUrl('') : void showPreview()} aria-expanded={Boolean(previewUrl)}>{previewUrl ? 'Cerrar vista previa' : 'Ver archivo'}</Button>}
      <Button disabled={busy} onClick={() => void download()}><Download size={16} /> Descargar original</Button>
    </div>
    {error && <p role="alert" className="form-error">{error}</p>}
    {previewUrl && (file.mime.startsWith('image/') && !file.previewPath
      ? <img className="portal-attachment-image" src={previewUrl} alt={file.name} onError={() => setError('No se pudo mostrar la imagen.')} />
      : <><iframe className="portal-attachment-pdf" src={previewUrl} title={`Vista previa de ${file.name}`} /><a className="portal-file-link" href={previewUrl} target="_blank" rel="noreferrer">Abrir PDF en otra pestaña</a></>)}
    {downloadUrl && <a className="portal-file-link" href={downloadUrl}>Volver a descargar</a>}
  </div>
}
