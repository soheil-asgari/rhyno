/** @type {import('next-sitemap').IConfig} */
module.exports = {
    siteUrl: 'https://rhynoai.ir',
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

    // مسیرهای دستی
    additionalPaths: async (config) => [
        await config.transform(config, '/'),
        await config.transform(config, '/landing'),
        await config.transform(config, '/chat'),
    ],
};
