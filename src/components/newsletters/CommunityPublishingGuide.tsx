import { Surface } from '../common/UI'

export function CommunityPublishingGuide() {
  return <Surface className="portal-publishing-guide">
    <h3>Cómo publicar en COMPARTÍ CON LA RED</h3>
    <p>¿Tenés una herramienta, experiencia o buena práctica que pueda ayudar a otros gerentes? Sumala al conocimiento colectivo.</p>
    <div className="portal-publishing-steps">
      <section>
        <h4>Qué podés compartir</h4>
        <ul>
          <li>Una herramienta que usás en tu gestión o una buena práctica de tu equipo.</li>
          <li>Una experiencia, un aprendizaje o un material útil para otros gerentes.</li>
          <li>Una recomendación de lectura, un enlace o un video de YouTube.</li>
        </ul>
      </section>
      <section>
        <h4>Cómo enviar tu aporte</h4>
        <ol>
          <li>Elegí <strong>Crear mi publicación</strong>. Agregá un título, una breve descripción y una o más etiquetas temáticas.</li>
          <li>Adjuntá el archivo o usá <strong>Insertar enlace</strong> para agregar una URL, incluso de YouTube.</li>
          <li>Elegí <strong>Enviar a revisión</strong>. Tras la aprobación, tu aporte quedará publicado con tu nombre.</li>
        </ol>
      </section>
    </div>
  </Surface>
}
