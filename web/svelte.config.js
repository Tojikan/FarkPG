import adapter from '@sveltejs/adapter-static';

// GitHub Pages: set BASE_PATH in workflow to /${{ github.event.repository.name }}
// so the site works at https://<user>.github.io/<repo-name>/
const base = process.env.BASE_PATH ?? (process.env.GITHUB_PAGES === 'true' ? '/FarkPG' : '');

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: '404.html', // replace default GitHub Pages 404 (see adapter-static docs)
      precompress: false,
      strict: true
    }),
    paths: { base },
    trailingSlash: 'always'
  }
};

export default config;
