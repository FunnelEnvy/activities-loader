const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
const $ = require('jquery');
global.$ = global.jQuery = $;

jest.useFakeTimers();
