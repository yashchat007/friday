import { FilesetResolver, HandLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision'

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

let landmarker: HandLandmarker | null = null

export type HandLandmarkMessage =
  | { type: 'ready' }
  | { type: 'landmarks'; points: { x: number; y: number }[] }
  | { type: 'error'; message: string }

self.onmessage = async (event: MessageEvent) => {
  const data = event.data as { type: string; bitmap?: ImageBitmap; timestamp?: number }

  if (data.type === 'init') {
    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE)
      landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandPresenceConfidence: 0.35,
        minTrackingConfidence: 0.35
      })
      const msg: HandLandmarkMessage = { type: 'ready' }
      self.postMessage(msg)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      self.postMessage({ type: 'error', message } satisfies HandLandmarkMessage)
    }
    return
  }

  if (data.type === 'frame' && landmarker && data.bitmap && data.timestamp !== undefined) {
    try {
      const result = landmarker.detectForVideo(data.bitmap, data.timestamp)
      data.bitmap.close()
      const points: { x: number; y: number }[] = []
      for (const hand of result.landmarks) {
        const tip = hand[8] as NormalizedLandmark | undefined
        const palm = hand[0] as NormalizedLandmark | undefined
        if (tip) points.push({ x: tip.x, y: tip.y })
        if (palm) points.push({ x: palm.x, y: palm.y })
      }
      self.postMessage({ type: 'landmarks', points } satisfies HandLandmarkMessage)
    } catch (err) {
      data.bitmap.close()
      const message = err instanceof Error ? err.message : String(err)
      self.postMessage({ type: 'error', message } satisfies HandLandmarkMessage)
    }
  }
}
