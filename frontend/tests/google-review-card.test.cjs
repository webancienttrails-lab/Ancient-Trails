const test=require("node:test");const assert=require("node:assert/strict");const fs=require("node:fs");const path=require("node:path");const Module=require("node:module");const ts=require("typescript");const React=require("react");const {renderToStaticMarkup}=require("react-dom/server");
function load(relative){
 const filename=path.resolve(__dirname,relative);const loaded=new Module(filename,module);loaded.filename=filename;loaded.paths=Module._nodeModulePaths(path.dirname(filename));
 loaded.require=function(request){if(request==="../../lib/google-review-url")return validators;return Module.prototype.require.call(this,request);};
 loaded._compile(ts.transpileModule(fs.readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);return loaded.exports;
}
const validators=load("../lib/google-review-url.ts");
const {GoogleReviewCard}=load("../components/experiences/google-review-card.tsx");
const individual="https://www.google.com/maps/reviews/data=!original";const business="https://search.google.com/local/reviews?placeid=ChIJBusiness";
const card=(props={})=>renderToStaticMarkup(React.createElement(GoogleReviewCard,{reviewerName:"Traveller",className:"mb-6 flex break-inside-avoid flex-col rounded-[10px] border bg-white px-5 py-5",...props},React.createElement("p",null,"Unchanged review content")));

test("individual review card is a native keyboard-accessible anchor opening the exact original in a protected new tab",()=>{const html=card({googleReviewUrl:individual});assert.match(html,/^<a /);assert.ok(html.includes('href="'+individual+'"'));assert.match(html,/target="_blank"/);assert.match(html,/rel="noopener noreferrer"/);assert.match(html,/opens in a new tab/);});
test("missing individual URL uses only the verified business fallback",()=>{assert.ok(card({businessReviews:{googleBusinessReviewsUrl:business,googleBusinessReviewsVerified:true}}).includes(business));assert.match(card({businessReviews:{googleBusinessReviewsUrl:business,googleBusinessReviewsVerified:false}}),/^<article /);});
test("existing cards without configured links remain non-interactive articles with identical classes and content",()=>{const legacy=card();const linked=card({googleReviewUrl:individual});assert.match(legacy,/^<article /);assert.ok(!legacy.includes('href='));assert.equal(legacy.match(/class="([^"]*)"/)[1],linked.match(/class="([^"]*)"/)[1]);assert.equal(legacy.match(/<p>.*<\/p>/)[0],linked.match(/<p>.*<\/p>/)[0]);});
test("unsafe URLs never create navigable cards",()=>{assert.match(card({googleReviewUrl:"javascript:alert(1)",businessReviews:{googleBusinessReviewsUrl:"https://evil.example",googleBusinessReviewsVerified:true}}),/^<article /);});
test("backend, admin and frontend use the exact same URL allowlist",()=>{const source=fs.readFileSync(path.resolve(__dirname,"../lib/google-review-url.ts"),"utf8");for(const file of ["../../admin/lib/google-review-url.ts","../../backend/src/utils/google-review-url.ts"]) assert.equal(fs.readFileSync(path.resolve(__dirname,file),"utf8"),source);});

test("an individual review cannot be configured as the site-wide business fallback",()=>{assert.match(card({businessReviews:{googleBusinessReviewsUrl:individual,googleBusinessReviewsVerified:true}}),/^<article /);});


test("contributor review URLs remain intact and open safely without becoming a business fallback",()=>{
 const url="https://www.google.com/maps/contrib/109670718655898970237/reviews?hl=en-IN";
 const html=card({googleReviewUrl:url});assert.ok(html.includes('href="'+url+'"'));assert.match(html,/target="_blank"/);assert.match(html,/rel="noopener noreferrer"/);
 assert.match(card({businessReviews:{googleBusinessReviewsUrl:url,googleBusinessReviewsVerified:true}}),/^<article /);
});


test("Google shared review link from the screenshot opens the unchanged short URL in a protected new tab",()=>{
 const url="https://share.google/h6TtxRsHYpHRd5NAh";
 const html=card({googleReviewUrl:url});assert.ok(html.includes('href="'+url+'"'));assert.match(html,/target="_blank"/);assert.match(html,/rel="noopener noreferrer"/);
 assert.match(card({businessReviews:{googleBusinessReviewsUrl:url,googleBusinessReviewsVerified:true}}),/^<article /);
});
