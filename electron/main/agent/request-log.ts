const PREFIX = '[friday:request]'

export function logRequestStage(
  requestId: string,
  stage: string,
  detail?: Record<string, string | number | boolean | undefined>
): void {
  const elapsed = detail?.elapsedMs !== undefined ? `${detail.elapsedMs}ms` : undefined
  const payload = { requestId, stage, ...detail }
  if (elapsed) {
    console.info(PREFIX, stage, requestId, elapsed, payload)
  } else {
    console.info(PREFIX, stage, requestId, payload)
  }
}
