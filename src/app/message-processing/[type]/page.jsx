import MessageEditorClient from './EditorClient';

export default async function MessageEditorPage({ params }) {
  const { type } = await params;
  return <MessageEditorClient type={type} />;
}
