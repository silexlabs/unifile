# Change log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased]
### Changed
- Code factorization
- Remove parameters mutations

### Added
- Tools, index and FS are 100% covered

## [1.2.0] - 2017-06-01
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

## [1.1.0] - 2017-04-26
### Added
- Local filesystem support

## 1.0.0 - 2017-04-05
### Changed
- Total rework of the philosphy

[Unreleased]: https://github.com/silexlabs/unifile/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/silexlabs/unifile/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/silexlabs/unifile/compare/v1.0.0...v1.1.0
