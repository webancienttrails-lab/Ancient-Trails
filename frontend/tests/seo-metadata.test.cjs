const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const origin = 'https://travel.example';
const sharedDependencies = {};
function evaluate(code, dependencies = {}, globals = {}) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(compiled, { module, exports: module.exports, URL, URLSearchParams,
    require: name => dependencies[name] ?? sharedDependencies[name] ?? require(name), ...globals });
  return module.exports;
}
function read(file) { return fs.readFileSync(path.join(__dirname, '..', file), 'utf8'); }
const seo = evaluate(read('lib/seo.ts'), { './site-origin': { getSiteOrigin: () => origin } });
const routes = evaluate(read('lib/routes.ts'));
sharedDependencies['@/components/seo/json-ld'] = evaluate(read('components/seo/json-ld.tsx'));
sharedDependencies['@/lib/structured-data'] = evaluate(read('lib/structured-data.ts'), {
  './site-origin': { getSiteOrigin: () => origin }, './seo': seo, './routes': routes,
  './tour-departures': evaluate(read('lib/tour-departures.ts')),
  './home-travel': { getHomeMediaUrl: value => value },
});
function assertPublic(metadata) {
  assert.ok(metadata.title.absolute.length <= 60, metadata.title.absolute);
  assert.ok(metadata.description.length >= 120 && metadata.description.length <= 155, metadata.description);
  assert.ok(metadata.alternates.canonical.startsWith(origin));
  assert.equal(metadata.openGraph.url, metadata.alternates.canonical);
  assert.equal(metadata.twitter.card, 'summary_large_image');
  assert.equal(metadata.twitter.images[0].url, metadata.openGraph.images[0].url);
}
test('SEO summaries strip markup and long titles stay within the display limit', () => {
  const metadata = seo.pageMetadata({ title: 'A very long heritage tour through ancient temples and royal palaces across India', description: '<script>bad()</script><p>A real &amp; memorable journey.</p>', path: '/tours/temples', image: 'https://cdn.example/temple.jpg' });
  assertPublic(metadata);
  assert.doesNotMatch(metadata.description, /<|bad\(\)|&amp;/);
  assert.equal(metadata.openGraph.images[0].url, 'https://cdn.example/temple.jpg');
  assert.equal(metadata.title.absolute.match(/Ancient Trails/g).length, 1);
});

function exportedMetadata(file) {
  const code = read(file);
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = source.statements.filter(ts.isVariableStatement).flatMap(statement => [...statement.declarationList.declarations]).find(node => node.name.getText(source) === 'metadata');
  assert.ok(declaration, file);
  return evaluate('module.exports = ' + declaration.initializer.getText(source), {}, { ...seo });
}
test('every static public page has a distinct title, description and canonical URL with social previews', () => {
  const pages = ['page.tsx', 'about/page.tsx', 'contact/page.tsx', 'faq/layout.tsx', 'tours/page.tsx', 'destinations/page.tsx', 'tour-calendar/page.tsx', 'short-trails/page.tsx', 'specialised-tours/page.tsx', 'experts/page.tsx', 'experiences/page.tsx', 'privacy-policy/page.tsx', 'terms-and-conditions/page.tsx'];
  const metadata = pages.map(file => exportedMetadata('app/' + file));
  metadata.forEach(assertPublic);
  for (const get of [item => item.title.absolute, item => item.description, item => item.alternates.canonical]) {
    assert.equal(new Set(metadata.map(get)).size, pages.length);
  }
});
test('login, account and recovery routes explicitly prevent indexing', () => {
  for (const file of ['login/page.tsx', 'me/layout.tsx', 'booking/layout.tsx', 'booking-confirmed/[bookingId]/page.tsx', 'booking-submitted/[bookingId]/page.tsx', 'bank-transfer/[bookingId]/page.tsx']) {
    const metadata = exportedMetadata('app/' + file);
    assert.equal(metadata.robots.index, false, file);
  }
});

