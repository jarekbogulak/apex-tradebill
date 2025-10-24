const nativeModulesMock = require('./jest.native-modules.mock.js');

jest.mock('react-native/Libraries/BatchedBridge/NativeModules', () => nativeModulesMock);

const turboModuleMock = {
  get(name) {
    if (name === 'SourceCode') {
      return { scriptURL: 'http://localhost' };
    }
    return {};
  },
  getEnforcing(name) {
    const module = turboModuleMock.get(name);
    if (!module) {
      throw new Error(`TurboModuleRegistry mock missing module: ${name}`);
    }
    return module;
  },
};

jest.mock('react-native/Libraries/TurboModule/TurboModuleRegistry', () => turboModuleMock);

jest.mock('react-native/src/private/specs_DEPRECATED/modules/NativeSourceCode', () => ({
  getConstants() {
    return { scriptURL: 'http://localhost' };
  },
}));

jest.mock('react-native/Libraries/Utilities/NativePlatformConstantsIOS', () => ({
  getConstants() {
    return {
      forceTouchAvailable: false,
      interfaceIdiom: 'phone',
      osVersion: 'test',
      systemName: 'test',
      isTesting: true,
    };
  },
}));

jest.mock('react-native/Libraries/Utilities/NativeDeviceInfo', () => ({
  getConstants() {
    return {
      Dimensions: {
        window: { width: 375, height: 812, scale: 2, fontScale: 2 },
        screen: { width: 375, height: 812, scale: 2, fontScale: 2 },
      },
    };
  },
}));

jest.mock('react-native/Libraries/ReactNative/UIManager', () => ({
  getViewManagerConfig() {
    return {};
  },
  createView() {},
  updateView() {},
  setChildren() {},
}));

jest.mock('expo', () => ({}));
