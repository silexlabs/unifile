# Change log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased]
### Addded
- SFTP support
- `.stat()` method that return information abouth the given path

### Fixed
- `.getInfos()` now correctly get the session
- Takes GitHub `redirectUri` into account for OAuth requests
- Fix Dropbox batch operation

### Changed
- Dropbox is now more tolerant with the path (first `/` is optional)
- Include connector documentation to the global one

## [1.1.0] - 2017-04-26
### Added
- Local filesystem support

## 1.0.0 - 2017-04-05
### Changed
- Total rework of the philosphy

[Unreleased]: https://github.com/silexlabs/unifile/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/silexlabs/unifile/compare/v1.0.0...v1.1.0
