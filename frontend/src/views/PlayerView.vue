<script setup lang="ts">
import { onMounted } from 'vue'
import { useYouTubePlayer } from '../composables/useYouTubePlayer'
import { usePlaybackEngine } from '../composables/usePlaybackEngine'
import ChordDisplay from '../components/ChordDisplay.vue'
import { assertBundleVersion } from '../utils/bundleVersion'
import type { PlayBundle } from '../types/playBundle'
import bundleJson from '../fixtures/sample.play.json'

const bundle = bundleJson as PlayBundle
assertBundleVersion(bundle)

const { playerState, createPlayer, currentTime } = useYouTubePlayer()
const { activeEvent, activeEventIdx, activeProgress } = usePlaybackEngine(bundle, currentTime, playerState)

onMounted(() => {
  createPlayer('yt-player', bundle.source.videoId)
})
</script>

<template>
  <div class="player-page">
    <div class="video-wrapper">
      <div id="yt-player" />
    </div>
    <ChordDisplay
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
