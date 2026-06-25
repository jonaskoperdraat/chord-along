import type { TranscriptionBundle } from '../types/transcriptionBundle'

const SUPPORTED_VERSIONS = [1]

export function assertBundleVersion(bundle: TranscriptionBundle): void {
  if (!SUPPORTED_VERSIONS.includes(bundle.version)) {
    console.warn(
      `[chord-along] Unknown transcription bundle version: ${bundle.version}. ` +
        `Supported: ${SUPPORTED_VERSIONS.join(', ')}. Attempting to render anyway.`,
    )
  }
}
