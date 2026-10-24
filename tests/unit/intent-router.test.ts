import { describe, expect, it } from 'vitest'
import { classifyUserIntent } from '../../electron/main/agent/intent-router'

describe('classifyUserIntent', () => {
  it('treats greetings as conversation', () => {
    expect(classifyUserIntent('Hi')).toBe('conversation')
    expect(classifyUserIntent('Hello!')).toBe('conversation')
  })

  it('treats recall questions as conversation', () => {
    expect(classifyUserIntent('My name is Yash. What is my name?')).toBe('conversation')
  })

  it('treats simple math questions as conversation', () => {
    expect(classifyUserIntent('What is 2 + 2?')).toBe('conversation')
  })

  it('treats how-to hypotheticals as conversation', () => {
    expect(classifyUserIntent('How would I open Notepad?')).toBe('conversation')
  })

  it('treats clear action requests as automation', () => {
    expect(classifyUserIntent("Open Notepad and type 'FRIDAY is working!'")).toBe('automation')
  })
})
