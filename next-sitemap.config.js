/** @type {import('next-sitemap').IConfig} */
const fs = require('fs');
const path = require('path');

const getBlogSlugs = () => {
    const postsDirectory = path.join(process.cwd(), '_posts');
    try {
        const fileNames = fs.readdirSync(postsDirectory);
        return fileNames
            .filter(fileName => fileName.endsWith('.md'))
            .map(fileName => fileName.replace(/\.md$/, ''));
    } catch (e) {
        console.error("Error reading blog posts:", e);
        return [];
    }
};
module.exports = {
    siteUrl: 'https://www.rhynoai.ir',
    generateRobotsTxt: true,
    sitemapSize: 5000,
    changefreq: 'weekly',
    priority: 0.7,
    outDir: './public',
    exclude: ['/api/*', '/secret', '/server-sitemap.xml'],
    robotsTxtOptions: {
        policies: [
            { userAgent: '*', allow: '/', disallow: ['/api', '/secret'] },
        ],
    },
    additionalPaths: async (config) => {
        const staticPaths = await Promise.all([
            config.transform(config, '/'),
            config.transform(config, '/chat'),
            config.transform(config, '/about'),
            config.transform(config, '/contact'),
            config.transform(config, '/blog'),
            config.transform(config, '/enterprise'),
            config.transform(config, '/company'),
        ]);

        // ✅ خواندن خودکار لیست مقالات
        const blogSlugs = getBlogSlugs();
        
        const blogPaths = await Promise.all(
            blogSlugs.map((slug) => config.transform(config, `/blog/${slug}`))
        );

        return [...staticPaths, ...blogPaths];
    },
};