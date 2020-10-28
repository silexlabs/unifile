# Change log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) and this project adheres to [Semantic Versioning](http://semver.org/).

## [] - 2020-10-22 - 2020-10-25 - 2020-10-28 - 2020-10-28 - 2020-10-28 - 2020-10-28

## [2.0.8] - 2019-11-06 - 2020-10-22 - 2020-10-25 - 2020-10-28 - 2020-10-28 - 2020-10-28 - 2020-10-28
### Fixed
- [FTP] FTP client has been replace, thus fixing multiple bugs like stat
- [SFTP] Fix an issue when listing or stating with an empty path
- [GitHub] Gracefully handle scopes and permissions
- [Node] Update minimal version of Node to 8

## [2.0.4] - 2018-10-08 - 2020-10-22 - 2020-10-25 - 2020-10-28 - 2020-10-28 - 2020-10-28 - 2020-10-28
### Fixed
- [FTP] Handles FTP server that return an empty list on 404 (like OVH)

## [2.0.3] - 2018-03-25 - 2020-10-22 - 2020-10-25 - 2020-10-28 - 2020-10-28 - 2020-10-28 - 2020-10-28
### Fixed
- [FTP] Prevents server crash when unable to connect to server (https://github.com/silexlabs/CloudExplorer2/issues/57)

## [2.0.2] - 2018-03-10 - 2020-10-22 - 2020-10-25 - 2020-10-28 - 2020-10-28 - 2020-10-28 - 2020-10-28
### Fixed
- [GitHub] OAuth scopes are provided in request headers (https://github.com/silexlabs/unifile/issues/123)
- [GitHub] Fix batch update with multi levels tree

## [2.0.1] - 2017-12-11 - 2020-10-22 - 2020-10-25 - 2020-10-28 - 2020-10-28 - 2020-10-28 - 2020-10-28
### Fixed
- [Dropbox] Batch correctly overwrite existing files (https://github.com/silexlabs/unifile/issues/131)
- [Dropbox] Batch now correctly rejects the promise if one action failed (https://github.com/silexlabs/unifile/issues/131)
- [Dropbox] Batch upload uses `Buffer` for file content and supports UTF-8 (https://github.com/silexlabs/unifile/issues/130)
- [Dropbox] All the methods support non-ASCII char in filename and content (https://github.com/silexlabs/unifile/issues/134)

## [2.0.0] - 2017-11-25 - 2020-10-22 - 2020-10-25 - 2020-10-28 - 2020-10-28 - 2020-10-28 - 2020-10-28
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

## [1.2.0] - 2017-06-01 - 2020-10-22 - 2020-10-25 - 2020-10-28 - 2020-10-28 - 2020-10-28 - 2020-10-28
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

## [1.1.0] - 2017-04-26 - 2020-10-22 - 2020-10-25 - 2020-10-28 - 2020-10-28 - 2020-10-28 - 2020-10-28
### Added
  - Local filesystem support

## 1.0.0 - 2017-04-05
### Changed
  - Total rework of the philosphy

[]: https://github.com/silexlabs/unifile/compare/v2.0.8...v
[2.0.8]: https://github.com/silexlabs/unifile/compare/v2.0.4...v2.0.8
[2.0.4]: https://github.com/silexlabs/unifile/compare/v2.0.3...v2.0.4
[2.0.3]: https://github.com/silexlabs/unifile/compare/v2.0.2...v2.0.3
[2.0.2]: https://github.com/silexlabs/unifile/compare/v2.0.1...v2.0.2
[2.0.1]: https://github.com/silexlabs/unifile/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/silexlabs/unifile/compare/v1.2.0...v2.0.0
[1.2.0]: https://github.com/silexlabs/unifile/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/silexlabs/unifile/compare/v1.0.0...v1.1.0
