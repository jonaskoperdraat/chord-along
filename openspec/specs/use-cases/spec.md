## ADDED Requirements

### Requirement: Actor roles

The system SHALL recognise three actor roles. Each role extends the capabilities
of the one before it.

```plantuml
@startuml
actor Guest
actor "User" as User
actor "Content Owner" as Owner

Guest <|-- User
User <|-- Owner

note right of Guest : Unauthenticated visitor
note right of User : Logged-in account
note right of Owner : User who authored\na specific resource
@enduml
```

- **Guest**: any visitor, authenticated or not. Can browse, view, and play.
- **User**: a logged-in account. Can additionally create content and rate.
- **Content Owner**: a User who is the `authorId` of a specific Transcription or
  Sync. Can additionally edit and delete that resource.

#### Scenario: Guest accesses without login

- **WHEN** an unauthenticated visitor navigates to any public page
- **THEN** the system SHALL serve it without requiring authentication

#### Scenario: Ownership is resource-scoped

- **WHEN** a User is the `authorId` of a Transcription
- **THEN** they SHALL have Content Owner capabilities for that Transcription only, not for other users' Transcriptions

### Requirement: Capability map

```plantuml
@startuml
left to right direction

actor Guest
actor "User" as User
actor "Content Owner" as Owner

Guest <|-- User
User <|-- Owner

rectangle "chord-along" {
  usecase "Browse transcriptions" as UC_Browse
  usecase "View transcription" as UC_View
  usecase "Browse syncs\nfor transcription" as UC_BrowseSyncs
  usecase "Play along\nwith sync" as UC_Play
  usecase "Log in / create account" as UC_Login

  usecase "Create transcription" as UC_Create
  usecase "Add sync to\nany transcription" as UC_AddSync
  usecase "Like transcription\nor sync" as UC_Like

  usecase "Edit transcription" as UC_Edit
  usecase "Delete transcription" as UC_DeleteT
  usecase "Edit sync" as UC_EditSync
  usecase "Delete sync" as UC_DeleteS
  usecase "Delete account" as UC_DeleteAccount
}

Guest --> UC_Browse
Guest --> UC_View
Guest --> UC_BrowseSyncs
Guest --> UC_Play
Guest --> UC_Login

User --> UC_Create
User --> UC_AddSync
User --> UC_Like
User --> UC_DeleteAccount

Owner --> UC_Edit
Owner --> UC_DeleteT
Owner --> UC_EditSync
Owner --> UC_DeleteS
@enduml
```

#### Scenario: Guest can play without login

- **WHEN** a Guest selects a sync on a transcription view page
- **THEN** the system SHALL load the player and begin playback without prompting for authentication

#### Scenario: User must be logged in to create content

- **WHEN** a Guest attempts to create a transcription or add a sync
- **THEN** the system SHALL redirect to the login flow before allowing the action

#### Scenario: User can add sync to any transcription

- **WHEN** a logged-in User submits a sync for a transcription authored by another User
- **THEN** the system SHALL accept the sync without checking transcription ownership

#### Scenario: Only the Content Owner can edit a transcription

- **WHEN** a User who is not the `authorId` attempts to edit a transcription
- **THEN** the system SHALL reject the request with a 403 Forbidden response

#### Scenario: Only the Content Owner can edit a sync

- **WHEN** a User who is not the `authorId` of a Sync attempts to edit it
- **THEN** the system SHALL reject the request with a 403 Forbidden response

### Requirement: Sync picker

When viewing a transcription that has multiple syncs, the system SHALL present a
sync picker so the user can choose which sync to load into the player.

```plantuml
@startuml
actor Guest

Guest -> System : open transcription view
System -> Guest : render chord sheet

alt transcription has no syncs
  System -> Guest : show "No syncs yet — be the first to add one"
else transcription has one sync
  System -> Guest : show single sync, offer to load it
else transcription has multiple syncs
  System -> Guest : show sync list (author, date, like count)
  Guest -> System : select a sync
  System -> Guest : load sync into player
end
@enduml
```

#### Scenario: No syncs available

- **WHEN** a transcription has zero associated syncs
- **THEN** the transcription view SHALL display a prompt encouraging logged-in users to add one

#### Scenario: Multiple syncs shown with attribution

- **WHEN** a transcription has two or more syncs
- **THEN** the sync picker SHALL display each sync with its author's displayName, creation date, and like count

#### Scenario: Selecting a sync loads the player

- **WHEN** a user selects a sync from the sync picker
- **THEN** the player SHALL load the corresponding SyncPlayData and TranscriptionBundle and begin ready-to-play state
