import { useCallback, useEffect, useMemo, useState } from 'react'
import { EditorContent, Extension, useEditor, useEditorState } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import type { Node } from '@tiptap/pm/model'
import { Plugin } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, Link2, List, ListOrdered, Quote, Redo2, Undo2 } from 'lucide-react'
import { NewsletterLinkDialog } from './NewsletterLinkDialog'
import type { LinkDraft } from './NewsletterLinkDialog'
import { NEWSLETTER_TEXT_LIMIT, normalizeNewsletterLink, sanitizeNewsletterHtml } from '../../utils/newsletterContent'
import './newsletter-rich-text.css'
import './newsletter-content.css'

const textOf = (doc: Node) => doc.textBetween(0, doc.content.size, '\n\n', '\n')

export default function NewsletterRichTextEditor({ initialContent, disabled, onChange }: {
  initialContent: string; disabled: boolean; onChange: (content: { html: string; text: string }) => void
}) {
  const [link, setLink] = useState<LinkDraft | null>(null)
  const [notice, setNotice] = useState('')
  const openLink = useCallback((instance: Editor) => {
    instance.commands.extendMarkRange('link')
    const { from, to } = instance.state.selection
    setLink({ from, to, text: instance.state.doc.textBetween(from, to, ' '), href: String(instance.getAttributes('link').href ?? '') })
  }, [])
  const extensions = useMemo(() => [
    StarterKit.configure({ heading: { levels: [2, 3] }, code: false, codeBlock: false, horizontalRule: false, strike: false, underline: false,
      link: { openOnClick: false, enableClickSelection: true, defaultProtocol: 'https', isAllowedUri: url => Boolean(normalizeNewsletterLink(url)), HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' } } }),
    Placeholder.configure({ placeholder: 'Escribí acá el contenido de tu newsletter…' }),
    Extension.create({ name: 'newsletterControls', addKeyboardShortcuts() { return { 'Mod-k': () => { openLink(this.editor); return true } } },
      addProseMirrorPlugins() { return [new Plugin({ filterTransaction(transaction, state) {
        if (!transaction.docChanged) return true
        const nextLength = textOf(transaction.doc).length
        if (nextLength > NEWSLETTER_TEXT_LIMIT && nextLength >= textOf(state.doc).length) {
          queueMicrotask(() => setNotice('El contenido admite hasta 5000 caracteres. Acortá el texto para continuar.'))
          return false
        }
        return true
      } })] } }),
  ], [openLink])
  const editor = useEditor({ extensions, content: initialContent, shouldRerenderOnTransaction: false,
    editorProps: { attributes: { class: 'newsletter-prose newsletter-editor-content', role: 'textbox', 'aria-label': 'Contenido del newsletter', 'aria-multiline': 'true', 'aria-describedby': 'newsletter-editor-count' },
      transformPastedHTML: sanitizeNewsletterHtml },
    onCreate: ({ editor: instance }) => onChange({ html: sanitizeNewsletterHtml(instance.getHTML()), text: textOf(instance.state.doc) }),
    onUpdate: ({ editor: instance }) => { setNotice(''); onChange({ html: sanitizeNewsletterHtml(instance.getHTML()), text: textOf(instance.state.doc) }) },
  })
  useEffect(() => { editor?.setEditable(!disabled) }, [editor, disabled])
  const state = useEditorState({ editor, selector: ({ editor: instance }) => instance ? {
    bold: instance.isActive('bold'), italic: instance.isActive('italic'), bullet: instance.isActive('bulletList'), ordered: instance.isActive('orderedList'),
    quote: instance.isActive('blockquote'), link: instance.isActive('link'), block: instance.isActive('heading', { level: 2 }) ? 'h2' : instance.isActive('heading', { level: 3 }) ? 'h3' : 'p',
    count: textOf(instance.state.doc).length, undo: instance.can().undo(), redo: instance.can().redo(),
  } : null })
  const closeLink = useCallback(() => { setLink(null); editor?.commands.focus() }, [editor])
  if (!editor || !state) return <p role="status">Cargando editor...</p>
  const tools = [
    { label: 'Negrita', shortcut: 'Ctrl+B', Icon: Bold, active: state.bold, run: () => editor.chain().focus().toggleBold().run() },
    { label: 'Cursiva', shortcut: 'Ctrl+I', Icon: Italic, active: state.italic, run: () => editor.chain().focus().toggleItalic().run() },
    { label: 'Lista con viñetas', Icon: List, active: state.bullet, run: () => editor.chain().focus().toggleBulletList().run() },
    { label: 'Lista numerada', Icon: ListOrdered, active: state.ordered, run: () => editor.chain().focus().toggleOrderedList().run() },
    { label: 'Cita', Icon: Quote, active: state.quote, run: () => editor.chain().focus().toggleBlockquote().run() },
    { label: state.link ? 'Editar enlace' : 'Insertar enlace', shortcut: 'Ctrl+K', Icon: Link2, active: state.link, run: () => openLink(editor) },
  ]
  return <div className={`newsletter-rich-editor ${disabled ? 'is-disabled' : ''}`}>
    <div className="newsletter-rich-toolbar" role="group" aria-label="Formato del contenido">
      <select aria-label="Estilo de párrafo" value={state.block} disabled={disabled} onChange={event => {
        const value = event.target.value
        if (value === 'p') editor.chain().focus().setParagraph().run()
        else editor.chain().focus().setHeading({ level: value === 'h2' ? 2 : 3 }).run()
      }}><option value="p">Párrafo</option><option value="h2">Título de sección</option><option value="h3">Subtítulo</option></select>
      {tools.map(({ label, shortcut, Icon, active, run }) => <button key={Icon.displayName ?? label} type="button" disabled={disabled} aria-label={label} aria-pressed={active} title={`${label}${shortcut ? ` (${shortcut})` : ''}`} onMouseDown={event => event.preventDefault()} onClick={run}><Icon size={18} /></button>)}
      <span className="newsletter-toolbar-spacer" />
      <button type="button" aria-label="Deshacer" title="Deshacer (Ctrl+Z)" disabled={disabled || !state.undo} onMouseDown={event => event.preventDefault()} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={18} /></button>
      <button type="button" aria-label="Rehacer" title="Rehacer (Ctrl+Shift+Z)" disabled={disabled || !state.redo} onMouseDown={event => event.preventDefault()} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={18} /></button>
    </div>
    <EditorContent editor={editor} />
    <div className="newsletter-rich-footer"><span role="status">{notice}</span><span id="newsletter-editor-count">{state.count}/{NEWSLETTER_TEXT_LIMIT}</span></div>
    {link && <NewsletterLinkDialog draft={link} onClose={closeLink} onApply={(href, text) => {
      const before = editor.state.doc
      const chain = editor.chain().focus().setTextSelection({ from: link.from, to: link.to })
      if (text === link.text.trim() && link.from !== link.to) chain.setLink({ href }).run()
      else chain.insertContentAt({ from: link.from, to: link.to }, { type: 'text', text, marks: [{ type: 'link', attrs: { href, target: '_blank', rel: 'noopener noreferrer' } }] }).unsetMark('link').setMeta('preventAutolink', true).run()
      return !editor.state.doc.eq(before) || (href === link.href && text === link.text.trim())
    }} onRemove={() => { editor.chain().focus().setTextSelection({ from: link.from, to: link.to }).unsetLink().run(); closeLink() }} />}
  </div>
}
