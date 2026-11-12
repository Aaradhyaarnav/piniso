/* Piniso v4 styles — command bar, kickoff, golden moments, growth, quiz games, and the motion pass.
   Appended to the main stylesheet (content/ui-css.js). Motion follows "calm" mode and prefers-reduced-motion. */
globalThis.PINISO_CSS = (globalThis.PINISO_CSS || '') + `
/* ---------- shared motion tokens ---------- */
.pz{--spring:cubic-bezier(.34,1.56,.64,1);--soft:cubic-bezier(.22,1,.36,1)}
.ov.ov-top{place-items:start center;padding-top:min(12vh,110px)}

/* ---------- ⌘ command bar ---------- */
.cmdk{width:min(640px,94vw);max-height:min(560px,76vh);display:flex;flex-direction:column;overflow:hidden;padding:0;border:var(--bw) solid var(--ink);border-radius:var(--r1);box-shadow:var(--sh),0 30px 80px rgba(0,0,0,.28);animation:pzCmdIn .42s var(--spring) both;transform-origin:50% 0}
@keyframes pzCmdIn{0%{opacity:0;transform:translateY(-18px) scale(.94) rotate(-.6deg)}60%{opacity:1}100%{transform:none}}
.cmdk-top{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1.5px dashed var(--line)}
.cmdk-ic{color:var(--ink);display:grid;place-items:center;width:30px;height:30px;border-radius:10px;background:var(--acc);border:1.5px solid var(--ink);animation:pzSpinIn .6s var(--spring) both}
@keyframes pzSpinIn{from{transform:rotate(-120deg) scale(.4)}}
.cmdk-in{flex:1;min-width:0;border:0;outline:0;background:transparent;font:500 18px/1.2 var(--f-ui);color:var(--ink);padding:4px 0}
.cmdk-in::placeholder{color:var(--muted);opacity:.85}
.cmdk-stage{flex:none;font:600 11.5px/1 var(--f-ui);padding:6px 9px;border-radius:99px;border:1.5px solid var(--ink);background:var(--paper);white-space:nowrap}
.cmdk-list{overflow:auto;padding:6px 8px 10px;overscroll-behavior:contain}
.cmdk-g{font:700 10.5px/1 var(--f-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted);padding:12px 10px 6px}
.cmdk-it{all:unset;box-sizing:border-box;width:100%;display:flex;align-items:center;gap:12px;padding:9px 10px;border-radius:12px;cursor:pointer;color:var(--ink);border:1.5px solid transparent;animation:pzRowIn .38s var(--soft) both;animation-delay:calc(var(--i,0) * 18ms)}
@keyframes pzRowIn{from{opacity:0;transform:translateY(6px)}}
.cmdk-it.sel{background:color-mix(in srgb,var(--acc) 38%,var(--paper2));border-color:var(--ink);box-shadow:var(--sh2)}
.cmdk-it.sel .ce{transform:scale(1.18) rotate(-8deg)}
.cmdk-it.off{opacity:.5}
.cmdk-it .ce{flex:none;width:32px;height:32px;display:grid;place-items:center;font-size:18px;border-radius:10px;background:var(--paper);border:1.5px solid var(--line);transition:transform .25s var(--spring)}
.cmdk-it .cn{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.cmdk-it .cn b{font:600 14px/1.2 var(--f-ui);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cmdk-it .cn small{font:400 12px/1.25 var(--f-ui);color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cmdk-it kbd,.cmdk-foot kbd{font:600 10.5px/1 var(--f-mono);padding:4px 6px;border-radius:6px;border:1.5px solid var(--line);background:var(--paper);color:var(--muted)}
.cmdk-it .cb{font:800 10px/1 var(--f-ui);padding:4px 7px;border-radius:99px;background:var(--ink);color:var(--paper);animation:pzPulse 1.6s ease-in-out infinite}
.cmdk-none{padding:26px 14px;text-align:center;color:var(--muted)}
.cmdk-foot{display:flex;gap:14px;align-items:center;padding:9px 16px;border-top:1.5px dashed var(--line);font:500 11.5px/1 var(--f-ui);color:var(--muted)}
.cmdk-foot .sp{flex:1}.cmdk-foot span{display:inline-flex;gap:4px;align-items:center}

/* ---------- ✏️ kickoff ---------- */
.kick{width:min(460px,100%);padding:26px 26px 16px;position:relative;text-align:center;animation:pzKickIn .55s var(--spring) both;overflow:visible}
@keyframes pzKickIn{0%{opacity:0;transform:translateY(30px) scale(.9) rotate(1.5deg)}100%{transform:none}}
.kick-pet{width:112px;margin:-78px auto 2px;filter:drop-shadow(0 6px 0 rgba(0,0,0,.08));animation:pzFloat 2.6s ease-in-out infinite}
@keyframes pzFloat{50%{transform:translateY(-6px)}}
.kick .kh{font:400 34px/1.05 var(--f-serif);margin:0}
.kick .kh em{font-style:italic;background:linear-gradient(transparent 62%,color-mix(in srgb,var(--acc) 80%,transparent) 62%);padding:0 3px}
.kick .ksub{margin:8px auto 0;max-width:360px;font:500 12.5px/1.35 var(--f-ui);color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.krow{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:18px 0 6px}
.kchip{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:9px 13px;border-radius:99px;border:var(--bw) solid var(--ink);background:var(--paper);font:600 13px/1 var(--f-ui);color:var(--ink);transition:transform .2s var(--spring),background .2s}
.kchip small{font-weight:700;color:var(--muted)}
.kchip.on{background:var(--acc);color:var(--acc-ink);transform:rotate(-2deg) scale(1.04);box-shadow:var(--sh2)}
.kchip.on small{color:inherit}
.kseg{display:inline-flex;border:var(--bw) solid var(--ink);border-radius:99px;overflow:hidden;background:var(--paper)}
.kseg button{all:unset;cursor:pointer;padding:9px 11px;font:600 12.5px/1 var(--f-ui);color:var(--ink);transition:background .2s}
.kseg button+button{border-left:1.5px solid var(--line)}
.kseg button.on{background:var(--ink);color:var(--paper)}
.klink{all:unset;cursor:pointer;font:600 12.5px/1 var(--f-ui);color:var(--muted);padding:8px 6px;border-radius:8px}
.klink:hover{color:var(--ink);text-decoration:underline;text-underline-offset:3px}
.kgoalw{text-align:left;margin:4px 0 2px;animation:pzRowIn .3s var(--soft) both}
.kgoalw .f{display:block;font:700 10.5px/1 var(--f-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:6px 0 7px}
.kgoal{width:100%;display:block}
.kgo{all:unset;box-sizing:border-box;cursor:pointer;width:100%;margin:14px 0 4px;display:flex;align-items:center;justify-content:center;gap:12px;padding:16px 18px;border-radius:16px 6px 15px 7px/7px 15px 6px 16px;border:var(--bw) solid var(--ink);background:var(--ink);color:var(--paper);box-shadow:4px 4px 0 var(--acc),4px 4px 0 1.5px var(--ink);transition:transform .15s var(--spring),box-shadow .15s;position:relative;overflow:hidden}
.kgo::after{content:"";position:absolute;inset:0;background:linear-gradient(105deg,transparent 30%,rgba(255,255,255,.28) 50%,transparent 70%);transform:translateX(-120%);animation:pzShine 2.8s 1s ease-in-out infinite}
@keyframes pzShine{60%,100%{transform:translateX(120%)}}
.kgo:hover{transform:translate(-1px,-2px) rotate(-.6deg)}
.kgo:active{transform:translate(3px,3px);box-shadow:0 0 0 var(--acc)}
.kgo-t{font:700 19px/1 var(--f-ui)}
.kgo-k{font:600 11px/1 var(--f-mono);opacity:.7;padding:5px 7px;border:1px solid currentColor;border-radius:6px}
.kfoot{display:flex;align-items:center;margin-top:4px}.kfoot .sp{flex:1}
.kick.counting>*:not(.kcount):not(.kick-pet){opacity:0;transform:scale(.96);transition:opacity .2s,transform .2s;pointer-events:none}
.kcount{position:absolute;inset:40px 0 0;display:grid;place-items:center}
.kcount .kring{position:absolute;width:190px;height:190px;fill:none;stroke:var(--acc);stroke-width:9;stroke-linecap:round;stroke-dasharray:520;stroke-dashoffset:520;animation:pzDraw .5s var(--soft) forwards}
@keyframes pzDraw{to{stroke-dashoffset:0}}
.kcount .kn{position:relative;font:700 108px/1 var(--f-hand);color:var(--ink);animation:pzNum .56s var(--spring) both}
.kcount .kn.go{font-size:76px;color:var(--ink);text-shadow:3px 3px 0 var(--acc)}
@keyframes pzNum{0%{transform:scale(2.2) rotate(-12deg);opacity:0}45%{opacity:1}100%{transform:none}}

/* ---------- 🌟 golden moment ---------- */
.golden{position:fixed;z-index:9;width:260px;display:flex;align-items:center;gap:12px;padding:12px 16px 12px 12px;border-radius:18px;border:2.5px solid #1c1b18;background:linear-gradient(135deg,#FFE27A,#FFC93C 55%,#FF9F1C);color:#1c1b18;box-shadow:4px 4px 0 #1c1b18,0 0 50px rgba(255,201,60,.65);pointer-events:none;animation:pzGold .7s var(--spring) both}
.golden.out{animation:pzGoldOut .4s ease-in both}
@keyframes pzGold{0%{opacity:0;transform:translateY(40px) scale(.4) rotate(-14deg)}100%{transform:none}}
@keyframes pzGoldOut{to{opacity:0;transform:translateY(-30px) scale(.9)}}
.golden .gstar{flex:none;width:46px;height:46px;animation:pzStarSpin 1.6s var(--spring) both}
.golden .gstar svg{width:100%;height:100%;fill:#fff;stroke:#1c1b18;stroke-width:5;stroke-linejoin:round}
@keyframes pzStarSpin{from{transform:rotate(-200deg) scale(.2)}}
.golden .gtxt{display:flex;flex-direction:column;gap:2px;font:600 13px/1.25 var(--f-ui)}
.golden .gtxt b{font:800 20px/1 var(--f-ui)}
.gspark{position:fixed;z-index:8;width:10px;height:10px;margin:-5px;border-radius:2px;background:#FFC93C;box-shadow:0 0 0 1.5px #1c1b18;pointer-events:none;animation:pzSpark 1.1s var(--soft) both}
.gspark:nth-child(3n){background:#fff}.gspark:nth-child(4n){border-radius:50%}
@keyframes pzSpark{0%{transform:translate(0,0) scale(.3) rotate(0)}70%{opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(1) rotate(260deg);opacity:0}}

/* ---------- 🌱 growth card ---------- */
.grow{width:min(420px,100%);padding:24px 24px 20px;text-align:center;position:relative;animation:pzKickIn .5s var(--spring) both}
.grow-e{font-size:64px;line-height:1;animation:pzGrowE 1s var(--spring) both}
@keyframes pzGrowE{0%{transform:scale(.2) translateY(30px)}}
.grow h2{font:400 30px/1.1 var(--f-serif);margin:8px 0 4px}.grow h2 em{font-style:italic}
.grow-bar{height:14px;border:2px solid var(--ink);border-radius:99px;overflow:hidden;margin:14px 0 8px;background:var(--paper)}
.grow-bar i{display:block;height:100%;background:repeating-linear-gradient(-45deg,var(--acc) 0 10px,color-mix(in srgb,var(--acc) 70%,#fff) 10px 20px);animation:pzBarIn 1.1s var(--soft) both,pzStripes 1s linear infinite}
@keyframes pzBarIn{from{width:0!important}}
@keyframes pzStripes{to{background-position:28px 0}}
.grow-path{display:flex;justify-content:space-between;margin-top:16px;font-size:22px}
.grow-path span{filter:grayscale(1);opacity:.35;transition:transform .3s}.grow-path span.on{filter:none;opacity:1}
.grow-path span.on:last-of-type,.grow-path span.on:hover{transform:scale(1.25)}

/* ---------- 🧩 new quiz games ---------- */
.qfill{font:500 18px/1.6 var(--f-ui);margin:8px 0 12px}
.qfill .blank{display:inline-block;min-width:90px;border-bottom:3px solid var(--ink);text-align:center;padding:0 6px;color:var(--muted);transition:all .3s var(--spring)}
.qfill .blank.ok{background:color-mix(in srgb,#4DD48A 40%,transparent);color:var(--ink);border-color:#1f9d55;transform:scale(1.06)}
.qfill .blank.no{background:color-mix(in srgb,#FF4D6D 30%,transparent);color:var(--ink);border-color:#d62246;animation:pzShake .4s}
.qwords{display:flex;flex-wrap:wrap;gap:8px}
.qword{all:unset;cursor:pointer;padding:9px 13px;border-radius:12px;border:var(--bw) solid var(--ink);background:var(--paper);font:600 14px/1 var(--f-ui);color:var(--ink);box-shadow:var(--sh2);transition:transform .15s var(--spring)}
.qword:hover{transform:translateY(-2px) rotate(-1deg)}
.qword.ok{background:#4DD48A}.qword.no{background:#FF8FA3;animation:pzShake .4s}.qword:disabled{cursor:default;opacity:.7}.qword.ok:disabled,.qword.no:disabled{opacity:1}
.qfix{font:500 18px/1.9 var(--f-ui);margin:8px 0 6px}
.qfix .w{all:unset;cursor:pointer;padding:1px 4px;border-radius:6px;transition:background .15s}
.qfix .w:hover{background:color-mix(in srgb,var(--acc) 45%,transparent)}
.qfix .w.ok{background:#FF8FA3;text-decoration:line-through;text-decoration-thickness:3px}
.qfix .w.no{background:color-mix(in srgb,var(--line) 70%,transparent);animation:pzShake .4s}
.qfix .w.hint{outline:2.5px dashed #d62246;outline-offset:2px}
.qhelp{font:500 12.5px/1.3 var(--f-ui);color:var(--muted);margin:2px 0 10px}
.qorder{display:flex;flex-direction:column;gap:8px;margin:8px 0}
.qorder .oi{all:unset;cursor:pointer;display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;border:var(--bw) solid var(--ink);background:var(--paper);font:600 14px/1.3 var(--f-ui);color:var(--ink);transition:transform .25s var(--spring),background .2s,opacity .2s}
.qorder .oi .on{flex:none;width:26px;height:26px;border-radius:50%;border:1.5px dashed var(--line);display:grid;place-items:center;font:700 13px/1 var(--f-mono)}
.qorder .oi.picked{background:color-mix(in srgb,var(--acc) 35%,var(--paper));transform:translateX(6px)}
.qorder .oi.picked .on{background:var(--ink);color:var(--paper);border:0;animation:pzNum .4s var(--spring) both}
.qorder .oi.ok{background:#C9F2D9}.qorder .oi.no{background:#FFD0D8}
.qmatch{display:grid;grid-template-columns:1fr 1fr;gap:8px 14px;margin:8px 0}
.qmatch .mc{display:flex;flex-direction:column;gap:8px}
.qmatch .mi{all:unset;cursor:pointer;box-sizing:border-box;padding:10px 12px;border-radius:12px;border:var(--bw) solid var(--ink);background:var(--paper);font:600 13.5px/1.25 var(--f-ui);color:var(--ink);text-align:center;transition:transform .2s var(--spring),background .2s}
.qmatch .mi.sel{background:var(--acc);color:var(--acc-ink);transform:scale(1.04) rotate(-1deg)}
.qmatch .mi.done{background:#C9F2D9;opacity:.85;cursor:default;transform:scale(.97)}
.qmatch .mi.no{background:#FFD0D8;animation:pzShake .4s}
.qmatch .mi[data-c]{box-shadow:inset 6px 0 0 var(--mc)}
.qgo{margin-top:10px}

/* ---------- motion pass on existing pieces ---------- */
.magic{animation:pzCmdIn .45s var(--spring) both}
.magic .mt{animation:pzRowIn .4s var(--soft) both}
.magic .mgrid .mt:nth-child(2){animation-delay:.03s}.magic .mgrid .mt:nth-child(3){animation-delay:.06s}.magic .mgrid .mt:nth-child(4){animation-delay:.09s}.magic .mgrid .mt:nth-child(5){animation-delay:.12s}.magic .mgrid .mt:nth-child(6){animation-delay:.15s}
.magic .mt .me{transition:transform .3s var(--spring)}
.magic .mt:hover .me{transform:scale(1.25) rotate(-10deg)}
.ov{animation:pzFade .3s var(--soft) both}
.toast{animation:pzToast .5s var(--spring) both}

/* calm mode / reduced motion: keep it still */
.pz.calm *,.pz.calm *::before,.pz.calm *::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
@media (prefers-reduced-motion:reduce){.pz *,.pz *::before,.pz *::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
`;
