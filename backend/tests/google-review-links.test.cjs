const test = require("node:test");
const assert = require("node:assert/strict");
const { Experience } = require("../dist/models/experience.model");
const { Tour } = require("../dist/models/tour.model");
const { SiteSettings } = require("../dist/models/siteSettings.model");
const { createExperience, updateExperience, listPublishedExperiences } = require("../dist/controllers/experience.controller");
const { updateSiteSettings } = require("../dist/controllers/siteSettings.controller");
const { isGoogleReviewUrl, resolveGoogleReviewUrl } = require("../dist/utils/google-review-url");
const individual = "https://www.google.com/maps/reviews/data=!4m5!1soriginal-review";
const business = "https://search.google.com/local/reviews?placeid=ChIJBusiness";
const payload = {tourId:"TOUR1", travellerName:"Original traveller", writtenReview:"Original review", travellerPhotoGallery:["/original.jpg"], ratingItinerary:4, ratingLocalTransport:5, ratingAccommodation:4, ratingTourExpert:5, status:"Published"};
const response = () => ({statusCode:0,body:null,status(code){this.statusCode=code;return this;},json(body){this.body=body;}});
function tourMocks(t) {
 t.mock.method(Tour,"findOne",()=>({select(){return this;},lean:async()=>({tourId:"TOUR1"})}));
 t.mock.method(Tour,"find",()=>({select(){return this;},lean:async()=>[{tourId:"TOUR1",tourName:"Tour"}]}));
}

test("only supported HTTPS Google Maps and review destinations are accepted", () => {
 for (const url of [individual,business,"https://maps.app.goo.gl/AbCd123?g_st=ic","https://goo.gl/maps/AbCd123","https://g.page/r/Business/review","https://www.google.co.in/maps/place/Ancient+Trails","https://maps.google.com/?cid=123"]) assert.equal(isGoogleReviewUrl(url),true,url);
 for (const url of ["javascript:alert(1)","http://www.google.com/maps/place/Test","https://google.com.evil.example/maps/place/X","https://evil.example/?google.com/maps/reviews","https://www.google.com/url?q=https://evil.example","https://www.google.com/search?q=reviews","https://user:pass@www.google.com/maps/reviews/x","https://www.google.com:444/maps/reviews/x","https://maps.app.goo.gl/AbCd?link=https://evil.example","https://maps.app.goo.gl/AbCd?ofl=https://evil.example","https://www.google.com/maps/reviews/x\n", "https://www.google.com/maps/\\evil.example"]) {
   // Surrounding whitespace is trimmed; controls inside a URL must be rejected.
   if(url.endsWith("\n")) continue;
   assert.equal(isGoogleReviewUrl(url),false,url);
 }
 assert.equal(isGoogleReviewUrl("https://www.google.com/maps/reviews/a\tb"),false);
});

test("individual review wins; only a verified configured business URL can be a fallback", () => {
 const config={googleBusinessReviewsUrl:business,googleBusinessReviewsVerified:true};
 assert.equal(resolveGoogleReviewUrl(individual,config),individual);
 assert.equal(resolveGoogleReviewUrl(undefined,config),business);
 assert.equal(resolveGoogleReviewUrl(undefined,{...config,googleBusinessReviewsVerified:false}),"");
 assert.equal(resolveGoogleReviewUrl("https://evil.example",{...config,googleBusinessReviewsUrl:"https://evil.example"}),"");
 assert.equal(resolveGoogleReviewUrl(),"");
 assert.equal(resolveGoogleReviewUrl(undefined,{...config,googleBusinessReviewsUrl:individual}),"");
});

test("adding a Google link preserves submitted review content, names, photos and ratings", async t => {
 tourMocks(t);t.mock.method(Experience,"create",async data=>new Experience({experienceId:"EXP1",...data}));
 const res=response();await createExperience({body:{...payload,googleReviewUrl:"  "+individual+"  "}},res);
 assert.equal(res.statusCode,201);assert.equal(res.body.data.experience.googleReviewUrl,individual);
 for(const field of ["writtenReview","travellerName","ratingItinerary","ratingLocalTransport","ratingAccommodation","ratingTourExpert"]) assert.equal(res.body.data.experience[field],payload[field]);
 assert.deepEqual(Array.from(res.body.data.experience.travellerPhotoGallery),payload.travellerPhotoGallery);
});

