// 템플릿 랜딩의 공통 스타일. 모든 규칙은 .lpt 아래로만 적용되고, 크기는 창이 아니라 .lpt 의 너비(cqw)를 따른다.
// 강의마다 바뀌는 것은 루트 style 속성의 색 변수(--ac 등)와 섹션의 바탕 클래스(t-*)뿐이다.
export const LANDING_CSS = `/* 루트: 크기 기준(container)이 되고, 사이트의 글자 설정이 안으로 새지 않게 다시 정한다 */
.lpt{container-type:inline-size;position:relative;max-width:800px;margin:0 auto;background:#fff;overflow:hidden;color:#15131a;font-family:Pretendard,-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;font-size:16px;font-weight:400;font-style:normal;line-height:1.62;letter-spacing:-.012em;text-align:left;text-transform:none;text-indent:0;white-space:normal;word-break:keep-all;overflow-wrap:anywhere;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%}

/* 사이트의 초기화 스타일(Tailwind preflight 등)이 있든 없든 같은 모양이 되도록 필요한 기본값을 직접 정한다 */
.lpt *,.lpt *::before,.lpt *::after{box-sizing:border-box}
.lpt p{margin:1em 0}
.lpt h1,.lpt h2,.lpt h3,.lpt h4{margin:0;font-size:inherit;font-weight:inherit}
.lpt ul,.lpt ol{list-style:none;margin:0;padding:0}
.lpt figure{margin:0}
.lpt img{display:block;max-width:100%;height:auto;border:0}
.lpt a{color:inherit;text-decoration:none}
.lpt b,.lpt strong{font-weight:bolder}
.lpt small{font-size:smaller}
.lpt th{font-weight:700;text-align:center}
.lpt details{display:block}
.lpt summary{display:list-item}

.lpt .sec{position:relative;font-size:clamp(16px,4.5cqw,20px);padding:clamp(68px,18cqw,120px) clamp(20px,6cqw,64px);text-align:center;background:var(--bg);color:var(--fg)}
.lpt .sec>*{position:relative}
.lpt .sec.tight-top{padding-top:0;background:var(--bg)}
.lpt .sec.tight-bot{padding-bottom:clamp(36px,9cqw,60px)}

/* 바탕 5종 */
.lpt .t-light{--bg:#fff;--fg:#15131a;--mute:#6d6878;--card:var(--l1);--card2:#fff;--line:rgba(20,10,40,.1);--hl:var(--ac);--chip:var(--ac-soft);--chipfg:var(--ac-deep)}
.lpt .t-tint{--bg:var(--l1);--fg:#15131a;--mute:#6d6878;--card:#fff;--card2:#fff;--line:rgba(20,10,40,.1);--hl:var(--ac);--chip:var(--ac-soft);--chipfg:var(--ac-deep)}
.lpt .t-dark{--bg:var(--d0);--fg:#fff;--mute:rgba(255,255,255,.62);--card:rgba(255,255,255,.07);--card2:rgba(255,255,255,.12);--line:rgba(255,255,255,.14);--hl:var(--ac-lite);--chip:rgba(255,255,255,.1);--chipfg:var(--ac-lite)}
.lpt .t-dark2{--bg:var(--d1);--fg:#fff;--mute:rgba(255,255,255,.62);--card:rgba(255,255,255,.07);--card2:rgba(255,255,255,.12);--line:rgba(255,255,255,.14);--hl:var(--ac-lite);--chip:rgba(255,255,255,.1);--chipfg:var(--ac-lite)}
.lpt .t-accent{--bg:var(--ac);--fg:var(--ac-ink);--mute:color-mix(in srgb,var(--ac-ink) 78%,transparent);--card:rgba(255,255,255,.14);--card2:#fff;--line:rgba(255,255,255,.3);--hl:var(--ac-pop);--chip:rgba(255,255,255,.18);--chipfg:var(--ac-ink)}
.lpt .t-dark,.lpt .t-dark2{background:radial-gradient(120% 60% at 50% 0%,color-mix(in srgb,var(--ac) 26%,transparent),transparent 70%),var(--bg)}
.lpt .t-accent{background:linear-gradient(180deg,var(--ac),var(--ac-deep))}

/* 글자 */
.lpt .h1{font-weight:900;font-size:clamp(35px,10.6cqw,68px);line-height:1.17;letter-spacing:-.04em;margin:0}
.lpt .h2{font-weight:900;font-size:clamp(29px,8.4cqw,52px);line-height:1.24;letter-spacing:-.035em;margin:0}
.lpt .h3{font-weight:800;font-size:clamp(21px,6cqw,32px);line-height:1.34;letter-spacing:-.03em;margin:0}
.lpt .lead{font-size:clamp(17px,4.9cqw,23px);line-height:1.55;color:var(--mute);font-weight:500;margin:0}
.lpt .lead b,.lpt .lead strong{color:var(--fg);font-weight:700}
.lpt .hl{color:var(--hl);font-style:normal}
.lpt .eyebrow{display:inline-block;font-weight:700;font-size:clamp(14px,3.9cqw,18px);padding:.5em 1.1em;border-radius:999px;background:var(--chip);color:var(--chipfg);letter-spacing:-.01em;margin:0 0 clamp(18px,5cqw,28px)}
.lpt .eyebrow.solid{background:var(--ac);color:var(--ac-ink)}
.lpt .gap-s{margin-top:clamp(14px,4cqw,22px)!important}.lpt .gap-m{margin-top:clamp(28px,7.5cqw,46px)!important}.lpt .gap-l{margin-top:clamp(48px,13cqw,84px)!important}
.lpt .note{list-style:none;padding:0;margin:clamp(22px,6cqw,34px) 0 0;text-align:left;font-size:clamp(13.5px,3.7cqw,16px);color:var(--mute);line-height:1.6}
.lpt .note li{padding-left:1em;text-indent:-1em}.lpt .note li:before{content:"* "}
.lpt .note li+li{margin-top:.3em}
.lpt .dots{width:2px;height:clamp(40px,11cqw,64px);margin:clamp(22px,6cqw,36px) auto;background:linear-gradient(var(--hl),transparent)}
.lpt .arrow{width:0;height:0;border:clamp(11px,3cqw,16px) solid transparent;border-top-color:var(--hl);border-bottom:0;margin:clamp(24px,7cqw,40px) auto}

/* 버튼 */
.lpt .btn{display:flex;align-items:center;justify-content:center;gap:.6em;width:100%;max-width:560px;margin:0 auto;padding:1.05em 1em;border-radius:999px;background:linear-gradient(180deg,color-mix(in srgb,var(--ac) 88%,#fff),var(--ac) 45%,var(--ac-deep));color:var(--ac-ink);font-weight:800;font-size:clamp(19px,5.6cqw,27px);text-decoration:none;letter-spacing:-.02em;box-shadow:0 14px 34px -10px color-mix(in srgb,var(--ac) 80%,transparent),inset 0 1px 0 rgba(255,255,255,.35);transition:transform .15s}
.lpt .btn:active{transform:scale(.98)}
.lpt .btn i{font-style:normal;font-weight:900;opacity:.75;letter-spacing:-.2em}
.lpt .t-accent .btn{background:#fff;color:var(--ac-deep);box-shadow:0 14px 34px -12px rgba(0,0,0,.5)}
.lpt .paynote{display:inline-block;margin-top:clamp(14px,4cqw,20px);padding:.5em 1em;background:rgba(0,0,0,.55);color:#fff;font-size:clamp(12.5px,3.4cqw,15px);border-radius:6px;line-height:1.5}
.lpt .when{display:inline-flex;align-items:center;gap:.5em;font-weight:700;font-size:clamp(15px,4.2cqw,19px)}
.lpt .live{display:inline-flex;align-items:center;gap:.45em;background:#e5294c;color:#fff;font-weight:800;border-radius:8px;padding:.3em .7em;font-size:clamp(14px,4cqw,18px)}
.lpt .live:before{content:"";width:.55em;height:.55em;border-radius:50%;background:#fff;animation:lpt-blink 1.4s infinite}
@keyframes lpt-blink{50%{opacity:.25}}

/* 카드·그림 */
.lpt .card{background:var(--card);border-radius:clamp(20px,5.5cqw,30px);padding:clamp(24px,6.5cqw,40px) clamp(20px,5.5cqw,36px)}
.lpt .card.line{border:1.5px solid var(--line)}
.lpt .card.glow .lead{font-size:clamp(15px,4.2cqw,19px)}
.lpt .card.glow{border:1.5px solid var(--hl);box-shadow:0 0 0 4px color-mix(in srgb,var(--hl) 16%,transparent),0 0 40px -6px color-mix(in srgb,var(--hl) 60%,transparent)}
.lpt .shot{border-radius:clamp(14px,4cqw,22px);overflow:hidden;background:#fff;box-shadow:0 18px 44px -18px rgba(0,0,0,.55);border:2px solid var(--hl)}
.lpt .shot img{width:100%}
.lpt .shot+.shot{margin-top:12px}
.lpt figcaption{font-size:clamp(13px,3.6cqw,15.5px);color:var(--mute);margin-top:.8em;line-height:1.5}
.lpt .photo{width:min(100%,440px);margin:0 auto;border-radius:clamp(22px,6cqw,34px);overflow:hidden}
.lpt .photo img{width:100%}
.lpt .pic{width:min(78%,360px);margin:0 auto;border-radius:24px;overflow:hidden}
.lpt .blend img{mix-blend-mode:multiply}

/* 첫 화면 */
.lpt .hook-sub{margin-bottom:clamp(10px,3cqw,16px)}
.lpt .titlebox{margin-top:clamp(36px,10cqw,60px)}
.lpt .titlebox .h2{margin-bottom:clamp(22px,6cqw,34px)}
.lpt .hero-photo{position:relative;margin-top:clamp(30px,8cqw,48px);border-radius:clamp(24px,6cqw,36px);overflow:hidden;background:#000}
.lpt .hero-photo img{width:100%}
.lpt .hero-photo .over{position:relative;margin:clamp(-70px,-15cqw,-50px) 0 0;padding:clamp(50px,15cqw,70px) 16px clamp(24px,6.5cqw,36px);background:linear-gradient(transparent,#000 clamp(50px,15cqw,70px));color:#fff;font-weight:800;font-size:clamp(19px,5.4cqw,30px);line-height:1.4;letter-spacing:-.03em}
.lpt .band{display:inline-block;background:var(--card2);padding:.18em .6em;font-weight:800;border-radius:4px}

/* 말풍선 */
.lpt .bubbles{display:flex;flex-direction:column;gap:clamp(10px,3cqw,16px);max-width:520px;margin:0 auto}
.lpt .bubble{padding:.75em 1.3em;border-radius:999px;font-weight:700;font-size:clamp(18px,5.2cqw,25px);background:#fff;color:#15131a;width:78%;align-self:flex-end;border-bottom-right-radius:6px}
.lpt .bubble:nth-child(even){align-self:flex-start;background:var(--ac);color:var(--ac-ink);border-radius:999px;border-bottom-left-radius:6px}
.lpt .t-light .bubble:nth-child(odd),.lpt .t-tint .bubble:nth-child(odd){background:var(--ac-soft)}
.lpt .quote{display:block;max-width:520px;margin:0 auto;text-align:left}
.lpt .quote p{margin:0 0 10px;display:inline-block;padding:.7em 1.1em;border-radius:20px;background:var(--card2);font-size:clamp(15.5px,4.3cqw,19px);font-weight:500;border:1px solid var(--line)}
.lpt .quote p:nth-child(odd){float:right;clear:both;border-bottom-right-radius:4px}
.lpt .quote p:nth-child(even){float:left;clear:both;border-bottom-left-radius:4px}
.lpt .quote:after{content:"";display:block;clear:both}

/* 고민 */
.lpt .moodbox{position:relative;border-radius:clamp(22px,6cqw,34px);overflow:hidden;background:#000;color:#fff}
.lpt .moodbox img{width:100%;opacity:.9}
.lpt .moodbox .q{position:absolute;left:0;right:0;top:0;padding:clamp(26px,8cqw,48px) 16px 60px;background:linear-gradient(rgba(0,0,0,.85),transparent);font-weight:800;font-size:clamp(22px,6.4cqw,36px);line-height:1.36;letter-spacing:-.03em}
.lpt .moodbox .q .hl{color:var(--ac-lite)}
.lpt .rows{list-style:none;margin:0 auto;padding:0;max-width:560px}
.lpt .rows li{padding:clamp(15px,4.2cqw,22px) 0;border-bottom:1px solid var(--line)}
.lpt .rows li:last-child{border:0}
.lpt .rows small{display:block;color:var(--mute);font-size:clamp(14.5px,4cqw,18px);font-weight:500}
.lpt .rows b{font-size:clamp(19px,5.4cqw,26px);font-weight:800;line-height:1.36;letter-spacing:-.03em}
.lpt .checks{list-style:none;margin:0 auto;padding:0;max-width:560px;text-align:left}
.lpt .checks li{position:relative;padding:.85em 1em .85em 2.8em;background:var(--card);border-radius:16px;font-weight:600}
.lpt .checks li+li{margin-top:10px}
.lpt .checks li:before{content:"";position:absolute;left:1em;top:1.15em;width:1.1em;height:.6em;border-left:3px solid var(--hl);border-bottom:3px solid var(--hl);transform:rotate(-45deg) scale(.8)}
.lpt .versus{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:stretch}
.lpt .versus>div{border-radius:clamp(18px,5cqw,26px);padding:clamp(18px,5cqw,28px) 10px;background:var(--card2);border:1.5px solid var(--line);display:flex;flex-direction:column;justify-content:flex-end}
.lpt .versus>div:last-child{background:var(--ac);color:var(--ac-ink);border-color:transparent}
.lpt .versus img{width:76%;margin:0 auto 12px;border-radius:14px}
.lpt .versus small{display:block;font-size:clamp(13.5px,3.7cqw,16px);opacity:.75}
.lpt .versus b{display:block;font-size:clamp(21px,6.2cqw,34px);font-weight:900;line-height:1.25;letter-spacing:-.04em}

/* 강사 */
.lpt .hello{font-size:clamp(17px,4.8cqw,22px);color:var(--mute);font-weight:500;margin:0}
.lpt .name{font-weight:900;font-size:clamp(46px,14cqw,88px);line-height:1.08;letter-spacing:-.05em;margin:.12em 0 0}
.lpt .name small{display:block;font-size:.5em;letter-spacing:-.04em;margin-top:.1em}
.lpt .career{list-style:none;padding:0;margin:0 auto;max-width:520px;text-align:left}
.lpt .career li{padding:.7em 0 .7em 1.2em;border-bottom:1px solid var(--line);position:relative;font-weight:600}
.lpt .career li:before{content:"";position:absolute;left:0;top:1.3em;width:6px;height:6px;border-radius:50%;background:var(--hl)}
.lpt .agelist{display:flex;flex-direction:column;gap:10px;max-width:480px;margin:0 auto}
.lpt .agelist div{background:#fff;color:#15131a;border-radius:999px;padding:.7em 1.2em;font-weight:800;font-size:clamp(20px,5.8cqw,28px);letter-spacing:-.03em;width:82%;box-shadow:0 10px 24px -12px rgba(0,0,0,.4)}
.lpt .agelist div:nth-child(even){align-self:flex-end}
.lpt .bignum{font-weight:900;font-size:clamp(44px,13.5cqw,84px);line-height:1.1;letter-spacing:-.05em;margin:0}
.lpt .bignum small{display:block;font-size:.36em;font-weight:700;letter-spacing:-.02em;opacity:.8;margin-bottom:.3em}

/* 증빙 */
.lpt .ba{display:flex;flex-direction:column;align-items:center}
.lpt .ba .from{font-size:clamp(26px,7.6cqw,44px);font-weight:800;color:var(--mute);text-decoration:line-through;text-decoration-thickness:2px;letter-spacing:-.03em;line-height:1.2}
.lpt .ba .to{font-size:clamp(46px,14cqw,90px);font-weight:900;line-height:1.12;letter-spacing:-.05em;background:linear-gradient(#fff 30%,var(--ac-lite));-webkit-background-clip:text;background-clip:text;color:transparent}
.lpt .t-light .ba .to,.lpt .t-tint .ba .to{background:none;color:var(--ac-deep)}
.lpt .ba .chev{width:14px;height:14px;border-right:3px solid var(--hl);border-bottom:3px solid var(--hl);transform:rotate(45deg);margin:6px 0 14px}
.lpt .stair{display:flex;flex-direction:column;align-items:center;gap:clamp(16px,4.5cqw,26px)}
.lpt .stair div{line-height:1.15}
.lpt .stair small{display:block;font-weight:700;font-size:.42em;letter-spacing:-.01em;margin-bottom:.2em;opacity:.85}
.lpt .stair b{font-weight:900;letter-spacing:-.045em}
.lpt .stair .s0{font-size:clamp(28px,8cqw,44px)}.lpt .stair .s1{font-size:clamp(38px,11cqw,62px)}.lpt .stair .s2{font-size:clamp(52px,15.5cqw,96px)}
.lpt .stair .s2 b{background:linear-gradient(#fff 30%,var(--ac-lite));-webkit-background-clip:text;background-clip:text;color:transparent}
.lpt .t-light .stair .s2 b,.lpt .t-tint .stair .s2 b{background:none;color:var(--ac-deep)}
.lpt .stair i{width:0;height:0;border:9px solid transparent;border-top-color:var(--hl);border-bottom:0;opacity:.7}
.lpt .amounts{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(130px,1fr))}
.lpt .amounts div{background:var(--card);border-radius:18px;padding:18px 10px}
.lpt .amounts small{display:block;color:var(--mute);font-size:.8em}.lpt .amounts b{font-size:clamp(22px,6.4cqw,34px);font-weight:900;letter-spacing:-.04em}

/* 방법 */
.lpt .stack{display:flex;flex-direction:column;gap:10px;max-width:560px;margin:0 auto}
.lpt .stack div{padding:1em;border-radius:18px;background:var(--chip);color:var(--mute);font-weight:600;font-size:clamp(17px,4.9cqw,22px)}
.lpt .stack div:last-child{background:var(--ac);color:var(--ac-ink);font-weight:800}
.lpt .cmp{display:grid;grid-template-columns:1fr 1.12fr;align-items:stretch;text-align:center;max-width:620px;margin:0 auto}
.lpt .cmp>div{padding:0 0 clamp(20px,6cqw,32px)}
.lpt .cmp .old{background:var(--card);border-radius:20px 0 0 20px;margin:14px 0;color:var(--mute);font-size:clamp(14.5px,4cqw,18px)}
.lpt .cmp .new{background:#fff;color:#15131a;border-radius:22px;box-shadow:0 0 0 2px var(--ac),0 18px 44px -14px color-mix(in srgb,var(--ac) 75%,transparent);display:flex;flex-direction:column}
.lpt .cmp h4{margin:0 0 clamp(16px,5cqw,26px);padding:.9em .4em;font-size:clamp(15px,4.2cqw,19px);font-weight:700}
.lpt .cmp .old h4{background:rgba(128,128,128,.14);border-radius:20px 0 0 0}
.lpt .cmp .new h4{background:var(--ac);color:var(--ac-ink);border-radius:20px 20px 0 0;font-size:clamp(17px,4.9cqw,22px);font-weight:800}
.lpt .cmp .old p{margin:0 8px 1em;line-height:1.45}
.lpt .cmp ol{list-style:none;margin:0;padding:0}
.lpt .cmp ol li+li:before{content:"";display:block;width:8px;height:8px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg);margin:5px auto 9px;opacity:.6}
.lpt .cmp .new p{margin:auto 12px;font-size:clamp(17px,4.9cqw,23px);font-weight:600;line-height:1.5}
.lpt .cmp .new .hl{color:var(--ac);font-weight:800}
.lpt .pairs{width:100%;border-collapse:separate;border-spacing:0 8px;max-width:620px;margin:0 auto}
.lpt .pairs th{font-size:.85em;padding:.6em}.lpt .pairs td{padding:.9em .6em;background:var(--card);width:50%}
.lpt .pairs td:last-child,.lpt .pairs th:last-child{background:var(--ac);color:var(--ac-ink);font-weight:800}

/* 알려줄 것 */
.lpt .steps{display:grid;gap:12px;text-align:left;counter-reset:st}
.lpt .steps.g2{grid-template-columns:1fr 1fr}
.lpt .steps>div{counter-increment:st;background:var(--card);border:1.5px solid var(--line);border-radius:clamp(18px,5cqw,26px);padding:clamp(18px,5cqw,28px);position:relative}
.lpt .steps>div:before{content:counter(st,decimal-leading-zero);display:block;font-weight:900;font-size:clamp(26px,7.4cqw,40px);color:var(--hl);letter-spacing:-.04em;line-height:1;margin-bottom:.45em}
.lpt .steps b{display:block;font-weight:800;font-size:clamp(18px,5.1cqw,24px);line-height:1.35;letter-spacing:-.03em}
.lpt .steps p{margin:.4em 0 0;color:var(--mute);font-size:.92em;line-height:1.5}
.lpt .steps .tag{display:inline-block;margin-top:.7em;padding:.25em .7em;border-radius:999px;background:var(--chip);color:var(--chipfg);font-weight:700;font-size:.82em}

/* 선물 */
.lpt .gifts{display:flex;flex-direction:column;gap:14px;text-align:left;counter-reset:gf}
.lpt .gift{counter-increment:gf;display:grid;grid-template-columns:clamp(96px,28cqw,150px) 1fr;gap:clamp(12px,4cqw,24px);align-items:center;background:#fff;color:#15131a;border-radius:clamp(20px,5.5cqw,30px);padding:clamp(14px,4cqw,22px);box-shadow:0 18px 40px -22px rgba(0,0,0,.5)}
.lpt .gift.noimg{grid-template-columns:1fr;padding:clamp(22px,6cqw,32px)}
.lpt .gift img{border-radius:14px}
.lpt .gift .no{display:inline-block;font-weight:900;color:var(--ac-deep);font-size:clamp(15px,4.2cqw,19px);letter-spacing:.02em}
.lpt .gift .no:before{content:"혜택 " counter(gf,decimal-leading-zero)}
.lpt .gift small{display:block;color:#7a7585;font-size:clamp(14px,3.9cqw,17px);font-weight:500;margin-top:.15em}
.lpt .gift .hl{color:var(--ac)}
.lpt .gift b{display:block;font-weight:800;font-size:clamp(18px,5.1cqw,25px);line-height:1.34;letter-spacing:-.03em}
.lpt .gift .val{display:inline-block;margin-top:.5em;font-weight:800;color:var(--ac-deep)}
.lpt .slider{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;padding-bottom:6px;scrollbar-width:none}
.lpt .slider::-webkit-scrollbar{display:none}
.lpt .slider>*{flex:0 0 84%;scroll-snap-align:center}
.lpt .sdots{display:flex;gap:7px;justify-content:center;margin-top:14px}
.lpt .sdots i{width:8px;height:8px;border-radius:50%;background:var(--line)}.lpt .sdots i.on{background:var(--hl);width:22px;border-radius:8px}

/* 마무리 */
.lpt .saying{display:inline-block;position:relative;background:var(--card2);border:1.5px solid var(--line);border-radius:clamp(18px,5cqw,26px);padding:clamp(20px,6cqw,32px) clamp(18px,5cqw,30px);font-weight:700;font-size:clamp(20px,5.8cqw,29px);line-height:1.42;letter-spacing:-.03em}
.lpt .saying:before{content:"“";display:block;font-size:2em;line-height:.5;color:var(--hl);margin-bottom:.1em;font-weight:900}
.lpt .script{font-weight:300;font-style:italic;font-size:clamp(34px,10cqw,60px);letter-spacing:-.05em;line-height:1.2;margin:0}
.lpt .promise{font-weight:800;font-size:clamp(22px,6.4cqw,36px);line-height:1.42;letter-spacing:-.03em}
.lpt .closephoto{position:relative;width:min(100%,460px);margin:0 auto;border-radius:clamp(24px,6cqw,36px);overflow:hidden}
.lpt .closephoto img{width:100%}

/* 일정(무료) */
.lpt .sched{border-radius:clamp(24px,6.5cqw,38px);padding:clamp(30px,8.5cqw,56px) clamp(18px,5cqw,40px);background:var(--card);border:1.5px solid var(--line)}
.lpt .sched .date{font-weight:900;font-size:clamp(27px,8cqw,50px);line-height:1.24;letter-spacing:-.04em;margin:.5em 0 .1em}
.lpt .sched .ttl{font-weight:800;font-size:clamp(19px,5.4cqw,27px);line-height:1.36;letter-spacing:-.03em;margin:clamp(18px,5cqw,28px) 0 clamp(22px,6cqw,34px)}
.lpt .kv{list-style:none;padding:0;margin:clamp(18px,5cqw,26px) auto 0;font-size:clamp(14px,3.9cqw,17px);color:var(--mute)}

/* 유료: 걱정과 답 */
.lpt .wcards{display:flex;flex-direction:column;gap:clamp(16px,4.5cqw,24px);text-align:left;counter-reset:w}
.lpt .wcard{counter-increment:w;background:var(--card);border-radius:clamp(22px,6cqw,32px);padding:clamp(24px,6.5cqw,38px) clamp(20px,5.5cqw,34px);border:1.5px solid color-mix(in srgb,var(--ac) 45%,transparent);box-shadow:0 16px 36px -24px color-mix(in srgb,var(--ac) 70%,transparent)}
.lpt .wcard:before{content:counter(w,decimal-leading-zero);display:inline-block;background:var(--ac);color:var(--ac-ink);font-weight:800;font-size:.8em;padding:.15em .6em;border-radius:6px;margin-bottom:.9em}
.lpt .wcard .q{font-weight:700;font-size:clamp(17px,4.8cqw,22px);line-height:1.4;margin:0}
.lpt .wcard .a{font-weight:900;font-size:clamp(27px,7.8cqw,42px);color:var(--hl);letter-spacing:-.04em;line-height:1.25;margin:.1em 0 .55em}
.lpt .wcard .strip{background:linear-gradient(90deg,var(--ac),color-mix(in srgb,var(--ac) 55%,transparent));color:#fff;font-weight:700;padding:.45em .8em;margin:0 calc(-1*clamp(20px,5.5cqw,34px)) .8em;padding-left:clamp(20px,5.5cqw,34px);font-size:clamp(15px,4.2cqw,19px)}
.lpt .wcard .strip em{font-style:normal;color:var(--ac-pop)}
.lpt .wcard ul{list-style:none;margin:0;padding:0;color:#3c3846;font-size:clamp(15px,4.2cqw,18.5px)}
.lpt .t-dark .wcard ul,.lpt .t-dark2 .wcard ul{color:var(--mute)}
.lpt .wcard li{padding:.28em 0 .28em .9em;text-indent:-.9em}.lpt .wcard li:before{content:"- "}

/* 유료: 후기 */
.lpt .case{padding:clamp(30px,8cqw,48px) 0;border-top:1px solid var(--line)}
.lpt .case:first-of-type{border-top:0}
.lpt .case .pre{font-size:clamp(16px,4.5cqw,21px);font-weight:600;margin:0}
.lpt .case .sub{font-size:clamp(17px,4.8cqw,22px);font-weight:600;margin:.2em 0 0}
.lpt .case .big{font-weight:900;font-size:clamp(31px,9.2cqw,58px);letter-spacing:-.045em;line-height:1.2;margin:.12em 0 .3em;background:linear-gradient(#fff 35%,var(--ac-pop));-webkit-background-clip:text;background-clip:text;color:transparent}
.lpt .t-light .case .big,.lpt .t-tint .case .big{background:none;color:var(--ac-deep)}
.lpt .case .tag{display:inline-block;background:#e9391f;color:#fff;font-weight:800;padding:.2em .7em;border-radius:4px;font-size:clamp(14px,4cqw,18px);margin-bottom:clamp(16px,4.5cqw,24px)}
.lpt .case .shot{border-color:var(--ac-pop)}

/* 유료: 마감 */
.lpt .deadbox{border:1.5px solid var(--hl);border-radius:clamp(18px,5cqw,26px);padding:clamp(18px,5cqw,28px) 14px;font-weight:700;font-size:clamp(19px,5.4cqw,27px);line-height:1.38;background:var(--card);max-width:520px;margin:0 auto}
.lpt .dead{font-weight:900;font-size:clamp(32px,9.6cqw,60px);line-height:1.2;letter-spacing:-.045em;margin:0}

/* 유료: 달력 */
.lpt .cal{background:#fff;color:#15131a;border-radius:clamp(20px,5.5cqw,30px);padding:clamp(18px,5cqw,30px) clamp(8px,2.4cqw,22px) clamp(14px,4cqw,24px);box-shadow:0 22px 50px -26px rgba(0,0,0,.45);border:1.5px solid var(--line)}
.lpt .cal h4{margin:0 0 .5em;font-size:clamp(22px,6.4cqw,32px);font-weight:900;letter-spacing:-.03em}
.lpt .cal table{width:100%;border-collapse:collapse;table-layout:fixed}
.lpt .cal th{font-size:clamp(11.5px,3.2cqw,15px);color:#9a96a3;font-weight:700;padding:.7em 0;border-top:2px solid #15131a}
.lpt .cal td{vertical-align:top;padding:clamp(5px,1.6cqw,10px) 0;height:clamp(62px,17cqw,92px);font-size:clamp(17px,4.9cqw,24px);color:#b3b0ba;font-weight:500}
.lpt .cal td span{display:inline-flex;align-items:center;justify-content:center;width:clamp(34px,9.6cqw,50px);height:clamp(34px,9.6cqw,50px);border-radius:50%}
.lpt .cal td.on{color:#fff;font-weight:800}
.lpt .cal td.on span{background:radial-gradient(circle at 35% 30%,color-mix(in srgb,var(--ac) 70%,#fff),var(--ac) 55%,var(--ac-deep));box-shadow:0 6px 14px -4px var(--ac)}
.lpt .cal td.on.lim span{background:radial-gradient(circle at 35% 30%,#fff3,var(--top) 10%,var(--top));color:#15131a;box-shadow:0 6px 14px -4px var(--top)}
.lpt .cal td small{display:block;font-size:clamp(10px,2.75cqw,13.5px);font-weight:800;color:#15131a;line-height:1.25;margin-top:3px;letter-spacing:-.04em}
.lpt .cal td small i{display:block;font-style:normal;font-weight:500;color:#6d6878}
.lpt .slist{list-style:none;margin:clamp(16px,4.5cqw,24px) 0 0;padding:0;text-align:left;display:grid;gap:8px}
.lpt .slist li{display:flex;gap:.7em;align-items:baseline;background:var(--card);border-radius:14px;padding:.75em 1em;font-size:clamp(15px,4.2cqw,19px);border:1px solid var(--line)}
.lpt .slist b{font-weight:800;color:var(--hl);white-space:nowrap}
.lpt .slist .lim{margin-left:auto;font-size:.78em;font-weight:800;background:var(--top);color:#15131a;border-radius:999px;padding:.15em .7em;white-space:nowrap}

/* 유료: 구성 요약 */
.lpt .plus{list-style:none;margin:0 auto;padding:0;text-align:left;max-width:600px}
.lpt .plus li{font-weight:800;font-size:clamp(19px,5.5cqw,29px);letter-spacing:-.035em;line-height:1.35;padding:.5em 0 .5em 1.1em;text-indent:-1.1em;border-bottom:2px solid var(--ac)}
.lpt .plus li:before{content:"+ ";color:var(--hl)}

/* 유료: 커리큘럼 */
.lpt .cur{text-align:left}
.lpt .sess{padding:clamp(30px,8cqw,50px) 0;border-top:1px solid var(--line)}
.lpt .sess:first-child{border-top:0;padding-top:0}
.lpt .sess .bar{display:inline-flex;flex-wrap:wrap;align-items:baseline;gap:.2em .7em;background:var(--ac);color:var(--ac-ink);padding:.4em .9em;border-radius:6px;font-size:clamp(14.5px,4cqw,18px)}
.lpt .sess .bar b{font-weight:900;font-size:1.22em}
.lpt .sess .lim{display:block;color:var(--hl);font-weight:800;font-size:clamp(19px,5.4cqw,26px);margin-top:.8em;letter-spacing:-.03em}
.lpt .sess h4{margin:.7em 0 .6em;font-weight:900;font-size:clamp(23px,6.6cqw,34px);letter-spacing:-.035em;line-height:1.3}
.lpt .sess .lim+h4{margin-top:.1em}
.lpt .sess ol{list-style:none;margin:0;padding:0;counter-reset:it}
.lpt .sess ol>li{counter-increment:it;position:relative;padding:.38em 0 .38em 1.7em;font-weight:700;font-size:clamp(16.5px,4.6cqw,21px);line-height:1.45}
.lpt .sess ol>li:before{content:counter(it);position:absolute;left:0;font-weight:900;color:var(--hl)}
.lpt .sess ol ul{list-style:none;margin:.35em 0 .2em;padding:0;font-weight:500;color:var(--mute);font-size:.92em}
.lpt .sess ol ul li{padding:.16em 0 .16em .8em;text-indent:-.8em}.lpt .sess ol ul li:before{content:"- "}
.lpt .outcome{margin-top:clamp(18px,5cqw,28px);display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;background:linear-gradient(180deg,#fff,var(--l1));border:1.5px solid var(--line);border-radius:clamp(18px,5cqw,26px);padding:clamp(18px,5cqw,28px);box-shadow:0 14px 30px -22px rgba(0,0,0,.4)}
.lpt .outcome small{display:block;font-weight:800;color:var(--hl);font-size:clamp(14px,3.9cqw,17px);margin-bottom:.3em}
.lpt .outcome p{margin:0;font-weight:600;font-size:clamp(16.5px,4.6cqw,21px);line-height:1.5}
.lpt .outcome img{width:clamp(72px,21cqw,120px);mix-blend-mode:multiply;border-radius:12px}

/* 유료: 플랜·혜택 */
.lpt .plans{display:grid;gap:12px}
.lpt .plan{position:relative;border-radius:clamp(20px,5.5cqw,30px);padding:clamp(22px,6cqw,34px) clamp(16px,4.5cqw,28px);background:var(--card);border:1.5px solid var(--line);--pc:#c9c9d1}
.lpt .plan.p1{--pc:var(--ac-lite);border-color:var(--pc)}
.lpt .plan.top{--pc:var(--top);border-color:var(--pc);box-shadow:0 0 44px -14px var(--top)}
.lpt .plan .rec{display:block;font-weight:900;font-style:italic;color:var(--pc);font-size:clamp(16px,4.6cqw,21px);margin-bottom:.4em;text-shadow:0 0 18px var(--pc)}
.lpt .plan .nm{display:inline-block;background:#fff;color:#15131a;font-weight:900;font-size:clamp(21px,6.2cqw,30px);padding:.28em 1.1em;border-radius:999px;letter-spacing:-.03em;box-shadow:0 0 0 3px var(--pc)}
.lpt .plan p{margin:.85em 0 0;font-size:clamp(15.5px,4.3cqw,19px);line-height:1.5}
.lpt .plan .cnt{display:block;margin-top:.7em;font-weight:800;color:var(--pc);font-size:clamp(15px,4.2cqw,19px)}
.lpt .bens{display:grid;grid-template-columns:1fr 1fr;gap:10px;text-align:left}
.lpt .ben{border-radius:clamp(16px,4.5cqw,24px);padding:clamp(15px,4.2cqw,24px);background:var(--card);border:1.5px solid var(--line);--pc:#c9c9d1;border-bottom:3px solid var(--pc)}
.lpt .ben.p1{--pc:var(--ac-lite)}.lpt .ben.top{--pc:var(--top)}
.lpt .ben.wide{grid-column:1/-1}
.lpt .ben .tg{display:inline-block;font-weight:800;font-size:clamp(11px,3cqw,13.5px);letter-spacing:.03em;padding:.22em .8em;border-radius:999px;background:var(--pc);color:#15131a;margin-bottom:.8em}
.lpt .ben .side{display:block;font-style:normal;font-size:clamp(11.5px,3.1cqw,14px);font-weight:700;color:var(--pc);margin:-.3em 0 .6em}
.lpt .ben b{display:block;font-weight:800;font-size:clamp(16.5px,4.7cqw,22px);line-height:1.36;letter-spacing:-.03em}
.lpt .ben p{margin:.5em 0 0;font-size:clamp(13.5px,3.75cqw,16.5px);color:var(--mute);line-height:1.55}
.lpt .perkbox{border-radius:clamp(22px,6cqw,34px);overflow:hidden;background:var(--card);border:1.5px solid var(--top)}
.lpt .perkbox img{width:100%}
.lpt .perks{list-style:none;margin:0;padding:0 clamp(18px,5cqw,32px);text-align:left}
.lpt .perks li{padding:clamp(18px,5cqw,26px) 0;border-top:1px solid var(--line)}.lpt .perks li:first-child{border:0}
.lpt .perks b{display:block;font-weight:800;font-size:clamp(20px,5.8cqw,28px);color:var(--top);letter-spacing:-.03em;line-height:1.3}
.lpt .perks span{display:block;margin-top:.3em;color:var(--mute);font-size:.92em}

/* 이런 분께 */
.lpt .pills{display:flex;flex-direction:column;gap:12px;max-width:560px;margin:0 auto}
.lpt .pills div{background:#fff;color:#15131a;border-radius:999px;padding:.9em 1.2em;font-weight:700;font-size:clamp(18px,5.1cqw,25px);line-height:1.38;letter-spacing:-.03em}
.lpt .pills .hl{color:var(--ac)}
.lpt .pills div.multi{border-radius:28px}

/* 질문 */
.lpt .faq{max-width:620px;margin:0 auto;text-align:left}
.lpt .faq details{background:var(--card);border-radius:18px;padding:0 1.1em;border:1px solid var(--line)}
.lpt .faq details+details{margin-top:10px}
.lpt .faq summary{list-style:none;cursor:pointer;font-weight:800;padding:1em 1.6em 1em 0;position:relative}
.lpt .faq summary::-webkit-details-marker{display:none}
.lpt .faq summary:after{content:"+";position:absolute;right:0;top:.75em;font-size:1.3em;color:var(--hl)}
.lpt .faq details[open] summary:after{content:"–"}
.lpt .faq details p{margin:0 0 1.1em;color:var(--mute)}

/* 작은 변형들 */
.lpt .h2.cause{font-size:clamp(25px,7.2cqw,44px)}
.lpt .h3.define{font-size:clamp(23px,6.6cqw,36px)}
.lpt .h3.tight{margin-top:.2em}
.lpt .h1.turn{font-weight:300;font-size:clamp(52px,16cqw,100px)}
.lpt .h1.word{font-size:clamp(46px,14cqw,88px)}
.lpt .lead.over-title{color:var(--fg);font-weight:700;margin-bottom:.4em}
.lpt .lead.asked-title{margin-bottom:.9em}
.lpt .lead.strong{font-weight:700}
.lpt .photo.full{width:100%}
.lpt .photo.stand{width:min(78%,360px);border-radius:28px 28px 0 0;margin-bottom:-1px}
.lpt .card.shade{background:rgba(0,0,0,.34)}
.lpt .card.compact{padding:1em}
.lpt .card.paper{background:#fff;color:#15131a;--fg:#15131a;--mute:#6d6878;--hl:var(--ac);--card2:#f1f1f4;--line:transparent}
.lpt .card.paper .lead.story{color:#15131a}
.lpt .card.pledge{background:var(--d0)}
.lpt .card.overlap{margin-top:-40px}
.lpt .band.ink{background:#15131a;color:#fff}
.lpt .band.wide{display:block;padding:.7em .5em;border-radius:14px}
.lpt .eyebrow.top-plan{background:var(--top);color:#15131a}
.lpt .perkbox .h2{padding:.8em .4em 0;--hl:var(--top)}
.lpt .versus.left{text-align:left}
.lpt .note.same-color{color:inherit}
.lpt .sched .eyebrow{margin-bottom:.8em}
.lpt .when.band-when{margin:1em 0 1.3em}

/* 무료 1: 첫 화면 배너 — 일정 알약 · 제목 · 버튼 · 강사 사진과 이름표 */
.lpt .when.pill{margin:0 0 clamp(20px,5.5cqw,30px);padding:.4em 1.1em .4em .45em;border-radius:999px;background:var(--card2);border:1.5px solid var(--line);box-shadow:0 10px 24px -16px rgba(0,0,0,.45)}
.lpt .when.pill .live{border-radius:999px}
.lpt .h1.banner-title{font-size:clamp(30px,9.2cqw,62px);text-wrap:balance}
.lpt .banner-cta{margin-top:clamp(28px,7.5cqw,44px)}
.lpt .banner-photo{position:relative;width:min(100%,460px);margin:clamp(34px,9cqw,54px) auto 0}
.lpt .banner-photo img{width:100%;border-radius:clamp(22px,6cqw,34px)}
.lpt .nametag{position:relative;display:inline-block;margin-top:clamp(-38px,-8cqw,-28px);padding:.6em 1.5em .7em;border-radius:20px;background:var(--ac);color:var(--ac-ink);line-height:1.3;box-shadow:0 16px 32px -14px color-mix(in srgb,var(--ac) 80%,transparent)}
.lpt .nametag small{display:block;font-size:clamp(13px,3.6cqw,16px);font-weight:600;opacity:.88}
.lpt .nametag b{display:block;font-size:clamp(23px,6.6cqw,34px);font-weight:900;letter-spacing:-.03em}
.lpt .banner-photo.nophoto .nametag{margin-top:0}

/* 무료 5: 캡처 아래 강조 숫자 */
.lpt .capnum{margin:.7em 0 0;line-height:1.2}
.lpt .capnum b{display:block;font-weight:900;font-size:clamp(30px,9cqw,56px);letter-spacing:-.045em;color:var(--hl)}
.lpt .capnum small{display:block;margin-top:.3em;font-size:clamp(13px,3.6cqw,16px);font-weight:600;color:var(--mute)}

/* 무료 7: "○○? 아닙니다." 반복 */
.lpt .nopes{display:flex;flex-direction:column;gap:clamp(26px,7cqw,42px)}
.lpt .nope .q{margin:0;font-weight:700;font-size:clamp(21px,6cqw,32px);line-height:1.34;letter-spacing:-.03em;color:var(--mute)}
.lpt .nope .a{margin:.1em 0 0;font-weight:900;font-size:clamp(35px,10.6cqw,68px);line-height:1.17;letter-spacing:-.04em;color:var(--hl)}

/* 무료 12: 선물 다시 보여 주기 */
.lpt .recap{max-width:560px;margin:0 auto clamp(18px,5cqw,26px);padding:1em 1.2em;border-radius:18px;background:var(--card2);text-align:left}
.lpt .recap small{display:block;margin-bottom:.4em;font-weight:800;font-size:clamp(13px,3.6cqw,16px);color:var(--hl)}
.lpt .recap li{position:relative;padding:.18em 0 .18em 1.1em;font-weight:600;font-size:clamp(15px,4.2cqw,18px)}
.lpt .recap li:before{content:"";position:absolute;left:0;top:.82em;width:6px;height:6px;border-radius:50%;background:var(--hl)}

/* 등장 효과 — mountLandingBehaviors 가 lpt-js 를 붙인 경우에만 숨겼다가 보여 준다 */
.lpt.lpt-js .rv{opacity:0;transform:translateY(22px);transition:opacity .7s ease,transform .7s ease}
.lpt.lpt-js .rv.in{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){.lpt.lpt-js .rv{opacity:1;transform:none;transition:none}.lpt .live:before{animation:none}}
@container (min-width:640px){.lpt .gifts{gap:18px}.lpt .steps.g2{gap:16px}}
`
