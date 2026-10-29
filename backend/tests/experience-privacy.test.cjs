const test = require('node:test');
const assert = require('node:assert/strict');
const { Experience } = require('../dist/models/experience.model');
const { Tour } = require('../dist/models/tour.model');
const { listPublishedExperiences, getPublishedExperience, listExperiences, getExperience } = require('../dist/controllers/experience.controller');
const response = () => ({ status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } });
function setup(t) {
  const records = ['private-reviewer@example.test', 'PRIVATE-REVIEWER@example.test', 'other-reviewer@example.test'].map((email, index) => {
    const record = new Experience({ experienceId:'EXP-' + index,tourId:'TOURTEST',travellerName:'Published reviewer',
      travellerEmail:email,title:'Published review',writtenReview:'A memorable tour',status:'Published',
      ratingItinerary:4,ratingLocalTransport:5,ratingAccommodation:4,ratingTourExpert:5,
      travellerPhotoGallery:['/photo.jpg'],attractionPhotoGallery:[{image:'/attraction.jpg',name:'Heritage site'}] });
    record.travellerPhone = '919876543210';
    record.contact = {email,phone:'919876543210'};
    record.privateNotes = 'Private reviewer contact';
    record.attractionPhotoGallery[0].travellerEmail = email;
    return record;
  });
  t.mock.method(Experience,'find',filter=>{
    if(filter.status) assert.equal(filter.status,'Published');
    return{sort(){return this;},limit:async()=>records};
  });
  t.mock.method(Experience,'findOne',async filter=>{
    assert.equal(filter.status,'Published');
    return records.find(record=>filter.$or.some(value=>value._id===record.id||value.experienceId===record.experienceId))||null;
  });
  t.mock.method(Experience,'findById',async()=>records[0]);
  t.mock.method(Tour,'find',()=>({select(){return this;},lean:async()=>[{tourId:'TOURTEST',tourName:'Test tour'}]}));
  return records;
}
function assertPublic(value) {
  if(Array.isArray(value)) {value.forEach(assertPublic);return;}
  if(!value||typeof value!=='object')return;
  for(const[key,child]of Object.entries(value)) {
    assert.doesNotMatch(key,/email|phone|mobile|contact|private|secret|token/i,'Private contact field leaked: '+key);
    assertPublic(child);
  }
  const encoded=JSON.stringify(value);
  assert.doesNotMatch(encoded,/@example\.test|919876543210|Private reviewer contact/);
}

test('anonymous public experience index uses an allow-list that omits contact and future private fields',async t=>{
  const records=setup(t),res=response();
  await listPublishedExperiences({query:{},headers:{}},res);
  assertPublic(res.body.data.experiences);
  const published=res.body.data.experiences[0];
  assert.equal(published.id,records[0].id);
  assert.equal(published.travellerName,'Published reviewer');
  assert.equal(published.writtenReview,'A memorable tour');
  assert.equal(published.ratingItinerary,4);
  assert.deepEqual(published.travellerPhotoGallery,['/photo.jpg']);
  assert.deepEqual(published.attractionPhotoGallery,[{image:'/attraction.jpg',name:'Heritage site'}]);
});

test('tour-filtered public experience index also omits all reviewer contact fields',async t=>{
  setup(t);const res=response();
  await listPublishedExperiences({query:{tourId:'TOURTEST'}},res);
  assertPublic(res.body.data.experiences);
});

test('public experience details are safe by both database ID and experience code',async t=>{
  const records=setup(t);
  for(const reference of [records[0].id,records[0].experienceId.toLowerCase()]) {
    const res=response();await getPublishedExperience({params:{reference},headers:{}},res);
    assertPublic(res.body.data.experience);
    assert.equal(res.body.data.experience.travellerReviewCount,2);
  }
});

test('review counts preserve email-based grouping without publishing addresses or linkable email hashes',async t=>{
  setup(t);const res=response();await listPublishedExperiences({query:{}},res);
  assert.deepEqual(res.body.data.experiences.map(record=>record.travellerReviewCount),[2,2,1]);
  assertPublic(res.body.data.experiences);
});

test('admin experience serializers retain the saved email for authorized management',async t=>{
  const records=setup(t),index=response(),detail=response();
  await listExperiences({query:{}},index);
  await getExperience({params:{id:records[0].id}},detail);
  assert.equal(index.body.data.experiences[0].travellerEmail,'private-reviewer@example.test');
  assert.equal(detail.body.data.experience.travellerEmail,'private-reviewer@example.test');
});
