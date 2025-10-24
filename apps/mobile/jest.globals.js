if (typeof global.TransformStream === 'undefined') {
  class MockTransformStream {
    constructor() {}
    get readable() {
      return {};
    }
    get writable() {
      return {};
    }
  }
  global.TransformStream = MockTransformStream;
}

if (typeof global.TextEncoderStream === 'undefined') {
  class MockTextEncoderStream extends global.TransformStream {}
  global.TextEncoderStream = MockTextEncoderStream;
}

if (typeof global.TextDecoderStream === 'undefined') {
  class MockTextDecoderStream extends global.TransformStream {}
  global.TextDecoderStream = MockTextDecoderStream;
}

if (typeof global.__fbBatchedBridgeConfig === 'undefined') {
  global.__fbBatchedBridgeConfig = {};
}

const React = require('react');
const internalKey = '__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED';
if (!React[internalKey]) {
  React[internalKey] = { ReactCurrentOwner: { current: null } };
} else if (!React[internalKey].ReactCurrentOwner) {
  React[internalKey].ReactCurrentOwner = { current: null };
}
