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
