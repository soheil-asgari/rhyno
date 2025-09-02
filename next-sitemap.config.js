/** @type {import('next-sitemap').IConfig} */
module.exports = {
    siteUrl: 'https://rhynoai.ir',
    generateRobotsTxt: true,
    sitemapSize: 5000,
    changefreq: 'weekly',
    priority: 0.7,
    exclude: ['/secret'],
    outDir: './public',// صفحات مخفی یا غیرضروری
};
