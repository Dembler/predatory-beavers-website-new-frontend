import { sitePath } from '@/shared/sitePath'

export type MascotState =
  | 'idle'
  | 'greeting'
  | 'listening'
  | 'thinking'
  | 'talking'
  | 'happy'
  | 'sad'
  | 'point'
  | 'launcher-idle'
  | 'scroll-up'
  | 'scroll-down'

export interface MascotRenderer {
  mount(target: HTMLElement): Promise<void>
  setState(state: MascotState): void
  setReducedMotion(enabled: boolean): void
  setVisible(visible: boolean): void
  dispose(): void
}

interface Clip {
  row: number
  frameCount: number
  durationsMs: number[]
}
interface Manifest {
  image: { width: number; height: number; frameWidth: number; frameHeight: number }
  clips: Record<string, Clip>
}
const clips: Record<MascotState, string> = {
  idle: 'idle',
  greeting: 'waving',
  listening: 'waiting',
  thinking: 'review',
  talking: 'waiting',
  happy: 'jumping',
  sad: 'failed',
  point: 'waving',
  'launcher-idle': 'idle',
  'scroll-up': 'running-left',
  'scroll-down': 'running-right',
}
const oneShot = new Set<MascotState>(['greeting', 'happy', 'sad', 'point'])

/** Decorative player; chat, network requests and business state belong to its caller. */
export class SpriteMascotRenderer implements MascotRenderer {
  private canvas = document.createElement('canvas')
  private atlas = new Image()
  private manifest?: Manifest
  private state: MascotState = 'greeting'
  private frame = 0
  private reduced = false
  private visible = true
  private disposed = false
  private timer?: ReturnType<typeof setTimeout>

  async mount(target: HTMLElement) {
    const response = await fetch(sitePath('/mascot/bobrik/animation.json'))
    if (!response.ok) throw new Error('Mascot manifest unavailable')
    const manifest: Manifest = await response.json()
    this.atlas.src = sitePath('/mascot/bobrik/spritesheet.webp')
    await this.atlas.decode()
    if (this.disposed) return
    if (
      this.atlas.naturalWidth !== manifest.image.width ||
      this.atlas.naturalHeight !== manifest.image.height
    )
      throw new Error('Mascot atlas dimensions differ')
    for (const name of Object.values(clips)) {
      const clip = manifest.clips[name]
      if (
        !clip ||
        clip.frameCount !== clip.durationsMs.length ||
        clip.durationsMs.some((n) => n < 42)
      )
        throw new Error('Invalid mascot clip')
    }
    this.manifest = manifest
    this.canvas.width = manifest.image.frameWidth
    this.canvas.height = manifest.image.frameHeight
    this.canvas.style.cssText = 'width:100%;height:100%;display:block'
    this.canvas.setAttribute('aria-hidden', 'true')
    target.replaceChildren(this.canvas)
    this.restart()
  }

  setState(state: MascotState) {
    if (this.state === state) return
    this.state = state
    this.frame = 0
    this.restart()
  }
  setReducedMotion(enabled: boolean) {
    this.reduced = enabled
    this.frame = 0
    this.restart()
  }
  setVisible(visible: boolean) {
    this.visible = visible
    this.restart()
  }
  private restart() {
    clearTimeout(this.timer)
    if (!this.manifest || this.disposed) return
    const clip = this.manifest.clips[clips[this.state]]!
    const { frameWidth, frameHeight } = this.manifest.image
    const context = this.canvas.getContext('2d')
    context?.clearRect(0, 0, frameWidth, frameHeight)
    context?.drawImage(
      this.atlas,
      this.frame * frameWidth,
      clip.row * frameHeight,
      frameWidth,
      frameHeight,
      0,
      0,
      frameWidth,
      frameHeight,
    )
    this.canvas.dataset.frame = String(this.frame)
    this.canvas.dataset.state = this.state
    if (this.reduced || !this.visible || this.state === 'launcher-idle') return
    this.timer = setTimeout(() => {
      this.frame++
      if (this.frame >= clip.frameCount) {
        this.frame = 0
        if (oneShot.has(this.state)) this.state = 'idle'
      }
      this.restart()
    }, clip.durationsMs[this.frame])
  }
  dispose() {
    this.disposed = true
    clearTimeout(this.timer)
    this.canvas.remove()
    this.atlas.src = ''
  }
}
