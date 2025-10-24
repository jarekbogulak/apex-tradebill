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
