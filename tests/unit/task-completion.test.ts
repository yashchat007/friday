import { describe, expect, it } from 'vitest'
import {
  inferTaskExpectation,
  isAutomationComplete,
  isTaskObjectiveMet,
  incompleteTaskHint
} from '../../electron/main/agent/task-completion'

describe('task completion heuristics', () => {
  it('detects notepad write intent', () => {
    const exp = inferTaskExpectation("open notepad for me, and write 'Hi i am yash on it'")
    expect(exp.needsNotepadLaunch).toBe(true)
    expect(exp.needsTyping).toBe(true)
  })

  it('fails objective when only path_resolve ran', () => {
    const exp = inferTaskExpectation('open notepad and write hello')
    const met = isTaskObjectiveMet(exp, [
      {
        id: '1',
        toolName: 'path_resolve',
        args: {},
        risk: 'safe',
        startedAt: 0,
        ok: true
      }
    ])
    expect(met).toBe(false)
    expect(incompleteTaskHint(exp, [])).toMatch(/desktop_launch/i)
  })

  it('passes when launch and type succeeded', () => {
    const exp = inferTaskExpectation('open notepad and write hello')
    const met = isTaskObjectiveMet(exp, [
      {
        id: '1',
        toolName: 'desktop_launch',
        args: { app: 'notepad' },
        risk: 'sensitive',
        startedAt: 0,
        ok: true
      },
      {
        id: '2',
        toolName: 'desktop_type_text',
        args: { text: 'hello' },
        risk: 'sensitive',
        startedAt: 0,
        ok: true
      }
    ])
    expect(met).toBe(true)
  })

  it('detects YouTube play intent and requires watch URL', () => {
    const exp = inferTaskExpectation("Open YouTube and play the song 'Desi Boys' on my laptop.")
    expect(exp.needsYoutubePlay).toBe(true)
    expect(exp.youtubeQuery).toBe('Desi Boys')
    expect(isTaskObjectiveMet(exp, [])).toBe(false)
    expect(
      isTaskObjectiveMet(exp, [
        {
          id: '1',
          toolName: 'browser_youtube_search_play',
          args: { query: 'Desi Boys' },
          risk: 'sensitive',
          startedAt: 0,
          ok: true,
          result: { url: 'https://www.youtube.com/watch?v=abc', videoId: 'abc', playing: true }
        }
      ])
    ).toBe(true)
  })

  it('does not complete generic automation without tool evidence', () => {
    const exp = inferTaskExpectation('list files in my documents folder')
    expect(isAutomationComplete(exp, [])).toBe(false)
    expect(
      isAutomationComplete(exp, [
        {
          id: '1',
          toolName: 'file_list',
          args: {},
          risk: 'safe',
          startedAt: 0,
          ok: true
        }
      ])
    ).toBe(true)
  })
})
