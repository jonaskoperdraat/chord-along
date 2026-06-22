## ADDED Requirements

### Requirement: YouTube IFrame embed
The app SHALL embed a YouTube video using the YouTube IFrame API. The video ID SHALL come from the loaded playback bundle's `source.videoId`.

#### Scenario: Video loads from bundle
- **WHEN** a playback bundle with `source.kind = "youtube"` is loaded
- **THEN** the YouTube iframe loads the specified video

### Requirement: Playback controls
The player SHALL expose play, pause, and seek controls driven by the application (not just the YouTube native controls). These controls are used internally by the playback engine.

#### Scenario: Play initiates video playback
- **WHEN** the application calls play
- **THEN** the YouTube video begins playing

#### Scenario: Pause halts video playback
- **WHEN** the application calls pause
- **THEN** the YouTube video pauses at the current position

#### Scenario: Seek moves to timestamp
- **WHEN** the application calls seek with a time `t`
- **THEN** the YouTube video moves to position `t` seconds

### Requirement: Current time polling
The player SHALL provide a way to read the current playback position in seconds, accurate to at least 0.1 s.

#### Scenario: Current time is readable during playback
- **WHEN** the video is playing
- **THEN** reading current time returns a value that advances monotonically with wall-clock time

### Requirement: Late API initialization
The YouTube IFrame API script, once injected, fires its ready callback exactly once per page load. The player component SHALL handle the case where the API is already initialized (e.g., after a hot-module reload) by checking for an existing `window.YT` object on mount.

#### Scenario: Component mounts after API is ready
- **WHEN** the YouTube IFrame API has already been loaded and `window.YT` exists
- **THEN** the player initializes without waiting for the `onYouTubeIframeAPIReady` callback