test('blog articles have a default canonical, article fields and matching Twitter images', async () => {
  const blog = { title: 'Temple Stories', slug: 'temple-stories', seoTitle: '', seoDescription: 'Stories of temple architecture.', quote: '', content: '', ogTitle: '', ogDescription: '', ogImage: '', heroImage: '/uploads/temple.jpg', canonicalUrl: '', seoKeywords: 'temples,heritage', publishedAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-27T00:00:00Z', authorName: 'Trail Author' };
  const route = evaluate(read('app/blog/[slug]/page.tsx'), {
    '@/lib/seo': seo, '@/lib/api': { ApiError: class extends Error {} },
    '@/lib/blogs': { getBlogMediaUrl: value => 'https://api.example' + value,
      getPublishedBlog: async () => ({ data: { blog } }), listPublishedBlogs: async () => ({ data: {} }) },
    'next/navigation': { notFound() { throw Error('NOT_FOUND'); } },
    '../_components/blog-pages': { BlogDetailPage: () => null },
  });
  const metadata = await route.generateMetadata({ params: Promise.resolve({ slug: 'temple-stories' }) });
  assertPublic(metadata);
  assert.equal(metadata.alternates.canonical, origin + '/blog/temple-stories');
  assert.equal(metadata.openGraph.type, 'article');
  assert.equal(metadata.openGraph.images[0].url, 'https://api.example/uploads/temple.jpg');
  assert.equal(metadata.openGraph.authors[0], 'Trail Author');
  blog.canonicalUrl = 'https://publisher.example/original';
  const custom = await route.generateMetadata({ params: Promise.resolve({ slug: blog.slug }) });
  assert.equal(custom.alternates.canonical, blog.canonicalUrl);
});

test('paginated blog pages keep their own canonical URL and page-specific title', async () => {
  const route = evaluate(read('app/blog/page.tsx'), {
    '@/lib/seo': seo, '@/lib/blog-pagination': evaluate(read('lib/blog-pagination.ts')),
    '@/lib/blogs': {}, './_components/blog-pages': {},
    'next/navigation': { notFound() { throw Error('NOT_FOUND'); } },
  });
  const first = await route.generateMetadata({});
  const second = await route.generateMetadata({ searchParams: Promise.resolve({ page: '2' }) });
  assertPublic(first); assertPublic(second);
  assert.equal(first.alternates.canonical, origin + '/blog');
  assert.equal(second.alternates.canonical, origin + '/blog?page=2');
  assert.notEqual(first.title.absolute, second.title.absolute);
});

test('unknown blog pages and metadata invoke server notFound while API failures remain errors', async () => {
  class ApiError extends Error { constructor(statusCode) { super('API failed'); this.statusCode = statusCode; } }
  let status = 404;
  const route = evaluate(read('app/blog/[slug]/page.tsx'), {
    '@/lib/seo': seo, '@/lib/api': { ApiError },
    '@/lib/blogs': { getPublishedBlog: async () => { throw new ApiError(status); } },
    '../_components/blog-pages': { BlogDetailPage: () => null },
    'next/navigation': { notFound() { throw Error('NOT_FOUND'); } },
  });
  const props = { params: Promise.resolve({ slug: 'zzz-not-a-real-post' }) };
  await assert.rejects(route.default(props), /NOT_FOUND/);
  await assert.rejects(route.generateMetadata(props), /NOT_FOUND/);
  status = 503;
  await assert.rejects(route.default(props), error => error.statusCode === 503);
});

test('valid blog pages receive server data without waiting for browser validation', async () => {
  const detail = { blog: { id: 'blog-1', slug: 'real-post', title: 'Real Post', content: 'A heritage story.', heroImage: 'https://cdn.example/story.jpg', publishedAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-27T00:00:00Z', authorName: 'Trail Author' }, relatedTours: [], popularPosts: [], adjacentPosts: [] };
  const route = evaluate(read('app/blog/[slug]/page.tsx'), {
    '@/lib/seo': seo, '@/lib/api': { ApiError: class extends Error {} },
    '@/lib/blogs': { getPublishedBlog: async () => ({ data: detail }), listPublishedBlogs: async () => ({ data: { blogs: [] } }) },
    '../_components/blog-pages': { BlogDetailPage: () => null },
    'next/navigation': { notFound() { throw Error('NOT_FOUND'); } },
  });
  const result = await route.default({ params: Promise.resolve({ slug: 'real-post' }) });
  const article = result.props.children.find(child => child.props?.initialData);
  assert.equal(article.props.initialData, detail);
  assert.equal(article.props.slug, 'real-post');
  const schema = result.props.children.find(child => child.props?.id === 'article-jsonld').props.data;
  assert.equal(schema['@type'], 'Article');
  assert.equal(schema.url, origin + '/blog/real-post');
  assert.equal(schema.headline, 'Real Post');
});

test('record-backed metadata finishes before HTML headers are streamed', () => {
  const config = evaluate(read('next.config.ts'), {}, { process: { env: { NODE_ENV: 'production' } } }).default;
  for (const agent of ['', 'Mozilla/5.0', 'Googlebot', 'WhatsApp']) assert.ok(config.htmlLimitedBots.test(agent));
});

test('experience previews use the actual story and photo with a stable canonical', async () => {
  const route = evaluate(read('app/experiences/[experienceId]/page.tsx'), {
    '@/lib/seo': seo, '@/lib/routes': routes,
    '@/lib/home-travel': { getHomeMediaUrl: value => value },
    '@/lib/experience-page': { loadExperiencePage: async () => ({ tour: null, experiences: [{ id: 'review-1', title: 'Walking through Hampi', writtenReview: 'Carved temples and memorable walks.', travellerPhotoGallery: ['https://cdn.example/hampi.jpg'], attractionPhotoGallery: [] }] }) },
    '../_components/experiences-page': {}, 'next/navigation': { notFound() { throw Error('NOT_FOUND'); } },
  });
  const metadata = await route.generateMetadata({ params: Promise.resolve({ experienceId: 'review-1' }) });
  assertPublic(metadata);
  assert.equal(metadata.alternates.canonical, origin + '/experiences/review-1');
  assert.match(metadata.description, /Walking through Hampi/);
  assert.equal(metadata.openGraph.images[0].url, 'https://cdn.example/hampi.jpg');
});
