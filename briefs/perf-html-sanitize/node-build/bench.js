import { createRequire } from "node:module";
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toESMCache_node;
var __toESMCache_esm;
var __toESM = (mod, isNodeMode, target) => {
  var canCache = mod != null && typeof mod === "object";
  if (canCache) {
    var cache = isNodeMode ? __toESMCache_node ??= new WeakMap : __toESMCache_esm ??= new WeakMap;
    var cached = cache.get(mod);
    if (cached)
      return cached;
  }
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  if (mod && typeof mod === "object" || typeof mod === "function") {
    for (let key of __getOwnPropNames(mod))
      if (!__hasOwnProp.call(to, key))
        __defProp(to, key, {
          get: __accessProp.bind(mod, key),
          enumerable: true
        });
  }
  if (canCache)
    cache.set(mod, to);
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __esm = (fn, res, err) => () => {
  if (fn)
    try {
      res = fn(fn = 0);
    } catch (e) {
      err = [e];
    }
  if (err)
    throw err[0];
  return res;
};
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// node_modules/entities/dist/decode-codepoint.js
function isInvalidCodePoint(codePoint) {
  return codePoint === 0 || codePoint >= 55296 && codePoint <= 57343 || codePoint > 1114111;
}
function replaceCodePoint(codePoint) {
  if (isInvalidCodePoint(codePoint)) {
    return 65533;
  }
  if (codePoint >= 128 && codePoint <= 159) {
    return c1[codePoint - 128] || codePoint;
  }
  return codePoint;
}
function replaceCodePointXML(codePoint) {
  return isInvalidCodePoint(codePoint) ? 65533 : codePoint;
}
function codePointToString(codePoint) {
  return codePoint - 1 >>> 0 < 127 || codePoint - 160 >>> 0 < 55136 ? String.fromCharCode(codePoint) : String.fromCodePoint(replaceCodePoint(codePoint));
}
var c1;
var init_decode_codepoint = __esm(() => {
  c1 = [
    8364,
    0,
    8218,
    402,
    8222,
    8230,
    8224,
    8225,
    710,
    8240,
    352,
    8249,
    338,
    0,
    381,
    0,
    0,
    8216,
    8217,
    8220,
    8221,
    8226,
    8211,
    8212,
    732,
    8482,
    353,
    8250,
    339,
    0,
    382,
    376
  ];
});

// node_modules/entities/dist/internal/decode-shared.js
function decodeTrieDict(input, resultLength, atomCount, dict1AtomCount, ngramCount, dictSize) {
  const base = 91;
  const inputLength = input.length;
  const twoCharBias = dictSize * (base - 1);
  let pos = 0;
  const readSlotCode = () => {
    const c1 = BASE91_INVERSE[input.charCodeAt(pos++)];
    return c1 < dictSize ? c1 : c1 * base - twoCharBias + BASE91_INVERSE[input.charCodeAt(pos++)];
  };
  const dict2AtomCount = atomCount - dict1AtomCount;
  const slotCount = atomCount + ngramCount;
  const single = new Int32Array(slotCount);
  single.fill(-1, dict1AtomCount, dictSize);
  single.fill(-1, dictSize + dict2AtomCount, slotCount);
  const start = new Int32Array(slotCount);
  const length = new Int32Array(slotCount);
  function decodeDelta(count, off) {
    let previous = 0;
    let slot = off;
    const end = off + count;
    while (slot < end) {
      const code = BASE91_INVERSE[input.charCodeAt(pos++)];
      if (code < 89) {
        previous += code;
        single[slot++] = previous;
      } else if (code === 89) {
        let runLength = BASE91_INVERSE[input.charCodeAt(pos++)] + 2;
        while (runLength--)
          single[slot++] = ++previous;
      } else {
        const next = BASE91_INVERSE[input.charCodeAt(pos++)];
        previous += 89 + (next < 90 ? next * base + BASE91_INVERSE[input.charCodeAt(pos++)] : BASE91_INVERSE[input.charCodeAt(pos++)] * 8281 + BASE91_INVERSE[input.charCodeAt(pos++)] * base + BASE91_INVERSE[input.charCodeAt(pos++)]);
        single[slot++] = previous;
      }
    }
  }
  decodeDelta(dict1AtomCount, 0);
  decodeDelta(dict2AtomCount, dictSize);
  const references = new Int32Array(ngramCount * 2);
  let poolSize = 0;
  let ngramIndex = 0;
  function readNgramReferences(count, startSlot) {
    for (let index = 0;index < count; index++) {
      const slot = startSlot + index;
      const a = readSlotCode();
      const b = readSlotCode();
      references[ngramIndex * 2] = a;
      references[ngramIndex * 2 + 1] = b;
      ngramIndex += 1;
      start[slot] = poolSize;
      const entryLength = (single[a] < 0 ? length[a] : 1) + (single[b] < 0 ? length[b] : 1);
      length[slot] = entryLength;
      poolSize += entryLength;
    }
  }
  readNgramReferences(ngramCount - dictSize + dict1AtomCount, dictSize + dict2AtomCount);
  readNgramReferences(dictSize - dict1AtomCount, dict1AtomCount);
  const pool = new Uint16Array(poolSize);
  let write = 0;
  for (let index = 0;index < ngramIndex; index++) {
    for (let half = 0;half < 2; half++) {
      const source = references[index * 2 + half];
      const value = single[source];
      if (value < 0) {
        let read = start[source];
        const readEnd = read + length[source];
        while (read < readEnd)
          pool[write++] = pool[read++];
      } else {
        pool[write++] = value;
      }
    }
  }
  const out = new Uint16Array(resultLength);
  let outIndex = 0;
  while (pos < inputLength) {
    let slot = BASE91_INVERSE[input.charCodeAt(pos++)];
    if (slot >= dictSize) {
      slot = slot * base - twoCharBias + BASE91_INVERSE[input.charCodeAt(pos++)];
    }
    const value = single[slot];
    if (value < 0) {
      let read = start[slot];
      const readEnd = read + length[slot];
      while (read < readEnd)
        out[outIndex++] = pool[read++];
    } else {
      out[outIndex++] = value;
    }
  }
  return out;
}
var BASE91_INVERSE;
var init_decode_shared = __esm(() => {
  BASE91_INVERSE = /* @__PURE__ */ (() => {
    const table = new Uint8Array(127);
    let code = 0;
    for (let char = 33;char <= 126; char++) {
      if (char !== 34 && char !== 36 && char !== 92) {
        table[char] = code++;
      }
    }
    return table;
  })();
});

// node_modules/entities/dist/generated/decode-data-html.js
var htmlDecodeTree;
var init_decode_data_html = __esm(() => {
  init_decode_shared();
  htmlDecodeTree = /* @__PURE__ */ decodeTrieDict("!}.&u%}'&}*'~!6*)%&,~!J~!J~%L~y<~!R,~~%Lu~~#GD~~#|)1#%}^%}2%+#.##%##%}&%##%'#%##&%#%#'%#&#%#&#'#%%#&#%##%#)%''%&%#%#'%#%%#%%}%%%#%#&(23#%%#&-%0%('1#(##%#'##+%'*.:1}#%#6-+(%'%%#%%%}#L'2351&('%}&/N'(0(/*-%(%%}#'+&T%7.2}#&%&#%#36/5##%&%%#&#%%#))2%%##%&&'0~!#*+&'%1~!%).'3q?&%'1~!.##%6(~!+%%%(Gw'rT~!E#<nA%#jZ~!H%(~!42##~!*31&~!G%U~#)5~#`3~!J~!Z~%]~%Y~%C~!q~!u~#kz~%#~!6'~!D~!U~!?~#T~!c%~!G#'~%7|~!G~!J~!G&~#pb~(Df}#%}*&}#%##%##%##&#-}&'#'&%#.++}%mI,#,@&(}*%}*'%&##&#%##%}&0}#.},U},%}+%}&%}#%##&}B%(}(%}+%)})%##%#&}&%##%&}<%}>%#%&}*%}(%}9%}/%})%}*%}*%}?&}&%}3%}&*#%})%#%#)}#&#-#+*%E%%'%'#%}#*V##&##I}#&&##%&%#&&Qf%%))w/0+&%#(#.%-''''++++7}>%4'',##1,#%#&%##&#'##&#*#9)%&%}#*}%,#+P(%A&%#'&##wSD',9E00#y#@}(+}&%&>~!#~!X}#*}(&&}(&}(,%}%&#+&}#&}I%#%}%)#(},'%#*}4%%#%}(''}#/##(##),%-##%%)#&}(.}&%#&}%%}*&#%},&&}&%}#%*'#%})%}D&}&%}-&}6&#&}-,%}#%})-(~+`~,=?~I9'9%~!,#%})%})%}@%}?%}(~!?~#<~#pP~#BG~#=1#%K+~#?#~%;)~#A~#mF1~#A'~'X%'~#lR~#N~'N~#r~#m#-~#i'?%#'%~#B%##%,%#~#_%#0%~#]732~,w~2+#:&#%&'0%&>%}#>##F+)#%&&#(+_}4&}-%}(&}@&}O7Fdf0@+/v4}&WU##&/0#&'('B#%}.%}'+#%}#%%&#&%#%##+#&#)#6#'#.},%}c%},%#%##%&#&%#&~#>'*-.%##%##%}#%%}%'~#)D1}#%*&~#_%%'(~#S2%'.}#~#=##*'*-%}&'%'##&&~'E%.#&~#M4}%%##&'%#~#O1##%&#'+~#<B%##%%'%+~#;#@%}#&%#&&%#(~#H1}'%'##&&~#?A}&'~#D#%32}'&&&&~#[}'(#%}'~#;C})&}%%#%~#=&%,3}%'(#%%~#^'#&&)#%'~#Y%-~#d-%'~#^%%&#&&&}#~#b~2t*&'~&(~&@~0%~e~3}%*''0})&}+~!9##-}#%-hD*)1fC#%/&/fB#40~!+#)*4~!+~!K'&:~!/*7~!.#~!H~!L':~%x&~!H#~!*~%1~!I#~!+A~#p'~!F~~#-#~,,(~.Z~!V~%;'B'mq-W~!N~%I%#&&#&}#%},%%}'%}+X#%}#&}(%}'%}<%}#%}%%'}'%}:~![)9@~%>~#UA%-%##&~!C%~!-.9:~!1~!-^2/:a~!y,D*J#-5)/4~%23,~#G~!L1~!0X3`~!2+~!!0-~&E~!W~!o,>Y&]~%cZx_&~#O*9#A#'#+I'%#)~!0B*-5A+-((F&*M#)(-7-5+'-3a5Vi~!Y~!?+[)%3),ERHm~!+:D,VG.+)?fB%%*(%)'(#&80%1'8`K8?`+'Z#&O&'H5#*9)A%%5&3))0%39+.*7#()&&*=4@**L)<'_&*+..;(#*+)./&0#3)%')-8(4ixD(&.}%,('aI:,)%,k2231T)I'#/-W7,/'Q#.'Y24+h')37</31&83##&0#),H(?'&?/1##%#&&#%''-%&&&#(&''&#.-'%#%%(,')*'&#&#'##%(%(#%('#&##%%%%('%#%#%%#%#&%##h>w+v<ayvyvcg.uuhKr}g/v|g>u9i[~>g5uI~=RvdwEg;v/g;uk!!TTSx]@RT!U!#!@VBRUU!'UTe-d0c`e&gSdicedFcrdTaqb.kYcAohdYd@a3e+d}dMdtd.aJ#bqcK`dle/e.e'dwdPdodddjbEb}ogd^ofdpduc6j?l%d{drdqc)d7bacOdQ%T#Y)X.sR[yH>6Vyv3[xwLu>vo'!*.[yBacahoj>6Rew3[xqdZa#!a&#^(X-[yG>6Vyu3[xvg3sEr|g.u/Ri9db0T#^(Xa)!-[y;>6Vylg4wKs{JwNZt3@3r=c4Z([xlg;wKt!cpq's@v7A'*a(a+!-a#[y<3Dt?3Dt'>6Vym3[xmg9rxsNJwLZt4~?r?db1T#`-!(Xa,!0[yS>6Vz%NuQs.g4wKtnJwNZtS@3r>c4Z([y%g;wKtrdga8!a(!#&T*Y-Xa#!a0<or[yc3Dtq>6Vz43[y3JwNZtf@3s!Ju}!%Dti:pm3c_%X#tjB5pkd6q!r]u?voC'*-a.a2!0a&a+[yI3DtI3Ds~3DtH>6Vyw3[xx;:s#~<5pKJwNZtE@3r~d`a)!a2T#a.(!+U.X1[yT3Dt`3Dtv>6Vz&3[y&g9rxwzcxstPu.<rAJwLZtT~?r@dZa%!a.&^*Za(/Reu[ya>6Vz23[y1g3sEr}wkg{NuQRg{ci(U#5@b`~,cg#U(2WnH5wugcRh7dX#T(Y,a'Ta!!a,[yZ<]mj>6Vz,3[y+Pv#5ReZKu+=,%!H}7ABwkaS?Rh:BcW(X#<]mrj:ubv/ARekdg%!(!a.*Ta(Y.X1!#sP>Rl*Dt6[y>>6Vyo3Wf*jOvuumvuRgRJuq*!:9<B@bX~3jVv&v@s@5Re[d/rQt{uAvo&a&a*)a2!,0Wf!3Dt0=Bs'>6Re}3[xy~<5s%JwJZt1~Gs)c;&!#2sJkNuXvzq7rxu,Re8dka4!a8(aEZ+a@Y.X1Xa)[yd=Bs(3DtP>6Vz53[y4cX#X&Re:avRe9~<5s&JwJZtQ~Gs*i^rzvdRg+Jv{%!2sbB@bX}kdga,!Za?&^*T1/!a'Dt+[y6>6Vyf3Wf%g/u;s4hGu6?Rh-JvZ,!c%#&RoX54Rivj7uyvf8RgTKvZB%*!2sGh<vu5Rgq<=C::9bb~#dZ#T&Ta6Y.X*Dt>[y93Wf)coZ(T,6VyifluvRgC@95@B@bX~/hFu34cC#T,k/unq8w8Q5RkUklwQuzunq8w8Q5Rk8d/rJu?v8w9)-&!a0a;a&aIWejg3sEr/h1s<DtDJvyZqY5aws3Jvy!&Wei~Hr1:au5@Bag>23E~5c:Z&bX};kKv?w&unuVu5Rjc;>bs)#~@:Rh.=ay<a]C;b`}Vd6s/t{uAvoaxa()!a,a7%-a#a2Dt,[yF2Wo[>6Vyt3[xuNuPRi&NuPwpi#RoWh?vf8Ri%Jv]!%Ri:KvxD!.'2WeAjZu`q9rxu,Re7woeAg-unLq(qA_/*2Wg_g3u5q^9:4E}/jTrxrzv=Wkkd~0UX#^^Xa-a1a5T&a=U1a'*aEa]!a*aPaA-adok[y54Rn>;:p3~Dp5g9rpsFNvZqjg3uJp4~<5p0Pw;5qlJwNZt*@3p1Pw:5p/Ou!5p2JvG'!6Vye=<qnJvh_[xhg3v,Rh3kOwOw-sDuev/Re^dha[a%!%!a+#Ta7)-5TaCaO!aka!a)sf[yb2>Rl!9ARiq5E}Qg=ucRkBE|oJrJ_@Wk~@Wk{JrJ_@Wk|@WkyJrJ_@Wk}@WkzJvO_[y2g-vMRmiKuYC!)&>Ri;>Ri<@3RkNc](X#@9Rk=g5vuRmhKvDB!+'=]meg3u4Rmgd)#Y'Vz3CARmfd`a+!%T'!+#Ta1Ta6TaM-sTDt9[yA9sYd'%Y#s[[xpj:ueunaXRgEjRq,v-vuqdd2'`#6Rev<32@5>:2<E}5xIo9a*X#Y(;5RePJvD_g>vyRgNj8w)v8<wggs:RgXiZt|vjx,hSq3ah!-(~@:Ro/Ou!5RhWj^v(pyw8unRhUdx-UY#^Ua.a3a70!)%UX1TaDa)'omRiRRhE[y:3Dsz=Br,>6Vyj3[xkg6ruwjcqsrPw;5r*Ku]D'Zt-@3r(~?r.i[vwv]dU1a--U#`a4(g/vsRhPOu!5RhLj:rmu9Wo!~@:wdh@g/vsRiTjXuvvNr}:RhBj^v(pyw8unRn]dz1UYa'a+^Y(!aETZalaRY.Ta?a4[yDJw1!#qLsW>6Vyrfzq-pLflpwRe|Js>%!Dt@3Dt&Jvy_[xs~HrnjMuwpsw'RecKu+D#'!t<~Grl~?rjg5u-x,gwp{ah!-(~@:Rg~Ou!5Rh'jXuvvNr}:Rh#cW#X/c;&!#2sLi[v7u7RgpJv)(!iLrxu,Re6j7v@s@5Se[e7d`aW!Za(a`T.a#!a3!&aDa-!9)Dt_=6s+3[x~~DR|h~DS6avhGun5RkZj3w)v-]mkKunB!&*]kb97R|i<ARk<c:Z(6Vy}Juh'!wziMRoS:F|vkLuauJv5vtvQRh1d='T+Y#VyO~DR|jcF#T'7R|g97R|kJv3'!ay<Rj,Jvh&!:ReXcsa6*a+#a#_aIRf9aLRf?c,Z&Rf5Rf7c.Z&Rf;Rf>cQ#%T'p-Rf8Rf=ct#%'(*!,p,Rf4p+Rf6Rf:Rf<d~'Ua%U*^UYa(!a,-!#a4YaTalaEX0a8a<Weo3Dt/3Dsx=Br93Wen~Dr;~<5p<JwNZt2@3p=Pw:5p;Ou!5r3c7&!#:p>3Ds}KvGB)_6Vyk2sM=<r7x'eovA(!hFu1ARf}cV#X&@r5j6rvwQa^Rf3c=Za'wkghJv__g;unRggA53B9=b^}%j6uduo5Jq;!(hIv%2Re`Ou4ARe_e%a#^^^Xa&!a*a2!&a6YaP!*ad!#a:aE/5Rn?[y@>6Vyp;:pE~DrY~<5pBJwNZt8@3pCh=rt3rWPw:5pAJup_[xoNuPpF9c!#'45pD5ARn)d8#X'X*3@rU72s]h>v<<sSjJpqvewOJq/(!hNw'5ReBk0s2u3w/w'5ReE5@Jq.!a+JQ!&WeU23d(#Y&RjG5]jBk!u7w&u0udARjEe#+^^^Ub#!a2/a`Z(agT1!a-a;|@TaG!aS[yV=Re~fow'RguNuPRe?bz#'>RoUWeL>:Cbb|?JwPZtVg6ruRmzJvD'!6Vz(g/vmRh~Jvy_[y(g9voRgyx*cy(#2>Ri2B9b]~9kIw9u7rluJu3Rg]dI#a%UY'@=p%CAx.gQZ&RhwwygtRm{x5g_Z'+ABqR9Woa=Bp&dV#^*Xa'!&@o{g4v]Rk;Jv{!%Rk[wkkiA5RkiwwfUB=x,fUuqC&*!>RfTg8v0RfV~ARfSd;rJsAuAv9wR'ae+/aO!a@aza/a#[yQ@Wg!2Wemg3sEr0JvB_g>uvReWg2v+Re=KupB_+[y!2AbY~-~Hr2AJwD!(h<~El>h<~El?Kun@+_:9b`}Kg-v/Ri3g;vtwyk_9]k_d=&T#*U.6qh@Ab`|K9:H|CJv[!&3Dtex'fDwC%!Rf[9WlMd[(^X,!a%Z06Vz!@WgBg=v~Rgvg,QRe@awd,#Y+jTv|Q~EfWj]uNr|~FRfXdy#Y&^Ua%!aO.!(a)Ua;=!a@aKap!a-,a!Ta]a[rSa]p?[y82sK=Bq~;:p:~<5p8Pw:5p7d'#Y'Wf(;RnRi[u4w&RgJJvG'!6Vyh=<r#ijuuv/sIKuYD'ZtG@3p9~Gr&d2#`(g<vtRgFj`u5w&rqpxRf2CJuY!+:wfnTOu!5Rg}jNs1ucv&RfwJvA!&3@q|BDcC#T,k/unq8w8Q5RkTklwQuzunq8w8Q5Rk9dga#!a'!a=#a0!:+Tb*b@aO.a4!aba8aFJv^}?!VyR~Dr<g;u%Rn.~<5p[x'e`wNZtR@3p]Pw:5pZhNvjBp.woe_g5u-r4JwF!%DtO3:ooc7&!#:p^3DtpLuGw(!+%)Dtk6Vz#2sd=<r8d'#Y([y#<x3gJt`w@!)%}MRiowzikRij=]ilxAf3,U(#B2Rf#g0v-Rm[ck{`U#]giKv3>)!&6Ri154s,KuGB_%@r68r:dJ|t`#X(9<E|u2@H|rx3gJu?w'!+'1Nu7Reg4=H~+9<wxgY95Rm]xLggZ-`(X}U2:Ri4h<uOawRmsJv__5@bb{jbV~3dka#a'a]!,#a+U=a>b6a3b%!/aKa/)!arwve^VyJ;:pR~DpTg3uJpS~<5pOPw;5qmPw:5pNOu!5pQJvG'!6Vyx=<qoJvA!{~Jup!%@qk7Rn/KvyD!}''[xz;>wkh'?Rh,x8gyt`w5D!&),(SgyccRgztJ@3pPB5p#d'(Y#<]mmifubw&RgoJvE&!82s^JvF&!8Rf,ADb]~;x=h'rNu]vK!,%'*0RnORh)4Rh*AqQg-vaRnNg;wHwkh'ba~4cE#Ta*x3gctyw@'!+%RnFRnD<4Rn@hFvK5RnCxWg[#`&a0Ua()`1Rm75Rg[c]%X#qi8Rg^NvdRj>BwzgZauwji7Rm6A4wgg]d1#&(*,.0a#Rm;Rm<Rm=Rm>Rm?Rm@RmARmBe%#^^^Xaea?aC/b+(,!a+a#!a/!>a&Ta<aKbD!2wphBRnk[yPw}hE|.=Br-3Dtm>6Vy~g6urRf.x,hPrNav!%'RnqRo%Ro#Nu;q[Pw;5r+JwNZtM@3r)d'#Y'Weh;xChL#`&RnmRnoKu}>%(!Rne~Bs-;2wjcussJv+'!aYSO}6@B<5?ba~8LrNvj!.%*ROwungw~ng~:9;Ri^>wtnig;wHRnixDh@|(UZ.x1h@|)!#:2<H|*xHn]#-UX'3Ro)z=iT}6ARns=Bwsn_wpnaRncw]aR(#UXa&Ua*a/=]iPd'#Y&Ro'WnXf{QRm2hNvj]nZd`'T~&1`{|`#9b]{}c:'!#Wl{>@=be}]?cl{{U#:5Abb}Jds#^YaF!a*b4a#a3aPa>&Tb!bH!*a_!Eau?/a&RjY<]gj>6Vz*;:pe~DrZg,QRj1JwNZtX@wihspcJvZ&!VyX9WmOJu|!|N2WmHJvh&!]ht~Bpbcn&T(!#RmQ<s7Nu;padH#X'`+WmJ@>RmKCARhnKup=!)&Wf+:RhqNuPpf9c!#'45pd5AwghpARn(Ls@w!%,)!RmP@Wfe<E|IJva!&WmNg8vsRmLd`*.`#Y'Xa!axRn*]hrA8Rhug5s@rXg8u!RmMd8#X'X*3@rV72smdI*#UY&RmICARho~GsgxVgd)Ta'U-Y&Xa!T#RnEWnA@Wffg1uDRi0hFvK5RnBxGnG&#`%owp)@wsf+bX}Ze-*1!a*^^^Ua|!#a.aq&Ya2!a>.a6!a:aO`aJDtL[y`@Wg#>6Vz12@wzoYRoZNuPRi!NuPRhzg=ucRi,@=b`{Yg=ucRi-ACJvB!&Sh[ebSh]ebi`wUuFRm4Jw2_[y0JvB!.<Ju(!&SoG}6Shd}6<Ju(!&SoH}6She}6Kur@._g5vHRieJvx!{L2G{Kx6gd'T#?Rh82Wi5cZ#X(g1w)Rm5dW-Y(Ta#!a)!#aYa=wnfE=su2>>bU{0j9udv:<svj8uQv-7RgHdE%#^'sq9sp=>Bb_{TJv`!&g/r|snj6v(us5d,#Y(56H}[978H}]Jw5!&g1rushJvB!+j;v{u5?zDhd}6}bj;v{u5?zDhe}6}ce*#`(^^^a[aea!=!a6a*aoXb1a.!aAbL!b>,b'aL!aV@Wf|2Wlg3[y/JwNZt^@3piPw:5pgJunZou3@rsJva&!Vy_g<v~Rm#JvG'!6Vz0=<r{Ju{%!:pj@WfsiXuJu3Rm:JvZ&!WfA~Bph@c4Z&Dtwax5rubx(#:awRk1@d,#Y&RfjRfid1#,Y(@Wfp2Wlrg5s@ryKu[@!,'=]ig9wlk?Rk>g5u-rqJvy'!@9RkQcH(T#=>Ri~@<wkj(Wj(KuZB*!&<7rw@9RkRcH(T#=>Ri}@<wkj)Wj)dg(Ta2Xa9X#`-!a*CARhg@@=I}d9x;c~#X%so=<sj>2@@=aybb}XjWv0Q~EfEj3vLv;<d,#Y(56H}`978H}_dgaPaFa'a/!#a3Y0a_a;a|!1(a7-[yE3[xt;:pJNvZrrg3uJrvJwNZt=@3pIh=rt3rxPw:5pGOu!5rpJvG'!6Vys=<rz@c4Z&Dt(ax5rtJvZ!&~BpH@wsfNg-vaRlNci*U#=<wei<F}a5@Jq.!a*JQ!%@qZ23d(#Y&RjH5]jCk!u7w&u0udARjFd/prq=tyvpaEa(a:.!a1aZ(@@=I}:9wpd%=<sX55w_h}@@=I{t=ay<aU@@=I}T=ay<2@@=I})?C9:9au@9Cb]}DP~=x-fAZ(2Wl1=ay<aU@@=I}>5@d##Y+jTv|vV~EfFj]uNpn~FRfGdgaK!Z2&!a8a-Tb({E!acTbM*!a(DtY[yYd'%Y#sl[y*hHvh>Re5x2c{Z}.j4uCvcawRiMd+#X+_x&d!},<5RkX;2Hzw@x,gavfB-!{CcF&T#Roe;RodwWbBg5urRgaKvHC*_6Vz+<4opieuew&Rmq@d]&Y)X,T#X0Rh}<BqP=4qS9:ReMg/ujReNJw0!/<Jui%!bd{kawwnemRelAxUa?a3#*.&UX(Ya+a/RhvRnQ<o}9Wmtd-#Y&RgSRmw9;Rmxay=Rmyg-vaRmuxEhSrNu,v-voC!%(aR.a(a7+1Ro1>Ro5CE{A9b]{@;5x#eO{:g;urRi+KrNA!%(Ro3>Ro79;Ri_Ku@>{;&!x%gX|{KunA_+g5QRj/g3u5Rj#g>uERj%wio/xRhS&!,!#^1U}wba{8>>@=be}qC@:D5ba{7Ku+A&!}x?ba}t>>@=be}se(aA^^^Uat!b0#{pa+awUazbGa#aLb9bgaWac'a5TbS=Br!d1#`%scp_Jvl!#rT>Re0JvX&!VyN=H{Fcm#U&:pY=ReaJv2&!]h0=]nUJvG'!6Vy|=<r%JrM_=]h2@Wlud'#)U'Wf'b]{i=]h/Jvh!&~BpWg=v]RnMx+ny#'Nu;pVwjnu=]nwxJnx,T#`&Reqwjnt=]nvieu9vrRjLLuYwP(#+!th@wih5pX~Gr'g5v/Rh4KunA'!-CARnP@wwiN:Rm_9x'cvw>!|l=<saKvAA!0&3@q}>w^e1bp#&Re2Re3BDx7gH#T|f5H|eKuZ>!%(:qNAH{]Jv6!+3B2B9=b^{X<5<B92:E{ZLvhwA(a;a%!igQuyRmad+#Y}m@3Rh5d8#X'X*:AqUAHzmaxwbh<aXRnVcF}RT#Nw&cj#U(BWnug/vsRntdka)(a3+.Zb7aYYan1!bVa@Xa}[y^@b[{G=H{+hFu73Rj&Pv#5ReQcK%T#sig1v{Rj'Ku+D#'!t]~Grm~?rkKuMB!01d5#`'Vy.ta3Dtu~Hroc8#'{^45s85AwZbP&!#Rn!wghxWn#KvEA!)&2RlA2RlBx:h|#(T,=]j09Wobz>x]z/@awRoTd+#Y(az]hFhCrm4d,#Y+jTv|Q~EfMj]uNr|~FRfOdCa!Xa9_X#@<plJvf!%b`{(9;Rgwc;.!#2x7cw#T|UDb]|T5Ju={(!=@E{&Jv)&!Ab`{'awJvf!~*>>@=be{#KuY>!+&4Ezyi[ugv&RjIdea+T)#UXa&T-T&a!Rh9auRmW=]kLg5vuRn+g3u4Rn-Ow6ARn,hHus5xNk?#UX(U~)/g8v0RkD~AwkkF?Ri.OuNBwkkA?Ri/d|a2`a*^UYa.!aBTZaTa'Xa;!(!2!-a#b2[yC>6Vyq3[xr2Wi?g1rusVh%s?DtF~<5rbJs;%!DtBfswKtCj[uvuSsEu3RgVx3o:u+wN'*Zt;@3rd~Grh~?rfg8w)Lq)qE&-a%!>bI|`jWv0vV~EfCjTv|vV~Ef@j]uNpn~FRfBcK#T']gWNu7x,k7q4ai(0!hHv8<RhmkMu9vrsBuev/RhlCJvB!,g<v{wchh~@:Rhji[vrv{wchi~@:RhkdS&a5UY#Ta!RgPwwiI5BwciI~@:Rh`x'iJvj'!5]iJPu8Bwch]~@:Rhach)U#h3rp]gLh@t|Ax,hTq3ah!-(~@:Ro0Ou!5RhXj^v(pyw8unRhVd|)`,^UYas!a?/a2Z'a^Ta{Tb7Ta(a#!a,Wf&9sZ3DtAadamov=Bqt3[xig8vsRm~>waiL2b`{QJv*_Ouv2qgj<v]v2BqfdR'X*X#Y-@3qr~Gqv~?p6hHv-]glPup5Lq+q?_%*b_{qF{n9b^{rOu4ARhpKvCD!+&~Bqp:5Dbb}nwoiKl&unuTuBv]v+ueunaXRf0=Jvh!0nKufu8v1w&w7q%w&uHrz:Rgnj5w,uxDJq/(!hNw'5ReCk0s2u3w/w'5ReFd>Za&!*UaA=<wkgsRnSJv^!%Refifw3vyRgOKu_B'!,<]gkiiu:w&Rh<=C@a^<B57@2F{[<B5@aW:=3away9A5aW=<B=C@a^<B57@2F{Ie-#`(^^^bCara.b8aza6!/bZ,!adTbnTbOb+aFaS!aAT9@Wf~2Wli3Dtl2@d,#Y&RfnRfmJwJZtN~GqyJva&!VyMg<v~Rm%iXuJu3Rm9Jv[_=]ih9wlkDRkCd1#`(@Wg>2Wls3cH#T(@<Rj*=>Ri|b~'#23s9h<~El.d'#Y&Dtxi^rzvdRl#d*#U%(o|B2s`hJwSaxRmDKv4B&!1:Rmdd5#`'Vx}to~Hq{x'f1v3(!BA5ba|bJv_&!Wfug1v]ReIdO+U/Y#&G}-8wze=Rh{g1v]ReHg/uQRf/by#)ibQwERl/cH#T(@<Rj+=>Ri{cNu+vlax-!(#a0qa9<Rii2;;bU{H;x<i=&X#Rk`<4wwi=C9H~8xAI(Y#<azRi@45wXI<B9;5bb~7dL(X#Xa(+!aL6Vy{g5QqOau:5au2@ay547EzbxOcU(UX-T#Ta#:Cbb|A?wjh/b_|SOw6ARgtihr}u7Rhy<d1#T)X1@@=I|~=ay<2@@=aybb}Sj3vLv;<d,#Y(56H}A978H}@dGpvs@uAu`vcw9*!aFa+ai%(b!aXa8.a?a[ozWey=sU2@G}Nch&U#Rf_WexKu+D#'!t:~Gr`~?r^j]uNr|~FRg*j^psurwJt|RmcKv)@&!)7Rkv~Br[@wxfO:Rl3co#U'6Rezj_q#vIuavjRltwzeyh@vr5JqD0!>aY?C9:9au@9Cb]}9cl#U*5;5<H||jbuus1ucv&Rfvg1v~d/pppzqFr^a--a~!aMat1(hFv;Wiz@@=Izoj5uuv-7Rix~Cw`fk2WlVcZ#X,k)u3vWs@u2]ktg;wEx'fBq(_2Wg/jTv|vV~EfoJv]!15x'hzqG!(P~EfU~CRl_j6v(us5x4i-#T(2WmZ?C2F|d>Kq<aj1!*jTqIsBv=Wl`~Cw`fi2WlWj`v0u*~>RlR=c>Z,k#u3vWs@u2]kr<c1Z+jTqIsBv=Wla~Cw`fm2WlXdmb3!a{(arZa`bkTa%TbQTa-a9+c'!aM!/[yL=Bqug.w'RifhFvyDRj.g>vgwyk^9]k^Jv3_@WfbAARkhJw2_[x|JvB_wkoIRoKwkoJRoLd'(Y#<]gm=<9<H|yd'%_X#skDtb3awwqkgNulRkgdB#^',9:p'hJwSaxRmEBwVb8@4=H|qLu+w50&!)@3qs~?pU>Awwn;;Rn=c:Z'ARn<=<qwKvC@!/&~BqqJv6!&]eVb^z^xRge'/a%+^`#Sge}6<4Rn3=]n0Pw2>Rn8Jw0!&>Rn:>Rn6cY#a7+!a&=<wkaNw~h3z_c5Z{=wjh#=]nLKv^D!&)Vyz=bW|swYb<WetcG#T(2wxa@qVx@gD#Y&b^|V5JwG&!5bb|pg/w&RgD@x=kHs=uAvn!a%%/'+RmSRh694Ro`g-vaRmRhHv-]mlxCcS#`&ba~.5cD#Ta)P~=d,#Y(56H{>978H{Dd_#{2^Y%_+qbbb{6g3sERhsbU{?dfa.,`a(Xa<!aiX#(55RiG54RiHcI#T'WiU3RiVNvdwtfcRlKNvdd,#Y&RlHRlExQgf.1*^T'X#Sgf}6Wn4=]hfPrk>Rn7Jw0!&>Rn5>Rn9Lunw?&a2!,5<oq@@wqfdRlJj5Q~=d,#Y(~ARfcOuN]fdDKw;ay(}i!547E}j?cI#T(@5bV}iCbV}hdv(^^Tb?a40,b##Tbo!a*bR!a<b|a/!aKai!aU[yK=]o^g:v>ReGJwPZtK<7Rh+h<~El,Pv#5ReR@awwxjCg,ulRjDJv6&!]j!z?aQeeg>w=Sh<eeJw;!&axEzOg,Qosc!#*:wkeJ]eJ>x'h-u(!%Ro.w~h.zPdNZ(X,Ya![x{;9ReY;wkgxRiF:x?ap#Y&RmUg<s2Rkod]+UY0TZ'!a&A9sw<=bczLNvuw{gqzNhJwSaxRmCKuLay!#&s_Rf-55b^{uJvZa!!c%#(55Ri654wmiu5RiuawLu,vp!+}^%b_}Y9;wkgxba}o>A9:=b^}zKuh=a''!3awRk3c*'!#aHRk6c+Z&Rk5Rk4Jv)&!awRjSawd9*`#0?C2@EzMj8u<uJ5RmbjQrquJu3x,k>uq@_+=ayb^|W~ARkEOuN]k@7dhzV^X/X&a-#zRzSb`zXcJzTT#2WkVKvDBzW!%FzY9;5bbzWjQrquJu3Jw3%!b`zU=ayb^zQd:#X(T-a!6Vyywxh}=b]{Jg=u1RiAdGp~qHtzv!w(wA+a+a;<!aJaYai'anasb(=azRmV:Cbb{MLq2vb!%')RjuRjrRjtRjqx3jnqCw3!%')Rk(Rk+Rk&Rk)Lq2vb!%')Rj{RjxRjzRjwLq2vb!%')RjsRjpRjfRjex3jcqCw3!%')Rk'Rk*RjkRjl9<CbbzfOu4ARhxLq2vb!%')RjyRjvRjhRjgx=joq*uKvb!%')+-Rk.Rk%Rj~Rk-Rk#Rj}x=jdq*uKvb!%')+-Rk,Rk!Rj|RjmRjjRjidAq&qKs@uAv8Aa.'*-a@a&0!aM@a5[y73Dsy3Ds|3Dt):wxgI2sHJwJZt.~Gqxwsf0ikrzt}Rl0Jvy_[xj~HqzKv_A|D!&WfP8axRoVcf,U#k(v]v+ueunaXRf1Ju}'!g8u#Ri=jQw!sCunLprq>!,')~<5qeGzq9F{W=c##%s5au:5aU3CBE|;d4#X(D!a&6Vygx(b;#(=]ed?C2F{N<capoq2r[a&!aPa9,'Pw;5s:@@=I|,55w_h|@@=IzcP~=x'fCqB_2Wl2>aU@@=I|1OuNBc1Z+jTqIsBv=Wlc~Cw`fl2WlZ~AcTa%!Z+jTqIsBv=Wlb~Cw`fh2WlYk+uNqJsBv=WlSg,u3dca3#UXaMYa)TaB-=cM|7T#<bI}l5@B932:aV2G{BOuNBJq:|M!5Ezt=<B=C@a^<B57@2F{v>cB{/T#=ay<bI{3Jv6!a.6BKq0ah&+!5E}HP~Ef{978BaU@@=Iza<7d#.Y#978BaU@@=IzH~AJq0!(@@=IzG978BaU@@=IzFe,aU*Y&^^^bvJb,b:bFad!a,c2Ta>aL.bo6!a#CbTa'T#Re{2Wlh2@G{yg6t~Ro_NvdRfticuRQRllJv3&!x&c|zs@Jw3!%RflwpfkRlpKuL;%(!Re<@G|C2GzdhIvuBwgjAg-u0RjAKQB%!(GzZ@G|5NuuRl7d='T+Y#Vy[g<v~Rm!==G|>JvA!)@wma=]m1ifuaw&RmnLs@vT'!|/+[y,g:v>ReTJw1!#qX=x!eC{bLu+wT&)ZtZauq_~Graci&U#F|89:r_Lupvq!.)&2RlG8RfaC=x!eF{_h?rpWlmd&'!#X|&]k::xJey#`'T|+<E|&2@H|%dE#(^,g;u.RiEg6vjRiC9xCkA{O|zY#g=ucRmXKs0@!&*@G|m@awRknJuh!,3d(}gY}eJvj!%Rm):Jw3!%Rm+Rm-Ls0w(&!a(a#@b[|6cZ#X'7RkxWgAOu4ARn'dH'U#Y*Vz-Wm'CARm}d]*#a%^a*T'aK!a<9bV{PC=p*Jw4!&SgxcbB5r]idw(wBRmF7xFkt#&`(Rm/Rm8E|!JuY_9:Rl5=wrgr2:bbxd@xXfB(a*#T+!.X0X1Ta/a'T&RlDRfL>RlyARl9b[z[>RfZ:RlL:RfRwlg/ARl;9;RlxKv,A/!%7s69<74=BA5ba{-8Bde#`a<XaKYa1,a'P~=wxfB2bZ}}?C972@@=I}r8@55B9;5bb}G978B2@@=aybb}3j3vLv;<Jw3&!>Rfk=ayb^}4~Ad1#`*@@=aybb{w2@>==<bbz]dx+UY#^UaF!a9!bB'Ya1.!ajXa#%olRhD[y=3Dt#Ov5BrHKuMB%!(Rf^Wep~HrJwkiQjKr|~FRg)Ku+D#'!t5~GrF~?rDdV)UY,Z/_7RkuG{<~BrBg,rlsO:235B@bX}|d?a1!#`(6Vyn5@d##Y+jTv|vV~EfIj]uNpn~FRfH7Lq2vb1!a9-978BaU@@=Iz9978BbU}#~AJq0!(@@=Iz8978BaU@@=Iz7~AJQ|}!978BbU}!JvkaK!AdUa21-U#`a+(g/vsRn~Ou!5RPj:rmu9WhOjXuvvNr}:RhAj^v(pyw8unRn[kPr}p|u7vwv]RiSBd;pppzq@qHQa?(b.!a.a`@.|xa(hFv;Wiyj5uuv-7Riw~Cw`fg2WlU978BbU|wOuNBJqG!(P~EfD~CRlQcZ#X,k)u3vWs@u2]ksg;wEx'f@q1_2Wg.j]uNpn~FRfqJv]!15x'h{qG!(@@=IzK~CRl^j6v(us5x4i,#T(2WmY?C2F{1>Kq<aj1!*jTqIsBv=Wld~Cw`fj2Wl[j`v0u*~>RlT=c>Z,k#u3vWs@u2]kq<c1Z+jTqIsBv=Wle~Cw`fn2Wl]dn1#c(a(b^a2!b/bAT(bj!aDa7bu,a_a{c0!2T0g:v>ReD2@G{42@G{5~DpM~<5rc=Bx6i>{RT#RnI@zCx]y]z:2Jv[!zr5Awyk]9]k]dD(Y+X#6Vz.g=wKtgwhaCwgmTWj2Lu,w%_+/[y-B;b^xeg3u3Rj-2@bX{*KrJ<!+'@Wg(g?QRlC@Jv`!%b[zIwsfII}8JQ_@w|kW|=Jv(%!AqcOuNBJvEzh!bYzjLs@wP#(0!oy@>RkdJwMZtc3Dtd@BcG#T'9bWxg2@2Fznd*#Y+;2x'c}w<zizixNgwa#Z'U+!/!a'!a+w~g~z6wcn{Rn}wcnzRn|5Rh%=]nJg5vuRmvNvdRlvcprJu}w*az*a#!%.a.'Bot9qT]kj@Wg'ay2Gzv@Jv`!%b[zEwsfHI}1;ck#Ux`<Cbbx_Lu+w!a&0*!wko*wwo,So,}6Juqxf!E}PigQuyRm`d3(`#8>Rn%:A5B;bZ~%KvhCa!a2!x>k7#Uxb@b{#xaRk7Jw0!)>wwhlShl}6>wwhmShm}6CJvB!.x'hhvj{!!5Bwkhhbaz}x'hivjz~!5Bwkhibaz|xEhTrNu,v-vpD!a%&/)a3a.,%Ro2t[CE{)@3re9b]{%wjo09:rgc:Z&Ro6=<riifuaw&RmoKrNA!%(Ro4>Ro89;Ri`dSaL'UYzxZb)7Rka3xRhT&!,!#^1U}vbaz{>>@=be}yC@:D5bazzKu+A&!}{?ba}y>>@=be}wxBh[t`u~vJvr!%a!a()a,a0a4RoC=]o;Ju(!%RoGRhdwjh`=]oAg>w#Ro?g5vuRo=NvdRl|Ku]C.!&;RoEJvB!%RoORoMBx'h[v+_?w~h`}~5?w~hd~!xKh]oiptu-utv.vp!#%&a30a@a'a+(a/aOp(o~p!RoDJu(!%RoHRhewjha=]oBNvdRl}g>w#Ro@g5vuRo>c[#X']o<CauRoRAd-#Y':RkpauRoQKu]C.!&;RoFJvB!%RoNRoPBx'h]v+_?w~ha}t5?w~he}ue!/UbhYacXaW^Tc&a;b:a-c/#b&aja1(!cL+!bKbt!bmcRc9aIc?8[yW3Dtt94Rg`Jv}!&SiRMzBhEebShEMNuPRe>x7gL#TzuwjirRipc<Z&>on;>z=h-MSh.Mwqczx'a7vj&!>Re4@=ResJt__NuPRi*NuPRi)j]uNr|~FRfzKrJ>_+@Wfy@Wf]2WocKrJ<!+'@Wg%g/QRl@@Jv`!&awRl<wsfFIzgLu(w*!.*&ShBMwvhIRhI9;RhNx1hK'!#Sn]Mx1hK~0!#:2<H~7cNu+w7D*'1ZtW>Rn1~?rOc:Z&Rn2=<rQ<7wjh&=BSnLMc]#X(6Vz)w[b=a!U#9wzgMc3#&(RgMRitRis<x,gKt`ax!&+SioM=BSilMc3#&(RgKRinRimKurB,!&SiQMzBhDebShDM6BJQ!(P~Efx978B2@@=I}WLrJw!!,a*&@G}O@9wkibRid@@x'fKwC!&SlDMSfLMjUv~Q~EfKKv3@a+!(hFv-]mpx/hYZ(C5RiWz<o/MwkhY?So/M@x,gbvfB*&!SgEM:SoeeehFu3:Rgbda(,^TZa)X/7Sg[eb:2RgI~BrMC@wgkc:wwkcRerx3h(uUvK!&*,SnOM4Sh*MArRg;wHRh(x=h;rJvPwI!a4',a'0@Wg&=BSh/Mg>w=Rh=g3w*wwgGRgGcW(X#;Sg}M2Gzk@Jv`!&awRl=wsfGIz`dKZ*T'Y-:RhR7RhQg5u-p`j6v(us5d,#Y+~Awkia?RicOuNBwkibba}Ld6p~tyu_vbAa'a+!a/'a3aEa8a!>Sh,ebJv{!&Sh@ebSaReb9;SgwebNuPRi(NvdRl)NuPRi'hHu^<Rm^Jvv_@Wl(g;u1Si/ebKu'B&!*Sh?eb@Wl'z@aPeb95Si.ebcpputyvjB)!,&a+0a%ShAMWeK@G}C@WfJ9;RhMwvhH9w{ia}ix,hJvRA1(!zAn[MRhHx1hJ~*!#hFv(BSn[MBJQ!(@@=I~'978B2@@=I}2db.Ua<'X}+T#a0XaG2G}E;wkg|wuh!Rh!x,hZu,@)!&So0MVy)C5RiXACJvB!&5RiY5RiZg8w)cG}*T#2@bU}=KsA>(!a.3wkhZba~(x,h^u(A!&(SoCMRhb5Bz=h[eb?w~hb~6x,h_u(A!&(SoDMRhc5Bz=h]eb?w~hc~6e)aA1T#T,^^^c-bMb&blcPaP(a/!0!bA=b5c@a(!bfbrc#2afwmhARnjwchORnp2Wlf3DtsNvdRl-2@wpa<]m0bx(#:awRk2@Jw3!%RfhwpfgRlnKQB%!(G{V@G|'NuuRl6d='T+Y#VyUg<v~Rl~==G|<Jv+'!aYShC}6@B<5?ba~8@Jw3'!g2QRljhLrpWlOd+#Y'g.w'rIg>w*wgj@g-u0Rj@Lu+wT&)ZtUauq]~GrGci&U#F|39:rELrNvj!.%*RhCwunfw~nf~:9;Ri]>wtnhg;wHRnhx3hDs@v~!/+'@Wfr@9RkSNu&Rlo=@<5GzoKs0@_+@Wl+@awRkmJuh!-3d(}pY#qWJvj!%Rm(:Jw3!%Rm,Rm*de&!1U-U#`)Re;@G|.@9Ri82@wjfvRlq=@<5GzpLvOvr!).&2RlF8Rf`C=x!eE{.Jw3_g2QRlkhLrpWlPde(!#U{s,UXa*Ta'[y'g:v>ReS;x0PZ&RnlRnn~HrKJw1}f!=x!eB|2w]aP(#Xa&a*Ta.Ua2a7=]iOd'#Y&Ro&WnWg;u.RiDg6vjRiBNvdRlzhNvj]nYJuW_2Wm3x)kFze{9d])!a.!,Y01!#&aC!a3RndC=ox~BrC@2b^{pg,rlse7x'ksuq!%Rm.E{xidw(wBRmGx9o+)X#wwo-So-}69:Rl4@xSf@a#XZ'X)X,Ta(/ARl8b[xc>RfY:RlI:RfQwlg.ARl:9;Rlwdn'#^XafaQa1X1TaHTa)@b[{zcZ#X'7RkwWg@Ou4ARn&x)kG#{,g7u/RkGdH'U#Y*Vz'Wm&CARm|bx#(A]gUbUzJj9Q~=d,#Y(56H}l978H{U7d,0#U*2>ABb_xZ978BbU{e~AJQ{g!978BbU{hxMh?ad{oUYZ.x1h?{l!#:2<H{mx3n[t{vl!,&a%3Ro(z=iS}6ARnr=Bwsn^wvn`Rnbd`*T}B0!#^X'BG{c9b]{a>>@=be}F?JvS!&BG{d7BG}(Bde#`a1X,Ya@!a'P~=wxf@2bZ}I56B2@@=aybb}08@55B9;5bb}<j3vLv;<Jw3&!>Rfg=ayb^}&OuNBKuLA!)a!P~=x#fD{f2@>==<bbzl?C972@@=Ix^d6rSu,v7w*C(0a)a6#B+a%!sQ[y?3Dt%3[xn~<5rLOu!5p@Ku+D#'!t7~GrP~?rNKvlaya7'!h+v-5qMg=t|cd,U#5AAaa5Abb{S@52B5@a[@52B5Gx[iXueu;d<#`a(!/549C;ag>23ExY5@Dah89b^~689Jv)!~2b[~1Lv'w(%*!a#bX|aPrmawRe]keu7uhv-q6rxu,q`xTo]/a5aU!bNaDXbi!b-!ao!b<bwA!#5@B932:aV2G|:d-)Y#hJrL>RhG<7@C5<H|_=Cau:5aj5@B932:bJ|ng>vIbs)#?C2F|9jPv0w.vISh-MKvUaz(.!9ABbb|[5;5<H|Eg>unwfh;9:4E|YjQsBt|vjx'hYq3!(?C2F|J:2<BaY?C2F|GOu!5x,g|p{ah!-(?C2F|c9:4E|OjXuvvNr}:Rh&i[w*t|cd+U#jJvsu)vsSn~Mkfrmu9p}u7vwv]So!McW#Xa!ax5@A5aY:5;5<H|>kJv~vYrquJu3x4ib#T)2@SmZM?C2F|Bj:rmu9@xPhI(a*a#U#`a3-5Abb|L~@:RhK9:4E|0@52B5G|#C::aY?C2F|-:2<BaY?C2F|.5Jvk!a)javYrquJu3x4ia#T)2@SmYM?C2F|HAxPhH(!a#U#`a*-5Abb|4~@:RhJ9:4E|R@52B5G|F:2<BaY?C2F|Sc^#Xa2j=Qq5CJvB!-g<v{z;hhM?C2F|Zi[vrv{z;hiM?C2F|XKsA>!a)-g<v{z;h[eb?C2F|]i[vrv{z;h]eb?C2F|^iZu.vix,hZq3ah!.(?C2F|QOu!5ShXM:2<BaY?C2F|P", 13494, 2713, 49, 25, 61);
});

// node_modules/entities/dist/generated/decode-data-xml.js
var xmlDecodeTree;
var init_decode_data_xml = __esm(() => {
  xmlDecodeTree = /* @__PURE__ */ new Uint16Array([
    512,
    26465,
    29036,
    7,
    0,
    2,
    4,
    116,
    24638,
    116,
    24636,
    8693,
    29807,
    24610,
    621,
    1,
    0,
    0,
    3,
    112,
    24614,
    111,
    115,
    24615
  ]);
});

// node_modules/entities/dist/internal/bin-trie-flags.js
var BinTrieFlags;
var init_bin_trie_flags = __esm(() => {
  (function(BinTrieFlags) {
    BinTrieFlags[BinTrieFlags["VALUE_LENGTH"] = 49152] = "VALUE_LENGTH";
    BinTrieFlags[BinTrieFlags["FLAG13"] = 8192] = "FLAG13";
    BinTrieFlags[BinTrieFlags["BRANCH_LENGTH"] = 8064] = "BRANCH_LENGTH";
    BinTrieFlags[BinTrieFlags["JUMP_TABLE"] = 127] = "JUMP_TABLE";
    BinTrieFlags[BinTrieFlags["VALUE_MASK"] = 8191] = "VALUE_MASK";
  })(BinTrieFlags || (BinTrieFlags = {}));
});

// node_modules/entities/dist/decode.js
function unpackConsumed(packed) {
  const consumed = packed >>> CONSUMED_SHIFT;
  return consumed === CONSUMED_OVERFLOW ? longNumericConsumed : consumed;
}
function isNumber(code) {
  return code - CharCodes.ZERO >>> 0 <= 9;
}
function isHexadecimalCharacter(code) {
  return (code | TO_LOWER_BIT) - CharCodes.LOWER_A >>> 0 <= 5;
}
function isAlpha(code) {
  return (code | TO_LOWER_BIT) - CharCodes.LOWER_A >>> 0 <= 25;
}
function isEntityInAttributeInvalidEnd(code) {
  return code === CharCodes.EQUALS || isAlpha(code) || isNumber(code);
}

class EntityDecoder {
  decodeTree;
  emitCodePoint;
  errors;
  state = EntityDecoderState.EntityStart;
  consumed = 1;
  result = 0;
  treeIndex = 0;
  excess = 1;
  decodeMode = DecodingMode.Strict;
  runConsumed = 0;
  constructor(decodeTree, emitCodePoint, errors) {
    this.decodeTree = decodeTree;
    this.emitCodePoint = emitCodePoint;
    this.errors = errors;
  }
  startEntity(decodeMode) {
    this.decodeMode = decodeMode;
    this.state = EntityDecoderState.EntityStart;
    this.result = 0;
    this.treeIndex = 0;
    this.excess = 1;
    this.consumed = 1;
    this.runConsumed = 0;
  }
  write(input, offset) {
    switch (this.state) {
      case EntityDecoderState.EntityStart: {
        if (input.charCodeAt(offset) === CharCodes.NUM) {
          this.state = EntityDecoderState.NumericStart;
          this.consumed += 1;
          return this.stateNumericStart(input, offset + 1);
        }
        this.state = EntityDecoderState.NamedEntity;
        return this.stateNamedEntity(input, offset);
      }
      case EntityDecoderState.NumericStart: {
        return this.stateNumericStart(input, offset);
      }
      case EntityDecoderState.NumericDecimal: {
        return this.stateNumericDecimal(input, offset);
      }
      case EntityDecoderState.NumericHex: {
        return this.stateNumericHex(input, offset);
      }
      default: {
        return this.stateNamedEntity(input, offset);
      }
    }
  }
  stateNumericStart(input, offset) {
    if (offset >= input.length) {
      return -1;
    }
    if ((input.charCodeAt(offset) | TO_LOWER_BIT) === CharCodes.LOWER_X) {
      this.state = EntityDecoderState.NumericHex;
      this.consumed += 1;
      return this.stateNumericHex(input, offset + 1);
    }
    this.state = EntityDecoderState.NumericDecimal;
    return this.stateNumericDecimal(input, offset);
  }
  stateNumericHex(input, offset) {
    const inputLength = input.length;
    let { result } = this;
    let { consumed } = this;
    while (offset < inputLength) {
      const char = input.charCodeAt(offset);
      if (isNumber(char) || isHexadecimalCharacter(char)) {
        const digit = char <= CharCodes.NINE ? char - CharCodes.ZERO : (char | TO_LOWER_BIT) - CharCodes.LOWER_A + 10;
        result = result * 16 + digit;
        consumed += 1;
        offset += 1;
      } else {
        this.result = result;
        this.consumed = consumed;
        return this.emitNumericEntity(char, 3);
      }
    }
    this.result = result;
    this.consumed = consumed;
    return -1;
  }
  stateNumericDecimal(input, offset) {
    const inputLength = input.length;
    let { result } = this;
    let { consumed } = this;
    while (offset < inputLength) {
      const digit = input.charCodeAt(offset) - CharCodes.ZERO;
      if (digit >>> 0 > 9) {
        this.result = result;
        this.consumed = consumed;
        return this.emitNumericEntity(digit + CharCodes.ZERO, 2);
      }
      result = result * 10 + digit;
      consumed += 1;
      offset += 1;
    }
    this.result = result;
    this.consumed = consumed;
    return -1;
  }
  emitNumericEntity(lastCp, expectedLength) {
    if (this.consumed <= expectedLength) {
      this.errors?.absenceOfDigitsInNumericCharacterReference(this.consumed);
      return 0;
    }
    if (lastCp === CharCodes.SEMI) {
      this.consumed += 1;
    } else if (this.decodeMode === DecodingMode.Strict) {
      return 0;
    }
    this.emitCodePoint((this.decodeTree === xmlDecodeTree ? replaceCodePointXML : replaceCodePoint)(this.result), this.consumed);
    if (this.errors) {
      if (lastCp !== CharCodes.SEMI) {
        this.errors.missingSemicolonAfterCharacterReference();
      }
      this.errors.validateNumericCharacterReference(this.result);
    }
    return this.consumed;
  }
  flushAndEmitLegacyOrReject(consumed, excess, char, valueLength) {
    this.consumed = consumed;
    this.excess = excess;
    return this.result === 0 || this.decodeMode === DecodingMode.Attribute && (valueLength === 0 || excess > 1 || isEntityInAttributeInvalidEnd(char)) ? 0 : this.emitNotTerminatedNamedEntity();
  }
  stateNamedEntity(input, offset) {
    const { decodeTree } = this;
    const inputLength = input.length;
    const isStrict = this.decodeMode === DecodingMode.Strict;
    let { treeIndex } = this;
    let { excess } = this;
    let { consumed } = this;
    let current = decodeTree[treeIndex];
    while (offset < inputLength) {
      while ((current & (BinTrieFlags.VALUE_LENGTH | BinTrieFlags.FLAG13)) === 0 && (current & BinTrieFlags.JUMP_TABLE) !== 0) {
        const char = input.charCodeAt(offset);
        const jumpOffset = current & BinTrieFlags.JUMP_TABLE;
        const branchCount = (current & BinTrieFlags.BRANCH_LENGTH) >> 7;
        if (branchCount === 0) {
          if (char !== jumpOffset) {
            return this.flushAndEmitLegacyOrReject(consumed, excess, char, 0);
          }
          treeIndex += 1;
        } else {
          const slot = char - jumpOffset;
          if (slot >>> 0 >= branchCount) {
            return this.flushAndEmitLegacyOrReject(consumed, excess, char, 0);
          }
          const stored = decodeTree[treeIndex + 1 + slot];
          if (stored === 0) {
            return this.flushAndEmitLegacyOrReject(consumed, excess, char, 0);
          }
          treeIndex = treeIndex + branchCount + stored & 65535;
        }
        current = decodeTree[treeIndex];
        offset += 1;
        excess += 1;
        if (offset >= inputLength)
          break;
      }
      if (offset >= inputLength)
        break;
      if ((current & (BinTrieFlags.VALUE_LENGTH | BinTrieFlags.FLAG13)) === BinTrieFlags.FLAG13) {
        const runLength = (current & BinTrieFlags.BRANCH_LENGTH) >> 7;
        let { runConsumed } = this;
        if (runConsumed === 0) {
          const char = input.charCodeAt(offset);
          if (char !== (current & BinTrieFlags.JUMP_TABLE)) {
            return this.flushAndEmitLegacyOrReject(consumed, excess, char, 0);
          }
          offset += 1;
          excess += 1;
          runConsumed = 1;
        }
        while (runConsumed < runLength) {
          if (offset >= inputLength) {
            this.treeIndex = treeIndex;
            this.excess = excess;
            this.consumed = consumed;
            this.runConsumed = runConsumed;
            return -1;
          }
          const charIndexInPacked = runConsumed - 1;
          const packedWord = decodeTree[treeIndex + 1 + (charIndexInPacked >> 1)];
          const expectedChar = packedWord >> ((charIndexInPacked & 1) << 3) & 255;
          const char = input.charCodeAt(offset);
          if (char !== expectedChar) {
            this.runConsumed = 0;
            return this.flushAndEmitLegacyOrReject(consumed, excess, char, 0);
          }
          offset += 1;
          excess += 1;
          runConsumed += 1;
        }
        this.runConsumed = 0;
        treeIndex += 1 + (runLength >> 1);
        current = decodeTree[treeIndex];
        continue;
      }
      const valueLength = current >>> 14;
      const char = input.charCodeAt(offset);
      if (valueLength !== 0) {
        if (!isStrict && (current & BinTrieFlags.FLAG13) === 0) {
          this.result = treeIndex;
          consumed += excess - 1;
          excess = 1;
        }
        if (char === CharCodes.SEMI) {
          return this.emitNamedEntityData(treeIndex, valueLength, consumed + excess);
        }
        if (valueLength === 1) {
          return this.flushAndEmitLegacyOrReject(consumed, excess, char, valueLength);
        }
      }
      const next = determineBranch(decodeTree, current, treeIndex + (valueLength || 1), char);
      if (next < 0) {
        return this.flushAndEmitLegacyOrReject(consumed, excess, char, valueLength);
      }
      treeIndex = next;
      current = decodeTree[treeIndex];
      offset += 1;
      excess += 1;
    }
    if (!isStrict && current >>> 14 !== 0 && (current & BinTrieFlags.FLAG13) === 0) {
      this.result = treeIndex;
      consumed += excess - 1;
      excess = 1;
    }
    this.treeIndex = treeIndex;
    this.excess = excess;
    this.consumed = consumed;
    return -1;
  }
  emitNotTerminatedNamedEntity() {
    const { result, decodeTree } = this;
    const valueLength = decodeTree[result] >>> 14;
    this.emitNamedEntityData(result, valueLength, this.consumed);
    this.errors?.missingSemicolonAfterCharacterReference();
    return this.consumed;
  }
  emitNamedEntityData(result, valueLength, consumed) {
    const { decodeTree } = this;
    this.emitCodePoint(valueLength === 1 ? decodeTree[result] & BinTrieFlags.VALUE_MASK : decodeTree[result + 1], consumed);
    if (valueLength === 3) {
      this.emitCodePoint(decodeTree[result + 2], consumed);
    }
    return consumed;
  }
  end() {
    switch (this.state) {
      case EntityDecoderState.NamedEntity: {
        return this.result !== 0 && (this.decodeMode !== DecodingMode.Attribute || this.result === this.treeIndex) ? this.emitNotTerminatedNamedEntity() : 0;
      }
      case EntityDecoderState.NumericDecimal: {
        return this.emitNumericEntity(0, 2);
      }
      case EntityDecoderState.NumericHex: {
        return this.emitNumericEntity(0, 3);
      }
      case EntityDecoderState.NumericStart: {
        this.errors?.absenceOfDigitsInNumericCharacterReference(this.consumed);
        return 0;
      }
      default: {
        return 0;
      }
    }
  }
}
function determineBranch(decodeTree, current, nodeIndex, char) {
  const branchCount = (current & BinTrieFlags.BRANCH_LENGTH) >> 7;
  const jumpOffset = current & BinTrieFlags.JUMP_TABLE;
  if (jumpOffset) {
    if (branchCount === 0) {
      return char === jumpOffset ? nodeIndex : -1;
    }
    const slot = char - jumpOffset;
    if (slot >>> 0 >= branchCount)
      return -1;
    const stored = decodeTree[nodeIndex + slot];
    return stored === 0 ? -1 : nodeIndex + branchCount + stored - 1 & 65535;
  }
  if (branchCount === 0)
    return -1;
  const packedKeySlots = branchCount + 1 >> 1;
  const branchEnd = nodeIndex + packedKeySlots + branchCount;
  for (let index = 0;index < branchCount; index++) {
    const packed = decodeTree[nodeIndex + (index >> 1)];
    const key = packed >> ((index & 1) << 3) & 255;
    if (key === char) {
      const pointerIndex = nodeIndex + packedKeySlots + index;
      return branchEnd + decodeTree[pointerIndex] & 65535;
    }
    if (key > char)
      return -1;
  }
  return -1;
}
function readTrieValue(decodeTree, nodeIndex, valueLength) {
  if (valueLength === 1) {
    return String.fromCharCode(decodeTree[nodeIndex] & BinTrieFlags.VALUE_MASK);
  }
  if (valueLength === 2) {
    return String.fromCharCode(decodeTree[nodeIndex + 1]);
  }
  return String.fromCharCode(decodeTree[nodeIndex + 1], decodeTree[nodeIndex + 2]);
}
function parseNumericEntity(input, numberStart, inputLength) {
  let offset = numberStart + 1;
  let cp = 0;
  let digitStart = offset;
  if (offset < inputLength && (input.charCodeAt(offset) | TO_LOWER_BIT) === CharCodes.LOWER_X) {
    offset += 1;
    digitStart = offset;
    while (offset < inputLength) {
      const char = input.charCodeAt(offset);
      if (isNumber(char)) {
        cp = cp * 16 + (char - CharCodes.ZERO);
      } else if (isHexadecimalCharacter(char)) {
        cp = cp * 16 + ((char | TO_LOWER_BIT) - CharCodes.LOWER_A + 10);
      } else {
        break;
      }
      offset += 1;
    }
  } else {
    while (offset < inputLength) {
      const digit = input.charCodeAt(offset) - CharCodes.ZERO;
      if (digit >>> 0 > 9)
        break;
      cp = cp * 10 + digit;
      offset += 1;
    }
  }
  if (offset === digitStart)
    return 0;
  if (offset < inputLength && input.charCodeAt(offset) === CharCodes.SEMI) {
    offset += 1;
  }
  if (cp > 1114111)
    cp = 1114112;
  let consumed = offset - numberStart;
  if (consumed >= CONSUMED_OVERFLOW) {
    longNumericConsumed = consumed;
    consumed = CONSUMED_OVERFLOW;
  }
  return consumed << CONSUMED_SHIFT | cp;
}
function decodeWithTrie(input, isStrict, isAttribute) {
  const decodeTree = htmlDecodeTree;
  let offset = input.indexOf("&");
  if (offset < 0)
    return input;
  const inputLength = input.length;
  let chunkStart = 0;
  let result = "";
  const root = decodeTree[0];
  const rootJumpOffset = root & BinTrieFlags.JUMP_TABLE;
  const rootBranchCount = (root & BinTrieFlags.BRANCH_LENGTH) >> 7;
  do {
    const entityStart = offset + 1;
    const firstChar = input.charCodeAt(entityStart);
    let consumed;
    let value;
    if (firstChar === CharCodes.NUM) {
      const packed = parseNumericEntity(input, entityStart, inputLength);
      consumed = unpackConsumed(packed);
      if (isStrict && consumed > 0 && input.charCodeAt(entityStart + consumed - 1) !== CharCodes.SEMI) {
        consumed = 0;
      }
      value = consumed === 0 ? "" : codePointToString(packed & CODE_POINT_MASK);
    } else if (isAlpha(firstChar)) {
      consumed = 0;
      value = "";
      const rootSlotIndex = firstChar - rootJumpOffset;
      let nodeIndex;
      if (rootSlotIndex >>> 0 < rootBranchCount) {
        const stored = decodeTree[1 + rootSlotIndex];
        nodeIndex = stored === 0 ? -1 : rootBranchCount + stored & 65535;
      } else {
        nodeIndex = -1;
      }
      let bestNodeIndex = 0;
      let bestValueLength = 0;
      let current = nodeIndex < 0 ? 0 : decodeTree[nodeIndex];
      let index = entityStart + 1;
      trie:
        while (index < inputLength) {
          while ((current & (BinTrieFlags.VALUE_LENGTH | BinTrieFlags.FLAG13)) === 0 && (current & BinTrieFlags.JUMP_TABLE) !== 0) {
            const jumpOffset = current & BinTrieFlags.JUMP_TABLE;
            const branchCount = (current & BinTrieFlags.BRANCH_LENGTH) >> 7;
            if (branchCount === 0) {
              if (input.charCodeAt(index) !== jumpOffset)
                break trie;
              nodeIndex += 1;
            } else {
              const slot = input.charCodeAt(index) - jumpOffset;
              if (slot >>> 0 >= branchCount)
                break trie;
              const stored = decodeTree[nodeIndex + 1 + slot];
              if (stored === 0)
                break trie;
              nodeIndex = nodeIndex + branchCount + stored & 65535;
            }
            current = decodeTree[nodeIndex];
            index += 1;
            if (index >= inputLength)
              break trie;
          }
          if ((current & (BinTrieFlags.VALUE_LENGTH | BinTrieFlags.FLAG13)) === BinTrieFlags.FLAG13) {
            const runLength = (current & BinTrieFlags.BRANCH_LENGTH) >> 7;
            if (input.charCodeAt(index) !== (current & BinTrieFlags.JUMP_TABLE)) {
              break;
            }
            index += 1;
            const remaining = runLength - 1;
            let wordIndex = nodeIndex + 1;
            let charIndexInPacked = 0;
            for (;charIndexInPacked + 1 < remaining; charIndexInPacked += 2) {
              const packed = decodeTree[wordIndex];
              if (input.charCodeAt(index) !== (packed & 255))
                break trie;
              index += 1;
              if (input.charCodeAt(index) !== (packed >> 8 & 255))
                break trie;
              index += 1;
              wordIndex += 1;
            }
            if (charIndexInPacked < remaining) {
              if (input.charCodeAt(index) !== (decodeTree[wordIndex] & 255))
                break;
              index += 1;
            }
            nodeIndex += 1 + (runLength >> 1);
            current = decodeTree[nodeIndex];
            continue;
          }
          const valueLength = current >>> 14;
          const char = input.charCodeAt(index);
          if (valueLength !== 0) {
            if (char === CharCodes.SEMI) {
              consumed = index - entityStart + 1;
              value = valueLength === 1 ? String.fromCharCode(current & BinTrieFlags.VALUE_MASK) : readTrieValue(decodeTree, nodeIndex, valueLength);
              break;
            }
            if (!isStrict && (current & BinTrieFlags.FLAG13) === 0) {
              consumed = index - entityStart;
              bestNodeIndex = nodeIndex;
              bestValueLength = valueLength;
            }
            if (valueLength === 1)
              break;
          }
          const next = determineBranch(decodeTree, current, nodeIndex + (valueLength || 1), char);
          if (next < 0)
            break;
          nodeIndex = next;
          current = decodeTree[nodeIndex];
          index += 1;
        }
      if (value === "") {
        const finalVL = current >>> 14;
        if (finalVL !== 0 && !isStrict && (current & BinTrieFlags.FLAG13) === 0) {
          consumed = index - entityStart;
          bestNodeIndex = nodeIndex;
          bestValueLength = finalVL;
        }
        if (consumed > 0) {
          value = readTrieValue(decodeTree, bestNodeIndex, bestValueLength);
        }
      }
    } else {
      consumed = 0;
      value = "";
    }
    if (consumed === 0 || isAttribute && firstChar !== CharCodes.NUM && input.charCodeAt(entityStart + consumed - 1) !== CharCodes.SEMI && entityStart + consumed < inputLength && isEntityInAttributeInvalidEnd(input.charCodeAt(entityStart + consumed))) {
      offset = entityStart;
    } else {
      if (chunkStart < offset) {
        result += input.slice(chunkStart, offset);
      }
      result += value;
      offset = chunkStart = entityStart + consumed;
    }
    if (input.charCodeAt(offset) !== CharCodes.AMP) {
      offset = input.indexOf("&", offset);
    }
  } while (offset >= 0);
  return result + input.slice(chunkStart);
}
function decodeHTMLAttribute(htmlAttribute) {
  return decodeWithTrie(htmlAttribute, false, true);
}
var CharCodes, TO_LOWER_BIT = 32, CONSUMED_SHIFT = 21, CODE_POINT_MASK = 2097151, CONSUMED_OVERFLOW = 2047, longNumericConsumed = 0, EntityDecoderState, DecodingMode;
var init_decode = __esm(() => {
  init_decode_codepoint();
  init_decode_data_html();
  init_decode_data_xml();
  init_bin_trie_flags();
  init_decode_data_html();
  init_decode_data_xml();
  (function(CharCodes) {
    CharCodes[CharCodes["AMP"] = 38] = "AMP";
    CharCodes[CharCodes["NUM"] = 35] = "NUM";
    CharCodes[CharCodes["SEMI"] = 59] = "SEMI";
    CharCodes[CharCodes["EQUALS"] = 61] = "EQUALS";
    CharCodes[CharCodes["ZERO"] = 48] = "ZERO";
    CharCodes[CharCodes["NINE"] = 57] = "NINE";
    CharCodes[CharCodes["LOWER_A"] = 97] = "LOWER_A";
    CharCodes[CharCodes["LOWER_X"] = 120] = "LOWER_X";
  })(CharCodes || (CharCodes = {}));
  (function(EntityDecoderState) {
    EntityDecoderState[EntityDecoderState["EntityStart"] = 0] = "EntityStart";
    EntityDecoderState[EntityDecoderState["NumericStart"] = 1] = "NumericStart";
    EntityDecoderState[EntityDecoderState["NumericDecimal"] = 2] = "NumericDecimal";
    EntityDecoderState[EntityDecoderState["NumericHex"] = 3] = "NumericHex";
    EntityDecoderState[EntityDecoderState["NamedEntity"] = 4] = "NamedEntity";
  })(EntityDecoderState || (EntityDecoderState = {}));
  (function(DecodingMode) {
    DecodingMode[DecodingMode["Legacy"] = 0] = "Legacy";
    DecodingMode[DecodingMode["Strict"] = 1] = "Strict";
    DecodingMode[DecodingMode["Attribute"] = 2] = "Attribute";
  })(DecodingMode || (DecodingMode = {}));
});

// node_modules/sanitize-html/node_modules/htmlparser2/dist/Tokenizer.js
function isWhitespace(c) {
  return c === CharCodes2.Space || c === CharCodes2.NewLine || c === CharCodes2.Tab || c === CharCodes2.FormFeed || c === CharCodes2.CarriageReturn;
}
function isEndOfTagSection(c) {
  return c === CharCodes2.Slash || c === CharCodes2.Gt || isWhitespace(c);
}
function isASCIIAlpha(c) {
  return c >= CharCodes2.LowerA && c <= CharCodes2.LowerZ || c >= CharCodes2.UpperA && c <= CharCodes2.UpperZ;
}

class Tokenizer {
  cbs;
  state = State.Text;
  buffer = "";
  sectionStart = 0;
  index = 0;
  entityStart = 0;
  baseState = State.Text;
  isSpecial = false;
  running = true;
  offset = 0;
  xmlMode;
  decodeEntities;
  recognizeSelfClosing;
  entityDecoder;
  constructor({ xmlMode = false, decodeEntities = true, recognizeSelfClosing = xmlMode }, cbs) {
    this.cbs = cbs;
    this.xmlMode = xmlMode;
    this.decodeEntities = decodeEntities;
    this.recognizeSelfClosing = recognizeSelfClosing;
    this.entityDecoder = new EntityDecoder(xmlMode ? xmlDecodeTree : htmlDecodeTree, (cp, consumed) => this.emitCodePoint(cp, consumed));
  }
  reset() {
    this.state = State.Text;
    this.buffer = "";
    this.sectionStart = 0;
    this.index = 0;
    this.baseState = State.Text;
    this.isSpecial = false;
    this.currentSequence = Sequences.Empty;
    this.sequenceIndex = 0;
    this.running = true;
    this.offset = 0;
  }
  write(chunk) {
    this.offset += this.buffer.length;
    this.buffer = chunk;
    this.parse();
  }
  end() {
    if (this.running)
      this.finish();
  }
  pause() {
    this.running = false;
  }
  resume() {
    this.running = true;
    if (this.index < this.buffer.length + this.offset) {
      this.parse();
    }
  }
  stateText(c) {
    if (c === CharCodes2.Lt || !this.decodeEntities && this.fastForwardTo(CharCodes2.Lt)) {
      if (this.index > this.sectionStart) {
        this.cbs.ontext(this.sectionStart, this.index);
      }
      this.state = State.BeforeTagName;
      this.sectionStart = this.index;
    } else if (this.decodeEntities && c === CharCodes2.Amp) {
      this.startEntity();
    }
  }
  currentSequence = Sequences.Empty;
  sequenceIndex = 0;
  enterTagBody() {
    if (this.currentSequence === Sequences.Plaintext) {
      this.currentSequence = Sequences.Empty;
      this.state = State.InPlainText;
    } else if (this.isSpecial) {
      this.state = State.InSpecialTag;
      this.sequenceIndex = 0;
    } else {
      this.state = State.Text;
    }
  }
  stateSpecialStartSequence(c) {
    const lower = c | 32;
    if (this.sequenceIndex < this.currentSequence.length) {
      if (lower === this.currentSequence[this.sequenceIndex]) {
        this.sequenceIndex++;
        return;
      }
      if (this.sequenceIndex === 3) {
        if (this.currentSequence === Sequences.ScriptEnd && lower === Sequences.StyleEnd[3]) {
          this.currentSequence = Sequences.StyleEnd;
          this.sequenceIndex = 4;
          return;
        }
        if (this.currentSequence === Sequences.TitleEnd && lower === Sequences.TextareaEnd[3]) {
          this.currentSequence = Sequences.TextareaEnd;
          this.sequenceIndex = 4;
          return;
        }
      } else if (this.sequenceIndex === 4 && this.currentSequence === Sequences.NoembedEnd && lower === Sequences.NoframesEnd[4]) {
        this.currentSequence = Sequences.NoframesEnd;
        this.sequenceIndex = 5;
        return;
      }
    } else if (isEndOfTagSection(c)) {
      this.sequenceIndex = 0;
      this.state = State.InTagName;
      this.stateInTagName(c);
      return;
    }
    this.isSpecial = false;
    this.currentSequence = Sequences.Empty;
    this.sequenceIndex = 0;
    this.state = State.InTagName;
    this.stateInTagName(c);
  }
  stateCDATASequence(c) {
    if (c === Sequences.Cdata[this.sequenceIndex]) {
      if (++this.sequenceIndex === Sequences.Cdata.length) {
        this.state = State.InCommentLike;
        this.currentSequence = Sequences.CdataEnd;
        this.sequenceIndex = 0;
        this.sectionStart = this.index + 1;
      }
    } else {
      this.sequenceIndex = 0;
      if (this.xmlMode) {
        this.state = State.InDeclaration;
        this.stateInDeclaration(c);
      } else {
        this.state = State.InSpecialComment;
        this.stateInSpecialComment(c);
      }
    }
  }
  fastForwardTo(c) {
    while (++this.index < this.buffer.length + this.offset) {
      if (this.buffer.charCodeAt(this.index - this.offset) === c) {
        return true;
      }
    }
    this.index = this.buffer.length + this.offset - 1;
    return false;
  }
  emitComment(offset) {
    this.cbs.oncomment(this.sectionStart, this.index, offset);
    this.sequenceIndex = 0;
    this.sectionStart = this.index + 1;
    this.state = State.Text;
  }
  stateInCommentLike(c) {
    if (!this.xmlMode && this.currentSequence === Sequences.CommentEnd && this.sequenceIndex <= 1 && this.index === this.sectionStart + this.sequenceIndex && c === CharCodes2.Gt) {
      this.emitComment(this.sequenceIndex);
    } else if (this.currentSequence === Sequences.CommentEnd && this.sequenceIndex === 2 && c === CharCodes2.Gt) {
      this.emitComment(2);
    } else if (this.currentSequence === Sequences.CommentEnd && this.sequenceIndex === this.currentSequence.length - 1 && c !== CharCodes2.Gt) {
      this.sequenceIndex = Number(c === CharCodes2.Dash);
    } else if (c === this.currentSequence[this.sequenceIndex]) {
      if (++this.sequenceIndex === this.currentSequence.length) {
        if (this.currentSequence === Sequences.CdataEnd) {
          this.cbs.oncdata(this.sectionStart, this.index, 2);
        } else {
          this.cbs.oncomment(this.sectionStart, this.index, 3);
        }
        this.sequenceIndex = 0;
        this.sectionStart = this.index + 1;
        this.state = State.Text;
      }
    } else if (this.sequenceIndex === 0) {
      if (this.fastForwardTo(this.currentSequence[0])) {
        this.sequenceIndex = 1;
      }
    } else if (c !== this.currentSequence[this.sequenceIndex - 1]) {
      this.sequenceIndex = 0;
    }
  }
  isTagStartChar(c) {
    return this.xmlMode ? !isEndOfTagSection(c) : isASCIIAlpha(c);
  }
  stateInSpecialTag(c) {
    if (this.sequenceIndex === this.currentSequence.length) {
      if (isEndOfTagSection(c)) {
        const endOfText = this.index - this.currentSequence.length;
        if (this.sectionStart < endOfText) {
          const actualIndex = this.index;
          this.index = endOfText;
          this.cbs.ontext(this.sectionStart, endOfText);
          this.index = actualIndex;
        }
        this.isSpecial = false;
        this.sectionStart = endOfText + 2;
        this.stateInClosingTagName(c);
        return;
      }
      this.sequenceIndex = 0;
    }
    if ((c | 32) === this.currentSequence[this.sequenceIndex]) {
      this.sequenceIndex += 1;
    } else if (this.sequenceIndex === 0) {
      if (this.currentSequence === Sequences.TitleEnd || this.currentSequence === Sequences.TextareaEnd) {
        if (this.decodeEntities && c === CharCodes2.Amp) {
          this.startEntity();
        }
      } else if (this.fastForwardTo(CharCodes2.Lt)) {
        this.sequenceIndex = 1;
      }
    } else {
      this.sequenceIndex = Number(c === CharCodes2.Lt);
    }
  }
  stateBeforeTagName(c) {
    if (c === CharCodes2.ExclamationMark) {
      this.state = State.BeforeDeclaration;
      this.sectionStart = this.index + 1;
    } else if (c === CharCodes2.Questionmark) {
      if (this.xmlMode) {
        this.state = State.InProcessingInstruction;
        this.sequenceIndex = 0;
        this.sectionStart = this.index + 1;
      } else {
        this.state = State.InSpecialComment;
        this.sectionStart = this.index;
      }
    } else if (this.isTagStartChar(c)) {
      this.sectionStart = this.index;
      const special = this.xmlMode || this.cbs.isInForeignContext?.() ? undefined : specialStartSequences.get(c | 32);
      if (special === undefined) {
        this.state = State.InTagName;
      } else {
        this.isSpecial = true;
        this.currentSequence = special;
        this.sequenceIndex = 3;
        this.state = State.SpecialStartSequence;
      }
    } else if (c === CharCodes2.Slash) {
      this.state = State.BeforeClosingTagName;
    } else {
      this.state = State.Text;
      this.stateText(c);
    }
  }
  stateInTagName(c) {
    if (isEndOfTagSection(c)) {
      this.cbs.onopentagname(this.sectionStart, this.index);
      this.sectionStart = -1;
      this.state = State.BeforeAttributeName;
      this.stateBeforeAttributeName(c);
    }
  }
  stateBeforeClosingTagName(c) {
    if (isWhitespace(c)) {
      if (this.xmlMode) {} else {
        this.state = State.InSpecialComment;
        this.sectionStart = this.index;
      }
    } else if (c === CharCodes2.Gt) {
      this.state = State.Text;
      if (!this.xmlMode) {
        this.sectionStart = this.index + 1;
      }
    } else {
      this.state = this.isTagStartChar(c) ? State.InClosingTagName : State.InSpecialComment;
      this.sectionStart = this.index;
    }
  }
  stateInClosingTagName(c) {
    if (isEndOfTagSection(c)) {
      this.cbs.onclosetag(this.sectionStart, this.index);
      this.sectionStart = -1;
      this.state = State.AfterClosingTagName;
      this.stateAfterClosingTagName(c);
    }
  }
  stateAfterClosingTagName(c) {
    if (c === CharCodes2.Gt || this.fastForwardTo(CharCodes2.Gt)) {
      this.state = State.Text;
      this.sectionStart = this.index + 1;
    }
  }
  stateBeforeAttributeName(c) {
    if (c === CharCodes2.Gt) {
      this.cbs.onopentagend(this.index);
      this.enterTagBody();
      this.sectionStart = this.index + 1;
    } else if (c === CharCodes2.Slash) {
      this.state = State.InSelfClosingTag;
    } else if (!isWhitespace(c)) {
      this.state = State.InAttributeName;
      this.sectionStart = this.index;
    }
  }
  stateInSelfClosingTag(c) {
    if (c === CharCodes2.Gt) {
      this.cbs.onselfclosingtag(this.index);
      this.sectionStart = this.index + 1;
      if (!this.recognizeSelfClosing) {
        this.enterTagBody();
        return;
      }
      this.state = State.Text;
      this.isSpecial = false;
      this.currentSequence = Sequences.Empty;
    } else if (!isWhitespace(c)) {
      this.state = State.BeforeAttributeName;
      this.stateBeforeAttributeName(c);
    }
  }
  stateInAttributeName(c) {
    if (c === CharCodes2.Eq || isEndOfTagSection(c)) {
      this.cbs.onattribname(this.sectionStart, this.index);
      this.sectionStart = this.index;
      this.state = State.AfterAttributeName;
      this.stateAfterAttributeName(c);
    }
  }
  stateAfterAttributeName(c) {
    if (c === CharCodes2.Eq) {
      this.state = State.BeforeAttributeValue;
    } else if (c === CharCodes2.Slash || c === CharCodes2.Gt) {
      this.cbs.onattribend(QuoteType.NoValue, this.sectionStart);
      this.sectionStart = -1;
      this.state = State.BeforeAttributeName;
      this.stateBeforeAttributeName(c);
    } else if (!isWhitespace(c)) {
      this.cbs.onattribend(QuoteType.NoValue, this.sectionStart);
      this.state = State.InAttributeName;
      this.sectionStart = this.index;
    }
  }
  stateBeforeAttributeValue(c) {
    if (c === CharCodes2.DoubleQuote) {
      this.state = State.InAttributeValueDq;
      this.sectionStart = this.index + 1;
    } else if (c === CharCodes2.SingleQuote) {
      this.state = State.InAttributeValueSq;
      this.sectionStart = this.index + 1;
    } else if (!isWhitespace(c)) {
      this.sectionStart = this.index;
      this.state = State.InAttributeValueNq;
      this.stateInAttributeValueNoQuotes(c);
    }
  }
  handleInAttributeValue(c, quote) {
    if (c === quote || !this.decodeEntities && this.fastForwardTo(quote)) {
      this.cbs.onattribdata(this.sectionStart, this.index);
      this.sectionStart = -1;
      this.cbs.onattribend(quote === CharCodes2.DoubleQuote ? QuoteType.Double : QuoteType.Single, this.index + 1);
      this.state = State.BeforeAttributeName;
    } else if (this.decodeEntities && c === CharCodes2.Amp) {
      this.startEntity();
    }
  }
  stateInAttributeValueDoubleQuotes(c) {
    this.handleInAttributeValue(c, CharCodes2.DoubleQuote);
  }
  stateInAttributeValueSingleQuotes(c) {
    this.handleInAttributeValue(c, CharCodes2.SingleQuote);
  }
  stateInAttributeValueNoQuotes(c) {
    if (isWhitespace(c) || c === CharCodes2.Gt) {
      this.cbs.onattribdata(this.sectionStart, this.index);
      this.sectionStart = -1;
      this.cbs.onattribend(QuoteType.Unquoted, this.index);
      this.state = State.BeforeAttributeName;
      this.stateBeforeAttributeName(c);
    } else if (this.decodeEntities && c === CharCodes2.Amp) {
      this.startEntity();
    }
  }
  stateBeforeDeclaration(c) {
    if (c === CharCodes2.OpeningSquareBracket) {
      this.state = State.CDATASequence;
      this.sequenceIndex = 0;
    } else if (this.xmlMode) {
      this.state = c === CharCodes2.Dash ? State.BeforeComment : State.InDeclaration;
    } else if ((c | 32) === Sequences.Doctype[0]) {
      this.state = State.DeclarationSequence;
      this.currentSequence = Sequences.Doctype;
      this.sequenceIndex = 1;
    } else if (c === CharCodes2.Gt) {
      this.cbs.oncomment(this.sectionStart, this.index, 0);
      this.state = State.Text;
      this.sectionStart = this.index + 1;
    } else if (c === CharCodes2.Dash) {
      this.state = State.BeforeComment;
    } else {
      this.state = State.InSpecialComment;
    }
  }
  stateDeclarationSequence(c) {
    if (this.sequenceIndex === this.currentSequence.length) {
      this.state = State.InDeclaration;
      this.stateInDeclaration(c);
    } else if ((c | 32) === this.currentSequence[this.sequenceIndex]) {
      this.sequenceIndex += 1;
    } else if (c === CharCodes2.Gt) {
      this.cbs.oncomment(this.sectionStart, this.index, 0);
      this.state = State.Text;
      this.sectionStart = this.index + 1;
    } else {
      this.state = State.InSpecialComment;
    }
  }
  stateInDeclaration(c) {
    if (c === CharCodes2.Gt || this.fastForwardTo(CharCodes2.Gt)) {
      this.cbs.ondeclaration(this.sectionStart, this.index);
      this.state = State.Text;
      this.sectionStart = this.index + 1;
    }
  }
  stateInProcessingInstruction(c) {
    if (c === CharCodes2.Questionmark) {
      this.sequenceIndex = 1;
    } else if (c === CharCodes2.Gt && this.sequenceIndex === 1) {
      this.cbs.onprocessinginstruction(this.sectionStart, this.index - 1);
      this.sequenceIndex = 0;
      this.state = State.Text;
      this.sectionStart = this.index + 1;
    } else {
      this.sequenceIndex = Number(this.fastForwardTo(CharCodes2.Questionmark));
    }
  }
  stateBeforeComment(c) {
    if (c === CharCodes2.Dash) {
      this.state = State.InCommentLike;
      this.currentSequence = Sequences.CommentEnd;
      this.sequenceIndex = 0;
      this.sectionStart = this.index + 1;
    } else if (this.xmlMode) {
      this.state = State.InDeclaration;
    } else if (c === CharCodes2.Gt) {
      this.cbs.oncomment(this.sectionStart, this.index, 0);
      this.state = State.Text;
      this.sectionStart = this.index + 1;
    } else {
      this.state = State.InSpecialComment;
    }
  }
  stateInSpecialComment(c) {
    if (c === CharCodes2.Gt || this.fastForwardTo(CharCodes2.Gt)) {
      this.cbs.oncomment(this.sectionStart, this.index, 0);
      this.state = State.Text;
      this.sectionStart = this.index + 1;
    }
  }
  startEntity() {
    this.baseState = this.state;
    this.state = State.InEntity;
    this.entityStart = this.index;
    this.entityDecoder.startEntity(this.xmlMode ? DecodingMode.Strict : this.baseState === State.Text || this.baseState === State.InSpecialTag ? DecodingMode.Legacy : DecodingMode.Attribute);
  }
  stateInEntity() {
    const indexInBuffer = this.index - this.offset;
    const length = this.entityDecoder.write(this.buffer, indexInBuffer);
    if (length >= 0) {
      this.state = this.baseState;
      if (length === 0) {
        this.index -= 1;
      }
    } else {
      if (indexInBuffer < this.buffer.length && this.buffer.charCodeAt(indexInBuffer) === CharCodes2.Amp) {
        this.state = this.baseState;
        this.index -= 1;
        return;
      }
      this.index = this.offset + this.buffer.length - 1;
    }
  }
  cleanup() {
    if (this.running && this.sectionStart !== this.index) {
      if (this.state === State.Text || this.state === State.InPlainText || this.state === State.InSpecialTag && this.sequenceIndex === 0) {
        this.cbs.ontext(this.sectionStart, this.index);
        this.sectionStart = this.index;
      } else if (this.state === State.InAttributeValueDq || this.state === State.InAttributeValueSq || this.state === State.InAttributeValueNq) {
        this.cbs.onattribdata(this.sectionStart, this.index);
        this.sectionStart = this.index;
      }
    }
  }
  shouldContinue() {
    return this.index < this.buffer.length + this.offset && this.running;
  }
  parse() {
    while (this.shouldContinue()) {
      const c = this.buffer.charCodeAt(this.index - this.offset);
      switch (this.state) {
        case State.Text: {
          this.stateText(c);
          break;
        }
        case State.InPlainText: {
          this.index = this.buffer.length + this.offset - 1;
          break;
        }
        case State.SpecialStartSequence: {
          this.stateSpecialStartSequence(c);
          break;
        }
        case State.InSpecialTag: {
          this.stateInSpecialTag(c);
          break;
        }
        case State.CDATASequence: {
          this.stateCDATASequence(c);
          break;
        }
        case State.DeclarationSequence: {
          this.stateDeclarationSequence(c);
          break;
        }
        case State.InAttributeValueDq: {
          this.stateInAttributeValueDoubleQuotes(c);
          break;
        }
        case State.InAttributeName: {
          this.stateInAttributeName(c);
          break;
        }
        case State.InCommentLike: {
          this.stateInCommentLike(c);
          break;
        }
        case State.InSpecialComment: {
          this.stateInSpecialComment(c);
          break;
        }
        case State.BeforeAttributeName: {
          this.stateBeforeAttributeName(c);
          break;
        }
        case State.InTagName: {
          this.stateInTagName(c);
          break;
        }
        case State.InClosingTagName: {
          this.stateInClosingTagName(c);
          break;
        }
        case State.BeforeTagName: {
          this.stateBeforeTagName(c);
          break;
        }
        case State.AfterAttributeName: {
          this.stateAfterAttributeName(c);
          break;
        }
        case State.InAttributeValueSq: {
          this.stateInAttributeValueSingleQuotes(c);
          break;
        }
        case State.BeforeAttributeValue: {
          this.stateBeforeAttributeValue(c);
          break;
        }
        case State.BeforeClosingTagName: {
          this.stateBeforeClosingTagName(c);
          break;
        }
        case State.AfterClosingTagName: {
          this.stateAfterClosingTagName(c);
          break;
        }
        case State.InAttributeValueNq: {
          this.stateInAttributeValueNoQuotes(c);
          break;
        }
        case State.InSelfClosingTag: {
          this.stateInSelfClosingTag(c);
          break;
        }
        case State.InDeclaration: {
          this.stateInDeclaration(c);
          break;
        }
        case State.BeforeDeclaration: {
          this.stateBeforeDeclaration(c);
          break;
        }
        case State.BeforeComment: {
          this.stateBeforeComment(c);
          break;
        }
        case State.InProcessingInstruction: {
          this.stateInProcessingInstruction(c);
          break;
        }
        case State.InEntity: {
          this.stateInEntity();
          break;
        }
      }
      this.index++;
    }
    this.cleanup();
  }
  finish() {
    if (this.state === State.InEntity) {
      this.entityDecoder.end();
      this.state = this.baseState;
    }
    this.handleTrailingData();
    this.cbs.onend();
  }
  handleTrailingCommentLikeData(endIndex) {
    if (this.state !== State.InCommentLike) {
      return false;
    }
    if (this.currentSequence === Sequences.CdataEnd) {
      if (this.xmlMode) {
        if (this.sectionStart < endIndex) {
          this.cbs.oncdata(this.sectionStart, endIndex, 0);
        }
      } else {
        const cdataStart = this.sectionStart - Sequences.Cdata.length - 1;
        this.cbs.oncomment(cdataStart, endIndex, 0);
      }
    } else {
      const offset = this.xmlMode ? 0 : Math.min(this.sequenceIndex, Sequences.CommentEnd.length - 1);
      this.cbs.oncomment(this.sectionStart, endIndex, offset);
    }
    return true;
  }
  handleTrailingMarkupDeclaration(endIndex) {
    if (this.xmlMode) {
      switch (this.state) {
        case State.InSpecialComment:
        case State.BeforeComment:
        case State.CDATASequence:
        case State.DeclarationSequence:
        case State.InDeclaration: {
          this.cbs.ontext(this.sectionStart, endIndex);
          return true;
        }
        default: {
          return false;
        }
      }
    }
    switch (this.state) {
      case State.BeforeDeclaration:
      case State.InSpecialComment:
      case State.BeforeComment:
      case State.CDATASequence: {
        this.cbs.oncomment(this.sectionStart, endIndex, 0);
        return true;
      }
      case State.DeclarationSequence: {
        if (this.sequenceIndex !== Sequences.Doctype.length) {
          this.cbs.oncomment(this.sectionStart, endIndex, 0);
        }
        return true;
      }
      case State.InDeclaration: {
        return true;
      }
      default: {
        return false;
      }
    }
  }
  handleTrailingData() {
    const endIndex = this.buffer.length + this.offset;
    if (this.handleTrailingCommentLikeData(endIndex) || this.handleTrailingMarkupDeclaration(endIndex)) {
      return;
    }
    if (this.sectionStart >= endIndex) {
      return;
    }
    switch (this.state) {
      case State.InTagName:
      case State.BeforeAttributeName:
      case State.BeforeAttributeValue:
      case State.AfterAttributeName:
      case State.InAttributeName:
      case State.InAttributeValueSq:
      case State.InAttributeValueDq:
      case State.InAttributeValueNq:
      case State.InClosingTagName: {
        break;
      }
      default: {
        this.cbs.ontext(this.sectionStart, endIndex);
      }
    }
  }
  emitCodePoint(cp, consumed) {
    if (this.baseState !== State.Text && this.baseState !== State.InSpecialTag) {
      if (this.sectionStart < this.entityStart) {
        this.cbs.onattribdata(this.sectionStart, this.entityStart);
      }
      this.sectionStart = this.entityStart + consumed;
      this.index = this.sectionStart - 1;
      this.cbs.onattribentity(cp);
    } else {
      if (this.sectionStart < this.entityStart) {
        this.cbs.ontext(this.sectionStart, this.entityStart);
      }
      this.sectionStart = this.entityStart + consumed;
      this.index = this.sectionStart - 1;
      this.cbs.ontextentity(cp, this.sectionStart);
    }
  }
}
var CharCodes2, State, QuoteType, Sequences, specialStartSequences;
var init_Tokenizer = __esm(() => {
  init_decode();
  (function(CharCodes) {
    CharCodes[CharCodes["Tab"] = 9] = "Tab";
    CharCodes[CharCodes["NewLine"] = 10] = "NewLine";
    CharCodes[CharCodes["FormFeed"] = 12] = "FormFeed";
    CharCodes[CharCodes["CarriageReturn"] = 13] = "CarriageReturn";
    CharCodes[CharCodes["Space"] = 32] = "Space";
    CharCodes[CharCodes["ExclamationMark"] = 33] = "ExclamationMark";
    CharCodes[CharCodes["Number"] = 35] = "Number";
    CharCodes[CharCodes["Amp"] = 38] = "Amp";
    CharCodes[CharCodes["SingleQuote"] = 39] = "SingleQuote";
    CharCodes[CharCodes["DoubleQuote"] = 34] = "DoubleQuote";
    CharCodes[CharCodes["Dash"] = 45] = "Dash";
    CharCodes[CharCodes["Slash"] = 47] = "Slash";
    CharCodes[CharCodes["Zero"] = 48] = "Zero";
    CharCodes[CharCodes["Nine"] = 57] = "Nine";
    CharCodes[CharCodes["Semi"] = 59] = "Semi";
    CharCodes[CharCodes["Lt"] = 60] = "Lt";
    CharCodes[CharCodes["Eq"] = 61] = "Eq";
    CharCodes[CharCodes["Gt"] = 62] = "Gt";
    CharCodes[CharCodes["Questionmark"] = 63] = "Questionmark";
    CharCodes[CharCodes["UpperA"] = 65] = "UpperA";
    CharCodes[CharCodes["LowerA"] = 97] = "LowerA";
    CharCodes[CharCodes["UpperF"] = 70] = "UpperF";
    CharCodes[CharCodes["LowerF"] = 102] = "LowerF";
    CharCodes[CharCodes["UpperZ"] = 90] = "UpperZ";
    CharCodes[CharCodes["LowerZ"] = 122] = "LowerZ";
    CharCodes[CharCodes["LowerX"] = 120] = "LowerX";
    CharCodes[CharCodes["OpeningSquareBracket"] = 91] = "OpeningSquareBracket";
  })(CharCodes2 || (CharCodes2 = {}));
  (function(State) {
    State[State["Text"] = 1] = "Text";
    State[State["BeforeTagName"] = 2] = "BeforeTagName";
    State[State["InTagName"] = 3] = "InTagName";
    State[State["InSelfClosingTag"] = 4] = "InSelfClosingTag";
    State[State["BeforeClosingTagName"] = 5] = "BeforeClosingTagName";
    State[State["InClosingTagName"] = 6] = "InClosingTagName";
    State[State["AfterClosingTagName"] = 7] = "AfterClosingTagName";
    State[State["BeforeAttributeName"] = 8] = "BeforeAttributeName";
    State[State["InAttributeName"] = 9] = "InAttributeName";
    State[State["AfterAttributeName"] = 10] = "AfterAttributeName";
    State[State["BeforeAttributeValue"] = 11] = "BeforeAttributeValue";
    State[State["InAttributeValueDq"] = 12] = "InAttributeValueDq";
    State[State["InAttributeValueSq"] = 13] = "InAttributeValueSq";
    State[State["InAttributeValueNq"] = 14] = "InAttributeValueNq";
    State[State["BeforeDeclaration"] = 15] = "BeforeDeclaration";
    State[State["InDeclaration"] = 16] = "InDeclaration";
    State[State["InProcessingInstruction"] = 17] = "InProcessingInstruction";
    State[State["BeforeComment"] = 18] = "BeforeComment";
    State[State["CDATASequence"] = 19] = "CDATASequence";
    State[State["DeclarationSequence"] = 20] = "DeclarationSequence";
    State[State["InSpecialComment"] = 21] = "InSpecialComment";
    State[State["InCommentLike"] = 22] = "InCommentLike";
    State[State["SpecialStartSequence"] = 23] = "SpecialStartSequence";
    State[State["InSpecialTag"] = 24] = "InSpecialTag";
    State[State["InPlainText"] = 25] = "InPlainText";
    State[State["InEntity"] = 26] = "InEntity";
  })(State || (State = {}));
  (function(QuoteType) {
    QuoteType[QuoteType["NoValue"] = 0] = "NoValue";
    QuoteType[QuoteType["Unquoted"] = 1] = "Unquoted";
    QuoteType[QuoteType["Single"] = 2] = "Single";
    QuoteType[QuoteType["Double"] = 3] = "Double";
  })(QuoteType || (QuoteType = {}));
  Sequences = {
    Empty: new Uint8Array(0),
    Cdata: new Uint8Array([67, 68, 65, 84, 65, 91]),
    CdataEnd: new Uint8Array([93, 93, 62]),
    CommentEnd: new Uint8Array([45, 45, 33, 62]),
    Doctype: new Uint8Array([100, 111, 99, 116, 121, 112, 101]),
    IframeEnd: new Uint8Array([60, 47, 105, 102, 114, 97, 109, 101]),
    NoembedEnd: new Uint8Array([
      60,
      47,
      110,
      111,
      101,
      109,
      98,
      101,
      100
    ]),
    NoframesEnd: new Uint8Array([
      60,
      47,
      110,
      111,
      102,
      114,
      97,
      109,
      101,
      115
    ]),
    Plaintext: new Uint8Array([
      60,
      47,
      112,
      108,
      97,
      105,
      110,
      116,
      101,
      120,
      116
    ]),
    ScriptEnd: new Uint8Array([60, 47, 115, 99, 114, 105, 112, 116]),
    StyleEnd: new Uint8Array([60, 47, 115, 116, 121, 108, 101]),
    TitleEnd: new Uint8Array([60, 47, 116, 105, 116, 108, 101]),
    TextareaEnd: new Uint8Array([
      60,
      47,
      116,
      101,
      120,
      116,
      97,
      114,
      101,
      97
    ]),
    XmpEnd: new Uint8Array([60, 47, 120, 109, 112])
  };
  specialStartSequences = new Map([
    [Sequences.IframeEnd[2], Sequences.IframeEnd],
    [Sequences.NoembedEnd[2], Sequences.NoembedEnd],
    [Sequences.Plaintext[2], Sequences.Plaintext],
    [Sequences.ScriptEnd[2], Sequences.ScriptEnd],
    [Sequences.TitleEnd[2], Sequences.TitleEnd],
    [Sequences.XmpEnd[2], Sequences.XmpEnd]
  ]);
});

// node_modules/sanitize-html/node_modules/htmlparser2/dist/Parser.js
class Parser {
  options;
  startIndex = 0;
  endIndex = 0;
  openTagStart = 0;
  tagname = "";
  attribname = "";
  attribvalue = "";
  attribs = null;
  stack = [];
  foreignContext;
  cbs;
  lowerCaseTagNames;
  lowerCaseAttributeNames;
  recognizeSelfClosing;
  htmlMode;
  tokenizer;
  buffers = [];
  bufferOffset = 0;
  writeIndex = 0;
  ended = false;
  constructor(cbs, options = {}) {
    this.options = options;
    this.cbs = cbs ?? {};
    this.htmlMode = !this.options.xmlMode;
    this.lowerCaseTagNames = options.lowerCaseTags ?? this.htmlMode;
    this.lowerCaseAttributeNames = options.lowerCaseAttributeNames ?? this.htmlMode;
    this.recognizeSelfClosing = options.recognizeSelfClosing ?? !this.htmlMode;
    this.tokenizer = new (options.Tokenizer ?? Tokenizer)(this.options, this);
    this.foreignContext = [ForeignContext.None];
    this.cbs.onparserinit?.(this);
  }
  ontext(start, endIndex) {
    const data = this.getSlice(start, endIndex);
    this.endIndex = endIndex - 1;
    this.cbs.ontext?.(data);
    this.startIndex = endIndex;
  }
  ontextentity(cp, endIndex) {
    this.endIndex = endIndex - 1;
    this.cbs.ontext?.(fromCodePoint(cp));
    this.startIndex = endIndex;
  }
  isInForeignContext() {
    return this.foreignContext[0] !== ForeignContext.None;
  }
  isVoidElement(name) {
    return this.htmlMode && voidElements.has(name);
  }
  readTagName(start, endIndex) {
    const name = this.lowerCaseTagNames ? this.getSlice(start, endIndex).toLowerCase() : this.getSlice(start, endIndex);
    if (!(this.lowerCaseTagNames && this.htmlMode)) {
      return name;
    }
    if (this.foreignContext[0] === ForeignContext.Svg) {
      return svgTagNameAdjustments.get(name) ?? name;
    }
    if (this.foreignContext.length > 1) {
      const adjusted = svgTagNameAdjustments.get(name);
      if (adjusted !== undefined && this.stack.includes(adjusted)) {
        return adjusted;
      }
    }
    if (!this.isInForeignContext()) {
      return name === "image" ? "img" : name;
    }
    return name;
  }
  onopentagname(start, endIndex) {
    this.endIndex = endIndex;
    this.emitOpenTag(this.readTagName(start, endIndex));
  }
  emitOpenTag(name) {
    this.openTagStart = this.startIndex;
    this.tagname = name;
    if (this.htmlMode && name === "form" && this.stack.includes("form")) {
      this.tagname = "";
      return;
    }
    const impliesClose = this.htmlMode && openImpliesClose.get(name);
    if (impliesClose) {
      while (this.stack.length > 0 && impliesClose.has(this.stack[0])) {
        this.popElement(true);
      }
    }
    if (!this.isVoidElement(name)) {
      this.stack.unshift(name);
      if (this.htmlMode) {
        if (name === "svg") {
          this.foreignContext.unshift(ForeignContext.Svg);
        } else if (name === "math") {
          this.foreignContext.unshift(ForeignContext.MathML);
        } else if (htmlIntegrationElements.has(name)) {
          this.foreignContext.unshift(ForeignContext.None);
        }
      }
    }
    this.cbs.onopentagname?.(name);
    if (this.cbs.onopentag)
      this.attribs = {};
  }
  endOpenTag(isImplied) {
    this.startIndex = this.openTagStart;
    if (this.attribs) {
      this.cbs.onopentag?.(this.tagname, this.attribs, isImplied);
      this.attribs = null;
    }
    if (this.cbs.onclosetag && this.isVoidElement(this.tagname)) {
      this.cbs.onclosetag(this.tagname, true);
    }
    this.tagname = "";
  }
  onopentagend(endIndex) {
    this.endIndex = endIndex;
    this.endOpenTag(false);
    this.startIndex = endIndex + 1;
  }
  onclosetag(start, endIndex) {
    this.endIndex = endIndex;
    const name = this.readTagName(start, endIndex);
    if (!this.isVoidElement(name)) {
      const pos = this.stack.indexOf(name);
      if (pos !== -1) {
        for (let index = 0;index < pos; index++) {
          this.popElement(true);
        }
        this.popElement(false);
      } else if (this.htmlMode && name === "p") {
        this.emitOpenTag("p");
        this.closeCurrentTag(true);
      }
    } else if (this.htmlMode && name === "br") {
      this.cbs.onopentagname?.("br");
      this.cbs.onopentag?.("br", {}, true);
      this.cbs.onclosetag?.("br", false);
    }
    this.startIndex = endIndex + 1;
  }
  onselfclosingtag(endIndex) {
    this.endIndex = endIndex;
    if (this.recognizeSelfClosing || this.isInForeignContext()) {
      this.closeCurrentTag(false);
      this.startIndex = endIndex + 1;
    } else {
      this.onopentagend(endIndex);
    }
  }
  popElement(implied) {
    const element = this.stack.shift();
    if (this.htmlMode && (foreignContextElements.has(element) || htmlIntegrationElements.has(element))) {
      this.foreignContext.shift();
    }
    this.cbs.onclosetag?.(element, implied);
  }
  closeCurrentTag(isOpenImplied) {
    const name = this.tagname;
    this.endOpenTag(isOpenImplied);
    if (this.stack[0] === name) {
      this.popElement(!isOpenImplied);
    }
  }
  onattribname(start, endIndex) {
    this.startIndex = start;
    const name = this.getSlice(start, endIndex);
    this.attribname = this.lowerCaseAttributeNames ? name.toLowerCase() : name;
  }
  onattribdata(start, endIndex) {
    this.attribvalue += this.getSlice(start, endIndex);
  }
  onattribentity(cp) {
    this.attribvalue += fromCodePoint(cp);
  }
  onattribend(quote, endIndex) {
    this.endIndex = endIndex;
    this.cbs.onattribute?.(this.attribname, this.attribvalue, quote === QuoteType.Double ? '"' : quote === QuoteType.Single ? "'" : quote === QuoteType.NoValue ? undefined : null);
    if (this.attribs && !Object.hasOwn(this.attribs, this.attribname)) {
      this.attribs[this.attribname] = this.attribvalue;
    }
    this.attribvalue = "";
  }
  getInstructionName(value) {
    const index = value.search(reNameEnd);
    let name = index < 0 ? value : value.substr(0, index);
    if (this.lowerCaseTagNames) {
      name = name.toLowerCase();
    }
    return name;
  }
  ondeclaration(start, endIndex) {
    this.endIndex = endIndex;
    const value = this.getSlice(start, endIndex);
    if (this.cbs.onprocessinginstruction) {
      const name = this.htmlMode ? this.lowerCaseTagNames ? DOCUMENT_TYPE : value.slice(0, DOCUMENT_TYPE.length) : this.getInstructionName(value);
      this.cbs.onprocessinginstruction(`!${name}`, `!${value}`);
    }
    this.startIndex = endIndex + 1;
  }
  onprocessinginstruction(start, endIndex) {
    this.endIndex = endIndex;
    const value = this.getSlice(start, endIndex);
    if (this.cbs.onprocessinginstruction) {
      const name = this.getInstructionName(value);
      this.cbs.onprocessinginstruction(`?${name}`, `?${value}`);
    }
    this.startIndex = endIndex + 1;
  }
  oncomment(start, endIndex, offset) {
    this.endIndex = endIndex;
    this.cbs.oncomment?.(this.getSlice(start, endIndex - offset));
    this.cbs.oncommentend?.();
    this.startIndex = endIndex + 1;
  }
  oncdata(start, endIndex, offset) {
    this.endIndex = endIndex;
    const value = this.getSlice(start, endIndex - offset);
    if (!this.htmlMode || this.options.recognizeCDATA) {
      this.cbs.oncdatastart?.();
      this.cbs.ontext?.(value);
      this.cbs.oncdataend?.();
    } else if (this.isInForeignContext()) {
      this.cbs.ontext?.(value);
    } else {
      this.cbs.oncomment?.(`[CDATA[${value}]]`);
      this.cbs.oncommentend?.();
    }
    this.startIndex = endIndex + 1;
  }
  onend() {
    if (this.cbs.onclosetag) {
      this.endIndex = this.startIndex;
      for (let index = 0;index < this.stack.length; index++) {
        this.cbs.onclosetag(this.stack[index], true);
      }
    }
    this.cbs.onend?.();
  }
  reset() {
    this.cbs.onreset?.();
    this.tokenizer.reset();
    this.tagname = "";
    this.attribname = "";
    this.attribvalue = "";
    this.attribs = null;
    this.stack.length = 0;
    this.startIndex = 0;
    this.endIndex = 0;
    this.cbs.onparserinit?.(this);
    this.buffers.length = 0;
    this.foreignContext.length = 0;
    this.foreignContext.unshift(ForeignContext.None);
    this.bufferOffset = 0;
    this.writeIndex = 0;
    this.ended = false;
  }
  parseComplete(data) {
    this.reset();
    this.end(data);
  }
  getSlice(start, end) {
    if (start === end) {
      return "";
    }
    while (start - this.bufferOffset >= this.buffers[0].length) {
      this.shiftBuffer();
    }
    let slice = this.buffers[0].slice(start - this.bufferOffset, end - this.bufferOffset);
    while (end - this.bufferOffset > this.buffers[0].length) {
      this.shiftBuffer();
      slice += this.buffers[0].slice(0, end - this.bufferOffset);
    }
    return slice;
  }
  shiftBuffer() {
    this.bufferOffset += this.buffers[0].length;
    this.writeIndex--;
    this.buffers.shift();
  }
  write(chunk) {
    if (this.ended) {
      this.cbs.onerror?.(new Error(".write() after done!"));
      return;
    }
    this.buffers.push(chunk);
    if (this.tokenizer.running) {
      this.tokenizer.write(chunk);
      this.writeIndex++;
    }
  }
  end(chunk) {
    if (this.ended) {
      this.cbs.onerror?.(new Error(".end() after done!"));
      return;
    }
    if (chunk)
      this.write(chunk);
    this.ended = true;
    this.tokenizer.end();
  }
  pause() {
    this.tokenizer.pause();
  }
  resume() {
    this.tokenizer.resume();
    while (this.tokenizer.running && this.writeIndex < this.buffers.length) {
      this.tokenizer.write(this.buffers[this.writeIndex++]);
    }
    if (this.ended)
      this.tokenizer.end();
  }
}
var fromCodePoint, formTags, pTag, headingTags, tableSectionTags, ddtTags, rtpTags, openImpliesClose, DOCUMENT_TYPE = "doctype", voidElements, foreignContextElements, htmlIntegrationElements, svgTagNameAdjustments, ForeignContext, reNameEnd;
var init_Parser = __esm(() => {
  init_Tokenizer();
  ({ fromCodePoint } = String);
  formTags = new Set([
    "input",
    "option",
    "optgroup",
    "select",
    "button",
    "datalist",
    "textarea"
  ]);
  pTag = new Set(["p"]);
  headingTags = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p"]);
  tableSectionTags = new Set(["thead", "tbody"]);
  ddtTags = new Set(["dd", "dt"]);
  rtpTags = new Set(["rt", "rp"]);
  openImpliesClose = new Map([
    ["tr", new Set(["tr", "th", "td"])],
    ["th", new Set(["th"])],
    ["td", new Set(["thead", "th", "td"])],
    ["body", new Set(["head", "link", "script"])],
    ["a", new Set(["a"])],
    ["li", new Set(["li"])],
    ["p", pTag],
    ["h1", headingTags],
    ["h2", headingTags],
    ["h3", headingTags],
    ["h4", headingTags],
    ["h5", headingTags],
    ["h6", headingTags],
    ["select", formTags],
    ["input", formTags],
    ["output", formTags],
    ["button", formTags],
    ["datalist", formTags],
    ["textarea", formTags],
    ["option", new Set(["option"])],
    ["optgroup", new Set(["optgroup", "option"])],
    ["dd", ddtTags],
    ["dt", ddtTags],
    ["address", pTag],
    ["article", pTag],
    ["aside", pTag],
    ["blockquote", pTag],
    ["details", pTag],
    ["div", pTag],
    ["dl", pTag],
    ["fieldset", pTag],
    ["figcaption", pTag],
    ["figure", pTag],
    ["footer", pTag],
    ["form", pTag],
    ["header", pTag],
    ["hr", pTag],
    ["main", pTag],
    ["nav", pTag],
    ["ol", pTag],
    ["pre", pTag],
    ["section", pTag],
    ["table", pTag],
    ["ul", pTag],
    ["rt", rtpTags],
    ["rp", rtpTags],
    ["tbody", tableSectionTags],
    ["tfoot", tableSectionTags]
  ]);
  voidElements = new Set([
    "area",
    "base",
    "basefont",
    "br",
    "col",
    "command",
    "embed",
    "frame",
    "hr",
    "img",
    "input",
    "isindex",
    "keygen",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr"
  ]);
  foreignContextElements = new Set(["math", "svg"]);
  htmlIntegrationElements = new Set([
    "mi",
    "mo",
    "mn",
    "ms",
    "mtext",
    "annotation-xml",
    "foreignObject",
    "desc",
    "title"
  ]);
  svgTagNameAdjustments = new Map([
    ["altglyph", "altGlyph"],
    ["altglyphdef", "altGlyphDef"],
    ["altglyphitem", "altGlyphItem"],
    ["animatecolor", "animateColor"],
    ["animatemotion", "animateMotion"],
    ["animatetransform", "animateTransform"],
    ["clippath", "clipPath"],
    ["feblend", "feBlend"],
    ["fecolormatrix", "feColorMatrix"],
    ["fecomponenttransfer", "feComponentTransfer"],
    ["fecomposite", "feComposite"],
    ["feconvolvematrix", "feConvolveMatrix"],
    ["fediffuselighting", "feDiffuseLighting"],
    ["fedisplacementmap", "feDisplacementMap"],
    ["fedistantlight", "feDistantLight"],
    ["fedropshadow", "feDropShadow"],
    ["feflood", "feFlood"],
    ["fefunca", "feFuncA"],
    ["fefuncb", "feFuncB"],
    ["fefuncg", "feFuncG"],
    ["fefuncr", "feFuncR"],
    ["fegaussianblur", "feGaussianBlur"],
    ["feimage", "feImage"],
    ["femerge", "feMerge"],
    ["femergenode", "feMergeNode"],
    ["femorphology", "feMorphology"],
    ["feoffset", "feOffset"],
    ["fepointlight", "fePointLight"],
    ["fespecularlighting", "feSpecularLighting"],
    ["fespotlight", "feSpotLight"],
    ["fetile", "feTile"],
    ["feturbulence", "feTurbulence"],
    ["foreignobject", "foreignObject"],
    ["glyphref", "glyphRef"],
    ["lineargradient", "linearGradient"],
    ["radialgradient", "radialGradient"],
    ["textpath", "textPath"]
  ]);
  (function(ForeignContext) {
    ForeignContext[ForeignContext["None"] = 0] = "None";
    ForeignContext[ForeignContext["Svg"] = 1] = "Svg";
    ForeignContext[ForeignContext["MathML"] = 2] = "MathML";
  })(ForeignContext || (ForeignContext = {}));
  reNameEnd = /\s|\//;
});

// node_modules/sanitize-html/node_modules/htmlparser2/node_modules/domelementtype/dist/index.js
var ElementType, Root, Text, Directive, Comment, Script, Style, Tag, CDATA, Doctype;
var init_dist = __esm(() => {
  (function(ElementType) {
    ElementType["Root"] = "root";
    ElementType["Text"] = "text";
    ElementType["Directive"] = "directive";
    ElementType["Comment"] = "comment";
    ElementType["Script"] = "script";
    ElementType["Style"] = "style";
    ElementType["Tag"] = "tag";
    ElementType["CDATA"] = "cdata";
    ElementType["Doctype"] = "doctype";
  })(ElementType || (ElementType = {}));
  Root = ElementType.Root;
  Text = ElementType.Text;
  Directive = ElementType.Directive;
  Comment = ElementType.Comment;
  Script = ElementType.Script;
  Style = ElementType.Style;
  Tag = ElementType.Tag;
  CDATA = ElementType.CDATA;
  Doctype = ElementType.Doctype;
});

// node_modules/sanitize-html/node_modules/htmlparser2/node_modules/domutils/dist/querying.js
var init_querying = () => {};

// node_modules/sanitize-html/node_modules/htmlparser2/node_modules/domutils/dist/legacy.js
var init_legacy = () => {};

// node_modules/entities/dist/escape.js
function getEscape(char) {
  return char === 34 ? "&quot;" : char === 38 ? "&amp;" : char === 39 ? "&apos;" : char === 60 ? "&lt;" : char === 62 ? "&gt;" : "&nbsp;";
}
function escapeWithRegex(re, data) {
  re.lastIndex = 0;
  if (!re.test(data))
    return data;
  let out = "";
  let last = 0;
  do {
    const index = re.lastIndex - 1;
    if (last !== index)
      out += data.substring(last, index);
    const char = data.charCodeAt(index);
    out += getEscape(char);
    last = index + 1;
  } while (re.test(data));
  return out + data.substring(last);
}
function escapeAttribute(data) {
  return escapeWithRegex(attributeEscapeRegex, data);
}
function escapeText(data) {
  return escapeWithRegex(textEscapeRegex, data);
}
var attributeEscapeRegex, textEscapeRegex;
var init_escape = __esm(() => {
  attributeEscapeRegex = /["&\u{A0}]/gu;
  textEscapeRegex = /[&<>\u{A0}]/gu;
});

// node_modules/entities/dist/index.js
var EntityLevel, EncodingMode;
var init_dist2 = __esm(() => {
  init_decode();
  (function(EntityLevel) {
    EntityLevel[EntityLevel["XML"] = 0] = "XML";
    EntityLevel[EntityLevel["HTML"] = 1] = "HTML";
  })(EntityLevel || (EntityLevel = {}));
  (function(EncodingMode) {
    EncodingMode[EncodingMode["UTF8"] = 0] = "UTF8";
    EncodingMode[EncodingMode["ASCII"] = 1] = "ASCII";
    EncodingMode[EncodingMode["Extensive"] = 2] = "Extensive";
    EncodingMode[EncodingMode["Attribute"] = 3] = "Attribute";
    EncodingMode[EncodingMode["Text"] = 4] = "Text";
  })(EncodingMode || (EncodingMode = {}));
});

// node_modules/sanitize-html/node_modules/htmlparser2/node_modules/domutils/dist/stringify.js
var init_stringify = () => {};

// node_modules/sanitize-html/node_modules/htmlparser2/node_modules/domutils/dist/feeds.js
var init_feeds = () => {};

// node_modules/sanitize-html/node_modules/htmlparser2/node_modules/domutils/dist/helpers.js
var DocumentPosition;
var init_helpers = __esm(() => {
  (function(DocumentPosition) {
    DocumentPosition[DocumentPosition["DISCONNECTED"] = 1] = "DISCONNECTED";
    DocumentPosition[DocumentPosition["PRECEDING"] = 2] = "PRECEDING";
    DocumentPosition[DocumentPosition["FOLLOWING"] = 4] = "FOLLOWING";
    DocumentPosition[DocumentPosition["CONTAINS"] = 8] = "CONTAINS";
    DocumentPosition[DocumentPosition["CONTAINED_BY"] = 16] = "CONTAINED_BY";
  })(DocumentPosition || (DocumentPosition = {}));
});

// node_modules/sanitize-html/node_modules/htmlparser2/node_modules/domutils/dist/traversal.js
var init_traversal = () => {};

// node_modules/sanitize-html/node_modules/htmlparser2/node_modules/domutils/dist/index.js
var init_dist3 = __esm(() => {
  init_feeds();
  init_helpers();
  init_legacy();
  init_querying();
  init_stringify();
  init_traversal();
});

// node_modules/sanitize-html/node_modules/htmlparser2/dist/index.js
var init_dist4 = __esm(() => {
  init_Parser();
  init_dist();
  init_dist3();
});

// node_modules/escape-string-regexp/index.js
var require_escape_string_regexp = __commonJS(function(exports, module) {
  module.exports = (string) => {
    if (typeof string !== "string") {
      throw new TypeError("Expected a string");
    }
    return string.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&").replace(/-/g, "\\x2d");
  };
});

// node_modules/is-plain-object/dist/is-plain-object.js
var require_is_plain_object = __commonJS(function(exports) {
  /*!
   * is-plain-object <https://github.com/jonschlinkert/is-plain-object>
   *
   * Copyright (c) 2014-2017, Jon Schlinkert.
   * Released under the MIT License.
   */
  function isObject(o) {
    return Object.prototype.toString.call(o) === "[object Object]";
  }
  function isPlainObject(o) {
    var ctor, prot;
    if (isObject(o) === false)
      return false;
    ctor = o.constructor;
    if (ctor === undefined)
      return true;
    prot = ctor.prototype;
    if (isObject(prot) === false)
      return false;
    if (prot.hasOwnProperty("isPrototypeOf") === false) {
      return false;
    }
    return true;
  }
  exports.isPlainObject = isPlainObject;
});

// node_modules/parse-srcset/src/parse-srcset.js
var require_parse_srcset = __commonJS(function(exports, module) {
  (function(root, factory) {
    if (typeof define === "function" && define.amd) {
      define([], factory);
    } else if (typeof module === "object" && module.exports) {
      module.exports = factory();
    } else {
      root.parseSrcset = factory();
    }
  })(exports, function() {
    return function(input) {
      function isSpace(c) {
        return c === " " || c === "\t" || c === `
` || c === "\f" || c === "\r";
      }
      function collectCharacters(regEx) {
        var chars, match = regEx.exec(input.substring(pos));
        if (match) {
          chars = match[0];
          pos += chars.length;
          return chars;
        }
      }
      var inputLength = input.length, regexLeadingSpaces = /^[ \t\n\r\u000c]+/, regexLeadingCommasOrSpaces = /^[, \t\n\r\u000c]+/, regexLeadingNotSpaces = /^[^ \t\n\r\u000c]+/, regexTrailingCommas = /[,]+$/, regexNonNegativeInteger = /^\d+$/, regexFloatingPoint = /^-?(?:[0-9]+|[0-9]*\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/, url, descriptors, currentDescriptor, state, c, pos = 0, candidates = [];
      while (true) {
        collectCharacters(regexLeadingCommasOrSpaces);
        if (pos >= inputLength) {
          return candidates;
        }
        url = collectCharacters(regexLeadingNotSpaces);
        descriptors = [];
        if (url.slice(-1) === ",") {
          url = url.replace(regexTrailingCommas, "");
          parseDescriptors();
        } else {
          tokenize();
        }
      }
      function tokenize() {
        collectCharacters(regexLeadingSpaces);
        currentDescriptor = "";
        state = "in descriptor";
        while (true) {
          c = input.charAt(pos);
          if (state === "in descriptor") {
            if (isSpace(c)) {
              if (currentDescriptor) {
                descriptors.push(currentDescriptor);
                currentDescriptor = "";
                state = "after descriptor";
              }
            } else if (c === ",") {
              pos += 1;
              if (currentDescriptor) {
                descriptors.push(currentDescriptor);
              }
              parseDescriptors();
              return;
            } else if (c === "(") {
              currentDescriptor = currentDescriptor + c;
              state = "in parens";
            } else if (c === "") {
              if (currentDescriptor) {
                descriptors.push(currentDescriptor);
              }
              parseDescriptors();
              return;
            } else {
              currentDescriptor = currentDescriptor + c;
            }
          } else if (state === "in parens") {
            if (c === ")") {
              currentDescriptor = currentDescriptor + c;
              state = "in descriptor";
            } else if (c === "") {
              descriptors.push(currentDescriptor);
              parseDescriptors();
              return;
            } else {
              currentDescriptor = currentDescriptor + c;
            }
          } else if (state === "after descriptor") {
            if (isSpace(c)) {} else if (c === "") {
              parseDescriptors();
              return;
            } else {
              state = "in descriptor";
              pos -= 1;
            }
          }
          pos += 1;
        }
      }
      function parseDescriptors() {
        var pError = false, w, d, h, i, candidate = {}, desc, lastChar, value, intVal, floatVal;
        for (i = 0;i < descriptors.length; i++) {
          desc = descriptors[i];
          lastChar = desc[desc.length - 1];
          value = desc.substring(0, desc.length - 1);
          intVal = parseInt(value, 10);
          floatVal = parseFloat(value);
          if (regexNonNegativeInteger.test(value) && lastChar === "w") {
            if (w || d) {
              pError = true;
            }
            if (intVal === 0) {
              pError = true;
            } else {
              w = intVal;
            }
          } else if (regexFloatingPoint.test(value) && lastChar === "x") {
            if (w || d || h) {
              pError = true;
            }
            if (floatVal < 0) {
              pError = true;
            } else {
              d = floatVal;
            }
          } else if (regexNonNegativeInteger.test(value) && lastChar === "h") {
            if (h || d) {
              pError = true;
            }
            if (intVal === 0) {
              pError = true;
            } else {
              h = intVal;
            }
          } else {
            pError = true;
          }
        }
        if (!pError) {
          candidate.url = url;
          if (w) {
            candidate.w = w;
          }
          if (d) {
            candidate.d = d;
          }
          if (h) {
            candidate.h = h;
          }
          candidates.push(candidate);
        } else if (console && console.log) {
          console.log("Invalid srcset descriptor found in '" + input + "' at '" + desc + "'.");
        }
      }
    };
  });
});

// node_modules/picocolors/picocolors.js
var require_picocolors = __commonJS(function(exports, module) {
  var p = process || {};
  var argv = p.argv || [];
  var env = p.env || {};
  var isColorSupported = !(!!env.NO_COLOR || argv.includes("--no-color")) && (!!env.FORCE_COLOR || argv.includes("--color") || p.platform === "win32" || (p.stdout || {}).isTTY && env.TERM !== "dumb" || !!env.CI);
  var formatter = (open, close, replace = open) => (input) => {
    let string = "" + input, index = string.indexOf(close, open.length);
    return ~index ? open + replaceClose(string, close, replace, index) + close : open + string + close;
  };
  var replaceClose = (string, close, replace, index) => {
    let result = "", cursor = 0;
    do {
      result += string.substring(cursor, index) + replace;
      cursor = index + close.length;
      index = string.indexOf(close, cursor);
    } while (~index);
    return result + string.substring(cursor);
  };
  var createColors = (enabled = isColorSupported) => {
    let f = enabled ? formatter : () => String;
    return {
      isColorSupported: enabled,
      reset: f("\x1B[0m", "\x1B[0m"),
      bold: f("\x1B[1m", "\x1B[22m", "\x1B[22m\x1B[1m"),
      dim: f("\x1B[2m", "\x1B[22m", "\x1B[22m\x1B[2m"),
      italic: f("\x1B[3m", "\x1B[23m"),
      underline: f("\x1B[4m", "\x1B[24m"),
      inverse: f("\x1B[7m", "\x1B[27m"),
      hidden: f("\x1B[8m", "\x1B[28m"),
      strikethrough: f("\x1B[9m", "\x1B[29m"),
      black: f("\x1B[30m", "\x1B[39m"),
      red: f("\x1B[31m", "\x1B[39m"),
      green: f("\x1B[32m", "\x1B[39m"),
      yellow: f("\x1B[33m", "\x1B[39m"),
      blue: f("\x1B[34m", "\x1B[39m"),
      magenta: f("\x1B[35m", "\x1B[39m"),
      cyan: f("\x1B[36m", "\x1B[39m"),
      white: f("\x1B[37m", "\x1B[39m"),
      gray: f("\x1B[90m", "\x1B[39m"),
      bgBlack: f("\x1B[40m", "\x1B[49m"),
      bgRed: f("\x1B[41m", "\x1B[49m"),
      bgGreen: f("\x1B[42m", "\x1B[49m"),
      bgYellow: f("\x1B[43m", "\x1B[49m"),
      bgBlue: f("\x1B[44m", "\x1B[49m"),
      bgMagenta: f("\x1B[45m", "\x1B[49m"),
      bgCyan: f("\x1B[46m", "\x1B[49m"),
      bgWhite: f("\x1B[47m", "\x1B[49m"),
      blackBright: f("\x1B[90m", "\x1B[39m"),
      redBright: f("\x1B[91m", "\x1B[39m"),
      greenBright: f("\x1B[92m", "\x1B[39m"),
      yellowBright: f("\x1B[93m", "\x1B[39m"),
      blueBright: f("\x1B[94m", "\x1B[39m"),
      magentaBright: f("\x1B[95m", "\x1B[39m"),
      cyanBright: f("\x1B[96m", "\x1B[39m"),
      whiteBright: f("\x1B[97m", "\x1B[39m"),
      bgBlackBright: f("\x1B[100m", "\x1B[49m"),
      bgRedBright: f("\x1B[101m", "\x1B[49m"),
      bgGreenBright: f("\x1B[102m", "\x1B[49m"),
      bgYellowBright: f("\x1B[103m", "\x1B[49m"),
      bgBlueBright: f("\x1B[104m", "\x1B[49m"),
      bgMagentaBright: f("\x1B[105m", "\x1B[49m"),
      bgCyanBright: f("\x1B[106m", "\x1B[49m"),
      bgWhiteBright: f("\x1B[107m", "\x1B[49m")
    };
  };
  module.exports = createColors();
  module.exports.createColors = createColors;
});

// node_modules/postcss/lib/tokenize.js
var require_tokenize = __commonJS(function(exports, module) {
  var SINGLE_QUOTE = 39;
  var DOUBLE_QUOTE = 34;
  var BACKSLASH = 92;
  var SLASH = 47;
  var NEWLINE = 10;
  var SPACE = 32;
  var FEED = 12;
  var TAB = 9;
  var CR = 13;
  var OPEN_SQUARE = 91;
  var CLOSE_SQUARE = 93;
  var OPEN_PARENTHESES = 40;
  var CLOSE_PARENTHESES = 41;
  var OPEN_CURLY = 123;
  var CLOSE_CURLY = 125;
  var SEMICOLON = 59;
  var ASTERISK = 42;
  var COLON = 58;
  var AT = 64;
  var RE_AT_END = /[\t\n\f\r "#'()/;[\\\]{}]/g;
  var RE_WORD_END = /[\t\n\f\r !"#'():;@[\\\]{}]|\/(?=\*)/g;
  var RE_BAD_BRACKET = /.[\r\n"'(/\\]/;
  var RE_HEX_ESCAPE = /[\da-f]/i;
  module.exports = function tokenizer(input, options = {}) {
    let css = input.css.valueOf();
    let ignore = options.ignoreErrors;
    let code, content, escape, next, quote;
    let currentToken, escaped, escapePos, n, prev;
    let length = css.length;
    let pos = 0;
    let buffer = [];
    let returned = [];
    let lastBadParen = -1;
    function position() {
      return pos;
    }
    function unclosed(what) {
      throw input.error("Unclosed " + what, pos);
    }
    function endOfFile() {
      return returned.length === 0 && pos >= length;
    }
    function nextToken(opts) {
      if (returned.length)
        return returned.pop();
      if (pos >= length)
        return;
      let ignoreUnclosed = opts ? opts.ignoreUnclosed : false;
      code = css.charCodeAt(pos);
      switch (code) {
        case NEWLINE:
        case SPACE:
        case TAB:
        case CR:
        case FEED: {
          next = pos;
          do {
            next += 1;
            code = css.charCodeAt(next);
          } while (code === SPACE || code === NEWLINE || code === TAB || code === CR || code === FEED);
          currentToken = ["space", css.slice(pos, next)];
          pos = next - 1;
          break;
        }
        case OPEN_SQUARE:
        case CLOSE_SQUARE:
        case OPEN_CURLY:
        case CLOSE_CURLY:
        case COLON:
        case SEMICOLON:
        case CLOSE_PARENTHESES: {
          let controlChar = String.fromCharCode(code);
          currentToken = [controlChar, controlChar, pos];
          break;
        }
        case OPEN_PARENTHESES: {
          prev = buffer.length ? buffer.pop()[1] : "";
          n = css.charCodeAt(pos + 1);
          if (prev === "url" && n !== SINGLE_QUOTE && n !== DOUBLE_QUOTE && n !== SPACE && n !== NEWLINE && n !== TAB && n !== FEED && n !== CR) {
            next = pos;
            do {
              escaped = false;
              next = css.indexOf(")", next + 1);
              if (next === -1) {
                if (ignore || ignoreUnclosed) {
                  next = pos;
                  break;
                } else {
                  unclosed("bracket");
                }
              }
              escapePos = next;
              while (css.charCodeAt(escapePos - 1) === BACKSLASH) {
                escapePos -= 1;
                escaped = !escaped;
              }
            } while (escaped);
            currentToken = ["brackets", css.slice(pos, next + 1), pos, next];
            pos = next;
          } else if (pos <= lastBadParen) {
            currentToken = ["(", "(", pos];
          } else {
            next = css.indexOf(")", pos + 1);
            content = css.slice(pos, next + 1);
            if (next === -1 || RE_BAD_BRACKET.test(content)) {
              lastBadParen = next === -1 ? length : next;
              currentToken = ["(", "(", pos];
            } else {
              currentToken = ["brackets", content, pos, next];
              pos = next;
            }
          }
          break;
        }
        case SINGLE_QUOTE:
        case DOUBLE_QUOTE: {
          quote = code === SINGLE_QUOTE ? "'" : '"';
          next = pos;
          do {
            escaped = false;
            next = css.indexOf(quote, next + 1);
            if (next === -1) {
              if (ignore || ignoreUnclosed) {
                next = pos + 1;
                break;
              } else {
                unclosed("string");
              }
            }
            escapePos = next;
            while (css.charCodeAt(escapePos - 1) === BACKSLASH) {
              escapePos -= 1;
              escaped = !escaped;
            }
          } while (escaped);
          currentToken = ["string", css.slice(pos, next + 1), pos, next];
          pos = next;
          break;
        }
        case AT: {
          RE_AT_END.lastIndex = pos + 1;
          RE_AT_END.test(css);
          if (RE_AT_END.lastIndex === 0) {
            next = css.length - 1;
          } else {
            next = RE_AT_END.lastIndex - 2;
          }
          currentToken = ["at-word", css.slice(pos, next + 1), pos, next];
          pos = next;
          break;
        }
        case BACKSLASH: {
          next = pos;
          escape = true;
          while (css.charCodeAt(next + 1) === BACKSLASH) {
            next += 1;
            escape = !escape;
          }
          code = css.charCodeAt(next + 1);
          if (escape && code !== SLASH && code !== SPACE && code !== NEWLINE && code !== TAB && code !== CR && code !== FEED) {
            next += 1;
            if (RE_HEX_ESCAPE.test(css.charAt(next))) {
              while (RE_HEX_ESCAPE.test(css.charAt(next + 1))) {
                next += 1;
              }
              if (css.charCodeAt(next + 1) === SPACE) {
                next += 1;
              }
            }
          }
          currentToken = ["word", css.slice(pos, next + 1), pos, next];
          pos = next;
          break;
        }
        default: {
          if (code === SLASH && css.charCodeAt(pos + 1) === ASTERISK) {
            next = css.indexOf("*/", pos + 2) + 1;
            if (next === 0) {
              if (ignore || ignoreUnclosed) {
                next = css.length;
              } else {
                unclosed("comment");
              }
            }
            currentToken = ["comment", css.slice(pos, next + 1), pos, next];
            pos = next;
          } else {
            RE_WORD_END.lastIndex = pos + 1;
            RE_WORD_END.test(css);
            if (RE_WORD_END.lastIndex === 0) {
              next = css.length - 1;
            } else {
              next = RE_WORD_END.lastIndex - 2;
            }
            currentToken = ["word", css.slice(pos, next + 1), pos, next];
            buffer.push(currentToken);
            pos = next;
          }
          break;
        }
      }
      pos++;
      return currentToken;
    }
    function back(token) {
      returned.push(token);
    }
    return {
      back,
      endOfFile,
      nextToken,
      position
    };
  };
});

// node_modules/postcss/lib/terminal-highlight.js
var require_terminal_highlight = __commonJS(function(exports, module) {
  var pico = require_picocolors();
  var tokenizer = require_tokenize();
  var Input;
  function registerInput(dependant) {
    Input = dependant;
  }
  var HIGHLIGHT_THEME = {
    ";": pico.yellow,
    ":": pico.yellow,
    "(": pico.cyan,
    ")": pico.cyan,
    "[": pico.yellow,
    "]": pico.yellow,
    "{": pico.yellow,
    "}": pico.yellow,
    "at-word": pico.cyan,
    brackets: pico.cyan,
    call: pico.cyan,
    class: pico.yellow,
    comment: pico.gray,
    hash: pico.magenta,
    string: pico.green
  };
  function getTokenType([type, value], processor) {
    if (type === "word") {
      if (value[0] === ".") {
        return "class";
      }
      if (value[0] === "#") {
        return "hash";
      }
    }
    if (!processor.endOfFile()) {
      let next = processor.nextToken();
      processor.back(next);
      if (next[0] === "brackets" || next[0] === "(")
        return "call";
    }
    return type;
  }
  function terminalHighlight(css) {
    let processor = tokenizer(new Input(css), { ignoreErrors: true });
    let result = "";
    while (!processor.endOfFile()) {
      let token = processor.nextToken();
      let color = HIGHLIGHT_THEME[getTokenType(token, processor)];
      if (color) {
        result += token[1].split(/\r?\n/).map((i) => color(i)).join(`
`);
      } else {
        result += token[1];
      }
    }
    return result;
  }
  terminalHighlight.registerInput = registerInput;
  module.exports = terminalHighlight;
});

// node_modules/postcss/lib/css-syntax-error.js
var require_css_syntax_error = __commonJS(function(exports, module) {
  var pico = require_picocolors();
  var terminalHighlight = require_terminal_highlight();

  class CssSyntaxError extends Error {
    constructor(message, line, column, source, file, plugin) {
      super(message);
      this.name = "CssSyntaxError";
      this.reason = message;
      if (file) {
        this.file = file;
      }
      if (source) {
        this.source = source;
      }
      if (plugin) {
        this.plugin = plugin;
      }
      if (typeof line !== "undefined" && typeof column !== "undefined") {
        if (typeof line === "number") {
          this.line = line;
          this.column = column;
        } else {
          this.line = line.line;
          this.column = line.column;
          this.endLine = column.line;
          this.endColumn = column.column;
        }
      }
      this.setMessage();
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, CssSyntaxError);
      }
    }
    setMessage() {
      this.message = this.plugin ? this.plugin + ": " : "";
      this.message += this.file ? this.file : "<css input>";
      if (typeof this.line !== "undefined") {
        this.message += ":" + this.line + ":" + this.column;
      }
      this.message += ": " + this.reason;
    }
    showSourceCode(color) {
      if (!this.source)
        return "";
      let css = this.source;
      if (color == null)
        color = pico.isColorSupported;
      let aside = (text) => text;
      let mark = (text) => text;
      let highlight = (text) => text;
      if (color) {
        let { bold, gray, red } = pico.createColors(true);
        mark = (text) => bold(red(text));
        aside = (text) => gray(text);
        if (terminalHighlight) {
          highlight = (text) => terminalHighlight(text);
        }
      }
      let lines = css.split(/\r?\n/);
      let start = Math.max(this.line - 3, 0);
      let end = Math.min(this.line + 2, lines.length);
      let maxWidth = String(end).length;
      return lines.slice(start, end).map((line, index) => {
        let number = start + 1 + index;
        let gutter = " " + (" " + number).slice(-maxWidth) + " | ";
        if (number === this.line) {
          if (line.length > 160) {
            let padding = 20;
            let subLineStart = Math.max(0, this.column - padding);
            let subLineEnd = Math.max(this.column + padding, this.endColumn + padding);
            let subLine = line.slice(subLineStart, subLineEnd);
            let spacing = aside(gutter.replace(/\d/g, " ")) + line.slice(0, Math.min(this.column - 1, padding - 1)).replace(/[^\t]/g, " ");
            return mark(">") + aside(gutter) + highlight(subLine) + `
 ` + spacing + mark("^");
          }
          let spacing = aside(gutter.replace(/\d/g, " ")) + line.slice(0, this.column - 1).replace(/[^\t]/g, " ");
          return mark(">") + aside(gutter) + highlight(line) + `
 ` + spacing + mark("^");
        }
        return " " + aside(gutter) + highlight(line);
      }).join(`
`);
    }
    toString() {
      let code = this.showSourceCode();
      if (code) {
        code = `

` + code + `
`;
      }
      return this.name + ": " + this.message + code;
    }
  }
  module.exports = CssSyntaxError;
  CssSyntaxError.default = CssSyntaxError;
});

// node_modules/postcss/lib/stringifier.js
var require_stringifier = __commonJS(function(exports, module) {
  var AT_NAME_END = /[\t\n\f\r "#'()/;[\\\]{}]/;
  var DEFAULT_RAW = {
    after: `
`,
    beforeClose: `
`,
    beforeComment: `
`,
    beforeDecl: `
`,
    beforeOpen: " ",
    beforeRule: `
`,
    colon: ": ",
    commentLeft: " ",
    commentRight: " ",
    emptyBody: "",
    indent: "    ",
    semicolon: false
  };
  function capitalize(str) {
    return str[0].toUpperCase() + str.slice(1);
  }
  function atruleStart(str, node) {
    let name = "@" + node.name;
    let params = node.params ? str.rawValue(node, "params") : "";
    let afterName = node.raws.afterName;
    if (typeof afterName === "undefined") {
      afterName = params ? " " : "";
    } else if (afterName === "" && params && !AT_NAME_END.test(params[0])) {
      afterName = " ";
    }
    return name + afterName + params;
  }
  function isCustomProperty(node) {
    if (!node.prop.startsWith("--"))
      return false;
    let before = node.raws.before;
    return typeof before === "undefined" || !/[^\s;]$/.test(before);
  }
  function pushBody(str, stack, node) {
    let nodes = node.nodes;
    let last = nodes.length - 1;
    while (last > 0) {
      if (nodes[last].type !== "comment")
        break;
      last -= 1;
    }
    let semicolon = str.raw(node, "semicolon");
    let isDocument = node.type === "document";
    for (let i = nodes.length - 1;i >= 0; i--) {
      let child = nodes[i];
      let childSemicolon = last !== i || semicolon;
      if (!childSemicolon && i < nodes.length - 1 && (child.type === "atrule" && !child.nodes || child.type === "decl" && isCustomProperty(child))) {
        childSemicolon = true;
      }
      stack.push({
        document: isDocument,
        node: child,
        semicolon: childSemicolon
      });
    }
  }
  function pushBlock(str, stack, node, start) {
    let between = str.raw(node, "between", "beforeOpen");
    str.builder(start + between + "{", node, "start");
    let hasNodes = node.nodes && node.nodes.length;
    let close = () => {
      let after = hasNodes ? str.raw(node, "after") : str.raw(node, "after", "emptyBody");
      if (after)
        str.builder(after);
      str.builder("}", node, "end");
      if (node.type === "rule" && node.raws.ownSemicolon) {
        str.builder(node.raws.ownSemicolon, node, "end");
      }
    };
    if (hasNodes) {
      stack.push(close);
      pushBody(str, stack, node);
    } else {
      close();
    }
  }

  class Stringifier {
    constructor(builder) {
      this.builder = builder;
    }
    atrule(node, semicolon) {
      let start = atruleStart(this, node);
      if (node.nodes) {
        this.block(node, start);
      } else {
        let end = (node.raws.between || "") + (semicolon ? ";" : "");
        this.builder(start + end, node);
      }
    }
    beforeAfter(node, detect) {
      let value;
      if (node.type === "decl") {
        value = this.raw(node, null, "beforeDecl");
      } else if (node.type === "comment") {
        value = this.raw(node, null, "beforeComment");
      } else if (detect === "before") {
        value = this.raw(node, null, "beforeRule");
      } else {
        value = this.raw(node, null, "beforeClose");
      }
      let buf = node.parent;
      let depth = 0;
      while (buf && buf.type !== "root") {
        depth += 1;
        buf = buf.parent;
      }
      if (value.includes(`
`)) {
        let indent = this.raw(node, null, "indent");
        if (indent.length) {
          for (let step = 0;step < depth; step++)
            value += indent;
        }
      }
      return value;
    }
    block(node, start) {
      let between = this.raw(node, "between", "beforeOpen");
      this.builder(start + between + "{", node, "start");
      let after;
      if (node.nodes && node.nodes.length) {
        this.body(node);
        after = this.raw(node, "after");
      } else {
        after = this.raw(node, "after", "emptyBody");
      }
      if (after)
        this.builder(after);
      this.builder("}", node, "end");
    }
    body(node) {
      let proto = Stringifier.prototype;
      let expandable = ["atrule", "block", "body", "rule", "stringify"].every((method) => this[method] === proto[method]);
      let stack = [];
      pushBody(this, stack, node);
      while (stack.length > 0) {
        let entry = stack.pop();
        if (typeof entry === "function") {
          entry();
          continue;
        }
        let child = entry.node;
        let before = this.raw(child, "before");
        if (before) {
          this.builder(before);
        }
        if (expandable && child.type === "rule") {
          pushBlock(this, stack, child, this.rawValue(child, "selector"));
        } else if (expandable && child.type === "atrule" && child.nodes) {
          pushBlock(this, stack, child, atruleStart(this, child));
        } else {
          this.stringify(child, entry.semicolon);
        }
      }
    }
    comment(node) {
      let left = this.raw(node, "left", "commentLeft");
      let right = this.raw(node, "right", "commentRight");
      this.builder("/*" + left + node.text + right + "*/", node);
    }
    decl(node, semicolon) {
      let raws = node.raws;
      let between = this.raw(node, "between", "colon");
      let string = node.prop + between + this.rawValue(node, "value");
      if (node.important) {
        string += raws.important || " !important";
      }
      if (semicolon)
        string += ";";
      this.builder(string, node);
    }
    document(node) {
      this.body(node);
    }
    raw(node, own, detect) {
      let value;
      if (!detect)
        detect = own;
      if (own) {
        value = node.raws[own];
        if (typeof value !== "undefined")
          return value;
      }
      let parent = node.parent;
      if (detect === "before") {
        if (!parent || parent.type === "root" && parent.first === node) {
          return "";
        }
        if (parent && parent.type === "document") {
          return "";
        }
      }
      if (!parent)
        return DEFAULT_RAW[detect];
      let root = node.root();
      let cache = root.rawCache || (root.rawCache = {});
      if (typeof cache[detect] !== "undefined") {
        return cache[detect];
      }
      if (detect === "before" || detect === "after") {
        return this.beforeAfter(node, detect);
      } else {
        let method = "raw" + capitalize(detect);
        if (this[method]) {
          value = this[method](root, node);
        } else {
          root.walk((i) => {
            value = i.raws[own];
            if (typeof value !== "undefined")
              return false;
          });
        }
      }
      if (typeof value === "undefined")
        value = DEFAULT_RAW[detect];
      cache[detect] = value;
      return value;
    }
    rawBeforeClose(root) {
      let value;
      root.walk((i) => {
        if (i.nodes && i.nodes.length > 0) {
          if (typeof i.raws.after !== "undefined") {
            value = i.raws.after;
            if (value.includes(`
`)) {
              value = value.replace(/[^\n]+$/, "");
            }
            return false;
          }
        }
      });
      if (value)
        value = value.replace(/\S/g, "");
      return value;
    }
    rawBeforeComment(root, node) {
      let value;
      root.walkComments((i) => {
        if (typeof i.raws.before !== "undefined") {
          value = i.raws.before;
          if (value.includes(`
`)) {
            value = value.replace(/[^\n]+$/, "");
          }
          return false;
        }
      });
      if (typeof value === "undefined") {
        value = this.raw(node, null, "beforeDecl");
      } else if (value) {
        value = value.replace(/\S/g, "");
      }
      return value;
    }
    rawBeforeDecl(root, node) {
      let value;
      root.walkDecls((i) => {
        if (typeof i.raws.before !== "undefined") {
          value = i.raws.before;
          if (value.includes(`
`)) {
            value = value.replace(/[^\n]+$/, "");
          }
          return false;
        }
      });
      if (typeof value === "undefined") {
        value = this.raw(node, null, "beforeRule");
      } else if (value) {
        value = value.replace(/\S/g, "");
      }
      return value;
    }
    rawBeforeOpen(root) {
      let value;
      root.walk((i) => {
        if (i.type !== "decl") {
          value = i.raws.between;
          if (typeof value !== "undefined")
            return false;
        }
      });
      return value;
    }
    rawBeforeRule(root) {
      let value;
      root.walk((i) => {
        if (i.nodes && (i.parent !== root || root.first !== i)) {
          if (typeof i.raws.before !== "undefined") {
            value = i.raws.before;
            if (value.includes(`
`)) {
              value = value.replace(/[^\n]+$/, "");
            }
            return false;
          }
        }
      });
      if (value)
        value = value.replace(/\S/g, "");
      return value;
    }
    rawColon(root) {
      let value;
      root.walkDecls((i) => {
        if (typeof i.raws.between !== "undefined") {
          value = i.raws.between.replace(/[^\s:]/g, "");
          return false;
        }
      });
      return value;
    }
    rawEmptyBody(root) {
      let value;
      root.walk((i) => {
        if (i.nodes && i.nodes.length === 0) {
          value = i.raws.after;
          if (typeof value !== "undefined")
            return false;
        }
      });
      return value;
    }
    rawIndent(root) {
      if (root.raws.indent)
        return root.raws.indent;
      let value;
      root.walk((i) => {
        let p = i.parent;
        if (p && p !== root && p.parent && p.parent === root) {
          if (typeof i.raws.before !== "undefined") {
            let parts = i.raws.before.split(`
`);
            value = parts[parts.length - 1];
            value = value.replace(/\S/g, "");
            return false;
          }
        }
      });
      return value;
    }
    rawSemicolon(root) {
      let value;
      root.walk((i) => {
        if (i.nodes && i.nodes.length && i.last.type === "decl") {
          value = i.raws.semicolon;
          if (typeof value !== "undefined")
            return false;
        }
      });
      return value;
    }
    rawValue(node, prop) {
      let value = node[prop];
      let raw = node.raws[prop];
      if (raw && raw.value === value) {
        return raw.raw;
      }
      return value;
    }
    root(node) {
      let inDocument = node.parent && node.parent.type === "document";
      if (!inDocument && node.source && node.source.input.hasBOM) {
        this.builder("\uFEFF", node, "start");
      }
      this.body(node);
      if (node.raws.after) {
        this.builder(node.raws.after);
      }
    }
    rule(node) {
      this.block(node, this.rawValue(node, "selector"));
      if (node.raws.ownSemicolon) {
        this.builder(node.raws.ownSemicolon, node, "end");
      }
    }
    stringify(node, semicolon) {
      if (!this[node.type]) {
        throw new Error("Unknown AST node type " + node.type + ". " + "Maybe you need to change PostCSS stringifier.");
      }
      this[node.type](node, semicolon);
    }
  }
  module.exports = Stringifier;
  Stringifier.default = Stringifier;
});

// node_modules/postcss/lib/stringify.js
var require_stringify = __commonJS(function(exports, module) {
  var Stringifier = require_stringifier();
  var STYLE_TAG = /(<)(\/?style\b)/gi;
  var COMMENT_OPEN = /(<)(!--)/g;
  function escapeHTMLInCSS(str) {
    if (!str.includes("<"))
      return str;
    return str.replace(STYLE_TAG, "\\3c $2").replace(COMMENT_OPEN, "\\3c $2");
  }
  function cutEscaped(chunks, css, escaped) {
    let parts = [];
    let at = 0;
    let into = 0;
    for (let i = 0;i < chunks.length; i += 3) {
      let from = into;
      let end = at + chunks[i].length;
      while (at < end) {
        if (css[at] === escaped[into]) {
          at += 1;
          into += 1;
        } else {
          at += 1;
          into += 4;
        }
      }
      parts.push(escaped.slice(from, into));
    }
    return parts;
  }

  class SafeStringifier extends Stringifier {
    escapeHTML(print) {
      let builder = this.builder;
      let chunks, css;
      this.builder = (str, child, type) => {
        if (chunks) {
          css += str;
          chunks.push(str, child, type);
        } else if (str.includes("<")) {
          css = str;
          chunks = [str, child, type];
        } else {
          builder(str, child, type);
        }
      };
      print();
      this.builder = builder;
      if (!chunks)
        return;
      let escaped = escapeHTMLInCSS(css);
      if (escaped === css) {
        for (let i = 0;i < chunks.length; i += 3) {
          builder(chunks[i], chunks[i + 1], chunks[i + 2]);
        }
      } else {
        let parts = cutEscaped(chunks, css, escaped);
        for (let i = 0;i < chunks.length; i += 3) {
          builder(parts[i / 3], chunks[i + 1], chunks[i + 2]);
        }
      }
    }
    root(node) {
      if (node.parent && node.parent.type === "document") {
        this.escapeHTML(() => this.body(node));
        if (node.raws.after)
          this.builder(node.raws.after);
      } else {
        this.escapeHTML(() => super.root(node));
      }
    }
  }
  function stringify(node, builder) {
    let str = new SafeStringifier(builder);
    if (node.type === "root" || node.type === "document") {
      str.stringify(node);
    } else {
      str.escapeHTML(() => str.stringify(node));
    }
  }
  module.exports = stringify;
  stringify.default = stringify;
});

// node_modules/postcss/lib/symbols.js
var require_symbols = __commonJS(function(exports, module) {
  exports.isClean = Symbol("isClean");
  exports.my = Symbol("my");
});

// node_modules/postcss/lib/node.js
var require_node = __commonJS(function(exports, module) {
  var CssSyntaxError = require_css_syntax_error();
  var Stringifier = require_stringifier();
  var stringify = require_stringify();
  var { isClean, my } = require_symbols();
  function cloneNode(obj, parent) {
    let cloned = new obj.constructor;
    let stack = [[obj, cloned, parent]];
    while (stack.length > 0) {
      let [source, target, targetParent] = stack.pop();
      for (let i in source) {
        if (!Object.prototype.hasOwnProperty.call(source, i)) {
          continue;
        }
        if (i === "proxyCache")
          continue;
        let value = source[i];
        let type = typeof value;
        if (i === "parent" && type === "object") {
          if (targetParent)
            target[i] = targetParent;
        } else if (i === "source") {
          target[i] = value;
        } else if (Array.isArray(value)) {
          let children = [];
          target[i] = children;
          for (let j of value) {
            let childClone = new j.constructor;
            children.push(childClone);
            stack.push([j, childClone, target]);
          }
        } else {
          if (type === "object" && value !== null) {
            let valueClone = new value.constructor;
            stack.push([value, valueClone, undefined]);
            value = valueClone;
          }
          target[i] = value;
        }
      }
    }
    return cloned;
  }
  function sourceOffset(inputCSS, position) {
    if (position && typeof position.offset !== "undefined") {
      return position.offset;
    }
    let column = 1;
    let line = 1;
    let offset = 0;
    for (let i = 0;i < inputCSS.length; i++) {
      if (line === position.line && column === position.column) {
        offset = i;
        break;
      }
      if (inputCSS[i] === `
`) {
        column = 1;
        line += 1;
      } else {
        column += 1;
      }
    }
    return offset;
  }

  class Node2 {
    get proxyOf() {
      return this;
    }
    constructor(defaults = {}) {
      this.raws = {};
      this[isClean] = false;
      this[my] = true;
      for (let name of Object.keys(defaults)) {
        if (name === "__proto__")
          continue;
        if (name === "nodes") {
          this.nodes = [];
          for (let node of defaults[name]) {
            if (typeof node.clone === "function" && node.parent) {
              this.append(node.clone());
            } else {
              this.append(node);
            }
          }
        } else {
          this[name] = defaults[name];
        }
      }
    }
    addToError(error) {
      error.postcssNode = this;
      if (error.stack && this.source && /\n\s{4}at /.test(error.stack)) {
        let s = this.source;
        error.stack = error.stack.replace(/\n\s{4}at /, `$&${s.input.from}:${s.start.line}:${s.start.column}$&`);
      }
      return error;
    }
    after(add) {
      this.parent.insertAfter(this, add);
      return this;
    }
    assign(overrides = {}) {
      for (let name in overrides) {
        this[name] = overrides[name];
      }
      return this;
    }
    before(add) {
      this.parent.insertBefore(this, add);
      return this;
    }
    cleanRaws(keepBetween) {
      delete this.raws.before;
      delete this.raws.after;
      if (!keepBetween)
        delete this.raws.between;
    }
    clone(overrides = {}) {
      let cloned = cloneNode(this);
      for (let name in overrides) {
        cloned[name] = overrides[name];
      }
      return cloned;
    }
    cloneAfter(overrides = {}) {
      let cloned = this.clone(overrides);
      this.parent.insertAfter(this, cloned);
      return cloned;
    }
    cloneBefore(overrides = {}) {
      let cloned = this.clone(overrides);
      this.parent.insertBefore(this, cloned);
      return cloned;
    }
    error(message, opts = {}) {
      if (this.source) {
        let { end, start } = this.rangeBy(opts);
        return this.source.input.error(message, { column: start.column, line: start.line }, { column: end.column, line: end.line }, opts);
      }
      return new CssSyntaxError(message);
    }
    getProxyProcessor() {
      return {
        get(node, prop) {
          if (prop === "proxyOf") {
            return node;
          } else if (prop === "root") {
            return () => node.root().toProxy();
          } else {
            return node[prop];
          }
        },
        set(node, prop, value) {
          if (node[prop] === value)
            return true;
          node[prop] = value;
          if (prop === "prop" || prop === "value" || prop === "name" || prop === "params" || prop === "important" || prop === "text") {
            node.markDirty();
          }
          return true;
        }
      };
    }
    markClean() {
      this[isClean] = true;
    }
    markDirty() {
      if (this[isClean]) {
        this[isClean] = false;
        let next = this;
        while (next = next.parent) {
          next[isClean] = false;
        }
      }
    }
    next() {
      if (!this.parent)
        return;
      let index = this.parent.index(this);
      return this.parent.nodes[index + 1];
    }
    positionBy(opts = {}) {
      let inputString = "document" in this.source.input ? this.source.input.document : this.source.input.css;
      let pos = {
        column: this.source.start.column,
        line: this.source.start.line,
        offset: sourceOffset(inputString, this.source.start)
      };
      if (opts.index) {
        pos = this.positionInside(opts.index);
      } else if (opts.word) {
        let stringRepresentation = inputString.slice(sourceOffset(inputString, this.source.start), sourceOffset(inputString, this.source.end));
        let index = stringRepresentation.indexOf(opts.word);
        if (index !== -1)
          pos = this.positionInside(index);
      }
      return pos;
    }
    positionInside(index) {
      let column = this.source.start.column;
      let line = this.source.start.line;
      let inputString = "document" in this.source.input ? this.source.input.document : this.source.input.css;
      let offset = sourceOffset(inputString, this.source.start);
      let end = offset + index;
      for (let i = offset;i < end; i++) {
        if (inputString[i] === `
`) {
          column = 1;
          line += 1;
        } else {
          column += 1;
        }
      }
      return { column, line, offset: end };
    }
    prev() {
      if (!this.parent)
        return;
      let index = this.parent.index(this);
      return this.parent.nodes[index - 1];
    }
    rangeBy(opts = {}) {
      let inputString = "document" in this.source.input ? this.source.input.document : this.source.input.css;
      let start = {
        column: this.source.start.column,
        line: this.source.start.line,
        offset: sourceOffset(inputString, this.source.start)
      };
      let end = this.source.end ? {
        column: this.source.end.column + 1,
        line: this.source.end.line,
        offset: typeof this.source.end.offset === "number" ? this.source.end.offset : sourceOffset(inputString, this.source.end) + 1
      } : {
        column: start.column + 1,
        line: start.line,
        offset: start.offset + 1
      };
      if (opts.word) {
        let stringRepresentation = inputString.slice(sourceOffset(inputString, this.source.start), sourceOffset(inputString, this.source.end));
        let index = stringRepresentation.indexOf(opts.word);
        if (index !== -1) {
          start = this.positionInside(index);
          end = this.positionInside(index + opts.word.length);
        }
      } else {
        if (opts.start) {
          start = {
            column: opts.start.column,
            line: opts.start.line,
            offset: sourceOffset(inputString, opts.start)
          };
        } else if (typeof opts.index === "number") {
          start = this.positionInside(opts.index);
        }
        if (opts.end) {
          end = {
            column: opts.end.column,
            line: opts.end.line,
            offset: sourceOffset(inputString, opts.end)
          };
        } else if (typeof opts.endIndex === "number") {
          end = this.positionInside(opts.endIndex);
        } else if (typeof opts.index === "number") {
          end = this.positionInside(opts.index + 1);
        }
      }
      if (end.line < start.line || end.line === start.line && end.column <= start.column) {
        end = {
          column: start.column + 1,
          line: start.line,
          offset: start.offset + 1
        };
      }
      return { end, start };
    }
    raw(prop, defaultType) {
      let str = new Stringifier;
      return str.raw(this, prop, defaultType);
    }
    remove() {
      if (this.parent) {
        this.parent.removeChild(this);
      }
      this.parent = undefined;
      return this;
    }
    replaceWith(...nodes) {
      if (this.parent) {
        let bookmark = this;
        let foundSelf = false;
        for (let node of nodes) {
          if (node === this) {
            foundSelf = true;
          } else if (foundSelf) {
            this.parent.insertAfter(bookmark, node);
            bookmark = node;
          } else {
            this.parent.insertBefore(bookmark, node);
          }
        }
        if (!foundSelf) {
          this.remove();
        }
      }
      return this;
    }
    root() {
      let result = this;
      while (result.parent && result.parent.type !== "document") {
        result = result.parent;
      }
      return result;
    }
    toJSON(_, inputs) {
      let emitInputs = inputs == null;
      inputs = inputs || new Map;
      let holderOfRoot = [];
      let queue = [[this, holderOfRoot, 0]];
      for (let step = 0;step < queue.length; step++) {
        let [node, holder, key] = queue[step];
        let fixed = {};
        holder[key] = fixed;
        for (let name in node) {
          if (!Object.prototype.hasOwnProperty.call(node, name)) {
            continue;
          }
          if (name === "parent" || name === "proxyCache")
            continue;
          let value = node[name];
          if (Array.isArray(value)) {
            let fixedArray = [];
            fixed[name] = fixedArray;
            for (let i = 0;i < value.length; i++) {
              let item = value[i];
              if (typeof item === "object" && item.toJSON) {
                if (item.toJSON === Node2.prototype.toJSON) {
                  queue.push([item, fixedArray, i]);
                } else {
                  fixedArray[i] = item.toJSON(null, inputs);
                }
              } else {
                fixedArray[i] = item;
              }
            }
          } else if (typeof value === "object" && value.toJSON) {
            if (value.toJSON === Node2.prototype.toJSON) {
              queue.push([value, fixed, name]);
            } else {
              fixed[name] = value.toJSON(null, inputs);
            }
          } else if (name === "source") {
            if (value == null)
              continue;
            let inputId = inputs.get(value.input);
            if (inputId == null) {
              inputId = inputs.size;
              inputs.set(value.input, inputId);
            }
            fixed[name] = {
              end: value.end,
              inputId,
              start: value.start
            };
          } else {
            fixed[name] = value;
          }
        }
      }
      let fixed = holderOfRoot[0];
      if (emitInputs) {
        fixed.inputs = [...inputs.keys()].map((input) => input.toJSON());
      }
      return fixed;
    }
    toProxy() {
      if (!this.proxyCache) {
        this.proxyCache = new Proxy(this, this.getProxyProcessor());
      }
      return this.proxyCache;
    }
    toString(stringifier = stringify) {
      if (stringifier.stringify)
        stringifier = stringifier.stringify;
      let result = "";
      stringifier(this, (i) => {
        result += i;
      });
      return result;
    }
    warn(result, text, opts = {}) {
      let data = { node: this };
      for (let i in opts)
        data[i] = opts[i];
      return result.warn(text, data);
    }
  }
  module.exports = Node2;
  Node2.default = Node2;
});

// node_modules/postcss/lib/comment.js
var require_comment = __commonJS(function(exports, module) {
  var Node2 = require_node();

  class Comment extends Node2 {
    constructor(defaults) {
      super(defaults);
      this.type = "comment";
    }
  }
  module.exports = Comment;
  Comment.default = Comment;
});

// node_modules/postcss/lib/declaration.js
var require_declaration = __commonJS(function(exports, module) {
  var Node2 = require_node();

  class Declaration extends Node2 {
    get variable() {
      return this.prop.startsWith("--") || this.prop[0] === "$";
    }
    constructor(defaults) {
      if (defaults && typeof defaults.value !== "undefined" && typeof defaults.value !== "string") {
        defaults = { ...defaults, value: String(defaults.value) };
      }
      super(defaults);
      this.type = "decl";
    }
  }
  module.exports = Declaration;
  Declaration.default = Declaration;
});

// node_modules/postcss/lib/container.js
var require_container = __commonJS(function(exports, module) {
  var Comment = require_comment();
  var Declaration = require_declaration();
  var Node2 = require_node();
  var { isClean, my } = require_symbols();
  var AtRule;
  var parse;
  var Root;
  var Rule;
  function cleanSource(nodes) {
    let stack = nodes.slice();
    while (stack.length > 0) {
      let node = stack.pop();
      delete node.source;
      if (node.nodes) {
        node.nodes = node.nodes.slice();
        for (let i of node.nodes)
          stack.push(i);
      }
    }
    return nodes.slice();
  }
  function markTreeDirty(node) {
    let stack = [node];
    while (stack.length > 0) {
      let next = stack.pop();
      next[isClean] = false;
      if (next.proxyOf.nodes) {
        for (let i of next.proxyOf.nodes)
          stack.push(i);
      }
    }
  }

  class Container extends Node2 {
    get first() {
      if (!this.proxyOf.nodes)
        return;
      return this.proxyOf.nodes[0];
    }
    get last() {
      if (!this.proxyOf.nodes)
        return;
      return this.proxyOf.nodes[this.proxyOf.nodes.length - 1];
    }
    append(...children) {
      for (let child of children) {
        let nodes = this.normalize(child, this.last);
        for (let node of nodes)
          this.proxyOf.nodes.push(node);
      }
      this.markDirty();
      return this;
    }
    cleanRaws(keepBetween) {
      let stack = [this];
      while (stack.length > 0) {
        let node = stack.pop();
        if (node !== this && node.cleanRaws !== Container.prototype.cleanRaws) {
          node.cleanRaws(keepBetween);
          continue;
        }
        Node2.prototype.cleanRaws.call(node, keepBetween);
        if (node.nodes) {
          for (let child of node.nodes)
            stack.push(child);
        }
      }
    }
    each(callback) {
      if (!this.proxyOf.nodes)
        return;
      let iterator = this.getIterator();
      let index, result;
      while (this.indexes[iterator] < this.proxyOf.nodes.length) {
        index = this.indexes[iterator];
        result = callback(this.proxyOf.nodes[index], index);
        if (result === false)
          break;
        this.indexes[iterator] += 1;
      }
      delete this.indexes[iterator];
      return result;
    }
    every(condition) {
      return this.nodes.every(condition);
    }
    getIterator() {
      if (!this.lastEach)
        this.lastEach = 0;
      if (!this.indexes)
        this.indexes = {};
      this.lastEach += 1;
      let iterator = this.lastEach;
      this.indexes[iterator] = 0;
      return iterator;
    }
    getProxyProcessor() {
      return {
        get(node, prop) {
          if (prop === "proxyOf") {
            return node;
          } else if (!node[prop]) {
            return node[prop];
          } else if (prop === "each" || typeof prop === "string" && prop.startsWith("walk")) {
            return (...args) => {
              return node[prop](...args.map((i) => {
                if (typeof i === "function") {
                  return (child, index) => i(child.toProxy(), index);
                } else {
                  return i;
                }
              }));
            };
          } else if (prop === "every" || prop === "some") {
            return (cb) => {
              return node[prop]((child, ...other) => cb(child.toProxy(), ...other));
            };
          } else if (prop === "root") {
            return () => node.root().toProxy();
          } else if (prop === "nodes") {
            return node.nodes.map((i) => i.toProxy());
          } else if (prop === "first" || prop === "last") {
            return node[prop].toProxy();
          } else {
            return node[prop];
          }
        },
        set(node, prop, value) {
          if (node[prop] === value)
            return true;
          node[prop] = value;
          if (prop === "name" || prop === "params" || prop === "selector") {
            node.markDirty();
          }
          return true;
        }
      };
    }
    index(child) {
      if (typeof child === "number")
        return child;
      if (child.proxyOf)
        child = child.proxyOf;
      return this.proxyOf.nodes.indexOf(child);
    }
    insertAfter(exist, add) {
      let existIndex = this.index(exist);
      let nodes = this.normalize(add, this.proxyOf.nodes[existIndex]).reverse();
      existIndex = this.index(exist);
      for (let node of nodes)
        this.proxyOf.nodes.splice(existIndex + 1, 0, node);
      let index;
      for (let id in this.indexes) {
        index = this.indexes[id];
        if (existIndex < index) {
          this.indexes[id] = index + nodes.length;
        }
      }
      this.markDirty();
      return this;
    }
    insertBefore(exist, add) {
      let existIndex = this.index(exist);
      let type = existIndex === 0 ? "prepend" : false;
      let nodes = this.normalize(add, this.proxyOf.nodes[existIndex], type).reverse();
      existIndex = this.index(exist);
      for (let node of nodes)
        this.proxyOf.nodes.splice(existIndex, 0, node);
      let index;
      for (let id in this.indexes) {
        index = this.indexes[id];
        if (existIndex <= index) {
          this.indexes[id] = index + nodes.length;
        }
      }
      this.markDirty();
      return this;
    }
    normalize(nodes, sample) {
      if (typeof nodes === "string") {
        nodes = cleanSource(parse(nodes).nodes);
      } else if (typeof nodes === "undefined") {
        nodes = [];
      } else if (Array.isArray(nodes)) {
        nodes = nodes.slice(0);
        for (let i of nodes) {
          if (i.parent)
            i.parent.removeChild(i, "ignore");
        }
      } else if (nodes.type === "root" && this.type !== "document") {
        nodes = nodes.nodes.slice(0);
        for (let i of nodes) {
          if (i.parent)
            i.parent.removeChild(i, "ignore");
        }
      } else if (nodes.type) {
        nodes = [nodes];
      } else if (nodes.prop) {
        if (typeof nodes.value === "undefined") {
          throw new Error("Value field is missed in node creation");
        } else if (typeof nodes.value !== "string") {
          nodes.value = String(nodes.value);
        }
        nodes = [new Declaration(nodes)];
      } else if (nodes.selector || nodes.selectors) {
        nodes = [new Rule(nodes)];
      } else if (nodes.name) {
        nodes = [new AtRule(nodes)];
      } else if (nodes.text) {
        nodes = [new Comment(nodes)];
      } else {
        throw new Error("Unknown node type in node creation");
      }
      let processed = nodes.map((i) => {
        if (!i[my])
          Container.rebuild(i);
        i = i.proxyOf;
        if (i.parent)
          i.parent.removeChild(i);
        if (i[isClean])
          markTreeDirty(i);
        if (!i.raws)
          i.raws = {};
        if (typeof i.raws.before === "undefined") {
          if (sample && typeof sample.raws.before !== "undefined") {
            i.raws.before = sample.raws.before.replace(/\S/g, "");
          }
        }
        i.parent = this.proxyOf;
        return i;
      });
      return processed;
    }
    prepend(...children) {
      children = children.reverse();
      for (let child of children) {
        let nodes = this.normalize(child, this.first, "prepend").reverse();
        for (let node of nodes)
          this.proxyOf.nodes.unshift(node);
        for (let id in this.indexes) {
          this.indexes[id] = this.indexes[id] + nodes.length;
        }
      }
      this.markDirty();
      return this;
    }
    push(child) {
      child.parent = this;
      this.proxyOf.nodes.push(child);
      return this;
    }
    removeAll() {
      for (let node of this.proxyOf.nodes)
        node.parent = undefined;
      this.proxyOf.nodes = [];
      this.markDirty();
      return this;
    }
    removeChild(child) {
      child = this.index(child);
      this.proxyOf.nodes[child].parent = undefined;
      this.proxyOf.nodes.splice(child, 1);
      let index;
      for (let id in this.indexes) {
        index = this.indexes[id];
        if (index >= child) {
          this.indexes[id] = index - 1;
        }
      }
      this.markDirty();
      return this;
    }
    replaceValues(pattern, opts, callback) {
      if (!callback) {
        callback = opts;
        opts = {};
      }
      this.walkDecls((decl) => {
        if (opts.props && !opts.props.includes(decl.prop))
          return;
        if (opts.fast && !decl.value.includes(opts.fast))
          return;
        decl.value = decl.value.replace(pattern, callback);
      });
      this.markDirty();
      return this;
    }
    some(condition) {
      return this.nodes.some(condition);
    }
    walk(callback) {
      if (!this.proxyOf.nodes)
        return;
      let stack = [{ iterator: this.getIterator(), node: this.proxyOf }];
      while (stack.length > 0) {
        let { iterator, node } = stack[stack.length - 1];
        let index = node.indexes[iterator];
        if (index >= node.proxyOf.nodes.length) {
          delete node.indexes[iterator];
          stack.pop();
          let parent = stack[stack.length - 1];
          if (parent)
            parent.node.indexes[parent.iterator] += 1;
          continue;
        }
        let child = node.proxyOf.nodes[index];
        let result;
        try {
          result = callback(child, index);
        } catch (e) {
          throw child.addToError(e);
        }
        if (result === false) {
          for (let opened of stack) {
            delete opened.node.indexes[opened.iterator];
          }
          return false;
        }
        if (child.walk && child.proxyOf.nodes) {
          stack.push({ iterator: child.getIterator(), node: child });
        } else {
          node.indexes[iterator] += 1;
        }
      }
      return;
    }
    walkAtRules(name, callback) {
      if (!callback) {
        callback = name;
        return this.walk((child, i) => {
          if (child.type === "atrule") {
            return callback(child, i);
          }
        });
      }
      if (name instanceof RegExp) {
        return this.walk((child, i) => {
          if (child.type === "atrule" && name.test(child.name)) {
            return callback(child, i);
          }
        });
      }
      return this.walk((child, i) => {
        if (child.type === "atrule" && child.name === name) {
          return callback(child, i);
        }
      });
    }
    walkComments(callback) {
      return this.walk((child, i) => {
        if (child.type === "comment") {
          return callback(child, i);
        }
      });
    }
    walkDecls(prop, callback) {
      if (!callback) {
        callback = prop;
        return this.walk((child, i) => {
          if (child.type === "decl") {
            return callback(child, i);
          }
        });
      }
      if (prop instanceof RegExp) {
        return this.walk((child, i) => {
          if (child.type === "decl" && prop.test(child.prop)) {
            return callback(child, i);
          }
        });
      }
      return this.walk((child, i) => {
        if (child.type === "decl" && child.prop === prop) {
          return callback(child, i);
        }
      });
    }
    walkRules(selector, callback) {
      if (!callback) {
        callback = selector;
        return this.walk((child, i) => {
          if (child.type === "rule") {
            return callback(child, i);
          }
        });
      }
      if (selector instanceof RegExp) {
        return this.walk((child, i) => {
          if (child.type === "rule" && selector.test(child.selector)) {
            return callback(child, i);
          }
        });
      }
      return this.walk((child, i) => {
        if (child.type === "rule" && child.selector === selector) {
          return callback(child, i);
        }
      });
    }
  }
  Container.registerParse = (dependant) => {
    parse = dependant;
  };
  Container.registerRule = (dependant) => {
    Rule = dependant;
  };
  Container.registerAtRule = (dependant) => {
    AtRule = dependant;
  };
  Container.registerRoot = (dependant) => {
    Root = dependant;
  };
  module.exports = Container;
  Container.default = Container;
  Container.rebuild = (node) => {
    let stack = [node];
    while (stack.length > 0) {
      let next = stack.pop();
      if (next.type === "atrule") {
        Object.setPrototypeOf(next, AtRule.prototype);
      } else if (next.type === "rule") {
        Object.setPrototypeOf(next, Rule.prototype);
      } else if (next.type === "decl") {
        Object.setPrototypeOf(next, Declaration.prototype);
      } else if (next.type === "comment") {
        Object.setPrototypeOf(next, Comment.prototype);
      } else if (next.type === "root") {
        Object.setPrototypeOf(next, Root.prototype);
      }
      next[my] = true;
      if (next.nodes) {
        for (let child of next.nodes)
          stack.push(child);
      }
    }
  };
});

// node_modules/postcss/lib/at-rule.js
var require_at_rule = __commonJS(function(exports, module) {
  var Container = require_container();

  class AtRule extends Container {
    constructor(defaults) {
      super(defaults);
      this.type = "atrule";
    }
    append(...children) {
      if (!this.proxyOf.nodes)
        this.nodes = [];
      return super.append(...children);
    }
    prepend(...children) {
      if (!this.proxyOf.nodes)
        this.nodes = [];
      return super.prepend(...children);
    }
  }
  module.exports = AtRule;
  AtRule.default = AtRule;
  Container.registerAtRule(AtRule);
});

// node_modules/postcss/lib/document.js
var require_document = __commonJS(function(exports, module) {
  var Container = require_container();
  var LazyResult;
  var Processor;

  class Document extends Container {
    constructor(defaults) {
      super({ type: "document", ...defaults });
      if (!this.nodes) {
        this.nodes = [];
      }
    }
    toResult(opts = {}) {
      let lazy = new LazyResult(new Processor, this, opts);
      return lazy.stringify();
    }
  }
  Document.registerLazyResult = (dependant) => {
    LazyResult = dependant;
  };
  Document.registerProcessor = (dependant) => {
    Processor = dependant;
  };
  module.exports = Document;
  Document.default = Document;
});

// node_modules/nanoid/non-secure/index.cjs
var require_non_secure = __commonJS(function(exports, module) {
  var urlAlphabet = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";
  var customAlphabet = (alphabet, defaultSize = 21) => {
    return (size = defaultSize) => {
      let id = "";
      let i = size | 0;
      while (i-- > 0) {
        id += alphabet[Math.random() * alphabet.length | 0];
      }
      return id;
    };
  };
  var nanoid = (size = 21) => {
    let id = "";
    let i = size | 0;
    while (i-- > 0) {
      id += urlAlphabet[Math.random() * 64 | 0];
    }
    return id;
  };
  module.exports = { nanoid, customAlphabet };
});

// node_modules/source-map-js/lib/base64.js
var require_base64 = __commonJS(function(exports) {
  var intToCharMap = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split("");
  exports.encode = function(number) {
    if (0 <= number && number < intToCharMap.length) {
      return intToCharMap[number];
    }
    throw new TypeError("Must be between 0 and 63: " + number);
  };
  exports.decode = function(charCode) {
    var bigA = 65;
    var bigZ = 90;
    var littleA = 97;
    var littleZ = 122;
    var zero = 48;
    var nine = 57;
    var plus = 43;
    var slash = 47;
    var littleOffset = 26;
    var numberOffset = 52;
    if (bigA <= charCode && charCode <= bigZ) {
      return charCode - bigA;
    }
    if (littleA <= charCode && charCode <= littleZ) {
      return charCode - littleA + littleOffset;
    }
    if (zero <= charCode && charCode <= nine) {
      return charCode - zero + numberOffset;
    }
    if (charCode == plus) {
      return 62;
    }
    if (charCode == slash) {
      return 63;
    }
    return -1;
  };
});

// node_modules/source-map-js/lib/base64-vlq.js
var require_base64_vlq = __commonJS(function(exports) {
  var base64 = require_base64();
  var VLQ_BASE_SHIFT = 5;
  var VLQ_BASE = 1 << VLQ_BASE_SHIFT;
  var VLQ_BASE_MASK = VLQ_BASE - 1;
  var VLQ_CONTINUATION_BIT = VLQ_BASE;
  function toVLQSigned(aValue) {
    return aValue < 0 ? (-aValue << 1) + 1 : (aValue << 1) + 0;
  }
  function fromVLQSigned(aValue) {
    var isNegative = (aValue & 1) === 1;
    var shifted = aValue >> 1;
    return isNegative ? -shifted : shifted;
  }
  exports.encode = function base64VLQ_encode(aValue) {
    var encoded = "";
    var digit;
    var vlq = toVLQSigned(aValue);
    do {
      digit = vlq & VLQ_BASE_MASK;
      vlq >>>= VLQ_BASE_SHIFT;
      if (vlq > 0) {
        digit |= VLQ_CONTINUATION_BIT;
      }
      encoded += base64.encode(digit);
    } while (vlq > 0);
    return encoded;
  };
  exports.decode = function base64VLQ_decode(aStr, aIndex, aOutParam) {
    var strLen = aStr.length;
    var result = 0;
    var shift = 0;
    var continuation, digit;
    do {
      if (aIndex >= strLen) {
        throw new Error("Expected more digits in base 64 VLQ value.");
      }
      digit = base64.decode(aStr.charCodeAt(aIndex++));
      if (digit === -1) {
        throw new Error("Invalid base64 digit: " + aStr.charAt(aIndex - 1));
      }
      continuation = !!(digit & VLQ_CONTINUATION_BIT);
      digit &= VLQ_BASE_MASK;
      result = result + (digit << shift);
      shift += VLQ_BASE_SHIFT;
    } while (continuation);
    aOutParam.value = fromVLQSigned(result);
    aOutParam.rest = aIndex;
  };
});

// node_modules/source-map-js/lib/util.js
var require_util = __commonJS(function(exports) {
  function getArg(aArgs, aName, aDefaultValue) {
    if (aName in aArgs) {
      return aArgs[aName];
    } else if (arguments.length === 3) {
      return aDefaultValue;
    } else {
      throw new Error('"' + aName + '" is a required argument.');
    }
  }
  exports.getArg = getArg;
  var urlRegexp = /^(?:([\w+\-.]+):)?\/\/(?:(\w+:\w+)@)?([\w.-]*)(?::(\d+))?(.*)$/;
  var dataUrlRegexp = /^data:.+\,.+$/;
  function urlParse(aUrl) {
    var match = aUrl.match(urlRegexp);
    if (!match) {
      return null;
    }
    return {
      scheme: match[1],
      auth: match[2],
      host: match[3],
      port: match[4],
      path: match[5]
    };
  }
  exports.urlParse = urlParse;
  function urlGenerate(aParsedUrl) {
    var url = "";
    if (aParsedUrl.scheme) {
      url += aParsedUrl.scheme + ":";
    }
    url += "//";
    if (aParsedUrl.auth) {
      url += aParsedUrl.auth + "@";
    }
    if (aParsedUrl.host) {
      url += aParsedUrl.host;
    }
    if (aParsedUrl.port) {
      url += ":" + aParsedUrl.port;
    }
    if (aParsedUrl.path) {
      url += aParsedUrl.path;
    }
    return url;
  }
  exports.urlGenerate = urlGenerate;
  var MAX_CACHED_INPUTS = 32;
  function lruMemoize(f) {
    var cache = [];
    return function(input) {
      for (var i = 0;i < cache.length; i++) {
        if (cache[i].input === input) {
          var temp = cache[0];
          cache[0] = cache[i];
          cache[i] = temp;
          return cache[0].result;
        }
      }
      var result = f(input);
      cache.unshift({
        input,
        result
      });
      if (cache.length > MAX_CACHED_INPUTS) {
        cache.pop();
      }
      return result;
    };
  }
  var normalize = lruMemoize(function normalize(aPath) {
    var path = aPath;
    var url = urlParse(aPath);
    if (url) {
      if (!url.path) {
        return aPath;
      }
      path = url.path;
    }
    var isAbsolute = exports.isAbsolute(path);
    var parts = [];
    var start = 0;
    var i = 0;
    while (true) {
      start = i;
      i = path.indexOf("/", start);
      if (i === -1) {
        parts.push(path.slice(start));
        break;
      } else {
        parts.push(path.slice(start, i));
        while (i < path.length && path[i] === "/") {
          i++;
        }
      }
    }
    for (var part, up = 0, i = parts.length - 1;i >= 0; i--) {
      part = parts[i];
      if (part === ".") {
        parts.splice(i, 1);
      } else if (part === "..") {
        up++;
      } else if (up > 0) {
        if (part === "") {
          parts.splice(i + 1, up);
          up = 0;
        } else {
          parts.splice(i, 2);
          up--;
        }
      }
    }
    path = parts.join("/");
    if (path === "") {
      path = isAbsolute ? "/" : ".";
    }
    if (url) {
      url.path = path;
      return urlGenerate(url);
    }
    return path;
  });
  exports.normalize = normalize;
  function join(aRoot, aPath) {
    if (aRoot === "") {
      aRoot = ".";
    }
    if (aPath === "") {
      aPath = ".";
    }
    var aPathUrl = urlParse(aPath);
    var aRootUrl = urlParse(aRoot);
    if (aRootUrl) {
      aRoot = aRootUrl.path || "/";
    }
    if (aPathUrl && !aPathUrl.scheme) {
      if (aRootUrl) {
        aPathUrl.scheme = aRootUrl.scheme;
      }
      return urlGenerate(aPathUrl);
    }
    if (aPathUrl || aPath.match(dataUrlRegexp)) {
      return aPath;
    }
    if (aRootUrl && !aRootUrl.host && !aRootUrl.path) {
      aRootUrl.host = aPath;
      return urlGenerate(aRootUrl);
    }
    var joined = aPath.charAt(0) === "/" ? aPath : normalize(aRoot.replace(/\/+$/, "") + "/" + aPath);
    if (aRootUrl) {
      aRootUrl.path = joined;
      return urlGenerate(aRootUrl);
    }
    return joined;
  }
  exports.join = join;
  exports.isAbsolute = function(aPath) {
    return aPath.charAt(0) === "/" || urlRegexp.test(aPath);
  };
  function relative(aRoot, aPath) {
    if (aRoot === "") {
      aRoot = ".";
    }
    aRoot = aRoot.replace(/\/$/, "");
    var level = 0;
    while (aPath.indexOf(aRoot + "/") !== 0) {
      var index = aRoot.lastIndexOf("/");
      if (index < 0) {
        return aPath;
      }
      aRoot = aRoot.slice(0, index);
      if (aRoot.match(/^([^\/]+:\/)?\/*$/)) {
        return aPath;
      }
      ++level;
    }
    return Array(level + 1).join("../") + aPath.substr(aRoot.length + 1);
  }
  exports.relative = relative;
  var supportsNullProto = function() {
    var obj = Object.create(null);
    return !("__proto__" in obj);
  }();
  function identity(s) {
    return s;
  }
  function toSetString(aStr) {
    if (isProtoString(aStr)) {
      return "$" + aStr;
    }
    return aStr;
  }
  exports.toSetString = supportsNullProto ? identity : toSetString;
  function fromSetString(aStr) {
    if (isProtoString(aStr)) {
      return aStr.slice(1);
    }
    return aStr;
  }
  exports.fromSetString = supportsNullProto ? identity : fromSetString;
  function isProtoString(s) {
    if (!s) {
      return false;
    }
    var length = s.length;
    if (length < 9) {
      return false;
    }
    if (s.charCodeAt(length - 1) !== 95 || s.charCodeAt(length - 2) !== 95 || s.charCodeAt(length - 3) !== 111 || s.charCodeAt(length - 4) !== 116 || s.charCodeAt(length - 5) !== 111 || s.charCodeAt(length - 6) !== 114 || s.charCodeAt(length - 7) !== 112 || s.charCodeAt(length - 8) !== 95 || s.charCodeAt(length - 9) !== 95) {
      return false;
    }
    for (var i = length - 10;i >= 0; i--) {
      if (s.charCodeAt(i) !== 36) {
        return false;
      }
    }
    return true;
  }
  function compareByOriginalPositions(mappingA, mappingB, onlyCompareOriginal) {
    var cmp = strcmp(mappingA.source, mappingB.source);
    if (cmp !== 0) {
      return cmp;
    }
    cmp = mappingA.originalLine - mappingB.originalLine;
    if (cmp !== 0) {
      return cmp;
    }
    cmp = mappingA.originalColumn - mappingB.originalColumn;
    if (cmp !== 0 || onlyCompareOriginal) {
      return cmp;
    }
    cmp = mappingA.generatedColumn - mappingB.generatedColumn;
    if (cmp !== 0) {
      return cmp;
    }
    cmp = mappingA.generatedLine - mappingB.generatedLine;
    if (cmp !== 0) {
      return cmp;
    }
    return strcmp(mappingA.name, mappingB.name);
  }
  exports.compareByOriginalPositions = compareByOriginalPositions;
  function compareByOriginalPositionsNoSource(mappingA, mappingB, onlyCompareOriginal) {
    var cmp;
    cmp = mappingA.originalLine - mappingB.originalLine;
    if (cmp !== 0) {
      return cmp;
    }
    cmp = mappingA.originalColumn - mappingB.originalColumn;
    if (cmp !== 0 || onlyCompareOriginal) {
      return cmp;
    }
    cmp = mappingA.generatedColumn - mappingB.generatedColumn;
    if (cmp !== 0) {
      return cmp;
    }
    cmp = mappingA.generatedLine - mappingB.generatedLine;
    if (cmp !== 0) {
      return cmp;
    }
    return strcmp(mappingA.name, mappingB.name);
  }
  exports.compareByOriginalPositionsNoSource = compareByOriginalPositionsNoSource;
  function compareByGeneratedPositionsDeflated(mappingA, mappingB, onlyCompareGenerated) {
    var cmp = mappingA.generatedLine - mappingB.generatedLine;
    if (cmp !== 0) {
      return cmp;
    }
    cmp = mappingA.generatedColumn - mappingB.generatedColumn;
    if (cmp !== 0 || onlyCompareGenerated) {
      return cmp;
    }
    cmp = strcmp(mappingA.source, mappingB.source);
    if (cmp !== 0) {
      return cmp;
    }
    cmp = mappingA.originalLine - mappingB.originalLine;
    if (cmp !== 0) {
      return cmp;
    }
    cmp = mappingA.originalColumn - mappingB.originalColumn;
    if (cmp !== 0) {
      return cmp;
    }
    return strcmp(mappingA.name, mappingB.name);
  }
  exports.compareByGeneratedPositionsDeflated = compareByGeneratedPositionsDeflated;
  function compareByGeneratedPositionsDeflatedNoLine(mappingA, mappingB, onlyCompareGenerated) {
    var cmp = mappingA.generatedColumn - mappingB.generatedColumn;
    if (cmp !== 0 || onlyCompareGenerated) {
      return cmp;
    }
    cmp = strcmp(mappingA.source, mappingB.source);
    if (cmp !== 0) {
      return cmp;
    }
    cmp = mappingA.originalLine - mappingB.originalLine;
    if (cmp !== 0) {
      return cmp;
    }
    cmp = mappingA.originalColumn - mappingB.originalColumn;
    if (cmp !== 0) {
      return cmp;
    }
    return strcmp(mappingA.name, mappingB.name);
  }
  exports.compareByGeneratedPositionsDeflatedNoLine = compareByGeneratedPositionsDeflatedNoLine;
  function strcmp(aStr1, aStr2) {
    if (aStr1 === aStr2) {
      return 0;
    }
    if (aStr1 === null) {
      return 1;
    }
    if (aStr2 === null) {
      return -1;
    }
    if (aStr1 > aStr2) {
      return 1;
    }
    return -1;
  }
  function compareByGeneratedPositionsInflated(mappingA, mappingB) {
    var cmp = mappingA.generatedLine - mappingB.generatedLine;
    if (cmp !== 0) {
      return cmp;
    }
    cmp = mappingA.generatedColumn - mappingB.generatedColumn;
    if (cmp !== 0) {
      return cmp;
    }
    cmp = strcmp(mappingA.source, mappingB.source);
    if (cmp !== 0) {
      return cmp;
    }
    cmp = mappingA.originalLine - mappingB.originalLine;
    if (cmp !== 0) {
      return cmp;
    }
    cmp = mappingA.originalColumn - mappingB.originalColumn;
    if (cmp !== 0) {
      return cmp;
    }
    return strcmp(mappingA.name, mappingB.name);
  }
  exports.compareByGeneratedPositionsInflated = compareByGeneratedPositionsInflated;
  function parseSourceMapInput(str) {
    return JSON.parse(str.replace(/^\)]}'[^\n]*\n/, ""));
  }
  exports.parseSourceMapInput = parseSourceMapInput;
  function computeSourceURL(sourceRoot, sourceURL, sourceMapURL) {
    sourceURL = sourceURL || "";
    if (sourceRoot) {
      if (sourceRoot[sourceRoot.length - 1] !== "/" && sourceURL[0] !== "/") {
        sourceRoot += "/";
      }
      sourceURL = sourceRoot + sourceURL;
    }
    if (sourceMapURL) {
      var parsed = urlParse(sourceMapURL);
      if (!parsed) {
        throw new Error("sourceMapURL could not be parsed");
      }
      if (parsed.path) {
        var index = parsed.path.lastIndexOf("/");
        if (index >= 0) {
          parsed.path = parsed.path.substring(0, index + 1);
        }
      }
      sourceURL = join(urlGenerate(parsed), sourceURL);
    }
    return normalize(sourceURL);
  }
  exports.computeSourceURL = computeSourceURL;
});

// node_modules/source-map-js/lib/array-set.js
var require_array_set = __commonJS(function(exports) {
  var util = require_util();
  var has = Object.prototype.hasOwnProperty;
  var hasNativeMap = typeof Map !== "undefined";
  function ArraySet() {
    this._array = [];
    this._set = hasNativeMap ? new Map : Object.create(null);
  }
  ArraySet.fromArray = function ArraySet_fromArray(aArray, aAllowDuplicates) {
    var set = new ArraySet;
    for (var i = 0, len = aArray.length;i < len; i++) {
      set.add(aArray[i], aAllowDuplicates);
    }
    return set;
  };
  ArraySet.prototype.size = function ArraySet_size() {
    return hasNativeMap ? this._set.size : Object.getOwnPropertyNames(this._set).length;
  };
  ArraySet.prototype.add = function ArraySet_add(aStr, aAllowDuplicates) {
    var sStr = hasNativeMap ? aStr : util.toSetString(aStr);
    var isDuplicate = hasNativeMap ? this.has(aStr) : has.call(this._set, sStr);
    var idx = this._array.length;
    if (!isDuplicate || aAllowDuplicates) {
      this._array.push(aStr);
    }
    if (!isDuplicate) {
      if (hasNativeMap) {
        this._set.set(aStr, idx);
      } else {
        this._set[sStr] = idx;
      }
    }
  };
  ArraySet.prototype.has = function ArraySet_has(aStr) {
    if (hasNativeMap) {
      return this._set.has(aStr);
    } else {
      var sStr = util.toSetString(aStr);
      return has.call(this._set, sStr);
    }
  };
  ArraySet.prototype.indexOf = function ArraySet_indexOf(aStr) {
    if (hasNativeMap) {
      var idx = this._set.get(aStr);
      if (idx >= 0) {
        return idx;
      }
    } else {
      var sStr = util.toSetString(aStr);
      if (has.call(this._set, sStr)) {
        return this._set[sStr];
      }
    }
    throw new Error('"' + aStr + '" is not in the set.');
  };
  ArraySet.prototype.at = function ArraySet_at(aIdx) {
    if (aIdx >= 0 && aIdx < this._array.length) {
      return this._array[aIdx];
    }
    throw new Error("No element indexed by " + aIdx);
  };
  ArraySet.prototype.toArray = function ArraySet_toArray() {
    return this._array.slice();
  };
  exports.ArraySet = ArraySet;
});

// node_modules/source-map-js/lib/mapping-list.js
var require_mapping_list = __commonJS(function(exports) {
  var util = require_util();
  function generatedPositionAfter(mappingA, mappingB) {
    var lineA = mappingA.generatedLine;
    var lineB = mappingB.generatedLine;
    var columnA = mappingA.generatedColumn;
    var columnB = mappingB.generatedColumn;
    return lineB > lineA || lineB == lineA && columnB >= columnA || util.compareByGeneratedPositionsInflated(mappingA, mappingB) <= 0;
  }
  function MappingList() {
    this._array = [];
    this._sorted = true;
    this._last = { generatedLine: -1, generatedColumn: 0 };
  }
  MappingList.prototype.unsortedForEach = function MappingList_forEach(aCallback, aThisArg) {
    this._array.forEach(aCallback, aThisArg);
  };
  MappingList.prototype.add = function MappingList_add(aMapping) {
    if (generatedPositionAfter(this._last, aMapping)) {
      this._last = aMapping;
      this._array.push(aMapping);
    } else {
      this._sorted = false;
      this._array.push(aMapping);
    }
  };
  MappingList.prototype.toArray = function MappingList_toArray() {
    if (!this._sorted) {
      this._array.sort(util.compareByGeneratedPositionsInflated);
      this._sorted = true;
    }
    return this._array;
  };
  exports.MappingList = MappingList;
});

// node_modules/source-map-js/lib/source-map-generator.js
var require_source_map_generator = __commonJS(function(exports) {
  var base64VLQ = require_base64_vlq();
  var util = require_util();
  var ArraySet = require_array_set().ArraySet;
  var MappingList = require_mapping_list().MappingList;
  function SourceMapGenerator(aArgs) {
    if (!aArgs) {
      aArgs = {};
    }
    this._file = util.getArg(aArgs, "file", null);
    this._sourceRoot = util.getArg(aArgs, "sourceRoot", null);
    this._skipValidation = util.getArg(aArgs, "skipValidation", false);
    this._ignoreInvalidMapping = util.getArg(aArgs, "ignoreInvalidMapping", false);
    this._sources = new ArraySet;
    this._names = new ArraySet;
    this._mappings = new MappingList;
    this._sourcesContents = null;
  }
  SourceMapGenerator.prototype._version = 3;
  SourceMapGenerator.fromSourceMap = function SourceMapGenerator_fromSourceMap(aSourceMapConsumer, generatorOps) {
    var sourceRoot = aSourceMapConsumer.sourceRoot;
    var generator = new SourceMapGenerator(Object.assign(generatorOps || {}, {
      file: aSourceMapConsumer.file,
      sourceRoot
    }));
    aSourceMapConsumer.eachMapping(function(mapping) {
      var newMapping = {
        generated: {
          line: mapping.generatedLine,
          column: mapping.generatedColumn
        }
      };
      if (mapping.source != null) {
        newMapping.source = mapping.source;
        if (sourceRoot != null) {
          newMapping.source = util.relative(sourceRoot, newMapping.source);
        }
        newMapping.original = {
          line: mapping.originalLine,
          column: mapping.originalColumn
        };
        if (mapping.name != null) {
          newMapping.name = mapping.name;
        }
      }
      generator.addMapping(newMapping);
    });
    aSourceMapConsumer.sources.forEach(function(sourceFile) {
      var sourceRelative = sourceFile;
      if (sourceRoot !== null) {
        sourceRelative = util.relative(sourceRoot, sourceFile);
      }
      if (!generator._sources.has(sourceRelative)) {
        generator._sources.add(sourceRelative);
      }
      var content = aSourceMapConsumer.sourceContentFor(sourceFile);
      if (content != null) {
        generator.setSourceContent(sourceFile, content);
      }
    });
    return generator;
  };
  SourceMapGenerator.prototype.addMapping = function SourceMapGenerator_addMapping(aArgs) {
    var generated = util.getArg(aArgs, "generated");
    var original = util.getArg(aArgs, "original", null);
    var source = util.getArg(aArgs, "source", null);
    var name = util.getArg(aArgs, "name", null);
    if (!this._skipValidation) {
      if (this._validateMapping(generated, original, source, name) === false) {
        return;
      }
    }
    if (source != null) {
      source = String(source);
      if (!this._sources.has(source)) {
        this._sources.add(source);
      }
    }
    if (name != null) {
      name = String(name);
      if (!this._names.has(name)) {
        this._names.add(name);
      }
    }
    this._mappings.add({
      generatedLine: generated.line,
      generatedColumn: generated.column,
      originalLine: original != null && original.line,
      originalColumn: original != null && original.column,
      source,
      name
    });
  };
  SourceMapGenerator.prototype.setSourceContent = function SourceMapGenerator_setSourceContent(aSourceFile, aSourceContent) {
    var source = aSourceFile;
    if (this._sourceRoot != null) {
      source = util.relative(this._sourceRoot, source);
    }
    if (aSourceContent != null) {
      if (!this._sourcesContents) {
        this._sourcesContents = Object.create(null);
      }
      this._sourcesContents[util.toSetString(source)] = aSourceContent;
    } else if (this._sourcesContents) {
      delete this._sourcesContents[util.toSetString(source)];
      if (Object.keys(this._sourcesContents).length === 0) {
        this._sourcesContents = null;
      }
    }
  };
  SourceMapGenerator.prototype.applySourceMap = function SourceMapGenerator_applySourceMap(aSourceMapConsumer, aSourceFile, aSourceMapPath) {
    var sourceFile = aSourceFile;
    if (aSourceFile == null) {
      if (aSourceMapConsumer.file == null) {
        throw new Error("SourceMapGenerator.prototype.applySourceMap requires either an explicit source file, " + `or the source map's "file" property. Both were omitted.`);
      }
      sourceFile = aSourceMapConsumer.file;
    }
    var sourceRoot = this._sourceRoot;
    if (sourceRoot != null) {
      sourceFile = util.relative(sourceRoot, sourceFile);
    }
    var newSources = new ArraySet;
    var newNames = new ArraySet;
    this._mappings.unsortedForEach(function(mapping) {
      if (mapping.source === sourceFile && mapping.originalLine != null) {
        var original = aSourceMapConsumer.originalPositionFor({
          line: mapping.originalLine,
          column: mapping.originalColumn
        });
        if (original.source != null) {
          mapping.source = original.source;
          if (aSourceMapPath != null) {
            mapping.source = util.join(aSourceMapPath, mapping.source);
          }
          if (sourceRoot != null) {
            mapping.source = util.relative(sourceRoot, mapping.source);
          }
          mapping.originalLine = original.line;
          mapping.originalColumn = original.column;
          if (original.name != null) {
            mapping.name = original.name;
          }
        }
      }
      var source = mapping.source;
      if (source != null && !newSources.has(source)) {
        newSources.add(source);
      }
      var name = mapping.name;
      if (name != null && !newNames.has(name)) {
        newNames.add(name);
      }
    }, this);
    this._sources = newSources;
    this._names = newNames;
    aSourceMapConsumer.sources.forEach(function(sourceFile) {
      var content = aSourceMapConsumer.sourceContentFor(sourceFile);
      if (content != null) {
        if (aSourceMapPath != null) {
          sourceFile = util.join(aSourceMapPath, sourceFile);
        }
        if (sourceRoot != null) {
          sourceFile = util.relative(sourceRoot, sourceFile);
        }
        this.setSourceContent(sourceFile, content);
      }
    }, this);
  };
  SourceMapGenerator.prototype._validateMapping = function SourceMapGenerator_validateMapping(aGenerated, aOriginal, aSource, aName) {
    if (aOriginal && typeof aOriginal.line !== "number" && typeof aOriginal.column !== "number") {
      var message = "original.line and original.column are not numbers -- you probably meant to omit " + "the original mapping entirely and only map the generated position. If so, pass " + "null for the original mapping instead of an object with empty or null values.";
      if (this._ignoreInvalidMapping) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn(message);
        }
        return false;
      } else {
        throw new Error(message);
      }
    }
    if (aGenerated && "line" in aGenerated && "column" in aGenerated && aGenerated.line > 0 && aGenerated.column >= 0 && !aOriginal && !aSource && !aName) {
      return;
    } else if (aGenerated && "line" in aGenerated && "column" in aGenerated && aOriginal && "line" in aOriginal && "column" in aOriginal && aGenerated.line > 0 && aGenerated.column >= 0 && aOriginal.line > 0 && aOriginal.column >= 0 && aSource) {
      return;
    } else {
      var message = "Invalid mapping: " + JSON.stringify({
        generated: aGenerated,
        source: aSource,
        original: aOriginal,
        name: aName
      });
      if (this._ignoreInvalidMapping) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn(message);
        }
        return false;
      } else {
        throw new Error(message);
      }
    }
  };
  SourceMapGenerator.prototype._serializeMappings = function SourceMapGenerator_serializeMappings() {
    var previousGeneratedColumn = 0;
    var previousGeneratedLine = 1;
    var previousOriginalColumn = 0;
    var previousOriginalLine = 0;
    var previousName = 0;
    var previousSource = 0;
    var result = "";
    var next;
    var mapping;
    var nameIdx;
    var sourceIdx;
    var mappings = this._mappings.toArray();
    for (var i = 0, len = mappings.length;i < len; i++) {
      mapping = mappings[i];
      next = "";
      if (mapping.generatedLine !== previousGeneratedLine) {
        previousGeneratedColumn = 0;
        var lineDelta = mapping.generatedLine - previousGeneratedLine;
        next += lineDelta === 1 ? ";" : ";".repeat(lineDelta);
        previousGeneratedLine = mapping.generatedLine;
      } else {
        if (i > 0) {
          if (!util.compareByGeneratedPositionsInflated(mapping, mappings[i - 1])) {
            continue;
          }
          next += ",";
        }
      }
      next += base64VLQ.encode(mapping.generatedColumn - previousGeneratedColumn);
      previousGeneratedColumn = mapping.generatedColumn;
      if (mapping.source != null) {
        sourceIdx = this._sources.indexOf(mapping.source);
        next += base64VLQ.encode(sourceIdx - previousSource);
        previousSource = sourceIdx;
        next += base64VLQ.encode(mapping.originalLine - 1 - previousOriginalLine);
        previousOriginalLine = mapping.originalLine - 1;
        next += base64VLQ.encode(mapping.originalColumn - previousOriginalColumn);
        previousOriginalColumn = mapping.originalColumn;
        if (mapping.name != null) {
          nameIdx = this._names.indexOf(mapping.name);
          next += base64VLQ.encode(nameIdx - previousName);
          previousName = nameIdx;
        }
      }
      result += next;
    }
    return result;
  };
  SourceMapGenerator.prototype._generateSourcesContent = function SourceMapGenerator_generateSourcesContent(aSources, aSourceRoot) {
    return aSources.map(function(source) {
      if (!this._sourcesContents) {
        return null;
      }
      if (aSourceRoot != null) {
        source = util.relative(aSourceRoot, source);
      }
      var key = util.toSetString(source);
      return Object.prototype.hasOwnProperty.call(this._sourcesContents, key) ? this._sourcesContents[key] : null;
    }, this);
  };
  SourceMapGenerator.prototype.toJSON = function SourceMapGenerator_toJSON() {
    var map = {
      version: this._version,
      sources: this._sources.toArray(),
      names: this._names.toArray(),
      mappings: this._serializeMappings()
    };
    if (this._file != null) {
      map.file = this._file;
    }
    if (this._sourceRoot != null) {
      map.sourceRoot = this._sourceRoot;
    }
    if (this._sourcesContents) {
      map.sourcesContent = this._generateSourcesContent(map.sources, map.sourceRoot);
    }
    return map;
  };
  SourceMapGenerator.prototype.toString = function SourceMapGenerator_toString() {
    return JSON.stringify(this.toJSON());
  };
  exports.SourceMapGenerator = SourceMapGenerator;
});

// node_modules/source-map-js/lib/binary-search.js
var require_binary_search = __commonJS(function(exports) {
  exports.GREATEST_LOWER_BOUND = 1;
  exports.LEAST_UPPER_BOUND = 2;
  function recursiveSearch(aLow, aHigh, aNeedle, aHaystack, aCompare, aBias) {
    var mid = Math.floor((aHigh - aLow) / 2) + aLow;
    var cmp = aCompare(aNeedle, aHaystack[mid], true);
    if (cmp === 0) {
      return mid;
    } else if (cmp > 0) {
      if (aHigh - mid > 1) {
        return recursiveSearch(mid, aHigh, aNeedle, aHaystack, aCompare, aBias);
      }
      if (aBias == exports.LEAST_UPPER_BOUND) {
        return aHigh < aHaystack.length ? aHigh : -1;
      } else {
        return mid;
      }
    } else {
      if (mid - aLow > 1) {
        return recursiveSearch(aLow, mid, aNeedle, aHaystack, aCompare, aBias);
      }
      if (aBias == exports.LEAST_UPPER_BOUND) {
        return mid;
      } else {
        return aLow < 0 ? -1 : aLow;
      }
    }
  }
  exports.search = function search(aNeedle, aHaystack, aCompare, aBias) {
    if (aHaystack.length === 0) {
      return -1;
    }
    var index = recursiveSearch(-1, aHaystack.length, aNeedle, aHaystack, aCompare, aBias || exports.GREATEST_LOWER_BOUND);
    if (index < 0) {
      return -1;
    }
    while (index - 1 >= 0) {
      if (aCompare(aHaystack[index], aHaystack[index - 1], true) !== 0) {
        break;
      }
      --index;
    }
    return index;
  };
});

// node_modules/source-map-js/lib/quick-sort.js
var require_quick_sort = __commonJS(function(exports) {
  function SortTemplate(comparator) {
    function swap(ary, x, y) {
      var temp = ary[x];
      ary[x] = ary[y];
      ary[y] = temp;
    }
    function randomIntInRange(low, high) {
      return Math.round(low + Math.random() * (high - low));
    }
    function doQuickSort(ary, comparator, p, r) {
      if (p < r) {
        var pivotIndex = randomIntInRange(p, r);
        var i = p - 1;
        swap(ary, pivotIndex, r);
        var pivot = ary[r];
        for (var j = p;j < r; j++) {
          if (comparator(ary[j], pivot, false) <= 0) {
            i += 1;
            swap(ary, i, j);
          }
        }
        swap(ary, i + 1, j);
        var q = i + 1;
        doQuickSort(ary, comparator, p, q - 1);
        doQuickSort(ary, comparator, q + 1, r);
      }
    }
    return doQuickSort;
  }
  function cloneSort(comparator) {
    let template = SortTemplate.toString();
    let templateFn = new Function(`return ${template}`)();
    return templateFn(comparator);
  }
  var isEvalAllowed = function() {
    try {
      new Function("return 0")();
      return true;
    } catch {
      return false;
    }
  }();
  var sortCache = new WeakMap;
  exports.quickSort = function(ary, comparator, start = 0) {
    let doQuickSort = isEvalAllowed ? sortCache.get(comparator) : SortTemplate(comparator);
    if (doQuickSort === undefined) {
      doQuickSort = cloneSort(comparator);
      sortCache.set(comparator, doQuickSort);
    }
    doQuickSort(ary, comparator, start, ary.length - 1);
  };
});

// node_modules/source-map-js/lib/source-map-consumer.js
var require_source_map_consumer = __commonJS(function(exports) {
  var util = require_util();
  var binarySearch = require_binary_search();
  var ArraySet = require_array_set().ArraySet;
  var base64VLQ = require_base64_vlq();
  var quickSort = require_quick_sort().quickSort;
  var MAX_SECTION_OFFSET_LINE = 1e7;
  function SourceMapConsumer(aSourceMap, aSourceMapURL) {
    var sourceMap = aSourceMap;
    if (typeof aSourceMap === "string") {
      sourceMap = util.parseSourceMapInput(aSourceMap);
    }
    return sourceMap.sections != null ? new IndexedSourceMapConsumer(sourceMap, aSourceMapURL) : new BasicSourceMapConsumer(sourceMap, aSourceMapURL);
  }
  SourceMapConsumer.fromSourceMap = function(aSourceMap, aSourceMapURL) {
    return BasicSourceMapConsumer.fromSourceMap(aSourceMap, aSourceMapURL);
  };
  SourceMapConsumer.prototype._version = 3;
  SourceMapConsumer.prototype.__generatedMappings = null;
  Object.defineProperty(SourceMapConsumer.prototype, "_generatedMappings", {
    configurable: true,
    enumerable: true,
    get: function() {
      if (!this.__generatedMappings) {
        this._parseMappings(this._mappings, this.sourceRoot);
      }
      return this.__generatedMappings;
    }
  });
  SourceMapConsumer.prototype.__originalMappings = null;
  Object.defineProperty(SourceMapConsumer.prototype, "_originalMappings", {
    configurable: true,
    enumerable: true,
    get: function() {
      if (!this.__originalMappings) {
        this._parseMappings(this._mappings, this.sourceRoot);
      }
      return this.__originalMappings;
    }
  });
  SourceMapConsumer.prototype._charIsMappingSeparator = function SourceMapConsumer_charIsMappingSeparator(aStr, index) {
    var c = aStr.charAt(index);
    return c === ";" || c === ",";
  };
  SourceMapConsumer.prototype._parseMappings = function SourceMapConsumer_parseMappings(aStr, aSourceRoot) {
    throw new Error("Subclasses must implement _parseMappings");
  };
  SourceMapConsumer.GENERATED_ORDER = 1;
  SourceMapConsumer.ORIGINAL_ORDER = 2;
  SourceMapConsumer.GREATEST_LOWER_BOUND = 1;
  SourceMapConsumer.LEAST_UPPER_BOUND = 2;
  SourceMapConsumer.prototype.eachMapping = function SourceMapConsumer_eachMapping(aCallback, aContext, aOrder) {
    var context = aContext || null;
    var order = aOrder || SourceMapConsumer.GENERATED_ORDER;
    var mappings;
    switch (order) {
      case SourceMapConsumer.GENERATED_ORDER:
        mappings = this._generatedMappings;
        break;
      case SourceMapConsumer.ORIGINAL_ORDER:
        mappings = this._originalMappings;
        break;
      default:
        throw new Error("Unknown order of iteration.");
    }
    var sourceRoot = this.sourceRoot;
    var boundCallback = aCallback.bind(context);
    var names = this._names;
    var sources = this._sources;
    var sourceMapURL = this._sourceMapURL;
    for (var i = 0, n = mappings.length;i < n; i++) {
      var mapping = mappings[i];
      var source = mapping.source === null ? null : sources.at(mapping.source);
      if (source !== null) {
        source = util.computeSourceURL(sourceRoot, source, sourceMapURL);
      }
      boundCallback({
        source,
        generatedLine: mapping.generatedLine,
        generatedColumn: mapping.generatedColumn,
        originalLine: mapping.originalLine,
        originalColumn: mapping.originalColumn,
        name: mapping.name === null ? null : names.at(mapping.name)
      });
    }
  };
  SourceMapConsumer.prototype.allGeneratedPositionsFor = function SourceMapConsumer_allGeneratedPositionsFor(aArgs) {
    var line = util.getArg(aArgs, "line");
    var needle = {
      source: util.getArg(aArgs, "source"),
      originalLine: line,
      originalColumn: util.getArg(aArgs, "column", 0)
    };
    needle.source = this._findSourceIndex(needle.source);
    if (needle.source < 0) {
      return [];
    }
    var mappings = [];
    var index = this._findMapping(needle, this._originalMappings, "originalLine", "originalColumn", util.compareByOriginalPositions, binarySearch.LEAST_UPPER_BOUND);
    if (index >= 0) {
      var mapping = this._originalMappings[index];
      if (aArgs.column === undefined) {
        var originalLine = mapping.originalLine;
        while (mapping && mapping.originalLine === originalLine) {
          mappings.push({
            line: util.getArg(mapping, "generatedLine", null),
            column: util.getArg(mapping, "generatedColumn", null),
            lastColumn: util.getArg(mapping, "lastGeneratedColumn", null)
          });
          mapping = this._originalMappings[++index];
        }
      } else {
        var originalColumn = mapping.originalColumn;
        while (mapping && mapping.originalLine === line && mapping.originalColumn == originalColumn) {
          mappings.push({
            line: util.getArg(mapping, "generatedLine", null),
            column: util.getArg(mapping, "generatedColumn", null),
            lastColumn: util.getArg(mapping, "lastGeneratedColumn", null)
          });
          mapping = this._originalMappings[++index];
        }
      }
    }
    return mappings;
  };
  exports.SourceMapConsumer = SourceMapConsumer;
  function BasicSourceMapConsumer(aSourceMap, aSourceMapURL) {
    var sourceMap = aSourceMap;
    if (typeof aSourceMap === "string") {
      sourceMap = util.parseSourceMapInput(aSourceMap);
    }
    var version = util.getArg(sourceMap, "version");
    var sources = util.getArg(sourceMap, "sources");
    var names = util.getArg(sourceMap, "names", []);
    var sourceRoot = util.getArg(sourceMap, "sourceRoot", null);
    var sourcesContent = util.getArg(sourceMap, "sourcesContent", null);
    var mappings = util.getArg(sourceMap, "mappings");
    var file = util.getArg(sourceMap, "file", null);
    if (version != this._version) {
      throw new Error("Unsupported version: " + version);
    }
    if (sourceRoot) {
      sourceRoot = util.normalize(sourceRoot);
    }
    sources = sources.map(String).map(util.normalize).map(function(source) {
      return sourceRoot && util.isAbsolute(sourceRoot) && util.isAbsolute(source) ? util.relative(sourceRoot, source) : source;
    });
    this._names = ArraySet.fromArray(names.map(String), true);
    this._sources = ArraySet.fromArray(sources, true);
    this._absoluteSources = this._sources.toArray().map(function(s) {
      return util.computeSourceURL(sourceRoot, s, aSourceMapURL);
    });
    this.sourceRoot = sourceRoot;
    this.sourcesContent = sourcesContent;
    this._mappings = mappings;
    this._sourceMapURL = aSourceMapURL;
    this.file = file;
  }
  BasicSourceMapConsumer.prototype = Object.create(SourceMapConsumer.prototype);
  BasicSourceMapConsumer.prototype.consumer = SourceMapConsumer;
  BasicSourceMapConsumer.prototype._findSourceIndex = function(aSource) {
    var relativeSource = aSource;
    if (this.sourceRoot != null) {
      relativeSource = util.relative(this.sourceRoot, relativeSource);
    }
    if (this._sources.has(relativeSource)) {
      return this._sources.indexOf(relativeSource);
    }
    var i;
    for (i = 0;i < this._absoluteSources.length; ++i) {
      if (this._absoluteSources[i] == aSource) {
        return i;
      }
    }
    return -1;
  };
  BasicSourceMapConsumer.fromSourceMap = function SourceMapConsumer_fromSourceMap(aSourceMap, aSourceMapURL) {
    var smc = Object.create(BasicSourceMapConsumer.prototype);
    var names = smc._names = ArraySet.fromArray(aSourceMap._names.toArray(), true);
    var sources = smc._sources = ArraySet.fromArray(aSourceMap._sources.toArray(), true);
    smc.sourceRoot = aSourceMap._sourceRoot;
    smc.sourcesContent = aSourceMap._generateSourcesContent(smc._sources.toArray(), smc.sourceRoot);
    smc.file = aSourceMap._file;
    smc._sourceMapURL = aSourceMapURL;
    smc._absoluteSources = smc._sources.toArray().map(function(s) {
      return util.computeSourceURL(smc.sourceRoot, s, aSourceMapURL);
    });
    var generatedMappings = aSourceMap._mappings.toArray().slice();
    var destGeneratedMappings = smc.__generatedMappings = [];
    var destOriginalMappings = smc.__originalMappings = [];
    for (var i = 0, length = generatedMappings.length;i < length; i++) {
      var srcMapping = generatedMappings[i];
      var destMapping = new Mapping;
      destMapping.generatedLine = srcMapping.generatedLine;
      destMapping.generatedColumn = srcMapping.generatedColumn;
      if (srcMapping.source) {
        destMapping.source = sources.indexOf(srcMapping.source);
        destMapping.originalLine = srcMapping.originalLine;
        destMapping.originalColumn = srcMapping.originalColumn;
        if (srcMapping.name) {
          destMapping.name = names.indexOf(srcMapping.name);
        }
        destOriginalMappings.push(destMapping);
      }
      destGeneratedMappings.push(destMapping);
    }
    quickSort(smc.__originalMappings, util.compareByOriginalPositions);
    return smc;
  };
  BasicSourceMapConsumer.prototype._version = 3;
  Object.defineProperty(BasicSourceMapConsumer.prototype, "sources", {
    get: function() {
      return this._absoluteSources.slice();
    }
  });
  function Mapping() {
    this.generatedLine = 0;
    this.generatedColumn = 0;
    this.source = null;
    this.originalLine = null;
    this.originalColumn = null;
    this.name = null;
  }
  var compareGenerated = util.compareByGeneratedPositionsDeflatedNoLine;
  function sortGenerated(array, start) {
    let l = array.length;
    let n = array.length - start;
    if (n <= 1) {
      return;
    } else if (n == 2) {
      let a = array[start];
      let b = array[start + 1];
      if (compareGenerated(a, b) > 0) {
        array[start] = b;
        array[start + 1] = a;
      }
    } else if (n < 20) {
      for (let i = start;i < l; i++) {
        for (let j = i;j > start; j--) {
          let a = array[j - 1];
          let b = array[j];
          if (compareGenerated(a, b) <= 0) {
            break;
          }
          array[j - 1] = b;
          array[j] = a;
        }
      }
    } else {
      quickSort(array, compareGenerated, start);
    }
  }
  BasicSourceMapConsumer.prototype._parseMappings = function SourceMapConsumer_parseMappings(aStr, aSourceRoot) {
    var generatedLine = 1;
    var previousGeneratedColumn = 0;
    var previousOriginalLine = 0;
    var previousOriginalColumn = 0;
    var previousSource = 0;
    var previousName = 0;
    var length = aStr.length;
    var index = 0;
    var cachedSegments = {};
    var temp = {};
    var originalMappings = [];
    var generatedMappings = [];
    var mapping, str, segment, end, value;
    let subarrayStart = 0;
    while (index < length) {
      if (aStr.charAt(index) === ";") {
        generatedLine++;
        index++;
        previousGeneratedColumn = 0;
        sortGenerated(generatedMappings, subarrayStart);
        subarrayStart = generatedMappings.length;
      } else if (aStr.charAt(index) === ",") {
        index++;
      } else {
        mapping = new Mapping;
        mapping.generatedLine = generatedLine;
        for (end = index;end < length; end++) {
          if (this._charIsMappingSeparator(aStr, end)) {
            break;
          }
        }
        str = aStr.slice(index, end);
        segment = [];
        while (index < end) {
          base64VLQ.decode(aStr, index, temp);
          value = temp.value;
          index = temp.rest;
          segment.push(value);
        }
        if (segment.length === 2) {
          throw new Error("Found a source, but no line and column");
        }
        if (segment.length === 3) {
          throw new Error("Found a source and line, but no column");
        }
        mapping.generatedColumn = previousGeneratedColumn + segment[0];
        previousGeneratedColumn = mapping.generatedColumn;
        if (segment.length > 1) {
          mapping.source = previousSource + segment[1];
          previousSource += segment[1];
          mapping.originalLine = previousOriginalLine + segment[2];
          previousOriginalLine = mapping.originalLine;
          mapping.originalLine += 1;
          mapping.originalColumn = previousOriginalColumn + segment[3];
          previousOriginalColumn = mapping.originalColumn;
          if (segment.length > 4) {
            mapping.name = previousName + segment[4];
            previousName += segment[4];
          }
        }
        generatedMappings.push(mapping);
        if (typeof mapping.originalLine === "number") {
          let currentSource = mapping.source;
          while (originalMappings.length <= currentSource) {
            originalMappings.push(null);
          }
          if (originalMappings[currentSource] === null) {
            originalMappings[currentSource] = [];
          }
          originalMappings[currentSource].push(mapping);
        }
      }
    }
    sortGenerated(generatedMappings, subarrayStart);
    this.__generatedMappings = generatedMappings;
    for (var i = 0;i < originalMappings.length; i++) {
      if (originalMappings[i] != null) {
        quickSort(originalMappings[i], util.compareByOriginalPositionsNoSource);
      }
    }
    this.__originalMappings = [].concat(...originalMappings);
  };
  BasicSourceMapConsumer.prototype._findMapping = function SourceMapConsumer_findMapping(aNeedle, aMappings, aLineName, aColumnName, aComparator, aBias) {
    if (aNeedle[aLineName] <= 0) {
      throw new TypeError("Line must be greater than or equal to 1, got " + aNeedle[aLineName]);
    }
    if (aNeedle[aColumnName] < 0) {
      throw new TypeError("Column must be greater than or equal to 0, got " + aNeedle[aColumnName]);
    }
    return binarySearch.search(aNeedle, aMappings, aComparator, aBias);
  };
  BasicSourceMapConsumer.prototype.computeColumnSpans = function SourceMapConsumer_computeColumnSpans() {
    for (var index = 0;index < this._generatedMappings.length; ++index) {
      var mapping = this._generatedMappings[index];
      if (index + 1 < this._generatedMappings.length) {
        var nextMapping = this._generatedMappings[index + 1];
        if (mapping.generatedLine === nextMapping.generatedLine) {
          mapping.lastGeneratedColumn = nextMapping.generatedColumn - 1;
          continue;
        }
      }
      mapping.lastGeneratedColumn = Infinity;
    }
  };
  BasicSourceMapConsumer.prototype.originalPositionFor = function SourceMapConsumer_originalPositionFor(aArgs) {
    var needle = {
      generatedLine: util.getArg(aArgs, "line"),
      generatedColumn: util.getArg(aArgs, "column")
    };
    var index = this._findMapping(needle, this._generatedMappings, "generatedLine", "generatedColumn", util.compareByGeneratedPositionsDeflated, util.getArg(aArgs, "bias", SourceMapConsumer.GREATEST_LOWER_BOUND));
    if (index >= 0) {
      var mapping = this._generatedMappings[index];
      if (mapping.generatedLine === needle.generatedLine) {
        var source = util.getArg(mapping, "source", null);
        if (source !== null) {
          source = this._sources.at(source);
          source = util.computeSourceURL(this.sourceRoot, source, this._sourceMapURL);
        }
        var name = util.getArg(mapping, "name", null);
        if (name !== null) {
          name = this._names.at(name);
        }
        return {
          source,
          line: util.getArg(mapping, "originalLine", null),
          column: util.getArg(mapping, "originalColumn", null),
          name
        };
      }
    }
    return {
      source: null,
      line: null,
      column: null,
      name: null
    };
  };
  BasicSourceMapConsumer.prototype.hasContentsOfAllSources = function BasicSourceMapConsumer_hasContentsOfAllSources() {
    if (!this.sourcesContent) {
      return false;
    }
    return this.sourcesContent.length >= this._sources.size() && !this.sourcesContent.some(function(sc) {
      return sc == null;
    });
  };
  BasicSourceMapConsumer.prototype.sourceContentFor = function SourceMapConsumer_sourceContentFor(aSource, nullOnMissing) {
    if (!this.sourcesContent) {
      return null;
    }
    var index = this._findSourceIndex(aSource);
    if (index >= 0) {
      return this.sourcesContent[index];
    }
    var relativeSource = aSource;
    if (this.sourceRoot != null) {
      relativeSource = util.relative(this.sourceRoot, relativeSource);
    }
    var url;
    if (this.sourceRoot != null && (url = util.urlParse(this.sourceRoot))) {
      var fileUriAbsPath = relativeSource.replace(/^file:\/\//, "");
      if (url.scheme == "file" && this._sources.has(fileUriAbsPath)) {
        return this.sourcesContent[this._sources.indexOf(fileUriAbsPath)];
      }
      if ((!url.path || url.path == "/") && this._sources.has("/" + relativeSource)) {
        return this.sourcesContent[this._sources.indexOf("/" + relativeSource)];
      }
    }
    if (nullOnMissing) {
      return null;
    } else {
      throw new Error('"' + relativeSource + '" is not in the SourceMap.');
    }
  };
  BasicSourceMapConsumer.prototype.generatedPositionFor = function SourceMapConsumer_generatedPositionFor(aArgs) {
    var source = util.getArg(aArgs, "source");
    source = this._findSourceIndex(source);
    if (source < 0) {
      return {
        line: null,
        column: null,
        lastColumn: null
      };
    }
    var needle = {
      source,
      originalLine: util.getArg(aArgs, "line"),
      originalColumn: util.getArg(aArgs, "column")
    };
    var index = this._findMapping(needle, this._originalMappings, "originalLine", "originalColumn", util.compareByOriginalPositions, util.getArg(aArgs, "bias", SourceMapConsumer.GREATEST_LOWER_BOUND));
    if (index >= 0) {
      var mapping = this._originalMappings[index];
      if (mapping.source === needle.source) {
        return {
          line: util.getArg(mapping, "generatedLine", null),
          column: util.getArg(mapping, "generatedColumn", null),
          lastColumn: util.getArg(mapping, "lastGeneratedColumn", null)
        };
      }
    }
    return {
      line: null,
      column: null,
      lastColumn: null
    };
  };
  exports.BasicSourceMapConsumer = BasicSourceMapConsumer;
  function IndexedSourceMapConsumer(aSourceMap, aSourceMapURL) {
    var sourceMap = aSourceMap;
    if (typeof aSourceMap === "string") {
      sourceMap = util.parseSourceMapInput(aSourceMap);
    }
    var version = util.getArg(sourceMap, "version");
    var sections = util.getArg(sourceMap, "sections");
    if (version != this._version) {
      throw new Error("Unsupported version: " + version);
    }
    this._sources = new ArraySet;
    this._names = new ArraySet;
    var lastOffset = {
      line: -1,
      column: 0
    };
    var maxOffsetLine = 0;
    this._sections = sections.map(function(s) {
      if (s.url) {
        throw new Error("Support for url field in sections not implemented.");
      }
      var offset = util.getArg(s, "offset");
      var offsetLine = util.getArg(offset, "line");
      var offsetColumn = util.getArg(offset, "column");
      if (!isValidOffset(offsetLine) || !isValidOffset(offsetColumn)) {
        throw new Error("Section offset line and column must be non-negative integers.");
      }
      if (offsetLine > MAX_SECTION_OFFSET_LINE) {
        throw new Error("Section offset line must not exceed " + MAX_SECTION_OFFSET_LINE + ".");
      }
      if (offsetLine < lastOffset.line || offsetLine === lastOffset.line && offsetColumn < lastOffset.column) {
        throw new Error("Section offsets must be ordered and non-overlapping.");
      }
      lastOffset = offset;
      var consumer = new SourceMapConsumer(util.getArg(s, "map"), aSourceMapURL);
      var totalOffsetLine = offsetLine + (consumer._maxOffsetLine || 0);
      if (totalOffsetLine > MAX_SECTION_OFFSET_LINE) {
        throw new Error("Section offset line must not exceed " + MAX_SECTION_OFFSET_LINE + ", including offsets of nested sections.");
      }
      if (totalOffsetLine > maxOffsetLine) {
        maxOffsetLine = totalOffsetLine;
      }
      return {
        generatedOffset: {
          generatedLine: offsetLine + 1,
          generatedColumn: offsetColumn + 1
        },
        consumer
      };
    });
    this._maxOffsetLine = maxOffsetLine;
  }
  function isValidOffset(aValue) {
    return typeof aValue === "number" && aValue >= 0 && aValue <= 9007199254740991 && Math.floor(aValue) === aValue;
  }
  IndexedSourceMapConsumer.prototype = Object.create(SourceMapConsumer.prototype);
  IndexedSourceMapConsumer.prototype.constructor = SourceMapConsumer;
  IndexedSourceMapConsumer.prototype._version = 3;
  Object.defineProperty(IndexedSourceMapConsumer.prototype, "sources", {
    get: function() {
      var sources = [];
      for (var i = 0;i < this._sections.length; i++) {
        var sectionSources = this._sections[i].consumer.sources;
        for (var j = 0;j < sectionSources.length; j++) {
          sources.push(sectionSources[j]);
        }
      }
      return sources;
    }
  });
  IndexedSourceMapConsumer.prototype.originalPositionFor = function IndexedSourceMapConsumer_originalPositionFor(aArgs) {
    var needle = {
      generatedLine: util.getArg(aArgs, "line"),
      generatedColumn: util.getArg(aArgs, "column")
    };
    var sectionIndex = binarySearch.search(needle, this._sections, function(needle, section) {
      var cmp = needle.generatedLine - section.generatedOffset.generatedLine;
      if (cmp) {
        return cmp;
      }
      return needle.generatedColumn - section.generatedOffset.generatedColumn;
    });
    var section = this._sections[sectionIndex];
    if (!section) {
      return {
        source: null,
        line: null,
        column: null,
        name: null
      };
    }
    return section.consumer.originalPositionFor({
      line: needle.generatedLine - (section.generatedOffset.generatedLine - 1),
      column: needle.generatedColumn - (section.generatedOffset.generatedLine === needle.generatedLine ? section.generatedOffset.generatedColumn - 1 : 0),
      bias: aArgs.bias
    });
  };
  IndexedSourceMapConsumer.prototype.hasContentsOfAllSources = function IndexedSourceMapConsumer_hasContentsOfAllSources() {
    return this._sections.every(function(s) {
      return s.consumer.hasContentsOfAllSources();
    });
  };
  IndexedSourceMapConsumer.prototype.sourceContentFor = function IndexedSourceMapConsumer_sourceContentFor(aSource, nullOnMissing) {
    for (var i = 0;i < this._sections.length; i++) {
      var section = this._sections[i];
      var content = section.consumer.sourceContentFor(aSource, true);
      if (content || content === "") {
        return content;
      }
    }
    if (nullOnMissing) {
      return null;
    } else {
      throw new Error('"' + aSource + '" is not in the SourceMap.');
    }
  };
  IndexedSourceMapConsumer.prototype.generatedPositionFor = function IndexedSourceMapConsumer_generatedPositionFor(aArgs) {
    for (var i = 0;i < this._sections.length; i++) {
      var section = this._sections[i];
      if (section.consumer._findSourceIndex(util.getArg(aArgs, "source")) === -1) {
        continue;
      }
      var generatedPosition = section.consumer.generatedPositionFor(aArgs);
      if (generatedPosition) {
        var ret = {
          line: generatedPosition.line + (section.generatedOffset.generatedLine - 1),
          column: generatedPosition.column + (section.generatedOffset.generatedLine === generatedPosition.line ? section.generatedOffset.generatedColumn - 1 : 0)
        };
        return ret;
      }
    }
    return {
      line: null,
      column: null
    };
  };
  IndexedSourceMapConsumer.prototype._parseMappings = function IndexedSourceMapConsumer_parseMappings(aStr, aSourceRoot) {
    this.__generatedMappings = [];
    this.__originalMappings = [];
    for (var i = 0;i < this._sections.length; i++) {
      var section = this._sections[i];
      var sectionMappings = section.consumer._generatedMappings;
      for (var j = 0;j < sectionMappings.length; j++) {
        var mapping = sectionMappings[j];
        var source = section.consumer._sources.at(mapping.source);
        if (source !== null) {
          source = util.computeSourceURL(section.consumer.sourceRoot, source, this._sourceMapURL);
        }
        this._sources.add(source);
        source = this._sources.indexOf(source);
        var name = null;
        if (mapping.name) {
          name = section.consumer._names.at(mapping.name);
          this._names.add(name);
          name = this._names.indexOf(name);
        }
        var adjustedMapping = {
          source,
          generatedLine: mapping.generatedLine + (section.generatedOffset.generatedLine - 1),
          generatedColumn: mapping.generatedColumn + (section.generatedOffset.generatedLine === mapping.generatedLine ? section.generatedOffset.generatedColumn - 1 : 0),
          originalLine: mapping.originalLine,
          originalColumn: mapping.originalColumn,
          name
        };
        this.__generatedMappings.push(adjustedMapping);
        if (typeof adjustedMapping.originalLine === "number") {
          this.__originalMappings.push(adjustedMapping);
        }
      }
    }
    quickSort(this.__generatedMappings, util.compareByGeneratedPositionsDeflated);
    quickSort(this.__originalMappings, util.compareByOriginalPositions);
  };
  exports.IndexedSourceMapConsumer = IndexedSourceMapConsumer;
});

// node_modules/source-map-js/lib/source-node.js
var require_source_node = __commonJS(function(exports) {
  var SourceMapGenerator = require_source_map_generator().SourceMapGenerator;
  var util = require_util();
  var REGEX_NEWLINE = /(\r?\n)/;
  var NEWLINE_CODE = 10;
  var isSourceNode = "$$$isSourceNode$$$";
  function SourceNode(aLine, aColumn, aSource, aChunks, aName) {
    this.children = [];
    this.sourceContents = {};
    this.line = aLine == null ? null : aLine;
    this.column = aColumn == null ? null : aColumn;
    this.source = aSource == null ? null : aSource;
    this.name = aName == null ? null : aName;
    this[isSourceNode] = true;
    if (aChunks != null)
      this.add(aChunks);
  }
  SourceNode.fromStringWithSourceMap = function SourceNode_fromStringWithSourceMap(aGeneratedCode, aSourceMapConsumer, aRelativePath) {
    var node = new SourceNode;
    var remainingLines = aGeneratedCode.split(REGEX_NEWLINE);
    var remainingLinesIndex = 0;
    var shiftNextLine = function() {
      var lineContents = getNextLine();
      var newLine = getNextLine() || "";
      return lineContents + newLine;
      function getNextLine() {
        return remainingLinesIndex < remainingLines.length ? remainingLines[remainingLinesIndex++] : undefined;
      }
    };
    var lastGeneratedLine = 1, lastGeneratedColumn = 0;
    var lastMapping = null;
    aSourceMapConsumer.eachMapping(function(mapping) {
      if (lastMapping !== null) {
        if (lastGeneratedLine < mapping.generatedLine) {
          addMappingWithCode(lastMapping, shiftNextLine());
          lastGeneratedLine++;
          lastGeneratedColumn = 0;
        } else {
          var nextLine = remainingLines[remainingLinesIndex] || "";
          var code = nextLine.substr(0, mapping.generatedColumn - lastGeneratedColumn);
          remainingLines[remainingLinesIndex] = nextLine.substr(mapping.generatedColumn - lastGeneratedColumn);
          lastGeneratedColumn = mapping.generatedColumn;
          addMappingWithCode(lastMapping, code);
          lastMapping = mapping;
          return;
        }
      }
      while (lastGeneratedLine < mapping.generatedLine) {
        if (remainingLinesIndex >= remainingLines.length) {
          lastGeneratedLine = mapping.generatedLine;
          break;
        }
        node.add(shiftNextLine());
        lastGeneratedLine++;
      }
      if (lastGeneratedColumn < mapping.generatedColumn) {
        var nextLine = remainingLines[remainingLinesIndex] || "";
        node.add(nextLine.substr(0, mapping.generatedColumn));
        remainingLines[remainingLinesIndex] = nextLine.substr(mapping.generatedColumn);
        lastGeneratedColumn = mapping.generatedColumn;
      }
      lastMapping = mapping;
    }, this);
    if (remainingLinesIndex < remainingLines.length) {
      if (lastMapping) {
        addMappingWithCode(lastMapping, shiftNextLine());
      }
      node.add(remainingLines.splice(remainingLinesIndex).join(""));
    }
    aSourceMapConsumer.sources.forEach(function(sourceFile) {
      var content = aSourceMapConsumer.sourceContentFor(sourceFile);
      if (content != null) {
        if (aRelativePath != null) {
          sourceFile = util.join(aRelativePath, sourceFile);
        }
        node.setSourceContent(sourceFile, content);
      }
    });
    return node;
    function addMappingWithCode(mapping, code) {
      if (mapping === null || mapping.source === undefined) {
        node.add(code);
      } else {
        var source = aRelativePath ? util.join(aRelativePath, mapping.source) : mapping.source;
        node.add(new SourceNode(mapping.originalLine, mapping.originalColumn, source, code, mapping.name));
      }
    }
  };
  SourceNode.prototype.add = function SourceNode_add(aChunk) {
    if (Array.isArray(aChunk)) {
      aChunk.forEach(function(chunk) {
        this.add(chunk);
      }, this);
    } else if (aChunk[isSourceNode] || typeof aChunk === "string") {
      if (aChunk) {
        this.children.push(aChunk);
      }
    } else {
      throw new TypeError("Expected a SourceNode, string, or an array of SourceNodes and strings. Got " + aChunk);
    }
    return this;
  };
  SourceNode.prototype.prepend = function SourceNode_prepend(aChunk) {
    if (Array.isArray(aChunk)) {
      for (var i = aChunk.length - 1;i >= 0; i--) {
        this.prepend(aChunk[i]);
      }
    } else if (aChunk[isSourceNode] || typeof aChunk === "string") {
      this.children.unshift(aChunk);
    } else {
      throw new TypeError("Expected a SourceNode, string, or an array of SourceNodes and strings. Got " + aChunk);
    }
    return this;
  };
  SourceNode.prototype.walk = function SourceNode_walk(aFn) {
    var chunk;
    for (var i = 0, len = this.children.length;i < len; i++) {
      chunk = this.children[i];
      if (chunk[isSourceNode]) {
        chunk.walk(aFn);
      } else {
        if (chunk !== "") {
          aFn(chunk, {
            source: this.source,
            line: this.line,
            column: this.column,
            name: this.name
          });
        }
      }
    }
  };
  SourceNode.prototype.join = function SourceNode_join(aSep) {
    var newChildren;
    var i;
    var len = this.children.length;
    if (len > 0) {
      newChildren = [];
      for (i = 0;i < len - 1; i++) {
        newChildren.push(this.children[i]);
        newChildren.push(aSep);
      }
      newChildren.push(this.children[i]);
      this.children = newChildren;
    }
    return this;
  };
  SourceNode.prototype.replaceRight = function SourceNode_replaceRight(aPattern, aReplacement) {
    var lastChild = this.children[this.children.length - 1];
    if (lastChild[isSourceNode]) {
      lastChild.replaceRight(aPattern, aReplacement);
    } else if (typeof lastChild === "string") {
      this.children[this.children.length - 1] = lastChild.replace(aPattern, aReplacement);
    } else {
      this.children.push("".replace(aPattern, aReplacement));
    }
    return this;
  };
  SourceNode.prototype.setSourceContent = function SourceNode_setSourceContent(aSourceFile, aSourceContent) {
    this.sourceContents[util.toSetString(aSourceFile)] = aSourceContent;
  };
  SourceNode.prototype.walkSourceContents = function SourceNode_walkSourceContents(aFn) {
    for (var i = 0, len = this.children.length;i < len; i++) {
      if (this.children[i][isSourceNode]) {
        this.children[i].walkSourceContents(aFn);
      }
    }
    var sources = Object.keys(this.sourceContents);
    for (var i = 0, len = sources.length;i < len; i++) {
      aFn(util.fromSetString(sources[i]), this.sourceContents[sources[i]]);
    }
  };
  SourceNode.prototype.toString = function SourceNode_toString() {
    var str = "";
    this.walk(function(chunk) {
      str += chunk;
    });
    return str;
  };
  SourceNode.prototype.toStringWithSourceMap = function SourceNode_toStringWithSourceMap(aArgs) {
    var generated = {
      code: "",
      line: 1,
      column: 0
    };
    var map = new SourceMapGenerator(aArgs);
    var sourceMappingActive = false;
    var lastOriginalSource = null;
    var lastOriginalLine = null;
    var lastOriginalColumn = null;
    var lastOriginalName = null;
    this.walk(function(chunk, original) {
      generated.code += chunk;
      if (original.source !== null && original.line !== null && original.column !== null) {
        if (lastOriginalSource !== original.source || lastOriginalLine !== original.line || lastOriginalColumn !== original.column || lastOriginalName !== original.name) {
          map.addMapping({
            source: original.source,
            original: {
              line: original.line,
              column: original.column
            },
            generated: {
              line: generated.line,
              column: generated.column
            },
            name: original.name
          });
        }
        lastOriginalSource = original.source;
        lastOriginalLine = original.line;
        lastOriginalColumn = original.column;
        lastOriginalName = original.name;
        sourceMappingActive = true;
      } else if (sourceMappingActive) {
        map.addMapping({
          generated: {
            line: generated.line,
            column: generated.column
          }
        });
        lastOriginalSource = null;
        sourceMappingActive = false;
      }
      for (var idx = 0, length = chunk.length;idx < length; idx++) {
        if (chunk.charCodeAt(idx) === NEWLINE_CODE) {
          generated.line++;
          generated.column = 0;
          if (idx + 1 === length) {
            lastOriginalSource = null;
            sourceMappingActive = false;
          } else if (sourceMappingActive) {
            map.addMapping({
              source: original.source,
              original: {
                line: original.line,
                column: original.column
              },
              generated: {
                line: generated.line,
                column: generated.column
              },
              name: original.name
            });
          }
        } else {
          generated.column++;
        }
      }
    });
    this.walkSourceContents(function(sourceFile, sourceContent) {
      map.setSourceContent(sourceFile, sourceContent);
    });
    return { code: generated.code, map };
  };
  exports.SourceNode = SourceNode;
});

// node_modules/source-map-js/source-map.js
var require_source_map = __commonJS(function(exports) {
  exports.SourceMapGenerator = require_source_map_generator().SourceMapGenerator;
  exports.SourceMapConsumer = require_source_map_consumer().SourceMapConsumer;
  exports.SourceNode = require_source_node().SourceNode;
});

// node_modules/postcss/lib/previous-map.js
var require_previous_map = __commonJS(function(exports, module) {
  var { existsSync, readFileSync, realpathSync } = __require("fs");
  var { dirname, isAbsolute, join, relative, sep } = __require("path");
  var { SourceMapConsumer, SourceMapGenerator } = require_source_map();
  function realPath(path) {
    try {
      return realpathSync(path);
    } catch {
      return path;
    }
  }
  function fromBase64(str) {
    if (Buffer) {
      return Buffer.from(str, "base64").toString();
    } else {
      return window.atob(str);
    }
  }

  class PreviousMap {
    constructor(css, opts) {
      if (opts.map === false)
        return;
      if (opts.unsafeMap)
        this.unsafeMap = true;
      this.loadAnnotation(css);
      this.inline = this.startWith(this.annotation, "data:");
      let prev = opts.map ? opts.map.prev : undefined;
      let text = this.loadMap(opts.from, prev);
      if (!this.mapFile && opts.from) {
        this.mapFile = opts.from;
      }
      if (this.mapFile)
        this.root = dirname(this.mapFile);
      if (text)
        this.text = text;
    }
    consumer() {
      if (!this.consumerCache) {
        this.consumerCache = new SourceMapConsumer(this.json || this.text);
      }
      return this.consumerCache;
    }
    decodeInline(text) {
      let baseCharsetUri = /^data:application\/json;charset=utf-?8;base64,/;
      let baseUri = /^data:application\/json;base64,/;
      let charsetUri = /^data:application\/json;charset=utf-?8,/;
      let uri = /^data:application\/json,/;
      let uriMatch = text.match(charsetUri) || text.match(uri);
      if (uriMatch) {
        return decodeURIComponent(text.substr(uriMatch[0].length));
      }
      let baseUriMatch = text.match(baseCharsetUri) || text.match(baseUri);
      if (baseUriMatch) {
        return fromBase64(text.substr(baseUriMatch[0].length));
      }
      let encoding = text.slice("data:application/json;".length);
      encoding = encoding.slice(0, encoding.indexOf(","));
      throw new Error("Unsupported source map encoding " + encoding);
    }
    getAnnotationURL(sourceMapString) {
      return sourceMapString.replace(/^\/\*\s*# sourceMappingURL=/, "").trim();
    }
    isMap(map) {
      if (typeof map !== "object")
        return false;
      return typeof map.mappings === "string" || typeof map._mappings === "string" || Array.isArray(map.sections);
    }
    loadAnnotation(css) {
      let comments = css.match(/\/\*\s*# sourceMappingURL=/g);
      if (!comments)
        return;
      let start = css.lastIndexOf(comments.pop());
      let end = css.indexOf("*/", start);
      if (start > -1 && end > -1) {
        this.annotation = this.getAnnotationURL(css.substring(start, end));
      }
    }
    loadFile(path, cssFile, trusted) {
      if (!trusted && !this.unsafeMap) {
        if (!/\.map$/i.test(path))
          return;
        if (!cssFile)
          return;
        let rel = relative(realPath(dirname(cssFile)), realPath(path));
        if (rel === ".." || rel.startsWith(".." + sep) || isAbsolute(rel)) {
          return;
        }
      }
      this.root = dirname(path);
      if (existsSync(path)) {
        this.mapFile = path;
        return readFileSync(path, "utf-8").toString().trim();
      }
    }
    loadMap(file, prev) {
      if (prev === false)
        return false;
      if (prev) {
        if (typeof prev === "string") {
          return prev;
        } else if (typeof prev === "function") {
          let prevPath = prev(file);
          if (prevPath) {
            let map = this.loadFile(prevPath, file, true);
            if (!map) {
              throw new Error("Unable to load previous source map: " + prevPath.toString());
            }
            return map;
          }
        } else if (prev instanceof SourceMapConsumer) {
          return SourceMapGenerator.fromSourceMap(prev).toString();
        } else if (prev instanceof SourceMapGenerator) {
          return prev.toString();
        } else if (this.isMap(prev)) {
          return JSON.stringify(prev);
        } else {
          throw new Error("Unsupported previous source map format: " + prev.toString());
        }
      } else if (this.inline) {
        return this.decodeInline(this.annotation);
      } else if (this.annotation) {
        let map = this.annotation;
        if (file)
          map = join(dirname(file), map);
        let unknown = this.loadFile(map, file, false);
        if (unknown) {
          try {
            this.json = JSON.parse(unknown.replace(/^\)]}'[^\n]*\n/, ""));
          } catch {
            return;
          }
        }
        return unknown;
      }
    }
    startWith(string, start) {
      if (!string)
        return false;
      return string.substr(0, start.length) === start;
    }
    withContent() {
      return !!(this.consumer().sourcesContent && this.consumer().sourcesContent.length > 0);
    }
  }
  module.exports = PreviousMap;
  PreviousMap.default = PreviousMap;
});

// node_modules/postcss/lib/input.js
var require_input = __commonJS(function(exports, module) {
  var { nanoid } = require_non_secure();
  var { isAbsolute, resolve } = __require("path");
  var { SourceMapConsumer, SourceMapGenerator } = require_source_map();
  var { fileURLToPath, pathToFileURL } = __require("url");
  var CssSyntaxError = require_css_syntax_error();
  var PreviousMap = require_previous_map();
  var terminalHighlight = require_terminal_highlight();
  var lineToIndexCache = Symbol("lineToIndexCache");
  var sourceMapAvailable = Boolean(SourceMapConsumer && SourceMapGenerator);
  var pathAvailable = Boolean(resolve && isAbsolute);
  function getLineToIndex(input) {
    if (input[lineToIndexCache])
      return input[lineToIndexCache];
    let lines = input.css.split(`
`);
    let lineToIndex = new Array(lines.length);
    let prevIndex = 0;
    for (let i = 0, l = lines.length;i < l; i++) {
      lineToIndex[i] = prevIndex;
      prevIndex += lines[i].length + 1;
    }
    input[lineToIndexCache] = lineToIndex;
    return lineToIndex;
  }

  class Input {
    get from() {
      return this.file || this.id;
    }
    constructor(css, opts = {}) {
      if (css === null || typeof css === "undefined" || typeof css === "object" && !css.toString) {
        throw new Error(`PostCSS received ${css} instead of CSS string`);
      }
      this.css = css.toString();
      if (this.css[0] === "\uFEFF" || this.css[0] === "￾") {
        this.hasBOM = true;
        this.css = this.css.slice(1);
      } else {
        this.hasBOM = false;
      }
      this.document = this.css;
      if (opts.document)
        this.document = opts.document.toString();
      if (opts.from) {
        if (!pathAvailable || /^\w+:\/\//.test(opts.from) || isAbsolute(opts.from)) {
          this.file = opts.from;
        } else {
          this.file = resolve(opts.from);
        }
      }
      if (pathAvailable && sourceMapAvailable) {
        let map = new PreviousMap(this.css, opts);
        if (map.text) {
          this.map = map;
          let file = map.consumer().file;
          if (!this.file && file)
            this.file = this.mapResolve(file);
        }
      }
      if (!this.file) {
        this.id = "<input css " + nanoid(6) + ">";
      }
      if (this.map)
        this.map.file = this.from;
    }
    error(message, line, column, opts = {}) {
      let endColumn, endLine, endOffset, offset, result;
      if (line && typeof line === "object") {
        let start = line;
        let end = column;
        if (typeof start.offset === "number") {
          offset = start.offset;
          let pos = this.fromOffset(offset);
          line = pos.line;
          column = pos.col;
        } else {
          line = start.line;
          column = start.column;
          offset = this.fromLineAndColumn(line, column);
        }
        if (typeof end.offset === "number") {
          endOffset = end.offset;
          let pos = this.fromOffset(endOffset);
          endLine = pos.line;
          endColumn = pos.col;
        } else {
          endLine = end.line;
          endColumn = end.column;
          endOffset = this.fromLineAndColumn(end.line, end.column);
        }
      } else if (!column) {
        offset = line;
        let pos = this.fromOffset(offset);
        line = pos.line;
        column = pos.col;
      } else {
        offset = this.fromLineAndColumn(line, column);
      }
      let origin = this.origin(line, column, endLine, endColumn);
      if (origin) {
        result = new CssSyntaxError(message, origin.endLine === undefined ? origin.line : { column: origin.column, line: origin.line }, origin.endLine === undefined ? origin.column : { column: origin.endColumn, line: origin.endLine }, origin.source, origin.file, opts.plugin);
      } else {
        result = new CssSyntaxError(message, endLine === undefined ? line : { column, line }, endLine === undefined ? column : { column: endColumn, line: endLine }, this.css, this.file, opts.plugin);
      }
      result.input = {
        column,
        endColumn,
        endLine,
        endOffset,
        line,
        offset,
        source: this.css
      };
      if (this.file) {
        if (pathToFileURL) {
          result.input.url = pathToFileURL(this.file).toString();
        }
        result.input.file = this.file;
      }
      return result;
    }
    fromLineAndColumn(line, column) {
      let lineToIndex = getLineToIndex(this);
      let index = lineToIndex[line - 1];
      return index + column - 1;
    }
    fromOffset(offset) {
      let lineToIndex = getLineToIndex(this);
      let lastLine = lineToIndex[lineToIndex.length - 1];
      let min = 0;
      if (offset >= lastLine) {
        min = lineToIndex.length - 1;
      } else {
        let max = lineToIndex.length - 2;
        let mid;
        while (min < max) {
          mid = min + (max - min >> 1);
          if (offset < lineToIndex[mid]) {
            max = mid - 1;
          } else if (offset >= lineToIndex[mid + 1]) {
            min = mid + 1;
          } else {
            min = mid;
            break;
          }
        }
      }
      return {
        col: offset - lineToIndex[min] + 1,
        line: min + 1
      };
    }
    mapResolve(file) {
      if (/^\w+:\/\//.test(file)) {
        return file;
      }
      return resolve(this.map.consumer().sourceRoot || this.map.root || ".", file);
    }
    origin(line, column, endLine, endColumn) {
      if (!this.map)
        return false;
      let consumer = this.map.consumer();
      let from = consumer.originalPositionFor({ column: column - 1, line });
      if (!from.source)
        return false;
      let to;
      if (typeof endLine === "number") {
        let toPosition = consumer.originalPositionFor({
          column: endColumn - 1,
          line: endLine
        });
        if (toPosition.source)
          to = toPosition;
      }
      let fromUrl;
      if (isAbsolute(from.source)) {
        fromUrl = pathToFileURL(from.source);
      } else {
        fromUrl = new URL(from.source, this.map.consumer().sourceRoot || pathToFileURL(this.map.mapFile));
      }
      let result = {
        column: from.column + 1,
        endColumn: to && to.column + 1,
        endLine: to && to.line,
        line: from.line,
        url: fromUrl.toString()
      };
      if (fromUrl.protocol === "file:") {
        if (fileURLToPath) {
          result.file = fileURLToPath(fromUrl);
        } else {
          throw new Error(`file: protocol is not available in this PostCSS build`);
        }
      }
      let source = consumer.sourceContentFor(from.source);
      if (source)
        result.source = source;
      return result;
    }
    toJSON() {
      let json = {};
      for (let name of ["hasBOM", "css", "file", "id"]) {
        if (this[name] != null) {
          json[name] = this[name];
        }
      }
      if (this.map) {
        json.map = { ...this.map };
        if (json.map.consumerCache) {
          json.map.consumerCache = undefined;
        }
      }
      return json;
    }
  }
  module.exports = Input;
  Input.default = Input;
  if (terminalHighlight && terminalHighlight.registerInput) {
    terminalHighlight.registerInput(Input);
  }
});

// node_modules/postcss/lib/root.js
var require_root = __commonJS(function(exports, module) {
  var Container = require_container();
  var LazyResult;
  var Processor;

  class Root extends Container {
    constructor(defaults) {
      super(defaults);
      this.type = "root";
      if (!this.nodes)
        this.nodes = [];
    }
    normalize(child, sample, type) {
      let keepBefore = new Set;
      for (let node of Array.isArray(child) ? child : [child]) {
        if (node && typeof node === "object" && !node.parent && node.raws && typeof node.raws.before !== "undefined") {
          keepBefore.add(node.raws);
        }
      }
      let nodes = super.normalize(child);
      if (sample) {
        if (type === "prepend") {
          if (this.nodes.length > 1) {
            sample.raws.before = this.nodes[1].raws.before;
          } else {
            delete sample.raws.before;
          }
        } else if (this.first !== sample) {
          for (let node of nodes) {
            if (!keepBefore.has(node.raws)) {
              node.raws.before = sample.raws.before;
            }
          }
        }
      }
      return nodes;
    }
    removeChild(child, ignore) {
      let index = this.index(child);
      if (!ignore && index === 0 && this.nodes.length > 1) {
        this.nodes[1].raws.before = this.nodes[index].raws.before;
      }
      return super.removeChild(child);
    }
    toResult(opts = {}) {
      let lazy = new LazyResult(new Processor, this, opts);
      return lazy.stringify();
    }
  }
  Root.registerLazyResult = (dependant) => {
    LazyResult = dependant;
  };
  Root.registerProcessor = (dependant) => {
    Processor = dependant;
  };
  module.exports = Root;
  Root.default = Root;
  Container.registerRoot(Root);
});

// node_modules/postcss/lib/list.js
var require_list = __commonJS(function(exports, module) {
  var list = {
    comma(string) {
      return list.split(string, [","], true);
    },
    space(string) {
      let spaces = [" ", `
`, "\t"];
      return list.split(string, spaces);
    },
    split(string, separators, last) {
      if (typeof string !== "string")
        return [];
      let array = [];
      let current = "";
      let split = false;
      let func = 0;
      let inQuote = false;
      let prevQuote = "";
      let escape = false;
      let inComment = false;
      for (let i = 0;i < string.length; i++) {
        let letter = string[i];
        if (inComment) {
          current += letter;
          if (letter === "*" && string[i + 1] === "/") {
            current += "/";
            i += 1;
            inComment = false;
          }
          continue;
        }
        if (escape) {
          escape = false;
        } else if (letter === "\\") {
          escape = true;
        } else if (inQuote) {
          if (letter === prevQuote) {
            inQuote = false;
          }
        } else if (letter === '"' || letter === "'") {
          inQuote = true;
          prevQuote = letter;
        } else if (letter === "/" && string[i + 1] === "*") {
          current += "/*";
          i += 1;
          inComment = true;
          continue;
        } else if (letter === "(") {
          func += 1;
        } else if (letter === ")") {
          if (func > 0)
            func -= 1;
        } else if (func === 0) {
          if (separators.includes(letter))
            split = true;
        }
        if (split) {
          let value = current.trim();
          if (last || value !== "")
            array.push(value);
          current = "";
          split = false;
        } else {
          current += letter;
        }
      }
      let value = current.trim();
      if (last || value !== "")
        array.push(value);
      return array;
    }
  };
  module.exports = list;
  list.default = list;
});

// node_modules/postcss/lib/rule.js
var require_rule = __commonJS(function(exports, module) {
  var Container = require_container();
  var list = require_list();

  class Rule extends Container {
    get selectors() {
      return list.comma(this.selector);
    }
    set selectors(values) {
      let match = this.selector ? this.selector.match(/,\s*/) : null;
      let sep = match ? match[0] : "," + this.raw("between", "beforeOpen");
      this.selector = values.join(sep);
    }
    constructor(defaults) {
      super(defaults);
      this.type = "rule";
      if (!this.nodes)
        this.nodes = [];
    }
  }
  module.exports = Rule;
  Rule.default = Rule;
  Container.registerRule(Rule);
});

// node_modules/postcss/lib/fromJSON.js
var require_fromJSON = __commonJS(function(exports, module) {
  var AtRule = require_at_rule();
  var Comment = require_comment();
  var Declaration = require_declaration();
  var Input = require_input();
  var PreviousMap = require_previous_map();
  var Root = require_root();
  var Rule = require_rule();
  function hydrateInputs(json, inputs) {
    if (!json.inputs)
      return inputs;
    return json.inputs.map((input) => {
      let inputHydrated = { ...input, __proto__: Input.prototype };
      if (inputHydrated.map) {
        inputHydrated.map = {
          ...inputHydrated.map,
          __proto__: PreviousMap.prototype
        };
      }
      return inputHydrated;
    });
  }
  function constructNode(json, inputs, children) {
    let defaults = { ...json };
    delete defaults.inputs;
    delete defaults.nodes;
    if (defaults.source) {
      let { inputId, ...source } = defaults.source;
      defaults.source = source;
      if (inputId != null) {
        defaults.source.input = inputs[inputId];
      }
    }
    let node;
    if (defaults.type === "root") {
      node = new Root(defaults);
    } else if (defaults.type === "decl") {
      node = new Declaration(defaults);
    } else if (defaults.type === "rule") {
      node = new Rule(defaults);
    } else if (defaults.type === "comment") {
      node = new Comment(defaults);
    } else if (defaults.type === "atrule") {
      node = new AtRule(defaults);
    } else {
      throw new Error("Unknown node type: " + json.type);
    }
    if (children) {
      node.nodes = children;
      for (let child of children)
        child.parent = node;
    }
    return node;
  }
  function fromJSON(json, inputs) {
    if (Array.isArray(json))
      return json.map((n) => fromJSON(n));
    let result;
    let stack = [
      { childIndex: 0, children: [], inputs: hydrateInputs(json, inputs), json }
    ];
    while (stack.length > 0) {
      let frame = stack[stack.length - 1];
      let jsonNodes = frame.json.nodes;
      if (jsonNodes && frame.childIndex < jsonNodes.length) {
        let childJson = jsonNodes[frame.childIndex];
        frame.childIndex += 1;
        stack.push({
          childIndex: 0,
          children: [],
          inputs: hydrateInputs(childJson, frame.inputs),
          json: childJson
        });
        continue;
      }
      stack.pop();
      let node = constructNode(frame.json, frame.inputs, jsonNodes ? frame.children : undefined);
      if (stack.length > 0) {
        stack[stack.length - 1].children.push(node);
      } else {
        result = node;
      }
    }
    return result;
  }
  module.exports = fromJSON;
  fromJSON.default = fromJSON;
});

// node_modules/postcss/lib/map-generator.js
var require_map_generator = __commonJS(function(exports, module) {
  var { dirname, relative, resolve, sep } = __require("path");
  var { SourceMapConsumer, SourceMapGenerator } = require_source_map();
  var { pathToFileURL } = __require("url");
  var Input = require_input();
  var sourceMapAvailable = Boolean(SourceMapConsumer && SourceMapGenerator);
  var pathAvailable = Boolean(dirname && resolve && relative && sep);

  class MapGenerator {
    constructor(stringify, root, opts, cssString) {
      this.stringify = stringify;
      this.mapOpts = opts.map || {};
      this.root = root;
      this.opts = opts;
      this.css = cssString;
      this.originalCSS = cssString;
      this.usesFileUrls = !this.mapOpts.from && this.mapOpts.absolute;
      this.memoizedFileURLs = new Map;
      this.memoizedPaths = new Map;
      this.memoizedURLs = new Map;
    }
    addAnnotation() {
      let content;
      if (this.isInline()) {
        content = "data:application/json;base64," + this.toBase64(this.map.toString());
      } else if (typeof this.mapOpts.annotation === "string") {
        content = this.mapOpts.annotation;
      } else if (typeof this.mapOpts.annotation === "function") {
        content = this.mapOpts.annotation(this.opts.to, this.root);
      } else {
        content = this.outputFile() + ".map";
      }
      let eol = `
`;
      if (this.css.includes(`\r
`))
        eol = `\r
`;
      this.css += eol + "/*# sourceMappingURL=" + content + " */";
    }
    applyPrevMaps() {
      for (let prev of this.previous()) {
        let from = this.toUrl(this.path(prev.file));
        let root = prev.root || dirname(prev.file);
        let map;
        if (this.mapOpts.sourcesContent === false) {
          map = new SourceMapConsumer(prev.text);
          if (map.sourcesContent) {
            map.sourcesContent = null;
          }
        } else {
          map = prev.consumer();
        }
        this.map.applySourceMap(map, from, this.toUrl(this.path(root)));
      }
    }
    clearAnnotation() {
      if (this.mapOpts.annotation === false)
        return;
      if (this.root) {
        let node;
        for (let i = this.root.nodes.length - 1;i >= 0; i--) {
          node = this.root.nodes[i];
          if (node.type !== "comment")
            continue;
          if (node.text.startsWith("# sourceMappingURL=")) {
            this.root.removeChild(i);
          }
        }
      } else if (this.css) {
        let annotation = "/*# sourceMappingURL=";
        let css = "";
        let cursor = 0;
        let startIndex;
        while ((startIndex = this.css.indexOf(annotation, cursor)) !== -1) {
          let endIndex = this.css.indexOf("*/", startIndex + annotation.length);
          if (endIndex === -1)
            break;
          while (startIndex > cursor && this.css[startIndex - 1] === `
`) {
            startIndex--;
          }
          css += this.css.slice(cursor, startIndex);
          cursor = endIndex + 2;
        }
        if (cursor > 0)
          this.css = css + this.css.slice(cursor);
      }
    }
    generate() {
      this.clearAnnotation();
      if (pathAvailable && sourceMapAvailable && this.isMap()) {
        return this.generateMap();
      } else {
        let result = "";
        this.stringify(this.root, (i) => {
          result += i;
        });
        return [result];
      }
    }
    generateMap() {
      if (this.root) {
        this.generateString();
      } else if (this.previous().length === 1) {
        let prev = this.previous()[0].consumer();
        prev.file = this.outputFile();
        this.map = SourceMapGenerator.fromSourceMap(prev, {
          ignoreInvalidMapping: true
        });
      } else {
        this.map = new SourceMapGenerator({
          file: this.outputFile(),
          ignoreInvalidMapping: true
        });
        this.map.addMapping({
          generated: { column: 0, line: 1 },
          original: { column: 0, line: 1 },
          source: this.opts.from ? this.toUrl(this.path(this.opts.from)) : "<no source>"
        });
      }
      if (this.isSourcesContent())
        this.setSourcesContent();
      if (this.root && this.previous().length > 0)
        this.applyPrevMaps();
      if (this.isAnnotation())
        this.addAnnotation();
      if (this.isInline()) {
        return [this.css];
      } else {
        return [this.css, this.map];
      }
    }
    generateString() {
      this.css = "";
      this.map = new SourceMapGenerator({
        file: this.outputFile(),
        ignoreInvalidMapping: true
      });
      let line = 1;
      let column = 1;
      let noSource = "<no source>";
      let mapping = {
        generated: { column: 0, line: 0 },
        original: { column: 0, line: 0 },
        source: ""
      };
      let last, lines;
      this.stringify(this.root, (str, node, type) => {
        this.css += str;
        if (node && type !== "end") {
          mapping.generated.line = line;
          mapping.generated.column = column - 1;
          if (node.source && node.source.start) {
            mapping.source = this.sourcePath(node);
            mapping.original.line = node.source.start.line;
            mapping.original.column = node.source.start.column - 1;
            this.map.addMapping(mapping);
          } else {
            mapping.source = noSource;
            mapping.original.line = 1;
            mapping.original.column = 0;
            this.map.addMapping(mapping);
          }
        }
        lines = str.match(/\n/g);
        if (lines) {
          line += lines.length;
          last = str.lastIndexOf(`
`);
          column = str.length - last;
        } else {
          column += str.length;
        }
        if (node && type !== "start") {
          let p = node.parent || { raws: {} };
          let childless = node.type === "decl" || node.type === "atrule" && !node.nodes;
          if (!childless || node !== p.last || p.raws.semicolon) {
            if (node.source && node.source.end) {
              mapping.source = this.sourcePath(node);
              mapping.original.line = node.source.end.line;
              mapping.original.column = node.source.end.column - 1;
              mapping.generated.line = line;
              mapping.generated.column = column - 2;
              this.map.addMapping(mapping);
            } else {
              mapping.source = noSource;
              mapping.original.line = 1;
              mapping.original.column = 0;
              mapping.generated.line = line;
              mapping.generated.column = column - 1;
              this.map.addMapping(mapping);
            }
          }
        }
      });
    }
    isAnnotation() {
      if (this.isInline()) {
        return true;
      }
      if (typeof this.mapOpts.annotation !== "undefined") {
        return this.mapOpts.annotation;
      }
      if (this.previous().length) {
        return this.previous().some((i) => i.annotation);
      }
      return true;
    }
    isInline() {
      if (typeof this.mapOpts.inline !== "undefined") {
        return this.mapOpts.inline;
      }
      let annotation = this.mapOpts.annotation;
      if (typeof annotation !== "undefined" && annotation !== true) {
        return false;
      }
      if (this.previous().length) {
        return this.previous().some((i) => i.inline);
      }
      return true;
    }
    isMap() {
      if (typeof this.opts.map !== "undefined") {
        return !!this.opts.map;
      }
      return this.previous().length > 0;
    }
    isSourcesContent() {
      if (typeof this.mapOpts.sourcesContent !== "undefined") {
        return this.mapOpts.sourcesContent;
      }
      if (this.previous().length) {
        return this.previous().some((i) => i.withContent());
      }
      return true;
    }
    outputFile() {
      if (this.opts.to) {
        return this.path(this.opts.to);
      } else if (this.opts.from) {
        return this.path(this.opts.from);
      } else {
        return "to.css";
      }
    }
    path(file) {
      if (this.mapOpts.absolute)
        return file;
      if (file.charCodeAt(0) === 60)
        return file;
      if (/^\w+:\/\//.test(file))
        return file;
      let cached = this.memoizedPaths.get(file);
      if (cached)
        return cached;
      let from = this.opts.to ? dirname(this.opts.to) : ".";
      if (typeof this.mapOpts.annotation === "string") {
        from = dirname(resolve(from, this.mapOpts.annotation));
      }
      let path = relative(from, file);
      this.memoizedPaths.set(file, path);
      return path;
    }
    previous() {
      if (!this.previousMaps) {
        this.previousMaps = [];
        if (this.root) {
          this.root.walk((node) => {
            if (node.source && node.source.input.map) {
              let map = node.source.input.map;
              if (!this.previousMaps.includes(map)) {
                this.previousMaps.push(map);
              }
            }
          });
        } else {
          let input = new Input(this.originalCSS, this.opts);
          if (input.map)
            this.previousMaps.push(input.map);
        }
      }
      return this.previousMaps;
    }
    setSourcesContent() {
      let already = {};
      if (this.root) {
        this.root.walk((node) => {
          if (node.source) {
            let from = node.source.input.from;
            if (from && !already[from]) {
              already[from] = true;
              let fromUrl = this.usesFileUrls ? this.toFileUrl(from) : this.toUrl(this.path(from));
              this.map.setSourceContent(fromUrl, node.source.input.css);
            }
          }
        });
      } else if (this.css) {
        let from = this.opts.from ? this.toUrl(this.path(this.opts.from)) : "<no source>";
        this.map.setSourceContent(from, this.css);
      }
    }
    sourcePath(node) {
      if (this.mapOpts.from) {
        return this.toUrl(this.mapOpts.from);
      } else if (this.usesFileUrls) {
        return this.toFileUrl(node.source.input.from);
      } else {
        return this.toUrl(this.path(node.source.input.from));
      }
    }
    toBase64(str) {
      if (Buffer) {
        return Buffer.from(str).toString("base64");
      } else {
        return window.btoa(unescape(encodeURIComponent(str)));
      }
    }
    toFileUrl(path) {
      let cached = this.memoizedFileURLs.get(path);
      if (cached)
        return cached;
      if (pathToFileURL) {
        let fileURL = pathToFileURL(path).toString();
        this.memoizedFileURLs.set(path, fileURL);
        return fileURL;
      } else {
        throw new Error("`map.absolute` option is not available in this PostCSS build");
      }
    }
    toUrl(path) {
      let cached = this.memoizedURLs.get(path);
      if (cached)
        return cached;
      if (sep === "\\") {
        path = path.replace(/\\/g, "/");
      }
      let url = encodeURI(path).replace(/[#?]/g, encodeURIComponent);
      this.memoizedURLs.set(path, url);
      return url;
    }
  }
  module.exports = MapGenerator;
});

// node_modules/postcss/lib/parser.js
var require_parser = __commonJS(function(exports, module) {
  var AtRule = require_at_rule();
  var Comment = require_comment();
  var Declaration = require_declaration();
  var Root = require_root();
  var Rule = require_rule();
  var tokenizer = require_tokenize();
  var SAFE_COMMENT_NEIGHBOR = {
    empty: true,
    space: true
  };
  function findLastWithPosition(tokens) {
    for (let i = tokens.length - 1;i >= 0; i--) {
      let token = tokens[i];
      let pos = token[3] || token[2];
      if (pos)
        return pos;
    }
  }
  function tokensToString(tokens, from, to) {
    let result = "";
    for (let i = from;i < to; i++)
      result += tokens[i][1];
    return result;
  }

  class Parser {
    constructor(input) {
      this.input = input;
      this.root = new Root;
      this.current = this.root;
      this.spaces = "";
      this.semicolon = false;
      this.createTokenizer();
      this.root.source = { input, start: { column: 1, line: 1, offset: 0 } };
    }
    atrule(token) {
      let node = new AtRule;
      node.name = token[1].slice(1);
      if (node.name === "") {
        this.unnamedAtrule(node, token);
      }
      this.init(node, token[2]);
      let type;
      let prev;
      let shift;
      let last = false;
      let open = false;
      let params = [];
      let brackets = [];
      while (!this.tokenizer.endOfFile()) {
        token = this.tokenizer.nextToken();
        type = token[0];
        if (type === "(" || type === "[") {
          brackets.push(type === "(" ? ")" : "]");
        } else if (type === "{" && brackets.length > 0) {
          brackets.push("}");
        } else if (type === brackets[brackets.length - 1]) {
          brackets.pop();
        }
        if (brackets.length === 0) {
          if (type === ";") {
            node.source.end = this.getPosition(token[2]);
            node.source.end.offset++;
            this.semicolon = true;
            break;
          } else if (type === "{") {
            open = true;
            break;
          } else if (type === "}") {
            if (params.length > 0) {
              shift = params.length - 1;
              prev = params[shift];
              while (prev && prev[0] === "space") {
                prev = params[--shift];
              }
              if (prev) {
                node.source.end = this.getPosition(prev[3] || prev[2]);
                node.source.end.offset++;
              }
            }
            this.end(token);
            break;
          } else {
            params.push(token);
          }
        } else {
          params.push(token);
        }
        if (this.tokenizer.endOfFile()) {
          last = true;
          break;
        }
      }
      node.raws.between = this.spacesAndCommentsFromEnd(params);
      if (params.length) {
        node.raws.afterName = this.spacesAndCommentsFromStart(params);
        this.raw(node, "params", params);
        if (last) {
          token = params[params.length - 1];
          node.source.end = this.getPosition(token[3] || token[2]);
          node.source.end.offset++;
          this.spaces = node.raws.between;
          node.raws.between = "";
        }
      } else {
        node.raws.afterName = "";
        node.params = "";
      }
      if (open) {
        node.nodes = [];
        this.current = node;
      }
    }
    checkMissedSemicolon(tokens) {
      let colon = this.colon(tokens);
      if (colon === false)
        return;
      let founded = 0;
      let token;
      for (let j = colon - 1;j >= 0; j--) {
        token = tokens[j];
        if (token[0] !== "space") {
          founded += 1;
          if (founded === 2)
            break;
        }
      }
      throw this.input.error("Missed semicolon", token[0] === "word" ? token[3] + 1 : token[2]);
    }
    colon(tokens) {
      let brackets = 0;
      let prev, token, type;
      for (let [i, element] of tokens.entries()) {
        token = element;
        type = token[0];
        if (type === "(") {
          brackets += 1;
        }
        if (type === ")") {
          brackets -= 1;
        }
        if (brackets === 0 && type === ":") {
          if (!prev) {
            this.doubleColon(token);
          } else if (prev[0] === "word" && prev[1] === "progid") {
            continue;
          } else {
            return i;
          }
        }
        prev = token;
      }
      return false;
    }
    comment(token) {
      let node = new Comment;
      this.init(node, token[2]);
      node.source.end = this.getPosition(token[3] || token[2]);
      node.source.end.offset++;
      let text = token[1].slice(2, -2);
      if (!text.trim()) {
        node.text = "";
        node.raws.left = text;
        node.raws.right = "";
      } else {
        let match = text.match(/^(\s*)([^]*\S)(\s*)$/);
        node.text = match[2];
        node.raws.left = match[1];
        node.raws.right = match[3];
      }
    }
    createTokenizer() {
      this.tokenizer = tokenizer(this.input);
    }
    decl(tokens, customProperty) {
      let node = new Declaration;
      this.init(node, tokens[0][2]);
      let last = tokens[tokens.length - 1];
      if (last[0] === ";") {
        this.semicolon = true;
        tokens.pop();
      }
      node.source.end = this.getPosition(last[3] || last[2] || findLastWithPosition(tokens));
      node.source.end.offset++;
      let start = 0;
      while (tokens[start][0] !== "word") {
        if (start === tokens.length - 1)
          this.unknownWord([tokens[start]]);
        start++;
      }
      node.raws.before += tokensToString(tokens, 0, start);
      node.source.start = this.getPosition(tokens[start][2]);
      let propStart = start;
      while (start < tokens.length) {
        let type = tokens[start][0];
        if (type === ":" || type === "space" || type === "comment") {
          break;
        }
        start++;
      }
      node.prop = tokensToString(tokens, propStart, start);
      let betweenStart = start;
      let token;
      while (start < tokens.length) {
        token = tokens[start];
        start++;
        if (token[0] === ":")
          break;
        if (token[0] === "word" && /\w/.test(token[1])) {
          this.unknownWord([token]);
        }
      }
      node.raws.between = tokensToString(tokens, betweenStart, start);
      if (node.prop[0] === "_" || node.prop[0] === "*") {
        node.raws.before += node.prop[0];
        node.prop = node.prop.slice(1);
      }
      let firstSpacesStart = start;
      while (start < tokens.length) {
        let next = tokens[start][0];
        if (next !== "space" && next !== "comment")
          break;
        start++;
      }
      let firstSpaces = tokens.slice(firstSpacesStart, start);
      tokens = tokens.slice(start);
      this.precheckMissedSemicolon(tokens);
      for (let i = tokens.length - 1;i >= 0; i--) {
        token = tokens[i];
        if (token[1].toLowerCase() === "!important") {
          node.important = true;
          let string = this.stringFrom(tokens, i);
          string = this.spacesFromEnd(tokens) + string;
          if (string !== " !important")
            node.raws.important = string;
          break;
        } else if (token[1].toLowerCase() === "important") {
          let cache = tokens.slice(0);
          let str = "";
          for (let j = i;j > 0; j--) {
            let type = cache[j][0];
            if (str.trim().startsWith("!") && type !== "space") {
              break;
            }
            str = cache.pop()[1] + str;
          }
          if (str.trim().startsWith("!")) {
            node.important = true;
            node.raws.important = str;
            tokens = cache;
          }
        }
        if (token[0] !== "space" && token[0] !== "comment") {
          break;
        }
      }
      let hasWord = tokens.some((i) => i[0] !== "space" && i[0] !== "comment");
      if (hasWord) {
        node.raws.between += firstSpaces.map((i) => i[1]).join("");
        firstSpaces = [];
      }
      this.raw(node, "value", firstSpaces.concat(tokens), customProperty);
      if (node.value.includes(":") && !customProperty) {
        this.checkMissedSemicolon(tokens);
      }
    }
    doubleColon(token) {
      throw this.input.error("Double colon", { offset: token[2] }, { offset: token[2] + token[1].length });
    }
    emptyRule(token) {
      let node = new Rule;
      this.init(node, token[2]);
      node.selector = "";
      node.raws.between = "";
      this.current = node;
    }
    end(token) {
      if (this.current.nodes && this.current.nodes.length) {
        this.current.raws.semicolon = this.semicolon;
      }
      this.semicolon = false;
      this.current.raws.after = (this.current.raws.after || "") + this.spaces;
      this.spaces = "";
      if (this.current.parent) {
        this.current.source.end = this.getPosition(token[2]);
        this.current.source.end.offset++;
        this.current = this.current.parent;
      } else {
        this.unexpectedClose(token);
      }
    }
    endFile() {
      if (this.current.parent)
        this.unclosedBlock();
      if (this.current.nodes && this.current.nodes.length) {
        this.current.raws.semicolon = this.semicolon;
      }
      this.current.raws.after = (this.current.raws.after || "") + this.spaces;
      this.root.source.end = this.getPosition(this.tokenizer.position());
    }
    freeSemicolon(token) {
      this.spaces += token[1];
      if (this.current.nodes) {
        let prev = this.current.nodes[this.current.nodes.length - 1];
        if (prev && prev.type === "rule" && !prev.raws.ownSemicolon) {
          prev.raws.ownSemicolon = this.spaces;
          this.spaces = "";
          prev.source.end = this.getPosition(token[2]);
          prev.source.end.offset++;
        }
      }
    }
    getPosition(offset) {
      let pos = this.input.fromOffset(offset);
      return {
        column: pos.col,
        line: pos.line,
        offset
      };
    }
    init(node, offset) {
      this.current.push(node);
      node.source = {
        input: this.input,
        start: this.getPosition(offset)
      };
      node.raws.before = this.spaces;
      this.spaces = "";
      if (node.type !== "comment")
        this.semicolon = false;
    }
    other(start) {
      let end = false;
      let type = null;
      let colon = false;
      let bracket = null;
      let brackets = [];
      let customProperty = start[1].startsWith("--");
      let tokens = [];
      let token = start;
      while (token) {
        type = token[0];
        tokens.push(token);
        if (type === "(" || type === "[") {
          if (!bracket)
            bracket = token;
          brackets.push(type === "(" ? ")" : "]");
        } else if (customProperty && colon && type === "{") {
          if (!bracket)
            bracket = token;
          brackets.push("}");
        } else if (brackets.length === 0) {
          if (type === ";") {
            if (colon) {
              this.decl(tokens, customProperty);
              return;
            } else {
              break;
            }
          } else if (type === "{") {
            this.rule(tokens);
            return;
          } else if (type === "}") {
            this.tokenizer.back(tokens.pop());
            end = true;
            break;
          } else if (type === ":") {
            colon = true;
          }
        } else if (type === brackets[brackets.length - 1]) {
          brackets.pop();
          if (brackets.length === 0)
            bracket = null;
        }
        token = this.tokenizer.nextToken();
      }
      if (this.tokenizer.endOfFile())
        end = true;
      if (brackets.length > 0)
        this.unclosedBracket(bracket);
      if (end && colon) {
        if (!customProperty) {
          while (tokens.length) {
            token = tokens[tokens.length - 1][0];
            if (token !== "space" && token !== "comment")
              break;
            this.tokenizer.back(tokens.pop());
          }
        }
        this.decl(tokens, customProperty);
      } else {
        this.unknownWord(tokens);
      }
    }
    parse() {
      let token;
      while (!this.tokenizer.endOfFile()) {
        token = this.tokenizer.nextToken();
        switch (token[0]) {
          case "space":
            this.spaces += token[1];
            break;
          case ";":
            this.freeSemicolon(token);
            break;
          case "}":
            this.end(token);
            break;
          case "comment":
            this.comment(token);
            break;
          case "at-word":
            this.atrule(token);
            break;
          case "{":
            this.emptyRule(token);
            break;
          default:
            this.other(token);
            break;
        }
      }
      this.endFile();
    }
    precheckMissedSemicolon() {}
    raw(node, prop, tokens, customProperty) {
      let token, type;
      let length = tokens.length;
      let value = "";
      let last = "";
      let clean = true;
      let next, prev;
      for (let i = 0;i < length; i += 1) {
        token = tokens[i];
        type = token[0];
        if (type === "space" && i === length - 1 && !customProperty) {
          clean = false;
        } else if (type === "comment") {
          prev = tokens[i - 1] ? tokens[i - 1][0] : "empty";
          next = tokens[i + 1] ? tokens[i + 1][0] : "empty";
          if (!SAFE_COMMENT_NEIGHBOR[prev] && !SAFE_COMMENT_NEIGHBOR[next]) {
            if (last === ",") {
              clean = false;
            } else {
              value += token[1];
              last = token[1].slice(-1);
            }
          } else {
            clean = false;
          }
        } else {
          value += token[1];
          last = token[1].slice(-1);
        }
      }
      if (!clean) {
        let raw = tokens.reduce((all, i) => all + i[1], "");
        node.raws[prop] = { raw, value };
      }
      node[prop] = value;
    }
    rule(tokens) {
      tokens.pop();
      let node = new Rule;
      this.init(node, tokens[0][2]);
      node.raws.between = this.spacesAndCommentsFromEnd(tokens);
      this.raw(node, "selector", tokens);
      this.current = node;
    }
    spacesAndCommentsFromEnd(tokens) {
      let lastTokenType;
      let spaces = "";
      while (tokens.length) {
        lastTokenType = tokens[tokens.length - 1][0];
        if (lastTokenType !== "space" && lastTokenType !== "comment")
          break;
        spaces = tokens.pop()[1] + spaces;
      }
      return spaces;
    }
    spacesAndCommentsFromStart(tokens) {
      let next;
      let spaces = "";
      while (tokens.length) {
        next = tokens[0][0];
        if (next !== "space" && next !== "comment")
          break;
        spaces += tokens.shift()[1];
      }
      return spaces;
    }
    spacesFromEnd(tokens) {
      let lastTokenType;
      let spaces = "";
      while (tokens.length) {
        lastTokenType = tokens[tokens.length - 1][0];
        if (lastTokenType !== "space")
          break;
        spaces = tokens.pop()[1] + spaces;
      }
      return spaces;
    }
    stringFrom(tokens, from) {
      let result = "";
      for (let i = from;i < tokens.length; i++) {
        result += tokens[i][1];
      }
      tokens.splice(from, tokens.length - from);
      return result;
    }
    unclosedBlock() {
      let pos = this.current.source.start;
      throw this.input.error("Unclosed block", pos.line, pos.column);
    }
    unclosedBracket(bracket) {
      throw this.input.error("Unclosed bracket", { offset: bracket[2] }, { offset: bracket[2] + 1 });
    }
    unexpectedClose(token) {
      throw this.input.error("Unexpected }", { offset: token[2] }, { offset: token[2] + 1 });
    }
    unknownWord(tokens) {
      throw this.input.error("Unknown word " + tokens[0][1], { offset: tokens[0][2] }, { offset: tokens[0][2] + tokens[0][1].length });
    }
    unnamedAtrule(node, token) {
      throw this.input.error("At-rule without name", { offset: token[2] }, { offset: token[2] + token[1].length });
    }
  }
  module.exports = Parser;
});

// node_modules/postcss/lib/parse.js
var require_parse = __commonJS(function(exports, module) {
  var Container = require_container();
  var Input = require_input();
  var Parser = require_parser();
  function parse(css, opts) {
    let input = new Input(css, opts);
    let parser = new Parser(input);
    try {
      parser.parse();
    } catch (e) {
      if (true) {
        if (e.name === "CssSyntaxError" && opts && opts.from) {
          if (/\.scss$/i.test(opts.from)) {
            e.message += `
You tried to parse SCSS with ` + "the standard CSS parser; " + "try again with the postcss-scss parser";
          } else if (/\.sass/i.test(opts.from)) {
            e.message += `
You tried to parse Sass with ` + "the standard CSS parser; " + "try again with the postcss-sass parser";
          } else if (/\.less$/i.test(opts.from)) {
            e.message += `
You tried to parse Less with ` + "the standard CSS parser; " + "try again with the postcss-less parser";
          }
        }
      }
      throw e;
    }
    return parser.root;
  }
  module.exports = parse;
  parse.default = parse;
  Container.registerParse(parse);
});

// node_modules/postcss/lib/warning.js
var require_warning = __commonJS(function(exports, module) {
  var Container = require_container();
  var { my } = require_symbols();

  class Warning {
    constructor(text, opts = {}) {
      this.type = "warning";
      this.text = text;
      if (opts.node && opts.node.source) {
        if (!opts.node[my]) {
          Container.rebuild(opts.node);
        }
        let range = opts.node.rangeBy(opts);
        this.line = range.start.line;
        this.column = range.start.column;
        this.endLine = range.end.line;
        this.endColumn = range.end.column;
      }
      for (let opt in opts)
        this[opt] = opts[opt];
    }
    toString() {
      if (this.node) {
        return this.node.error(this.text, {
          index: this.index,
          plugin: this.plugin,
          word: this.word
        }).message;
      }
      if (this.plugin) {
        return this.plugin + ": " + this.text;
      }
      return this.text;
    }
  }
  module.exports = Warning;
  Warning.default = Warning;
});

// node_modules/postcss/lib/result.js
var require_result = __commonJS(function(exports, module) {
  var Warning = require_warning();

  class Result {
    get content() {
      return this.css;
    }
    constructor(processor, root, opts) {
      this.processor = processor;
      this.messages = [];
      this.root = root;
      this.opts = opts;
      this.css = "";
      this.map = undefined;
    }
    toString() {
      return this.css;
    }
    warn(text, opts = {}) {
      if (!opts.plugin) {
        if (this.lastPlugin && this.lastPlugin.postcssPlugin) {
          opts.plugin = this.lastPlugin.postcssPlugin;
        }
      }
      let warning = new Warning(text, opts);
      this.messages.push(warning);
      return warning;
    }
    warnings() {
      return this.messages.filter((i) => i.type === "warning");
    }
  }
  module.exports = Result;
  Result.default = Result;
});

// node_modules/postcss/lib/warn-once.js
var require_warn_once = __commonJS(function(exports, module) {
  var printed = {};
  module.exports = function warnOnce(message) {
    if (printed[message])
      return;
    printed[message] = true;
    if (typeof console !== "undefined" && console.warn) {
      console.warn(message);
    }
  };
});

// node_modules/postcss/lib/lazy-result.js
var require_lazy_result = __commonJS(function(exports, module) {
  var Container = require_container();
  var Document = require_document();
  var MapGenerator = require_map_generator();
  var parse = require_parse();
  var Result = require_result();
  var Root = require_root();
  var stringify = require_stringify();
  var { isClean, my } = require_symbols();
  var warnOnce = require_warn_once();
  var TYPE_TO_CLASS_NAME = {
    atrule: "AtRule",
    comment: "Comment",
    decl: "Declaration",
    document: "Document",
    root: "Root",
    rule: "Rule"
  };
  var PLUGIN_PROPS = {
    AtRule: true,
    AtRuleExit: true,
    Comment: true,
    CommentExit: true,
    Declaration: true,
    DeclarationExit: true,
    Document: true,
    DocumentExit: true,
    Once: true,
    OnceExit: true,
    postcssPlugin: true,
    prepare: true,
    Root: true,
    RootExit: true,
    Rule: true,
    RuleExit: true
  };
  var NOT_VISITORS = {
    Once: true,
    postcssPlugin: true,
    prepare: true
  };
  var CHILDREN = 0;
  function isPromise(obj) {
    return typeof obj === "object" && typeof obj.then === "function";
  }
  function getEvents(node) {
    let key = false;
    let type = TYPE_TO_CLASS_NAME[node.type];
    if (node.type === "decl") {
      key = node.prop.toLowerCase();
    } else if (node.type === "atrule") {
      key = node.name.toLowerCase();
    }
    if (key && node.append) {
      return [
        type,
        type + "-" + key,
        CHILDREN,
        type + "Exit",
        type + "Exit-" + key
      ];
    } else if (key) {
      return [type, type + "-" + key, type + "Exit", type + "Exit-" + key];
    } else if (node.append) {
      return [type, CHILDREN, type + "Exit"];
    } else {
      return [type, type + "Exit"];
    }
  }
  function toStack(node) {
    let events;
    if (node.type === "document") {
      events = ["Document", CHILDREN, "DocumentExit"];
    } else if (node.type === "root") {
      events = ["Root", CHILDREN, "RootExit"];
    } else {
      events = getEvents(node);
    }
    return {
      eventIndex: 0,
      events,
      iterator: 0,
      node,
      visitorIndex: 0,
      visitors: []
    };
  }
  function cleanMarks(node) {
    let stack = [node];
    while (stack.length > 0) {
      let next = stack.pop();
      next[isClean] = false;
      if (next.nodes) {
        for (let i of next.nodes)
          stack.push(i);
      }
    }
    return node;
  }
  var postcss = {};

  class LazyResult {
    get content() {
      return this.stringify().content;
    }
    get css() {
      return this.stringify().css;
    }
    get map() {
      return this.stringify().map;
    }
    get messages() {
      return this.sync().messages;
    }
    get opts() {
      return this.result.opts;
    }
    get processor() {
      return this.result.processor;
    }
    get root() {
      return this.sync().root;
    }
    get [Symbol.toStringTag]() {
      return "LazyResult";
    }
    constructor(processor, css, opts) {
      this.stringified = false;
      this.processed = false;
      let root;
      if (typeof css === "object" && css !== null && (css.type === "root" || css.type === "document")) {
        root = cleanMarks(css);
      } else if (css instanceof LazyResult || css instanceof Result) {
        root = cleanMarks(css.root);
        if (css.map) {
          if (typeof opts.map === "undefined")
            opts.map = {};
          if (!opts.map.inline)
            opts.map.inline = false;
          opts.map.prev = css.map;
        }
      } else {
        let parser = parse;
        if (opts.syntax)
          parser = opts.syntax.parse;
        if (opts.parser)
          parser = opts.parser;
        if (parser.parse)
          parser = parser.parse;
        try {
          root = parser(css, opts);
        } catch (error) {
          this.processed = true;
          this.error = error;
        }
        if (root && !root[my]) {
          Container.rebuild(root);
        }
      }
      this.result = new Result(processor, root, opts);
      this.helpers = { ...postcss, postcss, result: this.result };
      this.plugins = this.processor.plugins.map((plugin) => {
        if (typeof plugin === "object" && plugin.prepare) {
          return { ...plugin, ...plugin.prepare(this.result) };
        } else {
          return plugin;
        }
      });
    }
    async() {
      if (this.error)
        return Promise.reject(this.error);
      if (this.processed)
        return Promise.resolve(this.result);
      if (!this.processing) {
        this.processing = this.runAsync();
      }
      return this.processing;
    }
    catch(onRejected) {
      return this.async().catch(onRejected);
    }
    finally(onFinally) {
      return this.async().then(onFinally, onFinally);
    }
    getAsyncError() {
      throw new Error("Use process(css).then(cb) to work with async plugins");
    }
    handleError(error, node) {
      let plugin = this.result.lastPlugin;
      try {
        if (node)
          node.addToError(error);
        this.error = error;
        if (error.name === "CssSyntaxError" && !error.plugin) {
          error.plugin = plugin.postcssPlugin;
          error.setMessage();
        } else if (plugin.postcssVersion) {
          if (true) {
            let pluginName = plugin.postcssPlugin;
            let pluginVer = plugin.postcssVersion;
            let runtimeVer = this.result.processor.version;
            let a = pluginVer.split(".");
            let b = runtimeVer.split(".");
            if (a[0] !== b[0] || parseInt(a[1]) > parseInt(b[1])) {
              console.error("Unknown error from PostCSS plugin. Your current PostCSS " + "version is " + runtimeVer + ", but " + pluginName + " uses " + pluginVer + ". Perhaps this is the source of the error below.");
            }
          }
        }
      } catch (err) {
        if (console && console.error)
          console.error(err);
      }
      return error;
    }
    prepareVisitors() {
      this.listeners = {};
      let add = (plugin, type, cb) => {
        if (!this.listeners[type])
          this.listeners[type] = [];
        this.listeners[type].push([plugin, cb]);
      };
      for (let plugin of this.plugins) {
        if (typeof plugin === "object") {
          for (let event in plugin) {
            if (!PLUGIN_PROPS[event] && /^[A-Z]/.test(event)) {
              throw new Error(`Unknown event ${event} in ${plugin.postcssPlugin}. ` + `Try to update PostCSS (${this.processor.version} now).`);
            }
            if (!NOT_VISITORS[event]) {
              if (typeof plugin[event] === "object") {
                for (let filter in plugin[event]) {
                  if (filter === "*") {
                    add(plugin, event, plugin[event][filter]);
                  } else {
                    add(plugin, event + "-" + filter.toLowerCase(), plugin[event][filter]);
                  }
                }
              } else if (typeof plugin[event] === "function") {
                add(plugin, event, plugin[event]);
              }
            }
          }
        }
      }
      this.hasListener = Object.keys(this.listeners).length > 0;
    }
    async runAsync() {
      this.plugin = 0;
      for (let i = 0;i < this.plugins.length; i++) {
        let plugin = this.plugins[i];
        let promise = this.runOnRoot(plugin);
        if (isPromise(promise)) {
          try {
            await promise;
          } catch (error) {
            throw this.handleError(error);
          }
        }
      }
      this.prepareVisitors();
      if (this.hasListener) {
        let root = this.result.root;
        while (!root[isClean]) {
          root[isClean] = true;
          let stack = [toStack(root)];
          while (stack.length > 0) {
            let promise = this.visitTick(stack);
            if (isPromise(promise)) {
              try {
                await promise;
              } catch (e) {
                let node = stack[stack.length - 1].node;
                throw this.handleError(e, node);
              }
            }
          }
        }
        if (this.listeners.OnceExit) {
          for (let [plugin, visitor] of this.listeners.OnceExit) {
            this.result.lastPlugin = plugin;
            try {
              if (root.type === "document") {
                let roots = root.nodes.map((subRoot) => visitor(subRoot, this.helpers));
                await Promise.all(roots);
              } else {
                await visitor(root, this.helpers);
              }
            } catch (e) {
              throw this.handleError(e);
            }
          }
        }
      }
      this.processed = true;
      return this.stringify();
    }
    runOnRoot(plugin) {
      this.result.lastPlugin = plugin;
      try {
        if (typeof plugin === "object" && plugin.Once) {
          if (this.result.root.type === "document") {
            let roots = this.result.root.nodes.map((root) => plugin.Once(root, this.helpers));
            if (isPromise(roots[0])) {
              return Promise.all(roots);
            }
            return roots;
          }
          return plugin.Once(this.result.root, this.helpers);
        } else if (typeof plugin === "function") {
          return plugin(this.result.root, this.result);
        }
      } catch (error) {
        throw this.handleError(error);
      }
    }
    stringify() {
      if (this.error)
        throw this.error;
      if (this.stringified)
        return this.result;
      this.stringified = true;
      this.sync();
      let opts = this.result.opts;
      let str = stringify;
      if (opts.syntax)
        str = opts.syntax.stringify;
      if (opts.stringifier)
        str = opts.stringifier;
      if (str.stringify)
        str = str.stringify;
      let rootSource = this.result.root.source;
      if (opts.map === undefined && !(rootSource && rootSource.input && rootSource.input.map)) {
        let result = "";
        str(this.result.root, (i) => {
          result += i;
        });
        this.result.css = result;
        return this.result;
      }
      let map = new MapGenerator(str, this.result.root, this.result.opts);
      let data = map.generate();
      this.result.css = data[0];
      this.result.map = data[1];
      return this.result;
    }
    sync() {
      if (this.error)
        throw this.error;
      if (this.processed)
        return this.result;
      this.processed = true;
      if (this.processing) {
        throw this.getAsyncError();
      }
      for (let plugin of this.plugins) {
        let promise = this.runOnRoot(plugin);
        if (isPromise(promise)) {
          throw this.getAsyncError();
        }
      }
      this.prepareVisitors();
      if (this.hasListener) {
        let root = this.result.root;
        while (!root[isClean]) {
          root[isClean] = true;
          this.walkSync(root);
        }
        if (this.listeners.OnceExit) {
          if (root.type === "document") {
            for (let subRoot of root.nodes) {
              this.visitSync(this.listeners.OnceExit, subRoot);
            }
          } else {
            this.visitSync(this.listeners.OnceExit, root);
          }
        }
      }
      return this.result;
    }
    then(onFulfilled, onRejected) {
      if (true) {
        if (!("from" in this.opts)) {
          warnOnce("Without `from` option PostCSS could generate wrong source map " + "and will not find Browserslist config. Set it to CSS file path " + "or to `undefined` to prevent this warning.");
        }
      }
      return this.async().then(onFulfilled, onRejected);
    }
    toString() {
      return this.css;
    }
    visitSync(visitors, node) {
      for (let [plugin, visitor] of visitors) {
        this.result.lastPlugin = plugin;
        let promise;
        try {
          promise = visitor(node, this.helpers);
        } catch (e) {
          throw this.handleError(e, node.proxyOf);
        }
        if (node.type !== "root" && node.type !== "document" && !node.parent) {
          return true;
        }
        if (isPromise(promise)) {
          throw this.getAsyncError();
        }
      }
    }
    visitTick(stack) {
      let visit = stack[stack.length - 1];
      let { node, visitors } = visit;
      if (node.type !== "root" && node.type !== "document" && !node.parent) {
        stack.pop();
        return;
      }
      if (visitors.length > 0 && visit.visitorIndex < visitors.length) {
        let [plugin, visitor] = visitors[visit.visitorIndex];
        visit.visitorIndex += 1;
        if (visit.visitorIndex === visitors.length) {
          visit.visitors = [];
          visit.visitorIndex = 0;
        }
        this.result.lastPlugin = plugin;
        try {
          return visitor(node.toProxy(), this.helpers);
        } catch (e) {
          throw this.handleError(e, node);
        }
      }
      if (visit.iterator !== 0) {
        let iterator = visit.iterator;
        if (visit.descending) {
          visit.descending = false;
          node.indexes[iterator] += 1;
        }
        let child;
        while (child = node.nodes[node.indexes[iterator]]) {
          if (!child[isClean]) {
            child[isClean] = true;
            visit.descending = true;
            stack.push(toStack(child));
            return;
          }
          node.indexes[iterator] += 1;
        }
        visit.iterator = 0;
        delete node.indexes[iterator];
      }
      let events = visit.events;
      while (visit.eventIndex < events.length) {
        let event = events[visit.eventIndex];
        visit.eventIndex += 1;
        if (event === CHILDREN) {
          if (node.nodes && node.nodes.length) {
            node[isClean] = true;
            visit.iterator = node.getIterator();
          }
          return;
        } else if (this.listeners[event]) {
          visit.visitors = this.listeners[event];
          return;
        }
      }
      stack.pop();
    }
    walkSync(node) {
      node[isClean] = true;
      let stack = [{ eventIndex: 0, events: getEvents(node), iterator: 0, node }];
      while (stack.length > 0) {
        let visit = stack[stack.length - 1];
        let visitNode = visit.node;
        if (visit.iterator !== 0) {
          let iterator = visit.iterator;
          if (visit.descending) {
            visit.descending = false;
            visitNode.indexes[iterator] += 1;
          }
          let child;
          let descended = false;
          while (child = visitNode.nodes[visitNode.indexes[iterator]]) {
            if (!child[isClean]) {
              child[isClean] = true;
              visit.descending = true;
              stack.push({
                eventIndex: 0,
                events: getEvents(child),
                iterator: 0,
                node: child
              });
              descended = true;
              break;
            }
            visitNode.indexes[iterator] += 1;
          }
          if (descended)
            continue;
          visit.iterator = 0;
          delete visitNode.indexes[iterator];
        }
        if (visit.eventIndex < visit.events.length) {
          let event = visit.events[visit.eventIndex];
          visit.eventIndex += 1;
          if (event === CHILDREN) {
            if (visitNode.nodes && visitNode.nodes.length) {
              visit.iterator = visitNode.getIterator();
            }
          } else {
            let visitors = this.listeners[event];
            if (visitors) {
              if (this.visitSync(visitors, visitNode.toProxy()))
                stack.pop();
            }
          }
          continue;
        }
        stack.pop();
      }
    }
    warnings() {
      return this.sync().warnings();
    }
  }
  LazyResult.registerPostcss = (dependant) => {
    postcss = dependant;
  };
  module.exports = LazyResult;
  LazyResult.default = LazyResult;
  Root.registerLazyResult(LazyResult);
  Document.registerLazyResult(LazyResult);
});

// node_modules/postcss/lib/no-work-result.js
var require_no_work_result = __commonJS(function(exports, module) {
  var MapGenerator = require_map_generator();
  var parse = require_parse();
  var Result = require_result();
  var stringify = require_stringify();
  var warnOnce = require_warn_once();

  class NoWorkResult {
    get content() {
      return this.result.css;
    }
    get css() {
      return this.result.css;
    }
    get map() {
      return this.result.map;
    }
    get messages() {
      return [];
    }
    get opts() {
      return this.result.opts;
    }
    get processor() {
      return this.result.processor;
    }
    get root() {
      if (this._root) {
        return this._root;
      }
      let root;
      let parser = parse;
      try {
        root = parser(this._css, this._opts);
      } catch (error) {
        this.error = error;
      }
      if (this.error) {
        throw this.error;
      } else {
        this._root = root;
        return root;
      }
    }
    get [Symbol.toStringTag]() {
      return "NoWorkResult";
    }
    constructor(processor, css, opts) {
      css = css.toString();
      this.stringified = false;
      this._processor = processor;
      this._css = css;
      this._opts = opts;
      this._map = undefined;
      let str = stringify;
      this.result = new Result(this._processor, undefined, this._opts);
      this.result.css = css;
      let self2 = this;
      Object.defineProperty(this.result, "root", {
        get() {
          return self2.root;
        }
      });
      let map = new MapGenerator(str, undefined, this._opts, css);
      if (map.isMap()) {
        let [generatedCSS, generatedMap] = map.generate();
        if (generatedCSS) {
          this.result.css = generatedCSS;
        }
        if (generatedMap) {
          this.result.map = generatedMap;
        }
      } else {
        map.clearAnnotation();
        this.result.css = map.css;
      }
    }
    async() {
      if (this.error)
        return Promise.reject(this.error);
      return Promise.resolve(this.result);
    }
    catch(onRejected) {
      return this.async().catch(onRejected);
    }
    finally(onFinally) {
      return this.async().then(onFinally, onFinally);
    }
    sync() {
      if (this.error)
        throw this.error;
      return this.result;
    }
    then(onFulfilled, onRejected) {
      if (true) {
        if (!("from" in this._opts)) {
          warnOnce("Without `from` option PostCSS could generate wrong source map " + "and will not find Browserslist config. Set it to CSS file path " + "or to `undefined` to prevent this warning.");
        }
      }
      return this.async().then(onFulfilled, onRejected);
    }
    toString() {
      return this._css;
    }
    warnings() {
      return [];
    }
  }
  module.exports = NoWorkResult;
  NoWorkResult.default = NoWorkResult;
});

// node_modules/postcss/lib/processor.js
var require_processor = __commonJS(function(exports, module) {
  var Document = require_document();
  var LazyResult = require_lazy_result();
  var NoWorkResult = require_no_work_result();
  var Root = require_root();

  class Processor {
    constructor(plugins = []) {
      this.version = "8.5.31";
      this.plugins = this.normalize(plugins);
    }
    normalize(plugins) {
      let normalized = [];
      for (let i of plugins) {
        if (i.postcss === true) {
          i = i();
        } else if (i.postcss) {
          i = i.postcss;
        }
        if (typeof i === "object" && Array.isArray(i.plugins)) {
          normalized = normalized.concat(i.plugins);
        } else if (typeof i === "object" && i.postcssPlugin) {
          normalized.push(i);
        } else if (typeof i === "function") {
          normalized.push(i);
        } else if (typeof i === "object" && (i.parse || i.stringify)) {
          if (true) {
            throw new Error("PostCSS syntaxes cannot be used as plugins. Instead, please use " + "one of the syntax/parser/stringifier options as outlined " + "in your PostCSS runner documentation.");
          }
        } else {
          throw new Error(i + " is not a PostCSS plugin");
        }
      }
      return normalized;
    }
    process(css, opts = {}) {
      if (!this.plugins.length && !opts.parser && !opts.stringifier && !opts.syntax) {
        return new NoWorkResult(this, css, opts);
      } else {
        return new LazyResult(this, css, opts);
      }
    }
    use(plugin) {
      this.plugins = this.plugins.concat(this.normalize([plugin]));
      return this;
    }
  }
  module.exports = Processor;
  Processor.default = Processor;
  Root.registerProcessor(Processor);
  Document.registerProcessor(Processor);
});

// node_modules/postcss/lib/postcss.js
var require_postcss = __commonJS(function(exports, module) {
  var AtRule = require_at_rule();
  var Comment = require_comment();
  var Container = require_container();
  var CssSyntaxError = require_css_syntax_error();
  var Declaration = require_declaration();
  var Document = require_document();
  var fromJSON = require_fromJSON();
  var Input = require_input();
  var LazyResult = require_lazy_result();
  var list = require_list();
  var Node2 = require_node();
  var parse = require_parse();
  var Processor = require_processor();
  var Result = require_result();
  var Root = require_root();
  var Rule = require_rule();
  var stringify = require_stringify();
  var Warning = require_warning();
  function postcss(...plugins) {
    if (plugins.length === 1 && Array.isArray(plugins[0])) {
      plugins = plugins[0];
    }
    return new Processor(plugins);
  }
  postcss.plugin = function plugin(name, initializer) {
    let warningPrinted = false;
    function creator(...args) {
      if (console && console.warn && !warningPrinted) {
        warningPrinted = true;
        console.warn(name + `: postcss.plugin was deprecated. Migration guide:
` + "https://evilmartians.com/chronicles/postcss-8-plugin-migration");
        if (process.env.LANG && process.env.LANG.startsWith("zh")) {
          console.warn(name + `: 里面 postcss.plugin 被弃用. 迁移指南:
` + "https://www.w3ctech.com/topic/2226");
        }
      }
      let transformer = initializer(...args);
      transformer.postcssPlugin = name;
      transformer.postcssVersion = new Processor().version;
      return transformer;
    }
    let cache;
    Object.defineProperty(creator, "postcss", {
      get() {
        if (!cache)
          cache = creator();
        return cache;
      }
    });
    creator.process = function(css, processOpts, pluginOpts) {
      return postcss([creator(pluginOpts)]).process(css, processOpts);
    };
    return creator;
  };
  postcss.stringify = stringify;
  postcss.parse = parse;
  postcss.fromJSON = fromJSON;
  postcss.list = list;
  postcss.comment = (defaults) => new Comment(defaults);
  postcss.atRule = (defaults) => new AtRule(defaults);
  postcss.decl = (defaults) => new Declaration(defaults);
  postcss.rule = (defaults) => new Rule(defaults);
  postcss.root = (defaults) => new Root(defaults);
  postcss.document = (defaults) => new Document(defaults);
  postcss.CssSyntaxError = CssSyntaxError;
  postcss.Declaration = Declaration;
  postcss.Container = Container;
  postcss.Processor = Processor;
  postcss.Document = Document;
  postcss.Comment = Comment;
  postcss.Warning = Warning;
  postcss.AtRule = AtRule;
  postcss.Result = Result;
  postcss.Input = Input;
  postcss.Rule = Rule;
  postcss.Root = Root;
  postcss.Node = Node2;
  LazyResult.registerPostcss(postcss);
  module.exports = postcss;
  postcss.default = postcss;
});

// node_modules/dayjs/dayjs.min.js
var require_dayjs_min = __commonJS(function(exports, module) {
  (function(t, e) {
    typeof exports == "object" && typeof module != "undefined" ? module.exports = e() : typeof define == "function" && define.amd ? define(e) : (t = typeof globalThis != "undefined" ? globalThis : t || self).dayjs = e();
  })(exports, function() {
    var t = 1000, e = 60000, n = 3600000, r = "millisecond", i = "second", s = "minute", u = "hour", a = "day", o = "week", c = "month", f = "quarter", h = "year", d = "date", l = "Invalid Date", $ = /^(\d{4})[-/]?(\d{1,2})?[-/]?(\d{0,2})[Tt\s]*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?[.:]?(\d+)?$/, y = /\[([^\]]+)]|YYYY|YY|M{1,4}|D{1,2}|d{1,4}|H{1,2}|h{1,2}|a|A|m{1,2}|s{1,2}|Z{1,2}|SSS/g, M = { name: "en", weekdays: "Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split("_"), months: "January_February_March_April_May_June_July_August_September_October_November_December".split("_"), ordinal: function(t) {
      var e = ["th", "st", "nd", "rd"], n = t % 100;
      return "[" + t + (e[(n - 20) % 10] || e[n] || e[0]) + "]";
    } }, m = function(t, e, n) {
      var r = String(t);
      return !r || r.length >= e ? t : "" + Array(e + 1 - r.length).join(n) + t;
    }, v = { s: m, z: function(t) {
      var e = -t.utcOffset(), n = Math.abs(e), r = Math.floor(n / 60), i = n % 60;
      return (e <= 0 ? "+" : "-") + m(r, 2, "0") + ":" + m(i, 2, "0");
    }, m: function t(e, n) {
      if (e.date() < n.date())
        return -t(n, e);
      var r = 12 * (n.year() - e.year()) + (n.month() - e.month()), i = e.clone().add(r, c), s = n - i < 0, u = e.clone().add(r + (s ? -1 : 1), c);
      return +(-(r + (n - i) / (s ? i - u : u - i)) || 0);
    }, a: function(t) {
      return t < 0 ? Math.ceil(t) || 0 : Math.floor(t);
    }, p: function(t) {
      return { M: c, y: h, w: o, d: a, D: d, h: u, m: s, s: i, ms: r, Q: f }[t] || String(t || "").toLowerCase().replace(/s$/, "");
    }, u: function(t) {
      return t === undefined;
    } }, g = "en", D = {};
    D[g] = M;
    var p = "$isDayjsObject", S = function(t) {
      return t instanceof _ || !(!t || !t[p]);
    }, w = function t(e, n, r) {
      var i;
      if (!e)
        return g;
      if (typeof e == "string") {
        var s = e.toLowerCase();
        D[s] && (i = s), n && (D[s] = n, i = s);
        var u = e.split("-");
        if (!i && u.length > 1)
          return t(u[0]);
      } else {
        var a = e.name;
        D[a] = e, i = a;
      }
      return !r && i && (g = i), i || !r && g;
    }, O = function(t, e) {
      if (S(t))
        return t.clone();
      var n = typeof e == "object" ? e : {};
      return n.date = t, n.args = arguments, new _(n);
    }, b = v;
    b.l = w, b.i = S, b.w = function(t, e) {
      return O(t, { locale: e.$L, utc: e.$u, x: e.$x, $offset: e.$offset });
    };
    var _ = function() {
      function M(t) {
        this.$L = w(t.locale, null, true), this.parse(t), this.$x = this.$x || t.x || {}, this[p] = true;
      }
      var m = M.prototype;
      return m.parse = function(t) {
        this.$d = function(t) {
          var { date: e, utc: n } = t;
          if (e === null)
            return new Date(NaN);
          if (b.u(e))
            return new Date;
          if (e instanceof Date)
            return new Date(e);
          if (typeof e == "string" && !/Z$/i.test(e)) {
            var r = e.match($);
            if (r) {
              var i = r[2] - 1 || 0, s = (r[7] || "0").substring(0, 3);
              return n ? new Date(Date.UTC(r[1], i, r[3] || 1, r[4] || 0, r[5] || 0, r[6] || 0, s)) : new Date(r[1], i, r[3] || 1, r[4] || 0, r[5] || 0, r[6] || 0, s);
            }
          }
          return new Date(e);
        }(t), this.init();
      }, m.init = function() {
        var t = this.$d;
        this.$y = t.getFullYear(), this.$M = t.getMonth(), this.$D = t.getDate(), this.$W = t.getDay(), this.$H = t.getHours(), this.$m = t.getMinutes(), this.$s = t.getSeconds(), this.$ms = t.getMilliseconds();
      }, m.$utils = function() {
        return b;
      }, m.isValid = function() {
        return !(this.$d.toString() === l);
      }, m.isSame = function(t, e) {
        var n = O(t);
        return this.startOf(e) <= n && n <= this.endOf(e);
      }, m.isAfter = function(t, e) {
        return O(t) < this.startOf(e);
      }, m.isBefore = function(t, e) {
        return this.endOf(e) < O(t);
      }, m.$g = function(t, e, n) {
        return b.u(t) ? this[e] : this.set(n, t);
      }, m.unix = function() {
        return Math.floor(this.valueOf() / 1000);
      }, m.valueOf = function() {
        return this.$d.getTime();
      }, m.startOf = function(t, e) {
        var n = this, r = !!b.u(e) || e, f = b.p(t), l = function(t, e) {
          var i = b.w(n.$u ? Date.UTC(n.$y, e, t) : new Date(n.$y, e, t), n);
          return r ? i : i.endOf(a);
        }, $ = function(t, e) {
          return b.w(n.toDate()[t].apply(n.toDate("s"), (r ? [0, 0, 0, 0] : [23, 59, 59, 999]).slice(e)), n);
        }, y = this.$W, M = this.$M, m = this.$D, v = "set" + (this.$u ? "UTC" : "");
        switch (f) {
          case h:
            return r ? l(1, 0) : l(31, 11);
          case c:
            return r ? l(1, M) : l(0, M + 1);
          case o:
            var g = this.$locale().weekStart || 0, D = (y < g ? y + 7 : y) - g;
            return l(r ? m - D : m + (6 - D), M);
          case a:
          case d:
            return $(v + "Hours", 0);
          case u:
            return $(v + "Minutes", 1);
          case s:
            return $(v + "Seconds", 2);
          case i:
            return $(v + "Milliseconds", 3);
          default:
            return this.clone();
        }
      }, m.endOf = function(t) {
        return this.startOf(t, false);
      }, m.$set = function(t, e) {
        var n, o = b.p(t), f = "set" + (this.$u ? "UTC" : ""), l = (n = {}, n[a] = f + "Date", n[d] = f + "Date", n[c] = f + "Month", n[h] = f + "FullYear", n[u] = f + "Hours", n[s] = f + "Minutes", n[i] = f + "Seconds", n[r] = f + "Milliseconds", n)[o], $ = o === a ? this.$D + (e - this.$W) : e;
        if (o === c || o === h) {
          var y = this.clone().set(d, 1);
          y.$d[l]($), y.init(), this.$d = y.set(d, Math.min(this.$D, y.daysInMonth())).$d;
        } else
          l && this.$d[l]($);
        return this.init(), this;
      }, m.set = function(t, e) {
        return this.clone().$set(t, e);
      }, m.get = function(t) {
        return this[b.p(t)]();
      }, m.add = function(r, f) {
        var d, l = this;
        r = Number(r);
        var $ = b.p(f), y = function(t) {
          var e = O(l);
          return b.w(e.date(e.date() + Math.round(t * r)), l);
        };
        if ($ === c)
          return this.set(c, this.$M + r);
        if ($ === h)
          return this.set(h, this.$y + r);
        if ($ === a)
          return y(1);
        if ($ === o)
          return y(7);
        var M = (d = {}, d[s] = e, d[u] = n, d[i] = t, d)[$] || 1, m = this.$d.getTime() + r * M;
        return b.w(m, this);
      }, m.subtract = function(t, e) {
        return this.add(-1 * t, e);
      }, m.format = function(t) {
        var e = this, n = this.$locale();
        if (!this.isValid())
          return n.invalidDate || l;
        var r = t || "YYYY-MM-DDTHH:mm:ssZ", i = b.z(this), s = this.$H, u = this.$m, a = this.$M, { weekdays: o, months: c, meridiem: f } = n, h = function(t, n, i, s) {
          return t && (t[n] || t(e, r)) || i[n].slice(0, s);
        }, d = function(t) {
          return b.s(s % 12 || 12, t, "0");
        }, $ = f || function(t, e, n) {
          var r = t < 12 ? "AM" : "PM";
          return n ? r.toLowerCase() : r;
        };
        return r.replace(y, function(t, r) {
          return r || function(t) {
            switch (t) {
              case "YY":
                return String(e.$y).slice(-2);
              case "YYYY":
                return b.s(e.$y, 4, "0");
              case "M":
                return a + 1;
              case "MM":
                return b.s(a + 1, 2, "0");
              case "MMM":
                return h(n.monthsShort, a, c, 3);
              case "MMMM":
                return h(c, a);
              case "D":
                return e.$D;
              case "DD":
                return b.s(e.$D, 2, "0");
              case "d":
                return String(e.$W);
              case "dd":
                return h(n.weekdaysMin, e.$W, o, 2);
              case "ddd":
                return h(n.weekdaysShort, e.$W, o, 3);
              case "dddd":
                return o[e.$W];
              case "H":
                return String(s);
              case "HH":
                return b.s(s, 2, "0");
              case "h":
                return d(1);
              case "hh":
                return d(2);
              case "a":
                return $(s, u, true);
              case "A":
                return $(s, u, false);
              case "m":
                return String(u);
              case "mm":
                return b.s(u, 2, "0");
              case "s":
                return String(e.$s);
              case "ss":
                return b.s(e.$s, 2, "0");
              case "SSS":
                return b.s(e.$ms, 3, "0");
              case "Z":
                return i;
            }
            return null;
          }(t) || i.replace(":", "");
        });
      }, m.utcOffset = function() {
        return 15 * -Math.round(this.$d.getTimezoneOffset() / 15);
      }, m.diff = function(r, d, l) {
        var $, y = this, M = b.p(d), m = O(r), v = (m.utcOffset() - this.utcOffset()) * e, g = this - m, D = function() {
          return b.m(y, m);
        };
        switch (M) {
          case h:
            $ = D() / 12;
            break;
          case c:
            $ = D();
            break;
          case f:
            $ = D() / 3;
            break;
          case o:
            $ = (g - v) / 604800000;
            break;
          case a:
            $ = (g - v) / 86400000;
            break;
          case u:
            $ = g / n;
            break;
          case s:
            $ = g / e;
            break;
          case i:
            $ = g / t;
            break;
          default:
            $ = g;
        }
        return l ? $ : b.a($);
      }, m.daysInMonth = function() {
        return this.endOf(c).$D;
      }, m.$locale = function() {
        return D[this.$L];
      }, m.locale = function(t, e) {
        if (!t)
          return this.$L;
        var n = this.clone(), r = w(t, e, true);
        return r && (n.$L = r), n;
      }, m.clone = function() {
        return b.w(this.$d, this);
      }, m.toDate = function() {
        return new Date(this.valueOf());
      }, m.toJSON = function() {
        return this.isValid() ? this.toISOString() : null;
      }, m.toISOString = function() {
        return this.$d.toISOString();
      }, m.toString = function() {
        return this.$d.toUTCString();
      }, M;
    }(), Y = _.prototype;
    return O.prototype = Y, [["$ms", r], ["$s", i], ["$m", s], ["$H", u], ["$W", a], ["$M", c], ["$y", h], ["$D", d]].forEach(function(t) {
      Y[t[1]] = function(e) {
        return this.$g(e, t[0], t[1]);
      };
    }), O.extend = function(t, e) {
      return t.$i || (t(e, _, O), t.$i = true), O;
    }, O.locale = w, O.isDayjs = S, O.unix = function(t) {
      return O(1000 * t);
    }, O.en = D[g], O.Ls = D, O.p = {}, O;
  });
});

// node_modules/launder/index.js
var require_launder = __commonJS(function(exports, module) {
  var dayjs = require_dayjs_min();
  function cleanHref(href) {
    href = href.replace(/[\x00-\x20]+/g, "");
    while (true) {
      const firstIndex = href.indexOf("<!--");
      if (firstIndex === -1) {
        break;
      }
      const lastIndex = href.indexOf("-->", firstIndex + 4);
      if (lastIndex === -1) {
        break;
      }
      href = href.substring(0, firstIndex) + href.substring(lastIndex + 3);
    }
    return href;
  }
  function naughtyHref(href, options) {
    options = options || {};
    const allowedSchemes = options.allowedSchemes || ["http", "https", "ftp", "mailto", "tel", "sms"];
    const allowProtocolRelative = options.allowProtocolRelative !== false;
    if (typeof href !== "string") {
      return false;
    }
    href = cleanHref(href);
    const matches = href.match(/^([a-zA-Z][a-zA-Z0-9.\-+]*):/);
    if (!matches) {
      if (href.match(/^[/\\]{2}/)) {
        return !allowProtocolRelative;
      }
      return false;
    }
    const scheme = matches[1].toLowerCase();
    return allowedSchemes.indexOf(scheme) === -1;
  }
  module.exports = function(options) {
    const self2 = {};
    self2.options = options || {};
    self2.filterTag = self2.options.filterTag || function(tag) {
      tag = tag.trim();
      return tag.toLowerCase();
    };
    self2.string = function(s, def) {
      if (typeof s !== "string") {
        if (typeof s === "number" || typeof s === "boolean") {
          s += "";
        } else {
          s = "";
        }
      }
      s = s.trim();
      if (def !== undefined) {
        if (s === "") {
          s = def;
        }
      }
      return s;
    };
    self2.strings = function(strings) {
      if (!Array.isArray(strings)) {
        return [];
      }
      return strings.map(function(s) {
        return self2.string(s);
      });
    };
    self2.integer = function(i, def, min, max) {
      if (def === undefined) {
        def = 0;
      }
      if (typeof i === "number") {
        i = Math.floor(i);
      } else {
        try {
          i = parseInt(i, 10);
          if (isNaN(i)) {
            i = def;
          }
        } catch (e) {
          i = def;
        }
      }
      if (typeof min === "number" && i < min) {
        i = min;
      }
      if (typeof max === "number" && i > max) {
        i = max;
      }
      return i;
    };
    self2.padInteger = function(i, places) {
      let s = i + "";
      while (s.length < places) {
        s = "0" + s;
      }
      return s;
    };
    self2.float = function(i, def, min, max) {
      if (def === undefined) {
        def = 0;
      }
      if (!(typeof i === "number")) {
        try {
          i = parseFloat(i, 10);
          if (isNaN(i)) {
            i = def;
          }
        } catch (e) {
          i = def;
        }
      }
      if (typeof min === "number" && i < min) {
        i = min;
      }
      if (typeof max === "number" && i > max) {
        i = max;
      }
      return i;
    };
    self2.naughtyHref = naughtyHref;
    self2.url = function(s, def, httpsFix) {
      s = self2.string(s, def);
      if (s === def) {
        return s;
      }
      s = cleanHref(s);
      if (naughtyHref(s)) {
        return def;
      }
      s = fixUrl(s);
      if (s === null) {
        return def;
      }
      return s;
      function fixUrl(href) {
        if (href.match(/^(((https?|ftp):\/\/)|((mailto|tel|sms):)|#|([^/.]+)?\/|[^/.]+$)/)) {
          return href;
        } else if (href.match(/^[^/.]+\.[^/.]+/)) {
          const protocol = httpsFix ? "https://" : "http://";
          return protocol + href;
        } else {
          return null;
        }
      }
    };
    self2.select = function(s, choices, def) {
      s = self2.string(s);
      if (!choices || !choices.length) {
        return def;
      }
      let choice;
      if (typeof choices[0] === "object") {
        choice = choices.find(function(choice) {
          if (choice.value === null || choice.value === undefined) {
            return false;
          }
          return choice.value.toString() === s;
        });
        if (choice != null) {
          return choice.value;
        }
        return def;
      }
      choice = choices.find(function(choice) {
        if (choice === null || choice === undefined) {
          return false;
        }
        return choice.toString() === s;
      });
      if (choice !== undefined) {
        return choice;
      }
      return def;
    };
    self2.boolean = function(b, def) {
      if (b === true) {
        return true;
      }
      if (b === false) {
        return false;
      }
      b = self2.string(b, def);
      if (b === def) {
        if (b === undefined) {
          return false;
        }
        return b;
      }
      b = b.toLowerCase().charAt(0);
      if (b === "" || b === "n" || b === "0" || b === "f") {
        return false;
      }
      if (b === "t" || b === "y" || b === "1") {
        return true;
      }
      return false;
    };
    self2.addBooleanFilterToCriteria = function(options, name, criteria, def) {
      if (def === undefined) {
        def = null;
      }
      let value = typeof options === "object" && options !== null ? options[name] : options;
      value = value === undefined ? def : value;
      value = self2.booleanOrNull(value);
      if (value === null) {} else if (!value) {
        criteria[name] = { $ne: true };
      } else {
        criteria[name] = true;
      }
    };
    self2.booleanOrNull = function(b, def) {
      if (b === true) {
        return b;
      }
      if (b === false) {
        return b;
      }
      if (b === null) {
        return b;
      }
      b = self2.string(b, def);
      if (b === def) {
        if (def === undefined) {
          return null;
        }
        return b;
      }
      if (b === "null") {
        return null;
      }
      b = b.toLowerCase().charAt(0);
      if (b === "" || b === "n" || b === "0" || b === "f") {
        return false;
      }
      if (b === "t" || b === "y" || b === "1") {
        return true;
      }
      if (b === "a") {
        return null;
      }
      return def;
    };
    self2.date = function(date, def, now) {
      let components;
      function returnDefault() {
        if (def === undefined) {
          def = dayjs().format("YYYY-MM-DD");
        }
        return def;
      }
      if (typeof date === "string") {
        if (date.match(/\//)) {
          components = date.split("/");
          if (components.length === 2) {
            return (now || new Date).getFullYear() + "-" + self2.padInteger(components[0], 2) + "-" + self2.padInteger(components[1], 2);
          } else if (components.length === 3) {
            if (components[2] < 100) {
              const d = now || new Date;
              const nowYear = d.getFullYear() % 100;
              const nowCentury = d.getFullYear() - nowYear;
              let theirYear = parseInt(components[2]) + nowCentury;
              if (theirYear - d.getFullYear() > 50) {
                theirYear -= 100;
              }
              components[2] = theirYear;
            }
            return self2.padInteger(components[2], 4) + "-" + self2.padInteger(components[0], 2) + "-" + self2.padInteger(components[1], 2);
          } else {
            return returnDefault();
          }
        } else if (date.match(/-/)) {
          components = date.split("-");
          if (components.length === 2) {
            return (now || new Date).getFullYear() + "-" + self2.padInteger(components[0], 2) + "-" + self2.padInteger(components[1], 2);
          } else if (components.length === 3) {
            return self2.padInteger(components[0], 4) + "-" + self2.padInteger(components[1], 2) + "-" + self2.padInteger(components[2], 2);
          } else {
            return returnDefault();
          }
        }
      }
      try {
        if (date === null) {
          return returnDefault();
        }
        date = now || new Date(date);
        if (isNaN(date.getTime())) {
          return returnDefault();
        }
        return date.getFullYear() + "-" + self2.padInteger(date.getMonth() + 1, 2) + "-" + self2.padInteger(date.getDate(), 2);
      } catch (e) {
        return returnDefault();
      }
    };
    self2.formatDate = function(date) {
      return dayjs(date).format("YYYY-MM-DD");
    };
    self2.time = function(time, def) {
      time = self2.string(time).toLowerCase();
      time = time.trim();
      const components = time.match(/^(\d+)([:|.](\d+))?([:|.](\d+))?\s*(am|pm|AM|PM|a|p|A|M)?$/);
      if (components) {
        let hours = parseInt(components[1], 10);
        const minutes = components[3] !== undefined ? parseInt(components[3], 10) : 0;
        const seconds = components[5] !== undefined ? parseInt(components[5], 10) : 0;
        let ampm = components[6] ? components[6].toLowerCase() : components[6];
        ampm = ampm && ampm.charAt(0);
        if (hours === 12 && ampm === "a") {
          hours -= 12;
        } else if (hours === 12 && ampm === "p") {} else if (ampm === "p") {
          hours += 12;
        }
        if (hours === 24 || hours === "24") {
          hours = 0;
        }
        return self2.padInteger(hours, 2) + ":" + self2.padInteger(minutes, 2) + ":" + self2.padInteger(seconds, 2);
      } else {
        if (def !== undefined) {
          return def;
        }
        return dayjs().format("HH:mm");
      }
    };
    self2.formatTime = function(date) {
      return dayjs(date).format("HH:mm:ss");
    };
    self2.tags = function(tags, filter) {
      if (typeof tags === "string") {
        tags = tags.split(/,\s*/);
      }
      if (!Array.isArray(tags)) {
        return [];
      }
      const strings = tags.map((tag) => self2.string(tag));
      const rewritten = strings.map(filter || self2.filterTag);
      const filtered = rewritten.filter((tag) => tag.length > 0);
      return filtered;
    };
    self2.idRegExp = self2.options.idRegExp || /^[A-Za-z0-9_]+$/;
    self2.id = function(s, def) {
      const id = self2.string(s, def);
      if (id === def) {
        return id;
      }
      if (!id.match(self2.idRegExp)) {
        return def;
      }
      return id;
    };
    self2.ids = function(ids) {
      if (!Array.isArray(ids)) {
        return [];
      }
      const result = ids.filter(function(id) {
        return self2.id(id) !== undefined;
      });
      return result;
    };
    return self2;
  };
  module.exports.naughtyHref = naughtyHref;
});

// node_modules/sanitize-html/index.js
var require_sanitize_html = __commonJS(function(exports, module) {
  var htmlparser = (init_dist4(), {});
  var escapeStringRegexp = require_escape_string_regexp();
  var { isPlainObject } = require_is_plain_object();
  var parseSrcset = require_parse_srcset();
  var { parse: postcssParse } = require_postcss();
  var { naughtyHref: launderNaughtyHref } = require_launder();
  var mediaTags = [
    "img",
    "audio",
    "video",
    "picture",
    "svg",
    "object",
    "map",
    "iframe",
    "embed"
  ];
  var vulnerableTags = ["script", "style"];
  var svgAnimationTags = [
    "animate",
    "animatecolor",
    "animatemotion",
    "animatetransform",
    "set"
  ];
  var alwaysUrlAttributes = ["href"];
  var severities = ["debug", "info", "warn", "error"];
  function loggerFor(options) {
    const source = options && options.logger || console;
    const logger = {};
    for (const severity of severities) {
      logger[severity] = typeof source[severity] === "function" ? (...args) => source[severity](...args) : (...args) => console[severity](...args);
    }
    return logger;
  }
  function each(obj, cb) {
    if (obj) {
      Object.keys(obj).forEach(function(key) {
        cb(obj[key], key);
      });
    }
  }
  function has(obj, key) {
    return {}.hasOwnProperty.call(obj, key);
  }
  function mergeClasses(specific, wildcard) {
    if (!Array.isArray(specific) || !Array.isArray(wildcard)) {
      return wildcard;
    }
    return specific.concat(wildcard);
  }
  function mergeStyles(specific, wildcard) {
    const merged = Object.create(null);
    for (const rules of [specific, wildcard]) {
      for (const prop of Object.keys(rules)) {
        merged[prop] = has(merged, prop) ? merged[prop].concat(rules[prop]) : rules[prop];
      }
    }
    return merged;
  }
  function filter(a, cb) {
    const n = [];
    each(a, function(v) {
      if (cb(v)) {
        n.push(v);
      }
    });
    return n;
  }
  function isEmptyObject(obj) {
    for (const key in obj) {
      if (has(obj, key)) {
        return false;
      }
    }
    return true;
  }
  function stringifySrcset(parsedSrcset) {
    return parsedSrcset.map(function(part) {
      if (!part.url) {
        throw new Error("URL missing");
      }
      return part.url + (part.w ? ` ${part.w}w` : "") + (part.h ? ` ${part.h}h` : "") + (part.d ? ` ${part.d}x` : "");
    }).join(", ");
  }
  module.exports = sanitizeHtml;
  var VALID_HTML_ATTRIBUTE_NAME = /^[^\0\t\n\f\r /<=>]+$/;
  var MAX_IFRAME_FALLBACK_DEPTH = 8;
  function sanitizeHtml(html, options, _fallback) {
    if (html == null) {
      return "";
    }
    const baseDepth = _fallback && _fallback.depth || 0;
    const iframeFallbackDepth = _fallback && _fallback.iframeFallbackDepth || 0;
    if (typeof html === "number") {
      html = html.toString();
    }
    let result = "";
    let tempResult = "";
    function Frame(tag, attribs) {
      const that = this;
      this.tag = tag;
      this.attribs = attribs || {};
      this.tagPosition = result.length;
      this.text = "";
      this.openingTagLength = 0;
      this.mediaChildren = [];
      this.updateParentNodeText = function() {
        if (stack.length) {
          const parentFrame = stack[stack.length - 1];
          parentFrame.text += that.text;
        }
      };
      this.updateParentNodeMediaChildren = function() {
        if (stack.length && mediaTags.includes(this.tag)) {
          const parentFrame = stack[stack.length - 1];
          parentFrame.mediaChildren.push(this.tag);
        }
      };
    }
    options = Object.assign({}, sanitizeHtml.defaults, options);
    options.parser = Object.assign({}, htmlParserDefaults, options.parser);
    const logger = loggerFor(options);
    const tagAllowed = function(name) {
      return options.allowedTags === false || (options.allowedTags || []).indexOf(name) > -1;
    };
    vulnerableTags.forEach(function(tag) {
      if (tagAllowed(tag) && !options.allowVulnerableTags) {
        logger.warn(`Your \`allowedTags\` option includes \`${tag}\`, which is inherently ` + "vulnerable to XSS attacks. Please remove it from `allowedTags`, or, " + "to disable this warning, add the `allowVulnerableTags` option and " + "ensure you are accounting for this risk.");
      }
    });
    const nonTextTagsArray = options.nonTextTags || [
      "script",
      "style",
      "textarea",
      "option",
      "xmp"
    ];
    let allowedAttributesMap;
    let allowedAttributesGlobMap;
    if (options.allowedAttributes) {
      allowedAttributesMap = {};
      allowedAttributesGlobMap = {};
      each(options.allowedAttributes, function(attributes, tag) {
        allowedAttributesMap[tag] = [];
        const globRegex = [];
        attributes.forEach(function(obj) {
          if (typeof obj === "string" && obj.indexOf("*") >= 0) {
            globRegex.push(escapeStringRegexp(obj).replace(/\\\*/g, ".*"));
          } else {
            allowedAttributesMap[tag].push(obj);
          }
        });
        if (globRegex.length) {
          allowedAttributesGlobMap[tag] = new RegExp("^(" + globRegex.join("|") + ")$");
        }
      });
    }
    const allowedClassesMap = {};
    const allowedClassesGlobMap = {};
    const allowedClassesRegexMap = {};
    each(options.allowedClasses, function(classes, tag) {
      if (allowedAttributesMap) {
        if (!has(allowedAttributesMap, tag)) {
          allowedAttributesMap[tag] = [];
        }
        allowedAttributesMap[tag].push("class");
      }
      allowedClassesMap[tag] = classes;
      if (Array.isArray(classes)) {
        const globRegex = [];
        allowedClassesMap[tag] = [];
        allowedClassesRegexMap[tag] = [];
        classes.forEach(function(obj) {
          if (typeof obj === "string" && obj.indexOf("*") >= 0) {
            globRegex.push(escapeStringRegexp(obj).replace(/\\\*/g, ".*"));
          } else if (obj instanceof RegExp) {
            allowedClassesRegexMap[tag].push(obj);
          } else {
            allowedClassesMap[tag].push(obj);
          }
        });
        if (globRegex.length) {
          allowedClassesGlobMap[tag] = new RegExp("^(" + globRegex.join("|") + ")$");
        }
      }
    });
    const transformTagsMap = {};
    let transformTagsAll;
    each(options.transformTags, function(transform, tag) {
      let transFun;
      if (typeof transform === "function") {
        transFun = transform;
      } else if (typeof transform === "string") {
        transFun = sanitizeHtml.simpleTransform(transform);
      }
      if (tag === "*") {
        transformTagsAll = transFun;
      } else {
        transformTagsMap[tag] = transFun;
      }
    });
    let depth;
    let stack;
    let skipMap;
    let transformMap;
    let skipText;
    let skipTextDepth;
    let rawTextEnd;
    let skipRawText;
    let addedText = false;
    initializeState();
    const parser = new Parser({
      onopentag: function(name, attribs) {
        if (options.onOpenTag) {
          options.onOpenTag(name, attribs);
        }
        updateRawTextRegion();
        if (options.enforceHtmlBoundary && name === "html") {
          initializeState();
        }
        if (skipRawText) {
          return;
        }
        if (skipText) {
          skipTextDepth++;
          return;
        }
        const frame = new Frame(name, attribs);
        stack.push(frame);
        let skip = false;
        const hasText = !!frame.text;
        let transformedTag;
        if (has(transformTagsMap, name)) {
          transformedTag = transformTagsMap[name](name, attribs);
          frame.attribs = attribs = transformedTag.attribs;
          if (transformedTag.text !== undefined) {
            frame.innerText = transformedTag.text;
          }
          if (name !== transformedTag.tagName) {
            frame.name = name = transformedTag.tagName;
            transformMap[depth] = transformedTag.tagName;
          }
        }
        if (transformTagsAll) {
          transformedTag = transformTagsAll(name, attribs);
          frame.attribs = attribs = transformedTag.attribs;
          if (name !== transformedTag.tagName) {
            frame.name = name = transformedTag.tagName;
            transformMap[depth] = transformedTag.tagName;
          }
        }
        if (!tagAllowed(name) || animatesUrlAttribute(name, attribs) || options.disallowedTagsMode === "recursiveEscape" && !isEmptyObject(skipMap) || options.nestingLimit != null && depth >= options.nestingLimit) {
          skip = true;
          skipMap[depth] = true;
          if (options.disallowedTagsMode === "discard" || options.disallowedTagsMode === "completelyDiscard") {
            if (nonTextTagsArray.indexOf(name) !== -1) {
              skipText = true;
              skipTextDepth = 1;
              if (frame.tag.toLowerCase() === "noscript") {
                rawTextEnd = findRawTextEnd("noscript", parser.endIndex + 1);
              }
            }
          }
        }
        depth++;
        if (skip) {
          if (options.disallowedTagsMode === "discard" || options.disallowedTagsMode === "completelyDiscard") {
            if (frame.innerText && !hasText) {
              const escaped = escapeHtml(frame.innerText);
              if (options.textFilter) {
                result += options.textFilter(escaped, name);
              } else {
                result += escaped;
              }
              addedText = true;
            }
            return;
          }
          tempResult = result;
          result = "";
        }
        result += "<" + name;
        if (name === "script") {
          if (options.allowedScriptHostnames || options.allowedScriptDomains) {
            frame.innerText = "";
          }
        }
        const isBeingEscaped = skip && (options.disallowedTagsMode === "escape" || options.disallowedTagsMode === "recursiveEscape");
        const shouldPreserveEscapedAttributes = isBeingEscaped && options.preserveEscapedAttributes;
        if (shouldPreserveEscapedAttributes) {
          each(attribs, function(value, a) {
            result += " " + a + '="' + escapeHtml(value || "", true) + '"';
          });
        } else if (!allowedAttributesMap || has(allowedAttributesMap, name) || allowedAttributesMap["*"]) {
          each(attribs, function(value, a) {
            if (!VALID_HTML_ATTRIBUTE_NAME.test(a)) {
              delete frame.attribs[a];
              return;
            }
            if (value === "" && !options.allowedEmptyAttributes.includes(a) && (options.nonBooleanAttributes.includes(a) || options.nonBooleanAttributes.includes("*"))) {
              delete frame.attribs[a];
              return;
            }
            let passedAllowedAttributesMapCheck = false;
            if (!allowedAttributesMap || has(allowedAttributesMap, name) && allowedAttributesMap[name].indexOf(a) !== -1 || allowedAttributesMap["*"] && allowedAttributesMap["*"].indexOf(a) !== -1 || has(allowedAttributesGlobMap, name) && allowedAttributesGlobMap[name].test(a) || allowedAttributesGlobMap["*"] && allowedAttributesGlobMap["*"].test(a)) {
              passedAllowedAttributesMapCheck = true;
            } else if (allowedAttributesMap && allowedAttributesMap[name]) {
              for (const o of allowedAttributesMap[name]) {
                if (isPlainObject(o) && o.name && o.name === a) {
                  passedAllowedAttributesMapCheck = true;
                  let newValue = "";
                  if (o.multiple === true) {
                    const splitStrArray = value.split(" ");
                    for (const s of splitStrArray) {
                      if (o.values.indexOf(s) !== -1) {
                        if (newValue === "") {
                          newValue = s;
                        } else {
                          newValue += " " + s;
                        }
                      }
                    }
                  } else if (o.values.indexOf(value) >= 0) {
                    newValue = value;
                  }
                  value = newValue;
                }
              }
            }
            if (passedAllowedAttributesMapCheck) {
              if (options.allowedSchemesAppliedToAttributes.indexOf(a) !== -1) {
                if (naughtyHref(name, value)) {
                  delete frame.attribs[a];
                  return;
                }
              }
              if (name === "meta" && a.toLowerCase() === "content" && isRefresh(attribs) && naughtyRefresh(value)) {
                delete frame.attribs[a];
                return;
              }
              if (name === "script" && a === "src") {
                let allowed = true;
                try {
                  const parsed = parseUrl(value);
                  if (options.allowedScriptHostnames || options.allowedScriptDomains) {
                    const allowedHostname = (options.allowedScriptHostnames || []).find(function(hostname) {
                      return hostname === parsed.url.hostname;
                    });
                    const allowedDomain = (options.allowedScriptDomains || []).find(function(domain) {
                      return parsed.url.hostname === domain || parsed.url.hostname.endsWith(`.${domain}`);
                    });
                    allowed = allowedHostname || allowedDomain;
                  }
                } catch (e) {
                  allowed = false;
                }
                if (!allowed) {
                  delete frame.attribs[a];
                  return;
                }
              }
              if (name === "iframe" && a === "src") {
                let allowed = true;
                try {
                  const parsed = parseUrl(value);
                  if (parsed.isRelativeUrl) {
                    allowed = has(options, "allowIframeRelativeUrls") ? options.allowIframeRelativeUrls : !options.allowedIframeHostnames && !options.allowedIframeDomains;
                  } else if (options.allowedIframeHostnames || options.allowedIframeDomains) {
                    const allowedHostname = (options.allowedIframeHostnames || []).find(function(hostname) {
                      return hostname === parsed.url.hostname;
                    });
                    const allowedDomain = (options.allowedIframeDomains || []).find(function(domain) {
                      return parsed.url.hostname === domain || parsed.url.hostname.endsWith(`.${domain}`);
                    });
                    allowed = allowedHostname || allowedDomain;
                  }
                } catch (e) {
                  allowed = false;
                }
                if (!allowed) {
                  delete frame.attribs[a];
                  return;
                }
              }
              if (a === "srcset" || a === "imagesrcset") {
                try {
                  let parsed = parseSrcset(value);
                  parsed.forEach(function(value) {
                    if (naughtyHref(name, value.url)) {
                      value.evil = true;
                    }
                  });
                  parsed = filter(parsed, function(v) {
                    return !v.evil;
                  });
                  if (!parsed.length) {
                    delete frame.attribs[a];
                    return;
                  } else {
                    value = stringifySrcset(filter(parsed, function(v) {
                      return !v.evil;
                    }));
                    frame.attribs[a] = value;
                  }
                } catch (e) {
                  delete frame.attribs[a];
                  return;
                }
              }
              if (a === "class") {
                const allowedSpecificClasses = allowedClassesMap[name];
                const allowedWildcardClasses = allowedClassesMap["*"];
                const allowedSpecificClassesGlob = allowedClassesGlobMap[name];
                const allowedSpecificClassesRegex = allowedClassesRegexMap[name];
                const allowedWildcardClassesRegex = allowedClassesRegexMap["*"];
                const allowedWildcardClassesGlob = allowedClassesGlobMap["*"];
                const allowedClassesGlobs = [
                  allowedSpecificClassesGlob,
                  allowedWildcardClassesGlob
                ].concat(allowedSpecificClassesRegex, allowedWildcardClassesRegex).filter(function(t) {
                  return t;
                });
                if (allowedSpecificClasses && allowedWildcardClasses) {
                  value = filterClasses(value, mergeClasses(allowedSpecificClasses, allowedWildcardClasses), allowedClassesGlobs);
                } else {
                  value = filterClasses(value, allowedSpecificClasses || allowedWildcardClasses, allowedClassesGlobs);
                }
                if (!value.length) {
                  delete frame.attribs[a];
                  return;
                }
              }
              if (a === "style") {
                if (options.parseStyleAttributes) {
                  try {
                    const abstractSyntaxTree = postcssParse(name + " {" + value + "}", { map: false });
                    const filteredAST = filterCss(abstractSyntaxTree, options.allowedStyles);
                    value = stringifyStyleAttributes(filteredAST);
                    if (value.length === 0) {
                      delete frame.attribs[a];
                      return;
                    }
                  } catch (e) {
                    if (typeof window !== "undefined") {
                      logger.warn(`Failed to parse "${name} {${value}}". If you are ` + "running this in a browser, we recommend disabling " + "style parsing with the parseStyleAttributes option, " + "since it only works in a node environment due to a " + "postcss dependency. More info: " + "https://github.com/apostrophecms/sanitize-html/issues/547");
                    }
                    delete frame.attribs[a];
                    return;
                  }
                } else if (options.allowedStyles) {
                  throw new Error("allowedStyles option cannot be used together with parseStyleAttributes: false.");
                }
              }
              result += " " + a;
              if (value && value.length) {
                result += '="' + escapeHtml(value, true) + '"';
              } else if (options.allowedEmptyAttributes.includes(a)) {
                result += '=""';
              }
            } else {
              delete frame.attribs[a];
            }
          });
        }
        if (options.selfClosing.indexOf(name) !== -1) {
          result += " />";
        } else {
          result += ">";
          if (frame.innerText && !hasText) {
            const escaped = escapeHtml(frame.innerText);
            if (options.textFilter) {
              result += options.textFilter(escaped, name);
            } else {
              result += escaped;
            }
            addedText = true;
          }
        }
        if (skip) {
          result = tempResult + escapeHtml(result);
          tempResult = "";
        }
        frame.openingTagLength = result.length - frame.tagPosition;
      },
      ontext: function(text) {
        updateRawTextRegion();
        if (skipText || skipRawText) {
          return;
        }
        const lastFrame = stack[stack.length - 1];
        let tag;
        if (lastFrame) {
          tag = lastFrame.tag;
          text = lastFrame.innerText !== undefined ? lastFrame.innerText : text;
        }
        if (options.disallowedTagsMode === "completelyDiscard" && !tagAllowed(tag)) {
          text = "";
        } else if (tag && tagAllowed(tag) && (options.disallowedTagsMode === "discard" || options.disallowedTagsMode === "completelyDiscard") && (tag === "script" || tag === "style")) {
          result += text;
        } else if (tag && tagAllowed(tag) && (options.disallowedTagsMode === "discard" || options.disallowedTagsMode === "completelyDiscard") && (tag === "textarea" || tag === "xmp")) {
          if (tag === "xmp") {
            result += text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
          } else {
            result += escapeHtml(text, false);
          }
        } else if (tag === "iframe" && !tagAllowed(tag) && options.disallowedTagsMode === "discard" && iframeFallbackDepth < MAX_IFRAME_FALLBACK_DEPTH) {
          result += sanitizeHtml(text, options, {
            depth,
            iframeFallbackDepth: iframeFallbackDepth + 1
          });
        } else if (!addedText) {
          const escaped = escapeHtml(text, false);
          if (options.textFilter) {
            result += options.textFilter(escaped, tag);
          } else {
            result += escaped;
          }
        }
        if (stack.length) {
          const frame = stack[stack.length - 1];
          frame.text += text;
        }
      },
      onclosetag: function(name, isImplied) {
        if (options.onCloseTag) {
          options.onCloseTag(name, isImplied);
        }
        updateRawTextRegion();
        if (skipRawText) {
          const lastFrame = stack[stack.length - 1];
          if (!lastFrame || lastFrame.tag !== name) {
            return;
          }
        } else if (skipText) {
          skipTextDepth--;
          if (!skipTextDepth) {
            skipText = false;
            if (rawTextEnd !== null) {
              skipRawText = true;
            }
          } else {
            return;
          }
        }
        const frame = stack.pop();
        if (!frame) {
          return;
        }
        if (frame.tag !== name) {
          stack.push(frame);
          return;
        }
        skipText = options.enforceHtmlBoundary ? name === "html" : false;
        depth--;
        const skip = skipMap[depth];
        if (skip) {
          delete skipMap[depth];
          if (options.disallowedTagsMode === "discard" || options.disallowedTagsMode === "completelyDiscard") {
            frame.updateParentNodeText();
            return;
          }
          tempResult = result;
          result = "";
        }
        if (transformMap[depth]) {
          name = transformMap[depth];
          delete transformMap[depth];
        }
        if (options.exclusiveFilter) {
          const filterResult = options.exclusiveFilter(frame);
          if (filterResult === "excludeTag") {
            if (skip) {
              result = tempResult;
              tempResult = "";
            }
            result = result.substring(0, frame.tagPosition) + result.substring(frame.tagPosition + frame.openingTagLength);
            return;
          } else if (filterResult) {
            result = result.substring(0, frame.tagPosition);
            return;
          }
        }
        frame.updateParentNodeMediaChildren();
        frame.updateParentNodeText();
        if (options.selfClosing.indexOf(name) !== -1 || isImplied && !tagAllowed(name) && ["escape", "recursiveEscape"].indexOf(options.disallowedTagsMode) >= 0) {
          if (skip) {
            result = tempResult;
            tempResult = "";
          }
          return;
        }
        result += "</" + name + ">";
        if (skip) {
          result = tempResult + escapeHtml(result);
          tempResult = "";
        }
        addedText = false;
      }
    }, options.parser);
    parser.write(html);
    parser.end();
    if (options.disallowedTagsMode === "escape" || options.disallowedTagsMode === "recursiveEscape") {
      const lastParsedIndex = parser.endIndex;
      if (lastParsedIndex != null && lastParsedIndex >= 0 && lastParsedIndex < html.length) {
        const unparsed = html.substring(lastParsedIndex);
        result += escapeHtml(unparsed);
      } else if ((lastParsedIndex == null || lastParsedIndex < 0) && html.length > 0 && result === "") {
        result = escapeHtml(html);
      }
    }
    return result;
    function initializeState() {
      result = "";
      depth = baseDepth;
      stack = [];
      skipMap = {};
      transformMap = {};
      skipText = false;
      skipTextDepth = 0;
      rawTextEnd = null;
      skipRawText = false;
    }
    function updateRawTextRegion() {
      if (rawTextEnd !== null && parser.startIndex >= rawTextEnd) {
        rawTextEnd = null;
        skipRawText = false;
      }
    }
    function findRawTextEnd(tagName, from) {
      const re = new RegExp("</" + tagName + "[\\t\\n\\f\\r />]", "ig");
      re.lastIndex = from;
      const match = re.exec(html);
      return match ? match.index : Infinity;
    }
    function escapeHtml(s, quote) {
      if (typeof s !== "string") {
        s = s + "";
      }
      if (options.parser.decodeEntities) {
        s = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        if (quote) {
          s = s.replace(/"/g, "&quot;");
        }
      }
      s = s.replace(/&(?![a-zA-Z0-9#]{1,20};)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      if (quote) {
        s = s.replace(/"/g, "&quot;");
      }
      return s;
    }
    function naughtyHref(name, href) {
      const allowedSchemes = has(options.allowedSchemesByTag, name) ? options.allowedSchemesByTag[name] : options.allowedSchemes || [];
      return launderNaughtyHref(href, {
        allowedSchemes,
        allowProtocolRelative: options.allowProtocolRelative
      });
    }
    function isRefresh(attribs) {
      return Object.keys(attribs).some(function(a) {
        return a.toLowerCase() === "http-equiv" && String(attribs[a]).trim().toLowerCase() === "refresh";
      });
    }
    function naughtyRefresh(content) {
      const input = String(content);
      const isWhitespace = function(c) {
        return c === " " || c === "\t" || c === `
` || c === "\f" || c === "\r";
      };
      let position = 0;
      const skipWhitespace = function() {
        while (position < input.length && isWhitespace(input[position])) {
          position++;
        }
      };
      const lowerAt = function(i) {
        return (input[i] || "").toLowerCase();
      };
      skipWhitespace();
      const timeStart = position;
      while (position < input.length && /[0-9.]/.test(input[position])) {
        position++;
      }
      if (position === timeStart) {
        return true;
      }
      if (position < input.length) {
        const c = input[position];
        if (c !== ";" && c !== "," && !isWhitespace(c)) {
          return true;
        }
        skipWhitespace();
        if (input[position] === ";" || input[position] === ",") {
          position++;
        }
        skipWhitespace();
      }
      if (position >= input.length) {
        return false;
      }
      let url = input.slice(position);
      let quoted = true;
      if (lowerAt(position) === "u") {
        quoted = false;
        if (lowerAt(position + 1) === "r" && lowerAt(position + 2) === "l") {
          position += 3;
          skipWhitespace();
          if (input[position] === "=") {
            position++;
            skipWhitespace();
            quoted = true;
          }
        }
      }
      if (quoted) {
        const quote = input[position];
        if (quote === '"' || quote === "'") {
          position++;
        }
        url = input.slice(position);
        if (quote === '"' || quote === "'") {
          const end = url.indexOf(quote);
          if (end !== -1) {
            url = url.slice(0, end);
          }
        }
      }
      return naughtyHref("meta", url);
    }
    function animatesUrlAttribute(name, attribs) {
      if (svgAnimationTags.indexOf(localPart(name)) === -1) {
        return false;
      }
      const schemeCheckedAttributes = options.allowedSchemesAppliedToAttributes || [];
      return Object.keys(attribs || {}).some(function(attributeName) {
        if (localPart(attributeName) !== "attributename") {
          return false;
        }
        const target = (attribs[attributeName] || "").trim().toLowerCase();
        const localName = target.slice(target.lastIndexOf(":") + 1);
        return alwaysUrlAttributes.indexOf(localName) !== -1 || schemeCheckedAttributes.indexOf(target) !== -1 || schemeCheckedAttributes.indexOf(localName) !== -1;
      });
    }
    function localPart(name) {
      const lower = name.toLowerCase();
      return lower.slice(lower.lastIndexOf(":") + 1);
    }
    function parseUrl(value) {
      value = value.replace(/^(\w+:)?\s*[\\/]\s*[\\/]/, "$1//");
      if (value.startsWith("relative:")) {
        throw new Error("relative: exploit attempt");
      }
      let base = "relative://relative-site";
      for (let i = 0;i < 100; i++) {
        base += `/${i}`;
      }
      const parsed = new URL(value, base);
      const isRelativeUrl = parsed && parsed.hostname === "relative-site" && parsed.protocol === "relative:";
      return {
        isRelativeUrl,
        url: parsed
      };
    }
    function filterCss(abstractSyntaxTree, allowedStyles) {
      if (!allowedStyles) {
        return abstractSyntaxTree;
      }
      const astRules = abstractSyntaxTree.nodes[0];
      let selectedRule;
      if (allowedStyles[astRules.selector] && allowedStyles["*"]) {
        selectedRule = mergeStyles(allowedStyles[astRules.selector], allowedStyles["*"]);
      } else {
        selectedRule = allowedStyles[astRules.selector] || allowedStyles["*"];
      }
      if (selectedRule) {
        abstractSyntaxTree.nodes[0].nodes = astRules.nodes.reduce(filterDeclarations(selectedRule), []);
      }
      return abstractSyntaxTree;
    }
    function stringifyStyleAttributes(filteredAST) {
      return filteredAST.nodes[0].nodes.reduce(function(extractedAttributes, attrObject) {
        extractedAttributes.push(`${attrObject.prop}:${attrObject.value}${attrObject.important ? " !important" : ""}`);
        return extractedAttributes;
      }, []).join(";");
    }
    function filterDeclarations(selectedRule) {
      return function(allowedDeclarationsList, attributeObject) {
        if (has(selectedRule, attributeObject.prop)) {
          const matchesRegex = selectedRule[attributeObject.prop].some(function(regularExpression) {
            return regularExpression.test(attributeObject.value);
          });
          if (matchesRegex) {
            allowedDeclarationsList.push(attributeObject);
          }
        }
        return allowedDeclarationsList;
      };
    }
    function filterClasses(classes, allowed, allowedGlobs) {
      if (!allowed) {
        return classes;
      }
      classes = classes.split(/\s+/);
      return classes.filter(function(clss) {
        return allowed.indexOf(clss) !== -1 || allowedGlobs.some(function(glob) {
          return glob.test(clss);
        });
      }).join(" ");
    }
  }
  var htmlParserDefaults = {
    decodeEntities: true
  };
  sanitizeHtml.defaults = {
    allowedTags: [
      "address",
      "article",
      "aside",
      "footer",
      "header",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "hgroup",
      "main",
      "nav",
      "section",
      "blockquote",
      "dd",
      "div",
      "dl",
      "dt",
      "figcaption",
      "figure",
      "hr",
      "li",
      "menu",
      "ol",
      "p",
      "pre",
      "ul",
      "a",
      "abbr",
      "b",
      "bdi",
      "bdo",
      "br",
      "cite",
      "code",
      "data",
      "dfn",
      "em",
      "i",
      "kbd",
      "mark",
      "q",
      "rb",
      "rp",
      "rt",
      "rtc",
      "ruby",
      "s",
      "samp",
      "small",
      "span",
      "strong",
      "sub",
      "sup",
      "time",
      "u",
      "var",
      "wbr",
      "caption",
      "col",
      "colgroup",
      "table",
      "tbody",
      "td",
      "tfoot",
      "th",
      "thead",
      "tr"
    ],
    nonBooleanAttributes: [
      "abbr",
      "accept",
      "accept-charset",
      "accesskey",
      "action",
      "allow",
      "alt",
      "as",
      "autocapitalize",
      "autocomplete",
      "blocking",
      "charset",
      "cite",
      "class",
      "color",
      "cols",
      "colspan",
      "content",
      "contenteditable",
      "coords",
      "crossorigin",
      "data",
      "datetime",
      "decoding",
      "dir",
      "dirname",
      "download",
      "draggable",
      "enctype",
      "enterkeyhint",
      "fetchpriority",
      "for",
      "form",
      "formaction",
      "formenctype",
      "formmethod",
      "formtarget",
      "headers",
      "height",
      "hidden",
      "high",
      "href",
      "hreflang",
      "http-equiv",
      "id",
      "imagesizes",
      "imagesrcset",
      "inputmode",
      "integrity",
      "is",
      "itemid",
      "itemprop",
      "itemref",
      "itemtype",
      "kind",
      "label",
      "lang",
      "list",
      "loading",
      "low",
      "max",
      "maxlength",
      "media",
      "method",
      "min",
      "minlength",
      "name",
      "nonce",
      "optimum",
      "pattern",
      "ping",
      "placeholder",
      "popover",
      "popovertarget",
      "popovertargetaction",
      "poster",
      "preload",
      "referrerpolicy",
      "rel",
      "rows",
      "rowspan",
      "sandbox",
      "scope",
      "shape",
      "size",
      "sizes",
      "slot",
      "span",
      "spellcheck",
      "src",
      "srcdoc",
      "srclang",
      "srcset",
      "start",
      "step",
      "style",
      "tabindex",
      "target",
      "title",
      "translate",
      "type",
      "usemap",
      "value",
      "width",
      "wrap",
      "onauxclick",
      "onafterprint",
      "onbeforematch",
      "onbeforeprint",
      "onbeforeunload",
      "onbeforetoggle",
      "onblur",
      "oncancel",
      "oncanplay",
      "oncanplaythrough",
      "onchange",
      "onclick",
      "onclose",
      "oncontextlost",
      "oncontextmenu",
      "oncontextrestored",
      "oncopy",
      "oncuechange",
      "oncut",
      "ondblclick",
      "ondrag",
      "ondragend",
      "ondragenter",
      "ondragleave",
      "ondragover",
      "ondragstart",
      "ondrop",
      "ondurationchange",
      "onemptied",
      "onended",
      "onerror",
      "onfocus",
      "onformdata",
      "onhashchange",
      "oninput",
      "oninvalid",
      "onkeydown",
      "onkeypress",
      "onkeyup",
      "onlanguagechange",
      "onload",
      "onloadeddata",
      "onloadedmetadata",
      "onloadstart",
      "onmessage",
      "onmessageerror",
      "onmousedown",
      "onmouseenter",
      "onmouseleave",
      "onmousemove",
      "onmouseout",
      "onmouseover",
      "onmouseup",
      "onoffline",
      "ononline",
      "onpagehide",
      "onpageshow",
      "onpaste",
      "onpause",
      "onplay",
      "onplaying",
      "onpopstate",
      "onprogress",
      "onratechange",
      "onreset",
      "onresize",
      "onrejectionhandled",
      "onscroll",
      "onscrollend",
      "onsecuritypolicyviolation",
      "onseeked",
      "onseeking",
      "onselect",
      "onslotchange",
      "onstalled",
      "onstorage",
      "onsubmit",
      "onsuspend",
      "ontimeupdate",
      "ontoggle",
      "onunhandledrejection",
      "onunload",
      "onvolumechange",
      "onwaiting",
      "onwheel"
    ],
    disallowedTagsMode: "discard",
    allowedAttributes: {
      a: ["href", "name", "target"],
      img: ["src", "srcset", "alt", "title", "width", "height", "loading"]
    },
    allowedEmptyAttributes: [
      "alt"
    ],
    selfClosing: ["img", "br", "hr", "area", "base", "basefont", "input", "link", "meta", "col"],
    allowedSchemes: ["http", "https", "ftp", "mailto", "tel"],
    allowedSchemesByTag: {},
    allowedSchemesAppliedToAttributes: [
      "href",
      "src",
      "cite",
      "action",
      "formaction",
      "data",
      "xlink:href",
      "poster",
      "background",
      "ping",
      "longdesc",
      "usemap",
      "codebase",
      "classid",
      "archive",
      "profile",
      "manifest",
      "itemid",
      "dynsrc",
      "lowsrc"
    ],
    allowProtocolRelative: true,
    enforceHtmlBoundary: false,
    parseStyleAttributes: true,
    preserveEscapedAttributes: false
  };
  sanitizeHtml.simpleTransform = function(newTagName, newAttribs, merge) {
    merge = merge === undefined ? true : merge;
    newAttribs = newAttribs || {};
    return function(tagName, attribs) {
      let attrib;
      if (merge) {
        for (attrib in newAttribs) {
          attribs[attrib] = newAttribs[attrib];
        }
      } else {
        attribs = newAttribs;
      }
      return {
        tagName: newTagName,
        attribs
      };
    };
  };
});

// node_modules/react/cjs/react.development.js
var require_react_development = __commonJS(function(exports, module) {
  (function() {
    function defineDeprecationWarning(methodName, info) {
      Object.defineProperty(Component.prototype, methodName, {
        get: function() {
          console.warn("%s(...) is deprecated in plain JavaScript React classes. %s", info[0], info[1]);
        }
      });
    }
    function getIteratorFn(maybeIterable) {
      if (maybeIterable === null || typeof maybeIterable !== "object")
        return null;
      maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
      return typeof maybeIterable === "function" ? maybeIterable : null;
    }
    function warnNoop(publicInstance, callerName) {
      publicInstance = (publicInstance = publicInstance.constructor) && (publicInstance.displayName || publicInstance.name) || "ReactClass";
      var warningKey = publicInstance + "." + callerName;
      didWarnStateUpdateForUnmountedComponent[warningKey] || (console.error("Can't call %s on a component that is not yet mounted. This is a no-op, but it might indicate a bug in your application. Instead, assign to `this.state` directly or define a `state = {};` class property with the desired state in the %s component.", callerName, publicInstance), didWarnStateUpdateForUnmountedComponent[warningKey] = true);
    }
    function Component(props, context, updater) {
      this.props = props;
      this.context = context;
      this.refs = emptyObject;
      this.updater = updater || ReactNoopUpdateQueue;
    }
    function ComponentDummy() {}
    function PureComponent(props, context, updater) {
      this.props = props;
      this.context = context;
      this.refs = emptyObject;
      this.updater = updater || ReactNoopUpdateQueue;
    }
    function noop() {}
    function testStringCoercion(value) {
      return "" + value;
    }
    function checkKeyStringCoercion(value) {
      try {
        testStringCoercion(value);
        var JSCompiler_inline_result = false;
      } catch (e) {
        JSCompiler_inline_result = true;
      }
      if (JSCompiler_inline_result) {
        JSCompiler_inline_result = console;
        var JSCompiler_temp_const = JSCompiler_inline_result.error;
        var JSCompiler_inline_result$jscomp$0 = typeof Symbol === "function" && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
        JSCompiler_temp_const.call(JSCompiler_inline_result, "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.", JSCompiler_inline_result$jscomp$0);
        return testStringCoercion(value);
      }
    }
    function getComponentNameFromType(type) {
      if (type == null)
        return null;
      if (typeof type === "function")
        return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
      if (typeof type === "string")
        return type;
      switch (type) {
        case REACT_FRAGMENT_TYPE:
          return "Fragment";
        case REACT_PROFILER_TYPE:
          return "Profiler";
        case REACT_STRICT_MODE_TYPE:
          return "StrictMode";
        case REACT_SUSPENSE_TYPE:
          return "Suspense";
        case REACT_SUSPENSE_LIST_TYPE:
          return "SuspenseList";
        case REACT_ACTIVITY_TYPE:
          return "Activity";
        case REACT_VIEW_TRANSITION_TYPE:
          return "ViewTransition";
      }
      if (typeof type === "object")
        switch (typeof type.tag === "number" && console.error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."), type.$$typeof) {
          case REACT_PORTAL_TYPE:
            return "Portal";
          case REACT_CONTEXT_TYPE:
            return type.displayName || "Context";
          case REACT_CONSUMER_TYPE:
            return (type._context.displayName || "Context") + ".Consumer";
          case REACT_FORWARD_REF_TYPE:
            var innerType = type.render;
            type = type.displayName;
            type || (type = innerType.displayName || innerType.name || "", type = type !== "" ? "ForwardRef(" + type + ")" : "ForwardRef");
            return type;
          case REACT_MEMO_TYPE:
            return innerType = type.displayName || null, innerType !== null ? innerType : getComponentNameFromType(type.type) || "Memo";
          case REACT_LAZY_TYPE:
            innerType = type._payload;
            type = type._init;
            try {
              return getComponentNameFromType(type(innerType));
            } catch (x) {}
        }
      return null;
    }
    function getTaskName(type) {
      if (type === REACT_FRAGMENT_TYPE)
        return "<>";
      if (typeof type === "object" && type !== null && type.$$typeof === REACT_LAZY_TYPE)
        return "<...>";
      try {
        var name = getComponentNameFromType(type);
        return name ? "<" + name + ">" : "<...>";
      } catch (x) {
        return "<...>";
      }
    }
    function getOwner() {
      var dispatcher = ReactSharedInternals.A;
      return dispatcher === null ? null : dispatcher.getOwner();
    }
    function UnknownOwner() {
      return Error("react-stack-top-frame");
    }
    function hasValidKey(config) {
      if (hasOwnProperty.call(config, "key")) {
        var getter = Object.getOwnPropertyDescriptor(config, "key").get;
        if (getter && getter.isReactWarning)
          return false;
      }
      return config.key !== undefined;
    }
    function defineKeyPropWarningGetter(props, displayName) {
      function warnAboutAccessingKey() {
        specialPropKeyWarningShown || (specialPropKeyWarningShown = true, console.error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)", displayName));
      }
      warnAboutAccessingKey.isReactWarning = true;
      Object.defineProperty(props, "key", {
        get: warnAboutAccessingKey,
        configurable: true
      });
    }
    function elementRefGetterWithDeprecationWarning() {
      var componentName = getComponentNameFromType(this.type);
      didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = true, console.error("Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."));
      componentName = this.props.ref;
      return componentName !== undefined ? componentName : null;
    }
    function ReactElement(type, key, props, owner, debugStack, debugTask) {
      var refProp = props.ref;
      type = {
        $$typeof: REACT_ELEMENT_TYPE,
        type,
        key,
        props,
        _owner: owner
      };
      (refProp !== undefined ? refProp : null) !== null ? Object.defineProperty(type, "ref", {
        enumerable: false,
        get: elementRefGetterWithDeprecationWarning
      }) : Object.defineProperty(type, "ref", { enumerable: false, value: null });
      type._store = {};
      Object.defineProperty(type._store, "validated", {
        configurable: false,
        enumerable: false,
        writable: true,
        value: 0
      });
      Object.defineProperty(type, "_debugInfo", {
        configurable: false,
        enumerable: false,
        writable: true,
        value: null
      });
      Object.defineProperty(type, "_debugStack", {
        configurable: false,
        enumerable: false,
        writable: true,
        value: debugStack
      });
      Object.defineProperty(type, "_debugTask", {
        configurable: false,
        enumerable: false,
        writable: true,
        value: debugTask
      });
      Object.freeze && (Object.freeze(type.props), Object.freeze(type));
      return type;
    }
    function cloneAndReplaceKey(oldElement, newKey) {
      newKey = ReactElement(oldElement.type, newKey, oldElement.props, oldElement._owner, oldElement._debugStack, oldElement._debugTask);
      oldElement._store && (newKey._store.validated = oldElement._store.validated);
      return newKey;
    }
    function validateChildKeys(node) {
      isValidElement(node) ? node._store && (node._store.validated = 1) : typeof node === "object" && node !== null && node.$$typeof === REACT_LAZY_TYPE && (node._payload.status === "fulfilled" ? isValidElement(node._payload.value) && node._payload.value._store && (node._payload.value._store.validated = 1) : node._store && (node._store.validated = 1));
    }
    function isValidElement(object) {
      return typeof object === "object" && object !== null && object.$$typeof === REACT_ELEMENT_TYPE;
    }
    function escape(key) {
      var escaperLookup = { "=": "=0", ":": "=2" };
      return "$" + key.replace(/[=:]/g, function(match) {
        return escaperLookup[match];
      });
    }
    function getElementKey(element, index) {
      return typeof element === "object" && element !== null && element.key != null ? (checkKeyStringCoercion(element.key), escape("" + element.key)) : index.toString(36);
    }
    function resolveThenable(thenable) {
      switch (thenable.status) {
        case "fulfilled":
          return thenable.value;
        case "rejected":
          throw thenable.reason;
        default:
          switch (typeof thenable.status === "string" ? thenable.then(noop, noop) : (thenable.status = "pending", thenable.then(function(fulfilledValue) {
            thenable.status === "pending" && (thenable.status = "fulfilled", thenable.value = fulfilledValue);
          }, function(error) {
            thenable.status === "pending" && (thenable.status = "rejected", thenable.reason = error);
          })), thenable.status) {
            case "fulfilled":
              return thenable.value;
            case "rejected":
              throw thenable.reason;
          }
      }
      throw thenable;
    }
    function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
      var type = typeof children;
      if (type === "undefined" || type === "boolean")
        children = null;
      var invokeCallback = false;
      if (children === null)
        invokeCallback = true;
      else
        switch (type) {
          case "bigint":
          case "string":
          case "number":
            invokeCallback = true;
            break;
          case "object":
            switch (children.$$typeof) {
              case REACT_ELEMENT_TYPE:
              case REACT_PORTAL_TYPE:
                invokeCallback = true;
                break;
              case REACT_LAZY_TYPE:
                return invokeCallback = children._init, mapIntoArray(invokeCallback(children._payload), array, escapedPrefix, nameSoFar, callback);
            }
        }
      if (invokeCallback) {
        invokeCallback = children;
        callback = callback(invokeCallback);
        var childKey = nameSoFar === "" ? "." + getElementKey(invokeCallback, 0) : nameSoFar;
        isArrayImpl(callback) ? (escapedPrefix = "", childKey != null && (escapedPrefix = childKey.replace(userProvidedKeyEscapeRegex, "$&/") + "/"), mapIntoArray(callback, array, escapedPrefix, "", function(c) {
          return c;
        })) : callback != null && (isValidElement(callback) && (callback.key != null && (invokeCallback && invokeCallback.key === callback.key || checkKeyStringCoercion(callback.key)), escapedPrefix = cloneAndReplaceKey(callback, escapedPrefix + (callback.key == null || invokeCallback && invokeCallback.key === callback.key ? "" : ("" + callback.key).replace(userProvidedKeyEscapeRegex, "$&/") + "/") + childKey), nameSoFar !== "" && invokeCallback != null && isValidElement(invokeCallback) && invokeCallback.key == null && invokeCallback._store && !invokeCallback._store.validated && (escapedPrefix._store.validated = 2), callback = escapedPrefix), array.push(callback));
        return 1;
      }
      invokeCallback = 0;
      childKey = nameSoFar === "" ? "." : nameSoFar + ":";
      if (isArrayImpl(children))
        for (var i = 0;i < children.length; i++)
          nameSoFar = children[i], type = childKey + getElementKey(nameSoFar, i), invokeCallback += mapIntoArray(nameSoFar, array, escapedPrefix, type, callback);
      else if (i = getIteratorFn(children), typeof i === "function")
        for (i === children.entries && (didWarnAboutMaps || console.warn("Using Maps as children is not supported. Use an array of keyed ReactElements instead."), didWarnAboutMaps = true), children = i.call(children), i = 0;!(nameSoFar = children.next()).done; )
          nameSoFar = nameSoFar.value, type = childKey + getElementKey(nameSoFar, i++), invokeCallback += mapIntoArray(nameSoFar, array, escapedPrefix, type, callback);
      else if (type === "object") {
        if (typeof children.then === "function")
          return mapIntoArray(resolveThenable(children), array, escapedPrefix, nameSoFar, callback);
        array = String(children);
        throw Error("Objects are not valid as a React child (found: " + (array === "[object Object]" ? "object with keys {" + Object.keys(children).join(", ") + "}" : array) + "). If you meant to render a collection of children, use an array instead.");
      }
      return invokeCallback;
    }
    function mapChildren(children, func, context) {
      if (children == null)
        return children;
      var result = [], count = 0;
      mapIntoArray(children, result, "", "", function(child) {
        return func.call(context, child, count++);
      });
      return result;
    }
    function lazyInitializer(payload) {
      if (payload._status === -1) {
        var resolveDebugValue = null, rejectDebugValue = null, ioInfo = payload._ioInfo;
        ioInfo != null && (ioInfo.start = ioInfo.end = performance.now(), ioInfo.value = new Promise(function(resolve, reject) {
          resolveDebugValue = resolve;
          rejectDebugValue = reject;
        }));
        ioInfo = payload._result;
        var thenable = ioInfo();
        thenable.then(function(moduleObject) {
          if (payload._status === 0 || payload._status === -1) {
            payload._status = 1;
            payload._result = moduleObject;
            var _ioInfo = payload._ioInfo;
            if (_ioInfo != null) {
              _ioInfo.end = performance.now();
              var debugValue = moduleObject == null ? undefined : moduleObject.default;
              resolveDebugValue(debugValue);
              _ioInfo.value.status = "fulfilled";
              _ioInfo.value.value = debugValue;
            }
            thenable.status === undefined && (thenable.status = "fulfilled", thenable.value = moduleObject);
          }
        }, function(error) {
          if (payload._status === 0 || payload._status === -1) {
            payload._status = 2;
            payload._result = error;
            var _ioInfo2 = payload._ioInfo;
            _ioInfo2 != null && (_ioInfo2.end = performance.now(), _ioInfo2.value.then(noop, noop), rejectDebugValue(error), _ioInfo2.value.status = "rejected", _ioInfo2.value.reason = error);
            thenable.status === undefined && (thenable.status = "rejected", thenable.reason = error);
          }
        });
        ioInfo = payload._ioInfo;
        if (ioInfo != null) {
          var displayName = thenable.displayName;
          typeof displayName === "string" && (ioInfo.name = displayName);
        }
        payload._status === -1 && (payload._status = 0, payload._result = thenable);
      }
      if (payload._status === 1)
        return ioInfo = payload._result, ioInfo === undefined && console.error(`lazy: Expected the result of a dynamic import() call. Instead received: %s

Your code should look like: 
  const MyComponent = lazy(() => import('./MyComponent'))

Did you accidentally put curly braces around the import?`, ioInfo), "default" in ioInfo || console.error(`lazy: Expected the result of a dynamic import() call. Instead received: %s

Your code should look like: 
  const MyComponent = lazy(() => import('./MyComponent'))`, ioInfo), ioInfo.default;
      throw payload._result;
    }
    function resolveDispatcher() {
      var dispatcher = ReactSharedInternals.H;
      dispatcher === null && console.error(`Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:
1. You might have mismatching versions of React and the renderer (such as React DOM)
2. You might be breaking the Rules of Hooks
3. You might have more than one copy of React in the same app
See https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem.`);
      return dispatcher;
    }
    function releaseAsyncTransition() {
      ReactSharedInternals.asyncTransitions--;
    }
    function startTransition(scope) {
      var prevTransition = ReactSharedInternals.T, currentTransition = {};
      currentTransition.types = prevTransition !== null ? prevTransition.types : null;
      currentTransition._updatedFibers = new Set;
      ReactSharedInternals.T = currentTransition;
      try {
        var returnValue = scope(), onStartTransitionFinish = ReactSharedInternals.S;
        onStartTransitionFinish !== null && onStartTransitionFinish(currentTransition, returnValue);
        typeof returnValue === "object" && returnValue !== null && typeof returnValue.then === "function" && (ReactSharedInternals.asyncTransitions++, returnValue.then(releaseAsyncTransition, releaseAsyncTransition), returnValue.then(noop, reportGlobalError));
      } catch (error) {
        reportGlobalError(error);
      } finally {
        prevTransition === null && currentTransition._updatedFibers && (scope = currentTransition._updatedFibers.size, currentTransition._updatedFibers.clear(), 10 < scope && console.warn("Detected a large number of updates inside startTransition. If this is due to a subscription please re-write it to use React provided hooks. Otherwise concurrent mode guarantees are off the table.")), prevTransition !== null && currentTransition.types !== null && (prevTransition.types !== null && prevTransition.types !== currentTransition.types && console.error("We expected inner Transitions to have transferred the outer types set and that you cannot add to the outer Transition while inside the inner.This is a bug in React."), prevTransition.types = currentTransition.types), ReactSharedInternals.T = prevTransition;
      }
    }
    function addTransitionType(type) {
      var transition = ReactSharedInternals.T;
      if (transition !== null) {
        var transitionTypes = transition.types;
        transitionTypes === null ? transition.types = [type] : transitionTypes.indexOf(type) === -1 && transitionTypes.push(type);
      } else
        ReactSharedInternals.asyncTransitions === 0 && console.error("addTransitionType can only be called inside a `startTransition()` callback. It must be associated with a specific Transition."), startTransition(addTransitionType.bind(null, type));
    }
    function enqueueTask(task) {
      if (enqueueTaskImpl === null)
        try {
          var requireString = ("require" + Math.random()).slice(0, 7);
          enqueueTaskImpl = (module && module[requireString]).call(module, "timers").setImmediate;
        } catch (_err) {
          enqueueTaskImpl = function(callback) {
            didWarnAboutMessageChannel === false && (didWarnAboutMessageChannel = true, typeof MessageChannel === "undefined" && console.error("This browser does not have a MessageChannel implementation, so enqueuing tasks via await act(async () => ...) will fail. Please file an issue at https://github.com/facebook/react/issues if you encounter this warning."));
            var channel = new MessageChannel;
            channel.port1.onmessage = callback;
            channel.port2.postMessage(undefined);
          };
        }
      return enqueueTaskImpl(task);
    }
    function aggregateErrors(errors) {
      return 1 < errors.length && typeof AggregateError === "function" ? new AggregateError(errors) : errors[0];
    }
    function popActScope(prevActQueue, prevActScopeDepth) {
      prevActScopeDepth !== actScopeDepth - 1 && console.error("You seem to have overlapping act() calls, this is not supported. Be sure to await previous act() calls before making a new one. ");
      actScopeDepth = prevActScopeDepth;
    }
    function recursivelyFlushAsyncActWork(returnValue, resolve, reject) {
      var queue = ReactSharedInternals.actQueue;
      if (queue !== null)
        if (queue.length !== 0)
          try {
            flushActQueue(queue);
            enqueueTask(function() {
              return recursivelyFlushAsyncActWork(returnValue, resolve, reject);
            });
            return;
          } catch (error) {
            ReactSharedInternals.thrownErrors.push(error);
          }
        else
          ReactSharedInternals.actQueue = null;
      0 < ReactSharedInternals.thrownErrors.length ? (queue = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, reject(queue)) : resolve(returnValue);
    }
    function flushActQueue(queue) {
      if (!isFlushing) {
        isFlushing = true;
        var i = 0;
        try {
          for (;i < queue.length; i++) {
            var callback = queue[i];
            do {
              ReactSharedInternals.didUsePromise = false;
              var continuation = callback(false);
              if (continuation !== null) {
                if (ReactSharedInternals.didUsePromise) {
                  queue[i] = callback;
                  queue.splice(0, i);
                  return;
                }
                callback = continuation;
              } else
                break;
            } while (1);
          }
          queue.length = 0;
        } catch (error) {
          queue.splice(0, i + 1), ReactSharedInternals.thrownErrors.push(error);
        } finally {
          isFlushing = false;
        }
      }
    }
    typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart === "function" && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
    var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = Symbol.for("react.activity"), REACT_VIEW_TRANSITION_TYPE = Symbol.for("react.view_transition"), MAYBE_ITERATOR_SYMBOL = Symbol.iterator, didWarnStateUpdateForUnmountedComponent = {}, ReactNoopUpdateQueue = {
      isMounted: function() {
        return false;
      },
      enqueueForceUpdate: function(publicInstance) {
        warnNoop(publicInstance, "forceUpdate");
      },
      enqueueReplaceState: function(publicInstance) {
        warnNoop(publicInstance, "replaceState");
      },
      enqueueSetState: function(publicInstance) {
        warnNoop(publicInstance, "setState");
      }
    }, assign = Object.assign, emptyObject = {};
    Object.freeze(emptyObject);
    Component.prototype.isReactComponent = {};
    Component.prototype.setState = function(partialState, callback) {
      if (typeof partialState !== "object" && typeof partialState !== "function" && partialState != null)
        throw Error("takes an object of state variables to update or a function which returns an object of state variables.");
      this.updater.enqueueSetState(this, partialState, callback, "setState");
    };
    Component.prototype.forceUpdate = function(callback) {
      this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
    };
    var deprecatedAPIs = {
      isMounted: [
        "isMounted",
        "Instead, make sure to clean up subscriptions and pending requests in componentWillUnmount to prevent memory leaks."
      ],
      replaceState: [
        "replaceState",
        "Refactor your code to use setState instead (see https://github.com/facebook/react/issues/3236)."
      ]
    };
    for (fnName in deprecatedAPIs)
      deprecatedAPIs.hasOwnProperty(fnName) && defineDeprecationWarning(fnName, deprecatedAPIs[fnName]);
    ComponentDummy.prototype = Component.prototype;
    deprecatedAPIs = PureComponent.prototype = new ComponentDummy;
    deprecatedAPIs.constructor = PureComponent;
    assign(deprecatedAPIs, Component.prototype);
    deprecatedAPIs.isPureReactComponent = true;
    var isArrayImpl = Array.isArray, REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference"), ReactSharedInternals = {
      H: null,
      A: null,
      T: null,
      S: null,
      actQueue: null,
      asyncTransitions: 0,
      isBatchingLegacy: false,
      didScheduleLegacyUpdate: false,
      didUsePromise: false,
      thrownErrors: [],
      getCurrentStack: null,
      recentlyCreatedOwnerStacks: 0
    }, hasOwnProperty = Object.prototype.hasOwnProperty, createTask = console.createTask ? console.createTask : function() {
      return null;
    };
    deprecatedAPIs = {
      react_stack_bottom_frame: function(callStackForError) {
        return callStackForError();
      }
    };
    var specialPropKeyWarningShown, didWarnAboutOldJSXRuntime;
    var didWarnAboutElementRef = {};
    var unknownOwnerDebugStack = deprecatedAPIs.react_stack_bottom_frame.bind(deprecatedAPIs, UnknownOwner)();
    var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
    var didWarnAboutMaps = false, userProvidedKeyEscapeRegex = /\/+/g, reportGlobalError = typeof reportError === "function" ? reportError : function(error) {
      if (typeof window === "object" && typeof window.ErrorEvent === "function") {
        var event = new window.ErrorEvent("error", {
          bubbles: true,
          cancelable: true,
          message: typeof error === "object" && error !== null && typeof error.message === "string" ? String(error.message) : String(error),
          error
        });
        if (!window.dispatchEvent(event))
          return;
      } else if (typeof process === "object" && typeof process.emit === "function") {
        process.emit("uncaughtException", error);
        return;
      }
      console.error(error);
    }, didWarnAboutMessageChannel = false, enqueueTaskImpl = null, actScopeDepth = 0, didWarnNoAwaitAct = false, isFlushing = false, queueSeveralMicrotasks = typeof queueMicrotask === "function" ? function(callback) {
      queueMicrotask(function() {
        return queueMicrotask(callback);
      });
    } : enqueueTask;
    deprecatedAPIs = Object.freeze({
      __proto__: null,
      c: function(size) {
        return resolveDispatcher().useMemoCache(size);
      }
    });
    var fnName = {
      map: mapChildren,
      forEach: function(children, forEachFunc, forEachContext) {
        mapChildren(children, function() {
          forEachFunc.apply(this, arguments);
        }, forEachContext);
      },
      count: function(children) {
        var n = 0;
        mapChildren(children, function() {
          n++;
        });
        return n;
      },
      toArray: function(children) {
        return mapChildren(children, function(child) {
          return child;
        }) || [];
      },
      only: function(children) {
        if (!isValidElement(children))
          throw Error("React.Children.only expected to receive a single React element child.");
        return children;
      }
    };
    exports.Activity = REACT_ACTIVITY_TYPE;
    exports.Children = fnName;
    exports.Component = Component;
    exports.Fragment = REACT_FRAGMENT_TYPE;
    exports.Profiler = REACT_PROFILER_TYPE;
    exports.PureComponent = PureComponent;
    exports.StrictMode = REACT_STRICT_MODE_TYPE;
    exports.Suspense = REACT_SUSPENSE_TYPE;
    exports.ViewTransition = REACT_VIEW_TRANSITION_TYPE;
    exports.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = ReactSharedInternals;
    exports.__COMPILER_RUNTIME = deprecatedAPIs;
    exports.act = function(callback) {
      var prevActQueue = ReactSharedInternals.actQueue, prevActScopeDepth = actScopeDepth;
      actScopeDepth++;
      var queue = ReactSharedInternals.actQueue = prevActQueue !== null ? prevActQueue : [], didAwaitActCall = false;
      try {
        var result = callback();
      } catch (error) {
        ReactSharedInternals.thrownErrors.push(error);
      }
      if (0 < ReactSharedInternals.thrownErrors.length)
        throw popActScope(prevActQueue, prevActScopeDepth), callback = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, callback;
      if (result !== null && typeof result === "object" && typeof result.then === "function") {
        var thenable = result;
        queueSeveralMicrotasks(function() {
          didAwaitActCall || didWarnNoAwaitAct || (didWarnNoAwaitAct = true, console.error("You called act(async () => ...) without await. This could lead to unexpected testing behaviour, interleaving multiple act calls and mixing their scopes. You should - await act(async () => ...);"));
        });
        return {
          then: function(resolve, reject) {
            didAwaitActCall = true;
            thenable.then(function(returnValue) {
              popActScope(prevActQueue, prevActScopeDepth);
              if (prevActScopeDepth === 0) {
                try {
                  flushActQueue(queue), enqueueTask(function() {
                    return recursivelyFlushAsyncActWork(returnValue, resolve, reject);
                  });
                } catch (error$0) {
                  ReactSharedInternals.thrownErrors.push(error$0);
                }
                if (0 < ReactSharedInternals.thrownErrors.length) {
                  var _thrownError = aggregateErrors(ReactSharedInternals.thrownErrors);
                  ReactSharedInternals.thrownErrors.length = 0;
                  reject(_thrownError);
                }
              } else
                resolve(returnValue);
            }, function(error) {
              popActScope(prevActQueue, prevActScopeDepth);
              0 < ReactSharedInternals.thrownErrors.length ? (error = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, reject(error)) : reject(error);
            });
          }
        };
      }
      var returnValue$jscomp$0 = result;
      popActScope(prevActQueue, prevActScopeDepth);
      prevActScopeDepth === 0 && (flushActQueue(queue), queue.length !== 0 && queueSeveralMicrotasks(function() {
        didAwaitActCall || didWarnNoAwaitAct || (didWarnNoAwaitAct = true, console.error("A component suspended inside an `act` scope, but the `act` call was not awaited. When testing React components that depend on asynchronous data, you must await the result:\n\nawait act(() => ...)"));
      }), ReactSharedInternals.actQueue = null);
      if (0 < ReactSharedInternals.thrownErrors.length)
        throw callback = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, callback;
      return {
        then: function(resolve, reject) {
          didAwaitActCall = true;
          prevActScopeDepth === 0 ? (ReactSharedInternals.actQueue = queue, enqueueTask(function() {
            return recursivelyFlushAsyncActWork(returnValue$jscomp$0, resolve, reject);
          })) : resolve(returnValue$jscomp$0);
        }
      };
    };
    exports.addTransitionType = addTransitionType;
    exports.cache = function(fn) {
      return function() {
        return fn.apply(null, arguments);
      };
    };
    exports.cacheSignal = function() {
      return null;
    };
    exports.captureOwnerStack = function() {
      var getCurrentStack = ReactSharedInternals.getCurrentStack;
      return getCurrentStack === null ? null : getCurrentStack();
    };
    exports.cloneElement = function(element, config, children) {
      if (element === null || element === undefined)
        throw Error("The argument must be a React element, but you passed " + element + ".");
      var props = assign({}, element.props), { key, _owner: owner } = element;
      if (config != null) {
        var JSCompiler_inline_result;
        a: {
          if (hasOwnProperty.call(config, "ref") && (JSCompiler_inline_result = Object.getOwnPropertyDescriptor(config, "ref").get) && JSCompiler_inline_result.isReactWarning) {
            JSCompiler_inline_result = false;
            break a;
          }
          JSCompiler_inline_result = config.ref !== undefined;
        }
        JSCompiler_inline_result && (owner = getOwner());
        hasValidKey(config) && (checkKeyStringCoercion(config.key), key = "" + config.key);
        for (propName in config)
          !hasOwnProperty.call(config, propName) || propName === "key" || propName === "__self" || propName === "__source" || propName === "ref" && config.ref === undefined || (props[propName] = config[propName]);
      }
      var propName = arguments.length - 2;
      if (propName === 1)
        props.children = children;
      else if (1 < propName) {
        JSCompiler_inline_result = Array(propName);
        for (var i = 0;i < propName; i++)
          JSCompiler_inline_result[i] = arguments[i + 2];
        props.children = JSCompiler_inline_result;
      }
      props = ReactElement(element.type, key, props, owner, element._debugStack, element._debugTask);
      for (key = 2;key < arguments.length; key++)
        validateChildKeys(arguments[key]);
      return props;
    };
    exports.createContext = function(defaultValue) {
      defaultValue = {
        $$typeof: REACT_CONTEXT_TYPE,
        _currentValue: defaultValue,
        _currentValue2: defaultValue,
        _threadCount: 0,
        Provider: null,
        Consumer: null
      };
      defaultValue.Provider = defaultValue;
      defaultValue.Consumer = {
        $$typeof: REACT_CONSUMER_TYPE,
        _context: defaultValue
      };
      defaultValue._currentRenderer = null;
      defaultValue._currentRenderer2 = null;
      return defaultValue;
    };
    exports.createElement = function(type, config, children) {
      for (var i = 2;i < arguments.length; i++)
        validateChildKeys(arguments[i]);
      var propName;
      i = {};
      var key = null;
      if (config != null)
        for (propName in didWarnAboutOldJSXRuntime || !("__self" in config) || "key" in config || (didWarnAboutOldJSXRuntime = true, console.warn("Your app (or one of its dependencies) is using an outdated JSX transform. Update to the modern JSX transform for faster performance: https://react.dev/link/new-jsx-transform")), hasValidKey(config) && (checkKeyStringCoercion(config.key), key = "" + config.key), config)
          hasOwnProperty.call(config, propName) && propName !== "key" && propName !== "__self" && propName !== "__source" && (i[propName] = config[propName]);
      var childrenLength = arguments.length - 2;
      if (childrenLength === 1)
        i.children = children;
      else if (1 < childrenLength) {
        for (var childArray = Array(childrenLength), _i = 0;_i < childrenLength; _i++)
          childArray[_i] = arguments[_i + 2];
        Object.freeze && Object.freeze(childArray);
        i.children = childArray;
      }
      if (type && type.defaultProps)
        for (propName in childrenLength = type.defaultProps, childrenLength)
          i[propName] === undefined && (i[propName] = childrenLength[propName]);
      key && defineKeyPropWarningGetter(i, typeof type === "function" ? type.displayName || type.name || "Unknown" : type);
      (propName = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++) ? (childArray = Error.stackTraceLimit, Error.stackTraceLimit = 10, childrenLength = Error("react-stack-top-frame"), Error.stackTraceLimit = childArray) : childrenLength = unknownOwnerDebugStack;
      return ReactElement(type, key, i, getOwner(), childrenLength, propName ? createTask(getTaskName(type)) : unknownOwnerDebugTask);
    };
    exports.createRef = function() {
      var refObject = { current: null };
      Object.seal(refObject);
      return refObject;
    };
    exports.forwardRef = function(render) {
      render != null && render.$$typeof === REACT_MEMO_TYPE ? console.error("forwardRef requires a render function but received a `memo` component. Instead of forwardRef(memo(...)), use memo(forwardRef(...)).") : typeof render !== "function" ? console.error("forwardRef requires a render function but was given %s.", render === null ? "null" : typeof render) : render.length !== 0 && render.length !== 2 && console.error("forwardRef render functions accept exactly two parameters: props and ref. %s", render.length === 1 ? "Did you forget to use the ref parameter?" : "Any additional parameter will be undefined.");
      render != null && render.defaultProps != null && console.error("forwardRef render functions do not support defaultProps. Did you accidentally pass a React component?");
      var elementType = { $$typeof: REACT_FORWARD_REF_TYPE, render }, ownName;
      Object.defineProperty(elementType, "displayName", {
        enumerable: false,
        configurable: true,
        get: function() {
          return ownName;
        },
        set: function(name) {
          ownName = name;
          render.name || render.displayName || (Object.defineProperty(render, "name", { value: name }), render.displayName = name);
        }
      });
      return elementType;
    };
    exports.isValidElement = isValidElement;
    exports.lazy = function(ctor) {
      ctor = { _status: -1, _result: ctor };
      var lazyType = {
        $$typeof: REACT_LAZY_TYPE,
        _payload: ctor,
        _init: lazyInitializer
      }, ioInfo = {
        name: "lazy",
        start: -1,
        end: -1,
        value: null,
        owner: null,
        debugStack: Error("react-stack-top-frame"),
        debugTask: console.createTask ? console.createTask("lazy()") : null
      };
      ctor._ioInfo = ioInfo;
      lazyType._debugInfo = [{ awaited: ioInfo }];
      return lazyType;
    };
    exports.memo = function(type, compare) {
      type == null && console.error("memo: The first argument must be a component. Instead received: %s", type === null ? "null" : typeof type);
      compare = {
        $$typeof: REACT_MEMO_TYPE,
        type,
        compare: compare === undefined ? null : compare
      };
      var ownName;
      Object.defineProperty(compare, "displayName", {
        enumerable: false,
        configurable: true,
        get: function() {
          return ownName;
        },
        set: function(name) {
          ownName = name;
          type.name || type.displayName || (Object.defineProperty(type, "name", { value: name }), type.displayName = name);
        }
      });
      return compare;
    };
    exports.startTransition = startTransition;
    exports.unstable_useCacheRefresh = function() {
      return resolveDispatcher().useCacheRefresh();
    };
    exports.use = function(usable) {
      return resolveDispatcher().use(usable);
    };
    exports.useActionState = function(action, initialState, permalink) {
      return resolveDispatcher().useActionState(action, initialState, permalink);
    };
    exports.useCallback = function(callback, deps) {
      return resolveDispatcher().useCallback(callback, deps);
    };
    exports.useContext = function(Context) {
      var dispatcher = resolveDispatcher();
      Context.$$typeof === REACT_CONSUMER_TYPE && console.error("Calling useContext(Context.Consumer) is not supported and will cause bugs. Did you mean to call useContext(Context) instead?");
      return dispatcher.useContext(Context);
    };
    exports.useDebugValue = function(value, formatterFn) {
      return resolveDispatcher().useDebugValue(value, formatterFn);
    };
    exports.useDeferredValue = function(value, initialValue) {
      return resolveDispatcher().useDeferredValue(value, initialValue);
    };
    exports.useEffect = function(create, deps) {
      create == null && console.warn("React Hook useEffect requires an effect callback. Did you forget to pass a callback to the hook?");
      return resolveDispatcher().useEffect(create, deps);
    };
    exports.useEffectEvent = function(callback) {
      return resolveDispatcher().useEffectEvent(callback);
    };
    exports.useId = function() {
      return resolveDispatcher().useId();
    };
    exports.useImperativeHandle = function(ref, create, deps) {
      return resolveDispatcher().useImperativeHandle(ref, create, deps);
    };
    exports.useInsertionEffect = function(create, deps) {
      create == null && console.warn("React Hook useInsertionEffect requires an effect callback. Did you forget to pass a callback to the hook?");
      return resolveDispatcher().useInsertionEffect(create, deps);
    };
    exports.useLayoutEffect = function(create, deps) {
      create == null && console.warn("React Hook useLayoutEffect requires an effect callback. Did you forget to pass a callback to the hook?");
      return resolveDispatcher().useLayoutEffect(create, deps);
    };
    exports.useMemo = function(create, deps) {
      return resolveDispatcher().useMemo(create, deps);
    };
    exports.useOptimistic = function(passthrough, reducer) {
      return resolveDispatcher().useOptimistic(passthrough, reducer);
    };
    exports.useReducer = function(reducer, initialArg, init) {
      return resolveDispatcher().useReducer(reducer, initialArg, init);
    };
    exports.useRef = function(initialValue) {
      return resolveDispatcher().useRef(initialValue);
    };
    exports.useState = function(initialState) {
      return resolveDispatcher().useState(initialState);
    };
    exports.useSyncExternalStore = function(subscribe, getSnapshot, getServerSnapshot) {
      return resolveDispatcher().useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    };
    exports.useTransition = function() {
      return resolveDispatcher().useTransition();
    };
    exports.version = "19.3.1";
    typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop === "function" && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
  })();
});

// node_modules/react/index.js
var require_react = __commonJS(function(exports, module) {
  var react_development = __toESM(require_react_development());
  if (false) {} else {
    module.exports = react_development;
  }
});

// node_modules/react/cjs/react-jsx-runtime.development.js
var require_react_jsx_runtime_development = __commonJS(function(exports) {
  var React = __toESM(require_react());
  (function() {
    function getComponentNameFromType(type) {
      if (type == null)
        return null;
      if (typeof type === "function")
        return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
      if (typeof type === "string")
        return type;
      switch (type) {
        case REACT_FRAGMENT_TYPE:
          return "Fragment";
        case REACT_PROFILER_TYPE:
          return "Profiler";
        case REACT_STRICT_MODE_TYPE:
          return "StrictMode";
        case REACT_SUSPENSE_TYPE:
          return "Suspense";
        case REACT_SUSPENSE_LIST_TYPE:
          return "SuspenseList";
        case REACT_ACTIVITY_TYPE:
          return "Activity";
        case REACT_VIEW_TRANSITION_TYPE:
          return "ViewTransition";
      }
      if (typeof type === "object")
        switch (typeof type.tag === "number" && console.error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."), type.$$typeof) {
          case REACT_PORTAL_TYPE:
            return "Portal";
          case REACT_CONTEXT_TYPE:
            return type.displayName || "Context";
          case REACT_CONSUMER_TYPE:
            return (type._context.displayName || "Context") + ".Consumer";
          case REACT_FORWARD_REF_TYPE:
            var innerType = type.render;
            type = type.displayName;
            type || (type = innerType.displayName || innerType.name || "", type = type !== "" ? "ForwardRef(" + type + ")" : "ForwardRef");
            return type;
          case REACT_MEMO_TYPE:
            return innerType = type.displayName || null, innerType !== null ? innerType : getComponentNameFromType(type.type) || "Memo";
          case REACT_LAZY_TYPE:
            innerType = type._payload;
            type = type._init;
            try {
              return getComponentNameFromType(type(innerType));
            } catch (x) {}
        }
      return null;
    }
    function testStringCoercion(value) {
      return "" + value;
    }
    function checkKeyStringCoercion(value) {
      try {
        testStringCoercion(value);
        var JSCompiler_inline_result = false;
      } catch (e) {
        JSCompiler_inline_result = true;
      }
      if (JSCompiler_inline_result) {
        JSCompiler_inline_result = console;
        var JSCompiler_temp_const = JSCompiler_inline_result.error;
        var JSCompiler_inline_result$jscomp$0 = typeof Symbol === "function" && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
        JSCompiler_temp_const.call(JSCompiler_inline_result, "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.", JSCompiler_inline_result$jscomp$0);
        return testStringCoercion(value);
      }
    }
    function getTaskName(type) {
      if (type === REACT_FRAGMENT_TYPE)
        return "<>";
      if (typeof type === "object" && type !== null && type.$$typeof === REACT_LAZY_TYPE)
        return "<...>";
      try {
        var name = getComponentNameFromType(type);
        return name ? "<" + name + ">" : "<...>";
      } catch (x) {
        return "<...>";
      }
    }
    function getOwner() {
      var dispatcher = ReactSharedInternals.A;
      return dispatcher === null ? null : dispatcher.getOwner();
    }
    function UnknownOwner() {
      return Error("react-stack-top-frame");
    }
    function hasValidKey(config) {
      if (hasOwnProperty.call(config, "key")) {
        var getter = Object.getOwnPropertyDescriptor(config, "key").get;
        if (getter && getter.isReactWarning)
          return false;
      }
      return config.key !== undefined;
    }
    function defineKeyPropWarningGetter(props, displayName) {
      function warnAboutAccessingKey() {
        specialPropKeyWarningShown || (specialPropKeyWarningShown = true, console.error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)", displayName));
      }
      warnAboutAccessingKey.isReactWarning = true;
      Object.defineProperty(props, "key", {
        get: warnAboutAccessingKey,
        configurable: true
      });
    }
    function elementRefGetterWithDeprecationWarning() {
      var componentName = getComponentNameFromType(this.type);
      didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = true, console.error("Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."));
      componentName = this.props.ref;
      return componentName !== undefined ? componentName : null;
    }
    function ReactElement(type, key, props, owner, debugStack, debugTask) {
      var refProp = props.ref;
      type = {
        $$typeof: REACT_ELEMENT_TYPE,
        type,
        key,
        props,
        _owner: owner
      };
      (refProp !== undefined ? refProp : null) !== null ? Object.defineProperty(type, "ref", {
        enumerable: false,
        get: elementRefGetterWithDeprecationWarning
      }) : Object.defineProperty(type, "ref", { enumerable: false, value: null });
      type._store = {};
      Object.defineProperty(type._store, "validated", {
        configurable: false,
        enumerable: false,
        writable: true,
        value: 0
      });
      Object.defineProperty(type, "_debugInfo", {
        configurable: false,
        enumerable: false,
        writable: true,
        value: null
      });
      Object.defineProperty(type, "_debugStack", {
        configurable: false,
        enumerable: false,
        writable: true,
        value: debugStack
      });
      Object.defineProperty(type, "_debugTask", {
        configurable: false,
        enumerable: false,
        writable: true,
        value: debugTask
      });
      Object.freeze && (Object.freeze(type.props), Object.freeze(type));
      return type;
    }
    function jsxDEVImpl(type, config, maybeKey, isStaticChildren, debugStack, debugTask) {
      var children = config.children;
      if (children !== undefined)
        if (isStaticChildren)
          if (isArrayImpl(children)) {
            for (isStaticChildren = 0;isStaticChildren < children.length; isStaticChildren++)
              validateChildKeys(children[isStaticChildren]);
            Object.freeze && Object.freeze(children);
          } else
            console.error("React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead.");
        else
          validateChildKeys(children);
      if (hasOwnProperty.call(config, "key")) {
        children = getComponentNameFromType(type);
        var keys = Object.keys(config).filter(function(k) {
          return k !== "key";
        });
        isStaticChildren = 0 < keys.length ? "{key: someKey, " + keys.join(": ..., ") + ": ...}" : "{key: someKey}";
        didWarnAboutKeySpread[children + isStaticChildren] || (keys = 0 < keys.length ? "{" + keys.join(": ..., ") + ": ...}" : "{}", console.error(`A props object containing a "key" prop is being spread into JSX:
  let props = %s;
  <%s {...props} />
React keys must be passed directly to JSX without using spread:
  let props = %s;
  <%s key={someKey} {...props} />`, isStaticChildren, children, keys, children), didWarnAboutKeySpread[children + isStaticChildren] = true);
      }
      children = null;
      maybeKey !== undefined && (checkKeyStringCoercion(maybeKey), children = "" + maybeKey);
      hasValidKey(config) && (checkKeyStringCoercion(config.key), children = "" + config.key);
      if ("key" in config) {
        maybeKey = {};
        for (var propName in config)
          propName !== "key" && (maybeKey[propName] = config[propName]);
      } else
        maybeKey = config;
      children && defineKeyPropWarningGetter(maybeKey, typeof type === "function" ? type.displayName || type.name || "Unknown" : type);
      return ReactElement(type, children, maybeKey, getOwner(), debugStack, debugTask);
    }
    function validateChildKeys(node) {
      isValidElement(node) ? node._store && (node._store.validated = 1) : typeof node === "object" && node !== null && node.$$typeof === REACT_LAZY_TYPE && (node._payload.status === "fulfilled" ? isValidElement(node._payload.value) && node._payload.value._store && (node._payload.value._store.validated = 1) : node._store && (node._store.validated = 1));
    }
    function isValidElement(object) {
      return typeof object === "object" && object !== null && object.$$typeof === REACT_ELEMENT_TYPE;
    }
    var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = Symbol.for("react.activity"), REACT_VIEW_TRANSITION_TYPE = Symbol.for("react.view_transition"), REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference"), ReactSharedInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, hasOwnProperty = Object.prototype.hasOwnProperty, isArrayImpl = Array.isArray, createTask = console.createTask ? console.createTask : function() {
      return null;
    };
    React = {
      react_stack_bottom_frame: function(callStackForError) {
        return callStackForError();
      }
    };
    var specialPropKeyWarningShown;
    var didWarnAboutElementRef = {};
    var unknownOwnerDebugStack = React.react_stack_bottom_frame.bind(React, UnknownOwner)();
    var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
    var didWarnAboutKeySpread = {};
    exports.Fragment = REACT_FRAGMENT_TYPE;
    exports.jsx = function(type, config, maybeKey) {
      var trackActualOwner = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
      if (trackActualOwner) {
        var previousStackTraceLimit = Error.stackTraceLimit;
        Error.stackTraceLimit = 10;
        var debugStackDEV = Error("react-stack-top-frame");
        Error.stackTraceLimit = previousStackTraceLimit;
      } else
        debugStackDEV = unknownOwnerDebugStack;
      return jsxDEVImpl(type, config, maybeKey, false, debugStackDEV, trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask);
    };
    exports.jsxs = function(type, config, maybeKey) {
      var trackActualOwner = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
      if (trackActualOwner) {
        var previousStackTraceLimit = Error.stackTraceLimit;
        Error.stackTraceLimit = 10;
        var debugStackDEV = Error("react-stack-top-frame");
        Error.stackTraceLimit = previousStackTraceLimit;
      } else
        debugStackDEV = unknownOwnerDebugStack;
      return jsxDEVImpl(type, config, maybeKey, true, debugStackDEV, trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask);
    };
  })();
});

// node_modules/react/jsx-runtime.js
var require_jsx_runtime = __commonJS(function(exports, module) {
  var react_jsx_runtime_development = __toESM(require_react_jsx_runtime_development());
  if (false) {} else {
    module.exports = react_jsx_runtime_development;
  }
});

// node_modules/react/cjs/react-jsx-dev-runtime.development.js
var require_react_jsx_dev_runtime_development = __commonJS(function(exports) {
  var React = __toESM(require_react());
  (function() {
    function getComponentNameFromType(type) {
      if (type == null)
        return null;
      if (typeof type === "function")
        return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
      if (typeof type === "string")
        return type;
      switch (type) {
        case REACT_FRAGMENT_TYPE:
          return "Fragment";
        case REACT_PROFILER_TYPE:
          return "Profiler";
        case REACT_STRICT_MODE_TYPE:
          return "StrictMode";
        case REACT_SUSPENSE_TYPE:
          return "Suspense";
        case REACT_SUSPENSE_LIST_TYPE:
          return "SuspenseList";
        case REACT_ACTIVITY_TYPE:
          return "Activity";
        case REACT_VIEW_TRANSITION_TYPE:
          return "ViewTransition";
      }
      if (typeof type === "object")
        switch (typeof type.tag === "number" && console.error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."), type.$$typeof) {
          case REACT_PORTAL_TYPE:
            return "Portal";
          case REACT_CONTEXT_TYPE:
            return type.displayName || "Context";
          case REACT_CONSUMER_TYPE:
            return (type._context.displayName || "Context") + ".Consumer";
          case REACT_FORWARD_REF_TYPE:
            var innerType = type.render;
            type = type.displayName;
            type || (type = innerType.displayName || innerType.name || "", type = type !== "" ? "ForwardRef(" + type + ")" : "ForwardRef");
            return type;
          case REACT_MEMO_TYPE:
            return innerType = type.displayName || null, innerType !== null ? innerType : getComponentNameFromType(type.type) || "Memo";
          case REACT_LAZY_TYPE:
            innerType = type._payload;
            type = type._init;
            try {
              return getComponentNameFromType(type(innerType));
            } catch (x) {}
        }
      return null;
    }
    function testStringCoercion(value) {
      return "" + value;
    }
    function checkKeyStringCoercion(value) {
      try {
        testStringCoercion(value);
        var JSCompiler_inline_result = false;
      } catch (e) {
        JSCompiler_inline_result = true;
      }
      if (JSCompiler_inline_result) {
        JSCompiler_inline_result = console;
        var JSCompiler_temp_const = JSCompiler_inline_result.error;
        var JSCompiler_inline_result$jscomp$0 = typeof Symbol === "function" && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
        JSCompiler_temp_const.call(JSCompiler_inline_result, "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.", JSCompiler_inline_result$jscomp$0);
        return testStringCoercion(value);
      }
    }
    function getTaskName(type) {
      if (type === REACT_FRAGMENT_TYPE)
        return "<>";
      if (typeof type === "object" && type !== null && type.$$typeof === REACT_LAZY_TYPE)
        return "<...>";
      try {
        var name = getComponentNameFromType(type);
        return name ? "<" + name + ">" : "<...>";
      } catch (x) {
        return "<...>";
      }
    }
    function getOwner() {
      var dispatcher = ReactSharedInternals.A;
      return dispatcher === null ? null : dispatcher.getOwner();
    }
    function UnknownOwner() {
      return Error("react-stack-top-frame");
    }
    function hasValidKey(config) {
      if (hasOwnProperty.call(config, "key")) {
        var getter = Object.getOwnPropertyDescriptor(config, "key").get;
        if (getter && getter.isReactWarning)
          return false;
      }
      return config.key !== undefined;
    }
    function defineKeyPropWarningGetter(props, displayName) {
      function warnAboutAccessingKey() {
        specialPropKeyWarningShown || (specialPropKeyWarningShown = true, console.error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)", displayName));
      }
      warnAboutAccessingKey.isReactWarning = true;
      Object.defineProperty(props, "key", {
        get: warnAboutAccessingKey,
        configurable: true
      });
    }
    function elementRefGetterWithDeprecationWarning() {
      var componentName = getComponentNameFromType(this.type);
      didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = true, console.error("Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."));
      componentName = this.props.ref;
      return componentName !== undefined ? componentName : null;
    }
    function ReactElement(type, key, props, owner, debugStack, debugTask) {
      var refProp = props.ref;
      type = {
        $$typeof: REACT_ELEMENT_TYPE,
        type,
        key,
        props,
        _owner: owner
      };
      (refProp !== undefined ? refProp : null) !== null ? Object.defineProperty(type, "ref", {
        enumerable: false,
        get: elementRefGetterWithDeprecationWarning
      }) : Object.defineProperty(type, "ref", { enumerable: false, value: null });
      type._store = {};
      Object.defineProperty(type._store, "validated", {
        configurable: false,
        enumerable: false,
        writable: true,
        value: 0
      });
      Object.defineProperty(type, "_debugInfo", {
        configurable: false,
        enumerable: false,
        writable: true,
        value: null
      });
      Object.defineProperty(type, "_debugStack", {
        configurable: false,
        enumerable: false,
        writable: true,
        value: debugStack
      });
      Object.defineProperty(type, "_debugTask", {
        configurable: false,
        enumerable: false,
        writable: true,
        value: debugTask
      });
      Object.freeze && (Object.freeze(type.props), Object.freeze(type));
      return type;
    }
    function jsxDEVImpl(type, config, maybeKey, isStaticChildren, debugStack, debugTask) {
      var children = config.children;
      if (children !== undefined)
        if (isStaticChildren)
          if (isArrayImpl(children)) {
            for (isStaticChildren = 0;isStaticChildren < children.length; isStaticChildren++)
              validateChildKeys(children[isStaticChildren]);
            Object.freeze && Object.freeze(children);
          } else
            console.error("React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead.");
        else
          validateChildKeys(children);
      if (hasOwnProperty.call(config, "key")) {
        children = getComponentNameFromType(type);
        var keys = Object.keys(config).filter(function(k) {
          return k !== "key";
        });
        isStaticChildren = 0 < keys.length ? "{key: someKey, " + keys.join(": ..., ") + ": ...}" : "{key: someKey}";
        didWarnAboutKeySpread[children + isStaticChildren] || (keys = 0 < keys.length ? "{" + keys.join(": ..., ") + ": ...}" : "{}", console.error(`A props object containing a "key" prop is being spread into JSX:
  let props = %s;
  <%s {...props} />
React keys must be passed directly to JSX without using spread:
  let props = %s;
  <%s key={someKey} {...props} />`, isStaticChildren, children, keys, children), didWarnAboutKeySpread[children + isStaticChildren] = true);
      }
      children = null;
      maybeKey !== undefined && (checkKeyStringCoercion(maybeKey), children = "" + maybeKey);
      hasValidKey(config) && (checkKeyStringCoercion(config.key), children = "" + config.key);
      if ("key" in config) {
        maybeKey = {};
        for (var propName in config)
          propName !== "key" && (maybeKey[propName] = config[propName]);
      } else
        maybeKey = config;
      children && defineKeyPropWarningGetter(maybeKey, typeof type === "function" ? type.displayName || type.name || "Unknown" : type);
      return ReactElement(type, children, maybeKey, getOwner(), debugStack, debugTask);
    }
    function validateChildKeys(node) {
      isValidElement(node) ? node._store && (node._store.validated = 1) : typeof node === "object" && node !== null && node.$$typeof === REACT_LAZY_TYPE && (node._payload.status === "fulfilled" ? isValidElement(node._payload.value) && node._payload.value._store && (node._payload.value._store.validated = 1) : node._store && (node._store.validated = 1));
    }
    function isValidElement(object) {
      return typeof object === "object" && object !== null && object.$$typeof === REACT_ELEMENT_TYPE;
    }
    var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = Symbol.for("react.activity"), REACT_VIEW_TRANSITION_TYPE = Symbol.for("react.view_transition"), REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference"), ReactSharedInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, hasOwnProperty = Object.prototype.hasOwnProperty, isArrayImpl = Array.isArray, createTask = console.createTask ? console.createTask : function() {
      return null;
    };
    React = {
      react_stack_bottom_frame: function(callStackForError) {
        return callStackForError();
      }
    };
    var specialPropKeyWarningShown;
    var didWarnAboutElementRef = {};
    var unknownOwnerDebugStack = React.react_stack_bottom_frame.bind(React, UnknownOwner)();
    var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
    var didWarnAboutKeySpread = {};
    exports.Fragment = REACT_FRAGMENT_TYPE;
    exports.jsxDEV = function(type, config, maybeKey, isStaticChildren) {
      var trackActualOwner = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
      if (trackActualOwner) {
        var previousStackTraceLimit = Error.stackTraceLimit;
        Error.stackTraceLimit = 10;
        var debugStackDEV = Error("react-stack-top-frame");
        Error.stackTraceLimit = previousStackTraceLimit;
      } else
        debugStackDEV = unknownOwnerDebugStack;
      return jsxDEVImpl(type, config, maybeKey, isStaticChildren, debugStackDEV, trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask);
    };
  })();
});

// node_modules/react/jsx-dev-runtime.js
var require_jsx_dev_runtime = __commonJS(function(exports, module) {
  var react_jsx_dev_runtime_development = __toESM(require_react_jsx_dev_runtime_development());
  if (false) {} else {
    module.exports = react_jsx_dev_runtime_development;
  }
});

// ../briefs/perf-html-sanitize/bench.ts
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadavg } from "node:os";

// lib/html/sanitize.ts
var import_sanitize_html = __toESM(require_sanitize_html(), 1);

// node_modules/postcss/lib/postcss.mjs
var import_postcss = __toESM(require_postcss(), 1);
var postcss_default = import_postcss.default;
var stringify2 = import_postcss.default.stringify;
var fromJSON = import_postcss.default.fromJSON;
var plugin = import_postcss.default.plugin;
var parse = import_postcss.default.parse;
var list = import_postcss.default.list;
var document = import_postcss.default.document;
var comment = import_postcss.default.comment;
var atRule = import_postcss.default.atRule;
var rule = import_postcss.default.rule;
var decl = import_postcss.default.decl;
var root = import_postcss.default.root;
var CssSyntaxError = import_postcss.default.CssSyntaxError;
var Declaration = import_postcss.default.Declaration;
var Container = import_postcss.default.Container;
var Processor = import_postcss.default.Processor;
var Document = import_postcss.default.Document;
var Comment2 = import_postcss.default.Comment;
var Warning = import_postcss.default.Warning;
var AtRule = import_postcss.default.AtRule;
var Result = import_postcss.default.Result;
var Input = import_postcss.default.Input;
var Rule = import_postcss.default.Rule;
var Root2 = import_postcss.default.Root;
var Node2 = import_postcss.default.Node;

// lib/html/remoteContent.ts
function senderAllowsRemoteContent(prefs, senderKey) {
  return !!senderKey && prefs.remoteContent?.allowedSenders?.[senderKey] === true;
}
function isLocalMailResource(value) {
  const url = value.trim();
  return /^(?:cid:|data:image\/|blob:)/i.test(url) || /^\/api\/accounts\/[^/?#\\]+\/messages\/[^/?#\\]+\/attachments\/[^/?#\\]+(?:\?[^#\\]*)?$/.test(url);
}
function messageHtmlCsp(mode = "block") {
  const remote = mode === "allow" ? " https: http:" : "";
  return `default-src 'none'; img-src 'self' data: cid: blob:${remote}; style-src 'unsafe-inline'; font-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'`;
}

// node_modules/parse5/dist/common/unicode.js
var UNDEFINED_CODE_POINTS = new Set([
  65534,
  65535,
  131070,
  131071,
  196606,
  196607,
  262142,
  262143,
  327678,
  327679,
  393214,
  393215,
  458750,
  458751,
  524286,
  524287,
  589822,
  589823,
  655358,
  655359,
  720894,
  720895,
  786430,
  786431,
  851966,
  851967,
  917502,
  917503,
  983038,
  983039,
  1048574,
  1048575,
  1114110,
  1114111
]);
var REPLACEMENT_CHARACTER = "�";
var CODE_POINTS;
(function(CODE_POINTS) {
  CODE_POINTS[CODE_POINTS["EOF"] = -1] = "EOF";
  CODE_POINTS[CODE_POINTS["NULL"] = 0] = "NULL";
  CODE_POINTS[CODE_POINTS["TABULATION"] = 9] = "TABULATION";
  CODE_POINTS[CODE_POINTS["CARRIAGE_RETURN"] = 13] = "CARRIAGE_RETURN";
  CODE_POINTS[CODE_POINTS["LINE_FEED"] = 10] = "LINE_FEED";
  CODE_POINTS[CODE_POINTS["FORM_FEED"] = 12] = "FORM_FEED";
  CODE_POINTS[CODE_POINTS["SPACE"] = 32] = "SPACE";
  CODE_POINTS[CODE_POINTS["EXCLAMATION_MARK"] = 33] = "EXCLAMATION_MARK";
  CODE_POINTS[CODE_POINTS["QUOTATION_MARK"] = 34] = "QUOTATION_MARK";
  CODE_POINTS[CODE_POINTS["AMPERSAND"] = 38] = "AMPERSAND";
  CODE_POINTS[CODE_POINTS["APOSTROPHE"] = 39] = "APOSTROPHE";
  CODE_POINTS[CODE_POINTS["HYPHEN_MINUS"] = 45] = "HYPHEN_MINUS";
  CODE_POINTS[CODE_POINTS["SOLIDUS"] = 47] = "SOLIDUS";
  CODE_POINTS[CODE_POINTS["DIGIT_0"] = 48] = "DIGIT_0";
  CODE_POINTS[CODE_POINTS["DIGIT_9"] = 57] = "DIGIT_9";
  CODE_POINTS[CODE_POINTS["SEMICOLON"] = 59] = "SEMICOLON";
  CODE_POINTS[CODE_POINTS["LESS_THAN_SIGN"] = 60] = "LESS_THAN_SIGN";
  CODE_POINTS[CODE_POINTS["EQUALS_SIGN"] = 61] = "EQUALS_SIGN";
  CODE_POINTS[CODE_POINTS["GREATER_THAN_SIGN"] = 62] = "GREATER_THAN_SIGN";
  CODE_POINTS[CODE_POINTS["QUESTION_MARK"] = 63] = "QUESTION_MARK";
  CODE_POINTS[CODE_POINTS["LATIN_CAPITAL_A"] = 65] = "LATIN_CAPITAL_A";
  CODE_POINTS[CODE_POINTS["LATIN_CAPITAL_Z"] = 90] = "LATIN_CAPITAL_Z";
  CODE_POINTS[CODE_POINTS["RIGHT_SQUARE_BRACKET"] = 93] = "RIGHT_SQUARE_BRACKET";
  CODE_POINTS[CODE_POINTS["GRAVE_ACCENT"] = 96] = "GRAVE_ACCENT";
  CODE_POINTS[CODE_POINTS["LATIN_SMALL_A"] = 97] = "LATIN_SMALL_A";
  CODE_POINTS[CODE_POINTS["LATIN_SMALL_Z"] = 122] = "LATIN_SMALL_Z";
})(CODE_POINTS || (CODE_POINTS = {}));
var SEQUENCES = {
  DASH_DASH: "--",
  CDATA_START: "[CDATA[",
  DOCTYPE: "doctype",
  SCRIPT: "script",
  PUBLIC: "public",
  SYSTEM: "system"
};
function isSurrogate(cp) {
  return cp >= 55296 && cp <= 57343;
}
function isSurrogatePair(cp) {
  return cp >= 56320 && cp <= 57343;
}
function getSurrogatePairCodePoint(cp1, cp2) {
  return (cp1 - 55296) * 1024 + 9216 + cp2;
}
function isControlCodePoint(cp) {
  return cp !== 32 && cp !== 10 && cp !== 13 && cp !== 9 && cp !== 12 && cp >= 1 && cp <= 31 || cp >= 127 && cp <= 159;
}
function isUndefinedCodePoint(cp) {
  return cp >= 64976 && cp <= 65007 || UNDEFINED_CODE_POINTS.has(cp);
}

// node_modules/parse5/dist/common/error-codes.js
var ERR;
(function(ERR) {
  ERR["controlCharacterInInputStream"] = "control-character-in-input-stream";
  ERR["noncharacterInInputStream"] = "noncharacter-in-input-stream";
  ERR["surrogateInInputStream"] = "surrogate-in-input-stream";
  ERR["nonVoidHtmlElementStartTagWithTrailingSolidus"] = "non-void-html-element-start-tag-with-trailing-solidus";
  ERR["endTagWithAttributes"] = "end-tag-with-attributes";
  ERR["endTagWithTrailingSolidus"] = "end-tag-with-trailing-solidus";
  ERR["unexpectedSolidusInTag"] = "unexpected-solidus-in-tag";
  ERR["unexpectedNullCharacter"] = "unexpected-null-character";
  ERR["unexpectedQuestionMarkInsteadOfTagName"] = "unexpected-question-mark-instead-of-tag-name";
  ERR["invalidFirstCharacterOfTagName"] = "invalid-first-character-of-tag-name";
  ERR["unexpectedEqualsSignBeforeAttributeName"] = "unexpected-equals-sign-before-attribute-name";
  ERR["missingEndTagName"] = "missing-end-tag-name";
  ERR["unexpectedCharacterInAttributeName"] = "unexpected-character-in-attribute-name";
  ERR["unknownNamedCharacterReference"] = "unknown-named-character-reference";
  ERR["missingSemicolonAfterCharacterReference"] = "missing-semicolon-after-character-reference";
  ERR["unexpectedCharacterAfterDoctypeSystemIdentifier"] = "unexpected-character-after-doctype-system-identifier";
  ERR["unexpectedCharacterInUnquotedAttributeValue"] = "unexpected-character-in-unquoted-attribute-value";
  ERR["eofBeforeTagName"] = "eof-before-tag-name";
  ERR["eofInTag"] = "eof-in-tag";
  ERR["missingAttributeValue"] = "missing-attribute-value";
  ERR["missingWhitespaceBetweenAttributes"] = "missing-whitespace-between-attributes";
  ERR["missingWhitespaceAfterDoctypePublicKeyword"] = "missing-whitespace-after-doctype-public-keyword";
  ERR["missingWhitespaceBetweenDoctypePublicAndSystemIdentifiers"] = "missing-whitespace-between-doctype-public-and-system-identifiers";
  ERR["missingWhitespaceAfterDoctypeSystemKeyword"] = "missing-whitespace-after-doctype-system-keyword";
  ERR["missingQuoteBeforeDoctypePublicIdentifier"] = "missing-quote-before-doctype-public-identifier";
  ERR["missingQuoteBeforeDoctypeSystemIdentifier"] = "missing-quote-before-doctype-system-identifier";
  ERR["missingDoctypePublicIdentifier"] = "missing-doctype-public-identifier";
  ERR["missingDoctypeSystemIdentifier"] = "missing-doctype-system-identifier";
  ERR["abruptDoctypePublicIdentifier"] = "abrupt-doctype-public-identifier";
  ERR["abruptDoctypeSystemIdentifier"] = "abrupt-doctype-system-identifier";
  ERR["cdataInHtmlContent"] = "cdata-in-html-content";
  ERR["incorrectlyOpenedComment"] = "incorrectly-opened-comment";
  ERR["eofInScriptHtmlCommentLikeText"] = "eof-in-script-html-comment-like-text";
  ERR["eofInDoctype"] = "eof-in-doctype";
  ERR["nestedComment"] = "nested-comment";
  ERR["abruptClosingOfEmptyComment"] = "abrupt-closing-of-empty-comment";
  ERR["eofInComment"] = "eof-in-comment";
  ERR["incorrectlyClosedComment"] = "incorrectly-closed-comment";
  ERR["eofInCdata"] = "eof-in-cdata";
  ERR["absenceOfDigitsInNumericCharacterReference"] = "absence-of-digits-in-numeric-character-reference";
  ERR["nullCharacterReference"] = "null-character-reference";
  ERR["surrogateCharacterReference"] = "surrogate-character-reference";
  ERR["characterReferenceOutsideUnicodeRange"] = "character-reference-outside-unicode-range";
  ERR["controlCharacterReference"] = "control-character-reference";
  ERR["noncharacterCharacterReference"] = "noncharacter-character-reference";
  ERR["missingWhitespaceBeforeDoctypeName"] = "missing-whitespace-before-doctype-name";
  ERR["missingDoctypeName"] = "missing-doctype-name";
  ERR["invalidCharacterSequenceAfterDoctypeName"] = "invalid-character-sequence-after-doctype-name";
  ERR["duplicateAttribute"] = "duplicate-attribute";
  ERR["nonConformingDoctype"] = "non-conforming-doctype";
  ERR["missingDoctype"] = "missing-doctype";
  ERR["misplacedDoctype"] = "misplaced-doctype";
  ERR["endTagWithoutMatchingOpenElement"] = "end-tag-without-matching-open-element";
  ERR["closingOfElementWithOpenChildElements"] = "closing-of-element-with-open-child-elements";
  ERR["disallowedContentInNoscriptInHead"] = "disallowed-content-in-noscript-in-head";
  ERR["openElementsLeftAfterEof"] = "open-elements-left-after-eof";
  ERR["abandonedHeadElementChild"] = "abandoned-head-element-child";
  ERR["misplacedStartTagForHeadElement"] = "misplaced-start-tag-for-head-element";
  ERR["nestedNoscriptInHead"] = "nested-noscript-in-head";
  ERR["eofInElementThatCanContainOnlyText"] = "eof-in-element-that-can-contain-only-text";
})(ERR || (ERR = {}));

// node_modules/parse5/dist/tokenizer/preprocessor.js
var DEFAULT_BUFFER_WATERLINE = 1 << 16;

class Preprocessor {
  constructor(handler) {
    this.handler = handler;
    this.html = "";
    this.pos = -1;
    this.lastGapPos = -2;
    this.gapStack = [];
    this.skipNextNewLine = false;
    this.lastChunkWritten = false;
    this.endOfChunkHit = false;
    this.bufferWaterline = DEFAULT_BUFFER_WATERLINE;
    this.isEol = false;
    this.lineStartPos = 0;
    this.droppedBufferSize = 0;
    this.line = 1;
    this.lastErrOffset = -1;
  }
  get col() {
    return this.pos - this.lineStartPos + Number(this.lastGapPos !== this.pos);
  }
  get offset() {
    return this.droppedBufferSize + this.pos;
  }
  getError(code, cpOffset) {
    const { line, col, offset } = this;
    const startCol = col + cpOffset;
    const startOffset = offset + cpOffset;
    return {
      code,
      startLine: line,
      endLine: line,
      startCol,
      endCol: startCol,
      startOffset,
      endOffset: startOffset
    };
  }
  _err(code) {
    if (this.handler.onParseError && this.lastErrOffset !== this.offset) {
      this.lastErrOffset = this.offset;
      this.handler.onParseError(this.getError(code, 0));
    }
  }
  _addGap() {
    this.gapStack.push(this.lastGapPos);
    this.lastGapPos = this.pos;
  }
  _processSurrogate(cp) {
    if (this.pos !== this.html.length - 1) {
      const nextCp = this.html.charCodeAt(this.pos + 1);
      if (isSurrogatePair(nextCp)) {
        this.pos++;
        this._addGap();
        return getSurrogatePairCodePoint(cp, nextCp);
      }
    } else if (!this.lastChunkWritten) {
      this.endOfChunkHit = true;
      return CODE_POINTS.EOF;
    }
    this._err(ERR.surrogateInInputStream);
    return cp;
  }
  willDropParsedChunk() {
    return this.pos > this.bufferWaterline;
  }
  dropParsedChunk() {
    if (this.willDropParsedChunk()) {
      this.html = this.html.substring(this.pos);
      this.lineStartPos -= this.pos;
      this.droppedBufferSize += this.pos;
      this.pos = 0;
      this.lastGapPos = -2;
      this.gapStack.length = 0;
    }
  }
  write(chunk, isLastChunk) {
    if (this.html.length > 0) {
      this.html += chunk;
    } else {
      this.html = chunk;
    }
    this.endOfChunkHit = false;
    this.lastChunkWritten = isLastChunk;
  }
  insertHtmlAtCurrentPos(chunk) {
    this.html = this.html.substring(0, this.pos + 1) + chunk + this.html.substring(this.pos + 1);
    this.endOfChunkHit = false;
  }
  startsWith(pattern, caseSensitive) {
    if (this.pos + pattern.length > this.html.length) {
      this.endOfChunkHit = !this.lastChunkWritten;
      return false;
    }
    if (caseSensitive) {
      return this.html.startsWith(pattern, this.pos);
    }
    for (let i = 0;i < pattern.length; i++) {
      const cp = this.html.charCodeAt(this.pos + i) | 32;
      if (cp !== pattern.charCodeAt(i)) {
        return false;
      }
    }
    return true;
  }
  peek(offset) {
    const pos = this.pos + offset;
    if (pos >= this.html.length) {
      this.endOfChunkHit = !this.lastChunkWritten;
      return CODE_POINTS.EOF;
    }
    const code = this.html.charCodeAt(pos);
    return code === CODE_POINTS.CARRIAGE_RETURN ? CODE_POINTS.LINE_FEED : code;
  }
  advance() {
    this.pos++;
    if (this.isEol) {
      this.isEol = false;
      this.line++;
      this.lineStartPos = this.pos;
    }
    if (this.pos >= this.html.length) {
      this.endOfChunkHit = !this.lastChunkWritten;
      return CODE_POINTS.EOF;
    }
    let cp = this.html.charCodeAt(this.pos);
    if (cp === CODE_POINTS.CARRIAGE_RETURN) {
      this.isEol = true;
      this.skipNextNewLine = true;
      return CODE_POINTS.LINE_FEED;
    }
    if (cp === CODE_POINTS.LINE_FEED) {
      this.isEol = true;
      if (this.skipNextNewLine) {
        this.line--;
        this.skipNextNewLine = false;
        this._addGap();
        return this.advance();
      }
    }
    this.skipNextNewLine = false;
    if (isSurrogate(cp)) {
      cp = this._processSurrogate(cp);
    }
    const isCommonValidRange = this.handler.onParseError === null || cp > 31 && cp < 127 || cp === CODE_POINTS.LINE_FEED || cp === CODE_POINTS.CARRIAGE_RETURN || cp > 159 && cp < 64976;
    if (!isCommonValidRange) {
      this._checkForProblematicCharacters(cp);
    }
    return cp;
  }
  _checkForProblematicCharacters(cp) {
    if (isControlCodePoint(cp)) {
      this._err(ERR.controlCharacterInInputStream);
    } else if (isUndefinedCodePoint(cp)) {
      this._err(ERR.noncharacterInInputStream);
    }
  }
  retreat(count) {
    this.pos -= count;
    while (this.pos < this.lastGapPos) {
      this.lastGapPos = this.gapStack.pop();
      this.pos--;
    }
    this.isEol = false;
  }
}

// node_modules/parse5/dist/common/token.js
var TokenType;
(function(TokenType) {
  TokenType[TokenType["CHARACTER"] = 0] = "CHARACTER";
  TokenType[TokenType["NULL_CHARACTER"] = 1] = "NULL_CHARACTER";
  TokenType[TokenType["WHITESPACE_CHARACTER"] = 2] = "WHITESPACE_CHARACTER";
  TokenType[TokenType["START_TAG"] = 3] = "START_TAG";
  TokenType[TokenType["END_TAG"] = 4] = "END_TAG";
  TokenType[TokenType["COMMENT"] = 5] = "COMMENT";
  TokenType[TokenType["DOCTYPE"] = 6] = "DOCTYPE";
  TokenType[TokenType["EOF"] = 7] = "EOF";
  TokenType[TokenType["HIBERNATION"] = 8] = "HIBERNATION";
})(TokenType || (TokenType = {}));
function getTokenAttr(token, attrName) {
  for (let i = token.attrs.length - 1;i >= 0; i--) {
    if (token.attrs[i].name === attrName) {
      return token.attrs[i].value;
    }
  }
  return null;
}

// node_modules/parse5/dist/tokenizer/index.js
init_decode();

// node_modules/parse5/dist/common/html.js
var NS;
(function(NS) {
  NS["HTML"] = "http://www.w3.org/1999/xhtml";
  NS["MATHML"] = "http://www.w3.org/1998/Math/MathML";
  NS["SVG"] = "http://www.w3.org/2000/svg";
  NS["XLINK"] = "http://www.w3.org/1999/xlink";
  NS["XML"] = "http://www.w3.org/XML/1998/namespace";
  NS["XMLNS"] = "http://www.w3.org/2000/xmlns/";
})(NS || (NS = {}));
var ATTRS;
(function(ATTRS) {
  ATTRS["TYPE"] = "type";
  ATTRS["ACTION"] = "action";
  ATTRS["ENCODING"] = "encoding";
  ATTRS["PROMPT"] = "prompt";
  ATTRS["NAME"] = "name";
  ATTRS["COLOR"] = "color";
  ATTRS["FACE"] = "face";
  ATTRS["SIZE"] = "size";
})(ATTRS || (ATTRS = {}));
var DOCUMENT_MODE;
(function(DOCUMENT_MODE) {
  DOCUMENT_MODE["NO_QUIRKS"] = "no-quirks";
  DOCUMENT_MODE["QUIRKS"] = "quirks";
  DOCUMENT_MODE["LIMITED_QUIRKS"] = "limited-quirks";
})(DOCUMENT_MODE || (DOCUMENT_MODE = {}));
var TAG_NAMES;
(function(TAG_NAMES) {
  TAG_NAMES["A"] = "a";
  TAG_NAMES["ADDRESS"] = "address";
  TAG_NAMES["ANNOTATION_XML"] = "annotation-xml";
  TAG_NAMES["APPLET"] = "applet";
  TAG_NAMES["AREA"] = "area";
  TAG_NAMES["ARTICLE"] = "article";
  TAG_NAMES["ASIDE"] = "aside";
  TAG_NAMES["B"] = "b";
  TAG_NAMES["BASE"] = "base";
  TAG_NAMES["BASEFONT"] = "basefont";
  TAG_NAMES["BGSOUND"] = "bgsound";
  TAG_NAMES["BIG"] = "big";
  TAG_NAMES["BLOCKQUOTE"] = "blockquote";
  TAG_NAMES["BODY"] = "body";
  TAG_NAMES["BR"] = "br";
  TAG_NAMES["BUTTON"] = "button";
  TAG_NAMES["CAPTION"] = "caption";
  TAG_NAMES["CENTER"] = "center";
  TAG_NAMES["CODE"] = "code";
  TAG_NAMES["COL"] = "col";
  TAG_NAMES["COLGROUP"] = "colgroup";
  TAG_NAMES["DD"] = "dd";
  TAG_NAMES["DESC"] = "desc";
  TAG_NAMES["DETAILS"] = "details";
  TAG_NAMES["DIALOG"] = "dialog";
  TAG_NAMES["DIR"] = "dir";
  TAG_NAMES["DIV"] = "div";
  TAG_NAMES["DL"] = "dl";
  TAG_NAMES["DT"] = "dt";
  TAG_NAMES["EM"] = "em";
  TAG_NAMES["EMBED"] = "embed";
  TAG_NAMES["FIELDSET"] = "fieldset";
  TAG_NAMES["FIGCAPTION"] = "figcaption";
  TAG_NAMES["FIGURE"] = "figure";
  TAG_NAMES["FONT"] = "font";
  TAG_NAMES["FOOTER"] = "footer";
  TAG_NAMES["FOREIGN_OBJECT"] = "foreignObject";
  TAG_NAMES["FORM"] = "form";
  TAG_NAMES["FRAME"] = "frame";
  TAG_NAMES["FRAMESET"] = "frameset";
  TAG_NAMES["H1"] = "h1";
  TAG_NAMES["H2"] = "h2";
  TAG_NAMES["H3"] = "h3";
  TAG_NAMES["H4"] = "h4";
  TAG_NAMES["H5"] = "h5";
  TAG_NAMES["H6"] = "h6";
  TAG_NAMES["HEAD"] = "head";
  TAG_NAMES["HEADER"] = "header";
  TAG_NAMES["HGROUP"] = "hgroup";
  TAG_NAMES["HR"] = "hr";
  TAG_NAMES["HTML"] = "html";
  TAG_NAMES["I"] = "i";
  TAG_NAMES["IMG"] = "img";
  TAG_NAMES["IMAGE"] = "image";
  TAG_NAMES["INPUT"] = "input";
  TAG_NAMES["IFRAME"] = "iframe";
  TAG_NAMES["KEYGEN"] = "keygen";
  TAG_NAMES["LABEL"] = "label";
  TAG_NAMES["LI"] = "li";
  TAG_NAMES["LINK"] = "link";
  TAG_NAMES["LISTING"] = "listing";
  TAG_NAMES["MAIN"] = "main";
  TAG_NAMES["MALIGNMARK"] = "malignmark";
  TAG_NAMES["MARQUEE"] = "marquee";
  TAG_NAMES["MATH"] = "math";
  TAG_NAMES["MENU"] = "menu";
  TAG_NAMES["META"] = "meta";
  TAG_NAMES["MGLYPH"] = "mglyph";
  TAG_NAMES["MI"] = "mi";
  TAG_NAMES["MO"] = "mo";
  TAG_NAMES["MN"] = "mn";
  TAG_NAMES["MS"] = "ms";
  TAG_NAMES["MTEXT"] = "mtext";
  TAG_NAMES["NAV"] = "nav";
  TAG_NAMES["NOBR"] = "nobr";
  TAG_NAMES["NOFRAMES"] = "noframes";
  TAG_NAMES["NOEMBED"] = "noembed";
  TAG_NAMES["NOSCRIPT"] = "noscript";
  TAG_NAMES["OBJECT"] = "object";
  TAG_NAMES["OL"] = "ol";
  TAG_NAMES["OPTGROUP"] = "optgroup";
  TAG_NAMES["OPTION"] = "option";
  TAG_NAMES["P"] = "p";
  TAG_NAMES["PARAM"] = "param";
  TAG_NAMES["PLAINTEXT"] = "plaintext";
  TAG_NAMES["PRE"] = "pre";
  TAG_NAMES["RB"] = "rb";
  TAG_NAMES["RP"] = "rp";
  TAG_NAMES["RT"] = "rt";
  TAG_NAMES["RTC"] = "rtc";
  TAG_NAMES["RUBY"] = "ruby";
  TAG_NAMES["S"] = "s";
  TAG_NAMES["SCRIPT"] = "script";
  TAG_NAMES["SEARCH"] = "search";
  TAG_NAMES["SECTION"] = "section";
  TAG_NAMES["SELECT"] = "select";
  TAG_NAMES["SOURCE"] = "source";
  TAG_NAMES["SMALL"] = "small";
  TAG_NAMES["SPAN"] = "span";
  TAG_NAMES["STRIKE"] = "strike";
  TAG_NAMES["STRONG"] = "strong";
  TAG_NAMES["STYLE"] = "style";
  TAG_NAMES["SUB"] = "sub";
  TAG_NAMES["SUMMARY"] = "summary";
  TAG_NAMES["SUP"] = "sup";
  TAG_NAMES["TABLE"] = "table";
  TAG_NAMES["TBODY"] = "tbody";
  TAG_NAMES["TEMPLATE"] = "template";
  TAG_NAMES["TEXTAREA"] = "textarea";
  TAG_NAMES["TFOOT"] = "tfoot";
  TAG_NAMES["TD"] = "td";
  TAG_NAMES["TH"] = "th";
  TAG_NAMES["THEAD"] = "thead";
  TAG_NAMES["TITLE"] = "title";
  TAG_NAMES["TR"] = "tr";
  TAG_NAMES["TRACK"] = "track";
  TAG_NAMES["TT"] = "tt";
  TAG_NAMES["U"] = "u";
  TAG_NAMES["UL"] = "ul";
  TAG_NAMES["SVG"] = "svg";
  TAG_NAMES["VAR"] = "var";
  TAG_NAMES["WBR"] = "wbr";
  TAG_NAMES["XMP"] = "xmp";
})(TAG_NAMES || (TAG_NAMES = {}));
var TAG_ID;
(function(TAG_ID) {
  TAG_ID[TAG_ID["UNKNOWN"] = 0] = "UNKNOWN";
  TAG_ID[TAG_ID["A"] = 1] = "A";
  TAG_ID[TAG_ID["ADDRESS"] = 2] = "ADDRESS";
  TAG_ID[TAG_ID["ANNOTATION_XML"] = 3] = "ANNOTATION_XML";
  TAG_ID[TAG_ID["APPLET"] = 4] = "APPLET";
  TAG_ID[TAG_ID["AREA"] = 5] = "AREA";
  TAG_ID[TAG_ID["ARTICLE"] = 6] = "ARTICLE";
  TAG_ID[TAG_ID["ASIDE"] = 7] = "ASIDE";
  TAG_ID[TAG_ID["B"] = 8] = "B";
  TAG_ID[TAG_ID["BASE"] = 9] = "BASE";
  TAG_ID[TAG_ID["BASEFONT"] = 10] = "BASEFONT";
  TAG_ID[TAG_ID["BGSOUND"] = 11] = "BGSOUND";
  TAG_ID[TAG_ID["BIG"] = 12] = "BIG";
  TAG_ID[TAG_ID["BLOCKQUOTE"] = 13] = "BLOCKQUOTE";
  TAG_ID[TAG_ID["BODY"] = 14] = "BODY";
  TAG_ID[TAG_ID["BR"] = 15] = "BR";
  TAG_ID[TAG_ID["BUTTON"] = 16] = "BUTTON";
  TAG_ID[TAG_ID["CAPTION"] = 17] = "CAPTION";
  TAG_ID[TAG_ID["CENTER"] = 18] = "CENTER";
  TAG_ID[TAG_ID["CODE"] = 19] = "CODE";
  TAG_ID[TAG_ID["COL"] = 20] = "COL";
  TAG_ID[TAG_ID["COLGROUP"] = 21] = "COLGROUP";
  TAG_ID[TAG_ID["DD"] = 22] = "DD";
  TAG_ID[TAG_ID["DESC"] = 23] = "DESC";
  TAG_ID[TAG_ID["DETAILS"] = 24] = "DETAILS";
  TAG_ID[TAG_ID["DIALOG"] = 25] = "DIALOG";
  TAG_ID[TAG_ID["DIR"] = 26] = "DIR";
  TAG_ID[TAG_ID["DIV"] = 27] = "DIV";
  TAG_ID[TAG_ID["DL"] = 28] = "DL";
  TAG_ID[TAG_ID["DT"] = 29] = "DT";
  TAG_ID[TAG_ID["EM"] = 30] = "EM";
  TAG_ID[TAG_ID["EMBED"] = 31] = "EMBED";
  TAG_ID[TAG_ID["FIELDSET"] = 32] = "FIELDSET";
  TAG_ID[TAG_ID["FIGCAPTION"] = 33] = "FIGCAPTION";
  TAG_ID[TAG_ID["FIGURE"] = 34] = "FIGURE";
  TAG_ID[TAG_ID["FONT"] = 35] = "FONT";
  TAG_ID[TAG_ID["FOOTER"] = 36] = "FOOTER";
  TAG_ID[TAG_ID["FOREIGN_OBJECT"] = 37] = "FOREIGN_OBJECT";
  TAG_ID[TAG_ID["FORM"] = 38] = "FORM";
  TAG_ID[TAG_ID["FRAME"] = 39] = "FRAME";
  TAG_ID[TAG_ID["FRAMESET"] = 40] = "FRAMESET";
  TAG_ID[TAG_ID["H1"] = 41] = "H1";
  TAG_ID[TAG_ID["H2"] = 42] = "H2";
  TAG_ID[TAG_ID["H3"] = 43] = "H3";
  TAG_ID[TAG_ID["H4"] = 44] = "H4";
  TAG_ID[TAG_ID["H5"] = 45] = "H5";
  TAG_ID[TAG_ID["H6"] = 46] = "H6";
  TAG_ID[TAG_ID["HEAD"] = 47] = "HEAD";
  TAG_ID[TAG_ID["HEADER"] = 48] = "HEADER";
  TAG_ID[TAG_ID["HGROUP"] = 49] = "HGROUP";
  TAG_ID[TAG_ID["HR"] = 50] = "HR";
  TAG_ID[TAG_ID["HTML"] = 51] = "HTML";
  TAG_ID[TAG_ID["I"] = 52] = "I";
  TAG_ID[TAG_ID["IMG"] = 53] = "IMG";
  TAG_ID[TAG_ID["IMAGE"] = 54] = "IMAGE";
  TAG_ID[TAG_ID["INPUT"] = 55] = "INPUT";
  TAG_ID[TAG_ID["IFRAME"] = 56] = "IFRAME";
  TAG_ID[TAG_ID["KEYGEN"] = 57] = "KEYGEN";
  TAG_ID[TAG_ID["LABEL"] = 58] = "LABEL";
  TAG_ID[TAG_ID["LI"] = 59] = "LI";
  TAG_ID[TAG_ID["LINK"] = 60] = "LINK";
  TAG_ID[TAG_ID["LISTING"] = 61] = "LISTING";
  TAG_ID[TAG_ID["MAIN"] = 62] = "MAIN";
  TAG_ID[TAG_ID["MALIGNMARK"] = 63] = "MALIGNMARK";
  TAG_ID[TAG_ID["MARQUEE"] = 64] = "MARQUEE";
  TAG_ID[TAG_ID["MATH"] = 65] = "MATH";
  TAG_ID[TAG_ID["MENU"] = 66] = "MENU";
  TAG_ID[TAG_ID["META"] = 67] = "META";
  TAG_ID[TAG_ID["MGLYPH"] = 68] = "MGLYPH";
  TAG_ID[TAG_ID["MI"] = 69] = "MI";
  TAG_ID[TAG_ID["MO"] = 70] = "MO";
  TAG_ID[TAG_ID["MN"] = 71] = "MN";
  TAG_ID[TAG_ID["MS"] = 72] = "MS";
  TAG_ID[TAG_ID["MTEXT"] = 73] = "MTEXT";
  TAG_ID[TAG_ID["NAV"] = 74] = "NAV";
  TAG_ID[TAG_ID["NOBR"] = 75] = "NOBR";
  TAG_ID[TAG_ID["NOFRAMES"] = 76] = "NOFRAMES";
  TAG_ID[TAG_ID["NOEMBED"] = 77] = "NOEMBED";
  TAG_ID[TAG_ID["NOSCRIPT"] = 78] = "NOSCRIPT";
  TAG_ID[TAG_ID["OBJECT"] = 79] = "OBJECT";
  TAG_ID[TAG_ID["OL"] = 80] = "OL";
  TAG_ID[TAG_ID["OPTGROUP"] = 81] = "OPTGROUP";
  TAG_ID[TAG_ID["OPTION"] = 82] = "OPTION";
  TAG_ID[TAG_ID["P"] = 83] = "P";
  TAG_ID[TAG_ID["PARAM"] = 84] = "PARAM";
  TAG_ID[TAG_ID["PLAINTEXT"] = 85] = "PLAINTEXT";
  TAG_ID[TAG_ID["PRE"] = 86] = "PRE";
  TAG_ID[TAG_ID["RB"] = 87] = "RB";
  TAG_ID[TAG_ID["RP"] = 88] = "RP";
  TAG_ID[TAG_ID["RT"] = 89] = "RT";
  TAG_ID[TAG_ID["RTC"] = 90] = "RTC";
  TAG_ID[TAG_ID["RUBY"] = 91] = "RUBY";
  TAG_ID[TAG_ID["S"] = 92] = "S";
  TAG_ID[TAG_ID["SCRIPT"] = 93] = "SCRIPT";
  TAG_ID[TAG_ID["SEARCH"] = 94] = "SEARCH";
  TAG_ID[TAG_ID["SECTION"] = 95] = "SECTION";
  TAG_ID[TAG_ID["SELECT"] = 96] = "SELECT";
  TAG_ID[TAG_ID["SOURCE"] = 97] = "SOURCE";
  TAG_ID[TAG_ID["SMALL"] = 98] = "SMALL";
  TAG_ID[TAG_ID["SPAN"] = 99] = "SPAN";
  TAG_ID[TAG_ID["STRIKE"] = 100] = "STRIKE";
  TAG_ID[TAG_ID["STRONG"] = 101] = "STRONG";
  TAG_ID[TAG_ID["STYLE"] = 102] = "STYLE";
  TAG_ID[TAG_ID["SUB"] = 103] = "SUB";
  TAG_ID[TAG_ID["SUMMARY"] = 104] = "SUMMARY";
  TAG_ID[TAG_ID["SUP"] = 105] = "SUP";
  TAG_ID[TAG_ID["TABLE"] = 106] = "TABLE";
  TAG_ID[TAG_ID["TBODY"] = 107] = "TBODY";
  TAG_ID[TAG_ID["TEMPLATE"] = 108] = "TEMPLATE";
  TAG_ID[TAG_ID["TEXTAREA"] = 109] = "TEXTAREA";
  TAG_ID[TAG_ID["TFOOT"] = 110] = "TFOOT";
  TAG_ID[TAG_ID["TD"] = 111] = "TD";
  TAG_ID[TAG_ID["TH"] = 112] = "TH";
  TAG_ID[TAG_ID["THEAD"] = 113] = "THEAD";
  TAG_ID[TAG_ID["TITLE"] = 114] = "TITLE";
  TAG_ID[TAG_ID["TR"] = 115] = "TR";
  TAG_ID[TAG_ID["TRACK"] = 116] = "TRACK";
  TAG_ID[TAG_ID["TT"] = 117] = "TT";
  TAG_ID[TAG_ID["U"] = 118] = "U";
  TAG_ID[TAG_ID["UL"] = 119] = "UL";
  TAG_ID[TAG_ID["SVG"] = 120] = "SVG";
  TAG_ID[TAG_ID["VAR"] = 121] = "VAR";
  TAG_ID[TAG_ID["WBR"] = 122] = "WBR";
  TAG_ID[TAG_ID["XMP"] = 123] = "XMP";
})(TAG_ID || (TAG_ID = {}));
var TAG_NAME_TO_ID = new Map([
  [TAG_NAMES.A, TAG_ID.A],
  [TAG_NAMES.ADDRESS, TAG_ID.ADDRESS],
  [TAG_NAMES.ANNOTATION_XML, TAG_ID.ANNOTATION_XML],
  [TAG_NAMES.APPLET, TAG_ID.APPLET],
  [TAG_NAMES.AREA, TAG_ID.AREA],
  [TAG_NAMES.ARTICLE, TAG_ID.ARTICLE],
  [TAG_NAMES.ASIDE, TAG_ID.ASIDE],
  [TAG_NAMES.B, TAG_ID.B],
  [TAG_NAMES.BASE, TAG_ID.BASE],
  [TAG_NAMES.BASEFONT, TAG_ID.BASEFONT],
  [TAG_NAMES.BGSOUND, TAG_ID.BGSOUND],
  [TAG_NAMES.BIG, TAG_ID.BIG],
  [TAG_NAMES.BLOCKQUOTE, TAG_ID.BLOCKQUOTE],
  [TAG_NAMES.BODY, TAG_ID.BODY],
  [TAG_NAMES.BR, TAG_ID.BR],
  [TAG_NAMES.BUTTON, TAG_ID.BUTTON],
  [TAG_NAMES.CAPTION, TAG_ID.CAPTION],
  [TAG_NAMES.CENTER, TAG_ID.CENTER],
  [TAG_NAMES.CODE, TAG_ID.CODE],
  [TAG_NAMES.COL, TAG_ID.COL],
  [TAG_NAMES.COLGROUP, TAG_ID.COLGROUP],
  [TAG_NAMES.DD, TAG_ID.DD],
  [TAG_NAMES.DESC, TAG_ID.DESC],
  [TAG_NAMES.DETAILS, TAG_ID.DETAILS],
  [TAG_NAMES.DIALOG, TAG_ID.DIALOG],
  [TAG_NAMES.DIR, TAG_ID.DIR],
  [TAG_NAMES.DIV, TAG_ID.DIV],
  [TAG_NAMES.DL, TAG_ID.DL],
  [TAG_NAMES.DT, TAG_ID.DT],
  [TAG_NAMES.EM, TAG_ID.EM],
  [TAG_NAMES.EMBED, TAG_ID.EMBED],
  [TAG_NAMES.FIELDSET, TAG_ID.FIELDSET],
  [TAG_NAMES.FIGCAPTION, TAG_ID.FIGCAPTION],
  [TAG_NAMES.FIGURE, TAG_ID.FIGURE],
  [TAG_NAMES.FONT, TAG_ID.FONT],
  [TAG_NAMES.FOOTER, TAG_ID.FOOTER],
  [TAG_NAMES.FOREIGN_OBJECT, TAG_ID.FOREIGN_OBJECT],
  [TAG_NAMES.FORM, TAG_ID.FORM],
  [TAG_NAMES.FRAME, TAG_ID.FRAME],
  [TAG_NAMES.FRAMESET, TAG_ID.FRAMESET],
  [TAG_NAMES.H1, TAG_ID.H1],
  [TAG_NAMES.H2, TAG_ID.H2],
  [TAG_NAMES.H3, TAG_ID.H3],
  [TAG_NAMES.H4, TAG_ID.H4],
  [TAG_NAMES.H5, TAG_ID.H5],
  [TAG_NAMES.H6, TAG_ID.H6],
  [TAG_NAMES.HEAD, TAG_ID.HEAD],
  [TAG_NAMES.HEADER, TAG_ID.HEADER],
  [TAG_NAMES.HGROUP, TAG_ID.HGROUP],
  [TAG_NAMES.HR, TAG_ID.HR],
  [TAG_NAMES.HTML, TAG_ID.HTML],
  [TAG_NAMES.I, TAG_ID.I],
  [TAG_NAMES.IMG, TAG_ID.IMG],
  [TAG_NAMES.IMAGE, TAG_ID.IMAGE],
  [TAG_NAMES.INPUT, TAG_ID.INPUT],
  [TAG_NAMES.IFRAME, TAG_ID.IFRAME],
  [TAG_NAMES.KEYGEN, TAG_ID.KEYGEN],
  [TAG_NAMES.LABEL, TAG_ID.LABEL],
  [TAG_NAMES.LI, TAG_ID.LI],
  [TAG_NAMES.LINK, TAG_ID.LINK],
  [TAG_NAMES.LISTING, TAG_ID.LISTING],
  [TAG_NAMES.MAIN, TAG_ID.MAIN],
  [TAG_NAMES.MALIGNMARK, TAG_ID.MALIGNMARK],
  [TAG_NAMES.MARQUEE, TAG_ID.MARQUEE],
  [TAG_NAMES.MATH, TAG_ID.MATH],
  [TAG_NAMES.MENU, TAG_ID.MENU],
  [TAG_NAMES.META, TAG_ID.META],
  [TAG_NAMES.MGLYPH, TAG_ID.MGLYPH],
  [TAG_NAMES.MI, TAG_ID.MI],
  [TAG_NAMES.MO, TAG_ID.MO],
  [TAG_NAMES.MN, TAG_ID.MN],
  [TAG_NAMES.MS, TAG_ID.MS],
  [TAG_NAMES.MTEXT, TAG_ID.MTEXT],
  [TAG_NAMES.NAV, TAG_ID.NAV],
  [TAG_NAMES.NOBR, TAG_ID.NOBR],
  [TAG_NAMES.NOFRAMES, TAG_ID.NOFRAMES],
  [TAG_NAMES.NOEMBED, TAG_ID.NOEMBED],
  [TAG_NAMES.NOSCRIPT, TAG_ID.NOSCRIPT],
  [TAG_NAMES.OBJECT, TAG_ID.OBJECT],
  [TAG_NAMES.OL, TAG_ID.OL],
  [TAG_NAMES.OPTGROUP, TAG_ID.OPTGROUP],
  [TAG_NAMES.OPTION, TAG_ID.OPTION],
  [TAG_NAMES.P, TAG_ID.P],
  [TAG_NAMES.PARAM, TAG_ID.PARAM],
  [TAG_NAMES.PLAINTEXT, TAG_ID.PLAINTEXT],
  [TAG_NAMES.PRE, TAG_ID.PRE],
  [TAG_NAMES.RB, TAG_ID.RB],
  [TAG_NAMES.RP, TAG_ID.RP],
  [TAG_NAMES.RT, TAG_ID.RT],
  [TAG_NAMES.RTC, TAG_ID.RTC],
  [TAG_NAMES.RUBY, TAG_ID.RUBY],
  [TAG_NAMES.S, TAG_ID.S],
  [TAG_NAMES.SCRIPT, TAG_ID.SCRIPT],
  [TAG_NAMES.SEARCH, TAG_ID.SEARCH],
  [TAG_NAMES.SECTION, TAG_ID.SECTION],
  [TAG_NAMES.SELECT, TAG_ID.SELECT],
  [TAG_NAMES.SOURCE, TAG_ID.SOURCE],
  [TAG_NAMES.SMALL, TAG_ID.SMALL],
  [TAG_NAMES.SPAN, TAG_ID.SPAN],
  [TAG_NAMES.STRIKE, TAG_ID.STRIKE],
  [TAG_NAMES.STRONG, TAG_ID.STRONG],
  [TAG_NAMES.STYLE, TAG_ID.STYLE],
  [TAG_NAMES.SUB, TAG_ID.SUB],
  [TAG_NAMES.SUMMARY, TAG_ID.SUMMARY],
  [TAG_NAMES.SUP, TAG_ID.SUP],
  [TAG_NAMES.TABLE, TAG_ID.TABLE],
  [TAG_NAMES.TBODY, TAG_ID.TBODY],
  [TAG_NAMES.TEMPLATE, TAG_ID.TEMPLATE],
  [TAG_NAMES.TEXTAREA, TAG_ID.TEXTAREA],
  [TAG_NAMES.TFOOT, TAG_ID.TFOOT],
  [TAG_NAMES.TD, TAG_ID.TD],
  [TAG_NAMES.TH, TAG_ID.TH],
  [TAG_NAMES.THEAD, TAG_ID.THEAD],
  [TAG_NAMES.TITLE, TAG_ID.TITLE],
  [TAG_NAMES.TR, TAG_ID.TR],
  [TAG_NAMES.TRACK, TAG_ID.TRACK],
  [TAG_NAMES.TT, TAG_ID.TT],
  [TAG_NAMES.U, TAG_ID.U],
  [TAG_NAMES.UL, TAG_ID.UL],
  [TAG_NAMES.SVG, TAG_ID.SVG],
  [TAG_NAMES.VAR, TAG_ID.VAR],
  [TAG_NAMES.WBR, TAG_ID.WBR],
  [TAG_NAMES.XMP, TAG_ID.XMP]
]);
function getTagID(tagName) {
  var _a;
  return (_a = TAG_NAME_TO_ID.get(tagName)) !== null && _a !== undefined ? _a : TAG_ID.UNKNOWN;
}
var $ = TAG_ID;
var SPECIAL_ELEMENTS = {
  [NS.HTML]: new Set([
    $.ADDRESS,
    $.APPLET,
    $.AREA,
    $.ARTICLE,
    $.ASIDE,
    $.BASE,
    $.BASEFONT,
    $.BGSOUND,
    $.BLOCKQUOTE,
    $.BODY,
    $.BR,
    $.BUTTON,
    $.CAPTION,
    $.CENTER,
    $.COL,
    $.COLGROUP,
    $.DD,
    $.DETAILS,
    $.DIR,
    $.DIV,
    $.DL,
    $.DT,
    $.EMBED,
    $.FIELDSET,
    $.FIGCAPTION,
    $.FIGURE,
    $.FOOTER,
    $.FORM,
    $.FRAME,
    $.FRAMESET,
    $.H1,
    $.H2,
    $.H3,
    $.H4,
    $.H5,
    $.H6,
    $.HEAD,
    $.HEADER,
    $.HGROUP,
    $.HR,
    $.HTML,
    $.IFRAME,
    $.IMG,
    $.INPUT,
    $.LI,
    $.LINK,
    $.LISTING,
    $.MAIN,
    $.MARQUEE,
    $.MENU,
    $.META,
    $.NAV,
    $.NOEMBED,
    $.NOFRAMES,
    $.NOSCRIPT,
    $.OBJECT,
    $.OL,
    $.P,
    $.PARAM,
    $.PLAINTEXT,
    $.PRE,
    $.SCRIPT,
    $.SECTION,
    $.SELECT,
    $.SOURCE,
    $.STYLE,
    $.SUMMARY,
    $.TABLE,
    $.TBODY,
    $.TD,
    $.TEMPLATE,
    $.TEXTAREA,
    $.TFOOT,
    $.TH,
    $.THEAD,
    $.TITLE,
    $.TR,
    $.TRACK,
    $.UL,
    $.WBR,
    $.XMP
  ]),
  [NS.MATHML]: new Set([$.MI, $.MO, $.MN, $.MS, $.MTEXT, $.ANNOTATION_XML]),
  [NS.SVG]: new Set([$.TITLE, $.FOREIGN_OBJECT, $.DESC]),
  [NS.XLINK]: new Set,
  [NS.XML]: new Set,
  [NS.XMLNS]: new Set
};
var NUMBERED_HEADERS = new Set([$.H1, $.H2, $.H3, $.H4, $.H5, $.H6]);
var UNESCAPED_TEXT = new Set([
  TAG_NAMES.STYLE,
  TAG_NAMES.SCRIPT,
  TAG_NAMES.XMP,
  TAG_NAMES.IFRAME,
  TAG_NAMES.NOEMBED,
  TAG_NAMES.NOFRAMES,
  TAG_NAMES.PLAINTEXT
]);
function hasUnescapedText(tn, scriptingEnabled) {
  return UNESCAPED_TEXT.has(tn) || scriptingEnabled && tn === TAG_NAMES.NOSCRIPT;
}

// node_modules/parse5/dist/tokenizer/index.js
var State2;
(function(State) {
  State[State["DATA"] = 0] = "DATA";
  State[State["RCDATA"] = 1] = "RCDATA";
  State[State["RAWTEXT"] = 2] = "RAWTEXT";
  State[State["SCRIPT_DATA"] = 3] = "SCRIPT_DATA";
  State[State["PLAINTEXT"] = 4] = "PLAINTEXT";
  State[State["TAG_OPEN"] = 5] = "TAG_OPEN";
  State[State["END_TAG_OPEN"] = 6] = "END_TAG_OPEN";
  State[State["TAG_NAME"] = 7] = "TAG_NAME";
  State[State["RCDATA_LESS_THAN_SIGN"] = 8] = "RCDATA_LESS_THAN_SIGN";
  State[State["RCDATA_END_TAG_OPEN"] = 9] = "RCDATA_END_TAG_OPEN";
  State[State["RCDATA_END_TAG_NAME"] = 10] = "RCDATA_END_TAG_NAME";
  State[State["RAWTEXT_LESS_THAN_SIGN"] = 11] = "RAWTEXT_LESS_THAN_SIGN";
  State[State["RAWTEXT_END_TAG_OPEN"] = 12] = "RAWTEXT_END_TAG_OPEN";
  State[State["RAWTEXT_END_TAG_NAME"] = 13] = "RAWTEXT_END_TAG_NAME";
  State[State["SCRIPT_DATA_LESS_THAN_SIGN"] = 14] = "SCRIPT_DATA_LESS_THAN_SIGN";
  State[State["SCRIPT_DATA_END_TAG_OPEN"] = 15] = "SCRIPT_DATA_END_TAG_OPEN";
  State[State["SCRIPT_DATA_END_TAG_NAME"] = 16] = "SCRIPT_DATA_END_TAG_NAME";
  State[State["SCRIPT_DATA_ESCAPE_START"] = 17] = "SCRIPT_DATA_ESCAPE_START";
  State[State["SCRIPT_DATA_ESCAPE_START_DASH"] = 18] = "SCRIPT_DATA_ESCAPE_START_DASH";
  State[State["SCRIPT_DATA_ESCAPED"] = 19] = "SCRIPT_DATA_ESCAPED";
  State[State["SCRIPT_DATA_ESCAPED_DASH"] = 20] = "SCRIPT_DATA_ESCAPED_DASH";
  State[State["SCRIPT_DATA_ESCAPED_DASH_DASH"] = 21] = "SCRIPT_DATA_ESCAPED_DASH_DASH";
  State[State["SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN"] = 22] = "SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN";
  State[State["SCRIPT_DATA_ESCAPED_END_TAG_OPEN"] = 23] = "SCRIPT_DATA_ESCAPED_END_TAG_OPEN";
  State[State["SCRIPT_DATA_ESCAPED_END_TAG_NAME"] = 24] = "SCRIPT_DATA_ESCAPED_END_TAG_NAME";
  State[State["SCRIPT_DATA_DOUBLE_ESCAPE_START"] = 25] = "SCRIPT_DATA_DOUBLE_ESCAPE_START";
  State[State["SCRIPT_DATA_DOUBLE_ESCAPED"] = 26] = "SCRIPT_DATA_DOUBLE_ESCAPED";
  State[State["SCRIPT_DATA_DOUBLE_ESCAPED_DASH"] = 27] = "SCRIPT_DATA_DOUBLE_ESCAPED_DASH";
  State[State["SCRIPT_DATA_DOUBLE_ESCAPED_DASH_DASH"] = 28] = "SCRIPT_DATA_DOUBLE_ESCAPED_DASH_DASH";
  State[State["SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN"] = 29] = "SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN";
  State[State["SCRIPT_DATA_DOUBLE_ESCAPE_END"] = 30] = "SCRIPT_DATA_DOUBLE_ESCAPE_END";
  State[State["BEFORE_ATTRIBUTE_NAME"] = 31] = "BEFORE_ATTRIBUTE_NAME";
  State[State["ATTRIBUTE_NAME"] = 32] = "ATTRIBUTE_NAME";
  State[State["AFTER_ATTRIBUTE_NAME"] = 33] = "AFTER_ATTRIBUTE_NAME";
  State[State["BEFORE_ATTRIBUTE_VALUE"] = 34] = "BEFORE_ATTRIBUTE_VALUE";
  State[State["ATTRIBUTE_VALUE_DOUBLE_QUOTED"] = 35] = "ATTRIBUTE_VALUE_DOUBLE_QUOTED";
  State[State["ATTRIBUTE_VALUE_SINGLE_QUOTED"] = 36] = "ATTRIBUTE_VALUE_SINGLE_QUOTED";
  State[State["ATTRIBUTE_VALUE_UNQUOTED"] = 37] = "ATTRIBUTE_VALUE_UNQUOTED";
  State[State["AFTER_ATTRIBUTE_VALUE_QUOTED"] = 38] = "AFTER_ATTRIBUTE_VALUE_QUOTED";
  State[State["SELF_CLOSING_START_TAG"] = 39] = "SELF_CLOSING_START_TAG";
  State[State["BOGUS_COMMENT"] = 40] = "BOGUS_COMMENT";
  State[State["MARKUP_DECLARATION_OPEN"] = 41] = "MARKUP_DECLARATION_OPEN";
  State[State["COMMENT_START"] = 42] = "COMMENT_START";
  State[State["COMMENT_START_DASH"] = 43] = "COMMENT_START_DASH";
  State[State["COMMENT"] = 44] = "COMMENT";
  State[State["COMMENT_LESS_THAN_SIGN"] = 45] = "COMMENT_LESS_THAN_SIGN";
  State[State["COMMENT_LESS_THAN_SIGN_BANG"] = 46] = "COMMENT_LESS_THAN_SIGN_BANG";
  State[State["COMMENT_LESS_THAN_SIGN_BANG_DASH"] = 47] = "COMMENT_LESS_THAN_SIGN_BANG_DASH";
  State[State["COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH"] = 48] = "COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH";
  State[State["COMMENT_END_DASH"] = 49] = "COMMENT_END_DASH";
  State[State["COMMENT_END"] = 50] = "COMMENT_END";
  State[State["COMMENT_END_BANG"] = 51] = "COMMENT_END_BANG";
  State[State["DOCTYPE"] = 52] = "DOCTYPE";
  State[State["BEFORE_DOCTYPE_NAME"] = 53] = "BEFORE_DOCTYPE_NAME";
  State[State["DOCTYPE_NAME"] = 54] = "DOCTYPE_NAME";
  State[State["AFTER_DOCTYPE_NAME"] = 55] = "AFTER_DOCTYPE_NAME";
  State[State["AFTER_DOCTYPE_PUBLIC_KEYWORD"] = 56] = "AFTER_DOCTYPE_PUBLIC_KEYWORD";
  State[State["BEFORE_DOCTYPE_PUBLIC_IDENTIFIER"] = 57] = "BEFORE_DOCTYPE_PUBLIC_IDENTIFIER";
  State[State["DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED"] = 58] = "DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED";
  State[State["DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED"] = 59] = "DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED";
  State[State["AFTER_DOCTYPE_PUBLIC_IDENTIFIER"] = 60] = "AFTER_DOCTYPE_PUBLIC_IDENTIFIER";
  State[State["BETWEEN_DOCTYPE_PUBLIC_AND_SYSTEM_IDENTIFIERS"] = 61] = "BETWEEN_DOCTYPE_PUBLIC_AND_SYSTEM_IDENTIFIERS";
  State[State["AFTER_DOCTYPE_SYSTEM_KEYWORD"] = 62] = "AFTER_DOCTYPE_SYSTEM_KEYWORD";
  State[State["BEFORE_DOCTYPE_SYSTEM_IDENTIFIER"] = 63] = "BEFORE_DOCTYPE_SYSTEM_IDENTIFIER";
  State[State["DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED"] = 64] = "DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED";
  State[State["DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED"] = 65] = "DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED";
  State[State["AFTER_DOCTYPE_SYSTEM_IDENTIFIER"] = 66] = "AFTER_DOCTYPE_SYSTEM_IDENTIFIER";
  State[State["BOGUS_DOCTYPE"] = 67] = "BOGUS_DOCTYPE";
  State[State["CDATA_SECTION"] = 68] = "CDATA_SECTION";
  State[State["CDATA_SECTION_BRACKET"] = 69] = "CDATA_SECTION_BRACKET";
  State[State["CDATA_SECTION_END"] = 70] = "CDATA_SECTION_END";
  State[State["CHARACTER_REFERENCE"] = 71] = "CHARACTER_REFERENCE";
  State[State["AMBIGUOUS_AMPERSAND"] = 72] = "AMBIGUOUS_AMPERSAND";
})(State2 || (State2 = {}));
var TokenizerMode = {
  DATA: State2.DATA,
  RCDATA: State2.RCDATA,
  RAWTEXT: State2.RAWTEXT,
  SCRIPT_DATA: State2.SCRIPT_DATA,
  PLAINTEXT: State2.PLAINTEXT,
  CDATA_SECTION: State2.CDATA_SECTION
};
function isAsciiDigit(cp) {
  return cp >= CODE_POINTS.DIGIT_0 && cp <= CODE_POINTS.DIGIT_9;
}
function isAsciiUpper(cp) {
  return cp >= CODE_POINTS.LATIN_CAPITAL_A && cp <= CODE_POINTS.LATIN_CAPITAL_Z;
}
function isAsciiLower(cp) {
  return cp >= CODE_POINTS.LATIN_SMALL_A && cp <= CODE_POINTS.LATIN_SMALL_Z;
}
function isAsciiLetter(cp) {
  return isAsciiLower(cp) || isAsciiUpper(cp);
}
function isAsciiAlphaNumeric(cp) {
  return isAsciiLetter(cp) || isAsciiDigit(cp);
}
function toAsciiLower(cp) {
  return cp + 32;
}
function isWhitespace2(cp) {
  return cp === CODE_POINTS.SPACE || cp === CODE_POINTS.LINE_FEED || cp === CODE_POINTS.TABULATION || cp === CODE_POINTS.FORM_FEED;
}
function isScriptDataDoubleEscapeSequenceEnd(cp) {
  return isWhitespace2(cp) || cp === CODE_POINTS.SOLIDUS || cp === CODE_POINTS.GREATER_THAN_SIGN;
}
function getErrorForNumericCharacterReference(code) {
  if (code === CODE_POINTS.NULL) {
    return ERR.nullCharacterReference;
  } else if (code > 1114111) {
    return ERR.characterReferenceOutsideUnicodeRange;
  } else if (isSurrogate(code)) {
    return ERR.surrogateCharacterReference;
  } else if (isUndefinedCodePoint(code)) {
    return ERR.noncharacterCharacterReference;
  } else if (isControlCodePoint(code) || code === CODE_POINTS.CARRIAGE_RETURN) {
    return ERR.controlCharacterReference;
  }
  return null;
}

class Tokenizer2 {
  constructor(options, handler) {
    this.options = options;
    this.handler = handler;
    this.paused = false;
    this.inLoop = false;
    this.inForeignNode = false;
    this.lastStartTagName = "";
    this.active = false;
    this.state = State2.DATA;
    this.returnState = State2.DATA;
    this.entityStartPos = 0;
    this.consumedAfterSnapshot = -1;
    this.currentCharacterToken = null;
    this.currentToken = null;
    this.currentAttr = { name: "", value: "" };
    this.preprocessor = new Preprocessor(handler);
    this.currentLocation = this.getCurrentLocation(-1);
    this.entityDecoder = new EntityDecoder(htmlDecodeTree, (cp, consumed) => {
      this.preprocessor.pos = this.entityStartPos + consumed - 1;
      this._flushCodePointConsumedAsCharacterReference(cp);
    }, handler.onParseError ? {
      missingSemicolonAfterCharacterReference: () => {
        this._err(ERR.missingSemicolonAfterCharacterReference, 1);
      },
      absenceOfDigitsInNumericCharacterReference: (consumed) => {
        this._err(ERR.absenceOfDigitsInNumericCharacterReference, this.entityStartPos - this.preprocessor.pos + consumed);
      },
      validateNumericCharacterReference: (code) => {
        const error = getErrorForNumericCharacterReference(code);
        if (error)
          this._err(error, 1);
      }
    } : undefined);
  }
  _err(code, cpOffset = 0) {
    var _a, _b;
    (_b = (_a = this.handler).onParseError) === null || _b === undefined || _b.call(_a, this.preprocessor.getError(code, cpOffset));
  }
  getCurrentLocation(offset) {
    if (!this.options.sourceCodeLocationInfo) {
      return null;
    }
    return {
      startLine: this.preprocessor.line,
      startCol: this.preprocessor.col - offset,
      startOffset: this.preprocessor.offset - offset,
      endLine: -1,
      endCol: -1,
      endOffset: -1
    };
  }
  _runParsingLoop() {
    if (this.inLoop)
      return;
    this.inLoop = true;
    while (this.active && !this.paused) {
      this.consumedAfterSnapshot = 0;
      const cp = this._consume();
      if (!this._ensureHibernation()) {
        this._callState(cp);
      }
    }
    this.inLoop = false;
  }
  pause() {
    this.paused = true;
  }
  resume(writeCallback) {
    if (!this.paused) {
      throw new Error("Parser was already resumed");
    }
    this.paused = false;
    if (this.inLoop)
      return;
    this._runParsingLoop();
    if (!this.paused) {
      writeCallback === null || writeCallback === undefined || writeCallback();
    }
  }
  write(chunk, isLastChunk, writeCallback) {
    this.active = true;
    this.preprocessor.write(chunk, isLastChunk);
    this._runParsingLoop();
    if (!this.paused) {
      writeCallback === null || writeCallback === undefined || writeCallback();
    }
  }
  insertHtmlAtCurrentPos(chunk) {
    this.active = true;
    this.preprocessor.insertHtmlAtCurrentPos(chunk);
    this._runParsingLoop();
  }
  _ensureHibernation() {
    if (this.preprocessor.endOfChunkHit) {
      this.preprocessor.retreat(this.consumedAfterSnapshot);
      this.consumedAfterSnapshot = 0;
      this.active = false;
      return true;
    }
    return false;
  }
  _consume() {
    this.consumedAfterSnapshot++;
    return this.preprocessor.advance();
  }
  _advanceBy(count) {
    this.consumedAfterSnapshot += count;
    for (let i = 0;i < count; i++) {
      this.preprocessor.advance();
    }
  }
  _consumeSequenceIfMatch(pattern, caseSensitive) {
    if (this.preprocessor.startsWith(pattern, caseSensitive)) {
      this._advanceBy(pattern.length - 1);
      return true;
    }
    return false;
  }
  _createStartTagToken() {
    this.currentToken = {
      type: TokenType.START_TAG,
      tagName: "",
      tagID: TAG_ID.UNKNOWN,
      selfClosing: false,
      ackSelfClosing: false,
      attrs: [],
      location: this.getCurrentLocation(1)
    };
  }
  _createEndTagToken() {
    this.currentToken = {
      type: TokenType.END_TAG,
      tagName: "",
      tagID: TAG_ID.UNKNOWN,
      selfClosing: false,
      ackSelfClosing: false,
      attrs: [],
      location: this.getCurrentLocation(2)
    };
  }
  _createCommentToken(offset) {
    this.currentToken = {
      type: TokenType.COMMENT,
      data: "",
      location: this.getCurrentLocation(offset)
    };
  }
  _createDoctypeToken(initialName) {
    this.currentToken = {
      type: TokenType.DOCTYPE,
      name: initialName,
      forceQuirks: false,
      publicId: null,
      systemId: null,
      location: this.currentLocation
    };
  }
  _createCharacterToken(type, chars) {
    this.currentCharacterToken = {
      type,
      chars,
      location: this.currentLocation
    };
  }
  _createAttr(attrNameFirstCh) {
    this.currentAttr = {
      name: attrNameFirstCh,
      value: ""
    };
    this.currentLocation = this.getCurrentLocation(0);
  }
  _leaveAttrName() {
    var _a;
    var _b;
    const token = this.currentToken;
    if (getTokenAttr(token, this.currentAttr.name) === null) {
      token.attrs.push(this.currentAttr);
      if (token.location && this.currentLocation) {
        const attrLocations = (_a = (_b = token.location).attrs) !== null && _a !== undefined ? _a : _b.attrs = Object.create(null);
        attrLocations[this.currentAttr.name] = this.currentLocation;
        this._leaveAttrValue();
      }
    } else {
      this._err(ERR.duplicateAttribute);
    }
  }
  _leaveAttrValue() {
    if (this.currentLocation) {
      this.currentLocation.endLine = this.preprocessor.line;
      this.currentLocation.endCol = this.preprocessor.col;
      this.currentLocation.endOffset = this.preprocessor.offset;
    }
  }
  prepareToken(ct) {
    this._emitCurrentCharacterToken(ct.location);
    this.currentToken = null;
    if (ct.location) {
      ct.location.endLine = this.preprocessor.line;
      ct.location.endCol = this.preprocessor.col + 1;
      ct.location.endOffset = this.preprocessor.offset + 1;
    }
    this.currentLocation = this.getCurrentLocation(-1);
  }
  emitCurrentTagToken() {
    const ct = this.currentToken;
    this.prepareToken(ct);
    ct.tagID = getTagID(ct.tagName);
    if (ct.type === TokenType.START_TAG) {
      this.lastStartTagName = ct.tagName;
      this.handler.onStartTag(ct);
    } else {
      if (ct.attrs.length > 0) {
        this._err(ERR.endTagWithAttributes);
      }
      if (ct.selfClosing) {
        this._err(ERR.endTagWithTrailingSolidus);
      }
      this.handler.onEndTag(ct);
    }
    this.preprocessor.dropParsedChunk();
  }
  emitCurrentComment(ct) {
    this.prepareToken(ct);
    this.handler.onComment(ct);
    this.preprocessor.dropParsedChunk();
  }
  emitCurrentDoctype(ct) {
    this.prepareToken(ct);
    this.handler.onDoctype(ct);
    this.preprocessor.dropParsedChunk();
  }
  _emitCurrentCharacterToken(nextLocation) {
    if (this.currentCharacterToken) {
      if (nextLocation && this.currentCharacterToken.location) {
        this.currentCharacterToken.location.endLine = nextLocation.startLine;
        this.currentCharacterToken.location.endCol = nextLocation.startCol;
        this.currentCharacterToken.location.endOffset = nextLocation.startOffset;
      }
      switch (this.currentCharacterToken.type) {
        case TokenType.CHARACTER: {
          this.handler.onCharacter(this.currentCharacterToken);
          break;
        }
        case TokenType.NULL_CHARACTER: {
          this.handler.onNullCharacter(this.currentCharacterToken);
          break;
        }
        case TokenType.WHITESPACE_CHARACTER: {
          this.handler.onWhitespaceCharacter(this.currentCharacterToken);
          break;
        }
      }
      this.currentCharacterToken = null;
    }
  }
  _emitEOFToken() {
    const location = this.getCurrentLocation(0);
    if (location) {
      location.endLine = location.startLine;
      location.endCol = location.startCol;
      location.endOffset = location.startOffset;
    }
    this._emitCurrentCharacterToken(location);
    this.handler.onEof({ type: TokenType.EOF, location });
    this.active = false;
  }
  _appendCharToCurrentCharacterToken(type, ch) {
    if (this.currentCharacterToken) {
      if (this.currentCharacterToken.type === type) {
        this.currentCharacterToken.chars += ch;
        return;
      } else {
        this.currentLocation = this.getCurrentLocation(0);
        this._emitCurrentCharacterToken(this.currentLocation);
        this.preprocessor.dropParsedChunk();
      }
    }
    this._createCharacterToken(type, ch);
  }
  _emitCodePoint(cp) {
    const type = isWhitespace2(cp) ? TokenType.WHITESPACE_CHARACTER : cp === CODE_POINTS.NULL ? TokenType.NULL_CHARACTER : TokenType.CHARACTER;
    this._appendCharToCurrentCharacterToken(type, cp < 65536 ? String.fromCharCode(cp) : String.fromCodePoint(cp));
  }
  _emitChars(ch) {
    this._appendCharToCurrentCharacterToken(TokenType.CHARACTER, ch);
  }
  _startCharacterReference() {
    this.returnState = this.state;
    this.state = State2.CHARACTER_REFERENCE;
    this.entityStartPos = this.preprocessor.pos;
    this.entityDecoder.startEntity(this._isCharacterReferenceInAttribute() ? DecodingMode.Attribute : DecodingMode.Legacy);
  }
  _isCharacterReferenceInAttribute() {
    return this.returnState === State2.ATTRIBUTE_VALUE_DOUBLE_QUOTED || this.returnState === State2.ATTRIBUTE_VALUE_SINGLE_QUOTED || this.returnState === State2.ATTRIBUTE_VALUE_UNQUOTED;
  }
  _flushCodePointConsumedAsCharacterReference(cp) {
    if (this._isCharacterReferenceInAttribute()) {
      this.currentAttr.value += String.fromCodePoint(cp);
    } else {
      this._emitCodePoint(cp);
    }
  }
  _callState(cp) {
    switch (this.state) {
      case State2.DATA: {
        this._stateData(cp);
        break;
      }
      case State2.RCDATA: {
        this._stateRcdata(cp);
        break;
      }
      case State2.RAWTEXT: {
        this._stateRawtext(cp);
        break;
      }
      case State2.SCRIPT_DATA: {
        this._stateScriptData(cp);
        break;
      }
      case State2.PLAINTEXT: {
        this._statePlaintext(cp);
        break;
      }
      case State2.TAG_OPEN: {
        this._stateTagOpen(cp);
        break;
      }
      case State2.END_TAG_OPEN: {
        this._stateEndTagOpen(cp);
        break;
      }
      case State2.TAG_NAME: {
        this._stateTagName(cp);
        break;
      }
      case State2.RCDATA_LESS_THAN_SIGN: {
        this._stateRcdataLessThanSign(cp);
        break;
      }
      case State2.RCDATA_END_TAG_OPEN: {
        this._stateRcdataEndTagOpen(cp);
        break;
      }
      case State2.RCDATA_END_TAG_NAME: {
        this._stateRcdataEndTagName(cp);
        break;
      }
      case State2.RAWTEXT_LESS_THAN_SIGN: {
        this._stateRawtextLessThanSign(cp);
        break;
      }
      case State2.RAWTEXT_END_TAG_OPEN: {
        this._stateRawtextEndTagOpen(cp);
        break;
      }
      case State2.RAWTEXT_END_TAG_NAME: {
        this._stateRawtextEndTagName(cp);
        break;
      }
      case State2.SCRIPT_DATA_LESS_THAN_SIGN: {
        this._stateScriptDataLessThanSign(cp);
        break;
      }
      case State2.SCRIPT_DATA_END_TAG_OPEN: {
        this._stateScriptDataEndTagOpen(cp);
        break;
      }
      case State2.SCRIPT_DATA_END_TAG_NAME: {
        this._stateScriptDataEndTagName(cp);
        break;
      }
      case State2.SCRIPT_DATA_ESCAPE_START: {
        this._stateScriptDataEscapeStart(cp);
        break;
      }
      case State2.SCRIPT_DATA_ESCAPE_START_DASH: {
        this._stateScriptDataEscapeStartDash(cp);
        break;
      }
      case State2.SCRIPT_DATA_ESCAPED: {
        this._stateScriptDataEscaped(cp);
        break;
      }
      case State2.SCRIPT_DATA_ESCAPED_DASH: {
        this._stateScriptDataEscapedDash(cp);
        break;
      }
      case State2.SCRIPT_DATA_ESCAPED_DASH_DASH: {
        this._stateScriptDataEscapedDashDash(cp);
        break;
      }
      case State2.SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN: {
        this._stateScriptDataEscapedLessThanSign(cp);
        break;
      }
      case State2.SCRIPT_DATA_ESCAPED_END_TAG_OPEN: {
        this._stateScriptDataEscapedEndTagOpen(cp);
        break;
      }
      case State2.SCRIPT_DATA_ESCAPED_END_TAG_NAME: {
        this._stateScriptDataEscapedEndTagName(cp);
        break;
      }
      case State2.SCRIPT_DATA_DOUBLE_ESCAPE_START: {
        this._stateScriptDataDoubleEscapeStart(cp);
        break;
      }
      case State2.SCRIPT_DATA_DOUBLE_ESCAPED: {
        this._stateScriptDataDoubleEscaped(cp);
        break;
      }
      case State2.SCRIPT_DATA_DOUBLE_ESCAPED_DASH: {
        this._stateScriptDataDoubleEscapedDash(cp);
        break;
      }
      case State2.SCRIPT_DATA_DOUBLE_ESCAPED_DASH_DASH: {
        this._stateScriptDataDoubleEscapedDashDash(cp);
        break;
      }
      case State2.SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN: {
        this._stateScriptDataDoubleEscapedLessThanSign(cp);
        break;
      }
      case State2.SCRIPT_DATA_DOUBLE_ESCAPE_END: {
        this._stateScriptDataDoubleEscapeEnd(cp);
        break;
      }
      case State2.BEFORE_ATTRIBUTE_NAME: {
        this._stateBeforeAttributeName(cp);
        break;
      }
      case State2.ATTRIBUTE_NAME: {
        this._stateAttributeName(cp);
        break;
      }
      case State2.AFTER_ATTRIBUTE_NAME: {
        this._stateAfterAttributeName(cp);
        break;
      }
      case State2.BEFORE_ATTRIBUTE_VALUE: {
        this._stateBeforeAttributeValue(cp);
        break;
      }
      case State2.ATTRIBUTE_VALUE_DOUBLE_QUOTED: {
        this._stateAttributeValueDoubleQuoted(cp);
        break;
      }
      case State2.ATTRIBUTE_VALUE_SINGLE_QUOTED: {
        this._stateAttributeValueSingleQuoted(cp);
        break;
      }
      case State2.ATTRIBUTE_VALUE_UNQUOTED: {
        this._stateAttributeValueUnquoted(cp);
        break;
      }
      case State2.AFTER_ATTRIBUTE_VALUE_QUOTED: {
        this._stateAfterAttributeValueQuoted(cp);
        break;
      }
      case State2.SELF_CLOSING_START_TAG: {
        this._stateSelfClosingStartTag(cp);
        break;
      }
      case State2.BOGUS_COMMENT: {
        this._stateBogusComment(cp);
        break;
      }
      case State2.MARKUP_DECLARATION_OPEN: {
        this._stateMarkupDeclarationOpen(cp);
        break;
      }
      case State2.COMMENT_START: {
        this._stateCommentStart(cp);
        break;
      }
      case State2.COMMENT_START_DASH: {
        this._stateCommentStartDash(cp);
        break;
      }
      case State2.COMMENT: {
        this._stateComment(cp);
        break;
      }
      case State2.COMMENT_LESS_THAN_SIGN: {
        this._stateCommentLessThanSign(cp);
        break;
      }
      case State2.COMMENT_LESS_THAN_SIGN_BANG: {
        this._stateCommentLessThanSignBang(cp);
        break;
      }
      case State2.COMMENT_LESS_THAN_SIGN_BANG_DASH: {
        this._stateCommentLessThanSignBangDash(cp);
        break;
      }
      case State2.COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH: {
        this._stateCommentLessThanSignBangDashDash(cp);
        break;
      }
      case State2.COMMENT_END_DASH: {
        this._stateCommentEndDash(cp);
        break;
      }
      case State2.COMMENT_END: {
        this._stateCommentEnd(cp);
        break;
      }
      case State2.COMMENT_END_BANG: {
        this._stateCommentEndBang(cp);
        break;
      }
      case State2.DOCTYPE: {
        this._stateDoctype(cp);
        break;
      }
      case State2.BEFORE_DOCTYPE_NAME: {
        this._stateBeforeDoctypeName(cp);
        break;
      }
      case State2.DOCTYPE_NAME: {
        this._stateDoctypeName(cp);
        break;
      }
      case State2.AFTER_DOCTYPE_NAME: {
        this._stateAfterDoctypeName(cp);
        break;
      }
      case State2.AFTER_DOCTYPE_PUBLIC_KEYWORD: {
        this._stateAfterDoctypePublicKeyword(cp);
        break;
      }
      case State2.BEFORE_DOCTYPE_PUBLIC_IDENTIFIER: {
        this._stateBeforeDoctypePublicIdentifier(cp);
        break;
      }
      case State2.DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED: {
        this._stateDoctypePublicIdentifierDoubleQuoted(cp);
        break;
      }
      case State2.DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED: {
        this._stateDoctypePublicIdentifierSingleQuoted(cp);
        break;
      }
      case State2.AFTER_DOCTYPE_PUBLIC_IDENTIFIER: {
        this._stateAfterDoctypePublicIdentifier(cp);
        break;
      }
      case State2.BETWEEN_DOCTYPE_PUBLIC_AND_SYSTEM_IDENTIFIERS: {
        this._stateBetweenDoctypePublicAndSystemIdentifiers(cp);
        break;
      }
      case State2.AFTER_DOCTYPE_SYSTEM_KEYWORD: {
        this._stateAfterDoctypeSystemKeyword(cp);
        break;
      }
      case State2.BEFORE_DOCTYPE_SYSTEM_IDENTIFIER: {
        this._stateBeforeDoctypeSystemIdentifier(cp);
        break;
      }
      case State2.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED: {
        this._stateDoctypeSystemIdentifierDoubleQuoted(cp);
        break;
      }
      case State2.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED: {
        this._stateDoctypeSystemIdentifierSingleQuoted(cp);
        break;
      }
      case State2.AFTER_DOCTYPE_SYSTEM_IDENTIFIER: {
        this._stateAfterDoctypeSystemIdentifier(cp);
        break;
      }
      case State2.BOGUS_DOCTYPE: {
        this._stateBogusDoctype(cp);
        break;
      }
      case State2.CDATA_SECTION: {
        this._stateCdataSection(cp);
        break;
      }
      case State2.CDATA_SECTION_BRACKET: {
        this._stateCdataSectionBracket(cp);
        break;
      }
      case State2.CDATA_SECTION_END: {
        this._stateCdataSectionEnd(cp);
        break;
      }
      case State2.CHARACTER_REFERENCE: {
        this._stateCharacterReference();
        break;
      }
      case State2.AMBIGUOUS_AMPERSAND: {
        this._stateAmbiguousAmpersand(cp);
        break;
      }
      default: {
        throw new Error("Unknown state");
      }
    }
  }
  _stateData(cp) {
    switch (cp) {
      case CODE_POINTS.LESS_THAN_SIGN: {
        this.state = State2.TAG_OPEN;
        break;
      }
      case CODE_POINTS.AMPERSAND: {
        this._startCharacterReference();
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this._emitCodePoint(cp);
        break;
      }
      case CODE_POINTS.EOF: {
        this._emitEOFToken();
        break;
      }
      default: {
        this._emitCodePoint(cp);
      }
    }
  }
  _stateRcdata(cp) {
    switch (cp) {
      case CODE_POINTS.AMPERSAND: {
        this._startCharacterReference();
        break;
      }
      case CODE_POINTS.LESS_THAN_SIGN: {
        this.state = State2.RCDATA_LESS_THAN_SIGN;
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this._emitChars(REPLACEMENT_CHARACTER);
        break;
      }
      case CODE_POINTS.EOF: {
        this._emitEOFToken();
        break;
      }
      default: {
        this._emitCodePoint(cp);
      }
    }
  }
  _stateRawtext(cp) {
    switch (cp) {
      case CODE_POINTS.LESS_THAN_SIGN: {
        this.state = State2.RAWTEXT_LESS_THAN_SIGN;
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this._emitChars(REPLACEMENT_CHARACTER);
        break;
      }
      case CODE_POINTS.EOF: {
        this._emitEOFToken();
        break;
      }
      default: {
        this._emitCodePoint(cp);
      }
    }
  }
  _stateScriptData(cp) {
    switch (cp) {
      case CODE_POINTS.LESS_THAN_SIGN: {
        this.state = State2.SCRIPT_DATA_LESS_THAN_SIGN;
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this._emitChars(REPLACEMENT_CHARACTER);
        break;
      }
      case CODE_POINTS.EOF: {
        this._emitEOFToken();
        break;
      }
      default: {
        this._emitCodePoint(cp);
      }
    }
  }
  _statePlaintext(cp) {
    switch (cp) {
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this._emitChars(REPLACEMENT_CHARACTER);
        break;
      }
      case CODE_POINTS.EOF: {
        this._emitEOFToken();
        break;
      }
      default: {
        this._emitCodePoint(cp);
      }
    }
  }
  _stateTagOpen(cp) {
    if (isAsciiLetter(cp)) {
      this._createStartTagToken();
      this.state = State2.TAG_NAME;
      this._stateTagName(cp);
    } else
      switch (cp) {
        case CODE_POINTS.EXCLAMATION_MARK: {
          this.state = State2.MARKUP_DECLARATION_OPEN;
          break;
        }
        case CODE_POINTS.SOLIDUS: {
          this.state = State2.END_TAG_OPEN;
          break;
        }
        case CODE_POINTS.QUESTION_MARK: {
          this._err(ERR.unexpectedQuestionMarkInsteadOfTagName);
          this._createCommentToken(1);
          this.state = State2.BOGUS_COMMENT;
          this._stateBogusComment(cp);
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofBeforeTagName);
          this._emitChars("<");
          this._emitEOFToken();
          break;
        }
        default: {
          this._err(ERR.invalidFirstCharacterOfTagName);
          this._emitChars("<");
          this.state = State2.DATA;
          this._stateData(cp);
        }
      }
  }
  _stateEndTagOpen(cp) {
    if (isAsciiLetter(cp)) {
      this._createEndTagToken();
      this.state = State2.TAG_NAME;
      this._stateTagName(cp);
    } else
      switch (cp) {
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this._err(ERR.missingEndTagName);
          this.state = State2.DATA;
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofBeforeTagName);
          this._emitChars("</");
          this._emitEOFToken();
          break;
        }
        default: {
          this._err(ERR.invalidFirstCharacterOfTagName);
          this._createCommentToken(2);
          this.state = State2.BOGUS_COMMENT;
          this._stateBogusComment(cp);
        }
      }
  }
  _stateTagName(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        this.state = State2.BEFORE_ATTRIBUTE_NAME;
        break;
      }
      case CODE_POINTS.SOLIDUS: {
        this.state = State2.SELF_CLOSING_START_TAG;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.state = State2.DATA;
        this.emitCurrentTagToken();
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        token.tagName += REPLACEMENT_CHARACTER;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInTag);
        this._emitEOFToken();
        break;
      }
      default: {
        token.tagName += String.fromCodePoint(isAsciiUpper(cp) ? toAsciiLower(cp) : cp);
      }
    }
  }
  _stateRcdataLessThanSign(cp) {
    if (cp === CODE_POINTS.SOLIDUS) {
      this.state = State2.RCDATA_END_TAG_OPEN;
    } else {
      this._emitChars("<");
      this.state = State2.RCDATA;
      this._stateRcdata(cp);
    }
  }
  _stateRcdataEndTagOpen(cp) {
    if (isAsciiLetter(cp)) {
      this.state = State2.RCDATA_END_TAG_NAME;
      this._stateRcdataEndTagName(cp);
    } else {
      this._emitChars("</");
      this.state = State2.RCDATA;
      this._stateRcdata(cp);
    }
  }
  handleSpecialEndTag(_cp) {
    if (!this.preprocessor.startsWith(this.lastStartTagName, false)) {
      return !this._ensureHibernation();
    }
    this._createEndTagToken();
    const token = this.currentToken;
    token.tagName = this.lastStartTagName;
    const cp = this.preprocessor.peek(this.lastStartTagName.length);
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        this._advanceBy(this.lastStartTagName.length);
        this.state = State2.BEFORE_ATTRIBUTE_NAME;
        return false;
      }
      case CODE_POINTS.SOLIDUS: {
        this._advanceBy(this.lastStartTagName.length);
        this.state = State2.SELF_CLOSING_START_TAG;
        return false;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._advanceBy(this.lastStartTagName.length);
        this.emitCurrentTagToken();
        this.state = State2.DATA;
        return false;
      }
      default: {
        return !this._ensureHibernation();
      }
    }
  }
  _stateRcdataEndTagName(cp) {
    if (this.handleSpecialEndTag(cp)) {
      this._emitChars("</");
      this.state = State2.RCDATA;
      this._stateRcdata(cp);
    }
  }
  _stateRawtextLessThanSign(cp) {
    if (cp === CODE_POINTS.SOLIDUS) {
      this.state = State2.RAWTEXT_END_TAG_OPEN;
    } else {
      this._emitChars("<");
      this.state = State2.RAWTEXT;
      this._stateRawtext(cp);
    }
  }
  _stateRawtextEndTagOpen(cp) {
    if (isAsciiLetter(cp)) {
      this.state = State2.RAWTEXT_END_TAG_NAME;
      this._stateRawtextEndTagName(cp);
    } else {
      this._emitChars("</");
      this.state = State2.RAWTEXT;
      this._stateRawtext(cp);
    }
  }
  _stateRawtextEndTagName(cp) {
    if (this.handleSpecialEndTag(cp)) {
      this._emitChars("</");
      this.state = State2.RAWTEXT;
      this._stateRawtext(cp);
    }
  }
  _stateScriptDataLessThanSign(cp) {
    switch (cp) {
      case CODE_POINTS.SOLIDUS: {
        this.state = State2.SCRIPT_DATA_END_TAG_OPEN;
        break;
      }
      case CODE_POINTS.EXCLAMATION_MARK: {
        this.state = State2.SCRIPT_DATA_ESCAPE_START;
        this._emitChars("<!");
        break;
      }
      default: {
        this._emitChars("<");
        this.state = State2.SCRIPT_DATA;
        this._stateScriptData(cp);
      }
    }
  }
  _stateScriptDataEndTagOpen(cp) {
    if (isAsciiLetter(cp)) {
      this.state = State2.SCRIPT_DATA_END_TAG_NAME;
      this._stateScriptDataEndTagName(cp);
    } else {
      this._emitChars("</");
      this.state = State2.SCRIPT_DATA;
      this._stateScriptData(cp);
    }
  }
  _stateScriptDataEndTagName(cp) {
    if (this.handleSpecialEndTag(cp)) {
      this._emitChars("</");
      this.state = State2.SCRIPT_DATA;
      this._stateScriptData(cp);
    }
  }
  _stateScriptDataEscapeStart(cp) {
    if (cp === CODE_POINTS.HYPHEN_MINUS) {
      this.state = State2.SCRIPT_DATA_ESCAPE_START_DASH;
      this._emitChars("-");
    } else {
      this.state = State2.SCRIPT_DATA;
      this._stateScriptData(cp);
    }
  }
  _stateScriptDataEscapeStartDash(cp) {
    if (cp === CODE_POINTS.HYPHEN_MINUS) {
      this.state = State2.SCRIPT_DATA_ESCAPED_DASH_DASH;
      this._emitChars("-");
    } else {
      this.state = State2.SCRIPT_DATA;
      this._stateScriptData(cp);
    }
  }
  _stateScriptDataEscaped(cp) {
    switch (cp) {
      case CODE_POINTS.HYPHEN_MINUS: {
        this.state = State2.SCRIPT_DATA_ESCAPED_DASH;
        this._emitChars("-");
        break;
      }
      case CODE_POINTS.LESS_THAN_SIGN: {
        this.state = State2.SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN;
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this._emitChars(REPLACEMENT_CHARACTER);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInScriptHtmlCommentLikeText);
        this._emitEOFToken();
        break;
      }
      default: {
        this._emitCodePoint(cp);
      }
    }
  }
  _stateScriptDataEscapedDash(cp) {
    switch (cp) {
      case CODE_POINTS.HYPHEN_MINUS: {
        this.state = State2.SCRIPT_DATA_ESCAPED_DASH_DASH;
        this._emitChars("-");
        break;
      }
      case CODE_POINTS.LESS_THAN_SIGN: {
        this.state = State2.SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN;
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this.state = State2.SCRIPT_DATA_ESCAPED;
        this._emitChars(REPLACEMENT_CHARACTER);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInScriptHtmlCommentLikeText);
        this._emitEOFToken();
        break;
      }
      default: {
        this.state = State2.SCRIPT_DATA_ESCAPED;
        this._emitCodePoint(cp);
      }
    }
  }
  _stateScriptDataEscapedDashDash(cp) {
    switch (cp) {
      case CODE_POINTS.HYPHEN_MINUS: {
        this._emitChars("-");
        break;
      }
      case CODE_POINTS.LESS_THAN_SIGN: {
        this.state = State2.SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.state = State2.SCRIPT_DATA;
        this._emitChars(">");
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this.state = State2.SCRIPT_DATA_ESCAPED;
        this._emitChars(REPLACEMENT_CHARACTER);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInScriptHtmlCommentLikeText);
        this._emitEOFToken();
        break;
      }
      default: {
        this.state = State2.SCRIPT_DATA_ESCAPED;
        this._emitCodePoint(cp);
      }
    }
  }
  _stateScriptDataEscapedLessThanSign(cp) {
    if (cp === CODE_POINTS.SOLIDUS) {
      this.state = State2.SCRIPT_DATA_ESCAPED_END_TAG_OPEN;
    } else if (isAsciiLetter(cp)) {
      this._emitChars("<");
      this.state = State2.SCRIPT_DATA_DOUBLE_ESCAPE_START;
      this._stateScriptDataDoubleEscapeStart(cp);
    } else {
      this._emitChars("<");
      this.state = State2.SCRIPT_DATA_ESCAPED;
      this._stateScriptDataEscaped(cp);
    }
  }
  _stateScriptDataEscapedEndTagOpen(cp) {
    if (isAsciiLetter(cp)) {
      this.state = State2.SCRIPT_DATA_ESCAPED_END_TAG_NAME;
      this._stateScriptDataEscapedEndTagName(cp);
    } else {
      this._emitChars("</");
      this.state = State2.SCRIPT_DATA_ESCAPED;
      this._stateScriptDataEscaped(cp);
    }
  }
  _stateScriptDataEscapedEndTagName(cp) {
    if (this.handleSpecialEndTag(cp)) {
      this._emitChars("</");
      this.state = State2.SCRIPT_DATA_ESCAPED;
      this._stateScriptDataEscaped(cp);
    }
  }
  _stateScriptDataDoubleEscapeStart(cp) {
    if (this.preprocessor.startsWith(SEQUENCES.SCRIPT, false) && isScriptDataDoubleEscapeSequenceEnd(this.preprocessor.peek(SEQUENCES.SCRIPT.length))) {
      this._emitCodePoint(cp);
      for (let i = 0;i < SEQUENCES.SCRIPT.length; i++) {
        this._emitCodePoint(this._consume());
      }
      this.state = State2.SCRIPT_DATA_DOUBLE_ESCAPED;
    } else if (!this._ensureHibernation()) {
      this.state = State2.SCRIPT_DATA_ESCAPED;
      this._stateScriptDataEscaped(cp);
    }
  }
  _stateScriptDataDoubleEscaped(cp) {
    switch (cp) {
      case CODE_POINTS.HYPHEN_MINUS: {
        this.state = State2.SCRIPT_DATA_DOUBLE_ESCAPED_DASH;
        this._emitChars("-");
        break;
      }
      case CODE_POINTS.LESS_THAN_SIGN: {
        this.state = State2.SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN;
        this._emitChars("<");
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this._emitChars(REPLACEMENT_CHARACTER);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInScriptHtmlCommentLikeText);
        this._emitEOFToken();
        break;
      }
      default: {
        this._emitCodePoint(cp);
      }
    }
  }
  _stateScriptDataDoubleEscapedDash(cp) {
    switch (cp) {
      case CODE_POINTS.HYPHEN_MINUS: {
        this.state = State2.SCRIPT_DATA_DOUBLE_ESCAPED_DASH_DASH;
        this._emitChars("-");
        break;
      }
      case CODE_POINTS.LESS_THAN_SIGN: {
        this.state = State2.SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN;
        this._emitChars("<");
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this.state = State2.SCRIPT_DATA_DOUBLE_ESCAPED;
        this._emitChars(REPLACEMENT_CHARACTER);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInScriptHtmlCommentLikeText);
        this._emitEOFToken();
        break;
      }
      default: {
        this.state = State2.SCRIPT_DATA_DOUBLE_ESCAPED;
        this._emitCodePoint(cp);
      }
    }
  }
  _stateScriptDataDoubleEscapedDashDash(cp) {
    switch (cp) {
      case CODE_POINTS.HYPHEN_MINUS: {
        this._emitChars("-");
        break;
      }
      case CODE_POINTS.LESS_THAN_SIGN: {
        this.state = State2.SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN;
        this._emitChars("<");
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.state = State2.SCRIPT_DATA;
        this._emitChars(">");
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this.state = State2.SCRIPT_DATA_DOUBLE_ESCAPED;
        this._emitChars(REPLACEMENT_CHARACTER);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInScriptHtmlCommentLikeText);
        this._emitEOFToken();
        break;
      }
      default: {
        this.state = State2.SCRIPT_DATA_DOUBLE_ESCAPED;
        this._emitCodePoint(cp);
      }
    }
  }
  _stateScriptDataDoubleEscapedLessThanSign(cp) {
    if (cp === CODE_POINTS.SOLIDUS) {
      this.state = State2.SCRIPT_DATA_DOUBLE_ESCAPE_END;
      this._emitChars("/");
    } else {
      this.state = State2.SCRIPT_DATA_DOUBLE_ESCAPED;
      this._stateScriptDataDoubleEscaped(cp);
    }
  }
  _stateScriptDataDoubleEscapeEnd(cp) {
    if (this.preprocessor.startsWith(SEQUENCES.SCRIPT, false) && isScriptDataDoubleEscapeSequenceEnd(this.preprocessor.peek(SEQUENCES.SCRIPT.length))) {
      this._emitCodePoint(cp);
      for (let i = 0;i < SEQUENCES.SCRIPT.length; i++) {
        this._emitCodePoint(this._consume());
      }
      this.state = State2.SCRIPT_DATA_ESCAPED;
    } else if (!this._ensureHibernation()) {
      this.state = State2.SCRIPT_DATA_DOUBLE_ESCAPED;
      this._stateScriptDataDoubleEscaped(cp);
    }
  }
  _stateBeforeAttributeName(cp) {
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        break;
      }
      case CODE_POINTS.SOLIDUS:
      case CODE_POINTS.GREATER_THAN_SIGN:
      case CODE_POINTS.EOF: {
        this.state = State2.AFTER_ATTRIBUTE_NAME;
        this._stateAfterAttributeName(cp);
        break;
      }
      case CODE_POINTS.EQUALS_SIGN: {
        this._err(ERR.unexpectedEqualsSignBeforeAttributeName);
        this._createAttr("=");
        this.state = State2.ATTRIBUTE_NAME;
        break;
      }
      default: {
        this._createAttr("");
        this.state = State2.ATTRIBUTE_NAME;
        this._stateAttributeName(cp);
      }
    }
  }
  _stateAttributeName(cp) {
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED:
      case CODE_POINTS.SOLIDUS:
      case CODE_POINTS.GREATER_THAN_SIGN:
      case CODE_POINTS.EOF: {
        this._leaveAttrName();
        this.state = State2.AFTER_ATTRIBUTE_NAME;
        this._stateAfterAttributeName(cp);
        break;
      }
      case CODE_POINTS.EQUALS_SIGN: {
        this._leaveAttrName();
        this.state = State2.BEFORE_ATTRIBUTE_VALUE;
        break;
      }
      case CODE_POINTS.QUOTATION_MARK:
      case CODE_POINTS.APOSTROPHE:
      case CODE_POINTS.LESS_THAN_SIGN: {
        this._err(ERR.unexpectedCharacterInAttributeName);
        this.currentAttr.name += String.fromCodePoint(cp);
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this.currentAttr.name += REPLACEMENT_CHARACTER;
        break;
      }
      default: {
        this.currentAttr.name += String.fromCodePoint(isAsciiUpper(cp) ? toAsciiLower(cp) : cp);
      }
    }
  }
  _stateAfterAttributeName(cp) {
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        break;
      }
      case CODE_POINTS.SOLIDUS: {
        this.state = State2.SELF_CLOSING_START_TAG;
        break;
      }
      case CODE_POINTS.EQUALS_SIGN: {
        this.state = State2.BEFORE_ATTRIBUTE_VALUE;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.state = State2.DATA;
        this.emitCurrentTagToken();
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInTag);
        this._emitEOFToken();
        break;
      }
      default: {
        this._createAttr("");
        this.state = State2.ATTRIBUTE_NAME;
        this._stateAttributeName(cp);
      }
    }
  }
  _stateBeforeAttributeValue(cp) {
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        break;
      }
      case CODE_POINTS.QUOTATION_MARK: {
        this.state = State2.ATTRIBUTE_VALUE_DOUBLE_QUOTED;
        break;
      }
      case CODE_POINTS.APOSTROPHE: {
        this.state = State2.ATTRIBUTE_VALUE_SINGLE_QUOTED;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._err(ERR.missingAttributeValue);
        this.state = State2.DATA;
        this.emitCurrentTagToken();
        break;
      }
      default: {
        this.state = State2.ATTRIBUTE_VALUE_UNQUOTED;
        this._stateAttributeValueUnquoted(cp);
      }
    }
  }
  _stateAttributeValueDoubleQuoted(cp) {
    switch (cp) {
      case CODE_POINTS.QUOTATION_MARK: {
        this.state = State2.AFTER_ATTRIBUTE_VALUE_QUOTED;
        break;
      }
      case CODE_POINTS.AMPERSAND: {
        this._startCharacterReference();
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this.currentAttr.value += REPLACEMENT_CHARACTER;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInTag);
        this._emitEOFToken();
        break;
      }
      default: {
        this.currentAttr.value += String.fromCodePoint(cp);
      }
    }
  }
  _stateAttributeValueSingleQuoted(cp) {
    switch (cp) {
      case CODE_POINTS.APOSTROPHE: {
        this.state = State2.AFTER_ATTRIBUTE_VALUE_QUOTED;
        break;
      }
      case CODE_POINTS.AMPERSAND: {
        this._startCharacterReference();
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this.currentAttr.value += REPLACEMENT_CHARACTER;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInTag);
        this._emitEOFToken();
        break;
      }
      default: {
        this.currentAttr.value += String.fromCodePoint(cp);
      }
    }
  }
  _stateAttributeValueUnquoted(cp) {
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        this._leaveAttrValue();
        this.state = State2.BEFORE_ATTRIBUTE_NAME;
        break;
      }
      case CODE_POINTS.AMPERSAND: {
        this._startCharacterReference();
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._leaveAttrValue();
        this.state = State2.DATA;
        this.emitCurrentTagToken();
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        this.currentAttr.value += REPLACEMENT_CHARACTER;
        break;
      }
      case CODE_POINTS.QUOTATION_MARK:
      case CODE_POINTS.APOSTROPHE:
      case CODE_POINTS.LESS_THAN_SIGN:
      case CODE_POINTS.EQUALS_SIGN:
      case CODE_POINTS.GRAVE_ACCENT: {
        this._err(ERR.unexpectedCharacterInUnquotedAttributeValue);
        this.currentAttr.value += String.fromCodePoint(cp);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInTag);
        this._emitEOFToken();
        break;
      }
      default: {
        this.currentAttr.value += String.fromCodePoint(cp);
      }
    }
  }
  _stateAfterAttributeValueQuoted(cp) {
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        this._leaveAttrValue();
        this.state = State2.BEFORE_ATTRIBUTE_NAME;
        break;
      }
      case CODE_POINTS.SOLIDUS: {
        this._leaveAttrValue();
        this.state = State2.SELF_CLOSING_START_TAG;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._leaveAttrValue();
        this.state = State2.DATA;
        this.emitCurrentTagToken();
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInTag);
        this._emitEOFToken();
        break;
      }
      default: {
        this._err(ERR.missingWhitespaceBetweenAttributes);
        this.state = State2.BEFORE_ATTRIBUTE_NAME;
        this._stateBeforeAttributeName(cp);
      }
    }
  }
  _stateSelfClosingStartTag(cp) {
    switch (cp) {
      case CODE_POINTS.GREATER_THAN_SIGN: {
        const token = this.currentToken;
        token.selfClosing = true;
        this.state = State2.DATA;
        this.emitCurrentTagToken();
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInTag);
        this._emitEOFToken();
        break;
      }
      default: {
        this._err(ERR.unexpectedSolidusInTag);
        this.state = State2.BEFORE_ATTRIBUTE_NAME;
        this._stateBeforeAttributeName(cp);
      }
    }
  }
  _stateBogusComment(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.state = State2.DATA;
        this.emitCurrentComment(token);
        break;
      }
      case CODE_POINTS.EOF: {
        this.emitCurrentComment(token);
        this._emitEOFToken();
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        token.data += REPLACEMENT_CHARACTER;
        break;
      }
      default: {
        token.data += String.fromCodePoint(cp);
      }
    }
  }
  _stateMarkupDeclarationOpen(cp) {
    if (this._consumeSequenceIfMatch(SEQUENCES.DASH_DASH, true)) {
      this._createCommentToken(SEQUENCES.DASH_DASH.length + 1);
      this.state = State2.COMMENT_START;
    } else if (this._consumeSequenceIfMatch(SEQUENCES.DOCTYPE, false)) {
      this.currentLocation = this.getCurrentLocation(SEQUENCES.DOCTYPE.length + 1);
      this.state = State2.DOCTYPE;
    } else if (this._consumeSequenceIfMatch(SEQUENCES.CDATA_START, true)) {
      if (this.inForeignNode) {
        this.state = State2.CDATA_SECTION;
      } else {
        this._err(ERR.cdataInHtmlContent);
        this._createCommentToken(SEQUENCES.CDATA_START.length + 1);
        this.currentToken.data = "[CDATA[";
        this.state = State2.BOGUS_COMMENT;
      }
    } else if (!this._ensureHibernation()) {
      this._err(ERR.incorrectlyOpenedComment);
      this._createCommentToken(2);
      this.state = State2.BOGUS_COMMENT;
      this._stateBogusComment(cp);
    }
  }
  _stateCommentStart(cp) {
    switch (cp) {
      case CODE_POINTS.HYPHEN_MINUS: {
        this.state = State2.COMMENT_START_DASH;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._err(ERR.abruptClosingOfEmptyComment);
        this.state = State2.DATA;
        const token = this.currentToken;
        this.emitCurrentComment(token);
        break;
      }
      default: {
        this.state = State2.COMMENT;
        this._stateComment(cp);
      }
    }
  }
  _stateCommentStartDash(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.HYPHEN_MINUS: {
        this.state = State2.COMMENT_END;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._err(ERR.abruptClosingOfEmptyComment);
        this.state = State2.DATA;
        this.emitCurrentComment(token);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInComment);
        this.emitCurrentComment(token);
        this._emitEOFToken();
        break;
      }
      default: {
        token.data += "-";
        this.state = State2.COMMENT;
        this._stateComment(cp);
      }
    }
  }
  _stateComment(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.HYPHEN_MINUS: {
        this.state = State2.COMMENT_END_DASH;
        break;
      }
      case CODE_POINTS.LESS_THAN_SIGN: {
        token.data += "<";
        this.state = State2.COMMENT_LESS_THAN_SIGN;
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        token.data += REPLACEMENT_CHARACTER;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInComment);
        this.emitCurrentComment(token);
        this._emitEOFToken();
        break;
      }
      default: {
        token.data += String.fromCodePoint(cp);
      }
    }
  }
  _stateCommentLessThanSign(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.EXCLAMATION_MARK: {
        token.data += "!";
        this.state = State2.COMMENT_LESS_THAN_SIGN_BANG;
        break;
      }
      case CODE_POINTS.LESS_THAN_SIGN: {
        token.data += "<";
        break;
      }
      default: {
        this.state = State2.COMMENT;
        this._stateComment(cp);
      }
    }
  }
  _stateCommentLessThanSignBang(cp) {
    if (cp === CODE_POINTS.HYPHEN_MINUS) {
      this.state = State2.COMMENT_LESS_THAN_SIGN_BANG_DASH;
    } else {
      this.state = State2.COMMENT;
      this._stateComment(cp);
    }
  }
  _stateCommentLessThanSignBangDash(cp) {
    if (cp === CODE_POINTS.HYPHEN_MINUS) {
      this.state = State2.COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH;
    } else {
      this.state = State2.COMMENT_END_DASH;
      this._stateCommentEndDash(cp);
    }
  }
  _stateCommentLessThanSignBangDashDash(cp) {
    if (cp !== CODE_POINTS.GREATER_THAN_SIGN && cp !== CODE_POINTS.EOF) {
      this._err(ERR.nestedComment);
    }
    this.state = State2.COMMENT_END;
    this._stateCommentEnd(cp);
  }
  _stateCommentEndDash(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.HYPHEN_MINUS: {
        this.state = State2.COMMENT_END;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInComment);
        this.emitCurrentComment(token);
        this._emitEOFToken();
        break;
      }
      default: {
        token.data += "-";
        this.state = State2.COMMENT;
        this._stateComment(cp);
      }
    }
  }
  _stateCommentEnd(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.state = State2.DATA;
        this.emitCurrentComment(token);
        break;
      }
      case CODE_POINTS.EXCLAMATION_MARK: {
        this.state = State2.COMMENT_END_BANG;
        break;
      }
      case CODE_POINTS.HYPHEN_MINUS: {
        token.data += "-";
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInComment);
        this.emitCurrentComment(token);
        this._emitEOFToken();
        break;
      }
      default: {
        token.data += "--";
        this.state = State2.COMMENT;
        this._stateComment(cp);
      }
    }
  }
  _stateCommentEndBang(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.HYPHEN_MINUS: {
        token.data += "--!";
        this.state = State2.COMMENT_END_DASH;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._err(ERR.incorrectlyClosedComment);
        this.state = State2.DATA;
        this.emitCurrentComment(token);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInComment);
        this.emitCurrentComment(token);
        this._emitEOFToken();
        break;
      }
      default: {
        token.data += "--!";
        this.state = State2.COMMENT;
        this._stateComment(cp);
      }
    }
  }
  _stateDoctype(cp) {
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        this.state = State2.BEFORE_DOCTYPE_NAME;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.state = State2.BEFORE_DOCTYPE_NAME;
        this._stateBeforeDoctypeName(cp);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        this._createDoctypeToken(null);
        const token = this.currentToken;
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        this._err(ERR.missingWhitespaceBeforeDoctypeName);
        this.state = State2.BEFORE_DOCTYPE_NAME;
        this._stateBeforeDoctypeName(cp);
      }
    }
  }
  _stateBeforeDoctypeName(cp) {
    if (isAsciiUpper(cp)) {
      this._createDoctypeToken(String.fromCharCode(toAsciiLower(cp)));
      this.state = State2.DOCTYPE_NAME;
    } else
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          this._createDoctypeToken(REPLACEMENT_CHARACTER);
          this.state = State2.DOCTYPE_NAME;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this._err(ERR.missingDoctypeName);
          this._createDoctypeToken(null);
          const token = this.currentToken;
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this.state = State2.DATA;
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInDoctype);
          this._createDoctypeToken(null);
          const token = this.currentToken;
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this._emitEOFToken();
          break;
        }
        default: {
          this._createDoctypeToken(String.fromCodePoint(cp));
          this.state = State2.DOCTYPE_NAME;
        }
      }
  }
  _stateDoctypeName(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        this.state = State2.AFTER_DOCTYPE_NAME;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.state = State2.DATA;
        this.emitCurrentDoctype(token);
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        token.name += REPLACEMENT_CHARACTER;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        token.name += String.fromCodePoint(isAsciiUpper(cp) ? toAsciiLower(cp) : cp);
      }
    }
  }
  _stateAfterDoctypeName(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.state = State2.DATA;
        this.emitCurrentDoctype(token);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        if (this._consumeSequenceIfMatch(SEQUENCES.PUBLIC, false)) {
          this.state = State2.AFTER_DOCTYPE_PUBLIC_KEYWORD;
        } else if (this._consumeSequenceIfMatch(SEQUENCES.SYSTEM, false)) {
          this.state = State2.AFTER_DOCTYPE_SYSTEM_KEYWORD;
        } else if (!this._ensureHibernation()) {
          this._err(ERR.invalidCharacterSequenceAfterDoctypeName);
          token.forceQuirks = true;
          this.state = State2.BOGUS_DOCTYPE;
          this._stateBogusDoctype(cp);
        }
      }
    }
  }
  _stateAfterDoctypePublicKeyword(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        this.state = State2.BEFORE_DOCTYPE_PUBLIC_IDENTIFIER;
        break;
      }
      case CODE_POINTS.QUOTATION_MARK: {
        this._err(ERR.missingWhitespaceAfterDoctypePublicKeyword);
        token.publicId = "";
        this.state = State2.DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED;
        break;
      }
      case CODE_POINTS.APOSTROPHE: {
        this._err(ERR.missingWhitespaceAfterDoctypePublicKeyword);
        token.publicId = "";
        this.state = State2.DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._err(ERR.missingDoctypePublicIdentifier);
        token.forceQuirks = true;
        this.state = State2.DATA;
        this.emitCurrentDoctype(token);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        this._err(ERR.missingQuoteBeforeDoctypePublicIdentifier);
        token.forceQuirks = true;
        this.state = State2.BOGUS_DOCTYPE;
        this._stateBogusDoctype(cp);
      }
    }
  }
  _stateBeforeDoctypePublicIdentifier(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        break;
      }
      case CODE_POINTS.QUOTATION_MARK: {
        token.publicId = "";
        this.state = State2.DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED;
        break;
      }
      case CODE_POINTS.APOSTROPHE: {
        token.publicId = "";
        this.state = State2.DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._err(ERR.missingDoctypePublicIdentifier);
        token.forceQuirks = true;
        this.state = State2.DATA;
        this.emitCurrentDoctype(token);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        this._err(ERR.missingQuoteBeforeDoctypePublicIdentifier);
        token.forceQuirks = true;
        this.state = State2.BOGUS_DOCTYPE;
        this._stateBogusDoctype(cp);
      }
    }
  }
  _stateDoctypePublicIdentifierDoubleQuoted(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.QUOTATION_MARK: {
        this.state = State2.AFTER_DOCTYPE_PUBLIC_IDENTIFIER;
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        token.publicId += REPLACEMENT_CHARACTER;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._err(ERR.abruptDoctypePublicIdentifier);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this.state = State2.DATA;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        token.publicId += String.fromCodePoint(cp);
      }
    }
  }
  _stateDoctypePublicIdentifierSingleQuoted(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.APOSTROPHE: {
        this.state = State2.AFTER_DOCTYPE_PUBLIC_IDENTIFIER;
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        token.publicId += REPLACEMENT_CHARACTER;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._err(ERR.abruptDoctypePublicIdentifier);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this.state = State2.DATA;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        token.publicId += String.fromCodePoint(cp);
      }
    }
  }
  _stateAfterDoctypePublicIdentifier(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        this.state = State2.BETWEEN_DOCTYPE_PUBLIC_AND_SYSTEM_IDENTIFIERS;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.state = State2.DATA;
        this.emitCurrentDoctype(token);
        break;
      }
      case CODE_POINTS.QUOTATION_MARK: {
        this._err(ERR.missingWhitespaceBetweenDoctypePublicAndSystemIdentifiers);
        token.systemId = "";
        this.state = State2.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED;
        break;
      }
      case CODE_POINTS.APOSTROPHE: {
        this._err(ERR.missingWhitespaceBetweenDoctypePublicAndSystemIdentifiers);
        token.systemId = "";
        this.state = State2.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        this._err(ERR.missingQuoteBeforeDoctypeSystemIdentifier);
        token.forceQuirks = true;
        this.state = State2.BOGUS_DOCTYPE;
        this._stateBogusDoctype(cp);
      }
    }
  }
  _stateBetweenDoctypePublicAndSystemIdentifiers(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.emitCurrentDoctype(token);
        this.state = State2.DATA;
        break;
      }
      case CODE_POINTS.QUOTATION_MARK: {
        token.systemId = "";
        this.state = State2.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED;
        break;
      }
      case CODE_POINTS.APOSTROPHE: {
        token.systemId = "";
        this.state = State2.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        this._err(ERR.missingQuoteBeforeDoctypeSystemIdentifier);
        token.forceQuirks = true;
        this.state = State2.BOGUS_DOCTYPE;
        this._stateBogusDoctype(cp);
      }
    }
  }
  _stateAfterDoctypeSystemKeyword(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        this.state = State2.BEFORE_DOCTYPE_SYSTEM_IDENTIFIER;
        break;
      }
      case CODE_POINTS.QUOTATION_MARK: {
        this._err(ERR.missingWhitespaceAfterDoctypeSystemKeyword);
        token.systemId = "";
        this.state = State2.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED;
        break;
      }
      case CODE_POINTS.APOSTROPHE: {
        this._err(ERR.missingWhitespaceAfterDoctypeSystemKeyword);
        token.systemId = "";
        this.state = State2.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._err(ERR.missingDoctypeSystemIdentifier);
        token.forceQuirks = true;
        this.state = State2.DATA;
        this.emitCurrentDoctype(token);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        this._err(ERR.missingQuoteBeforeDoctypeSystemIdentifier);
        token.forceQuirks = true;
        this.state = State2.BOGUS_DOCTYPE;
        this._stateBogusDoctype(cp);
      }
    }
  }
  _stateBeforeDoctypeSystemIdentifier(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        break;
      }
      case CODE_POINTS.QUOTATION_MARK: {
        token.systemId = "";
        this.state = State2.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED;
        break;
      }
      case CODE_POINTS.APOSTROPHE: {
        token.systemId = "";
        this.state = State2.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._err(ERR.missingDoctypeSystemIdentifier);
        token.forceQuirks = true;
        this.state = State2.DATA;
        this.emitCurrentDoctype(token);
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        this._err(ERR.missingQuoteBeforeDoctypeSystemIdentifier);
        token.forceQuirks = true;
        this.state = State2.BOGUS_DOCTYPE;
        this._stateBogusDoctype(cp);
      }
    }
  }
  _stateDoctypeSystemIdentifierDoubleQuoted(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.QUOTATION_MARK: {
        this.state = State2.AFTER_DOCTYPE_SYSTEM_IDENTIFIER;
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        token.systemId += REPLACEMENT_CHARACTER;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._err(ERR.abruptDoctypeSystemIdentifier);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this.state = State2.DATA;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        token.systemId += String.fromCodePoint(cp);
      }
    }
  }
  _stateDoctypeSystemIdentifierSingleQuoted(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.APOSTROPHE: {
        this.state = State2.AFTER_DOCTYPE_SYSTEM_IDENTIFIER;
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        token.systemId += REPLACEMENT_CHARACTER;
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this._err(ERR.abruptDoctypeSystemIdentifier);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this.state = State2.DATA;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        token.systemId += String.fromCodePoint(cp);
      }
    }
  }
  _stateAfterDoctypeSystemIdentifier(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.SPACE:
      case CODE_POINTS.LINE_FEED:
      case CODE_POINTS.TABULATION:
      case CODE_POINTS.FORM_FEED: {
        break;
      }
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.emitCurrentDoctype(token);
        this.state = State2.DATA;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInDoctype);
        token.forceQuirks = true;
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default: {
        this._err(ERR.unexpectedCharacterAfterDoctypeSystemIdentifier);
        this.state = State2.BOGUS_DOCTYPE;
        this._stateBogusDoctype(cp);
      }
    }
  }
  _stateBogusDoctype(cp) {
    const token = this.currentToken;
    switch (cp) {
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.emitCurrentDoctype(token);
        this.state = State2.DATA;
        break;
      }
      case CODE_POINTS.NULL: {
        this._err(ERR.unexpectedNullCharacter);
        break;
      }
      case CODE_POINTS.EOF: {
        this.emitCurrentDoctype(token);
        this._emitEOFToken();
        break;
      }
      default:
    }
  }
  _stateCdataSection(cp) {
    switch (cp) {
      case CODE_POINTS.RIGHT_SQUARE_BRACKET: {
        this.state = State2.CDATA_SECTION_BRACKET;
        break;
      }
      case CODE_POINTS.EOF: {
        this._err(ERR.eofInCdata);
        this._emitEOFToken();
        break;
      }
      default: {
        this._emitCodePoint(cp);
      }
    }
  }
  _stateCdataSectionBracket(cp) {
    if (cp === CODE_POINTS.RIGHT_SQUARE_BRACKET) {
      this.state = State2.CDATA_SECTION_END;
    } else {
      this._emitChars("]");
      this.state = State2.CDATA_SECTION;
      this._stateCdataSection(cp);
    }
  }
  _stateCdataSectionEnd(cp) {
    switch (cp) {
      case CODE_POINTS.GREATER_THAN_SIGN: {
        this.state = State2.DATA;
        break;
      }
      case CODE_POINTS.RIGHT_SQUARE_BRACKET: {
        this._emitChars("]");
        break;
      }
      default: {
        this._emitChars("]]");
        this.state = State2.CDATA_SECTION;
        this._stateCdataSection(cp);
      }
    }
  }
  _stateCharacterReference() {
    let length = this.entityDecoder.write(this.preprocessor.html, this.preprocessor.pos);
    if (length < 0) {
      if (this.preprocessor.lastChunkWritten) {
        length = this.entityDecoder.end();
      } else {
        this.active = false;
        this.preprocessor.pos = this.preprocessor.html.length - 1;
        this.consumedAfterSnapshot = 0;
        this.preprocessor.endOfChunkHit = true;
        return;
      }
    }
    if (length === 0) {
      this.preprocessor.pos = this.entityStartPos;
      this._flushCodePointConsumedAsCharacterReference(CODE_POINTS.AMPERSAND);
      this.state = !this._isCharacterReferenceInAttribute() && isAsciiAlphaNumeric(this.preprocessor.peek(1)) ? State2.AMBIGUOUS_AMPERSAND : this.returnState;
    } else {
      this.state = this.returnState;
    }
  }
  _stateAmbiguousAmpersand(cp) {
    if (isAsciiAlphaNumeric(cp)) {
      this._flushCodePointConsumedAsCharacterReference(cp);
    } else {
      if (cp === CODE_POINTS.SEMICOLON) {
        this._err(ERR.unknownNamedCharacterReference);
      }
      this.state = this.returnState;
      this._callState(cp);
    }
  }
}

// node_modules/parse5/dist/parser/open-element-stack.js
var IMPLICIT_END_TAG_REQUIRED = new Set([TAG_ID.DD, TAG_ID.DT, TAG_ID.LI, TAG_ID.OPTGROUP, TAG_ID.OPTION, TAG_ID.P, TAG_ID.RB, TAG_ID.RP, TAG_ID.RT, TAG_ID.RTC]);
var IMPLICIT_END_TAG_REQUIRED_THOROUGHLY = new Set([
  ...IMPLICIT_END_TAG_REQUIRED,
  TAG_ID.CAPTION,
  TAG_ID.COLGROUP,
  TAG_ID.TBODY,
  TAG_ID.TD,
  TAG_ID.TFOOT,
  TAG_ID.TH,
  TAG_ID.THEAD,
  TAG_ID.TR
]);
var SCOPING_ELEMENTS_HTML = new Set([
  TAG_ID.APPLET,
  TAG_ID.CAPTION,
  TAG_ID.HTML,
  TAG_ID.MARQUEE,
  TAG_ID.OBJECT,
  TAG_ID.TABLE,
  TAG_ID.TD,
  TAG_ID.TEMPLATE,
  TAG_ID.TH
]);
var SCOPING_ELEMENTS_HTML_LIST = new Set([...SCOPING_ELEMENTS_HTML, TAG_ID.OL, TAG_ID.UL]);
var SCOPING_ELEMENTS_HTML_BUTTON = new Set([...SCOPING_ELEMENTS_HTML, TAG_ID.BUTTON]);
var SCOPING_ELEMENTS_MATHML = new Set([TAG_ID.ANNOTATION_XML, TAG_ID.MI, TAG_ID.MN, TAG_ID.MO, TAG_ID.MS, TAG_ID.MTEXT]);
var SCOPING_ELEMENTS_SVG = new Set([TAG_ID.DESC, TAG_ID.FOREIGN_OBJECT, TAG_ID.TITLE]);
var TABLE_ROW_CONTEXT = new Set([TAG_ID.TR, TAG_ID.TEMPLATE, TAG_ID.HTML]);
var TABLE_BODY_CONTEXT = new Set([TAG_ID.TBODY, TAG_ID.TFOOT, TAG_ID.THEAD, TAG_ID.TEMPLATE, TAG_ID.HTML]);
var TABLE_CONTEXT = new Set([TAG_ID.TABLE, TAG_ID.TEMPLATE, TAG_ID.HTML]);
var TABLE_CELLS = new Set([TAG_ID.TD, TAG_ID.TH]);

class OpenElementStack {
  get currentTmplContentOrNode() {
    return this._isInTemplate() ? this.treeAdapter.getTemplateContent(this.current) : this.current;
  }
  constructor(document, treeAdapter, handler) {
    this.treeAdapter = treeAdapter;
    this.handler = handler;
    this.items = [];
    this.tagIDs = [];
    this.stackTop = -1;
    this.tmplCount = 0;
    this.currentTagId = TAG_ID.UNKNOWN;
    this.current = document;
  }
  _indexOf(element) {
    return this.items.lastIndexOf(element, this.stackTop);
  }
  _isInTemplate() {
    return this.currentTagId === TAG_ID.TEMPLATE && this.treeAdapter.getNamespaceURI(this.current) === NS.HTML;
  }
  _updateCurrentElement() {
    this.current = this.items[this.stackTop];
    this.currentTagId = this.tagIDs[this.stackTop];
  }
  push(element, tagID) {
    this.stackTop++;
    this.items[this.stackTop] = element;
    this.current = element;
    this.tagIDs[this.stackTop] = tagID;
    this.currentTagId = tagID;
    if (this._isInTemplate()) {
      this.tmplCount++;
    }
    this.handler.onItemPush(element, tagID, true);
  }
  pop() {
    const popped = this.current;
    if (this.tmplCount > 0 && this._isInTemplate()) {
      this.tmplCount--;
    }
    this.stackTop--;
    this._updateCurrentElement();
    this.handler.onItemPop(popped, true);
  }
  replace(oldElement, newElement) {
    const idx = this._indexOf(oldElement);
    this.items[idx] = newElement;
    if (idx === this.stackTop) {
      this.current = newElement;
    }
  }
  insertAfter(referenceElement, newElement, newElementID) {
    const insertionIdx = this._indexOf(referenceElement) + 1;
    this.items.splice(insertionIdx, 0, newElement);
    this.tagIDs.splice(insertionIdx, 0, newElementID);
    this.stackTop++;
    if (insertionIdx === this.stackTop) {
      this._updateCurrentElement();
    }
    if (this.current && this.currentTagId !== undefined) {
      this.handler.onItemPush(this.current, this.currentTagId, insertionIdx === this.stackTop);
    }
  }
  popUntilTagNamePopped(tagName) {
    let targetIdx = this.stackTop + 1;
    do {
      targetIdx = this.tagIDs.lastIndexOf(tagName, targetIdx - 1);
    } while (targetIdx > 0 && this.treeAdapter.getNamespaceURI(this.items[targetIdx]) !== NS.HTML);
    this.shortenToLength(Math.max(targetIdx, 0));
  }
  shortenToLength(idx) {
    while (this.stackTop >= idx) {
      const popped = this.current;
      if (this.tmplCount > 0 && this._isInTemplate()) {
        this.tmplCount -= 1;
      }
      this.stackTop--;
      this._updateCurrentElement();
      this.handler.onItemPop(popped, this.stackTop < idx);
    }
  }
  popUntilElementPopped(element) {
    const idx = this._indexOf(element);
    this.shortenToLength(Math.max(idx, 0));
  }
  popUntilPopped(tagNames, targetNS) {
    const idx = this._indexOfTagNames(tagNames, targetNS);
    this.shortenToLength(Math.max(idx, 0));
  }
  popUntilNumberedHeaderPopped() {
    this.popUntilPopped(NUMBERED_HEADERS, NS.HTML);
  }
  popUntilTableCellPopped() {
    this.popUntilPopped(TABLE_CELLS, NS.HTML);
  }
  popAllUpToHtmlElement() {
    this.tmplCount = 0;
    this.shortenToLength(1);
  }
  _indexOfTagNames(tagNames, namespace) {
    for (let i = this.stackTop;i >= 0; i--) {
      if (tagNames.has(this.tagIDs[i]) && this.treeAdapter.getNamespaceURI(this.items[i]) === namespace) {
        return i;
      }
    }
    return -1;
  }
  clearBackTo(tagNames, targetNS) {
    const idx = this._indexOfTagNames(tagNames, targetNS);
    this.shortenToLength(idx + 1);
  }
  clearBackToTableContext() {
    this.clearBackTo(TABLE_CONTEXT, NS.HTML);
  }
  clearBackToTableBodyContext() {
    this.clearBackTo(TABLE_BODY_CONTEXT, NS.HTML);
  }
  clearBackToTableRowContext() {
    this.clearBackTo(TABLE_ROW_CONTEXT, NS.HTML);
  }
  remove(element) {
    const idx = this._indexOf(element);
    if (idx >= 0) {
      if (idx === this.stackTop) {
        this.pop();
      } else {
        this.items.splice(idx, 1);
        this.tagIDs.splice(idx, 1);
        this.stackTop--;
        this._updateCurrentElement();
        this.handler.onItemPop(element, false);
      }
    }
  }
  tryPeekProperlyNestedBodyElement() {
    return this.stackTop >= 1 && this.tagIDs[1] === TAG_ID.BODY ? this.items[1] : null;
  }
  contains(element) {
    return this._indexOf(element) > -1;
  }
  getCommonAncestor(element) {
    const elementIdx = this._indexOf(element) - 1;
    return elementIdx >= 0 ? this.items[elementIdx] : null;
  }
  isRootHtmlElementCurrent() {
    return this.stackTop === 0 && this.tagIDs[0] === TAG_ID.HTML;
  }
  hasInDynamicScope(tagName, htmlScope) {
    for (let i = this.stackTop;i >= 0; i--) {
      const tn = this.tagIDs[i];
      switch (this.treeAdapter.getNamespaceURI(this.items[i])) {
        case NS.HTML: {
          if (tn === tagName)
            return true;
          if (htmlScope.has(tn))
            return false;
          break;
        }
        case NS.SVG: {
          if (SCOPING_ELEMENTS_SVG.has(tn))
            return false;
          break;
        }
        case NS.MATHML: {
          if (SCOPING_ELEMENTS_MATHML.has(tn))
            return false;
          break;
        }
      }
    }
    return true;
  }
  hasInScope(tagName) {
    return this.hasInDynamicScope(tagName, SCOPING_ELEMENTS_HTML);
  }
  hasInListItemScope(tagName) {
    return this.hasInDynamicScope(tagName, SCOPING_ELEMENTS_HTML_LIST);
  }
  hasInButtonScope(tagName) {
    return this.hasInDynamicScope(tagName, SCOPING_ELEMENTS_HTML_BUTTON);
  }
  hasNumberedHeaderInScope() {
    for (let i = this.stackTop;i >= 0; i--) {
      const tn = this.tagIDs[i];
      switch (this.treeAdapter.getNamespaceURI(this.items[i])) {
        case NS.HTML: {
          if (NUMBERED_HEADERS.has(tn))
            return true;
          if (SCOPING_ELEMENTS_HTML.has(tn))
            return false;
          break;
        }
        case NS.SVG: {
          if (SCOPING_ELEMENTS_SVG.has(tn))
            return false;
          break;
        }
        case NS.MATHML: {
          if (SCOPING_ELEMENTS_MATHML.has(tn))
            return false;
          break;
        }
      }
    }
    return true;
  }
  hasInTableScope(tagName) {
    for (let i = this.stackTop;i >= 0; i--) {
      if (this.treeAdapter.getNamespaceURI(this.items[i]) !== NS.HTML) {
        continue;
      }
      switch (this.tagIDs[i]) {
        case tagName: {
          return true;
        }
        case TAG_ID.TABLE:
        case TAG_ID.HTML: {
          return false;
        }
      }
    }
    return true;
  }
  hasTableBodyContextInTableScope() {
    for (let i = this.stackTop;i >= 0; i--) {
      if (this.treeAdapter.getNamespaceURI(this.items[i]) !== NS.HTML) {
        continue;
      }
      switch (this.tagIDs[i]) {
        case TAG_ID.TBODY:
        case TAG_ID.THEAD:
        case TAG_ID.TFOOT: {
          return true;
        }
        case TAG_ID.TABLE:
        case TAG_ID.HTML: {
          return false;
        }
      }
    }
    return true;
  }
  hasInSelectScope(tagName) {
    for (let i = this.stackTop;i >= 0; i--) {
      if (this.treeAdapter.getNamespaceURI(this.items[i]) !== NS.HTML) {
        continue;
      }
      switch (this.tagIDs[i]) {
        case tagName: {
          return true;
        }
        case TAG_ID.OPTION:
        case TAG_ID.OPTGROUP: {
          break;
        }
        default: {
          return false;
        }
      }
    }
    return true;
  }
  generateImpliedEndTags() {
    while (this.currentTagId !== undefined && IMPLICIT_END_TAG_REQUIRED.has(this.currentTagId)) {
      this.pop();
    }
  }
  generateImpliedEndTagsThoroughly() {
    while (this.currentTagId !== undefined && IMPLICIT_END_TAG_REQUIRED_THOROUGHLY.has(this.currentTagId)) {
      this.pop();
    }
  }
  generateImpliedEndTagsWithExclusion(exclusionId) {
    while (this.currentTagId !== undefined && this.currentTagId !== exclusionId && IMPLICIT_END_TAG_REQUIRED_THOROUGHLY.has(this.currentTagId)) {
      this.pop();
    }
  }
}

// node_modules/parse5/dist/parser/formatting-element-list.js
var NOAH_ARK_CAPACITY = 3;
var EntryType;
(function(EntryType) {
  EntryType[EntryType["Marker"] = 0] = "Marker";
  EntryType[EntryType["Element"] = 1] = "Element";
})(EntryType || (EntryType = {}));
var MARKER = { type: EntryType.Marker };

class FormattingElementList {
  constructor(treeAdapter) {
    this.treeAdapter = treeAdapter;
    this.entries = [];
    this.bookmark = null;
  }
  _getNoahArkConditionCandidates(newElement, neAttrs) {
    const candidates = [];
    const neAttrsLength = neAttrs.length;
    const neTagName = this.treeAdapter.getTagName(newElement);
    const neNamespaceURI = this.treeAdapter.getNamespaceURI(newElement);
    for (let i = 0;i < this.entries.length; i++) {
      const entry = this.entries[i];
      if (entry.type === EntryType.Marker) {
        break;
      }
      const { element } = entry;
      if (this.treeAdapter.getTagName(element) === neTagName && this.treeAdapter.getNamespaceURI(element) === neNamespaceURI) {
        const elementAttrs = this.treeAdapter.getAttrList(element);
        if (elementAttrs.length === neAttrsLength) {
          candidates.push({ idx: i, attrs: elementAttrs });
        }
      }
    }
    return candidates;
  }
  _ensureNoahArkCondition(newElement) {
    if (this.entries.length < NOAH_ARK_CAPACITY)
      return;
    const neAttrs = this.treeAdapter.getAttrList(newElement);
    const candidates = this._getNoahArkConditionCandidates(newElement, neAttrs);
    if (candidates.length < NOAH_ARK_CAPACITY)
      return;
    const neAttrsMap = new Map(neAttrs.map((neAttr) => [neAttr.name, neAttr.value]));
    let validCandidates = 0;
    for (let i = 0;i < candidates.length; i++) {
      const candidate = candidates[i];
      if (candidate.attrs.every((cAttr) => neAttrsMap.get(cAttr.name) === cAttr.value)) {
        validCandidates += 1;
        if (validCandidates >= NOAH_ARK_CAPACITY) {
          this.entries.splice(candidate.idx, 1);
        }
      }
    }
  }
  insertMarker() {
    this.entries.unshift(MARKER);
  }
  pushElement(element, token) {
    this._ensureNoahArkCondition(element);
    this.entries.unshift({
      type: EntryType.Element,
      element,
      token
    });
  }
  insertElementAfterBookmark(element, token) {
    const bookmarkIdx = this.entries.indexOf(this.bookmark);
    this.entries.splice(bookmarkIdx, 0, {
      type: EntryType.Element,
      element,
      token
    });
  }
  removeEntry(entry) {
    const entryIndex = this.entries.indexOf(entry);
    if (entryIndex !== -1) {
      this.entries.splice(entryIndex, 1);
    }
  }
  clearToLastMarker() {
    const markerIdx = this.entries.indexOf(MARKER);
    if (markerIdx === -1) {
      this.entries.length = 0;
    } else {
      this.entries.splice(0, markerIdx + 1);
    }
  }
  getElementEntryInScopeWithTagName(tagName) {
    const entry = this.entries.find((entry) => entry.type === EntryType.Marker || this.treeAdapter.getTagName(entry.element) === tagName);
    return entry && entry.type === EntryType.Element ? entry : null;
  }
  getElementEntry(element) {
    return this.entries.find((entry) => entry.type === EntryType.Element && entry.element === element);
  }
}

// node_modules/parse5/dist/tree-adapters/default.js
var defaultTreeAdapter = {
  createDocument() {
    return {
      nodeName: "#document",
      mode: DOCUMENT_MODE.NO_QUIRKS,
      childNodes: []
    };
  },
  createDocumentFragment() {
    return {
      nodeName: "#document-fragment",
      childNodes: []
    };
  },
  createElement(tagName, namespaceURI, attrs) {
    return {
      nodeName: tagName,
      tagName,
      attrs,
      namespaceURI,
      childNodes: [],
      parentNode: null
    };
  },
  createCommentNode(data) {
    return {
      nodeName: "#comment",
      data,
      parentNode: null
    };
  },
  createTextNode(value) {
    return {
      nodeName: "#text",
      value,
      parentNode: null
    };
  },
  appendChild(parentNode, newNode) {
    parentNode.childNodes.push(newNode);
    newNode.parentNode = parentNode;
  },
  insertBefore(parentNode, newNode, referenceNode) {
    const insertionIdx = parentNode.childNodes.indexOf(referenceNode);
    parentNode.childNodes.splice(insertionIdx, 0, newNode);
    newNode.parentNode = parentNode;
  },
  setTemplateContent(templateElement, contentElement) {
    templateElement.content = contentElement;
  },
  getTemplateContent(templateElement) {
    return templateElement.content;
  },
  setDocumentType(document, name, publicId, systemId) {
    const doctypeNode = document.childNodes.find((node) => node.nodeName === "#documentType");
    if (doctypeNode) {
      doctypeNode.name = name;
      doctypeNode.publicId = publicId;
      doctypeNode.systemId = systemId;
    } else {
      const node = {
        nodeName: "#documentType",
        name,
        publicId,
        systemId,
        parentNode: null
      };
      defaultTreeAdapter.appendChild(document, node);
    }
  },
  setDocumentMode(document, mode) {
    document.mode = mode;
  },
  getDocumentMode(document) {
    return document.mode;
  },
  detachNode(node) {
    if (node.parentNode) {
      const idx = node.parentNode.childNodes.indexOf(node);
      node.parentNode.childNodes.splice(idx, 1);
      node.parentNode = null;
    }
  },
  insertText(parentNode, text) {
    if (parentNode.childNodes.length > 0) {
      const prevNode = parentNode.childNodes[parentNode.childNodes.length - 1];
      if (defaultTreeAdapter.isTextNode(prevNode)) {
        prevNode.value += text;
        return;
      }
    }
    defaultTreeAdapter.appendChild(parentNode, defaultTreeAdapter.createTextNode(text));
  },
  insertTextBefore(parentNode, text, referenceNode) {
    const prevNode = parentNode.childNodes[parentNode.childNodes.indexOf(referenceNode) - 1];
    if (prevNode && defaultTreeAdapter.isTextNode(prevNode)) {
      prevNode.value += text;
    } else {
      defaultTreeAdapter.insertBefore(parentNode, defaultTreeAdapter.createTextNode(text), referenceNode);
    }
  },
  adoptAttributes(recipient, attrs) {
    const recipientAttrsMap = new Set(recipient.attrs.map((attr) => attr.name));
    for (let j = 0;j < attrs.length; j++) {
      if (!recipientAttrsMap.has(attrs[j].name)) {
        recipient.attrs.push(attrs[j]);
      }
    }
  },
  getFirstChild(node) {
    return node.childNodes[0];
  },
  getChildNodes(node) {
    return node.childNodes;
  },
  getParentNode(node) {
    return node.parentNode;
  },
  getAttrList(element) {
    return element.attrs;
  },
  getTagName(element) {
    return element.tagName;
  },
  getNamespaceURI(element) {
    return element.namespaceURI;
  },
  getTextNodeContent(textNode) {
    return textNode.value;
  },
  getCommentNodeContent(commentNode) {
    return commentNode.data;
  },
  getDocumentTypeNodeName(doctypeNode) {
    return doctypeNode.name;
  },
  getDocumentTypeNodePublicId(doctypeNode) {
    return doctypeNode.publicId;
  },
  getDocumentTypeNodeSystemId(doctypeNode) {
    return doctypeNode.systemId;
  },
  isTextNode(node) {
    return node.nodeName === "#text";
  },
  isCommentNode(node) {
    return node.nodeName === "#comment";
  },
  isDocumentTypeNode(node) {
    return node.nodeName === "#documentType";
  },
  isElementNode(node) {
    return Object.prototype.hasOwnProperty.call(node, "tagName");
  },
  setNodeSourceCodeLocation(node, location) {
    node.sourceCodeLocation = location;
  },
  getNodeSourceCodeLocation(node) {
    return node.sourceCodeLocation;
  },
  updateNodeSourceCodeLocation(node, endLocation) {
    node.sourceCodeLocation = { ...node.sourceCodeLocation, ...endLocation };
  }
};

// node_modules/parse5/dist/common/doctype.js
var VALID_DOCTYPE_NAME = "html";
var VALID_SYSTEM_ID = "about:legacy-compat";
var QUIRKS_MODE_SYSTEM_ID = "http://www.ibm.com/data/dtd/v11/ibmxhtml1-transitional.dtd";
var QUIRKS_MODE_PUBLIC_ID_PREFIXES = [
  "+//silmaril//dtd html pro v0r11 19970101//",
  "-//as//dtd html 3.0 aswedit + extensions//",
  "-//advasoft ltd//dtd html 3.0 aswedit + extensions//",
  "-//ietf//dtd html 2.0 level 1//",
  "-//ietf//dtd html 2.0 level 2//",
  "-//ietf//dtd html 2.0 strict level 1//",
  "-//ietf//dtd html 2.0 strict level 2//",
  "-//ietf//dtd html 2.0 strict//",
  "-//ietf//dtd html 2.0//",
  "-//ietf//dtd html 2.1e//",
  "-//ietf//dtd html 3.0//",
  "-//ietf//dtd html 3.2 final//",
  "-//ietf//dtd html 3.2//",
  "-//ietf//dtd html 3//",
  "-//ietf//dtd html level 0//",
  "-//ietf//dtd html level 1//",
  "-//ietf//dtd html level 2//",
  "-//ietf//dtd html level 3//",
  "-//ietf//dtd html strict level 0//",
  "-//ietf//dtd html strict level 1//",
  "-//ietf//dtd html strict level 2//",
  "-//ietf//dtd html strict level 3//",
  "-//ietf//dtd html strict//",
  "-//ietf//dtd html//",
  "-//metrius//dtd metrius presentational//",
  "-//microsoft//dtd internet explorer 2.0 html strict//",
  "-//microsoft//dtd internet explorer 2.0 html//",
  "-//microsoft//dtd internet explorer 2.0 tables//",
  "-//microsoft//dtd internet explorer 3.0 html strict//",
  "-//microsoft//dtd internet explorer 3.0 html//",
  "-//microsoft//dtd internet explorer 3.0 tables//",
  "-//netscape comm. corp.//dtd html//",
  "-//netscape comm. corp.//dtd strict html//",
  "-//o'reilly and associates//dtd html 2.0//",
  "-//o'reilly and associates//dtd html extended 1.0//",
  "-//o'reilly and associates//dtd html extended relaxed 1.0//",
  "-//sq//dtd html 2.0 hotmetal + extensions//",
  "-//softquad software//dtd hotmetal pro 6.0::19990601::extensions to html 4.0//",
  "-//softquad//dtd hotmetal pro 4.0::19971010::extensions to html 4.0//",
  "-//spyglass//dtd html 2.0 extended//",
  "-//sun microsystems corp.//dtd hotjava html//",
  "-//sun microsystems corp.//dtd hotjava strict html//",
  "-//w3c//dtd html 3 1995-03-24//",
  "-//w3c//dtd html 3.2 draft//",
  "-//w3c//dtd html 3.2 final//",
  "-//w3c//dtd html 3.2//",
  "-//w3c//dtd html 3.2s draft//",
  "-//w3c//dtd html 4.0 frameset//",
  "-//w3c//dtd html 4.0 transitional//",
  "-//w3c//dtd html experimental 19960712//",
  "-//w3c//dtd html experimental 970421//",
  "-//w3c//dtd w3 html//",
  "-//w3o//dtd w3 html 3.0//",
  "-//webtechs//dtd mozilla html 2.0//",
  "-//webtechs//dtd mozilla html//"
];
var QUIRKS_MODE_NO_SYSTEM_ID_PUBLIC_ID_PREFIXES = [
  ...QUIRKS_MODE_PUBLIC_ID_PREFIXES,
  "-//w3c//dtd html 4.01 frameset//",
  "-//w3c//dtd html 4.01 transitional//"
];
var QUIRKS_MODE_PUBLIC_IDS = new Set([
  "-//w3o//dtd w3 html strict 3.0//en//",
  "-/w3c/dtd html 4.0 transitional/en",
  "html"
]);
var LIMITED_QUIRKS_PUBLIC_ID_PREFIXES = ["-//w3c//dtd xhtml 1.0 frameset//", "-//w3c//dtd xhtml 1.0 transitional//"];
var LIMITED_QUIRKS_WITH_SYSTEM_ID_PUBLIC_ID_PREFIXES = [
  ...LIMITED_QUIRKS_PUBLIC_ID_PREFIXES,
  "-//w3c//dtd html 4.01 frameset//",
  "-//w3c//dtd html 4.01 transitional//"
];
function hasPrefix(publicId, prefixes) {
  return prefixes.some((prefix) => publicId.startsWith(prefix));
}
function isConforming(token) {
  return token.name === VALID_DOCTYPE_NAME && token.publicId === null && (token.systemId === null || token.systemId === VALID_SYSTEM_ID);
}
function getDocumentMode(token) {
  if (token.name !== VALID_DOCTYPE_NAME) {
    return DOCUMENT_MODE.QUIRKS;
  }
  const { systemId } = token;
  if (systemId && systemId.toLowerCase() === QUIRKS_MODE_SYSTEM_ID) {
    return DOCUMENT_MODE.QUIRKS;
  }
  let { publicId } = token;
  if (publicId !== null) {
    publicId = publicId.toLowerCase();
    if (QUIRKS_MODE_PUBLIC_IDS.has(publicId)) {
      return DOCUMENT_MODE.QUIRKS;
    }
    let prefixes = systemId === null ? QUIRKS_MODE_NO_SYSTEM_ID_PUBLIC_ID_PREFIXES : QUIRKS_MODE_PUBLIC_ID_PREFIXES;
    if (hasPrefix(publicId, prefixes)) {
      return DOCUMENT_MODE.QUIRKS;
    }
    prefixes = systemId === null ? LIMITED_QUIRKS_PUBLIC_ID_PREFIXES : LIMITED_QUIRKS_WITH_SYSTEM_ID_PUBLIC_ID_PREFIXES;
    if (hasPrefix(publicId, prefixes)) {
      return DOCUMENT_MODE.LIMITED_QUIRKS;
    }
  }
  return DOCUMENT_MODE.NO_QUIRKS;
}

// node_modules/parse5/dist/common/foreign-content.js
var MIME_TYPES = {
  TEXT_HTML: "text/html",
  APPLICATION_XML: "application/xhtml+xml"
};
var DEFINITION_URL_ATTR = "definitionurl";
var ADJUSTED_DEFINITION_URL_ATTR = "definitionURL";
var SVG_ATTRS_ADJUSTMENT_MAP = new Map([
  "attributeName",
  "attributeType",
  "baseFrequency",
  "baseProfile",
  "calcMode",
  "clipPathUnits",
  "diffuseConstant",
  "edgeMode",
  "filterUnits",
  "glyphRef",
  "gradientTransform",
  "gradientUnits",
  "kernelMatrix",
  "kernelUnitLength",
  "keyPoints",
  "keySplines",
  "keyTimes",
  "lengthAdjust",
  "limitingConeAngle",
  "markerHeight",
  "markerUnits",
  "markerWidth",
  "maskContentUnits",
  "maskUnits",
  "numOctaves",
  "pathLength",
  "patternContentUnits",
  "patternTransform",
  "patternUnits",
  "pointsAtX",
  "pointsAtY",
  "pointsAtZ",
  "preserveAlpha",
  "preserveAspectRatio",
  "primitiveUnits",
  "refX",
  "refY",
  "repeatCount",
  "repeatDur",
  "requiredExtensions",
  "requiredFeatures",
  "specularConstant",
  "specularExponent",
  "spreadMethod",
  "startOffset",
  "stdDeviation",
  "stitchTiles",
  "surfaceScale",
  "systemLanguage",
  "tableValues",
  "targetX",
  "targetY",
  "textLength",
  "viewBox",
  "viewTarget",
  "xChannelSelector",
  "yChannelSelector",
  "zoomAndPan"
].map((attr) => [attr.toLowerCase(), attr]));
var XML_ATTRS_ADJUSTMENT_MAP = new Map([
  ["xlink:actuate", { prefix: "xlink", name: "actuate", namespace: NS.XLINK }],
  ["xlink:arcrole", { prefix: "xlink", name: "arcrole", namespace: NS.XLINK }],
  ["xlink:href", { prefix: "xlink", name: "href", namespace: NS.XLINK }],
  ["xlink:role", { prefix: "xlink", name: "role", namespace: NS.XLINK }],
  ["xlink:show", { prefix: "xlink", name: "show", namespace: NS.XLINK }],
  ["xlink:title", { prefix: "xlink", name: "title", namespace: NS.XLINK }],
  ["xlink:type", { prefix: "xlink", name: "type", namespace: NS.XLINK }],
  ["xml:lang", { prefix: "xml", name: "lang", namespace: NS.XML }],
  ["xml:space", { prefix: "xml", name: "space", namespace: NS.XML }],
  ["xmlns", { prefix: "", name: "xmlns", namespace: NS.XMLNS }],
  ["xmlns:xlink", { prefix: "xmlns", name: "xlink", namespace: NS.XMLNS }]
]);
var SVG_TAG_NAMES_ADJUSTMENT_MAP = new Map([
  "altGlyph",
  "altGlyphDef",
  "altGlyphItem",
  "animateColor",
  "animateMotion",
  "animateTransform",
  "clipPath",
  "feBlend",
  "feColorMatrix",
  "feComponentTransfer",
  "feComposite",
  "feConvolveMatrix",
  "feDiffuseLighting",
  "feDisplacementMap",
  "feDistantLight",
  "feFlood",
  "feFuncA",
  "feFuncB",
  "feFuncG",
  "feFuncR",
  "feGaussianBlur",
  "feImage",
  "feMerge",
  "feMergeNode",
  "feMorphology",
  "feOffset",
  "fePointLight",
  "feSpecularLighting",
  "feSpotLight",
  "feTile",
  "feTurbulence",
  "foreignObject",
  "glyphRef",
  "linearGradient",
  "radialGradient",
  "textPath"
].map((tn) => [tn.toLowerCase(), tn]));
var EXITS_FOREIGN_CONTENT = new Set([
  TAG_ID.B,
  TAG_ID.BIG,
  TAG_ID.BLOCKQUOTE,
  TAG_ID.BODY,
  TAG_ID.BR,
  TAG_ID.CENTER,
  TAG_ID.CODE,
  TAG_ID.DD,
  TAG_ID.DIV,
  TAG_ID.DL,
  TAG_ID.DT,
  TAG_ID.EM,
  TAG_ID.EMBED,
  TAG_ID.H1,
  TAG_ID.H2,
  TAG_ID.H3,
  TAG_ID.H4,
  TAG_ID.H5,
  TAG_ID.H6,
  TAG_ID.HEAD,
  TAG_ID.HR,
  TAG_ID.I,
  TAG_ID.IMG,
  TAG_ID.LI,
  TAG_ID.LISTING,
  TAG_ID.MENU,
  TAG_ID.META,
  TAG_ID.NOBR,
  TAG_ID.OL,
  TAG_ID.P,
  TAG_ID.PRE,
  TAG_ID.RUBY,
  TAG_ID.S,
  TAG_ID.SMALL,
  TAG_ID.SPAN,
  TAG_ID.STRONG,
  TAG_ID.STRIKE,
  TAG_ID.SUB,
  TAG_ID.SUP,
  TAG_ID.TABLE,
  TAG_ID.TT,
  TAG_ID.U,
  TAG_ID.UL,
  TAG_ID.VAR
]);
function causesExit(startTagToken) {
  const tn = startTagToken.tagID;
  const isFontWithAttrs = tn === TAG_ID.FONT && startTagToken.attrs.some(({ name }) => name === ATTRS.COLOR || name === ATTRS.SIZE || name === ATTRS.FACE);
  return isFontWithAttrs || EXITS_FOREIGN_CONTENT.has(tn);
}
function adjustTokenMathMLAttrs(token) {
  for (let i = 0;i < token.attrs.length; i++) {
    if (token.attrs[i].name === DEFINITION_URL_ATTR) {
      token.attrs[i].name = ADJUSTED_DEFINITION_URL_ATTR;
      break;
    }
  }
}
function adjustTokenSVGAttrs(token) {
  for (let i = 0;i < token.attrs.length; i++) {
    const adjustedAttrName = SVG_ATTRS_ADJUSTMENT_MAP.get(token.attrs[i].name);
    if (adjustedAttrName != null) {
      token.attrs[i].name = adjustedAttrName;
    }
  }
}
function adjustTokenXMLAttrs(token) {
  for (let i = 0;i < token.attrs.length; i++) {
    const adjustedAttrEntry = XML_ATTRS_ADJUSTMENT_MAP.get(token.attrs[i].name);
    if (adjustedAttrEntry) {
      token.attrs[i].prefix = adjustedAttrEntry.prefix;
      token.attrs[i].name = adjustedAttrEntry.name;
      token.attrs[i].namespace = adjustedAttrEntry.namespace;
    }
  }
}
function adjustTokenSVGTagName(token) {
  const adjustedTagName = SVG_TAG_NAMES_ADJUSTMENT_MAP.get(token.tagName);
  if (adjustedTagName != null) {
    token.tagName = adjustedTagName;
    token.tagID = getTagID(token.tagName);
  }
}
function isMathMLTextIntegrationPoint(tn, ns) {
  return ns === NS.MATHML && (tn === TAG_ID.MI || tn === TAG_ID.MO || tn === TAG_ID.MN || tn === TAG_ID.MS || tn === TAG_ID.MTEXT);
}
function isHtmlIntegrationPoint(tn, ns, attrs) {
  if (ns === NS.MATHML && tn === TAG_ID.ANNOTATION_XML) {
    for (let i = 0;i < attrs.length; i++) {
      if (attrs[i].name === ATTRS.ENCODING) {
        const value = attrs[i].value.toLowerCase();
        return value === MIME_TYPES.TEXT_HTML || value === MIME_TYPES.APPLICATION_XML;
      }
    }
  }
  return ns === NS.SVG && (tn === TAG_ID.FOREIGN_OBJECT || tn === TAG_ID.DESC || tn === TAG_ID.TITLE);
}
function isIntegrationPoint(tn, ns, attrs, foreignNS) {
  return (!foreignNS || foreignNS === NS.HTML) && isHtmlIntegrationPoint(tn, ns, attrs) || (!foreignNS || foreignNS === NS.MATHML) && isMathMLTextIntegrationPoint(tn, ns);
}

// node_modules/parse5/dist/parser/index.js
var HIDDEN_INPUT_TYPE = "hidden";
var AA_OUTER_LOOP_ITER = 8;
var AA_INNER_LOOP_ITER = 3;
var InsertionMode;
(function(InsertionMode) {
  InsertionMode[InsertionMode["INITIAL"] = 0] = "INITIAL";
  InsertionMode[InsertionMode["BEFORE_HTML"] = 1] = "BEFORE_HTML";
  InsertionMode[InsertionMode["BEFORE_HEAD"] = 2] = "BEFORE_HEAD";
  InsertionMode[InsertionMode["IN_HEAD"] = 3] = "IN_HEAD";
  InsertionMode[InsertionMode["IN_HEAD_NO_SCRIPT"] = 4] = "IN_HEAD_NO_SCRIPT";
  InsertionMode[InsertionMode["AFTER_HEAD"] = 5] = "AFTER_HEAD";
  InsertionMode[InsertionMode["IN_BODY"] = 6] = "IN_BODY";
  InsertionMode[InsertionMode["TEXT"] = 7] = "TEXT";
  InsertionMode[InsertionMode["IN_TABLE"] = 8] = "IN_TABLE";
  InsertionMode[InsertionMode["IN_TABLE_TEXT"] = 9] = "IN_TABLE_TEXT";
  InsertionMode[InsertionMode["IN_CAPTION"] = 10] = "IN_CAPTION";
  InsertionMode[InsertionMode["IN_COLUMN_GROUP"] = 11] = "IN_COLUMN_GROUP";
  InsertionMode[InsertionMode["IN_TABLE_BODY"] = 12] = "IN_TABLE_BODY";
  InsertionMode[InsertionMode["IN_ROW"] = 13] = "IN_ROW";
  InsertionMode[InsertionMode["IN_CELL"] = 14] = "IN_CELL";
  InsertionMode[InsertionMode["IN_SELECT"] = 15] = "IN_SELECT";
  InsertionMode[InsertionMode["IN_SELECT_IN_TABLE"] = 16] = "IN_SELECT_IN_TABLE";
  InsertionMode[InsertionMode["IN_TEMPLATE"] = 17] = "IN_TEMPLATE";
  InsertionMode[InsertionMode["AFTER_BODY"] = 18] = "AFTER_BODY";
  InsertionMode[InsertionMode["IN_FRAMESET"] = 19] = "IN_FRAMESET";
  InsertionMode[InsertionMode["AFTER_FRAMESET"] = 20] = "AFTER_FRAMESET";
  InsertionMode[InsertionMode["AFTER_AFTER_BODY"] = 21] = "AFTER_AFTER_BODY";
  InsertionMode[InsertionMode["AFTER_AFTER_FRAMESET"] = 22] = "AFTER_AFTER_FRAMESET";
})(InsertionMode || (InsertionMode = {}));
var BASE_LOC = {
  startLine: -1,
  startCol: -1,
  startOffset: -1,
  endLine: -1,
  endCol: -1,
  endOffset: -1
};
var TABLE_STRUCTURE_TAGS = new Set([TAG_ID.TABLE, TAG_ID.TBODY, TAG_ID.TFOOT, TAG_ID.THEAD, TAG_ID.TR]);
var defaultParserOptions = {
  scriptingEnabled: true,
  sourceCodeLocationInfo: false,
  treeAdapter: defaultTreeAdapter,
  onParseError: null
};

class Parser2 {
  constructor(options, document, fragmentContext = null, scriptHandler = null) {
    this.fragmentContext = fragmentContext;
    this.scriptHandler = scriptHandler;
    this.currentToken = null;
    this.stopped = false;
    this.insertionMode = InsertionMode.INITIAL;
    this.originalInsertionMode = InsertionMode.INITIAL;
    this.headElement = null;
    this.formElement = null;
    this.currentNotInHTML = false;
    this.tmplInsertionModeStack = [];
    this.pendingCharacterTokens = [];
    this.hasNonWhitespacePendingCharacterToken = false;
    this.framesetOk = true;
    this.skipNextNewLine = false;
    this.fosterParentingEnabled = false;
    this.options = {
      ...defaultParserOptions,
      ...options
    };
    this.treeAdapter = this.options.treeAdapter;
    this.onParseError = this.options.onParseError;
    if (this.onParseError) {
      this.options.sourceCodeLocationInfo = true;
    }
    this.document = document !== null && document !== undefined ? document : this.treeAdapter.createDocument();
    this.tokenizer = new Tokenizer2(this.options, this);
    this.activeFormattingElements = new FormattingElementList(this.treeAdapter);
    this.fragmentContextID = fragmentContext ? getTagID(this.treeAdapter.getTagName(fragmentContext)) : TAG_ID.UNKNOWN;
    this._setContextModes(fragmentContext !== null && fragmentContext !== undefined ? fragmentContext : this.document, this.fragmentContextID);
    this.openElements = new OpenElementStack(this.document, this.treeAdapter, this);
  }
  static parse(html, options) {
    const parser = new this(options);
    parser.tokenizer.write(html, true);
    return parser.document;
  }
  static getFragmentParser(fragmentContext, options) {
    const opts = {
      ...defaultParserOptions,
      ...options
    };
    fragmentContext !== null && fragmentContext !== undefined || (fragmentContext = opts.treeAdapter.createElement(TAG_NAMES.TEMPLATE, NS.HTML, []));
    const documentMock = opts.treeAdapter.createElement("documentmock", NS.HTML, []);
    const parser = new this(opts, documentMock, fragmentContext);
    if (parser.fragmentContextID === TAG_ID.TEMPLATE) {
      parser.tmplInsertionModeStack.unshift(InsertionMode.IN_TEMPLATE);
    }
    parser._initTokenizerForFragmentParsing();
    parser._insertFakeRootElement();
    parser._resetInsertionMode();
    parser._findFormInFragmentContext();
    return parser;
  }
  getFragment() {
    const rootElement = this.treeAdapter.getFirstChild(this.document);
    const fragment = this.treeAdapter.createDocumentFragment();
    this._adoptNodes(rootElement, fragment);
    return fragment;
  }
  _err(token, code, beforeToken) {
    var _a;
    if (!this.onParseError)
      return;
    const loc = (_a = token.location) !== null && _a !== undefined ? _a : BASE_LOC;
    const err = {
      code,
      startLine: loc.startLine,
      startCol: loc.startCol,
      startOffset: loc.startOffset,
      endLine: beforeToken ? loc.startLine : loc.endLine,
      endCol: beforeToken ? loc.startCol : loc.endCol,
      endOffset: beforeToken ? loc.startOffset : loc.endOffset
    };
    this.onParseError(err);
  }
  onItemPush(node, tid, isTop) {
    var _a, _b;
    (_b = (_a = this.treeAdapter).onItemPush) === null || _b === undefined || _b.call(_a, node);
    if (isTop && this.openElements.stackTop > 0)
      this._setContextModes(node, tid);
  }
  onItemPop(node, isTop) {
    var _a, _b;
    if (this.options.sourceCodeLocationInfo) {
      this._setEndLocation(node, this.currentToken);
    }
    (_b = (_a = this.treeAdapter).onItemPop) === null || _b === undefined || _b.call(_a, node, this.openElements.current);
    if (isTop) {
      let current;
      let currentTagId;
      if (this.openElements.stackTop === 0 && this.fragmentContext) {
        current = this.fragmentContext;
        currentTagId = this.fragmentContextID;
      } else {
        ({ current, currentTagId } = this.openElements);
      }
      this._setContextModes(current, currentTagId);
    }
  }
  _setContextModes(current, tid) {
    const isHTML = current === this.document || current && this.treeAdapter.getNamespaceURI(current) === NS.HTML;
    this.currentNotInHTML = !isHTML;
    this.tokenizer.inForeignNode = !isHTML && current !== undefined && tid !== undefined && !this._isIntegrationPoint(tid, current);
  }
  _switchToTextParsing(currentToken, nextTokenizerState) {
    this._insertElement(currentToken, NS.HTML);
    this.tokenizer.state = nextTokenizerState;
    this.originalInsertionMode = this.insertionMode;
    this.insertionMode = InsertionMode.TEXT;
  }
  switchToPlaintextParsing() {
    this.insertionMode = InsertionMode.TEXT;
    this.originalInsertionMode = InsertionMode.IN_BODY;
    this.tokenizer.state = TokenizerMode.PLAINTEXT;
  }
  _getAdjustedCurrentElement() {
    return this.openElements.stackTop === 0 && this.fragmentContext ? this.fragmentContext : this.openElements.current;
  }
  _findFormInFragmentContext() {
    let node = this.fragmentContext;
    while (node) {
      if (this.treeAdapter.getTagName(node) === TAG_NAMES.FORM) {
        this.formElement = node;
        break;
      }
      node = this.treeAdapter.getParentNode(node);
    }
  }
  _initTokenizerForFragmentParsing() {
    if (!this.fragmentContext || this.treeAdapter.getNamespaceURI(this.fragmentContext) !== NS.HTML) {
      return;
    }
    switch (this.fragmentContextID) {
      case TAG_ID.TITLE:
      case TAG_ID.TEXTAREA: {
        this.tokenizer.state = TokenizerMode.RCDATA;
        break;
      }
      case TAG_ID.STYLE:
      case TAG_ID.XMP:
      case TAG_ID.IFRAME:
      case TAG_ID.NOEMBED:
      case TAG_ID.NOFRAMES:
      case TAG_ID.NOSCRIPT: {
        this.tokenizer.state = TokenizerMode.RAWTEXT;
        break;
      }
      case TAG_ID.SCRIPT: {
        this.tokenizer.state = TokenizerMode.SCRIPT_DATA;
        break;
      }
      case TAG_ID.PLAINTEXT: {
        this.tokenizer.state = TokenizerMode.PLAINTEXT;
        break;
      }
      default:
    }
  }
  _setDocumentType(token) {
    const name = token.name || "";
    const publicId = token.publicId || "";
    const systemId = token.systemId || "";
    this.treeAdapter.setDocumentType(this.document, name, publicId, systemId);
    if (token.location) {
      const documentChildren = this.treeAdapter.getChildNodes(this.document);
      const docTypeNode = documentChildren.find((node) => this.treeAdapter.isDocumentTypeNode(node));
      if (docTypeNode) {
        this.treeAdapter.setNodeSourceCodeLocation(docTypeNode, token.location);
      }
    }
  }
  _attachElementToTree(element, location) {
    if (this.options.sourceCodeLocationInfo) {
      const loc = location && {
        ...location,
        startTag: location
      };
      this.treeAdapter.setNodeSourceCodeLocation(element, loc);
    }
    if (this._shouldFosterParentOnInsertion()) {
      this._fosterParentElement(element);
    } else {
      const parent = this.openElements.currentTmplContentOrNode;
      this.treeAdapter.appendChild(parent !== null && parent !== undefined ? parent : this.document, element);
    }
  }
  _appendElement(token, namespaceURI) {
    const element = this.treeAdapter.createElement(token.tagName, namespaceURI, token.attrs);
    this._attachElementToTree(element, token.location);
  }
  _insertElement(token, namespaceURI) {
    const element = this.treeAdapter.createElement(token.tagName, namespaceURI, token.attrs);
    this._attachElementToTree(element, token.location);
    this.openElements.push(element, token.tagID);
  }
  _insertFakeElement(tagName, tagID) {
    const element = this.treeAdapter.createElement(tagName, NS.HTML, []);
    this._attachElementToTree(element, null);
    this.openElements.push(element, tagID);
  }
  _insertTemplate(token) {
    const tmpl = this.treeAdapter.createElement(token.tagName, NS.HTML, token.attrs);
    const content = this.treeAdapter.createDocumentFragment();
    this.treeAdapter.setTemplateContent(tmpl, content);
    this._attachElementToTree(tmpl, token.location);
    this.openElements.push(tmpl, token.tagID);
    if (this.options.sourceCodeLocationInfo)
      this.treeAdapter.setNodeSourceCodeLocation(content, null);
  }
  _insertFakeRootElement() {
    const element = this.treeAdapter.createElement(TAG_NAMES.HTML, NS.HTML, []);
    if (this.options.sourceCodeLocationInfo)
      this.treeAdapter.setNodeSourceCodeLocation(element, null);
    this.treeAdapter.appendChild(this.openElements.current, element);
    this.openElements.push(element, TAG_ID.HTML);
  }
  _appendCommentNode(token, parent) {
    const commentNode = this.treeAdapter.createCommentNode(token.data);
    this.treeAdapter.appendChild(parent, commentNode);
    if (this.options.sourceCodeLocationInfo) {
      this.treeAdapter.setNodeSourceCodeLocation(commentNode, token.location);
    }
  }
  _insertCharacters(token) {
    let parent;
    let beforeElement;
    if (this._shouldFosterParentOnInsertion()) {
      ({ parent, beforeElement } = this._findFosterParentingLocation());
      if (beforeElement) {
        this.treeAdapter.insertTextBefore(parent, token.chars, beforeElement);
      } else {
        this.treeAdapter.insertText(parent, token.chars);
      }
    } else {
      parent = this.openElements.currentTmplContentOrNode;
      this.treeAdapter.insertText(parent, token.chars);
    }
    if (!token.location)
      return;
    const siblings = this.treeAdapter.getChildNodes(parent);
    const textNodeIdx = beforeElement ? siblings.lastIndexOf(beforeElement) : siblings.length;
    const textNode = siblings[textNodeIdx - 1];
    const tnLoc = this.treeAdapter.getNodeSourceCodeLocation(textNode);
    if (tnLoc) {
      const { endLine, endCol, endOffset } = token.location;
      this.treeAdapter.updateNodeSourceCodeLocation(textNode, { endLine, endCol, endOffset });
    } else if (this.options.sourceCodeLocationInfo) {
      this.treeAdapter.setNodeSourceCodeLocation(textNode, token.location);
    }
  }
  _adoptNodes(donor, recipient) {
    for (let child = this.treeAdapter.getFirstChild(donor);child; child = this.treeAdapter.getFirstChild(donor)) {
      this.treeAdapter.detachNode(child);
      this.treeAdapter.appendChild(recipient, child);
    }
  }
  _setEndLocation(element, closingToken) {
    if (this.treeAdapter.getNodeSourceCodeLocation(element) && closingToken.location) {
      const ctLoc = closingToken.location;
      const tn = this.treeAdapter.getTagName(element);
      const endLoc = closingToken.type === TokenType.END_TAG && tn === closingToken.tagName ? {
        endTag: { ...ctLoc },
        endLine: ctLoc.endLine,
        endCol: ctLoc.endCol,
        endOffset: ctLoc.endOffset
      } : {
        endLine: ctLoc.startLine,
        endCol: ctLoc.startCol,
        endOffset: ctLoc.startOffset
      };
      this.treeAdapter.updateNodeSourceCodeLocation(element, endLoc);
    }
  }
  shouldProcessStartTagTokenInForeignContent(token) {
    if (!this.currentNotInHTML)
      return false;
    let current;
    let currentTagId;
    if (this.openElements.stackTop === 0 && this.fragmentContext) {
      current = this.fragmentContext;
      currentTagId = this.fragmentContextID;
    } else {
      ({ current, currentTagId } = this.openElements);
    }
    if (token.tagID === TAG_ID.SVG && this.treeAdapter.getTagName(current) === TAG_NAMES.ANNOTATION_XML && this.treeAdapter.getNamespaceURI(current) === NS.MATHML) {
      return false;
    }
    return this.tokenizer.inForeignNode || (token.tagID === TAG_ID.MGLYPH || token.tagID === TAG_ID.MALIGNMARK) && currentTagId !== undefined && !this._isIntegrationPoint(currentTagId, current, NS.HTML);
  }
  _processToken(token) {
    switch (token.type) {
      case TokenType.CHARACTER: {
        this.onCharacter(token);
        break;
      }
      case TokenType.NULL_CHARACTER: {
        this.onNullCharacter(token);
        break;
      }
      case TokenType.COMMENT: {
        this.onComment(token);
        break;
      }
      case TokenType.DOCTYPE: {
        this.onDoctype(token);
        break;
      }
      case TokenType.START_TAG: {
        this._processStartTag(token);
        break;
      }
      case TokenType.END_TAG: {
        this.onEndTag(token);
        break;
      }
      case TokenType.EOF: {
        this.onEof(token);
        break;
      }
      case TokenType.WHITESPACE_CHARACTER: {
        this.onWhitespaceCharacter(token);
        break;
      }
    }
  }
  _isIntegrationPoint(tid, element, foreignNS) {
    const ns = this.treeAdapter.getNamespaceURI(element);
    const attrs = this.treeAdapter.getAttrList(element);
    return isIntegrationPoint(tid, ns, attrs, foreignNS);
  }
  _reconstructActiveFormattingElements() {
    const listLength = this.activeFormattingElements.entries.length;
    if (listLength) {
      const endIndex = this.activeFormattingElements.entries.findIndex((entry) => entry.type === EntryType.Marker || this.openElements.contains(entry.element));
      const unopenIdx = endIndex === -1 ? listLength - 1 : endIndex - 1;
      for (let i = unopenIdx;i >= 0; i--) {
        const entry = this.activeFormattingElements.entries[i];
        this._insertElement(entry.token, this.treeAdapter.getNamespaceURI(entry.element));
        entry.element = this.openElements.current;
      }
    }
  }
  _closeTableCell() {
    this.openElements.generateImpliedEndTags();
    this.openElements.popUntilTableCellPopped();
    this.activeFormattingElements.clearToLastMarker();
    this.insertionMode = InsertionMode.IN_ROW;
  }
  _closePElement() {
    this.openElements.generateImpliedEndTagsWithExclusion(TAG_ID.P);
    this.openElements.popUntilTagNamePopped(TAG_ID.P);
  }
  _resetInsertionMode() {
    for (let i = this.openElements.stackTop;i >= 0; i--) {
      switch (i === 0 && this.fragmentContext ? this.fragmentContextID : this.openElements.tagIDs[i]) {
        case TAG_ID.TR: {
          this.insertionMode = InsertionMode.IN_ROW;
          return;
        }
        case TAG_ID.TBODY:
        case TAG_ID.THEAD:
        case TAG_ID.TFOOT: {
          this.insertionMode = InsertionMode.IN_TABLE_BODY;
          return;
        }
        case TAG_ID.CAPTION: {
          this.insertionMode = InsertionMode.IN_CAPTION;
          return;
        }
        case TAG_ID.COLGROUP: {
          this.insertionMode = InsertionMode.IN_COLUMN_GROUP;
          return;
        }
        case TAG_ID.TABLE: {
          this.insertionMode = InsertionMode.IN_TABLE;
          return;
        }
        case TAG_ID.BODY: {
          this.insertionMode = InsertionMode.IN_BODY;
          return;
        }
        case TAG_ID.FRAMESET: {
          this.insertionMode = InsertionMode.IN_FRAMESET;
          return;
        }
        case TAG_ID.SELECT: {
          this._resetInsertionModeForSelect(i);
          return;
        }
        case TAG_ID.TEMPLATE: {
          this.insertionMode = this.tmplInsertionModeStack[0];
          return;
        }
        case TAG_ID.HTML: {
          this.insertionMode = this.headElement ? InsertionMode.AFTER_HEAD : InsertionMode.BEFORE_HEAD;
          return;
        }
        case TAG_ID.TD:
        case TAG_ID.TH: {
          if (i > 0) {
            this.insertionMode = InsertionMode.IN_CELL;
            return;
          }
          break;
        }
        case TAG_ID.HEAD: {
          if (i > 0) {
            this.insertionMode = InsertionMode.IN_HEAD;
            return;
          }
          break;
        }
      }
    }
    this.insertionMode = InsertionMode.IN_BODY;
  }
  _resetInsertionModeForSelect(selectIdx) {
    if (selectIdx > 0) {
      for (let i = selectIdx - 1;i > 0; i--) {
        const tn = this.openElements.tagIDs[i];
        if (tn === TAG_ID.TEMPLATE) {
          break;
        } else if (tn === TAG_ID.TABLE) {
          this.insertionMode = InsertionMode.IN_SELECT_IN_TABLE;
          return;
        }
      }
    }
    this.insertionMode = InsertionMode.IN_SELECT;
  }
  _isElementCausesFosterParenting(tn) {
    return TABLE_STRUCTURE_TAGS.has(tn);
  }
  _shouldFosterParentOnInsertion() {
    return this.fosterParentingEnabled && this.openElements.currentTagId !== undefined && this._isElementCausesFosterParenting(this.openElements.currentTagId);
  }
  _findFosterParentingLocation() {
    for (let i = this.openElements.stackTop;i >= 0; i--) {
      const openElement = this.openElements.items[i];
      switch (this.openElements.tagIDs[i]) {
        case TAG_ID.TEMPLATE: {
          if (this.treeAdapter.getNamespaceURI(openElement) === NS.HTML) {
            return { parent: this.treeAdapter.getTemplateContent(openElement), beforeElement: null };
          }
          break;
        }
        case TAG_ID.TABLE: {
          const parent = this.treeAdapter.getParentNode(openElement);
          if (parent) {
            return { parent, beforeElement: openElement };
          }
          return { parent: this.openElements.items[i - 1], beforeElement: null };
        }
        default:
      }
    }
    return { parent: this.openElements.items[0], beforeElement: null };
  }
  _fosterParentElement(element) {
    const location = this._findFosterParentingLocation();
    if (location.beforeElement) {
      this.treeAdapter.insertBefore(location.parent, element, location.beforeElement);
    } else {
      this.treeAdapter.appendChild(location.parent, element);
    }
  }
  _isSpecialElement(element, id) {
    const ns = this.treeAdapter.getNamespaceURI(element);
    return SPECIAL_ELEMENTS[ns].has(id);
  }
  onCharacter(token) {
    this.skipNextNewLine = false;
    if (this.tokenizer.inForeignNode) {
      characterInForeignContent(this, token);
      return;
    }
    switch (this.insertionMode) {
      case InsertionMode.INITIAL: {
        tokenInInitialMode(this, token);
        break;
      }
      case InsertionMode.BEFORE_HTML: {
        tokenBeforeHtml(this, token);
        break;
      }
      case InsertionMode.BEFORE_HEAD: {
        tokenBeforeHead(this, token);
        break;
      }
      case InsertionMode.IN_HEAD: {
        tokenInHead(this, token);
        break;
      }
      case InsertionMode.IN_HEAD_NO_SCRIPT: {
        tokenInHeadNoScript(this, token);
        break;
      }
      case InsertionMode.AFTER_HEAD: {
        tokenAfterHead(this, token);
        break;
      }
      case InsertionMode.IN_BODY:
      case InsertionMode.IN_CAPTION:
      case InsertionMode.IN_CELL:
      case InsertionMode.IN_TEMPLATE: {
        characterInBody(this, token);
        break;
      }
      case InsertionMode.TEXT:
      case InsertionMode.IN_SELECT:
      case InsertionMode.IN_SELECT_IN_TABLE: {
        this._insertCharacters(token);
        break;
      }
      case InsertionMode.IN_TABLE:
      case InsertionMode.IN_TABLE_BODY:
      case InsertionMode.IN_ROW: {
        characterInTable(this, token);
        break;
      }
      case InsertionMode.IN_TABLE_TEXT: {
        characterInTableText(this, token);
        break;
      }
      case InsertionMode.IN_COLUMN_GROUP: {
        tokenInColumnGroup(this, token);
        break;
      }
      case InsertionMode.AFTER_BODY: {
        tokenAfterBody(this, token);
        break;
      }
      case InsertionMode.AFTER_AFTER_BODY: {
        tokenAfterAfterBody(this, token);
        break;
      }
      default:
    }
  }
  onNullCharacter(token) {
    this.skipNextNewLine = false;
    if (this.tokenizer.inForeignNode) {
      nullCharacterInForeignContent(this, token);
      return;
    }
    switch (this.insertionMode) {
      case InsertionMode.INITIAL: {
        tokenInInitialMode(this, token);
        break;
      }
      case InsertionMode.BEFORE_HTML: {
        tokenBeforeHtml(this, token);
        break;
      }
      case InsertionMode.BEFORE_HEAD: {
        tokenBeforeHead(this, token);
        break;
      }
      case InsertionMode.IN_HEAD: {
        tokenInHead(this, token);
        break;
      }
      case InsertionMode.IN_HEAD_NO_SCRIPT: {
        tokenInHeadNoScript(this, token);
        break;
      }
      case InsertionMode.AFTER_HEAD: {
        tokenAfterHead(this, token);
        break;
      }
      case InsertionMode.TEXT: {
        this._insertCharacters(token);
        break;
      }
      case InsertionMode.IN_TABLE:
      case InsertionMode.IN_TABLE_BODY:
      case InsertionMode.IN_ROW: {
        characterInTable(this, token);
        break;
      }
      case InsertionMode.IN_COLUMN_GROUP: {
        tokenInColumnGroup(this, token);
        break;
      }
      case InsertionMode.AFTER_BODY: {
        tokenAfterBody(this, token);
        break;
      }
      case InsertionMode.AFTER_AFTER_BODY: {
        tokenAfterAfterBody(this, token);
        break;
      }
      default:
    }
  }
  onComment(token) {
    this.skipNextNewLine = false;
    if (this.currentNotInHTML) {
      appendComment(this, token);
      return;
    }
    switch (this.insertionMode) {
      case InsertionMode.INITIAL:
      case InsertionMode.BEFORE_HTML:
      case InsertionMode.BEFORE_HEAD:
      case InsertionMode.IN_HEAD:
      case InsertionMode.IN_HEAD_NO_SCRIPT:
      case InsertionMode.AFTER_HEAD:
      case InsertionMode.IN_BODY:
      case InsertionMode.IN_TABLE:
      case InsertionMode.IN_CAPTION:
      case InsertionMode.IN_COLUMN_GROUP:
      case InsertionMode.IN_TABLE_BODY:
      case InsertionMode.IN_ROW:
      case InsertionMode.IN_CELL:
      case InsertionMode.IN_SELECT:
      case InsertionMode.IN_SELECT_IN_TABLE:
      case InsertionMode.IN_TEMPLATE:
      case InsertionMode.IN_FRAMESET:
      case InsertionMode.AFTER_FRAMESET: {
        appendComment(this, token);
        break;
      }
      case InsertionMode.IN_TABLE_TEXT: {
        tokenInTableText(this, token);
        break;
      }
      case InsertionMode.AFTER_BODY: {
        appendCommentToRootHtmlElement(this, token);
        break;
      }
      case InsertionMode.AFTER_AFTER_BODY:
      case InsertionMode.AFTER_AFTER_FRAMESET: {
        appendCommentToDocument(this, token);
        break;
      }
      default:
    }
  }
  onDoctype(token) {
    this.skipNextNewLine = false;
    switch (this.insertionMode) {
      case InsertionMode.INITIAL: {
        doctypeInInitialMode(this, token);
        break;
      }
      case InsertionMode.BEFORE_HEAD:
      case InsertionMode.IN_HEAD:
      case InsertionMode.IN_HEAD_NO_SCRIPT:
      case InsertionMode.AFTER_HEAD: {
        this._err(token, ERR.misplacedDoctype);
        break;
      }
      case InsertionMode.IN_TABLE_TEXT: {
        tokenInTableText(this, token);
        break;
      }
      default:
    }
  }
  onStartTag(token) {
    this.skipNextNewLine = false;
    this.currentToken = token;
    this._processStartTag(token);
    if (token.selfClosing && !token.ackSelfClosing) {
      this._err(token, ERR.nonVoidHtmlElementStartTagWithTrailingSolidus);
    }
  }
  _processStartTag(token) {
    if (this.shouldProcessStartTagTokenInForeignContent(token)) {
      startTagInForeignContent(this, token);
    } else {
      this._startTagOutsideForeignContent(token);
    }
  }
  _startTagOutsideForeignContent(token) {
    switch (this.insertionMode) {
      case InsertionMode.INITIAL: {
        tokenInInitialMode(this, token);
        break;
      }
      case InsertionMode.BEFORE_HTML: {
        startTagBeforeHtml(this, token);
        break;
      }
      case InsertionMode.BEFORE_HEAD: {
        startTagBeforeHead(this, token);
        break;
      }
      case InsertionMode.IN_HEAD: {
        startTagInHead(this, token);
        break;
      }
      case InsertionMode.IN_HEAD_NO_SCRIPT: {
        startTagInHeadNoScript(this, token);
        break;
      }
      case InsertionMode.AFTER_HEAD: {
        startTagAfterHead(this, token);
        break;
      }
      case InsertionMode.IN_BODY: {
        startTagInBody(this, token);
        break;
      }
      case InsertionMode.IN_TABLE: {
        startTagInTable(this, token);
        break;
      }
      case InsertionMode.IN_TABLE_TEXT: {
        tokenInTableText(this, token);
        break;
      }
      case InsertionMode.IN_CAPTION: {
        startTagInCaption(this, token);
        break;
      }
      case InsertionMode.IN_COLUMN_GROUP: {
        startTagInColumnGroup(this, token);
        break;
      }
      case InsertionMode.IN_TABLE_BODY: {
        startTagInTableBody(this, token);
        break;
      }
      case InsertionMode.IN_ROW: {
        startTagInRow(this, token);
        break;
      }
      case InsertionMode.IN_CELL: {
        startTagInCell(this, token);
        break;
      }
      case InsertionMode.IN_SELECT: {
        startTagInSelect(this, token);
        break;
      }
      case InsertionMode.IN_SELECT_IN_TABLE: {
        startTagInSelectInTable(this, token);
        break;
      }
      case InsertionMode.IN_TEMPLATE: {
        startTagInTemplate(this, token);
        break;
      }
      case InsertionMode.AFTER_BODY: {
        startTagAfterBody(this, token);
        break;
      }
      case InsertionMode.IN_FRAMESET: {
        startTagInFrameset(this, token);
        break;
      }
      case InsertionMode.AFTER_FRAMESET: {
        startTagAfterFrameset(this, token);
        break;
      }
      case InsertionMode.AFTER_AFTER_BODY: {
        startTagAfterAfterBody(this, token);
        break;
      }
      case InsertionMode.AFTER_AFTER_FRAMESET: {
        startTagAfterAfterFrameset(this, token);
        break;
      }
      default:
    }
  }
  onEndTag(token) {
    this.skipNextNewLine = false;
    this.currentToken = token;
    if (this.currentNotInHTML) {
      endTagInForeignContent(this, token);
    } else {
      this._endTagOutsideForeignContent(token);
    }
  }
  _endTagOutsideForeignContent(token) {
    switch (this.insertionMode) {
      case InsertionMode.INITIAL: {
        tokenInInitialMode(this, token);
        break;
      }
      case InsertionMode.BEFORE_HTML: {
        endTagBeforeHtml(this, token);
        break;
      }
      case InsertionMode.BEFORE_HEAD: {
        endTagBeforeHead(this, token);
        break;
      }
      case InsertionMode.IN_HEAD: {
        endTagInHead(this, token);
        break;
      }
      case InsertionMode.IN_HEAD_NO_SCRIPT: {
        endTagInHeadNoScript(this, token);
        break;
      }
      case InsertionMode.AFTER_HEAD: {
        endTagAfterHead(this, token);
        break;
      }
      case InsertionMode.IN_BODY: {
        endTagInBody(this, token);
        break;
      }
      case InsertionMode.TEXT: {
        endTagInText(this, token);
        break;
      }
      case InsertionMode.IN_TABLE: {
        endTagInTable(this, token);
        break;
      }
      case InsertionMode.IN_TABLE_TEXT: {
        tokenInTableText(this, token);
        break;
      }
      case InsertionMode.IN_CAPTION: {
        endTagInCaption(this, token);
        break;
      }
      case InsertionMode.IN_COLUMN_GROUP: {
        endTagInColumnGroup(this, token);
        break;
      }
      case InsertionMode.IN_TABLE_BODY: {
        endTagInTableBody(this, token);
        break;
      }
      case InsertionMode.IN_ROW: {
        endTagInRow(this, token);
        break;
      }
      case InsertionMode.IN_CELL: {
        endTagInCell(this, token);
        break;
      }
      case InsertionMode.IN_SELECT: {
        endTagInSelect(this, token);
        break;
      }
      case InsertionMode.IN_SELECT_IN_TABLE: {
        endTagInSelectInTable(this, token);
        break;
      }
      case InsertionMode.IN_TEMPLATE: {
        endTagInTemplate(this, token);
        break;
      }
      case InsertionMode.AFTER_BODY: {
        endTagAfterBody(this, token);
        break;
      }
      case InsertionMode.IN_FRAMESET: {
        endTagInFrameset(this, token);
        break;
      }
      case InsertionMode.AFTER_FRAMESET: {
        endTagAfterFrameset(this, token);
        break;
      }
      case InsertionMode.AFTER_AFTER_BODY: {
        tokenAfterAfterBody(this, token);
        break;
      }
      default:
    }
  }
  onEof(token) {
    switch (this.insertionMode) {
      case InsertionMode.INITIAL: {
        tokenInInitialMode(this, token);
        break;
      }
      case InsertionMode.BEFORE_HTML: {
        tokenBeforeHtml(this, token);
        break;
      }
      case InsertionMode.BEFORE_HEAD: {
        tokenBeforeHead(this, token);
        break;
      }
      case InsertionMode.IN_HEAD: {
        tokenInHead(this, token);
        break;
      }
      case InsertionMode.IN_HEAD_NO_SCRIPT: {
        tokenInHeadNoScript(this, token);
        break;
      }
      case InsertionMode.AFTER_HEAD: {
        tokenAfterHead(this, token);
        break;
      }
      case InsertionMode.IN_BODY:
      case InsertionMode.IN_TABLE:
      case InsertionMode.IN_CAPTION:
      case InsertionMode.IN_COLUMN_GROUP:
      case InsertionMode.IN_TABLE_BODY:
      case InsertionMode.IN_ROW:
      case InsertionMode.IN_CELL:
      case InsertionMode.IN_SELECT:
      case InsertionMode.IN_SELECT_IN_TABLE: {
        eofInBody(this, token);
        break;
      }
      case InsertionMode.TEXT: {
        eofInText(this, token);
        break;
      }
      case InsertionMode.IN_TABLE_TEXT: {
        tokenInTableText(this, token);
        break;
      }
      case InsertionMode.IN_TEMPLATE: {
        eofInTemplate(this, token);
        break;
      }
      case InsertionMode.AFTER_BODY:
      case InsertionMode.IN_FRAMESET:
      case InsertionMode.AFTER_FRAMESET:
      case InsertionMode.AFTER_AFTER_BODY:
      case InsertionMode.AFTER_AFTER_FRAMESET: {
        stopParsing(this, token);
        break;
      }
      default:
    }
  }
  onWhitespaceCharacter(token) {
    if (this.skipNextNewLine) {
      this.skipNextNewLine = false;
      if (token.chars.charCodeAt(0) === CODE_POINTS.LINE_FEED) {
        if (token.chars.length === 1) {
          return;
        }
        token.chars = token.chars.substr(1);
      }
    }
    if (this.tokenizer.inForeignNode) {
      this._insertCharacters(token);
      return;
    }
    switch (this.insertionMode) {
      case InsertionMode.IN_HEAD:
      case InsertionMode.IN_HEAD_NO_SCRIPT:
      case InsertionMode.AFTER_HEAD:
      case InsertionMode.TEXT:
      case InsertionMode.IN_COLUMN_GROUP:
      case InsertionMode.IN_SELECT:
      case InsertionMode.IN_SELECT_IN_TABLE:
      case InsertionMode.IN_FRAMESET:
      case InsertionMode.AFTER_FRAMESET: {
        this._insertCharacters(token);
        break;
      }
      case InsertionMode.IN_BODY:
      case InsertionMode.IN_CAPTION:
      case InsertionMode.IN_CELL:
      case InsertionMode.IN_TEMPLATE:
      case InsertionMode.AFTER_BODY:
      case InsertionMode.AFTER_AFTER_BODY:
      case InsertionMode.AFTER_AFTER_FRAMESET: {
        whitespaceCharacterInBody(this, token);
        break;
      }
      case InsertionMode.IN_TABLE:
      case InsertionMode.IN_TABLE_BODY:
      case InsertionMode.IN_ROW: {
        characterInTable(this, token);
        break;
      }
      case InsertionMode.IN_TABLE_TEXT: {
        whitespaceCharacterInTableText(this, token);
        break;
      }
      default:
    }
  }
}
function aaObtainFormattingElementEntry(p, token) {
  let formattingElementEntry = p.activeFormattingElements.getElementEntryInScopeWithTagName(token.tagName);
  if (formattingElementEntry) {
    if (!p.openElements.contains(formattingElementEntry.element)) {
      p.activeFormattingElements.removeEntry(formattingElementEntry);
      formattingElementEntry = null;
    } else if (!p.openElements.hasInScope(token.tagID)) {
      formattingElementEntry = null;
    }
  } else {
    genericEndTagInBody(p, token);
  }
  return formattingElementEntry;
}
function aaObtainFurthestBlock(p, formattingElementEntry) {
  let furthestBlock = null;
  let idx = p.openElements.stackTop;
  for (;idx >= 0; idx--) {
    const element = p.openElements.items[idx];
    if (element === formattingElementEntry.element) {
      break;
    }
    if (p._isSpecialElement(element, p.openElements.tagIDs[idx])) {
      furthestBlock = element;
    }
  }
  if (!furthestBlock) {
    p.openElements.shortenToLength(Math.max(idx, 0));
    p.activeFormattingElements.removeEntry(formattingElementEntry);
  }
  return furthestBlock;
}
function aaInnerLoop(p, furthestBlock, formattingElement) {
  let lastElement = furthestBlock;
  let nextElement = p.openElements.getCommonAncestor(furthestBlock);
  for (let i = 0, element = nextElement;element !== formattingElement; i++, element = nextElement) {
    nextElement = p.openElements.getCommonAncestor(element);
    const elementEntry = p.activeFormattingElements.getElementEntry(element);
    const counterOverflow = elementEntry && i >= AA_INNER_LOOP_ITER;
    const shouldRemoveFromOpenElements = !elementEntry || counterOverflow;
    if (shouldRemoveFromOpenElements) {
      if (counterOverflow) {
        p.activeFormattingElements.removeEntry(elementEntry);
      }
      p.openElements.remove(element);
    } else {
      element = aaRecreateElementFromEntry(p, elementEntry);
      if (lastElement === furthestBlock) {
        p.activeFormattingElements.bookmark = elementEntry;
      }
      p.treeAdapter.detachNode(lastElement);
      p.treeAdapter.appendChild(element, lastElement);
      lastElement = element;
    }
  }
  return lastElement;
}
function aaRecreateElementFromEntry(p, elementEntry) {
  const ns = p.treeAdapter.getNamespaceURI(elementEntry.element);
  const newElement = p.treeAdapter.createElement(elementEntry.token.tagName, ns, elementEntry.token.attrs);
  p.openElements.replace(elementEntry.element, newElement);
  elementEntry.element = newElement;
  return newElement;
}
function aaInsertLastNodeInCommonAncestor(p, commonAncestor, lastElement) {
  const tn = p.treeAdapter.getTagName(commonAncestor);
  const tid = getTagID(tn);
  if (p._isElementCausesFosterParenting(tid)) {
    p._fosterParentElement(lastElement);
  } else {
    const ns = p.treeAdapter.getNamespaceURI(commonAncestor);
    if (tid === TAG_ID.TEMPLATE && ns === NS.HTML) {
      commonAncestor = p.treeAdapter.getTemplateContent(commonAncestor);
    }
    p.treeAdapter.appendChild(commonAncestor, lastElement);
  }
}
function aaReplaceFormattingElement(p, furthestBlock, formattingElementEntry) {
  const ns = p.treeAdapter.getNamespaceURI(formattingElementEntry.element);
  const { token } = formattingElementEntry;
  const newElement = p.treeAdapter.createElement(token.tagName, ns, token.attrs);
  p._adoptNodes(furthestBlock, newElement);
  p.treeAdapter.appendChild(furthestBlock, newElement);
  p.activeFormattingElements.insertElementAfterBookmark(newElement, token);
  p.activeFormattingElements.removeEntry(formattingElementEntry);
  p.openElements.remove(formattingElementEntry.element);
  p.openElements.insertAfter(furthestBlock, newElement, token.tagID);
}
function callAdoptionAgency(p, token) {
  for (let i = 0;i < AA_OUTER_LOOP_ITER; i++) {
    const formattingElementEntry = aaObtainFormattingElementEntry(p, token);
    if (!formattingElementEntry) {
      break;
    }
    const furthestBlock = aaObtainFurthestBlock(p, formattingElementEntry);
    if (!furthestBlock) {
      break;
    }
    p.activeFormattingElements.bookmark = formattingElementEntry;
    const lastElement = aaInnerLoop(p, furthestBlock, formattingElementEntry.element);
    const commonAncestor = p.openElements.getCommonAncestor(formattingElementEntry.element);
    p.treeAdapter.detachNode(lastElement);
    if (commonAncestor)
      aaInsertLastNodeInCommonAncestor(p, commonAncestor, lastElement);
    aaReplaceFormattingElement(p, furthestBlock, formattingElementEntry);
  }
}
function appendComment(p, token) {
  p._appendCommentNode(token, p.openElements.currentTmplContentOrNode);
}
function appendCommentToRootHtmlElement(p, token) {
  p._appendCommentNode(token, p.openElements.items[0]);
}
function appendCommentToDocument(p, token) {
  p._appendCommentNode(token, p.document);
}
function stopParsing(p, token) {
  p.stopped = true;
  if (token.location) {
    const target = p.fragmentContext ? 0 : 2;
    for (let i = p.openElements.stackTop;i >= target; i--) {
      p._setEndLocation(p.openElements.items[i], token);
    }
    if (!p.fragmentContext && p.openElements.stackTop >= 0) {
      const htmlElement = p.openElements.items[0];
      const htmlLocation = p.treeAdapter.getNodeSourceCodeLocation(htmlElement);
      if (htmlLocation && !htmlLocation.endTag) {
        p._setEndLocation(htmlElement, token);
        if (p.openElements.stackTop >= 1) {
          const bodyElement = p.openElements.items[1];
          const bodyLocation = p.treeAdapter.getNodeSourceCodeLocation(bodyElement);
          if (bodyLocation && !bodyLocation.endTag) {
            p._setEndLocation(bodyElement, token);
          }
        }
      }
    }
  }
}
function doctypeInInitialMode(p, token) {
  p._setDocumentType(token);
  const mode = token.forceQuirks ? DOCUMENT_MODE.QUIRKS : getDocumentMode(token);
  if (!isConforming(token)) {
    p._err(token, ERR.nonConformingDoctype);
  }
  p.treeAdapter.setDocumentMode(p.document, mode);
  p.insertionMode = InsertionMode.BEFORE_HTML;
}
function tokenInInitialMode(p, token) {
  p._err(token, ERR.missingDoctype, true);
  p.treeAdapter.setDocumentMode(p.document, DOCUMENT_MODE.QUIRKS);
  p.insertionMode = InsertionMode.BEFORE_HTML;
  p._processToken(token);
}
function startTagBeforeHtml(p, token) {
  if (token.tagID === TAG_ID.HTML) {
    p._insertElement(token, NS.HTML);
    p.insertionMode = InsertionMode.BEFORE_HEAD;
  } else {
    tokenBeforeHtml(p, token);
  }
}
function endTagBeforeHtml(p, token) {
  const tn = token.tagID;
  if (tn === TAG_ID.HTML || tn === TAG_ID.HEAD || tn === TAG_ID.BODY || tn === TAG_ID.BR) {
    tokenBeforeHtml(p, token);
  }
}
function tokenBeforeHtml(p, token) {
  p._insertFakeRootElement();
  p.insertionMode = InsertionMode.BEFORE_HEAD;
  p._processToken(token);
}
function startTagBeforeHead(p, token) {
  switch (token.tagID) {
    case TAG_ID.HTML: {
      startTagInBody(p, token);
      break;
    }
    case TAG_ID.HEAD: {
      p._insertElement(token, NS.HTML);
      p.headElement = p.openElements.current;
      p.insertionMode = InsertionMode.IN_HEAD;
      break;
    }
    default: {
      tokenBeforeHead(p, token);
    }
  }
}
function endTagBeforeHead(p, token) {
  const tn = token.tagID;
  if (tn === TAG_ID.HEAD || tn === TAG_ID.BODY || tn === TAG_ID.HTML || tn === TAG_ID.BR) {
    tokenBeforeHead(p, token);
  } else {
    p._err(token, ERR.endTagWithoutMatchingOpenElement);
  }
}
function tokenBeforeHead(p, token) {
  p._insertFakeElement(TAG_NAMES.HEAD, TAG_ID.HEAD);
  p.headElement = p.openElements.current;
  p.insertionMode = InsertionMode.IN_HEAD;
  p._processToken(token);
}
function startTagInHead(p, token) {
  switch (token.tagID) {
    case TAG_ID.HTML: {
      startTagInBody(p, token);
      break;
    }
    case TAG_ID.BASE:
    case TAG_ID.BASEFONT:
    case TAG_ID.BGSOUND:
    case TAG_ID.LINK:
    case TAG_ID.META: {
      p._appendElement(token, NS.HTML);
      token.ackSelfClosing = true;
      break;
    }
    case TAG_ID.TITLE: {
      p._switchToTextParsing(token, TokenizerMode.RCDATA);
      break;
    }
    case TAG_ID.NOSCRIPT: {
      if (p.options.scriptingEnabled) {
        p._switchToTextParsing(token, TokenizerMode.RAWTEXT);
      } else {
        p._insertElement(token, NS.HTML);
        p.insertionMode = InsertionMode.IN_HEAD_NO_SCRIPT;
      }
      break;
    }
    case TAG_ID.NOFRAMES:
    case TAG_ID.STYLE: {
      p._switchToTextParsing(token, TokenizerMode.RAWTEXT);
      break;
    }
    case TAG_ID.SCRIPT: {
      p._switchToTextParsing(token, TokenizerMode.SCRIPT_DATA);
      break;
    }
    case TAG_ID.TEMPLATE: {
      p._insertTemplate(token);
      p.activeFormattingElements.insertMarker();
      p.framesetOk = false;
      p.insertionMode = InsertionMode.IN_TEMPLATE;
      p.tmplInsertionModeStack.unshift(InsertionMode.IN_TEMPLATE);
      break;
    }
    case TAG_ID.HEAD: {
      p._err(token, ERR.misplacedStartTagForHeadElement);
      break;
    }
    default: {
      tokenInHead(p, token);
    }
  }
}
function endTagInHead(p, token) {
  switch (token.tagID) {
    case TAG_ID.HEAD: {
      p.openElements.pop();
      p.insertionMode = InsertionMode.AFTER_HEAD;
      break;
    }
    case TAG_ID.BODY:
    case TAG_ID.BR:
    case TAG_ID.HTML: {
      tokenInHead(p, token);
      break;
    }
    case TAG_ID.TEMPLATE: {
      templateEndTagInHead(p, token);
      break;
    }
    default: {
      p._err(token, ERR.endTagWithoutMatchingOpenElement);
    }
  }
}
function templateEndTagInHead(p, token) {
  if (p.openElements.tmplCount > 0) {
    p.openElements.generateImpliedEndTagsThoroughly();
    if (p.openElements.currentTagId !== TAG_ID.TEMPLATE) {
      p._err(token, ERR.closingOfElementWithOpenChildElements);
    }
    p.openElements.popUntilTagNamePopped(TAG_ID.TEMPLATE);
    p.activeFormattingElements.clearToLastMarker();
    p.tmplInsertionModeStack.shift();
    p._resetInsertionMode();
  } else {
    p._err(token, ERR.endTagWithoutMatchingOpenElement);
  }
}
function tokenInHead(p, token) {
  p.openElements.pop();
  p.insertionMode = InsertionMode.AFTER_HEAD;
  p._processToken(token);
}
function startTagInHeadNoScript(p, token) {
  switch (token.tagID) {
    case TAG_ID.HTML: {
      startTagInBody(p, token);
      break;
    }
    case TAG_ID.BASEFONT:
    case TAG_ID.BGSOUND:
    case TAG_ID.HEAD:
    case TAG_ID.LINK:
    case TAG_ID.META:
    case TAG_ID.NOFRAMES:
    case TAG_ID.STYLE: {
      startTagInHead(p, token);
      break;
    }
    case TAG_ID.NOSCRIPT: {
      p._err(token, ERR.nestedNoscriptInHead);
      break;
    }
    default: {
      tokenInHeadNoScript(p, token);
    }
  }
}
function endTagInHeadNoScript(p, token) {
  switch (token.tagID) {
    case TAG_ID.NOSCRIPT: {
      p.openElements.pop();
      p.insertionMode = InsertionMode.IN_HEAD;
      break;
    }
    case TAG_ID.BR: {
      tokenInHeadNoScript(p, token);
      break;
    }
    default: {
      p._err(token, ERR.endTagWithoutMatchingOpenElement);
    }
  }
}
function tokenInHeadNoScript(p, token) {
  const errCode = token.type === TokenType.EOF ? ERR.openElementsLeftAfterEof : ERR.disallowedContentInNoscriptInHead;
  p._err(token, errCode);
  p.openElements.pop();
  p.insertionMode = InsertionMode.IN_HEAD;
  p._processToken(token);
}
function startTagAfterHead(p, token) {
  switch (token.tagID) {
    case TAG_ID.HTML: {
      startTagInBody(p, token);
      break;
    }
    case TAG_ID.BODY: {
      p._insertElement(token, NS.HTML);
      p.framesetOk = false;
      p.insertionMode = InsertionMode.IN_BODY;
      break;
    }
    case TAG_ID.FRAMESET: {
      p._insertElement(token, NS.HTML);
      p.insertionMode = InsertionMode.IN_FRAMESET;
      break;
    }
    case TAG_ID.BASE:
    case TAG_ID.BASEFONT:
    case TAG_ID.BGSOUND:
    case TAG_ID.LINK:
    case TAG_ID.META:
    case TAG_ID.NOFRAMES:
    case TAG_ID.SCRIPT:
    case TAG_ID.STYLE:
    case TAG_ID.TEMPLATE:
    case TAG_ID.TITLE: {
      p._err(token, ERR.abandonedHeadElementChild);
      p.openElements.push(p.headElement, TAG_ID.HEAD);
      startTagInHead(p, token);
      p.openElements.remove(p.headElement);
      break;
    }
    case TAG_ID.HEAD: {
      p._err(token, ERR.misplacedStartTagForHeadElement);
      break;
    }
    default: {
      tokenAfterHead(p, token);
    }
  }
}
function endTagAfterHead(p, token) {
  switch (token.tagID) {
    case TAG_ID.BODY:
    case TAG_ID.HTML:
    case TAG_ID.BR: {
      tokenAfterHead(p, token);
      break;
    }
    case TAG_ID.TEMPLATE: {
      templateEndTagInHead(p, token);
      break;
    }
    default: {
      p._err(token, ERR.endTagWithoutMatchingOpenElement);
    }
  }
}
function tokenAfterHead(p, token) {
  p._insertFakeElement(TAG_NAMES.BODY, TAG_ID.BODY);
  p.insertionMode = InsertionMode.IN_BODY;
  modeInBody(p, token);
}
function modeInBody(p, token) {
  switch (token.type) {
    case TokenType.CHARACTER: {
      characterInBody(p, token);
      break;
    }
    case TokenType.WHITESPACE_CHARACTER: {
      whitespaceCharacterInBody(p, token);
      break;
    }
    case TokenType.COMMENT: {
      appendComment(p, token);
      break;
    }
    case TokenType.START_TAG: {
      startTagInBody(p, token);
      break;
    }
    case TokenType.END_TAG: {
      endTagInBody(p, token);
      break;
    }
    case TokenType.EOF: {
      eofInBody(p, token);
      break;
    }
    default:
  }
}
function whitespaceCharacterInBody(p, token) {
  p._reconstructActiveFormattingElements();
  p._insertCharacters(token);
}
function characterInBody(p, token) {
  p._reconstructActiveFormattingElements();
  p._insertCharacters(token);
  p.framesetOk = false;
}
function htmlStartTagInBody(p, token) {
  if (p.openElements.tmplCount === 0) {
    p.treeAdapter.adoptAttributes(p.openElements.items[0], token.attrs);
  }
}
function bodyStartTagInBody(p, token) {
  const bodyElement = p.openElements.tryPeekProperlyNestedBodyElement();
  if (bodyElement && p.openElements.tmplCount === 0) {
    p.framesetOk = false;
    p.treeAdapter.adoptAttributes(bodyElement, token.attrs);
  }
}
function framesetStartTagInBody(p, token) {
  const bodyElement = p.openElements.tryPeekProperlyNestedBodyElement();
  if (p.framesetOk && bodyElement) {
    p.treeAdapter.detachNode(bodyElement);
    p.openElements.popAllUpToHtmlElement();
    p._insertElement(token, NS.HTML);
    p.insertionMode = InsertionMode.IN_FRAMESET;
  }
}
function addressStartTagInBody(p, token) {
  if (p.openElements.hasInButtonScope(TAG_ID.P)) {
    p._closePElement();
  }
  p._insertElement(token, NS.HTML);
}
function numberedHeaderStartTagInBody(p, token) {
  if (p.openElements.hasInButtonScope(TAG_ID.P)) {
    p._closePElement();
  }
  if (p.openElements.currentTagId !== undefined && NUMBERED_HEADERS.has(p.openElements.currentTagId)) {
    p.openElements.pop();
  }
  p._insertElement(token, NS.HTML);
}
function preStartTagInBody(p, token) {
  if (p.openElements.hasInButtonScope(TAG_ID.P)) {
    p._closePElement();
  }
  p._insertElement(token, NS.HTML);
  p.skipNextNewLine = true;
  p.framesetOk = false;
}
function formStartTagInBody(p, token) {
  const inTemplate = p.openElements.tmplCount > 0;
  if (!p.formElement || inTemplate) {
    if (p.openElements.hasInButtonScope(TAG_ID.P)) {
      p._closePElement();
    }
    p._insertElement(token, NS.HTML);
    if (!inTemplate) {
      p.formElement = p.openElements.current;
    }
  }
}
function listItemStartTagInBody(p, token) {
  p.framesetOk = false;
  const tn = token.tagID;
  for (let i = p.openElements.stackTop;i >= 0; i--) {
    const elementId = p.openElements.tagIDs[i];
    if (tn === TAG_ID.LI && elementId === TAG_ID.LI || (tn === TAG_ID.DD || tn === TAG_ID.DT) && (elementId === TAG_ID.DD || elementId === TAG_ID.DT)) {
      p.openElements.generateImpliedEndTagsWithExclusion(elementId);
      p.openElements.popUntilTagNamePopped(elementId);
      break;
    }
    if (elementId !== TAG_ID.ADDRESS && elementId !== TAG_ID.DIV && elementId !== TAG_ID.P && p._isSpecialElement(p.openElements.items[i], elementId)) {
      break;
    }
  }
  if (p.openElements.hasInButtonScope(TAG_ID.P)) {
    p._closePElement();
  }
  p._insertElement(token, NS.HTML);
}
function plaintextStartTagInBody(p, token) {
  if (p.openElements.hasInButtonScope(TAG_ID.P)) {
    p._closePElement();
  }
  p._insertElement(token, NS.HTML);
  p.tokenizer.state = TokenizerMode.PLAINTEXT;
}
function buttonStartTagInBody(p, token) {
  if (p.openElements.hasInScope(TAG_ID.BUTTON)) {
    p.openElements.generateImpliedEndTags();
    p.openElements.popUntilTagNamePopped(TAG_ID.BUTTON);
  }
  p._reconstructActiveFormattingElements();
  p._insertElement(token, NS.HTML);
  p.framesetOk = false;
}
function aStartTagInBody(p, token) {
  const activeElementEntry = p.activeFormattingElements.getElementEntryInScopeWithTagName(TAG_NAMES.A);
  if (activeElementEntry) {
    callAdoptionAgency(p, token);
    p.openElements.remove(activeElementEntry.element);
    p.activeFormattingElements.removeEntry(activeElementEntry);
  }
  p._reconstructActiveFormattingElements();
  p._insertElement(token, NS.HTML);
  p.activeFormattingElements.pushElement(p.openElements.current, token);
}
function bStartTagInBody(p, token) {
  p._reconstructActiveFormattingElements();
  p._insertElement(token, NS.HTML);
  p.activeFormattingElements.pushElement(p.openElements.current, token);
}
function nobrStartTagInBody(p, token) {
  p._reconstructActiveFormattingElements();
  if (p.openElements.hasInScope(TAG_ID.NOBR)) {
    callAdoptionAgency(p, token);
    p._reconstructActiveFormattingElements();
  }
  p._insertElement(token, NS.HTML);
  p.activeFormattingElements.pushElement(p.openElements.current, token);
}
function appletStartTagInBody(p, token) {
  p._reconstructActiveFormattingElements();
  p._insertElement(token, NS.HTML);
  p.activeFormattingElements.insertMarker();
  p.framesetOk = false;
}
function tableStartTagInBody(p, token) {
  if (p.treeAdapter.getDocumentMode(p.document) !== DOCUMENT_MODE.QUIRKS && p.openElements.hasInButtonScope(TAG_ID.P)) {
    p._closePElement();
  }
  p._insertElement(token, NS.HTML);
  p.framesetOk = false;
  p.insertionMode = InsertionMode.IN_TABLE;
}
function areaStartTagInBody(p, token) {
  p._reconstructActiveFormattingElements();
  p._appendElement(token, NS.HTML);
  p.framesetOk = false;
  token.ackSelfClosing = true;
}
function isHiddenInput(token) {
  const inputType = getTokenAttr(token, ATTRS.TYPE);
  return inputType != null && inputType.toLowerCase() === HIDDEN_INPUT_TYPE;
}
function inputStartTagInBody(p, token) {
  p._reconstructActiveFormattingElements();
  p._appendElement(token, NS.HTML);
  if (!isHiddenInput(token)) {
    p.framesetOk = false;
  }
  token.ackSelfClosing = true;
}
function paramStartTagInBody(p, token) {
  p._appendElement(token, NS.HTML);
  token.ackSelfClosing = true;
}
function hrStartTagInBody(p, token) {
  if (p.openElements.hasInButtonScope(TAG_ID.P)) {
    p._closePElement();
  }
  p._appendElement(token, NS.HTML);
  p.framesetOk = false;
  token.ackSelfClosing = true;
}
function imageStartTagInBody(p, token) {
  token.tagName = TAG_NAMES.IMG;
  token.tagID = TAG_ID.IMG;
  areaStartTagInBody(p, token);
}
function textareaStartTagInBody(p, token) {
  p._insertElement(token, NS.HTML);
  p.skipNextNewLine = true;
  p.tokenizer.state = TokenizerMode.RCDATA;
  p.originalInsertionMode = p.insertionMode;
  p.framesetOk = false;
  p.insertionMode = InsertionMode.TEXT;
}
function xmpStartTagInBody(p, token) {
  if (p.openElements.hasInButtonScope(TAG_ID.P)) {
    p._closePElement();
  }
  p._reconstructActiveFormattingElements();
  p.framesetOk = false;
  p._switchToTextParsing(token, TokenizerMode.RAWTEXT);
}
function iframeStartTagInBody(p, token) {
  p.framesetOk = false;
  p._switchToTextParsing(token, TokenizerMode.RAWTEXT);
}
function rawTextStartTagInBody(p, token) {
  p._switchToTextParsing(token, TokenizerMode.RAWTEXT);
}
function selectStartTagInBody(p, token) {
  p._reconstructActiveFormattingElements();
  p._insertElement(token, NS.HTML);
  p.framesetOk = false;
  p.insertionMode = p.insertionMode === InsertionMode.IN_TABLE || p.insertionMode === InsertionMode.IN_CAPTION || p.insertionMode === InsertionMode.IN_TABLE_BODY || p.insertionMode === InsertionMode.IN_ROW || p.insertionMode === InsertionMode.IN_CELL ? InsertionMode.IN_SELECT_IN_TABLE : InsertionMode.IN_SELECT;
}
function optgroupStartTagInBody(p, token) {
  if (p.openElements.currentTagId === TAG_ID.OPTION) {
    p.openElements.pop();
  }
  p._reconstructActiveFormattingElements();
  p._insertElement(token, NS.HTML);
}
function rbStartTagInBody(p, token) {
  if (p.openElements.hasInScope(TAG_ID.RUBY)) {
    p.openElements.generateImpliedEndTags();
  }
  p._insertElement(token, NS.HTML);
}
function rtStartTagInBody(p, token) {
  if (p.openElements.hasInScope(TAG_ID.RUBY)) {
    p.openElements.generateImpliedEndTagsWithExclusion(TAG_ID.RTC);
  }
  p._insertElement(token, NS.HTML);
}
function mathStartTagInBody(p, token) {
  p._reconstructActiveFormattingElements();
  adjustTokenMathMLAttrs(token);
  adjustTokenXMLAttrs(token);
  if (token.selfClosing) {
    p._appendElement(token, NS.MATHML);
  } else {
    p._insertElement(token, NS.MATHML);
  }
  token.ackSelfClosing = true;
}
function svgStartTagInBody(p, token) {
  p._reconstructActiveFormattingElements();
  adjustTokenSVGAttrs(token);
  adjustTokenXMLAttrs(token);
  if (token.selfClosing) {
    p._appendElement(token, NS.SVG);
  } else {
    p._insertElement(token, NS.SVG);
  }
  token.ackSelfClosing = true;
}
function genericStartTagInBody(p, token) {
  p._reconstructActiveFormattingElements();
  p._insertElement(token, NS.HTML);
}
function startTagInBody(p, token) {
  switch (token.tagID) {
    case TAG_ID.I:
    case TAG_ID.S:
    case TAG_ID.B:
    case TAG_ID.U:
    case TAG_ID.EM:
    case TAG_ID.TT:
    case TAG_ID.BIG:
    case TAG_ID.CODE:
    case TAG_ID.FONT:
    case TAG_ID.SMALL:
    case TAG_ID.STRIKE:
    case TAG_ID.STRONG: {
      bStartTagInBody(p, token);
      break;
    }
    case TAG_ID.A: {
      aStartTagInBody(p, token);
      break;
    }
    case TAG_ID.H1:
    case TAG_ID.H2:
    case TAG_ID.H3:
    case TAG_ID.H4:
    case TAG_ID.H5:
    case TAG_ID.H6: {
      numberedHeaderStartTagInBody(p, token);
      break;
    }
    case TAG_ID.P:
    case TAG_ID.DL:
    case TAG_ID.OL:
    case TAG_ID.UL:
    case TAG_ID.DIV:
    case TAG_ID.DIR:
    case TAG_ID.NAV:
    case TAG_ID.MAIN:
    case TAG_ID.MENU:
    case TAG_ID.ASIDE:
    case TAG_ID.CENTER:
    case TAG_ID.FIGURE:
    case TAG_ID.FOOTER:
    case TAG_ID.HEADER:
    case TAG_ID.HGROUP:
    case TAG_ID.DIALOG:
    case TAG_ID.DETAILS:
    case TAG_ID.ADDRESS:
    case TAG_ID.ARTICLE:
    case TAG_ID.SEARCH:
    case TAG_ID.SECTION:
    case TAG_ID.SUMMARY:
    case TAG_ID.FIELDSET:
    case TAG_ID.BLOCKQUOTE:
    case TAG_ID.FIGCAPTION: {
      addressStartTagInBody(p, token);
      break;
    }
    case TAG_ID.LI:
    case TAG_ID.DD:
    case TAG_ID.DT: {
      listItemStartTagInBody(p, token);
      break;
    }
    case TAG_ID.BR:
    case TAG_ID.IMG:
    case TAG_ID.WBR:
    case TAG_ID.AREA:
    case TAG_ID.EMBED:
    case TAG_ID.KEYGEN: {
      areaStartTagInBody(p, token);
      break;
    }
    case TAG_ID.HR: {
      hrStartTagInBody(p, token);
      break;
    }
    case TAG_ID.RB:
    case TAG_ID.RTC: {
      rbStartTagInBody(p, token);
      break;
    }
    case TAG_ID.RT:
    case TAG_ID.RP: {
      rtStartTagInBody(p, token);
      break;
    }
    case TAG_ID.PRE:
    case TAG_ID.LISTING: {
      preStartTagInBody(p, token);
      break;
    }
    case TAG_ID.XMP: {
      xmpStartTagInBody(p, token);
      break;
    }
    case TAG_ID.SVG: {
      svgStartTagInBody(p, token);
      break;
    }
    case TAG_ID.HTML: {
      htmlStartTagInBody(p, token);
      break;
    }
    case TAG_ID.BASE:
    case TAG_ID.LINK:
    case TAG_ID.META:
    case TAG_ID.STYLE:
    case TAG_ID.TITLE:
    case TAG_ID.SCRIPT:
    case TAG_ID.BGSOUND:
    case TAG_ID.BASEFONT:
    case TAG_ID.TEMPLATE: {
      startTagInHead(p, token);
      break;
    }
    case TAG_ID.BODY: {
      bodyStartTagInBody(p, token);
      break;
    }
    case TAG_ID.FORM: {
      formStartTagInBody(p, token);
      break;
    }
    case TAG_ID.NOBR: {
      nobrStartTagInBody(p, token);
      break;
    }
    case TAG_ID.MATH: {
      mathStartTagInBody(p, token);
      break;
    }
    case TAG_ID.TABLE: {
      tableStartTagInBody(p, token);
      break;
    }
    case TAG_ID.INPUT: {
      inputStartTagInBody(p, token);
      break;
    }
    case TAG_ID.PARAM:
    case TAG_ID.TRACK:
    case TAG_ID.SOURCE: {
      paramStartTagInBody(p, token);
      break;
    }
    case TAG_ID.IMAGE: {
      imageStartTagInBody(p, token);
      break;
    }
    case TAG_ID.BUTTON: {
      buttonStartTagInBody(p, token);
      break;
    }
    case TAG_ID.APPLET:
    case TAG_ID.OBJECT:
    case TAG_ID.MARQUEE: {
      appletStartTagInBody(p, token);
      break;
    }
    case TAG_ID.IFRAME: {
      iframeStartTagInBody(p, token);
      break;
    }
    case TAG_ID.SELECT: {
      selectStartTagInBody(p, token);
      break;
    }
    case TAG_ID.OPTION:
    case TAG_ID.OPTGROUP: {
      optgroupStartTagInBody(p, token);
      break;
    }
    case TAG_ID.NOEMBED:
    case TAG_ID.NOFRAMES: {
      rawTextStartTagInBody(p, token);
      break;
    }
    case TAG_ID.FRAMESET: {
      framesetStartTagInBody(p, token);
      break;
    }
    case TAG_ID.TEXTAREA: {
      textareaStartTagInBody(p, token);
      break;
    }
    case TAG_ID.NOSCRIPT: {
      if (p.options.scriptingEnabled) {
        rawTextStartTagInBody(p, token);
      } else {
        genericStartTagInBody(p, token);
      }
      break;
    }
    case TAG_ID.PLAINTEXT: {
      plaintextStartTagInBody(p, token);
      break;
    }
    case TAG_ID.COL:
    case TAG_ID.TH:
    case TAG_ID.TD:
    case TAG_ID.TR:
    case TAG_ID.HEAD:
    case TAG_ID.FRAME:
    case TAG_ID.TBODY:
    case TAG_ID.TFOOT:
    case TAG_ID.THEAD:
    case TAG_ID.CAPTION:
    case TAG_ID.COLGROUP: {
      break;
    }
    default: {
      genericStartTagInBody(p, token);
    }
  }
}
function bodyEndTagInBody(p, token) {
  if (p.openElements.hasInScope(TAG_ID.BODY)) {
    p.insertionMode = InsertionMode.AFTER_BODY;
    if (p.options.sourceCodeLocationInfo) {
      const bodyElement = p.openElements.tryPeekProperlyNestedBodyElement();
      if (bodyElement) {
        p._setEndLocation(bodyElement, token);
      }
    }
  }
}
function htmlEndTagInBody(p, token) {
  if (p.openElements.hasInScope(TAG_ID.BODY)) {
    p.insertionMode = InsertionMode.AFTER_BODY;
    endTagAfterBody(p, token);
  }
}
function addressEndTagInBody(p, token) {
  const tn = token.tagID;
  if (p.openElements.hasInScope(tn)) {
    p.openElements.generateImpliedEndTags();
    p.openElements.popUntilTagNamePopped(tn);
  }
}
function formEndTagInBody(p) {
  const inTemplate = p.openElements.tmplCount > 0;
  const { formElement } = p;
  if (!inTemplate) {
    p.formElement = null;
  }
  if ((formElement || inTemplate) && p.openElements.hasInScope(TAG_ID.FORM)) {
    p.openElements.generateImpliedEndTags();
    if (inTemplate) {
      p.openElements.popUntilTagNamePopped(TAG_ID.FORM);
    } else if (formElement) {
      p.openElements.remove(formElement);
    }
  }
}
function pEndTagInBody(p) {
  if (!p.openElements.hasInButtonScope(TAG_ID.P)) {
    p._insertFakeElement(TAG_NAMES.P, TAG_ID.P);
  }
  p._closePElement();
}
function liEndTagInBody(p) {
  if (p.openElements.hasInListItemScope(TAG_ID.LI)) {
    p.openElements.generateImpliedEndTagsWithExclusion(TAG_ID.LI);
    p.openElements.popUntilTagNamePopped(TAG_ID.LI);
  }
}
function ddEndTagInBody(p, token) {
  const tn = token.tagID;
  if (p.openElements.hasInScope(tn)) {
    p.openElements.generateImpliedEndTagsWithExclusion(tn);
    p.openElements.popUntilTagNamePopped(tn);
  }
}
function numberedHeaderEndTagInBody(p) {
  if (p.openElements.hasNumberedHeaderInScope()) {
    p.openElements.generateImpliedEndTags();
    p.openElements.popUntilNumberedHeaderPopped();
  }
}
function appletEndTagInBody(p, token) {
  const tn = token.tagID;
  if (p.openElements.hasInScope(tn)) {
    p.openElements.generateImpliedEndTags();
    p.openElements.popUntilTagNamePopped(tn);
    p.activeFormattingElements.clearToLastMarker();
  }
}
function brEndTagInBody(p) {
  p._reconstructActiveFormattingElements();
  p._insertFakeElement(TAG_NAMES.BR, TAG_ID.BR);
  p.openElements.pop();
  p.framesetOk = false;
}
function genericEndTagInBody(p, token) {
  const tn = token.tagName;
  const tid = token.tagID;
  for (let i = p.openElements.stackTop;i > 0; i--) {
    const element = p.openElements.items[i];
    const elementId = p.openElements.tagIDs[i];
    if (tid === elementId && (tid !== TAG_ID.UNKNOWN || p.treeAdapter.getTagName(element) === tn)) {
      p.openElements.generateImpliedEndTagsWithExclusion(tid);
      if (p.openElements.stackTop >= i)
        p.openElements.shortenToLength(i);
      break;
    }
    if (p._isSpecialElement(element, elementId)) {
      break;
    }
  }
}
function endTagInBody(p, token) {
  switch (token.tagID) {
    case TAG_ID.A:
    case TAG_ID.B:
    case TAG_ID.I:
    case TAG_ID.S:
    case TAG_ID.U:
    case TAG_ID.EM:
    case TAG_ID.TT:
    case TAG_ID.BIG:
    case TAG_ID.CODE:
    case TAG_ID.FONT:
    case TAG_ID.NOBR:
    case TAG_ID.SMALL:
    case TAG_ID.STRIKE:
    case TAG_ID.STRONG: {
      callAdoptionAgency(p, token);
      break;
    }
    case TAG_ID.P: {
      pEndTagInBody(p);
      break;
    }
    case TAG_ID.DL:
    case TAG_ID.UL:
    case TAG_ID.OL:
    case TAG_ID.DIR:
    case TAG_ID.DIV:
    case TAG_ID.NAV:
    case TAG_ID.PRE:
    case TAG_ID.MAIN:
    case TAG_ID.MENU:
    case TAG_ID.ASIDE:
    case TAG_ID.BUTTON:
    case TAG_ID.CENTER:
    case TAG_ID.FIGURE:
    case TAG_ID.FOOTER:
    case TAG_ID.HEADER:
    case TAG_ID.HGROUP:
    case TAG_ID.DIALOG:
    case TAG_ID.ADDRESS:
    case TAG_ID.ARTICLE:
    case TAG_ID.DETAILS:
    case TAG_ID.SEARCH:
    case TAG_ID.SECTION:
    case TAG_ID.SUMMARY:
    case TAG_ID.LISTING:
    case TAG_ID.FIELDSET:
    case TAG_ID.BLOCKQUOTE:
    case TAG_ID.FIGCAPTION: {
      addressEndTagInBody(p, token);
      break;
    }
    case TAG_ID.LI: {
      liEndTagInBody(p);
      break;
    }
    case TAG_ID.DD:
    case TAG_ID.DT: {
      ddEndTagInBody(p, token);
      break;
    }
    case TAG_ID.H1:
    case TAG_ID.H2:
    case TAG_ID.H3:
    case TAG_ID.H4:
    case TAG_ID.H5:
    case TAG_ID.H6: {
      numberedHeaderEndTagInBody(p);
      break;
    }
    case TAG_ID.BR: {
      brEndTagInBody(p);
      break;
    }
    case TAG_ID.BODY: {
      bodyEndTagInBody(p, token);
      break;
    }
    case TAG_ID.HTML: {
      htmlEndTagInBody(p, token);
      break;
    }
    case TAG_ID.FORM: {
      formEndTagInBody(p);
      break;
    }
    case TAG_ID.APPLET:
    case TAG_ID.OBJECT:
    case TAG_ID.MARQUEE: {
      appletEndTagInBody(p, token);
      break;
    }
    case TAG_ID.TEMPLATE: {
      templateEndTagInHead(p, token);
      break;
    }
    default: {
      genericEndTagInBody(p, token);
    }
  }
}
function eofInBody(p, token) {
  if (p.tmplInsertionModeStack.length > 0) {
    eofInTemplate(p, token);
  } else {
    stopParsing(p, token);
  }
}
function endTagInText(p, token) {
  var _a;
  if (token.tagID === TAG_ID.SCRIPT) {
    (_a = p.scriptHandler) === null || _a === undefined || _a.call(p, p.openElements.current);
  }
  p.openElements.pop();
  p.insertionMode = p.originalInsertionMode;
}
function eofInText(p, token) {
  p._err(token, ERR.eofInElementThatCanContainOnlyText);
  p.openElements.pop();
  p.insertionMode = p.originalInsertionMode;
  p.onEof(token);
}
function characterInTable(p, token) {
  if (p.openElements.currentTagId !== undefined && TABLE_STRUCTURE_TAGS.has(p.openElements.currentTagId)) {
    p.pendingCharacterTokens.length = 0;
    p.hasNonWhitespacePendingCharacterToken = false;
    p.originalInsertionMode = p.insertionMode;
    p.insertionMode = InsertionMode.IN_TABLE_TEXT;
    switch (token.type) {
      case TokenType.CHARACTER: {
        characterInTableText(p, token);
        break;
      }
      case TokenType.WHITESPACE_CHARACTER: {
        whitespaceCharacterInTableText(p, token);
        break;
      }
    }
  } else {
    tokenInTable(p, token);
  }
}
function captionStartTagInTable(p, token) {
  p.openElements.clearBackToTableContext();
  p.activeFormattingElements.insertMarker();
  p._insertElement(token, NS.HTML);
  p.insertionMode = InsertionMode.IN_CAPTION;
}
function colgroupStartTagInTable(p, token) {
  p.openElements.clearBackToTableContext();
  p._insertElement(token, NS.HTML);
  p.insertionMode = InsertionMode.IN_COLUMN_GROUP;
}
function colStartTagInTable(p, token) {
  p.openElements.clearBackToTableContext();
  p._insertFakeElement(TAG_NAMES.COLGROUP, TAG_ID.COLGROUP);
  p.insertionMode = InsertionMode.IN_COLUMN_GROUP;
  startTagInColumnGroup(p, token);
}
function tbodyStartTagInTable(p, token) {
  p.openElements.clearBackToTableContext();
  p._insertElement(token, NS.HTML);
  p.insertionMode = InsertionMode.IN_TABLE_BODY;
}
function tdStartTagInTable(p, token) {
  p.openElements.clearBackToTableContext();
  p._insertFakeElement(TAG_NAMES.TBODY, TAG_ID.TBODY);
  p.insertionMode = InsertionMode.IN_TABLE_BODY;
  startTagInTableBody(p, token);
}
function tableStartTagInTable(p, token) {
  if (p.openElements.hasInTableScope(TAG_ID.TABLE)) {
    p.openElements.popUntilTagNamePopped(TAG_ID.TABLE);
    p._resetInsertionMode();
    p._processStartTag(token);
  }
}
function inputStartTagInTable(p, token) {
  if (isHiddenInput(token)) {
    p._appendElement(token, NS.HTML);
  } else {
    tokenInTable(p, token);
  }
  token.ackSelfClosing = true;
}
function formStartTagInTable(p, token) {
  if (!p.formElement && p.openElements.tmplCount === 0) {
    p._insertElement(token, NS.HTML);
    p.formElement = p.openElements.current;
    p.openElements.pop();
  }
}
function startTagInTable(p, token) {
  switch (token.tagID) {
    case TAG_ID.TD:
    case TAG_ID.TH:
    case TAG_ID.TR: {
      tdStartTagInTable(p, token);
      break;
    }
    case TAG_ID.STYLE:
    case TAG_ID.SCRIPT:
    case TAG_ID.TEMPLATE: {
      startTagInHead(p, token);
      break;
    }
    case TAG_ID.COL: {
      colStartTagInTable(p, token);
      break;
    }
    case TAG_ID.FORM: {
      formStartTagInTable(p, token);
      break;
    }
    case TAG_ID.TABLE: {
      tableStartTagInTable(p, token);
      break;
    }
    case TAG_ID.TBODY:
    case TAG_ID.TFOOT:
    case TAG_ID.THEAD: {
      tbodyStartTagInTable(p, token);
      break;
    }
    case TAG_ID.INPUT: {
      inputStartTagInTable(p, token);
      break;
    }
    case TAG_ID.CAPTION: {
      captionStartTagInTable(p, token);
      break;
    }
    case TAG_ID.COLGROUP: {
      colgroupStartTagInTable(p, token);
      break;
    }
    default: {
      tokenInTable(p, token);
    }
  }
}
function endTagInTable(p, token) {
  switch (token.tagID) {
    case TAG_ID.TABLE: {
      if (p.openElements.hasInTableScope(TAG_ID.TABLE)) {
        p.openElements.popUntilTagNamePopped(TAG_ID.TABLE);
        p._resetInsertionMode();
      }
      break;
    }
    case TAG_ID.TEMPLATE: {
      templateEndTagInHead(p, token);
      break;
    }
    case TAG_ID.BODY:
    case TAG_ID.CAPTION:
    case TAG_ID.COL:
    case TAG_ID.COLGROUP:
    case TAG_ID.HTML:
    case TAG_ID.TBODY:
    case TAG_ID.TD:
    case TAG_ID.TFOOT:
    case TAG_ID.TH:
    case TAG_ID.THEAD:
    case TAG_ID.TR: {
      break;
    }
    default: {
      tokenInTable(p, token);
    }
  }
}
function tokenInTable(p, token) {
  const savedFosterParentingState = p.fosterParentingEnabled;
  p.fosterParentingEnabled = true;
  modeInBody(p, token);
  p.fosterParentingEnabled = savedFosterParentingState;
}
function whitespaceCharacterInTableText(p, token) {
  p.pendingCharacterTokens.push(token);
}
function characterInTableText(p, token) {
  p.pendingCharacterTokens.push(token);
  p.hasNonWhitespacePendingCharacterToken = true;
}
function tokenInTableText(p, token) {
  let i = 0;
  if (p.hasNonWhitespacePendingCharacterToken) {
    for (;i < p.pendingCharacterTokens.length; i++) {
      tokenInTable(p, p.pendingCharacterTokens[i]);
    }
  } else {
    for (;i < p.pendingCharacterTokens.length; i++) {
      p._insertCharacters(p.pendingCharacterTokens[i]);
    }
  }
  p.insertionMode = p.originalInsertionMode;
  p._processToken(token);
}
var TABLE_VOID_ELEMENTS = new Set([TAG_ID.CAPTION, TAG_ID.COL, TAG_ID.COLGROUP, TAG_ID.TBODY, TAG_ID.TD, TAG_ID.TFOOT, TAG_ID.TH, TAG_ID.THEAD, TAG_ID.TR]);
function startTagInCaption(p, token) {
  const tn = token.tagID;
  if (TABLE_VOID_ELEMENTS.has(tn)) {
    if (p.openElements.hasInTableScope(TAG_ID.CAPTION)) {
      p.openElements.generateImpliedEndTags();
      p.openElements.popUntilTagNamePopped(TAG_ID.CAPTION);
      p.activeFormattingElements.clearToLastMarker();
      p.insertionMode = InsertionMode.IN_TABLE;
      startTagInTable(p, token);
    }
  } else {
    startTagInBody(p, token);
  }
}
function endTagInCaption(p, token) {
  const tn = token.tagID;
  switch (tn) {
    case TAG_ID.CAPTION:
    case TAG_ID.TABLE: {
      if (p.openElements.hasInTableScope(TAG_ID.CAPTION)) {
        p.openElements.generateImpliedEndTags();
        p.openElements.popUntilTagNamePopped(TAG_ID.CAPTION);
        p.activeFormattingElements.clearToLastMarker();
        p.insertionMode = InsertionMode.IN_TABLE;
        if (tn === TAG_ID.TABLE) {
          endTagInTable(p, token);
        }
      }
      break;
    }
    case TAG_ID.BODY:
    case TAG_ID.COL:
    case TAG_ID.COLGROUP:
    case TAG_ID.HTML:
    case TAG_ID.TBODY:
    case TAG_ID.TD:
    case TAG_ID.TFOOT:
    case TAG_ID.TH:
    case TAG_ID.THEAD:
    case TAG_ID.TR: {
      break;
    }
    default: {
      endTagInBody(p, token);
    }
  }
}
function startTagInColumnGroup(p, token) {
  switch (token.tagID) {
    case TAG_ID.HTML: {
      startTagInBody(p, token);
      break;
    }
    case TAG_ID.COL: {
      p._appendElement(token, NS.HTML);
      token.ackSelfClosing = true;
      break;
    }
    case TAG_ID.TEMPLATE: {
      startTagInHead(p, token);
      break;
    }
    default: {
      tokenInColumnGroup(p, token);
    }
  }
}
function endTagInColumnGroup(p, token) {
  switch (token.tagID) {
    case TAG_ID.COLGROUP: {
      if (p.openElements.currentTagId === TAG_ID.COLGROUP) {
        p.openElements.pop();
        p.insertionMode = InsertionMode.IN_TABLE;
      }
      break;
    }
    case TAG_ID.TEMPLATE: {
      templateEndTagInHead(p, token);
      break;
    }
    case TAG_ID.COL: {
      break;
    }
    default: {
      tokenInColumnGroup(p, token);
    }
  }
}
function tokenInColumnGroup(p, token) {
  if (p.openElements.currentTagId === TAG_ID.COLGROUP) {
    p.openElements.pop();
    p.insertionMode = InsertionMode.IN_TABLE;
    p._processToken(token);
  }
}
function startTagInTableBody(p, token) {
  switch (token.tagID) {
    case TAG_ID.TR: {
      p.openElements.clearBackToTableBodyContext();
      p._insertElement(token, NS.HTML);
      p.insertionMode = InsertionMode.IN_ROW;
      break;
    }
    case TAG_ID.TH:
    case TAG_ID.TD: {
      p.openElements.clearBackToTableBodyContext();
      p._insertFakeElement(TAG_NAMES.TR, TAG_ID.TR);
      p.insertionMode = InsertionMode.IN_ROW;
      startTagInRow(p, token);
      break;
    }
    case TAG_ID.CAPTION:
    case TAG_ID.COL:
    case TAG_ID.COLGROUP:
    case TAG_ID.TBODY:
    case TAG_ID.TFOOT:
    case TAG_ID.THEAD: {
      if (p.openElements.hasTableBodyContextInTableScope()) {
        p.openElements.clearBackToTableBodyContext();
        p.openElements.pop();
        p.insertionMode = InsertionMode.IN_TABLE;
        startTagInTable(p, token);
      }
      break;
    }
    default: {
      startTagInTable(p, token);
    }
  }
}
function endTagInTableBody(p, token) {
  const tn = token.tagID;
  switch (token.tagID) {
    case TAG_ID.TBODY:
    case TAG_ID.TFOOT:
    case TAG_ID.THEAD: {
      if (p.openElements.hasInTableScope(tn)) {
        p.openElements.clearBackToTableBodyContext();
        p.openElements.pop();
        p.insertionMode = InsertionMode.IN_TABLE;
      }
      break;
    }
    case TAG_ID.TABLE: {
      if (p.openElements.hasTableBodyContextInTableScope()) {
        p.openElements.clearBackToTableBodyContext();
        p.openElements.pop();
        p.insertionMode = InsertionMode.IN_TABLE;
        endTagInTable(p, token);
      }
      break;
    }
    case TAG_ID.BODY:
    case TAG_ID.CAPTION:
    case TAG_ID.COL:
    case TAG_ID.COLGROUP:
    case TAG_ID.HTML:
    case TAG_ID.TD:
    case TAG_ID.TH:
    case TAG_ID.TR: {
      break;
    }
    default: {
      endTagInTable(p, token);
    }
  }
}
function startTagInRow(p, token) {
  switch (token.tagID) {
    case TAG_ID.TH:
    case TAG_ID.TD: {
      p.openElements.clearBackToTableRowContext();
      p._insertElement(token, NS.HTML);
      p.insertionMode = InsertionMode.IN_CELL;
      p.activeFormattingElements.insertMarker();
      break;
    }
    case TAG_ID.CAPTION:
    case TAG_ID.COL:
    case TAG_ID.COLGROUP:
    case TAG_ID.TBODY:
    case TAG_ID.TFOOT:
    case TAG_ID.THEAD:
    case TAG_ID.TR: {
      if (p.openElements.hasInTableScope(TAG_ID.TR)) {
        p.openElements.clearBackToTableRowContext();
        p.openElements.pop();
        p.insertionMode = InsertionMode.IN_TABLE_BODY;
        startTagInTableBody(p, token);
      }
      break;
    }
    default: {
      startTagInTable(p, token);
    }
  }
}
function endTagInRow(p, token) {
  switch (token.tagID) {
    case TAG_ID.TR: {
      if (p.openElements.hasInTableScope(TAG_ID.TR)) {
        p.openElements.clearBackToTableRowContext();
        p.openElements.pop();
        p.insertionMode = InsertionMode.IN_TABLE_BODY;
      }
      break;
    }
    case TAG_ID.TABLE: {
      if (p.openElements.hasInTableScope(TAG_ID.TR)) {
        p.openElements.clearBackToTableRowContext();
        p.openElements.pop();
        p.insertionMode = InsertionMode.IN_TABLE_BODY;
        endTagInTableBody(p, token);
      }
      break;
    }
    case TAG_ID.TBODY:
    case TAG_ID.TFOOT:
    case TAG_ID.THEAD: {
      if (p.openElements.hasInTableScope(token.tagID) || p.openElements.hasInTableScope(TAG_ID.TR)) {
        p.openElements.clearBackToTableRowContext();
        p.openElements.pop();
        p.insertionMode = InsertionMode.IN_TABLE_BODY;
        endTagInTableBody(p, token);
      }
      break;
    }
    case TAG_ID.BODY:
    case TAG_ID.CAPTION:
    case TAG_ID.COL:
    case TAG_ID.COLGROUP:
    case TAG_ID.HTML:
    case TAG_ID.TD:
    case TAG_ID.TH: {
      break;
    }
    default: {
      endTagInTable(p, token);
    }
  }
}
function startTagInCell(p, token) {
  const tn = token.tagID;
  if (TABLE_VOID_ELEMENTS.has(tn)) {
    if (p.openElements.hasInTableScope(TAG_ID.TD) || p.openElements.hasInTableScope(TAG_ID.TH)) {
      p._closeTableCell();
      startTagInRow(p, token);
    }
  } else {
    startTagInBody(p, token);
  }
}
function endTagInCell(p, token) {
  const tn = token.tagID;
  switch (tn) {
    case TAG_ID.TD:
    case TAG_ID.TH: {
      if (p.openElements.hasInTableScope(tn)) {
        p.openElements.generateImpliedEndTags();
        p.openElements.popUntilTagNamePopped(tn);
        p.activeFormattingElements.clearToLastMarker();
        p.insertionMode = InsertionMode.IN_ROW;
      }
      break;
    }
    case TAG_ID.TABLE:
    case TAG_ID.TBODY:
    case TAG_ID.TFOOT:
    case TAG_ID.THEAD:
    case TAG_ID.TR: {
      if (p.openElements.hasInTableScope(tn)) {
        p._closeTableCell();
        endTagInRow(p, token);
      }
      break;
    }
    case TAG_ID.BODY:
    case TAG_ID.CAPTION:
    case TAG_ID.COL:
    case TAG_ID.COLGROUP:
    case TAG_ID.HTML: {
      break;
    }
    default: {
      endTagInBody(p, token);
    }
  }
}
function startTagInSelect(p, token) {
  switch (token.tagID) {
    case TAG_ID.HTML: {
      startTagInBody(p, token);
      break;
    }
    case TAG_ID.OPTION: {
      if (p.openElements.currentTagId === TAG_ID.OPTION) {
        p.openElements.pop();
      }
      p._insertElement(token, NS.HTML);
      break;
    }
    case TAG_ID.OPTGROUP: {
      if (p.openElements.currentTagId === TAG_ID.OPTION) {
        p.openElements.pop();
      }
      if (p.openElements.currentTagId === TAG_ID.OPTGROUP) {
        p.openElements.pop();
      }
      p._insertElement(token, NS.HTML);
      break;
    }
    case TAG_ID.HR: {
      if (p.openElements.currentTagId === TAG_ID.OPTION) {
        p.openElements.pop();
      }
      if (p.openElements.currentTagId === TAG_ID.OPTGROUP) {
        p.openElements.pop();
      }
      p._appendElement(token, NS.HTML);
      token.ackSelfClosing = true;
      break;
    }
    case TAG_ID.INPUT:
    case TAG_ID.KEYGEN:
    case TAG_ID.TEXTAREA:
    case TAG_ID.SELECT: {
      if (p.openElements.hasInSelectScope(TAG_ID.SELECT)) {
        p.openElements.popUntilTagNamePopped(TAG_ID.SELECT);
        p._resetInsertionMode();
        if (token.tagID !== TAG_ID.SELECT) {
          p._processStartTag(token);
        }
      }
      break;
    }
    case TAG_ID.SCRIPT:
    case TAG_ID.TEMPLATE: {
      startTagInHead(p, token);
      break;
    }
    default:
  }
}
function endTagInSelect(p, token) {
  switch (token.tagID) {
    case TAG_ID.OPTGROUP: {
      if (p.openElements.stackTop > 0 && p.openElements.currentTagId === TAG_ID.OPTION && p.openElements.tagIDs[p.openElements.stackTop - 1] === TAG_ID.OPTGROUP) {
        p.openElements.pop();
      }
      if (p.openElements.currentTagId === TAG_ID.OPTGROUP) {
        p.openElements.pop();
      }
      break;
    }
    case TAG_ID.OPTION: {
      if (p.openElements.currentTagId === TAG_ID.OPTION) {
        p.openElements.pop();
      }
      break;
    }
    case TAG_ID.SELECT: {
      if (p.openElements.hasInSelectScope(TAG_ID.SELECT)) {
        p.openElements.popUntilTagNamePopped(TAG_ID.SELECT);
        p._resetInsertionMode();
      }
      break;
    }
    case TAG_ID.TEMPLATE: {
      templateEndTagInHead(p, token);
      break;
    }
    default:
  }
}
function startTagInSelectInTable(p, token) {
  const tn = token.tagID;
  if (tn === TAG_ID.CAPTION || tn === TAG_ID.TABLE || tn === TAG_ID.TBODY || tn === TAG_ID.TFOOT || tn === TAG_ID.THEAD || tn === TAG_ID.TR || tn === TAG_ID.TD || tn === TAG_ID.TH) {
    p.openElements.popUntilTagNamePopped(TAG_ID.SELECT);
    p._resetInsertionMode();
    p._processStartTag(token);
  } else {
    startTagInSelect(p, token);
  }
}
function endTagInSelectInTable(p, token) {
  const tn = token.tagID;
  if (tn === TAG_ID.CAPTION || tn === TAG_ID.TABLE || tn === TAG_ID.TBODY || tn === TAG_ID.TFOOT || tn === TAG_ID.THEAD || tn === TAG_ID.TR || tn === TAG_ID.TD || tn === TAG_ID.TH) {
    if (p.openElements.hasInTableScope(tn)) {
      p.openElements.popUntilTagNamePopped(TAG_ID.SELECT);
      p._resetInsertionMode();
      p.onEndTag(token);
    }
  } else {
    endTagInSelect(p, token);
  }
}
function startTagInTemplate(p, token) {
  switch (token.tagID) {
    case TAG_ID.BASE:
    case TAG_ID.BASEFONT:
    case TAG_ID.BGSOUND:
    case TAG_ID.LINK:
    case TAG_ID.META:
    case TAG_ID.NOFRAMES:
    case TAG_ID.SCRIPT:
    case TAG_ID.STYLE:
    case TAG_ID.TEMPLATE:
    case TAG_ID.TITLE: {
      startTagInHead(p, token);
      break;
    }
    case TAG_ID.CAPTION:
    case TAG_ID.COLGROUP:
    case TAG_ID.TBODY:
    case TAG_ID.TFOOT:
    case TAG_ID.THEAD: {
      p.tmplInsertionModeStack[0] = InsertionMode.IN_TABLE;
      p.insertionMode = InsertionMode.IN_TABLE;
      startTagInTable(p, token);
      break;
    }
    case TAG_ID.COL: {
      p.tmplInsertionModeStack[0] = InsertionMode.IN_COLUMN_GROUP;
      p.insertionMode = InsertionMode.IN_COLUMN_GROUP;
      startTagInColumnGroup(p, token);
      break;
    }
    case TAG_ID.TR: {
      p.tmplInsertionModeStack[0] = InsertionMode.IN_TABLE_BODY;
      p.insertionMode = InsertionMode.IN_TABLE_BODY;
      startTagInTableBody(p, token);
      break;
    }
    case TAG_ID.TD:
    case TAG_ID.TH: {
      p.tmplInsertionModeStack[0] = InsertionMode.IN_ROW;
      p.insertionMode = InsertionMode.IN_ROW;
      startTagInRow(p, token);
      break;
    }
    default: {
      p.tmplInsertionModeStack[0] = InsertionMode.IN_BODY;
      p.insertionMode = InsertionMode.IN_BODY;
      startTagInBody(p, token);
    }
  }
}
function endTagInTemplate(p, token) {
  if (token.tagID === TAG_ID.TEMPLATE) {
    templateEndTagInHead(p, token);
  }
}
function eofInTemplate(p, token) {
  if (p.openElements.tmplCount > 0) {
    p.openElements.popUntilTagNamePopped(TAG_ID.TEMPLATE);
    p.activeFormattingElements.clearToLastMarker();
    p.tmplInsertionModeStack.shift();
    p._resetInsertionMode();
    p.onEof(token);
  } else {
    stopParsing(p, token);
  }
}
function startTagAfterBody(p, token) {
  if (token.tagID === TAG_ID.HTML) {
    startTagInBody(p, token);
  } else {
    tokenAfterBody(p, token);
  }
}
function endTagAfterBody(p, token) {
  var _a;
  if (token.tagID === TAG_ID.HTML) {
    if (!p.fragmentContext) {
      p.insertionMode = InsertionMode.AFTER_AFTER_BODY;
    }
    if (p.options.sourceCodeLocationInfo && p.openElements.tagIDs[0] === TAG_ID.HTML) {
      p._setEndLocation(p.openElements.items[0], token);
      const bodyElement = p.openElements.items[1];
      if (bodyElement && !((_a = p.treeAdapter.getNodeSourceCodeLocation(bodyElement)) === null || _a === undefined ? undefined : _a.endTag)) {
        p._setEndLocation(bodyElement, token);
      }
    }
  } else {
    tokenAfterBody(p, token);
  }
}
function tokenAfterBody(p, token) {
  p.insertionMode = InsertionMode.IN_BODY;
  modeInBody(p, token);
}
function startTagInFrameset(p, token) {
  switch (token.tagID) {
    case TAG_ID.HTML: {
      startTagInBody(p, token);
      break;
    }
    case TAG_ID.FRAMESET: {
      p._insertElement(token, NS.HTML);
      break;
    }
    case TAG_ID.FRAME: {
      p._appendElement(token, NS.HTML);
      token.ackSelfClosing = true;
      break;
    }
    case TAG_ID.NOFRAMES: {
      startTagInHead(p, token);
      break;
    }
    default:
  }
}
function endTagInFrameset(p, token) {
  if (token.tagID === TAG_ID.FRAMESET && !p.openElements.isRootHtmlElementCurrent()) {
    p.openElements.pop();
    if (!p.fragmentContext && p.openElements.currentTagId !== TAG_ID.FRAMESET) {
      p.insertionMode = InsertionMode.AFTER_FRAMESET;
    }
  }
}
function startTagAfterFrameset(p, token) {
  switch (token.tagID) {
    case TAG_ID.HTML: {
      startTagInBody(p, token);
      break;
    }
    case TAG_ID.NOFRAMES: {
      startTagInHead(p, token);
      break;
    }
    default:
  }
}
function endTagAfterFrameset(p, token) {
  if (token.tagID === TAG_ID.HTML) {
    p.insertionMode = InsertionMode.AFTER_AFTER_FRAMESET;
  }
}
function startTagAfterAfterBody(p, token) {
  if (token.tagID === TAG_ID.HTML) {
    startTagInBody(p, token);
  } else {
    tokenAfterAfterBody(p, token);
  }
}
function tokenAfterAfterBody(p, token) {
  p.insertionMode = InsertionMode.IN_BODY;
  modeInBody(p, token);
}
function startTagAfterAfterFrameset(p, token) {
  switch (token.tagID) {
    case TAG_ID.HTML: {
      startTagInBody(p, token);
      break;
    }
    case TAG_ID.NOFRAMES: {
      startTagInHead(p, token);
      break;
    }
    default:
  }
}
function nullCharacterInForeignContent(p, token) {
  token.chars = REPLACEMENT_CHARACTER;
  p._insertCharacters(token);
}
function characterInForeignContent(p, token) {
  p._insertCharacters(token);
  p.framesetOk = false;
}
function popUntilHtmlOrIntegrationPoint(p) {
  while (p.treeAdapter.getNamespaceURI(p.openElements.current) !== NS.HTML && p.openElements.currentTagId !== undefined && !p._isIntegrationPoint(p.openElements.currentTagId, p.openElements.current)) {
    p.openElements.pop();
  }
}
function startTagInForeignContent(p, token) {
  if (causesExit(token)) {
    popUntilHtmlOrIntegrationPoint(p);
    p._startTagOutsideForeignContent(token);
  } else {
    const current = p._getAdjustedCurrentElement();
    const currentNs = p.treeAdapter.getNamespaceURI(current);
    if (currentNs === NS.MATHML) {
      adjustTokenMathMLAttrs(token);
    } else if (currentNs === NS.SVG) {
      adjustTokenSVGTagName(token);
      adjustTokenSVGAttrs(token);
    }
    adjustTokenXMLAttrs(token);
    if (token.selfClosing) {
      p._appendElement(token, currentNs);
    } else {
      p._insertElement(token, currentNs);
    }
    token.ackSelfClosing = true;
  }
}
function endTagInForeignContent(p, token) {
  if (token.tagID === TAG_ID.P || token.tagID === TAG_ID.BR) {
    popUntilHtmlOrIntegrationPoint(p);
    p._endTagOutsideForeignContent(token);
    return;
  }
  for (let i = p.openElements.stackTop;i > 0; i--) {
    const element = p.openElements.items[i];
    if (p.treeAdapter.getNamespaceURI(element) === NS.HTML) {
      p._endTagOutsideForeignContent(token);
      break;
    }
    const tagName = p.treeAdapter.getTagName(element);
    if (tagName.toLowerCase() === token.tagName) {
      token.tagName = tagName;
      p.openElements.shortenToLength(i);
      break;
    }
  }
}
// node_modules/parse5/dist/serializer/index.js
init_escape();
var VOID_ELEMENTS = new Set([
  TAG_NAMES.AREA,
  TAG_NAMES.BASE,
  TAG_NAMES.BASEFONT,
  TAG_NAMES.BGSOUND,
  TAG_NAMES.BR,
  TAG_NAMES.COL,
  TAG_NAMES.EMBED,
  TAG_NAMES.FRAME,
  TAG_NAMES.HR,
  TAG_NAMES.IMG,
  TAG_NAMES.INPUT,
  TAG_NAMES.KEYGEN,
  TAG_NAMES.LINK,
  TAG_NAMES.META,
  TAG_NAMES.PARAM,
  TAG_NAMES.SOURCE,
  TAG_NAMES.TRACK,
  TAG_NAMES.WBR
]);
function isVoidElement(node, options) {
  return options.treeAdapter.isElementNode(node) && options.treeAdapter.getNamespaceURI(node) === NS.HTML && VOID_ELEMENTS.has(options.treeAdapter.getTagName(node));
}
var defaultOpts = { treeAdapter: defaultTreeAdapter, scriptingEnabled: true };
function serialize(node, options) {
  const opts = { ...defaultOpts, ...options };
  if (isVoidElement(node, opts)) {
    return "";
  }
  return serializeChildNodes(node, opts);
}
function serializeChildNodes(parentNode, options) {
  let html = "";
  const container = options.treeAdapter.isElementNode(parentNode) && options.treeAdapter.getTagName(parentNode) === TAG_NAMES.TEMPLATE && options.treeAdapter.getNamespaceURI(parentNode) === NS.HTML ? options.treeAdapter.getTemplateContent(parentNode) : parentNode;
  const childNodes = options.treeAdapter.getChildNodes(container);
  if (childNodes) {
    for (const currentNode of childNodes) {
      html += serializeNode(currentNode, options);
    }
  }
  return html;
}
function serializeNode(node, options) {
  if (options.treeAdapter.isElementNode(node)) {
    return serializeElement(node, options);
  }
  if (options.treeAdapter.isTextNode(node)) {
    return serializeTextNode(node, options);
  }
  if (options.treeAdapter.isCommentNode(node)) {
    return serializeCommentNode(node, options);
  }
  if (options.treeAdapter.isDocumentTypeNode(node)) {
    return serializeDocumentTypeNode(node, options);
  }
  return "";
}
function serializeElement(node, options) {
  const tn = options.treeAdapter.getTagName(node);
  return `<${tn}${serializeAttributes(node, options)}>${isVoidElement(node, options) ? "" : `${serializeChildNodes(node, options)}</${tn}>`}`;
}
function serializeAttributes(node, { treeAdapter }) {
  let html = "";
  for (const attr of treeAdapter.getAttrList(node)) {
    html += " ";
    if (attr.namespace) {
      switch (attr.namespace) {
        case NS.XML: {
          html += `xml:${attr.name}`;
          break;
        }
        case NS.XMLNS: {
          if (attr.name !== "xmlns") {
            html += "xmlns:";
          }
          html += attr.name;
          break;
        }
        case NS.XLINK: {
          html += `xlink:${attr.name}`;
          break;
        }
        default: {
          html += `${attr.prefix}:${attr.name}`;
        }
      }
    } else {
      html += attr.name;
    }
    html += `="${escapeAttribute(attr.value)}"`;
  }
  return html;
}
function serializeTextNode(node, options) {
  const { treeAdapter } = options;
  const content = treeAdapter.getTextNodeContent(node);
  const parent = treeAdapter.getParentNode(node);
  const parentTn = parent && treeAdapter.isElementNode(parent) && treeAdapter.getTagName(parent);
  return parentTn && treeAdapter.getNamespaceURI(parent) === NS.HTML && hasUnescapedText(parentTn, options.scriptingEnabled) ? content : escapeText(content);
}
function serializeCommentNode(node, { treeAdapter }) {
  return `<!--${treeAdapter.getCommentNodeContent(node)}-->`;
}
function serializeDocumentTypeNode(node, { treeAdapter }) {
  return `<!DOCTYPE ${treeAdapter.getDocumentTypeNodeName(node)}>`;
}

// node_modules/parse5/dist/index.js
function parse2(html, options) {
  return Parser2.parse(html, options);
}
function parseFragment(fragmentContext, html, options) {
  if (typeof fragmentContext === "string") {
    options = html;
    html = fragmentContext;
    fragmentContext = null;
  }
  const parser = Parser2.getFragmentParser(fragmentContext, options);
  parser.tokenizer.write(html, true);
  return parser.getFragment();
}

// lib/html/normalize.ts
function normalizeHtmlStructure(input) {
  if (!input)
    return input;
  const isDocument = /^\s*<!doctype\b/i.test(input) || /<(?:html|body)[\s>]/i.test(input);
  return serialize(isDocument ? parse2(input) : parseFragment(input));
}

// lib/html/sanitize.ts
var SANITIZE_HTML_OPTIONS = {
  allowedTags: [
    ...import_sanitize_html.default.defaults.allowedTags,
    "img",
    "picture",
    "source",
    "style",
    "html",
    "head",
    "meta",
    "body",
    "title",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "td",
    "th",
    "caption",
    "colgroup",
    "col",
    "center",
    "font",
    "u",
    "s",
    "strike"
  ],
  allowedAttributes: {
    "*": [
      "id",
      "class",
      "style",
      "title",
      "role",
      "dir",
      "lang",
      "xmlns",
      "xml:lang",
      "align",
      "valign",
      "bgcolor",
      "color",
      "width",
      "height"
    ],
    a: ["href", "name", "target", "rel"],
    source: ["srcset", "media", "type", "data-remote-srcset"],
    img: ["src", "srcset", "referrerpolicy", "data-remote-src", "data-remote-srcset", "alt", "title", "width", "height", "align"],
    table: ["border", "cellspacing", "cellpadding", "summary"],
    td: ["colspan", "rowspan", "headers", "scope"],
    th: ["colspan", "rowspan", "headers", "scope"],
    col: ["span"],
    colgroup: ["span"],
    font: ["face", "size"],
    body: ["bgcolor"],
    meta: ["charset", "name", "content"]
  },
  allowedSchemes: ["http", "https", "mailto", "tel", "cid"],
  allowedSchemesByTag: { img: ["http", "https", "data", "cid"], source: ["http", "https", "data", "cid"] },
  allowedClasses: { "*": [/.*/] },
  allowVulnerableTags: true,
  parser: { lowerCaseTags: true, lowerCaseAttributeNames: true }
};
var BLANK_IMAGE = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
function privateCss(input, inline = false) {
  try {
    const root = postcss_default.parse(inline ? `x{${input}}` : input);
    root.walkComments((comment) => {
      comment.remove();
    });
    root.walkAtRules((rule) => {
      if (!/^(media|supports|layer|container|keyframes|-webkit-keyframes|page|font-face)$/i.test(rule.name))
        rule.remove();
    });
    root.walkDecls((decl) => {
      const value = decl.value;
      if (/\\|(?:image-set|src)\s*\(/i.test(value) || /\\/.test(decl.prop)) {
        decl.remove();
        return;
      }
      const urls = [...value.matchAll(/url\s*\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi)];
      if (urls.some((match) => !isLocalMailResource(match[1] ?? match[2] ?? match[3] ?? "")) || (value.match(/url\s*\(/gi)?.length ?? 0) !== urls.length)
        decl.remove();
    });
    const output = root.toString();
    return inline ? output.slice(2, -1) : output;
  } catch {
    return "";
  }
}
function localSrcset(input) {
  let rest = input.trim();
  while (rest) {
    const token = /^([^\s]+)/.exec(rest)?.[1];
    if (!token)
      return false;
    const url = token.replace(/,+$/, "");
    if (!isLocalMailResource(url))
      return false;
    rest = rest.slice(token.length).trimStart();
    if (!token.endsWith(",")) {
      const comma = rest.indexOf(",");
      if (comma < 0)
        return true;
      rest = rest.slice(comma + 1).trimStart();
    }
  }
  return true;
}
function sanitizeHtmlForDisplay(input, mode = "block") {
  if (!input)
    return input;
  const block = mode === "block";
  const sanitized = import_sanitize_html.default(normalizeHtmlStructure(input), {
    ...SANITIZE_HTML_OPTIONS,
    transformTags: {
      "*": (tagName, original) => {
        const attribs = { ...original };
        delete attribs["http-equiv"];
        if (tagName === "meta" && attribs.name?.trim().toLowerCase() === "referrer") {
          delete attribs.name;
          delete attribs.content;
        }
        if (attribs.style)
          attribs.style = privateCss(attribs.style, true);
        if (tagName === "img")
          attribs.referrerpolicy = "no-referrer";
        if (block && (tagName === "img" || tagName === "source")) {
          if (attribs.src && !isLocalMailResource(attribs.src)) {
            attribs["data-remote-src"] = attribs.src;
            attribs.src = BLANK_IMAGE;
          }
          if (attribs.srcset && !localSrcset(attribs.srcset)) {
            attribs["data-remote-srcset"] = attribs.srcset;
            delete attribs.srcset;
          }
        }
        return { tagName, attribs };
      }
    }
  });
  return sanitized.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_match, open, css, close) => `${open}${privateCss(css)}${close}`);
}

// lib/html/strip.ts
function stripConditionalComments(input) {
  return input.replace(/<!--\s*\[if\s*(?!\s*!)[^\]]+\]\s*>[\s\S]*?<!\s*\[endif\s*\]\s*-->/gi, "").replace(/<!--\s*\[if\s*![^\]]+\]\s*>\s*(?:<!-->|<!--\s*-->|<!---->)?/gi, "").replace(/(?:<!--\s*)?<!\s*\[endif\s*\]\s*-->/gi, "");
}

// lib/html/document.ts
var TRIVIAL_BACKGROUNDS = new Set(["#fff", "#ffffff", "white", "transparent"]);
function isMeaningfulBackground(value) {
  const normalized = value?.replace(/\s*!important\s*$/i, "").trim().toLowerCase() ?? "";
  if (!normalized)
    return false;
  return !TRIVIAL_BACKGROUNDS.has(normalized);
}
function shouldShowHtmlViewerFrame(input) {
  const trimmed = input.trim();
  if (!trimmed)
    return false;
  const headSample = trimmed.slice(0, 8192).replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/\s+/g, " ");
  const bodyTag = /<body\b[^>]*>/i.exec(headSample)?.[0] ?? "";
  const bgColorAttr = /\sbgcolor\s*=\s*["']?([^"'\s>]+)/i.exec(bodyTag)?.[1];
  const bodyStyle = /style\s*=\s*["']([^"']*)["']/i.exec(bodyTag)?.[1] ?? "";
  const bgStyle = [
    ...bodyStyle.matchAll(/background(?:-color)?\s*:\s*([^;"']+)/gi)
  ].at(-1)?.[1];
  if (isMeaningfulBackground(bgColorAttr) || isMeaningfulBackground(bgStyle)) {
    return false;
  }
  if (/<(?:table|td|div|section|article)[^>]*style=["'][^"']*(?:box-shadow\s*:|padding\s*:\s*(?:0\s+)?(?:1[2-9]|[2-9]\d)(?:px|rem|em)|margin\s*:\s*0(?:\s+auto)+)[^"']*["']/i.test(headSample)) {
    return false;
  }
  if (/<table[^>]*\swidth=["']?(?:[4-9]\d{2}|\d{4,})["']?[^>]*>/i.test(headSample) && /<(?:table|td|div)[^>]*(?:align=["']center["']|style=["'][^"']*margin\s*:\s*0(?:\s+auto)+[^"']*["'])/i.test(headSample)) {
    return false;
  }
  return true;
}
// node_modules/use-intl/dist/esm/development/react.js
var import_react3 = __toESM(require_react(), 1);

// node_modules/@formatjs/fast-memoize/index.js
function memoize(fn, options) {
  const cache = options && options.cache ? options.cache : cacheDefault;
  const serializer = options && options.serializer ? options.serializer : serializerDefault;
  return (options && options.strategy ? options.strategy : strategyDefault)(fn, {
    cache,
    serializer
  });
}
function isPrimitive(value) {
  return value == null || typeof value === "number" || typeof value === "boolean";
}
function monadic(fn, cache, serializer, arg) {
  const cacheKey = isPrimitive(arg) ? arg : serializer(arg);
  let computedValue = cache.get(cacheKey);
  if (typeof computedValue === "undefined") {
    computedValue = fn.call(this, arg);
    cache.set(cacheKey, computedValue);
  }
  return computedValue;
}
function variadic(fn, cache, serializer) {
  const args = Array.prototype.slice.call(arguments, 3);
  const cacheKey = serializer(args);
  let computedValue = cache.get(cacheKey);
  if (typeof computedValue === "undefined") {
    computedValue = fn.apply(this, args);
    cache.set(cacheKey, computedValue);
  }
  return computedValue;
}
function assemble(fn, context, strategy, cache, serialize) {
  return strategy.bind(context, fn, cache, serialize);
}
function strategyDefault(fn, options) {
  const strategy = fn.length === 1 ? monadic : variadic;
  return assemble(fn, this, strategy, options.cache.create(), options.serializer);
}
function strategyVariadic(fn, options) {
  return assemble(fn, this, variadic, options.cache.create(), options.serializer);
}
function strategyMonadic(fn, options) {
  return assemble(fn, this, monadic, options.cache.create(), options.serializer);
}
var serializerDefault = function() {
  return JSON.stringify(arguments);
};
var ObjectWithoutPrototypeCache = class {
  constructor() {
    this.cache = Object.create(null);
  }
  get(key) {
    return this.cache[key];
  }
  set(key, value) {
    this.cache[key] = value;
  }
};
var cacheDefault = { create: function create() {
  return new ObjectWithoutPrototypeCache;
} };
var strategies = {
  variadic: strategyVariadic,
  monadic: strategyMonadic
};

// node_modules/use-intl/dist/esm/development/formatters-r4aAmsMP.js
class IntlError extends Error {
  constructor(code, originalMessage) {
    let message = code;
    if (originalMessage) {
      message += ": " + originalMessage;
    }
    super(message);
    this.code = code;
    if (originalMessage) {
      this.originalMessage = originalMessage;
    }
  }
}
var IntlErrorCode = /* @__PURE__ */ function(IntlErrorCode) {
  IntlErrorCode["MISSING_MESSAGE"] = "MISSING_MESSAGE";
  IntlErrorCode["MISSING_FORMAT"] = "MISSING_FORMAT";
  IntlErrorCode["ENVIRONMENT_FALLBACK"] = "ENVIRONMENT_FALLBACK";
  IntlErrorCode["INSUFFICIENT_PATH"] = "INSUFFICIENT_PATH";
  IntlErrorCode["INVALID_MESSAGE"] = "INVALID_MESSAGE";
  IntlErrorCode["INVALID_KEY"] = "INVALID_KEY";
  IntlErrorCode["FORMATTING_ERROR"] = "FORMATTING_ERROR";
  return IntlErrorCode;
}(IntlErrorCode || {});
function createCache() {
  return {
    dateTime: {},
    number: {},
    message: {},
    relativeTime: {},
    pluralRules: {},
    list: {},
    displayNames: {}
  };
}
function createMemoCache(store) {
  return {
    create() {
      return {
        get(key) {
          return store[key];
        },
        set(key, value) {
          store[key] = value;
        }
      };
    }
  };
}
function memoFn(fn, cache) {
  return memoize(fn, {
    cache: createMemoCache(cache),
    strategy: strategies.variadic
  });
}
function memoConstructor(ConstructorFn, cache) {
  return memoFn((...args) => new ConstructorFn(...args), cache);
}
function createIntlFormatters(cache) {
  const getDateTimeFormat = memoConstructor(Intl.DateTimeFormat, cache.dateTime);
  const getNumberFormat = memoConstructor(Intl.NumberFormat, cache.number);
  const getPluralRules = memoConstructor(Intl.PluralRules, cache.pluralRules);
  const getRelativeTimeFormat = memoConstructor(Intl.RelativeTimeFormat, cache.relativeTime);
  const getListFormat = memoConstructor(Intl.ListFormat, cache.list);
  const getDisplayNames = memoConstructor(Intl.DisplayNames, cache.displayNames);
  return {
    getDateTimeFormat,
    getNumberFormat,
    getPluralRules,
    getRelativeTimeFormat,
    getListFormat,
    getDisplayNames
  };
}

// node_modules/use-intl/dist/esm/development/initializeConfig-CUsOI8u2.js
var import_react2 = __toESM(require_react(), 1);

// node_modules/@formatjs/icu-skeleton-parser/index.js
var DATE_TIME_REGEX = /(?:[Eec]{1,6}|G{1,5}|[Qq]{1,5}|(?:[yYur]+|U{1,5})|[ML]{1,5}|d{1,2}|D{1,3}|F{1}|[abB]{1,5}|[hkHK]{1,2}|w{1,2}|W{1}|m{1,2}|s{1,2}|[zZOvVxX]{1,4})(?=([^']*'[^']*')*[^']*$)/g;
function parseDateTimeSkeleton(skeleton) {
  const result = {};
  skeleton.replace(DATE_TIME_REGEX, (match) => {
    const len = match.length;
    switch (match[0]) {
      case "G":
        result.era = len === 4 ? "long" : len === 5 ? "narrow" : "short";
        break;
      case "y":
        result.year = len === 2 ? "2-digit" : "numeric";
        break;
      case "Y":
      case "u":
      case "U":
      case "r":
        throw new RangeError("`Y/u/U/r` (year) patterns are not supported, use `y` instead");
      case "q":
      case "Q":
        throw new RangeError("`q/Q` (quarter) patterns are not supported");
      case "M":
      case "L":
        result.month = [
          "numeric",
          "2-digit",
          "short",
          "long",
          "narrow"
        ][len - 1];
        break;
      case "w":
      case "W":
        throw new RangeError("`w/W` (week) patterns are not supported");
      case "d":
        result.day = ["numeric", "2-digit"][len - 1];
        break;
      case "D":
      case "F":
      case "g":
        throw new RangeError("`D/F/g` (day) patterns are not supported, use `d` instead");
      case "E":
        result.weekday = len === 4 ? "long" : len === 5 ? "narrow" : "short";
        break;
      case "e":
        if (len < 4)
          throw new RangeError("`e..eee` (weekday) patterns are not supported");
        result.weekday = [
          "short",
          "long",
          "narrow",
          "short"
        ][len - 3];
        break;
      case "c":
        if (len < 4)
          throw new RangeError("`c..ccc` (weekday) patterns are not supported");
        result.weekday = [
          "short",
          "long",
          "narrow",
          "short"
        ][len - 3];
        break;
      case "a":
        result.hour12 = true;
        break;
      case "b":
      case "B":
        throw new RangeError("`b/B` (period) patterns are not supported, use `a` instead");
      case "h":
        result.hourCycle = "h12";
        result.hour = ["numeric", "2-digit"][len - 1];
        break;
      case "H":
        result.hourCycle = "h23";
        result.hour = ["numeric", "2-digit"][len - 1];
        break;
      case "K":
        result.hourCycle = "h11";
        result.hour = ["numeric", "2-digit"][len - 1];
        break;
      case "k":
        result.hourCycle = "h24";
        result.hour = ["numeric", "2-digit"][len - 1];
        break;
      case "j":
      case "J":
      case "C":
        throw new RangeError("`j/J/C` (hour) patterns are not supported, use `h/H/K/k` instead");
      case "m":
        result.minute = ["numeric", "2-digit"][len - 1];
        break;
      case "s":
        result.second = ["numeric", "2-digit"][len - 1];
        break;
      case "S":
      case "A":
        throw new RangeError("`S/A` (second) patterns are not supported, use `s` instead");
      case "z":
        result.timeZoneName = len < 4 ? "short" : "long";
        break;
      case "Z":
      case "O":
      case "v":
      case "V":
      case "X":
      case "x":
        throw new RangeError("`Z/O/v/V/X/x` (timeZone) patterns are not supported, use `z` instead");
    }
    return "";
  });
  return result;
}
var WHITE_SPACE_REGEX = /[\t-\r \x85\u200E\u200F\u2028\u2029]/i;
function parseNumberSkeletonFromString(skeleton) {
  if (skeleton.length === 0)
    throw new Error("Number skeleton cannot be empty");
  const stringTokens = skeleton.split(WHITE_SPACE_REGEX).filter((x) => x.length > 0);
  const tokens = [];
  for (const stringToken of stringTokens) {
    let stemAndOptions = stringToken.split("/");
    if (stemAndOptions.length === 0)
      throw new Error("Invalid number skeleton");
    const [stem, ...options] = stemAndOptions;
    for (const option of options)
      if (option.length === 0)
        throw new Error("Invalid number skeleton");
    tokens.push({
      stem,
      options
    });
  }
  return tokens;
}
function icuUnitToEcma(unit) {
  return unit.replace(/^(.*?)-/, "");
}
var FRACTION_PRECISION_REGEX = /^\.(?:(0+)(\*)?|(#+)|(0+)(#+))$/g;
var SIGNIFICANT_PRECISION_REGEX = /^(@+)?(\+|#+)?[rs]?$/g;
var INTEGER_WIDTH_REGEX = /(\*)(0+)|(#+)(0+)|(0+)/g;
var CONCISE_INTEGER_WIDTH_REGEX = /^(0+)$/;
function parseSignificantPrecision(str) {
  const result = {};
  if (str[str.length - 1] === "r")
    result.roundingPriority = "morePrecision";
  else if (str[str.length - 1] === "s")
    result.roundingPriority = "lessPrecision";
  str.replace(SIGNIFICANT_PRECISION_REGEX, function(_, g1, g2) {
    if (typeof g2 !== "string") {
      result.minimumSignificantDigits = g1.length;
      result.maximumSignificantDigits = g1.length;
    } else if (g2 === "+")
      result.minimumSignificantDigits = g1.length;
    else if (g1[0] === "#")
      result.maximumSignificantDigits = g1.length;
    else {
      result.minimumSignificantDigits = g1.length;
      result.maximumSignificantDigits = g1.length + (typeof g2 === "string" ? g2.length : 0);
    }
    return "";
  });
  return result;
}
function parseSign(str) {
  switch (str) {
    case "sign-auto":
      return { signDisplay: "auto" };
    case "sign-accounting":
    case "()":
      return { currencySign: "accounting" };
    case "sign-always":
    case "+!":
      return { signDisplay: "always" };
    case "sign-accounting-always":
    case "()!":
      return {
        signDisplay: "always",
        currencySign: "accounting"
      };
    case "sign-except-zero":
    case "+?":
      return { signDisplay: "exceptZero" };
    case "sign-accounting-except-zero":
    case "()?":
      return {
        signDisplay: "exceptZero",
        currencySign: "accounting"
      };
    case "sign-never":
    case "+_":
      return { signDisplay: "never" };
  }
}
function parseConciseScientificAndEngineeringStem(stem) {
  let result;
  if (stem[0] === "E" && stem[1] === "E") {
    result = { notation: "engineering" };
    stem = stem.slice(2);
  } else if (stem[0] === "E") {
    result = { notation: "scientific" };
    stem = stem.slice(1);
  }
  if (result) {
    const signDisplay = stem.slice(0, 2);
    if (signDisplay === "+!") {
      result.signDisplay = "always";
      stem = stem.slice(2);
    } else if (signDisplay === "+?") {
      result.signDisplay = "exceptZero";
      stem = stem.slice(2);
    }
    if (!CONCISE_INTEGER_WIDTH_REGEX.test(stem))
      throw new Error("Malformed concise eng/scientific notation");
    result.minimumIntegerDigits = stem.length;
  }
  return result;
}
function parseNotationOptions(opt) {
  const result = {};
  const signOpts = parseSign(opt);
  if (signOpts)
    return signOpts;
  return result;
}
function parseNumberSkeleton(tokens) {
  let result = {};
  for (const token of tokens) {
    switch (token.stem) {
      case "percent":
      case "%":
        result.style = "percent";
        continue;
      case "%x100":
        result.style = "percent";
        result.scale = 100;
        continue;
      case "currency":
        result.style = "currency";
        result.currency = token.options[0];
        continue;
      case "group-off":
      case ",_":
        result.useGrouping = false;
        continue;
      case "precision-integer":
      case ".":
        result.maximumFractionDigits = 0;
        continue;
      case "measure-unit":
      case "unit":
        result.style = "unit";
        result.unit = icuUnitToEcma(token.options[0]);
        continue;
      case "compact-short":
      case "K":
        result.notation = "compact";
        result.compactDisplay = "short";
        continue;
      case "compact-long":
      case "KK":
        result.notation = "compact";
        result.compactDisplay = "long";
        continue;
      case "scientific":
        result = {
          ...result,
          notation: "scientific",
          ...token.options.reduce((all, opt) => ({
            ...all,
            ...parseNotationOptions(opt)
          }), {})
        };
        continue;
      case "engineering":
        result = {
          ...result,
          notation: "engineering",
          ...token.options.reduce((all, opt) => ({
            ...all,
            ...parseNotationOptions(opt)
          }), {})
        };
        continue;
      case "notation-simple":
        result.notation = "standard";
        continue;
      case "unit-width-narrow":
        result.currencyDisplay = "narrowSymbol";
        result.unitDisplay = "narrow";
        continue;
      case "unit-width-short":
        result.currencyDisplay = "code";
        result.unitDisplay = "short";
        continue;
      case "unit-width-full-name":
        result.currencyDisplay = "name";
        result.unitDisplay = "long";
        continue;
      case "unit-width-iso-code":
        result.currencyDisplay = "symbol";
        continue;
      case "scale":
        result.scale = parseFloat(token.options[0]);
        continue;
      case "rounding-mode-floor":
        result.roundingMode = "floor";
        continue;
      case "rounding-mode-ceiling":
        result.roundingMode = "ceil";
        continue;
      case "rounding-mode-down":
        result.roundingMode = "trunc";
        continue;
      case "rounding-mode-up":
        result.roundingMode = "expand";
        continue;
      case "rounding-mode-half-even":
        result.roundingMode = "halfEven";
        continue;
      case "rounding-mode-half-down":
        result.roundingMode = "halfTrunc";
        continue;
      case "rounding-mode-half-up":
        result.roundingMode = "halfExpand";
        continue;
      case "integer-width":
        if (token.options.length > 1)
          throw new RangeError("integer-width stems only accept a single optional option");
        token.options[0].replace(INTEGER_WIDTH_REGEX, function(_, g1, g2, g3, g4, g5) {
          if (g1)
            result.minimumIntegerDigits = g2.length;
          else if (g3 && g4)
            throw new Error("We currently do not support maximum integer digits");
          else if (g5)
            throw new Error("We currently do not support exact integer digits");
          return "";
        });
        continue;
    }
    if (CONCISE_INTEGER_WIDTH_REGEX.test(token.stem)) {
      result.minimumIntegerDigits = token.stem.length;
      continue;
    }
    if (FRACTION_PRECISION_REGEX.test(token.stem)) {
      if (token.options.length > 1)
        throw new RangeError("Fraction-precision stems only accept a single optional option");
      token.stem.replace(FRACTION_PRECISION_REGEX, function(_, g1, g2, g3, g4, g5) {
        if (g2 === "*")
          result.minimumFractionDigits = g1.length;
        else if (g3 && g3[0] === "#")
          result.maximumFractionDigits = g3.length;
        else if (g4 && g5) {
          result.minimumFractionDigits = g4.length;
          result.maximumFractionDigits = g4.length + g5.length;
        } else {
          result.minimumFractionDigits = g1.length;
          result.maximumFractionDigits = g1.length;
        }
        return "";
      });
      const opt = token.options[0];
      if (opt === "w")
        result = {
          ...result,
          trailingZeroDisplay: "stripIfInteger"
        };
      else if (opt)
        result = {
          ...result,
          ...parseSignificantPrecision(opt)
        };
      continue;
    }
    if (SIGNIFICANT_PRECISION_REGEX.test(token.stem)) {
      result = {
        ...result,
        ...parseSignificantPrecision(token.stem)
      };
      continue;
    }
    const signOpts = parseSign(token.stem);
    if (signOpts)
      result = {
        ...result,
        ...signOpts
      };
    const conciseScientificAndEngineeringOpts = parseConciseScientificAndEngineeringStem(token.stem);
    if (conciseScientificAndEngineeringOpts)
      result = {
        ...result,
        ...conciseScientificAndEngineeringOpts
      };
  }
  return result;
}

// node_modules/@formatjs/icu-messageformat-parser/index.js
var ErrorKind = /* @__PURE__ */ function(ErrorKind) {
  ErrorKind[ErrorKind["EXPECT_ARGUMENT_CLOSING_BRACE"] = 1] = "EXPECT_ARGUMENT_CLOSING_BRACE";
  ErrorKind[ErrorKind["EMPTY_ARGUMENT"] = 2] = "EMPTY_ARGUMENT";
  ErrorKind[ErrorKind["MALFORMED_ARGUMENT"] = 3] = "MALFORMED_ARGUMENT";
  ErrorKind[ErrorKind["EXPECT_ARGUMENT_TYPE"] = 4] = "EXPECT_ARGUMENT_TYPE";
  ErrorKind[ErrorKind["INVALID_ARGUMENT_TYPE"] = 5] = "INVALID_ARGUMENT_TYPE";
  ErrorKind[ErrorKind["EXPECT_ARGUMENT_STYLE"] = 6] = "EXPECT_ARGUMENT_STYLE";
  ErrorKind[ErrorKind["INVALID_NUMBER_SKELETON"] = 7] = "INVALID_NUMBER_SKELETON";
  ErrorKind[ErrorKind["INVALID_DATE_TIME_SKELETON"] = 8] = "INVALID_DATE_TIME_SKELETON";
  ErrorKind[ErrorKind["EXPECT_NUMBER_SKELETON"] = 9] = "EXPECT_NUMBER_SKELETON";
  ErrorKind[ErrorKind["EXPECT_DATE_TIME_SKELETON"] = 10] = "EXPECT_DATE_TIME_SKELETON";
  ErrorKind[ErrorKind["UNCLOSED_QUOTE_IN_ARGUMENT_STYLE"] = 11] = "UNCLOSED_QUOTE_IN_ARGUMENT_STYLE";
  ErrorKind[ErrorKind["EXPECT_SELECT_ARGUMENT_OPTIONS"] = 12] = "EXPECT_SELECT_ARGUMENT_OPTIONS";
  ErrorKind[ErrorKind["EXPECT_PLURAL_ARGUMENT_OFFSET_VALUE"] = 13] = "EXPECT_PLURAL_ARGUMENT_OFFSET_VALUE";
  ErrorKind[ErrorKind["INVALID_PLURAL_ARGUMENT_OFFSET_VALUE"] = 14] = "INVALID_PLURAL_ARGUMENT_OFFSET_VALUE";
  ErrorKind[ErrorKind["EXPECT_SELECT_ARGUMENT_SELECTOR"] = 15] = "EXPECT_SELECT_ARGUMENT_SELECTOR";
  ErrorKind[ErrorKind["EXPECT_PLURAL_ARGUMENT_SELECTOR"] = 16] = "EXPECT_PLURAL_ARGUMENT_SELECTOR";
  ErrorKind[ErrorKind["EXPECT_SELECT_ARGUMENT_SELECTOR_FRAGMENT"] = 17] = "EXPECT_SELECT_ARGUMENT_SELECTOR_FRAGMENT";
  ErrorKind[ErrorKind["EXPECT_PLURAL_ARGUMENT_SELECTOR_FRAGMENT"] = 18] = "EXPECT_PLURAL_ARGUMENT_SELECTOR_FRAGMENT";
  ErrorKind[ErrorKind["INVALID_PLURAL_ARGUMENT_SELECTOR"] = 19] = "INVALID_PLURAL_ARGUMENT_SELECTOR";
  ErrorKind[ErrorKind["DUPLICATE_PLURAL_ARGUMENT_SELECTOR"] = 20] = "DUPLICATE_PLURAL_ARGUMENT_SELECTOR";
  ErrorKind[ErrorKind["DUPLICATE_SELECT_ARGUMENT_SELECTOR"] = 21] = "DUPLICATE_SELECT_ARGUMENT_SELECTOR";
  ErrorKind[ErrorKind["MISSING_OTHER_CLAUSE"] = 22] = "MISSING_OTHER_CLAUSE";
  ErrorKind[ErrorKind["INVALID_TAG"] = 23] = "INVALID_TAG";
  ErrorKind[ErrorKind["INVALID_TAG_NAME"] = 25] = "INVALID_TAG_NAME";
  ErrorKind[ErrorKind["UNMATCHED_CLOSING_TAG"] = 26] = "UNMATCHED_CLOSING_TAG";
  ErrorKind[ErrorKind["UNCLOSED_TAG"] = 27] = "UNCLOSED_TAG";
  return ErrorKind;
}({});
function isLiteralElement(el) {
  return el.type === 0;
}
function isArgumentElement(el) {
  return el.type === 1;
}
function isNumberElement(el) {
  return el.type === 2;
}
function isDateElement(el) {
  return el.type === 3;
}
function isTimeElement(el) {
  return el.type === 4;
}
function isSelectElement(el) {
  return el.type === 5;
}
function isPluralElement(el) {
  return el.type === 6;
}
function isPoundElement(el) {
  return el.type === 7;
}
function isTagElement(el) {
  return el.type === 8;
}
function isNumberSkeleton(el) {
  return !!(el && typeof el === "object" && el.type === 0);
}
function isDateTimeSkeleton(el) {
  return !!(el && typeof el === "object" && el.type === 1);
}
var SPACE_SEPARATOR_REGEX = /[ \xA0\u1680\u2000-\u200A\u202F\u205F\u3000]/;
var timeData = {
  "001": ["H", "h"],
  "419": [
    "h",
    "H",
    "hB",
    "hb"
  ],
  AC: [
    "H",
    "h",
    "hb",
    "hB"
  ],
  AD: ["H", "hB"],
  AE: [
    "h",
    "hB",
    "hb",
    "H"
  ],
  AF: [
    "H",
    "hb",
    "hB",
    "h"
  ],
  AG: [
    "h",
    "hb",
    "H",
    "hB"
  ],
  AI: [
    "H",
    "h",
    "hb",
    "hB"
  ],
  AL: [
    "h",
    "H",
    "hB"
  ],
  AM: ["H", "hB"],
  AO: ["H", "hB"],
  AR: [
    "h",
    "H",
    "hB",
    "hb"
  ],
  AS: ["h", "H"],
  AT: ["H", "hB"],
  AU: [
    "h",
    "hb",
    "H",
    "hB"
  ],
  AW: ["H", "hB"],
  AX: ["H"],
  AZ: [
    "H",
    "hB",
    "h"
  ],
  BA: [
    "H",
    "hB",
    "h"
  ],
  BB: [
    "h",
    "hb",
    "H",
    "hB"
  ],
  BD: [
    "h",
    "hB",
    "H"
  ],
  BE: ["H", "hB"],
  BF: ["H", "hB"],
  BG: [
    "H",
    "hB",
    "h"
  ],
  BH: [
    "h",
    "hB",
    "hb",
    "H"
  ],
  BI: ["H", "h"],
  BJ: ["H", "hB"],
  BL: ["H", "hB"],
  BM: [
    "h",
    "hb",
    "H",
    "hB"
  ],
  BN: [
    "hb",
    "hB",
    "h",
    "H"
  ],
  BO: [
    "h",
    "H",
    "hB",
    "hb"
  ],
  BQ: ["H"],
  BR: ["H", "hB"],
  BS: [
    "h",
    "hb",
    "H",
    "hB"
  ],
  BT: ["h", "H"],
  BW: [
    "H",
    "h",
    "hb",
    "hB"
  ],
  BY: ["H", "h"],
  BZ: [
    "H",
    "h",
    "hb",
    "hB"
  ],
  CA: [
    "h",
    "hb",
    "H",
    "hB"
  ],
  CC: [
    "H",
    "h",
    "hb",
    "hB"
  ],
  CD: ["hB", "H"],
  CF: [
    "H",
    "h",
    "hB"
  ],
  CG: ["H", "hB"],
  CH: [
    "H",
    "hB",
    "h"
  ],
  CI: ["H", "hB"],
  CK: [
    "H",
    "h",
    "hb",
    "hB"
  ],
  CL: [
    "h",
    "H",
    "hB",
    "hb"
  ],
  CM: [
    "H",
    "h",
    "hB"
  ],
  CN: [
    "H",
    "hB",
    "hb",
    "h"
  ],
  CO: [
    "h",
    "H",
    "hB",
    "hb"
  ],
  CP: ["H"],
  CR: [
    "h",
    "H",
    "hB",
    "hb"
  ],
  CU: [
    "h",
    "H",
    "hB",
    "hb"
  ],
  CV: ["H", "hB"],
  CW: ["H", "hB"],
  CX: [
    "H",
    "h",
    "hb",
    "hB"
  ],
  CY: [
    "h",
    "H",
    "hb",
    "hB"
  ],
  CZ: ["H"],
  DE: ["H", "hB"],
  DG: [
    "H",
    "h",
    "hb",
    "hB"
  ],
  DJ: ["h", "H"],
  DK: ["H"],
  DM: [
    "h",
    "hb",
    "H",
    "hB"
  ],
  DO: [
    "h",
    "H",
    "hB",
    "hb"
  ],
  DZ: [
    "h",
    "hB",
    "hb",
    "H"
  ],
  EA: [
    "H",
    "h",
    "hB",
    "hb"
  ],
  EC: [
    "h",
    "H",
    "hB",
    "hb"
  ],
  EE: ["H", "hB"],
  EG: [
    "h",
    "hB",
    "hb",
    "H"
  ],
  EH: [
    "h",
    "hB",
    "hb",
    "H"
  ],
  ER: ["h", "H"],
  ES: [
    "H",
    "hB",
    "h",
    "hb"
  ],
  ET: [
    "hB",
    "hb",
    "h",
    "H"
  ],
  FI: ["H"],
  FJ: [
    "h",
    "hb",
    "H",
    "hB"
  ],
  FK: [
    "H",
    "h",
    "hb",
    "hB"
  ],
  FM: [
    "h",
    "hb",
    "H",
    "hB"
  ],
  FO: ["H", "h"],
  FR: ["H", "hB"],
  GA: ["H", "hB"],
  GB: [
    "H",
    "h",
    "hb",
    "hB"
  ],
  GD: [
    "h",
    "hb",
    "H",
    "hB"
  ],
  GE: [
    "H",
    "hB",
    "h"
  ],
  GF: ["H", "hB"],
  GG: [
    "H",
    "h",
    "hb",
    "hB"
  ],
  GH: ["h", "H"],
  GI: [
    "H",
    "h",
    "hb",
    "hB"
  ],
  GL: ["H", "h"],
  GM: [
    "h",
    "hb",
    "H",
    "hB"
  ],
  GN: ["H", "hB"],
  GP: ["H", "hB"],
  GQ: [
    "H",
    "hB",
    "h",
    "hb"
  ],
  GR: [
    "h",
    "H",
    "hb",
    "hB"
  ],
  GS: [
    "H",
    "h",
    "hb",
    "hB"
  ],
  GT: [
    "h",
    "H",
    "hB",
    "hb"
  ],
  GU: [
    "h",
    "hb",
    "H",
    "hB"
  ],
  GW: ["H", "hB"],
  GY: [
    "h",
    "hb",
    "H",
    "hB"
  ],
  HK: [
    "h",
    "hB",
    "hb",
    "H"
  ],
  HN: [
    "h",
    "H",
    "hB",
    "hb"
  ],
  HR: ["H", "hB"],
  HU: ["H", "h"],
  IC: [
    "H",
    "h",
    "hB",
    "hb"
  ],
  ID: ["H"],
  IE: [
    "H",
    "h",
    "hb",
    "hB"
  ],
  IL: ["H", "hB"],
  IM: [
    "H",
    "h",
    "hb",
    "hB"
  ],
  IN: ["h", "H"],
  IO: [
    "H",
    "h",
    "hb",
    "hB"
  ],
  IQ: [
    "h",
    "hB",
    "hb",
    "H"
  ],
  IR: ["hB", "H"],
  IS: ["H"],
  IT: ["H", "hB"],
  JE: [
    "H",
    "h",
    "hb",
    "hB"
  ],
  JM: [
    "h",
    "hb",
    "H",
    "hB"
  ],
  JO: [
    "h",
    "hB",
    "hb",
    "H"
  ],
  JP: [
    "H",
    "K",
    "h"
  ],
  KE: [
    "hB",
    "hb",
    "H",
    "h"
  ],
  KG: [
    "H",
    "h",
    "hB",
    "hb"
  ],
  KH: [
    "hB",
    "h",
    "H",
    "hb"
  ],
  KI: [
    "h",
    "hb",
    "H",
    "hB"
  ],
  KM: [
    "H",
    "h",
    "hB",
    "hb"
  ],
  KN: [
    "h",
    "hb",
    "H",
    "hB"
  ],
  KP: [
    "h",
    "H",
    "hB",
    "hb"
  ],
  KR: [
    "h",
    "H",
    "hB",
    "hb"
  ],
  KW: [
    "h",
    "hB",
    "hb",
    "H"
  ],
  KY: [
    "h",
    "hb",
    "H",
    "hB"
  ],
  KZ: ["H", "hB"],
  LA: [
    "H",
    "hb",
    "hB",
    "h"
  ],
  LB: [
    "h",
    "hB",
    "hb",
    "H"
  ],
  LC: [
    "h",
    "hb",
    "H",
    "hB"
  ],
  LI: [
    "H",
    "hB",
    "h"
  ],
  LK: [
    "H",
    "h",
    "hB",
    "hb"
  ],
  LR: [
    "h",
    "hb",
    "H",
    "hB"
  ],
  LS: ["h", "H"],
  LT: [
    "H",
    "h",
    "hb",
    "hB"
  ],
  LU: [
    "H",
    "h",
    "hB"
  ],
  LV: [
    "H",
    "hB",
    "hb",
    "h"
  ],
  LY: [
    "h",
    "hB",
    "hb",
    "H"
  ],
  MA: [
    "H",
    "h",
    "hB",
    "hb"
  ],
  MC: ["H", "hB"],
  MD: ["H", "hB"],
  ME: [
    "H",
    "hB",
    "h"
  ],
  MF: ["H", "hB"],
  MG: ["H", "h"],
  MH: [
    "h",
    "hb",
    "H",
    "hB"
  ],
  MK: [
    "H",
    "h",
    "hb",
    "hB"
  ],
  ML: ["H"],
  MM: [
    "hB",
    "hb",
    "H",
    "h"
  ],
  MN: [
    "H",
    "h",
    "hb",
    "hB"
  ],
  MO: [
    "h",
    "hB",
    "hb",
    "H"
  ],
  MP: [
    "h",
    "hb",
    "H",
    "hB"
  ],
  MQ: ["H", "hB"],
  MR: [
    "h",
    "hB",
    "hb",
    "H"
  ],
  MS: [
    "H",
    "h",
    "hb",
    "hB"
  ],
  MT: ["H", "h"],
  MU: ["H", "h"],
  MV: ["H", "h"],
  MW: [
    "h",
    "hb",
    "H",
    "hB"
  ],
  MX: [
    "h",
    "H",
    "hB",
    "hb"
  ],
  MY: [
    "hb",
    "hB",
    "h",
    "H"
  ],
  MZ: ["H", "hB"],
  NA: [
    "h",
    "H",
    "hB",
    "hb"
  ],
  NC: ["H", "hB"],
  NE: ["H"],
  NF: [
    "H",
    "h",
    "hb",
    "hB"
  ],
  NG: [
    "H",
    "h",
    "hb",
    "hB"
  ],
  NI: [
    "h",
    "H",
    "hB",
    "hb"
  ],
  NL: ["H", "hB"],
  NO: ["H", "h"],
  NP: [
    "H",
    "h",
    "hB"
  ],
  NR: [
    "H",
    "h",
    "hb",
    "hB"
  ],
  NU: [
    "H",
    "h",
    "hb",
    "hB"
  ],
  NZ: [
    "h",
    "hb",
    "H",
    "hB"
  ],
  OM: [
    "h",
    "hB",
    "hb",
    "H"
  ],
  PA: [
    "h",
    "H",
    "hB",
    "hb"
  ],
  PE: [
    "h",
    "H",
    "hB",
    "hb"
  ],
  PF: [
    "H",
    "h",
    "hB"
  ],
  PG: ["h", "H"],
  PH: [
    "h",
    "hB",
    "hb",
    "H"
  ],
  PK: [
    "h",
    "hB",
    "H"
  ],
  PL: ["H", "h"],
  PM: ["H", "hB"],
  PN: [
    "H",
    "h",
    "hb",
    "hB"
  ],
  PR: [
    "h",
    "H",
    "hB",
    "hb"
  ],
  PS: [
    "h",
    "hB",
    "hb",
    "H"
  ],
  PT: ["H", "hB"],
  PW: ["h", "H"],
  PY: [
    "h",
    "H",
    "hB",
    "hb"
  ],
  QA: [
    "h",
    "hB",
    "hb",
    "H"
  ],
  RE: ["H", "hB"],
  RO: ["H", "hB"],
  RS: [
    "H",
    "hB",
    "h"
  ],
  RU: ["H"],
  RW: ["H", "h"],
  SA: [
    "h",
    "hB",
    "hb",
    "H"
  ],
  SB: [
    "h",
    "hb",
    "H",
    "hB"
  ],
  SC: [
    "H",
    "h",
    "hB"
  ],
  SD: [
    "h",
    "hB",
    "hb",
    "H"
  ],
  SE: ["H"],
  SG: [
    "h",
    "hb",
    "H",
    "hB"
  ],
  SH: [
    "H",
    "h",
    "hb",
    "hB"
  ],
  SI: ["H", "hB"],
  SJ: ["H"],
  SK: ["H"],
  SL: [
    "h",
    "hb",
    "H",
    "hB"
  ],
  SM: [
    "H",
    "h",
    "hB"
  ],
  SN: [
    "H",
    "h",
    "hB"
  ],
  SO: ["h", "H"],
  SR: ["H", "hB"],
  SS: [
    "h",
    "hb",
    "H",
    "hB"
  ],
  ST: ["H", "hB"],
  SV: [
    "h",
    "H",
    "hB",
    "hb"
  ],
  SX: [
    "H",
    "h",
    "hb",
    "hB"
  ],
  SY: [
    "h",
    "hB",
    "hb",
    "H"
  ],
  SZ: [
    "h",
    "hb",
    "H",
    "hB"
  ],
  TA: [
    "H",
    "h",
    "hb",
    "hB"
  ],
  TC: [
    "h",
    "hb",
    "H",
    "hB"
  ],
  TD: [
    "h",
    "H",
    "hB"
  ],
  TF: [
    "H",
    "h",
    "hB"
  ],
  TG: ["H", "hB"],
  TH: ["H", "h"],
  TJ: ["H", "h"],
  TL: [
    "H",
    "hB",
    "hb",
    "h"
  ],
  TM: ["H", "h"],
  TN: [
    "h",
    "hB",
    "hb",
    "H"
  ],
  TO: ["h", "H"],
  TR: ["H", "hB"],
  TT: [
    "h",
    "hb",
    "H",
    "hB"
  ],
  TW: [
    "hB",
    "hb",
    "h",
    "H"
  ],
  TZ: [
    "hB",
    "hb",
    "H",
    "h"
  ],
  UA: [
    "H",
    "hB",
    "h"
  ],
  UG: [
    "hB",
    "hb",
    "H",
    "h"
  ],
  UM: [
    "h",
    "hb",
    "H",
    "hB"
  ],
  US: [
    "h",
    "hb",
    "H",
    "hB"
  ],
  UY: [
    "h",
    "H",
    "hB",
    "hb"
  ],
  UZ: [
    "H",
    "hB",
    "h"
  ],
  VA: [
    "H",
    "h",
    "hB"
  ],
  VC: [
    "h",
    "hb",
    "H",
    "hB"
  ],
  VE: [
    "h",
    "H",
    "hB",
    "hb"
  ],
  VG: [
    "h",
    "hb",
    "H",
    "hB"
  ],
  VI: [
    "h",
    "hb",
    "H",
    "hB"
  ],
  VN: ["H", "h"],
  VU: ["h", "H"],
  WF: ["H", "hB"],
  WS: ["h", "H"],
  XK: [
    "H",
    "hB",
    "h"
  ],
  YE: [
    "h",
    "hB",
    "hb",
    "H"
  ],
  YT: ["H", "hB"],
  ZA: [
    "H",
    "h",
    "hb",
    "hB"
  ],
  ZM: [
    "h",
    "hb",
    "H",
    "hB"
  ],
  ZW: ["H", "h"],
  "af-ZA": [
    "H",
    "h",
    "hB",
    "hb"
  ],
  "ar-001": [
    "h",
    "hB",
    "hb",
    "H"
  ],
  "ca-ES": [
    "H",
    "h",
    "hB"
  ],
  "en-001": [
    "h",
    "hb",
    "H",
    "hB"
  ],
  "en-HK": [
    "h",
    "hb",
    "H",
    "hB"
  ],
  "en-IL": [
    "H",
    "h",
    "hb",
    "hB"
  ],
  "en-MY": [
    "h",
    "hb",
    "H",
    "hB"
  ],
  "es-BR": [
    "H",
    "h",
    "hB",
    "hb"
  ],
  "es-ES": [
    "H",
    "h",
    "hB",
    "hb"
  ],
  "es-GQ": [
    "H",
    "h",
    "hB",
    "hb"
  ],
  "fr-CA": [
    "H",
    "h",
    "hB"
  ],
  "gl-ES": [
    "H",
    "h",
    "hB"
  ],
  "gu-IN": [
    "hB",
    "hb",
    "h",
    "H"
  ],
  "hi-IN": [
    "hB",
    "h",
    "H"
  ],
  "it-CH": [
    "H",
    "h",
    "hB"
  ],
  "it-IT": [
    "H",
    "h",
    "hB"
  ],
  "kn-IN": [
    "hB",
    "h",
    "H"
  ],
  "ku-SY": ["H", "hB"],
  "ml-IN": [
    "hB",
    "h",
    "H"
  ],
  "mr-IN": [
    "hB",
    "hb",
    "h",
    "H"
  ],
  "pa-IN": [
    "hB",
    "hb",
    "h",
    "H"
  ],
  "ta-IN": [
    "hB",
    "h",
    "hb",
    "H"
  ],
  "te-IN": [
    "hB",
    "h",
    "H"
  ],
  "zu-ZA": [
    "H",
    "hB",
    "hb",
    "h"
  ]
};
function getBestPattern(skeleton, locale) {
  let skeletonCopy = "";
  for (let patternPos = 0;patternPos < skeleton.length; patternPos++) {
    const patternChar = skeleton.charAt(patternPos);
    if (patternChar === "j") {
      let extraLength = 0;
      while (patternPos + 1 < skeleton.length && skeleton.charAt(patternPos + 1) === patternChar) {
        extraLength++;
        patternPos++;
      }
      let hourLen = 1 + (extraLength & 1);
      let dayPeriodLen = extraLength < 2 ? 1 : 3 + (extraLength >> 1);
      let dayPeriodChar = "a";
      let hourChar = getDefaultHourSymbolFromLocale(locale);
      if (hourChar == "H" || hourChar == "k")
        dayPeriodLen = 0;
      while (dayPeriodLen-- > 0)
        skeletonCopy += dayPeriodChar;
      while (hourLen-- > 0)
        skeletonCopy = hourChar + skeletonCopy;
    } else if (patternChar === "J")
      skeletonCopy += "H";
    else
      skeletonCopy += patternChar;
  }
  return skeletonCopy;
}
function getDefaultHourSymbolFromLocale(locale) {
  let hourCycle = locale.hourCycle;
  if (hourCycle === undefined) {
    const localeWithHourCycles = locale;
    hourCycle = localeWithHourCycles.getHourCycles?.()[0] ?? localeWithHourCycles.hourCycles?.[0];
  }
  if (hourCycle)
    switch (hourCycle) {
      case "h24":
        return "k";
      case "h23":
        return "H";
      case "h12":
        return "h";
      case "h11":
        return "K";
      default:
        throw new Error("Invalid hourCycle");
    }
  const languageTag = locale.language;
  let regionTag;
  if (languageTag !== "root")
    regionTag = locale.maximize().region;
  return (timeData[`${languageTag}-${regionTag}`] || timeData[regionTag || ""] || timeData[languageTag || ""] || timeData[`${languageTag}-001`] || timeData["001"])[0].charAt(0);
}
var SPACE_SEPARATOR_START_REGEX = new RegExp(`^${SPACE_SEPARATOR_REGEX.source}*`);
var SPACE_SEPARATOR_END_REGEX = new RegExp(`${SPACE_SEPARATOR_REGEX.source}*$`);
function createLocation(start, end) {
  return {
    start,
    end
  };
}
var hasNativeFromEntries = !!Object.fromEntries;
var hasTrimStart = !!String.prototype.trimStart;
var hasTrimEnd = !!String.prototype.trimEnd;
var fromEntries = hasNativeFromEntries ? Object.fromEntries : function fromEntries(entries) {
  const obj = {};
  for (const [k, v] of entries)
    obj[k] = v;
  return obj;
};
var trimStart = hasTrimStart ? function trimStart(s) {
  return s.trimStart();
} : function trimStart(s) {
  return s.replace(SPACE_SEPARATOR_START_REGEX, "");
};
var trimEnd = hasTrimEnd ? function trimEnd(s) {
  return s.trimEnd();
} : function trimEnd(s) {
  return s.replace(SPACE_SEPARATOR_END_REGEX, "");
};
var IDENTIFIER_PREFIX_RE = new RegExp("([^\\p{White_Space}\\p{Pattern_Syntax}]*)", "yu");
function matchIdentifierAtIndex(s, index) {
  IDENTIFIER_PREFIX_RE.lastIndex = index;
  return IDENTIFIER_PREFIX_RE.exec(s)[1] ?? "";
}
function plainTopLevelEndPosition(message) {
  if (message.length === 0)
    return null;
  let line = 1;
  let column = 1;
  for (let offset = 0;offset < message.length; ) {
    const code = message.charCodeAt(offset);
    switch (code) {
      case 35:
      case 39:
      case 60:
      case 123:
      case 125:
        return null;
    }
    if (code === 10) {
      line++;
      column = 1;
      offset++;
    } else {
      column++;
      if (code >= 55296 && code <= 56319 && offset + 1 < message.length) {
        const next = message.charCodeAt(offset + 1);
        offset += next >= 56320 && next <= 57343 ? 2 : 1;
      } else
        offset++;
    }
  }
  return {
    offset: message.length,
    line,
    column
  };
}
var Parser3 = class {
  constructor(message, options = {}) {
    this.message = message;
    this.position = {
      offset: 0,
      line: 1,
      column: 1
    };
    this.ignoreTag = !!options.ignoreTag;
    this.locale = options.locale;
    this.requiresOtherClause = !!options.requiresOtherClause;
    this.shouldParseSkeletons = !!options.shouldParseSkeletons;
  }
  parse() {
    if (this.offset() !== 0)
      throw Error("parser can only be used once");
    if (this.message.length > 0) {
      const firstCode = this.message.charCodeAt(0);
      if (firstCode !== 35 && firstCode !== 39 && firstCode !== 60 && firstCode !== 123 && firstCode !== 125) {
        const plainEndPosition = plainTopLevelEndPosition(this.message);
        if (plainEndPosition) {
          const start = this.clonePosition();
          this.position = plainEndPosition;
          return {
            val: [{
              type: 0,
              value: this.message,
              location: createLocation(start, this.clonePosition())
            }],
            err: null
          };
        }
      }
    }
    return this.parseMessage(0, "", false);
  }
  parseMessage(nestingLevel, parentArgType, expectingCloseTag) {
    let elements = [];
    while (!this.isEOF()) {
      const char = this.char();
      if (char === 123) {
        const result = this.parseArgument(nestingLevel, expectingCloseTag);
        if (result.err)
          return result;
        elements.push(result.val);
      } else if (char === 125 && nestingLevel > 0)
        break;
      else if (char === 35 && (parentArgType === "plural" || parentArgType === "selectordinal")) {
        const position = this.clonePosition();
        this.bump();
        elements.push({
          type: 7,
          location: createLocation(position, this.clonePosition())
        });
      } else if (char === 60 && !this.ignoreTag && this.peek() === 47) {
        if (expectingCloseTag)
          break;
        else
          return this.error(26, createLocation(this.clonePosition(), this.clonePosition()));
      } else if (char === 60 && !this.ignoreTag && _isAlpha(this.peek() || 0)) {
        const result = this.parseTag(nestingLevel, parentArgType);
        if (result.err)
          return result;
        elements.push(result.val);
      } else {
        const result = this.parseLiteral(nestingLevel, parentArgType);
        if (result.err)
          return result;
        elements.push(result.val);
      }
    }
    return {
      val: elements,
      err: null
    };
  }
  parseTag(nestingLevel, parentArgType) {
    const startPosition = this.clonePosition();
    this.bump();
    const tagName = this.parseTagName();
    this.bumpSpace();
    if (this.bumpIf("/>"))
      return {
        val: {
          type: 0,
          value: `<${tagName}/>`,
          location: createLocation(startPosition, this.clonePosition())
        },
        err: null
      };
    else if (this.bumpIf(">")) {
      const childrenResult = this.parseMessage(nestingLevel + 1, parentArgType, true);
      if (childrenResult.err)
        return childrenResult;
      const children = childrenResult.val;
      const endTagStartPosition = this.clonePosition();
      if (this.bumpIf("</")) {
        if (this.isEOF() || !_isAlpha(this.char()))
          return this.error(23, createLocation(endTagStartPosition, this.clonePosition()));
        const closingTagNameStartPosition = this.clonePosition();
        if (tagName !== this.parseTagName())
          return this.error(26, createLocation(closingTagNameStartPosition, this.clonePosition()));
        this.bumpSpace();
        if (!this.bumpIf(">"))
          return this.error(23, createLocation(endTagStartPosition, this.clonePosition()));
        return {
          val: {
            type: 8,
            value: tagName,
            children,
            location: createLocation(startPosition, this.clonePosition())
          },
          err: null
        };
      } else
        return this.error(27, createLocation(startPosition, this.clonePosition()));
    } else
      return this.error(23, createLocation(startPosition, this.clonePosition()));
  }
  parseTagName() {
    const startOffset = this.offset();
    this.bump();
    while (!this.isEOF() && _isPotentialElementNameChar(this.char()))
      this.bump();
    return this.message.slice(startOffset, this.offset());
  }
  parseLiteral(nestingLevel, parentArgType) {
    const start = this.clonePosition();
    let value = "";
    while (true) {
      const parseQuoteResult = this.tryParseQuote(parentArgType);
      if (parseQuoteResult) {
        value += parseQuoteResult;
        continue;
      }
      const parseUnquotedResult = this.tryParseUnquoted(nestingLevel, parentArgType);
      if (parseUnquotedResult) {
        value += parseUnquotedResult;
        continue;
      }
      const parseLeftAngleResult = this.tryParseLeftAngleBracket();
      if (parseLeftAngleResult) {
        value += parseLeftAngleResult;
        continue;
      }
      break;
    }
    const location = createLocation(start, this.clonePosition());
    return {
      val: {
        type: 0,
        value,
        location
      },
      err: null
    };
  }
  tryParseLeftAngleBracket() {
    if (!this.isEOF() && this.char() === 60 && (this.ignoreTag || !_isAlphaOrSlash(this.peek() || 0))) {
      this.bump();
      return "<";
    }
    return null;
  }
  tryParseQuote(parentArgType) {
    if (this.isEOF() || this.char() !== 39)
      return null;
    switch (this.peek()) {
      case 39:
        this.bump();
        this.bump();
        return "'";
      case 123:
      case 60:
      case 62:
      case 125:
        break;
      case 35:
        if (parentArgType === "plural" || parentArgType === "selectordinal")
          break;
        return null;
      default:
        return null;
    }
    this.bump();
    const codePoints = [this.char()];
    this.bump();
    while (!this.isEOF()) {
      const ch = this.char();
      if (ch === 39) {
        if (this.peek() === 39) {
          codePoints.push(39);
          this.bump();
        } else {
          this.bump();
          break;
        }
      } else
        codePoints.push(ch);
      this.bump();
    }
    return String.fromCodePoint(...codePoints);
  }
  tryParseUnquoted(nestingLevel, parentArgType) {
    if (this.isEOF())
      return null;
    const ch = this.char();
    if (ch === 60 || ch === 123 || ch === 35 && (parentArgType === "plural" || parentArgType === "selectordinal") || ch === 125 && nestingLevel > 0)
      return null;
    else {
      this.bump();
      return String.fromCodePoint(ch);
    }
  }
  parseArgument(nestingLevel, expectingCloseTag) {
    const openingBracePosition = this.clonePosition();
    this.bump();
    this.bumpSpace();
    if (this.isEOF())
      return this.error(1, createLocation(openingBracePosition, this.clonePosition()));
    if (this.char() === 125) {
      this.bump();
      return this.error(2, createLocation(openingBracePosition, this.clonePosition()));
    }
    let value = this.parseIdentifierIfPossible().value;
    if (!value)
      return this.error(3, createLocation(openingBracePosition, this.clonePosition()));
    this.bumpSpace();
    if (this.isEOF())
      return this.error(1, createLocation(openingBracePosition, this.clonePosition()));
    switch (this.char()) {
      case 125:
        this.bump();
        return {
          val: {
            type: 1,
            value,
            location: createLocation(openingBracePosition, this.clonePosition())
          },
          err: null
        };
      case 44:
        this.bump();
        this.bumpSpace();
        if (this.isEOF())
          return this.error(1, createLocation(openingBracePosition, this.clonePosition()));
        return this.parseArgumentOptions(nestingLevel, expectingCloseTag, value, openingBracePosition);
      default:
        return this.error(3, createLocation(openingBracePosition, this.clonePosition()));
    }
  }
  parseIdentifierIfPossible() {
    const startingPosition = this.clonePosition();
    const startOffset = this.offset();
    const value = matchIdentifierAtIndex(this.message, startOffset);
    const endOffset = startOffset + value.length;
    this.bumpTo(endOffset);
    return {
      value,
      location: createLocation(startingPosition, this.clonePosition())
    };
  }
  parseArgumentOptions(nestingLevel, expectingCloseTag, value, openingBracePosition) {
    let typeStartPosition = this.clonePosition();
    let argType = this.parseIdentifierIfPossible().value;
    let typeEndPosition = this.clonePosition();
    switch (argType) {
      case "":
        return this.error(4, createLocation(typeStartPosition, typeEndPosition));
      case "number":
      case "date":
      case "time": {
        this.bumpSpace();
        let styleAndLocation = null;
        if (this.bumpIf(",")) {
          this.bumpSpace();
          const styleStartPosition = this.clonePosition();
          const result = this.parseSimpleArgStyleIfPossible();
          if (result.err)
            return result;
          const style = trimEnd(result.val);
          if (style.length === 0)
            return this.error(6, createLocation(this.clonePosition(), this.clonePosition()));
          styleAndLocation = {
            style,
            styleLocation: createLocation(styleStartPosition, this.clonePosition())
          };
        }
        const argCloseResult = this.tryParseArgumentClose(openingBracePosition);
        if (argCloseResult.err)
          return argCloseResult;
        const location = createLocation(openingBracePosition, this.clonePosition());
        if (styleAndLocation && styleAndLocation.style.startsWith("::")) {
          let skeleton = trimStart(styleAndLocation.style.slice(2));
          if (argType === "number") {
            const result = this.parseNumberSkeletonFromString(skeleton, styleAndLocation.styleLocation);
            if (result.err)
              return result;
            return {
              val: {
                type: 2,
                value,
                location,
                style: result.val
              },
              err: null
            };
          } else {
            if (skeleton.length === 0)
              return this.error(10, location);
            let dateTimePattern = skeleton;
            if (this.locale)
              dateTimePattern = getBestPattern(skeleton, this.locale);
            const style = {
              type: 1,
              pattern: dateTimePattern,
              location: styleAndLocation.styleLocation,
              parsedOptions: this.shouldParseSkeletons ? parseDateTimeSkeleton(dateTimePattern) : {}
            };
            return {
              val: {
                type: argType === "date" ? 3 : 4,
                value,
                location,
                style
              },
              err: null
            };
          }
        }
        return {
          val: {
            type: argType === "number" ? 2 : argType === "date" ? 3 : 4,
            value,
            location,
            style: styleAndLocation?.style ?? null
          },
          err: null
        };
      }
      case "plural":
      case "selectordinal":
      case "select": {
        const typeEndPosition = this.clonePosition();
        this.bumpSpace();
        if (!this.bumpIf(","))
          return this.error(12, createLocation(typeEndPosition, { ...typeEndPosition }));
        this.bumpSpace();
        let identifierAndLocation = this.parseIdentifierIfPossible();
        let pluralOffset = 0;
        if (argType !== "select" && identifierAndLocation.value === "offset") {
          if (!this.bumpIf(":"))
            return this.error(13, createLocation(this.clonePosition(), this.clonePosition()));
          this.bumpSpace();
          const result = this.tryParseDecimalInteger(13, 14);
          if (result.err)
            return result;
          this.bumpSpace();
          identifierAndLocation = this.parseIdentifierIfPossible();
          pluralOffset = result.val;
        }
        const optionsResult = this.tryParsePluralOrSelectOptions(nestingLevel, argType, expectingCloseTag, identifierAndLocation);
        if (optionsResult.err)
          return optionsResult;
        const argCloseResult = this.tryParseArgumentClose(openingBracePosition);
        if (argCloseResult.err)
          return argCloseResult;
        const location = createLocation(openingBracePosition, this.clonePosition());
        if (argType === "select")
          return {
            val: {
              type: 5,
              value,
              options: fromEntries(optionsResult.val),
              location
            },
            err: null
          };
        else
          return {
            val: {
              type: 6,
              value,
              options: fromEntries(optionsResult.val),
              offset: pluralOffset,
              pluralType: argType === "plural" ? "cardinal" : "ordinal",
              location
            },
            err: null
          };
      }
      default:
        return this.error(5, createLocation(typeStartPosition, typeEndPosition));
    }
  }
  tryParseArgumentClose(openingBracePosition) {
    if (this.isEOF() || this.char() !== 125)
      return this.error(1, createLocation(openingBracePosition, this.clonePosition()));
    this.bump();
    return {
      val: true,
      err: null
    };
  }
  parseSimpleArgStyleIfPossible() {
    let nestedBraces = 0;
    const startPosition = this.clonePosition();
    while (!this.isEOF())
      switch (this.char()) {
        case 39: {
          this.bump();
          let apostrophePosition = this.clonePosition();
          if (!this.bumpUntil("'"))
            return this.error(11, createLocation(apostrophePosition, this.clonePosition()));
          this.bump();
          break;
        }
        case 123:
          nestedBraces += 1;
          this.bump();
          break;
        case 125:
          if (nestedBraces > 0)
            nestedBraces -= 1;
          else
            return {
              val: this.message.slice(startPosition.offset, this.offset()),
              err: null
            };
          break;
        default:
          this.bump();
      }
    return {
      val: this.message.slice(startPosition.offset, this.offset()),
      err: null
    };
  }
  parseNumberSkeletonFromString(skeleton, location) {
    let tokens = [];
    try {
      tokens = parseNumberSkeletonFromString(skeleton);
    } catch {
      return this.error(7, location);
    }
    return {
      val: {
        type: 0,
        tokens,
        location,
        parsedOptions: this.shouldParseSkeletons ? parseNumberSkeleton(tokens) : {}
      },
      err: null
    };
  }
  tryParsePluralOrSelectOptions(nestingLevel, parentArgType, expectCloseTag, parsedFirstIdentifier) {
    let hasOtherClause = false;
    const options = [];
    const parsedSelectors = /* @__PURE__ */ new Set;
    let { value: selector, location: selectorLocation } = parsedFirstIdentifier;
    while (true) {
      if (selector.length === 0) {
        const startPosition = this.clonePosition();
        if (parentArgType !== "select" && this.bumpIf("=")) {
          const result = this.tryParseDecimalInteger(16, 19);
          if (result.err)
            return result;
          selectorLocation = createLocation(startPosition, this.clonePosition());
          selector = this.message.slice(startPosition.offset, this.offset());
        } else
          break;
      }
      if (parsedSelectors.has(selector))
        return this.error(parentArgType === "select" ? 21 : 20, selectorLocation);
      if (selector === "other")
        hasOtherClause = true;
      this.bumpSpace();
      const openingBracePosition = this.clonePosition();
      if (!this.bumpIf("{"))
        return this.error(parentArgType === "select" ? 17 : 18, createLocation(this.clonePosition(), this.clonePosition()));
      const fragmentResult = this.parseMessage(nestingLevel + 1, parentArgType, expectCloseTag);
      if (fragmentResult.err)
        return fragmentResult;
      const argCloseResult = this.tryParseArgumentClose(openingBracePosition);
      if (argCloseResult.err)
        return argCloseResult;
      options.push([selector, {
        value: fragmentResult.val,
        location: createLocation(openingBracePosition, this.clonePosition())
      }]);
      parsedSelectors.add(selector);
      this.bumpSpace();
      ({ value: selector, location: selectorLocation } = this.parseIdentifierIfPossible());
    }
    if (options.length === 0)
      return this.error(parentArgType === "select" ? 15 : 16, createLocation(this.clonePosition(), this.clonePosition()));
    if (this.requiresOtherClause && !hasOtherClause)
      return this.error(22, createLocation(this.clonePosition(), this.clonePosition()));
    return {
      val: options,
      err: null
    };
  }
  tryParseDecimalInteger(expectNumberError, invalidNumberError) {
    let sign = 1;
    const startingPosition = this.clonePosition();
    if (this.bumpIf("+")) {} else if (this.bumpIf("-"))
      sign = -1;
    let hasDigits = false;
    let decimal = 0;
    while (!this.isEOF()) {
      const ch = this.char();
      if (ch >= 48 && ch <= 57) {
        hasDigits = true;
        decimal = decimal * 10 + (ch - 48);
        this.bump();
      } else
        break;
    }
    const location = createLocation(startingPosition, this.clonePosition());
    if (!hasDigits)
      return this.error(expectNumberError, location);
    decimal *= sign;
    if (!Number.isSafeInteger(decimal))
      return this.error(invalidNumberError, location);
    return {
      val: decimal,
      err: null
    };
  }
  offset() {
    return this.position.offset;
  }
  isEOF() {
    return this.offset() === this.message.length;
  }
  clonePosition() {
    return {
      offset: this.position.offset,
      line: this.position.line,
      column: this.position.column
    };
  }
  char() {
    const offset = this.position.offset;
    if (offset >= this.message.length)
      throw Error("out of bound");
    const code = this.message.codePointAt(offset);
    if (code === undefined)
      throw Error(`Offset ${offset} is at invalid UTF-16 code unit boundary`);
    return code;
  }
  error(kind, location) {
    return {
      val: null,
      err: {
        kind,
        message: this.message,
        location
      }
    };
  }
  bump() {
    if (this.isEOF())
      return;
    const code = this.char();
    if (code === 10) {
      this.position.line += 1;
      this.position.column = 1;
      this.position.offset += 1;
    } else {
      this.position.column += 1;
      this.position.offset += code < 65536 ? 1 : 2;
    }
  }
  bumpIf(prefix) {
    if (this.message.startsWith(prefix, this.offset())) {
      for (let i = 0;i < prefix.length; i++)
        this.bump();
      return true;
    }
    return false;
  }
  bumpUntil(pattern) {
    const currentOffset = this.offset();
    const index = this.message.indexOf(pattern, currentOffset);
    if (index >= 0) {
      this.bumpTo(index);
      return true;
    } else {
      this.bumpTo(this.message.length);
      return false;
    }
  }
  bumpTo(targetOffset) {
    if (this.offset() > targetOffset)
      throw Error(`targetOffset ${targetOffset} must be greater than or equal to the current offset ${this.offset()}`);
    targetOffset = Math.min(targetOffset, this.message.length);
    while (true) {
      const offset = this.offset();
      if (offset === targetOffset)
        break;
      if (offset > targetOffset)
        throw Error(`targetOffset ${targetOffset} is at invalid UTF-16 code unit boundary`);
      this.bump();
      if (this.isEOF())
        break;
    }
  }
  bumpSpace() {
    while (!this.isEOF() && _isWhiteSpace(this.char()))
      this.bump();
  }
  peek() {
    if (this.isEOF())
      return null;
    const code = this.char();
    const offset = this.offset();
    return this.message.charCodeAt(offset + (code >= 65536 ? 2 : 1)) ?? null;
  }
};
function _isAlpha(codepoint) {
  return codepoint >= 97 && codepoint <= 122 || codepoint >= 65 && codepoint <= 90;
}
function _isAlphaOrSlash(codepoint) {
  return _isAlpha(codepoint) || codepoint === 47;
}
function _isPotentialElementNameChar(c) {
  return c === 45 || c === 46 || c >= 48 && c <= 57 || c === 95 || c >= 97 && c <= 122 || c >= 65 && c <= 90 || c == 183 || c >= 192 && c <= 214 || c >= 216 && c <= 246 || c >= 248 && c <= 893 || c >= 895 && c <= 8191 || c >= 8204 && c <= 8205 || c >= 8255 && c <= 8256 || c >= 8304 && c <= 8591 || c >= 11264 && c <= 12271 || c >= 12289 && c <= 55295 || c >= 63744 && c <= 64975 || c >= 65008 && c <= 65533 || c >= 65536 && c <= 983039;
}
function _isWhiteSpace(c) {
  return c >= 9 && c <= 13 || c === 32 || c === 133 || c >= 8206 && c <= 8207 || c === 8232 || c === 8233;
}
function pruneLocation(els) {
  els.forEach((el) => {
    delete el.location;
    if (isSelectElement(el) || isPluralElement(el))
      for (const k in el.options) {
        delete el.options[k].location;
        pruneLocation(el.options[k].value);
      }
    else if (isNumberElement(el) && isNumberSkeleton(el.style))
      delete el.style.location;
    else if ((isDateElement(el) || isTimeElement(el)) && isDateTimeSkeleton(el.style))
      delete el.style.location;
    else if (isTagElement(el))
      pruneLocation(el.children);
  });
}
function parse3(message, opts = {}) {
  opts = {
    shouldParseSkeletons: true,
    requiresOtherClause: true,
    ...opts
  };
  const result = new Parser3(message, opts).parse();
  if (result.err) {
    const error = SyntaxError(ErrorKind[result.err.kind]);
    error.location = result.err.location;
    error.originalMessage = result.err.message;
    throw error;
  }
  if (!opts?.captureLocation)
    pruneLocation(result.val);
  return result.val;
}

// node_modules/intl-messageformat/index.js
var FormatError = class extends Error {
  constructor(msg, code, originalMessage) {
    super(msg);
    this.code = code;
    this.originalMessage = originalMessage;
  }
  toString() {
    return `[formatjs Error: ${this.code}] ${this.message}`;
  }
};
var InvalidValueError = class extends FormatError {
  constructor(variableId, value, options, originalMessage) {
    super(`Invalid values for "${variableId}": "${value}". Options are "${Object.keys(options).join('", "')}"`, "INVALID_VALUE", originalMessage);
  }
};
var InvalidValueTypeError = class extends FormatError {
  constructor(value, type, originalMessage) {
    super(`Value for "${value}" must be of type ${type}`, "INVALID_VALUE", originalMessage);
  }
};
var MissingValueError = class extends FormatError {
  constructor(variableId, originalMessage) {
    super(`The intl string context variable "${variableId}" was not provided to the string "${originalMessage}"`, "MISSING_VALUE", originalMessage);
  }
};
function mergeLiteral(parts) {
  if (parts.length < 2)
    return parts;
  return parts.reduce((all, part) => {
    const lastPart = all[all.length - 1];
    if (!lastPart || lastPart.type !== 0 || part.type !== 0)
      all.push(part);
    else
      lastPart.value += part.value;
    return all;
  }, []);
}
function isFormatXMLElementFn(el) {
  return typeof el === "function";
}
function formatToParts(els, locales, formatters, formats, values, currentPluralValue, originalMessage) {
  if (els.length === 1 && isLiteralElement(els[0]))
    return [{
      type: 0,
      value: els[0].value
    }];
  const result = [];
  for (const el of els) {
    if (isLiteralElement(el)) {
      result.push({
        type: 0,
        value: el.value
      });
      continue;
    }
    if (isPoundElement(el)) {
      if (typeof currentPluralValue === "number")
        result.push({
          type: 0,
          value: formatters.getNumberFormat(locales).format(currentPluralValue)
        });
      continue;
    }
    const { value: varName } = el;
    if (!(values && (varName in values)))
      throw new MissingValueError(varName, originalMessage);
    let value = values[varName];
    if (isArgumentElement(el)) {
      if (!value || typeof value === "string" || typeof value === "number" || typeof value === "bigint")
        value = typeof value === "string" || typeof value === "number" || typeof value === "bigint" ? String(value) : "";
      result.push({
        type: typeof value === "string" ? 0 : 1,
        value
      });
      continue;
    }
    if (isDateElement(el)) {
      const style = typeof el.style === "string" ? formats.date[el.style] : isDateTimeSkeleton(el.style) ? el.style.parsedOptions : undefined;
      result.push({
        type: 0,
        value: formatters.getDateTimeFormat(locales, style).format(value)
      });
      continue;
    }
    if (isTimeElement(el)) {
      const style = typeof el.style === "string" ? formats.time[el.style] : isDateTimeSkeleton(el.style) ? el.style.parsedOptions : formats.time.medium;
      result.push({
        type: 0,
        value: formatters.getDateTimeFormat(locales, style).format(value)
      });
      continue;
    }
    if (isNumberElement(el)) {
      const style = typeof el.style === "string" ? formats.number[el.style] : isNumberSkeleton(el.style) ? el.style.parsedOptions : undefined;
      if (style && style.scale) {
        const scale = style.scale || 1;
        if (typeof value === "bigint") {
          if (!Number.isInteger(scale))
            throw new TypeError(`Cannot apply fractional scale ${scale} to bigint value. Scale must be an integer when formatting bigint.`);
          value = value * BigInt(scale);
        } else
          value = value * scale;
      }
      result.push({
        type: 0,
        value: formatters.getNumberFormat(locales, style).format(value)
      });
      continue;
    }
    if (isTagElement(el)) {
      const { children, value } = el;
      const formatFn = values[value];
      if (!isFormatXMLElementFn(formatFn))
        throw new InvalidValueTypeError(value, "function", originalMessage);
      let chunks = formatFn(formatToParts(children, locales, formatters, formats, values, currentPluralValue).map((p) => p.value));
      if (!Array.isArray(chunks))
        chunks = [chunks];
      result.push(...chunks.map((c) => {
        return {
          type: typeof c === "string" ? 0 : 1,
          value: c
        };
      }));
    }
    if (isSelectElement(el)) {
      const key = value;
      const opt = (Object.prototype.hasOwnProperty.call(el.options, key) ? el.options[key] : undefined) || el.options.other;
      if (!opt)
        throw new InvalidValueError(el.value, value, Object.keys(el.options), originalMessage);
      result.push(...formatToParts(opt.value, locales, formatters, formats, values));
      continue;
    }
    if (isPluralElement(el)) {
      const exactKey = `=${value}`;
      let opt = Object.prototype.hasOwnProperty.call(el.options, exactKey) ? el.options[exactKey] : undefined;
      if (!opt) {
        if (!Intl.PluralRules)
          throw new FormatError(`Intl.PluralRules is not available in this environment.
Try polyfilling it using "@formatjs/intl-pluralrules"
`, "MISSING_INTL_API", originalMessage);
        const numericValue = typeof value === "bigint" ? Number(value) : value;
        const rule = formatters.getPluralRules(locales, { type: el.pluralType }).select(numericValue - (el.offset || 0));
        opt = (Object.prototype.hasOwnProperty.call(el.options, rule) ? el.options[rule] : undefined) || el.options.other;
      }
      if (!opt)
        throw new InvalidValueError(el.value, value, Object.keys(el.options), originalMessage);
      const numericValue = typeof value === "bigint" ? Number(value) : value;
      result.push(...formatToParts(opt.value, locales, formatters, formats, values, numericValue - (el.offset || 0)));
      continue;
    }
  }
  return mergeLiteral(result);
}
function mergeConfig(c1, c2) {
  if (!c2)
    return c1;
  return {
    ...c1,
    ...c2,
    ...Object.keys(c1).reduce((all, k) => {
      all[k] = {
        ...c1[k],
        ...c2[k]
      };
      return all;
    }, {})
  };
}
function mergeConfigs(defaultConfig, configs) {
  if (!configs)
    return defaultConfig;
  return Object.keys(defaultConfig).reduce((all, k) => {
    all[k] = mergeConfig(defaultConfig[k], configs[k]);
    return all;
  }, { ...defaultConfig });
}
function createFastMemoizeCache(store) {
  return { create() {
    return {
      get(key) {
        return store[key];
      },
      set(key, value) {
        store[key] = value;
      }
    };
  } };
}
function createDefaultFormatters(cache = {
  number: {},
  dateTime: {},
  pluralRules: {}
}) {
  return {
    getNumberFormat: memoize((...args) => new Intl.NumberFormat(...args), {
      cache: createFastMemoizeCache(cache.number),
      strategy: strategies.variadic
    }),
    getDateTimeFormat: memoize((...args) => new Intl.DateTimeFormat(...args), {
      cache: createFastMemoizeCache(cache.dateTime),
      strategy: strategies.variadic
    }),
    getPluralRules: memoize((...args) => new Intl.PluralRules(...args), {
      cache: createFastMemoizeCache(cache.pluralRules),
      strategy: strategies.variadic
    })
  };
}
var IntlMessageFormat = class IntlMessageFormat {
  constructor(message, locales = IntlMessageFormat.defaultLocale, overrideFormats, opts) {
    this.formatterCache = {
      number: {},
      dateTime: {},
      pluralRules: {}
    };
    this.format = (values) => {
      const parts = this.formatToParts(values);
      if (parts.length === 1)
        return parts[0].value;
      const result = parts.reduce((all, part) => {
        if (!all.length || part.type !== 0 || typeof all[all.length - 1] !== "string")
          all.push(part.value);
        else
          all[all.length - 1] += part.value;
        return all;
      }, []);
      if (result.length <= 1)
        return result[0] || "";
      return result;
    };
    this.formatToParts = (values) => formatToParts(this.ast, this.locales, this.formatters, this.formats, values, undefined, this.message);
    this.resolvedOptions = () => ({ locale: this.resolvedLocale?.toString() || Intl.NumberFormat.supportedLocalesOf(this.locales)[0] });
    this.getAst = () => this.ast;
    this.locales = locales;
    this.resolvedLocale = IntlMessageFormat.resolveLocale(locales);
    if (typeof message === "string") {
      this.message = message;
      if (!IntlMessageFormat.__parse)
        throw new TypeError("IntlMessageFormat.__parse must be set to process `message` of type `string`");
      const { ...parseOpts } = opts || {};
      this.ast = IntlMessageFormat.__parse(message, {
        ...parseOpts,
        locale: this.resolvedLocale
      });
    } else
      this.ast = message;
    if (!Array.isArray(this.ast))
      throw new TypeError("A message must be provided as a String or AST.");
    this.formats = mergeConfigs(IntlMessageFormat.formats, overrideFormats);
    this.formatters = opts && opts.formatters || createDefaultFormatters(this.formatterCache);
  }
  static {
    this.memoizedDefaultLocale = null;
  }
  static get defaultLocale() {
    if (!IntlMessageFormat.memoizedDefaultLocale)
      IntlMessageFormat.memoizedDefaultLocale = new Intl.NumberFormat().resolvedOptions().locale;
    return IntlMessageFormat.memoizedDefaultLocale;
  }
  static {
    this.resolveLocale = (locales) => {
      if (typeof Intl.Locale === "undefined")
        return;
      const supportedLocales = Intl.NumberFormat.supportedLocalesOf(locales);
      if (supportedLocales.length > 0)
        return new Intl.Locale(supportedLocales[0]);
      return new Intl.Locale(typeof locales === "string" ? locales : locales[0]);
    };
  }
  static {
    this.__parse = parse3;
  }
  static {
    this.formats = {
      number: {
        integer: { maximumFractionDigits: 0 },
        currency: { style: "currency" },
        percent: { style: "percent" }
      },
      date: {
        short: {
          month: "numeric",
          day: "numeric",
          year: "2-digit"
        },
        medium: {
          month: "short",
          day: "numeric",
          year: "numeric"
        },
        long: {
          month: "long",
          day: "numeric",
          year: "numeric"
        },
        full: {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric"
        }
      },
      time: {
        short: {
          hour: "numeric",
          minute: "numeric"
        },
        medium: {
          hour: "numeric",
          minute: "numeric",
          second: "numeric"
        },
        long: {
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
          timeZoneName: "short"
        },
        full: {
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
          timeZoneName: "short"
        }
      }
    };
  }
};

// node_modules/use-intl/dist/esm/development/format-message/index.js
var import_react = __toESM(require_react(), 1);
function convertFormatsToIntlMessageFormat(globalFormats, inlineFormats, timeZone) {
  const mfDateDefaults = IntlMessageFormat.formats.date;
  const mfTimeDefaults = IntlMessageFormat.formats.time;
  const dateTimeFormats = {
    ...globalFormats?.dateTime,
    ...inlineFormats?.dateTime
  };
  const allFormats = {
    date: {
      ...mfDateDefaults,
      ...dateTimeFormats
    },
    time: {
      ...mfTimeDefaults,
      ...dateTimeFormats
    },
    number: {
      ...globalFormats?.number,
      ...inlineFormats?.number
    }
  };
  if (timeZone) {
    ["date", "time"].forEach((property) => {
      const formats = allFormats[property];
      for (const [key, value] of Object.entries(formats)) {
        formats[key] = {
          timeZone,
          ...value
        };
      }
    });
  }
  return allFormats;
}
function createMessageFormatter(cache, intlFormatters) {
  const getMessageFormat = memoFn((...args) => new IntlMessageFormat(args[0], args[1], args[2], {
    formatters: intlFormatters,
    ...args[3]
  }), cache.message);
  return getMessageFormat;
}
function getPlainMessage(candidate, values) {
  return values || /'[{}<#|']/.test(candidate) || /<|{/.test(candidate) ? undefined : candidate;
}
function formatMessage(...[key, message, values, options]) {
  if (Array.isArray(message)) {
    throw new IntlError(IntlErrorCode.INVALID_MESSAGE, `Message at \`${key}\` resolved to an array, but only strings are supported. See https://next-intl.dev/docs/usage/translations#arrays-of-messages`);
  }
  if (typeof message === "object") {
    throw new IntlError(IntlErrorCode.INSUFFICIENT_PATH, `Message at \`${key}\` resolved to \`${typeof message}\`, but only strings are supported. Use a \`.\` to retrieve nested messages. See https://next-intl.dev/docs/usage/translations#structuring-messages`);
  }
  if (typeof message === "string") {
    const plainMessage = getPlainMessage(message, values);
    if (plainMessage)
      return plainMessage;
  }
  const {
    cache,
    formats,
    formatters,
    globalFormats,
    locale,
    timeZone
  } = options;
  if (!formatters.getMessageFormat) {
    formatters.getMessageFormat = createMessageFormatter(cache, formatters);
  }
  let messageFormat;
  try {
    messageFormat = formatters.getMessageFormat(message, locale, convertFormatsToIntlMessageFormat(globalFormats, formats, timeZone), {
      formatters: {
        ...formatters,
        getDateTimeFormat(locales, dateTimeOptions) {
          return formatters.getDateTimeFormat(locales, {
            ...dateTimeOptions,
            timeZone: dateTimeOptions?.timeZone ?? timeZone
          });
        }
      }
    });
  } catch (error) {
    throw new IntlError(IntlErrorCode.INVALID_MESSAGE, `${error.message} (${error.originalMessage})`);
  }
  const formattedMessage = messageFormat.format(values);
  return /* @__PURE__ */ import_react.isValidElement(formattedMessage) || Array.isArray(formattedMessage) || typeof formattedMessage === "string" ? formattedMessage : String(formattedMessage);
}
formatMessage.raw = true;

// node_modules/use-intl/dist/esm/development/initializeConfig-CUsOI8u2.js
function joinPath(...parts) {
  return parts.filter(Boolean).join(".");
}
function defaultGetMessageFallback(props) {
  return joinPath(props.namespace, props.key);
}
function defaultOnError(error) {
  console.error(error);
}
function prepareTranslationValues(values) {
  const transformedValues = {};
  Object.keys(values).forEach((key) => {
    let index = 0;
    const value = values[key];
    let transformed;
    if (typeof value === "function") {
      transformed = (chunks) => {
        const result = value(chunks);
        return /* @__PURE__ */ import_react2.isValidElement(result) ? /* @__PURE__ */ import_react2.cloneElement(result, {
          key: key + index++
        }) : result;
      };
    } else {
      transformed = value;
    }
    transformedValues[key] = transformed;
  });
  return transformedValues;
}
function resolvePath(locale, messages, key, namespace) {
  const fullKey = joinPath(namespace, key);
  if (!messages) {
    throw new Error(`No messages available at \`${namespace}\`.`);
  }
  let message = messages;
  key.split(".").forEach((part) => {
    const next = message[part];
    if (part == null || next == null) {
      throw new Error(`Could not resolve \`${fullKey}\` in messages for locale \`${locale}\`.`);
    }
    message = next;
  });
  return message;
}
function getMessagesOrError(locale, messages, namespace) {
  try {
    if (!messages) {
      throw new Error(`No messages were configured.`);
    }
    const retrievedMessages = namespace ? resolvePath(locale, messages, namespace) : messages;
    if (!retrievedMessages) {
      throw new Error(`No messages for namespace \`${namespace}\` found.`);
    }
    return retrievedMessages;
  } catch (error) {
    const intlError = new IntlError(IntlErrorCode.MISSING_MESSAGE, error.message);
    return intlError;
  }
}
function createBaseTranslator(config) {
  const messagesOrError = getMessagesOrError(config.locale, config.messages, config.namespace);
  return createBaseTranslatorImpl({
    ...config,
    messagesOrError
  });
}
function createBaseTranslatorImpl({
  cache,
  formats: globalFormats,
  formatters,
  getMessageFallback = defaultGetMessageFallback,
  locale,
  messagesOrError,
  namespace,
  onError,
  timeZone
}) {
  const hasMessagesError = messagesOrError instanceof IntlError;
  function getFallbackFromErrorAndNotify(key, code, message, fallback) {
    const error = new IntlError(code, message);
    onError(error);
    return fallback ?? getMessageFallback({
      error,
      key,
      namespace
    });
  }
  function translateBaseFn(key, values, formats, _fallback) {
    const fallback = _fallback;
    let message;
    if (hasMessagesError) {
      if (fallback) {
        message = fallback;
      } else {
        onError(messagesOrError);
        return getMessageFallback({
          error: messagesOrError,
          key,
          namespace
        });
      }
    } else {
      const messages = messagesOrError;
      try {
        message = resolvePath(locale, messages, key, namespace);
      } catch (error) {
        if (fallback) {
          message = fallback;
        } else {
          return getFallbackFromErrorAndNotify(key, IntlErrorCode.MISSING_MESSAGE, error.message, fallback);
        }
      }
    }
    try {
      const messagePath = joinPath(namespace, key);
      return formatMessage(messagePath, message, values ? prepareTranslationValues(values) : values, {
        cache,
        formatters,
        globalFormats,
        formats,
        locale,
        timeZone
      });
    } catch (error) {
      let errorCode, errorMessage;
      if (error instanceof IntlError) {
        errorCode = error.code;
        errorMessage = error.originalMessage;
      } else {
        errorCode = IntlErrorCode.FORMATTING_ERROR;
        errorMessage = error.message;
      }
      return getFallbackFromErrorAndNotify(key, errorCode, errorMessage, fallback);
    }
  }
  function translateFn(key, values, formats, _fallback) {
    const result = translateBaseFn(key, values, formats, _fallback);
    if (typeof result !== "string") {
      return getFallbackFromErrorAndNotify(key, IntlErrorCode.INVALID_MESSAGE, `The message \`${key}\` in ${namespace ? `namespace \`${namespace}\`` : "messages"} didn't resolve to a string. If you want to format rich text, use \`t.rich\` instead.`);
    }
    return result;
  }
  translateFn.rich = translateBaseFn;
  translateFn.markup = (key, values, formats, _fallback) => {
    const result = translateBaseFn(key, values, formats, _fallback);
    if (typeof result !== "string") {
      const error = new IntlError(IntlErrorCode.FORMATTING_ERROR, "`t.markup` only accepts functions for formatting that receive and return strings.\n\nE.g. t.markup('markup', {b: (chunks) => `<b>${chunks}</b>`})");
      onError(error);
      return getMessageFallback({
        error,
        key,
        namespace
      });
    }
    return result;
  };
  translateFn.raw = (key) => {
    {
      if (!formatMessage.raw) {
        throw new Error("`t.raw` is not supported when messages are precompiled.");
      }
    }
    if (hasMessagesError) {
      onError(messagesOrError);
      return getMessageFallback({
        error: messagesOrError,
        key,
        namespace
      });
    }
    const messages = messagesOrError;
    try {
      return resolvePath(locale, messages, key, namespace);
    } catch (error) {
      return getFallbackFromErrorAndNotify(key, IntlErrorCode.MISSING_MESSAGE, error.message);
    }
  };
  translateFn.has = (key) => {
    if (hasMessagesError) {
      return false;
    }
    try {
      resolvePath(locale, messagesOrError, key, namespace);
      return true;
    } catch {
      return false;
    }
  };
  return translateFn;
}
function resolveNamespace(namespace, namespacePrefix) {
  return namespace === namespacePrefix ? undefined : namespace.slice((namespacePrefix + ".").length);
}
var SECOND = 1;
var MINUTE = SECOND * 60;
var HOUR = MINUTE * 60;
var DAY = HOUR * 24;
var WEEK = DAY * 7;
var MONTH = DAY * (365 / 12);
var QUARTER = MONTH * 3;
var YEAR = DAY * 365;
var UNIT_SECONDS = {
  second: SECOND,
  seconds: SECOND,
  minute: MINUTE,
  minutes: MINUTE,
  hour: HOUR,
  hours: HOUR,
  day: DAY,
  days: DAY,
  week: WEEK,
  weeks: WEEK,
  month: MONTH,
  months: MONTH,
  quarter: QUARTER,
  quarters: QUARTER,
  year: YEAR,
  years: YEAR
};
function resolveRelativeTimeUnit(seconds) {
  const absValue = Math.abs(seconds);
  if (absValue < MINUTE) {
    return "second";
  } else if (absValue < HOUR) {
    return "minute";
  } else if (absValue < DAY) {
    return "hour";
  } else if (absValue < WEEK) {
    return "day";
  } else if (absValue < MONTH) {
    return "week";
  } else if (absValue < YEAR) {
    return "month";
  }
  return "year";
}
function calculateRelativeTimeValue(seconds, unit) {
  return Math.round(seconds / UNIT_SECONDS[unit]);
}
function createFormatter(props) {
  const {
    _cache: cache = createCache(),
    _formatters: formatters = createIntlFormatters(cache),
    formats,
    locale,
    onError = defaultOnError,
    timeZone: globalTimeZone
  } = props;
  function applyTimeZone(options) {
    if (!options?.timeZone) {
      if (globalTimeZone) {
        options = {
          ...options,
          timeZone: globalTimeZone
        };
      } else {
        onError(new IntlError(IntlErrorCode.ENVIRONMENT_FALLBACK, `The \`timeZone\` parameter wasn't provided and there is no global default configured. Consider adding a global default to avoid markup mismatches caused by environment differences. Learn more: https://next-intl.dev/docs/configuration#time-zone`));
      }
    }
    return options;
  }
  function resolveFormatOrOptions(typeFormats, formatOrOptions, overrides) {
    let options;
    if (typeof formatOrOptions === "string") {
      const formatName = formatOrOptions;
      options = typeFormats?.[formatName];
      if (!options) {
        const error = new IntlError(IntlErrorCode.MISSING_FORMAT, `Format \`${formatName}\` is not available.`);
        onError(error);
        throw error;
      }
    } else {
      options = formatOrOptions;
    }
    if (overrides) {
      options = {
        ...options,
        ...overrides
      };
    }
    return options;
  }
  function getFormattedValue(formatOrOptions, overrides, typeFormats, formatter, getFallback) {
    let options;
    try {
      options = resolveFormatOrOptions(typeFormats, formatOrOptions, overrides);
    } catch {
      return getFallback();
    }
    try {
      return formatter(options);
    } catch (error) {
      onError(new IntlError(IntlErrorCode.FORMATTING_ERROR, error.message));
      return getFallback();
    }
  }
  function dateTime(value, formatOrOptions, overrides) {
    return getFormattedValue(formatOrOptions, overrides, formats?.dateTime, (options) => {
      options = applyTimeZone(options);
      return formatters.getDateTimeFormat(locale, options).format(value);
    }, () => String(value));
  }
  function dateTimeRange(start, end, formatOrOptions, overrides) {
    return getFormattedValue(formatOrOptions, overrides, formats?.dateTime, (options) => {
      options = applyTimeZone(options);
      return formatters.getDateTimeFormat(locale, options).formatRange(start, end);
    }, () => [dateTime(start), dateTime(end)].join(" – "));
  }
  function number(value, formatOrOptions, overrides) {
    return getFormattedValue(formatOrOptions, overrides, formats?.number, (options) => formatters.getNumberFormat(locale, options).format(value), () => String(value));
  }
  function getGlobalNow() {
    if (props.now) {
      return props.now;
    } else {
      onError(new IntlError(IntlErrorCode.ENVIRONMENT_FALLBACK, `The \`now\` parameter wasn't provided to \`relativeTime\` and there is no global default configured, therefore the current time will be used as a fallback. See https://next-intl.dev/docs/usage/dates-times#relative-times-usenow`));
      return new Date;
    }
  }
  function relativeTime(date, nowOrOptions) {
    try {
      let nowDate, unit;
      const opts = {};
      if (nowOrOptions instanceof Date || typeof nowOrOptions === "number") {
        nowDate = new Date(nowOrOptions);
      } else if (nowOrOptions) {
        if (nowOrOptions.now != null) {
          nowDate = new Date(nowOrOptions.now);
        } else {
          nowDate = getGlobalNow();
        }
        unit = nowOrOptions.unit;
        opts.style = nowOrOptions.style;
        opts.numberingSystem = nowOrOptions.numberingSystem;
      }
      if (!nowDate) {
        nowDate = getGlobalNow();
      }
      const dateDate = new Date(date);
      const seconds = (dateDate.getTime() - nowDate.getTime()) / 1000;
      if (!unit) {
        unit = resolveRelativeTimeUnit(seconds);
      }
      opts.numeric = unit === "second" ? "auto" : "always";
      const value = calculateRelativeTimeValue(seconds, unit);
      return formatters.getRelativeTimeFormat(locale, opts).format(value, unit);
    } catch (error) {
      onError(new IntlError(IntlErrorCode.FORMATTING_ERROR, error.message));
      return String(date);
    }
  }
  function list(value, formatOrOptions, overrides) {
    const serializedValue = [];
    const richValues = new Map;
    let index = 0;
    for (const item of value) {
      let serializedItem;
      if (typeof item === "object") {
        serializedItem = String(index);
        richValues.set(serializedItem, item);
      } else {
        serializedItem = String(item);
      }
      serializedValue.push(serializedItem);
      index++;
    }
    return getFormattedValue(formatOrOptions, overrides, formats?.list, (options) => {
      const result = formatters.getListFormat(locale, options).formatToParts(serializedValue).map((part) => part.type === "literal" ? part.value : richValues.get(part.value) || part.value);
      if (richValues.size > 0) {
        return result;
      } else {
        return result.join("");
      }
    }, () => String(value));
  }
  function displayName(value, formatOrOptions, overrides) {
    return getFormattedValue(formatOrOptions, overrides, formats?.displayName, (options) => formatters.getDisplayNames(locale, options).of(value), () => value);
  }
  return {
    dateTime,
    number,
    relativeTime,
    list,
    dateTimeRange,
    displayName
  };
}

// node_modules/use-intl/dist/esm/development/react.js
var import_jsx_runtime = __toESM(require_jsx_runtime(), 1);
var IntlContext = /* @__PURE__ */ import_react3.createContext(undefined);
function useIntlContext() {
  const context = import_react3.useContext(IntlContext);
  if (!context) {
    throw new Error("No intl context found. Have you configured the provider? See https://next-intl.dev/docs/usage/configuration#server-client-components");
  }
  return context;
}
var hasWarnedForMissingTimezone = false;
var isServer = typeof window === "undefined";
function useTranslationsImpl(allMessagesPrefixed, namespacePrefixed, namespacePrefix) {
  const {
    cache,
    formats: globalFormats,
    formatters,
    getMessageFallback,
    locale,
    onError,
    timeZone
  } = useIntlContext();
  const allMessages = allMessagesPrefixed[namespacePrefix];
  const namespace = resolveNamespace(namespacePrefixed, namespacePrefix);
  if (!timeZone && !hasWarnedForMissingTimezone && isServer) {
    hasWarnedForMissingTimezone = true;
    onError(new IntlError(IntlErrorCode.ENVIRONMENT_FALLBACK, `There is no \`timeZone\` configured, this can lead to markup mismatches caused by environment differences. Consider adding a global default: https://next-intl.dev/docs/configuration#time-zone`));
  }
  const translate = import_react3.useMemo(() => createBaseTranslator({
    cache,
    formatters,
    getMessageFallback,
    messages: allMessages,
    namespace,
    onError,
    formats: globalFormats,
    locale,
    timeZone
  }), [cache, formatters, getMessageFallback, allMessages, namespace, onError, globalFormats, locale, timeZone]);
  return translate;
}
function useTranslations(namespace) {
  const context = useIntlContext();
  const messages = context.messages;
  return useTranslationsImpl({
    "!": messages
  }, namespace ? `!.${namespace}` : "!", "!");
}
function useFormatter() {
  const {
    formats,
    formatters,
    locale,
    now: globalNow,
    onError,
    timeZone
  } = useIntlContext();
  return import_react3.useMemo(() => createFormatter({
    formats,
    locale,
    now: globalNow,
    onError,
    timeZone,
    _formatters: formatters
  }), [formats, formatters, globalNow, locale, onError, timeZone]);
}
// node_modules/next-intl/dist/esm/development/react-client/index.js
function callHook(name, hook) {
  return (...args) => {
    try {
      return hook(...args);
    } catch {
      throw new Error(`Failed to call \`${name}\` because the context from \`NextIntlClientProvider\` was not found.

This can happen because:
1) You intended to render this component as a Server Component, the render
   failed, and therefore React attempted to render the component on the client
   instead. If this is the case, check the console for server errors.
2) You intended to render this component on the client side, but no context was found.
   Learn more about this error here: https://next-intl.dev/docs/environments/server-client-components#missing-context`);
    }
  };
}
var useTranslations2 = callHook("useTranslations", useTranslations);
var useFormatter2 = callHook("useFormatter", useFormatter);
// app/components/HtmlMessage.tsx
var import_react8 = __toESM(require_react(), 1);
// lib/html/extract.ts
function extractVisibleHtmlText(html) {
  return html.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<head[\s\S]*?<\/head>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ").replace(/<br\s*\/?>/gi, `
`).replace(/<\/(p|div|section|article|header|footer|blockquote|pre|table|tr|li|ul|ol|h[1-6])>/gi, `
`).replace(/<[^>]+>/g, " ").replace(/&(nbsp|#160|#xa0);/gi, " ").replace(/[\u00a0\u200b-\u200d\u2060\ufeff\ufffc]/g, " ").replace(/\s+/g, " ").trim();
}
function splitConcatenatedHtmlDocuments(input) {
  const trimmed = input.trim();
  const startMatch = trimmed.match(/^(?:<!doctype html>\s*)?<html[\s>]/i);
  if (!startMatch)
    return [input];
  const segments = [];
  let cursor = 0;
  const boundaryRe = /<\/html>\s*(?:<br\s*\/?>\s*)*(?=(?:<!doctype html>\s*)?<html[\s>])/gi;
  let boundary;
  while (boundary = boundaryRe.exec(trimmed)) {
    const end = boundary.index + boundary[0].length;
    segments.push(trimmed.slice(cursor, end));
    cursor = end;
  }
  if (segments.length === 0)
    return [input];
  segments.push(trimmed.slice(cursor));
  return segments.filter(Boolean);
}
function scoreHtmlDocument(html) {
  const visibleText = extractVisibleHtmlText(html);
  return {
    html,
    visibleTextLength: visibleText.length,
    hasMeaningfulText: /[\p{L}\p{N}]/u.test(visibleText),
    hasRenderableMedia: /<(img|table|svg|video|iframe|canvas|object|embed)\b/i.test(html),
    htmlLength: html.length
  };
}
function extractBodyContent(input) {
  const candidates = splitConcatenatedHtmlDocuments(input).map((candidate) => candidate.trim()).filter(Boolean);
  const normalizedCandidates = candidates.length > 0 ? candidates : [input];
  if (normalizedCandidates.length === 1 && !/<body[\s>]/i.test(normalizedCandidates[0] ?? "")) {
    return {
      body: normalizedCandidates[0] ?? "",
      styles: (normalizedCandidates[0] ?? "").match(/<style[^>]*>[\s\S]*?<\/style>/gi) ?? [],
      bodyAttrs: { className: "", style: "", id: "" }
    };
  }
  const parts = normalizedCandidates.map((candidate) => {
    const scored = scoreHtmlDocument(candidate);
    const styles = candidate.match(/<style[^>]*>[\s\S]*?<\/style>/gi) ?? [];
    const bodyMatch = candidate.match(/<body([^>]*)>([\s\S]*)<\/body>/i);
    const attrs = bodyMatch?.[1] ?? "";
    const classMatch = attrs.match(/class=["']([^"']+)["']/i);
    const styleMatch = attrs.match(/style=["']([^"']+)["']/i);
    const idMatch = attrs.match(/id=["']([^"']+)["']/i);
    return {
      ...scored,
      styles,
      body: (bodyMatch?.[2] ?? candidate).replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ""),
      bodyAttrs: {
        className: classMatch?.[1] ?? "",
        style: styleMatch?.[1] ?? "",
        id: idMatch?.[1] ?? ""
      }
    };
  });
  const visibleParts = parts.filter((part) => part.hasMeaningfulText || part.hasRenderableMedia || part.visibleTextLength > 0);
  const renderedParts = visibleParts.length > 0 ? visibleParts : parts;
  const primaryPart = renderedParts.find((part) => part.bodyAttrs.className || part.bodyAttrs.style || part.bodyAttrs.id) ?? renderedParts[0];
  return {
    body: renderedParts.map((part) => part.body).join(""),
    styles: renderedParts.flatMap((part) => part.styles),
    bodyAttrs: primaryPart?.bodyAttrs ?? { className: "", style: "", id: "" }
  };
}
// lib/html/viewportUnits.ts
init_dist2();
var CSS_ESCAPE = String.raw`\\(?:[0-9a-f]{1,6}(?:\r\n|[ \t\n\r\f])?|[^\n\r\f])`;
var CSS_NAME = String.raw`(?:[\w\u0080-\uffff-]|${CSS_ESCAPE})+`;
var CSS_NUMBER = String.raw`[+-]?(?:\d*\.\d+|\d+\.?\d*)(?:e[+-]?\d+)?`;
var CSS_STRING = String.raw`"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'`;
var CSS_TOKEN = new RegExp([
  String.raw`\/\*[\s\S]*?(?:\*\/|$)`,
  CSS_STRING,
  String.raw`url\(\s*(?:${CSS_STRING}|(?:\\[\s\S]|[^)\\])*)\s*\)`,
  `${CSS_NUMBER}(?:${CSS_NAME})?`,
  String.raw`(?:--|-?[a-z_\u0080-\uffff]|${CSS_ESCAPE})(?:${CSS_NAME})?`,
  `#${CSS_NAME}`
].join("|"), "gi");
var VIEWPORT_LENGTH = /^([+-]?(?:\d*\.\d+|\d+\.?\d*)(?:e[+-]?\d+)?)([sld]?v(?:h|b|min|max))$/i;
function rewriteViewportHeightUnits(css) {
  return css.replace(CSS_TOKEN, (token) => {
    const length = VIEWPORT_LENGTH.exec(token);
    if (!length)
      return token;
    const [, amount, unit] = length;
    const axis = /min$/i.test(unit) ? "min(var(--noctua-vh), 1vw)" : /max$/i.test(unit) ? "max(var(--noctua-vh), 1vw)" : "var(--noctua-vh)";
    return `calc(${amount} * ${axis})`;
  });
}
function rewriteHtmlViewportHeightUnits(html) {
  return html.replace(/<!--[\s\S]*?-->|<style\b[^>]*>[\s\S]*?<\/style\s*>|<[a-z][\w:-]*(?:"[^"]*(?:"|$)|'[^']*(?:'|$)|[^'">])*(?:>|$)/gi, (tag) => {
    if (tag.startsWith("<!--"))
      return tag;
    if (/^<style\b/i.test(tag)) {
      return tag.replace(/(>)([\s\S]*)(<\/style\s*>$)/i, (_, open, css, close) => `${open}${rewriteViewportHeightUnits(css)}${close}`);
    }
    return tag.replace(/(\s+)([^\s=/>]+)(\s*=\s*)("[^"]*"|'[^']*'|[^\s>]+)/g, (attribute, space, name, equals, value) => {
      if (name.toLowerCase() !== "style")
        return attribute;
      const quote = /^["']/.test(value) ? value[0] : "";
      const css = decodeHTMLAttribute(quote ? value.slice(1, -1) : value);
      const rewritten = rewriteViewportHeightUnits(css);
      if (rewritten === css)
        return attribute;
      const delimiter = quote || '"';
      const escaped = rewritten.replace(/&/g, "&amp;").replace(delimiter === '"' ? /"/g : /'/g, delimiter === '"' ? "&quot;" : "&#39;");
      return `${space}${name}${equals}${delimiter}${escaped}${delimiter}`;
    });
  });
}
function stripBodyHeightStyles(style) {
  const boundaries = /\/\*[\s\S]*?(?:\*\/|$)|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|[();]/g;
  let depth = 0;
  let start = 0;
  let output = "";
  const keepDeclaration = (declaration) => {
    const withoutComments = declaration.replace(/\/\*[\s\S]*?\*\//g, "");
    return !/^\s*(?:height|min-height|max-height)\s*:/i.test(withoutComments);
  };
  for (const token of style.matchAll(boundaries)) {
    if (token[0] === "(")
      depth += 1;
    if (token[0] === ")")
      depth = Math.max(0, depth - 1);
    if (token[0] !== ";" || depth > 0)
      continue;
    const end = token.index + 1;
    const declaration = style.slice(start, end);
    if (keepDeclaration(declaration))
      output += declaration;
    start = end;
  }
  const last = style.slice(start);
  return output + (keepDeclaration(last) ? last : "");
}
// lib/html/quoteBoundary.ts
var HEAD_SCAN_LENGTH = 1000;
var QUOTE_TEXT_SCAN_LIMIT = HEAD_SCAN_LENGTH;
var QUOTE_COLLAPSE_MIN_QUOTED_CHARS = 400;
var QUOTE_COLLAPSE_MIN_LEADING_CHARS = 20;
var ATTRIBUTION_MAX_LENGTH = 400;
var BOUNDARY_IDS = new Set([
  "noctua-quoted-html",
  "appendonsend",
  "divrplyfwdmsg",
  "mail-editor-reference-message-container",
  "stopspelling",
  "olk_src_body_section"
]);
var BOUNDARY_CLASSES = new Set([
  "gmail_quote",
  "gmail_quote_container",
  "yahoo_quoted",
  "moz-cite-prefix",
  "protonmail_quote",
  "zmail_extra",
  "outlookmessageheader"
]);
var HEADER_BLOCK_START = /^(?:von|from)\s*:/i;
var HEADER_BLOCK_SENT = /(?:^|[^\p{L}])(?:gesendet|sent|datum|date)\s*:/iu;
var HEADER_BLOCK_SUBJECT = /(?:^|[^\p{L}])(?:betreff|subject)\s*:/iu;
var FORWARD_SEPARATOR = /^-{2,}\s*(?:original message|ursprüngliche nachricht|weitergeleitete nachricht|forwarded message)\s*-{2,}/i;
var ATTRIBUTION_LINE = /^(?:on\b[\s\S]{0,300}?\bwrote\s*:|am\b[\s\S]{0,300}?\bschrieb\b[\s\S]{0,200}?:)$/i;
var WRAPPABLE_PARENT_TAGS = new Set([
  "BODY",
  "DIV",
  "SECTION",
  "ARTICLE",
  "MAIN",
  "BLOCKQUOTE",
  "LI",
  "CENTER",
  "FORM"
]);
var TABLE_LAYOUT_TAGS = new Set(["TABLE", "THEAD", "TBODY", "TFOOT", "TR", "TD", "TH"]);
function hasQuoteBoundaryMarker(markers) {
  const id = markers.id.trim().toLowerCase();
  if (id && BOUNDARY_IDS.has(id)) {
    return true;
  }
  const classNames = markers.className.toLowerCase().split(/\s+/);
  if (classNames.some((name) => name && BOUNDARY_CLASSES.has(name))) {
    return true;
  }
  return markers.tagName.toUpperCase() === "BLOCKQUOTE" && markers.typeAttr.trim().toLowerCase() === "cite";
}
function isQuoteBoundaryText(rawText) {
  const text = rawText.trim();
  if (!text) {
    return false;
  }
  const head = text.slice(0, HEAD_SCAN_LENGTH);
  if (FORWARD_SEPARATOR.test(head)) {
    return true;
  }
  if (HEADER_BLOCK_START.test(head) && HEADER_BLOCK_SENT.test(head) && HEADER_BLOCK_SUBJECT.test(head)) {
    return true;
  }
  return text.length <= ATTRIBUTION_MAX_LENGTH && ATTRIBUTION_LINE.test(text);
}
function shouldCollapseQuote(sizes) {
  return sizes.leadingTextLength >= QUOTE_COLLAPSE_MIN_LEADING_CHARS && sizes.quotedTextLength >= QUOTE_COLLAPSE_MIN_QUOTED_CHARS;
}
function canWrapQuoteInParent(parentTagName) {
  return WRAPPABLE_PARENT_TAGS.has(parentTagName.toUpperCase());
}
function isTableLayoutTag(tagName) {
  return TABLE_LAYOUT_TAGS.has(tagName.toUpperCase());
}
// lib/html/quotedParts.ts
var FORWARD_META_ATTR = "data-noctua-forward-meta";
var FORWARD_META_TABLE_RE = new RegExp(`<table\\b[^>]*\\b${FORWARD_META_ATTR}=["']1["'][^>]*>[\\s\\S]*?<\\/table>`, "i");
// app/components/mailclient/message/MessageLinkPreviewContext.tsx
var import_react6 = __toESM(require_react(), 1);
"use client";
var noopMessageLinkPreviewHandler = () => {};
var MessageLinkPreviewContext = import_react6.createContext(noopMessageLinkPreviewHandler);
function useMessageLinkPreview() {
  return import_react6.useContext(MessageLinkPreviewContext);
}

// node_modules/clsx/dist/clsx.mjs
function r(e) {
  var t, f, n = "";
  if (typeof e == "string" || typeof e == "number")
    n += e;
  else if (typeof e == "object")
    if (Array.isArray(e)) {
      var o = e.length;
      for (t = 0;t < o; t++)
        e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
    } else
      for (f in e)
        e[f] && (n && (n += " "), n += f);
  return n;
}
function clsx() {
  for (var e, t, f = 0, n = "", o = arguments.length;f < o; f++)
    (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
  return n;
}

// node_modules/class-variance-authority/dist/index.mjs
var falsyToString = (value) => typeof value === "boolean" ? `${value}` : value === 0 ? "0" : value;
var cx = clsx;
var cva = (base, config) => (props) => {
  var _config_compoundVariants;
  if ((config === null || config === undefined ? undefined : config.variants) == null)
    return cx(base, props === null || props === undefined ? undefined : props.class, props === null || props === undefined ? undefined : props.className);
  const { variants, defaultVariants } = config;
  const getVariantClassNames = Object.keys(variants).map((variant) => {
    const variantProp = props === null || props === undefined ? undefined : props[variant];
    const defaultVariantProp = defaultVariants === null || defaultVariants === undefined ? undefined : defaultVariants[variant];
    if (variantProp === null)
      return null;
    const variantKey = falsyToString(variantProp) || falsyToString(defaultVariantProp);
    return variants[variant][variantKey];
  });
  const propsWithoutUndefined = props && Object.entries(props).reduce((acc, param) => {
    let [key, value] = param;
    if (value === undefined) {
      return acc;
    }
    acc[key] = value;
    return acc;
  }, {});
  const getCompoundVariantClassNames = config === null || config === undefined ? undefined : (_config_compoundVariants = config.compoundVariants) === null || _config_compoundVariants === undefined ? undefined : _config_compoundVariants.reduce((acc, param) => {
    let { class: cvClass, className: cvClassName, ...compoundVariantOptions } = param;
    return Object.entries(compoundVariantOptions).every((param) => {
      let [key, value] = param;
      return Array.isArray(value) ? value.includes({
        ...defaultVariants,
        ...propsWithoutUndefined
      }[key]) : {
        ...defaultVariants,
        ...propsWithoutUndefined
      }[key] === value;
    }) ? [
      ...acc,
      cvClass,
      cvClassName
    ] : acc;
  }, []);
  return cx(base, getVariantClassNames, getCompoundVariantClassNames, props === null || props === undefined ? undefined : props.class, props === null || props === undefined ? undefined : props.className);
};

// node_modules/cn/dist/tables.js
var P = 48;
var U = (s, o = 0) => {
  const out = new Int32Array(s.length);
  for (let i = 0;i < s.length; i++)
    out[i] = s.charCodeAt(i) - P - o;
  return out;
};
var PS = (counts) => {
  const out = new Int32Array(counts.length + 1);
  for (let i = 0;i < counts.length; i++)
    out[i + 1] = out[i] + counts[i];
  return out;
};
var DZ = (s) => {
  const out = new Int32Array(s.length);
  let a = 0;
  for (let i = 0;i < s.length; i++) {
    const z = s.charCodeAt(i) - P;
    a += z >>> 1 ^ -(z & 1);
    out[i] = a;
  }
  return out;
};
var GROUP_COUNT = 384;
var customValidatorNames = [];
var edgeStart = PS(U("E0500002005282000000002000150000020021820000011200000003022202000300004200120000200420001200021200301200010400162000010000220021010:2192001200220012000220012000200200200400010200040000000000400200108200110100000022010313000162002000020020012020080213000228200000000082000000000120002000120020020040101020300130001001010"));
var labelStart = PS(U(":11111111211111119311546544411119731869:671397415686432441111111111161114151214313433415:78311132233313187211117221449443411141111151152226611131111112212518142224214215421421542142424242516171151615616347111111111197911327451111111111111111111113134714133513411111311111111111111111111112444411111342312715245411117:3"));
var labelText = "@containerabcdefghinlmoprstunderlineviawzccentlignnimatespectuto-colsrowsaglorightnessckdrop-sisbcontrastfiltergrayscalehue-rotateinvertopacityslurrightnessaturateepia-coniclinearpositionradialsizeockurrderttom-belrstxyespacing-xyaretoursorlnt-umnsendspantartainentrasteividerop-shadowurationcorationlay-xyasendillexontromlter-featuresstretchapr-xyayscaleidow-colsrowsue-rotatedentlinesetvert-beringsxyeshadoweiadingftnest-clamp-imageabein-lrstxyskx--b-coniclpositionrsizet-x-y-fromto-fromto-inearfromto-fromto-adialfromto-fromtofromtofromtofromtoblockhinlinew-screenesblockhinlinewbjectpacityrutlinederigin-offsetbelrstxyesrspective-originaceholderioghtng-offsettateundedw-xyz-belrstlreseslr-endspantartaturatecepiahizekewpace-taleroll-xyz-barmpbelrstxyesbelrstxyes-thumbrackadowrink-xyxyartrokeabextora-shadowpckingnsformitionlate-xyz-offsetill-changeoom";
var edgeTarget = (() => {
  const N = edgeStart.length - 1;
  const sizes = new Int32Array(N);
  for (let i = N - 1;i >= 0; i--) {
    let s = 1;
    let c = i + 1;
    for (let k = edgeStart[i];k < edgeStart[i + 1]; k++) {
      s += sizes[c];
      c += sizes[c];
    }
    sizes[i] = s;
  }
  const out = new Int32Array(edgeStart[N]);
  let e = 0;
  for (let i = 0;i < N; i++) {
    let c = i + 1;
    for (let k = edgeStart[i];k < edgeStart[i + 1]; k++) {
      out[e++] = c;
      c += sizes[c];
    }
  }
  return out;
})();
var nodeGroup = U("02000000000000900<=0?000B000F00F00ŏI0J0LNPRTVX0000]_a00000000000000000000000rst0000000zŏ00000000000ŏ0000000ŏ00000000000000000000000000000000000000000000000000000000000000Ë000000000000000000000Þ000000000000000000ð0000000ø0ùúûüýþÿĀāĂăĄąĆ000000000000000000000000000000000000000000ħ0ĨĪ00000000000000000000ļĽ00000Ŭ000000", 1);
var vlistPat = PS(U("123333359346463635126536711576"));
var vlistOps = U("93203242332583253248325D>E?F@03263243255B:032523853:0325B:8GA032542H<C=12727B:0328432553;D>E?3257D>032585:0325B:;0328B:032");
var vlistRef = U("012113445661666666789111:5;;;;;;;;444;;;:62999<1161=62>>?61:21@ABCD4446996:64E:::;:?::64:F114GHHIHHHHIHH1HH1HH1HHHHHH::EEJ4444::EE4444441691;644444114244444:;K6666555555555555555999666664444444444444444444444226?6:66644L9M?D:111::::6DE199");
var vlistGroup = DZ("020200202020020020020020020020200200200200200200200002020202001003040106000200200200200200200200200200200200200200200200200200200200200200200200200200200200020020020020020020002020200202002002002002002002002002002020002002020020200220200200200200200200200200200200020020020000200020002000200200200020020020002000200200200020020202002020202000200200020022000200200020020002002000200220002002000200W0Z00020020002002020002002000200g0j0002002000200200020020002002000200200020020002000200002000002002002002002000200020000200002002002002002002002020020020200200200200200200200200202020020020020020020020020002002002020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020002002002002002002000200200200200200200200200200020202020002000200020002002002002000020200200");
var nodeVlist = (() => {
  const out = (/* @__PURE__ */ new Int32Array(319)).fill(-1);
  const A = DZ("02422242:222222242224222242442222222422222244442242226224222426222422442462222422622222222626222462242622422622422424242422222222422222222242422222222222222222622442224222222222222224424442262222222222222222222226224222424242422224422422422222");
  const V = DZ("02222222222222222222202222222222222222222222221422222222222222222222222222222222222Y\\222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222221422222222222222222222222222222222222222Ŀł222222222222222222");
  for (let i = 0;i < A.length; i++)
    out[A[i]] = V[i];
  return out;
})();
var SETS = "container |break-after- all auto avoid avoid-page column left page right|break-before- all auto avoid avoid-page column left page right|break-inside-a uto void void-column void-page|box-decoration- clone slice|box- border content| contents flow-root hidden table table-caption table-cell table-column table-column-group table-footer-group table-header-group table-row table-row-group| not-sr-only sr-only|float- end left none right start|clear- both end left none right start|isolat e ion-auto|overflow- auto clip hidden scroll visible|overflow-x- auto clip hidden scroll visible|overflow-y- auto clip hidden scroll visible|overscroll- auto contain none|overscroll-x- auto contain none|overscroll-y- auto contain none| absolute fixed relative static sticky| collapse invisible visible|justify- around baseline between center center-safe end end-safe evenly normal start stretch|justify-items- center center-safe end end-safe normal start stretch|justify-self- auto center center-safe end end-safe start stretch|items- baseline baseline-last center center-safe end end-safe start stretch|self- auto baseline baseline-last center center-safe end end-safe start stretch|place-content- around baseline between center center-safe end end-safe evenly start stretch|place-items- baseline center center-safe end end-safe start stretch|place-self- auto center center-safe end end-safe start stretch| antialiased subpixel-antialiased| italic not-italic|normal-nums |ordinal |slashed-zero | lining-nums oldstyle-nums| proportional-nums tabular-nums| diagonal-fractions stacked-fractions| no-underline overline| capitalize lowercase normal-case uppercase|truncate |whitespace- break-spaces normal nowrap pre pre-line pre-wrap|break- all keep normal words|wrap- anywhere break-word normal|hyphens- auto manual none|mix-blend- color color-burn color-dodge darken difference exclusion hard-light hue lighten luminosity multiply normal overlay plus-darker plus-lighter saturation screen soft-light|table- auto fixed|caption- bottom top|backface- hidden visible|appearance- auto none|scheme- dark light light-dark normal only-dark only-light|field-sizing- content fixed|pointer-events- auto none|resize  -none -x -y|snap- align-none center end start|snap- always normal|snap- both none x y|snap- mandatory proximity|touch- auto manipulation none|touch-pan- left right x|touch-pan- down up y|touch-pinch-zoom |select- all auto none text|forced-color-adjust- auto none| normal size| baseline bottom middle sub super text-bottom text-top top| bounce none ping pulse spin| auto square video| auto fr max min px|none | auto full px| fixed local scroll|clip- border content padding text|origin- border content padding| bottom bottom-left bottom-right center left left-bottom left-top right right-bottom right-top top top-left top-right| no-repeat repeat repeat-round repeat-space repeat-x repeat-y| auto contain cover| gradient-to-b gradient-to-bl gradient-to-br gradient-to-l gradient-to-r gradient-to-t gradient-to-tl gradient-to-tr none|blend- color color-burn color-dodge darken difference exclusion hard-light hue lighten luminosity multiply normal overlay saturation screen soft-light|to- b bl br l r t tl tr| auto dvh fit full lh lvh max min px screen svh| dashed dotted double hidden none solid| collapse separate|px |auto |full | content none strict| inline-size size|layout |paint |style | around baseline between center center-safe end end-safe evenly normal start stretch| alias all-scroll auto cell col-resize context-menu copy crosshair default e-resize ew-resize grab grabbing help move n-resize ne-resize nesw-resize no-drop none not-allowed ns-resize nw-resize nwse-resize pointer progress row-resize s-resize se-resize sw-resize text vertical-text w-resize wait zoom-in zoom-out| dashed dotted double solid wavy| auto from-font|reverse |initial | in in-out initial linear out| col col-reverse row row-reverse| nowrap wrap wrap-reverse| auto initial none| black bold extrabold extralight light medium normal semibold thin| condensed expanded extra-condensed extra-expanded normal semi-condensed semi-expanded ultra-condensed ultra-expanded|flow- col col-dense dense row row-dense| none subgrid| auto dvh dvw fit full lh lvh lvw max min px screen svh svw| block flex grid table| auto dvw fit full lvw max min px screen svw| loose none normal px relaxed snug tight|through |item | inside outside| decimal disc none| auto px| clip-border clip-content clip-fill clip-padding clip-stroke clip-view no-clip| add exclude intersect subtract| alpha luminance match|origin- border content fill padding stroke view|type- alpha luminance| circle ellipse| closest-corner closest-side farthest-corner farthest-side|at- bottom bottom-left bottom-right center left left-bottom left-top right right-bottom right-top top top-left top-right| dvh fit full lh lvh max min none px screen svh| auto dvh dvw fit full lh lvh lvw max min none px screen svh svw| dvw fit full lvw max min none px screen svw| auto dvh dvw fit full lvh lvw max min none prose px svh svw| auto dvh dvw fit full lvh lvw max min none px screen svh svw| contain cover fill none scale-down| first last none| distant dramatic midrange near none normal|inset | full none|3d | auto smooth|gutter- auto both stable| auto none thin| inner none| auto dvh dvw fit full lvh lvw max min px svh svw|base | center end justify left right start| clip ellipsis| balance nowrap pretty wrap| normal tight tighter wide wider widest| cpu gpu none| 3d flat| all colors none opacity shadow transform| discrete normal| full px| auto dvh dvw fit full lvh lvw max min px screen svh svw| auto contents scroll transform".split("|").map((s) => {
  const tails = s.split(" ");
  const prefix = tails.shift();
  for (let i = 0;i < tails.length; i++)
    tails[i] = prefix + tails[i];
  return tails;
});
var AA = DZ("0000000000000000000000000000000000000000000000000000000000000262242:6@200000006:240B428:4422400002046044222426220026642642462026224222824220022400000000\\00N222422242222222224062242222222422226264222422222222222222442804222422222222222222222222220<4<0204260002444020204224422");
var AG = DZ("ɠ222222222222222222222222222222222222222222222222222222222222˕4222226>ʶ22ʷʺʷ2ʸʷ42ʴ2ʓ22>621422ɶ222ɹɼɷɺɷɺ22ɱ42222ɨ2ɧ26622ɘɓ244ƸƵ222]d24242ǖǓƚÄȫ2263ȨȥȨ2222222ǣ222222222222222222ǂƽ2ƾƵ2222222422222ƜƑ22222222222222222222144Ŧţ22Ţş222222222222222222222ĸ2ı68ĦģĦɡŰ4Ġ«®ĝ822ĔđĔ2ē2222622");
var AS = DZ("02222222222222222222222222222222222222222222222222222222222222222202022222222222EH2200IL021042222Y\\222IL0cf2e10j2222U00X202[^2y0000120|{~22:22|22222222222G000qOVI00000}2>40000B00000I¨©000¬00000000000000021M®­00°000000000000000000000222HGHa1º222¿2À2222ÉÌ000­°2±");
var litAnchor = /* @__PURE__ */ new Int32Array(995);
var litGroup = /* @__PURE__ */ new Int32Array(995);
var litPool = /* @__PURE__ */ new Int32Array(995);
var poolText = "";
var poolOffsets = /* @__PURE__ */ new Int32Array(1038);
{
  const tailRef = /* @__PURE__ */ new Map;
  let nextRef = 0;
  let e = 0;
  for (let i = 0;i < AA.length; i++)
    for (const tail of SETS[AS[i]]) {
      let r = tailRef.get(tail);
      if (r === undefined) {
        r = nextRef++;
        tailRef.set(tail, r);
        poolOffsets[r * 2] = poolText.length;
        poolOffsets[r * 2 + 1] = tail.length;
        poolText += tail;
      }
      litAnchor[e] = AA[i];
      litGroup[e] = AG[i];
      litPool[e] = r;
      e++;
    }
}
var adjGid = DZ("0b2N:222@R>F@286¦2@H2D266226FB22B2>BD\\6N22222Z222D222p");
var adjStart = PS(U("1::24444432:442:44:44>222222:44:4421322511111311111114"));
var adjTgt = DZ("24A;33N=C@H4A;33N=C@<27;83:;8393NQ:3NQʰ222ˉºŴŽ2R2=18cƴÅŇ=cĞÛC1ƈǝȈ:ħ25=11D3A@4=<1;1DEr25;11B3?<6;:371BCn9@7=<8192>2E121@9@EHE@9>2T25511<398454131<=V25511<398454131<=ƧNž2Đå242L222290000f22500ɛ000ǘ222");
var patGid = U("ĳ");
var patTgt = U("");
var postfixLookupGroups = U("1");
var orderSensitiveModifiers = "* ** after backdrop before details-content file first-letter first-line marker placeholder selection";
var tables_generated_default = {
  GROUP_COUNT,
  customValidatorNames,
  edgeStart,
  labelStart,
  labelText,
  edgeTarget,
  nodeGroup,
  nodeVlist,
  vlistPat,
  vlistOps,
  vlistRef,
  vlistGroup,
  litAnchor,
  litGroup,
  litPool,
  poolOffsets,
  poolText,
  adjGid,
  adjStart,
  adjTgt,
  patGid,
  patTgt,
  postfixLookupGroups,
  orderSensitiveModifiers
};

// node_modules/cn/dist/engine.js
var IS_JSC = "line" in /* @__PURE__ */ new Error;
var EXTERNAL = -1;
var DEAD = -1;
var fnv = (str, s, e) => {
  let h = 2166136261;
  for (let p = s;p < e; p++)
    h = Math.imul(h ^ str.charCodeAt(p), 16777619);
  return h;
};
var spanHash = (str, s, e) => {
  const len = e - s;
  let h = Math.imul(len, 2654435761) ^ str.charCodeAt(s);
  if (len > 3) {
    const q = len >> 2;
    const m = len >> 1;
    h = Math.imul(h ^ str.charCodeAt(s + 1) << 8 ^ str.charCodeAt(s + 2) << 16 ^ str.charCodeAt(s + q), 2246822507);
    h = Math.imul(h ^ str.charCodeAt(s + m) << 8 ^ str.charCodeAt(s + m + q) << 16 ^ str.charCodeAt(e - 3), 3266489909);
    h ^= str.charCodeAt(e - 2) << 8 ^ str.charCodeAt(e - 1) << 16;
    for (let p = s + 3, q = e - 4;p < s + 8 && p < q; p++, q--)
      h = Math.imul(h ^ str.charCodeAt(p) ^ str.charCodeAt(q) << 8, 16777619);
  }
  return h ^ h >>> 15 | 0;
};
var createEngine = (T, validatorImpls, options = {}) => {
  const { GROUP_COUNT, edgeStart, labelStart, labelText, edgeTarget, nodeGroup, nodeVlist, vlistPat, vlistOps, vlistRef, vlistGroup, litAnchor, litGroup, litPool, poolOffsets, poolText, adjGid, adjStart, adjTgt, patGid, patTgt, postfixLookupGroups, customValidatorNames, orderSensitiveModifiers } = T;
  const adjRow = new Int32Array(GROUP_COUNT).fill(-1);
  for (let i = 0;i < adjGid.length; i++)
    adjRow[adjGid[i]] = i;
  let maxAdj = 0;
  for (let r = 0;r + 1 < adjStart.length; r++) {
    const n = adjStart[r + 1] - adjStart[r];
    if (n > maxAdj)
      maxAdj = n;
  }
  let CLAIM_PER_TOKEN = 32;
  while (CLAIM_PER_TOKEN < 2 * (1 + maxAdj + patGid.length))
    CLAIM_PER_TOKEN <<= 1;
  const vgStart = new Int32Array(vlistRef.length + 1);
  for (let l = 0;l < vlistRef.length; l++)
    vgStart[l + 1] = vgStart[l] + vlistPat[vlistRef[l] + 1] - vlistPat[vlistRef[l]];
  const postfixLookupSet = new Uint8Array(GROUP_COUNT);
  for (let i = 0;i < postfixLookupGroups.length; i++)
    postfixLookupSet[postfixLookupGroups[i]] = 1;
  const nodeCount = edgeStart.length - 1;
  const nodeHasLit = new Uint8Array(nodeCount);
  let litMaxLen = 0;
  let litNoArb = true;
  for (let i = 0;i < litAnchor.length; i++) {
    nodeHasLit[litAnchor[i]] = 1;
    const len = poolOffsets[litPool[i] * 2 + 1];
    if (len > litMaxLen)
      litMaxLen = len;
    const c0 = poolText.charCodeAt(poolOffsets[litPool[i] * 2]);
    if (c0 === 91 || c0 === 40)
      litNoArb = false;
  }
  let LIT_SIZE = 1;
  while (LIT_SIZE < litAnchor.length * 2)
    LIT_SIZE <<= 1;
  const litTable = new Int32Array(LIT_SIZE).fill(-1);
  for (let i = 0;i < litAnchor.length; i++) {
    const off = poolOffsets[litPool[i] * 2];
    let idx = (fnv(poolText, off, off + poolOffsets[litPool[i] * 2 + 1]) ^ Math.imul(litAnchor[i], 2654435761) | 0) & LIT_SIZE - 1;
    while (litTable[idx] !== -1)
      idx = idx + 1 & LIT_SIZE - 1;
    litTable[idx] = i;
  }
  const litProbe = (anchor, input, s, e) => {
    let idx = (fnv(input, s, e) ^ Math.imul(anchor, 2654435761) | 0) & LIT_SIZE - 1;
    const len = e - s;
    for (;; ) {
      const entry = litTable[idx];
      if (entry === -1)
        return -1;
      if (litAnchor[entry] === anchor && poolOffsets[litPool[entry] * 2 + 1] === len) {
        const off = poolOffsets[litPool[entry] * 2];
        let ok = true;
        for (let k = 0;k < len; k++)
          if (poolText.charCodeAt(off + k) !== input.charCodeAt(s + k)) {
            ok = false;
            break;
          }
        if (ok)
          return litGroup[entry];
      }
      idx = idx + 1 & LIT_SIZE - 1;
    }
  };
  const cacheSize = options.cacheSize ?? 8192;
  const RAW_PREFIX = options.prefix ?? T.prefix ?? "";
  const FULL_PREFIX = RAW_PREFIX === "" ? "" : RAW_PREFIX + ":";
  const FPL = FULL_PREFIX.length;
  const vCustom = (customValidatorNames ?? []).map((name) => {
    const fn = validatorImpls && validatorImpls[name];
    if (!fn)
      throw new Error("cn: missing validator " + name);
    return fn;
  });
  const lengthUnitRegex = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/;
  const colorFunctionRegex = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix)\(.+\)$/;
  const shadowRegex = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/;
  const imageRegex = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/;
  let aKind = 0;
  let aLabelS = -1;
  let aLabelE = -1;
  let aValS = -1;
  let aValE = -1;
  const isWordCode = (c) => c >= 97 && c <= 122 || c >= 65 && c <= 90 || c >= 48 && c <= 57 || c === 95;
  const isUniWS = (c) => /\s/.test(String.fromCharCode(c));
  const analyzeArb = (input, s, e) => {
    aKind = 0;
    aLabelS = -1;
    if (e - s < 3)
      return;
    const c0 = input.charCodeAt(s);
    const cl = input.charCodeAt(e - 1);
    if (c0 === 91 && cl === 93)
      aKind = 1;
    else if (c0 === 40 && cl === 41)
      aKind = 2;
    else
      return;
    aValS = s + 1;
    aValE = e - 1;
    let p = s + 1;
    if (isWordCode(input.charCodeAt(p))) {
      p++;
      while (p < e - 1) {
        const c = input.charCodeAt(p);
        if (!isWordCode(c) && c !== 45)
          break;
        p++;
      }
      if (p < e - 2 && input.charCodeAt(p) === 58) {
        aLabelS = s + 1;
        aLabelE = p;
        aValS = p + 1;
      }
    }
  };
  const spanEq = (input, s, e, str) => {
    if (e - s !== str.length)
      return false;
    for (let i = 0;i < str.length; i++)
      if (input.charCodeAt(s + i) !== str.charCodeAt(i))
        return false;
    return true;
  };
  const fractionRegex = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/;
  const tshirtRegex = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/;
  const isNumStr = (v) => !!v && !Number.isNaN(Number(v));
  const spanIsNamedContainerQuery = (input, s, e) => {
    if (e - s < 11 || !spanEq(input, s, s + 10, "@container"))
      return false;
    if (input.charCodeAt(s + 10) === 47)
      return e - s >= 12;
    const c11 = input.charCodeAt(s + 11);
    return c11 === 115 && e - s >= 17 && spanEq(input, s + 10, s + 16, "-size/") || c11 === 110 && e - s >= 19 && spanEq(input, s + 10, s + 18, "-normal/");
  };
  const VKIND = [
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    2,
    2,
    2,
    2,
    2,
    2,
    2
  ];
  const VLABELS = "length|number|number weight|family-name|position percentage|length size bg-size|image url|shadow|length|family-name|position percentage|length size bg-size|image url|shadow|number weight".split("|").map((s) => s.split(" "));
  const VFALL = [
    2,
    3,
    1,
    0,
    0,
    0,
    4,
    5,
    0,
    0,
    0,
    0,
    0,
    1,
    1
  ];
  const runValidator = (op, input, s, e) => {
    if (op >= 10) {
      if (op >= 25)
        return vCustom[op - 25](input.slice(s, e));
      const i = op - 10;
      if (aKind !== VKIND[i])
        return false;
      if (aLabelS >= 0) {
        for (const L of VLABELS[i])
          if (spanEq(input, aLabelS, aLabelE, L))
            return true;
        return false;
      }
      switch (VFALL[i]) {
        case 0:
          return false;
        case 1:
          return true;
        case 2: {
          const v = input.slice(aValS, aValE);
          return lengthUnitRegex.test(v) && !colorFunctionRegex.test(v);
        }
        case 3:
          return isNumStr(input.slice(aValS, aValE));
        case 4:
          return imageRegex.test(input.slice(aValS, aValE));
        default:
          return shadowRegex.test(input.slice(aValS, aValE));
      }
    }
    switch (op) {
      case 0:
        return true;
      case 1:
        return aKind === 0;
      case 2:
        return aKind === 1;
      case 3:
        return aKind === 2;
      case 4:
        return fractionRegex.test(input.slice(s, e));
      case 5:
        return isNumStr(input.slice(s, e));
      case 6: {
        const v = input.slice(s, e);
        return !!v && Number.isInteger(Number(v));
      }
      case 7:
        return e > s && input.charCodeAt(e - 1) === 37 && isNumStr(input.slice(s, e - 1));
      case 8:
        return tshirtRegex.test(input.slice(s, e));
      default:
        return spanIsNamedContainerQuery(input, s, e);
    }
  };
  const orderSensitive = new Set(typeof orderSensitiveModifiers === "string" ? orderSensitiveModifiers.split(" ") : orderSensitiveModifiers);
  const internSpan = (map, input, s, e, imp, make) => {
    const h = fnv(input, s, e) ^ (imp ? 2654435769 : 0) | 0;
    let bucket = map.get(h);
    if (bucket !== undefined)
      outer:
        for (let b = 0;b < bucket.length; b++) {
          const en = bucket[b];
          if (en.imp !== imp || en.k.length !== e - s)
            continue;
          for (let i = 0;i < en.k.length; i++)
            if (en.k.charCodeAt(i) !== input.charCodeAt(s + i))
              continue outer;
          return en.id;
        }
    else
      map.set(h, bucket = []);
    const k = input.slice(s, e);
    const id = make(k);
    bucket.push({
      k,
      imp,
      id
    });
    return id;
  };
  let ctxByHash = /* @__PURE__ */ new Map;
  let ctxByCanon = /* @__PURE__ */ new Map;
  let nextCtxId = 2;
  const MAX_CTX = 4096;
  const canonicalizeContext = (raw, important) => {
    const mods = [];
    let dB = 0, dP = 0, start = 0;
    for (let i = 0;i < raw.length; i++) {
      const c = raw.charCodeAt(i);
      if (dB === 0 && dP === 0 && c === 58) {
        mods.push(raw.slice(start, i));
        start = i + 1;
      } else if (c === 91)
        dB++;
      else if (c === 93)
        dB--;
      else if (c === 40)
        dP++;
      else if (c === 41)
        dP--;
    }
    mods.push(raw.slice(start));
    let canonical = mods[0];
    if (mods.length > 1) {
      const result = [];
      let segment = [];
      for (const mod of mods)
        if (mod.charCodeAt(0) === 91 || orderSensitive.has(mod)) {
          if (segment.length) {
            result.push(...segment.sort());
            segment = [];
          }
          result.push(mod);
        } else
          segment.push(mod);
      if (segment.length)
        result.push(...segment.sort());
      canonical = result.join(":");
    }
    const key = important ? canonical + " !" : canonical;
    let id = ctxByCanon.get(key);
    if (id === undefined)
      ctxByCanon.set(key, id = nextCtxId++);
    return id;
  };
  let dynByHash = /* @__PURE__ */ new Map;
  let nextDynId = GROUP_COUNT;
  const MAX_DYN = GROUP_COUNT + 4096;
  const newDynId = () => nextDynId++;
  const ID_LIMIT = 2097152;
  const TOKEN_TABLE = 8192;
  const memoHash = new Int32Array(TOKEN_TABLE);
  const memoStr = new Array(TOKEN_TABLE).fill(null);
  const memoGid = new Int32Array(TOKEN_TABLE);
  const memoCtx = new Int32Array(TOKEN_TABLE);
  const memoFlags = new Uint8Array(TOKEN_TABLE);
  let memoTick = 0;
  const memoPut = (way0, input, ts, te, h, gid, ctxId, flags) => {
    let slot = way0;
    if (memoStr[way0] !== null) {
      if (memoStr[way0 | 1] === null)
        slot = way0 | 1;
      else if ((memoTick++ & 3) === 0)
        slot = way0 | memoTick >> 2 & 1;
      else
        return;
    }
    memoStr[slot] = input.slice(ts, te);
    memoHash[slot] = h;
    memoGid[slot] = gid;
    memoCtx[slot] = ctxId;
    memoFlags[slot] = flags;
  };
  const memoReset = () => memoStr.fill(null);
  let cap = 256;
  let tokI32 = [
    new Int32Array(cap),
    new Int32Array(cap),
    new Int32Array(cap),
    new Int32Array(cap)
  ];
  let [tokStart, tokEnd, tokGid, tokCtx] = tokI32;
  let tokFlags = new Uint8Array(cap);
  let keep = new Uint8Array(cap);
  const growTokens = () => {
    cap *= 2;
    tokI32 = tokI32.map((a) => {
      const n = new Int32Array(cap);
      n.set(a);
      return n;
    });
    [tokStart, tokEnd, tokGid, tokCtx] = tokI32;
    const nf = new Uint8Array(cap);
    nf.set(tokFlags);
    tokFlags = nf;
    keep = new Uint8Array(cap);
  };
  let ckptCap = 64;
  let ckptNode = new Int32Array(ckptCap);
  let ckptTail = new Int32Array(ckptCap);
  const claim0 = new Int32Array(GROUP_COUNT);
  let CLAIM_TABLE = 2048;
  let claimShift = 21;
  let claimKeys = new Float64Array(CLAIM_TABLE);
  let claimEpochs = new Int32Array(CLAIM_TABLE);
  let epoch = 0;
  const claimTest = (ctx, gid) => {
    if (ctx === 0 && gid < GROUP_COUNT) {
      if (claim0[gid] === epoch)
        return 1;
      claim0[gid] = epoch;
      return 0;
    }
    const key = ctx * 2097152 + gid + 1;
    let idx = Math.imul(key, 2654435761) >>> claimShift;
    for (;; ) {
      if (claimEpochs[idx] !== epoch)
        break;
      if (claimKeys[idx] === key)
        return 1;
      idx = idx + 1 & CLAIM_TABLE - 1;
    }
    claimKeys[idx] = key;
    claimEpochs[idx] = epoch;
    return 0;
  };
  const resolveAt = (input, bs, endPos, nodeAt, ckptAt) => {
    if (endPos - bs >= 2 && input.charCodeAt(bs) === 91 && input.charCodeAt(endPos - 1) === 93) {
      let colon = -1;
      for (let p = bs + 1;p < endPos - 1; p++)
        if (input.charCodeAt(p) === 58) {
          colon = p;
          break;
        }
      if (colon === -1 || colon === bs + 1)
        return EXTERNAL;
      return internSpan(dynByHash, input, bs + 1, colon, 0, newDynId);
    }
    if (nodeAt >= 0 && nodeGroup[nodeAt] >= 0)
      return nodeGroup[nodeAt];
    for (let k = ckptAt - 1;k >= 0; k--) {
      const tailStart = ckptTail[k];
      if (tailStart > endPos)
        continue;
      const nodeId = ckptNode[k];
      const tlen = endPos - tailStart;
      if (nodeHasLit[nodeId] === 1 && tlen > 0 && tlen <= litMaxLen) {
        const c0 = input.charCodeAt(tailStart);
        if (litNoArb === false || c0 !== 91 && c0 !== 40) {
          const g = litProbe(nodeId, input, tailStart, endPos);
          if (g >= 0)
            return g;
        }
      }
      const vl = nodeVlist[nodeId];
      if (vl < 0)
        continue;
      const pat = vlistRef[vl];
      const vs = vlistPat[pat];
      const ve = vlistPat[pat + 1];
      if (vs === ve)
        continue;
      analyzeArb(input, tailStart, endPos);
      const g0 = vgStart[vl] - vs;
      for (let v = vs;v < ve; v++)
        if (runValidator(vlistOps[v], input, tailStart, endPos))
          return vlistGroup[g0 + v];
    }
    return EXTERNAL;
  };
  const mergeClassList = (input) => {
    const n = input.length;
    let tokenCount = 0;
    let totalTokenChars = 0;
    let sawNonSpaceWS = false;
    if (nextCtxId > MAX_CTX || ctxByHash.size > MAX_CTX) {
      ctxByHash = /* @__PURE__ */ new Map;
      ctxByCanon = /* @__PURE__ */ new Map;
      nextCtxId = 2;
      memoReset();
    }
    if (nextDynId > MAX_DYN) {
      dynByHash = /* @__PURE__ */ new Map;
      nextDynId = GROUP_COUNT;
      memoReset();
    }
    let i = 0;
    while (i < n) {
      let c = input.charCodeAt(i);
      if (c === 32 || c >= 9 && c <= 13 || c >= 160 && isUniWS(c)) {
        if (c !== 32)
          sawNonSpaceWS = true;
        i++;
        continue;
      }
      const ts = i;
      let th = 0;
      while (i < n) {
        c = input.charCodeAt(i);
        if (c <= 32) {
          if (c === 32)
            break;
          if (c >= 9 && c <= 13) {
            sawNonSpaceWS = true;
            break;
          }
        } else if (c >= 160 && isUniWS(c)) {
          sawNonSpaceWS = true;
          break;
        }
        th = Math.imul(th ^ c, 16777619);
        i++;
      }
      const te = i;
      const len = te - ts;
      if (tokenCount === cap)
        growTokens();
      const t = tokenCount++;
      tokStart[t] = ts;
      tokEnd[t] = te;
      totalTokenChars += len;
      th ^= Math.imul(len, 2654435761);
      const h = th ^ th >>> 15 | 0;
      const way0 = h & 8190;
      {
        let hitAt = -1;
        if (memoHash[way0] === h && memoStr[way0] !== null && memoStr[way0].length === len)
          hitAt = way0;
        else if (memoHash[way0 | 1] === h && memoStr[way0 | 1] !== null && memoStr[way0 | 1].length === len)
          hitAt = way0 | 1;
        if (hitAt >= 0) {
          const s = memoStr[hitAt];
          let ok = true;
          for (let k = 0;k < len; k++)
            if (s.charCodeAt(k) !== input.charCodeAt(ts + k)) {
              ok = false;
              break;
            }
          if (ok) {
            tokGid[t] = memoGid[hitAt];
            tokCtx[t] = memoCtx[hitAt];
            tokFlags[t] = memoFlags[hitAt];
            continue;
          }
        }
      }
      let pts = ts;
      if (FPL !== 0) {
        if (te - ts <= FPL || !input.startsWith(FULL_PREFIX, ts)) {
          tokGid[t] = EXTERNAL;
          memoPut(way0, input, ts, te, h, EXTERNAL, 0, 0);
          continue;
        }
        pts = ts + FPL;
      }
      let depthB = 0, depthP = 0;
      let lastColon = -1, lastSlash = -1;
      for (let p = pts;p < te; p++) {
        const pc = input.charCodeAt(p);
        if (depthB === 0 && depthP === 0) {
          if (pc === 58) {
            lastColon = p;
            continue;
          }
          if (pc === 47) {
            lastSlash = p;
            continue;
          }
        }
        if (pc === 91)
          depthB++;
        else if (pc === 93)
          depthB--;
        else if (pc === 40)
          depthP++;
        else if (pc === 41)
          depthP--;
      }
      const modStart = lastColon >= pts ? lastColon + 1 : pts;
      let bs = modStart;
      let be = te;
      let important = false;
      let prefixShift = 0;
      if (be > bs && input.charCodeAt(be - 1) === 33) {
        important = true;
        be--;
      } else if (be > bs && input.charCodeAt(bs) === 33) {
        important = true;
        bs++;
        prefixShift = 1;
      }
      let postfixEnd = -1;
      if (lastSlash > modStart) {
        postfixEnd = lastSlash + prefixShift;
        if (postfixEnd >= be)
          postfixEnd = -1;
      }
      let feedStart = bs;
      if (be - bs > 1 && input.charCodeAt(bs) === 45)
        feedStart = bs + 1;
      let node = 0;
      let lp = 0;
      let le = 0;
      let pending = -1;
      let ckptTop = 0;
      if (nodeVlist[0] >= 0 || nodeHasLit[0] === 1) {
        ckptNode[0] = 0;
        ckptTail[0] = feedStart;
        ckptTop = 1;
      }
      let slashNode = DEAD;
      let slashCkpt = 0;
      for (let p = feedStart;p < be; p++) {
        if (p === postfixEnd) {
          slashNode = lp < le ? DEAD : node;
          slashCkpt = ckptTop;
        }
        if (node !== DEAD) {
          const cc = input.charCodeAt(p);
          let arrived = -1;
          if (lp < le) {
            if (labelText.charCodeAt(lp) === cc) {
              lp++;
              if (lp === le)
                arrived = node = pending;
            } else
              node = DEAD;
          } else {
            const es = edgeStart[node];
            const ee = edgeStart[node + 1];
            let next = DEAD;
            for (let e = es;e < ee; e++) {
              const ls = labelStart[e];
              if (labelText.charCodeAt(ls) === cc) {
                if (labelStart[e + 1] - ls === 1)
                  arrived = next = edgeTarget[e];
                else {
                  lp = ls + 1;
                  le = labelStart[e + 1];
                  pending = edgeTarget[e];
                  next = node;
                }
                break;
              }
            }
            node = next;
          }
          if (arrived >= 0 && (nodeVlist[arrived] >= 0 || nodeHasLit[arrived] === 1) && p + 1 < be && input.charCodeAt(p + 1) === 45) {
            if (ckptTop === ckptCap) {
              ckptCap *= 2;
              const nv = new Int32Array(ckptCap);
              nv.set(ckptNode);
              ckptNode = nv;
              const nt = new Int32Array(ckptCap);
              nt.set(ckptTail);
              ckptTail = nt;
            }
            ckptNode[ckptTop] = arrived;
            ckptTail[ckptTop] = p + 2;
            ckptTop++;
          }
        }
      }
      if (postfixEnd === be) {
        slashNode = lp < le ? DEAD : node;
        slashCkpt = ckptTop;
      }
      const endNode = lp < le ? DEAD : node;
      let gid;
      let hasPostfix = false;
      if (postfixEnd >= 0) {
        hasPostfix = true;
        gid = resolveAt(input, bs, postfixEnd, slashNode, slashCkpt);
        if (gid !== EXTERNAL && gid < GROUP_COUNT && postfixLookupSet[gid]) {
          const gidFull = resolveAt(input, bs, be, endNode, ckptTop);
          if (gidFull !== EXTERNAL && gidFull !== gid) {
            gid = gidFull;
            hasPostfix = false;
          }
        } else if (gid === EXTERNAL) {
          gid = resolveAt(input, bs, be, endNode, ckptTop);
          hasPostfix = false;
        }
      } else
        gid = resolveAt(input, bs, be, endNode, ckptTop);
      let ctxId = 0;
      let flags = 0;
      if (gid === EXTERNAL)
        tokGid[t] = EXTERNAL;
      else {
        flags = hasPostfix ? 1 : 0;
        ctxId = pts >= lastColon ? important ? 1 : 0 : internSpan(ctxByHash, input, pts, lastColon, important ? 1 : 0, (k) => canonicalizeContext(k, important));
        tokGid[t] = gid;
        tokFlags[t] = flags;
        tokCtx[t] = ctxId;
      }
      memoPut(way0, input, ts, te, h, gid, ctxId, flags);
    }
    if (tokenCount === 0)
      return "";
    if (tokenCount === 1)
      return tokStart[0] === 0 && tokEnd[0] === n ? input : input.slice(tokStart[0], tokEnd[0]);
    if (tokenCount * CLAIM_PER_TOKEN > CLAIM_TABLE) {
      while (tokenCount * CLAIM_PER_TOKEN > CLAIM_TABLE) {
        CLAIM_TABLE <<= 1;
        claimShift--;
      }
      claimKeys = new Float64Array(CLAIM_TABLE);
      claimEpochs = new Int32Array(CLAIM_TABLE);
    }
    if (nextCtxId >= ID_LIMIT || nextDynId >= ID_LIMIT)
      throw new Error("cn: too many distinct classes in one merge");
    epoch = epoch + 1 | 0;
    if (epoch === 0) {
      claim0.fill(0);
      claimEpochs.fill(0);
      epoch = 1;
    }
    let didDrop = false;
    for (let t = tokenCount - 1;t >= 0; t--) {
      const gid = tokGid[t];
      if (gid === EXTERNAL) {
        keep[t] = 1;
        continue;
      }
      const ctxId = tokCtx[t];
      if (claimTest(ctxId, gid) === 1) {
        keep[t] = 0;
        didDrop = true;
        continue;
      }
      keep[t] = 1;
      if (gid < GROUP_COUNT) {
        const r = adjRow[gid];
        if (r >= 0)
          for (let k = adjStart[r];k < adjStart[r + 1]; k++)
            claimTest(ctxId, adjTgt[k]);
        if (tokFlags[t] & 1) {
          for (let k = 0;k < patGid.length; k++)
            if (patGid[k] === gid)
              claimTest(ctxId, patTgt[k]);
        }
      }
    }
    if (!didDrop && !sawNonSpaceWS && n === totalTokenChars + tokenCount - 1)
      return input;
    let out = "";
    let t = 0;
    while (t < tokenCount) {
      if (!keep[t]) {
        t++;
        continue;
      }
      const runStart = tokStart[t];
      let runEnd = tokEnd[t];
      let u = t + 1;
      while (u < tokenCount && keep[u] && tokStart[u] === runEnd + 1 && input.charCodeAt(runEnd) === 32) {
        runEnd = tokEnd[u];
        u++;
      }
      if (out.length > 0)
        out += " ";
      out += input.slice(runStart, runEnd);
      t = u;
    }
    return out;
  };
  const DOOR_SIZE = 16384;
  const door = new Int32Array(DOOR_SIZE * 2);
  let doorBase = 0;
  let doorEpoch = 1;
  let cache = Object.create(null);
  let prevCache = Object.create(null);
  let cacheMap = /* @__PURE__ */ new Map;
  let prevCacheMap = /* @__PURE__ */ new Map;
  let cacheCount = 0;
  let doorMarks = 0;
  const rotateDoor = () => {
    doorBase ^= DOOR_SIZE;
    doorEpoch = doorEpoch + 1 | 0;
    doorMarks = 0;
  };
  const mergeCached = (input) => {
    let merged = cache[input];
    if (merged !== undefined)
      return merged;
    const hash = spanHash(input, 0, input.length);
    const slot = (hash & 16383) + doorBase;
    const wasSeen = door[slot] === (hash ^ doorEpoch) || door[slot ^ DOOR_SIZE] === (hash ^ doorEpoch - 1);
    if (wasSeen) {
      merged = prevCache[input];
      if (merged !== undefined) {
        cache[input] = merged;
        return merged;
      }
    }
    merged = mergeClassList(input);
    if (wasSeen) {
      cache[input] = merged;
      if (++cacheCount > cacheSize) {
        cacheCount = 0;
        prevCache = cache;
        cache = Object.create(null);
        rotateDoor();
      }
    } else {
      door[slot] = hash ^ doorEpoch;
      if (++doorMarks > DOOR_SIZE)
        rotateDoor();
    }
    return merged;
  };
  const mergeCachedMap = (input) => {
    let merged = cacheMap.get(input);
    if (merged !== undefined)
      return merged;
    const hash = spanHash(input, 0, input.length);
    const slot = (hash & 16383) + doorBase;
    const wasSeen = door[slot] === (hash ^ doorEpoch) || door[slot ^ DOOR_SIZE] === (hash ^ doorEpoch - 1);
    if (wasSeen) {
      merged = prevCacheMap.get(input);
      if (merged !== undefined) {
        cacheMap.set(input, merged);
        return merged;
      }
    }
    merged = mergeClassList(input);
    if (wasSeen) {
      cacheMap.set(input, merged);
      if (++cacheCount > cacheSize) {
        cacheCount = 0;
        prevCacheMap = cacheMap;
        cacheMap = /* @__PURE__ */ new Map;
        rotateDoor();
      }
    } else {
      door[slot] = hash ^ doorEpoch;
      if (++doorMarks > DOOR_SIZE)
        rotateDoor();
    }
    return merged;
  };
  const seenBefore = (input) => {
    const hash = spanHash(input, 0, input.length);
    const slot = (hash & 16383) + doorBase;
    if (door[slot] === (hash ^ doorEpoch) || door[slot ^ DOOR_SIZE] === (hash ^ doorEpoch - 1))
      return true;
    door[slot] = hash ^ doorEpoch;
    if (++doorMarks > DOOR_SIZE)
      rotateDoor();
    return false;
  };
  const mergeString = cacheSize === 0 ? mergeClassList : IS_JSC ? (input) => {
    const merged = cacheMap.get(input);
    return merged !== undefined ? merged : mergeCachedMap(input);
  } : mergeCached;
  const merge = function() {
    return arguments.length === 1 && typeof arguments[0] === "string" ? mergeString(arguments[0]) : mergeString(twJoin.apply(null, arguments));
  };
  return {
    merge,
    mergeString,
    seenBefore: cacheSize === 0 ? () => false : seenBefore,
    mergeUncached: mergeClassList
  };
};
var resolveValue = (v, clsxMode) => {
  if (!v)
    return "";
  if (typeof v === "string")
    return v;
  let out = "";
  if (typeof v.length === "number" && (clsxMode ? Array.isArray(v) : true)) {
    const arr = v;
    for (let i = 0;i < arr.length; i++) {
      const item = arr[i];
      if (!item)
        continue;
      const r = typeof item === "string" ? item : resolveValue(item, clsxMode);
      if (r) {
        if (out)
          out += " ";
        out += r;
      }
    }
    return out;
  }
  if (clsxMode) {
    if (typeof v === "number")
      return "" + v;
    if (typeof v === "object") {
      for (const k in v)
        if (v[k]) {
          if (out)
            out += " ";
          out += k;
        }
    }
  }
  return out;
};
var joinArgs = (args, clsxMode) => {
  let s = "";
  for (let i = 0;i < args.length; i++) {
    const a = args[i];
    if (!a)
      continue;
    const r = typeof a === "string" ? a : resolveValue(a, clsxMode);
    if (r) {
      if (s)
        s += " ";
      s += r;
    }
  }
  return s;
};
var twJoin = function() {
  return joinArgs(arguments, false);
};
var BUCKET_CAP = 256;
var BUCKET_MISS_CAP = 16;
var BUCKET_SKIP = 1024;
var CHURN_SIZE = 4096;
var wrapClsx = (mergeString, fresh) => {
  const seenBefore = fresh === undefined ? () => true : fresh.seenBefore;
  const mergeUncached = fresh === undefined ? mergeString : fresh.mergeUncached;
  let argCache = /* @__PURE__ */ new Map;
  let prevArgCache = /* @__PURE__ */ new Map;
  let argCount = 0;
  let lastHit = null;
  let churnKey = null;
  let churnOwn = [];
  let churnVal = [];
  let churnTick = 0;
  const churnLookup = (key, own, join) => {
    if (churnKey === null) {
      churnKey = new Array(CHURN_SIZE).fill("");
      churnOwn = new Array(CHURN_SIZE).fill("");
      churnVal = new Array(CHURN_SIZE).fill("");
    }
    const way0 = spanHash(key, 0, key.length) & 4094;
    if (churnKey[way0] === key && churnOwn[way0] === own)
      return churnVal[way0];
    if (churnKey[way0 | 1] === key && churnOwn[way0 | 1] === own)
      return churnVal[way0 | 1];
    const merged = mergeString(join ? own + " " + key : key);
    const slot = churnKey[way0] === "" ? way0 : way0 | (churnKey[way0 | 1] === "" ? 1 : churnTick++ & 1);
    churnKey[slot] = key;
    churnOwn[slot] = own;
    churnVal[slot] = merged;
    return merged;
  };
  const match3 = (e, v0, v1, v2) => {
    let k = 0;
    if (v0) {
      if (v0 !== e.a0)
        return false;
      k = 1;
    }
    if (v1) {
      if (v1 !== (k === 0 ? e.a0 : e.a1))
        return false;
      k++;
    }
    if (v2) {
      if (v2 !== (k === 0 ? e.a0 : k === 1 ? e.a1 : e.a2))
        return false;
      k++;
    }
    return k === e.t;
  };
  const matchN = (e, vals) => {
    const ea = e.a;
    let k = 0;
    for (let i = 0;i < vals.length; i++) {
      const v = vals[i];
      if (!v)
        continue;
      if (v !== ea[k])
        return false;
      k++;
    }
    return k === e.t;
  };
  const resolveArgs = (vals, probed) => {
    const nArgs = vals.length;
    const pred = lastHit === null ? null : lastHit.n;
    if (!probed) {
      if (pred !== null && matchN(pred, vals)) {
        lastHit = pred;
        return pred.r;
      }
      if (lastHit !== null && lastHit !== pred && matchN(lastHit, vals))
        return lastHit.r;
    }
    let first = "";
    let firstIdx = -1;
    let truthy = 0;
    let hasResolvedValue = false;
    for (let i = 0;i < nArgs; i++) {
      let v = vals[i];
      if (!v)
        continue;
      if (typeof v !== "string") {
        v = vals[i] = resolveValue(v, true);
        if (!v)
          continue;
        hasResolvedValue = true;
      }
      if (firstIdx < 0) {
        first = v;
        firstIdx = i;
      }
      truthy++;
    }
    if (truthy === 0)
      return "";
    if (truthy === 1)
      return mergeString(first);
    if (hasResolvedValue) {
      if (pred !== null && matchN(pred, vals)) {
        lastHit = pred;
        return pred.r;
      }
      if (lastHit !== null && lastHit !== pred && matchN(lastHit, vals))
        return lastHit.r;
    }
    let bucket = argCache.get(first);
    if (bucket === undefined) {
      bucket = prevArgCache.get(first);
      if (bucket !== undefined)
        argCache.set(first, bucket);
    }
    let hit = null;
    if (bucket !== undefined) {
      if (bucket.skip > 0) {
        bucket.skip--;
        lastHit = null;
        let joined = first;
        for (let i = firstIdx + 1;i < nArgs; i++) {
          const v = vals[i];
          if (v)
            joined += " " + v;
        }
        return churnLookup(joined, "", false);
      }
      const entries = bucket.e;
      outer:
        for (let b = 0;b < entries.length; b++) {
          const e = entries[b];
          if (e.t !== truthy)
            continue;
          const ea = e.a;
          let k = 1;
          for (let i = firstIdx + 1;i < nArgs; i++) {
            const v = vals[i];
            if (v && v !== ea[k++])
              continue outer;
          }
          hit = e;
          break;
        }
      if (hit !== null)
        bucket.miss = 0;
    }
    if (hit === null) {
      let joined = first;
      const a = [first];
      for (let i = firstIdx + 1;i < nArgs; i++) {
        const v = vals[i];
        if (!v)
          continue;
        joined += " " + v;
        a.push(v);
      }
      if (!seenBefore(joined))
        return mergeUncached(joined);
      hit = {
        r: mergeString(joined),
        t: a.length,
        a0: a[0],
        a1: a[1],
        a2: a[2] ?? "",
        a,
        n: null
      };
      if (bucket === undefined)
        argCache.set(first, bucket = {
          e: [],
          miss: 0,
          skip: 0,
          at: 0
        });
      else if (++bucket.miss > BUCKET_MISS_CAP) {
        bucket.miss = BUCKET_MISS_CAP;
        bucket.skip = BUCKET_SKIP;
        bucket.e.length = 0;
        bucket.at = 0;
      }
      const entries = bucket.e;
      if (entries.length < BUCKET_CAP)
        entries.push(hit);
      else {
        entries[bucket.at] = hit;
        bucket.at = bucket.at + 1 & 255;
      }
      if (++argCount > 1000) {
        argCount = 0;
        prevArgCache = argCache;
        argCache = /* @__PURE__ */ new Map;
      }
    }
    if (lastHit !== null && lastHit !== hit)
      lastHit.n = hit;
    lastHit = hit;
    return hit.r;
  };
  const mergeSingleValue = (value) => Array.isArray(value) ? resolveArgs(value.slice(), false) : mergeString(resolveValue(value, true));
  return function(v0, v1, v2) {
    const nArgs = arguments.length;
    if ((nArgs | 1) === 3) {
      const lh = lastHit;
      if (lh !== null) {
        const pred = lh.n;
        if (pred !== null && match3(pred, v0, v1, v2)) {
          lastHit = pred;
          return pred.r;
        }
        if (lh !== pred && match3(lh, v0, v1, v2))
          return lh.r;
      }
      if (nArgs === 2 && typeof v1 === "string" && v1 !== "") {
        const bucket = argCache.get(v0);
        if (bucket !== undefined && bucket.skip > 0) {
          bucket.skip--;
          lastHit = null;
          return churnLookup(v1, v0, true);
        }
      }
      return resolveArgs([
        v0,
        v1,
        v2
      ], true);
    }
    if (nArgs === 1)
      return typeof v0 === "string" ? mergeString(v0) : mergeSingleValue(v0);
    const lh = lastHit;
    if (lh !== null) {
      const pred = lh.n;
      if (pred !== null) {
        const pa = pred.a;
        let k = 0;
        let ok = true;
        for (let i = 0;i < nArgs; i++) {
          const v = arguments[i];
          if (!v)
            continue;
          if (v !== pa[k]) {
            ok = false;
            break;
          }
          k++;
        }
        if (ok && k === pred.t) {
          lastHit = pred;
          return pred.r;
        }
      }
      if (lh !== pred) {
        const la = lh.a;
        let k = 0;
        let ok = true;
        for (let i = 0;i < nArgs; i++) {
          const v = arguments[i];
          if (!v)
            continue;
          if (v !== la[k]) {
            ok = false;
            break;
          }
          k++;
        }
        if (ok && k === lh.t)
          return lh.r;
      }
    }
    const vals = [];
    for (let i = 0;i < nArgs; i++)
      vals.push(arguments[i]);
    return resolveArgs(vals, true);
  };
};

// node_modules/cn/dist/index.js
var instance = /* @__PURE__ */ createEngine(tables_generated_default);
var cn = /* @__PURE__ */ wrapClsx(instance.mergeString, instance);
var twMerge = instance.merge;
// node_modules/@radix-ui/react-slot/dist/index.mjs
var React2 = __toESM(require_react(), 1);

// node_modules/@radix-ui/react-compose-refs/dist/index.mjs
var React = __toESM(require_react(), 1);
var __defProp2 = Object.defineProperty;
var __name = (target, value) => __defProp2(target, "name", { value, configurable: true });
function setRef(ref, value) {
  if (typeof ref === "function") {
    return ref(value);
  } else if (ref !== null && ref !== undefined) {
    ref.current = value;
  }
}
__name(setRef, "setRef");
function composeRefs(...refs) {
  return (node) => {
    let hasCleanup = false;
    const cleanups = refs.map((ref) => {
      const cleanup = setRef(ref, node);
      if (!hasCleanup && typeof cleanup == "function") {
        hasCleanup = true;
      }
      return cleanup;
    });
    if (hasCleanup) {
      return () => {
        for (let i = 0;i < cleanups.length; i++) {
          const cleanup = cleanups[i];
          if (typeof cleanup == "function") {
            cleanup();
          } else {
            setRef(refs[i], null);
          }
        }
      };
    }
  };
}
__name(composeRefs, "composeRefs");
function useComposedRefs(...refs) {
  return React.useCallback(composeRefs(...refs), refs);
}
__name(useComposedRefs, "useComposedRefs");

// node_modules/@radix-ui/react-slot/dist/index.mjs
var __defProp3 = Object.defineProperty;
var __name2 = (target, value) => __defProp3(target, "name", { value, configurable: true });
function createSlot(ownerName) {
  const Slot2 = React2.forwardRef((props, forwardedRef) => {
    let { children, ...slotProps } = props;
    let slottableElement = null;
    let hasSlottable = false;
    const newChildren = [];
    children = useUnwrappedLazy(children);
    React2.Children.forEach(children, (maybeSlottable) => {
      if (isSlottable(maybeSlottable)) {
        hasSlottable = true;
        const slottable = maybeSlottable;
        let child = "child" in slottable.props ? slottable.props.child : slottable.props.children;
        while (isLazyComponent(child) && typeof use === "function") {
          child = use(child._payload);
        }
        slottableElement = getSlottableElementFromSlottable(slottable, child);
        newChildren.push(slottableElement?.props?.children);
      } else {
        newChildren.push(maybeSlottable);
      }
    });
    if (slottableElement) {
      slottableElement = React2.cloneElement(slottableElement, undefined, newChildren);
    } else if (!hasSlottable && React2.Children.count(children) === 1 && React2.isValidElement(children)) {
      slottableElement = children;
    }
    const slottableElementRef = slottableElement ? getElementRef(slottableElement) : undefined;
    const composedRef = useComposedRefs(forwardedRef, slottableElementRef);
    if (!slottableElement) {
      if (children || children === 0) {
        throw new Error(hasSlottable ? createSlottableError(ownerName) : createSlotError(ownerName));
      }
      return children;
    }
    const mergedProps = mergeProps(slotProps, slottableElement.props ?? {});
    if (slottableElement.type !== React2.Fragment) {
      mergedProps.ref = forwardedRef ? composedRef : slottableElementRef;
    }
    return React2.cloneElement(slottableElement, mergedProps);
  });
  Slot2.displayName = `${ownerName}.Slot`;
  return Slot2;
}
__name2(createSlot, "createSlot");
var Slot = /* @__PURE__ */ createSlot("Slot");
var SLOTTABLE_IDENTIFIER = Symbol.for("radix.slottable");
function createSlottable(ownerName) {
  const Slottable2 = /* @__PURE__ */ __name2((props) => ("child" in props) ? props.children(props.child) : props.children, "Slottable");
  Slottable2.displayName = `${ownerName}.Slottable`;
  Slottable2.__radixId = SLOTTABLE_IDENTIFIER;
  return Slottable2;
}
__name2(createSlottable, "createSlottable");
var getSlottableElementFromSlottable = /* @__PURE__ */ __name2((slottable, child) => {
  if ("child" in slottable.props) {
    if (!React2.isValidElement(child))
      return null;
    return React2.cloneElement(child, undefined, slottable.props.children(child.props.children));
  }
  return React2.isValidElement(child) ? child : null;
}, "getSlottableElementFromSlottable");
function mergeProps(slotProps, childProps) {
  const overrideProps = { ...childProps };
  for (const propName in childProps) {
    const slotPropValue = slotProps[propName];
    const childPropValue = childProps[propName];
    const isHandler = /^on[A-Z]/.test(propName);
    if (isHandler) {
      if (slotPropValue && childPropValue) {
        overrideProps[propName] = (...args) => {
          const result = childPropValue(...args);
          slotPropValue(...args);
          return result;
        };
      } else if (slotPropValue) {
        overrideProps[propName] = slotPropValue;
      }
    } else if (propName === "style") {
      overrideProps[propName] = { ...slotPropValue, ...childPropValue };
    } else if (propName === "className") {
      overrideProps[propName] = [slotPropValue, childPropValue].filter(Boolean).join(" ");
    } else if (propName === "aria-describedby") {
      overrideProps[propName] = concatAriaDescribedby(childPropValue, slotPropValue);
    }
  }
  return { ...slotProps, ...overrideProps };
}
__name2(mergeProps, "mergeProps");
function getElementRef(element) {
  let getter = Object.getOwnPropertyDescriptor(element.props, "ref")?.get;
  let mayWarn = getter && "isReactWarning" in getter && getter.isReactWarning;
  if (mayWarn) {
    return element.ref;
  }
  getter = Object.getOwnPropertyDescriptor(element, "ref")?.get;
  mayWarn = getter && "isReactWarning" in getter && getter.isReactWarning;
  if (mayWarn) {
    return element.props.ref;
  }
  return element.props.ref || element.ref;
}
__name2(getElementRef, "getElementRef");
function isSlottable(child) {
  return React2.isValidElement(child) && typeof child.type === "function" && "__radixId" in child.type && child.type.__radixId === SLOTTABLE_IDENTIFIER;
}
__name2(isSlottable, "isSlottable");
var REACT_LAZY_TYPE = Symbol.for("react.lazy");
function isLazyComponent(element) {
  return element != null && typeof element === "object" && "$$typeof" in element && element.$$typeof === REACT_LAZY_TYPE && "_payload" in element && isPromiseLike(element._payload);
}
__name2(isLazyComponent, "isLazyComponent");
function isPromiseLike(value) {
  return typeof value === "object" && value !== null && "then" in value;
}
__name2(isPromiseLike, "isPromiseLike");
function useUnwrappedLazy(value) {
  let unwrapped = value;
  while (isLazyComponent(unwrapped) && typeof use === "function") {
    unwrapped = use(unwrapped._payload);
  }
  return unwrapped;
}
__name2(useUnwrappedLazy, "useUnwrappedLazy");
function concatAriaDescribedby(...values) {
  const ids = /* @__PURE__ */ new Set;
  for (const value of values) {
    if (typeof value !== "string")
      continue;
    for (const id of String(value).trim().split(/\s+/)) {
      if (id)
        ids.add(id);
    }
  }
  return ids.size > 0 ? Array.from(ids).join(" ") : undefined;
}
__name2(concatAriaDescribedby, "concatAriaDescribedby");
var createSlotError = /* @__PURE__ */ __name2((ownerName) => {
  return `${ownerName} failed to slot onto its children. Expected a single React element child or \`Slottable\`.`;
}, "createSlotError");
var createSlottableError = /* @__PURE__ */ __name2((ownerName) => {
  return `${ownerName} failed to slot onto its \`Slottable\`. Expected \`Slottable\` to receive a single React element child.`;
}, "createSlottableError");
var use = React2[" use ".trim().toString()];
// app/components/ui/button.tsx
var jsx_dev_runtime = __toESM(require_jsx_dev_runtime(), 1);
var buttonVariants = cva("group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4", {
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground hover:bg-primary/80",
      outline: "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
      secondary: "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
      ghost: "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
      destructive: "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive",
      link: "text-primary underline-offset-4 hover:underline"
    },
    size: {
      default: "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
      xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
      sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
      lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
      icon: "size-8",
      "icon-xs": "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
      "icon-sm": "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
      "icon-lg": "size-9"
    }
  },
  defaultVariants: {
    variant: "default",
    size: "default"
  }
});
function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot : "button";
  return /* @__PURE__ */ jsx_dev_runtime.jsxDEV(Comp, {
    "data-slot": "button",
    "data-variant": variant,
    "data-size": size,
    className: cn(buttonVariants({ variant, size, className })),
    ...props
  }, undefined, false, undefined, this);
}

// app/hooks/useRemoteContent.ts
var import_react7 = __toESM(require_react(), 1);

// lib/accountApiPaths.ts
function buildAccountApiPath(accountId, suffix) {
  const normalizedSuffix = suffix ? suffix.startsWith("/") ? suffix : `/${suffix}` : "";
  return `/api/accounts/${encodeURIComponent(accountId)}${normalizedSuffix}`;
}

// lib/html/remoteContentSession.ts
var allowedMessages = new Set;
var readers = new Map;
var listeners = new Set;
var key = (accountId, messageId) => JSON.stringify([accountId, messageId]);
function retainRemoteContentDecision(accountId, messageId) {
  const messageKey = key(accountId, messageId);
  readers.set(messageKey, (readers.get(messageKey) ?? 0) + 1);
  return () => {
    const count = (readers.get(messageKey) ?? 1) - 1;
    if (count > 0)
      readers.set(messageKey, count);
    else {
      readers.delete(messageKey);
      if (allowedMessages.delete(messageKey))
        listeners.forEach((listener) => listener());
    }
  };
}
function hasLoadedRemoteContent(accountId, messageId) {
  return allowedMessages.has(key(accountId, messageId));
}
function loadRemoteContentOnce(accountId, messageId) {
  allowedMessages.add(key(accountId, messageId));
  listeners.forEach((listener) => listener());
}
function subscribeRemoteContent(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// app/hooks/useRemoteContent.ts
"use client";
var PREFERENCES_CHANGED = "noctua:remote-content-prefs";
function useRemoteContent(accountId, senderKey, messageKey) {
  const preferenceKey = JSON.stringify([accountId, senderKey]);
  const key = JSON.stringify([preferenceKey, messageKey]);
  const once = import_react7.useSyncExternalStore(subscribeRemoteContent, () => hasLoadedRemoteContent(accountId ?? "", messageKey), () => false);
  const [preference, setPreference] = import_react7.useState({ key: "", allowed: false });
  const [saveState, setSaveState] = import_react7.useState({ key: "", pending: false, error: "" });
  import_react7.useEffect(() => retainRemoteContentDecision(accountId ?? "", messageKey), [accountId, messageKey]);
  import_react7.useEffect(() => {
    if (!accountId || !senderKey)
      return;
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(buildAccountApiPath(accountId, "/prefs"));
        if (!response.ok)
          return;
        const { prefs } = await response.json();
        if (active)
          setPreference({ key: preferenceKey, allowed: senderAllowsRemoteContent(prefs, senderKey) });
      } catch {}
    };
    refresh();
    window.addEventListener(PREFERENCES_CHANGED, refresh);
    return () => {
      active = false;
      window.removeEventListener(PREFERENCES_CHANGED, refresh);
    };
  }, [accountId, preferenceKey, senderKey]);
  const alwaysAllow = async () => {
    if (!accountId || !senderKey)
      return;
    setSaveState({ key, pending: true, error: "" });
    try {
      const response = await fetch(buildAccountApiPath(accountId, "/prefs"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remoteContent: { allowedSenders: { [senderKey]: true } } })
      });
      if (!response.ok)
        throw new Error("Preferences could not be saved.");
      setPreference({ key: preferenceKey, allowed: true });
      setSaveState({ key, pending: false, error: "" });
      window.dispatchEvent(new Event(PREFERENCES_CHANGED));
    } catch {
      setSaveState({ key, pending: false, error: "Preferences could not be saved. Try again." });
    }
  };
  return {
    allowed: once || preference.key === preferenceKey && preference.allowed,
    loadOnce: () => loadRemoteContentOnce(accountId ?? "", messageKey),
    alwaysAllow,
    canAlwaysAllow: !!accountId && !!senderKey,
    saving: saveState.key === key && saveState.pending,
    error: saveState.key === key ? saveState.error : ""
  };
}

// app/components/HtmlMessage.module.css
var HtmlMessage_module_default = {
  htmlMessage: "htmlMessage_zvrs2w",
  frame: "frame_zvrs2w",
  framed: "framed_zvrs2w",
  unframed: "unframed_zvrs2w"
};

// lib/ui/fontSubsets.json
var fontSubsets_default = [
  {
    name: "latin",
    url: "/fonts/InterVariable-latin.woff2",
    unicodeRange: "U+0,U+20-7E,U+A0-AC,U+AE-FF,U+131,U+152-153,U+2BB-2BC,U+2C6,U+2DA,U+2DC,U+304,U+308,U+2000-200B,U+2010-2027,U+202F-2055,U+2057,U+205F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+FEFF"
  },
  {
    name: "vietnamese",
    url: "/fonts/InterVariable-vietnamese.woff2",
    unicodeRange: "U+102-103,U+110-111,U+128-129,U+168-169,U+1A0-1A1,U+1AF-1B0,U+300-301,U+303,U+309,U+323,U+1EA0-1EF9"
  },
  {
    name: "latin-ext",
    url: "/fonts/InterVariable-latin-ext.woff2",
    unicodeRange: "U+100-101,U+104-10F,U+112-127,U+12A-130,U+132-148,U+14A-151,U+154-167,U+16A-19F,U+1A2-1AE,U+1B1-1C3,U+1C5-254,U+256-27B,U+27E-284,U+286-290,U+292-2A4,U+2A6-2BA,U+2BD-2C5,U+2C7-2D9,U+2DB,U+2DD-2FF,U+302,U+306-307,U+30A,U+30C,U+30F,U+313,U+315,U+31B,U+326-328,U+32C,U+337-338,U+342-343,U+346-36F,U+1D00,U+1D0D,U+1D1B,U+1D43,U+1D47-1D49,U+1D4D,U+1D4F-1D50,U+1D52,U+1D56-1D58,U+1D5B,U+1D62-1D65,U+1D9C,U+1DA0,U+1DBB,U+1DBF-1DF5,U+1DFC-1E9B,U+1E9D-1E9F,U+1EFA-1EFF,U+2C7C,U+2C7F,U+A7FF"
  },
  {
    name: "greek",
    url: "/fonts/InterVariable-greek.woff2",
    unicodeRange: "U+374-376,U+37A-37F,U+384-38A,U+38C,U+38E-3A1,U+3A3-3D7,U+3DC-3DD,U+3F0-3F6,U+3F9-3FA,U+3FC-3FF,U+1F00-1F15,U+1F18-1F1D,U+1F20-1F45,U+1F48-1F4D,U+1F50-1F57,U+1F59,U+1F5B,U+1F5D,U+1F5F-1F7D,U+1F80-1FB4,U+1FB6-1FC4,U+1FC6-1FD3,U+1FD6-1FDB,U+1FDD-1FEF,U+1FF2-1FF4,U+1FF6-1FFE"
  },
  {
    name: "cyrillic",
    url: "/fonts/InterVariable-cyrillic.woff2",
    unicodeRange: "U+400-479,U+480-49D,U+4A0-4FF,U+52F,U+2DFF,U+A69F"
  },
  {
    name: "remainder",
    url: "/fonts/InterVariable-remainder.woff2",
    unicodeRange: "U+E3F,U+2070-2071,U+2074-208E,U+2090-209C,U+20A0-20AB,U+20AD-20AF,U+20B1-20B5,U+20B8-20BA,U+20BC-20C0,U+20DB-20DE,U+20E8,U+20F0,U+2100-2101,U+2103,U+2105-2106,U+2109,U+2113,U+2116-2117,U+211E-2121,U+2126,U+212A-212B,U+212E,U+2132,U+213B,U+214D,U+2150-217F,U+2183-2186,U+2189,U+2190,U+2192,U+2194-2199,U+21A9-21AA,U+21B0-21B1,U+21B3-21B5,U+21BA-21BB,U+21D0,U+21D2,U+21D4,U+21DE-21DF,U+21E4-21E5,U+21E7,U+21EA,U+2202,U+2205-2206,U+220F,U+2211,U+221A,U+221E,U+222B,U+2236,U+2248,U+2260,U+2264-2265,U+2295-2298,U+2303-2305,U+2318,U+2325-2327,U+232B,U+2380,U+2387,U+238B,U+23CE-23CF,U+2423,U+2460-2468,U+24B6-24CF,U+24EA,U+25A0-25A2,U+25AA,U+25B2-25B3,U+25B6-25B7,U+25BA-25BD,U+25C0-25C1,U+25C4-25C7,U+25CA-25CB,U+25CF,U+25E6,U+25EF,U+2600,U+2605-2606,U+263C,U+2661,U+2665,U+266A-266B,U+26A0,U+2713,U+2717,U+2756,U+2764,U+2780-2788,U+27EF,U+27F5-27FA,U+2913,U+2A38,U+2B06,U+2B12-2B13,U+2B1C,U+2B24,U+2E18,U+A92E,U+E000,U+E002-E05E,U+E06A-E0BD,U+E0C8-E0CC,U+E0DC-E0E6,U+E0F3-E0F5,U+E106,U+E109-E10A,U+E10C-E10F,U+E111-E113,U+E117-E118,U+E121-E122,U+E124,U+E12A-E15E,U+E163,U+E1C3,U+E1D2-E1DF,U+E1E1-E2DC,U+EE01-EE07,U+EE09-EE0A,U+EE0C-EE12,U+EE14,U+EE17,U+EE1D-EE45,U+EE47-EE84,U+EE87-EED6,U+EED8-EEE1,U+F6C3,U+1F12F-1F149,U+1F16A-1F16B,U+1F850,U+1F852"
  }
];

// lib/ui/fonts.ts
var APP_FONT_FAMILY = "Inter";
var APP_FONT_SUBSETS = fontSubsets_default;
var APP_FONT_STACK = `"${APP_FONT_FAMILY}", system-ui, -apple-system, sans-serif`;
var APP_FONT_FACE_CSS = APP_FONT_SUBSETS.map(({ url, unicodeRange }) => `@font-face { font-family: "${APP_FONT_FAMILY}"; font-style: normal; font-weight: 100 900; ` + `font-display: swap; src: url("${url}") format("woff2"); unicode-range: ${unicodeRange}; }`).join(`
`);

// app/components/HtmlMessage.tsx
var jsx_dev_runtime2 = __toESM(require_jsx_dev_runtime(), 1);
"use client";
var NOCTUA_EMAIL_CONTENT_CLASS = "noctua-email-content";
var NOCTUA_EMAIL_VIEWPORT_CLASS = "noctua-email-viewport";
var NOCTUA_EMAIL_VIEWPORT_DEFAULT_MARGIN_CLASS = "noctua-email-viewport--default-margin";
var NOCTUA_QUOTE_COLLAPSE_CLASS = "noctua-quote-collapse";
var NOCTUA_QUOTE_CONTENT_CLASS = "noctua-quote-collapse-content";
var QUOTE_ANIMATION_MS = 220;
var previewDocumentSequence = 0;
function scaleFontSizes(input) {
  return input.replace(/font-size\s*:\s*([0-9]*\.?[0-9]+)px/gi, "font-size: calc($1px * var(--font-scale))").replace(/font-size\s*:\s*([0-9]*\.?[0-9]+)pt/gi, "font-size: calc($1pt * var(--font-scale))").replace(/font-size\s*:\s*([0-9]*\.?[0-9]+)rem/gi, "font-size: calc($1rem * var(--font-scale))").replace(/font-size\s*:\s*([0-9]*\.?[0-9]+)em/gi, "font-size: calc($1em * var(--font-scale))");
}
function prefixSelectors(css, prefix) {
  return css.replace(/(^|})\s*([^@\s][^{]+)\{/g, (match, brace, selector) => {
    const next = selector.split(",").map((part) => `${prefix}${part.trim()}`).join(", ");
    return `${brace}
${next}{`;
  });
}
function extractPrefersColorScheme(css, theme) {
  let injected = "";
  let output = "";
  let i = 0;
  const lower = css.toLowerCase();
  while (i < css.length) {
    const mediaIndex = lower.indexOf("@media", i);
    if (mediaIndex === -1) {
      output += css.slice(i);
      break;
    }
    output += css.slice(i, mediaIndex);
    const openBrace = css.indexOf("{", mediaIndex + "@media".length);
    if (openBrace === -1) {
      output += css.slice(mediaIndex);
      break;
    }
    const header = css.slice(mediaIndex, openBrace);
    let depth = 1;
    let j = openBrace + 1;
    while (j < css.length && depth > 0) {
      const char = css[j];
      if (char === "{")
        depth += 1;
      if (char === "}")
        depth -= 1;
      j += 1;
    }
    const block = css.slice(openBrace + 1, j - 1);
    const headerLower = header.toLowerCase();
    if (headerLower.includes("prefers-color-scheme")) {
      const isDark = headerLower.includes("prefers-color-scheme: dark");
      const isLight = headerLower.includes("prefers-color-scheme: light");
      if (theme === "dark" && isDark || theme === "light" && isLight) {
        injected += `
${prefixSelectors(block, `html[data-theme="${theme}"] `)}`;
      }
    } else {
      output += css.slice(mediaIndex, j);
    }
    i = j;
  }
  return { stripped: output, injected };
}
function escapeAttribute2(value) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function getClosestAnchor(target) {
  if (!target || typeof target !== "object")
    return null;
  const element = target;
  const anchor = typeof element.closest === "function" ? element.closest("a") : null;
  if (!anchor)
    return null;
  return String(anchor.tagName || "").toUpperCase() === "A" ? anchor : null;
}
function isHashHref(href) {
  const trimmed = href?.trim();
  return !trimmed || trimmed.startsWith("#");
}
function isNoOpHref(href) {
  const trimmed = href?.trim();
  return !trimmed || trimmed === "#";
}
function getAnchorPreviewUrl(anchor) {
  if (!anchor)
    return null;
  const href = anchor.getAttribute("href")?.trim();
  if (!href || isHashHref(href))
    return null;
  return anchor.href || href;
}
function readBoundedText(element, limit) {
  let text = "";
  const collect = (node) => {
    for (let child = node.firstChild;child && text.length < limit; child = child.nextSibling) {
      if (child.nodeType === Node.TEXT_NODE) {
        text = (text + (child.textContent ?? "")).trimStart();
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        collect(child);
      }
    }
  };
  collect(element);
  return text.slice(0, limit);
}
function findQuoteBoundary(root) {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  for (let node = walker.nextNode();node; node = walker.nextNode()) {
    const element = node;
    const markers = {
      tagName: element.tagName,
      id: element.getAttribute("id") ?? "",
      className: element.getAttribute("class") ?? "",
      typeAttr: element.getAttribute("type") ?? ""
    };
    if (hasQuoteBoundaryMarker(markers))
      return element;
    if (isQuoteBoundaryText(readBoundedText(element, QUOTE_TEXT_SCAN_LIMIT)))
      return element;
  }
  return null;
}
function hasVisibleContentBefore(node) {
  for (let sibling = node.previousSibling;sibling; sibling = sibling.previousSibling) {
    if ((sibling.textContent ?? "").trim())
      return true;
    if (sibling.nodeType !== Node.ELEMENT_NODE)
      continue;
    const element = sibling;
    if (element.tagName === "IMG" || element.querySelector("img"))
      return true;
  }
  return false;
}
function promoteQuoteRoot(boundary, root) {
  let node = boundary;
  while (node.parentElement && node.parentElement !== root && !hasVisibleContentBefore(node)) {
    node = node.parentElement;
  }
  return node;
}
function isInsideTableLayout(node, root) {
  for (let ancestor = node.parentElement;ancestor && ancestor !== root; ancestor = ancestor.parentElement) {
    if (isTableLayoutTag(ancestor.tagName))
      return true;
  }
  return false;
}
function countVisibleTextChars(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent ?? "").replace(/\s+/g, "").length;
  }
  if (node.nodeType !== Node.ELEMENT_NODE)
    return 0;
  const tagName = node.tagName;
  if (tagName === "STYLE" || tagName === "SCRIPT" || tagName === "TEMPLATE")
    return 0;
  let total = 0;
  for (let child = node.firstChild;child; child = child.nextSibling) {
    total += countVisibleTextChars(child);
  }
  return total;
}
function collapseQuotedContent(doc, expanded, toggleLabel) {
  const root = doc.querySelector(`.${NOCTUA_EMAIL_CONTENT_CLASS}`);
  if (!root)
    return null;
  const boundary = findQuoteBoundary(root);
  if (!boundary)
    return null;
  const quoteRoot = promoteQuoteRoot(boundary, root);
  const parent = quoteRoot.parentElement;
  if (!parent || !canWrapQuoteInParent(parent.tagName))
    return null;
  if (isInsideTableLayout(quoteRoot, root))
    return null;
  let quotedTextLength = 0;
  for (let node = quoteRoot;node; node = node.nextSibling) {
    quotedTextLength += countVisibleTextChars(node);
  }
  const leadingTextLength = countVisibleTextChars(root) - quotedTextLength;
  if (!shouldCollapseQuote({ leadingTextLength, quotedTextLength }))
    return null;
  const details = doc.createElement("details");
  details.className = NOCTUA_QUOTE_COLLAPSE_CLASS;
  details.open = expanded;
  const summary = doc.createElement("summary");
  summary.title = toggleLabel;
  summary.setAttribute("aria-label", toggleLabel);
  summary.textContent = "•••";
  const content = doc.createElement("div");
  content.className = NOCTUA_QUOTE_CONTENT_CLASS;
  details.append(summary, content);
  parent.insertBefore(details, quoteRoot);
  for (let next = details.nextSibling;next; next = details.nextSibling) {
    content.appendChild(next);
  }
  return { details, content };
}
function attachQuoteAnimation(details, content, onSettled) {
  const view = details.ownerDocument.defaultView;
  const summary = details.querySelector("summary");
  if (!view || !summary || typeof content.animate !== "function")
    return null;
  let animation = null;
  let settleTimer = 0;
  let expandedIntent = details.open;
  const settle = (expanding) => {
    view.clearTimeout(settleTimer);
    settleTimer = 0;
    animation = null;
    content.style.overflow = "";
    if (!expanding)
      details.open = false;
    onSettled();
  };
  const handleClick = (event) => {
    if (view.document.hidden || view.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    event.preventDefault();
    const startHeight = animation ? content.getBoundingClientRect().height : null;
    animation?.cancel();
    view.clearTimeout(settleTimer);
    expandedIntent = !expandedIntent;
    const expanding = expandedIntent;
    if (expanding)
      details.open = true;
    const from = startHeight ?? (expanding ? 0 : content.scrollHeight);
    const to = expanding ? content.scrollHeight : 0;
    content.style.overflow = "hidden";
    animation = content.animate({ height: [`${from}px`, `${to}px`] }, { duration: QUOTE_ANIMATION_MS, easing: "ease" });
    animation.onfinish = () => settle(expanding);
    settleTimer = view.setTimeout(() => settle(expanding), QUOTE_ANIMATION_MS + 250);
  };
  const handleToggleSync = () => {
    if (!animation)
      expandedIntent = details.open;
  };
  summary.addEventListener("click", handleClick);
  details.addEventListener("toggle", handleToggleSync);
  return () => {
    view.clearTimeout(settleTimer);
    animation?.cancel();
    content.style.overflow = "";
    summary.removeEventListener("click", handleClick);
    details.removeEventListener("toggle", handleToggleSync);
  };
}
function buildPreviewDocument({
  html,
  safeHtml,
  darkMode,
  fontScale,
  zoom,
  showViewerFrame,
  hostViewportHeight,
  token,
  remoteContent
}) {
  const viewportUnit = typeof hostViewportHeight === "number" && Number.isFinite(hostViewportHeight) && hostViewportHeight > 0 ? hostViewportHeight / 100 : 8;
  const cleanedHtml = stripConditionalComments(html || "");
  const hasExplicitColor = /(^|[^-])color\s*:/i.test(cleanedHtml);
  let injectedCss = "";
  const viewportHtml = rewriteHtmlViewportHeightUnits(safeHtml);
  const withRewrites = viewportHtml.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_, css) => {
    const scaledCss = scaleFontSizes(css);
    const rewritten = extractPrefersColorScheme(scaledCss, darkMode ? "dark" : "light");
    if (rewritten.injected) {
      injectedCss += `
${rewritten.injected}`;
    }
    return `<style>${rewritten.stripped}</style>`;
  });
  const scaledHtml = scaleFontSizes(withRewrites);
  const { body, styles: styleBlocks, bodyAttrs } = extractBodyContent(scaledHtml);
  const blockquoteBorder = darkMode ? "#8aa7d4" : "#1847d5";
  const linkColor = darkMode ? "#b8d5ff" : "#1847d5";
  const quoteChipBackground = darkMode ? "#2b303b" : "#e8ebf0";
  const quoteChipHoverBackground = darkMode ? "#39404e" : "#dbe0e8";
  const quoteChipColor = darkMode ? "#aab4c4" : "#6b7480";
  const hostTextColor = hasExplicitColor ? "" : "color: var(--mail-view-fg, var(--text, #1a1a1a));";
  const bodyClassName = [NOCTUA_EMAIL_CONTENT_CLASS, "email-body", bodyAttrs.className].filter(Boolean).join(" ");
  const bodyId = escapeAttribute2(bodyAttrs.id || "NoctuaMessageViewBody");
  const bodyStyle = escapeAttribute2(stripBodyHeightStyles(bodyAttrs.style || ""));
  const contentMarkup = body ? `<div class="${escapeAttribute2(bodyClassName)}" id="${bodyId}" style="${bodyStyle}">${body}</div>` : `<div class="${NOCTUA_EMAIL_CONTENT_CLASS} email-body" id="NoctuaMessageViewBody">${scaledHtml}</div>`;
  return [
    "<!doctype html>",
    `<html id="noctua-email-root" data-theme="${darkMode ? "dark" : "light"}" data-noctua-preview="${token}">`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<meta http-equiv="Content-Security-Policy" content="${escapeAttribute2(messageHtmlCsp(remoteContent))}">`,
    '<meta name="referrer" content="no-referrer">',
    "<style>",
    APP_FONT_FACE_CSS,
    `:root { color-scheme: ${darkMode ? "dark" : "light"}; --zoom: ${zoom}; --font-scale: ${fontScale}; --noctua-vh: ${viewportUnit}px; }`,
    "html { width: 100%; min-width: 0; max-width: 100%; box-sizing: border-box; font-size: 100%; }",
    `body { margin: 0; width: 100%; min-width: 0; max-width: 100%; box-sizing: border-box; background: transparent; ${hostTextColor} font-size: 100%; }`,
    `.${NOCTUA_EMAIL_CONTENT_CLASS} { font-family: ${APP_FONT_STACK}; color: inherit; background: transparent; font-size: 100%; width: 100%; max-width: 100%; min-width: 0; box-sizing: border-box; }`,
    ".html-scale { transform: scale(var(--zoom)); transform-origin: top left; width: calc(100% / var(--zoom)); min-width: 0; box-sizing: border-box; }",
    `.${NOCTUA_EMAIL_VIEWPORT_CLASS} { width: 100%; max-width: 100%; min-width: 0; box-sizing: border-box; overflow-x: auto; }`,
    `.${NOCTUA_EMAIL_VIEWPORT_DEFAULT_MARGIN_CLASS} { padding: 8px; }`,
    ".email-body { width: 100%; max-width: 100%; min-width: 0; box-sizing: border-box; }",
    `a { color: ${linkColor}; }`,
    "img { max-width: 100%; height: auto; }",
    `.${NOCTUA_EMAIL_CONTENT_CLASS} p, .${NOCTUA_EMAIL_CONTENT_CLASS} div, .${NOCTUA_EMAIL_CONTENT_CLASS} span { max-width: 100%; }`,
    `blockquote { border-left: 3px solid ${blockquoteBorder}; margin: 8px 0; padding-left: 12px; }`,
    "pre { white-space: pre-wrap; }",
    `details.${NOCTUA_QUOTE_COLLAPSE_CLASS} { margin: 12px 0 0; padding-bottom: 18px; }`,
    `details.${NOCTUA_QUOTE_COLLAPSE_CLASS} > summary { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 15px; border-radius: 8px; background: ${quoteChipBackground}; color: ${quoteChipColor}; font: 500 11px/1 system-ui, -apple-system, sans-serif; letter-spacing: 0.5px; cursor: pointer; list-style: none; user-select: none; transition: background-color 120ms ease; }`,
    `details.${NOCTUA_QUOTE_COLLAPSE_CLASS} > summary:hover { background: ${quoteChipHoverBackground}; }`,
    `details.${NOCTUA_QUOTE_COLLAPSE_CLASS} > summary::marker { content: ""; }`,
    `details.${NOCTUA_QUOTE_COLLAPSE_CLASS} > summary::-webkit-details-marker { display: none; }`,
    injectedCss,
    "</style>",
    styleBlocks.join(`
`),
    `<style>html#noctua-email-root, html#noctua-email-root body, html#noctua-email-root .${NOCTUA_EMAIL_CONTENT_CLASS} { height: auto !important; min-height: 0 !important; max-height: none !important; }</style>`,
    "</head>",
    "<body>",
    '<div class="html-scale">',
    `<div class="${NOCTUA_EMAIL_VIEWPORT_CLASS} ${showViewerFrame ? NOCTUA_EMAIL_VIEWPORT_DEFAULT_MARGIN_CLASS : ""}">`,
    contentMarkup,
    "</div>",
    "</div>",
    "</body>",
    "</html>"
  ].join(`
`);
}
function HtmlMessage({
  html,
  darkMode,
  fontScale = 1,
  zoom = 1,
  accountId,
  senderKey,
  messageId,
  sanitizeHtml = sanitizeHtmlForDisplay
}) {
  const iframeRef = import_react8.useRef(null);
  const quoteStateRef = import_react8.useRef({ html: "", expanded: false });
  const setLinkPreviewUrl = useMessageLinkPreview();
  const t = useTranslations2("Reader");
  const cleanedHtml = stripConditionalComments(html || "");
  const showViewerFrame = shouldShowHtmlViewerFrame(cleanedHtml);
  const remote = useRemoteContent(accountId, senderKey, messageId ?? html);
  const remoteContent = remote.allowed ? "allow" : "block";
  const blockedHtml = import_react8.useMemo(() => sanitizeHtml(cleanedHtml), [cleanedHtml, sanitizeHtml]);
  const allowedHtml = import_react8.useMemo(() => sanitizeHtmlForDisplay(cleanedHtml, "allow"), [cleanedHtml]);
  const hasRemoteContent = blockedHtml !== allowedHtml;
  const safeHtml = remote.allowed ? allowedHtml : blockedHtml;
  import_react8.useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe)
      return;
    if (quoteStateRef.current.html !== html) {
      quoteStateRef.current = { html, expanded: false };
    }
    const previewToken = `preview-${previewDocumentSequence += 1}`;
    const previewDocument = buildPreviewDocument({
      html,
      safeHtml,
      darkMode,
      fontScale,
      zoom,
      showViewerFrame,
      hostViewportHeight: window.innerHeight,
      remoteContent,
      token: previewToken
    });
    let frameObserver = null;
    let documentObserver = null;
    let rafId = null;
    let bindRafId = null;
    let boundDocument = null;
    let removeDocumentListeners = null;
    let removeQuoteToggleListener = null;
    const getPreviewDocument = () => {
      const doc = iframe.contentDocument;
      if (doc?.documentElement?.dataset.noctuaPreview !== previewToken)
        return null;
      return doc.readyState === "loading" ? null : doc;
    };
    const scheduleHeightUpdate = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const doc = getPreviewDocument();
        if (!doc)
          return;
        const body = doc.body;
        const root = doc.documentElement;
        const nextHeight = body ? Math.max(body.scrollHeight, body.offsetHeight) : Math.max(root?.scrollHeight ?? 0, root?.offsetHeight ?? 0);
        iframe.style.height = `${Math.max(1, Math.ceil(nextHeight))}px`;
      });
    };
    const attachDocumentListeners = (doc) => {
      removeDocumentListeners?.();
      removeDocumentListeners = null;
      documentObserver?.disconnect();
      documentObserver = null;
      doc.querySelectorAll("a").forEach((link) => {
        if (isHashHref(link.getAttribute("href"))) {
          link.removeAttribute("target");
          link.removeAttribute("rel");
          return;
        }
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noreferrer noopener");
      });
      const handleClick = (event) => {
        const button = event.button;
        if (event.type === "click" ? button !== 0 : event.type !== "auxclick" || button !== 1)
          return;
        const anchor = getClosestAnchor(event.target);
        if (!anchor)
          return;
        const href = anchor.getAttribute("href");
        if (isNoOpHref(href))
          event.preventDefault();
        else if (isHashHref(href)) {
          event.preventDefault();
          let fragment = href.trim().slice(1);
          try {
            fragment = decodeURIComponent(fragment);
          } catch {
            return;
          }
          const target = doc.getElementById(fragment) ?? Array.from(doc.getElementsByName(fragment)).find((element) => element.tagName === "A");
          target?.scrollIntoView();
        } else {
          event.preventDefault();
          window.open(anchor.href, "_blank", "noopener,noreferrer");
        }
      };
      doc.addEventListener("click", handleClick);
      doc.addEventListener("auxclick", handleClick);
      const updateLinkPreview = (value) => {
        setLinkPreviewUrl(value);
      };
      const handleMouseOver = (event) => {
        updateLinkPreview(getAnchorPreviewUrl(getClosestAnchor(event.target)));
      };
      const handleMouseOut = (event) => {
        const currentAnchor = getClosestAnchor(event.target);
        if (!currentAnchor)
          return;
        const relatedAnchor = getClosestAnchor(event.relatedTarget);
        if (relatedAnchor === currentAnchor)
          return;
        updateLinkPreview(getAnchorPreviewUrl(relatedAnchor));
      };
      const handleFocusIn = (event) => {
        updateLinkPreview(getAnchorPreviewUrl(getClosestAnchor(event.target)));
      };
      const handleFocusOut = (event) => {
        updateLinkPreview(getAnchorPreviewUrl(getClosestAnchor(event.relatedTarget)));
      };
      const handleFrameMouseLeave = () => {
        updateLinkPreview(null);
      };
      const handleAssetLoad = () => {
        scheduleHeightUpdate();
      };
      doc.addEventListener("mouseover", handleMouseOver);
      doc.addEventListener("mouseout", handleMouseOut);
      doc.addEventListener("focusin", handleFocusIn);
      doc.addEventListener("focusout", handleFocusOut);
      iframe.addEventListener("mouseleave", handleFrameMouseLeave);
      doc.querySelectorAll("img").forEach((image) => {
        image.addEventListener("load", handleAssetLoad);
        image.addEventListener("error", handleAssetLoad);
      });
      if (typeof ResizeObserver !== "undefined") {
        documentObserver = new ResizeObserver(() => {
          scheduleHeightUpdate();
        });
        if (doc.documentElement)
          documentObserver.observe(doc.documentElement);
        if (doc.body)
          documentObserver.observe(doc.body);
      }
      doc.fonts?.ready?.then(() => {
        scheduleHeightUpdate();
      });
      removeDocumentListeners = () => {
        updateLinkPreview(null);
        doc.removeEventListener("click", handleClick);
        doc.removeEventListener("auxclick", handleClick);
        doc.removeEventListener("mouseover", handleMouseOver);
        doc.removeEventListener("mouseout", handleMouseOut);
        doc.removeEventListener("focusin", handleFocusIn);
        doc.removeEventListener("focusout", handleFocusOut);
        iframe.removeEventListener("mouseleave", handleFrameMouseLeave);
        doc.querySelectorAll("img").forEach((image) => {
          image.removeEventListener("load", handleAssetLoad);
          image.removeEventListener("error", handleAssetLoad);
        });
      };
    };
    const applyQuoteCollapse = (doc) => {
      removeQuoteToggleListener?.();
      removeQuoteToggleListener = null;
      const collapsed = collapseQuotedContent(doc, quoteStateRef.current.expanded, t("quotedText"));
      if (!collapsed)
        return;
      const { details, content } = collapsed;
      const handleToggle = () => {
        quoteStateRef.current = { html, expanded: details.open };
        scheduleHeightUpdate();
      };
      details.addEventListener("toggle", handleToggle);
      const detachAnimation = attachQuoteAnimation(details, content, scheduleHeightUpdate);
      removeQuoteToggleListener = () => {
        detachAnimation?.();
        details.removeEventListener("toggle", handleToggle);
      };
    };
    const bindPreviewDocument = () => {
      const doc = getPreviewDocument();
      if (!doc)
        return false;
      if (bindRafId !== null) {
        cancelAnimationFrame(bindRafId);
        bindRafId = null;
      }
      if (doc === boundDocument)
        return true;
      boundDocument = doc;
      applyQuoteCollapse(doc);
      attachDocumentListeners(doc);
      scheduleHeightUpdate();
      return true;
    };
    const pollForPreviewDocument = () => {
      bindRafId = requestAnimationFrame(() => {
        bindRafId = null;
        if (bindPreviewDocument())
          return;
        pollForPreviewDocument();
      });
    };
    const handleLoad = () => {
      bindPreviewDocument();
      scheduleHeightUpdate();
    };
    iframe.addEventListener("load", handleLoad);
    if (typeof ResizeObserver !== "undefined") {
      frameObserver = new ResizeObserver(() => {
        scheduleHeightUpdate();
      });
      frameObserver.observe(iframe);
    }
    iframe.srcdoc = previewDocument;
    pollForPreviewDocument();
    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      if (bindRafId !== null) {
        cancelAnimationFrame(bindRafId);
      }
      removeQuoteToggleListener?.();
      removeDocumentListeners?.();
      documentObserver?.disconnect();
      frameObserver?.disconnect();
      iframe.removeEventListener("load", handleLoad);
    };
  }, [darkMode, fontScale, html, remoteContent, safeHtml, setLinkPreviewUrl, showViewerFrame, t, zoom]);
  return /* @__PURE__ */ jsx_dev_runtime2.jsxDEV("div", {
    className: `${HtmlMessage_module_default.htmlMessage} ${showViewerFrame ? HtmlMessage_module_default.framed : HtmlMessage_module_default.unframed}`,
    children: [
      !remote.allowed && hasRemoteContent && /* @__PURE__ */ jsx_dev_runtime2.jsxDEV("div", {
        role: "status",
        className: "flex flex-wrap items-center gap-2 border-b border-border bg-muted px-3 py-2 text-sm text-muted-foreground",
        children: [
          /* @__PURE__ */ jsx_dev_runtime2.jsxDEV("span", {
            children: t("remoteBlocked")
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsx_dev_runtime2.jsxDEV(Button, {
            variant: "outline",
            size: "sm",
            onClick: remote.loadOnce,
            children: t("loadOnce")
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsx_dev_runtime2.jsxDEV(Button, {
            variant: "ghost",
            size: "sm",
            disabled: !remote.canAlwaysAllow || remote.saving,
            onClick: () => void remote.alwaysAllow(),
            children: t("alwaysLoadSender")
          }, undefined, false, undefined, this),
          !remote.canAlwaysAllow && /* @__PURE__ */ jsx_dev_runtime2.jsxDEV("span", {
            children: t("unknownSender")
          }, undefined, false, undefined, this),
          remote.error && /* @__PURE__ */ jsx_dev_runtime2.jsxDEV("span", {
            role: "alert",
            children: remote.error
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsx_dev_runtime2.jsxDEV("iframe", {
        ref: iframeRef,
        className: HtmlMessage_module_default.frame,
        title: t("htmlMessage"),
        scrolling: "no",
        sandbox: "allow-same-origin",
        referrerPolicy: "no-referrer"
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
var HtmlMessage_default = import_react8.memo(HtmlMessage);

// ../briefs/perf-html-sanitize/proto/sanitizeProto.ts
var import_sanitize_html2 = __toESM(require_sanitize_html());
var import_postcss3 = __toESM(require_postcss());
var SANITIZE_HTML_OPTIONS2 = {
  allowedTags: [
    ...import_sanitize_html2.default.defaults.allowedTags,
    "img",
    "picture",
    "source",
    "style",
    "html",
    "head",
    "meta",
    "body",
    "title",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "td",
    "th",
    "caption",
    "colgroup",
    "col",
    "center",
    "font",
    "u",
    "s",
    "strike"
  ],
  allowedAttributes: {
    "*": [
      "id",
      "class",
      "style",
      "title",
      "role",
      "dir",
      "lang",
      "xmlns",
      "xml:lang",
      "align",
      "valign",
      "bgcolor",
      "color",
      "width",
      "height"
    ],
    a: ["href", "name", "target", "rel"],
    source: ["srcset", "media", "type", "data-remote-srcset"],
    img: ["src", "srcset", "referrerpolicy", "data-remote-src", "data-remote-srcset", "alt", "title", "width", "height", "align"],
    table: ["border", "cellspacing", "cellpadding", "summary"],
    td: ["colspan", "rowspan", "headers", "scope"],
    th: ["colspan", "rowspan", "headers", "scope"],
    col: ["span"],
    colgroup: ["span"],
    font: ["face", "size"],
    body: ["bgcolor"],
    meta: ["charset", "name", "content"]
  },
  allowedSchemes: ["http", "https", "mailto", "tel", "cid"],
  allowedSchemesByTag: { img: ["http", "https", "data", "cid"], source: ["http", "https", "data", "cid"] },
  allowedClasses: { "*": [/.*/] },
  allowVulnerableTags: true,
  parser: { lowerCaseTags: true, lowerCaseAttributeNames: true }
};
var BLANK_IMAGE2 = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
function privateCss2(input, inline = false) {
  try {
    const root = import_postcss3.default.parse(inline ? `x{${input}}` : input);
    root.walkComments((comment) => {
      comment.remove();
    });
    root.walkAtRules((rule) => {
      if (!/^(media|supports|layer|container|keyframes|-webkit-keyframes|page|font-face)$/i.test(rule.name))
        rule.remove();
    });
    root.walkDecls((decl) => {
      const value = decl.value;
      if (/\\|(?:image-set|src)\s*\(/i.test(value) || /\\/.test(decl.prop)) {
        decl.remove();
        return;
      }
      const urls = [...value.matchAll(/url\s*\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi)];
      if (urls.some((match) => !isLocalMailResource(match[1] ?? match[2] ?? match[3] ?? "")) || (value.match(/url\s*\(/gi)?.length ?? 0) !== urls.length)
        decl.remove();
    });
    const output = root.toString();
    return inline ? output.slice(2, -1) : output;
  } catch {
    return "";
  }
}
function localSrcset2(input) {
  let rest = input.trim();
  while (rest) {
    const token = /^([^\s]+)/.exec(rest)?.[1];
    if (!token)
      return false;
    const url = token.replace(/,+$/, "");
    if (!isLocalMailResource(url))
      return false;
    rest = rest.slice(token.length).trimStart();
    if (!token.endsWith(",")) {
      const comma = rest.indexOf(",");
      if (comma < 0)
        return true;
      rest = rest.slice(comma + 1).trimStart();
    }
  }
  return true;
}
function memoCss() {
  const inlineCache = new Map;
  const blockCache = new Map;
  return (input, inline = false) => {
    const cache = inline ? inlineCache : blockCache;
    let out = cache.get(input);
    if (out === undefined) {
      out = privateCss2(input, inline);
      cache.set(input, out);
    }
    return out;
  };
}
function sanitizeNormalized(normalized, mode, css = privateCss2, onRemoteRewrite) {
  const block = mode === "block";
  const sanitized = import_sanitize_html2.default(normalized, {
    ...SANITIZE_HTML_OPTIONS2,
    transformTags: {
      "*": (tagName, original) => {
        const attribs = { ...original };
        delete attribs["http-equiv"];
        if (tagName === "meta" && attribs.name?.trim().toLowerCase() === "referrer") {
          delete attribs.name;
          delete attribs.content;
        }
        if (attribs.style)
          attribs.style = css(attribs.style, true);
        if (tagName === "img")
          attribs.referrerpolicy = "no-referrer";
        if (block && (tagName === "img" || tagName === "source")) {
          if (attribs.src && !isLocalMailResource(attribs.src)) {
            onRemoteRewrite?.();
            attribs["data-remote-src"] = attribs.src;
            attribs.src = BLANK_IMAGE2;
          }
          if (attribs.srcset && !localSrcset2(attribs.srcset)) {
            onRemoteRewrite?.();
            attribs["data-remote-srcset"] = attribs.srcset;
            delete attribs.srcset;
          }
        }
        return { tagName, attribs };
      }
    }
  });
  return sanitized.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_match, open, cssText, close) => `${open}${css(cssText)}${close}`);
}
function sanitizeSingle(input, mode = "block") {
  if (!input)
    return input;
  return sanitizeNormalized(normalizeHtmlStructure(input), mode);
}
function pairSharedNormalize(input) {
  if (!input)
    return { block: input, allow: input };
  const n = normalizeHtmlStructure(input);
  return { block: sanitizeNormalized(n, "block"), allow: sanitizeNormalized(n, "allow") };
}
function pairSharedCss(input) {
  if (!input)
    return { block: input, allow: input };
  const n = normalizeHtmlStructure(input);
  const css = memoCss();
  return { block: sanitizeNormalized(n, "block", css), allow: sanitizeNormalized(n, "allow", css) };
}
function pairSkipAllow(input) {
  if (!input)
    return { block: input, allow: input };
  const n = normalizeHtmlStructure(input);
  const css = memoCss();
  let rewrites = 0;
  const block = sanitizeNormalized(n, "block", css, () => {
    rewrites++;
  });
  const allow = rewrites ? sanitizeNormalized(n, "allow", css) : block;
  return { block, allow };
}
function pairSkipAllowNoMemo(input) {
  if (!input)
    return { block: input, allow: input };
  const n = normalizeHtmlStructure(input);
  let rewrites = 0;
  const block = sanitizeNormalized(n, "block", privateCss2, () => {
    rewrites++;
  });
  const allow = rewrites ? sanitizeNormalized(n, "allow") : block;
  return { block, allow };
}
function sanitizeNoCss(normalized, mode) {
  return sanitizeNormalized(normalized, mode, (s) => s);
}

// ../briefs/perf-html-sanitize/bench.ts
var [corpusDir, capturedPath, outPath, runsArg] = process.argv.slice(2);
var RUNS = Number(runsArg ?? 15);
var WARMUP = 3;
var runtime = typeof Bun !== "undefined" ? `bun ${Bun.version}` : `node ${process.version}`;
var today = (input) => ({ block: sanitizeHtmlForDisplay(input), allow: sanitizeHtmlForDisplay(input, "allow") });
var variants = {
  rebuiltSingle: (input) => ({ block: sanitizeSingle(input, "block"), allow: sanitizeSingle(input, "allow") }),
  A_sharedNormalize: pairSharedNormalize,
  B_sharedCss: pairSharedCss,
  C_skipAllow: pairSkipAllow
};
var corpus = readdirSync(corpusDir).filter((f) => f.endsWith(".html")).sort().map((f) => ({ name: f.replace(/\.html$/, ""), html: readFileSync(join(corpusDir, f), "utf8") }));
var captured = [...new Set(readFileSync(capturedPath, "utf8").split(`
`).filter(Boolean).map((line) => JSON.parse(line).input))];
var diffInputs = [
  ...corpus.flatMap((c) => [{ name: `corpus:${c.name}`, html: c.html }, { name: `corpus:${c.name}:cleaned`, html: stripConditionalComments(c.html) }]),
  ...captured.map((html, i) => ({ name: `test-payload:${i}`, html })),
  { name: "edge:empty", html: "" }
];
var diff = { inputs: diffInputs.length, mismatches: [], hasRemoteMismatch: [], skipAllowTaken: 0, remoteInputs: 0 };
for (const { name, html } of diffInputs) {
  const ref = today(html);
  const refHasRemote = ref.block !== ref.allow;
  if (refHasRemote)
    diff.remoteInputs++;
  for (const [vName, fn] of Object.entries(variants)) {
    const got = fn(html);
    if (got.block !== ref.block)
      diff.mismatches.push(`${vName} block ${name}`);
    if (got.allow !== ref.allow)
      diff.mismatches.push(`${vName} allow ${name}`);
    if (got.block !== got.allow !== refHasRemote)
      diff.hasRemoteMismatch.push(`${vName} ${name}`);
  }
  let rewrites = 0;
  if (html)
    sanitizeNormalized(normalizeHtmlStructure(html), "block", privateCss2, () => {
      rewrites++;
    });
  if (!rewrites)
    diff.skipAllowTaken++;
}
console.log(JSON.stringify({ runtime, diff }, null, 1));
function time(fn) {
  for (let i = 0;i < WARMUP; i++)
    fn();
  const t = [];
  for (let i = 0;i < RUNS; i++) {
    const s = performance.now();
    fn();
    t.push(performance.now() - s);
  }
  t.sort((a, b) => a - b);
  const q = (p) => t[Math.min(t.length - 1, Math.floor(p * (t.length - 1) + 0.5))];
  const r = (x) => Math.round(x * 1000) / 1000;
  return { median: r(q(0.5)), p25: r(q(0.25)), p75: r(q(0.75)), min: r(t[0]), max: r(t.at(-1)), runs: RUNS };
}
var results = [];
for (const { name, html } of corpus) {
  const cleaned = stripConditionalComments(html);
  const normalized = normalizeHtmlStructure(cleaned);
  const blocked = sanitizeHtmlForDisplay(cleaned);
  const styleAttrs = [];
  const styleBlocks = [];
  sanitizeNormalized(normalized, "block", (s, inline) => {
    (inline ? styleAttrs : styleBlocks).push(s);
    return s;
  });
  const uniqueCss = new Set(styleAttrs).size;
  let rewrites = 0;
  sanitizeNormalized(normalized, "block", privateCss2, () => {
    rewrites++;
  });
  const load = loadavg()[0];
  const passes = {
    stripConditionalComments: time(() => stripConditionalComments(html)),
    shouldShowHtmlViewerFrame: time(() => shouldShowHtmlViewerFrame(cleaned)),
    normalizeHtmlStructure: time(() => normalizeHtmlStructure(cleaned)),
    sanitizeHtmlCore_block_noCss: time(() => sanitizeNoCss(normalized, "block")),
    privateCss_all_calls_one_pass: time(() => {
      for (const s of styleAttrs)
        privateCss2(s, true);
      for (const s of styleBlocks)
        privateCss2(s);
    }),
    sanitizeHtmlForDisplay_block: time(() => sanitizeHtmlForDisplay(cleaned)),
    sanitizeHtmlForDisplay_allow: time(() => sanitizeHtmlForDisplay(cleaned, "allow")),
    today_pair: time(() => {
      sanitizeHtmlForDisplay(cleaned);
      sanitizeHtmlForDisplay(cleaned, "allow");
    }),
    A_sharedNormalize_pair: time(() => pairSharedNormalize(cleaned)),
    B_sharedCss_pair: time(() => pairSharedCss(cleaned)),
    C_skipAllow_pair: time(() => pairSkipAllow(cleaned)),
    D_skipAllowNoMemo_pair: time(() => pairSkipAllowNoMemo(cleaned)),
    buildPreviewDocument: time(() => buildPreviewDocument({ html, safeHtml: blocked, darkMode: false, fontScale: 1, zoom: 1, showViewerFrame: false, hostViewportHeight: 900, remoteContent: "block", token: "bench" }))
  };
  const row = { name, bytes: html.length, styleAttrs: styleAttrs.length, uniqueStyleAttrs: uniqueCss, styleBlocks: styleBlocks.length, remoteRewrites: rewrites, loadAtStart: load, loadAtEnd: loadavg()[0], passes };
  results.push(row);
  console.log(name, html.length, Object.fromEntries(Object.entries(passes).map(([k, v]) => [k, v.median])));
}
writeFileSync(outPath, JSON.stringify({ runtime, runs: RUNS, warmup: WARMUP, at: new Date().toISOString(), diff, results }, null, 2));
