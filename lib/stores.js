// Store catalog. `kind` decides where deals come from:
//   shopify  - the store's own product catalog (live prices)
//   tapestry - Kate Spade / Coach listing pages (live prices)
//   magento  - the store's Magento catalog (live prices)
//   lovense  - Lovense's own store page (live prices)
//   feed     - community-posted deals from Slickdeals, for retailers that don't expose a catalog

// Each store belongs to one category; the page shows every deal in the chosen category together.
export const CATEGORIES = [
  { id: 'bags', label: 'Bags' },
  { id: 'clothing', label: 'Clothing' },
  { id: 'shoes', label: 'Shoes' },
  { id: 'active', label: 'Activewear' },
  { id: 'alt', label: 'Alt & goth' },
  { id: 'jewelry', label: 'Jewelry' },
  { id: 'department', label: 'Department stores' },
  { id: 'electronics', label: 'Electronics' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'gadgets', label: 'Gadgets' },
  { id: 'general', label: 'Everything stores' },
];

const shopify = (id, name, category, domain) => ({ id, name, category, kind: 'shopify', domain });

const tapestry = (id, name, domain, paths) => ({ id, name, category: 'bags', kind: 'tapestry', domain, paths });

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
  // Bags, luggage and accessories
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
  feed('michael-kors', 'Michael Kors', 'bags', 'michaelkors.com'),
  feed('tory-burch', 'Tory Burch', 'bags', 'toryburch.com'),
  shopify('rebecca-minkoff', 'Rebecca Minkoff', 'bags', 'rebeccaminkoff.com'),
  shopify('dagne-dover', 'Dagne Dover', 'bags', 'dagnedover.com'),
  shopify('jw-pei', 'JW PEI', 'bags', 'jwpei.com'),
  shopify('cuyana', 'Cuyana', 'bags', 'cuyana.com'),
  shopify('beis', 'Béis', 'bags', 'beistravel.com'),
  shopify('away', 'Away', 'bags', 'awaytravel.com'),

  // Clothing
  { id: 'zumiez', name: 'Zumiez', category: 'clothing', kind: 'magento', domain: 'www.zumiez.com', saleCategory: 'Markdowns' },
  // Slickdeals files Old Navy under gap.com, so Old Navy is matched by name only.
  feed('gap', 'Gap', 'clothing', 'gap.com', { query: 'gap.com', match: /\bgap\b/i, exclude: /old\s*navy|banana\s*republic|athleta/i }),
  feed('old-navy', 'Old Navy', 'clothing', 'oldnavy.com'),
  feed('j-crew', 'J.Crew', 'clothing', 'jcrew.com', { query: 'j.crew', match: /j\.?\s*crew/i }),
  feed('levis', "Levi's", 'clothing', 'levi.com', { query: 'levis', match: /levi'?s/i }),
  feed('ralph-lauren', 'Ralph Lauren', 'clothing', 'ralphlauren.com'),
  feed('torrid', 'Torrid', 'clothing', 'torrid.com'),
  shopify('fashion-nova', 'Fashion Nova', 'clothing', 'fashionnova.com'),
  shopify('princess-polly', 'Princess Polly', 'clothing', 'us.princesspolly.com'),
  shopify('good-american', 'Good American', 'clothing', 'goodamerican.com'),
  shopify('staud', 'STAUD', 'clothing', 'staud.clothing'),
  shopify('kith', 'Kith', 'clothing', 'kith.com'),
  shopify('chubbies', 'Chubbies', 'clothing', 'chubbiesshorts.com'),
  shopify('untuckit', 'UNTUCKit', 'clothing', 'untuckit.com'),

  // Shoes
  shopify('steve-madden', 'Steve Madden', 'shoes', 'stevemadden.com'),
  shopify('allbirds', 'Allbirds', 'shoes', 'allbirds.com'),
  shopify('rothys', "Rothy's", 'shoes', 'rothys.com'),
  shopify('tecovas', 'Tecovas', 'shoes', 'tecovas.com'),
  feed('dr-martens', 'Dr. Martens', 'shoes', 'drmartens.com', { query: 'dr martens', match: /dr\.?\s*martens|doc\s*martens/i }),
  feed('vans', 'Vans', 'shoes', 'vans.com', { match: /\bvans\b/i }),
  feed('converse', 'Converse', 'shoes', 'converse.com'),

  // Activewear
  feed('nike', 'Nike', 'active', 'nike.com', { match: /\bnike\b/i }),
  feed('adidas', 'Adidas', 'active', 'adidas.com'),
  feed('lululemon', 'Lululemon', 'active', 'lululemon.com'),
  shopify('alo-yoga', 'Alo Yoga', 'active', 'aloyoga.com'),
  shopify('gymshark', 'Gymshark', 'active', 'gymshark.com'),

  // Alternative, goth and punk
  shopify('junkmans-daughter', "The Junkman's Daughter", 'alt', 'thejunkmansdaughter.com'),
  shopify('dolls-kill', 'Dolls Kill', 'alt', 'dollskill.com'),
  shopify('killstar', 'Killstar', 'alt', 'us.killstar.com'),
  shopify('disturbia', 'Disturbia', 'alt', 'disturbia.us'),
  shopify('blackcraft', 'Blackcraft Cult', 'alt', 'blackcraftcult.com'),
  shopify('foxblood', 'Foxblood', 'alt', 'foxblood.com'),
  shopify('tripp-nyc', 'Tripp NYC', 'alt', 'trippnyc.com'),
  shopify('demonia', 'Demonia', 'alt', 'demoniacult.com'),
  shopify('trash-and-vaudeville', 'Trash and Vaudeville', 'alt', 'trashandvaudeville.com'),
  shopify('vampirefreaks', 'VampireFreaks', 'alt', 'vampirefreaks.com'),
  shopify('rebels-market', 'Rebels Market', 'alt', 'rebelsmarket.com'),
  shopify('midnight-hour', 'Midnight Hour', 'alt', 'midnighthour.com'),
  shopify('the-pretty-cult', 'The Pretty Cult', 'alt', 'theprettycult.com'),
  shopify('la-femme-en-noir', 'La Femme En Noir', 'alt', 'lafemmeennoir.net'),
  shopify('punk-design', 'Punk Design', 'alt', 'punkdesign.shop'),
  shopify('strange-cvlt', 'Strange Cvlt', 'alt', 'strangecvlt.com'),
  shopify('minga-london', 'Minga London', 'alt', 'us.mingalondon.com'),
  shopify('goodbye-bread', 'Goodbye Bread', 'alt', 'goodbyebread.com'),
  shopify('aelfric-eden', 'Aelfric Eden', 'alt', 'aelfriceden.com'),
  shopify('sourpuss', 'Sourpuss', 'alt', 'sourpussclothing.com'),
  shopify('kreepsville', 'Kreepsville 666', 'alt', 'kreepsville666.com'),
  shopify('rockabilia', 'Rockabilia', 'alt', 'rockabilia.com'),
  shopify('unique-vintage', 'Unique Vintage', 'alt', 'unique-vintage.com'),
  shopify('iheartraves', 'iHeartRaves', 'alt', 'iheartraves.com'),
  shopify('inked-shop', 'Inked Shop', 'alt', 'inkedshop.com'),
  shopify('sullen', 'Sullen', 'alt', 'sullenclothing.com'),
  feed('hot-topic', 'Hot Topic', 'alt', 'hottopic.com'),
  feed('spencers', "Spencer's", 'alt', 'spencersonline.com', { query: 'spencers', match: /spencer'?s/i, exclude: /marks\s*(&|and)\s*spencer/i }),

  // Jewelry and watches
  feed('pandora', 'Pandora', 'jewelry', 'pandora.net', { query: 'pandora jewelry', exclude: /avatar|frontiers|borderlands/i }),
  feed('swarovski', 'Swarovski', 'jewelry', 'swarovski.com'),
  feed('kendra-scott', 'Kendra Scott', 'jewelry', 'kendrascott.com'),
  shopify('trollbeads', 'Trollbeads', 'jewelry', 'trollbeads.com'),
  shopify('brighton', 'Brighton', 'jewelry', 'brighton.com'),
  shopify('alex-and-ani', 'Alex and Ani', 'jewelry', 'alexandani.com'),
  shopify('stella-and-dot', 'Stella & Dot', 'jewelry', 'stelladot.com'),
  shopify('lovisa', 'Lovisa', 'jewelry', 'lovisa.com'),
  shopify('ross-simons', 'Ross-Simons', 'jewelry', 'ross-simons.com'),
  shopify('john-hardy', 'John Hardy', 'jewelry', 'johnhardy.com'),
  shopify('missoma', 'Missoma', 'jewelry', 'us.missoma.com'),
  shopify('baublebar', 'BaubleBar', 'jewelry', 'baublebar.com'),
  shopify('gorjana', 'gorjana', 'jewelry', 'gorjana.com'),
  shopify('pura-vida', 'Pura Vida', 'jewelry', 'puravidabracelets.com'),
  shopify('mvmt', 'MVMT', 'jewelry', 'mvmt.com'),
  shopify('jenny-bird', 'Jenny Bird', 'jewelry', 'jenny-bird.com'),
  shopify('made-by-mary', 'Made By Mary', 'jewelry', 'madebymary.com'),
  shopify('awe-inspired', 'Awe Inspired', 'jewelry', 'aweinspired.com'),
  shopify('mint-and-lily', 'Mint & Lily', 'jewelry', 'mintandlily.com'),
  shopify('caitlyn-minimalist', 'Caitlyn Minimalist', 'jewelry', 'caitlynminimalist.com'),
  shopify('maison-miru', 'Maison Miru', 'jewelry', 'maisonmiru.com'),
  shopify('studs', 'Studs', 'jewelry', 'studs.com'),
  shopify('aurate', 'Aurate', 'jewelry', 'auratenewyork.com'),
  shopify('luv-aj', 'Luv Aj', 'jewelry', 'luvaj.com'),
  shopify('adina-eden', 'Adina Eden', 'jewelry', 'adinaeden.com'),
  shopify('uncommon-james', 'Uncommon James', 'jewelry', 'uncommonjames.com'),
  shopify('bryan-anthonys', 'Bryan Anthonys', 'jewelry', 'bryananthonys.com'),
  shopify('little-words-project', 'Little Words Project', 'jewelry', 'littlewordsproject.com'),
  shopify('lokai', 'Lokai', 'jewelry', 'lokai.com'),
  shopify('enewton', 'enewton', 'jewelry', 'enewtondesign.com'),
  shopify('sterling-forever', 'Sterling Forever', 'jewelry', 'sterlingforever.com'),
  shopify('ettika', 'Ettika', 'jewelry', 'ettika.com'),
  shopify('evry-jewels', 'Evry Jewels', 'jewelry', 'evryjewels.com'),
  shopify('gldn', 'GLDN', 'jewelry', 'gldn.com'),
  shopify('james-michelle', 'James Michelle', 'jewelry', 'jamesmichelle.com'),
  shopify('atolea', 'Atolea', 'jewelry', 'atoleajewelry.com'),
  shopify('brook-and-york', 'Brook & York', 'jewelry', 'brookandyork.com'),
  // Darker, alternative-style jewelry
  shopify('blood-milk', 'Blood Milk', 'jewelry', 'bloodmilkjewels.com'),
  shopify('ask-and-embla', 'Ask and Embla', 'jewelry', 'askandembla.com'),
  shopify('personal-fears', 'Personal Fears', 'jewelry', 'personalfears.com'),
  shopify('pyrrha', 'Pyrrha', 'jewelry', 'pyrrha.com'),
  shopify('child-of-wild', 'Child of Wild', 'jewelry', 'childofwild.com'),
  shopify('vitaly', 'Vitaly', 'jewelry', 'vitalydesign.com'),
  shopify('clocks-and-colours', 'Clocks and Colours', 'jewelry', 'clocksandcolours.com'),

  // Department stores
  feed('nordstrom', 'Nordstrom', 'department', 'nordstrom.com', { exclude: /nordstrom\s*rack/i }),
  feed('nordstrom-rack', 'Nordstrom Rack', 'department', 'nordstromrack.com'),
  feed('macys', "Macy's", 'department', 'macys.com', { query: 'macys', match: /macy'?s/i }),

  // Computers and electronics
  feed('best-buy', 'Best Buy', 'electronics', 'bestbuy.com'),
  feed('micro-center', 'Micro Center', 'electronics', 'microcenter.com', { match: /micro\s*center/i }),
  feed('newegg', 'Newegg', 'electronics', 'newegg.com'),
  feed('bh-photo', 'B&H Photo', 'electronics', 'bhphotovideo.com', { query: 'b&h photo', match: /b\s*&\s*h|bhphoto/i }),
  feed('adorama', 'Adorama', 'electronics', 'adorama.com'),
  feed('apple', 'Apple', 'electronics', 'apple.com', { match: /\bapple\b/i }),
  feed('samsung', 'Samsung', 'electronics', 'samsung.com'),
  feed('dell', 'Dell', 'electronics', 'dell.com', { match: /\bdell\b/i }),
  feed('hp', 'HP', 'electronics', 'hp.com', { query: 'hp.com', match: /\bhp\b/i }),
  feed('lenovo', 'Lenovo', 'electronics', 'lenovo.com'),
  feed('microsoft-store', 'Microsoft Store', 'electronics', 'microsoft.com', { match: /microsoft\s*store|microsoft\.com/i }),

  // Gaming
  feed('gamestop', 'GameStop', 'gaming', 'gamestop.com'),
  shopify('keychron', 'Keychron', 'gaming', 'keychron.com'),
  shopify('glorious', 'Glorious Gaming', 'gaming', 'gloriousgaming.com'),
  shopify('turtle-beach', 'Turtle Beach', 'gaming', 'turtlebeach.com'),
  shopify('secretlab', 'Secretlab', 'gaming', 'secretlab.co'),

  // Gadgets and accessories
  { id: 'lovense', name: 'Lovense', category: 'gadgets', kind: 'lovense', domain: 'www.lovense.com' },
  shopify('skullcandy', 'Skullcandy', 'gadgets', 'skullcandy.com'),
  shopify('satechi', 'Satechi', 'gadgets', 'satechi.net'),
  shopify('twelve-south', 'Twelve South', 'gadgets', 'twelvesouth.com'),
  shopify('peak-design', 'Peak Design', 'gadgets', 'peakdesign.com'),
  shopify('wyze', 'Wyze', 'gadgets', 'wyze.com'),
  shopify('jackery', 'Jackery', 'gadgets', 'jackery.com'),
  shopify('ecoflow', 'EcoFlow', 'gadgets', 'us.ecoflow.com'),

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
