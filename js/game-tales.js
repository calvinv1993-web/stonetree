'use strict';
// Tales: the old stories of Brightwater Isle, which nobody can say are true. A tale is a
// chain of deeds - digging somewhere, saying something somewhere, blowing a whistle,
// slaying a monster, striking a wall - each at its own place, some only at their hour.
// What each deed is, and what follows from it, is sealed in TALE: a deed's fingerprint
// opens its step and nothing else does, so not even the code tells you the way, or
// whether there is one. Only those without a vocation hear the island's tales: whoever
// has chosen one has left the island for good.

// Each step: a: [[fingerprint, key], ...] (the deeds that take it), m: what happens then.
// sealed:begin
const TALE = [
  {
    a: [
      [4181244024, 3081258768], [1184518366, 1695101629], [1572304698, 4235010783], [2649228053, 3313771302], [432891144, 953223747],
      [4290587398, 1414763766], [1152852651, 3627737219], [2332080666, 309075630], [3082010382, 1007315845],
    ],
    m: '80a41a51af3f0c9ee680546077613689f26501acda6839728c77102eeee552bbb22ed7ca5aea740d14f9976f71703c02315cb9aaab4cba4ad7a06acbd130f67400'
      + 'ec6ac41b74b18432177904490abbea3abcedab30904d9f9f0b5b345ec47a3e01d61518558b72ac413a935d5c388a66751da22607480404c9d0c4bb644f6380bfa8'
      + '653c94a575d63ffeeab7ae51292f2b64415bd1023d25bcf9d40bef1f56202fc5ca1727a5d1891d29888305a84900281ff9dcf1000ffc11defdabf05f80dd85eb90'
      + 'b8d2ec8f027d4d5729f532f73d8882dd983c228f9d3155ac38db3790ec20ef5da0ae9454a743eee06f1314c5f029d5e7835193413e0a8852590847eb1998ec12cc'
      + 'd9eaa0fb3aefd847204e40bb6c5878e108c1b019790aa03e6f6c818f38f75c2c0d44563a636ec26170e594b9108159c8e5f74b657c04fa762e3083fa3428925f22'
      + '7296959442ae544d089d2e1acce4acccec7c7f3c70f0439f571ecdaa65d60e81d4ad75b584a5e389c90d2dbbcf805e3dfac4e73151a42044871370da544418b5a2'
      + 'bfc412cf6533b3dcf38c09ad3c94068f76f0b4a0263a6285916f4a36dae876ddd6',
  },
  {
    a: [
      [3129363546, 3379824380], [504990214, 666860950], [1743010179, 935638644], [3369578533, 3000906557], [1902084272, 181312709],
      [3988946535, 1222336147], [1306011055, 3318959526], [3539119992, 3064711119], [1923819103, 4858858],
    ],
    m: '5e5cddfbdf6608a61a0394cb35647e6e96336be3c05442bedc23da4a5bd10dd16016cfa36e4eae2e32983d55b5d6a13794663db1361f3532cbd4acefebc9ea0e63'
      + 'ed9b68bbe29a9f19d89aaf5915dfb82035534f176126cf84138dd6aa067c742c037cc7aacd6494291ddb6a5a96badc47da88d780f3911623a4d1008981fb2c53e6'
      + '9cecc8085a34b2ce2b07f4103abcbdf6f55ac8d72024809d313494403056bab31e7c3577039964c94a31bc874f77e30285367f81f7eb6dcd461c1baf7b4fe08937'
      + '424b43b2748200517def53df75aab2f1dad98c721a4d82c921c645122804f66c7d1d33fb08c228137ee0b17add29e8e1fc7633064ad40d2f58b35383d8916e4fac'
      + '510effd2b77967ddc818b7ec6a6835330d8507259a2a3b6c0c53c4c5e5e8ae9ecc62244b729d6744b9d8700156d267ec0aacd827af8fcd1bffcca213606f25eb27'
      + 'cb04ed166e21a8da5a832cd8a9486010a821114f1a34cdb03f54d8818868f999aa2958b1bf8681c23e01a00a00138d9350bbceb71bf1f69b8405f387997e825e03'
      + '87b5519cbf5b52e15cba824ca7a649',
  },
  {
    a: [
      [1406448844, 2812215828],
    ],
    m: '81bdedf90fde1217c854132d3e12ec4b28ccc5e819f190e63b6424c7ded1bcf25435809264d0f8386cf99abc4bb74a4dbeee4cc2549dffd1d46889f1f7f8ad398a'
      + '33ff5ecb466a1f5492b71227dbbde9e6f26db32327477c948f84377ffcf48e2dc6ac510f5d72699d1518079e0b02fef54f98aca2ba5bb16966fe8d1073a44d7aa0'
      + 'f5736de36117625477fab4d1a1b5477b5c3ae7b566c534b6c7fffc375deb6a2938e1da35cc8bfccde773ff719fa13782fbdac7040e44390f9a5138dc903e3e9ad2'
      + 'd4d009a84dc2c2df7c0f7aaf980d9fa050080a732d46b9d50d41b1e2ffff581a2b9f84350c955501dbc79f8cecd1df4156f4b975da1666e27c55677efb7b651af8'
      + 'd9b51c09727d8f696920d3c45513c3c6bcb4e6693111d06e939ef66e2de0c84b925e58af843a2bab9578c5575ea61d463cd733e0036eaa596bafa13dbd5b6e361a'
      + '2f9c9ad9adacc8d09681a8f2b8316ddf1ed2c802cc898ab7',
  },
  {
    a: [
      [1467137129, 2896785894], [1512773710, 2070674341], [3630097996, 2115763376], [719721957, 4140508174], [375768971, 3175007112],
      [929871848, 2384886112], [982076677, 829669563], [3648977395, 50274600], [740712966, 1335313953], [219138388, 3613892010],
      [3328051617, 1966550683], [1619452497, 2520907756], [2410590460, 1802466607], [1519419579, 3539690979], [2061594046, 2275120688],
      [2116056449, 3153973614], [1923682066, 985351011], [1512375284, 467998955], [803653463, 2052854618], [395450404, 853119364],
      [4168655577, 2178121025], [68819191, 180169341], [2478982083, 970417212], [1883451774, 101752680], [2461646765, 2679204299],
    ],
    m: '241ee77ed7a7b8a16582ac260e04593e64ad755883502f25101e2b74c060aa789361096137189f3d4ed5dc81afb0393b5f71107d51e4ac1997421c5b07d40f7084'
      + 'f493542eea59ae9b7b19f4c7e544bf127750e96a2166901af1c70c7d736fc11de5f855c65825ab8f70af97c7cfa8cc752eb9af8f004a320940e94675fa8660346b'
      + 'c1a84a819188d56bf0ccd4e1a07126dfabd16cba016aba3442daaffe6622cfad212fd4cdd6bfd8cbb26f941930358945517761c3d327e6fccd20abd630184a218c'
      + '0ace40e8b3fe01b574e4933cbd03701b9f1f62ff0f0950e95ee1bbb6c07350c6850e3031faf0d84c7e733ed00dd0487315f225655a5244fa109774a1fdf7bcad6c'
      + '0bc7b55c02a5e974d5e8a2830f27a036a72161804cb3c080f570954cae5c752ee2ccb2a44c68f8efb5daaef1da8aad5b416b00069ffa818d0674bd838f3f0c36bc'
      + '04b4e2c35b0858486e73b8f0a9d49be01cc8980ed8e138a3fbe1fa6d0a60acad8a6d132fd175646dcaac51527fbb13df9e1b3346a2c37c0931ddfb420524603c68'
      + '5b23c7b3ae33b8deeeda921ba558836210313b7cd49481c0160811d1a5aaaefb190ee2adee2d489e1ee4d5ca2ce04c54159f6af258823ccdda3939dd',
  },
  {
    a: [
      [266370679, 1887863143],
    ],
    m: 'b516654d4957c365b2d213ecf15a7fa42b6672c2f3d013337b8ac34a8a7a524ed4ab818aefac985385a789b1073f59e7a3456950654bf9f7e1178bcb58d802bfec'
      + '3e9d139f7672bea69984d3cf88088703cc55f87d93a626c5ef6b05aac3a7947c9a5f4a3dfa191d963f4bfa83825e772ad80d8debb134fbba112a2282aa9238345f'
      + '73c726bcf955218ed5c6220e2eff43b8c63de42c77663ac7f46b9d6dfec4dcedc12b15d7fe5d41636d78517728ce90838ba2f4f37717e6945d9885e48d9f7d4370'
      + '3d3d1f3066d0ca1dbff97581992f4e453670adecd03edf1b06d6f75b926ad1018b7100205609e4c352c81741e80652392998dfedc23097454bfcc76772235f1eeb'
      + '9355914855316dccf5af56359083c054916c43c6e2ad0e5a814c14ab8d11bdc5dd9625bedb5091ba52b21d9b1290f76b664094a0fe791e8ad28fdc7b1808e53a69'
      + 'ee644af2e6ffccbd68115fb0f6f16e6a44a82d9322835b88606581c0d1f8845ba38a73826b44b97703e52968a75da3e324e6ae0b1f1243caf2b8365f5d0bd2c8ef'
      + 'df25633c4865793600349b83d41c1c7175b64914a55304da090ab6930f1c5efc178e3a1e0c41e9a15a134f1dfd9ce30dd01d45182420a91171c90703a0f7eaae08'
      + 'e8364b4696799a2116e0789e770c77fb33effe2894866811e35c290de103cf41c12a7c35cf9828d18b88ebb8c6',
  },
];
// sealed:end

