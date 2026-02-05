# Changelog

All notable changes to the "Antigravity Status" extension will be documented in this file.

## [0.0.2] - 2026-02-05

### Fixed
- Fixed extension activation failure when installed via Marketplace due to hardcoded Extension ID mismatch.
- Unified Extension ID to `yoruhub.antigravity-status` (lowercase) for strict Marketplace compatibility.
- Fixed an issue where the settings command would fail for the Marketplace version.

### Changed
- Localized `package.json` metadata (display name, description, command titles) using `%...%` placeholders for multi-language support on the Marketplace.
- Bumped version to `0.0.2` to force a clean installation and bypass potential IDE extension caches.

## [0.0.1] - 2026-02-04

### Added
- Initial release.
- Real-time monitoring of AI quota (Gemini 3 Pro, Claude, etc.) in the status bar.
- Support for process hunting and direct API fallback.
- Support for English and Japanese languages.
