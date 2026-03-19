import { useState } from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EditableNumberInput from '../../../src/components/common/EditableNumberInput'

function Harness() {
  const [value, setValue] = useState(5)

  return (
    <div>
      <EditableNumberInput aria-label="Count" value={value} onCommit={setValue} min={0} max={10} />
      <button type="button">Done</button>
    </div>
  )
}

describe('EditableNumberInput', () => {
  it('allows clearing before typing a replacement value', async () => {
    const user = userEvent.setup()

    render(<Harness />)

    const input = screen.getByLabelText('Count')
    await user.clear(input)
    expect(input).toHaveValue(null)

    await user.type(input, '3')
    expect(input).toHaveValue(3)

    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(input).toHaveValue(3)
  })

  it('restores the previous value when blurred while empty instead of forcing zero', async () => {
    const user = userEvent.setup()

    render(<Harness />)

    const input = screen.getByLabelText('Count')
    await user.clear(input)
    expect(input).toHaveValue(null)

    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(input).toHaveValue(5)
  })
})