const TALE_SEEDS = [0x6a09e667, 0xbb67ae85];

function taleHash(text, seed) {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 0x5bd1e995);
    h ^= h >>> 13;
  }
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

// A stream of bytes from a key (mulberry32).
function taleStream(key) {
  let s = key >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) & 255;
  };
}

function taleOpen(hex, key) {
  const next = taleStream(key);
  let text = '';
  for (let i = 0; i < hex.length; i += 2) text += String.fromCharCode(parseInt(hex.substr(i, 2), 16) ^ next());
  try {
    return JSON.parse(text);
  } catch (e) {
    return null; // not this one after all
  }
}

// Spoken words as a tale hears them: no case, no punctuation, no "the" in front.
const taleWords = text => String(text).toLowerCase().replace(/'/g, '').replace(/[^a-z]+/g, ' ').trim().replace(/^the /, '');

// The time of day in the words a deed may need: the hour, and night, dawn, day or dusk.
function taleTimes() {
  const h = Math.floor(worldMinutes() / 60);
  return [`h${h}`, h >= 21 || h < 5 ? 'night' : h < 7 ? 'dawn' : h < 19 ? 'day' : 'dusk'];
}

// Someone did something that a tale might be waiting for: kind ('dig', 'pick', 'say',
// 'blow' or 'kill') and what and where. True when it was the next step of their tale.
function taleDeed(kind, what) {
  if (player.vocation !== 'none') return false;
  const step = TALE[player.tale || 0];
  if (!step) return false;
  const deed = `${kind}|${what}`;
  for (const sig of [deed, ...taleTimes().map(t => `${deed}|${t}`)]) {
    const found = step.a.find(([print]) => print === taleHash(sig, TALE_SEEDS[0]));
    const told = found && taleOpen(step.m, (taleHash(sig, TALE_SEEDS[1]) ^ found[1]) >>> 0);
    if (!told) continue;
    player.tale = (player.tale || 0) + 1;
    taleTell(told);
    return true;
  }
  return false;
}

// What happens: { title, text, sound, color, give: [item, count, grade], all: news for everyone }.
function taleTell(t) {
  if (t.sound) addSound(t.sound, player.x, player.y, player.z);
  addSparkle(player, t.color || '#9cc0ee');
  if (t.text) showText(t.title || 'Brightwater Isle', t.text);
  if (t.give) {
    const item = makeItem(t.give[0], t.give[1] || 1);
    if (t.give[2]) item.q = t.give[2];
    stash(item);
  }
  if (t.all) {
    const news = t.all.replace('$name', player.name);
    for (const p of players) asPlayer(p, () => {
      log(news, 'quest');
      playerEvent('banner', { message: news });
    });
  }
  uiDirty();
}

// A whistle: anyone can blow one, and everyone around hears it.
function blowWhistle() {
  if (now < player.useReady) return;
  player.useReady = now + 1500;
  addSound('whistle', player.x, player.y, player.z);
  addSpeech(player, '*wheeee*');
  if (!taleDeed('blow', `${player.x},${player.y},${player.z}`)) log('You blow the whistle. A thin, lonely note carries far.');
}
