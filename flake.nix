{
  description = "A Nix flake for the Apex TradeBill monorepo (Expo mobile + Fastify API)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    android-nixpkgs = {
      url = "github:tadfisher/android-nixpkgs";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, flake-utils, android-nixpkgs }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config = {
            android_sdk.accept_license = true;
            allowUnfree = true;
          };
        };
        
        # ============================================================================
        # ANDROID CONFIGURATION
        # ============================================================================
        androidPkgs = android-nixpkgs.sdk.${system} (sdkPkgs: with sdkPkgs; [
          cmdline-tools-latest
          build-tools-34-0-0
          platform-tools
          platforms-android-34
          platforms-android-33
          emulator
          system-images-android-34-google-apis-x86-64
          system-images-android-33-google-apis-x86-64
        ]);
        
        # Java version for Android development
        jdk = pkgs.jdk17;
        
        # ============================================================================
        # iOS CONFIGURATION (macOS only)
        # ============================================================================
        iosPackages = with pkgs; [
          cocoapods
        ];
        
        # Base packages for monorepo development (API + mobile)
        basePackages = with pkgs; [
          # Node.js and package managers
          nodejs_22
          pnpm
          
          # Note: Use 'npx @expo/cli' instead of installing expo CLI globally
          # Note: Use 'npx react-native' for bare React Native projects

          # Watchman for file watching
          watchman

          # Shell utilities
          bash
          
          # Optional: Flipper for debugging
          # flipper
        ];
        
        # Android-specific packages
        androidPackages = [
          jdk
          androidPkgs
        ];

        # Lightweight dev shell packages (no Android/iOS SDKs)
        lightPackages = basePackages;

        # Full mobile tooling (Android + iOS)
        mobilePackages = basePackages ++ androidPackages ++ iosPackages;

        baseShellHook = ''
          echo "🚀 Welcome to the Apex TradeBill dev shell (lightweight)"
          echo ""
          echo "📦 Package Management:"
          echo "  npm install / yarn install / pnpm install - Install dependencies"
          echo ""
          echo "🧩 Monorepo Commands:"
          echo "  pnpm --filter @apex-tradebill/api dev - Start Fastify API"
          echo "  pnpm dev:mobile - Start the Expo client"
          echo "  pnpm typecheck / pnpm lint / pnpm test - Quality checks"
          echo ""
          echo "🔧 Expo Commands:"
          echo "  npx @expo/cli start - Start the Expo development server"
          echo "  npx @expo/cli build - Build your app"
          echo "  npx eas build - Build with Expo Application Services"
          echo "  npx create-expo-app@latest MyApp - Create new Expo project"
          echo ""
          echo "⚛️  React Native Commands (for bare projects):"
          echo "  npx react-native run-android - Run bare RN project on Android"
          echo "  npx react-native run-ios - Run bare RN project on iOS"
          echo "  npx react-native@latest init MyApp - Create new RN project"
          echo ""
          echo "Tip: run 'nix develop .#mobile' for full Android + iOS tooling"
          echo ""

          # Expo environment variables
          export EXPO_NO_TELEMETRY=1
        '';

        mobileShellHook = ''
          echo "🚀 Welcome to the Apex TradeBill mobile dev shell on macOS!"
          echo ""
          
          # ========================================================================
          # CROSS-PLATFORM COMMANDS
          # ========================================================================
          echo "📦 Package Management:"
          echo "  npm install / yarn install / pnpm install - Install dependencies"
          echo ""
          echo "🧩 Monorepo Commands:"
          echo "  pnpm --filter @apex-tradebill/api dev - Start Fastify API"
          echo "  pnpm dev:mobile - Start the Expo client"
          echo "  pnpm typecheck / pnpm lint / pnpm test - Quality checks"
          echo ""
          echo "🔧 Expo Commands:"
          echo "  npx @expo/cli start - Start the Expo development server"
          echo "  npx @expo/cli build - Build your app"
          echo "  npx eas build - Build with Expo Application Services"
          echo "  npx create-expo-app@latest MyApp - Create new Expo project"
          echo ""
          echo "⚛️  React Native Commands (for bare projects):"
          echo "  npx react-native run-android - Run bare RN project on Android"
          echo "  npx react-native run-ios - Run bare RN project on iOS"
          echo "  npx react-native@latest init MyApp - Create new RN project"
          echo ""
          
          # ========================================================================
          # ANDROID CONFIGURATION
          # ========================================================================
          echo "🤖 Android Development:"
          echo "  Android SDK: ${androidPkgs}"
          echo "  Java version: ${jdk.version}"
          echo ""
          
          # Set Android environment variables
          export ANDROID_HOME="${androidPkgs}/share/android-sdk"
          export ANDROID_SDK_ROOT="$ANDROID_HOME"
          export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
          
          # Set Java environment
          export JAVA_HOME="${jdk.home}"
          export PATH="$JAVA_HOME/bin:$PATH"
          
          echo "  ANDROID_SDK_ROOT: $ANDROID_SDK_ROOT"
          echo "  JAVA_HOME: $JAVA_HOME"
          echo ""
          echo "  Android Commands:"
          echo "    avdmanager create avd -n MyEmulator -k 'system-images;android-34;google_apis;x86_64'"
          echo "    emulator -avd MyEmulator"
          echo "    adb devices"
          echo ""
          
          # ========================================================================
          # iOS CONFIGURATION (macOS only)
          # ========================================================================
          echo "🍎 iOS Development:"
          
          # iOS Simulator environment (if Xcode is installed)
          if command -v xcrun &> /dev/null; then
            export DEVELOPER_DIR=$(xcode-select -p)
            echo "  ✅ Xcode Developer Tools: $DEVELOPER_DIR"
            echo "  iOS Commands:"
            echo "    pod install - Install iOS dependencies (in ios/ directory)"
            echo "    xcrun simctl list devices - List available iOS simulators"
            echo "    open -a Simulator - Open iOS Simulator"
          else
            echo "  ⚠️  Xcode not found. Install Xcode from the App Store for iOS development."
            echo "  After installing Xcode, run: sudo xcodebuild -license accept"
          fi
          echo ""
          
          # ========================================================================
          # FINAL SETUP
          # ========================================================================
          # Expo environment variables
          export EXPO_NO_TELEMETRY=1
          
          echo "🎯 Next Steps:"
          if ! command -v xcrun &> /dev/null; then
            echo "  1. Install Xcode from the App Store (required for iOS development)"
            echo "  2. Accept Xcode license: sudo xcodebuild -license accept"
            echo "  3. Install Command Line Tools: xcode-select --install"
          fi
          echo "  • Create new project: npx create-expo-app@latest MyApp"
          echo "  • Or navigate to your existing project directory"
          echo "  • Run: npx @expo/cli start"
          echo ""
          echo "✨ Environment ready for React Native + Expo development!"
          
          # Uncomment the following section to disable iOS development
          # ========================================================================
          # # DISABLE iOS DEVELOPMENT
          # # Comment out iosPackages in allPackages and this section
          # ========================================================================
          
          # Uncomment the following section to disable Android development
          # ========================================================================
          # # DISABLE ANDROID DEVELOPMENT
          # # Comment out androidPackages in allPackages and this section
          # # unset ANDROID_HOME ANDROID_SDK_ROOT JAVA_HOME
          # # export PATH=$(echo $PATH | sed 's|[^:]*android[^:]*:||g' | sed 's|[^:]*java[^:]*:||g')
          # ========================================================================
        '';
        
      in {
        # Reference to self to avoid unused parameter warning
        inherit self;
        devShells.default = pkgs.mkShell {
          packages = lightPackages;
          shellHook = baseShellHook;
        };

        devShells.mobile = pkgs.mkShell {
          packages = mobilePackages;
          shellHook = mobileShellHook;
        };
      }
    );
}
