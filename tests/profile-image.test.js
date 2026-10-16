import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareProfileImage } from '../src/utils/profileImage.js';

test('gallery images are resized, normalized, bounded and cleaned up; unsupported photos show actionable errors', async t => {
  let decode = true, blobSize = 1024, revoked = 0, draws = 0;
  const previousImage = globalThis.Image, previousDocument = globalThis.document;
  const canvas = { width: 0,height: 0,getContext: () => ({ fillRect() {},drawImage() { draws++; },set fillStyle(value) {} }),toBlob(callback,mime) { callback(new Blob([new Uint8Array(blobSize)],{ type: mime })); } };
  globalThis.document = { createElement: () => canvas };
  globalThis.Image = class { naturalWidth = 4000; naturalHeight = 3000; set src(value) { queueMicrotask(() => decode ? this.onload() : this.onerror()); } };
  t.mock.method(URL,'createObjectURL',() => 'blob:synthetic');
  t.mock.method(URL,'revokeObjectURL',() => { revoked++; });
  t.after(() => { if (previousImage === undefined) delete globalThis.Image; else globalThis.Image = previousImage; if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument; });
  for (const [name,type,expected] of [['gallery.jpg','image/jpeg','image/jpeg'],['gallery.webp','image/webp','image/png'],['gallery.png','image/png','image/png'],['gallery.heic','image/heic','image/jpeg'],['gallery.avif','image/avif','image/jpeg'],['gallery.jpeg','','image/jpeg']]) {
    const output = await prepareProfileImage(new File(['synthetic'],name,{ type }));
    assert.equal(output.type,expected); assert(output.size <= 2 * 1024 * 1024);
    assert.equal(canvas.width,1600); assert.equal(canvas.height,1200);
    assert.match(output.name,/\.(png|jpg)$/);
  }
  assert.equal(revoked,6); assert.equal(draws,6);
  await assert.rejects(prepareProfileImage(new File(['synthetic'],'bad.txt',{ type: 'text/plain' })),/Choose an image/);
  await assert.rejects(prepareProfileImage(new File([new Uint8Array(20 * 1024 * 1024 + 1)],'large.jpg',{ type: 'image/jpeg' })),/20 MB/);
  decode = false;
  await assert.rejects(prepareProfileImage(new File(['synthetic'],'phone.heic',{ type: 'image/heic' })),/export it as JPEG or PNG/);
  assert.equal(revoked,7);
  decode = true; blobSize = 2 * 1024 * 1024 + 1;
  await assert.rejects(prepareProfileImage(new File(['synthetic'],'large.png',{ type: 'image/png' })),/still too large/);
  assert.equal(revoked,8); assert.equal(draws,13);
});
