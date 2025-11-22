const NativeModules = {};

NativeModules.NativeUnimoduleProxy = {
  modulesConstants: {
    mockDefinition: {
      ExponentConstants: {
        experienceUrl: { mock: 'exp://local-dev' },
      },
    },
  },
  viewManagersMetadata: {},
};

NativeModules.UIManager = {};
NativeModules.Linking = {};
NativeModules.SourceCode = { scriptURL: 'http://localhost' };

// Jest Expo's preset accesses NativeModules via the default export; mirror it to avoid undefined
// during setup.
NativeModules.default = NativeModules;

module.exports = NativeModules;
