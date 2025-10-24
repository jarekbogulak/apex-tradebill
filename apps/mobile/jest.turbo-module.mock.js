module.exports = {
  get(name) {
    if (name === 'SourceCode') {
      return { scriptURL: 'http://localhost' };
    }
    if (name === 'PlatformConstants') {
      return {
        forceTouchAvailable: false,
        interfaceIdiom: 'phone',
        isTesting: true,
        osVersion: 'test',
        systemName: 'test',
      };
    }
    return {};
  },
  getEnforcing(name) {
    const module = this.get(name);
    if (!module) {
      throw new Error(`TurboModuleRegistry mock missing module: ${name}`);
    }
    return module;
  },
};
