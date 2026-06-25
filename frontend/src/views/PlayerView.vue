<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useYouTubePlayer } from '../composables/useYouTubePlayer'
import { usePlaybackEngine } from '../composables/usePlaybackEngine'
import ChordDisplay from '../components/ChordDisplay.vue'
import { assertBundleVersion } from '../utils/bundleVersion'
import type { TranscriptionBundle, SyncPlayData } from '../types/transcriptionBundle'

const bundle = ref<TranscriptionBundle | null>(null)
const syncPlay = ref<SyncPlayData | null>(null)

const { playerState, createPlayer, currentTime } = useYouTubePlayer()
const { activeEvent, activeEventIdx, activeProgress } = usePlaybackEngine(bundle, syncPlay, currentTime, playerState)

onMounted(async () => {
  const [bundleData, syncData] = await Promise.all([
    import('../fixtures/sample.bundle.json'),
    import('../fixtures/sample.sync-play.json'),
  ])
  const loaded = bundleData.default as TranscriptionBundle
  assertBundleVersion(loaded)
  bundle.value = loaded
  syncPlay.value = syncData.default as SyncPlayData
  if (loaded.source.kind === 'youtube') {
    createPlayer('yt-player', loaded.source.videoId)
  }
})
</script>

<template>
  <div class="player-page">
    <div class="video-wrapper">
      <div id="yt-player" />
    </div>
    <ChordDisplay
      v-if="bundle"
      :bundle="bundle"
      :active-event="activeEvent"
      :active-event-idx="activeEventIdx"
      :active-progress="activeProgress"
    />
  </div>
</template>

<style scoped>
.player-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1rem;
  max-width: 900px;
  margin: 0 auto;
}

.video-wrapper {
  aspect-ratio: 16 / 9;
  width: 100%;
}

.video-wrapper :deep(iframe),
.video-wrapper :deep(#yt-player) {
  width: 100%;
  height: 100%;
}
</style>
