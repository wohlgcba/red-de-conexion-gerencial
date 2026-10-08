import { useCallback, useId, useRef, useState } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { Crop, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import { DirectoryDialog } from '../directory/DirectoryDialog'
import { Button } from './UI'
import { cropImage } from '../../utils/imageCrop'
import { useObjectUrl } from '../../app/useObjectUrl'
import 'react-easy-crop/react-easy-crop.css'
import './image-crop.css'

export default function ImageCropDialog({ file, kind, onConfirm, onClose }: {
  file: File; kind: 'cover' | 'avatar'; onConfirm: (file: File) => void | Promise<void>; onClose: () => void
}) {
  const source = useObjectUrl(file)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const [error, setError] = useState('')
  const [invalidMedia, setInvalidMedia] = useState(false)
  const [busy, setBusy] = useState(false)
  const saving = useRef(false)
  const zoomInput = useRef<HTMLInputElement>(null)
  const id = useId()
  const avatar = kind === 'avatar'
  const close = useCallback(() => { if (!saving.current) onClose() }, [onClose])
  const apply = async () => {
    if (!area || saving.current || invalidMedia) return
    saving.current = true; setBusy(true); setError('')
    try { await onConfirm(await cropImage(source, area, avatar ? 512 : 1280)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No pudimos guardar la imagen.') }
    finally { saving.current = false; setBusy(false) }
  }
  return <DirectoryDialog title={avatar ? 'Encuadrar foto de perfil' : 'Encuadrar portada'} titleIcon={<Crop size={22} />} className="image-crop-dialog"
    onClose={close} busy={busy} initialFocusRef={zoomInput} describedBy={`${id}-help`} footer={<>
      <Button disabled={busy} onClick={close}>Cancelar</Button><Button variant="primary" disabled={!area || busy || invalidMedia} onClick={() => void apply()}>{busy ? 'Guardando imagen...' : 'Usar este encuadre'}</Button>
    </>}>
    <p className="image-crop-help" id={`${id}-help`}>Mové la imagen para elegir el encuadre y ajustá el zoom. {avatar ? 'La foto se mostrará dentro de un círculo.' : 'La portada mantendrá la proporción 16:9.'}</p>
    <div className={`image-crop-stage ${avatar ? 'is-avatar' : ''}`}>
      {source && <Cropper image={source} crop={crop} zoom={zoom} aspect={avatar ? 1 : 16 / 9} cropShape={avatar ? 'round' : 'rect'} objectFit="contain"
        onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_percentages, pixels) => setArea(pixels)}
        onMediaLoaded={media => { if (media.naturalWidth * media.naturalHeight > 40_000_000) { setInvalidMedia(true); setError('La imagen es demasiado grande. Elegí una de hasta 40 megapíxeles.'); setArea(null) } }}
        mediaProps={{ onError: () => { setInvalidMedia(true); setArea(null); setError('No pudimos abrir la imagen. Elegí otro archivo.') } }}
        showGrid={!avatar} zoomWithScroll={false} keyboardStep={8} disableAutomaticStylesInjection />}
    </div>
    <div className="image-crop-controls"><label htmlFor={`${id}-zoom`}>Zoom <strong>{Math.round(zoom * 100)}%</strong></label>
      <div><ZoomOut size={18} aria-hidden="true" /><input ref={zoomInput} id={`${id}-zoom`} type="range" min="1" max="3" step="0.01" value={zoom}
        disabled={busy} onChange={event => setZoom(Number(event.target.value))} /><ZoomIn size={18} aria-hidden="true" />
        <Button variant="ghost" disabled={busy} onClick={() => { setCrop({ x: 0, y: 0 }); setZoom(1) }}><RotateCcw size={16} /> Restablecer</Button></div>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
  </DirectoryDialog>
}
