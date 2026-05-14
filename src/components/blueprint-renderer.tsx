'use client'

interface BlueprintRendererProps {
  content: string
}

// Converts blueprint markdown to readable React elements
export default function BlueprintRenderer({ content }: BlueprintRendererProps) {
  if (!content) return null

  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]

    // h1
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={key++} className="text-cyan-400 font-bold text-base mt-4 mb-2 first:mt-0">
          {renderInline(line.slice(2))}
        </h1>
      )
      i++; continue
    }

    // h2
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={key++} className="text-purple-400 font-semibold text-sm mt-3 mb-1.5 border-b border-white/5 pb-1">
          {renderInline(line.slice(3))}
        </h2>
      )
      i++; continue
    }

    // h3
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={key++} className="text-slate-300 font-medium text-xs mt-2 mb-1">
          {renderInline(line.slice(4))}
        </h3>
      )
      i++; continue
    }

    // hr
    if (line.match(/^---+$/)) {
      elements.push(<hr key={key++} className="border-white/5 my-3" />)
      i++; continue
    }

    // ul
    if (line.match(/^[-*]\s/)) {
      const items: string[] = []
      while (i < lines.length && lines[i].match(/^[-*]\s/)) {
        items.push(lines[i].slice(2).trim())
        i++
      }
      elements.push(
        <ul key={key++} className="space-y-1 my-1">
          {items.map((item, idx) => (
            <li key={idx} className="text-slate-400 text-xs pl-4 relative before:content-['→'] before:absolute before:left-0 before:text-cyan-400">
              {renderInline(item)}
            </li>
          ))}
        </ul>
      )
      continue
    }

    // ol
    if (line.match(/^\d+\.\s/)) {
      const items: string[] = []
      while (i < lines.length && lines[i].match(/^\d+\.\s/)) {
        items.push(lines[i].replace(/^\d+\.\s/, '').trim())
        i++
      }
      elements.push(
        <ol key={key++} className="space-y-1 my-1 list-decimal list-inside">
          {items.map((item, idx) => (
            <li key={idx} className="text-slate-400 text-xs">{renderInline(item)}</li>
          ))}
        </ol>
      )
      continue
    }

    // empty line
    if (!line.trim()) { i++; continue }

    // paragraph
    elements.push(
      <p key={key++} className="text-slate-400 text-xs leading-relaxed my-1">
        {renderInline(line)}
      </p>
    )
    i++
  }

  return <>{elements}</>
}

function renderInline(text: string): React.ReactNode {
  // Bold
  text = text.replace(/\*\*(.+?)\*\*/g, '~~BOLD~~$1~~/BOLD~~')
  // Italic
  text = text.replace(/\*(.+?)\*/g, '~~ITALIC~~$1~~/ITALIC~~')
  // Inline code
  text = text.replace(/`(.+?)`/g, '~~CODE~~$1~~/CODE~~')

  const parts = text.split(/~~(BOLD|ITALIC|CODE)\s~(.*?)\s~~\/~~\1~~|~~(BOLD|ITALIC|CODE)~~(.*?)~~\/~~\3~~/)
  const result: React.ReactNode[] = []
  let k = 0

  for (const part of parts) {
    if (!part) continue
    if (part === 'BOLD') {
      const next = parts[++k]
      const content = parts[++k]
      result.push(<strong key={k}>{content}</strong>)
    } else if (part === 'ITALIC') {
      const content = parts[++k]
      result.push(<em key={k}>{content}</em>)
    } else if (part === 'CODE') {
      const content = parts[++k]
      result.push(<code key={k} className="bg-white/10 px-1 py-0.5 rounded text-purple-300 text-[11px]">{content}</code>)
    } else if (part === 'BOLD') {
      const content = parts[++k]
      result.push(<strong key={k}>{content}</strong>)
    } else if (part === 'ITALIC') {
      const content = parts[++k]
      result.push(<em key={k}>{content}</em>)
    } else if (part === 'CODE') {
      const content = parts[++k]
      result.push(<code key={k} className="bg-white/10 px-1 py-0.5 rounded text-purple-300 text-[11px]">{content}</code>)
    } else {
      result.push(part)
    }
    k++
  }

  return <>{result}</>
}
