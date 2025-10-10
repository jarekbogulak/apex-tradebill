# Codex Custom Prompts

**Caution**: Please use the `/constitution`, `/specify`, and `/plan` commands in order. You cannot use input from a subsequent command in a preceding one, so ensure these commands are not mixed.

User inputs for Codex custom prompts:
- `/constitution`
- `/specify`
- `/plan`
with additional project instructions for prompt files located in `.codex/prompts/`.

1. /constitution: Create principles for a trading companion app (tradebill) for Apex Omni DEX day traders focused on financial data integrity, risk management, code quality, testing standards, user experience consistency for day-traders, and performance requirements such as low-latency execution and high reliability. Emphasize crypto-grade security and sercrets protection. Include governance for how these principles should guide technical decisions and implementation choices throughout development of the Apex Tradebill mobile app.
2. /specify: Develop Apex TradeBill, a trading companion app for Apex Omni DEX day traders. The app’s purpose is to provide a fast, portable, and reliable way to calculate position sizing, manage trade risk, and evaluate trade opportunities directly from a mobile device. Its core function is to let traders enter a potential trade idea and instantly see the calculated risk, required position size, and risk-to-reward profile, all powered by live market data. When a user launches Apex TradeBill, they will be prompted to enter or select key trade inputs: account size, trade direction (long or short), entry price, stop price, and target price. The entry price will default to the real-time trade value fetched from the API. Additional risk parameters such as multipliers, and percent risk can be configured upfront or adjusted through a settings menu. Crucially, the app will calculate the Average True Range (ATR) dynamically using real-time price data pulled directly from the Apex Omni API to determine a safe place to put stop losses to avoid being stop hunted or stopped out of a trade due to a tight stop loss. Default multiplier setting is 1.5. For a more conservative stop loss use 2 and for a tighter stop loss use 1. This ensures that all volatility-based calculations are current and adapt automatically as market conditions change. Based on the user’s inputs and live market data, the app will display critical trade outputs in real time. These include the number of crypto to buy, the total cost of the position, the trade’s exact risk value, and a clear risk-to-reward profile. The main interface will present this information in a structured, intuitive layout: Inputs Panel for entering trade details, Outputs Panel showing calculated trade size, cost, and risk, Risk Visualization to illustrate stop-loss versus target scenarios, and Trade History to store and review recent calculations. The rationale behind Apex TradeBill is to eliminate the friction of relying on static tools and manual calculations in fast-moving markets. By combining instant risk management calculations with real-time volatility analysis, the app gives traders sharper decision-making power at the moment of opportunity. In its initial phase, Apex TradeBill will focus on delivering feature parity for essential trade preparation functions—ensuring accuracy and speed—before expanding to advanced features such as multi-leg trades, saved strategies, or execution integrations.
3. /plan: The application utilizes React Native with Expo (a universal app with web capabilities) for the frontend, while Node.JS with the Apex Omni OpenApi-Node.JS-SDK is employed for the backend. Use context7 for the official Expo documentation. The official API documentation is accessible at https://api-docs.omni.apex.exchange

# Expo Monorepo Cheatsheet

## TL;DR
- Expo SDK **54+** auto‑detects monorepos. Prefer SDK 54 or newer.
- Use pnpm workspace. **Install from the repo root.**
- Avoid custom Metro settings unless you truly need them.

## Repo Layout
```
root/
├─ apps/            # app projects (Expo, web, etc.)
│  └─ mobile/       # Expo
│  └─ api/          # Node
├─ packages/        # shared libraries/packages
│  └─ cool-package/
└─ pnpm-workspace.yaml
```

### Root workspace config
**pnpm** (`pnpm-workspace.yaml`):
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

## Create an app
From repo root:
```bash
npx create-expo-app@latest apps/mobile
```

Then in `apps/mobile/package.json` ensure typical scripts exist:
```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web"
  }
}
```

## Create a shared package
```bash
mkdir -p packages/cool-package
cd packages/cool-package
pnpm init
```
`packages/cool-package/index.js`
```js
export const greeting = 'Hello!';
```

### Use the package in an app
Add a workspace dependency (prefer a workspace range when supported):
```json
{
  "dependencies": {
    "cool-package": "workspace:*"  // or "*" if your manager doesn’t support workspace: yet
  }
}
```

## Install & run
```bash
# Always install from repo root
# (choose your manager)
pnpm install

# then run the app
cd apps/mobile
npm run start
```

## Metro config (SDK ≥ 54)
- If you previously customized `metro.config.js` for monorepos, **remove** these keys: `watchFolders`, `resolver.nodeModulesPath`/`nodeModulesPaths`, `resolver.extraNodeModules`, `resolver.disableHierarchicalLookup`.
- Use Expo’s default config: `const { getDefaultConfig } = require('expo/metro-config');` and then `module.exports = getDefaultConfig(__dirname);`
- After cleanup, run once: `npx expo start --clear`.

## Common issues & fixes

### 1) Isolated installs (pnpm/bun) vs hoisted installs
- SDK **54+** supports isolated dependencies. Some libs may still break.
- If you hit resolution/build issues with **pnpm**, try hoisted linker:
  ```ini
  # .npmrc at repo root
  node-linker=hoisted
  ```

### 2) Duplicate React/React Native or native modules
- Ensure only **one** version of `react` and `react-native` per app; avoid multiple versions of Turbo/Expo modules.
- Inspect dependency graph:
  ```bash
  npm why react-native
  # yarn why react-native
  # pnpm why --depth=10 react-native
  # bun pm why react-native
  ```
- If peers lag (e.g., React 19), add a top‑level resolution override:
  ```json
  {
    "resolutions": {
      "react": "^19.1.0"
    }
  }
  ```

### 3) “Script '…' does not exist” (native path hardcoding)
Use dynamic resolution instead of hardcoded node_modules paths.

**Android (`android/app/build.gradle`)**
```gradle
apply from: new File([
  "node", "--print", "require.resolve('react-native/package.json')"
].execute(null, rootDir).text.trim(), "../react.gradle")
```

**iOS (Podfile)**
```ruby
require File.join(File.dirname(`node --print "require.resolve('react-native/package.json')"`), "scripts/react_native_pods")
```

### 4) Align Metro and native autolinking (SDK ≥ 54, experimental)
Enable matching between Metro resolution and native autolinking:
```json
{
  "experiments": {
    "autolinkingModuleResolution": true
  }
}
```

## Gotchas / best practices
- **One install strategy** across the repo; avoid mixing managers.
- Keep React/React Native versions **consistent** across apps.
- Prefer `workspace:*` (or equivalent) for local packages to prevent accidentally resolving a published package.
- When in doubt, clear caches: `npx expo start --clear`.
- Run EAS builds from the **app** directory or configure your CI to set the correct working directory.

---
**Checklist before committing**
- [ ] Root workspaces configured (`package.json` or `pnpm-workspace.yaml`)
- [ ] Apps live under `apps/`, shared code under `packages/`
- [ ] Only one version of React/React Native used per app
- [ ] No custom Metro monorepo hacks left in `metro.config.js`
- [ ] App runs with `expo start` from `apps/<app>`

