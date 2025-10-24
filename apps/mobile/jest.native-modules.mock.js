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

module.exports = NativeModules;
