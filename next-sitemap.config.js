/** @type {import('next-sitemap').IConfig} */
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
            {
                userAgent: '*',
                allow: '/',
                disallow: ['/api', '/secret'],
            },
        ],
    },

    additionalPaths: async (config) => {
        // مسیرهای ثابت سایت
        const staticPaths = await Promise.all([
            config.transform(config, '/'),
            config.transform(config, '/chat'),
            config.transform(config, '/about'),
            config.transform(config, '/contact'),
            config.transform(config, '/blog'),
        ]);

        // مسیرهای بلاگ — اینجا باید لیست slugها رو دستی یا داینامیک وارد کنید
        const blogSlugs = [
            'ai-business-growth',
            'ai-dollar-rhyno',
            'ai-trends-2025',
            "rhyno-dollar-1",
            "content-creation-ai",
            "keyword-research-with-ai",
            "link-building-guide",
            "on-page-seo-guide",
            "pejman-jamshidi-seo"

        ];

        const blogPaths = await Promise.all(
            blogSlugs.map((slug) => config.transform(config, `/blog/${slug}`))
        );

        return [...staticPaths, ...blogPaths];
    },
};
