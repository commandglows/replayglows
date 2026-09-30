export const MILESTONES = ['speed', 'pin', 'loop', 'note', 'opened'] as const
export type Milestone = typeof MILESTONES[number]
export const PREFIX = 'discovery.v1.'
export const key = (name: string) => `${PREFIX}${name}`
export async function withTimeout<T>(operation: Promise<T>, milliseconds = 6000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Le délai de réponse est dépassé. Réessayez.')), milliseconds)
    })])
  } finally { clearTimeout(timer) }
}
export function achieved(data: Record<string, unknown>, id: Milestone): boolean {
  return data[key(id)] === true
}
export function nextLesson(data: Record<string, unknown>): Milestone | undefined {
  return MILESTONES.find(id => !achieved(data, id) && data[key(`skip.${id}`)] !== true)
}
// Independent, idempotent keys prevent different contexts overwriting progress.
export async function recordAchievement(id: Milestone): Promise<void> {
  const name = key(id)
  if ((await withTimeout(chrome.storage.local.get(name)))[name] !== true) await withTimeout(chrome.storage.local.set({ [name]: true }))
}
export function confirmsSpeed(before: number | undefined, requested: number, media: { available: boolean; rate: number; error: string } | null | undefined): boolean {
  return before !== undefined && Math.abs(before - requested) > 0.025 && !!media?.available
    && !media.error && Math.abs(media.rate - requested) < 0.025
}
