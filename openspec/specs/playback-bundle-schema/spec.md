## ADDED Requirements

### Requirement: Playback bundle structure
A playback bundle (`*.play.json`) SHALL conform to the following structure:

```
{
  "source":  { "kind": string, ...provider fields, "offsetSec": number },
  "version": number,
  "lines":   [ { "section"?: string, "slots": [ { "chord"?: string, "text"?: string, "t"?: number } ] } ],
  "events":  [ { "t": number, "lineIdx": number, "slotIdx": number } ]
}
```

- `events[]` MUST be present and sorted ascending by `t`.
- `events[]` MUST contain an entry for every slot that carries a `t` field.
- End times are implicit: a slot's chord is active from its `t` until the next entry in `events[]`.
- `source.kind` SHALL be `"youtube"` in v1, with fields `videoId: string` and `offsetSec: number`.

#### Scenario: Valid bundle is accepted by the player
- **WHEN** the player loads a file conforming to the schema above
- **THEN** the player renders lines/slots without errors

#### Scenario: Events index is sorted
- **WHEN** a bundle's `events[]` array is inspected
- **THEN** every entry's `t` is greater than or equal to the previous entry's `t`

### Requirement: Hand-crafted fixture
The repository SHALL include at least one hand-crafted `*.play.json` fixture for a real song. It SHALL cover a minimum of one complete verse and chorus, with accurate-enough timestamps to be playable.

#### Scenario: Fixture loads in the player
- **WHEN** the app loads the bundled fixture
- **THEN** the player renders the song's chords and lyrics without errors

#### Scenario: Fixture is valid against the schema
- **WHEN** the fixture file is parsed
- **THEN** all required fields (`source`, `version`, `lines`, `events`) are present and `events` is non-empty

### Requirement: Version field
Every playback bundle SHALL carry a `version` field (integer, starting at 1). The player SHALL surface a console warning (not a crash) when it encounters a version it does not recognize.

#### Scenario: Known version loads silently
- **WHEN** the player loads a bundle with a known `version`
- **THEN** no warning is logged

#### Scenario: Unknown version logs a warning
- **WHEN** the player loads a bundle with an unrecognized `version`
- **THEN** the player logs a console warning and attempts to render the bundle anyway
