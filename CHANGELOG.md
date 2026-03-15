# Changelog

## [0.83.0](https://github.com/pannous/iclaude/compare/iclaude-v0.82.0...iclaude-v0.83.0) (2026-03-15)


### Features

* **agents:** add conversational chat SDK, cloud relay, and runs view ([#471](https://github.com/pannous/iclaude/issues/471)) ([e8420c8](https://github.com/pannous/iclaude/commit/e8420c824cc07b8bb374ec15b6b01653e94daef6))
* **agents:** add Linear Agent Interaction SDK integration ([#486](https://github.com/pannous/iclaude/issues/486)) ([64b838d](https://github.com/pannous/iclaude/commit/64b838de84c4c5b21ee4b43d6853f36975a6923b))
* **agents:** add per-agent chat platform credentials ([#477](https://github.com/pannous/iclaude/issues/477)) ([afb9557](https://github.com/pannous/iclaude/commit/afb95575615516600a284666f6f55c5c121e9650))
* **agents:** add reusable agent system with triggers, MCP, and scheduling ([#397](https://github.com/pannous/iclaude/issues/397)) ([1849d5d](https://github.com/pannous/iclaude/commit/1849d5d7c2a2b3d4036f8b2aebd1adc84f14258e))
* **ai-validator:** add actionable error reasons for AI validation failures ([#457](https://github.com/pannous/iclaude/issues/457)) ([ab5455e](https://github.com/pannous/iclaude/commit/ab5455e33d7c148a62e8abb81c31306b4ed3d50f))
* **auth:** add token-page endpoint and login page link for QR-based auth ([09be121](https://github.com/pannous/iclaude/commit/09be121dff7038a5fce4ca77f1dd84aaa1011174))
* **auto-namer:** fall back to OpenAI (gpt-4o-mini) via OPENAI_API_KEY env when OpenRouter is not configured ([b4a6d93](https://github.com/pannous/iclaude/commit/b4a6d9334eba0c8d21302ffd59f5ea41545d1a47))
* **auto-namer:** store openaiApiKey in settings.json, prefer it over env var fallback ([902ab6a](https://github.com/pannous/iclaude/commit/902ab6acbd878dad6d2a986821e2e6af47411f4d))
* **browser:** add browser preview for containerized sessions ([#505](https://github.com/pannous/iclaude/issues/505)) ([2e61e76](https://github.com/pannous/iclaude/commit/2e61e768ec3a99dea37212fe39bff3681ededdc9))
* **browser:** add browser preview tab with dual-mode support (container VNC + host proxy) ([#508](https://github.com/pannous/iclaude/issues/508)) ([4a30f96](https://github.com/pannous/iclaude/commit/4a30f9699d7ccfa749a1c0cf0477dbc2b433b21f))
* **composer:** pre-populate slash commands and skills on session creation ([#500](https://github.com/pannous/iclaude/issues/500)) ([79b4664](https://github.com/pannous/iclaude/commit/79b466417631ab9f345e05d6d3d55d1786cdf398))
* Development environment setup ([#472](https://github.com/pannous/iclaude/issues/472)) ([99fed7c](https://github.com/pannous/iclaude/commit/99fed7c1e35315e9bcec79ebd937010019796e20))
* **diff:** use git diff as source of truth; show A/M/D status icons and deleted files ([#385](https://github.com/pannous/iclaude/issues/385)) ([d1e0db5](https://github.com/pannous/iclaude/commit/d1e0db5f9b94bd5fe055455bf6b4f69714e350f5))
* **docker:** add Cubic CLI to the-companion image ([#499](https://github.com/pannous/iclaude/issues/499)) ([2b45aaa](https://github.com/pannous/iclaude/commit/2b45aaa2790e41cff2c940adb26106ddf06729ef))
* **integrations:** add Tailscale Funnel integration for one-click HTTPS ([#482](https://github.com/pannous/iclaude/issues/482)) ([a79f1fd](https://github.com/pannous/iclaude/commit/a79f1fd4f45dad176a2f718029e4c6625cdd7f02))
* **linear:** add guided Linear Agent setup wizard ([#522](https://github.com/pannous/iclaude/issues/522)) ([0bf218d](https://github.com/pannous/iclaude/commit/0bf218de9fd078c5fc190224b0f620392fe71759))
* **linear:** inject Linear context into CLI system prompt ([#497](https://github.com/pannous/iclaude/issues/497)) ([db0ae68](https://github.com/pannous/iclaude/commit/db0ae6843da948273844acb2f7f9adafa05a42a3))
* **linear:** support multiple Linear connections with API key injection ([#496](https://github.com/pannous/iclaude/issues/496)) ([3c76a4b](https://github.com/pannous/iclaude/commit/3c76a4b8331f1519be1abb34476e53186dd57b48))
* Menu esthétique ergonomie ([#474](https://github.com/pannous/iclaude/issues/474)) ([033a854](https://github.com/pannous/iclaude/commit/033a8547d18bee4fd12b71fadb9322a1f445ef9c))
* **multi-agent:** enable codex by default and improve subagent UI ([#444](https://github.com/pannous/iclaude/issues/444)) ([973ca5f](https://github.com/pannous/iclaude/commit/973ca5facc9f9c1b36b3b48f0d7183c8fa54da47))
* **platform:** add Companion Cloud managed platform foundation ([#401](https://github.com/pannous/iclaude/issues/401)) ([cdd6a0c](https://github.com/pannous/iclaude/commit/cdd6a0c1df616ffd16439339b0be745c812ad16a))
* **platform:** add hetzner provider and instance scaling ([#525](https://github.com/pannous/iclaude/issues/525)) ([4618efa](https://github.com/pannous/iclaude/commit/4618efad9fe4cf4dae634773784fe76460aa639a))
* **platform:** non-blocking instance creation with SSE streaming ([#518](https://github.com/pannous/iclaude/issues/518)) ([5972d60](https://github.com/pannous/iclaude/commit/5972d60954e1f34b010811e2d47caafa02557d84))
* **sandbox:** add init script testing and remove Dockerfile support ([#520](https://github.com/pannous/iclaude/issues/520)) ([39dc238](https://github.com/pannous/iclaude/commit/39dc238da6a4922e39bce5f1c71064f37c1c5a08))
* **sandbox:** enable sandbox system for Codex backend ([#521](https://github.com/pannous/iclaude/issues/521)) ([ea856b1](https://github.com/pannous/iclaude/commit/ea856b1668e4132e2aacbcf30e3ef43b61011f61))
* **sandbox:** separate sandbox from environment management ([#516](https://github.com/pannous/iclaude/issues/516)) ([d38dcc3](https://github.com/pannous/iclaude/commit/d38dcc34623048fdf881584691f9dabfad025d0d))
* **server:** formalize session state machine and transitions ([#541](https://github.com/pannous/iclaude/issues/541)) ([0cc85c1](https://github.com/pannous/iclaude/commit/0cc85c1703220d949ce0ca6f8f56d876ed59387d))
* **server:** implement typed internal event bus ([#536](https://github.com/pannous/iclaude/issues/536)) ([d8fa90b](https://github.com/pannous/iclaude/commit/d8fa90b7a38892267f1676187dece78ee272d308))
* **settings:** add public URL config + guided Linear webhook setup ([#478](https://github.com/pannous/iclaude/issues/478)) ([18f08d3](https://github.com/pannous/iclaude/commit/18f08d35ea412c5a81f0918197ea23a90f485a97))
* **sidebar:** add external links to docs, GitHub, and website ([#468](https://github.com/pannous/iclaude/issues/468)) ([6fe561e](https://github.com/pannous/iclaude/commit/6fe561e83fbdd90359bee7bf76587256b35d0704))
* **sidebar:** redesign footer nav from grid to vertical list ([#470](https://github.com/pannous/iclaude/issues/470)) ([8fdd9f6](https://github.com/pannous/iclaude/commit/8fdd9f6b1b91e5cb311abfd46ee122358c2cd553))
* **sidebar:** redesign session items with status-first layout ([#368](https://github.com/pannous/iclaude/issues/368)) ([7287cfc](https://github.com/pannous/iclaude/commit/7287cfcb54cadbc35f1dff2ea7f0e42042b89124))
* **skills:** add new skills for design enhancement and adaptation ([a1643c4](https://github.com/pannous/iclaude/commit/a1643c4d4713168375c4dc4360be91d3903766ad))
* **ui:** add compacting context indicator in message feed ([#462](https://github.com/pannous/iclaude/issues/462)) ([9bfab3c](https://github.com/pannous/iclaude/commit/9bfab3c8786d0273da0bb247c3f6bcd71028608c))
* **update:** add Docker image update dialog after app update ([#526](https://github.com/pannous/iclaude/issues/526)) ([7b18479](https://github.com/pannous/iclaude/commit/7b184796a2b33113fa0fe159e1a96e6de36673f0))
* **web:** add @ mention prompt support to home page input ([#419](https://github.com/pannous/iclaude/issues/419)) ([94dbb4e](https://github.com/pannous/iclaude/commit/94dbb4e4d44317aa823125678b6210f5c6adee96))
* **web:** add auth, PWA, process panel, editor/files, page redesigns, and theme polish ([#396](https://github.com/pannous/iclaude/issues/396)) ([cb2f101](https://github.com/pannous/iclaude/commit/cb2f101d7c2764fbaa0d582ed1022763706c9283))
* **web:** add create Linear issue button in context section ([#421](https://github.com/pannous/iclaude/issues/421)) ([22e658c](https://github.com/pannous/iclaude/commit/22e658c1c0c533a058887d12ebefbbee68e10d3c))
* **web:** add Docker Builder page and refactor Environment UI ([#454](https://github.com/pannous/iclaude/issues/454)) ([c97dc9e](https://github.com/pannous/iclaude/commit/c97dc9e52a49528b5e7a64bbf518c33f630d2853))
* **web:** add prerelease update channel and preview CI pipeline ([#451](https://github.com/pannous/iclaude/issues/451)) ([6799c6f](https://github.com/pannous/iclaude/commit/6799c6f46124ff2da61d7612f344fbd23da9ec69))
* **web:** implement AI validation mode for permission requests ([#420](https://github.com/pannous/iclaude/issues/420)) ([3436175](https://github.com/pannous/iclaude/commit/3436175dfb66810584ef168ad943f0e47086623d))
* **web:** improve streaming reliability and session branching controls ([#381](https://github.com/pannous/iclaude/issues/381)) ([200ab34](https://github.com/pannous/iclaude/commit/200ab34f42969e09c1a1e9bbb0ba6df44b791a6e))
* **web:** increase recorder max lines from 100k to 1M ([#426](https://github.com/pannous/iclaude/issues/426)) ([cf7a70b](https://github.com/pannous/iclaude/commit/cf7a70bf107722c48c784d8ca829196171ef27e3))
* **web:** make AI validation configurable per session ([#428](https://github.com/pannous/iclaude/issues/428)) ([bfec31a](https://github.com/pannous/iclaude/commit/bfec31a29e15441e1e3c251752d4570b6950692f))
* **web:** make saved prompts targetable by project scope or global ([#448](https://github.com/pannous/iclaude/issues/448)) ([805eb73](https://github.com/pannous/iclaude/commit/805eb73c7f3138a6feb5ad33a485dc60d9364a0a))
* **web:** move git fetch/checkout/pull inside Docker container ([#422](https://github.com/pannous/iclaude/issues/422)) ([02b22fa](https://github.com/pannous/iclaude/commit/02b22fa57dab59d95bf3a812c6800a1cdd121975))
* **web:** move git fetch/checkout/pull inside Docker container ([#424](https://github.com/pannous/iclaude/issues/424)) ([8559dcf](https://github.com/pannous/iclaude/commit/8559dcf49a23d1969b17907f33c4ffcf91205f63))
* **web:** prompt to transition Linear issue status on session archive ([#441](https://github.com/pannous/iclaude/issues/441)) ([e8ed5bd](https://github.com/pannous/iclaude/commit/e8ed5bd4a3b30f20dcd7e10d64f834752bed8b37))
* **web:** replace OpenRouter by Anthropic for AI features ([#439](https://github.com/pannous/iclaude/issues/439)) ([40d794c](https://github.com/pannous/iclaude/commit/40d794c24f90cd31628a362c960ad135877326e9))


### Bug Fixes

* add mass-deletion guards to pre-commit and pre-push hooks ([cf5229b](https://github.com/pannous/iclaude/commit/cf5229b10ead266a0b737b7f928d12cf9c908f5e))
* add Windows compatibility for binary resolution and process spawning ([#510](https://github.com/pannous/iclaude/issues/510)) ([79573af](https://github.com/pannous/iclaude/commit/79573af1243a74586f56b1cc5fd4558f76c2c69e))
* **agents:** add resilient webhook copy URL behavior ([#400](https://github.com/pannous/iclaude/issues/400)) ([07bbf9b](https://github.com/pannous/iclaude/commit/07bbf9b8e63ec9e20f0bb4ac52fd6d0d18614f71))
* **agents:** allow GET requests on webhook endpoint ([b94e793](https://github.com/pannous/iclaude/commit/b94e793af4a6fbf4f4525fff5c2dad1b301d0dea))
* **agents:** make webhook secret field editable for Linear/GitHub ([#485](https://github.com/pannous/iclaude/issues/485)) ([b3460db](https://github.com/pannous/iclaude/commit/b3460db75b5bec4ea116f41ea83e710c79566751))
* **agents:** replace emoji icons with SVG icon system ([#406](https://github.com/pannous/iclaude/issues/406)) ([d2ed31b](https://github.com/pannous/iclaude/commit/d2ed31b477e07d7f8d17e2a19c01599b45e05f69))
* **agents:** Run button now navigates to the spawned session immediately ([becb72f](https://github.com/pannous/iclaude/commit/becb72ff5ffd80172caa68fb9d8e5202df2b0447))
* Alt+Enter inserts newline instead of sending in Composer ([92025b8](https://github.com/pannous/iclaude/commit/92025b8862da8bb69d6580b708324f70cd8f91fe))
* apply spam label/cwd filters to resumable session lists ([6d10b47](https://github.com/pannous/iclaude/commit/6d10b47020e1bc64064f8d2027f93bf29ccba423))
* **auth:** add Cache-Control: no-store to login page so reload after token entry works ([9c3d3a1](https://github.com/pannous/iclaude/commit/9c3d3a1857edda18e666fe8ed8bd39eb530d88c0))
* **auth:** check ?token= URL param before autoAuth to fix WKWebView auth loop ([f369c95](https://github.com/pannous/iclaude/commit/f369c95a9d6e9ab72fece8fe08c0a1ff89c7dee4))
* **auth:** eliminate WKWebView reload loop on iOS ([471b818](https://github.com/pannous/iclaude/commit/471b818693a60051d8a16b08fa5ad8d5f5927d07))
* **auth:** enforce auth for tunnel traffic via X-Companion-Tunnel header bypass guard ([20de556](https://github.com/pannous/iclaude/commit/20de5561b5d62500df156e3822f477e10bd3f36d))
* **auth:** gate all tunnel traffic at app level with inline login page ([77d9e02](https://github.com/pannous/iclaude/commit/77d9e0254e879ac7f7debb2b0011ced66ad1cc8c))
* **auth:** resolve authentication loop for remote/WKWebView clients ([afbd49e](https://github.com/pannous/iclaude/commit/afbd49ee36082ffa39ad39bcf50953745df1d10d))
* **auth:** resolve infinite reload loop for tunnel/remote authentication ([2a423a1](https://github.com/pannous/iclaude/commit/2a423a185d6dacd623475a96a79ca1d96d3ceea2))
* **auth:** suppress login-page flash when auth is disabled ([39ce508](https://github.com/pannous/iclaude/commit/39ce508ec928e067204e3be059891646d29668bd))
* **auth:** tunnel authentication fully working ([4ed165d](https://github.com/pannous/iclaude/commit/4ed165d32ee10193386d0bf960d5ef226e8fd723))
* **auth:** use SameSite=Lax for auth cookie to fix cross-site navigation ([a65b8bb](https://github.com/pannous/iclaude/commit/a65b8bb78edc63d74e997c839fc12d681731fd8e))
* **auto-namer:** restore OpenAI fallback for session title generation ([c6cdf47](https://github.com/pannous/iclaude/commit/c6cdf4766f36844e49d5c6727fb29d4b21ce42c2))
* **auto-namer:** update title with AI summary after first turn ([0330ed9](https://github.com/pannous/iclaude/commit/0330ed997d5449ec484a9c4851caf897cce04eaa))
* **auto-namer:** use setTitle to update sdkSessions.title so AI summary takes priority in UI ([82b1e7a](https://github.com/pannous/iclaude/commit/82b1e7ad1c47f25bcf9973e37ee5f85cd079b474))
* auto-send waits for CLI connection before submitting ([fcfe946](https://github.com/pannous/iclaude/commit/fcfe9468bc8198e17c42637dcff9af8a86565377))
* broaden spam filter to catch auto-generated titles and sessionNames ([1474222](https://github.com/pannous/iclaude/commit/1474222457dcecdf93060c5aaef5dd6687bd413d))
* **ci:** install ripgrep in Preview workflow test-gate ([4ac9040](https://github.com/pannous/iclaude/commit/4ac90407e4e045ea81e9ce015a2f7ceffe99d600))
* **ci:** install ripgrep on both Ubuntu and macOS runners ([c0fd798](https://github.com/pannous/iclaude/commit/c0fd798f40bdf5be3c5ac54279af17bcf795c6ce))
* **ci:** install ripgrep on Ubuntu runners for fs/grep tests ([f5dd5e2](https://github.com/pannous/iclaude/commit/f5dd5e2baec31aff4835b8d75b4ba67da3ee683b))
* **ci:** rewrite coverage gate to enforce 80% on new/changed files ([#399](https://github.com/pannous/iclaude/issues/399)) ([e257897](https://github.com/pannous/iclaude/commit/e257897674024a5cad12f3468c73a7e2f9d7c799))
* **ci:** use bun run test instead of bun test in preview workflow ([#452](https://github.com/pannous/iclaude/issues/452)) ([f2e2f10](https://github.com/pannous/iclaude/commit/f2e2f10b7f74c9fb3126c9c9d2be1c74b43a3bf9))
* **ci:** use patch-core bump for preview npm versions (THE-216) ([#456](https://github.com/pannous/iclaude/issues/456)) ([c3c1115](https://github.com/pannous/iclaude/commit/c3c11156b33e2a5549293365d32107ccf93c8d51))
* **ci:** write .npmrc directly for npm granular token auth ([274fd8f](https://github.com/pannous/iclaude/commit/274fd8fbba19834318491a87ad5a9fd65d2e1a24))
* **codex:** auto-relaunch session when transport drops with browsers connected ([#484](https://github.com/pannous/iclaude/issues/484)) ([c0ec63b](https://github.com/pannous/iclaude/commit/c0ec63be8e9e1814e33eef2fc9b58da1b09e06b7))
* **codex:** fall back to thread/start when thread/resume fails on session restart ([#524](https://github.com/pannous/iclaude/issues/524)) ([36e4179](https://github.com/pannous/iclaude/commit/36e41794e8aef968786021a03e688802710c5e51))
* **codex:** handle WS reconnection and idle kill for Codex sessions ([#530](https://github.com/pannous/iclaude/issues/530)) ([f26a6b8](https://github.com/pannous/iclaude/commit/f26a6b809d4671ec1dd2716e312a007ec0da83cd))
* **codex:** increase WS timeouts and auto-relaunch on RPC timeout ([#514](https://github.com/pannous/iclaude/issues/514)) ([2fcccf3](https://github.com/pannous/iclaude/commit/2fcccf39d72a59bc674b41e7d912297c3afce4eb))
* **codex:** normalize rate-limit reset timestamps ([#386](https://github.com/pannous/iclaude/issues/386)) ([f361696](https://github.com/pannous/iclaude/commit/f3616960e48dcddccc48c956621c819568157e49))
* **codex:** preserve parent id in task tool-use backfill ([#447](https://github.com/pannous/iclaude/issues/447)) ([a208ee4](https://github.com/pannous/iclaude/commit/a208ee42e09209866be39940c6fb2d480d9ecc5a))
* **companion:** receive speech-input on home screen when no session is active ([9fce263](https://github.com/pannous/iclaude/commit/9fce263063d2e1263cfda8ca6636046ef7b0cb21))
* **complete:** inline ghost text, [Tab] badge, Ctrl+Z dismiss, placeholder ([6c6c648](https://github.com/pannous/iclaude/commit/6c6c648fcb88278ed52b42b411b8250cf9f598f1))
* **complete:** only suggest when agent is idle, shorter smarter prompts ([26956e2](https://github.com/pannous/iclaude/commit/26956e2b887f3e6e57d173f43e8c0c01ef008ca6))
* **complete:** switch completion provider to OpenAI gpt-4o-mini ([41cd607](https://github.com/pannous/iclaude/commit/41cd6073475e9b8aac1b979bbbe272e4e6fb298e))
* **composer:** add clear input button to mobile/iPad toolbar ([ed6e0cb](https://github.com/pannous/iclaude/commit/ed6e0cbf24c141b20f27a24baccbbba7dfc91b9c))
* **composer:** add clear X button to mobile/iPad toolbar ([39fda02](https://github.com/pannous/iclaude/commit/39fda02ebf668fadbba6fa55af971f561cf3a6aa))
* **composer:** persist draft input across HMR and server restarts ([cc0a91d](https://github.com/pannous/iclaude/commit/cc0a91d22a607802fd9d2ed3c4c7c1b6807b7ca2))
* **composer:** preserve tab completion on focus and enable click-to-accept ([b963e8e](https://github.com/pannous/iclaude/commit/b963e8ea5abfda331f79136a5f064c8b39a9a166))
* **composer:** prevent iOS/iPadOS tap-to-blur from swallowing send button clicks ([6d4ae42](https://github.com/pannous/iclaude/commit/6d4ae42c9148c5f6cb296d849a08a50e99807c6b))
* **composer:** remove duplicate mode/model/upload controls ([27ea4e1](https://github.com/pannous/iclaude/commit/27ea4e15813a8787e5d4c0fd01524490d044f5c5))
* **composer:** require double-click/double-tap to accept ghost completion ([92a512f](https://github.com/pannous/iclaude/commit/92a512f54bd0a9edae7f536dcbefde7f8a972996))
* **composer:** show stop button during streamed responses by setting status to running on message_start ([6842bad](https://github.com/pannous/iclaude/commit/6842bad0bb90c4982ffb6fe32a311fb91ebdaf7b))
* **composer:** use onTouchEnd for send/stop buttons on iOS/iPadOS ([c2ae46c](https://github.com/pannous/iclaude/commit/c2ae46c3290c22fb47b208477fc2a15b885c116f))
* **dev:** add claude.pannous.com to Vite allowedHosts ([bd57e55](https://github.com/pannous/iclaude/commit/bd57e555f1550d793850425b2495fd8d750e391b))
* **dev:** auto-restart backend when it stops responding ([78784ae](https://github.com/pannous/iclaude/commit/78784ae626540f149d0ed43ca2a53ab44c778388))
* **dev:** dynamically allow local network IPs in Vite allowedHosts ([c591bd1](https://github.com/pannous/iclaude/commit/c591bd174a1846241d97985615dd267e890ffa07))
* **dev:** exclude coverage/ from Vite HMR watcher to stop spurious reloads ([c5d8481](https://github.com/pannous/iclaude/commit/c5d84812cef4ab2fd795bfb09b2aad02930f039e))
* **dev:** fix LAN loop — rewrite Host header and bind Vite to localhost only ([c6f75d2](https://github.com/pannous/iclaude/commit/c6f75d204090daee37bc7f2f3b8bd2d627aabd5c))
* **dev:** proxy Vite through API port so QR code works on LAN ([f61b99a](https://github.com/pannous/iclaude/commit/f61b99a5b0a925dffd5cf293730f4f7877a7388d))
* **dev:** skip update checker and banner in non-production mode ([6a20ec7](https://github.com/pannous/iclaude/commit/6a20ec7665b8f374c7fe20ddcce434df7cb41bb0))
* **docs:** update mintlify docs.json schema ([265c89e](https://github.com/pannous/iclaude/commit/265c89eb3480974458dc7e0ad135a1fbb5b306b3))
* **editor:** open clicked file path instead of first file in tree ([f7b6a5e](https://github.com/pannous/iclaude/commit/f7b6a5e18b9c206b2f16ac16c5055cc9f12e88f8))
* **editor:** replace vscode tab with codemirror behind settings ([#372](https://github.com/pannous/iclaude/issues/372)) ([52bc626](https://github.com/pannous/iclaude/commit/52bc626fdb1a27a06c2e13a2ef6aa59a4f0da9f9))
* enable text selection on inline filename buttons for copy-paste ([a2d5462](https://github.com/pannous/iclaude/commit/a2d546217863e4f34b9906557142aa6da0374ac3))
* expand root-script slash commands server-side for Claude Code ([c40347d](https://github.com/pannous/iclaude/commit/c40347dc55bd0c733a30a748e4579ed9e3ff10b4))
* **fork:** assign session name on fork + show fork icon in sidebar ([e4ea70b](https://github.com/pannous/iclaude/commit/e4ea70b4e1834f95d50fcde2db0eaa67993cdfeb))
* **fork:** auto-load prior history and hide redundant banner when messages are pre-loaded ([f039409](https://github.com/pannous/iclaude/commit/f0394095473ddb697be668d39668abad7ba50c17))
* **fork:** copy original session name into forked session with "(fork)" suffix ([c72704a](https://github.com/pannous/iclaude/commit/c72704a3a814c63cea0e6ac886c0390104d49826))
* **fork:** sync fork name to server to prevent auto-namer from overwriting it ([ce7519c](https://github.com/pannous/iclaude/commit/ce7519cc734ff83cfcd37269be6b4192c21b505c))
* **fork:** use --resume instead of non-existent --resume-session-at flag ([41c8bec](https://github.com/pannous/iclaude/commit/41c8bec25d225413c9b0faaeeba88bc538271ed5))
* **fragments:** clean up merge artifacts and improve fragment API docs ([a752580](https://github.com/pannous/iclaude/commit/a752580adb481bc0d9344736ad35e20fddb6dbbb))
* **fragments:** inject bridge into srcdoc HTML instead of eval after mount ([48ac4e1](https://github.com/pannous/iclaude/commit/48ac4e110553efe410abf18c6049c1b835b9f218))
* **frontend:** replace silent .catch(() =&gt; {}) with console.warn for debuggability ([2d4cbf0](https://github.com/pannous/iclaude/commit/2d4cbf0a5d4b4ad11c74d77fe7da323fcc4e7db9))
* **fs-routes:** guardPath with root "/" base now allows all absolute paths ([849839a](https://github.com/pannous/iclaude/commit/849839a26841f997d7da3908f26126828fd65171))
* **fs:** allow all paths in YOLO mode (default) ([90c8873](https://github.com/pannous/iclaude/commit/90c8873d649f8fae870afa6585239efd0169b89a))
* **fs:** expand tilde in /fs/image path to serve ~/Pictures etc. ([ffba1e8](https://github.com/pannous/iclaude/commit/ffba1e89bd3b7aec42fdb1f75ccf19a2ab7a2135))
* gate pre-auth API calls behind isAuthenticated ([05d3801](https://github.com/pannous/iclaude/commit/05d38012e81827eac9e5c5cbf369724aca176591))
* **git-log:** pass focusedFolder as ?path= query param so panel reads it synchronously on load ([ea0022b](https://github.com/pannous/iclaude/commit/ea0022b12a40b110084180848a361d15316402b5))
* **git-log:** send focusedFolder to panel iframe on load, not just on change ([76abc2e](https://github.com/pannous/iclaude/commit/76abc2e6589664d17ce1d2ee1ff0b00508f0377a))
* **git-utils:** use enriched PATH so git is found in service environments ([810cadd](https://github.com/pannous/iclaude/commit/810caddbeca26b7a716862e7c11ca339ab9aa11b))
* group MCP Servers next to Plugins, both collapsed by default ([c758a99](https://github.com/pannous/iclaude/commit/c758a99cd5b0ed4f54c319be4e9f97c8de1b0473))
* hide mic button on iOS/iPadOS where Web Speech API is unavailable ([4a92c4a](https://github.com/pannous/iclaude/commit/4a92c4a077990f16d1af882b13e70b1f26f92b8f))
* **history:** eagerly load CLI history on browser connect when messageHistory is empty ([41fe8cb](https://github.com/pannous/iclaude/commit/41fe8cb431f86e4dddd9b603077031886a5c11de))
* **homepage:** remove brittle session row count coupling ([e202479](https://github.com/pannous/iclaude/commit/e202479eab603423ce1cb466ab3c39f645e0c268))
* **html:** permissive HTML fragment detection + warm terminal bg ([08cfac6](https://github.com/pannous/iclaude/commit/08cfac641cdbb3c9ac91103da8bb13a7f98dde32))
* improve cwd logging and handle missing cwd in session creation ([a1ee1b3](https://github.com/pannous/iclaude/commit/a1ee1b3f8f335053129065a99d43b222dc014351))
* **ios:** enable text selection in shell output on iPad ([d33588b](https://github.com/pannous/iclaude/commit/d33588b6fc949dff766563b5bc12145427cb5566))
* **linear:** refresh OAuth configured state after saving credentials ([#495](https://github.com/pannous/iclaude/issues/495)) ([db5998a](https://github.com/pannous/iclaude/commit/db5998a2752f0188432d4c726dc8d1fbc8768cca))
* **linear:** thread connectionId through CreateIssueModal for multi-connection support ([#498](https://github.com/pannous/iclaude/issues/498)) ([ccb8881](https://github.com/pannous/iclaude/commit/ccb8881066bafe9664f7cf3822f528d840499df1))
* listen on IPv4 (0.0.0.0) instead of IPv6-only default ([94421d0](https://github.com/pannous/iclaude/commit/94421d0ec938c5fef9a6f06eddf499450d995793))
* **merge:** add LOCAL comment for ThemeToggle divergence, split Cmd+S keybinding ([eec270c](https://github.com/pannous/iclaude/commit/eec270c2a89bc71ac3093ca70f7358b6c1dbe894))
* **merge:** restore removed type definitions and resolve codex-adapter stash conflict ([127204e](https://github.com/pannous/iclaude/commit/127204e2ca395ed00a1f7c8089bcb43d5eb5d2d7))
* **message-feed:** dedupe duplicate ids and stabilize row keys ([6c18718](https://github.com/pannous/iclaude/commit/6c187187c781edc302c13fa7ad71025cb1a32241))
* **minor:** add iclaude.pannous.com SSL cert and Vite allowedHosts ([b9cbcf3](https://github.com/pannous/iclaude/commit/b9cbcf34a0fadea2271acfee8b69507d01f97652))
* **minor:** add openrouterApiKey to test fixtures and fix API key focus masking ([dcb0913](https://github.com/pannous/iclaude/commit/dcb09138248bd1304a474b2595f359b38f344780))
* **minor:** correct dev port references and HMR proxy config ([42aa27f](https://github.com/pannous/iclaude/commit/42aa27f65daefccb53452ffa211a619175ad3e02))
* **minor:** detect Tailscale Funnel not enabled on tailnet ([262a01f](https://github.com/pannous/iclaude/commit/262a01f991b8dd7746bf9bd708082e1e63c60e0c))
* **minor:** gate pannous QR code to home server only ([e930077](https://github.com/pannous/iclaude/commit/e930077e63f7ad8df5892a610ee230e41d91212b))
* **minor:** improve accessibility of lazy tool result toggle ([bb2d195](https://github.com/pannous/iclaude/commit/bb2d19530e187ae5145ea87fdfbe8aba1c645b0b))
* **minor:** include auth header in tunnel shortcut download ([cd62184](https://github.com/pannous/iclaude/commit/cd62184314528b4ba7c245cfe0e7279721ca117f))
* **minor:** increase padding between hook messages in chat feed ([332ee8c](https://github.com/pannous/iclaude/commit/332ee8c2247db1d35a55d497372da33b86a87379))
* **minor:** move Persistent URL box below Public Tunnel toggle in settings ([aacd989](https://github.com/pannous/iclaude/commit/aacd989fbafdcae009d1bb6c4f82646a706f7e4a))
* **minor:** move resume button to right of folder label instead of hover actions ([eb6b834](https://github.com/pannous/iclaude/commit/eb6b834ca3083c2f379873402e30528389befe8c))
* **minor:** proxy Vite HMR WebSocket through API port for remote dev access ([0019b63](https://github.com/pannous/iclaude/commit/0019b63f6d7472f12fe29d9038071b43bfdcb70f))
* **minor:** remove 'Created' line from session tooltip ([639af92](https://github.com/pannous/iclaude/commit/639af9225678c60429455dc7e25bc6e51f55629b))
* **minor:** reuse existing cloudflared tunnel across bun --watch reloads ([aeb2c8a](https://github.com/pannous/iclaude/commit/aeb2c8a85c624382a1e4af73630e36fa6914905d))
* **minor:** skip Docker workflow on forks (no Docker Hub secrets) ([2051c9a](https://github.com/pannous/iclaude/commit/2051c9a74df2fdb4cf3133f40e8243fb43e7d7ce))
* **minor:** suppress Vite's verbose proxy error stack traces ([10fa736](https://github.com/pannous/iclaude/commit/10fa736bdbd50e74218195c51b4858f763a63265))
* **minor:** update Docker workflow for fork (pannous/the-companion) ([6c63fd5](https://github.com/pannous/iclaude/commit/6c63fd526609075461af1c0ad30dd1cd2bbb158b))
* **minor:** update QR label to mention Browser and Listen App ([361bf90](https://github.com/pannous/iclaude/commit/361bf9038b61398afff0e59cd9536db672d239a2))
* **minor:** update release workflow for fork (pannous/iclaude) ([40ca454](https://github.com/pannous/iclaude/commit/40ca4542795f4931e8eb2e21e8f1ac08642a296d))
* **minor:** update SettingsPage test to match button label "New" ([d108076](https://github.com/pannous/iclaude/commit/d108076f3697b0a06ee71fb6bf14c18813dc0be8))
* **minor:** use npm Trusted Publishing (OIDC) instead of access token ([7b2f719](https://github.com/pannous/iclaude/commit/7b2f7192a030d3af048cb1890f72985144527129))
* mock execSync in tunnel-manager tests for CI compatibility ([1a07f59](https://github.com/pannous/iclaude/commit/1a07f595d2680dd23cc20c75fdfe0f9468b9fc24))
* **mode:** default session permission mode to agent (bypassPermissions) ([bbbfaa9](https://github.com/pannous/iclaude/commit/bbbfaa9de3afc9de3297a84b6d729869e4e7e1e0))
* move clear input button to left of save prompt button ([62487ac](https://github.com/pannous/iclaude/commit/62487acaa2ec1b5162f801955b2e4326a90be663))
* move plugins section above branch/MCP/tasks in context panel ([9de8388](https://github.com/pannous/iclaude/commit/9de8388507fdf8f9f802fc42e4692253c5336539))
* move tunnel settings after auth, improve error messages ([a16e334](https://github.com/pannous/iclaude/commit/a16e3342313182ffd60cf4e8b5efa19e18b6c7f8))
* persist tunnel enabled setting across server restarts ([a4bf745](https://github.com/pannous/iclaude/commit/a4bf745f33cca26a1f322818bee82a9dbf5c190c))
* prefer agentName over mechanical title for agent sessions in sidebar ([e57e38f](https://github.com/pannous/iclaude/commit/e57e38f86c3e007468a6cfb4119a1c57f6f561e7))
* preserve config version on toggle + split cost/context display ([d922a7b](https://github.com/pannous/iclaude/commit/d922a7b71ef05b0628851331495a3f0d65b926a5))
* preserve post-thinking streaming text with HTML fragment scanning ([8e01a89](https://github.com/pannous/iclaude/commit/8e01a892ea5d2f210e0daa9662e1dd9aa057f642))
* prevent iOS text selection from stealing send/stop button taps ([3a676b3](https://github.com/pannous/iclaude/commit/3a676b35f468a3214d22ebf90f2717264de8d7db))
* prevent PWA service worker from auto-reloading the page ([2f91cfc](https://github.com/pannous/iclaude/commit/2f91cfc2e8a033b103a050a950473702005258fa))
* prevent WebSocket connection cycling and output replay ([#494](https://github.com/pannous/iclaude/issues/494)) ([91e2a22](https://github.com/pannous/iclaude/commit/91e2a22c039973e63031ebc8dcbdd92323254d8a))
* **prompts:** always fetch global prompts when no cwd is available ([a05bd81](https://github.com/pannous/iclaude/commit/a05bd817db47492f6faa4d6dce4484ab1c165b27))
* **prompts:** infer scope from cwd and allow saving prompts without active session ([77db08d](https://github.com/pannous/iclaude/commit/77db08da69323d4d9b0bff897cdee5f08acd7dce))
* **pwa:** alias virtual:pwa-register to stub when devOptions disabled ([e3421b1](https://github.com/pannous/iclaude/commit/e3421b1ebec80655e6af1835cce344dc842df4f8))
* redesign Composer layout for iOS Safari compatibility ([3658f75](https://github.com/pannous/iclaude/commit/3658f751af4b8d6291e899b00980fed1f5405097))
* remove dead _model param from generateSessionTitle, fix early-return guard ([6fd6054](https://github.com/pannous/iclaude/commit/6fd6054f486f4ac38f6b61ac30917fccdc6340b2))
* remove impossible keep_alive check in broadcastToBrowsers ([6d673e8](https://github.com/pannous/iclaude/commit/6d673e8b0c3d2c93a254a6685fd75318ecc59dd8))
* remove plugin tabs and skill picker from top bar ([87f56cc](https://github.com/pannous/iclaude/commit/87f56ccabc9847d9d3b62f7cae4390d3e196d684))
* remove plugins list from sidebar, keep nav button ([5f81ac3](https://github.com/pannous/iclaude/commit/5f81ac31a4e073075972ac8817d5e5e374ebe8d4))
* remove skipWaiting/clientsClaim from workbox config ([0d44cab](https://github.com/pannous/iclaude/commit/0d44cab14185f529c067dc1ccb1509cf6e6c6200))
* replace + text with puzzle piece icon for SkillPicker button ([727be93](https://github.com/pannous/iclaude/commit/727be9322b6edec304aafbda92319aba9e3e1b62))
* replaced raw localStorage with safeStorage in SessionBrowserPane.tsx ([55dc49c](https://github.com/pannous/iclaude/commit/55dc49c84b56167a0faa8413c7e6e614bd3984bb))
* reset activeTab when creating new session ([50e5e27](https://github.com/pannous/iclaude/commit/50e5e27ff1c6b148aaaa4852ce43ead4e7cee938))
* resolve auth loop on companion.pannous.com ([f0ade77](https://github.com/pannous/iclaude/commit/f0ade774d1d0a19de87395a86ec317cca51e9110))
* resolve stash conflicts and rename the-companion to iclaude in upstream test assertions ([b39eede](https://github.com/pannous/iclaude/commit/b39eedea81bc854e3900013e1cbd7db147a07beb))
* **resume-picker:** use real cwd for project name, strip agent title prefix ([330373e](https://github.com/pannous/iclaude/commit/330373ec8a38b11fa4bd865e8750ea01c1f8e334))
* **resume:** forward resumeSessionId to launcher so CLI spawns with --resume ([947a033](https://github.com/pannous/iclaude/commit/947a0332b954b00c96e19125528318d57d67313c))
* **routes:** validate cwd exists before spawning CLI process ([44c658f](https://github.com/pannous/iclaude/commit/44c658f30cb5a032c6d743c52af246da6f08e9f0))
* scan user messages for HTML files + open .html in browser not editor ([f56072f](https://github.com/pannous/iclaude/commit/f56072f6e62f103ce0dd14db80c21758f7ca3bef))
* **scanner:** detect image paths wrapped in backticks ([add6615](https://github.com/pannous/iclaude/commit/add6615a49f410cdaaff188416dbb10350606a2d))
* **scroll:** disable auto-scroll when scroll-to-bottom button is visible ([0dc0284](https://github.com/pannous/iclaude/commit/0dc028477858f18967fe5c85c9faac5ff7fe14f3))
* **server:** handle CLI 2.x deferred system_init and suppress startup disconnect flash ([80b2c9a](https://github.com/pannous/iclaude/commit/80b2c9a8c1a8470025cd247e41c435f343b2003f))
* **server:** pre-load CLI history when resuming sessions ([967bcce](https://github.com/pannous/iclaude/commit/967bcce5c97fd44fa82f1dfa3617d515c0165f4e))
* **server:** strip system-injected XML tags from session titles ([06d761f](https://github.com/pannous/iclaude/commit/06d761fdf645477a603ab5438254a44fd7d6a0b9))
* **server:** support usage limits on Linux and Docker ([#540](https://github.com/pannous/iclaude/issues/540)) ([70e5d4e](https://github.com/pannous/iclaude/commit/70e5d4e51ad699a45cae89c1288d7f6101889b17))
* **session:** allow navigating to archived sessions without redirect ([403887f](https://github.com/pannous/iclaude/commit/403887fb84a80e72b40061f2c665c4fd3843bc3f))
* **session:** auto-reactivate archived/exited sessions when opened via URL ([a1c0348](https://github.com/pannous/iclaude/commit/a1c0348c2299f12c9a510b617877cf3c22942734))
* **session:** fetch remote refs before worktree branch creation (THE-218) ([#460](https://github.com/pannous/iclaude/issues/460)) ([0050884](https://github.com/pannous/iclaude/commit/0050884dc07c3ec04a373be388e85f1ca28c2b97))
* **session:** increase orphan kill timeout from 10min to 24h ([42d988a](https://github.com/pannous/iclaude/commit/42d988a36f76e8fc7ef6769a38d5ee7af55f4139))
* **session:** only prune ghost sessions older than 5 minutes ([25042a7](https://github.com/pannous/iclaude/commit/25042a773cb9541e53168d2936659f57f03d0b31))
* **session:** persist sessions to ~/.companion/sessions/ instead of $TMPDIR ([6b4872a](https://github.com/pannous/iclaude/commit/6b4872a67dfbcf959d2fb0ad6088d415487d6314))
* **session:** prevent ghost filter from hiding actively-viewed sessions ([f300133](https://github.com/pannous/iclaude/commit/f300133cf5feb285d5386a08425957ae88c80086))
* **sessions:** clean stale system tags from titles in /api/sessions response ([16c24b4](https://github.com/pannous/iclaude/commit/16c24b44cc3d2d6327cf0903ed20d4e7f7f57790))
* **sessions:** eliminate &lt;local-command-caveat&gt; from session titles at every layer ([4c5b410](https://github.com/pannous/iclaude/commit/4c5b410364ab2a9028440d80f4b23cbd2e028d86))
* **sessions:** keep titled sessions from being filtered as orphaned prewarms ([94980c2](https://github.com/pannous/iclaude/commit/94980c2a2623bcaf7e6e78b3f0bf30d49f662685))
* **sessions:** strip XML system tags from titles at all layers (server load, render, filter) ([d89876f](https://github.com/pannous/iclaude/commit/d89876fbb12f62cb969a2de5e0b4caac12a0acf1))
* **session:** surface CLI startup errors to browser when process exits ([4b890fa](https://github.com/pannous/iclaude/commit/4b890fa36dc404a3d81427802f38c5e9b6e49bb6))
* **settings:** correct Anthropic model ID from claude-sonnet-4.6 to claude-sonnet-4-6 ([#503](https://github.com/pannous/iclaude/issues/503)) ([186aa77](https://github.com/pannous/iclaude/commit/186aa77c631a5d0c96ce96d41b7342e28b3b7024))
* **settings:** default desktop notifications to enabled ([1fef27f](https://github.com/pannous/iclaude/commit/1fef27f73c56d58f1fdf1bb09d972935b95680a6))
* **settings:** disable auto-deny dangerous tools by default ([#513](https://github.com/pannous/iclaude/issues/513)) ([4c9be30](https://github.com/pannous/iclaude/commit/4c9be30104dea84462daca03f52d079d697e2859))
* **settings:** hide misleading auto-rename hint when OpenRouter is selected ([55cebe5](https://github.com/pannous/iclaude/commit/55cebe50b6c0f3c4dbe733d2dc193ed0d1f19ffb))
* **settings:** preserve session title stability across mode switches ([d4ac56c](https://github.com/pannous/iclaude/commit/d4ac56cee7a8a30d390bcee15bcf4882fca77293))
* **shortcuts:** use Claude --resume session mechanism instead of manual context building; default session key when none provided ([fd20336](https://github.com/pannous/iclaude/commit/fd20336dfff347421d7dccd2664cd5b10e69a72a))
* show "Generating..." indicator immediately after sending a message ([81cdd50](https://github.com/pannous/iclaude/commit/81cdd50b9f9e1298f5524d0d2606a609906935d6))
* show both 5h and 7d limit bars in session stats with clear labels ([a4e019e](https://github.com/pannous/iclaude/commit/a4e019eebfe8bdc54c2a972e431775138240ed2f))
* show SkillPicker on all screens, fix fs-routes test types ([fadb0bf](https://github.com/pannous/iclaude/commit/fadb0bf2bada51c8aa1b29f40af6ef170e0cae53))
* **sidebar:** clicking folder label opens new session in that folder ([5a401b8](https://github.com/pannous/iclaude/commit/5a401b821c1ed9de6e0402afdc5541f68e2d99e6))
* **sidebar:** filter out spam sessions matching blocklist patterns ([434859e](https://github.com/pannous/iclaude/commit/434859e1c524c8411364651e2cb9831eb75cc730))
* **sidebar:** filter test_project by cwd path instead of label ([b3f6234](https://github.com/pannous/iclaude/commit/b3f62348cc229bfcf48e8dd19eb6ae8e8063c3b3))
* **sidebar:** hide redundant + button on folder groups ([1c31024](https://github.com/pannous/iclaude/commit/1c3102462f935812e1e827c6f3f879873f82d7f7))
* **sidebar:** make 'Clear all' button gray instead of red ([ce74ae7](https://github.com/pannous/iclaude/commit/ce74ae70e74e194cf7d204febf8cea823275a565))
* **sidebar:** prevent hover overlay and restore archived click ([#370](https://github.com/pannous/iclaude/issues/370)) ([56abbc1](https://github.com/pannous/iclaude/commit/56abbc1ca11b5ff34d0a2c1350740d697640b6d9))
* **sidebar:** remove confirmation dialog for single archived session delete ([0800e60](https://github.com/pannous/iclaude/commit/0800e609882ab7e23a5729f9e4d6d4766a81519d))
* **sidebar:** remove test_project from spam filter patterns ([fc1f250](https://github.com/pannous/iclaude/commit/fc1f250a7d9ccccf2d9a1a20ef20695f4ed80ccf))
* **sidebar:** rename 'Delete all' to 'Clear all' and skip confirmation dialog for archived sessions ([017c0ee](https://github.com/pannous/iclaude/commit/017c0eec3395b15a91c300f3edb7e1833745879a))
* **sidebar:** restore direct archive button, remove CC/CX badges ([23b73a3](https://github.com/pannous/iclaude/commit/23b73a3c25f116e0469e34ce5bc2412e57584313))
* **sidebar:** restore direct archive/restore/delete buttons, remove three-dots menu ([08e8393](https://github.com/pannous/iclaude/commit/08e8393f925f00b2819a079e663c2f28696e01ae))
* **sidebar:** show 'Clear all' button even when archived list is collapsed ([0378132](https://github.com/pannous/iclaude/commit/037813235253453bdd88ba9ed4b98b7994c77959))
* **sidebar:** show 'Clear all' button even with a single archived session ([74da3e8](https://github.com/pannous/iclaude/commit/74da3e822a2c26a4d895e55920c2a43a09f07951))
* **sidebar:** switch to chat view when clicking session title ([88faa2e](https://github.com/pannous/iclaude/commit/88faa2e163663050421af9a56caab02a8c8651e9))
* **sidebar:** sync focusedFolder when selecting a session ([a7da105](https://github.com/pannous/iclaude/commit/a7da105d8993ca7def98eaacddb0c15b4b6f4cfe))
* **sidebar:** use exact path matching for per-folder resume filter ([6ff5359](https://github.com/pannous/iclaude/commit/6ff5359a140c5fa97225c471bc7be209604368ff))
* **sidebar:** use store.removeSession instead of useStore.setState, fix agent section auto-expand ([b863beb](https://github.com/pannous/iclaude/commit/b863beb5f386f5de82cd806739e15cf40a3ad3b8))
* skip CLI onboarding prompts and remove misleading privacy consent error ([a918b28](https://github.com/pannous/iclaude/commit/a918b286b5fa49ff325e67c6c2dfbc9b22476640))
* soften hook message spacing instead of aggressive negative margins ([64ed9ac](https://github.com/pannous/iclaude/commit/64ed9ac4566d002379ee115536f9fd05b77bb56e))
* strip redundant "agent: " prefix from agent session labels in sidebar ([de45704](https://github.com/pannous/iclaude/commit/de457045bac9938d952f9009e7e20a72866ecddb))
* **tailscale:** add operator mode detection + DNS reachability checks ([#483](https://github.com/pannous/iclaude/issues/483)) ([d7a1460](https://github.com/pannous/iclaude/commit/d7a1460ac0864c7970970fcfcc0d8c7e1237eff2))
* **terminal:** inherit theme from app CSS variables ([116d341](https://github.com/pannous/iclaude/commit/116d34196d13f69c3641c24cc17b961d428d68c0))
* **terminal:** use dedicated terminal CSS variables that flip with theme ([2d631cf](https://github.com/pannous/iclaude/commit/2d631cf44931edeed142b3139a3b89402f8cb97f))
* **test:** add completeInput mock + fix editInputRef type in tests ([1c25b80](https://github.com/pannous/iclaude/commit/1c25b80a980ae7743619a2fb3a0e50505152c089))
* **test:** handle API billing/auth errors gracefully in auto-namer integration test ([317ef69](https://github.com/pannous/iclaude/commit/317ef695fb652d2df375833d43603bf8adbed617))
* **test:** replace flaky tunnel integration tests with mocked unit tests ([ac4fecf](https://github.com/pannous/iclaude/commit/ac4fecfb679e9333aa4ab7d063edd8651da54919))
* **tests:** restore non-bypass permission flow in 4 ws-bridge tests ([0cdcc53](https://github.com/pannous/iclaude/commit/0cdcc5310b7e571adbcdf5c02ef9456ac7280a17))
* **tests:** stabilize SessionEditorPane refresh assertion ([#466](https://github.com/pannous/iclaude/issues/466)) ([c244ed8](https://github.com/pannous/iclaude/commit/c244ed86b5144a8ab1b3729be208fe5ba6278b9f))
* **test:** type-safe mock for Bun.file in fs-routes test ([0947362](https://github.com/pannous/iclaude/commit/09473628f360412e240d03614475a5f84d3caf54))
* **topbar:** scroll to top when clicking anywhere on bar except tab buttons ([3b6dd92](https://github.com/pannous/iclaude/commit/3b6dd9224578038b624c11a8b75b54e4613add57))
* **topbar:** show session name in tab instead of static "Session" text ([2bd629b](https://github.com/pannous/iclaude/commit/2bd629b1831e4054f7d8b816fd39ffa9296a91ea))
* translate /api/exec response to match skill API contract ([b5a4a18](https://github.com/pannous/iclaude/commit/b5a4a18eb6ca19a5afb578ac00a6750585b42ea7))
* **tunnel:** auto-patch vite allowedHosts with tunnel provider wildcard ([8565407](https://github.com/pannous/iclaude/commit/8565407eaa2d849b731ec75545c7514a64f5c459))
* **tunnel:** forward to Vite port in dev mode so HMR works through tunnel ([d196f3a](https://github.com/pannous/iclaude/commit/d196f3a07d82df5b0976230179235e7f11114427))
* **ui:** enlarge sidebar action buttons for iPad touch targets ([b108a94](https://github.com/pannous/iclaude/commit/b108a94f169e1c10694bab0d724d45d99f41a58a))
* **ui:** increase sidebar archive/restore/delete button hit targets ([4e992a2](https://github.com/pannous/iclaude/commit/4e992a2b47864e401ec8680e212a3417ae4fdab6))
* **ui:** limit auto-approve notifications to one with dismiss button ([#504](https://github.com/pannous/iclaude/issues/504)) ([6fb15a0](https://github.com/pannous/iclaude/commit/6fb15a0ebe1790cef1368dc80af0a9eb0da6c7d1))
* **ui:** make copy button work on iPad with fallback and larger touch target ([85011b7](https://github.com/pannous/iclaude/commit/85011b7eb0bbc2f3420769b2b595c057266fb34a))
* **ui:** make copy buttons always visible for touch devices ([5374e67](https://github.com/pannous/iclaude/commit/5374e67c3a1721ac1dd6fcb6d564365c965e492c))
* **ui:** make ToolBlock file paths clickable to open in editor 🎉 ([774d118](https://github.com/pannous/iclaude/commit/774d118333fcb27d80a1d7cba8054fe173e60325))
* **ui:** match archive button icon size to restore/delete buttons ([f9ebfcf](https://github.com/pannous/iclaude/commit/f9ebfcf95db4436b88f656fa565c7f4cfabab4cd))
* **ui:** match session archive button size to folder archive button ([bf22772](https://github.com/pannous/iclaude/commit/bf22772c6307d7d735785fc69acc35a688d0e348))
* **ui:** separate file path button from expand toggle in ToolBlock ([faa8e0c](https://github.com/pannous/iclaude/commit/faa8e0c922214c7c80ee1b9a50178e35ea570978))
* **ui:** show fork button while agent is running ([8e00b56](https://github.com/pannous/iclaude/commit/8e00b56c5e6ac1769731faab785cd5137d80f736))
* **ui:** use button elements for clickable file paths on iOS/iPadOS ([5b5da46](https://github.com/pannous/iclaude/commit/5b5da46f95af1507da0be8576b7605b967bafdd1))
* unset CLAUDECODE env in claudeAsk execSync to allow nested claude invocation ([b053e8b](https://github.com/pannous/iclaude/commit/b053e8bda5bc6584cba9c7c83ce2f28aa439224b))
* use span instead of button for inline filename links ([b0245ca](https://github.com/pannous/iclaude/commit/b0245ca9a54103ec0f700f2214f7d926efffbe86))
* version-based config migration resets section order on layout changes ([2573826](https://github.com/pannous/iclaude/commit/257382621e8e94dbf4b44e82e0bc49c789246184))
* **vite:** exclude test files from HMR watch to prevent page reloads ([43a9f30](https://github.com/pannous/iclaude/commit/43a9f30ffa822e0b81d5b7ad237931a3e43fdbd2))
* **web:** add auth header to UpdateOverlay server poll ([#410](https://github.com/pannous/iclaude/issues/410)) ([86e26cb](https://github.com/pannous/iclaude/commit/86e26cb0a3983b5c5c39aa3a60276bdedf17629a))
* **web:** broadcast session name update on manual rename ([#427](https://github.com/pannous/iclaude/issues/427)) ([e3479b8](https://github.com/pannous/iclaude/commit/e3479b8ca0018014f6bd3121246d047ee292125e))
* **web:** decouple Saved Prompts page from session cwd and add grouped view ([#450](https://github.com/pannous/iclaude/issues/450)) ([c87cd27](https://github.com/pannous/iclaude/commit/c87cd2799c341ec44e760721df6a2721f0a3c1d0))
* **web:** fix Codex session reconnection Transport closed errors ([#431](https://github.com/pannous/iclaude/issues/431)) ([c559f79](https://github.com/pannous/iclaude/commit/c559f7910c4d18b83b343af99ef7c932e66cce66))
* **web:** fix plan display colors broken in light mode ([#417](https://github.com/pannous/iclaude/issues/417)) ([90f6e81](https://github.com/pannous/iclaude/commit/90f6e8182af098027610bc89481bb7c87c0038f3))
* **web:** flush pending messages when attaching Codex adapter ([#433](https://github.com/pannous/iclaude/issues/433)) ([86a25ff](https://github.com/pannous/iclaude/commit/86a25ffde7ce7c8672367607352508bcc222b08a))
* **web:** handle Codex ExitPlanMode as dedicated permission request ([#430](https://github.com/pannous/iclaude/issues/430)) ([bde2d11](https://github.com/pannous/iclaude/commit/bde2d11b5234faa9f6889d78133ef3dc2ae182ad))
* **web:** prevent Codex Docker sessions from becoming zombie/unreachable ([#449](https://github.com/pannous/iclaude/issues/449)) ([db947f5](https://github.com/pannous/iclaude/commit/db947f57989d676e1b40f44a7c7014cffb5fed19))
* **web:** prevent horizontal scroll on Android Chrome ([#443](https://github.com/pannous/iclaude/issues/443)) ([cc4743c](https://github.com/pannous/iclaude/commit/cc4743ce3112f0e523e7dd688a7ec8a008f73e57))
* **web:** send full Linear ticket description in session prompt ([#435](https://github.com/pannous/iclaude/issues/435)) ([bd9745a](https://github.com/pannous/iclaude/commit/bd9745a81b43fccb843a32d9a842e6c04e7fb8b5))
* **windows:** add platform guards and prefer where over which ([#512](https://github.com/pannous/iclaude/issues/512)) ([08464f5](https://github.com/pannous/iclaude/commit/08464f5e2b82153a4218ebbad10f4efdf3f0c81a))
* **ws-bridge:** deduplicate user messages on reconnect by preserving client-generated ID ([50ef053](https://github.com/pannous/iclaude/commit/50ef0534726f6f661d4ef9f00982f824a7d2c179))
* **ws-bridge:** increase orphan kill timeout from 60s to 10min ([747749f](https://github.com/pannous/iclaude/commit/747749f753b3e5b466e6dd0f320b578989492c8d))
* **ws-bridge:** kill orphaned CLI processes when idle with no browsers ([3b15ac8](https://github.com/pannous/iclaude/commit/3b15ac849f4b9f9daac9cb23070c57cb722634da))
* **ws-bridge:** prevent server crash from unhandled errors in message handlers ([724eb5e](https://github.com/pannous/iclaude/commit/724eb5efdf4a30bbc5d4949f9b84e4ecb3ac1244))
* **ws-bridge:** search all project dirs when loading CLI history ([968958e](https://github.com/pannous/iclaude/commit/968958ea1e9c0c51963ab150a6ef7bb18bb18788))
* **ws:** clean up hadAssistantThisTurn on session disconnect ([279cceb](https://github.com/pannous/iclaude/commit/279cceb710a03f79ebf5dae1df0b52d6b231a095))
* **ws:** deduplicate extended-thinking assistant messages sharing the same ID ([6039871](https://github.com/pannous/iclaude/commit/6039871299bbf827a534ef29d2388dc84e28159c))
* **ws:** only connect the currently-viewed session, not all sessions ([46b73a2](https://github.com/pannous/iclaude/commit/46b73a23db2ac80613f868f71d15e52e9ee45522))
* **ws:** prevent reconnects to archived/deleted sessions ([26adcaf](https://github.com/pannous/iclaude/commit/26adcafb9e39b7d5f7a05e65d6db7f65067539b6))


### Code Refactoring

* **agents:** extract icon map, dropdown helper, and pill base constant ([51ff1e8](https://github.com/pannous/iclaude/commit/51ff1e806dd38ef56bbd55eaf268ff82c0c6c235))
* **agents:** remove Vercel Chat SDK entirely, keep webhooks + Linear Agent SDK ([#493](https://github.com/pannous/iclaude/issues/493)) ([64a39f6](https://github.com/pannous/iclaude/commit/64a39f6d01746fa3894b062e5a23d154f7e668bb))
* **api:** centralize auth key, extract request helper, remove unused export ([c2b890c](https://github.com/pannous/iclaude/commit/c2b890c6ae665f7b460e7af7fddb5c433934e414))
* **app:** extract lazyNamed helper, replace route chain with PAGE_MAP ([6dbe79d](https://github.com/pannous/iclaude/commit/6dbe79d5eaa048307b3c32ed312b29d303852200))
* **auth:** simplify token management to in-memory only, no file persistence ([19b4f2d](https://github.com/pannous/iclaude/commit/19b4f2da5f2c4e5cf6c8432a359ec661b8dd80d4))
* **cli-launcher:** remove trivial comments ([17eb076](https://github.com/pannous/iclaude/commit/17eb0765e38b8e99765542feb0eca0b074cd851f))
* **codex-adapter:** fix async Promise constructor anti-pattern ([ec09c6d](https://github.com/pannous/iclaude/commit/ec09c6d1a8aa13868eff01c219960babc0122d04))
* **composer:** extract state reset, menu key handler, image formatter helpers ([e3731b5](https://github.com/pannous/iclaude/commit/e3731b5e7f1178a1ad1698083cd66da6fb162101))
* **container:** extract path constants, consolidate safeExec helper ([76f7eb8](https://github.com/pannous/iclaude/commit/76f7eb8d3a483b50aa6342d91f25ffd210e4b4c8))
* **fragments:** replace WS round-trip query with simple push-only state ([e147817](https://github.com/pannous/iclaude/commit/e147817fe49805023b87370cb5f29eafe279a3a7))
* **frontend:** add setInMap/addToSet helpers to reduce store boilerplate ([660da8f](https://github.com/pannous/iclaude/commit/660da8f299126ec1d8764f34b395dd7506c996ea))
* **frontend:** extract shared tool displays from PermissionBanner and ToolBlock ([b419494](https://github.com/pannous/iclaude/commit/b419494d6b1c0bf9b06adb7ef26ee420db1c7408))
* **frontend:** replace getInitial* boilerplate with factory functions ([c1c2a13](https://github.com/pannous/iclaude/commit/c1c2a13443fc3804a754d348c7f954ace7cc8ff6))
* **frontend:** stabilize frontend with dead code removal, memory leak fixes, and component extraction ([#375](https://github.com/pannous/iclaude/issues/375)) ([b232a2e](https://github.com/pannous/iclaude/commit/b232a2e709ae71d0109fdcf8dfe0d7d51c202a83))
* merge Webhooks section into Tunnel settings ([92ae582](https://github.com/pannous/iclaude/commit/92ae5829da592299f727f554af51fff8941888bb))
* move regenerate button inline next to copy in auth token row ([c539bc3](https://github.com/pannous/iclaude/commit/c539bc3d168386a6a557cc6fbd829c5ead86f705))
* move theme toggle + processes tab to sidebar, remove session cwd ([7997e22](https://github.com/pannous/iclaude/commit/7997e22e5765b6107dff59f8c27d9affc97bf8e9))
* rename package from the-companion to iclaude ([cdf0a77](https://github.com/pannous/iclaude/commit/cdf0a77a7a0f2690ed1d02142b91c08b932f964f))
* rename skill references to panel in frontend components ([67e0dfb](https://github.com/pannous/iclaude/commit/67e0dfbf926d5531e2112e36f82124ade6ff7d55))
* rename skills to panels across backend, tests, and docs ([b3d637c](https://github.com/pannous/iclaude/commit/b3d637cc1729f60dbb8cefd7f18ecdd994c5b173))
* rename Terminal to Shell with prompt-style icon ([b7354a1](https://github.com/pannous/iclaude/commit/b7354a1f0f7f156e331f8629ce071c73fa74ce40))
* revert sidebar nav from vertical list to 3-column grid layout ([a28351d](https://github.com/pannous/iclaude/commit/a28351d16cd2591bbda4c69c0a16d8c85222727c))
* revert sidebar nav from Workbench/Workspace sections to flat list ([14170a0](https://github.com/pannous/iclaude/commit/14170a0f38096e0caa0268651d6dcdc38402acda))
* **routes:** cleanup debug logs and trivial comments ([efbd30b](https://github.com/pannous/iclaude/commit/efbd30b9dc08d54e7492c021de887221e21ca527))
* **server:** consolidate control request builders in ws-bridge-controls.ts ([2b657f8](https://github.com/pannous/iclaude/commit/2b657f87fba3951c935ddbf745bc72b05e1de55c))
* **server:** decompose ws-bridge into event pipeline ([#535](https://github.com/pannous/iclaude/issues/535)) ([5059845](https://github.com/pannous/iclaude/commit/5059845e73f9c2bff63ac9c4c8358fbccc5be06e))
* **server:** extract SessionOrchestrator for unified session lifecycle ([#533](https://github.com/pannous/iclaude/issues/533)) ([945b596](https://github.com/pannous/iclaude/commit/945b596423695c13e15d9fd0ff117a25d43a69a1))
* **server:** extract shared slugify/ensureDir/filePath to utils.ts ([bd24053](https://github.com/pannous/iclaude/commit/bd24053b0fc992ed1deb7599ffda0e28daf1d443))
* **server:** introduce unified IBackendAdapter for Claude & Codex ([#543](https://github.com/pannous/iclaude/issues/543)) ([18337b8](https://github.com/pannous/iclaude/commit/18337b824b8d1465eb7fca67c9002729dee764bb))
* **server:** modularize routes and ws bridge architecture ([#379](https://github.com/pannous/iclaude/issues/379)) ([3043e1b](https://github.com/pannous/iclaude/commit/3043e1bbffac5bc02c8a25dbdeba1e4f31177a65))
* **server:** use GIT_SESSION_KEYS in refreshGitInfo snapshot ([519c7c1](https://github.com/pannous/iclaude/commit/519c7c169e6b921e58940361e1e427ba1847fe3c))
* **Sidebar:** cleanup dead code and comments ([ae87144](https://github.com/pannous/iclaude/commit/ae87144152501cc9966748d2187a53782e92d58a))
* **store:** cleanup dead code and comments ([e147b07](https://github.com/pannous/iclaude/commit/e147b0721c80f20ab8e0cd2a8904592341744194))
* **store:** migrate frontend store to domain-based slice architecture ([#534](https://github.com/pannous/iclaude/issues/534)) ([08739a8](https://github.com/pannous/iclaude/commit/08739a8df1593c553ae958727d81a7df92acd43e))
* **task-panel:** extract UsageBar component for progress bars ([347308c](https://github.com/pannous/iclaude/commit/347308c5e68d2623a3980294fa9d4919485118c7))
* **ui:** redesign sidebar session list for better visual hierarchy ([#539](https://github.com/pannous/iclaude/issues/539)) ([728702e](https://github.com/pannous/iclaude/commit/728702ec791aa3ff0d0b14879a3b68c8c952144d))
* unify login page and token-page into single LoginPage component ([d0d934d](https://github.com/pannous/iclaude/commit/d0d934de005a9ad3d35fc97634dcaed24a649357))
* use CLI/Codex session IDs as canonical session IDs ([e860b1a](https://github.com/pannous/iclaude/commit/e860b1ad906ffb146d30efd5eb57ff179d1e8c7c))
* use npm version patch for build bump ([192b212](https://github.com/pannous/iclaude/commit/192b2125a933df90682d9e9b3dcfe72cc8bd999d))
* use SessionStart hook instead of PreToolUse + temp file ([9dd052d](https://github.com/pannous/iclaude/commit/9dd052d8621f8a7649141839cbcc0fee589098e8))
* **ws:** cleanup debug logs, dead code, and fix indentation ([ffa1e9f](https://github.com/pannous/iclaude/commit/ffa1e9f6771c138fdbd865d2883b78aa0104903d))

## [0.82.0](https://github.com/The-Vibe-Company/companion/compare/the-companion-v0.81.1...the-companion-v0.82.0) (2026-03-14)


### Features

* **server:** formalize session state machine and transitions ([#541](https://github.com/The-Vibe-Company/companion/issues/541)) ([0cc85c1](https://github.com/The-Vibe-Company/companion/commit/0cc85c1703220d949ce0ca6f8f56d876ed59387d))

## [0.81.1](https://github.com/The-Vibe-Company/companion/compare/the-companion-v0.81.0...the-companion-v0.81.1) (2026-03-14)


### Bug Fixes

* **server:** support usage limits on Linux and Docker ([#540](https://github.com/The-Vibe-Company/companion/issues/540)) ([70e5d4e](https://github.com/The-Vibe-Company/companion/commit/70e5d4e51ad699a45cae89c1288d7f6101889b17))


### Code Refactoring

* **ui:** redesign sidebar session list for better visual hierarchy ([#539](https://github.com/The-Vibe-Company/companion/issues/539)) ([728702e](https://github.com/The-Vibe-Company/companion/commit/728702ec791aa3ff0d0b14879a3b68c8c952144d))

## [0.81.0](https://github.com/The-Vibe-Company/companion/compare/the-companion-v0.80.1...the-companion-v0.81.0) (2026-03-14)


### Features

* **server:** implement typed internal event bus ([#536](https://github.com/The-Vibe-Company/companion/issues/536)) ([d8fa90b](https://github.com/The-Vibe-Company/companion/commit/d8fa90b7a38892267f1676187dece78ee272d308))
* **skills:** add new skills for design enhancement and adaptation ([a1643c4](https://github.com/The-Vibe-Company/companion/commit/a1643c4d4713168375c4dc4360be91d3903766ad))

## [0.80.1](https://github.com/The-Vibe-Company/companion/compare/the-companion-v0.80.0...the-companion-v0.80.1) (2026-03-14)


### Code Refactoring

* **server:** decompose ws-bridge into event pipeline ([#535](https://github.com/The-Vibe-Company/companion/issues/535)) ([5059845](https://github.com/The-Vibe-Company/companion/commit/5059845e73f9c2bff63ac9c4c8358fbccc5be06e))
* **server:** extract SessionOrchestrator for unified session lifecycle ([#533](https://github.com/The-Vibe-Company/companion/issues/533)) ([945b596](https://github.com/The-Vibe-Company/companion/commit/945b596423695c13e15d9fd0ff117a25d43a69a1))
* **store:** migrate frontend store to domain-based slice architecture ([#534](https://github.com/The-Vibe-Company/companion/issues/534)) ([08739a8](https://github.com/The-Vibe-Company/companion/commit/08739a8df1593c553ae958727d81a7df92acd43e))

## [0.80.0](https://github.com/The-Vibe-Company/companion/compare/the-companion-v0.79.0...the-companion-v0.80.0) (2026-03-14)


### Features

* **linear:** add guided Linear Agent setup wizard ([#522](https://github.com/The-Vibe-Company/companion/issues/522)) ([0bf218d](https://github.com/The-Vibe-Company/companion/commit/0bf218de9fd078c5fc190224b0f620392fe71759))
* **platform:** add hetzner provider and instance scaling ([#525](https://github.com/The-Vibe-Company/companion/issues/525)) ([4618efa](https://github.com/The-Vibe-Company/companion/commit/4618efad9fe4cf4dae634773784fe76460aa639a))


### Bug Fixes

* **codex:** handle WS reconnection and idle kill for Codex sessions ([#530](https://github.com/The-Vibe-Company/companion/issues/530)) ([f26a6b8](https://github.com/The-Vibe-Company/companion/commit/f26a6b809d4671ec1dd2716e312a007ec0da83cd))
## [0.79.0](https://github.com/The-Vibe-Company/companion/compare/the-companion-v0.78.0...the-companion-v0.79.0) (2026-03-13)


### Features

* **update:** add Docker image update dialog after app update ([#526](https://github.com/The-Vibe-Company/companion/issues/526)) ([7b18479](https://github.com/The-Vibe-Company/companion/commit/7b184796a2b33113fa0fe159e1a96e6de36673f0))

## [0.78.0](https://github.com/The-Vibe-Company/companion/compare/the-companion-v0.77.0...the-companion-v0.78.0) (2026-03-13)


### Features

* **sandbox:** add init script testing and remove Dockerfile support ([#520](https://github.com/The-Vibe-Company/companion/issues/520)) ([39dc238](https://github.com/The-Vibe-Company/companion/commit/39dc238da6a4922e39bce5f1c71064f37c1c5a08))


### Bug Fixes

* **codex:** fall back to thread/start when thread/resume fails on session restart ([#524](https://github.com/The-Vibe-Company/companion/issues/524)) ([36e4179](https://github.com/The-Vibe-Company/companion/commit/36e41794e8aef968786021a03e688802710c5e51))

## [0.77.0](https://github.com/The-Vibe-Company/companion/compare/the-companion-v0.76.0...the-companion-v0.77.0) (2026-03-13)


### Features

* **browser:** add browser preview tab with dual-mode support (container VNC + host proxy) ([#508](https://github.com/The-Vibe-Company/companion/issues/508)) ([4a30f96](https://github.com/The-Vibe-Company/companion/commit/4a30f9699d7ccfa749a1c0cf0477dbc2b433b21f))
* **platform:** non-blocking instance creation with SSE streaming ([#518](https://github.com/The-Vibe-Company/companion/issues/518)) ([5972d60](https://github.com/The-Vibe-Company/companion/commit/5972d60954e1f34b010811e2d47caafa02557d84))
* **sandbox:** enable sandbox system for Codex backend ([#521](https://github.com/The-Vibe-Company/companion/issues/521)) ([ea856b1](https://github.com/The-Vibe-Company/companion/commit/ea856b1668e4132e2aacbcf30e3ef43b61011f61))

## [0.76.0](https://github.com/The-Vibe-Company/companion/compare/the-companion-v0.75.2...the-companion-v0.76.0) (2026-03-13)


### Features

* **platform:** add Companion Cloud managed platform foundation ([#401](https://github.com/The-Vibe-Company/companion/issues/401)) ([cdd6a0c](https://github.com/The-Vibe-Company/companion/commit/cdd6a0c1df616ffd16439339b0be745c812ad16a))
* **sandbox:** separate sandbox from environment management ([#516](https://github.com/The-Vibe-Company/companion/issues/516)) ([d38dcc3](https://github.com/The-Vibe-Company/companion/commit/d38dcc34623048fdf881584691f9dabfad025d0d))

## [0.75.2](https://github.com/The-Vibe-Company/companion/compare/the-companion-v0.75.1...the-companion-v0.75.2) (2026-03-12)


### Bug Fixes

* **codex:** increase WS timeouts and auto-relaunch on RPC timeout ([#514](https://github.com/The-Vibe-Company/companion/issues/514)) ([2fcccf3](https://github.com/The-Vibe-Company/companion/commit/2fcccf39d72a59bc674b41e7d912297c3afce4eb))
* **settings:** disable auto-deny dangerous tools by default ([#513](https://github.com/The-Vibe-Company/companion/issues/513)) ([4c9be30](https://github.com/The-Vibe-Company/companion/commit/4c9be30104dea84462daca03f52d079d697e2859))

## [0.75.1](https://github.com/The-Vibe-Company/companion/compare/the-companion-v0.75.0...the-companion-v0.75.1) (2026-03-12)


### Bug Fixes

* add Windows compatibility for binary resolution and process spawning ([#510](https://github.com/The-Vibe-Company/companion/issues/510)) ([79573af](https://github.com/The-Vibe-Company/companion/commit/79573af1243a74586f56b1cc5fd4558f76c2c69e))
* **windows:** add platform guards and prefer where over which ([#512](https://github.com/The-Vibe-Company/companion/issues/512)) ([08464f5](https://github.com/The-Vibe-Company/companion/commit/08464f5e2b82153a4218ebbad10f4efdf3f0c81a))

## [0.75.0](https://github.com/The-Vibe-Company/companion/compare/the-companion-v0.74.0...the-companion-v0.75.0) (2026-03-11)


### Features

* **browser:** add browser preview for containerized sessions ([#505](https://github.com/The-Vibe-Company/companion/issues/505)) ([2e61e76](https://github.com/The-Vibe-Company/companion/commit/2e61e768ec3a99dea37212fe39bff3681ededdc9))

## [0.74.0](https://github.com/The-Vibe-Company/companion/compare/the-companion-v0.73.0...the-companion-v0.74.0) (2026-03-10)


### Features

* **composer:** pre-populate slash commands and skills on session creation ([#500](https://github.com/The-Vibe-Company/companion/issues/500)) ([79b4664](https://github.com/The-Vibe-Company/companion/commit/79b466417631ab9f345e05d6d3d55d1786cdf398))


### Bug Fixes

* prevent WebSocket connection cycling and output replay ([#494](https://github.com/The-Vibe-Company/companion/issues/494)) ([91e2a22](https://github.com/The-Vibe-Company/companion/commit/91e2a22c039973e63031ebc8dcbdd92323254d8a))
* **settings:** correct Anthropic model ID from claude-sonnet-4.6 to claude-sonnet-4-6 ([#503](https://github.com/The-Vibe-Company/companion/issues/503)) ([186aa77](https://github.com/The-Vibe-Company/companion/commit/186aa77c631a5d0c96ce96d41b7342e28b3b7024))
* **ui:** limit auto-approve notifications to one with dismiss button ([#504](https://github.com/The-Vibe-Company/companion/issues/504)) ([6fb15a0](https://github.com/The-Vibe-Company/companion/commit/6fb15a0ebe1790cef1368dc80af0a9eb0da6c7d1))

## [0.73.0](https://github.com/The-Vibe-Company/companion/compare/the-companion-v0.72.0...the-companion-v0.73.0) (2026-03-10)


### Features

* **agents:** add Linear Agent Interaction SDK integration ([#486](https://github.com/The-Vibe-Company/companion/issues/486)) ([64b838d](https://github.com/The-Vibe-Company/companion/commit/64b838de84c4c5b21ee4b43d6853f36975a6923b))
* **agents:** add per-agent chat platform credentials ([#477](https://github.com/The-Vibe-Company/companion/issues/477)) ([afb9557](https://github.com/The-Vibe-Company/companion/commit/afb95575615516600a284666f6f55c5c121e9650))
* **docker:** add Cubic CLI to the-companion image ([#499](https://github.com/The-Vibe-Company/companion/issues/499)) ([2b45aaa](https://github.com/The-Vibe-Company/companion/commit/2b45aaa2790e41cff2c940adb26106ddf06729ef))
* **integrations:** add Tailscale Funnel integration for one-click HTTPS ([#482](https://github.com/The-Vibe-Company/companion/issues/482)) ([a79f1fd](https://github.com/The-Vibe-Company/companion/commit/a79f1fd4f45dad176a2f718029e4c6625cdd7f02))
* **linear:** inject Linear context into CLI system prompt ([#497](https://github.com/The-Vibe-Company/companion/issues/497)) ([db0ae68](https://github.com/The-Vibe-Company/companion/commit/db0ae6843da948273844acb2f7f9adafa05a42a3))
* **linear:** support multiple Linear connections with API key injection ([#496](https://github.com/The-Vibe-Company/companion/issues/496)) ([3c76a4b](https://github.com/The-Vibe-Company/companion/commit/3c76a4b8331f1519be1abb34476e53186dd57b48))
* **settings:** add public URL config + guided Linear webhook setup ([#478](https://github.com/The-Vibe-Company/companion/issues/478)) ([18f08d3](https://github.com/The-Vibe-Company/companion/commit/18f08d35ea412c5a81f0918197ea23a90f485a97))


### Bug Fixes

* **agents:** make webhook secret field editable for Linear/GitHub ([#485](https://github.com/The-Vibe-Company/companion/issues/485)) ([b3460db](https://github.com/The-Vibe-Company/companion/commit/b3460db75b5bec4ea116f41ea83e710c79566751))
* **codex:** auto-relaunch session when transport drops with browsers connected ([#484](https://github.com/The-Vibe-Company/companion/issues/484)) ([c0ec63b](https://github.com/The-Vibe-Company/companion/commit/c0ec63be8e9e1814e33eef2fc9b58da1b09e06b7))
* **linear:** refresh OAuth configured state after saving credentials ([#495](https://github.com/The-Vibe-Company/companion/issues/495)) ([db5998a](https://github.com/The-Vibe-Company/companion/commit/db5998a2752f0188432d4c726dc8d1fbc8768cca))
* **linear:** thread connectionId through CreateIssueModal for multi-connection support ([#498](https://github.com/The-Vibe-Company/companion/issues/498)) ([ccb8881](https://github.com/The-Vibe-Company/companion/commit/ccb8881066bafe9664f7cf3822f528d840499df1))
* **tailscale:** add operator mode detection + DNS reachability checks ([#483](https://github.com/The-Vibe-Company/companion/issues/483)) ([d7a1460](https://github.com/The-Vibe-Company/companion/commit/d7a1460ac0864c7970970fcfcc0d8c7e1237eff2))
* **web:** prevent horizontal scroll on Android Chrome ([#443](https://github.com/The-Vibe-Company/companion/issues/443)) ([cc4743c](https://github.com/The-Vibe-Company/companion/commit/cc4743ce3112f0e523e7dd688a7ec8a008f73e57))

## [0.72.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.71.0...iclaude-v0.72.0) (2026-03-04)


### Features

* **agents:** add conversational chat SDK, cloud relay, and runs view ([#471](https://github.com/The-Vibe-Company/companion/issues/471)) ([e8420c8](https://github.com/The-Vibe-Company/companion/commit/e8420c824cc07b8bb374ec15b6b01653e94daef6))
* Development environment setup ([#472](https://github.com/The-Vibe-Company/companion/issues/472)) ([99fed7c](https://github.com/The-Vibe-Company/companion/commit/99fed7c1e35315e9bcec79ebd937010019796e20))
* Menu esthétique ergonomie ([#474](https://github.com/The-Vibe-Company/companion/issues/474)) ([033a854](https://github.com/The-Vibe-Company/companion/commit/033a8547d18bee4fd12b71fadb9322a1f445ef9c))

## [0.71.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.70.0...iclaude-v0.71.0) (2026-03-04)


### Features

* **sidebar:** add external links to docs, GitHub, and website ([#468](https://github.com/The-Vibe-Company/companion/issues/468)) ([6fe561e](https://github.com/The-Vibe-Company/companion/commit/6fe561e83fbdd90359bee7bf76587256b35d0704))
* **sidebar:** redesign footer nav from grid to vertical list ([#470](https://github.com/The-Vibe-Company/companion/issues/470)) ([8fdd9f6](https://github.com/The-Vibe-Company/companion/commit/8fdd9f6b1b91e5cb311abfd46ee122358c2cd553))

## [0.70.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.69.0...iclaude-v0.70.0) (2026-03-03)


### Features

* **ui:** add compacting context indicator in message feed ([#462](https://github.com/The-Vibe-Company/companion/issues/462)) ([9bfab3c](https://github.com/The-Vibe-Company/companion/commit/9bfab3c8786d0273da0bb247c3f6bcd71028608c))


### Bug Fixes

* **tests:** stabilize SessionEditorPane refresh assertion ([#466](https://github.com/The-Vibe-Company/companion/issues/466)) ([c244ed8](https://github.com/The-Vibe-Company/companion/commit/c244ed86b5144a8ab1b3729be208fe5ba6278b9f))

## [0.69.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.68.1...iclaude-v0.69.0) (2026-03-01)


### Features

* **ai-validator:** add actionable error reasons for AI validation failures ([#457](https://github.com/The-Vibe-Company/companion/issues/457)) ([ab5455e](https://github.com/The-Vibe-Company/companion/commit/ab5455e33d7c148a62e8abb81c31306b4ed3d50f))


### Bug Fixes

* **session:** fetch remote refs before worktree branch creation (THE-218) ([#460](https://github.com/The-Vibe-Company/companion/issues/460)) ([0050884](https://github.com/The-Vibe-Company/companion/commit/0050884dc07c3ec04a373be388e85f1ca28c2b97))

## [0.68.1](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.68.0...iclaude-v0.68.1) (2026-03-01)


### Bug Fixes

* **ci:** use patch-core bump for preview npm versions (THE-216) ([#456](https://github.com/The-Vibe-Company/companion/issues/456)) ([c3c1115](https://github.com/The-Vibe-Company/companion/commit/c3c11156b33e2a5549293365d32107ccf93c8d51))

## [0.68.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.67.0...iclaude-v0.68.0) (2026-02-28)


### Features

* **web:** add Docker Builder page and refactor Environment UI ([#454](https://github.com/The-Vibe-Company/companion/issues/454)) ([c97dc9e](https://github.com/The-Vibe-Company/companion/commit/c97dc9e52a49528b5e7a64bbf518c33f630d2853))


### Bug Fixes

* **docs:** update mintlify docs.json schema ([265c89e](https://github.com/The-Vibe-Company/companion/commit/265c89eb3480974458dc7e0ad135a1fbb5b306b3))

## [0.67.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.66.0...iclaude-v0.67.0) (2026-02-28)


### Features

* **multi-agent:** enable codex by default and improve subagent UI ([#444](https://github.com/The-Vibe-Company/companion/issues/444)) ([973ca5f](https://github.com/The-Vibe-Company/companion/commit/973ca5facc9f9c1b36b3b48f0d7183c8fa54da47))
* **web:** add prerelease update channel and preview CI pipeline ([#451](https://github.com/The-Vibe-Company/companion/issues/451)) ([6799c6f](https://github.com/The-Vibe-Company/companion/commit/6799c6f46124ff2da61d7612f344fbd23da9ec69))
* **web:** make saved prompts targetable by project scope or global ([#448](https://github.com/The-Vibe-Company/companion/issues/448)) ([805eb73](https://github.com/The-Vibe-Company/companion/commit/805eb73c7f3138a6feb5ad33a485dc60d9364a0a))


### Bug Fixes

* **ci:** use bun run test instead of bun test in preview workflow ([#452](https://github.com/The-Vibe-Company/companion/issues/452)) ([f2e2f10](https://github.com/The-Vibe-Company/companion/commit/f2e2f10b7f74c9fb3126c9c9d2be1c74b43a3bf9))
* **codex:** preserve parent id in task tool-use backfill ([#447](https://github.com/The-Vibe-Company/companion/issues/447)) ([a208ee4](https://github.com/The-Vibe-Company/companion/commit/a208ee42e09209866be39940c6fb2d480d9ecc5a))
* **web:** decouple Saved Prompts page from session cwd and add grouped view ([#450](https://github.com/The-Vibe-Company/companion/issues/450)) ([c87cd27](https://github.com/The-Vibe-Company/companion/commit/c87cd2799c341ec44e760721df6a2721f0a3c1d0))
* **web:** prevent Codex Docker sessions from becoming zombie/unreachable ([#449](https://github.com/The-Vibe-Company/companion/issues/449)) ([db947f5](https://github.com/The-Vibe-Company/companion/commit/db947f57989d676e1b40f44a7c7014cffb5fed19))

## [0.66.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.65.0...iclaude-v0.66.0) (2026-02-28)


### Features

* **web:** prompt to transition Linear issue status on session archive ([#441](https://github.com/The-Vibe-Company/companion/issues/441)) ([e8ed5bd](https://github.com/The-Vibe-Company/companion/commit/e8ed5bd4a3b30f20dcd7e10d64f834752bed8b37))

## [0.65.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.64.3...iclaude-v0.65.0) (2026-02-27)


### Features

* **web:** replace OpenRouter by Anthropic for AI features ([#439](https://github.com/The-Vibe-Company/companion/issues/439)) ([40d794c](https://github.com/The-Vibe-Company/companion/commit/40d794c24f90cd31628a362c960ad135877326e9))

## [0.64.3](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.64.2...iclaude-v0.64.3) (2026-02-27)


### Bug Fixes

* **web:** send full Linear ticket description in session prompt ([#435](https://github.com/The-Vibe-Company/companion/issues/435)) ([bd9745a](https://github.com/The-Vibe-Company/companion/commit/bd9745a81b43fccb843a32d9a842e6c04e7fb8b5))

## [0.64.2](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.64.1...iclaude-v0.64.2) (2026-02-27)


### Bug Fixes

* **web:** flush pending messages when attaching Codex adapter ([#433](https://github.com/The-Vibe-Company/companion/issues/433)) ([86a25ff](https://github.com/The-Vibe-Company/companion/commit/86a25ffde7ce7c8672367607352508bcc222b08a))

## [0.64.1](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.64.0...iclaude-v0.64.1) (2026-02-26)


### Bug Fixes

* **web:** fix Codex session reconnection Transport closed errors ([#431](https://github.com/The-Vibe-Company/companion/issues/431)) ([c559f79](https://github.com/The-Vibe-Company/companion/commit/c559f7910c4d18b83b343af99ef7c932e66cce66))

## [0.64.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.63.0...iclaude-v0.64.0) (2026-02-26)


### Features

* **web:** increase recorder max lines from 100k to 1M ([#426](https://github.com/The-Vibe-Company/companion/issues/426)) ([cf7a70b](https://github.com/The-Vibe-Company/companion/commit/cf7a70bf107722c48c784d8ca829196171ef27e3))
* **web:** make AI validation configurable per session ([#428](https://github.com/The-Vibe-Company/companion/issues/428)) ([bfec31a](https://github.com/The-Vibe-Company/companion/commit/bfec31a29e15441e1e3c251752d4570b6950692f))


### Bug Fixes

* **web:** broadcast session name update on manual rename ([#427](https://github.com/The-Vibe-Company/companion/issues/427)) ([e3479b8](https://github.com/The-Vibe-Company/companion/commit/e3479b8ca0018014f6bd3121246d047ee292125e))
* **web:** handle Codex ExitPlanMode as dedicated permission request ([#430](https://github.com/The-Vibe-Company/companion/issues/430)) ([bde2d11](https://github.com/The-Vibe-Company/companion/commit/bde2d11b5234faa9f6889d78133ef3dc2ae182ad))

## [0.63.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.62.0...iclaude-v0.63.0) (2026-02-26)


### Features

* **web:** add create Linear issue button in context section ([#421](https://github.com/The-Vibe-Company/companion/issues/421)) ([22e658c](https://github.com/The-Vibe-Company/companion/commit/22e658c1c0c533a058887d12ebefbbee68e10d3c))
* **web:** move git fetch/checkout/pull inside Docker container ([#422](https://github.com/The-Vibe-Company/companion/issues/422)) ([02b22fa](https://github.com/The-Vibe-Company/companion/commit/02b22fa57dab59d95bf3a812c6800a1cdd121975))
* **web:** move git fetch/checkout/pull inside Docker container ([#424](https://github.com/The-Vibe-Company/companion/issues/424)) ([8559dcf](https://github.com/The-Vibe-Company/companion/commit/8559dcf49a23d1969b17907f33c4ffcf91205f63))

## [0.62.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.61.2...iclaude-v0.62.0) (2026-02-26)


### Features

* **web:** add @ mention prompt support to home page input ([#419](https://github.com/The-Vibe-Company/companion/issues/419)) ([94dbb4e](https://github.com/The-Vibe-Company/companion/commit/94dbb4e4d44317aa823125678b6210f5c6adee96))
* **web:** implement AI validation mode for permission requests ([#420](https://github.com/The-Vibe-Company/companion/issues/420)) ([3436175](https://github.com/The-Vibe-Company/companion/commit/3436175dfb66810584ef168ad943f0e47086623d))


### Bug Fixes

* **web:** fix plan display colors broken in light mode ([#417](https://github.com/The-Vibe-Company/companion/issues/417)) ([90f6e81](https://github.com/The-Vibe-Company/companion/commit/90f6e8182af098027610bc89481bb7c87c0038f3))

## [0.61.2](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.61.1...iclaude-v0.61.2) (2026-02-25)


### Bug Fixes

* **web:** add auth header to UpdateOverlay server poll ([#410](https://github.com/The-Vibe-Company/companion/issues/410)) ([86e26cb](https://github.com/The-Vibe-Company/companion/commit/86e26cb0a3983b5c5c39aa3a60276bdedf17629a))

## [0.61.1](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.61.0...iclaude-v0.61.1) (2026-02-24)


### Bug Fixes

* **agents:** replace emoji icons with SVG icon system ([#406](https://github.com/The-Vibe-Company/companion/issues/406)) ([d2ed31b](https://github.com/The-Vibe-Company/companion/commit/d2ed31b477e07d7f8d17e2a19c01599b45e05f69))

## [0.61.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.60.1...iclaude-v0.61.0) (2026-02-24)


### Features

* **web:** add auth, PWA, process panel, editor/files, page redesigns, and theme polish ([#396](https://github.com/The-Vibe-Company/companion/issues/396)) ([cb2f101](https://github.com/The-Vibe-Company/companion/commit/cb2f101d7c2764fbaa0d582ed1022763706c9283))

## [0.60.1](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.60.0...iclaude-v0.60.1) (2026-02-24)


### Bug Fixes

* **agents:** add resilient webhook copy URL behavior ([#400](https://github.com/The-Vibe-Company/companion/issues/400)) ([07bbf9b](https://github.com/The-Vibe-Company/companion/commit/07bbf9b8e63ec9e20f0bb4ac52fd6d0d18614f71))

## [0.60.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.59.0...iclaude-v0.60.0) (2026-02-24)


### Features

* **agents:** add reusable agent system with triggers, MCP, and scheduling ([#397](https://github.com/The-Vibe-Company/companion/issues/397)) ([1849d5d](https://github.com/The-Vibe-Company/companion/commit/1849d5d7c2a2b3d4036f8b2aebd1adc84f14258e))


### Bug Fixes

* **ci:** rewrite coverage gate to enforce 80% on new/changed files ([#399](https://github.com/The-Vibe-Company/companion/issues/399)) ([e257897](https://github.com/The-Vibe-Company/companion/commit/e257897674024a5cad12f3468c73a7e2f9d7c799))

## [0.59.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.58.2...iclaude-v0.59.0) (2026-02-22)


### Features

* **diff:** use git diff as source of truth; show A/M/D status icons and deleted files ([#385](https://github.com/The-Vibe-Company/companion/issues/385)) ([d1e0db5](https://github.com/The-Vibe-Company/companion/commit/d1e0db5f9b94bd5fe055455bf6b4f69714e350f5))
* **web:** improve streaming reliability and session branching controls ([#381](https://github.com/The-Vibe-Company/companion/issues/381)) ([200ab34](https://github.com/The-Vibe-Company/companion/commit/200ab34f42969e09c1a1e9bbb0ba6df44b791a6e))


### Bug Fixes

* **codex:** normalize rate-limit reset timestamps ([#386](https://github.com/The-Vibe-Company/companion/issues/386)) ([f361696](https://github.com/The-Vibe-Company/companion/commit/f3616960e48dcddccc48c956621c819568157e49))

## [0.58.2](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.58.1...iclaude-v0.58.2) (2026-02-21)


### Bug Fixes

* **editor:** replace vscode tab with codemirror behind settings ([#372](https://github.com/The-Vibe-Company/companion/issues/372)) ([52bc626](https://github.com/The-Vibe-Company/companion/commit/52bc626fdb1a27a06c2e13a2ef6aa59a4f0da9f9))

## [0.58.1](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.58.0...iclaude-v0.58.1) (2026-02-20)


### Bug Fixes

* **sidebar:** prevent hover overlay and restore archived click ([#370](https://github.com/The-Vibe-Company/companion/issues/370)) ([56abbc1](https://github.com/The-Vibe-Company/companion/commit/56abbc1ca11b5ff34d0a2c1350740d697640b6d9))

## [0.58.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.57.0...iclaude-v0.58.0) (2026-02-20)


### Features

* **sidebar:** redesign session items with status-first layout ([#368](https://github.com/The-Vibe-Company/companion/issues/368)) ([7287cfc](https://github.com/The-Vibe-Company/companion/commit/7287cfcb54cadbc35f1dff2ea7f0e42042b89124))

## [0.57.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.56.1...iclaude-v0.57.0) (2026-02-20)


### Features

* **sidebar:** redesign left sidebar navigation and sessions list ([#365](https://github.com/The-Vibe-Company/companion/issues/365)) ([000a748](https://github.com/The-Vibe-Company/companion/commit/000a7483c4fe7ad1df9dc8b1fa98ff0740c1c303))

## [0.56.1](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.56.0...iclaude-v0.56.1) (2026-02-19)


### Bug Fixes

* **topbar:** improve diff badge contrast in dark mode ([#359](https://github.com/The-Vibe-Company/companion/issues/359)) ([a995aa1](https://github.com/The-Vibe-Company/companion/commit/a995aa1568576905c6b6e9702b5b5f5cc3ca4527))

## [0.56.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.55.4...iclaude-v0.56.0) (2026-02-19)


### Features

* **editor:** move VS Code editor to dedicated tab with host fallback ([#358](https://github.com/The-Vibe-Company/companion/issues/358)) ([c169027](https://github.com/The-Vibe-Company/companion/commit/c169027ae77f28b9d491c4172b1e01e2af95c3a7))
* **session:** add VS Code editor pane beside shell ([#354](https://github.com/The-Vibe-Company/companion/issues/354)) ([ab10a8d](https://github.com/The-Vibe-Company/companion/commit/ab10a8d09f200ba38a3ee3138505a868b94ace25))


### Bug Fixes

* **settings:** open update overlay on update restart ([#356](https://github.com/The-Vibe-Company/companion/issues/356)) ([2c7989e](https://github.com/The-Vibe-Company/companion/commit/2c7989ee8242c95eebced7cc712a0191271f79e9))

## [0.55.4](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.55.3...iclaude-v0.55.4) (2026-02-19)


### Bug Fixes

* **linear:** add server-side cache to prevent API rate limiting ([#352](https://github.com/The-Vibe-Company/companion/issues/352)) ([843b585](https://github.com/The-Vibe-Company/companion/commit/843b5857a3aefd5ee304fa05aa60fa09d8add1b9))

## [0.55.3](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.55.2...iclaude-v0.55.3) (2026-02-19)


### Bug Fixes

* **update:** add full-screen overlay with auto-refresh after update ([#349](https://github.com/The-Vibe-Company/companion/issues/349)) ([f988b14](https://github.com/The-Vibe-Company/companion/commit/f988b142ea5458cb6654211a24e7cd02d7ee02da))

## [0.55.2](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.55.1...iclaude-v0.55.2) (2026-02-19)


### Bug Fixes

* **server:** map container repo root to host path ([#348](https://github.com/The-Vibe-Company/companion/issues/348)) ([c29f967](https://github.com/The-Vibe-Company/companion/commit/c29f9671d4dcdda876a999906f0e6fd63da8bd27))

## [0.55.1](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.55.0...iclaude-v0.55.1) (2026-02-19)


### Bug Fixes

* **linear:** show only active issues and prioritize backlog ([#346](https://github.com/The-Vibe-Company/companion/issues/346)) ([c2a6e1a](https://github.com/The-Vibe-Company/companion/commit/c2a6e1a0b8d22d032b516a186d5e23db906fdfc2))

## [0.55.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.54.1...iclaude-v0.55.0) (2026-02-19)


### Features

* **ui:** make right sidebar modular with inline configuration ([#345](https://github.com/The-Vibe-Company/companion/issues/345)) ([a9a7905](https://github.com/The-Vibe-Company/companion/commit/a9a7905374e2dcf0c173b3fa9f04a7f209f75a6f))


### Bug Fixes

* **homepage:** restore linear issue branch auto-selection ([#342](https://github.com/The-Vibe-Company/companion/issues/342)) ([01936e4](https://github.com/The-Vibe-Company/companion/commit/01936e4de89bd925c71d13034c91c95560b5e517))

## [0.54.1](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.54.0...iclaude-v0.54.1) (2026-02-19)


### Bug Fixes

* **server:** resolve branch from containerized session git state ([#340](https://github.com/The-Vibe-Company/companion/issues/340)) ([304092d](https://github.com/The-Vibe-Company/companion/commit/304092df1c2e3ce8eceaa3c2c39917beb94b2cdb))

## [0.54.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.53.1...iclaude-v0.54.0) (2026-02-19)


### Features

* **integrations:** associate Linear ticket with session in TaskPanel ([#333](https://github.com/The-Vibe-Company/companion/issues/333)) ([943bf36](https://github.com/The-Vibe-Company/companion/commit/943bf36cd3f8fbdfc3f73fa48e7d9cd76fd12ea4))
* **integrations:** attach Linear project to git repo and show recent issues on homepage ([#331](https://github.com/The-Vibe-Company/companion/issues/331)) ([54239d7](https://github.com/The-Vibe-Company/companion/commit/54239d76f12cc7fea06f76ecd4957b8c06a50f05))
* **integrations:** auto-transition Linear issue to In Progress on session launch ([#332](https://github.com/The-Vibe-Company/companion/issues/332)) ([1df0c8c](https://github.com/The-Vibe-Company/companion/commit/1df0c8cb1d9c82f2756047af661611640de42836))


### Bug Fixes

* **ui:** hide Linear context bar when Linear is not configured ([#339](https://github.com/The-Vibe-Company/companion/issues/339)) ([cd4f55f](https://github.com/The-Vibe-Company/companion/commit/cd4f55f83d9ca166368680c6303c93c3b354f782))

## [0.53.1](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.53.0...iclaude-v0.53.1) (2026-02-19)


### Bug Fixes

* **server:** base new branches on origin/{defaultBranch} instead of stale local ref ([#334](https://github.com/The-Vibe-Company/companion/issues/334)) ([0a736f4](https://github.com/The-Vibe-Company/companion/commit/0a736f4f224db0a79aaca329a70f24f7b7e1b5e7))

## [0.53.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.52.0...iclaude-v0.53.0) (2026-02-19)


### Features

* **linear:** auto-create recommended branch when starting session with Linear issue ([#329](https://github.com/The-Vibe-Company/companion/issues/329)) ([51972b7](https://github.com/The-Vibe-Company/companion/commit/51972b78b32f6a7b2701016b55bf0675a4e13bc3))

## [0.52.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.51.0...iclaude-v0.52.0) (2026-02-19)


### Features

* **codex:** add plan mode with runtime Auto↔Plan toggle ([#325](https://github.com/The-Vibe-Company/companion/issues/325)) ([21ef723](https://github.com/The-Vibe-Company/companion/commit/21ef7237b9666ebd4cc5689c5db05a4b26f10bdd))
* **integrations:** add linear setup, issue search, and startup context ([#326](https://github.com/The-Vibe-Company/companion/issues/326)) ([4612288](https://github.com/The-Vibe-Company/companion/commit/461228845965c45236c0e492f6bef50b71e80a24))


### Bug Fixes

* **integrations:** refine linear settings flow and home card UX ([#328](https://github.com/The-Vibe-Company/companion/issues/328)) ([443b3ec](https://github.com/The-Vibe-Company/companion/commit/443b3ecef48565f13d27c0a913d4504d1d0ef66e))
* **server:** prevent settings undefined overwrite crash ([#327](https://github.com/The-Vibe-Company/companion/issues/327)) ([9173ee2](https://github.com/The-Vibe-Company/companion/commit/9173ee2ed959a6333fb180d3e34f4deaa180c0d9))
* **ui:** improve thinking, tool results, and question prompts ([#321](https://github.com/The-Vibe-Company/companion/issues/321)) ([5c3dd7c](https://github.com/The-Vibe-Company/companion/commit/5c3dd7c501bc23b52c56fee6d5a3995545f8730b))

## [0.51.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.50.3...iclaude-v0.51.0) (2026-02-18)


### Features

* **prompts:** add global prompt library with @ insertion ([#319](https://github.com/The-Vibe-Company/companion/issues/319)) ([10b97b4](https://github.com/The-Vibe-Company/companion/commit/10b97b450c26e57ee0a2a5c96f42bc2c27cbb0c7))
* **server:** allow configuring session storage directory via COMPANION_SESSION_DIR ([#266](https://github.com/The-Vibe-Company/companion/issues/266)) ([3a63bc9](https://github.com/The-Vibe-Company/companion/commit/3a63bc915a16844aa2fbf33f08b60587efb9ea4a))

## [0.50.3](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.50.2...iclaude-v0.50.3) (2026-02-18)


### Bug Fixes

* **topbar:** hide context button on home page ([#317](https://github.com/The-Vibe-Company/companion/issues/317)) ([e5152e5](https://github.com/The-Vibe-Company/companion/commit/e5152e573ffc43ee5ad9aecc7bd76c937dd03d79))

## [0.50.2](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.50.1...iclaude-v0.50.2) (2026-02-18)


### Bug Fixes

* **topbar:** sample active tab color from underlying surface ([#315](https://github.com/The-Vibe-Company/companion/issues/315)) ([ebce0ec](https://github.com/The-Vibe-Company/companion/commit/ebce0ec12b5280ac46a8b63b4511202801009fcc))

## [0.50.1](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.50.0...iclaude-v0.50.1) (2026-02-18)


### Bug Fixes

* **codex:** use container cwd for docker runtime context ([#313](https://github.com/The-Vibe-Company/companion/issues/313)) ([ba6347b](https://github.com/The-Vibe-Company/companion/commit/ba6347ba90e93ba3e750b13b8687b7e428484725))

## [0.50.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.49.0...iclaude-v0.50.0) (2026-02-18)


### Features

* **docker:** background image pulls and streaming creation progress ([#311](https://github.com/The-Vibe-Company/companion/issues/311)) ([f3a7a5e](https://github.com/The-Vibe-Company/companion/commit/f3a7a5e48bbb371b828f8ffe53c8ad3448f1c07b))

## [0.49.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.48.0...iclaude-v0.49.0) (2026-02-18)


### Features

* **diff:** add diff base setting (last commit vs default branch) ([#308](https://github.com/The-Vibe-Company/companion/issues/308)) ([2a7f427](https://github.com/The-Vibe-Company/companion/commit/2a7f4271ef021db67c5b57d6509fe54853e930cc))


### Bug Fixes

* **docker:** propagate host git identity into containers ([#310](https://github.com/The-Vibe-Company/companion/issues/310)) ([81be828](https://github.com/The-Vibe-Company/companion/commit/81be828db84efb74772ef4cb89d4d83fc5b4e9f5))

## [0.48.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.47.0...iclaude-v0.48.0) (2026-02-18)


### Features

* **session-ui:** redesign tabs, terminal persistence and composer ([#306](https://github.com/The-Vibe-Company/companion/issues/306)) ([4a7fe9f](https://github.com/The-Vibe-Company/companion/commit/4a7fe9f4bdeef0dd41bb24d16dd530ed8c6e1939))


### Bug Fixes

* **ui:** dock session terminal inside workspace and prioritize docker target ([#302](https://github.com/The-Vibe-Company/companion/issues/302)) ([b3f0dd4](https://github.com/The-Vibe-Company/companion/commit/b3f0dd4196af53fd05fd8c432afdc40547a3f2c9))

## [0.47.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.46.1...iclaude-v0.47.0) (2026-02-18)


### Features

* **terminal:** add quick session terminal tabs for host and docker ([#299](https://github.com/The-Vibe-Company/companion/issues/299)) ([e4dfc51](https://github.com/The-Vibe-Company/companion/commit/e4dfc5141c54a898b0a5d4583ef3733b23a7d25d))

## [0.46.1](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.46.0...iclaude-v0.46.1) (2026-02-17)


### Bug Fixes

* **docker:** remove legacy companion-dev image support ([#295](https://github.com/The-Vibe-Company/companion/issues/295)) ([fe8cc2a](https://github.com/The-Vibe-Company/companion/commit/fe8cc2a57390a5ccd5e2d18605995c043cfa26b4))

## [0.46.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.45.0...iclaude-v0.46.0) (2026-02-16)


### Features

* **containers:** add Codex CLI support in Docker sessions ([#290](https://github.com/The-Vibe-Company/companion/issues/290)) ([992604b](https://github.com/The-Vibe-Company/companion/commit/992604b229542de87cacd8547c7d74955b05c5d8))


### Bug Fixes

* **sidebar:** separate scheduled runs from regular sessions ([#284](https://github.com/The-Vibe-Company/companion/issues/284)) ([cc0f042](https://github.com/The-Vibe-Company/companion/commit/cc0f042472363e40410728c550a7e6e2275ab80b))

## [0.45.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.44.1...iclaude-v0.45.0) (2026-02-16)


### Features

* **containers:** implement workspace isolation and git auth seeding in Docker sessions ([d651cc3](https://github.com/The-Vibe-Company/companion/commit/d651cc3144f65c939bdcb91f7f6900951a161552))
* **routing:** add session ID to URL hash for deep-linking ([#289](https://github.com/The-Vibe-Company/companion/issues/289)) ([ddd15ac](https://github.com/The-Vibe-Company/companion/commit/ddd15ac194390eb7b7bf4d7ff0850d71b2ff498a))
* **ui:** add full-screen session launch overlay ([#287](https://github.com/The-Vibe-Company/companion/issues/287)) ([0f31196](https://github.com/The-Vibe-Company/companion/commit/0f3119629de91271a0f3d92da2124f5028fe543b))


### Bug Fixes

* **ui:** cap textarea height and add overflow scroll for long prompts ([#285](https://github.com/The-Vibe-Company/companion/issues/285)) ([2b26bc7](https://github.com/The-Vibe-Company/companion/commit/2b26bc7b4122d22d29c821d9e1db29cce7dfbc64))

## [0.44.1](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.44.0...iclaude-v0.44.1) (2026-02-16)


### Bug Fixes

* **containers:** switch Docker registry from ghcr.io to Docker Hub ([525687e](https://github.com/The-Vibe-Company/companion/commit/525687e3e6d4eae3ab1125599c62881ee0ce80ac))

## [0.44.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.43.0...iclaude-v0.44.0) (2026-02-16)


### Features

* **containers:** pull Docker images from ghcr.io + session creation progress UI ([#281](https://github.com/The-Vibe-Company/companion/issues/281)) ([e87cfae](https://github.com/The-Vibe-Company/companion/commit/e87cfaed99010c37e12eca5adcaa30e8e5c07cb6))
* **containers:** replace git worktree isolation with Docker container-based sessions ([#277](https://github.com/The-Vibe-Company/companion/issues/277)) ([92a6172](https://github.com/The-Vibe-Company/companion/commit/92a6172db4bfa4bef613f21fa1bc243c848f7b9d))
* **containers:** seed git auth (gitconfig + gh token) in Docker sessions ([198be0e](https://github.com/The-Vibe-Company/companion/commit/198be0ef7465e3d355e34945fa67151e0457f096))


### Bug Fixes

* **ci:** only tag Docker image as :latest on version tags ([63ca679](https://github.com/The-Vibe-Company/companion/commit/63ca67934ab6d4a9024f5aa6031b4e059baeca79))
* **containers:** rewrite SSH git remotes to HTTPS inside containers ([6c867e3](https://github.com/The-Vibe-Company/companion/commit/6c867e36cc7b76a94c59e646ba37813b4aea651b))

## [0.43.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.42.0...iclaude-v0.43.0) (2026-02-15)


### Features

* **assistant:** add Companion — persistent AI assistant session ([#268](https://github.com/The-Vibe-Company/companion/issues/268)) ([ec0e90b](https://github.com/The-Vibe-Company/companion/commit/ec0e90b8b58f0ec09104590b182941a4d7c9b503))

## [0.42.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.41.0...iclaude-v0.42.0) (2026-02-15)


### Features

* **cron:** add scheduled task system for autonomous sessions ([#84](https://github.com/The-Vibe-Company/companion/issues/84)) ([e02c55a](https://github.com/The-Vibe-Company/companion/commit/e02c55a079bb0f81b71bc7a1fd44b23181d97bb1))

## [0.41.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.40.1...iclaude-v0.41.0) (2026-02-15)


### Features

* **server:** add always-on session recorder with line-based rotation ([#262](https://github.com/The-Vibe-Company/companion/issues/262)) ([369df07](https://github.com/The-Vibe-Company/companion/commit/369df07642f74f7abb523ed0323912f4f6b3d989))
* **ui:** enhanced tool rendering, tool_progress, and Codex session details ([#264](https://github.com/The-Vibe-Company/companion/issues/264)) ([a12963c](https://github.com/The-Vibe-Company/companion/commit/a12963cd014643fdd6785b03ad9e57016c1f7219))


### Bug Fixes

* **ui:** address review comments - stray 0 render, concurrent progress clearing ([#265](https://github.com/The-Vibe-Company/companion/issues/265)) ([6dfdee0](https://github.com/The-Vibe-Company/companion/commit/6dfdee0dbd25bc896e2c3ef37727021130da1808))

## [0.40.1](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.40.0...iclaude-v0.40.1) (2026-02-15)


### Reverts

* **plugins:** remove event-driven plugin runtime ([#260](https://github.com/The-Vibe-Company/companion/issues/260)) ([ea8011a](https://github.com/The-Vibe-Company/companion/commit/ea8011a714b9bdac096eb7bce8a6eca9b71e0eb1))

## [0.40.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.39.1...iclaude-v0.40.0) (2026-02-14)


### Features

* **plugins:** add event-driven plugin runtime with frontend integration ([#251](https://github.com/The-Vibe-Company/companion/issues/251)) ([fdc7418](https://github.com/The-Vibe-Company/companion/commit/fdc7418b7e0a0e17e31e0dbeaf45a7c0fad810cc))


### Bug Fixes

* **repo:** add tailored greptile code review rules ([#258](https://github.com/The-Vibe-Company/companion/issues/258)) ([2030e55](https://github.com/The-Vibe-Company/companion/commit/2030e553015800b757716393ada8fe2b1527f5bf))

## [0.39.1](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.39.0...iclaude-v0.39.1) (2026-02-14)


### Bug Fixes

* **ui:** keep session action controls visible on mobile ([#247](https://github.com/The-Vibe-Company/companion/issues/247)) ([209ac9a](https://github.com/The-Vibe-Company/companion/commit/209ac9a3f2d5bd99e3e2dbe46dc9eb7b10e40082))

## [0.39.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.38.0...iclaude-v0.39.0) (2026-02-14)


### Features

* **telemetry:** add posthog analytics, opt-out controls, and CI env wiring ([#238](https://github.com/The-Vibe-Company/companion/issues/238)) ([743aeab](https://github.com/The-Vibe-Company/companion/commit/743aeab86aa5b9141c86f605bbd3572694c80113))

## [0.38.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.37.2...iclaude-v0.38.0) (2026-02-13)


### Features

* **settings:** add application update controls to settings ([#234](https://github.com/The-Vibe-Company/companion/issues/234)) ([17760af](https://github.com/The-Vibe-Company/companion/commit/17760afb3cade5e325b7771cabbe0f78034512e5))


### Bug Fixes

* **landing:** focus messaging on codex, mcp, terminal and secure remote setup ([#237](https://github.com/The-Vibe-Company/companion/issues/237)) ([80759a7](https://github.com/The-Vibe-Company/companion/commit/80759a7ed3209d8aebf1e108d3e0c68d7bb8824f))

## [0.37.2](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.37.1...iclaude-v0.37.2) (2026-02-13)


### Bug Fixes

* **ws:** add durable replay cursors and idempotent message handling ([#232](https://github.com/The-Vibe-Company/companion/issues/232)) ([fba76e7](https://github.com/The-Vibe-Company/companion/commit/fba76e730ea5398a2df9dbda2167c32f49c7668f))

## [0.37.1](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.37.0...iclaude-v0.37.1) (2026-02-13)


### Bug Fixes

* **settings:** correct auto-renaming helper copy ([#230](https://github.com/The-Vibe-Company/companion/issues/230)) ([5da1586](https://github.com/The-Vibe-Company/companion/commit/5da15865508e6ae5bbcda45e149f64bc966b141c))

## [0.37.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.36.2...iclaude-v0.37.0) (2026-02-13)


### Features

* **ui:** show session name in top bar ([#228](https://github.com/The-Vibe-Company/companion/issues/228)) ([a9dc926](https://github.com/The-Vibe-Company/companion/commit/a9dc926d761c2dbbef741a2e7b05ecba29bd29b8))


### Bug Fixes

* **web:** compare file diffs against default branch ([#226](https://github.com/The-Vibe-Company/companion/issues/226)) ([b437d2c](https://github.com/The-Vibe-Company/companion/commit/b437d2c5705ee32cb4e7964dd1d33113d3470f9d))

## [0.36.2](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.36.1...iclaude-v0.36.2) (2026-02-13)


### Bug Fixes

* **cli-launcher:** bypass shebang to use correct Node for Codex ([#223](https://github.com/The-Vibe-Company/companion/issues/223)) ([9fe1583](https://github.com/The-Vibe-Company/companion/commit/9fe158358880789ec80ea5bd5daf738a261089dc))
* **ui:** move terminal, settings, and environments to full pages ([#224](https://github.com/The-Vibe-Company/companion/issues/224)) ([be1de35](https://github.com/The-Vibe-Company/companion/commit/be1de35e816ac782d4ba5c948f0b00abf0641f75))

## [0.36.1](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.36.0...iclaude-v0.36.1) (2026-02-13)


### Bug Fixes

* **cli-launcher:** pass enriched PATH to spawned CLI/Codex processes ([#221](https://github.com/The-Vibe-Company/companion/issues/221)) ([661e8b4](https://github.com/The-Vibe-Company/companion/commit/661e8b45d9909b9e59b0ecb396a4fb7a143f2816))

## [0.36.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.35.0...iclaude-v0.36.0) (2026-02-13)


### Features

* add Linux systemd support for service install/uninstall ([#169](https://github.com/The-Vibe-Company/companion/issues/169)) ([73fb3f7](https://github.com/The-Vibe-Company/companion/commit/73fb3f721efde79fec50f9c74a4f078f821c35d3))
* add MCP server management support ([#198](https://github.com/The-Vibe-Company/companion/issues/198)) ([018cf1f](https://github.com/The-Vibe-Company/companion/commit/018cf1f65ea5e281c19a39367f8cccf14ac56c1f))
* Add permission & plan approval E2E tests ([#6](https://github.com/The-Vibe-Company/companion/issues/6)) ([8590a68](https://github.com/The-Vibe-Company/companion/commit/8590a68657f0a06e94795a179ad4bbedae782c63))
* add release-please for automated npm publishing ([#24](https://github.com/The-Vibe-Company/companion/issues/24)) ([93b24ee](https://github.com/The-Vibe-Company/companion/commit/93b24ee4a12b3f32e81f59a348b25e89aaa86dce))
* allow dev server access over Tailscale/LAN ([#33](https://github.com/The-Vibe-Company/companion/issues/33)) ([9599d7a](https://github.com/The-Vibe-Company/companion/commit/9599d7ad4e2823d51c8fa262e1dcd96eeb056244))
* claude.md update ([7fa4e7a](https://github.com/The-Vibe-Company/companion/commit/7fa4e7adfdc7c409cfeed4e8a11f237ff0572234))
* **cli:** add service install/uninstall and separate dev/prod ports ([#155](https://github.com/The-Vibe-Company/companion/issues/155)) ([a4e5ba6](https://github.com/The-Vibe-Company/companion/commit/a4e5ba6ced2cc8041f61b303b0205f36e50b7594))
* **cli:** add stop and restart service commands ([#185](https://github.com/The-Vibe-Company/companion/issues/185)) ([04da8e5](https://github.com/The-Vibe-Company/companion/commit/04da8e5a3d3f0e363f662cdd6bca6145eaec479f))
* **cli:** start and stop Companion via daemon service ([#201](https://github.com/The-Vibe-Company/companion/issues/201)) ([39e2b79](https://github.com/The-Vibe-Company/companion/commit/39e2b79a6dbb70e7c7dcaf3ccbaf2116ac26b43a))
* **codex:** add offline protocol compatibility guardrails and playground coverage ([#194](https://github.com/The-Vibe-Company/companion/issues/194)) ([bf0a43e](https://github.com/The-Vibe-Company/companion/commit/bf0a43e5fdc791166e76391c0ee1ad3cf18dae10))
* Corriger menu dossier mobile et décalage clavier ([#151](https://github.com/The-Vibe-Company/companion/issues/151)) ([8068925](https://github.com/The-Vibe-Company/companion/commit/8068925f6a5ec5c6b7a40b36398bd4f9be04708d))
* e2e permissions plans ([#9](https://github.com/The-Vibe-Company/companion/issues/9)) ([53b38bf](https://github.com/The-Vibe-Company/companion/commit/53b38bfd4e773454492a3fea10e8db7ffd3fd768))
* Fix Diffs panel for worktree/relative paths and untracked files ([#165](https://github.com/The-Vibe-Company/companion/issues/165)) ([6810643](https://github.com/The-Vibe-Company/companion/commit/681064328d2bf3f4fc5c3a1867abc1536d2d54f3))
* Hide successful no-output command results ([#139](https://github.com/The-Vibe-Company/companion/issues/139)) ([a66e386](https://github.com/The-Vibe-Company/companion/commit/a66e386491e6887c5684cd70f63cc49cac0a64b7))
* **landing:** add marketing landing page for thecompanion.sh ([#128](https://github.com/The-Vibe-Company/companion/issues/128)) ([170b89c](https://github.com/The-Vibe-Company/companion/commit/170b89c72012dfb0ba68239a7665634d65275aa3))
* OpenRouter-based session auto-naming + settings page ([#168](https://github.com/The-Vibe-Company/companion/issues/168)) ([a86b1e7](https://github.com/The-Vibe-Company/companion/commit/a86b1e711ff1c38985bb3d622c6ec372a266637e))
* protocol conformance fixes and improved E2E tests ([#14](https://github.com/The-Vibe-Company/companion/issues/14)) ([51b13b9](https://github.com/The-Vibe-Company/companion/commit/51b13b9d647de6c92881b1abb61161f39152e0ef))
* Redesign README as a landing page with API-first documentation ([#7](https://github.com/The-Vibe-Company/companion/issues/7)) ([a59e1b4](https://github.com/The-Vibe-Company/companion/commit/a59e1b4604baf87faa32af7d62e4846afae49dbe))
* **sidebar:** group sound and alerts under notification ([#203](https://github.com/The-Vibe-Company/companion/issues/203)) ([0077e75](https://github.com/The-Vibe-Company/companion/commit/0077e75208e7505a53db8a829a9480a77b8c3916))
* simplified claude() API, unified endpoints, and landing page README ([#12](https://github.com/The-Vibe-Company/companion/issues/12)) ([aa2e535](https://github.com/The-Vibe-Company/companion/commit/aa2e535fe0a83b726ff2a2c08359e55973a9136b))
* The Vibe Companion complete web UI rewrite + npm package ([#23](https://github.com/The-Vibe-Company/companion/issues/23)) ([0bdc77a](https://github.com/The-Vibe-Company/companion/commit/0bdc77a81b21cd9d08ba29ea48844e73df3a1852))
* trigger release for statusline capture ([#19](https://github.com/The-Vibe-Company/companion/issues/19)) ([cedc9df](https://github.com/The-Vibe-Company/companion/commit/cedc9dfb7445344bdb43a1a756f1d2e538e08c76))
* **web:** adaptive server-side PR polling with WebSocket push ([#178](https://github.com/The-Vibe-Company/companion/issues/178)) ([57939e4](https://github.com/The-Vibe-Company/companion/commit/57939e4030a4b0e5a7dae39d93c34944e3bdff0f))
* **web:** add browser web notifications ([#191](https://github.com/The-Vibe-Company/companion/issues/191)) ([092c59a](https://github.com/The-Vibe-Company/companion/commit/092c59aff620aa2b2eac51903c01ad7cb0c4bc8e))
* **web:** add CLAUDE.md editor button in TopBar ([#170](https://github.com/The-Vibe-Company/companion/issues/170)) ([f553b9b](https://github.com/The-Vibe-Company/companion/commit/f553b9b86842f0b47c0bf24b08903e0352b7b078))
* **web:** add Clawd-inspired pixel art logo and favicon ([#70](https://github.com/The-Vibe-Company/companion/issues/70)) ([b3994ef](https://github.com/The-Vibe-Company/companion/commit/b3994eff2eac62c3cf8f40a8c31b720c910a7601))
* **web:** add component playground and ExitPlanMode display ([#36](https://github.com/The-Vibe-Company/companion/issues/36)) ([e958be7](https://github.com/The-Vibe-Company/companion/commit/e958be780f1b6e1a8f65daedbf968cdf6ef47798))
* **web:** add embedded code editor with file tree, changed files tracking, and diff view ([#81](https://github.com/The-Vibe-Company/companion/issues/81)) ([3ed0957](https://github.com/The-Vibe-Company/companion/commit/3ed095790c73edeef911ab4c73d74f1998100c5c))
* **web:** add embedded terminal in sidebar ([#175](https://github.com/The-Vibe-Company/companion/issues/175)) ([e711c5d](https://github.com/The-Vibe-Company/companion/commit/e711c5d5ef40edfa9c265642383a4c526b9b3ece))
* **web:** add git worktree support for isolated multi-branch sessions ([#64](https://github.com/The-Vibe-Company/companion/issues/64)) ([fee39d6](https://github.com/The-Vibe-Company/companion/commit/fee39d62986cd99700ba78c84a1f586331955ff8))
* **web:** add GitHub PR status to TaskPanel sidebar ([#166](https://github.com/The-Vibe-Company/companion/issues/166)) ([6ace3b2](https://github.com/The-Vibe-Company/companion/commit/6ace3b2944ec9e9082a11a45fe0798f0f5f41e55))
* **web:** add missing message-flow components to Playground ([#156](https://github.com/The-Vibe-Company/companion/issues/156)) ([ef6c27d](https://github.com/The-Vibe-Company/companion/commit/ef6c27dfa950c11b09394c74c4452c0b02aed8fb))
* **web:** add notification sound on task completion ([#99](https://github.com/The-Vibe-Company/companion/issues/99)) ([337c735](https://github.com/The-Vibe-Company/companion/commit/337c735e8267f076ada4b9ef01632d37376ec2d0))
* **web:** add OpenAI Codex CLI backend integration ([#100](https://github.com/The-Vibe-Company/companion/issues/100)) ([54e3c1a](https://github.com/The-Vibe-Company/companion/commit/54e3c1a2b359719d7983fa9ee857507e1446f505))
* **web:** add per-session usage limits with OAuth refresh and Codex support ([24ebd32](https://github.com/The-Vibe-Company/companion/commit/24ebd32f5ec617290b6b93e8bc76972a3b80d6a9))
* **web:** add permission suggestions and pending permission indicators ([10422c1](https://github.com/The-Vibe-Company/companion/commit/10422c1464b6ad4bc45eb90e6cd9ebbc0ebeac92))
* **web:** add PWA support for mobile home screen install ([#116](https://github.com/The-Vibe-Company/companion/issues/116)) ([85e605f](https://github.com/The-Vibe-Company/companion/commit/85e605fd758ee952e0d5b1dbc6f7065b514844a7))
* **web:** add update-available banner with auto-update for service mode ([#158](https://github.com/The-Vibe-Company/companion/issues/158)) ([727bd7f](https://github.com/The-Vibe-Company/companion/commit/727bd7fbd16557fd63ce41632592c1485e69713c))
* **web:** add usage limits display in session panel ([#97](https://github.com/The-Vibe-Company/companion/issues/97)) ([d29f489](https://github.com/The-Vibe-Company/companion/commit/d29f489ed9951d36ff45ec240410ffd8ffdf05eb))
* **web:** archive sessions instead of deleting them ([#56](https://github.com/The-Vibe-Company/companion/issues/56)) ([489d608](https://github.com/The-Vibe-Company/companion/commit/489d6087fc99b9131386547edaf3bd303a114090))
* **web:** enlarge homepage logo as hero element ([#71](https://github.com/The-Vibe-Company/companion/issues/71)) ([18ead74](https://github.com/The-Vibe-Company/companion/commit/18ead7436d3ebbe9d766754ddb17aa504c63703f))
* **web:** git fetch on branch picker open ([#72](https://github.com/The-Vibe-Company/companion/issues/72)) ([f110405](https://github.com/The-Vibe-Company/companion/commit/f110405edbd0f00454edd65ed72197daf0293182))
* **web:** git info display, folder dropdown fix, dev workflow ([#43](https://github.com/The-Vibe-Company/companion/issues/43)) ([1fe2069](https://github.com/The-Vibe-Company/companion/commit/1fe2069a7db17b410e383f883c934ee1662c2171))
* **web:** git worktree support with branch picker and git pull ([#65](https://github.com/The-Vibe-Company/companion/issues/65)) ([4d0c9c8](https://github.com/The-Vibe-Company/companion/commit/4d0c9c83f4fe13be863313d6c945ce0b671a7f8a))
* **web:** group sidebar sessions by project directory ([#117](https://github.com/The-Vibe-Company/companion/issues/117)) ([deceb59](https://github.com/The-Vibe-Company/companion/commit/deceb599975f53141e9c0bd6c7675437f96978b8))
* **web:** named environment profiles (~/.companion/envs/) ([#50](https://github.com/The-Vibe-Company/companion/issues/50)) ([eaa1a49](https://github.com/The-Vibe-Company/companion/commit/eaa1a497f3be61f2f71f9467e93fa2b65be19095))
* **web:** persist sessions to disk for dev mode resilience ([#45](https://github.com/The-Vibe-Company/companion/issues/45)) ([c943d00](https://github.com/The-Vibe-Company/companion/commit/c943d0047b728854f059e26facde950e08cdfe0c))
* **web:** redesign session list with avatars, auto-reconnect, and git info ([#111](https://github.com/The-Vibe-Company/companion/issues/111)) ([8a7284b](https://github.com/The-Vibe-Company/companion/commit/8a7284b3c08dc301a879924aea133945697b037a))
* **web:** replace CodeMirror editor with unified diff viewer ([#160](https://github.com/The-Vibe-Company/companion/issues/160)) ([f9b6869](https://github.com/The-Vibe-Company/companion/commit/f9b686902011ffd194a118cc1cb022bac71eaa3b))
* **web:** replace folder picker dropdown with fixed-size modal ([#76](https://github.com/The-Vibe-Company/companion/issues/76)) ([979e395](https://github.com/The-Vibe-Company/companion/commit/979e395b530cdb21e6a073ba60e33ea8ac497e2a))
* **web:** session rename persistence + auto-generated titles ([#79](https://github.com/The-Vibe-Company/companion/issues/79)) ([e1dc58c](https://github.com/The-Vibe-Company/companion/commit/e1dc58ce8ab9a619d36f2261cce89b90cfdb70d6))
* **web:** warn when branch is behind remote before session creation ([#127](https://github.com/The-Vibe-Company/companion/issues/127)) ([ef89d5c](https://github.com/The-Vibe-Company/companion/commit/ef89d5c208ca5da006aaa88b78dbd647186fb0df))


### Bug Fixes

* add web/dist to gitignore ([#2](https://github.com/The-Vibe-Company/companion/issues/2)) ([b9ac264](https://github.com/The-Vibe-Company/companion/commit/b9ac264fbb99415517636517e8f503d40fe3253d))
* always update statusLine settings on agent spawn ([#21](https://github.com/The-Vibe-Company/companion/issues/21)) ([71c343c](https://github.com/The-Vibe-Company/companion/commit/71c343cfd29fff3204ad0cc2986ff000d1be5adc))
* auto-accept workspace trust prompt and handle idle in ask() ([#16](https://github.com/The-Vibe-Company/companion/issues/16)) ([ded31b4](https://github.com/The-Vibe-Company/companion/commit/ded31b4cf9900f7ed8c3ff373ef16ae8f1e8a886))
* checkout selected branch when worktree mode is off ([#68](https://github.com/The-Vibe-Company/companion/issues/68)) ([500f3b1](https://github.com/The-Vibe-Company/companion/commit/500f3b112c5ccc646c7965344b5774efe1338377))
* **cli:** auto-update restarts service reliably via explicit systemctl/launchctl ([#208](https://github.com/The-Vibe-Company/companion/issues/208)) ([33fa67e](https://github.com/The-Vibe-Company/companion/commit/33fa67ebd75609b9a7b8700ce67b1dd949663b06))
* **cli:** expose stop/restart in help and add test ([#188](https://github.com/The-Vibe-Company/companion/issues/188)) ([c307525](https://github.com/The-Vibe-Company/companion/commit/c30752545f2137fd7c03525d5bb7f5f8851271d4))
* **cli:** fix Linux systemd service management (start, auto-restart) ([#213](https://github.com/The-Vibe-Company/companion/issues/213)) ([fc1dd65](https://github.com/The-Vibe-Company/companion/commit/fc1dd65a9fd32958d47499af1b35992a0c10fe8e))
* **cli:** refresh systemd unit file on start/restart to prevent restart loops ([#215](https://github.com/The-Vibe-Company/companion/issues/215)) ([35f80d9](https://github.com/The-Vibe-Company/companion/commit/35f80d963b1f0f0feccf7215a9bd4711b4520a12))
* **cli:** resolve binaries via user shell PATH when running as service ([#216](https://github.com/The-Vibe-Company/companion/issues/216)) ([47e4967](https://github.com/The-Vibe-Company/companion/commit/47e4967215a5bfd84c8afc2a86ce42151c73d187))
* **codex:** fix 3 critical bugs in Codex backend integration ([#147](https://github.com/The-Vibe-Company/companion/issues/147)) ([0ec92db](https://github.com/The-Vibe-Company/companion/commit/0ec92db909c7be42f94cc21d2890c9c123702dd7))
* **codex:** handle init failure gracefully and isolate per-session CODEX_HOME ([#210](https://github.com/The-Vibe-Company/companion/issues/210)) ([f4efcea](https://github.com/The-Vibe-Company/companion/commit/f4efceace6c260de92df728335678b7bded3e144))
* make service stop actually stop on macOS and refresh stale update checks ([#192](https://github.com/The-Vibe-Company/companion/issues/192)) ([f608f64](https://github.com/The-Vibe-Company/companion/commit/f608f64887bf78b2cca909aa20bd87e4a897ce94))
* remove vibe alias, update repo URLs to companion ([#30](https://github.com/The-Vibe-Company/companion/issues/30)) ([4f7b47c](https://github.com/The-Vibe-Company/companion/commit/4f7b47cba86c278e89fe81292fea9b8b3e75c035))
* scope permission requests to their session tab ([#35](https://github.com/The-Vibe-Company/companion/issues/35)) ([ef9f41c](https://github.com/The-Vibe-Company/companion/commit/ef9f41c8589e382de1db719984931bc4e91aeb11))
* show pasted images in chat history ([#32](https://github.com/The-Vibe-Company/companion/issues/32)) ([46365be](https://github.com/The-Vibe-Company/companion/commit/46365be45ae8b325100ed296617455c105d4d52e))
* **sidebar:** nest notification toggles behind disclosure ([#207](https://github.com/The-Vibe-Company/companion/issues/207)) ([87e71b8](https://github.com/The-Vibe-Company/companion/commit/87e71b8f5bf3e47c96421bca315ac412934a7dc2))
* **task-panel:** enable scrolling for long MCP sections ([#204](https://github.com/The-Vibe-Company/companion/issues/204)) ([b98abbb](https://github.com/The-Vibe-Company/companion/commit/b98abbbea4355c7e91d4dc322e53e638f4e4c542))
* track all commits in release-please, not just web/ ([#27](https://github.com/The-Vibe-Company/companion/issues/27)) ([d49f649](https://github.com/The-Vibe-Company/companion/commit/d49f64996d02807baf0482ce3c3607ae59f78638))
* use correct secret name NPM_PUBLISH_TOKEN in publish workflow ([e296ab0](https://github.com/The-Vibe-Company/companion/commit/e296ab0fabd6345b1f21c7094ca1f8d6f6af79cb))
* use correct secret name NPM_PUBLISH_TOKEN in publish workflow ([#26](https://github.com/The-Vibe-Company/companion/issues/26)) ([61eed5a](https://github.com/The-Vibe-Company/companion/commit/61eed5addd6e332fac360d9ae8239f1b0f93868e))
* use random suffixes for worktree branch names ([#88](https://github.com/The-Vibe-Company/companion/issues/88)) ([0b79f9a](https://github.com/The-Vibe-Company/companion/commit/0b79f9af172595cb84810b5d4cd65e0ed9c8e23d))
* **web:** always generate unique branch names for worktrees with forceNew ([#131](https://github.com/The-Vibe-Company/companion/issues/131)) ([cd62d4a](https://github.com/The-Vibe-Company/companion/commit/cd62d4ac8fae0b56cdef0ff850eab4a8c707f99b))
* **web:** chat scroll and composer visibility in plan mode ([#55](https://github.com/The-Vibe-Company/companion/issues/55)) ([4cff10c](https://github.com/The-Vibe-Company/companion/commit/4cff10cde297b7142c088584b6dd83060902c526))
* **web:** deduplicate messages on WebSocket reconnection ([#150](https://github.com/The-Vibe-Company/companion/issues/150)) ([a81bb3d](https://github.com/The-Vibe-Company/companion/commit/a81bb3d878957f1f18234a5f9194d1d8064f795c))
* **web:** default folder picker to home directory instead of server cwd ([#122](https://github.com/The-Vibe-Company/companion/issues/122)) ([7b8a4c7](https://github.com/The-Vibe-Company/companion/commit/7b8a4c71f32c68ffcc907269e88b3711c0d5af7a))
* **web:** enable codex web search when internet toggle is on ([#135](https://github.com/The-Vibe-Company/companion/issues/135)) ([8d9f0b0](https://github.com/The-Vibe-Company/companion/commit/8d9f0b002dcafcfc020862cb107777d75fc2580e))
* **web:** fetch and pull selected branch on session create ([#137](https://github.com/The-Vibe-Company/companion/issues/137)) ([9cdbbe1](https://github.com/The-Vibe-Company/companion/commit/9cdbbe1e151f024bd41f60e20c60e2f092ba7014))
* **web:** fix Codex approval policy and Composer mode labels ([#106](https://github.com/The-Vibe-Company/companion/issues/106)) ([fd5c2f1](https://github.com/The-Vibe-Company/companion/commit/fd5c2f15b144eb2ae9ec809fdb6ee19e797dc15a))
* **web:** fix session auto-rename and add blur-to-focus animation ([#86](https://github.com/The-Vibe-Company/companion/issues/86)) ([6d3c91f](https://github.com/The-Vibe-Company/companion/commit/6d3c91f73a65054e2c15727e90ca554af70eed28))
* **web:** fix WritableStream locked race condition in Codex adapter ([b43569d](https://github.com/The-Vibe-Company/companion/commit/b43569dbb3d154a303d60ec6bc2007b5a7bcedea))
* **web:** improve light mode contrast ([#89](https://github.com/The-Vibe-Company/companion/issues/89)) ([7ac7886](https://github.com/The-Vibe-Company/companion/commit/7ac7886fc6305e3ec45698a1c7c91b72a91c7c44))
* **web:** improve responsive design across all components ([#85](https://github.com/The-Vibe-Company/companion/issues/85)) ([0750fbb](https://github.com/The-Vibe-Company/companion/commit/0750fbbbe456d79bc104fdbdaf8f08e8795a3b62))
* **web:** isolate worktree sessions with proper branch-tracking ([#74](https://github.com/The-Vibe-Company/companion/issues/74)) ([764d7a7](https://github.com/The-Vibe-Company/companion/commit/764d7a7f5391a686408a8542421f771da341d5db))
* **web:** polyfill localStorage for Node.js 22+ ([#149](https://github.com/The-Vibe-Company/companion/issues/149)) ([602c684](https://github.com/The-Vibe-Company/companion/commit/602c6841f03677ec3f419860469e39b791968de6))
* **web:** prevent iOS auto-zoom on mobile input focus ([#102](https://github.com/The-Vibe-Company/companion/issues/102)) ([18ee23f](https://github.com/The-Vibe-Company/companion/commit/18ee23f6f1674fbcf5e1be25f8c4e23510bc12b5))
* **web:** prevent mobile keyboard layout shift and iOS zoom on branch selector ([#159](https://github.com/The-Vibe-Company/companion/issues/159)) ([4276afd](https://github.com/The-Vibe-Company/companion/commit/4276afd4390808d9d040555652c80bd1461c45b7))
* **web:** refresh git branch tracking after session start ([#195](https://github.com/The-Vibe-Company/companion/issues/195)) ([c3cb47b](https://github.com/The-Vibe-Company/companion/commit/c3cb47b56257b866b76abbb66709694cb26e0925))
* **web:** resolve [object Object] display for Codex file edit results ([#133](https://github.com/The-Vibe-Company/companion/issues/133)) ([9cc21a7](https://github.com/The-Vibe-Company/companion/commit/9cc21a78064cf07bb90174dd87bbfbd367516c90))
* **web:** resolve original repo root for worktree sessions in sidebar grouping ([#120](https://github.com/The-Vibe-Company/companion/issues/120)) ([8925ac9](https://github.com/The-Vibe-Company/companion/commit/8925ac9f540b3cd2520268539d21b0267b2dadb1))
* **web:** session reconnection with auto-relaunch and persist ([#49](https://github.com/The-Vibe-Company/companion/issues/49)) ([f58e542](https://github.com/The-Vibe-Company/companion/commit/f58e5428847a342069e6790fa7d70f190bc5f396))
* **web:** stable session ordering — sort by creation date only ([#173](https://github.com/The-Vibe-Company/companion/issues/173)) ([05c3a06](https://github.com/The-Vibe-Company/companion/commit/05c3a0652b823c5ca20b233be164a899f9920caf))
* **web:** unset CLAUDECODE env var to prevent CLI nesting guard rejec… ([#181](https://github.com/The-Vibe-Company/companion/issues/181)) ([75e264a](https://github.com/The-Vibe-Company/companion/commit/75e264a0be975dadbf3d56e64b990e0e07b12777))
* **web:** use --resume on CLI relaunch to restore conversation context ([#46](https://github.com/The-Vibe-Company/companion/issues/46)) ([3e2b5bd](https://github.com/The-Vibe-Company/companion/commit/3e2b5bdd39bd265ca5675784227a9f1b4f2a8aa3))

## [0.35.0](https://github.com/The-Vibe-Company/companion/compare/thecompanion-v0.34.5...thecompanion-v0.35.0) (2026-02-13)


### Features

* add Linux systemd support for service install/uninstall ([#169](https://github.com/The-Vibe-Company/companion/issues/169)) ([73fb3f7](https://github.com/The-Vibe-Company/companion/commit/73fb3f721efde79fec50f9c74a4f078f821c35d3))
* add MCP server management support ([#198](https://github.com/The-Vibe-Company/companion/issues/198)) ([018cf1f](https://github.com/The-Vibe-Company/companion/commit/018cf1f65ea5e281c19a39367f8cccf14ac56c1f))
* Add permission & plan approval E2E tests ([#6](https://github.com/The-Vibe-Company/companion/issues/6)) ([8590a68](https://github.com/The-Vibe-Company/companion/commit/8590a68657f0a06e94795a179ad4bbedae782c63))
* add release-please for automated npm publishing ([#24](https://github.com/The-Vibe-Company/companion/issues/24)) ([93b24ee](https://github.com/The-Vibe-Company/companion/commit/93b24ee4a12b3f32e81f59a348b25e89aaa86dce))
* allow dev server access over Tailscale/LAN ([#33](https://github.com/The-Vibe-Company/companion/issues/33)) ([9599d7a](https://github.com/The-Vibe-Company/companion/commit/9599d7ad4e2823d51c8fa262e1dcd96eeb056244))
* claude.md update ([7fa4e7a](https://github.com/The-Vibe-Company/companion/commit/7fa4e7adfdc7c409cfeed4e8a11f237ff0572234))
* **cli:** add service install/uninstall and separate dev/prod ports ([#155](https://github.com/The-Vibe-Company/companion/issues/155)) ([a4e5ba6](https://github.com/The-Vibe-Company/companion/commit/a4e5ba6ced2cc8041f61b303b0205f36e50b7594))
* **cli:** add stop and restart service commands ([#185](https://github.com/The-Vibe-Company/companion/issues/185)) ([04da8e5](https://github.com/The-Vibe-Company/companion/commit/04da8e5a3d3f0e363f662cdd6bca6145eaec479f))
* **cli:** start and stop Companion via daemon service ([#201](https://github.com/The-Vibe-Company/companion/issues/201)) ([39e2b79](https://github.com/The-Vibe-Company/companion/commit/39e2b79a6dbb70e7c7dcaf3ccbaf2116ac26b43a))
* **codex:** add offline protocol compatibility guardrails and playground coverage ([#194](https://github.com/The-Vibe-Company/companion/issues/194)) ([bf0a43e](https://github.com/The-Vibe-Company/companion/commit/bf0a43e5fdc791166e76391c0ee1ad3cf18dae10))
* Corriger menu dossier mobile et décalage clavier ([#151](https://github.com/The-Vibe-Company/companion/issues/151)) ([8068925](https://github.com/The-Vibe-Company/companion/commit/8068925f6a5ec5c6b7a40b36398bd4f9be04708d))
* e2e permissions plans ([#9](https://github.com/The-Vibe-Company/companion/issues/9)) ([53b38bf](https://github.com/The-Vibe-Company/companion/commit/53b38bfd4e773454492a3fea10e8db7ffd3fd768))
* Fix Diffs panel for worktree/relative paths and untracked files ([#165](https://github.com/The-Vibe-Company/companion/issues/165)) ([6810643](https://github.com/The-Vibe-Company/companion/commit/681064328d2bf3f4fc5c3a1867abc1536d2d54f3))
* Hide successful no-output command results ([#139](https://github.com/The-Vibe-Company/companion/issues/139)) ([a66e386](https://github.com/The-Vibe-Company/companion/commit/a66e386491e6887c5684cd70f63cc49cac0a64b7))
* **landing:** add marketing landing page for thecompanion.sh ([#128](https://github.com/The-Vibe-Company/companion/issues/128)) ([170b89c](https://github.com/The-Vibe-Company/companion/commit/170b89c72012dfb0ba68239a7665634d65275aa3))
* OpenRouter-based session auto-naming + settings page ([#168](https://github.com/The-Vibe-Company/companion/issues/168)) ([a86b1e7](https://github.com/The-Vibe-Company/companion/commit/a86b1e711ff1c38985bb3d622c6ec372a266637e))
* protocol conformance fixes and improved E2E tests ([#14](https://github.com/The-Vibe-Company/companion/issues/14)) ([51b13b9](https://github.com/The-Vibe-Company/companion/commit/51b13b9d647de6c92881b1abb61161f39152e0ef))
* Redesign README as a landing page with API-first documentation ([#7](https://github.com/The-Vibe-Company/companion/issues/7)) ([a59e1b4](https://github.com/The-Vibe-Company/companion/commit/a59e1b4604baf87faa32af7d62e4846afae49dbe))
* **sidebar:** group sound and alerts under notification ([#203](https://github.com/The-Vibe-Company/companion/issues/203)) ([0077e75](https://github.com/The-Vibe-Company/companion/commit/0077e75208e7505a53db8a829a9480a77b8c3916))
* simplified claude() API, unified endpoints, and landing page README ([#12](https://github.com/The-Vibe-Company/companion/issues/12)) ([aa2e535](https://github.com/The-Vibe-Company/companion/commit/aa2e535fe0a83b726ff2a2c08359e55973a9136b))
* The Vibe Companion complete web UI rewrite + npm package ([#23](https://github.com/The-Vibe-Company/companion/issues/23)) ([0bdc77a](https://github.com/The-Vibe-Company/companion/commit/0bdc77a81b21cd9d08ba29ea48844e73df3a1852))
* trigger release for statusline capture ([#19](https://github.com/The-Vibe-Company/companion/issues/19)) ([cedc9df](https://github.com/The-Vibe-Company/companion/commit/cedc9dfb7445344bdb43a1a756f1d2e538e08c76))
* **web:** adaptive server-side PR polling with WebSocket push ([#178](https://github.com/The-Vibe-Company/companion/issues/178)) ([57939e4](https://github.com/The-Vibe-Company/companion/commit/57939e4030a4b0e5a7dae39d93c34944e3bdff0f))
* **web:** add browser web notifications ([#191](https://github.com/The-Vibe-Company/companion/issues/191)) ([092c59a](https://github.com/The-Vibe-Company/companion/commit/092c59aff620aa2b2eac51903c01ad7cb0c4bc8e))
* **web:** add CLAUDE.md editor button in TopBar ([#170](https://github.com/The-Vibe-Company/companion/issues/170)) ([f553b9b](https://github.com/The-Vibe-Company/companion/commit/f553b9b86842f0b47c0bf24b08903e0352b7b078))
* **web:** add Clawd-inspired pixel art logo and favicon ([#70](https://github.com/The-Vibe-Company/companion/issues/70)) ([b3994ef](https://github.com/The-Vibe-Company/companion/commit/b3994eff2eac62c3cf8f40a8c31b720c910a7601))
* **web:** add component playground and ExitPlanMode display ([#36](https://github.com/The-Vibe-Company/companion/issues/36)) ([e958be7](https://github.com/The-Vibe-Company/companion/commit/e958be780f1b6e1a8f65daedbf968cdf6ef47798))
* **web:** add embedded code editor with file tree, changed files tracking, and diff view ([#81](https://github.com/The-Vibe-Company/companion/issues/81)) ([3ed0957](https://github.com/The-Vibe-Company/companion/commit/3ed095790c73edeef911ab4c73d74f1998100c5c))
* **web:** add embedded terminal in sidebar ([#175](https://github.com/The-Vibe-Company/companion/issues/175)) ([e711c5d](https://github.com/The-Vibe-Company/companion/commit/e711c5d5ef40edfa9c265642383a4c526b9b3ece))
* **web:** add git worktree support for isolated multi-branch sessions ([#64](https://github.com/The-Vibe-Company/companion/issues/64)) ([fee39d6](https://github.com/The-Vibe-Company/companion/commit/fee39d62986cd99700ba78c84a1f586331955ff8))
* **web:** add GitHub PR status to TaskPanel sidebar ([#166](https://github.com/The-Vibe-Company/companion/issues/166)) ([6ace3b2](https://github.com/The-Vibe-Company/companion/commit/6ace3b2944ec9e9082a11a45fe0798f0f5f41e55))
* **web:** add missing message-flow components to Playground ([#156](https://github.com/The-Vibe-Company/companion/issues/156)) ([ef6c27d](https://github.com/The-Vibe-Company/companion/commit/ef6c27dfa950c11b09394c74c4452c0b02aed8fb))
* **web:** add notification sound on task completion ([#99](https://github.com/The-Vibe-Company/companion/issues/99)) ([337c735](https://github.com/The-Vibe-Company/companion/commit/337c735e8267f076ada4b9ef01632d37376ec2d0))
* **web:** add OpenAI Codex CLI backend integration ([#100](https://github.com/The-Vibe-Company/companion/issues/100)) ([54e3c1a](https://github.com/The-Vibe-Company/companion/commit/54e3c1a2b359719d7983fa9ee857507e1446f505))
* **web:** add per-session usage limits with OAuth refresh and Codex support ([24ebd32](https://github.com/The-Vibe-Company/companion/commit/24ebd32f5ec617290b6b93e8bc76972a3b80d6a9))
* **web:** add permission suggestions and pending permission indicators ([10422c1](https://github.com/The-Vibe-Company/companion/commit/10422c1464b6ad4bc45eb90e6cd9ebbc0ebeac92))
* **web:** add PWA support for mobile home screen install ([#116](https://github.com/The-Vibe-Company/companion/issues/116)) ([85e605f](https://github.com/The-Vibe-Company/companion/commit/85e605fd758ee952e0d5b1dbc6f7065b514844a7))
* **web:** add update-available banner with auto-update for service mode ([#158](https://github.com/The-Vibe-Company/companion/issues/158)) ([727bd7f](https://github.com/The-Vibe-Company/companion/commit/727bd7fbd16557fd63ce41632592c1485e69713c))
* **web:** add usage limits display in session panel ([#97](https://github.com/The-Vibe-Company/companion/issues/97)) ([d29f489](https://github.com/The-Vibe-Company/companion/commit/d29f489ed9951d36ff45ec240410ffd8ffdf05eb))
* **web:** archive sessions instead of deleting them ([#56](https://github.com/The-Vibe-Company/companion/issues/56)) ([489d608](https://github.com/The-Vibe-Company/companion/commit/489d6087fc99b9131386547edaf3bd303a114090))
* **web:** enlarge homepage logo as hero element ([#71](https://github.com/The-Vibe-Company/companion/issues/71)) ([18ead74](https://github.com/The-Vibe-Company/companion/commit/18ead7436d3ebbe9d766754ddb17aa504c63703f))
* **web:** git fetch on branch picker open ([#72](https://github.com/The-Vibe-Company/companion/issues/72)) ([f110405](https://github.com/The-Vibe-Company/companion/commit/f110405edbd0f00454edd65ed72197daf0293182))
* **web:** git info display, folder dropdown fix, dev workflow ([#43](https://github.com/The-Vibe-Company/companion/issues/43)) ([1fe2069](https://github.com/The-Vibe-Company/companion/commit/1fe2069a7db17b410e383f883c934ee1662c2171))
* **web:** git worktree support with branch picker and git pull ([#65](https://github.com/The-Vibe-Company/companion/issues/65)) ([4d0c9c8](https://github.com/The-Vibe-Company/companion/commit/4d0c9c83f4fe13be863313d6c945ce0b671a7f8a))
* **web:** group sidebar sessions by project directory ([#117](https://github.com/The-Vibe-Company/companion/issues/117)) ([deceb59](https://github.com/The-Vibe-Company/companion/commit/deceb599975f53141e9c0bd6c7675437f96978b8))
* **web:** named environment profiles (~/.companion/envs/) ([#50](https://github.com/The-Vibe-Company/companion/issues/50)) ([eaa1a49](https://github.com/The-Vibe-Company/companion/commit/eaa1a497f3be61f2f71f9467e93fa2b65be19095))
* **web:** persist sessions to disk for dev mode resilience ([#45](https://github.com/The-Vibe-Company/companion/issues/45)) ([c943d00](https://github.com/The-Vibe-Company/companion/commit/c943d0047b728854f059e26facde950e08cdfe0c))
* **web:** redesign session list with avatars, auto-reconnect, and git info ([#111](https://github.com/The-Vibe-Company/companion/issues/111)) ([8a7284b](https://github.com/The-Vibe-Company/companion/commit/8a7284b3c08dc301a879924aea133945697b037a))
* **web:** replace CodeMirror editor with unified diff viewer ([#160](https://github.com/The-Vibe-Company/companion/issues/160)) ([f9b6869](https://github.com/The-Vibe-Company/companion/commit/f9b686902011ffd194a118cc1cb022bac71eaa3b))
* **web:** replace folder picker dropdown with fixed-size modal ([#76](https://github.com/The-Vibe-Company/companion/issues/76)) ([979e395](https://github.com/The-Vibe-Company/companion/commit/979e395b530cdb21e6a073ba60e33ea8ac497e2a))
* **web:** session rename persistence + auto-generated titles ([#79](https://github.com/The-Vibe-Company/companion/issues/79)) ([e1dc58c](https://github.com/The-Vibe-Company/companion/commit/e1dc58ce8ab9a619d36f2261cce89b90cfdb70d6))
* **web:** warn when branch is behind remote before session creation ([#127](https://github.com/The-Vibe-Company/companion/issues/127)) ([ef89d5c](https://github.com/The-Vibe-Company/companion/commit/ef89d5c208ca5da006aaa88b78dbd647186fb0df))


### Bug Fixes

* add web/dist to gitignore ([#2](https://github.com/The-Vibe-Company/companion/issues/2)) ([b9ac264](https://github.com/The-Vibe-Company/companion/commit/b9ac264fbb99415517636517e8f503d40fe3253d))
* always update statusLine settings on agent spawn ([#21](https://github.com/The-Vibe-Company/companion/issues/21)) ([71c343c](https://github.com/The-Vibe-Company/companion/commit/71c343cfd29fff3204ad0cc2986ff000d1be5adc))
* auto-accept workspace trust prompt and handle idle in ask() ([#16](https://github.com/The-Vibe-Company/companion/issues/16)) ([ded31b4](https://github.com/The-Vibe-Company/companion/commit/ded31b4cf9900f7ed8c3ff373ef16ae8f1e8a886))
* checkout selected branch when worktree mode is off ([#68](https://github.com/The-Vibe-Company/companion/issues/68)) ([500f3b1](https://github.com/The-Vibe-Company/companion/commit/500f3b112c5ccc646c7965344b5774efe1338377))
* **cli:** auto-update restarts service reliably via explicit systemctl/launchctl ([#208](https://github.com/The-Vibe-Company/companion/issues/208)) ([33fa67e](https://github.com/The-Vibe-Company/companion/commit/33fa67ebd75609b9a7b8700ce67b1dd949663b06))
* **cli:** expose stop/restart in help and add test ([#188](https://github.com/The-Vibe-Company/companion/issues/188)) ([c307525](https://github.com/The-Vibe-Company/companion/commit/c30752545f2137fd7c03525d5bb7f5f8851271d4))
* **cli:** fix Linux systemd service management (start, auto-restart) ([#213](https://github.com/The-Vibe-Company/companion/issues/213)) ([fc1dd65](https://github.com/The-Vibe-Company/companion/commit/fc1dd65a9fd32958d47499af1b35992a0c10fe8e))
* **cli:** refresh systemd unit file on start/restart to prevent restart loops ([#215](https://github.com/The-Vibe-Company/companion/issues/215)) ([35f80d9](https://github.com/The-Vibe-Company/companion/commit/35f80d963b1f0f0feccf7215a9bd4711b4520a12))
* **cli:** resolve binaries via user shell PATH when running as service ([#216](https://github.com/The-Vibe-Company/companion/issues/216)) ([47e4967](https://github.com/The-Vibe-Company/companion/commit/47e4967215a5bfd84c8afc2a86ce42151c73d187))
* **codex:** fix 3 critical bugs in Codex backend integration ([#147](https://github.com/The-Vibe-Company/companion/issues/147)) ([0ec92db](https://github.com/The-Vibe-Company/companion/commit/0ec92db909c7be42f94cc21d2890c9c123702dd7))
* **codex:** handle init failure gracefully and isolate per-session CODEX_HOME ([#210](https://github.com/The-Vibe-Company/companion/issues/210)) ([f4efcea](https://github.com/The-Vibe-Company/companion/commit/f4efceace6c260de92df728335678b7bded3e144))
* make service stop actually stop on macOS and refresh stale update checks ([#192](https://github.com/The-Vibe-Company/companion/issues/192)) ([f608f64](https://github.com/The-Vibe-Company/companion/commit/f608f64887bf78b2cca909aa20bd87e4a897ce94))
* remove vibe alias, update repo URLs to companion ([#30](https://github.com/The-Vibe-Company/companion/issues/30)) ([4f7b47c](https://github.com/The-Vibe-Company/companion/commit/4f7b47cba86c278e89fe81292fea9b8b3e75c035))
* scope permission requests to their session tab ([#35](https://github.com/The-Vibe-Company/companion/issues/35)) ([ef9f41c](https://github.com/The-Vibe-Company/companion/commit/ef9f41c8589e382de1db719984931bc4e91aeb11))
* show pasted images in chat history ([#32](https://github.com/The-Vibe-Company/companion/issues/32)) ([46365be](https://github.com/The-Vibe-Company/companion/commit/46365be45ae8b325100ed296617455c105d4d52e))
* **sidebar:** nest notification toggles behind disclosure ([#207](https://github.com/The-Vibe-Company/companion/issues/207)) ([87e71b8](https://github.com/The-Vibe-Company/companion/commit/87e71b8f5bf3e47c96421bca315ac412934a7dc2))
* **task-panel:** enable scrolling for long MCP sections ([#204](https://github.com/The-Vibe-Company/companion/issues/204)) ([b98abbb](https://github.com/The-Vibe-Company/companion/commit/b98abbbea4355c7e91d4dc322e53e638f4e4c542))
* track all commits in release-please, not just web/ ([#27](https://github.com/The-Vibe-Company/companion/issues/27)) ([d49f649](https://github.com/The-Vibe-Company/companion/commit/d49f64996d02807baf0482ce3c3607ae59f78638))
* use correct secret name NPM_PUBLISH_TOKEN in publish workflow ([e296ab0](https://github.com/The-Vibe-Company/companion/commit/e296ab0fabd6345b1f21c7094ca1f8d6f6af79cb))
* use correct secret name NPM_PUBLISH_TOKEN in publish workflow ([#26](https://github.com/The-Vibe-Company/companion/issues/26)) ([61eed5a](https://github.com/The-Vibe-Company/companion/commit/61eed5addd6e332fac360d9ae8239f1b0f93868e))
* use random suffixes for worktree branch names ([#88](https://github.com/The-Vibe-Company/companion/issues/88)) ([0b79f9a](https://github.com/The-Vibe-Company/companion/commit/0b79f9af172595cb84810b5d4cd65e0ed9c8e23d))
* **web:** always generate unique branch names for worktrees with forceNew ([#131](https://github.com/The-Vibe-Company/companion/issues/131)) ([cd62d4a](https://github.com/The-Vibe-Company/companion/commit/cd62d4ac8fae0b56cdef0ff850eab4a8c707f99b))
* **web:** chat scroll and composer visibility in plan mode ([#55](https://github.com/The-Vibe-Company/companion/issues/55)) ([4cff10c](https://github.com/The-Vibe-Company/companion/commit/4cff10cde297b7142c088584b6dd83060902c526))
* **web:** deduplicate messages on WebSocket reconnection ([#150](https://github.com/The-Vibe-Company/companion/issues/150)) ([a81bb3d](https://github.com/The-Vibe-Company/companion/commit/a81bb3d878957f1f18234a5f9194d1d8064f795c))
* **web:** default folder picker to home directory instead of server cwd ([#122](https://github.com/The-Vibe-Company/companion/issues/122)) ([7b8a4c7](https://github.com/The-Vibe-Company/companion/commit/7b8a4c71f32c68ffcc907269e88b3711c0d5af7a))
* **web:** enable codex web search when internet toggle is on ([#135](https://github.com/The-Vibe-Company/companion/issues/135)) ([8d9f0b0](https://github.com/The-Vibe-Company/companion/commit/8d9f0b002dcafcfc020862cb107777d75fc2580e))
* **web:** fetch and pull selected branch on session create ([#137](https://github.com/The-Vibe-Company/companion/issues/137)) ([9cdbbe1](https://github.com/The-Vibe-Company/companion/commit/9cdbbe1e151f024bd41f60e20c60e2f092ba7014))
* **web:** fix Codex approval policy and Composer mode labels ([#106](https://github.com/The-Vibe-Company/companion/issues/106)) ([fd5c2f1](https://github.com/The-Vibe-Company/companion/commit/fd5c2f15b144eb2ae9ec809fdb6ee19e797dc15a))
* **web:** fix session auto-rename and add blur-to-focus animation ([#86](https://github.com/The-Vibe-Company/companion/issues/86)) ([6d3c91f](https://github.com/The-Vibe-Company/companion/commit/6d3c91f73a65054e2c15727e90ca554af70eed28))
* **web:** fix WritableStream locked race condition in Codex adapter ([b43569d](https://github.com/The-Vibe-Company/companion/commit/b43569dbb3d154a303d60ec6bc2007b5a7bcedea))
* **web:** improve light mode contrast ([#89](https://github.com/The-Vibe-Company/companion/issues/89)) ([7ac7886](https://github.com/The-Vibe-Company/companion/commit/7ac7886fc6305e3ec45698a1c7c91b72a91c7c44))
* **web:** improve responsive design across all components ([#85](https://github.com/The-Vibe-Company/companion/issues/85)) ([0750fbb](https://github.com/The-Vibe-Company/companion/commit/0750fbbbe456d79bc104fdbdaf8f08e8795a3b62))
* **web:** isolate worktree sessions with proper branch-tracking ([#74](https://github.com/The-Vibe-Company/companion/issues/74)) ([764d7a7](https://github.com/The-Vibe-Company/companion/commit/764d7a7f5391a686408a8542421f771da341d5db))
* **web:** polyfill localStorage for Node.js 22+ ([#149](https://github.com/The-Vibe-Company/companion/issues/149)) ([602c684](https://github.com/The-Vibe-Company/companion/commit/602c6841f03677ec3f419860469e39b791968de6))
* **web:** prevent iOS auto-zoom on mobile input focus ([#102](https://github.com/The-Vibe-Company/companion/issues/102)) ([18ee23f](https://github.com/The-Vibe-Company/companion/commit/18ee23f6f1674fbcf5e1be25f8c4e23510bc12b5))
* **web:** prevent mobile keyboard layout shift and iOS zoom on branch selector ([#159](https://github.com/The-Vibe-Company/companion/issues/159)) ([4276afd](https://github.com/The-Vibe-Company/companion/commit/4276afd4390808d9d040555652c80bd1461c45b7))
* **web:** refresh git branch tracking after session start ([#195](https://github.com/The-Vibe-Company/companion/issues/195)) ([c3cb47b](https://github.com/The-Vibe-Company/companion/commit/c3cb47b56257b866b76abbb66709694cb26e0925))
* **web:** resolve [object Object] display for Codex file edit results ([#133](https://github.com/The-Vibe-Company/companion/issues/133)) ([9cc21a7](https://github.com/The-Vibe-Company/companion/commit/9cc21a78064cf07bb90174dd87bbfbd367516c90))
* **web:** resolve original repo root for worktree sessions in sidebar grouping ([#120](https://github.com/The-Vibe-Company/companion/issues/120)) ([8925ac9](https://github.com/The-Vibe-Company/companion/commit/8925ac9f540b3cd2520268539d21b0267b2dadb1))
* **web:** session reconnection with auto-relaunch and persist ([#49](https://github.com/The-Vibe-Company/companion/issues/49)) ([f58e542](https://github.com/The-Vibe-Company/companion/commit/f58e5428847a342069e6790fa7d70f190bc5f396))
* **web:** stable session ordering — sort by creation date only ([#173](https://github.com/The-Vibe-Company/companion/issues/173)) ([05c3a06](https://github.com/The-Vibe-Company/companion/commit/05c3a0652b823c5ca20b233be164a899f9920caf))
* **web:** unset CLAUDECODE env var to prevent CLI nesting guard rejec… ([#181](https://github.com/The-Vibe-Company/companion/issues/181)) ([75e264a](https://github.com/The-Vibe-Company/companion/commit/75e264a0be975dadbf3d56e64b990e0e07b12777))
* **web:** use --resume on CLI relaunch to restore conversation context ([#46](https://github.com/The-Vibe-Company/companion/issues/46)) ([3e2b5bd](https://github.com/The-Vibe-Company/companion/commit/3e2b5bdd39bd265ca5675784227a9f1b4f2a8aa3))

## [0.34.5](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.34.4...iclaude-v0.34.5) (2026-02-13)


### Bug Fixes

* **cli:** fix Linux systemd service management (start, auto-restart) ([#213](https://github.com/The-Vibe-Company/companion/issues/213)) ([fc1dd65](https://github.com/The-Vibe-Company/companion/commit/fc1dd65a9fd32958d47499af1b35992a0c10fe8e))
* **cli:** refresh systemd unit file on start/restart to prevent restart loops ([#215](https://github.com/The-Vibe-Company/companion/issues/215)) ([35f80d9](https://github.com/The-Vibe-Company/companion/commit/35f80d963b1f0f0feccf7215a9bd4711b4520a12))
* **cli:** resolve binaries via user shell PATH when running as service ([#216](https://github.com/The-Vibe-Company/companion/issues/216)) ([47e4967](https://github.com/The-Vibe-Company/companion/commit/47e4967215a5bfd84c8afc2a86ce42151c73d187))

## [0.34.4](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.34.3...iclaude-v0.34.4) (2026-02-13)


### Bug Fixes

* **codex:** handle init failure gracefully and isolate per-session CODEX_HOME ([#210](https://github.com/The-Vibe-Company/companion/issues/210)) ([f4efcea](https://github.com/The-Vibe-Company/companion/commit/f4efceace6c260de92df728335678b7bded3e144))

## [0.34.3](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.34.2...iclaude-v0.34.3) (2026-02-13)


### Bug Fixes

* **cli:** auto-update restarts service reliably via explicit systemctl/launchctl ([#208](https://github.com/The-Vibe-Company/companion/issues/208)) ([33fa67e](https://github.com/The-Vibe-Company/companion/commit/33fa67ebd75609b9a7b8700ce67b1dd949663b06))

## [0.34.2](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.34.1...iclaude-v0.34.2) (2026-02-13)


### Bug Fixes

* **sidebar:** nest notification toggles behind disclosure ([#207](https://github.com/The-Vibe-Company/companion/issues/207)) ([87e71b8](https://github.com/The-Vibe-Company/companion/commit/87e71b8f5bf3e47c96421bca315ac412934a7dc2))

## [0.34.1](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.34.0...iclaude-v0.34.1) (2026-02-13)


### Bug Fixes

* **task-panel:** enable scrolling for long MCP sections ([#204](https://github.com/The-Vibe-Company/companion/issues/204)) ([b98abbb](https://github.com/The-Vibe-Company/companion/commit/b98abbbea4355c7e91d4dc322e53e638f4e4c542))

## [0.34.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.33.0...iclaude-v0.34.0) (2026-02-13)


### Features

* **cli:** start and stop Companion via daemon service ([#201](https://github.com/The-Vibe-Company/companion/issues/201)) ([39e2b79](https://github.com/The-Vibe-Company/companion/commit/39e2b79a6dbb70e7c7dcaf3ccbaf2116ac26b43a))
* **sidebar:** group sound and alerts under notification ([#203](https://github.com/The-Vibe-Company/companion/issues/203)) ([0077e75](https://github.com/The-Vibe-Company/companion/commit/0077e75208e7505a53db8a829a9480a77b8c3916))

## [0.33.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.32.0...iclaude-v0.33.0) (2026-02-13)


### Features

* **web:** add browser web notifications ([#191](https://github.com/The-Vibe-Company/companion/issues/191)) ([092c59a](https://github.com/The-Vibe-Company/companion/commit/092c59aff620aa2b2eac51903c01ad7cb0c4bc8e))

## [0.32.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.31.0...iclaude-v0.32.0) (2026-02-13)


### Features

* add MCP server management support ([#198](https://github.com/The-Vibe-Company/companion/issues/198)) ([018cf1f](https://github.com/The-Vibe-Company/companion/commit/018cf1f65ea5e281c19a39367f8cccf14ac56c1f))


### Bug Fixes

* **web:** refresh git branch tracking after session start ([#195](https://github.com/The-Vibe-Company/companion/issues/195)) ([c3cb47b](https://github.com/The-Vibe-Company/companion/commit/c3cb47b56257b866b76abbb66709694cb26e0925))

## [0.31.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.30.1...iclaude-v0.31.0) (2026-02-13)


### Features

* **codex:** add offline protocol compatibility guardrails and playground coverage ([#194](https://github.com/The-Vibe-Company/companion/issues/194)) ([bf0a43e](https://github.com/The-Vibe-Company/companion/commit/bf0a43e5fdc791166e76391c0ee1ad3cf18dae10))


### Bug Fixes

* make service stop actually stop on macOS and refresh stale update checks ([#192](https://github.com/The-Vibe-Company/companion/issues/192)) ([f608f64](https://github.com/The-Vibe-Company/companion/commit/f608f64887bf78b2cca909aa20bd87e4a897ce94))

## [0.30.1](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.30.0...iclaude-v0.30.1) (2026-02-13)


### Bug Fixes

* **cli:** expose stop/restart in help and add test ([#188](https://github.com/The-Vibe-Company/companion/issues/188)) ([c307525](https://github.com/The-Vibe-Company/companion/commit/c30752545f2137fd7c03525d5bb7f5f8851271d4))

## [0.30.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.29.0...iclaude-v0.30.0) (2026-02-13)


### Features

* **cli:** add stop and restart service commands ([#185](https://github.com/The-Vibe-Company/companion/issues/185)) ([04da8e5](https://github.com/The-Vibe-Company/companion/commit/04da8e5a3d3f0e363f662cdd6bca6145eaec479f))

## [0.29.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.28.0...iclaude-v0.29.0) (2026-02-13)


### Features

* **web:** adaptive server-side PR polling with WebSocket push ([#178](https://github.com/The-Vibe-Company/companion/issues/178)) ([57939e4](https://github.com/The-Vibe-Company/companion/commit/57939e4030a4b0e5a7dae39d93c34944e3bdff0f))


### Bug Fixes

* **web:** unset CLAUDECODE env var to prevent CLI nesting guard rejec… ([#181](https://github.com/The-Vibe-Company/companion/issues/181)) ([75e264a](https://github.com/The-Vibe-Company/companion/commit/75e264a0be975dadbf3d56e64b990e0e07b12777))

## [0.28.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.27.1...iclaude-v0.28.0) (2026-02-12)


### Features

* **web:** add embedded terminal in sidebar ([#175](https://github.com/The-Vibe-Company/companion/issues/175)) ([e711c5d](https://github.com/The-Vibe-Company/companion/commit/e711c5d5ef40edfa9c265642383a4c526b9b3ece))

## [0.27.1](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.27.0...iclaude-v0.27.1) (2026-02-12)


### Bug Fixes

* **web:** stable session ordering — sort by creation date only ([#173](https://github.com/The-Vibe-Company/companion/issues/173)) ([05c3a06](https://github.com/The-Vibe-Company/companion/commit/05c3a0652b823c5ca20b233be164a899f9920caf))

## [0.27.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.26.0...iclaude-v0.27.0) (2026-02-12)


### Features

* OpenRouter-based session auto-naming + settings page ([#168](https://github.com/The-Vibe-Company/companion/issues/168)) ([a86b1e7](https://github.com/The-Vibe-Company/companion/commit/a86b1e711ff1c38985bb3d622c6ec372a266637e))
* **web:** add CLAUDE.md editor button in TopBar ([#170](https://github.com/The-Vibe-Company/companion/issues/170)) ([f553b9b](https://github.com/The-Vibe-Company/companion/commit/f553b9b86842f0b47c0bf24b08903e0352b7b078))

## [0.26.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.25.0...iclaude-v0.26.0) (2026-02-12)


### Features

* add Linux systemd support for service install/uninstall ([#169](https://github.com/The-Vibe-Company/companion/issues/169)) ([73fb3f7](https://github.com/The-Vibe-Company/companion/commit/73fb3f721efde79fec50f9c74a4f078f821c35d3))

## [0.25.0](https://github.com/The-Vibe-Company/companion/compare/iclaude-v0.24.0...iclaude-v0.25.0) (2026-02-12)


### Features

* Add permission & plan approval E2E tests ([#6](https://github.com/The-Vibe-Company/companion/issues/6)) ([8590a68](https://github.com/The-Vibe-Company/companion/commit/8590a68657f0a06e94795a179ad4bbedae782c63))
* add release-please for automated npm publishing ([#24](https://github.com/The-Vibe-Company/companion/issues/24)) ([93b24ee](https://github.com/The-Vibe-Company/companion/commit/93b24ee4a12b3f32e81f59a348b25e89aaa86dce))
* allow dev server access over Tailscale/LAN ([#33](https://github.com/The-Vibe-Company/companion/issues/33)) ([9599d7a](https://github.com/The-Vibe-Company/companion/commit/9599d7ad4e2823d51c8fa262e1dcd96eeb056244))
* claude.md update ([7fa4e7a](https://github.com/The-Vibe-Company/companion/commit/7fa4e7adfdc7c409cfeed4e8a11f237ff0572234))
* **cli:** add service install/uninstall and separate dev/prod ports ([#155](https://github.com/The-Vibe-Company/companion/issues/155)) ([a4e5ba6](https://github.com/The-Vibe-Company/companion/commit/a4e5ba6ced2cc8041f61b303b0205f36e50b7594))
* Corriger menu dossier mobile et décalage clavier ([#151](https://github.com/The-Vibe-Company/companion/issues/151)) ([8068925](https://github.com/The-Vibe-Company/companion/commit/8068925f6a5ec5c6b7a40b36398bd4f9be04708d))
* e2e permissions plans ([#9](https://github.com/The-Vibe-Company/companion/issues/9)) ([53b38bf](https://github.com/The-Vibe-Company/companion/commit/53b38bfd4e773454492a3fea10e8db7ffd3fd768))
* Fix Diffs panel for worktree/relative paths and untracked files ([#165](https://github.com/The-Vibe-Company/companion/issues/165)) ([6810643](https://github.com/The-Vibe-Company/companion/commit/681064328d2bf3f4fc5c3a1867abc1536d2d54f3))
* Hide successful no-output command results ([#139](https://github.com/The-Vibe-Company/companion/issues/139)) ([a66e386](https://github.com/The-Vibe-Company/companion/commit/a66e386491e6887c5684cd70f63cc49cac0a64b7))
* **landing:** add marketing landing page for thecompanion.sh ([#128](https://github.com/The-Vibe-Company/companion/issues/128)) ([170b89c](https://github.com/The-Vibe-Company/companion/commit/170b89c72012dfb0ba68239a7665634d65275aa3))
* protocol conformance fixes and improved E2E tests ([#14](https://github.com/The-Vibe-Company/companion/issues/14)) ([51b13b9](https://github.com/The-Vibe-Company/companion/commit/51b13b9d647de6c92881b1abb61161f39152e0ef))
* Redesign README as a landing page with API-first documentation ([#7](https://github.com/The-Vibe-Company/companion/issues/7)) ([a59e1b4](https://github.com/The-Vibe-Company/companion/commit/a59e1b4604baf87faa32af7d62e4846afae49dbe))
* simplified claude() API, unified endpoints, and landing page README ([#12](https://github.com/The-Vibe-Company/companion/issues/12)) ([aa2e535](https://github.com/The-Vibe-Company/companion/commit/aa2e535fe0a83b726ff2a2c08359e55973a9136b))
* The Vibe Companion complete web UI rewrite + npm package ([#23](https://github.com/The-Vibe-Company/companion/issues/23)) ([0bdc77a](https://github.com/The-Vibe-Company/companion/commit/0bdc77a81b21cd9d08ba29ea48844e73df3a1852))
* trigger release for statusline capture ([#19](https://github.com/The-Vibe-Company/companion/issues/19)) ([cedc9df](https://github.com/The-Vibe-Company/companion/commit/cedc9dfb7445344bdb43a1a756f1d2e538e08c76))
* **web:** add Clawd-inspired pixel art logo and favicon ([#70](https://github.com/The-Vibe-Company/companion/issues/70)) ([b3994ef](https://github.com/The-Vibe-Company/companion/commit/b3994eff2eac62c3cf8f40a8c31b720c910a7601))
* **web:** add component playground and ExitPlanMode display ([#36](https://github.com/The-Vibe-Company/companion/issues/36)) ([e958be7](https://github.com/The-Vibe-Company/companion/commit/e958be780f1b6e1a8f65daedbf968cdf6ef47798))
* **web:** add embedded code editor with file tree, changed files tracking, and diff view ([#81](https://github.com/The-Vibe-Company/companion/issues/81)) ([3ed0957](https://github.com/The-Vibe-Company/companion/commit/3ed095790c73edeef911ab4c73d74f1998100c5c))
* **web:** add git worktree support for isolated multi-branch sessions ([#64](https://github.com/The-Vibe-Company/companion/issues/64)) ([fee39d6](https://github.com/The-Vibe-Company/companion/commit/fee39d62986cd99700ba78c84a1f586331955ff8))
* **web:** add GitHub PR status to TaskPanel sidebar ([#166](https://github.com/The-Vibe-Company/companion/issues/166)) ([6ace3b2](https://github.com/The-Vibe-Company/companion/commit/6ace3b2944ec9e9082a11a45fe0798f0f5f41e55))
* **web:** add missing message-flow components to Playground ([#156](https://github.com/The-Vibe-Company/companion/issues/156)) ([ef6c27d](https://github.com/The-Vibe-Company/companion/commit/ef6c27dfa950c11b09394c74c4452c0b02aed8fb))
* **web:** add notification sound on task completion ([#99](https://github.com/The-Vibe-Company/companion/issues/99)) ([337c735](https://github.com/The-Vibe-Company/companion/commit/337c735e8267f076ada4b9ef01632d37376ec2d0))
* **web:** add OpenAI Codex CLI backend integration ([#100](https://github.com/The-Vibe-Company/companion/issues/100)) ([54e3c1a](https://github.com/The-Vibe-Company/companion/commit/54e3c1a2b359719d7983fa9ee857507e1446f505))
* **web:** add per-session usage limits with OAuth refresh and Codex support ([24ebd32](https://github.com/The-Vibe-Company/companion/commit/24ebd32f5ec617290b6b93e8bc76972a3b80d6a9))
* **web:** add permission suggestions and pending permission indicators ([10422c1](https://github.com/The-Vibe-Company/companion/commit/10422c1464b6ad4bc45eb90e6cd9ebbc0ebeac92))
* **web:** add PWA support for mobile home screen install ([#116](https://github.com/The-Vibe-Company/companion/issues/116)) ([85e605f](https://github.com/The-Vibe-Company/companion/commit/85e605fd758ee952e0d5b1dbc6f7065b514844a7))
* **web:** add update-available banner with auto-update for service mode ([#158](https://github.com/The-Vibe-Company/companion/issues/158)) ([727bd7f](https://github.com/The-Vibe-Company/companion/commit/727bd7fbd16557fd63ce41632592c1485e69713c))
* **web:** add usage limits display in session panel ([#97](https://github.com/The-Vibe-Company/companion/issues/97)) ([d29f489](https://github.com/The-Vibe-Company/companion/commit/d29f489ed9951d36ff45ec240410ffd8ffdf05eb))
* **web:** archive sessions instead of deleting them ([#56](https://github.com/The-Vibe-Company/companion/issues/56)) ([489d608](https://github.com/The-Vibe-Company/companion/commit/489d6087fc99b9131386547edaf3bd303a114090))
* **web:** enlarge homepage logo as hero element ([#71](https://github.com/The-Vibe-Company/companion/issues/71)) ([18ead74](https://github.com/The-Vibe-Company/companion/commit/18ead7436d3ebbe9d766754ddb17aa504c63703f))
* **web:** git fetch on branch picker open ([#72](https://github.com/The-Vibe-Company/companion/issues/72)) ([f110405](https://github.com/The-Vibe-Company/companion/commit/f110405edbd0f00454edd65ed72197daf0293182))
* **web:** git info display, folder dropdown fix, dev workflow ([#43](https://github.com/The-Vibe-Company/companion/issues/43)) ([1fe2069](https://github.com/The-Vibe-Company/companion/commit/1fe2069a7db17b410e383f883c934ee1662c2171))
* **web:** git worktree support with branch picker and git pull ([#65](https://github.com/The-Vibe-Company/companion/issues/65)) ([4d0c9c8](https://github.com/The-Vibe-Company/companion/commit/4d0c9c83f4fe13be863313d6c945ce0b671a7f8a))
* **web:** group sidebar sessions by project directory ([#117](https://github.com/The-Vibe-Company/companion/issues/117)) ([deceb59](https://github.com/The-Vibe-Company/companion/commit/deceb599975f53141e9c0bd6c7675437f96978b8))
* **web:** named environment profiles (~/.companion/envs/) ([#50](https://github.com/The-Vibe-Company/companion/issues/50)) ([eaa1a49](https://github.com/The-Vibe-Company/companion/commit/eaa1a497f3be61f2f71f9467e93fa2b65be19095))
* **web:** persist sessions to disk for dev mode resilience ([#45](https://github.com/The-Vibe-Company/companion/issues/45)) ([c943d00](https://github.com/The-Vibe-Company/companion/commit/c943d0047b728854f059e26facde950e08cdfe0c))
* **web:** redesign session list with avatars, auto-reconnect, and git info ([#111](https://github.com/The-Vibe-Company/companion/issues/111)) ([8a7284b](https://github.com/The-Vibe-Company/companion/commit/8a7284b3c08dc301a879924aea133945697b037a))
* **web:** replace CodeMirror editor with unified diff viewer ([#160](https://github.com/The-Vibe-Company/companion/issues/160)) ([f9b6869](https://github.com/The-Vibe-Company/companion/commit/f9b686902011ffd194a118cc1cb022bac71eaa3b))
* **web:** replace folder picker dropdown with fixed-size modal ([#76](https://github.com/The-Vibe-Company/companion/issues/76)) ([979e395](https://github.com/The-Vibe-Company/companion/commit/979e395b530cdb21e6a073ba60e33ea8ac497e2a))
* **web:** session rename persistence + auto-generated titles ([#79](https://github.com/The-Vibe-Company/companion/issues/79)) ([e1dc58c](https://github.com/The-Vibe-Company/companion/commit/e1dc58ce8ab9a619d36f2261cce89b90cfdb70d6))
* **web:** warn when branch is behind remote before session creation ([#127](https://github.com/The-Vibe-Company/companion/issues/127)) ([ef89d5c](https://github.com/The-Vibe-Company/companion/commit/ef89d5c208ca5da006aaa88b78dbd647186fb0df))


### Bug Fixes

* add web/dist to gitignore ([#2](https://github.com/The-Vibe-Company/companion/issues/2)) ([b9ac264](https://github.com/The-Vibe-Company/companion/commit/b9ac264fbb99415517636517e8f503d40fe3253d))
* always update statusLine settings on agent spawn ([#21](https://github.com/The-Vibe-Company/companion/issues/21)) ([71c343c](https://github.com/The-Vibe-Company/companion/commit/71c343cfd29fff3204ad0cc2986ff000d1be5adc))
* auto-accept workspace trust prompt and handle idle in ask() ([#16](https://github.com/The-Vibe-Company/companion/issues/16)) ([ded31b4](https://github.com/The-Vibe-Company/companion/commit/ded31b4cf9900f7ed8c3ff373ef16ae8f1e8a886))
* checkout selected branch when worktree mode is off ([#68](https://github.com/The-Vibe-Company/companion/issues/68)) ([500f3b1](https://github.com/The-Vibe-Company/companion/commit/500f3b112c5ccc646c7965344b5774efe1338377))
* **codex:** fix 3 critical bugs in Codex backend integration ([#147](https://github.com/The-Vibe-Company/companion/issues/147)) ([0ec92db](https://github.com/The-Vibe-Company/companion/commit/0ec92db909c7be42f94cc21d2890c9c123702dd7))
* remove vibe alias, update repo URLs to companion ([#30](https://github.com/The-Vibe-Company/companion/issues/30)) ([4f7b47c](https://github.com/The-Vibe-Company/companion/commit/4f7b47cba86c278e89fe81292fea9b8b3e75c035))
* scope permission requests to their session tab ([#35](https://github.com/The-Vibe-Company/companion/issues/35)) ([ef9f41c](https://github.com/The-Vibe-Company/companion/commit/ef9f41c8589e382de1db719984931bc4e91aeb11))
* show pasted images in chat history ([#32](https://github.com/The-Vibe-Company/companion/issues/32)) ([46365be](https://github.com/The-Vibe-Company/companion/commit/46365be45ae8b325100ed296617455c105d4d52e))
* track all commits in release-please, not just web/ ([#27](https://github.com/The-Vibe-Company/companion/issues/27)) ([d49f649](https://github.com/The-Vibe-Company/companion/commit/d49f64996d02807baf0482ce3c3607ae59f78638))
* use correct secret name NPM_PUBLISH_TOKEN in publish workflow ([e296ab0](https://github.com/The-Vibe-Company/companion/commit/e296ab0fabd6345b1f21c7094ca1f8d6f6af79cb))
* use correct secret name NPM_PUBLISH_TOKEN in publish workflow ([#26](https://github.com/The-Vibe-Company/companion/issues/26)) ([61eed5a](https://github.com/The-Vibe-Company/companion/commit/61eed5addd6e332fac360d9ae8239f1b0f93868e))
* use random suffixes for worktree branch names ([#88](https://github.com/The-Vibe-Company/companion/issues/88)) ([0b79f9a](https://github.com/The-Vibe-Company/companion/commit/0b79f9af172595cb84810b5d4cd65e0ed9c8e23d))
* **web:** always generate unique branch names for worktrees with forceNew ([#131](https://github.com/The-Vibe-Company/companion/issues/131)) ([cd62d4a](https://github.com/The-Vibe-Company/companion/commit/cd62d4ac8fae0b56cdef0ff850eab4a8c707f99b))
* **web:** chat scroll and composer visibility in plan mode ([#55](https://github.com/The-Vibe-Company/companion/issues/55)) ([4cff10c](https://github.com/The-Vibe-Company/companion/commit/4cff10cde297b7142c088584b6dd83060902c526))
* **web:** deduplicate messages on WebSocket reconnection ([#150](https://github.com/The-Vibe-Company/companion/issues/150)) ([a81bb3d](https://github.com/The-Vibe-Company/companion/commit/a81bb3d878957f1f18234a5f9194d1d8064f795c))
* **web:** default folder picker to home directory instead of server cwd ([#122](https://github.com/The-Vibe-Company/companion/issues/122)) ([7b8a4c7](https://github.com/The-Vibe-Company/companion/commit/7b8a4c71f32c68ffcc907269e88b3711c0d5af7a))
* **web:** enable codex web search when internet toggle is on ([#135](https://github.com/The-Vibe-Company/companion/issues/135)) ([8d9f0b0](https://github.com/The-Vibe-Company/companion/commit/8d9f0b002dcafcfc020862cb107777d75fc2580e))
* **web:** fetch and pull selected branch on session create ([#137](https://github.com/The-Vibe-Company/companion/issues/137)) ([9cdbbe1](https://github.com/The-Vibe-Company/companion/commit/9cdbbe1e151f024bd41f60e20c60e2f092ba7014))
* **web:** fix Codex approval policy and Composer mode labels ([#106](https://github.com/The-Vibe-Company/companion/issues/106)) ([fd5c2f1](https://github.com/The-Vibe-Company/companion/commit/fd5c2f15b144eb2ae9ec809fdb6ee19e797dc15a))
* **web:** fix session auto-rename and add blur-to-focus animation ([#86](https://github.com/The-Vibe-Company/companion/issues/86)) ([6d3c91f](https://github.com/The-Vibe-Company/companion/commit/6d3c91f73a65054e2c15727e90ca554af70eed28))
* **web:** fix WritableStream locked race condition in Codex adapter ([b43569d](https://github.com/The-Vibe-Company/companion/commit/b43569dbb3d154a303d60ec6bc2007b5a7bcedea))
* **web:** improve light mode contrast ([#89](https://github.com/The-Vibe-Company/companion/issues/89)) ([7ac7886](https://github.com/The-Vibe-Company/companion/commit/7ac7886fc6305e3ec45698a1c7c91b72a91c7c44))
* **web:** improve responsive design across all components ([#85](https://github.com/The-Vibe-Company/companion/issues/85)) ([0750fbb](https://github.com/The-Vibe-Company/companion/commit/0750fbbbe456d79bc104fdbdaf8f08e8795a3b62))
* **web:** isolate worktree sessions with proper branch-tracking ([#74](https://github.com/The-Vibe-Company/companion/issues/74)) ([764d7a7](https://github.com/The-Vibe-Company/companion/commit/764d7a7f5391a686408a8542421f771da341d5db))
* **web:** polyfill localStorage for Node.js 22+ ([#149](https://github.com/The-Vibe-Company/companion/issues/149)) ([602c684](https://github.com/The-Vibe-Company/companion/commit/602c6841f03677ec3f419860469e39b791968de6))
* **web:** prevent iOS auto-zoom on mobile input focus ([#102](https://github.com/The-Vibe-Company/companion/issues/102)) ([18ee23f](https://github.com/The-Vibe-Company/companion/commit/18ee23f6f1674fbcf5e1be25f8c4e23510bc12b5))
* **web:** prevent mobile keyboard layout shift and iOS zoom on branch selector ([#159](https://github.com/The-Vibe-Company/companion/issues/159)) ([4276afd](https://github.com/The-Vibe-Company/companion/commit/4276afd4390808d9d040555652c80bd1461c45b7))
* **web:** resolve [object Object] display for Codex file edit results ([#133](https://github.com/The-Vibe-Company/companion/issues/133)) ([9cc21a7](https://github.com/The-Vibe-Company/companion/commit/9cc21a78064cf07bb90174dd87bbfbd367516c90))
* **web:** resolve original repo root for worktree sessions in sidebar grouping ([#120](https://github.com/The-Vibe-Company/companion/issues/120)) ([8925ac9](https://github.com/The-Vibe-Company/companion/commit/8925ac9f540b3cd2520268539d21b0267b2dadb1))
* **web:** session reconnection with auto-relaunch and persist ([#49](https://github.com/The-Vibe-Company/companion/issues/49)) ([f58e542](https://github.com/The-Vibe-Company/companion/commit/f58e5428847a342069e6790fa7d70f190bc5f396))
* **web:** use --resume on CLI relaunch to restore conversation context ([#46](https://github.com/The-Vibe-Company/companion/issues/46)) ([3e2b5bd](https://github.com/The-Vibe-Company/companion/commit/3e2b5bdd39bd265ca5675784227a9f1b4f2a8aa3))

## [0.24.0](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.23.0...the-vibe-companion-v0.24.0) (2026-02-12)


### Features

* Fix Diffs panel for worktree/relative paths and untracked files ([#165](https://github.com/The-Vibe-Company/companion/issues/165)) ([6810643](https://github.com/The-Vibe-Company/companion/commit/681064328d2bf3f4fc5c3a1867abc1536d2d54f3))
* **web:** add GitHub PR status to TaskPanel sidebar ([#166](https://github.com/The-Vibe-Company/companion/issues/166)) ([6ace3b2](https://github.com/The-Vibe-Company/companion/commit/6ace3b2944ec9e9082a11a45fe0798f0f5f41e55))
* **web:** add update-available banner with auto-update for service mode ([#158](https://github.com/The-Vibe-Company/companion/issues/158)) ([727bd7f](https://github.com/The-Vibe-Company/companion/commit/727bd7fbd16557fd63ce41632592c1485e69713c))
* **web:** replace CodeMirror editor with unified diff viewer ([#160](https://github.com/The-Vibe-Company/companion/issues/160)) ([f9b6869](https://github.com/The-Vibe-Company/companion/commit/f9b686902011ffd194a118cc1cb022bac71eaa3b))


### Bug Fixes

* **web:** prevent mobile keyboard layout shift and iOS zoom on branch selector ([#159](https://github.com/The-Vibe-Company/companion/issues/159)) ([4276afd](https://github.com/The-Vibe-Company/companion/commit/4276afd4390808d9d040555652c80bd1461c45b7))

## [0.23.0](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.22.1...the-vibe-companion-v0.23.0) (2026-02-12)


### Features

* **cli:** add service install/uninstall and separate dev/prod ports ([#155](https://github.com/The-Vibe-Company/companion/issues/155)) ([a4e5ba6](https://github.com/The-Vibe-Company/companion/commit/a4e5ba6ced2cc8041f61b303b0205f36e50b7594))
* **web:** add missing message-flow components to Playground ([#156](https://github.com/The-Vibe-Company/companion/issues/156)) ([ef6c27d](https://github.com/The-Vibe-Company/companion/commit/ef6c27dfa950c11b09394c74c4452c0b02aed8fb))

## [0.22.1](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.22.0...the-vibe-companion-v0.22.1) (2026-02-12)


### Bug Fixes

* **web:** polyfill localStorage for Node.js 22+ ([#149](https://github.com/The-Vibe-Company/companion/issues/149)) ([602c684](https://github.com/The-Vibe-Company/companion/commit/602c6841f03677ec3f419860469e39b791968de6))

## [0.22.0](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.21.0...the-vibe-companion-v0.22.0) (2026-02-12)


### Features

* Corriger menu dossier mobile et décalage clavier ([#151](https://github.com/The-Vibe-Company/companion/issues/151)) ([8068925](https://github.com/The-Vibe-Company/companion/commit/8068925f6a5ec5c6b7a40b36398bd4f9be04708d))


### Bug Fixes

* **codex:** fix 3 critical bugs in Codex backend integration ([#147](https://github.com/The-Vibe-Company/companion/issues/147)) ([0ec92db](https://github.com/The-Vibe-Company/companion/commit/0ec92db909c7be42f94cc21d2890c9c123702dd7))
* **web:** deduplicate messages on WebSocket reconnection ([#150](https://github.com/The-Vibe-Company/companion/issues/150)) ([a81bb3d](https://github.com/The-Vibe-Company/companion/commit/a81bb3d878957f1f18234a5f9194d1d8064f795c))

## [0.21.0](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.20.3...the-vibe-companion-v0.21.0) (2026-02-11)


### Features

* Hide successful no-output command results ([#139](https://github.com/The-Vibe-Company/companion/issues/139)) ([a66e386](https://github.com/The-Vibe-Company/companion/commit/a66e386491e6887c5684cd70f63cc49cac0a64b7))

## [0.20.3](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.20.2...the-vibe-companion-v0.20.3) (2026-02-11)


### Bug Fixes

* **web:** enable codex web search when internet toggle is on ([#135](https://github.com/The-Vibe-Company/companion/issues/135)) ([8d9f0b0](https://github.com/The-Vibe-Company/companion/commit/8d9f0b002dcafcfc020862cb107777d75fc2580e))
* **web:** fetch and pull selected branch on session create ([#137](https://github.com/The-Vibe-Company/companion/issues/137)) ([9cdbbe1](https://github.com/The-Vibe-Company/companion/commit/9cdbbe1e151f024bd41f60e20c60e2f092ba7014))

## [0.20.2](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.20.1...the-vibe-companion-v0.20.2) (2026-02-11)


### Bug Fixes

* **web:** resolve [object Object] display for Codex file edit results ([#133](https://github.com/The-Vibe-Company/companion/issues/133)) ([9cc21a7](https://github.com/The-Vibe-Company/companion/commit/9cc21a78064cf07bb90174dd87bbfbd367516c90))

## [0.20.1](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.20.0...the-vibe-companion-v0.20.1) (2026-02-11)


### Bug Fixes

* **web:** always generate unique branch names for worktrees with forceNew ([#131](https://github.com/The-Vibe-Company/companion/issues/131)) ([cd62d4a](https://github.com/The-Vibe-Company/companion/commit/cd62d4ac8fae0b56cdef0ff850eab4a8c707f99b))

## [0.20.0](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.19.1...the-vibe-companion-v0.20.0) (2026-02-11)


### Features

* **landing:** add marketing landing page for thecompanion.sh ([#128](https://github.com/The-Vibe-Company/companion/issues/128)) ([170b89c](https://github.com/The-Vibe-Company/companion/commit/170b89c72012dfb0ba68239a7665634d65275aa3))
* **web:** warn when branch is behind remote before session creation ([#127](https://github.com/The-Vibe-Company/companion/issues/127)) ([ef89d5c](https://github.com/The-Vibe-Company/companion/commit/ef89d5c208ca5da006aaa88b78dbd647186fb0df))

## [0.19.1](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.19.0...the-vibe-companion-v0.19.1) (2026-02-11)


### Bug Fixes

* **web:** default folder picker to home directory instead of server cwd ([#122](https://github.com/The-Vibe-Company/companion/issues/122)) ([7b8a4c7](https://github.com/The-Vibe-Company/companion/commit/7b8a4c71f32c68ffcc907269e88b3711c0d5af7a))

## [0.19.0](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.18.1...the-vibe-companion-v0.19.0) (2026-02-11)


### Features

* **web:** add PWA support for mobile home screen install ([#116](https://github.com/The-Vibe-Company/companion/issues/116)) ([85e605f](https://github.com/The-Vibe-Company/companion/commit/85e605fd758ee952e0d5b1dbc6f7065b514844a7))

## [0.18.1](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.18.0...the-vibe-companion-v0.18.1) (2026-02-11)


### Bug Fixes

* **web:** resolve original repo root for worktree sessions in sidebar grouping ([#120](https://github.com/The-Vibe-Company/companion/issues/120)) ([8925ac9](https://github.com/The-Vibe-Company/companion/commit/8925ac9f540b3cd2520268539d21b0267b2dadb1))

## [0.18.0](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.17.1...the-vibe-companion-v0.18.0) (2026-02-11)


### Features

* **web:** group sidebar sessions by project directory ([#117](https://github.com/The-Vibe-Company/companion/issues/117)) ([deceb59](https://github.com/The-Vibe-Company/companion/commit/deceb599975f53141e9c0bd6c7675437f96978b8))
* **web:** redesign session list with avatars, auto-reconnect, and git info ([#111](https://github.com/The-Vibe-Company/companion/issues/111)) ([8a7284b](https://github.com/The-Vibe-Company/companion/commit/8a7284b3c08dc301a879924aea133945697b037a))

## [0.17.1](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.17.0...the-vibe-companion-v0.17.1) (2026-02-11)


### Bug Fixes

* **web:** prevent iOS auto-zoom on mobile input focus ([#102](https://github.com/The-Vibe-Company/companion/issues/102)) ([18ee23f](https://github.com/The-Vibe-Company/companion/commit/18ee23f6f1674fbcf5e1be25f8c4e23510bc12b5))

## [0.17.0](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.16.0...the-vibe-companion-v0.17.0) (2026-02-11)


### Features

* **web:** add per-session usage limits with OAuth refresh and Codex support ([24ebd32](https://github.com/The-Vibe-Company/companion/commit/24ebd32f5ec617290b6b93e8bc76972a3b80d6a9))


### Bug Fixes

* **web:** fix WritableStream locked race condition in Codex adapter ([b43569d](https://github.com/The-Vibe-Company/companion/commit/b43569dbb3d154a303d60ec6bc2007b5a7bcedea))

## [0.16.0](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.15.0...the-vibe-companion-v0.16.0) (2026-02-11)


### Features

* **web:** add usage limits display in session panel ([#97](https://github.com/The-Vibe-Company/companion/issues/97)) ([d29f489](https://github.com/The-Vibe-Company/companion/commit/d29f489ed9951d36ff45ec240410ffd8ffdf05eb))


### Bug Fixes

* **web:** fix Codex approval policy and Composer mode labels ([#106](https://github.com/The-Vibe-Company/companion/issues/106)) ([fd5c2f1](https://github.com/The-Vibe-Company/companion/commit/fd5c2f15b144eb2ae9ec809fdb6ee19e797dc15a))

## [0.15.0](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.14.1...the-vibe-companion-v0.15.0) (2026-02-10)


### Features

* **web:** add notification sound on task completion ([#99](https://github.com/The-Vibe-Company/companion/issues/99)) ([337c735](https://github.com/The-Vibe-Company/companion/commit/337c735e8267f076ada4b9ef01632d37376ec2d0))
* **web:** add OpenAI Codex CLI backend integration ([#100](https://github.com/The-Vibe-Company/companion/issues/100)) ([54e3c1a](https://github.com/The-Vibe-Company/companion/commit/54e3c1a2b359719d7983fa9ee857507e1446f505))


### Bug Fixes

* use random suffixes for worktree branch names ([#88](https://github.com/The-Vibe-Company/companion/issues/88)) ([0b79f9a](https://github.com/The-Vibe-Company/companion/commit/0b79f9af172595cb84810b5d4cd65e0ed9c8e23d))
* **web:** improve light mode contrast ([#89](https://github.com/The-Vibe-Company/companion/issues/89)) ([7ac7886](https://github.com/The-Vibe-Company/companion/commit/7ac7886fc6305e3ec45698a1c7c91b72a91c7c44))

## [0.14.1](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.14.0...the-vibe-companion-v0.14.1) (2026-02-10)


### Bug Fixes

* **web:** fix session auto-rename and add blur-to-focus animation ([#86](https://github.com/The-Vibe-Company/companion/issues/86)) ([6d3c91f](https://github.com/The-Vibe-Company/companion/commit/6d3c91f73a65054e2c15727e90ca554af70eed28))
* **web:** improve responsive design across all components ([#85](https://github.com/The-Vibe-Company/companion/issues/85)) ([0750fbb](https://github.com/The-Vibe-Company/companion/commit/0750fbbbe456d79bc104fdbdaf8f08e8795a3b62))

## [0.14.0](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.13.0...the-vibe-companion-v0.14.0) (2026-02-10)


### Features

* **web:** add embedded code editor with file tree, changed files tracking, and diff view ([#81](https://github.com/The-Vibe-Company/companion/issues/81)) ([3ed0957](https://github.com/The-Vibe-Company/companion/commit/3ed095790c73edeef911ab4c73d74f1998100c5c))
* **web:** session rename persistence + auto-generated titles ([#79](https://github.com/The-Vibe-Company/companion/issues/79)) ([e1dc58c](https://github.com/The-Vibe-Company/companion/commit/e1dc58ce8ab9a619d36f2261cce89b90cfdb70d6))

## [0.13.0](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.12.1...the-vibe-companion-v0.13.0) (2026-02-10)


### Features

* **web:** replace folder picker dropdown with fixed-size modal ([#76](https://github.com/The-Vibe-Company/companion/issues/76)) ([979e395](https://github.com/The-Vibe-Company/companion/commit/979e395b530cdb21e6a073ba60e33ea8ac497e2a))

## [0.12.1](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.12.0...the-vibe-companion-v0.12.1) (2026-02-10)


### Bug Fixes

* **web:** isolate worktree sessions with proper branch-tracking ([#74](https://github.com/The-Vibe-Company/companion/issues/74)) ([764d7a7](https://github.com/The-Vibe-Company/companion/commit/764d7a7f5391a686408a8542421f771da341d5db))

## [0.12.0](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.11.0...the-vibe-companion-v0.12.0) (2026-02-10)


### Features

* **web:** git fetch on branch picker open ([#72](https://github.com/The-Vibe-Company/companion/issues/72)) ([f110405](https://github.com/The-Vibe-Company/companion/commit/f110405edbd0f00454edd65ed72197daf0293182))

## [0.11.0](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.10.0...the-vibe-companion-v0.11.0) (2026-02-10)


### Features

* **web:** add Clawd-inspired pixel art logo and favicon ([#70](https://github.com/The-Vibe-Company/companion/issues/70)) ([b3994ef](https://github.com/The-Vibe-Company/companion/commit/b3994eff2eac62c3cf8f40a8c31b720c910a7601))
* **web:** enlarge homepage logo as hero element ([#71](https://github.com/The-Vibe-Company/companion/issues/71)) ([18ead74](https://github.com/The-Vibe-Company/companion/commit/18ead7436d3ebbe9d766754ddb17aa504c63703f))


### Bug Fixes

* checkout selected branch when worktree mode is off ([#68](https://github.com/The-Vibe-Company/companion/issues/68)) ([500f3b1](https://github.com/The-Vibe-Company/companion/commit/500f3b112c5ccc646c7965344b5774efe1338377))

## [0.10.0](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.9.0...the-vibe-companion-v0.10.0) (2026-02-10)


### Features

* **web:** git worktree support with branch picker and git pull ([#65](https://github.com/The-Vibe-Company/companion/issues/65)) ([4d0c9c8](https://github.com/The-Vibe-Company/companion/commit/4d0c9c83f4fe13be863313d6c945ce0b671a7f8a))

## [0.9.0](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.8.1...the-vibe-companion-v0.9.0) (2026-02-10)


### Features

* claude.md update ([7fa4e7a](https://github.com/The-Vibe-Company/companion/commit/7fa4e7adfdc7c409cfeed4e8a11f237ff0572234))
* **web:** add git worktree support for isolated multi-branch sessions ([#64](https://github.com/The-Vibe-Company/companion/issues/64)) ([fee39d6](https://github.com/The-Vibe-Company/companion/commit/fee39d62986cd99700ba78c84a1f586331955ff8))

## [0.8.1](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.8.0...the-vibe-companion-v0.8.1) (2026-02-10)


### Bug Fixes

* **web:** chat scroll and composer visibility in plan mode ([#55](https://github.com/The-Vibe-Company/companion/issues/55)) ([4cff10c](https://github.com/The-Vibe-Company/companion/commit/4cff10cde297b7142c088584b6dd83060902c526))

## [0.8.0](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.7.0...the-vibe-companion-v0.8.0) (2026-02-10)


### Features

* **web:** archive sessions instead of deleting them ([#56](https://github.com/The-Vibe-Company/companion/issues/56)) ([489d608](https://github.com/The-Vibe-Company/companion/commit/489d6087fc99b9131386547edaf3bd303a114090))

## [0.7.0](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.6.1...the-vibe-companion-v0.7.0) (2026-02-10)


### Features

* **web:** named environment profiles (~/.companion/envs/) ([#50](https://github.com/The-Vibe-Company/companion/issues/50)) ([eaa1a49](https://github.com/The-Vibe-Company/companion/commit/eaa1a497f3be61f2f71f9467e93fa2b65be19095))

## [0.6.1](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.6.0...the-vibe-companion-v0.6.1) (2026-02-10)


### Bug Fixes

* **web:** session reconnection with auto-relaunch and persist ([#49](https://github.com/The-Vibe-Company/companion/issues/49)) ([f58e542](https://github.com/The-Vibe-Company/companion/commit/f58e5428847a342069e6790fa7d70f190bc5f396))
* **web:** use --resume on CLI relaunch to restore conversation context ([#46](https://github.com/The-Vibe-Company/companion/issues/46)) ([3e2b5bd](https://github.com/The-Vibe-Company/companion/commit/3e2b5bdd39bd265ca5675784227a9f1b4f2a8aa3))

## [0.6.0](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.5.0...the-vibe-companion-v0.6.0) (2026-02-10)


### Features

* **web:** git info display, folder dropdown fix, dev workflow ([#43](https://github.com/The-Vibe-Company/companion/issues/43)) ([1fe2069](https://github.com/The-Vibe-Company/companion/commit/1fe2069a7db17b410e383f883c934ee1662c2171))
* **web:** persist sessions to disk for dev mode resilience ([#45](https://github.com/The-Vibe-Company/companion/issues/45)) ([c943d00](https://github.com/The-Vibe-Company/companion/commit/c943d0047b728854f059e26facde950e08cdfe0c))

## [0.5.0](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.4.0...the-vibe-companion-v0.5.0) (2026-02-09)


### Features

* **web:** add permission suggestions and pending permission indicators ([10422c1](https://github.com/The-Vibe-Company/companion/commit/10422c1464b6ad4bc45eb90e6cd9ebbc0ebeac92))

## [0.4.0](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.3.0...the-vibe-companion-v0.4.0) (2026-02-09)


### Features

* **web:** add component playground and ExitPlanMode display ([#36](https://github.com/The-Vibe-Company/companion/issues/36)) ([e958be7](https://github.com/The-Vibe-Company/companion/commit/e958be780f1b6e1a8f65daedbf968cdf6ef47798))

## [0.3.0](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.2.2...the-vibe-companion-v0.3.0) (2026-02-09)


### Features

* allow dev server access over Tailscale/LAN ([#33](https://github.com/The-Vibe-Company/companion/issues/33)) ([9599d7a](https://github.com/The-Vibe-Company/companion/commit/9599d7ad4e2823d51c8fa262e1dcd96eeb056244))


### Bug Fixes

* scope permission requests to their session tab ([#35](https://github.com/The-Vibe-Company/companion/issues/35)) ([ef9f41c](https://github.com/The-Vibe-Company/companion/commit/ef9f41c8589e382de1db719984931bc4e91aeb11))

## [0.2.2](https://github.com/The-Vibe-Company/companion/compare/the-vibe-companion-v0.2.1...the-vibe-companion-v0.2.2) (2026-02-09)


### Bug Fixes

* remove vibe alias, update repo URLs to companion ([#30](https://github.com/The-Vibe-Company/companion/issues/30)) ([4f7b47c](https://github.com/The-Vibe-Company/companion/commit/4f7b47cba86c278e89fe81292fea9b8b3e75c035))
* show pasted images in chat history ([#32](https://github.com/The-Vibe-Company/companion/issues/32)) ([46365be](https://github.com/The-Vibe-Company/companion/commit/46365be45ae8b325100ed296617455c105d4d52e))

## [0.2.1](https://github.com/The-Vibe-Company/claude-code-controller/compare/the-vibe-companion-v0.2.0...the-vibe-companion-v0.2.1) (2026-02-09)


### Bug Fixes

* track all commits in release-please, not just web/ ([#27](https://github.com/The-Vibe-Company/claude-code-controller/issues/27)) ([d49f649](https://github.com/The-Vibe-Company/claude-code-controller/commit/d49f64996d02807baf0482ce3c3607ae59f78638))
* use correct secret name NPM_PUBLISH_TOKEN in publish workflow ([e296ab0](https://github.com/The-Vibe-Company/claude-code-controller/commit/e296ab0fabd6345b1f21c7094ca1f8d6f6af79cb))
* use correct secret name NPM_PUBLISH_TOKEN in publish workflow ([#26](https://github.com/The-Vibe-Company/claude-code-controller/issues/26)) ([61eed5a](https://github.com/The-Vibe-Company/claude-code-controller/commit/61eed5addd6e332fac360d9ae8239f1b0f93868e))
