# Change log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased]

## [2.0.1] - 2017-12-11
### Fixed
- [Dropbox] Batch correctly overwrite existing files (https://github.com/silexlabs/unifile/issues/131)
- [Dropbox] Batch now correctly rejects the promise if one action failed (https://github.com/silexlabs/unifile/issues/131)
- [Dropbox] Batch upload uses `Buffer` for file content and supports UTF-8 (https://github.com/silexlabs/unifile/issues/130)
- [Dropbox] All the methods support non-ASCII char in filename and content (https://github.com/silexlabs/unifile/issues/134)

## [2.0.0] - 2017-11-25
### Changed
- GitHub batch fixes and optimization
- Code factorization
- Remove parameters mutations
- `.readFile()` now always return a `Buffer`
- [Dropbox] Retrieve account when providing only the token
- [Dropbox] Normalize errors (https://github.com/silexlabs/unifile/issues/103)

### Added
- Tools, index and FS are 100% covered
- Coverage for all connectors
- [Dropbox] Add some security check

### Fixed
- In SFTP, directory type is now set to 'application/directory'
- [Dropbox] Fixes batch upload (https://github.com/silexlabs/unifile/issues/114)

### Removed
- WebDAV connector is now a separate plugin
- `unifile.connectors` is now private

## [1.2.0] - 2017-06-01 - 2017-11-25
### Added
- SFTP support
- `.stat()` method that return information abouth the given path
- Connector constructor now accepts `infos` to override static infos
- FS connector now has a sandbox to restrict file access

### Fixed
- `.getInfos()` now correctly get the session
- Takes GitHub `redirectUri` into account for OAuth requests
- Fixes Dropbox batch operation
- Fixes Dropbox infos when account has not been set yet

### Changed
- Dropbox is now more tolerant with the path (first `/` is optional)
  - Includes connector documentation to the global one
  - Includes README in documentation

## [1.1.0] - 2017-04-26 - 2017-11-25
### Added
  - Local filesystem support

## 1.0.0 - 2017-04-05
### Changed
  - Total rework of the philosphy

[Unreleased]: https://github.com/silexlabs/unifile/compare/v2.0.1...HEAD
[2.0.1]: https://github.com/silexlabs/unifile/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/silexlabs/unifile/compare/v1.2.0...v2.0.0
[1.2.0]: https://github.com/silexlabs/unifile/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/silexlabs/unifile/compare/v1.0.0...v1.1.0
