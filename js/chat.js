/* Bin Bros Assistant: answers from Bin Bros' published info only.
   Anything it can't answer is handed to a real Bro by phone or email. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const BOOK = 'http://binbrosva.jobatory.com/home';
const PORTAL = 'https://binbrosva.jobatory.com/auth/login';
const GIFT = 'http://binbrosva.jobatory.com/gift-card';
const PHONE = '<a href="tel:+17572408445">(757) 240-8445</a>';
const EMAIL = '<a href="mailto:BinBrosSupport@gmail.com">BinBrosSupport@gmail.com</a>';
const ZIPS = { 23693: 'Yorktown', 23692: 'Yorktown', 23690: 'Yorktown', 23696: 'Seaford', 23662: 'Poquoson', 23185: 'Williamsburg', 23666: 'Hampton', 23608: 'Newport News' };
const TOWNS = ['yorktown', 'poquoson', 'seaford', 'newport news', 'hampton', 'williamsburg', 'york county'];
const PLANS = [['Monthly', 25], ['Bi-Monthly', 35], ['Quarterly', 50], ['On-Demand', 70]];

const chat = $('#chat'), log = $('#chatLog'), quick = $('#chatQuick'), form = $('#chatForm'), input = $('#chatText');
const fab = $('#chatFab'), openers = $$('[data-open-chat]');
const touch = matchMedia('(pointer: coarse)').matches;
let open = false, greeted = false, closeTimer;

const QR = {
  start: ['Prices', 'Do you serve my area?', 'How it works', 'Book a clean', 'Talk to a person'],
  afterPrice: ['Extra bins?', 'Price calculator', 'Book a clean', 'Do you serve my area?'],
  afterArea: ['Prices', 'How it works', 'Book a clean'],
  general: ['Prices', 'Service area', 'How it works', 'Talk to a person'],
};

/* ---------- answers ---------- */
function priceList() {
  return `Flat pricing, 2 bins included in every plan:<ul>${PLANS.map(([n, p]) => `<li><span>${n}</span><b>$${p}</b></li>`).join('')}</ul>Each extra bin is $10.`;
}
function reply(raw) {
  const t = raw.toLowerCase().trim();
  const zip = t.match(/\b(\d{5})\b/);
  if (zip) {
    const z = zip[1];
    return ZIPS[z]
      ? { html: `Yes! ${z} (${ZIPS[z]}) is in our service area. <a href="${BOOK}" target="_blank" rel="noopener">Schedule your first clean →</a>`, qr: QR.afterArea }
      : { html: `${z} isn't on our ZIP list yet, but we may still reach your street. Give us a call at ${PHONE} to check.`, qr: QR.general };
  }
  const town = TOWNS.find((n) => t.includes(n));
  if (town && !/price|cost/.test(t)) {
    const name = town.replace(/\b\w/g, (c) => c.toUpperCase());
    return { html: `Yes, ${name} is in our service area. Want to double-check your street? Send me your 5-digit ZIP code.`, qr: QR.afterArea };
  }
  const has = (re) => re.test(t);
  if (has(/^(hi|hey|hello|yo|hiya|howdy|good (morning|afternoon|evening)|salam|assalam)/)) return { html: 'Hey there! What can I help you with? Prices, service area, booking, anything about your bins.', qr: QR.start };
  if (has(/thank|thx|appreciate|awesome|great|perfect/)) return { html: `Anytime! If you need a real Bro, call ${PHONE}.`, qr: QR.general };
  if (has(/gift/)) return { html: `Gift cards are available here: <a href="${GIFT}" target="_blank" rel="noopener">buy a gift card</a>. A clean bin makes a surprisingly good present.`, qr: QR.general };
  if (has(/portal|account|log ?in|cancel|reschedul|pause|manage|billing|invoice|pay|card on file|skip/)) return { html: `You can manage your service in the <a href="${PORTAL}" target="_blank" rel="noopener">customer portal</a>. For anything else, call ${PHONE} or email ${EMAIL}.`, qr: QR.general };
  if (has(/calculator|calculate|estimate|quote/)) {
    setTimeout(() => { const c = document.getElementById('calc'); if (c) { closeChat(); c.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }, 900);
    return { html: 'Taking you to the price calculator now: pick a plan and how many bins you roll out.', qr: QR.afterPrice };
  }
  if (has(/extra|additional|more than (2|two)|[3-9] bins|three|four|five|another bin|more bins/)) return { html: 'Every plan includes 2 bins. Each additional bin is just $10 per clean. So 3 bins on the Monthly plan is $35.', qr: QR.afterPrice };
  if (has(/recycl/)) return { html: 'Yes, we clean both trash and recycling bins, inside and out.', qr: QR.afterPrice };
  if (has(/price|cost|how much|pricing|plans?\b|rate|\$|cheap|charge|fee|expensive|monthly|quarterly|on.?demand|bi.?monthly/)) return { html: priceList(), qr: QR.afterPrice };
  if (has(/commercial|business|dumpster|restaurant|hoa|apartment|office/)) return { html: `Our listed service is residential trash bin cleaning. For anything beyond that, call ${PHONE} and ask the Bros directly.`, qr: QR.general };
  if (has(/book|schedul|sign ?up|start|subscribe|appointment|get started|order/)) return { html: `Easy. <a href="${BOOK}" target="_blank" rel="noopener">Schedule service here</a>, pick your plan, and leave your bins at the curb on your scheduled day.`, qr: QR.afterArea };
  if (has(/how.*work|process|steps?|what do you do|what happens|how do you clean/)) return { html: '<b>1. Leave bins out</b>: roll them to the curb on your scheduled day.<br><b>2. Deep clean</b>: hot, high-pressure water and eco-friendly cleaners, inside and out.<br><b>3. Deodorize &amp; return</b>: sanitized, deodorized, and set back where you left them.', qr: QR.afterArea };
  if (has(/when|what day|which day|time|trash day|pickup|how often|frequency/)) return { html: `You get a scheduled service day when you sign up. Just have the bins at the curb that day. For specific timing on your street, call ${PHONE}.`, qr: QR.general };
  if (has(/eco|chemical|safe|green|environment|product|soap|bleach|pets?|kids?|smell|odor|stink/)) return { html: 'We clean with eco-friendly products, then sanitize and deodorize every bin, so it comes back fresh.', qr: QR.general };
  if (has(/hot|pressure|water|temperature|steam/)) return { html: 'Hot, high-pressure water does the heavy lifting. It gets the stuck-on residue at the bottom of the can that a garden hose never reaches.', qr: QR.general };
  if (has(/back|return|put.*away|move|drag|driveway/)) return { html: "Yes, we put your bins back exactly where we found them. You don't lift a finger.", qr: QR.general };
  if (has(/area|serve|zip|where|location|town|city|cover|near|region/)) return { html: 'We serve Yorktown, Poquoson, Seaford, Newport News, Hampton, Williamsburg and the greater York County area. Send me your ZIP code and I\'ll check it.', qr: ['23692', '23662', '23185', 'Prices'] };
  if (has(/veteran|family|owner|who are you|about|local|company/)) return { html: 'Bin Bros is veteran and family owned, locally operated on the Virginia Peninsula. Our promise: show up on schedule, do honest work, and leave your bins cleaner than we found them.', qr: QR.general };
  if (has(/call|phone|email|contact|human|person|talk|speak|text|number|real/)) return { html: `Talk to a real Bro at ${PHONE} or email ${EMAIL}.`, qr: QR.start };
  if (has(/bot|ai|robot|are you real/)) return { html: `I'm the Bin Bros assistant, an automated helper. For a real person, call ${PHONE}.`, qr: QR.general };
  return { html: `Good question. I don't want to guess on that one, so the Bros can answer it directly: ${PHONE} or ${EMAIL}.`, qr: QR.start };
}

/* ---------- rendering ---------- */
function scrollDown() { log.scrollTo({ top: log.scrollHeight, behavior: 'smooth' }); }
function add(html, who) {
  const m = document.createElement('div');
  m.className = 'msg ' + who;
  if (who === 'me') m.textContent = html; else m.innerHTML = html;
  log.appendChild(m); scrollDown();
  return m;
}
function setQuick(list) {
  quick.innerHTML = '';
  list.forEach((label) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = label;
    b.addEventListener('click', () => send(label));
    quick.appendChild(b);
  });
}
function botSay(r) {
  const typing = add('<i></i><i></i><i></i>', 'bot typing');
  const delay = 420 + Math.min(900, r.html.length * 4);
  setTimeout(() => { typing.remove(); add(r.html, 'bot'); setQuick(r.qr || QR.general); }, delay);
}
function send(text) {
  const v = (text || '').trim();
  if (!v) return;
  add(v, 'me');
  setQuick([]);
  botSay(reply(v));
}
form.addEventListener('submit', (e) => { e.preventDefault(); send(input.value); input.value = ''; });