test("older clients omitting the optional URL do not clear an existing review link", async t => {
 tourMocks(t);const stored=new Experience({experienceId:"EXP1",...payload,googleReviewUrl:individual});
 t.mock.method(Experience,"findByIdAndUpdate",async(id,data)=>{assert.equal(Object.hasOwn(data,"googleReviewUrl"),false);stored.set(data);return stored;});
 const res=response();await updateExperience({params:{id:stored.id},body:payload},res);assert.equal(res.body.data.experience.googleReviewUrl,individual);
});

test("an admin can explicitly clear an individual URL", async t => {
 tourMocks(t);const stored=new Experience({experienceId:"EXP1",...payload,googleReviewUrl:individual});
 t.mock.method(Experience,"findByIdAndUpdate",async(id,data)=>{stored.set(data);return stored;});
 const res=response();await updateExperience({params:{id:stored.id},body:{...payload,googleReviewUrl:""}},res);assert.equal(res.body.data.experience.googleReviewUrl,"");
});

test("unsafe individual URLs fail before a review write", async t => {
 const write=t.mock.method(Experience,"create",()=>{throw Error("No write expected");});
 await assert.rejects(createExperience({body:{...payload,googleReviewUrl:"https://evil.example"}},response()),error=>error.statusCode===400);
 assert.equal(write.mock.callCount(),0);
 const model=new Experience({experienceId:"EXP1",...payload,googleReviewUrl:"https://evil.example"});await assert.rejects(model.validate(), error => Boolean(error.errors?.googleReviewUrl));
});

test("public API exposes the optional link and keeps legacy reviews available", async t => {
 tourMocks(t);const records=[new Experience({experienceId:"EXP1",...payload,googleReviewUrl:individual}),new Experience({experienceId:"LEGACY",...payload})];
 t.mock.method(Experience,"find",()=>({sort(){return this;},limit:async()=>records}));
 const res=response();await listPublishedExperiences({query:{}},res);
 assert.equal(res.body.data.experiences[0].googleReviewUrl,individual);assert.equal(res.body.data.experiences[1].googleReviewUrl,"");assert.equal(res.body.data.experiences.length,2);
});

test("business fallback requires confirmation, resets on a URL-only update and survives unrelated settings edits", async t => {
 const contact={emailId:"help@example.com"};let stored=new SiteSettings({key:"site",contact});
 t.mock.method(SiteSettings,"findOneAndUpdate",async(filter,update)=>{stored.set(update.$set);return stored;});
 const res=response();await updateSiteSettings({body:{contact,googleBusinessReviewsUrl:business,googleBusinessReviewsVerified:true}},res);
 assert.equal(res.body.data.settings.googleBusinessReviewsVerified,true);
 await updateSiteSettings({body:{contact}},res);assert.equal(res.body.data.settings.googleBusinessReviewsUrl,business);assert.equal(res.body.data.settings.googleBusinessReviewsVerified,true);
 await updateSiteSettings({body:{contact,googleBusinessReviewsUrl:business}},res);assert.equal(res.body.data.settings.googleBusinessReviewsVerified,false);
 await assert.rejects(updateSiteSettings({body:{contact,googleBusinessReviewsVerified:true}},res),error=>error.statusCode===400);
 await assert.rejects(updateSiteSettings({body:{contact,googleBusinessReviewsUrl:"https://evil.example"}},res),error=>error.statusCode===400);
});


