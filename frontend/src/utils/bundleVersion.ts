import type { PlayBundle } from '../types/playBundle'

const SUPPORTED_VERSIONS = [1]

export function assertBundleVersion(bundle: PlayBundle): void {
  if (!SUPPORTED_VERSIONS.includes(bundle.version)) {
    console.warn(
      `[chord-along] Unknown playback bundle version: ${bundle.version}. ` +
        `Supported: ${SUPPORTED_VERSIONS.join(', ')}. Attempting to render anyway.`,
    )
  }
}
