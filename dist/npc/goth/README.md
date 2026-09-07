# Editing your girlfriend

These files define her character. You can edit them with any text editor. During local development, save your changes and refresh the browser. This starts a fresh conversation with the updated files. You do not need to retrain or reconvert the model. After editing a deployed copy of the project, rebuild and deploy the site to publish the new files.

| File | What to change |
| --- | --- |
| `system.md` | The complete system prompt: who she is, her personality, and how she talks. Always included in every reply. |
| `character.json` | UI name, opening line, example replies, model, temperature, reply length and the list of lore files. |
| `lore/girlfriend.md` | Her home, interests and established relationship details. |
| `lore/town.md` | Buildings, world background and places she knows. |
| `lore/gameplay.md` | Controls and game mechanics she can explain. |

She is currently unnamed: “Your girlfriend” is a UI label, not a personal name. You and she are already an adult couple. Her default tone is dry, goth, commanding and dominant. Change `system.md` when you want to change this.

## Adding knowledge

1. Create a Markdown file such as `lore/secrets.md`.
2. Add `"lore/secrets.md"` to `knowledgeFiles` in `character.json`. Remember JSON commas and quotes.
3. Use descriptive headings and short paragraphs:

```markdown
# The locked bell tower
The bell tower was sealed after the old bell cracked. Your girlfriend has heard the sound at night, but does not know what causes it.
```

The above is an example of lore you could invent; it is not part of the current game. Write established facts clearly and distinguish rumors from facts. Files listed in the JSON manifest are the only lore files loaded. Names may contain letters, digits, underscores and hyphens.

The retriever ranks passages by words shared with the current question only. It adds up to three passages that fit the prompt budget. This is lexical RAG, not embedding search. Descriptive headings, recognizable place names and explicit facts help it find the right passages. Keep one game mechanic per section: listing five different keys in one passage made the tiny model confuse the controls during testing. Expand **Conversation notes** after a reply to see what was selected.

## Keeping a tiny model focused

The system prompt is limited to 2,100 UTF-8 bytes. Lore files can each be up to 64 KB; up to 32 files can be listed. Keep individual topics short. Long lore sections are split into passages automatically.

A prompt contains the system prompt + up to two example conversations + your latest message with retrieved facts beside it. Optional example replies in `styleExamples` can establish her voice. The default is an empty list: in testing, this 360M model sometimes copied an example instead of answering the new question. Add examples cautiously. Each example allows up to 100 UTF-8 bytes for the user line and 160 bytes for her reply. Prompt content is bounded to 3,400 UTF-8 bytes, leaving room for ChatML framing and the reply in a 4,096-token context. User input sent to the model is limited to 600 UTF-8 bytes (the input field also has a 400-character limit). Each message is independent: no previous user messages or replies are sent to the model, and lore retrieval uses only the current message. The engine resets its chat before each reply. Visible bubbles remain for the player to read.

`temperature` controls variation: a lower value is usually more consistent, a higher value more varied. It cannot fix reasoning errors. `maxReplyTokens` controls the maximum generated length; the default is 160 and supported values are 32–192. She is prompted to use one or two sentences.

The 360M model can still misunderstand questions, forget instructions, invent details or slip out of character. RAG supplies facts; it does not train them into the model or guarantee compliance. Try a few representative conversations before adding lots of rules. A short concrete instruction usually works better than a long list.

## Model and privacy

The default model is `SmolLM2-360M-Instruct-q0f16-MLC` from WebLLM's built-in catalog. `q0` means unquantized weights; `f16` means 16-bit floating point. It runs in a browser worker using WebGPU. After approval, the browser downloads model assets from Hugging Face and MLC's model-library host and caches them for later use. The model repository totals about 727 MB; the notice rounds this to roughly 730 MB. GPU memory use is separate: WebLLM estimates about 872 MB for this model, before the game and other browser work.

Chat messages are not sent to an AI server. The visible transcript stays in this page's memory but is never included in subsequent model requests. Refreshing, resetting the conversation, or leaving/rebuilding the world clears the conversation. Closing the panel keeps completed turns for reopening during the same world. Model files can remain in the browser cache. These character files are public website assets: visitors can read them.

Use HTTPS or `localhost`, and a WebGPU-capable browser/GPU. Both f16 builds require `shader-f16`. If the UI reports that it is missing, change `modelId` to `SmolLM2-360M-Instruct-q4f32_1-MLC` and refresh the page. That fallback uses 4-bit weights and 32-bit computation, with an estimated 580 MB of GPU memory. There is no automatic model switch or cloud fallback.

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

Before any character-file fetch or WebLLM/model load, a first-use information banner requires explicit approval. It explains AI limitations, local processing, external model downloads and browser storage, and links to WebLLM and the site’s existing legal pages. Approval uses the versioned localStorage key `testfps.goth-chat-consent.v2`. Clearing site data shows the notice again. If storage is unavailable, approval lasts only for this page. To revise the notice materially, update its copy in `src/gothChat.ts` and bump the key in `src/gothChatConsent.ts`. The notice is a technical explanation, not a replacement for the site’s legal documents.

### Changing the model yourself

Edit `modelId` in `public/npc/goth/character.json`, save, and refresh the game page. The next approved interaction loads that model. Your RAG files and animation setup do not change.

| Model ID | Weights / computation | Estimated GPU memory |
| --- | --- | --- |
| `SmolLM2-360M-Instruct-q0f16-MLC` | Unquantized / float16 (current default) | 872 MB |
| `SmolLM2-360M-Instruct-q4f16_1-MLC` | 4-bit / float16 (previous default) | 376 MB |
| `SmolLM2-360M-Instruct-q4f32_1-MLC` | 4-bit / float32 | 580 MB |

These IDs are accepted by `validateCharacterConfig` in `src/gothKnowledge.ts`. Other models also need validation and prompt-budget review. For a deployed site, rebuild and deploy after editing. The first-use notice lives in `src/gothChat.ts`; revise its size estimate and bump the consent key if changing the default materially changes download requirements. Higher precision removes 4-bit quantization loss, but the model still has 360M parameters and may give unreliable replies.
