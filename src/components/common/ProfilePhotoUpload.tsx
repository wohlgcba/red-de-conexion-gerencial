import { lazy, Suspense, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { Button } from './UI'
import { useCatalog } from '../../app/useCatalog'
import { validateImageFile } from '../../utils/imageCrop'

const ImageCropDialog = lazy(() => import('./ImageCropDialog'))

export function ProfilePhotoUpload() {
  const { saveProfilePhoto } = useCatalog()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  return <div className="profile-photo-upload">
    <Button onClick={() => input.current?.click()}><Camera size={17} /> Cambiar foto de perfil</Button>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={event => {
      const selected = event.target.files?.[0]; event.target.value = ''
      if (!selected) return
      try { validateImageFile(selected); setFile(selected); setError(''); setNotice('') }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'No pudimos abrir la imagen.') }
    }} />
    {error && <p className="form-error" role="alert">{error}</p>}
    {notice && <p className="photo-upload-notice" role="status">{notice}</p>}
    <Suspense fallback={<p role="status">Cargando encuadre...</p>}>
      {file && <ImageCropDialog file={file} kind="avatar" onClose={() => setFile(null)} onConfirm={async cropped => {
        await saveProfilePhoto(cropped); setFile(null); setNotice('Tu foto de perfil se actualizó.')
      }} />}
    </Suspense>
  </div>
}
