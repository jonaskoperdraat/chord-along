import { ref, onUnmounted } from 'vue'

declare global {
  interface Window {
    YT: typeof YT
    onYouTubeIframeAPIReady: () => void
  }
}

// Singleton: the API script is injected once per page.
let apiReady = false
let apiReadyCallbacks: (() => void)[] = []

function loadYouTubeApi(): Promise<void> {
  return new Promise((resolve) => {
    if (apiReady) {
      resolve()
      return
    }
    apiReadyCallbacks.push(resolve)
    if (document.getElementById('yt-iframe-api')) return
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      if (prev) prev()
      apiReady = true
      apiReadyCallbacks.forEach((cb) => cb())
      apiReadyCallbacks = []
    }
    // If YT is already loaded (e.g. HMR), resolve immediately.
    if (window.YT?.Player) {
      window.onYouTubeIframeAPIReady()
      return
    }
    const script = document.createElement('script')
    script.id = 'yt-iframe-api'
    script.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(script)
  })
}

export function useYouTubePlayer() {
  const playerState = ref<number>(-1) // YT.PlayerState values
  let player: YT.Player | null = null

  async function createPlayer(elementId: string, videoId: string) {
    await loadYouTubeApi()
    player = new window.YT.Player(elementId, {
      videoId,
      playerVars: { playsinline: 1 },
      events: {
        onStateChange: (e: YT.OnStateChangeEvent) => {
          playerState.value = e.data
        },
      },
    })
  }

  function currentTime(): number {
    return player?.getCurrentTime() ?? 0
  }

  function play() {
    player?.playVideo()
  }

  function pause() {
    player?.pauseVideo()
  }

  function seek(t: number) {
    player?.seekTo(t, true)
  }

  onUnmounted(() => {
    player?.destroy()
    player = null
  })

  return { playerState, createPlayer, currentTime, play, pause, seek }
}
