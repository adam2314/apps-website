/* Languages: English and Hebrew for kids (full niqqud, gender-neutral plural instructions). */
import { TOOLS, toolStats, RANKS, CUSTOMER_NAMES } from './data.js';

export const LANGS = { he: 'עִבְרִית', en: 'English' };
let lang = 'he';

export function setLang(l) {
  lang = LANGS[l] ? l : 'he';
  const html = document.documentElement;
  html.lang = lang;
  html.dir = lang === 'he' ? 'rtl' : 'ltr';
}
export const getLang = () => lang;
export const isRTL = () => lang === 'he';

/* ---------------------------------------------------------------- UI strings */
const UI = {
  en: {
    'doc.title': 'Shine Time · 3D Car Wash Sim',
    'loading': 'Filling the buckets…',
    'brand': 'Shine Time',
    'canvas.aria': 'Car wash bay. Drag on the car to wash it, drag elsewhere to look around.',
    'hud.day': 'Day {n}',
    'hud.rep': 'Reputation (average of recent ratings)',
    'hud.goalTitle': 'Daily revenue goal',
    'hud.goal': 'Goal',
    'btn.shop': 'Upgrades (B)', 'btn.shopAria': 'Upgrades',
    'btn.sound': 'Sound (M)', 'btn.soundAria': 'Toggle sound',
    'btn.full': 'Fullscreen',
    'btn.pause': 'Pause (Esc)', 'btn.pauseAria': 'Pause',
    'aria.queue': 'Customers waiting in line',
    'aria.tools': 'Wash tools',
    'side.hint': 'More to do on the other side. Drag the background to turn.',
    'cam.left': 'Rotate left (Q)', 'cam.top': 'Top view (Space)', 'cam.right': 'Rotate right (E)',
    'title.h1': 'Shine Time',
    'title.sub': '3D Car Wash Simulator',
    'title.continue': 'Continue',
    'title.continueDay': 'Continue · Day {n}',
    'title.new': 'New Game',
    'howto': 'How to play',
    'set.sound': 'Sound', 'set.vibrate': 'Vibration', 'set.graphics': 'Graphics', 'set.language': 'Language',
    'q.auto': 'Auto', 'q.high': 'High', 'q.medium': 'Medium', 'q.low': 'Low',
    'title.install': 'Install offline copy',
    'off.title': 'Play without internet',
    'off.app': 'Install as app',
    'off.ios': 'On iPhone or iPad: tap Share, then “Add to Home Screen”.',
    'off.phoneHttp': 'Phones and tablets can only install the app from a secure (https) address.',
    'off.siteBtn': 'Install from the website',
    'off.site': 'Open the game’s website and tap Install there. Your progress comes along.',
    'off.siteIos': 'Open the game’s website in Safari, tap Share, then “Add to Home Screen”. Your progress comes along.',
    'off.menu': 'To install it as an app, open the browser menu and choose “Install” or “Add to Home Screen”.',
    'off.http': 'Apps can’t be installed from this address, but you can download the whole game as one file.',
    'off.download': 'Download offline copy',
    'off.note': 'Saves one file. Open it to play any time, even without internet or the server. Your progress comes along.',
    'off.working': 'Preparing the file…',
    'off.done': 'Saved! Look for {file} in your downloads.',
    'off.fail': 'Couldn’t make the file. Please try again.',
    'off.installed': 'Installed! Find Shine Time with your other apps.',
    'title.fine': 'Mouse, touch and keyboard · Desktop, tablet and phone',
    'close': 'Close',
    'shop.title': 'Upgrades',
    'shop.maxed': 'Maxed',
    'shop.needs': 'Needs {x}',
    'sum.title': 'Day {n} complete',
    'sum.next': 'Start Day {n}',
    'sum.avg': '{n} average rating',
    'sum.none': 'No cars washed today',
    'sum.washed': 'Cars washed', 'sum.lost': 'Customers who left', 'sum.missed': 'Drove past (line full)',
    'sum.revenue': 'Service revenue', 'sum.tips': 'Tips', 'sum.snacks': 'Snack sales',
    'sum.goal': 'Daily goal ({m})', 'sum.bonus': '+{m} bonus', 'sum.missedGoal': 'missed',
    'sum.supplies': 'Water & soap', 'sum.net': 'Net profit',
    'sum.rank': 'Business rank', 'sum.toNext': '{m} lifetime earnings to <b>{rank}</b>', 'sum.top': 'Top rank reached!',
    'pause.title': 'Paused', 'pause.resume': 'Resume', 'pause.full': 'Toggle fullscreen',
    'pause.gfxNote': 'Graphics changes apply after a reload.',
    'pause.quit': 'Quit to title (today restarts)',
    'howto.1': '<b>Wash in order.</b> Each customer orders a service. Follow the steps shown at the top: pre-rinse, foam, scrub, rinse, dry, and later tire shine and wax.',
    'howto.2': '<b>Drag on the car</b> to use your tool. Sprays work while you hold. Sponges, towels and the polisher need you to rub back and forth.',
    'howto.3': '<b>Drag the background</b> (or use two fingers, the right mouse button, or Q/E) to walk around the car. Every side counts. Pinch or scroll to zoom.',
    'howto.4': '<b>Be quick.</b> Waiting customers lose patience. Happy customers tip more, and your reputation brings in more cars.',
    'howto.5': '<b>Upgrade</b> between cars or after each day: better gear, new services, a Scrub Bot helper, and comforts for your customers.',
    'howto.keys': '<kbd>1</kbd>–<kbd>6</kbd> tools · <kbd>Q</kbd>/<kbd>E</kbd> rotate · <kbd>W</kbd>/<kbd>S</kbd> tilt · <kbd>Space</kbd> top view · <kbd>B</kbd> shop · <kbd>Esc</kbd> pause · <kbd>M</kbd> sound',
    'tut.title': 'Welcome to Shine Time!',
    'tut.p': "You've just opened a one-bay car wash. Customers line up outside the entrance.",
    'tut.1': '<b>Drag on the car</b> with the highlighted tool to clean it.',
    'tut.2': '<b>Drag the background</b> to turn the camera and reach the other side.',
    'tut.3': 'Glowing rings show spots you missed.',
    'tut.ok': "Let's wash!",
    'toast.dayOpen': 'Day {n}: doors open!',
    'toast.stepDone': '{step} done!',
    'toast.upgraded': '{name} upgraded!',
    'toast.lineFull': 'A customer drove past: the line was full!',
    'toast.left': '{name} got tired of waiting and left.',
    'toast.closing': '6 PM: closing time! Finish the cars in line.',
    'toast.wrongTool': 'Use the {tool} for {step} (key {n})',
    'confirm.new': 'Start over? Your current car wash will be lost.',
    'q.waiting': '{n} waiting', 'q.full': 'Line full!',
    'job.closing': 'Closing up…', 'job.free': 'Bay is free. Next car coming up.',
    'badge.vip': 'VIP', 'badge.mud': 'MUDDY',
    'pay.service': '{m} service', 'pay.tip': '{m} tip', 'pay.snacks': '{m} snacks',
    'pay.streak': '🔥 {n} five-star streak · tips ×{m}',
    'ban.closing': 'Closing time', 'ban.waiting': 'Waiting for customers',
    'ban.next': 'Next car pulling in…', 'ban.ads': 'Buy Advertising to bring in more cars',
    'ban.enter': '{name} is pulling in', 'ban.step': 'Step {i}/{n}',
    'ban.clean': 'Sparkling clean!', 'ban.nextCust': 'Next customer, please',
    'up.level': 'Level {n}: wider and faster',
  },

  he: {
    'doc.title': 'שְׁטִיפָה נוֹצֶצֶת',
    'loading': 'מְמַלְּאִים אֶת הַדְּלָיִים…',
    'brand': 'שְׁטִיפָה נוֹצֶצֶת',
    'canvas.aria': 'תָּא שְׁטִיפָה. גִּרְרוּ עַל הַמְּכוֹנִית כְּדֵי לִשְׁטֹף אוֹתָהּ, וְעַל הָרֶקַע כְּדֵי לְהִסְתּוֹבֵב.',
    'hud.day': 'יוֹם {n}',
    'hud.rep': 'כַּמָּה הַלָּקוֹחוֹת מְרֻצִּים',
    'hud.goalTitle': 'כַּמָּה כֶּסֶף צָרִיךְ לְהַרְוִיחַ הַיּוֹם',
    'hud.goal': 'יַעַד',
    'btn.shop': 'חֲנוּת (B)', 'btn.shopAria': 'חֲנוּת',
    'btn.sound': 'צְלִיל (M)', 'btn.soundAria': 'צְלִיל',
    'btn.full': 'מָסָךְ מָלֵא',
    'btn.pause': 'הַפְסָקָה (Esc)', 'btn.pauseAria': 'הַפְסָקָה',
    'aria.queue': 'לָקוֹחוֹת בַּתּוֹר',
    'aria.tools': 'כְּלֵי שְׁטִיפָה',
    'side.hint': 'יֵשׁ עוֹד מָה לִשְׁטֹף בַּצַּד הַשֵּׁנִי. גִּרְרוּ אֶת הָרֶקַע כְּדֵי לְהִסְתּוֹבֵב.',
    'cam.left': 'סִבּוּב שְׂמֹאלָה (Q)', 'cam.top': 'מַבָּט מִלְמַעְלָה (Space)', 'cam.right': 'סִבּוּב יָמִינָה (E)',
    'title.h1': 'שְׁטִיפָה נוֹצֶצֶת',
    'title.sub': 'מִשְׂחַק שְׁטִיפַת מְכוֹנִיּוֹת',
    'title.continue': 'מַמְשִׁיכִים',
    'title.continueDay': 'מַמְשִׁיכִים · יוֹם {n}',
    'title.new': 'מִשְׂחָק חָדָשׁ',
    'howto': 'אֵיךְ מְשַׂחֲקִים?',
    'set.sound': 'צְלִיל', 'set.vibrate': 'רֶטֶט', 'set.graphics': 'גְּרָפִיקָה', 'set.language': 'שָׂפָה',
    'q.auto': 'אוֹטוֹמָטִי', 'q.high': 'גָּבוֹהַּ', 'q.medium': 'בֵּינוֹנִי', 'q.low': 'נָמוּךְ',
    'title.install': 'לְהַתְקִין וּלְשַׂחֵק בְּלִי אִינְטֶרְנֶט',
    'off.title': 'מְשַׂחֲקִים בְּלִי אִינְטֶרְנֶט',
    'off.app': 'הַתְקָנָה כְּאַפְּלִיקַצְיָה',
    'off.ios': 'בְּאַייפוֹן אוֹ בְּאַייפֶּד: לוֹחֲצִים עַל "שִׁתּוּף" וּבוֹחֲרִים "הוֹסָפָה לְמָסַךְ הַבַּיִת".',
    'off.phoneHttp': 'בַּטֶּלֶפוֹן וּבַטַּאבְּלֶט אֶפְשָׁר לְהַתְקִין רַק מִכְּתֹבֶת מְאֻבְטַחַת (https).',
    'off.siteBtn': 'הַתְקָנָה מֵהָאֲתָר',
    'off.site': 'פּוֹתְחִים אֶת הָאֲתָר שֶׁל הַמִּשְׂחָק וְלוֹחֲצִים שָׁם "הַתְקָנָה". הַהִתְקַדְּמוּת שֶׁלָּכֶם עוֹבֶרֶת אִתְּכֶם.',
    'off.siteIos': 'פּוֹתְחִים אֶת הָאֲתָר שֶׁל הַמִּשְׂחָק בְּסָפָארִי, לוֹחֲצִים עַל "שִׁתּוּף" וּבוֹחֲרִים "הוֹסָפָה לְמָסַךְ הַבַּיִת". הַהִתְקַדְּמוּת שֶׁלָּכֶם עוֹבֶרֶת אִתְּכֶם.',
    'off.menu': 'כְּדֵי לְהַתְקִין כְּאַפְּלִיקַצְיָה: פּוֹתְחִים אֶת הַתַּפְרִיט שֶׁל הַדַּפְדְּפָן וּבוֹחֲרִים "הַתְקָנָה" אוֹ "הוֹסָפָה לְמָסַךְ הַבַּיִת".',
    'off.http': 'מֵהַכְּתֹבֶת הַזֹּאת אִי אֶפְשָׁר לְהַתְקִין אַפְּלִיקַצְיָה, אֲבָל אֶפְשָׁר לְהוֹרִיד אֶת כָּל הַמִּשְׂחָק לְקֹבֶץ אֶחָד.',
    'off.download': 'לְהוֹרִיד אֶת הַמִּשְׂחָק',
    'off.note': 'נִשְׁמָר קֹבֶץ אֶחָד. פּוֹתְחִים אוֹתוֹ וּמְשַׂחֲקִים מָתַי שֶׁרוֹצִים, גַּם בְּלִי אִינְטֶרְנֶט. הַכֶּסֶף וְהַשְּׁדְרוּגִים שֶׁלָּכֶם עוֹבְרִים אִתְּכֶם.',
    'off.working': 'מְכִינִים אֶת הַקֹּבֶץ…',
    'off.done': 'הַקֹּבֶץ נִשְׁמַר! מְחַפְּשִׂים אֶת {file} בַּהוֹרָדוֹת.',
    'off.fail': 'לֹא הִצְלַחְנוּ לְהָכִין אֶת הַקֹּבֶץ. נַסּוּ שׁוּב.',
    'off.installed': 'הַמִּשְׂחָק הֻתְקַן! מְחַפְּשִׂים אוֹתוֹ בֵּין הָאַפְּלִיקַצְיוֹת.',
    'title.fine': 'עַכְבָּר, מַגָּע אוֹ מִקְלֶדֶת · מַחְשֵׁב, טַאבְּלֶט אוֹ טֶלֶפוֹן',
    'close': 'סְגִירָה',
    'shop.title': 'חֲנוּת',
    'shop.maxed': 'הֲכִי טוֹב!',
    'shop.needs': 'צָרִיךְ קֹדֶם: {x}',
    'sum.title': 'יוֹם {n} נִגְמַר!',
    'sum.next': 'מַתְחִילִים יוֹם {n}',
    'sum.avg': 'דֵּרוּג מְמֻצָּע: {n}',
    'sum.none': 'הַיּוֹם לֹא נִשְׁטְפוּ מְכוֹנִיּוֹת',
    'sum.washed': 'מְכוֹנִיּוֹת שֶׁנִּשְׁטְפוּ', 'sum.lost': 'לָקוֹחוֹת שֶׁהָלְכוּ', 'sum.missed': 'נָסְעוּ הָלְאָה (תּוֹר מָלֵא)',
    'sum.revenue': 'כֶּסֶף מִשְּׁטִיפוֹת', 'sum.tips': 'טִיפִּים', 'sum.snacks': 'מְכִירַת חֲטִיפִים',
    'sum.goal': 'יַעַד יוֹמִי ({m})', 'sum.bonus': 'בּוֹנוּס {m}', 'sum.missedGoal': 'לֹא הִגַּעְנוּ',
    'sum.supplies': 'מַיִם וְסַבּוֹן', 'sum.net': 'רֶוַח',
    'sum.rank': 'הַדַּרְגָּה שֶׁלָּכֶם', 'sum.toNext': 'עוֹד {m} עַד <b>{rank}</b>', 'sum.top': 'הִגַּעְתֶּם לַדַּרְגָּה הֲכִי גְּבוֹהָה!',
    'pause.title': 'הַפְסָקָה', 'pause.resume': 'מַמְשִׁיכִים לְשַׂחֵק', 'pause.full': 'מָסָךְ מָלֵא',
    'pause.gfxNote': 'שִׁנּוּי הַגְּרָפִיקָה יַעֲבֹד בַּפַּעַם הַבָּאָה.',
    'pause.quit': 'יְצִיאָה לַתַּפְרִיט (הַיּוֹם יַתְחִיל מֵחָדָשׁ)',
    'howto.1': '<b>שׁוֹטְפִים לְפִי הַסֵּדֶר.</b> כָּל לָקוֹחַ בּוֹחֵר שְׁטִיפָה. עִשׂוּ אֶת הַשְּׁלַבִּים שֶׁלְּמַעְלָה: מַיִם, קֶצֶף, קִרְצוּף, שְׁטִיפָה וְיִבּוּשׁ.',
    'howto.2': '<b>גִּרְרוּ עַל הַמְּכוֹנִית</b> כְּדֵי לְהִשְׁתַּמֵּשׁ בַּכְּלִי. מַיִם וְקֶצֶף יוֹצְאִים כְּשֶׁמַּחֲזִיקִים. אֶת הַסְּפוֹג וְהַמַּגֶּבֶת צָרִיךְ לְהָזִיז הֲלוֹךְ וָשׁוֹב.',
    'howto.3': '<b>גִּרְרוּ אֶת הָרֶקַע</b> כְּדֵי לְהִסְתּוֹבֵב סְבִיב הַמְּכוֹנִית. צָרִיךְ לִשְׁטֹף מִכָּל הַצְּדָדִים!',
    'howto.4': '<b>מַהֵר, מַהֵר!</b> לָקוֹחוֹת שֶׁמְּחַכִּים הַרְבֵּה מְאַבְּדִים סַבְלָנוּת. לָקוֹחוֹת שְׂמֵחִים נוֹתְנִים טִיפִּים וּמְבִיאִים חֲבֵרִים.',
    'howto.5': '<b>קְנוּ שִׁדְרוּגִים</b> בַּחֲנוּת: כֵּלִים טוֹבִים יוֹתֵר, שְׁטִיפוֹת חֲדָשׁוֹת וְרוֹבּוֹט עוֹזֵר.',
    'howto.keys': '<kbd>1</kbd>–<kbd>6</kbd> כֵּלִים · <kbd>Q</kbd>/<kbd>E</kbd> סִבּוּב · <kbd>Space</kbd> מִלְמַעְלָה · <kbd>B</kbd> חֲנוּת · <kbd>Esc</kbd> הַפְסָקָה · <kbd>M</kbd> צְלִיל',
    'tut.title': 'בְּרוּכִים הַבָּאִים לַשְּׁטִיפָה הַנּוֹצֶצֶת!',
    'tut.p': 'פְּתַחְתֶּם שְׁטִיפַת מְכוֹנִיּוֹת! הַלָּקוֹחוֹת מְחַכִּים בַּתּוֹר בַּחוּץ.',
    'tut.1': '<b>גִּרְרוּ עַל הַמְּכוֹנִית</b> עִם הַכְּלִי הַמֻּדְגָּשׁ כְּדֵי לְנַקּוֹת אוֹתָהּ.',
    'tut.2': '<b>גִּרְרוּ אֶת הָרֶקַע</b> כְּדֵי לְהַגִּיעַ לַצַּד הַשֵּׁנִי.',
    'tut.3': 'עִגּוּלִים זוֹהֲרִים מַרְאִים מָה עוֹד לֹא נִקִּיתֶם.',
    'tut.ok': 'יַאלְלָה, שׁוֹטְפִים!',
    'toast.dayOpen': 'יוֹם {n}: פּוֹתְחִים!',
    'toast.stepDone': '{step}: כָּל הַכָּבוֹד!',
    'toast.upgraded': 'קְנִיתֶם: {name}!',
    'toast.lineFull': 'לָקוֹחַ נָסַע הָלְאָה, כִּי הַתּוֹר הָיָה מָלֵא!',
    'toast.left': '{name}: "נִגְמְרָה לִי הַסַּבְלָנוּת!"',
    'toast.closing': 'הַשָּׁעָה 18:00, סוֹגְרִים! סַיְּמוּ אֶת הַמְּכוֹנִיּוֹת בַּתּוֹר.',
    'toast.wrongTool': 'צָרִיךְ כְּלִי אַחֵר: {tool} (מַקָּשׁ {n})',
    'confirm.new': 'לְהַתְחִיל מֵהַהַתְחָלָה? כָּל מָה שֶׁבְּנִיתֶם יִמָּחֵק.',
    'q.waiting': '{n} מְחַכִּים', 'q.full': 'הַתּוֹר מָלֵא!',
    'job.closing': 'סוֹגְרִים…', 'job.free': 'הַמָּקוֹם פָּנוּי. עוֹד מְעַט תַּגִּיעַ מְכוֹנִית.',
    'badge.vip': 'מְיֻחָד', 'badge.mud': 'מְלֻכְלָךְ',
    'pay.service': 'שְׁטִיפָה {m}', 'pay.tip': 'טִיפּ {m}', 'pay.snacks': 'חֲטִיפִים {m}',
    'pay.streak': '🔥 {n} פְּעָמִים 5 כּוֹכָבִים בָּרֶצֶף · טִיפִּים ×{m}',
    'ban.closing': 'זְמַן לִסְגֹּר', 'ban.waiting': 'מְחַכִּים לְלָקוֹחוֹת',
    'ban.next': 'מְכוֹנִית נִכְנֶסֶת…', 'ban.ads': 'קְנוּ פִּרְסוּם בַּחֲנוּת כְּדֵי שֶׁיַּגִּיעוּ עוֹד מְכוֹנִיּוֹת',
    'ban.enter': 'הִנֵּה {name}!', 'ban.step': 'שָׁלָב {i} מִתּוֹךְ {n}',
    'ban.clean': 'נָקִי וְנוֹצֵץ!', 'ban.nextCust': 'הַלָּקוֹחַ הַבָּא, בְּבַקָּשָׁה!',
    'up.level': 'שָׁלָב {n}: רָחָב וּמָהִיר יוֹתֵר',
  },
};

