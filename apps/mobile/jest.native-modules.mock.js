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

module.exports = NativeModules;
