# Editing your girlfriend

These files define her character. You can edit them with any text editor. During local development, save your changes and refresh the browser. This starts a fresh conversation with the updated files. You do not need to retrain or reconvert the model. After editing a deployed copy of the project, rebuild and deploy the site to publish the new files.

| File | What to change |
| --- | --- |
| `system.md` | The complete system prompt: who she is, her personality, and how she talks. Always included in every reply. |
| `character.json` | UI name, opening line, example replies, model, temperature, reply length and the list of lore files. |
| `lore/player.md` | The player’s identity and past. |
| `lore/town.md` | Buildings, world background and places she knows. |
| `lore/gameplay.md` | Controls and game mechanics she can explain. |

She is currently unnamed: “Your girlfriend” is a UI label, not a personal name. You and she are already a couple. Her default tone is dry, goth, commanding and dominant. Change `system.md` when you want to change this.

## Adding knowledge

1. Create a Markdown file such as `lore/secrets.md`.
2. Add `"lore/secrets.md"` to `knowledgeFiles` in `character.json`. Remember JSON commas and quotes.
3. Use descriptive headings and short paragraphs:

```markdown
# The locked bell tower
The bell tower was sealed after the old bell cracked. The girlfriend has heard the sound at night, but does not know what causes it.
```

The above is an example of lore you could invent; it is not part of the current game. Write established facts clearly and distinguish rumors from facts. Files listed in the JSON manifest are the only lore files loaded. Names may contain letters, digits, underscores and hyphens.

The retriever ranks passages by words shared with the current question only. First-person references in the player’s question also search for “player”, second-person references search for “girlfriend”, and common questions about what happened also search for past/history. It adds up to three passages that fit the prompt budget. This is lexical RAG, not embedding search. Descriptive headings, recognizable place names and explicit facts help it find the right passages. Keep one game mechanic per section: listing five different keys in one passage made the tiny model confuse the controls during testing. Expand **Conversation notes** after a reply to see what was selected.

## Keeping a tiny model focused

The system prompt is limited to 2,100 UTF-8 bytes. Lore files can each be up to 64 KB; up to 32 files can be listed. Keep individual topics short. Long lore sections are split into passages automatically.

The system message contains `system.md` followed by clearly labeled retrieved background facts. The user message contains only the player’s latest text. Optional example conversations appear between them. Write system instructions as “You are…” addressing the girlfriend. Write background facts with explicit subjects: “The girlfriend collects old books” or “The player has been asleep for years.” Avoid “you”, “your” or an unidentified “I” in lore: those can refer to either speaker. Two short `styleExamples` demonstrate “Who am I?” versus “Who are you?” using actual user/assistant message roles. They are fixed demonstrations, not remembered chat history; you can edit or remove them in `character.json`. Each example allows up to 100 UTF-8 bytes for the user line and 160 bytes for her reply. Prompt content is bounded to at most 12,000 UTF-8 bytes, reduced as needed to reserve the reply limit and message framing. Hermes and Qwen use a 16,384-token context; SmolLM2 uses 8,192. The system prompt, examples, latest message and relevant lore take priority. The newest completed exchanges fill the remaining space, with older exchanges dropped in complete pairs. User input sent to the model is limited to 600 UTF-8 bytes (the input field also has a 400-character limit).

Messages in the same open interaction share conversation history. Only successfully completed exchanges are remembered; interrupted or failed replies are excluded. Closing chat clears the transcript, draft and history. Interacting again starts a fresh conversation with the greeting. The loaded model can stay ready between interactions. Internally, the engine rebuilds its cache for updated RAG facts, but receives the retained conversation with every request. Lore retrieval searches the latest message; earlier exchanges remain available to interpret follow-up questions.

`temperature` controls variation: a lower value is usually more consistent, a higher value more varied. It cannot fix reasoning errors. `maxReplyTokens` controls the maximum generated length; the current value is 4,096 and supported values are 32–4,096. The token budget includes hidden thinking as well as the spoken answer. For the Qwen fallback, thinking is enabled in `src/gothChatEngine.ts` via `extra_body.enable_thinking`; generated thinking blocks are hidden from the chat.

The model can still misunderstand questions, forget instructions, invent details or slip out of character. RAG supplies facts; it does not train them into the model or guarantee compliance. Try a few representative conversations before adding lots of rules. A short concrete instruction usually works better than a long list.

## Model and privacy

The default model is `Hermes-3-Llama-3.2-3B-q4f16_1-MLC` from WebLLM's built-in catalog. Hermes produces direct replies; Qwen-specific thinking settings are only sent when a Qwen model is selected. `q4` means 4-bit weights; `f16` means 16-bit computation. It runs in a browser worker using WebGPU. After approval, the browser downloads model assets from Hugging Face and MLC's model-library host and caches them for later use. The model repository is about 1.82 GB; the notice rounds this to roughly 1.8 GB. WebLLM estimates about 2.26 GB of GPU memory for the model, before additional memory for the larger context, game and browser usage.

Chat messages are not sent to an AI server. The current interaction’s completed exchanges are included in subsequent model requests locally. Closing the panel, refreshing, resetting the conversation, or leaving/rebuilding the world clears the conversation. Model files can remain in the browser cache. These character files are public website assets: visitors can read them.

