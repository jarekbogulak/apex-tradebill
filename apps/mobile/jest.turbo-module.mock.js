module.exports = {
  get(name) {
    if (name === 'SourceCode') {
      return { scriptURL: 'http://localhost' };
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
