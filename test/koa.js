const path = require('path');
const os = require('os');
const _isBuffer = require('lodash.isbuffer');
const _isObject = require('lodash.isobject');
const test = require('ava');
const uuid = require('uuid');
const Koa = require('koa');
const multer = require('@koa/multer');
const bytes = require('bytes');
const errorHandler = require('koa-better-error-handler');
const lipoKoa = require('lipo-koa');

const lipo = require('../lib');

const input = path.join(__dirname, 'fixtures', 'input.jpg');

const upload = multer({
  limits: {
    fieldNameSize: bytes('100b'),
    fieldSize: bytes('1mb'),
    fileSize: bytes('5mb'),
    fields: 10,
    files: 1
  }
});

test.beforeEach.cb((t) => {
  const app = new Koa();
  app.use(upload.single('input'));
  // override koa's undocumented error handler
  // <https://github.com/sindresorhus/eslint-plugin-unicorn/issues/174>
  app.context.onerror = errorHandler;
  // listen for error and log events emitted by app
  app.on('error', console.error);
  app.on('log', console.log);
  // specify that this is our api
  app.context.api = true;
  // use lipo's koa middleware
  app.use(lipoKoa);
  t.context.server = app.listen(function () {
    t.context.lipo = lipo({
      baseURI: `http://localhost:${this.address().port}`
    });
    t.end();
  });
});

test('parallel failure', async (t) => {
  const jpg = path.join(os.tmpdir(), `${uuid.v4()}.jpg`);
  const [info1, info2, info3, info4] = await Promise.all(
    [100, 200, 300, 400].map((number) =>
      t.context.lipo(input).clone().resize(number, number).toFile(jpg)
    )
  );
  t.is(info1.width, 100);
  t.is(info1.height, 100);
  t.is(info2.width, 200);
  t.is(info2.height, 200);
  t.is(info3.width, 300);
  t.is(info3.height, 300);
  t.is(info4.width, 400);
  t.is(info4.height, 400);
});

test('metadata', async (t) => {
  const info = await t.context
    .lipo(input)
    // <https://github.com/lovell/sharp/issues/1046>
    // .resize(300, 300)
    .metadata();
  t.is(info.format, 'jpeg');
  t.is(info.width, 100);
  t.is(info.height, 100);
});

test('basic', async (t) => {
  const jpg = path.join(os.tmpdir(), `${uuid.v4()}.jpg`);
  const info = await t.context.lipo(input).resize(300, 300).toFile(jpg);
  t.is(info.format, 'jpeg');
  // t.is(info.size, 1498);
  t.is(info.width, 300);
  t.is(info.height, 300);
  t.is(info.channels, 3);
  t.is(info.premultiplied, false);
});

test('basic showing instance can be reused', async (t) => {
  const jpg = path.join(os.tmpdir(), `${uuid.v4()}.jpg`);
  const info1 = await t.context.lipo(input).resize(300, 300).toFile(jpg);

  t.is(info1.format, 'jpeg');
  // t.is(info1.size, 1498);
  t.is(info1.width, 300);
  t.is(info1.height, 300);
  t.is(info1.channels, 3);
  t.is(info1.premultiplied, false);

  const info2 = await t.context.lipo(input).resize(300, 300).toFile(jpg);

  t.is(info2.format, 'jpeg');
  // t.is(info2.size, 1498);
  t.is(info2.width, 300);
  t.is(info2.height, 300);
  t.is(info2.channels, 3);
  t.is(info2.premultiplied, false);
});

test('basic with options', async (t) => {
  const jpg = path.join(os.tmpdir(), `${uuid.v4()}.jpg`);
  const info = await t.context
    .lipo({
      create: {
        width: 300,
        height: 300,
        channels: 3,
        background: { r: 255, g: 255, b: 255, alpha: 128 }
      }
    })
    .jpeg()
    .toFile(jpg);
  t.is(info.format, 'jpeg');
  // t.is(info.size, 807);
  t.is(info.width, 300);
  t.is(info.height, 300);
  t.is(info.channels, 3);
  t.is(info.premultiplied, false);
});

test.cb('basic with callback', (t) => {
  const jpg = path.join(os.tmpdir(), `${uuid.v4()}.jpg`);
  t.context
    .lipo(input)
    .resize(300, 300)
    .toFile(jpg, (err, info) => {
      if (err) return t.end(err);
      t.is(info.format, 'jpeg');
      // t.is(info.size, 1498);
      t.is(info.width, 300);
      t.is(info.height, 300);
      t.is(info.channels, 3);
      t.is(info.premultiplied, false);
      t.end();
    });
});

test('convert to png', async (t) => {
  const png = path.join(os.tmpdir(), `${uuid.v4()}.png`);
  const info = await t.context.lipo(input).resize(200, 200).png().toFile(png);
  t.is(info.format, 'png');
  // t.is(info.size, 641);
  t.is(info.width, 200);
  t.is(info.height, 200);
  t.is(info.channels, 3);
  t.is(info.premultiplied, false);
});

test('buffer', async (t) => {
  const data = await t.context.lipo(input).resize(200, 200).png().toBuffer();
  t.true(_isBuffer(data));
});

test('buffer with `options.resolveWithObject`', async (t) => {
  const { data, info } = await t.context
    .lipo(input)
    .resize(200, 200)
    .png()
    .toBuffer({ resolveWithObject: true });
  t.true(_isBuffer(data));
  t.true(_isObject(info));
  t.is(info.format, 'png');
  // t.is(info.size, 641);
  t.is(info.width, 200);
  t.is(info.height, 200);
  t.is(info.channels, 3);
  t.is(info.premultiplied, false);
});

test.cb('buffer with callback', (t) => {
  t.context
    .lipo(input)
    .resize(200, 200)
    .png()
    .toBuffer((err, data) => {
      if (err) return t.end(err);
      t.true(_isBuffer(data));
      t.end();
    });
});

test('crop with strategy', async (t) => {
  const jpg = path.join(os.tmpdir(), `${uuid.v4()}.jpg`);
  const info = await t.context
    .lipo(input)
    .resize(300, 300, { fit: 'cover', position: 'entropy' })
    .toFile(jpg);
  t.is(info.format, 'jpeg');
  t.is(info.width, 300);
  t.is(info.height, 300);
  t.is(info.channels, 3);
  t.is(info.premultiplied, false);
});
