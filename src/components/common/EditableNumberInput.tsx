import { useEffect, useMemo, useState } from 'react'

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value: number
  onCommit: (value: number) => void
}

function toBound(value: number | string | undefined): number | null {
  if (value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? null : parsed
}

export default function EditableNumberInput({ value, onCommit, min, max, onBlur, onFocus, onKeyDown, ...props }: Props) {
  const [draft, setDraft] = useState(String(value))
  const [isEditing, setIsEditing] = useState(false)

  const minValue = useMemo(() => toBound(min), [min])
  const maxValue = useMemo(() => toBound(max), [max])

  useEffect(() => {
    if (!isEditing) {
      setDraft(String(value))
    }
  }, [isEditing, value])

  const commitDraft = () => {
    if (draft.trim() === '') {
      setDraft(String(value))
      return
    }

    let nextValue = Number.parseInt(draft, 10)
    if (Number.isNaN(nextValue)) {
      setDraft(String(value))
      return
    }

    if (minValue !== null) nextValue = Math.max(minValue, nextValue)
    if (maxValue !== null) nextValue = Math.min(maxValue, nextValue)

    setDraft(String(nextValue))
    if (nextValue !== value) {
      onCommit(nextValue)
    }
  }

  return (
    <input
      {...props}
      type="number"
      min={min}
      max={max}
      value={draft}
      onFocus={(event) => {
        setIsEditing(true)
        onFocus?.(event)
      }}
      onChange={(event) => {
        setDraft(event.target.value)
      }}
      onBlur={(event) => {
        setIsEditing(false)
        commitDraft()
        onBlur?.(event)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur()
        }
        onKeyDown?.(event)
      }}
    />
  )
}
