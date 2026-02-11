# Changelog

## [0.16.0](https://github.com/pannous/companion/compare/the-vibe-companion-v0.15.0...the-vibe-companion-v0.16.0) (2026-02-11)


### Features

* Add permission & plan approval E2E tests ([#6](https://github.com/pannous/companion/issues/6)) ([8590a68](https://github.com/pannous/companion/commit/8590a68657f0a06e94795a179ad4bbedae782c63))
* add release-please for automated npm publishing ([#24](https://github.com/pannous/companion/issues/24)) ([93b24ee](https://github.com/pannous/companion/commit/93b24ee4a12b3f32e81f59a348b25e89aaa86dce))
* allow dev server access over Tailscale/LAN ([#33](https://github.com/pannous/companion/issues/33)) ([9599d7a](https://github.com/pannous/companion/commit/9599d7ad4e2823d51c8fa262e1dcd96eeb056244))
* claude.md update ([7fa4e7a](https://github.com/pannous/companion/commit/7fa4e7adfdc7c409cfeed4e8a11f237ff0572234))
* e2e permissions plans ([#9](https://github.com/pannous/companion/issues/9)) ([53b38bf](https://github.com/pannous/companion/commit/53b38bfd4e773454492a3fea10e8db7ffd3fd768))
* **minor:** add Alt+Ctrl+PageUp/PageDown shortcuts for session navigation ([2744992](https://github.com/pannous/companion/commit/27449920d3429992ea90307416f79a24811b06e2))
* **minor:** add Alt+X keyboard shortcut to archive current session ([60a0053](https://github.com/pannous/companion/commit/60a00533962faa14558b9401f6a5dcd6f1cca656))
* **minor:** add auto title generation from first message ([2aea4f6](https://github.com/pannous/companion/commit/2aea4f6b06acc368f4700b84d1b48724d4aec37a))
* **minor:** add browser back/forward button support for session navigation ([b428ce0](https://github.com/pannous/companion/commit/b428ce0373a85ca21de65ced3269f63b5b5947b3))
* **minor:** add copy buttons to chat messages and conversation ([48ace45](https://github.com/pannous/companion/commit/48ace45934847b6ba621c5f7aa216d577f48e13d))
* **minor:** add Ctrl+S and Ctrl+T keyboard shortcuts to start new session ([4a2e27d](https://github.com/pannous/companion/commit/4a2e27d3dfce2035c8d91275662008df4915f213))
* **minor:** add dangerous skip permissions mode ([795bd42](https://github.com/pannous/companion/commit/795bd42766ece135697b5c4b67736960d5415117))
* **minor:** add error monitor that spawns Claude agent to auto-fix dev errors ([5a5dc95](https://github.com/pannous/companion/commit/5a5dc953648e823dad35a0b7858ea32727bca0ec))
* **minor:** add favicon matching sidebar logo ([3adce6b](https://github.com/pannous/companion/commit/3adce6b53c010929f363b5f3d46b6b33c8341dd2))
* **minor:** add keyboard shortcuts to navigate between sessions ([1b16a04](https://github.com/pannous/companion/commit/1b16a04291b784b4c8690e2ccfb2d511d8945d1a))
* **minor:** add middle mouse button to archive current session ([a2dcf5b](https://github.com/pannous/companion/commit/a2dcf5ba7cba51ea508115e70f9e400c2a3b5748))
* **minor:** add Resume Session button to sidebar ([0609d31](https://github.com/pannous/companion/commit/0609d312554a91e2fe1cd28cffc190e65418f60b))
* **minor:** add working/idle status indicators in session list ([5069cce](https://github.com/pannous/companion/commit/5069cce9b733ab473af229dca5229d6af1446a5e))
* **minor:** auto-collapse archived section after clicking ([9fdfd96](https://github.com/pannous/companion/commit/9fdfd96e361274fdded9338fd6c4ddc9430af505))
* **minor:** auto-detect and display images in assistant messages ([dc809e3](https://github.com/pannous/companion/commit/dc809e35ca2c20a72c5fe5752ccf76b7ff102c38))
* **minor:** change dev server port from 5174 to 2345 ([bee079d](https://github.com/pannous/companion/commit/bee079d9037a1ad43acf381859040c4d3b4083b1))
* **minor:** display auto-generated titles in sidebar ([9184435](https://github.com/pannous/companion/commit/91844355a1b4ffdab5e05f7789fd985efb8ded00))
* **minor:** improve title generation with summarization and manual rename ([2f6a19c](https://github.com/pannous/companion/commit/2f6a19c1df7cc965d7eca2c1ed306086eac543b1))
* **minor:** keep session ID in URL hash for bookmarkable sessions ([6e3f7f7](https://github.com/pannous/companion/commit/6e3f7f710e20885d36c828c3b45e817605f799ca))
* **minor:** live title sync to browsers, createdAt tracking, touch UI fix ([805ce09](https://github.com/pannous/companion/commit/805ce0917c758defae3c2b91cb14ecb0079f7547))
* **minor:** load previous messages when resuming sessions ([ccbef11](https://github.com/pannous/companion/commit/ccbef11830f290a9227b0862aba7d188cc9ce4cb))
* **minor:** populate folder selector with recent Claude projects ([c51a729](https://github.com/pannous/companion/commit/c51a729b87a6748cb223c7d5cfda78e8d93c7eff))
* **minor:** show session name in top bar instead of "Connected" text ([ea8bcdd](https://github.com/pannous/companion/commit/ea8bcddb5a5bc013d7225e9a5803aa46501f6da0))
* protocol conformance fixes and improved E2E tests ([#14](https://github.com/pannous/companion/issues/14)) ([51b13b9](https://github.com/pannous/companion/commit/51b13b9d647de6c92881b1abb61161f39152e0ef))
* Redesign README as a landing page with API-first documentation ([#7](https://github.com/pannous/companion/issues/7)) ([a59e1b4](https://github.com/pannous/companion/commit/a59e1b4604baf87faa32af7d62e4846afae49dbe))
* simplified claude() API, unified endpoints, and landing page README ([#12](https://github.com/pannous/companion/issues/12)) ([aa2e535](https://github.com/pannous/companion/commit/aa2e535fe0a83b726ff2a2c08359e55973a9136b))
* The Vibe Companion complete web UI rewrite + npm package ([#23](https://github.com/pannous/companion/issues/23)) ([0bdc77a](https://github.com/pannous/companion/commit/0bdc77a81b21cd9d08ba29ea48844e73df3a1852))
* trigger release for statusline capture ([#19](https://github.com/pannous/companion/issues/19)) ([cedc9df](https://github.com/pannous/companion/commit/cedc9dfb7445344bdb43a1a756f1d2e538e08c76))
* **web:** add Clawd-inspired pixel art logo and favicon ([#70](https://github.com/pannous/companion/issues/70)) ([b3994ef](https://github.com/pannous/companion/commit/b3994eff2eac62c3cf8f40a8c31b720c910a7601))
* **web:** add component playground and ExitPlanMode display ([#36](https://github.com/pannous/companion/issues/36)) ([e958be7](https://github.com/pannous/companion/commit/e958be780f1b6e1a8f65daedbf968cdf6ef47798))
* **web:** add embedded code editor with file tree, changed files tracking, and diff view ([#81](https://github.com/pannous/companion/issues/81)) ([3ed0957](https://github.com/pannous/companion/commit/3ed095790c73edeef911ab4c73d74f1998100c5c))
* **web:** add git worktree support for isolated multi-branch sessions ([#64](https://github.com/pannous/companion/issues/64)) ([fee39d6](https://github.com/pannous/companion/commit/fee39d62986cd99700ba78c84a1f586331955ff8))
* **web:** add notification sound on task completion ([#99](https://github.com/pannous/companion/issues/99)) ([337c735](https://github.com/pannous/companion/commit/337c735e8267f076ada4b9ef01632d37376ec2d0))
* **web:** add OpenAI Codex CLI backend integration ([#100](https://github.com/pannous/companion/issues/100)) ([54e3c1a](https://github.com/pannous/companion/commit/54e3c1a2b359719d7983fa9ee857507e1446f505))
* **web:** add permission suggestions and pending permission indicators ([10422c1](https://github.com/pannous/companion/commit/10422c1464b6ad4bc45eb90e6cd9ebbc0ebeac92))
* **web:** add usage limits display in session panel ([#97](https://github.com/pannous/companion/issues/97)) ([d29f489](https://github.com/pannous/companion/commit/d29f489ed9951d36ff45ec240410ffd8ffdf05eb))
* **web:** archive sessions instead of deleting them ([#56](https://github.com/pannous/companion/issues/56)) ([489d608](https://github.com/pannous/companion/commit/489d6087fc99b9131386547edaf3bd303a114090))
* **web:** enlarge homepage logo as hero element ([#71](https://github.com/pannous/companion/issues/71)) ([18ead74](https://github.com/pannous/companion/commit/18ead7436d3ebbe9d766754ddb17aa504c63703f))
* **web:** git fetch on branch picker open ([#72](https://github.com/pannous/companion/issues/72)) ([f110405](https://github.com/pannous/companion/commit/f110405edbd0f00454edd65ed72197daf0293182))
* **web:** git info display, folder dropdown fix, dev workflow ([#43](https://github.com/pannous/companion/issues/43)) ([1fe2069](https://github.com/pannous/companion/commit/1fe2069a7db17b410e383f883c934ee1662c2171))
* **web:** git worktree support with branch picker and git pull ([#65](https://github.com/pannous/companion/issues/65)) ([4d0c9c8](https://github.com/pannous/companion/commit/4d0c9c83f4fe13be863313d6c945ce0b671a7f8a))
* **web:** named environment profiles (~/.companion/envs/) ([#50](https://github.com/pannous/companion/issues/50)) ([eaa1a49](https://github.com/pannous/companion/commit/eaa1a497f3be61f2f71f9467e93fa2b65be19095))
* **web:** persist sessions to disk for dev mode resilience ([#45](https://github.com/pannous/companion/issues/45)) ([c943d00](https://github.com/pannous/companion/commit/c943d0047b728854f059e26facde950e08cdfe0c))
* **web:** replace folder picker dropdown with fixed-size modal ([#76](https://github.com/pannous/companion/issues/76)) ([979e395](https://github.com/pannous/companion/commit/979e395b530cdb21e6a073ba60e33ea8ac497e2a))
* **web:** session rename persistence + auto-generated titles ([#79](https://github.com/pannous/companion/issues/79)) ([e1dc58c](https://github.com/pannous/companion/commit/e1dc58ce8ab9a619d36f2261cce89b90cfdb70d6))


### Bug Fixes

* add Ctrl+Delete as alternative archive shortcut for Firefox compatibility ([939ef53](https://github.com/pannous/companion/commit/939ef534a58df33cf6073cb9f6ce8e0dde675dea))
* add exponential backoff to CLI relaunch and WebSocket reconnect ([9ca9d08](https://github.com/pannous/companion/commit/9ca9d08ab1a41ede9cbd6654a79173becfff6876))
* add PNG favicon fallbacks and Apple touch icon for iOS/iPadOS support ([09c50ad](https://github.com/pannous/companion/commit/09c50adf35d554392ec3e0a56bb49068b1906bb5))
* add web/dist to gitignore ([#2](https://github.com/pannous/companion/issues/2)) ([b9ac264](https://github.com/pannous/companion/commit/b9ac264fbb99415517636517e8f503d40fe3253d))
* always update statusLine settings on agent spawn ([#21](https://github.com/pannous/companion/issues/21)) ([71c343c](https://github.com/pannous/companion/commit/71c343cfd29fff3204ad0cc2986ff000d1be5adc))
* apply useWorktree flag from upstream merge ([a49feab](https://github.com/pannous/companion/commit/a49feabb0b61bb1fd08a1c6cbf6728bada8d45e2))
* auto-accept workspace trust prompt and handle idle in ask() ([#16](https://github.com/pannous/companion/issues/16)) ([ded31b4](https://github.com/pannous/companion/commit/ded31b4cf9900f7ed8c3ff373ef16ae8f1e8a886))
* auto-approve permissions in dontAsk mode ([999b1a5](https://github.com/pannous/companion/commit/999b1a5bf24a68368db0a0604a0c389e0f908d06))
* checkout selected branch when worktree mode is off ([#68](https://github.com/pannous/companion/issues/68)) ([500f3b1](https://github.com/pannous/companion/commit/500f3b112c5ccc646c7965344b5774efe1338377))
* correct port numbers in CLAUDE.md (5174 -&gt; 2345 for Vite dev server) ([fa55125](https://github.com/pannous/companion/commit/fa55125649c65a56df4efc5704ef57e464a4b85b))
* correct port numbers in documentation and scripts ([7d80975](https://github.com/pannous/companion/commit/7d80975682f98f8be4c7c8f68eef1eb11bbfb9c1))
* display cost with 2 decimal places instead of 4 ([d836a93](https://github.com/pannous/companion/commit/d836a937ff4b906dfdc4148ea0f32bf0094c21f4))
* display folder and branch name on same line in sidebar session list ([26f552c](https://github.com/pannous/companion/commit/26f552cc34122e74033b536b83e52393ba5667e3))
* ensure cli-launcher cleanup also removes session files ([0075f25](https://github.com/pannous/companion/commit/0075f2506d8f9c81cb6915cdcd1cf1fd46ac3955))
* filter empty user messages and properly extract text from resumed sessions ([2b80cfd](https://github.com/pannous/companion/commit/2b80cfd3dc412a1564b8636da1d52050cdc3c43f))
* gracefully handle missing ANTHROPIC_API_KEY in title generator ([83b5c61](https://github.com/pannous/companion/commit/83b5c61e5e2a5d9c8f79617c1874457e258f4eca))
* keep title stable, show CLI result as subtitle in TopBar ([5195856](https://github.com/pannous/companion/commit/51958563cdf7467a79a861bae14b908f40b515cb))
* prevent crash loop from session accumulation ([00b59d9](https://github.com/pannous/companion/commit/00b59d961f1db28870b1ec3d19d803edf8ead658))
* prevent duplicate message rendering with ID-based deduplication ([ff5e826](https://github.com/pannous/companion/commit/ff5e8266ddf32de9a155a48cd207675f7a4425e1))
* remove vibe alias, update repo URLs to companion ([#30](https://github.com/pannous/companion/issues/30)) ([4f7b47c](https://github.com/pannous/companion/commit/4f7b47cba86c278e89fe81292fea9b8b3e75c035))
* resolve Bun segfault by upgrading to 1.3.9 ([316934b](https://github.com/pannous/companion/commit/316934bd0d849e5de8df6a70b156aabe09297b2c))
* scope permission requests to their session tab ([#35](https://github.com/pannous/companion/issues/35)) ([ef9f41c](https://github.com/pannous/companion/commit/ef9f41c8589e382de1db719984931bc4e91aeb11))
* show Claude-generated session title in top bar instead of random name ([ec47e50](https://github.com/pannous/companion/commit/ec47e50bc55cb426e45881493b009b3c56a1a025))
* show pasted images in chat history ([#32](https://github.com/pannous/companion/issues/32)) ([46365be](https://github.com/pannous/companion/commit/46365be45ae8b325100ed296617455c105d4d52e))
* support browsers with cookies/localStorage disabled ([6658637](https://github.com/pannous/companion/commit/6658637584b6cf296e9c3cb4f1ebcf89afd4835d))
* **test:** resolve Bun test compatibility issues in routes.test.ts ([8d89e39](https://github.com/pannous/companion/commit/8d89e398c7c28175f5be9e494e409ba0826408ec))
* track all commits in release-please, not just web/ ([#27](https://github.com/pannous/companion/issues/27)) ([d49f649](https://github.com/pannous/companion/commit/d49f64996d02807baf0482ce3c3607ae59f78638))
* update tests for Node 25 localStorage, cwd security, and UI changes ([1721ee0](https://github.com/pannous/companion/commit/1721ee002afa72abf78a09155c03e3762d10b5c8))
* use Claude API for intelligent title generation instead of regex patterns ([814db49](https://github.com/pannous/companion/commit/814db49417815fca819645775c7d66c9724e7a18))
* use correct secret name NPM_PUBLISH_TOKEN in publish workflow ([e296ab0](https://github.com/pannous/companion/commit/e296ab0fabd6345b1f21c7094ca1f8d6f6af79cb))
* use correct secret name NPM_PUBLISH_TOKEN in publish workflow ([#26](https://github.com/pannous/companion/issues/26)) ([61eed5a](https://github.com/pannous/companion/commit/61eed5addd6e332fac360d9ae8239f1b0f93868e))
* use random suffixes for worktree branch names ([#88](https://github.com/pannous/companion/issues/88)) ([0b79f9a](https://github.com/pannous/companion/commit/0b79f9af172595cb84810b5d4cd65e0ed9c8e23d))
* **web:** chat scroll and composer visibility in plan mode ([#55](https://github.com/pannous/companion/issues/55)) ([4cff10c](https://github.com/pannous/companion/commit/4cff10cde297b7142c088584b6dd83060902c526))
* **web:** fix session auto-rename and add blur-to-focus animation ([#86](https://github.com/pannous/companion/issues/86)) ([6d3c91f](https://github.com/pannous/companion/commit/6d3c91f73a65054e2c15727e90ca554af70eed28))
* **web:** improve light mode contrast ([#89](https://github.com/pannous/companion/issues/89)) ([7ac7886](https://github.com/pannous/companion/commit/7ac7886fc6305e3ec45698a1c7c91b72a91c7c44))
* **web:** improve responsive design across all components ([#85](https://github.com/pannous/companion/issues/85)) ([0750fbb](https://github.com/pannous/companion/commit/0750fbbbe456d79bc104fdbdaf8f08e8795a3b62))
* **web:** isolate worktree sessions with proper branch-tracking ([#74](https://github.com/pannous/companion/issues/74)) ([764d7a7](https://github.com/pannous/companion/commit/764d7a7f5391a686408a8542421f771da341d5db))
* **web:** session reconnection with auto-relaunch and persist ([#49](https://github.com/pannous/companion/issues/49)) ([f58e542](https://github.com/pannous/companion/commit/f58e5428847a342069e6790fa7d70f190bc5f396))
* **web:** use --resume on CLI relaunch to restore conversation context ([#46](https://github.com/pannous/companion/issues/46)) ([3e2b5bd](https://github.com/pannous/companion/commit/3e2b5bdd39bd265ca5675784227a9f1b4f2a8aa3))

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