/** Look up a UI string and fill {placeholders}. Strings are our own, so some contain markup (<b>, <kbd>). */
export function t(key, params) {
  let s = UI[lang][key] ?? UI.en[key] ?? key;
  if (params) s = s.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? ''));
  return s;
}

/** Fill static markup: data-i18n (text), data-i18n-html, data-i18n-title, data-i18n-aria. */
export function applyStatic(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  document.title = t('doc.title');
}

/* ---------------------------------------------------------------- game data in Hebrew */
const HE = {
  tools: {
    hose: 'צִנּוֹר', foam: 'תּוֹתַח קֶצֶף', sponge: 'סְפוֹג', tire: 'תַּרְסִיס צְמִיגִים', wax: 'מְלַטֶּשֶׁת',
    towel: 'מַגֶּבֶת', plush: 'מַגֶּבֶת רַכָּה', blower: 'מַפּוּחַ', turbo: 'מַפּוּחַ טוּרְבּוֹ',
  },
  steps: {
    prerinse: ['שְׁטִיפָה רִאשׁוֹנָה', 'רַסְּסוּ מַיִם וְהוֹרִידוּ אֶת כָּל הָאָבָק'],
    foam: ['קֶצֶף', 'כַּסּוּ אֶת כָּל הַמְּכוֹנִית בְּקֶצֶף'],
    scrub: ['קִרְצוּף', 'שִׁפְשְׁפוּ אֶת הַכְּתָמִים הֲלוֹךְ וָשׁוֹב'],
    rinse: ['שְׁטִיפַת הַקֶּצֶף', 'שִׁטְפוּ אֶת כָּל הַקֶּצֶף'],
    dry: ['יִבּוּשׁ', 'נַגְּבוּ אֶת כָּל טִפּוֹת הַמַּיִם'],
    tires: ['צְמִיגִים נוֹצְצִים', 'רַסְּסוּ אֶת אַרְבַּעַת הַצְּמִיגִים'],
    wax: ['הַבְרָקָה', 'לַטְּשׁוּ עַד שֶׁהַמְּכוֹנִית תִּבְרַק'],
  },
  services: { quick: 'שְׁטִיפָה מְהִירָה', full: 'שְׁטִיפָה מְלֵאָה', shine: 'שְׁטִיפָה מַבְרִיקָה', showroom: 'שְׁטִיפַת מְלָכִים' },
  cats: { Tools: 'כֵּלִים', Services: 'שְׁטִיפוֹת', Staff: 'עוֹזְרִים', Business: 'הָעֵסֶק' },
  upgrades: {
    nozzle: ['זַרְנוּק חָזָק', 'סִילוֹן מַיִם רָחָב וְחָזָק יוֹתֵר.'],
    foamer: ['תּוֹתַח קֶצֶף', 'יוֹתֵר קֶצֶף, וּמַהֵר יוֹתֵר.'],
    mitt: ['כְּפָפוֹת קִרְצוּף', 'מוֹרִידוֹת לִכְלוּךְ עַקְשָׁן מַהֵר יוֹתֵר.'],
    dryer: ['צִיּוּד יִבּוּשׁ', 'מַגֶּבֶת רַכָּה, אַחַר כָּךְ מַפּוּחַ, וְאָז מַפּוּחַ טוּרְבּוֹ.'],
    tireKit: ['עֶרְכַּת צְמִיגִים', 'פּוֹתַחַת אֶת הַשְּׁטִיפָה הַמַּבְרִיקָה. שָׁלָב 2: מְרַסֶּסֶת מַהֵר יוֹתֵר.'],
    waxKit: ['מְלַטֶּשֶׁת', 'פּוֹתַחַת אֶת שְׁטִיפַת הַמְּלָכִים. שָׁלָב 2: מְלַטֶּשֶׁת מַהֵר יוֹתֵר.'],
    bot: ['רוֹבּוֹט עוֹזֵר', 'רַחְפָן קָטָן שֶׁעוֹזֵר לָכֶם בְּכָל שָׁלָב.'],
    belt: ['חֲגוֹרַת כֵּלִים', 'הַכְּלִי הַנָּכוֹן מוּכָן אַחֲרֵי כָּל שָׁלָב.'],
    lounge: ['פִּנַּת הַמְתָּנָה', 'הַלָּקוֹחוֹת מְחַכִּים בְּסַבְלָנוּת.'],
    ads: ['פִּרְסוּם', 'יוֹתֵר לָקוֹחוֹת מַגִּיעִים.'],
    products: ['סַבּוֹן מְשֻׁבָּח', 'כָּל שְׁטִיפָה שָׁוָה יוֹתֵר כֶּסֶף.'],
    vending: ['מְכוֹנַת חֲטִיפִים', 'לָקוֹחוֹת קוֹנִים חֲטִיף בִּזְמַן הַשְּׁטִיפָה.'],
  },
  ranks: ['שְׁטִיפָה בַּחֲנָיָה', 'שְׁטִיפָה שְׁכוּנָתִית', 'תַּחֲנַת בּוּעוֹת', 'מִפְעַל הַבָּרָק', 'אַרְמוֹן הַבָּרָק', 'אַגָּדַת הַשְּׁטִיפָה'],
  names: ['נֹעָה', 'יוֹנָתָן', 'מָאיָה', 'אוֹרִי', 'תָּמָר', 'דָּנִי', 'שִׁירָה', 'אִיתַי', 'רוֹנִי', 'יָעֵל', 'עוֹמֶר', 'לִיאוֹר',
    'אָדָם', 'הִלָּה', 'אֵיתָן', 'רוֹן', 'מִיכַל', 'עִידוֹ', 'אֲרִיאֵל', 'טַל', 'אֶלָּה', 'נָדָב', 'שָׁקֵד', 'אֲמִיר',
    'גִּיל', 'רוֹתֶם', 'יָם', 'אָבִיב', 'שַׁחַר', 'עֲנָת', 'סָהָר'],
  say: {
    good: ['וָאוּ, נָקִי לְגַמְרֵי!', 'נִרְאֵית כְּמוֹ חֲדָשָׁה!', 'אֵיזֶה בָּרָק!', 'מֻשְׁלָם, תּוֹדָה!', 'הַשְּׁטִיפָה הֲכִי טוֹבָה בָּעִיר!'],
    ok: ['עֲבוֹדָה יָפָה.', 'דַּי נָקִי!', 'תּוֹדָה!', 'זֶה בְּסֵדֶר.'],
    bad: ['לָקַח הַרְבֵּה זְמַן...', 'סוֹף סוֹף.', 'אוּף, קְצָת אִטִּי.'],
  },
  world: {
    sign: ['שְׁטִיפָה נוֹצֶצֶת', 'שְׁטִיפַת מְכוֹנִיּוֹת'], enter: 'כְּנִיסָה', exit: 'יְצִיאָה', snacks: 'חֲטִיפִים',
    posters: [['מְסִבַּת קֶצֶף', 'כָּל יוֹם!'], ['מִבְצַע בָּרָק', 'שַׁאֲלוּ בִּפְנִים'], ['מַבְרִיק!', 'כְּמוֹ חָדָשׁ']],
  },
};