/* ---------- open / close ---------- */
function setExpanded(v) {
  fab.setAttribute('aria-expanded', String(v));
  fab.setAttribute('aria-label', v ? 'Close chat' : 'Open chat');
  openers.forEach((o) => o.hasAttribute('aria-label') && o.closest('.mbar') && o.setAttribute('aria-expanded', String(v)));
}
function openChat() {
  if (open) return;
  if (window.__closeMenu) window.__closeMenu();
  clearTimeout(closeTimer);
  open = true; chat.hidden = false; fab.classList.add('seen');
  requestAnimationFrame(() => requestAnimationFrame(() => chat.classList.add('open')));
  setExpanded(true);
  if (!greeted) {
    greeted = true;
    add("Hey! I'm the Bin Bros assistant. Ask me about prices, whether we serve your street, or how a clean works.", 'bot');
    setQuick(QR.start);
  }
  if (!touch) setTimeout(() => input.focus({ preventScroll: true }), 250);
}
function closeChat() {
  if (!open) return;
  open = false; chat.classList.remove('open'); setExpanded(false);
  closeTimer = setTimeout(() => { if (!open) chat.hidden = true; }, 420);
  chat.style.removeProperty('bottom'); chat.style.removeProperty('height');
}
fab.addEventListener('click', () => (open ? closeChat() : openChat()));
openers.forEach((o) => o.addEventListener('click', () => (open && o.closest('.mbar') ? closeChat() : openChat())));
$('.chat-x').addEventListener('click', closeChat);
addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) closeChat(); });
document.addEventListener('pointerdown', (e) => {
  if (!open) return;
  if (chat.contains(e.target) || fab.contains(e.target) || e.target.closest('[data-open-chat]')) return;
  closeChat();
});

// Keep the panel above the on-screen keyboard on phones
if (window.visualViewport) {
  const vv = window.visualViewport;
  const adjust = () => {
    if (!open || innerWidth > 760) return;
    const kb = Math.max(0, innerHeight - vv.height - vv.offsetTop);
    if (kb > 80) { chat.style.bottom = kb + 10 + 'px'; chat.style.height = Math.min(520, vv.height - 24) + 'px'; }
    else { chat.style.removeProperty('bottom'); chat.style.removeProperty('height'); }
  };
  vv.addEventListener('resize', adjust); vv.addEventListener('scroll', adjust);
}
