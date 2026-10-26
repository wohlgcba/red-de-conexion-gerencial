import { emailHref } from './emailCompose.ts'

export function candidateInvitation(name: string, origin: string) {
  const formUrl = new URL('/solicitar-acceso', origin).href
  const subject = 'Invitación a la Red de Conexión Gerencial'
  const body = `Hola, ${name.trim() || '¿cómo estás?'}:\n\nTe invitamos a sumarte a la Red de Conexión Gerencial, un espacio para conectar con otras áreas y compartir experiencias y aprendizajes de gestión.\n\nPara solicitar tu incorporación, completá el formulario de ingreso:\n${formUrl}\n\nSi ya tenés una cuenta en las aplicaciones de BASE GCBA, usá tu contraseña actual. Si todavía no tenés cuenta, podés crearla desde el mismo formulario y verificar tu correo.\n\nLa solicitud será revisada por la administración de la Red.\n\n¡Esperamos contar con tu participación!\nAdministración de la Red de Conexión Gerencial`
  return { subject, body, formUrl }
}
export function invitationMailto(email: string, invitation: ReturnType<typeof candidateInvitation>) {
  return emailHref(email, invitation)
}
