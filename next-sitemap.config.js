/** @type {import('next-sitemap').IConfig} */
module.exports = {
    siteUrl: 'https://www.rhynoai.ir', // 👈 اصلاح شد
    generateRobotsTxt: true,
    sitemapSize: 5000,
    changefreq: 'weekly',
    priority: 0.7,
    outDir: './public',

    exclude: ['/api/*', '/secret', '/server-sitemap.xml'],

    robotsTxtOptions: {
        policies: [
            {
                userAgent: '*',
                allow: '/',
                disallow: ['/api', '/secret'],
            },
        ],
    },

    additionalPaths: async (config) => [
        await config.transform(config, '/'),        // صفحه اصلی
        await config.transform(config, '/chat'),
        await config.transform(config, '/blog'),
        await config.transform(config, '/about'),
        await config.transform(config, '/contact'),
    ],
};
