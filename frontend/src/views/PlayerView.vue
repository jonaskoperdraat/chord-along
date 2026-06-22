<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useYouTubePlayer } from '../composables/useYouTubePlayer'
import { usePlaybackEngine } from '../composables/usePlaybackEngine'
import ChordDisplay from '../components/ChordDisplay.vue'
import { assertBundleVersion } from '../utils/bundleVersion'
import type { PlayBundle } from '../types/playBundle'
import { SongsApi, Configuration } from '../generated/api'

const bundle = ref<PlayBundle | null>(null)

const { playerState, createPlayer, currentTime } = useYouTubePlayer()
const { activeEvent, activeEventIdx, activeProgress } = usePlaybackEngine(bundle, currentTime, playerState)

onMounted(async () => {
  const api = new SongsApi(new Configuration({ basePath: import.meta.env.VITE_API_BASE_URL }))
  const loaded = await api.getSongBundle({ id: 'photograph' })
  assertBundleVersion(loaded as PlayBundle)
  bundle.value = loaded as PlayBundle
  createPlayer('yt-player', bundle.value.source.videoId)
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