Use HTTPS or `localhost`, and a WebGPU-capable browser/GPU. The f16 builds require `shader-f16`. If the UI reports that it is missing, change `modelId` to `Hermes-3-Llama-3.2-3B-q4f32_1-MLC` and refresh the page. That fallback uses 4-bit weights and 32-bit computation, with an estimated 2.95 GB of GPU memory. There is no automatic model switch or cloud fallback.

## Implementation map

- `src/gothKnowledge.ts`: file loading, validation, passage splitting, lexical ranking and prompt construction.
- `src/gothChatEngine.ts` and `src/gothChat.worker.ts`: WebLLM loading, progress, streamed replies, timeouts and cancellation.
- `src/gothChat.ts` and `src/gothChat.css`: chat UI and conversation lifetime.
- `src/main.ts`: F-key interaction, pointer-lock release/resume, input guards and world/death cleanup.
- `src/gothGirlfriend.ts`: greeting wave and queued talking gestures on the existing rig.

F opens the panel and plays a wave. On the first generated text of each reply, a talking gesture is queued; if the wave is still playing, it finishes first. Talking gestures are Explain, Shrug or Agree, with no consecutive repeat. The opening line is editable scripted text; subsequent answers come from WebLLM. This first version is typed dialogue and does not synthesize audio.

Closing while loading or generating terminates that worker and interrupts the unfinished reply. An idle loaded engine is kept for reopening. A new reply is never run concurrently with an existing reply. All model output is rendered as plain text, not executable HTML.

For direct testing, open `/tests/goth-chat-preview.html` on the Vite server. It uses the actual character, town, chat UI, retriever and WebLLM model. It avoids requiring pointer lock to reach the character and is excluded from the production build.

References: [WebLLM basic usage](https://webllm.mlc.ai/docs/user/basic_usage.html), [WebLLM workers](https://webllm.mlc.ai/docs/user/advanced_usage.html), [model catalog](https://github.com/mlc-ai/web-llm/blob/main/src/config.ts).

## Chat controls and first-use information

In singleplayer and for the multiplayer lobby creator/host, F opens the conversation, plays her wave, and smoothly moves the player to a centered position in front of her over 0.55 seconds, looking toward her face. Joined multiplayer players see her standing there with no interaction prompt; F does nothing for them. The game HUD is hidden until Esc returns to play. Type into the bottom bar and press Enter to send; you can draft the next message while she replies. The mouse wheel scrolls the conversation even when the pointer is over the scene. Your messages are blue with right-pointing tails; hers are white with left-pointing tails.

Before any character-file fetch or WebLLM/model load, a first-use information banner requires explicit approval. It explains AI limitations, local processing, external model downloads and browser storage, and links to WebLLM and the site’s existing legal pages. Approval uses the versioned localStorage key `testfps.goth-chat-consent.v4`. Clearing site data shows the notice again. If storage is unavailable, approval lasts only for this page. To revise the notice materially, update its copy in `src/gothChat.ts` and bump the key in `src/gothChatConsent.ts`. The notice is a technical explanation, not a replacement for the site’s legal documents.

### Changing the model yourself

Edit `modelId` in `public/npc/goth/character.json`, save, and refresh the game page. The next approved interaction loads that model. Your RAG files and animation setup do not change.

| Model ID | Weights / computation | Estimated GPU memory |
| --- | --- | --- |
| `Hermes-3-Llama-3.2-3B-q4f16_1-MLC` | 4-bit / float16 (current default) | 2,264 MB |
| `Hermes-3-Llama-3.2-3B-q4f32_1-MLC` | 4-bit / float32 | 2,952 MB |
| `Qwen3.5-2B-q4f16_1-MLC` | 4-bit / float16 (previous default) | 2,245 MB |
| `Qwen3.5-2B-q4f32_1-MLC` | 4-bit / float32 | 2,592 MB |
| `SmolLM2-360M-Instruct-q0f16-MLC` | Unquantized / float16 (previous default) | 872 MB |
| `SmolLM2-360M-Instruct-q4f16_1-MLC` | 4-bit / float16 (previous default) | 376 MB |
| `SmolLM2-360M-Instruct-q4f32_1-MLC` | 4-bit / float32 | 580 MB |

These IDs are accepted by `validateCharacterConfig` in `src/gothKnowledge.ts`. Other models also need validation and prompt-budget review. For a deployed site, rebuild and deploy after editing. The first-use notice lives in `src/gothChat.ts`; revise its size estimate and bump the consent key if changing the default materially changes download requirements. SmolLM2 remains available as a smaller fallback. All supported models can still give unreliable replies.


### Loading the model at page startup

The game settings include **Download WebLLM Model Immediately**, off by default. Checking it opens the same AI information window used for the girlfriend. Approval enables the pending setting; declining or pressing Esc leaves it off. Apply saves the setting and reloads the page. On subsequent page loads, saved approval permits background model loading. Cached model files are reused. Without saved approval, automatic loading stays off and interacting with the girlfriend shows the normal approval window.

Starting a game or opening chat reuses an ongoing background load. Closing the conversation clears its messages while an automatic model load can continue. Disabling the setting and applying it stops automatic loading on the reloaded page; it does not delete cached model files.