test("Google contributor reviews URL from the admin form can be saved without changing review data", async t => {
 const url="https://www.google.com/maps/contrib/109670718655898970237/reviews?hl=en-IN";
 assert.equal(isGoogleReviewUrl(url),true);
 assert.equal(isGoogleReviewUrl("https://www.google.com/maps/contrib/not-a-profile/reviews"),false);
 assert.equal(isGoogleReviewUrl("https://www.google.com.evil.example/maps/contrib/109670718655898970237/reviews"),false);
 assert.equal(resolveGoogleReviewUrl(undefined,{googleBusinessReviewsUrl:url,googleBusinessReviewsVerified:true}),"");
 tourMocks(t);const stored=new Experience({experienceId:"EXP1",...payload});
 t.mock.method(Experience,"findByIdAndUpdate",async(id,data)=>{stored.set(data);return stored;});
 const res=response();await updateExperience({params:{id:stored.id},body:{...payload,googleReviewUrl:url}},res);
 assert.equal(res.body.data.experience.googleReviewUrl,url);
 assert.equal(res.body.data.experience.writtenReview,payload.writtenReview);
 assert.equal(res.body.data.experience.travellerName,payload.travellerName);
});


test("Google review share.google links save with the original URL and still reject spoofed or redirecting links", async t => {
 const url="https://share.google/h6TtxRsHYpHRd5NAh";
 assert.equal(isGoogleReviewUrl(url),true);
 for(const invalid of ["https://share.google.evil.example/h6TtxRsHYpHRd5NAh","http://share.google/h6TtxRsHYpHRd5NAh","https://share.google/h6TtxRsHYpHRd5NAh?url=https://evil.example","https://share.google/h6TtxRsHYpHRd5NAh?link=https://evil.example","https://share.google/","https://share.google/one/two"]) assert.equal(isGoogleReviewUrl(invalid),false,invalid);
 assert.equal(resolveGoogleReviewUrl(undefined,{googleBusinessReviewsUrl:url,googleBusinessReviewsVerified:true}),"");
 tourMocks(t);const stored=new Experience({experienceId:"EXP1",...payload});
 t.mock.method(Experience,"findByIdAndUpdate",async(id,data)=>{stored.set(data);return stored;});
 const res=response();await updateExperience({params:{id:stored.id},body:{...payload,googleReviewUrl:url}},res);
 assert.equal(res.body.data.experience.googleReviewUrl,url);
 assert.equal(res.body.data.experience.writtenReview,payload.writtenReview);
});


test("Google publication date and original relative description persist without changing review content", async t=>{
 tourMocks(t);const stored=new Experience({experienceId:"EXP1",...payload});
 t.mock.method(Experience,"findByIdAndUpdate",async(id,data)=>{stored.set(data);return stored;});const res=response();
 await updateExperience({params:{id:stored.id},body:{...payload,googleReviewPublishedAt:"2025-06-15T10:27:45.123Z",googleReviewTimeDescription:"a year ago"}},res);
 assert.equal(res.body.data.experience.googleReviewPublishedAt.toISOString(),"2025-06-15T10:27:45.123Z");assert.equal(res.body.data.experience.googleReviewTimeDescription,"a year ago");assert.equal(res.body.data.experience.writtenReview,payload.writtenReview);
 await updateExperience({params:{id:stored.id},body:payload},res);assert.equal(res.body.data.experience.googleReviewPublishedAt.toISOString(),"2025-06-15T10:27:45.123Z");assert.equal(res.body.data.experience.googleReviewTimeDescription,"a year ago");
 await updateExperience({params:{id:stored.id},body:{...payload,googleReviewPublishedAt:null}},res);assert.equal(res.body.data.experience.googleReviewPublishedAt,null);
});
test("invalid or future Google publication dates are rejected before saving",async t=>{
 const write=t.mock.method(Experience,"create",()=>{throw Error("No write expected");});
 for(const date of ["not-a-date","2025-02-30T12:00:00Z",new Date(Date.now()+86400000).toISOString()])await assert.rejects(createExperience({body:{...payload,googleReviewPublishedAt:date}},response()),error=>error.statusCode===400);
 assert.equal(write.mock.callCount(),0);
});
