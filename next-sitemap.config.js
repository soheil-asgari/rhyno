/** @type {import('next-sitemap').IConfig} */
module.exports = {
    siteUrl: 'https://www.rhynoai.ir',
    generateRobotsTxt: true,
    sitemapSize: 5000,
    changefreq: 'weekly',
    priority: 0.7,
    outDir: './public',
    exclude: ['/api/*', '/secret', '/server-sitemap.xml', '/admin/*'],
    robotsTxtOptions: {
        policies: [
            { userAgent: '*', allow: '/', disallow: ['/api', '/secret', '/admin'] },
        ],
    },
    // ✅ بخش additionalPaths کامل حذف شد چون خودکار انجام می‌شود
};