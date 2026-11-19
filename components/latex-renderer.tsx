'use client'

import 'katex/dist/katex.min.css'
import { useMemo } from 'react'
import katex from 'katex'
import { comaDecimal } from '@/lib/numeros'

interface LaTeXRendererProps {
  content: string
  className?: string
}

function isLikelyTextNotMath(str: string): boolean {
  // If it contains explicit LaTeX commands (\frac, \sqrt, \sum, \mathbb, etc), it's math
  if (/\\[a-zA-Z]+/.test(str)) {
    return false
  }

  // Count words with 3 or more letters
  const textWords = str.match(/[a-zA-ZáéíóúñÁÉÍÓÚÑ]{3,}/g) || []

  // If there are 3 or more regular text words inside $...$, it's text, not inline math!
  if (textWords.length >= 3) {
    return true
  }

  // If it contains sentence punctuation (¿ ? ¡ !) and no math operators
  if (/[¿?¡!]/.test(str) && !/[=+\-*/<>^]/.test(str)) {
    return true
  }

  return false
}

export function LaTeXRenderer({ content: original, className = '' }: LaTeXRendererProps) {
  const renderedContent = useMemo(() => {
    // K1: coma decimal en todo lo que dibuja este componente (enunciados,
    // opciones, respuestas, fórmulas), también en lo ya generado con punto.
    const content = comaDecimal(original)
    const parts: (string | { type: 'latex'; content: string; display: boolean })[] = []
    let lastIndex = 0

    // Match both $$...$$ (display) and $...$ (inline)
    const regex = /\$\$([\s\S]*?)\$\$|\$((?:\\[$]|[^$])+?)\$/g
    let match

    while ((match = regex.exec(content)) !== null) {
      const latexContent = match[1] || match[2]
      const isDisplay = match[1] !== undefined

      // Check if it's a false inline match (text falsely wrapped in $)
      if (!isDisplay && isLikelyTextNotMath(latexContent)) {
        if (match.index > lastIndex) {
          parts.push(content.slice(lastIndex, match.index))
        }
        parts.push(match[0].replace(/^\$|\$$/g, '').replace(/\{,\}/g, ','))
        lastIndex = match.index + match[0].length
        continue
      }

      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(content.slice(lastIndex, match.index))
      }

      try {
        const rendered = katex.renderToString(latexContent, {
          throwOnError: false,
          displayMode: isDisplay,
          strict: false
        })
        parts.push({ type: 'latex', content: rendered, display: isDisplay })
      } catch {
        parts.push(latexContent)
      }

      lastIndex = match.index + match[0].length
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex))
    }

    return parts
  }, [original])

  return (
    <span className={`inline-block max-w-full min-w-0 break-words ${className}`}>
      {renderedContent.map((part, index) => {
        if (typeof part === 'string') {
          return <span key={index} className="break-words">{part}</span>
        }
        // Inline math keeps the horizontal scroll (a long formula can't wrap)
        // but hides the scrollbar chrome: on Windows the classic scrollbar has
        // arrow buttons at both ends, and sub-pixel rounding was enough to make
        // it appear under short fragments like $25$ or $7^2$. Display math is
        // wide on purpose, so there the scrollbar stays visible.
        return (
          <span
            key={index}
            className={
              part.display
                ? 'inline-block max-w-full overflow-x-auto align-middle break-words'
                : 'inline-block max-w-full overflow-x-auto align-middle break-words [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
            }
            dangerouslySetInnerHTML={{ __html: part.content }}
          />
        )
      })}
    </span>
  )
}
