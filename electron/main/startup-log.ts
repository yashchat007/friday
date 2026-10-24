const PREFIX = '[friday:startup]'

export function logStartup(message: string, detail?: unknown): void {
  if (detail !== undefined) {
    console.info(PREFIX, message, detail)
  } else {
    console.info(PREFIX, message)
  }
}

export function logStartupError(message: string, err?: unknown): void {
  console.error(PREFIX, message, err)
}

const ORB_PREFIX = '[friday:orb]'

export function logOrb(message: string, detail?: unknown): void {
  if (detail !== undefined) {
    console.info(ORB_PREFIX, message, detail)
  } else {
    console.info(ORB_PREFIX, message)
  }
}

export function logOrbError(message: string, err?: unknown): void {
  console.error(ORB_PREFIX, message, err)
}

export function installMainDiagnostics(): void {
  process.on('uncaughtException', (err) => {
    logStartupError('uncaughtException', err)
  })
  process.on('unhandledRejection', (reason) => {
    logStartupError('unhandledRejection', reason)
  })
}
