# ASD-STE100 Rules for Technical Specifications

## Purpose

This document provides Simplified Technical English (ASD-STE100) writing rules for technical specifications.

## Core Rules

Follow these writing rules for all specifications:

1. **Sentence length.** Write maximum 20 words for instructions. Write maximum 25 words for descriptions.
2. **One idea per sentence.** Do not combine multiple instructions or claims into one sentence.
3. **Active voice.** Use active voice. Use passive voice only when the actor is genuinely unknown.
4. **Paragraph size.** Keep one topic per paragraph. Write maximum six sentences per paragraph.
5. **No filler words.** Avoid empty adjectives such as "seamless", "robust", "powerful", "flexible", or "smart". State verifiable measurements instead.
6. **Complete sentences.** Do not omit articles ("a", "an", "the") or subjects to make text shorter.
7. **Vertical lists.** Use vertical bulleted or numbered lists for complex series of items.
8. **Short nouns.** Do not use noun clusters with more than three words. Break long noun clusters with prepositions.
9. **British English.** Use British spelling throughout (for example: "behaviour", "synchronise", "catalogue", "programme").

## Word Replacement Table

Use approved, simple words. Replace complex or ambiguous words using this table:

| Do Not Use                 | Approved Alternative                      | Example                                         |
| -------------------------- | ----------------------------------------- | ----------------------------------------------- |
| utilise / utilize          | use                                       | Use the primary key to find the record.         |
| facilitate                 | help / provide / allow                    | The service provides secure access.             |
| leverage                   | use                                       | Use existing tables.                            |
| in order to                | to                                        | Call the endpoint to fetch results.             |
| perform (analysis / check) | analyse / check / run                     | Run the analysis.                               |
| terminate                  | stop / end                                | Stop the session.                               |
| elucidate / clarify        | explain / define                          | Define the state transitions.                   |
| execute                    | run / start                               | Run the batch job.                              |
| optimum / optimal          | best                                      | Select the best index.                          |
| numerous                   | many                                      | Many records failed validation.                 |
| transmit                   | send                                      | Send the event to the queue.                    |
| ascertain                  | verify / check / determine                | Verify that the signature is valid.             |
| subsequently               | then / after                              | Save the record. Then emit the event.           |
| prior to                   | before                                    | Validate input before processing.               |
| robust                     | resilient / fault-tolerant (with metrics) | The process retries three times before failing. |
| seamless                   | direct / uninterrupted                    | The switch takes under 50 milliseconds.         |

## Before and After Examples

### Example 1: Instruction
- **Do not write:** In order to facilitate the optimal execution of the background verification procedure, the operator should make sure to terminate all running tasks prior to initiating the process. (26 words, passive, filler)
- **Write:** Stop all running tasks before you start the verification process. (10 words)

### Example 2: Architecture Description
- **Do not write:** The authentication component leverages a distributed caching infrastructure so as to seamlessly maintain persistent session state across diverse geographical nodes without significant latency overheads. (25 words, vague adjectives)
- **Write:** The authentication component stores session state in a cache cluster. Nodes read the cache in under five milliseconds. (18 words, two sentences)

### Example 3: Error Rule
- **Do not write:** In the event that an invalid payload is encountered, an error notification shall be transmitted by the handler to the upstream caller. (22 words, passive)
- **Write:** When the payload is invalid, the handler returns an error code to the caller. (14 words)