const EN = {
  say: {
    good: ['Wow, spotless!', 'Looks brand new!', 'That shine!', 'Perfect, thanks!', 'Best wash in town!'],
    ok: ['Nice job.', 'Pretty clean!', 'Thanks!', 'Good enough.'],
    bad: ['Took forever...', 'Finally.', 'Hmm, slow service.'],
  },
  world: {
    sign: ['SHINE TIME', 'C A R   W A S H'], enter: 'ENTER', exit: 'EXIT', snacks: 'SNACKS',
    posters: [['FOAM PARTY', 'every day!'], ['SHINE SALE', 'ask inside'], ['WAX ON!', 'showroom shine']],
  },
};

const he = () => lang === 'he';

export function toolLabel(id, up) {
  const st = toolStats(id, up);
  if (he()) return HE.tools[st.variant || id] || TOOLS[id].name;
  return st.name || TOOLS[id].name;
}
export const stepName = (step) => (he() ? HE.steps[step.id][0] : step.name);
export const stepHint = (step) => (he() ? HE.steps[step.id][1] : step.hint);
export const serviceName = (svc) => (he() ? HE.services[svc.id] : svc.name);
export const upgradeName = (u) => (he() ? HE.upgrades[u.id][0] : u.name);
export const upgradeDesc = (u) => (he() ? HE.upgrades[u.id][1] : u.desc);
export const categoryName = (cat) => (he() ? HE.cats[cat] || cat : cat);
export const rankName = (r) => (he() ? HE.ranks[RANKS.indexOf(r)] || r.name : r.name);
export const customerNames = () => (he() ? HE.names : CUSTOMER_NAMES);
export const customerSays = (kind) => (he() ? HE.say : EN.say)[kind];
export const worldText = () => (he() ? HE.world : EN.world);

