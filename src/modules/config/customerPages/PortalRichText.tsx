import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Underline from "@tiptap/extension-underline";
import Strike from "@tiptap/extension-strike";
import Heading from "@tiptap/extension-heading";
import Blockquote from "@tiptap/extension-blockquote";
import HardBreak from "@tiptap/extension-hard-break";
import { BulletList, OrderedList, ListItem } from "@tiptap/extension-list";
export default function PortalRichText({
  value,
  text,
  onChange,
}: {
  value: unknown;
  text: string;
  onChange: (document: unknown) => void;
}) {
  const change = useRef(onChange);
  change.current = onChange;
  const initial = Array.isArray(value)
    ? { type: "doc", content: value }
    : value || {
        type: "doc",
        content: [
          { type: "paragraph", content: text ? [{ type: "text", text }] : [] },
        ],
      };
  const editor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
      Bold,
      Italic,
      Underline,
      Strike,
      Heading.configure({ levels: [2, 3, 4] }),
      Blockquote,
      HardBreak,
      BulletList,
      OrderedList,
      ListItem,
    ],
    content: initial,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        "aria-label": "Texto enriquecido",
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor }) => change.current(editor.getJSON().content || []),
  });
  useEffect(() => {
    if (
      editor &&
      JSON.stringify(editor.getJSON().content || []) !==
        JSON.stringify(value) &&
      Array.isArray(value)
    )
      editor.commands.setContent(
        { type: "doc", content: value },
        { emitUpdate: false },
      );
  }, [value, editor]);
  return (
    <div className="portal-rich-editor">
      <label>Texto enriquecido</label>
      <div role="toolbar" aria-label="Formato de texto">
        <button
          type="button"
          aria-label="Negrita"
          aria-pressed={editor?.isActive("bold")}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <strong>N</strong>
        </button>
        <button
          type="button"
          aria-label="Cursiva"
          aria-pressed={editor?.isActive("italic")}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <em>C</em>
        </button>
        <button
          type="button"
          aria-label="Subrayado"
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          <u>S</u>
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          Lista
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          1. Lista
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        >
          Cita
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().unsetAllMarks().run()}
        >
          Limpiar
        </button>
      </div>
      <EditorContent editor={editor} />
      <small>
        Puedes pegar texto; el formato se limita a los elementos admitidos.
      </small>
    </div>
  );
}
