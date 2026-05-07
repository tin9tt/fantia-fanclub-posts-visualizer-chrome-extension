# CONTRIBUTING

Thank you for contributing to this project.

## Pull requests

Please contribute using the following workflow:

1. Fork this repository
2. Create a feature branch
3. Make changes
4. Test locally
5. Open a Pull Request

Please keep changes small and focused whenever possible.

## Directory structure

```txt
.
├── manifest.json
├── index.js
├── index.css
├── PRIVACY_POLICY.md
├── assets/
│   └── Chrome Web Store listing assets
└── Taskfile.yml
```

### Files

- `manifest.json`
  - Chrome Extension Manifest V3 configuration

- `index.js`
  - Main content script
  - Handles DOM enhancement, badge rendering, thumbnail replacement, API fetch, and cache handling

- `index.css`
  - Styles for badges and thumbnail replacement

- `PRIVACY_POLICY.md`
  - Privacy policy for Chrome Web Store

- `assets/`
  - Images and assets used for the Chrome Web Store listing

## Local development

Load the extension locally:

1. Open `chrome://extensions`
2. Enable Developer Mode
3. Click "Load unpacked"
4. Select this repository directory

## Package

Create a local extension package:

```sh
task
```

Generated package:

```txt
extension.zip
```

## Deploy

- Create a local package

  ```sh
  task
  ```

- Open the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
- Select the extension
- Open the [Build] > [Package] tab
- Upload `extension.zip` using "Upload new package"

## Style guidelines

- Use plain JavaScript
- Do not add unnecessary dependencies
- Keep selectors centralized
- Keep custom class names prefixed with `fantia-post-enhancer-`
- Fail softly when Fantia DOM changes unexpectedly

## Issues

- Use Bug Report for bugs and regressions
- Use Feature Request for new ideas and improvements