/** What the next level of an upgrade does. fmt formats money. */
export function upgradeNext(u, lvl, fmt) {
  const H = he();
  switch (u.id) {
    case 'nozzle': case 'foamer': case 'mitt': return t('up.level', { n: lvl + 1 });
    case 'dryer': return (H
      ? ['מַגֶּבֶת רַכָּה: מְנַגֶּבֶת מַהֵר יוֹתֵר', 'מַפּוּחַ: רַק לְהַחְזִיק וְזֶה מְיַבֵּשׁ', 'מַפּוּחַ טוּרְבּוֹ: רוּחַ עֲנָקִית וַחֲזָקָה']
      : ['Plush Towel: wider, faster wiping', 'Air Blower: just hold to dry', 'Turbo Blower: huge, powerful airflow'])[lvl];
    case 'tireKit': return lvl === 0
      ? (H ? 'פּוֹתַחַת אֶת הַשְּׁטִיפָה הַמַּבְרִיקָה' : 'Unlocks the Shine Wash service')
      : (H ? 'מְרַסֶּסֶת 40% מַהֵר יוֹתֵר' : 'Sprays 40% faster');
    case 'waxKit': return lvl === 0
      ? (H ? 'פּוֹתַחַת אֶת שְׁטִיפַת הַמְּלָכִים' : 'Unlocks the Showroom Detail service')
      : (H ? 'מְלַטֶּשֶׁת 40% מַהֵר יוֹתֵר' : 'Buffs 40% faster');
    case 'bot': return (H
      ? ['רוֹבּוֹט קָטָן שֶׁעוֹזֵר לִשְׁטֹף', 'הָרוֹבּוֹט עוֹבֵד מַהֵר יוֹתֵר', 'הָרוֹבּוֹט עוֹבֵד מַהֵר מְאֹד']
      : ['Helper works at 32% of your speed', 'Helper works at 50%', 'Helper works at 75%'])[lvl];
    case 'belt': return H ? 'הַכְּלִי הַנָּכוֹן מוּכָן אַחֲרֵי כָּל שָׁלָב' : 'The right tool is ready after every step';
    case 'lounge': return H ? `הַלָּקוֹחוֹת מְחַכִּים ${25 * (lvl + 1)}% יוֹתֵר` : `Customer patience +${25 * (lvl + 1)}%`;
    case 'ads': return H ? `${20 * (lvl + 1)}% יוֹתֵר לָקוֹחוֹת` : `${20 * (lvl + 1)}% more customers`;
    case 'products': return H ? `כָּל שְׁטִיפָה שָׁוָה ${12 * (lvl + 1)}% יוֹתֵר` : `Service prices +${12 * (lvl + 1)}%`;
    case 'vending': return H ? `עוֹד ${fmt(3 * (lvl + 1))} עַל כָּל מְכוֹנִית` : `+${fmt(3 * (lvl + 1))} snack sales per car`;
  }
  return upgradeDesc(u);
}
