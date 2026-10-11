// Store catalog. `kind` decides where deals come from:
//   shopify  - the store's own product catalog (live prices)
//   tapestry - Kate Spade / Coach listing pages (live prices)
//   magento  - the store's Magento catalog (live prices)
//   lovense  - Lovense's own store page (live prices)
//   feed     - community-posted deals from Slickdeals, for retailers that don't expose a catalog

const shopify = (id, name, category, domain) => ({ id, name, category, kind: 'shopify', domain });

const tapestry = (id, name, domain, paths) => ({ id, name, category: 'fashion', kind: 'tapestry', domain, paths });

const feed = (id, name, category, domain, { query = name, match, exclude } = {}) => ({
  id,
  name,
  category,
  kind: 'feed',
  domain,
  query,
  match: match || new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*'), 'i'),
  exclude,
});

export const STORES = [
  // Fashion, bags and jewelry
  tapestry('kate-spade-outlet', 'Kate Spade Outlet', 'www.katespadeoutlet.com', [
    '/shop/deals/clearance',
    '/shop/deals/todays-deal',
    '/shop/deals/handbags-under-100',
    '/shop/handbags/view-all',
    '/shop/wallets/view-all',
    '/shop/clothing/view-all',
  ]),
  tapestry('kate-spade', 'Kate Spade', 'www.katespade.com', [
    '/shop/sale/view-all',
    '/shop/sale/handbags',
    '/shop/sale/wallets',
    '/shop/sale/jewelry',
    '/shop/sale/clothing',
    '/shop/sale/shoes',
  ]),
  tapestry('coach-outlet', 'Coach Outlet', 'www.coachoutlet.com', [
    '/shop/bags/view-all',
    '/shop/women/view-all',
    '/shop/men/view-all',
  ]),
  tapestry('coach', 'Coach', 'www.coach.com', ['/shop/sale/view-all']),
  { id: 'zumiez', name: 'Zumiez', category: 'fashion', kind: 'magento', domain: 'www.zumiez.com', saleCategory: 'Markdowns' },
  feed('hot-topic', 'Hot Topic', 'fashion', 'hottopic.com'),
  feed('spencers', "Spencer's", 'fashion', 'spencersonline.com', { query: 'spencers', match: /spencer'?s/i, exclude: /marks\s*(&|and)\s*spencer/i }),
  feed('pandora', 'Pandora', 'fashion', 'pandora.net', { query: 'pandora jewelry', exclude: /avatar|frontiers|borderlands/i }),
  feed('michael-kors', 'Michael Kors', 'fashion', 'michaelkors.com'),
  feed('tory-burch', 'Tory Burch', 'fashion', 'toryburch.com'),
  feed('swarovski', 'Swarovski', 'fashion', 'swarovski.com'),
  feed('kendra-scott', 'Kendra Scott', 'fashion', 'kendrascott.com'),
  feed('nordstrom', 'Nordstrom', 'fashion', 'nordstrom.com', { exclude: /nordstrom\s*rack/i }),
  feed('nordstrom-rack', 'Nordstrom Rack', 'fashion', 'nordstromrack.com'),
  feed('macys', "Macy's", 'fashion', 'macys.com', { query: 'macys', match: /macy'?s/i }),
  feed('nike', 'Nike', 'fashion', 'nike.com', { match: /\bnike\b/i }),
  feed('adidas', 'Adidas', 'fashion', 'adidas.com'),
  feed('lululemon', 'Lululemon', 'fashion', 'lululemon.com'),
  // Slickdeals files Old Navy under gap.com, so Old Navy is matched by name only.
  feed('gap', 'Gap', 'fashion', 'gap.com', { query: 'gap.com', match: /\bgap\b/i, exclude: /old\s*navy|banana\s*republic|athleta/i }),
  feed('old-navy', 'Old Navy', 'fashion', 'oldnavy.com'),
  feed('j-crew', 'J.Crew', 'fashion', 'jcrew.com', { query: 'j.crew', match: /j\.?\s*crew/i }),
  feed('levis', "Levi's", 'fashion', 'levi.com', { query: 'levis', match: /levi'?s/i }),
  feed('ralph-lauren', 'Ralph Lauren', 'fashion', 'ralphlauren.com'),
  shopify('rebecca-minkoff', 'Rebecca Minkoff', 'fashion', 'rebeccaminkoff.com'),
  shopify('steve-madden', 'Steve Madden', 'fashion', 'stevemadden.com'),
  shopify('dagne-dover', 'Dagne Dover', 'fashion', 'dagnedover.com'),
  shopify('jw-pei', 'JW PEI', 'fashion', 'jwpei.com'),
  shopify('cuyana', 'Cuyana', 'fashion', 'cuyana.com'),
  shopify('beis', 'Béis', 'fashion', 'beistravel.com'),
  shopify('away', 'Away', 'fashion', 'awaytravel.com'),
  shopify('baublebar', 'BaubleBar', 'fashion', 'baublebar.com'),
  shopify('gorjana', 'gorjana', 'fashion', 'gorjana.com'),
  shopify('alex-and-ani', 'Alex and Ani', 'fashion', 'alexandani.com'),
  shopify('pura-vida', 'Pura Vida', 'fashion', 'puravidabracelets.com'),
  shopify('mvmt', 'MVMT', 'fashion', 'mvmt.com'),
  shopify('alo-yoga', 'Alo Yoga', 'fashion', 'aloyoga.com'),
  shopify('gymshark', 'Gymshark', 'fashion', 'gymshark.com'),
  shopify('fashion-nova', 'Fashion Nova', 'fashion', 'fashionnova.com'),
  shopify('princess-polly', 'Princess Polly', 'fashion', 'us.princesspolly.com'),
  shopify('good-american', 'Good American', 'fashion', 'goodamerican.com'),
  shopify('staud', 'STAUD', 'fashion', 'staud.clothing'),
  shopify('kith', 'Kith', 'fashion', 'kith.com'),
  shopify('allbirds', 'Allbirds', 'fashion', 'allbirds.com'),
  shopify('rothys', "Rothy's", 'fashion', 'rothys.com'),
  shopify('tecovas', 'Tecovas', 'fashion', 'tecovas.com'),
  shopify('chubbies', 'Chubbies', 'fashion', 'chubbiesshorts.com'),
  shopify('untuckit', 'UNTUCKit', 'fashion', 'untuckit.com'),

  // Tech
  feed('best-buy', 'Best Buy', 'tech', 'bestbuy.com'),
  feed('micro-center', 'Micro Center', 'tech', 'microcenter.com', { match: /micro\s*center/i }),
  feed('newegg', 'Newegg', 'tech', 'newegg.com'),
  feed('bh-photo', 'B&H Photo', 'tech', 'bhphotovideo.com', { query: 'b&h photo', match: /b\s*&\s*h|bhphoto/i }),
  feed('adorama', 'Adorama', 'tech', 'adorama.com'),
  feed('gamestop', 'GameStop', 'tech', 'gamestop.com'),
  feed('apple', 'Apple', 'tech', 'apple.com', { match: /\bapple\b/i }),
  feed('samsung', 'Samsung', 'tech', 'samsung.com'),
  feed('dell', 'Dell', 'tech', 'dell.com', { match: /\bdell\b/i }),
  feed('hp', 'HP', 'tech', 'hp.com', { query: 'hp.com', match: /\bhp\b/i }),
  feed('lenovo', 'Lenovo', 'tech', 'lenovo.com'),
  feed('microsoft-store', 'Microsoft Store', 'tech', 'microsoft.com', { match: /microsoft\s*store|microsoft\.com/i }),
  { id: 'lovense', name: 'Lovense', category: 'tech', kind: 'lovense', domain: 'www.lovense.com' },
  shopify('keychron', 'Keychron', 'tech', 'keychron.com'),
  shopify('glorious', 'Glorious Gaming', 'tech', 'gloriousgaming.com'),
  shopify('turtle-beach', 'Turtle Beach', 'tech', 'turtlebeach.com'),
  shopify('secretlab', 'Secretlab', 'tech', 'secretlab.co'),
  shopify('skullcandy', 'Skullcandy', 'tech', 'skullcandy.com'),
  shopify('satechi', 'Satechi', 'tech', 'satechi.net'),
  shopify('twelve-south', 'Twelve South', 'tech', 'twelvesouth.com'),
  shopify('peak-design', 'Peak Design', 'tech', 'peakdesign.com'),
  shopify('wyze', 'Wyze', 'tech', 'wyze.com'),
  shopify('jackery', 'Jackery', 'tech', 'jackery.com'),
  shopify('ecoflow', 'EcoFlow', 'tech', 'us.ecoflow.com'),

  // Sell-everything retailers
  feed('amazon', 'Amazon', 'general', 'amazon.com'),
  feed('walmart', 'Walmart', 'general', 'walmart.com'),
  feed('target', 'Target', 'general', 'target.com', { match: /\btarget\b/i }),
  feed('costco', 'Costco', 'general', 'costco.com'),
  feed('woot', 'Woot', 'general', 'woot.com', { match: /\bwoot\b/i }),
];

export function publicStore({ id, name, category, kind, domain }) {
  return { id, name, category, kind, domain };
}
