const test=require('node:test');
const assert=require('node:assert/strict');
const {isGoogleMapsUrl,getGoogleMapsEmbedUrl}=require('../src/utils/destination-map.ts');
const {resolveDestinationMapUrl,resolveDestinationMapContent}=require('../src/services/destination-map.service.ts');
const expanded='https://www.google.com/maps/place/Hampi,+Karnataka/@15.3324162,76.440832,3235m/data=!3m5!8m2!3d15.3350132!4d76.460024';
test('map URLs are validated and place coordinates take precedence over viewport coordinates',()=>{
  assert.ok(isGoogleMapsUrl('https://maps.app.goo.gl/PosZzJ5MqDGHejrN7'));
  for(const url of ['https://maps.app.goo.gl.evil.test/x','https://user@maps.google.com/maps?q=x','http://127.0.0.1/maps','https://www.google.com/url?url=https://evil.test','https://maps.app.goo.gl/x?link=http://127.0.0.1','javascript:alert(1)'])assert.equal(isGoogleMapsUrl(url),false,url);
  assert.match(getGoogleMapsEmbedUrl(expanded),/q=15.3350132%2C76.460024/);
  const embed='https://www.google.com/maps/embed?pb=test';
  assert.equal(getGoogleMapsEmbedUrl(embed),embed);
  assert.equal(getGoogleMapsEmbedUrl('https://maps.app.goo.gl/Short'),null);
});
test('legacy share links are expanded, cached, and returned as maps rather than images',async t=>{
  let calls=0;
  t.mock.method(global,'fetch',async()=>{calls++;return new Response(null,{status:302,headers:{location:expanded}})});
  const source={mapImage:'https://maps.app.goo.gl/TestLegacyMap',mapQuery:'Hampi',byAir:'Airport'};
  const result=await resolveDestinationMapContent(source);
  assert.equal(result.mapImage,'');assert.equal(result.mapLink,source.mapImage);
  assert.equal(result.byAir,'Airport');assert.match(result.mapEmbedUrl,/q=15.3350132%2C76.460024/);
  await resolveDestinationMapContent(source);assert.equal(calls,1);
});
test('redirects to non-map hosts are never fetched and failures retain the saved address',async t=>{
  let calls=0;
  t.mock.method(global,'fetch',async()=>{calls++;return new Response(null,{status:302,headers:{location:'http://127.0.0.1/private'}})});
  const result=await resolveDestinationMapContent({mapLink:'https://maps.app.goo.gl/TestUnsafeRedirect',mapQuery:'Saved address'});
  assert.equal(calls,1);assert.equal(result.mapEmbedUrl,undefined);assert.equal(result.mapQuery,'Saved address');
  assert.equal(await resolveDestinationMapUrl('https://evil.test/maps'),null);
});
test('uploaded map images remain images without external requests',async t=>{
  t.mock.method(global,'fetch',async()=>assert.fail('Image mode must not resolve maps'));
  assert.deepEqual(await resolveDestinationMapContent({mapImage:'/uploads/map.webp'}),{mapImage:'/uploads/map.webp'});
});
